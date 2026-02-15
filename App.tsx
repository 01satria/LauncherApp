import React, { useEffect, useState, memo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  ToastAndroid,
  Dimensions,
  Image,
  Modal,
  TextInput,
  Switch,
  AppState,
  ListRenderItem,
  NativeModules,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

const { UninstallModule } = NativeModules;

interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ICON_SIZE = 56;
const DOCK_ICON_SIZE = 48;

const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_ASSISTANT_NAME_PATH = `${CUSTOM_AVATAR_DIR}/assistant_name.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const CUSTOM_DOCK_PATH = `${CUSTOM_AVATAR_DIR}/dock.json`;
const CUSTOM_SHOW_NAMES_PATH = `${CUSTOM_AVATAR_DIR}/show_names.txt`;
const CUSTOM_NOTIF_DISMISSED_PATH = `${CUSTOM_AVATAR_DIR}/notif_dismissed.txt`;
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// ==================== SAFE IMAGE (OPTIMIZED) ====================
const SafeAppIcon = memo(({ iconUri, size = ICON_SIZE }: { iconUri: string; size?: number }) => {
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const uri = iconUri.startsWith('file://') ? iconUri : `file://${iconUri}`;

  useEffect(() => {
    return () => {
      fadeAnim.stopAnimation();
    };
  }, [fadeAnim]);

  const handleLoad = useCallback(() => {
    setError(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const borderRadius = size * 0.22;

  if (error) {
    return <View style={{ width: size, height: size, borderRadius }} />;
  }

  return (
    <Animated.View style={{ 
      width: size, 
      height: size, 
      borderRadius,
      overflow: 'hidden',
      opacity: fadeAnim,
    }}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        fadeDuration={0}
        onError={() => setError(true)}
        onLoad={handleLoad}
      />
    </Animated.View>
  );
}, (prev, next) => prev.iconUri === next.iconUri && prev.size === next.size);

// ==================== ITEM LIST (OPTIMIZED) ====================
const MemoizedItem = memo(({ item, onPress, onLongPress, showNames }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  showNames: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [scaleAnim]);

  return (
    <View style={styles.item}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={() => onPress(item.packageName)}
        onLongPress={() => onLongPress(item.packageName, item.label)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={300}
      >
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <SafeAppIcon iconUri={item.icon} />
        </Animated.View>
        {showNames && <Text style={styles.label} numberOfLines={1}>{item.label}</Text>}
      </TouchableOpacity>
    </View>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName && prev.showNames === next.showNames);

// ==================== DOCK APP ITEM ====================
const DockAppItem = memo(({ app, onPress, onLongPress }: {
  app: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.8,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [scaleAnim]);

  return (
    <TouchableOpacity
      style={styles.dockAppItem}
      onPress={() => onPress(app.packageName)}
      onLongPress={() => onLongPress(app.packageName, app.label)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      delayLongPress={300}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <SafeAppIcon iconUri={app.icon} size={DOCK_ICON_SIZE} />
      </Animated.View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.app.packageName === next.app.packageName);

// ==================== ASSISTANT NOTIFICATION ====================
const AssistantNotification = memo(({ 
  userName,
  assistantName,
  avatarSource,
  onDismiss,
}: {
  userName: string;
  assistantName: string;
  avatarSource: string | null;
  onDismiss: () => void;
}) => {
  const [message, setMessage] = useState("");
  const slideAnim = useRef(new Animated.Value(-250)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const updateMessage = () => {
      const h = new Date().getHours();
      if (h >= 22 || h < 4) setMessage(`It's late, ${userName}. Put the phone down now! 😠 u need rest to stay healthy.`);
      else if (h >= 4 && h < 11) setMessage(`Good morning, ${userName}! ☀️ Wake up and conquer the day. Remember, I'm always cheering for u right here. 😘`);
      else if (h >= 11 && h < 15) setMessage(`Stop working for a bit! 😠 Have u had lunch, ${userName}? Don't u dare skip meals, I don't want u getting sick! 🍔`);
      else if (h >= 15 && h < 18) setMessage(`U must be tired, ${userName}.. ☕ Take a break, okay?.. 🤗`);
      else setMessage(`Are u done for the day? 🌙 No more wandering around. It's time for u to relax. 🥰`);
    };

    updateMessage();

    // Smooth slide in with opacity
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ]).start();

    let timer: NodeJS.Timeout | null = null;
    const startTimer = () => {
      if (timer) clearInterval(timer);
      updateMessage();
      timer = setInterval(updateMessage, 60000);
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (nextAppState === 'active') startTimer();
      else if (timer) clearInterval(timer);
    });

    startTimer();

    return () => {
      if (timer) clearInterval(timer);
      subscription.remove();
      slideAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, [userName, slideAnim, opacityAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -250,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss();
    });
  };

  return (
    <Animated.View 
      style={[
        styles.notificationCard,
        { 
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        }
      ]}
    >
      <View style={styles.notifTopRow}>
        <View style={styles.notifAvatarContainer}>
          <Image 
            source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
            style={styles.notifAvatar} 
          />
        </View>
        
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{assistantName}</Text>
          <Text style={styles.notifMessage} numberOfLines={4}>{message}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.notifOkayBtn}
        onPress={handleDismiss}
        activeOpacity={0.7}
      >
        <Text style={styles.notifOkayText}>Okay</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ==================== SIMPLE DOCK (APPS ONLY) ====================
const SimpleDock = memo(({ 
  dockApps,
  onLaunchApp,
  onLongPressApp,
}: {
  dockApps: AppData[];
  onLaunchApp: (pkg: string) => void;
  onLongPressApp: (pkg: string, label: string) => void;
}) => {
  // Calculate dynamic width based on app count
  const appCount = dockApps.length;
  const minWidth = 150; // Minimum width for empty state
  const iconWidth = DOCK_ICON_SIZE + 8; // Icon + spacing
  const padding = 24; // Horizontal padding
  const calculatedWidth = appCount > 0 ? (iconWidth * appCount) + padding : minWidth;

  return (
    <View style={styles.simpleDockContainer}>
      <View style={[styles.simpleDockCard, { width: calculatedWidth }]}>
        {dockApps.length === 0 ? (
          <View style={styles.emptyDockContainer}>
            <Text style={styles.emptyDockText}>Long press any app to pin</Text>
          </View>
        ) : (
          <View style={styles.dockAppsRow}>
            {dockApps.map((app: AppData) => (
              <DockAppItem 
                key={app.packageName} 
                app={app} 
                onPress={onLaunchApp}
                onLongPress={onLongPressApp}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

// ==================== MAIN APP ====================
const App = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [assistantName, setAssistantName] = useState("Assistant");
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [dockPackages, setDockPackages] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState("User");
  const [tempAssistantName, setTempAssistantName] = useState("Assistant");

  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [listKey, setListKey] = useState(0);
  const modalScaleAnim = useRef(new Animated.Value(0)).current;
  const settingsModalAnim = useRef(new Animated.Value(0)).current;

  // Check if notification should show (daily reset at 01:00)
  const checkNotificationStatus = useCallback(async () => {
    try {
      const exists = await RNFS.exists(CUSTOM_NOTIF_DISMISSED_PATH);
      if (!exists) {
        setShowNotification(true);
        return;
      }

      const dismissedDate = await RNFS.readFile(CUSTOM_NOTIF_DISMISSED_PATH, 'utf8');
      const today = new Date();
      const lastDismissed = new Date(dismissedDate);

      // Check if it's past 01:00 AM and it's a new day
      const resetHour = 1;
      const shouldReset = 
        today.getDate() !== lastDismissed.getDate() ||
        today.getMonth() !== lastDismissed.getMonth() ||
        today.getFullYear() !== lastDismissed.getFullYear();

      if (shouldReset && today.getHours() >= resetHour) {
        setShowNotification(true);
      }
    } catch (e) {
      setShowNotification(true);
    }
  }, []);

  const handleDismissNotification = async () => {
    setShowNotification(false);
    const now = new Date().toISOString();
    await RNFS.writeFile(CUSTOM_NOTIF_DISMISSED_PATH, now, 'utf8');
  };

  const handleOpenSettings = () => {
    setTempName(userName);
    setTempAssistantName(assistantName);
    setModalVisible(true);
  };

  useEffect(() => {
    if (actionModal) {
      Animated.spring(modalScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      modalScaleAnim.setValue(0);
    }
  }, [actionModal, modalScaleAnim]);

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(settingsModalAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      settingsModalAnim.setValue(0);
    }
  }, [modalVisible, settingsModalAnim]);

  useEffect(() => {
    return () => {
      modalScaleAnim.stopAnimation();
      settingsModalAnim.stopAnimation();
    };
  }, [modalScaleAnim, settingsModalAnim]);

  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getSortedApps();
      const apps = result.map((a: any) => ({
        label: a.label || 'App',
        packageName: a.packageName,
        icon: a.icon,
      }));
      setAllApps(apps);
    } catch (e) {
      console.error('refreshApps failed:', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => { });
      const [uName, aName, hidden, showH, avt, dock, showN] = await Promise.all([
        RNFS.exists(CUSTOM_USER_PATH).then(e => e ? RNFS.readFile(CUSTOM_USER_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_ASSISTANT_NAME_PATH).then(e => e ? RNFS.readFile(CUSTOM_ASSISTANT_NAME_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_AVATAR_PATH).then(e => e ? RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64') : null),
        RNFS.exists(CUSTOM_DOCK_PATH).then(e => e ? RNFS.readFile(CUSTOM_DOCK_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_NAMES_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_NAMES_PATH, 'utf8') : null),
      ]);
      if (uName) setUserName(uName);
      if (aName) setAssistantName(aName);
      if (hidden) setHiddenPackages(JSON.parse(hidden));
      if (showH) setShowHidden(showH === 'true');
      if (avt) setAvatarSource(`data:image/jpeg;base64,${avt}`);
      if (dock) setDockPackages(JSON.parse(dock));
      if (showN !== null) setShowNames(showN === 'true');
      
      // Check notification status
      await checkNotificationStatus();
      
      setLoading(false);
    };
    init();
    refreshApps();

    // Daily reset timer - check every hour if it's 01:00
    const checkResetTimer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 1 && now.getMinutes() === 0) {
        checkNotificationStatus();
      }
    }, 60000); // Check every minute

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      refreshApps();
    });

    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        setTimeout(() => refreshApps(), 1000);
        checkNotificationStatus();
      }
    });

    return () => {
      clearInterval(checkResetTimer);
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
    };
  }, [refreshApps, checkNotificationStatus]);

  // Filter apps: exclude dock apps from main list
  useEffect(() => {
    requestAnimationFrame(() => {
      const filtered = allApps.filter(app => 
        !dockPackages.includes(app.packageName) && 
        (showHidden || !hiddenPackages.includes(app.packageName))
      );
      setFilteredApps(filtered);
    });
  }, [allApps, hiddenPackages, dockPackages, showHidden]);

  const dockApps = allApps.filter(app => dockPackages.includes(app.packageName)).slice(0, 5);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg);
    setActionType(isHidden ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, [hiddenPackages]);

  const doAction = async () => {
    let newList = [...hiddenPackages];
    if (actionType === 'unhide') {
      newList = newList.filter(p => p !== selectedPkg);
    } else {
      if (!newList.includes(selectedPkg)) newList.push(selectedPkg);
      
      // Auto-remove from dock when hiding
      if (dockPackages.includes(selectedPkg)) {
        const newDock = dockPackages.filter(p => p !== selectedPkg);
        setDockPackages(newDock);
        await RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
      }
    }
    setHiddenPackages(newList);
    await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
    ToastAndroid.show(actionType === 'hide' ? 'App Hidden' : 'App Visible', ToastAndroid.SHORT);
  };

  const pinToDock = async () => {
    const isDocked = dockPackages.includes(selectedPkg);
    const isHidden = hiddenPackages.includes(selectedPkg);
    let newDock = [...dockPackages];
    
    if (isDocked) {
      newDock = newDock.filter(p => p !== selectedPkg);
      ToastAndroid.show('Unpinned from Dock', ToastAndroid.SHORT);
    } else {
      if (newDock.length >= 5) {
        ToastAndroid.show('Dock is full (max 5 apps)', ToastAndroid.LONG);
        setActionModal(false);
        return;
      }
      newDock.push(selectedPkg);
      
      // Auto-unhide when pinning to dock
      if (isHidden) {
        const newHidden = hiddenPackages.filter(p => p !== selectedPkg);
        setHiddenPackages(newHidden);
        await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newHidden), 'utf8');
        ToastAndroid.show('Pinned to Dock & Unhidden', ToastAndroid.SHORT);
      } else {
        ToastAndroid.show('Pinned to Dock', ToastAndroid.SHORT);
      }
    }
    
    setDockPackages(newDock);
    await RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
    setActionModal(false);
  };

  const handleUninstall = () => {
    const pkgToRemove = selectedPkg;
    setActionModal(false);

    setAllApps(prev => prev.filter(app => app.packageName !== pkgToRemove));
    setDockPackages(prev => {
      const newDock = prev.filter(p => p !== pkgToRemove);
      RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
      return newDock;
    });
    setListKey(prev => prev + 1);

    setTimeout(() => {
      if (UninstallModule) {
        UninstallModule.uninstallApp(pkgToRemove);
      }
    }, 420);

    setTimeout(() => refreshApps(), 1800);
    setTimeout(() => refreshApps(), 4500);
    setTimeout(() => refreshApps(), 8000);
  };

  const launchApp = (pkg: string) => {
    try { RNLauncherKitHelper.launchApplication(pkg); } catch { ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} showNames={showNames} />
  ), [handleLongPress, showNames]);

  const toggleHidden = (v: boolean) => { setShowHidden(v); RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); };
  const toggleShowNames = (v: boolean) => { setShowNames(v); RNFS.writeFile(CUSTOM_SHOW_NAMES_PATH, v ? 'true' : 'false', 'utf8'); };
  
  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true, maxWidth: 200, maxHeight: 200 });
    if (res.assets?.[0]?.base64) {
      const b64 = res.assets[0].base64;
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
      RNFS.writeFile(CUSTOM_AVATAR_PATH, b64, 'base64');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0f0" size="large" /></View>;

  const isDocked = dockPackages.includes(selectedPkg);
  const scrollViewRef = useRef<any>(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <Pressable 
        style={styles.homeScreenWrapper}
        onLongPress={handleOpenSettings}
        delayLongPress={400}
      >
        {({ pressed }) => (
          <FlatList
            key={listKey}
            data={filteredApps}
            numColumns={4}
            keyExtractor={item => item.packageName}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })}
            scrollEnabled={!pressed}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Pressable>
      
      <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.75)', '#000000']} style={styles.gradientFade} pointerEvents="none" />
      
      {/* ASSISTANT NOTIFICATION */}
      {showNotification && (
        <AssistantNotification
          userName={userName}
          assistantName={assistantName}
          avatarSource={avatarSource}
          onDismiss={handleDismissNotification}
        />
      )}

      {/* SIMPLE DOCK */}
      <SimpleDock
        dockApps={dockApps}
        onLaunchApp={launchApp}
        onLongPressApp={handleLongPress}
      />

      {/* SETTINGS MODAL */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [
                  { scale: settingsModalAnim },
                  {
                    translateY: settingsModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    })
                  }
                ],
                opacity: settingsModalAnim
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ur Name</Text>
            <TextInput
              style={styles.modernInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter name..."
              placeholderTextColor="#666"
            />

            <Text style={styles.inputLabel}>Assistant Name</Text>
            <TextInput
              style={styles.modernInput}
              value={tempAssistantName}
              onChangeText={setTempAssistantName}
              placeholder="Enter assistant name..."
              placeholderTextColor="#666"
            />

            <View style={styles.rowBetween}>
              <Text style={styles.settingText}>Show Hidden Apps</Text>
              <Switch
                value={showHidden}
                onValueChange={toggleHidden}
                thumbColor={showHidden ? "#27ae60" : "#f4f3f4"}
                trackColor={{ false: "#767577", true: "#2ecc7130" }}
              />
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.settingText}>Show App Names</Text>
              <Switch
                value={showNames}
                onValueChange={toggleShowNames}
                thumbColor={showNames ? "#27ae60" : "#f4f3f4"}
                trackColor={{ false: "#767577", true: "#2ecc7130" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.verticalBtnGroup}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnBlue, styles.btnFull]} onPress={changePhoto} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Change Avatar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} onPress={() => {
                setUserName(tempName);
                setAssistantName(tempAssistantName);
                RNFS.writeFile(CUSTOM_USER_PATH, tempName, 'utf8');
                RNFS.writeFile(CUSTOM_ASSISTANT_NAME_PATH, tempAssistantName, 'utf8');
                setModalVisible(false);
              }} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {/* APP ACTION MODAL */}
      <Modal visible={actionModal} transparent animationType="none" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [
                  { scale: modalScaleAnim },
                  {
                    translateY: modalScaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    })
                  }
                ],
                opacity: modalScaleAnim
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedLabel}</Text>
              <TouchableOpacity onPress={() => setActionModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Select an action for this app:</Text>

            <View style={styles.verticalBtnGroup}>
              <TouchableOpacity 
                style={[styles.actionBtn, isDocked ? styles.btnOrange : styles.btnPurple, styles.btnFull]} 
                onPress={pinToDock} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {isDocked ? '📌 Unpin from Dock' : '📌 Pin to Dock'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} 
                onPress={doAction} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {actionType === 'unhide' ? '👁️ Unhide' : '🙈 Hide'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnRed, styles.btnFull]} 
                onPress={handleUninstall} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>🗑️ Uninstall</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  homeScreenWrapper: { flex: 1 },
  list: { paddingTop: 50, paddingBottom: 140 },
  item: { 
    width: ITEM_WIDTH, 
    height: 90, 
    alignItems: 'center', 
    marginBottom: 8,
    justifyContent: 'center',
  },
  itemTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: { 
    width: ICON_SIZE, 
    height: ICON_SIZE, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  label: { 
    color: '#eee', 
    fontSize: 11, 
    textAlign: 'center', 
    marginHorizontal: 4, 
    textShadowColor: 'rgba(0,0,0,0.8)', 
    textShadowRadius: 3 
  },
  
  // ==================== NOTIFICATION STYLES ====================
  notificationCard: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notifAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  notifAvatar: {
    width: '100%',
    height: '100%',
  },
  notifContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifMessage: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
  },
  notifOkayBtn: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  notifOkayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // ==================== SIMPLE DOCK STYLES (DYNAMIC WIDTH) ====================
  simpleDockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  simpleDockCard: {
    height: 62,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 31,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyDockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyDockText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dockAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flex: 1,
  },
  dockAppItem: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  gradientFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, zIndex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.85, backgroundColor: '#000000', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333', elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', flex: 1 },
  closeBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333', borderRadius: 15 },
  closeText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: -2 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  modernInput: { backgroundColor: '#2C2C2C', color: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  settingText: { color: '#fff', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15, width: '100%' },
  verticalBtnGroup: { width: '100%', gap: 10 },
  actionBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnFull: { width: '100%' },
  btnGreen: { backgroundColor: '#27ae60' },
  btnBlue: { backgroundColor: '#2980b9' },
  btnRed: { backgroundColor: '#c0392b' },
  btnPurple: { backgroundColor: '#8e44ad' },
  btnOrange: { backgroundColor: '#e67e22' },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  modalSubtitle: { color: '#aaa', fontSize: 14, marginBottom: 25 },
});

// @2026 Satria Dev - SATRIA LAUNCHER - All Rights Reserved
// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
export default App;
