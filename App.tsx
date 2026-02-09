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
const ITEM_WIDTH = width / 4;

const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;

// ==================== Memoized Item ====================
const MemoizedItem = memo(({ item, onPress, onLongPress }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}) => {
  const getInitial = (label: string) =>
    label ? label.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || "?" : "?";

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={800}
    >
      <View style={styles.iconBox}>
        <Text style={styles.initial}>{getInitial(item.label)}</Text>
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
        setMessage(`It's late, ${userName}. 😴 Go to sleep now so you're fresh tomorrow. I'll be here when you wake up!`);
      }
      else if (hour >= 4 && hour < 11) {
        setMessage(`Morning, ${userName}! ☀️ Hope you have a great day. I'm ready to accompany you!`);
      }
      else if (hour >= 11 && hour < 15) {
        setMessage(`Lunch time, ${userName}! 🌤️ Eat something good and keep your energy up. You matter to me! ❤️`);
      }
      else if (hour >= 15 && hour < 18) {
        setMessage(`Hey ${userName}, take a break if you're tired. 🌇 I'm always here for you.`);
      }
      else if (hour >= 18 && hour < 20) {
        setMessage(`Evening, ${userName}! 🌇 I'm here to support you. Take care of yourself.`);
      }
      else {
        setMessage(`Good night, ${userName}! 🌙 You did great today. I'm proud of you, now go rest.`);
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
        <TouchableOpacity onLongPress={openModal} activeOpacity={0.8} delayLongPress={800}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatar} />
            <View style={styles.onlineIndicator} />
          </View>
        </TouchableOpacity>
        <View style={styles.messageContainer}>
          <Text style={styles.assistantText}>{message}</Text>
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
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
              <Switch value={showHidden} onValueChange={onToggleShowHidden} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={onChangePhoto} style={{ marginRight: 50 }}>
                <Text style={styles.modalButtonText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginRight: 25 }}>
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

  // Refresh aplikasi (dipakai saat install/uninstall)
  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getApps();
      const apps = result
        .map((a: any) => ({ label: a.label || 'App', packageName: a.packageName }))
        .filter((a: any) => a.packageName)
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      setAllApps(apps);
    } catch (e) { }
  }, []);

  // Inisialisasi data (sekali saja)
  useEffect(() => {
    const init = async () => {
      try {
        await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => { });

        if (await RNFS.exists(CUSTOM_USER_PATH))
          setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));

        if (await RNFS.exists(CUSTOM_HIDDEN_PATH)) {
          const data = await RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8');
          setHiddenPackages(JSON.parse(data));
        }

        if (await RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH))
          setShowHidden((await RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8')) === 'true');

        if (await RNFS.exists(CUSTOM_AVATAR_PATH)) {
          const b64 = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
          setAvatarSource(`data:image/jpeg;base64,${b64}`);
        }
      } catch (_) { }
      setLoading(false);
    };
    init();
    refreshApps(); // load apps pertama kali
  }, [refreshApps]);

  // Listener Install / Uninstall (Hanya ini yang aktif)
  useEffect(() => {
    packageListener.current = DeviceEventEmitter.addListener("PACKAGE_CHANGED", () => {
      refreshApps();
      ToastAndroid.show("App list updated", ToastAndroid.SHORT);
    });

    return () => {
      packageListener.current?.remove();
    };
  }, [refreshApps]);

  // Filter apps
  useEffect(() => {
    setFilteredApps(allApps.filter(app => showHidden || !hiddenPackages.includes(app.packageName)));
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
    const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true });
    if (res.assets?.[0]?.base64) {
      await RNFS.writeFile(CUSTOM_AVATAR_PATH, res.assets[0].base64, 'base64');
      const b64 = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
      setAvatarSource(`data:image/jpeg;base64,${b64}`);
    }
  }, []);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    const isHidden = hiddenPackages.includes(pkg) && showHidden;
    setActionType(isHidden ? 'unhide' : 'hide');
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, [hiddenPackages, showHidden]);

  const doAction = useCallback(async () => {
    let newList = [...hiddenPackages];
    if (actionType === 'unhide') {
      newList = newList.filter(p => p !== selectedPkg);
    } else {
      newList.push(selectedPkg);
    }
    setHiddenPackages(newList);
    await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newList), 'utf8');
    setActionModal(false);
  }, [actionType, selectedPkg, hiddenPackages]);

  const launchApp = useCallback((packageName: string) => {
    try {
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (e) {
      ToastAndroid.show("Can't open app", ToastAndroid.SHORT);
    }
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={item => item.packageName}
        renderItem={({ item }) => (
          <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
      />

      <AssistantDock
        userName={userName}
        showHidden={showHidden}
        onSaveUserName={saveUserName}
        onToggleShowHidden={toggleShowHidden}
        onChangePhoto={changePhoto}
        avatarSource={avatarSource}
      />

      {/* Modal Hide / Unhide */}
      <Modal visible={actionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{actionType === 'unhide' ? 'Unhide' : 'Hide'} App</Text>
            <Text style={styles.modalMessage}>Do you want to {actionType} {selectedLabel}?</Text>
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
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 60, paddingBottom: 130 },
  item: { width: ITEM_WIDTH, height: 100, alignItems: 'center', marginBottom: 12 },
  iconBox: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  initial: { color: '#fff', fontSize: 21, fontWeight: '700' },
  label: { color: '#eee', fontSize: 10.5, textAlign: 'center', marginTop: 4 },

  dockContainer: { position: 'absolute', bottom: 28, left: 16, right: 16, height: 76, backgroundColor: 'rgba(0,0,0,0.94)', borderRadius: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  dockContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#0f0', borderWidth: 2, borderColor: '#000' },
  messageContainer: { flex: 1 },
  assistantText: { color: '#fff', fontSize: 13, lineHeight: 17 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.88, backgroundColor: '#1c1c1c', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 19, fontWeight: 'bold', textAlign: 'center', marginBottom: 18 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  modalInput: { backgroundColor: '#282828', color: '#fff', borderRadius: 12, padding: 12, marginBottom: 18 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  switchLabel: { color: '#ddd', fontSize: 14.5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  modalButtonText: { color: '#999', fontSize: 15 },
  saveButton: { color: '#0f0', fontWeight: 'bold', fontSize: 15 },
  modalMessage: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 10 },

});

export default App;