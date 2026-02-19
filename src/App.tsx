import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  saveLayoutMode,
} from './utils/storage';
import { useAppManagement, useUserSettings } from './hooks/useAppManagement';
import AppItem from './components/AppItem';
import AppListItem from './components/AppListItem';
import SimpleDock from './components/SimpleDock';
import SettingsModal from './components/SettingsModal';
import AppActionModal from './components/AppActionModal';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [tempName, setTempName] = useState("User");
  const [tempAssistantName, setTempAssistantName] = useState("Assistant");

  // Animations
  const modalScaleAnim = useRef(new Animated.Value(0));
  const settingsModalAnim = useRef(new Animated.Value(0));

  const {
    allApps,
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

  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      const prefs = await loadUserPreferences();

      setUserName(prefs.userName);
      setAssistantName(prefs.assistantName);
      setHiddenPackages(prefs.hiddenPackages);
      setShowHidden(prefs.showHidden);
      setAvatarSource(prefs.avatarSource);
      setDockPackages(prefs.dockPackages);
      setShowNames(prefs.showNames);
      setLayoutMode(prefs.layoutMode);

      setLoading(false);
    };

    init();
    refreshApps();

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      if (AppState.currentState === 'active') {
        refreshApps();
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') {
        // Auto-close all modals when app goes to background
        setSettingsVisible(false);
        setActionModalVisible(false);
        modalScaleAnim.current.stopAnimation();
        settingsModalAnim.current.stopAnimation();
        modalScaleAnim.current.setValue(0);
        settingsModalAnim.current.setValue(0);
      }
      // NOTE: no refreshApps() on 'active' — install listener handles installs,
      // and re-rendering 100+ app icons on every app switch wastes RAM/CPU.
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
      modalScaleAnim.current.stopAnimation();
      settingsModalAnim.current.stopAnimation();
    };
  }, []);

  useEffect(() => {
    const filtered = allApps.filter(app =>
      !dockPackages.includes(app.packageName) &&
      (showHidden || !hiddenPackages.includes(app.packageName))
    );
    setFilteredApps(filtered);
  }, [allApps, hiddenPackages, dockPackages, showHidden]);

  useEffect(() => {
    if (actionModalVisible) {
      Animated.timing(modalScaleAnim.current, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.current.setValue(0);
    }
  }, [actionModalVisible]);

  useEffect(() => {
    if (settingsVisible) {
      Animated.timing(settingsModalAnim.current, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.current.setValue(0);
    }
  }, [settingsVisible]);

  const handleOpenSettings = useCallback(() => {
    setTempName(userName);
    setTempAssistantName(assistantName);
    setSettingsVisible(true);
  }, [userName, assistantName]);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg);
    setActionType(isHidden ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModalVisible(true);
  }, [hiddenPackages]);

  const handleHideAction = useCallback(async () => {
    if (actionType === 'unhide') {
      await unhideApp(selectedPkg);
    } else {
      await hideApp(selectedPkg);
    }
    setActionModalVisible(false);
  }, [actionType, selectedPkg, unhideApp, hideApp]);

  const handlePinToDock = useCallback(async () => {
    const success = await pinToDock(selectedPkg);
    if (success !== false) {
      setActionModalVisible(false);
    }
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
      maxHeight: 200
    });

    if (res.assets?.[0]?.base64) {
      const b64 = res.assets[0].base64;
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
      await saveAvatar(b64);
    }
  }, [setAvatarSource]);

  const handleLayoutModeChange = useCallback(async (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    await saveLayoutMode(mode);
  }, []);

  const handleSaveSettings = useCallback(async () => {
    await updateUserName(tempName);
    await updateAssistantName(tempAssistantName);
    setSettingsVisible(false);
  }, [tempName, tempAssistantName, updateUserName, updateAssistantName]);

  const renderGridItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  const renderListItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppListItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  const { dockApps, isDocked } = React.useMemo(() => {
    const apps = allApps.filter(app => dockPackages.includes(app.packageName)).slice(0, 5);
    const docked = dockPackages.includes(selectedPkg);
    return { dockApps: apps, isDocked: docked };
  }, [allApps, dockPackages, selectedPkg]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="rgb(255, 255, 255)" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <MaskedView
        style={styles.appsContainer}
        maskElement={
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
            <View style={{ height: 90, backgroundColor: 'transparent' }} />
          </View>
        }
      >
        <FlatList
          key={`${listKey}-${layoutMode}`}
          data={filteredApps}
          numColumns={layoutMode === 'grid' ? 4 : 1}
          keyExtractor={item => item.packageName}
          renderItem={layoutMode === 'grid' ? renderGridItem : renderListItem}
          contentContainerStyle={layoutMode === 'grid' ? styles.listGrid : styles.listList}
          initialNumToRender={INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
          windowSize={WINDOW_SIZE}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={UPDATE_CELLS_BATCHING_PERIOD}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={styles.listFooter} />}
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
          layoutMode={layoutMode}
          scaleAnim={settingsModalAnim.current}
          onClose={() => setSettingsVisible(false)}
          onTempNameChange={setTempName}
          onTempAssistantNameChange={setTempAssistantName}
          onToggleHidden={toggleShowHidden}
          onToggleShowNames={toggleShowNames}
          onLayoutModeChange={handleLayoutModeChange}
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
          dockCount={dockApps.length}
          scaleAnim={modalScaleAnim.current}
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
    backgroundColor: 'transparent'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  appsContainer: {
    flex: 1,
  },
  listGrid: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  listList: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  listFooter: {
    height: 120,
  },
});

// Satria Launcher
// Made with ❤️ by Satria Bagus (01satria)
// Instagram: @satria.page
// GitHub: github.com/01satria
// Website: 01satria.vercel.app
// Indonesia: "Peluncur Satria" atau "Satria Launcher" (Satria berarti "prajurit" atau "ksatria", melambangkan kekuatan, keberanian, dan keandalan. Nama ini memberikan kesan bahwa peluncur ini kuat, cepat, dan dapat diandalkan seperti seorang satria dalam pertempuran digital Anda.)
// English: "Satria Launcher" (Satria means "warrior" or "knight" in Indonesian, symbolizing strength, courage, and reliability. The name gives the impression that this launcher is powerful, fast, and dependable like a warrior in your digital battles.)
export default App;