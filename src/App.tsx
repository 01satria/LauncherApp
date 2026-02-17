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

  // Animations
  const modalScaleAnim = useRef(new Animated.Value(0)).current;
  const settingsModalAnim = useRef(new Animated.Value(0)).current;
  const appStateRef = useRef(AppState.currentState);

  // Custom hooks
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

  // Background state management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && previousState !== 'active') {
        // Returning from background - minimal refresh
        setIsActive(true);
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => refreshApps(), 500);
        });
      } else if (nextAppState.match(/inactive|background/)) {
        // Going to background - pause non-critical tasks
        setIsActive(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshApps]);

  // Initialize app
  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      const prefs = await loadUserPreferences();

      // Batch state updates
      InteractionManager.runAfterInteractions(() => {
        setUserName(prefs.userName);
        setAssistantName(prefs.assistantName);
        setHiddenPackages(prefs.hiddenPackages);
        setShowHidden(prefs.showHidden);
        setAvatarSource(prefs.avatarSource);
        setDockPackages(prefs.dockPackages);
        setShowNames(prefs.showNames);
        setLoading(false);
      });
    };

    init();
    refreshApps();

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      if (isActive) {
        refreshApps();
      }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
    };
  }, []);

  // Filter apps - optimized with useMemo-like behavior
  useEffect(() => {
    if (!isActive) return; // Skip filtering when in background

    const filterTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        const filtered = allApps.filter(app =>
          !dockPackages.includes(app.packageName) &&
          (showHidden || !hiddenPackages.includes(app.packageName))
        );
        setFilteredApps(filtered);
      });
    }, 50); // Debounce filtering

    return () => clearTimeout(filterTimeout);
  }, [allApps, hiddenPackages, dockPackages, showHidden, isActive]);

  // Modal animations - only when active
  useEffect(() => {
    if (!isActive) return;

    if (actionModalVisible) {
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.setValue(0);
    }
  }, [actionModalVisible, modalScaleAnim, isActive]);

  useEffect(() => {
    if (!isActive) return;

    if (settingsVisible) {
      Animated.spring(settingsModalAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.setValue(0);
    }
  }, [settingsVisible, settingsModalAnim, isActive]);

  useEffect(() => {
    return () => {
      modalScaleAnim.stopAnimation();
      settingsModalAnim.stopAnimation();
    };
  }, [modalScaleAnim, settingsModalAnim]);

  // Handlers - wrapped in useCallback for stability
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
  }, [actionType, selectedPkg, hideApp, unhideApp]);

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
  }, []);

  const handleSaveSettings = useCallback(async () => {
    await updateUserName(tempName);
    await updateAssistantName(tempAssistantName);
    setSettingsVisible(false);
  }, [tempName, tempAssistantName, updateUserName, updateAssistantName]);

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  const dockApps = allApps.filter(app => dockPackages.includes(app.packageName)).slice(0, 5);
  const isDocked = dockPackages.includes(selectedPkg);

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

      {/* App Grid with MaskedView fade */}
      <MaskedView
        style={styles.appsContainer}
        maskElement={
          <View style={{ flex: 1 }}>
            <View style={{ height: 10, backgroundColor: 'transparent' }} />
            <LinearGradient
              colors={['black', 'black', 'rgba(0,0,0,0.5)', 'transparent']}
              locations={[0, 0.90, 0.95, 1]}
              style={{ flex: 1 }}
            />
            <View style={{ height: 85, backgroundColor: 'transparent' }} />
          </View>
        }
      >
        <FlatList
          key={listKey}
          data={filteredApps}
          numColumns={4}
          keyExtractor={item => item.packageName}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
          windowSize={WINDOW_SIZE}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={UPDATE_CELLS_BATCHING_PERIOD}
          getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={styles.listFooter} />}
          // Performance optimizations
          disableVirtualization={false}
          legacyImplementation={false}
          maxToRenderPerBatch={isActive ? MAX_TO_RENDER_PER_BATCH : 5}
          scrollEventThrottle={16}
          directionalLockEnabled={true}
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

      {isActive && (
        <>
          <SettingsModal
            visible={settingsVisible}
            tempName={tempName}
            tempAssistantName={tempAssistantName}
            showHidden={showHidden}
            showNames={showNames}
            scaleAnim={settingsModalAnim}
            onClose={() => setSettingsVisible(false)}
            onTempNameChange={setTempName}
            onTempAssistantNameChange={setTempAssistantName}
            onToggleHidden={toggleShowHidden}
            onToggleShowNames={toggleShowNames}
            onChangePhoto={handleChangePhoto}
            onSave={handleSaveSettings}
          />

          <AppActionModal
            visible={actionModalVisible}
            selectedLabel={selectedLabel}
            actionType={actionType}
            isDocked={isDocked}
            scaleAnim={modalScaleAnim}
            onClose={() => setActionModalVisible(false)}
            onPinToDock={handlePinToDock}
            onHideAction={handleHideAction}
            onUninstall={handleUninstall}
          />
        </>
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
    position: 'relative',
  },
  list: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  listFooter: {
    height: 120,
  },
});

// @2026 Satria Dev - SATRIA LAUNCHER - All Rights Reserved
// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
// Instagram: https://www.instagram.com/satria.page/
// Indonesian: "Jangan lupa untuk memberikan kredit kepada Satria Dev jika Anda menggunakan atau memodifikasi kode ini dalam proyek Anda. Terima kasih telah menghargai karya saya!" - Satria Dev
// English: "Please remember to give credit to Satria Dev if you use or modify this code in your projects. Thank you for respecting my work!" - Satria Dev

export default App;