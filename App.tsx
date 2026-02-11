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

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; // 4 Kolom

// Konstanta Path
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// ==================== COMPONENT: AppIcon (Strict Icon Only) ====================
const AppIcon = memo(({ packageName }: { packageName: string }) => {
  const [iconUri, setIconUri] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchIcon = async () => {
      try {
        // Mengambil icon asli
        const result = await RNLauncherKitHelper.getAppIcon(packageName);
        if (isMounted && result) {
            // Pastikan format base64 valid
            const source = result.startsWith('data:image') ? result : `data:image/png;base64,${result}`;
            setIconUri(source);
        }
      } catch (e) { 
        // Silent error 
      }
    };
    fetchIcon();
    return () => { isMounted = false; };
  }, [packageName]);

  // JIKA ICON BELUM ADA: Tampilkan kotak kosong transparan (Bukan Huruf)
  if (!iconUri) {
    return <View style={styles.placeholderIcon} />;
  }

  // JIKA ICON ADA: Tampilkan Icon Asli
  return (
    <Image 
      source={{ uri: iconUri }} 
      style={styles.appIconImage} 
      resizeMode="contain"
    />
  );
});

// ==================== ITEM LIST ====================
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
      delayLongPress={400} // Lebih responsif
    >
      <View style={styles.iconContainer}>
        {/* Hanya memanggil komponen Icon, tanpa opsi teks */}
        <AppIcon packageName={item.packageName} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
});

// ==================== DOCK ASSISTANT ====================
const AssistantDock = memo(({ userName, showHidden, onSaveUserName, onToggleShowHidden, onChangePhoto, avatarSource }: any) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);

  useEffect(() => {
    const updateMessage = () => {
      const h = new Date().getHours();
      if (h >= 22 || h < 4) setMessage(`Zzz... Good night ${userName}. 😴`);
      else if (h >= 4 && h < 11) setMessage(`Morning ${userName}! ☀️ Ready to start?`);
      else if (h >= 11 && h < 15) setMessage(`It's lunch time ${userName}. 🍔`);
      else if (h >= 15 && h < 18) setMessage(`Good afternoon ${userName}. ☕`);
      else setMessage(`Good evening ${userName}. 🌙`);
    };
    updateMessage();
    const timer = setInterval(updateMessage, 60000);
    return () => clearInterval(timer);
  }, [userName]);

  const save = () => { onSaveUserName(tempName); setModalVisible(false); };

  return (
    <>
      <View style={styles.dockContainer}>
        <TouchableOpacity style={styles.dockContent} onLongPress={() => { setTempName(userName); setModalVisible(true); }}>
           <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatar} />
           <View style={styles.messageBox}>
             <Text style={styles.assistantText} numberOfLines={1}>{message}</Text>
           </View>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TextInput style={styles.input} value={tempName} onChangeText={setTempName} placeholder="Your Name" placeholderTextColor="#666"/>
            <View style={styles.rowBetween}>
                <Text style={{color:'#fff'}}>Show Hidden Apps</Text>
                <Switch value={showHidden} onValueChange={onToggleShowHidden}/>
            </View>
            <View style={styles.modalBtnRow}>
                <TouchableOpacity onPress={onChangePhoto}><Text style={styles.btnText}>Change Icon</Text></TouchableOpacity>
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

  // Action Modal
  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const packageListener = useRef<EmitterSubscription | null>(null);

  const refreshApps = useCallback(async () => {
    try {
      // HANYA ambil Label & Package Name (Sangat Ringan)
      const result = await InstalledApps.getApps();
      const apps = result
        .map((a: any) => ({ label: a.label || 'App', packageName: a.packageName }))
        .filter((a: any) => a.packageName)
        .sort((a: any, b: any) => a.label.localeCompare(b.label));
      setAllApps(apps);
    } catch (e) { console.error(e); }
  }, []);

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

  useEffect(() => {
    packageListener.current = DeviceEventEmitter.addListener("PACKAGE_CHANGED", () => {
       refreshApps(); 
       ToastAndroid.show("Apps Updated", ToastAndroid.SHORT);
    });
    return () => { packageListener.current?.remove(); };
  }, [refreshApps]);

  useEffect(() => {
    setFilteredApps(showHidden ? allApps : allApps.filter(app => !hiddenPackages.includes(app.packageName)));
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
    await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
  };

  const launchApp = (pkg: string) => {
     try { RNLauncherKitHelper.launchApplication(pkg); } catch { ToastAndroid.show("Error", ToastAndroid.SHORT); }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
  ), [handleLongPress]);

  // Save Settings Handlers
  const saveName = async (n: string) => { await RNFS.writeFile(CUSTOM_USER_PATH, n, 'utf8'); setUserName(n); };
  const toggleHidden = async (v: boolean) => { setShowHidden(v); await RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, v ? 'true' : 'false', 'utf8'); };
  const changePhoto = async () => {
      const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true, maxWidth: 200, maxHeight: 200 });
      if (res.assets?.[0]?.base64) {
          await RNFS.writeFile(CUSTOM_AVATAR_PATH, res.assets[0].base64, 'base64');
          setAvatarSource(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0f0" size="large"/></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      
      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={item => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        removeClippedSubviews={true} 
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        getItemLayout={(data, index) => ({length: 100, offset: 100 * index, index})}
      />

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
             </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 60, paddingBottom: 120 },
  item: { width: ITEM_WIDTH, height: 100, alignItems: 'center', marginBottom: 10 },
  
  // Icon Styles - Updated
  iconContainer: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  appIconImage: { width: 56, height: 56 },
  placeholderIcon: { width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 }, // Placeholder transparan
  
  label: { color: '#ddd', fontSize: 11, textAlign: 'center', marginTop: 5, marginHorizontal: 4, textShadowColor: '#000', textShadowRadius: 2 },

  // Dock Styles
  dockContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  dockContent: { backgroundColor: 'rgba(20,20,20,0.9)', flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  messageBox: { flex: 1 },
  assistantText: { color: '#fff', fontSize: 13 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.8, backgroundColor: '#222', padding: 20, borderRadius: 16, borderColor: '#444', borderWidth: 1 },
  modalTitle: { color: '#fff', fontSize: 18, marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  btnText: { color: '#aaa', fontSize: 15 },
  btnSave: { color: '#4caf50', fontSize: 15, fontWeight: 'bold' },
});

export default App;