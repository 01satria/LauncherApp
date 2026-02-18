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
import CacheManager from './utils/CacheManager';
import { useAppManagement, useUserSettings } from './hooks/useAppManagement';
import AppItem from './components/AppItem';
import AppListItem from './components/AppListItem';
import SimpleDock from './components/SimpleDock';
import SettingsModal from './components/SettingsModal';
import AppActionModal from './components/AppActionModal';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [tempName, setTempName] = useState("User");
  const [tempAssistantName, setTempAssistantName] = useState("Assistant");

  // Animations - lazy init
  const modalScaleAnim = useRef<Animated.Value | null>(null);
  const settingsModalAnim = useRef<Animated.Value | null>(null);
  
  // Cache management timers
  const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getModalScaleAnim = () => {
    if (!modalScaleAnim.current) {
      modalScaleAnim.current = new Animated.Value(0);
    }
    return modalScaleAnim.current;
  };

  const getSettingsModalAnim = () => {
    if (!settingsModalAnim.current) {
      settingsModalAnim.current = new Animated.Value(0);
    }
    return settingsModalAnim.current;
  };

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
      const isNowActive = nextAppState === 'active';
      setIsActive(isNowActive);

      if (isNowActive) {
        // App returning to foreground - cancel any pending cache clears
        if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
        if (deepCacheTimerRef.current) clearTimeout(deepCacheTimerRef.current);
        
        setTimeout(() => refreshApps(), 500);
        CacheManager.warmupCache();
      } else {
        // App going to background - progressive cache clearing
        
        // 1. Immediate: Stop animations to save CPU
        modalScaleAnim.current?.stopAnimation();
        settingsModalAnim.current?.stopAnimation();
        modalScaleAnim.current?.setValue(0);
        settingsModalAnim.current?.setValue(0);
        
        // 2. After 5 seconds: Clear basic cache (decoded images)
        backgroundTimerRef.current = setTimeout(() => {
          if (AppState.currentState !== 'active') {
            CacheManager.clearBackgroundCache();
          }
        }, 5000);
        
        // 3. After 30 seconds: Deep cache clear (for extended background)
        deepCacheTimerRef.current = setTimeout(() => {
          if (AppState.currentState !== 'active') {
            CacheManager.clearDeepCache();
          }
        }, 30000);
      }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
      modalScaleAnim.current?.stopAnimation();
      settingsModalAnim.current?.stopAnimation();
      modalScaleAnim.current = null;
      settingsModalAnim.current = null;
      
      // Clear cache management timers
      if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
      if (deepCacheTimerRef.current) clearTimeout(deepCacheTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;
    
    const rafId = requestAnimationFrame(() => {
      const filtered = allApps.filter(app =>
        !dockPackages.includes(app.packageName) &&
        (showHidden || !hiddenPackages.includes(app.packageName))
      );
      setFilteredApps(filtered);
    });

    return () => cancelAnimationFrame(rafId);
  }, [allApps, hiddenPackages, dockPackages, showHidden, isActive]);

  useEffect(() => {
    if (!isActive) return;
    
    if (actionModalVisible) {
      const anim = getModalScaleAnim();
      Animated.spring(anim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.current?.setValue(0);
    }
  }, [actionModalVisible, isActive]);

  useEffect(() => {
    if (!isActive) return;
    
    if (settingsVisible) {
      const anim = getSettingsModalAnim();
      Animated.spring(anim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.current?.setValue(0);
    }
  }, [settingsVisible, isActive]);

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

  // GRID MODE: 4 columns
  const renderGridItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  // LIST MODE: 1 column (Niagara-style)
  const renderListItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppListItem
      item={item}
      onPress={launchApp}
      onLongPress={handleLongPress}
      showNames={showNames}
    />
  ), [launchApp, handleLongPress, showNames]);

  const dockApps = React.useMemo(
    () => allApps.filter(app => dockPackages.includes(app.packageName)).slice(0, 5),
    [allApps, dockPackages]
  );
  
  const isDocked = dockPackages.includes(selectedPkg);

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
            <View style={{ height: 85, backgroundColor: 'transparent' }} />
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
          scaleAnim={getSettingsModalAnim()}
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

// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
// Instagram: https://www.instagram.com/satria.page/
// Indonesian: "Jangan lupa untuk memberikan kredit kepada Satria Dev jika Anda menggunakan atau memodifikasi kode ini dalam proyek Anda. Terima kasih telah menghargai karya saya!" - Satria Dev
// English: "Please remember to give credit to Satria Dev if you use or modify this code in your projects. Thank you for respecting my work!" - Satria Dev

export default App;