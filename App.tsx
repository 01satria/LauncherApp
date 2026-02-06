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
  PermissionsAndroid,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';

import RNNotificationListener from 'react-native-notification-listener';
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

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  const getInitial = (label: string) => {
    if (!label) return "?";
    const words = label.trim().split(/\s+/);

    if (words.length > 1) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }

    return label.charAt(0).toUpperCase();
  };

  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName, item.label)} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Text style={styles.initial}>{getInitial(item.label)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName);

const AssistantDock = () => {
  const [message, setMessage] = useState("");
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState("Assistant");
  const [userName, setUserName] = useState("User");
  const [notifications, setNotifications] = useState<string[]>([]);

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

      const nameExists = await RNFS.exists(CUSTOM_NAME_PATH);
      if (nameExists) setAssistantName(await RNFS.readFile(CUSTOM_NAME_PATH, 'utf8'));

      const userExists = await RNFS.exists(CUSTOM_USER_PATH);
      if (userExists) setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));
    } catch (error) {
      setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
    }
  };

  useEffect(() => {
    loadAssistantData();
    const setupListener = async () => {
      const status = await RNNotificationListener.getPermissionStatus();
      if (status === 'authorized') {
        (RNNotificationListener as any).onNotificationReceived((notification: any) => {
          const appName = notification.app || "New Notification";
          setNotifications(prev => [...new Set([appName, ...prev].slice(0, 3))]);
          setTimeout(() => setNotifications([]), 10000);
        });
      }
    };
    setupListener();
  }, []);

  useEffect(() => {
    // Buat fungsi update sebagai variabel agar bisa dipanggil kapan saja
    const updateMessage = () => {
      // Prioritas 1: Notifikasi (Langsung tampil jika ada)
      if (notifications.length > 0) {
        const uniqueApps = [...new Set(notifications)];
        const lastApp = uniqueApps[0].toLowerCase();

        if (lastApp.includes('whatsapp')) {
          setMessage(`${userName}, someone's texting you on WhatsApp! 💌 Check it out now.`);
        } else {
          setMessage(`Hey ${userName}, you've got new updates from ${uniqueApps[0]}. ✨`);
        }
        return; // Keluar dari fungsi agar tidak menimpa pesan dengan salam waktu
      }

      // Prioritas 2: Salam berdasarkan Waktu (Jika tidak ada notifikasi)
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 4) setMessage(`Go to sleep, ${userName} 😴 I'm ${assistantName}, don't stay up late.`);
      else if (hour >= 4 && hour < 11) setMessage(`Good morning, ${userName}! ☀️ ${assistantName} is here.`);
      else if (hour >= 11 && hour < 15) setMessage(`Good afternoon, ${userName} 🌤️ Don't forget lunch!`);
      else if (hour >= 15 && hour < 18) setMessage(`Good afternoon, ${userName} 🌇 ${assistantName} is online.`);
      else setMessage(`Good night, ${userName} 🌙 Recharge with ${assistantName}.`);
    };

    // Jalankan seketika saat notifications, assistantName, atau userName berubah
    updateMessage();

    // Tetap gunakan interval untuk update waktu (misal dari pagi ke siang)
    const interval = setInterval(updateMessage, 10000); // Perkecil ke 10 detik agar lebih responsif
    return () => clearInterval(interval);
  }, [notifications, assistantName, userName]); // Dependency sangat penting di sini!

  const saveSettings = async () => {
    if (tempAssistantName.trim()) {
      await RNFS.writeFile(CUSTOM_NAME_PATH, tempAssistantName, 'utf8');
      setAssistantName(tempAssistantName);
    }
    if (tempUserName.trim()) {
      await RNFS.writeFile(CUSTOM_USER_PATH, tempUserName, 'utf8');
      setUserName(tempUserName);
    }
    setModalVisible(false);
    ToastAndroid.show("Saved!", ToastAndroid.SHORT);
  };

  const handleUpdateAssistant = () => {
    Alert.alert('Settings', 'Update profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit Names', onPress: () => { setTempAssistantName(assistantName); setTempUserName(userName); setModalVisible(true); } },
      {
        text: 'Change Photo',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true });
          if (result.assets && result.assets[0].base64) {
            await RNFS.writeFile(CUSTOM_AVATAR_PATH, result.assets[0].base64, 'base64');
            loadAssistantData();
          }
        }
      }
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
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const result = await InstalledApps.getApps();
        const lightData = result
          .map(app => ({ label: app.label || 'App', packageName: app.packageName }))
          .filter(app => app.packageName)
          .sort((a, b) => a.label.localeCompare(b.label));
        setApps(lightData);
        setLoading(false);
      } catch (e) { setLoading(false); }
    };
    fetchApps();

    const loadUserName = async () => {
      try {
        const userExists = await RNFS.exists(CUSTOM_USER_PATH);
        if (userExists) setUserName(await RNFS.readFile(CUSTOM_USER_PATH, 'utf8'));
      } catch (error) {
        // keep default
      }
    };
    loadUserName();
  }, []);

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
      } else {
        // Pesan default untuk aplikasi lain
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
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <AssistantDock />
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
});

export default App;