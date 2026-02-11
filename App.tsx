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
  DeviceEventEmitter,
  ListRenderItem,
} from 'react-native';
import type { EmitterSubscription } from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

// Interface Data Aplikasi (Hanya Text agar RAM Ringan)
interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;

// Konstanta File System
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;

// ==================== KOMPONEN PENGHEMAT RAM: AppIcon ====================
// Komponen ini bertugas mengambil icon HANYA saat ditampilkan.
// Jika di-scroll lewat, dia tidak akan membebani RAM.
const AppIcon = memo(({ packageName, label }: { packageName: string, label: string }) => {
  const [iconUri, setIconUri] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadIcon = async () => {
      try {
        // Mengambil icon spesifik untuk package ini
        const result = await RNLauncherKitHelper.getAppIcon(packageName);
        
        if (isMounted && result) {
            // Pastikan format base64 benar
            const cleanIcon = result.startsWith('data:image') 
                ? result 
                : `data:image/png;base64,${result}`;
            setIconUri(cleanIcon);
        }
      } catch (e) {
        // Jika gagal, biarkan null agar menampilkan inisial teks
      }
    };

    loadIcon();

    // Cleanup function: Mencegah update state jika komponen sudah hilang dari layar
    return () => { isMounted = false; };
  }, [packageName]);

  // Fallback: Jika icon belum loading atau gagal, tampilkan Inisial Huruf
  if (!iconUri) {
    const initial = label ? label.trim().substring(0, 1).toUpperCase() : "?";
    return <Text style={styles.initialText}>{initial}</Text>;
  }

  // Render Icon Asli
  return (
    <Image 
      source={{ uri: iconUri }} 
      style={styles.appIconImage} 
      resizeMode="contain"
      // fadeDuration={0} // Opsi: matikan animasi fade agar terasa lebih cepat
    />
  );
});

// ==================== Memoized Item ====================
const MemoizedItem = memo(({ item, onPress, onLongPress }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={500}
    >
      <View style={styles.iconBox}>
        {/* Panggil komponen AppIcon di sini */}
        <AppIcon packageName={item.packageName} label={item.label} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
});

// ==================== AssistantDock (Tetap Sama) ====================
const AssistantDock = memo(({ userName, showHidden, onSaveUserName, onToggleShowHidden, onChangePhoto, avatarSource }: any) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);

  useEffect(() => {
    const updateMessage = () => {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 4) setMessage(`It's late, ${userName}. 😴 Go to sleep.`);
      else if (hour >= 4 && hour < 11) setMessage(`Morning, ${userName}! ☀️ Have a great day.`);
      else if (hour >= 11 && hour < 15) setMessage(`Lunch time, ${userName}! 🌤️ Keep it up!`);
      else if (hour >= 15 && hour < 18) setMessage(`Hey ${userName}, take a break. 🌇`);
      else if (hour >= 18 && hour < 20) setMessage(`Evening, ${userName}! 🌇 I'm here.`);
      else setMessage(`Good night, ${userName}! 🌙 You did great.`);
    };
    updateMessage();
    const id = setInterval(updateMessage, 60000);
    return () => clearInterval(id);
  }, [userName]);

  const save = () => { onSaveUserName(tempName); setModalVisible(false); };
  
  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockContent}>
        <TouchableOpacity onLongPress={() => { setTempName(userName); setModalVisible(true); }}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatar} />
            <View style={styles.onlineIndicator} />
          </View>
        </TouchableOpacity>
        <View style={styles.messageContainer}>
          <Text style={styles.assistantText} numberOfLines={2}>{message}</Text>
        </View>
      </View>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TextInput style={styles.modalInput} value={tempName} onChangeText={setTempName} placeholder="Your Name" placeholderTextColor="#666" />
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Show Hidden Apps</Text>
              <Switch value={showHidden} onValueChange={onToggleShowHidden} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={onChangePhoto} style={{marginRight: 15}}><Text style={styles.modalButtonText}>Change Photo</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginRight: 15}}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save}><Text style={styles.saveButton}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

// ==================== Main App ====================
const App = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);

  // Action Modal State
  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const packageListener = useRef<EmitterSubscription | null>(null);

  // --- FUNGSI LOAD DATA UTAMA (Sangat Ringan) ---
  const refreshApps = useCallback(async () => {
    try {
      // Kita HANYA mengambil label & packageName.
      // JANGAN mengambil icon di sini (berat).
      const result = await InstalledApps.getApps();
      
      const apps = result
        .map((a: any) => ({ 
          label: a.label || 'App', 
          packageName: a.packageName 
        }))
        .filter((a: any) => a.packageName)
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      setAllApps(apps);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Init Data
  useEffect(() => {
    const init = async () => {
      await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => {});
      try {
        if (await RNFS.exists(CUSTOM_USER_PATH)) setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));
        if (await RNFS.exists(CUSTOM_HIDDEN_PATH)) setHiddenPackages(JSON.parse(await RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8')));
        if (await RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH)) setShowHidden((await RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8')) === 'true');
        if (await RNFS.exists(CUSTOM_AVATAR_PATH)) setAvatarSource(`data:image/jpeg;base64,${await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64')}`);
      } catch (_) {}
      setLoading(false);
    };
    init();
    refreshApps();
  }, [refreshApps]);

  // Listener Install/Uninstall
  useEffect(() => {
    packageListener.current = DeviceEventEmitter.addListener("PACKAGE_CHANGED", () => {
      refreshApps();
    });
    return () => { packageListener.current?.remove(); };
  }, [refreshApps]);

  // Filtering Logic
  useEffect(() => {
    setFilteredApps(showHidden ? allApps : allApps.filter(app => !hiddenPackages.includes(app.packageName)));
  }, [allApps, hiddenPackages, showHidden]);

  // Handlers
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
    await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
    ToastAndroid.show(`App ${actionType === 'hide' ? 'Hidden' : 'Visible'}`, ToastAndroid.SHORT);
  };

  const launchApp = (pkg: string) => {
    try { RNLauncherKitHelper.launchApplication(pkg); } catch { ToastAndroid.show("Error launching", ToastAndroid.SHORT); }
  };

  const saveName = async (n: string) => { await RNFS.writeFile(CUSTOM_USER_PATH, n, 'utf8'); setUserName(n); };
  const toggleHidden = async (v: boolean) => { setShowHidden(v); await RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); };
  const changePhoto = async () => {
      const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.5, maxWidth: 200, maxHeight: 200 });
      if (res.assets?.[0]?.base64) {
          await RNFS.writeFile(CUSTOM_AVATAR_PATH, res.assets[0].base64, 'base64');
          setAvatarSource(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
  ), [handleLongPress]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0f0" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      
      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={item => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        removeClippedSubviews={true} // PENTING untuk performa
        initialNumToRender={16}      // Hanya render yang terlihat di awal
        maxToRenderPerBatch={8}      // Render sedikit demi sedikit
        windowSize={5}               // Jangan simpan terlalu banyak di memori (di luar layar)
        getItemLayout={(data, index) => (
            {length: 112, offset: 112 * index, index} // Optimasi kalkulasi scroll
        )}
      />
      
      <AssistantDock 
         userName={userName} showHidden={showHidden} 
         onSaveUserName={saveName} onToggleShowHidden={toggleHidden} 
         onChangePhoto={changePhoto} avatarSource={avatarSource} 
      />

      {/* Modal Hide/Unhide */}
      <Modal visible={actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{actionType === 'unhide' ? 'Unhide' : 'Hide'} App</Text>
                <Text style={styles.modalMessage}>Do you want to {actionType} "{selectedLabel}"?</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => setActionModal(false)}><Text style={[styles.modalButtonText, {marginRight: 20}]}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={doAction}><Text style={styles.saveButton}>Confirm</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 60, paddingBottom: 130 },
  item: { width: ITEM_WIDTH, height: 100, alignItems: 'center', marginBottom: 12 },
  
  // Icon Box yang lebih rapi
  iconBox: { 
      width: 58, 
      height: 58, 
      justifyContent: 'center', 
      alignItems: 'center',
      // backgroundColor: 'rgba(0,0,0,0.2)', // Opsional: background tipis di belakang icon
      // borderRadius: 12 
  },
  
  // Style untuk Icon Gambar
  appIconImage: { 
      width: 58, 
      height: 58 
  },
  
  // Style untuk Fallback Text Inisial
  initialText: { 
      color: '#fff', 
      fontSize: 24, 
      fontWeight: 'bold',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowRadius: 4
  },
  
  label: { 
      color: '#eee', 
      fontSize: 11, 
      textAlign: 'center', 
      marginTop: 6, 
      marginHorizontal: 4, 
      textShadowColor: '#000', 
      textShadowRadius: 3 
  },

  // Dock & Modal Styles (Sama seperti sebelumnya)
  dockContainer: { position: 'absolute', bottom: 28, left: 16, right: 16, height: 76, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  dockContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { marginRight: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4caf50', borderWidth: 2, borderColor: '#000' },
  messageContainer: { flex: 1 },
  assistantText: { color: '#fff', fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.8, backgroundColor: '#222', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalMessage: { color: '#ccc', textAlign: 'center', marginBottom: 20 },
  modalInput: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  switchLabel: { color: '#ccc' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButtonText: { color: '#aaa', fontSize: 15 },
  saveButton: { color: '#4caf50', fontSize: 15, fontWeight: 'bold' },
});

export default App;