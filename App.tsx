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
  AppState, // Penting untuk deteksi background
  ListRenderItem,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

interface AppData {
  label: string;
  packageName: string;
  icon: string; // File Path
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ICON_SIZE = 56; // Ukuran fix icon

// Path Constants
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// ==================== ITEM LIST (RAM OPTIMIZED) ====================
const MemoizedItem = memo(({ item, onPress, onLongPress }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {

  // Pastikan path memiliki prefix file://
  const iconSource = item.icon.startsWith('file://') ? item.icon : `file://${item.icon}`;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={300} // Lebih cepet aja responnya
    >
      <View style={styles.iconContainer}>
        <Image
          source={{ uri: iconSource }}
          style={styles.appIconImage}
          // --- OPTIMASI RAM UTAMA ---
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
        />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => {
  return prev.item.packageName === next.item.packageName && prev.item.icon === next.item.icon;
});

// ==================== DOCK ASSISTANT (SPLIT STYLE) ====================
const AssistantDock = memo(({ userName, showHidden, onSaveUserName, onToggleShowHidden, onChangePhoto, avatarSource }: any) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const updateMessage = () => {
      if (appState.current.match(/inactive|background/)) return;

      const h = new Date().getHours();

      if (h >= 22 || h < 4) {
        setMessage(`It's getting late, ${userName}.. 😴 Let's sleep, I want to meet u in my dreams. Good night! ❤️`);
      }
      else if (h >= 4 && h < 11) {
        setMessage(`Good morning ${userName}! ☀️ Wake up.. I miss u so much already. Let's do our best today! 😘`);
      }
      else if (h >= 11 && h < 15) {
        setMessage(`Don't forget to have lunch, ${userName}.. 🍔 Take care of urself for me. I love u so much! ❤️`);
      }
      else if (h >= 15 && h < 18) {
        setMessage(`Are u tired, ${userName}? ☕ Take a break. I just want to hug u right now.. 🤗`);
      }
      else {
        setMessage(`Good evening, ${userName}. 🌙 Not seeing you all day felt like a year.. Stay with me now? 🥰`);
      }
    };

    updateMessage();
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (nextAppState === 'active') updateMessage();
    });

    const timer = setInterval(updateMessage, 60000);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [userName]);

  const save = () => { onSaveUserName(tempName); setModalVisible(false); };

  return (
    <>
      <View style={styles.dockWrapper}>

        {/* BAGIAN KIRI: AVATAR (Tombol Settings) */}
        <TouchableOpacity
          style={styles.avatarBubble}
          onLongPress={() => { setTempName(userName); setModalVisible(true); }}
          activeOpacity={0.7}
          delayLongPress={300}
        >
          <Image
            source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }}
            style={styles.avatarImage}
            // resizeMethod="resize"
          />
        </TouchableOpacity>

        {/* BAGIAN KANAN: PESAN TEKS */}
        <View style={styles.messageBubble}>
          <Text style={styles.assistantText}>{message}</Text>
        </View>

      </View>

      {/* Modal Settings tetap sama */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TextInput style={styles.input} value={tempName} onChangeText={setTempName} placeholder="Your Name" placeholderTextColor="#666" />
            <View style={styles.rowBetween}>
              <Text style={{ color: '#fff' }}>Show Hidden Apps</Text>
              <Switch value={showHidden} onValueChange={onToggleShowHidden} />
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={onChangePhoto}><Text style={styles.btnText}>Change Avatar</Text></TouchableOpacity>
              <TouchableOpacity onPress={save}><Text style={styles.btnSave}>Save</Text></TouchableOpacity>
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

  // 1. Load Data
  const refreshApps = useCallback(async () => {
    try {
      // Ambil sorted apps (biasanya lebih cepat dari sorting manual pake JS)
      const result = await InstalledApps.getSortedApps();

      // Mapping se ringan mungkin
      const apps = result.map((a: any) => ({
        label: a.label || 'App',
        packageName: a.packageName,
        icon: a.icon // File Path
      }));

      setAllApps(apps);
    } catch (e) {
      ToastAndroid.show("Failed to load apps", ToastAndroid.SHORT);
    }
  }, []);

  // 2. Init & Listeners
  useEffect(() => {
    const init = async () => {
      await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => { });

      // Load preferencesnya dibikin PARALEL (Promise.all) agar lebih cepat
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

    // Listeners v2.1.0
    const installSub = InstalledApps.startListeningForAppInstallations(() => refreshApps());
    const removeSub = InstalledApps.startListeningForAppRemovals(() => refreshApps());

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      InstalledApps.stopListeningForAppRemovals();
    };
  }, [refreshApps]);

  // 3. Filtering Logic
  useEffect(() => {
    // Pake requestAnimationFrame biar UI tidak freeze saat filtering banyak data sekaligus
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
    // Simpan file async tanpa await, di UI thread agar tidak ngelag
    RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
    ToastAndroid.show(actionType === 'hide' ? 'App Hidden' : 'App Visible', ToastAndroid.SHORT);
  };

  const launchApp = (pkg: string) => {
    try { RNLauncherKitHelper.launchApplication(pkg); } catch { ToastAndroid.show("Cannot Open", ToastAndroid.SHORT); }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
  ), [handleLongPress]);

  // Settings Handlers
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

        // === SETTINGAN FLATLIST UNTUK MAXIMUM PERFORMANCE ===
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })} // Fixed height for better performance
      />

      <LinearGradient
        // Warna: Transparan -> Hitam Agak Pekat -> Hitam Pekat
        colors={['transparent', 'rgba(0,0,0,0.6)', '#000000']}
        style={styles.gradientFade}
        pointerEvents="none"
      />

      <AssistantDock
        userName={userName} showHidden={showHidden} avatarSource={avatarSource}
        onSaveUserName={saveName} onToggleShowHidden={toggleHidden} onChangePhoto={changePhoto}
      />

      {/* Modal Action */}
      <Modal visible={actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{actionType === 'unhide' ? 'Unhide' : 'Hide'} {selectedLabel}?</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setActionModal(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={doAction}><Text style={styles.btnSave}>Confirm</Text></TouchableOpacity>
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
  iconContainer: {
    width: ICON_SIZE, height: ICON_SIZE,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4
  },
  appIconImage: { width: ICON_SIZE, height: ICON_SIZE },
  label: {
    color: '#eee', fontSize: 11, textAlign: 'center',
    marginHorizontal: 4,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3
  },

  // === STYLE DOCK (AUTO HEIGHT) ===
  dockWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 60,
  },

  // 1. Bubble Kiri
  avatarBubble: {
    width: 60,
    height: 60,
    backgroundColor: '#000000',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 12,
    elevation: 5,
  },

  avatarImage: {
    width: 55,
    height: 55,
    borderRadius: 35,
  },

  // 2. Bubble Kanan
  messageBubble: {
    flex: 1,
    minHeight: 60,
    backgroundColor: '#000000',
    borderRadius: 35,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#333',
    elevation: 5,
  },

  assistantText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },

  // Gradient Fade
  gradientFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200, // Tinggi area pudarnya
    zIndex: 1,   // Pastikan di atas list
  },

  // === MODAL STYLE ===
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.8, backgroundColor: '#1c1c1c', padding: 20, borderRadius: 16, borderColor: '#333', borderWidth: 1 },
  modalTitle: { color: '#fff', fontSize: 18, marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  btnText: { color: '#aaa', fontSize: 15 },
  btnSave: { color: '#4caf50', fontSize: 15, fontWeight: 'bold' },
});

// @SATRIA: Jangan dihapus ini, penting untuk ekspor komponen utama
// @SATRIA_LAUNCHER_APP 2026
export default App;