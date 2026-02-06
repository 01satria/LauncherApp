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
  Modal,
  TextInput,
  PermissionsAndroid,
  Platform,
  Alert,
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

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: '#000000' }]}>
        <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName);

const AssistantDock = () => {
  const [message, setMessage] = useState("");
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState("Assistant");
  const [notifications, setNotifications] = useState<string[]>([]);

  // State untuk Modal Nama
  const [isModalVisible, setModalVisible] = useState(false);
  const [tempName, setTempName] = useState("");

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
      if (nameExists) {
        const savedName = await RNFS.readFile(CUSTOM_NAME_PATH, 'utf8');
        setAssistantName(savedName);
      }
    } catch (error) {
      setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
    }
  };

  useEffect(() => {
    loadAssistantData();
    const setupListener = async () => {
      const status = await RNNotificationListener.getPermissionStatus();
      if (status !== 'authorized') return;
      (RNNotificationListener as any).onNotificationReceived((notification: any) => {
        const appName = notification.app || "New Notification";
        if (appName) {
          setNotifications(prev => {
            const newList = [appName, ...prev].slice(0, 3);
            return [...new Set(newList)];
          });
          setTimeout(() => setNotifications([]), 10000);
        }
      });
    };
    setupListener();
  }, []);

  useEffect(() => {
    const updateMessage = () => {
      if (notifications.length > 0) {
        const uniqueApps = [...new Set(notifications)];
        setMessage(`Satria, I'm ${assistantName}. Someone's texting you on ${uniqueApps[0]}! 💌`);
      } else {
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 4) setMessage(`Go to sleep, Satria 😴 I'm ${assistantName}, don't stay up late.`);
        else if (hour >= 4 && hour < 11) setMessage(`Good morning, Satria! ☀️ ${assistantName} is here.`);
        else setMessage(`Hello Satria, ${assistantName} is online! ✨`);
      }
    };
    updateMessage();
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [notifications, assistantName]);

  const saveName = async () => {
    if (tempName.trim().length > 0) {
      await RNFS.writeFile(CUSTOM_NAME_PATH, tempName, 'utf8');
      setAssistantName(tempName);
      setModalVisible(false);
      ToastAndroid.show(`Name updated to ${tempName}`, ToastAndroid.SHORT);
    }
  };

  const handleUpdateAssistant = () => {
    Alert.alert('Update Assistant', 'What to change?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change Name', onPress: () => { setTempName(assistantName); setModalVisible(true); } },
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
        <TouchableOpacity delayLongPress={5000} onLongPress={handleUpdateAssistant}>
          <Image source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} style={styles.avatar} />
          <View style={styles.onlineIndicator} />
        </TouchableOpacity>
        <View style={styles.messageContainer}>
          <Text style={styles.assistantText}>{message}</Text>
        </View>
      </View>

      {/* MODAL INPUT NAMA */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assistant Name</Text>
            <TextInput
              style={styles.modalInput}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter name..."
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginRight: 20 }}>
                <Text style={{ color: '#aaa' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveName}>
                <Text style={{ color: '#00ff00', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
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

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const result = await InstalledApps.getApps();
        const lightData = result
          .map(app => ({
            label: app.label || 'App',
            packageName: app.packageName,
          }))
          .filter(app => app.packageName)
          .sort((a, b) => a.label.localeCompare(b.label));
        setApps(lightData);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      if (label.toLowerCase().includes('brave')) {
        ToastAndroid.show("Browsing time? Focus, Satria! 🌐😘", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(`Opening ${label}...`, ToastAndroid.SHORT);
      }
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      ToastAndroid.show("Failed to launch", ToastAndroid.SHORT);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

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
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { paddingTop: 50, paddingBottom: 120 },
  item: { width: ITEM_WIDTH, height: ITEM_HEIGHT, alignItems: 'center', marginBottom: 10 },
  iconBox: {
    width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    marginBottom: 6, borderWidth: 1, borderColor: '#333', backgroundColor: '#000', elevation: 2,
  },
  initial: { color: 'white', fontSize: 24, fontWeight: '700' },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', paddingHorizontal: 2 },
  dockContainer: {
    position: 'absolute', bottom: 20, left: 20, right: 20, height: 70,
    backgroundColor: 'rgba(20, 20, 20, 0.9)', borderRadius: 35,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', elevation: 10,
  },
  dockContent: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  messageContainer: { justifyContent: 'center', maxWidth: width * 0.6 },
  assistantText: { color: '#ffffff', fontSize: 13, fontWeight: '500', lineHeight: 18, opacity: 0.9 },
  onlineIndicator: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#00ff00', bottom: 0, right: 0, borderWidth: 2, borderColor: '#141414',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.8,
    backgroundColor: '#222',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInput: {
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
  },
});

export default App;