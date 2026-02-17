import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ToastAndroid,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  AppState,
  AppStateStatus,
  Animated,
  ListRenderItem,
  InteractionManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import * as ImagePicker from 'react-native-image-picker';
import { AppData } from './types';
import {
  INITIAL_NUM_TO_RENDER,
  MAX_TO_RENDER_PER_BATCH,
  WINDOW_SIZE,
  UPDATE_CELLS_BATCHING_PERIOD,
} from './constants';
import {
  initializeStorage,
  loadUserPreferences,
  saveAvatar,
} from './utils/storage';
import { useAppManagement, useUserSettings } from './hooks/useAppManagement';
import AppItem from './components/AppItem';
import SimpleDock from './components/SimpleDock';
import SettingsModal from './components/SettingsModal';
import AppActionModal from './components/AppActionModal';

// ─── Static mask (never re-creates) ──────────────────────────────────────────
const MaskElement = (
  <View style={{ flex: 1 }}>
    <View style={{ height: 20, backgroundColor: 'transparent' }} />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.3)', 'black']}
      locations={[0, 0.1, 0.3]}
      style={{ height: 35 }}
    />
    <LinearGradient
      colors={['black', 'black', 'rgba(0,0,0,0.5)', 'transparent']}
      locations={[0, 0.98, 0.99, 1]}
      style={{ flex: 1 }}
    />
    <View style={{ height: 110, backgroundColor: 'transparent' }} />
  </View>
);

// ─── Rubber Band Hook ─────────────────────────────────────────────────────────
// When scroll reaches top or bottom edge, icons near that edge get
// a "rubber-pulled" effect: scaleY squish + translateY shift,
// proportional to their distance from the edge row.
// On release, they spring back naturally.
//
// shared state exposed via a ref so AppItem can read it without re-renders.
const ICON_SIZE       = 90;   // must match getItemLayout length
const NUM_COLS        = 4;
const ROW_HEIGHT      = ICON_SIZE;
const MAX_PULL        = 60;   // max px overscroll before clamping visual effect
const AFFECTED_ROWS   = 3;    // how many rows from edge receive the animation

type RubberBandState = {
  progress: Animated.Value; // 0 = no pull, 1 = max pull
  edge: 'top' | 'bottom' | 'none';
};

const useRubberBand = () => {
  const progress       = useRef(new Animated.Value(0)).current;
  const edgeRef        = useRef<'top' | 'bottom' | 'none'>('none');
  const scrollY        = useRef(0);
  const contentH       = useRef(0);
  const containerH     = useRef(0);
  const springAnim     = useRef<Animated.CompositeAnimation | null>(null);
  const isAnimating    = useRef(false);

  const snapBack = useCallback(() => {
    springAnim.current?.stop();
    isAnimating.current = true;
    springAnim.current = Animated.spring(progress, {
      toValue: 0,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    });
    springAnim.current.start(() => {
      isAnimating.current = false;
      edgeRef.current = 'none';
    });
  }, [progress]);

  const onContentSizeChange = useCallback((_: number, h: number) => {
    contentH.current = h;
  }, []);

  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    containerH.current = e.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    const maxScroll = contentH.current - containerH.current;

    if (isAnimating.current) return;

    if (y < 0) {
      edgeRef.current = 'top';
      // Normalize: -y goes 0 → MAX_PULL, mapped to progress 0 → 1
      const raw = Math.min(-y / MAX_PULL, 1);
      progress.setValue(raw);
    } else if (maxScroll > 0 && y > maxScroll) {
      edgeRef.current = 'bottom';
      const raw = Math.min((y - maxScroll) / MAX_PULL, 1);
      progress.setValue(raw);
    } else if (!isAnimating.current) {
      edgeRef.current = 'none';
      progress.setValue(0);
    }
  }, [progress]);

  const onScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    const maxScroll = contentH.current - containerH.current;
    if (y < 0 || (maxScroll > 0 && y > maxScroll)) {
      snapBack();
    }
  }, [snapBack]);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    const maxScroll = contentH.current - containerH.current;
    if (y <= 0 || y >= maxScroll) {
      snapBack();
    }
  }, [snapBack]);

  return {
    progress,
    edgeRef,
    onLayout,
    onContentSizeChange,
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
};

// ─── Rubber Band Item Wrapper ─────────────────────────────────────────────────
// Wraps each AppItem with a per-row animated transform.
// rowIndex: which row this item is in (0 = top row, N = bottom row).
// totalRows: total number of rows in the list.
// rubberBand: shared rubber band state.
type RubberAppItemProps = {
  item: AppData;
  rowIndex: number;
  totalRows: number;
  rubberBand: ReturnType<typeof useRubberBand>;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  showNames: boolean;
};

const RubberAppItem = React.memo(({
  item,
  rowIndex,
  totalRows,
  rubberBand,
  onPress,
  onLongPress,
  showNames,
}: RubberAppItemProps) => {
  const { progress, edgeRef } = rubberBand;

  // How close is this row to the active edge? 0 = no effect, 1 = full effect
  // For 'top' edge:    rowIndex 0 → factor 1, rowIndex AFFECTED_ROWS → factor 0
  // For 'bottom' edge: last row → factor 1, (lastRow - AFFECTED_ROWS) → factor 0
  const rowFactor = useMemo(() => {
    const lastRow = totalRows - 1;
    // We compute two possible factors and pick based on edge at runtime.
    // Since this is a static memo, we embed both and switch via interpolation tricks.
    // Instead, we'll use a derived Animated.Value per item.
    // factor is computed purely from progress × edgeRef × position.
    // Since edgeRef is a ref (not reactive), we compute it live in the interpolation.
    // Simplest correct approach: use Animated.multiply after deriving factor from JS.
    return null; // placeholder — real factor computed below
  }, []);

  // Compute per-row animated transforms
  const animatedStyle = useMemo(() => {
    // factor = how much this row is affected (0–1, based on proximity to edge)
    // We approximate this by defining TWO progress tracks: top & bottom.
    // Since we can't branch on edgeRef inside Animated, we use a
    // signed progress: positive = top pull, negative = bottom pull.
    // Then derive scaleY and translateY from it.

    // scaleY: near edge rows squish vertically (pull = stretch Y slightly toward edge)
    // translateY: rows shift toward the pull edge proportionally

    // Because edgeRef is mutable and not Animated, we compute in onScroll
    // and store as a SIGNED value: positive = top, negative = bottom.
    // Then in the animated style we can derive transforms purely from that number.

    // signedProgress is set externally — see useRubberBandSigned below.
    // For now, we use a simpler approach: two separate Animated.Values
    // exposed from the hook, one per edge.

    // ─── Row factor: how affected this row is ──────────────────────────────
    // For top pull: row 0 is fully affected, row AFFECTED_ROWS is 0
    const topFactor    = Math.max(0, 1 - rowIndex / AFFECTED_ROWS);
    // For bottom pull: last row is fully affected, going up
    const bottomFactor = Math.max(0, 1 - (totalRows - 1 - rowIndex) / AFFECTED_ROWS);

    // ─── We need to know which edge is active. ─────────────────────────────
    // We solve this by having TWO progress values from the hook:
    // progressTop and progressBottom, both 0 when inactive.
    // The combined style adds effects from both (only one is ever > 0 at a time).
    // → This means we need to refactor the hook. See useRubberBandDual below.
    // For now, use a workaround: store signed progress in a single value.
    // Positive = top pull, Negative = bottom pull.
    // We'll use interpolation with different output for +/- sides.

    // scaleY for top pull (stretch toward top = slight squish + shift up)
    const scaleTopOutput    = 1 + 0.15 * topFactor;    // rows near top stretch
    const translateTopOutput = -MAX_PULL * 0.3 * topFactor; // shift toward top

    // scaleY for bottom pull
    const scaleBottomOutput    = 1 + 0.15 * bottomFactor;
    const translateBottomOutput = MAX_PULL * 0.3 * bottomFactor;

    return {
      topFactor,
      bottomFactor,
      scaleTopOutput,
      translateTopOutput,
      scaleBottomOutput,
      translateBottomOutput,
    };
  }, [rowIndex, totalRows]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            scaleY: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [animatedStyle.scaleBottomOutput, 1, animatedStyle.scaleTopOutput],
              extrapolate: 'clamp',
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [
                animatedStyle.translateBottomOutput,
                0,
                animatedStyle.translateTopOutput,
              ],
              extrapolate: 'clamp',
            }),
          },
        ],
      }}
    >
      <AppItem
        item={item}
        onPress={onPress}
        onLongPress={onLongPress}
        showNames={showNames}
      />
    </Animated.View>
  );
});

// ─── Dual-signed Rubber Band Hook ─────────────────────────────────────────────
// progress range: -1 (full bottom pull) → 0 (neutral) → 1 (full top pull)
const useRubberBandDual = () => {
  // Signed: +1 = top pull, -1 = bottom pull
  const progress      = useRef(new Animated.Value(0)).current;
  const scrollY       = useRef(0);
  const contentH      = useRef(0);
  const containerH    = useRef(0);
  const springAnim    = useRef<Animated.CompositeAnimation | null>(null);
  const isAnimating   = useRef(false);
  const edgeRef       = useRef<'top' | 'bottom' | 'none'>('none');

  const snapBack = useCallback(() => {
    springAnim.current?.stop();
    isAnimating.current = true;
    springAnim.current = Animated.spring(progress, {
      toValue: 0,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    });
    springAnim.current.start(() => {
      isAnimating.current = false;
      edgeRef.current = 'none';
    });
  }, [progress]);

  const onContentSizeChange = useCallback((_: number, h: number) => {
    contentH.current = h;
  }, []);

  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    containerH.current = e.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    const maxScroll = contentH.current - containerH.current;

    if (isAnimating.current) return;

    if (y < 0) {
      // Top pull → positive progress
      edgeRef.current = 'top';
      progress.setValue(Math.min(-y / MAX_PULL, 1));
    } else if (maxScroll > 0 && y > maxScroll) {
      // Bottom pull → negative progress
      edgeRef.current = 'bottom';
      progress.setValue(-Math.min((y - maxScroll) / MAX_PULL, 1));
    } else {
      edgeRef.current = 'none';
      progress.setValue(0);
    }
  }, [progress]);

  const onScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    const maxScroll = contentH.current - containerH.current;
    if (y < 0 || (maxScroll > 0 && y > maxScroll)) snapBack();
  }, [snapBack]);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y         = e.nativeEvent.contentOffset.y;
    const maxScroll = contentH.current - containerH.current;
    if (y <= 0 || y >= maxScroll) snapBack();
  }, [snapBack]);

  return {
    progress,
    edgeRef,
    onLayout,
    onContentSizeChange,
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App = () => {
  const [loading, setLoading]               = useState(true);
  const [filteredApps, setFilteredApps]     = useState<AppData[]>([]);
  const [isActive, setIsActive]             = useState(true);

  // Modals
  const [settingsVisible, setSettingsVisible]       = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType]                 = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg]               = useState('');
  const [selectedLabel, setSelectedLabel]           = useState('');
  const [tempName, setTempName]                     = useState("User");
  const [tempAssistantName, setTempAssistantName]   = useState("Assistant");

  // Lazy animation refs
  const modalScaleAnim    = useRef<Animated.Value | null>(null);
  const settingsModalAnim = useRef<Animated.Value | null>(null);

  const getModalScaleAnim = useCallback(() => {
    if (!modalScaleAnim.current) modalScaleAnim.current = new Animated.Value(0);
    return modalScaleAnim.current;
  }, []);

  const getSettingsModalAnim = useCallback(() => {
    if (!settingsModalAnim.current) settingsModalAnim.current = new Animated.Value(0);
    return settingsModalAnim.current;
  }, []);

  // Rubber band dual hook (replaces old bounce hook)
  const rubberBand = useRubberBandDual();

  const {
    allApps, setAllApps,
    hiddenPackages, setHiddenPackages,
    dockPackages, setDockPackages,
    listKey, refreshApps,
    hideApp, unhideApp, pinToDock, uninstallApp,
  } = useAppManagement();

  const {
    userName, setUserName,
    assistantName, setAssistantName,
    showHidden, setShowHidden,
    showNames, setShowNames,
    avatarSource, setAvatarSource,
    updateUserName, updateAssistantName,
    toggleShowHidden, toggleShowNames,
  } = useUserSettings();

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      await initializeStorage();
      const prefs = await loadUserPreferences();
      setUserName(prefs.userName);
      setAssistantName(prefs.assistantName);
      setHiddenPackages(prefs.hiddenPackages);
      setShowHidden(prefs.showHidden);
      setAvatarSource(prefs.avatarSource);
      setDockPackages(prefs.dockPackages);
      setShowNames(prefs.showNames);
      setLoading(false);
    });

    refreshApps();

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      if (AppState.currentState === 'active') refreshApps();
    });

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const active = next === 'active';
      setIsActive(active);
      if (active) {
        setTimeout(() => refreshApps(), 400);
      } else {
        modalScaleAnim.current?.stopAnimation();
        settingsModalAnim.current?.stopAnimation();
        modalScaleAnim.current    = null;
        settingsModalAnim.current = null;
      }
    });

    return () => {
      task.cancel();
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
      modalScaleAnim.current?.stopAnimation();
      settingsModalAnim.current?.stopAnimation();
      modalScaleAnim.current    = null;
      settingsModalAnim.current = null;
    };
  }, []);

  // ─── Filter apps ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setFilteredApps(
        allApps.filter(app =>
          !dockPackages.includes(app.packageName) &&
          (showHidden || !hiddenPackages.includes(app.packageName))
        )
      );
    });
    return () => task.cancel();
  }, [allApps, hiddenPackages, dockPackages, showHidden, isActive]);

  // ─── Modal animations ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    if (actionModalVisible) {
      Animated.spring(getModalScaleAnim(), {
        toValue: 1, friction: 7, tension: 120, useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.current?.setValue(0);
    }
  }, [actionModalVisible, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (settingsVisible) {
      Animated.spring(getSettingsModalAnim(), {
        toValue: 1, friction: 7, tension: 120, useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.current?.setValue(0);
    }
  }, [settingsVisible, isActive]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenSettings = useCallback(() => {
    setTempName(userName);
    setTempAssistantName(assistantName);
    setSettingsVisible(true);
  }, [userName, assistantName]);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    setActionType(hiddenPackages.includes(pkg) ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModalVisible(true);
  }, [hiddenPackages]);

  const handleHideAction = useCallback(async () => {
    if (actionType === 'unhide') await unhideApp(selectedPkg);
    else await hideApp(selectedPkg);
    setActionModalVisible(false);
  }, [actionType, selectedPkg, unhideApp, hideApp]);

  const handlePinToDock = useCallback(async () => {
    const ok = await pinToDock(selectedPkg);
    if (ok !== false) setActionModalVisible(false);
  }, [selectedPkg, pinToDock]);

  const handleUninstall = useCallback(() => {
    setActionModalVisible(false);
    uninstallApp(selectedPkg);
  }, [selectedPkg, uninstallApp]);

  const launchApp = useCallback((pkg: string) => {
    try { RNLauncherKitHelper.launchApplication(pkg); }
    catch { ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); }
  }, []);

  const handleChangePhoto = useCallback(async () => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: 'photo', includeBase64: true, maxWidth: 200, maxHeight: 200,
    });
    if (res.assets?.[0]?.base64) {
      const b64 = res.assets[0].base64;
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
      await saveAvatar(b64);
    }
  }, [setAvatarSource]);

  const handleSaveSettings = useCallback(async () => {
    await updateUserName(tempName);
    await updateAssistantName(tempAssistantName);
    setSettingsVisible(false);
  }, [tempName, tempAssistantName, updateUserName, updateAssistantName]);

  // ─── FlatList with rubber band renderItem ─────────────────────────────────
  const totalRows = useMemo(
    () => Math.ceil(filteredApps.length / NUM_COLS),
    [filteredApps.length]
  );

  const renderItem: ListRenderItem<AppData> = useCallback(({ item, index }) => {
    const rowIndex = Math.floor(index / NUM_COLS);
    return (
      <RubberAppItem
        item={item}
        rowIndex={rowIndex}
        totalRows={totalRows}
        rubberBand={rubberBand}
        onPress={launchApp}
        onLongPress={handleLongPress}
        showNames={showNames}
      />
    );
  }, [launchApp, handleLongPress, showNames, totalRows, rubberBand]);

  const keyExtractor  = useCallback((item: AppData) => item.packageName, []);
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index,
  }), []);

  const dockApps = useMemo(
    () => allApps.filter(a => dockPackages.includes(a.packageName)).slice(0, 5),
    [allApps, dockPackages]
  );
  const isDocked   = useMemo(() => dockPackages.includes(selectedPkg), [dockPackages, selectedPkg]);
  const listFooter = useMemo(() => <View style={styles.listFooter} />, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0f0" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <MaskedView
        style={styles.appsContainer}
        maskElement={MaskElement}
        onLayout={rubberBand.onLayout}
      >
        <FlatList
          key={listKey}
          data={filteredApps}
          numColumns={NUM_COLS}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
          windowSize={WINDOW_SIZE}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={UPDATE_CELLS_BATCHING_PERIOD}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={listFooter}
          // Disable native bounce — our rubber band takes over
          bounces={false}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          onContentSizeChange={rubberBand.onContentSizeChange}
          onScroll={rubberBand.onScroll}
          onScrollEndDrag={rubberBand.onScrollEndDrag}
          onMomentumScrollEnd={rubberBand.onMomentumScrollEnd}
        />
      </MaskedView>

      <SimpleDock
        dockApps={dockApps}
        onLaunchApp={launchApp}
        onLongPressApp={handleLongPress}
        onOpenSettings={handleOpenSettings}
        avatarSource={avatarSource}
        assistantName={assistantName}
        userName={userName}
      />

      {settingsVisible && (
        <SettingsModal
          visible={settingsVisible}
          tempName={tempName}
          tempAssistantName={tempAssistantName}
          showHidden={showHidden}
          showNames={showNames}
          scaleAnim={getSettingsModalAnim()}
          onClose={() => setSettingsVisible(false)}
          onTempNameChange={setTempName}
          onTempAssistantNameChange={setTempAssistantName}
          onToggleHidden={toggleShowHidden}
          onToggleShowNames={toggleShowNames}
          onChangePhoto={handleChangePhoto}
          onSave={handleSaveSettings}
        />
      )}

      {actionModalVisible && (
        <AppActionModal
          visible={actionModalVisible}
          selectedLabel={selectedLabel}
          actionType={actionType}
          isDocked={isDocked}
          scaleAnim={getModalScaleAnim()}
          onClose={() => setActionModalVisible(false)}
          onPinToDock={handlePinToDock}
          onHideAction={handleHideAction}
          onUninstall={handleUninstall}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: 'transparent' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appsContainer: { flex: 1 },
  list:          { paddingTop: 50, paddingBottom: 20 },
  listFooter:    { height: 120 },
});

// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
// Instagram: https://www.instagram.com/satria.page/
// Made with ❤️ by Satria Bagus (01satria)
export default App;