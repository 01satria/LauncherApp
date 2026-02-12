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

// ==================== 1. SAFE IMAGE (ANTI CRASH) ====================
const SafeAppIcon = memo(({ iconUri }: { iconUri: string }) => {
  const [error, setError] = useState(false);
  if (error) return <View style={{ width: ICON_SIZE, height: ICON_SIZE }} />; // Kotak kosong

  return (
    <Image
      source={{ uri: iconUri }}
      style={styles.appIconImage}
      resizeMode="contain"
      resizeMethod="resize"
      fadeDuration={0}
      onError={() => setError(true)}
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
      if (h >= 22 || h < 4) setMessage(`It's getting late, ${userName}.. 😴 Good night! ❤️`);
      else if (h >= 4 && h < 11) setMessage(`Good morning ${userName}! ☀️ Let's do our best today! 😘`);
      else if (h >= 11 && h < 15) setMessage(`Don't forget lunch, ${userName}.. 🍔 I love u! ❤️`);
      else if (h >= 15 && h < 18) setMessage(`Tired, ${userName}? ☕ I want to hug u.. 🤗`);
      else setMessage(`Good evening, ${userName}. 🌙 Stay with me? 🥰`);
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
            <Text style={styles.modalTitle}>Settings</Text>
            <TextInput style={styles.input} value={tempName} onChangeText={setTempName} placeholder="Name" placeholderTextColor="#666" />
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

  // KUNCI ANTI GLITCH: Key ini memaksa FlatList dibuat ulang saat uninstall
  const [listKey, setListKey] = useState(0);

  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  // Fungsi load data (BERAT - Jangan dipanggil saat uninstall)
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

    // 1. INSTALL LISTENER (Boleh refresh karena file nambah)
    const installSub = InstalledApps.startListeningForAppInstallations(() => {
        ToastAndroid.show("New App Installed", ToastAndroid.SHORT);
        refreshApps();
    });

    // 2. REMOVE LISTENER (SAFE MODE)
    // JANGAN PANGGIL refreshApps() DISINI! ITU PENYEBAB CRASH.
    const removeSub = InstalledApps.startListeningForAppRemovals((pkg) => {
        const pkgData: any = pkg; 
        const removedPkgName = typeof pkgData === 'string' ? pkgData : pkgData?.packageName;
        
        if (removedPkgName) {
            // Cukup hapus dari State React saja. 
            // Jangan tanya Native Module untuk data baru (karena Native lagi sibuk hapus file)
            setAllApps((currentApps) => 
                currentApps.filter(app => app.packageName !== removedPkgName)
            );
            
            // Flush UI
            setListKey(prev => prev + 1);
        }
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
      InstalledApps.stopListeningForAppRemovals();
    };
  }, [refreshApps]);

  useEffect(() => {
    requestAnimationFrame(() => {
        setFilteredApps(showHidden ? allApps : allApps.filter(app => !hiddenPackages.includes(app.packageName)));
    });
  }, [allApps, hiddenPackages, showHidden]);

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
        key={listKey} // Reset list saat ada perubahan drastis
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
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)', '#000000']} style={styles.gradientFade} pointerEvents="none" />
      <AssistantDock
        userName={userName} showHidden={showHidden} avatarSource={avatarSource}
        onSaveUserName={saveName} onToggleShowHidden={toggleHidden} onChangePhoto={changePhoto}
      />
      <Modal visible={actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{actionType === 'unhide' ? 'Unhide' : 'Hide'} {selectedLabel}?</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setActionModal(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={doAction}><Text style={styles.btnSave}>Confirm</Text></TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: '#333', marginVertical: 15, width: '100%' }} />
            <TouchableOpacity style={{ paddingVertical: 10, alignItems: 'center', width: '100%' }} onPress={handleUninstall}>
              <Text style={styles.menuButtonTextRed}>Uninstall This App</Text>
            </TouchableOpacity>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.8, backgroundColor: '#1c1c1c', padding: 20, borderRadius: 16, borderColor: '#333', borderWidth: 1 },
  modalTitle: { color: '#fff', fontSize: 18, marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  btnText: { color: '#aaa', fontSize: 15 },
  btnSave: { color: '#4caf50', fontSize: 15, fontWeight: 'bold' },
  menuButtonTextRed: { color: '#ff5252', fontSize: 16, fontWeight: 'bold' },
});

export default App;