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

// KOMPONEN DOCK ASISTEN
const AssistantDock = () => {
  const [message, setMessage] = useState("");
  const [avatarSource, setAvatarSource] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

  // 1. Setup Notification Listener
  useEffect(() => {
    let notificationSubscription: any;

    const startListening = async () => {
      const status = await RNNotificationListener.getPermissionStatus();
      if (status !== 'authorized') return;

      notificationSubscription = (RNNotificationListener as any).onNotificationReceived((notification: any) => {
        const appName = notification.app || notification.name || "New Notification";
        if (appName) {
          setNotifications(prev => {
            const newList = [appName, ...prev].slice(0, 3);
            return [...new Set(newList)];
          });
          // Notifikasi hilang otomatis setelah 10 detik
          setTimeout(() => setNotifications([]), 10000);
        }
      });
    };

    startListening();
    return () => {
      if (notificationSubscription) notificationSubscription.remove();
    };
  }, []);

  // 2. Logic Update Pesan (Salam & Notifikasi)
  useEffect(() => {
    const updateMessage = () => {
      if (notifications.length > 0) {
        const uniqueApps = [...new Set(notifications)];
        if (uniqueApps.some(app => app.toLowerCase().includes('whatsapp'))) {
          setMessage("Satria, someone's texting you on WhatsApp! 💌 Check it out now.");
        } else {
          const appNames = uniqueApps.join(", ");
          setMessage(`Hey Satria, you've got new updates from ${appNames}. ✨`);
        }
      } else {
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 4) {
          setMessage("It's late, Satria 😴 Go to sleep and don't stay up, okay?");
        } else if (hour >= 4 && hour < 11) {
          setMessage("Good morning, Satria ☀️ Have a wonderful day ahead!");
        } else if (hour >= 11 && hour < 15) {
          setMessage("Good afternoon, Satria 🌤️ Don't forget to eat your lunch!");
        } else if (hour >= 15 && hour < 18) {
          setMessage("Good afternoon, Satria 🌇 Hope you're having a good one.");
        } else {
          setMessage("Good night, Satria 🌙 Time to rest and recharge.");
        }
      }
    };

    updateMessage();
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [notifications]);

  const loadAvatar = async () => {
    try {
      const exists = await RNFS.exists(CUSTOM_AVATAR_PATH);
      if (exists) {
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
    const initStorage = async () => {
      const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
      if (!dirExists) await RNFS.mkdir(CUSTOM_AVATAR_DIR);
      await loadAvatar();
    };
    initStorage();
  }, []);

  const handleChangeAvatar = () => {
    Alert.alert('Change Assistant', 'Pick a new photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibrary({
              mediaType: 'photo',
              includeBase64: true,
              maxHeight: 200,
              maxWidth: 200,
            });

            if (result.didCancel || !result.assets) return;
            const asset = result.assets[0];

            if (asset.base64) {
              await RNFS.writeFile(CUSTOM_AVATAR_PATH, asset.base64, 'base64');
              ToastAndroid.show('Avatar updated!', ToastAndroid.SHORT);
              await loadAvatar();
            }
          } catch (error) {
            ToastAndroid.show('Update failed', ToastAndroid.SHORT);
          }
        },
      },
    ]);
  };

  if (!avatarSource) {
    return (
      <View style={styles.dockContainer}>
        <ActivityIndicator size="small" color="#ffffff" />
      </View>
    );
  }

  return (
    <View style={styles.dockContainer}>
      <View style={styles.dockContent}>
        <TouchableOpacity
          style={styles.avatarContainer}
          delayLongPress={5000}
          onLongPress={handleChangeAvatar}
          activeOpacity={0.7}
        >
          <Image source={{ uri: avatarSource }} style={styles.avatar} resizeMode="cover" />
          <View style={styles.onlineIndicator} />
        </TouchableOpacity>

        <View style={styles.messageContainer}>
          <Text style={styles.assistantText} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
};

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getApps = async () => {
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
    getApps();
  }, []);

  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      const name = label.toLowerCase();
      if (name.includes('brave')) {
        ToastAndroid.show("Browsing time? Don't get lost in your tabs! 🌐😘", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(`Opening ${label}...`, ToastAndroid.SHORT);
      }
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      ToastAndroid.show("Error launching app", ToastAndroid.SHORT);
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
    marginBottom: 6, borderWidth: 1, borderColor: '#333', elevation: 2,
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
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222' },
  messageContainer: { justifyContent: 'center', maxWidth: width * 0.6 },
  assistantText: { color: '#ffffff', fontSize: 13, fontWeight: '500', opacity: 0.9 },
  onlineIndicator: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#00ff00', bottom: 0, right: 0, borderWidth: 2, borderColor: '#141414',
  },
});

export default App;