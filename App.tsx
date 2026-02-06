import React, { useEffect, useState, memo, useCallback } from 'react';
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
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100;

const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";
const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
const CUSTOM_NAME_PATH = `${CUSTOM_AVATAR_DIR}/name.txt`;
const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;

const MemoizedItem = memo(({ item, onPress, onLongPress }: { item: AppData; onPress: (pkg: string, label: string) => void; onLongPress: (pkg: string, label: string) => void }) => {
  const getInitial = (label: string) => {
    if (!label) return "?";
    const words = label.trim().split(/\s+/);

    if (words.length > 1) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }

    return label.charAt(0).toUpperCase();
  };

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName, item.label)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      activeOpacity={0.7}
      delayLongPress={2000}
    >
      <View style={[styles.iconBox, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Text style={styles.initial}>{getInitial(item.label)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName);

const AssistantDock = ({
  userName,
  assistantName,
  showHidden,
  onSaveNames,
  onToggleShowHidden,
  onChangePhoto
}: {
  userName: string;
  assistantName: string;
  showHidden: boolean;
  onSaveNames: (newAssistantName: string, newUserName: string) => void;
  onToggleShowHidden: (value: boolean) => void;
  onChangePhoto: () => void;
}) => {
  const [message, setMessage] = useState("");
  const [avatarSource, setAvatarSource] = useState<string | null>(null);

  const [isModalVisible, setModalVisible] = useState(false);
  const [tempAssistantName, setTempAssistantName] = useState("");
  const [tempUserName, setTempUserName] = useState("");

  const loadAssistantData = async () => {
    try {
      const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
      if (!dirExists) await RNFS.mkdir(CUSTOM_AVATAR_DIR);

      const photoExists = await RNFS.exists(CUSTOM_AVATAR_PATH);
      if (photoExists) {
        const fileData = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
        setAvatarSource(`data:image/jpeg;base64,${fileData}`);
      } else {
        setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
      }
    } catch (error) {
      setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
    }
  };

  useEffect(() => {
    loadAssistantData();
  }, []);

  useEffect(() => {
    const updateMessage = () => {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 4) {
        setMessage(`Hey ${userName}, it's getting late... 😴 Don't stay up too much, get some good rest so you're fresh tomorrow. ${assistantName} cares about you, sleep tight!`);
      }
      else if (hour >= 4 && hour < 11) {
        setMessage(`Good morning, ${userName}! ☀️ Hope your day is full of happiness. ${assistantName} is ready to accompany you all day!`);
      }
      else if (hour >= 11 && hour < 15) {
        setMessage(`Afternoon ${userName}! 🌤️ Don't forget to have lunch, keep your energy up. You're important to ${assistantName} ❤️`);
      }
      else if (hour >= 15 && hour < 18) {
        setMessage(`Afternoon ${userName}! 🌇 Hope your day has been smooth so far. If you're tired, take a short break. ${assistantName} is always here for you.`);
      }
      else {
        setMessage(`Evening ${userName}! 🌙 You've been great today. Relax, recharge, and get a good night's sleep. ${assistantName} is proud of you!`);
      }
    };
    updateMessage();
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [assistantName, userName]);

  const saveSettings = () => {
    onSaveNames(tempAssistantName, tempUserName);
    setModalVisible(false);
    ToastAndroid.show("Saved!", ToastAndroid.SHORT);
  };

  const handleUpdateAssistant = () => {
    Alert.alert('Settings', 'Update profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit Names', onPress: () => { setTempAssistantName(assistantName); setTempUserName(userName); setModalVisible(true); } },
      { text: 'Change Photo', onPress: onChangePhoto },
    ]);
  };

  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockContent}>
        <TouchableOpacity delayLongPress={5000} onLongPress={handleUpdateAssistant} activeOpacity={0.8}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatar} />
            <View style={styles.onlineIndicator} />
          </View>
        </TouchableOpacity>
        <View style={styles.messageContainer}>
          <Text style={styles.assistantText}>{message}</Text>
        </View>
      </View>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Text style={styles.inputLabel}>Assistant Name:</Text>
            <TextInput style={styles.modalInput} value={tempAssistantName} onChangeText={setTempAssistantName} placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>Your Name:</Text>
            <TextInput style={styles.modalInput} value={tempUserName} onChangeText={setTempUserName} placeholderTextColor="#666" />
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Show Hidden Apps</Text>
              <Switch value={showHidden} onValueChange={onToggleShowHidden} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginRight: 20 }}><Text style={{ color: '#aaa' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveSettings}><Text style={{ color: '#00ff00', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const App = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [assistantName, setAssistantName] = useState("Assistant");
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  const loadData = async () => {
    try {
      const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
      if (!dirExists) await RNFS.mkdir(CUSTOM_AVATAR_DIR);

      const userExists = await RNFS.exists(CUSTOM_USER_PATH);
      if (userExists) setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));

      const nameExists = await RNFS.exists(CUSTOM_NAME_PATH);
      if (nameExists) setAssistantName(await RNFS.readFile(CUSTOM_NAME_PATH, 'utf8'));

      const hiddenExists = await RNFS.exists(CUSTOM_HIDDEN_PATH);
      if (hiddenExists) {
        const hiddenData = await RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8');
        setHiddenPackages(JSON.parse(hiddenData));
      }

      const showHiddenExists = await RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH);
      if (showHiddenExists) {
        const showHiddenData = await RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8');
        setShowHidden(showHiddenData === 'true');
      }
    } catch (error) {
      // keep defaults
    }
  };

  const fetchApps = async () => {
    try {
      const result = await InstalledApps.getApps();
      const lightData = result
        .map(app => ({ label: app.label || 'App', packageName: app.packageName }))
        .filter(app => app.packageName)
        .sort((a, b) => a.label.localeCompare(b.label));
      setAllApps(lightData);
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  useEffect(() => {
    loadData();
    fetchApps();
  }, []);

  useEffect(() => {
    const updatedFiltered = allApps.filter(app => showHidden || !hiddenPackages.includes(app.packageName));
    setFilteredApps(updatedFiltered);
  }, [allApps, hiddenPackages, showHidden]);

  const saveNames = async (newAssistantName: string, newUserName: string) => {
    if (newAssistantName.trim()) {
      await RNFS.writeFile(CUSTOM_NAME_PATH, newAssistantName, 'utf8');
      setAssistantName(newAssistantName);
    }
    if (newUserName.trim()) {
      await RNFS.writeFile(CUSTOM_USER_PATH, newUserName, 'utf8');
      setUserName(newUserName);
    }
  };

  const toggleShowHidden = async (value: boolean) => {
    setShowHidden(value);
    await RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, value ? 'true' : 'false', 'utf8');
  };

  const changePhoto = async () => {
    const result = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true });
    if (result.assets && result.assets[0].base64) {
      await RNFS.writeFile(CUSTOM_AVATAR_PATH, result.assets[0].base64, 'base64');
      // Note: To refresh avatar, you may need to add a state or reload in AssistantDock, but since it's in dock, assume reload on app restart or add prop.
    }
  };

  const handleLongPress = (packageName: string, label: string) => {
    Alert.alert('Hide App', `Do you want to hide ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        onPress: async () => {
          const newHidden = [...hiddenPackages, packageName];
          setHiddenPackages(newHidden);
          await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(newHidden), 'utf8');
          ToastAndroid.show(`${label} hidden`, ToastAndroid.SHORT);
        }
      }
    ]);
  };

  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      const appName = label.toLowerCase();

      // Logika Toast Pesan Khusus
      if (appName.includes('brave')) {
        ToastAndroid.show(`Browsing time? Don't get lost in your tabs, ${userName}! 🌐😘`, ToastAndroid.LONG);
      } else if (appName.includes('whatsapp') || appName.includes('telegram') || appName.includes('telegram x') || appName.includes('messenger') || appName.includes('wa business')) {
        ToastAndroid.show(`Checking messages, ${userName}? Say hi for me! 💌`, ToastAndroid.SHORT);
      } else if (appName.includes('youtube')) {
        ToastAndroid.show(`Enjoy your videos, ${userName}! 🍿`, ToastAndroid.SHORT);
      } else if (appName.includes('instagram lite')) {
        ToastAndroid.show(`Scrolling through feeds, ${userName}? Stay fabulous! 📸✨`, ToastAndroid.SHORT);
      } else if (appName.includes('camera')) {
        ToastAndroid.show(`Smile for the camera, ${userName}! 📷😄`, ToastAndroid.SHORT);
      } else if (appName.includes('gallery')) {
        ToastAndroid.show(`Revisiting memories, ${userName}? 📂❤️`, ToastAndroid.SHORT);
      } else if (appName.includes('waze')) {
        ToastAndroid.show(`Navigating with Waze, ${userName}? Safe travels! 🗺️🚗`, ToastAndroid.SHORT);
      } else if (appName.includes('maps')) {
        ToastAndroid.show(`Exploring with Maps, ${userName}? Adventure awaits! 🌍🧭`, ToastAndroid.SHORT);
      } else if (appName.includes('shopee lite')) {
        ToastAndroid.show(`Shopping spree on Shopee, ${userName}? Happy hunting! 🛒💸`, ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(`Opening ${label} for you 😉`, ToastAndroid.SHORT);
      }

      // Jalankan Aplikasinya
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      ToastAndroid.show("Failed to launch app", ToastAndroid.SHORT);
    }
  }, [userName]); // Tambahkan userName sebagai dependency agar namanya terupdate

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <FlatList
        data={filteredApps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} onLongPress={handleLongPress} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <AssistantDock
        userName={userName}
        assistantName={assistantName}
        showHidden={showHidden}
        onSaveNames={saveNames}
        onToggleShowHidden={toggleShowHidden}
        onChangePhoto={changePhoto}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' }, // Wallpaper Terlihat
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingTop: 60, paddingBottom: 120 },
  item: { width: ITEM_WIDTH, height: ITEM_HEIGHT, alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  initial: { color: 'white', fontSize: 20, fontWeight: '700' },
  label: { color: '#fff', fontSize: 11, textAlign: 'center', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },

  dockContainer: {
    position: 'absolute', bottom: 30, left: 20, right: 20, height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)'
  },
  dockContent: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  avatarContainer: { position: 'relative', marginRight: 20 }, // Jarak Antara Avatar & Teks
  avatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#333' },
  messageContainer: { flex: 1, justifyContent: 'center' },
  assistantText: { color: '#ffffff', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  onlineIndicator: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#00ff00', bottom: 2, right: 2, borderWidth: 2, borderColor: '#000' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.85, backgroundColor: '#1a1a1a', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 8, marginLeft: 5 },
  modalInput: { backgroundColor: '#262626', color: '#fff', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  switchLabel: { color: '#fff', fontSize: 14 },
});

export default App;