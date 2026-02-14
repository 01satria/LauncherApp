import React, { useEffect, useState, memo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
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
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const CUSTOM_DOCK_PATH = `${CUSTOM_AVATAR_DIR}/dock.json`;
const CUSTOM_SHOW_NAMES_PATH = `${CUSTOM_AVATAR_DIR}/show_names.txt`;
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
    <TouchableOpacity
      style={styles.item}
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

// ==================== DOCK ASSISTANT ====================
const AssistantDock = memo(({ 
  userName, 
  showHidden, 
  showNames,
  onSaveUserName, 
  onToggleShowHidden,
  onToggleShowNames,
  onChangePhoto, 
  avatarSource,
  dockApps,
  onLaunchApp,
  onLongPressApp,
  showDockView,
  onToggleDockView
}: any) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const appState = useRef(AppState.currentState);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const settingsModalAnim = useRef(new Animated.Value(0)).current;

  // ==================== SWIPE GESTURE HANDLER ====================
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Aktifkan gesture jika swipe horizontal lebih dari 20px
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 50;
        
        // Deteksi arah swipe
        if (Math.abs(gestureState.dx) > swipeThreshold) {
          const swipeRight = gestureState.dx > 0; // true jika swipe ke kanan
          
          // Set arah animasi sebelum toggle
          setAnimDirection(swipeRight ? 'right' : 'left');
          
          // Toggle view (infinite loop)
          onToggleDockView();
        }
      },
    })
  ).current;

  const [animDirection, setAnimDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: showDockView ? 1 : 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: showDockView ? 1 : 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ]).start();
  }, [showDockView, slideAnim, rotateAnim]);

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

  // Animasi dinamis mengikuti arah swipe - INFINITE LOOP
  // Swipe kanan: elemen masuk dari kiri | Swipe kiri: elemen masuk dari kanan
  const messageTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: animDirection === 'right' 
      ? [-width, 0]  // Swipe kanan: message masuk dari kiri
      : [width, 0]   // Swipe kiri: message masuk dari kanan
  });

  const dockTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: animDirection === 'right' 
      ? [-width, 0]  // Swipe kanan: dock masuk dari kiri
      : [width, 0]   // Swipe kiri: dock masuk dari kanan
  });

  const avatarRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    return () => {
      slideAnim.stopAnimation();
      rotateAnim.stopAnimation();
      settingsModalAnim.stopAnimation();
    };
  }, [slideAnim, rotateAnim, settingsModalAnim]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const updateMessage = () => {
      if (appState.current?.match(/inactive|background/)) return;
      const h = new Date().getHours();
      if (h >= 22 || h < 4) setMessage(`It's late, ${userName}. Put the phone down now! 😠 u need rest to stay healthy.`);
      else if (h >= 4 && h < 11) setMessage(`Good morning, ${userName}! ☀️ Wake up and conquer the day. Remember, I'm always cheering for u right here. 😘`);
      else if (h >= 11 && h < 15) setMessage(`Stop working for a bit! 😠 Have u had lunch, ${userName}? Don't u dare skip meals, I don't want u getting sick! 🍔`);
      else if (h >= 15 && h < 18) setMessage(`U must be tired, ${userName}.. ☕ Take a break, okay?.. 🤗`);
      else setMessage(`Are u done for the day? 🌙 No more wandering around. It's time for u to relax. 🥰`);
    };

    const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
    const startTimer = () => { stopTimer(); updateMessage(); timer = setInterval(updateMessage, 60000); };

    startTimer();
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (nextAppState === 'active') startTimer(); else stopTimer();
    });
    return () => { stopTimer(); subscription.remove(); };
  }, [userName]);

  const save = () => { onSaveUserName(tempName); setModalVisible(false); };

  return (
    <>
      <View style={styles.dockWrapper} {...panResponder.panHandlers}>
        <TouchableOpacity 
          style={styles.avatarBubble} 
          onPress={onToggleDockView}
          onLongPress={() => { setTempName(userName); setModalVisible(true); }} 
          activeOpacity={0.8}
        >
          <Animated.Image 
            source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
            style={[styles.avatarImage, { transform: [{ rotate: avatarRotate }] }]} 
          />
        </TouchableOpacity>

        <View style={styles.contentWrapper}>
          {/* MESSAGE VIEW */}
          <Animated.View 
            style={[
              styles.messageBubble, 
              { 
                transform: [{ 
                  translateX: showDockView 
                    ? (animDirection === 'right' ? width : -width)  // Sembunyikan di sisi berlawanan
                    : messageTranslateX 
                }],
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              }
            ]}
            pointerEvents={showDockView ? 'none' : 'auto'}
          >
            <Text style={styles.assistantText}>{message}</Text>
          </Animated.View>

          {/* DOCK APPS VIEW */}
          <Animated.View 
            style={[
              styles.dockAppsContainer, 
              { 
                transform: [{ 
                  translateX: showDockView 
                    ? dockTranslateX 
                    : (animDirection === 'right' ? width : -width)  // Sembunyikan di sisi berlawanan
                }],
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              }
            ]}
            pointerEvents={showDockView ? 'auto' : 'none'}
          >
            {dockApps.length === 0 ? (
              <Text style={styles.emptyDockText}>Long press any app to pin here</Text>
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
          </Animated.View>
        </View>
      </View>

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

            <View style={styles.rowBetween}>
              <Text style={styles.settingText}>Show Hidden Apps</Text>
              <Switch
                value={showHidden}
                onValueChange={onToggleShowHidden}
                thumbColor={showHidden ? "#27ae60" : "#f4f3f4"}
                trackColor={{ false: "#767577", true: "#2ecc7130" }}
              />
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.settingText}>Show App Names</Text>
              <Switch
                value={showNames}
                onValueChange={onToggleShowNames}
                thumbColor={showNames ? "#27ae60" : "#f4f3f4"}
                trackColor={{ false: "#767577", true: "#2ecc7130" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.verticalBtnGroup}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnBlue, styles.btnFull]} onPress={onChangePhoto} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Change Avatar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} onPress={save} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
});

// ==================== MAIN APP ====================
const App = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [dockPackages, setDockPackages] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [showDockView, setShowDockView] = useState(false);

  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [listKey, setListKey] = useState(0);
  const modalScaleAnim = useRef(new Animated.Value(0)).current;

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
    return () => {
      modalScaleAnim.stopAnimation();
    };
  }, [modalScaleAnim]);

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
      const [uName, hidden, showH, avt, dock, showN] = await Promise.all([
        RNFS.exists(CUSTOM_USER_PATH).then(e => e ? RNFS.readFile(CUSTOM_USER_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_AVATAR_PATH).then(e => e ? RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64') : null),
        RNFS.exists(CUSTOM_DOCK_PATH).then(e => e ? RNFS.readFile(CUSTOM_DOCK_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_NAMES_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_NAMES_PATH, 'utf8') : null),
      ]);
      if (uName) setUserName(uName);
      if (hidden) setHiddenPackages(JSON.parse(hidden));
      if (showH) setShowHidden(showH === 'true');
      if (avt) setAvatarSource(`data:image/jpeg;base64,${avt}`);
      if (dock) setDockPackages(JSON.parse(dock));
      if (showN !== null) setShowNames(showN === 'true');
      setLoading(false);
    };
    init();
    refreshApps();

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      refreshApps();
    });

    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        setTimeout(() => refreshApps(), 1000);
      }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
    };
  }, [refreshApps]);

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
      
      // BUG FIX: Auto-remove from dock when hiding
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

  const saveName = (n: string) => { setUserName(n); RNFS.writeFile(CUSTOM_USER_PATH, n, 'utf8'); };
  const toggleHidden = (v: boolean) => { setShowHidden(v); RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); };
  const toggleShowNames = (v: boolean) => { setShowNames(v); RNFS.writeFile(CUSTOM_SHOW_NAMES_PATH, v ? 'true' : 'false', 'utf8'); };
  const toggleDockView = () => setShowDockView(prev => !prev);
  
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
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })}
      />
      <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.75)', '#000000']} style={styles.gradientFade} pointerEvents="none" />
      <AssistantDock
        userName={userName} 
        showHidden={showHidden}
        showNames={showNames}
        avatarSource={avatarSource}
        dockApps={dockApps}
        showDockView={showDockView}
        onSaveUserName={saveName} 
        onToggleShowHidden={toggleHidden}
        onToggleShowNames={toggleShowNames}
        onChangePhoto={changePhoto}
        onLaunchApp={launchApp}
        onLongPressApp={handleLongPress}
        onToggleDockView={toggleDockView}
      />
      
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
              {/* Pin/Unpin Button */}
              <TouchableOpacity 
                style={[styles.actionBtn, isDocked ? styles.btnOrange : styles.btnPurple, styles.btnFull]} 
                onPress={pinToDock} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {isDocked ? '📌 Unpin from Dock' : '📌 Pin to Dock'}
                </Text>
              </TouchableOpacity>

              {/* Hide/Unhide Button */}
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} 
                onPress={doAction} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {actionType === 'unhide' ? '👁️ Unhide' : '🙈 Hide'}
                </Text>
              </TouchableOpacity>

              {/* Uninstall Button */}
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
  list: { paddingTop: 50, paddingBottom: 130 },
  item: { width: ITEM_WIDTH, height: 90, alignItems: 'center', marginBottom: 8 },
  iconContainer: { width: ICON_SIZE, height: ICON_SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', marginHorizontal: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  dockWrapper: { position: 'absolute', bottom: 24, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end', height: 60, zIndex: 2 },
  avatarBubble: { width: 60, height: 60, backgroundColor: '#000000', borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', marginRight: 12, elevation: 5 },
  avatarImage: { width: 55, height: 55, borderRadius: 27.5 },
  contentWrapper: { flex: 1, height: 60, position: 'relative' },
  messageBubble: { flex: 1, minHeight: 60, backgroundColor: '#000000', borderRadius: 30, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#333', elevation: 5 },
  assistantText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  dockAppsContainer: { flex: 1, height: 60, backgroundColor: '#000000', borderRadius: 30, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: '#333', elevation: 5 },
  dockAppsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 8 },
  dockAppItem: { width: DOCK_ICON_SIZE, height: DOCK_ICON_SIZE, justifyContent: 'center', alignItems: 'center' },
  emptyDockText: { color: '#424242', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
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
