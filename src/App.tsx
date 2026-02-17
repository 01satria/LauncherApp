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

// Static mask element - defined outside component so it never re-creates
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

const App = () => {
  const [loading, setLoading] = useState(true);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Modals
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [tempName, setTempName] = useState("User");
  const [tempAssistantName, setTempAssistantName] = useState("Assistant");

  // Lazy animation refs - only allocated on first use
  const modalScaleAnim = useRef<Animated.Value | null>(null);
  const settingsModalAnim = useRef<Animated.Value | null>(null);

  const getModalScaleAnim = useCallback(() => {
    if (!modalScaleAnim.current) {
      modalScaleAnim.current = new Animated.Value(0);
    }
    return modalScaleAnim.current;
  }, []);

  const getSettingsModalAnim = useCallback(() => {
    if (!settingsModalAnim.current) {
      settingsModalAnim.current = new Animated.Value(0);
    }
    return settingsModalAnim.current;
  }, []);

  const {
    allApps,
    setAllApps,
    hiddenPackages,
    setHiddenPackages,
    dockPackages,
    setDockPackages,
    listKey,
    refreshApps,
    hideApp,
    unhideApp,
    pinToDock,
    uninstallApp,
  } = useAppManagement();

  const {
    userName,
    setUserName,
    assistantName,
    setAssistantName,
    showHidden,
    setShowHidden,
    showNames,
    setShowNames,
    avatarSource,
    setAvatarSource,
    updateUserName,
    updateAssistantName,
    toggleShowHidden,
    toggleShowNames,
  } = useUserSettings();

  // ─── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Defer non-critical init to after first render
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
      // Only process if launcher is in foreground
      if (AppState.currentState === 'active') {
        refreshApps();
      }
    });

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const active = next === 'active';
      setIsActive(active);

      if (active) {
        // Stagger refresh to avoid jank on resume
        setTimeout(() => refreshApps(), 400);
      } else {
        // ── BACKGROUND: release everything possible ──
        modalScaleAnim.current?.stopAnimation();
        settingsModalAnim.current?.stopAnimation();
        modalScaleAnim.current?.setValue(0);
        settingsModalAnim.current?.setValue(0);
        // Null out refs so GC can collect the Animated.Value objects
        modalScaleAnim.current = null;
        settingsModalAnim.current = null;
      }
    });

    return () => {
      task.cancel();
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
      modalScaleAnim.current?.stopAnimation();
      settingsModalAnim.current?.stopAnimation();
      modalScaleAnim.current = null;
      settingsModalAnim.current = null;
    };
  }, []);

  // ─── Filter apps (skip in background) ──────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    // Run after interactions so scroll stays smooth during filter
    const task = InteractionManager.runAfterInteractions(() => {
      const filtered = allApps.filter(app =>
        !dockPackages.includes(app.packageName) &&
        (showHidden || !hiddenPackages.includes(app.packageName))
      );
      setFilteredApps(filtered);
    });

    return () => task.cancel();
  }, [allApps, hiddenPackages, dockPackages, showHidden, isActive]);

  // ─── Modal animations ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    if (actionModalVisible) {
      Animated.spring(getModalScaleAnim(), {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.current?.setValue(0);
    }
  }, [actionModalVisible, isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (settingsVisible) {
      Animated.spring(getSettingsModalAnim(), {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.current?.setValue(0);
    }
  }, [settingsVisible, isActive]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
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
    try {
      RNLauncherKitHelper.launchApplication(pkg);
    } catch {
      ToastAndroid.show("Cannot Open", ToastAndroid.SHORT);
    }
  }, []);

  const handleChangePhoto = useCallback(async () => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 200,
      maxHeight: 200,
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  // Stable renderItem - won't cause FlatList re-render
  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  // Stable keyExtractor
  const keyExtractor = useCallback((item: AppData) => item.packageName, []);

  // Stable getItemLayout - crucial for smooth scroll performance
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 90,
    offset: 90 * index,
    index,
  }), []);

  // Memoized derived data
  const dockApps = useMemo(
    () => allApps.filter(a => dockPackages.includes(a.packageName)).slice(0, 5),
    [allApps, dockPackages]
  );

  const isDocked = useMemo(
    () => dockPackages.includes(selectedPkg),
    [dockPackages, selectedPkg]
  );

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

      <MaskedView style={styles.appsContainer} maskElement={MaskElement}>
        <FlatList
          key={listKey}
          data={filteredApps}
          numColumns={4}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
          windowSize={WINDOW_SIZE}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={UPDATE_CELLS_BATCHING_PERIOD}
          getItemLayout={getItemLayout}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={listFooter}
          // Smooth scroll optimizations
          decelerationRate="fast"
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={false}
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
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appsContainer: {
    flex: 1,
  },
  list: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  listFooter: {
    height: 120,
  },
});

// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
// Instagram: https://www.instagram.com/satria.page/
// If you find any bugs or have suggestions, please open an issue or reach out!
// Made with ❤️ by Satria Bagus (01satria)
export default App;