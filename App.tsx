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

// --- Interface Update: Menambahkan 'icon' ---
interface AppData {
  label: string;
  packageName: string;
  icon: string; // Base64 string dari library
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;

const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;

// ==================== Memoized Item (Diperbaiki) ====================
const MemoizedItem = memo(({ item, onPress, onLongPress }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {
  // Fallback jika icon tidak ada (jarang terjadi)
  const getInitial = (label: string) =>
    label ? label.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || "?" : "?";

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={500} // Sedikit dipercepat agar lebih responsif
    >
      <View style={styles.iconBox}>
        {item.icon ? (
          <Image 
            source={{ uri: `data:image/png;base64,${item.icon}` }} 
            style={styles.appIcon} 
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.initial}>{getInitial(item.label)}</Text>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
});

// ==================== AssistantDock ====================
const AssistantDock = memo(({
  userName,
  showHidden,
  onSaveUserName,
  onToggleShowHidden,
  onChangePhoto,
  avatarSource,
}: {
  userName: string;
  showHidden: boolean;
  onSaveUserName: (name: string) => void;
  onToggleShowHidden: (value: boolean) => void;
  onChangePhoto: () => void;
  avatarSource: string | null;
}) => {
  const [message, setMessage] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);

  useEffect(() => {
    const updateMessage = () => {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 4) {
        setMessage(`It's late, ${userName}. 😴 Go to sleep now so you're fresh tomorrow.`);
      } else if (hour >= 4 && hour < 11) {
        setMessage(`Morning, ${userName}! ☀️ Hope you have a great day.`);
      } else if (hour >= 11 && hour < 15) {
        setMessage(`Lunch time, ${userName}! 🌤️ Keep your energy up!`);
      } else if (hour >= 15 && hour < 18) {
        setMessage(`Hey ${userName}, take a break if you're tired. 🌇`);
      } else if (hour >= 18 && hour < 20) {
        setMessage(`Evening, ${userName}! 🌇 I'm here to support you.`);
      } else {
        setMessage(`Good night, ${userName}! 🌙 You did great today.`);
      }
    };

    updateMessage();
    const id = setInterval(updateMessage, 60000);
    return () => clearInterval(id);
  }, [userName]);

  const save = useCallback(() => {
    onSaveUserName(tempName.trim());
    setModalVisible(false);
    ToastAndroid.show("Saved", ToastAndroid.SHORT);
  }, [tempName, onSaveUserName]);

  const openModal = useCallback(() => {
    setTempName(userName);
    setModalVisible(true);
  }, [userName]);

  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockContent}>
        <TouchableOpacity onLongPress={openModal} activeOpacity={0.8}>
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
            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              placeholderTextColor="#666"
            />
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Show Hidden Apps</Text>
              <Switch value={showHidden} onValueChange={onToggleShowHidden} trackColor={{false: "#767577", true: "#81b0ff"}} thumbColor={showHidden ? "#f5dd4b" : "#f4f3f4"} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={onChangePhoto} style={{ marginRight: 20 }}>
                <Text style={styles.modalButtonText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginRight: 20 }}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
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

  const [actionModal, setActionModal] = useState(false);
  const [actionType, setActionType] = useState<'hide' | 'unhide'>('hide');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const packageListener = useRef<EmitterSubscription | null>(null);

  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getApps();
      const apps = result
        .map((a: any) => ({ 
          label: a.label || 'App', 
          packageName: a.packageName,
          icon: a.icon // PENTING: Mengambil data icon
        }))
        .filter((a: any) => a.packageName)
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      setAllApps(apps);
    } catch (e) {
      console.error("Error loading apps", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => {});
        
        // Load semua data preference secara paralel agar lebih cepat
        const [userExists, hiddenExists, showHiddenExists, avatarExists] = await Promise.all([
            RNFS.exists(CUSTOM_USER_PATH),
            RNFS.exists(CUSTOM_HIDDEN_PATH),
            RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH),
            RNFS.exists(CUSTOM_AVATAR_PATH)
        ]);

        if (userExists) setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));
        
        if (hiddenExists) {
          const data = await RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8');
          setHiddenPackages(JSON.parse(data));
        }

        if (showHiddenExists) {
           const val = await RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8');
           setShowHidden(val === 'true');
        }

        if (avatarExists) {
          const b64 = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
          setAvatarSource(`data:image/jpeg;base64,${b64}`);
        }
      } catch (_) {}
      
      setLoading(false);
    };
    
    init();
    refreshApps();
  }, [refreshApps]);

  useEffect(() => {
    packageListener.current = DeviceEventEmitter.addListener("PACKAGE_CHANGED", () => {
      refreshApps();
      ToastAndroid.show("Updating app list...", ToastAndroid.SHORT);
    });

    return () => {
      packageListener.current?.remove();
    };
  }, [refreshApps]);

  useEffect(() => {
    // Filter logic
    if (showHidden) {
        setFilteredApps(allApps);
    } else {
        setFilteredApps(allApps.filter(app => !hiddenPackages.includes(app.packageName)));
    }
  }, [allApps, hiddenPackages, showHidden]);

  const saveUserName = useCallback(async (name: string) => {
    if (name) {
      await RNFS.writeFile(CUSTOM_USER_PATH, name, 'utf8');
      setUserName(name);
    }
  }, []);

  const toggleShowHidden = useCallback(async (val: boolean) => {
    setShowHidden(val);
    await RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, val ? 'true' : 'false', 'utf8');
  }, []);

  const changePhoto = useCallback(async () => {
    try {
        const res = await ImagePicker.launchImageLibrary({ 
            mediaType: 'photo', 
            includeBase64: true,
            quality: 0.5, // Kompresi agar tidak berat
            maxWidth: 200,
            maxHeight: 200
        });
        
        if (res.assets?.[0]?.base64) {
            await RNFS.writeFile(CUSTOM_AVATAR_PATH, res.assets[0].base64, 'base64');
            const b64 = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
            setAvatarSource(`data:image/jpeg;base64,${b64}`);
            ToastAndroid.show("Photo updated", ToastAndroid.SHORT);
        }
    } catch (err) {
        ToastAndroid.show("Failed to pick image", ToastAndroid.SHORT);
    }
  }, []);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    // Jika showHidden true, kita bisa melihat hidden apps, jadi aksinya bisa unhide
    // Jika showHidden false, kita tidak bisa melihat hidden apps, jadi aksinya pasti hide
    const isCurrentlyHidden = hiddenPackages.includes(pkg);
    
    if (isCurrentlyHidden) {
        setActionType('unhide');
    } else {
        setActionType('hide');
    }
    
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, [hiddenPackages]);

  const doAction = useCallback(async () => {
    let newList = [...hiddenPackages];
    if (actionType === 'unhide') {
      newList = newList.filter(p => p !== selectedPkg);
    } else {
      // Cek duplicate agar aman
      if (!newList.includes(selectedPkg)) {
          newList.push(selectedPkg);
      }
    }
    
    setHiddenPackages(newList);
    await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
    ToastAndroid.show(`App ${actionType === 'hide' ? 'Hidden' : 'Visible'}`, ToastAndroid.SHORT);
  }, [actionType, selectedPkg, hiddenPackages]);

  const launchApp = useCallback((packageName: string) => {
    try {
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (e) {
      ToastAndroid.show("Can't open app", ToastAndroid.SHORT);
    }
  }, []);

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
      <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
  ), [launchApp, handleLongPress]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#00ff00" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={item => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={16} 
        maxToRenderPerBatch={8}
        windowSize={5} // Diperkecil agar hemat RAM
        getItemLayout={(data, index) => (
            {length: 100 + 12, offset: (100 + 12) * index, index}
        )}
      />

      <AssistantDock
        userName={userName}
        showHidden={showHidden}
        onSaveUserName={saveUserName}
        onToggleShowHidden={toggleShowHidden}
        onChangePhoto={changePhoto}
        avatarSource={avatarSource}
      />

      <Modal visible={actionModal} transparent animationType="fade" onRequestClose={() => setActionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{actionType === 'unhide' ? 'Unhide' : 'Hide'} App</Text>
            <Text style={styles.modalMessage}>Do you want to {actionType} "{selectedLabel}"?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setActionModal(false)} style={{ marginRight: 25 }}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doAction}>
                <Text style={styles.saveButton}>{actionType === 'unhide' ? 'Unhide' : 'Hide'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' }, // Launcher biasanya transparan agar wallpaper terlihat
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 60, paddingBottom: 130 },
  item: { width: ITEM_WIDTH, height: 100, alignItems: 'center', marginBottom: 12 },
  
  // Update Style IconBox agar mendukung gambar
  iconBox: { 
      width: 58, 
      height: 58, 
      // borderRadius: 18, // Opsional: jika ingin kotak rounded
      justifyContent: 'center', 
      alignItems: 'center', 
  },
  appIcon: {
      width: 58,
      height: 58,
  },
  
  initial: { color: '#fff', fontSize: 24, fontWeight: 'bold' }, // Style fallback
  label: { color: '#eee', fontSize: 11, textAlign: 'center', marginTop: 6, marginHorizontal: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },

  dockContainer: { position: 'absolute', bottom: 28, left: 16, right: 16, height: 76, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dockContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4caf50', borderWidth: 2, borderColor: '#1c1c1c' },
  messageContainer: { flex: 1, justifyContent: 'center' },
  assistantText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '400' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.85, backgroundColor: '#222', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#333', elevation: 10 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  modalInput: { backgroundColor: '#333', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 20, fontSize: 16 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  switchLabel: { color: '#ddd', fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 },
  modalButtonText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  saveButton: { color: '#4caf50', fontWeight: 'bold', fontSize: 16 },
  modalMessage: { color: '#ddd', fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
});

export default App;