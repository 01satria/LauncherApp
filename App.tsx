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
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

// Module Java/Kotlin
const { UninstallModule } = NativeModules;

interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ICON_SIZE = 56;
const DOCK_ICON_SIZE = 52;
const MAX_DOCK_APPS = 5;
const DOCK_DROP_ZONE_HEIGHT = 120;

const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const CUSTOM_DOCK_PATH = `${CUSTOM_AVATAR_DIR}/dock.json`;
const CUSTOM_NOTIF_SHOWN_PATH = `${CUSTOM_AVATAR_DIR}/notif_shown.txt`;
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// ==================== SAFE IMAGE ====================
const SafeAppIcon = memo(({ iconUri, size = ICON_SIZE }: { iconUri: string; size?: number }) => {
  const [error, setError] = useState(false);
  const uri = iconUri.startsWith('file://') ? iconUri : `file://${iconUri}`;

  if (error) {
    return <View style={{ width: size, height: size, backgroundColor: '#222', borderRadius: size / 4 }} />;
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
      onError={() => setError(true)}
    />
  );
});

// ==================== DRAGGABLE APP ITEM ====================
interface DraggableItemProps {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  onDragStart: (item: AppData, pageY: number) => void;
  onDragMove: (pageY: number) => void;
  onDragEnd: (item: AppData, pageY: number) => void;
  isBeingDragged: boolean;
}

const DraggableItem = memo(({ 
  item, 
  onPress, 
  onLongPress, 
  onDragStart,
  onDragMove,
  onDragEnd,
  isBeingDragged 
}: DraggableItemProps) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const hasMoved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => isDragEnabled,
      
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        hasMoved.current = false;
        setIsDragEnabled(false);
        
        // Timer 1 detik untuk enable drag atau show modal
        longPressTimer.current = setTimeout(() => {
          if (!hasMoved.current) {
            // Setelah 1 detik hold
            setIsDragEnabled(true);
            // Jika masih tidak bergerak, show modal
            setTimeout(() => {
              if (!hasMoved.current) {
                onLongPress(item.packageName, item.label);
                setIsDragEnabled(false);
              }
            }, 100);
          }
        }, 1000);
      },
      
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const moved = Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        
        if (moved) {
          hasMoved.current = true;
        }
        
        // Jika drag enabled dan user gerak, mulai drag
        if (isDragEnabled && moved) {
          if (!isDragging) {
            setIsDragging(true);
            onDragStart(item, evt.nativeEvent.pageY);
          }
          
          if (isDragging) {
            pan.setValue({ x: gestureState.dx, y: gestureState.dy });
            onDragMove(evt.nativeEvent.pageY);
          }
        }
      },
      
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        // Clear timer
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (isDragging) {
          // User drag dan release
          onDragEnd(item, evt.nativeEvent.pageY);
          
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            setIsDragging(false);
            setIsDragEnabled(false);
          });
        } else if (!hasMoved.current && !isDragEnabled) {
          // Tap cepat = buka app
          onPress(item.packageName);
        }
        
        // Reset
        hasMoved.current = false;
        setIsDragEnabled(false);
      },
      
      onPanResponderTerminate: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start(() => {
          setIsDragging(false);
          setIsDragEnabled(false);
        });
        
        hasMoved.current = false;
      },
    })
  ).current;

  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [item.packageName]);

  return (
    <Animated.View
      style={[
        styles.item,
        isDragging && styles.itemDragging,
        isBeingDragged && { opacity: 0.3 },
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.iconContainer}>
        <SafeAppIcon iconUri={item.icon} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </Animated.View>
  );
}, (prev, next) => 
  prev.item.packageName === next.item.packageName && 
  prev.item.icon === next.item.icon &&
  prev.isBeingDragged === next.isBeingDragged
);

// ==================== NOTIFICATION ASSISTANT ====================
const AssistantNotification = memo(({ userName, onDismiss, avatarSource }: any) => {
  const [message, setMessage] = useState("");
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 22 || h < 4) setMessage(`It's late, ${userName}. Put the phone down now! 😠`);
    else if (h >= 4 && h < 11) setMessage(`Good morning, ${userName}! ☀️ Have a great day!`);
    else if (h >= 11 && h < 15) setMessage(`Stop working! 😠 Have u had lunch, ${userName}?`);
    else if (h >= 15 && h < 18) setMessage(`U must be tired, ${userName}.. ☕ Take a break!`);
    else setMessage(`Are u done for the day? 🌙 Time to relax, ${userName}.`);

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 8000);

    return () => clearTimeout(timer);
  }, [userName]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  return (
    <Animated.View style={[styles.notificationContainer, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.notificationContent} onPress={handleDismiss} activeOpacity={0.9}>
        <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.notifAvatar} />
        <View style={styles.notifTextContainer}>
          <Text style={styles.notifTitle}>Assistant</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} style={styles.notifClose}>
          <Text style={styles.notifCloseText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ==================== DOCK COMPONENT ====================
const DockComponent = memo(({ dockApps, onLaunch, onLongPress, isDropZone }: any) => {
  return (
    <View style={styles.dockContainer}>
      <View style={[styles.dockBackground, isDropZone && styles.dockHighlight]}>
        {dockApps.map((app: AppData) => (
          <TouchableOpacity
            key={app.packageName}
            style={styles.dockItem}
            onPress={() => onLaunch(app.packageName)}
            onLongPress={() => onLongPress(app.packageName, app.label)}
            activeOpacity={0.7}
            delayLongPress={300}
          >
            <SafeAppIcon iconUri={app.icon} size={DOCK_ICON_SIZE} />
          </TouchableOpacity>
        ))}
        
        {dockApps.length < MAX_DOCK_APPS && (
          <View style={styles.dockEmptySlot}>
            <View style={styles.dockEmptyDot} />
          </View>
        )}
      </View>
    </View>
  );
});

// ==================== SETTINGS MODAL ====================
const SettingsModal = memo(({ visible, onClose, userName, showHidden, avatarSource, onSave, onToggleHidden, onChangePhoto }: any) => {
  const [tempName, setTempName] = useState(userName);

  useEffect(() => {
    setTempName(userName);
  }, [userName]);

  const handleSave = () => {
    onSave(tempName);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Your Name</Text>
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
              onValueChange={onToggleHidden}
              thumbColor={showHidden ? "#27ae60" : "#f4f3f4"}
              trackColor={{ false: "#767577", true: "#2ecc7130" }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.verticalBtnGroup}>
            <TouchableOpacity style={[styles.actionBtn, styles.btnBlue, styles.btnFull]} onPress={onChangePhoto} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>Change Avatar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// ==================== MAIN APP ====================
const App = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [dockApps, setDockApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notifShown, setNotifShown] = useState(false);

  const [actionModal, setActionModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide' | 'remove_dock'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [listKey, setListKey] = useState(0);
  
  const [draggingApp, setDraggingApp] = useState<AppData | null>(null);
  const [isOverDock, setIsOverDock] = useState(false);
  const dockZoneY = useRef(height - DOCK_DROP_ZONE_HEIGHT);

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
      await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => {});
      const [uName, hidden, showH, avt, dock, notifS] = await Promise.all([
        RNFS.exists(CUSTOM_USER_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_USER_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_HIDDEN_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_AVATAR_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64') : null),
        RNFS.exists(CUSTOM_DOCK_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_DOCK_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_NOTIF_SHOWN_PATH).then((e: boolean) => e ? RNFS.readFile(CUSTOM_NOTIF_SHOWN_PATH, 'utf8') : null),
      ]);
      
      if (uName) setUserName(uName);
      if (hidden) setHiddenPackages(JSON.parse(hidden));
      if (showH) setShowHidden(showH === 'true');
      if (avt) setAvatarSource(`data:image/jpeg;base64,${avt}`);
      if (dock) {
        const dockData = JSON.parse(dock);
        setDockApps(dockData);
      }
      
      const today = new Date().toDateString();
      if (notifS !== today) {
        setShowNotification(true);
        setNotifShown(false);
      } else {
        setNotifShown(true);
      }
      
      setLoading(false);
    };
    init();
    refreshApps();

    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      refreshApps();
    });

    const appStateSub = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        setTimeout(() => refreshApps(), 1000);
        
        const today = new Date().toDateString();
        RNFS.exists(CUSTOM_NOTIF_SHOWN_PATH).then((exists: boolean) => {
          if (exists) {
            RNFS.readFile(CUSTOM_NOTIF_SHOWN_PATH, 'utf8').then((date: string) => {
              if (date !== today && !notifShown) {
                setShowNotification(true);
              }
            });
          } else if (!notifShown) {
            setShowNotification(true);
          }
        });
      }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      appStateSub.remove();
    };
  }, [refreshApps]);

  // Filtering Logic
  useEffect(() => {
    const dockPackages = dockApps.map((app: AppData) => app.packageName);
    const filtered = allApps.filter((app: AppData) => {
      if (dockPackages.includes(app.packageName)) return false;
      if (!showHidden && hiddenPackages.includes(app.packageName)) return false;
      return true;
    });
    setFilteredApps(filtered);
  }, [allApps, hiddenPackages, showHidden, dockApps]);

  // Update dock apps when allApps changes
  useEffect(() => {
    setDockApps((prevDock: AppData[]) => {
      return prevDock.map((dockApp: AppData) => {
        const updatedApp = allApps.find((app: AppData) => app.packageName === dockApp.packageName);
        return updatedApp || dockApp;
      }).filter((app: AppData) => allApps.some((a: AppData) => a.packageName === app.packageName));
    });
  }, [allApps]);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg);
    const isInDock = dockApps.some((app: AppData) => app.packageName === pkg);
    
    if (isInDock) {
      setActionType('remove_dock');
    } else {
      setActionType(isHidden ? 'unhide' : 'hide');
    }
    
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, [hiddenPackages, dockApps]);

  const doAction = async () => {
    if (actionType === 'remove_dock') {
      const newDock = dockApps.filter((app: AppData) => app.packageName !== selectedPkg);
      setDockApps(newDock);
      await RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
      ToastAndroid.show('App removed from dock', ToastAndroid.SHORT);
    } else {
      let newList = [...hiddenPackages];
      if (actionType === 'unhide') {
        newList = newList.filter((p: string) => p !== selectedPkg);
      } else if (!newList.includes(selectedPkg)) {
        newList.push(selectedPkg);
      }
      setHiddenPackages(newList);
      await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
      ToastAndroid.show(actionType === 'hide' ? 'App Hidden' : 'App Visible', ToastAndroid.SHORT);
    }
    setActionModal(false);
  };

  const handleUninstall = () => {
    const pkgToRemove = selectedPkg;
    setActionModal(false);

    setDockApps((prev: AppData[]) => {
      const newDock = prev.filter((app: AppData) => app.packageName !== pkgToRemove);
      RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
      return newDock;
    });

    setAllApps((prev: AppData[]) => prev.filter((app: AppData) => app.packageName !== pkgToRemove));
    setListKey(prev => prev + 1);

    setTimeout(() => {
      if (UninstallModule) {
        UninstallModule.uninstallApp(pkgToRemove);
      }
    }, 420);

    setTimeout(() => refreshApps(), 1800);
    setTimeout(() => refreshApps(), 4500);
  };

  const launchApp = (pkg: string) => {
    try { 
      RNLauncherKitHelper.launchApplication(pkg); 
    } catch { 
      ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); 
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((item: AppData, pageY: number) => {
    setDraggingApp(item);
    setIsOverDock(pageY > dockZoneY.current);
  }, []);

  const handleDragMove = useCallback((pageY: number) => {
    setIsOverDock(pageY > dockZoneY.current);
  }, []);

  const handleDragEnd = useCallback((item: AppData, pageY: number) => {
    const isOverDockNow = pageY > dockZoneY.current;
    
    if (isOverDockNow && draggingApp) {
      if (dockApps.length >= MAX_DOCK_APPS) {
        ToastAndroid.show('Dock is full (max 5 apps)', ToastAndroid.SHORT);
      } else {
        const alreadyInDock = dockApps.some((app: AppData) => app.packageName === item.packageName);
        if (!alreadyInDock) {
          const newDock = [...dockApps, item];
          setDockApps(newDock);
          RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(newDock), 'utf8');
          ToastAndroid.show(`${item.label} added to dock`, ToastAndroid.SHORT);
        }
      }
    }
    
    setDraggingApp(null);
    setIsOverDock(false);
  }, [draggingApp, dockApps]);

  const dismissNotification = useCallback(() => {
    setShowNotification(false);
    setNotifShown(true);
    const today = new Date().toDateString();
    RNFS.writeFile(CUSTOM_NOTIF_SHOWN_PATH, today, 'utf8');
  }, []);

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }: { item: AppData }) => (
    <DraggableItem 
      item={item} 
      onPress={launchApp} 
      onLongPress={handleLongPress}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      isBeingDragged={draggingApp?.packageName === item.packageName}
    />
  ), [handleLongPress, handleDragStart, handleDragMove, handleDragEnd, draggingApp]);

  const saveName = (n: string) => { 
    setUserName(n); 
    RNFS.writeFile(CUSTOM_USER_PATH, n, 'utf8'); 
  };
  
  const toggleHidden = (v: boolean) => { 
    setShowHidden(v); 
    RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); 
  };
  
  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibrary({ 
      mediaType: 'photo', 
      includeBase64: true, 
      maxWidth: 200, 
      maxHeight: 200 
    });
    if (res.assets?.[0]?.base64) {
      const b64 = res.assets[0].base64;
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
      RNFS.writeFile(CUSTOM_AVATAR_PATH, b64, 'base64');
    }
  };

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
      
      {/* Settings Gear Icon */}
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={() => setSettingsModal(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>

      {/* App List */}
      <FlatList
        key={listKey}
        data={filteredApps}
        numColumns={4}
        keyExtractor={(item: AppData) => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({ 
          length: 90, 
          offset: 90 * Math.floor(index / 4), 
          index 
        })}
      />

      {/* Gradient Fade */}
      <LinearGradient 
        colors={['transparent', 'rgba(0, 0, 0, 0.75)', '#000000']} 
        style={styles.gradientFade} 
        pointerEvents="none" 
      />

      {/* Dock */}
      <DockComponent 
        dockApps={dockApps}
        onLaunch={launchApp}
        onLongPress={handleLongPress}
        isDropZone={isOverDock}
      />

      {/* Assistant Notification */}
      {showNotification && !notifShown && (
        <AssistantNotification 
          userName={userName}
          avatarSource={avatarSource}
          onDismiss={dismissNotification}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal 
        visible={settingsModal}
        onClose={() => setSettingsModal(false)}
        userName={userName}
        showHidden={showHidden}
        avatarSource={avatarSource}
        onSave={saveName}
        onToggleHidden={toggleHidden}
        onChangePhoto={changePhoto}
      />

      {/* Action Modal */}
      <Modal 
        visible={actionModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedLabel}</Text>
              <TouchableOpacity onPress={() => setActionModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Select an action for this app:</Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnGreen, styles.btnHalf]} 
                onPress={doAction} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {actionType === 'remove_dock' ? 'Remove Dock' : actionType === 'unhide' ? 'Unhide' : 'Hide'}
                </Text>
              </TouchableOpacity>

              <View style={{ width: 15 }} />

              <TouchableOpacity 
                style={[styles.actionBtn, styles.btnRed, styles.btnHalf]} 
                onPress={handleUninstall} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Uninstall</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 50, paddingBottom: 140 },
  
  settingsButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
  },
  settingsIcon: {
    fontSize: 24,
  },

  item: { 
    width: ITEM_WIDTH, 
    height: 90, 
    alignItems: 'center', 
    marginBottom: 8,
  },
  itemDragging: {
    opacity: 0.7,
    transform: [{ scale: 1.15 }],
    elevation: 10,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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

  notificationContainer: {
    position: 'absolute',
    top: 60,
    left: 15,
    right: 15,
    zIndex: 100,
  },
  notificationContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  notifAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    marginRight: 12,
  },
  notifTextContainer: {
    flex: 1,
  },
  notifTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  notifMessage: {
    color: '#ddd',
    fontSize: 12,
    lineHeight: 16,
  },
  notifClose: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 14,
    marginLeft: 8,
  },
  notifCloseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  dockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 80,
    zIndex: 2,
  },
  dockBackground: {
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
  },
  dockHighlight: {
    borderColor: '#27ae60',
    borderWidth: 2,
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
  },
  dockItem: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  dockEmptySlot: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  dockEmptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#555',
  },

  gradientFade: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    height: 220, 
    zIndex: 1 
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 15,
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 25,
  },

  inputLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modernInput: {
    backgroundColor: '#2C2C2C',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
    width: '100%',
  },

  verticalBtnGroup: {
    width: '100%',
    gap: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHalf: {
    flex: 1,
  },
  btnFull: {
    width: '100%',
  },
  btnGreen: { backgroundColor: '#27ae60' },
  btnBlue: { backgroundColor: '#2980b9' },
  btnRed: { backgroundColor: '#c0392b' },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

// @2026 Satria Dev - SATRIA LAUNCHER - All Rights Reserved
// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
export default App;
