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
} from 'react-native';
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
  checkNotificationStatus,
  saveNotificationDismissed,
  saveAvatar,
} from './utils/storage';
import { useAppManagement, useUserSettings } from './hooks/useAppManagement';
import AppItem from './components/AppItem';
import SimpleDock from './components/SimpleDock';
import AssistantNotification from './components/AssistantNotification';
import SettingsModal from './components/SettingsModal';
import AppActionModal from './components/AppActionModal';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  
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

  // Initialize app
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
      
      const shouldShow = await checkNotificationStatus();
      setShowNotification(shouldShow);
      
      setLoading(false);
    };
    
    init();
    refreshApps();

    // Daily reset timer
    const checkResetTimer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 1 && now.getMinutes() === 0) {
        checkNotificationStatus().then(setShowNotification);
      }
    }, 60000);

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      refreshApps();
    });

    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        setTimeout(() => refreshApps(), 1000);
        checkNotificationStatus().then(setShowNotification);
      }
    });

    return () => {
      clearInterval(checkResetTimer);
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
    };
  }, []);

  // Filter apps
  useEffect(() => {
    requestAnimationFrame(() => {
      const filtered = allApps.filter(app => 
        !dockPackages.includes(app.packageName) && 
        (showHidden || !hiddenPackages.includes(app.packageName))
      );
      setFilteredApps(filtered);
    });
  }, [allApps, hiddenPackages, dockPackages, showHidden]);

  // Modal animations
  useEffect(() => {
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
  }, [actionModalVisible, modalScaleAnim]);

  useEffect(() => {
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
  }, [settingsVisible, settingsModalAnim]);

  useEffect(() => {
    return () => {
      modalScaleAnim.stopAnimation();
      settingsModalAnim.stopAnimation();
    };
  }, [modalScaleAnim, settingsModalAnim]);

  // Handlers
  const handleDismissNotification = async () => {
    setShowNotification(false);
    await saveNotificationDismissed();
  };

  const handleOpenSettings = () => {
    setTempName(userName);
    setTempAssistantName(assistantName);
    setSettingsVisible(true);
  };

  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg);
    setActionType(isHidden ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModalVisible(true);
  }, [hiddenPackages]);

  const handleHideAction = async () => {
    if (actionType === 'unhide') {
      await unhideApp(selectedPkg);
    } else {
      await hideApp(selectedPkg);
    }
    setActionModalVisible(false);
  };

  const handlePinToDock = async () => {
    const success = await pinToDock(selectedPkg);
    if (success !== false) {
      setActionModalVisible(false);
    }
  };

  const handleUninstall = () => {
    setActionModalVisible(false);
    uninstallApp(selectedPkg);
  };

  const launchApp = (pkg: string) => {
    try { 
      RNLauncherKitHelper.launchApplication(pkg); 
    } catch { 
      ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); 
    }
  };

  const handleChangePhoto = async () => {
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
  };

  const handleSaveSettings = async () => {
    await updateUserName(tempName);
    await updateAssistantName(tempAssistantName);
    setSettingsVisible(false);
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppItem 
      item={item} 
      onPress={launchApp} 
      onLongPress={handleLongPress} 
      showNames={showNames} 
    />
  ), [handleLongPress, showNames]);

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
      />
      
      <LinearGradient 
        colors={['transparent', 'rgba(0, 0, 0, 0.75)', '#000000']} 
        style={styles.gradientFade} 
        pointerEvents="none" 
      />
      
      {showNotification && (
        <AssistantNotification
          userName={userName}
          assistantName={assistantName}
          avatarSource={avatarSource}
          onDismiss={handleDismissNotification}
        />
      )}

      <SimpleDock
        dockApps={dockApps}
        onLaunchApp={launchApp}
        onLongPressApp={handleLongPress}
        onOpenSettings={handleOpenSettings}
      />

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
  list: { 
    paddingTop: 50, 
    paddingBottom: 140 
  },
  gradientFade: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    height: 220, 
    zIndex: 1 
  },
});

// @2026 Satria Dev - SATRIA LAUNCHER - All Rights Reserved
// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
export default App;