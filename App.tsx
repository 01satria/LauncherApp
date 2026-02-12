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
  Platform
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

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ICON_SIZE = 56;

const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// ==================== 1. SAFE IMAGE ====================
// Penyelamat saat file icon tiba-tiba hilang!
const SafeAppIcon = memo(({ iconUri }: { iconUri: string }) => {
  const [error, setError] = useState(false);
  if (error) return <View style={{ width: ICON_SIZE, height: ICON_SIZE }} />; // Render kosong

  return (
    <Image
      source={{ uri: iconUri }}
      style={styles.appIconImage}
      resizeMode="contain"
      resizeMethod="resize"
      fadeDuration={0}
      onError={() => setError(true)} // Tangkap error nativenya disini
    />
  );
});

// ==================== ITEM LIST ====================
const MemoizedItem = memo(({ item, onPress, onLongPress }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {
  const iconSource = item.icon.startsWith('file://') ? item.icon : `file://${item.icon}`;
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      <View style={styles.iconContainer}>
        <SafeAppIcon iconUri={iconSource} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName && prev.item.icon === next.item.icon);

// ==================== DOCK ASSISTANT ====================
const AssistantDock = memo(({ userName, showHidden, onSaveUserName, onToggleShowHidden, onChangePhoto, avatarSource }: any) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const updateMessage = () => {
      if (appState.current && appState.current.match(/inactive|background/)) return;
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
      <View style={styles.dockWrapper}>
        <TouchableOpacity style={styles.avatarBubble} onLongPress={() => { setTempName(userName); setModalVisible(true); }} activeOpacity={0.7}>
          <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatarImage} />
        </TouchableOpacity>
        <View style={styles.messageBubble}><Text style={styles.assistantText}>{message}</Text></View>
      </View>
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            {/* HEADER: Judul & Tombol Close (X) */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* INPUT NAMA */}
            <Text style={styles.inputLabel}>Ur Name</Text>
            <TextInput
              style={styles.modernInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter name..."
              placeholderTextColor="#666"
            />

            {/* TOGGLE HIDDEN APPS */}
            <View style={styles.rowBetween}>
              <Text style={styles.settingText}>Show Hidden Apps</Text>
              <Switch
                value={showHidden}
                onValueChange={onToggleShowHidden}
                thumbColor={showHidden ? "#27ae60" : "#f4f3f4"}
                trackColor={{ false: "#767577", true: "#2ecc7130" }}
              />
            </View>

            {/* GARIS PEMISAH */}
            <View style={styles.divider} />

            {/* ACTION BUTTONS (Stacked) */}
            <View style={styles.verticalBtnGroup}>

              {/* Tombol Change Avatar */}
              <TouchableOpacity style={[styles.actionBtn, styles.btnBlue, styles.btnFull]} onPress={onChangePhoto} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Change Avatar</Text>
              </TouchableOpacity>

              {/* Tombol Save */}
              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} onPress={save} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Save Changes</Text>
              </TouchableOpacity>

            </View>

          </View>
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
  const [showHidden, setShowHidden] = useState(false);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  // Flag untuk load data
  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getSortedApps();
      const apps = result.map((a: any) => ({
        label: a.label || 'App',
        packageName: a.packageName,
        icon: a.icon
      }));
      setAllApps(apps);
    } catch (e) { }
  }, []);

  useEffect(() => {
    const init = async () => {
      await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => { });
      const [uName, hidden, showH, avt] = await Promise.all([
        RNFS.exists(CUSTOM_USER_PATH).then(e => e ? RNFS.readFile(CUSTOM_USER_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8') : null),
        RNFS.exists(CUSTOM_AVATAR_PATH).then(e => e ? RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64') : null)
      ]);
      if (uName) setUserName(uName);
      if (hidden) setHiddenPackages(JSON.parse(hidden));
      if (showH) setShowHidden(showH === 'true');
      if (avt) setAvatarSource(`data:image/jpeg;base64,${avt}`);
      setLoading(false);
    };
    init();
    refreshApps();

    // === LISTENER INSTALL (Boleh Refresh) ===
    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      ToastAndroid.show("New App Installed", ToastAndroid.SHORT);
      refreshApps();
    });

    // === LISTENER UNINSTALL (ANTI CRASH / MODE HIDE) ===
    const removeSub = InstalledApps.startListeningForAppRemovals((pkg) => {
      // Ambil nama package
      const pkgData: any = pkg;
      const removedPkgName = typeof pkgData === 'string' ? pkgData : pkgData?.packageName;

      if (removedPkgName) {
        setAllApps((currentApps) =>
          currentApps.filter(app => app.packageName !== removedPkgName)
        );
      }
    });

    // === LISTENER APP STATE (SYNC SAAT RESUME) ===
    // Refresh data asli hanya dilakukan saat user balik ke launcher
    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // Delay sedikit biar aman
        setTimeout(() => refreshApps(), 500);
      }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      InstalledApps.stopListeningForAppRemovals();
      appStateSub.remove();
    };
  }, [refreshApps]);

  // Filtering Logic (Untuk Hide & Uninstall Realtime)
  useEffect(() => {
    requestAnimationFrame(() => {
      setFilteredApps(showHidden ? allApps : allApps.filter(app => !hiddenPackages.includes(app.packageName)));
    });
  }, [allApps, hiddenPackages, showHidden]);

  // Actions
  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg);
    setActionType(isHidden ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, [hiddenPackages]);

  const doAction = async () => {
    let newList = [...hiddenPackages];
    if (actionType === 'unhide') newList = newList.filter(p => p !== selectedPkg);
    else if (!newList.includes(selectedPkg)) newList.push(selectedPkg);
    setHiddenPackages(newList);
    RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
    ToastAndroid.show(actionType === 'hide' ? 'App Hidden' : 'App Visible', ToastAndroid.SHORT);
  };

  const handleUninstall = () => {
    try {
      setActionModal(false);
      if (UninstallModule) {
        UninstallModule.uninstallApp(selectedPkg);
      } else {
        ToastAndroid.show("Module Not Found", ToastAndroid.SHORT);
      }
    } catch (e) {
      ToastAndroid.show("Error", ToastAndroid.SHORT);
    }
  };

  const launchApp = (pkg: string) => {
    try { RNLauncherKitHelper.launchApplication(pkg); } catch { ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
  ), [handleLongPress]);

  const saveName = (n: string) => { setUserName(n); RNFS.writeFile(CUSTOM_USER_PATH, n, 'utf8'); };
  const toggleHidden = (v: boolean) => { setShowHidden(v); RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); };
  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true, maxWidth: 200, maxHeight: 200 });
    if (res.assets?.[0]?.base64) {
      const b64 = res.assets[0].base64;
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
      RNFS.writeFile(CUSTOM_AVATAR_PATH, b64, 'base64');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0f0" size="large" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={item => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })}
      />
      <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.75)', '#000000']} style={styles.gradientFade} pointerEvents="none" />
      <AssistantDock
        userName={userName} showHidden={showHidden} avatarSource={avatarSource}
        onSaveUserName={saveName} onToggleShowHidden={toggleHidden} onChangePhoto={changePhoto}
      />
      <Modal visible={actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            {/* HEADER: Judul App & Tombol Close (X) */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedLabel}</Text>
              <TouchableOpacity onPress={() => setActionModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Select an action for this app:</Text>

            {/* FOOTER: Dua Tombol Berdampingan */}
            <View style={styles.modalBtnRow}>

              {/* Tombol Kiri: Hide/Unhide (Hijau) */}
              <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, styles.btnHalf]} onPress={doAction} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>
                  {actionType === 'unhide' ? 'Unhide' : 'Hide'}
                </Text>
              </TouchableOpacity>

              {/* Spacing */}
              <View style={{ width: 15 }} />

              {/* Tombol Kanan: Uninstall (Merah) */}
              <TouchableOpacity style={[styles.actionBtn, styles.btnRed, styles.btnHalf]} onPress={handleUninstall} activeOpacity={0.8}>
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
  list: { paddingTop: 50, paddingBottom: 130 },
  item: { width: ITEM_WIDTH, height: 90, alignItems: 'center', marginBottom: 8 },
  iconContainer: { width: ICON_SIZE, height: ICON_SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  appIconImage: { width: ICON_SIZE, height: ICON_SIZE },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', marginHorizontal: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  dockWrapper: { position: 'absolute', bottom: 24, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end', minHeight: 60, zIndex: 2 },
  avatarBubble: { width: 60, height: 60, backgroundColor: '#000000', borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', marginRight: 12, elevation: 5 },
  avatarImage: { width: 55, height: 55, borderRadius: 35 },
  messageBubble: { flex: 1, minHeight: 60, backgroundColor: '#000000', borderRadius: 35, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#333', elevation: 5 },
  assistantText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  gradientFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, zIndex: 1 },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 },
  btnText: { color: '#aaa', fontSize: 15 },
  btnSave: { color: '#4caf50', fontSize: 15, fontWeight: 'bold' },
  menuButtonTextRed: { color: '#ff5252', fontSize: 16, fontWeight: 'bold' },
  // === GENERAL MODAL STYLES (REUSABLE) ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#000000', // Dark Modern
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

  // === FORM ELEMENTS ===
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

  // === BUTTONS & LAYOUT ===
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

  // Warna
  btnGreen: { backgroundColor: '#27ae60' },
  btnBlue: { backgroundColor: '#2980b9' },
  btnRed: { backgroundColor: '#c0392b' },

  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // === MODERN MODAL STYLE ===
  modalSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 25,
  },
});

// @2026 Satria Dev - SATRIA LAUNCHER - All Rights Reserved
// Website: https://01satria.vercel.app
// Github: https://github.com/01satria
export default App;