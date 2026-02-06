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
  Alert, // Tambahan untuk konfirmasi dialog
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker'; // Tambahan untuk image picker

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100;

// URL Default Foto Asisten
const DEFAULT_ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

// Path custom untuk simpan avatar
// Ganti ini
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

  // Simulasi Notifikasi
  const [notifications, setNotifications] = useState<string[]>([]);

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
          setMessage("Go to sleep, Satria 😴 Don't stay up too late, okay?");
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

  // Function untuk load avatar (dipanggil setelah permission atau setelah update)
  const loadAvatar = async () => {
    try {
      const exists = await RNFS.exists(CUSTOM_AVATAR_PATH);
      console.log('Load avatar - File exists:', exists);
      if (exists) {
        const fileData = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
        const base64Uri = `data:image/jpeg;base64,${fileData}`;
        setAvatarSource(base64Uri);
        console.log('Avatar loaded from custom path');
      } else {
        setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
        console.log('Using default avatar');
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
      setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
    }
  };

  // Effect untuk request permissions dan load avatar awal
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Request READ_MEDIA_IMAGES untuk gallery dan read file
        let readPermission = PermissionsAndroid.RESULTS.GRANTED;
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          readPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        } else if (Platform.OS === 'android') {
          readPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }

        // Request WRITE_EXTERNAL_STORAGE jika < Android 13
        let writePermission = PermissionsAndroid.RESULTS.GRANTED;
        if (Platform.OS === 'android' && Platform.Version < 33) {
          writePermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }

        console.log('Read permission:', readPermission);
        console.log('Write permission:', writePermission);

        if (readPermission === PermissionsAndroid.RESULTS.GRANTED && writePermission === PermissionsAndroid.RESULTS.GRANTED) {
          // Buat folder awal jika belum ada
          const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
          if (!dirExists) {
            await RNFS.mkdir(CUSTOM_AVATAR_DIR);
            console.log('Created directory:', CUSTOM_AVATAR_DIR);
          }
          await loadAvatar();
        } else {
          setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
          ToastAndroid.show('Izin storage ditolak, menggunakan avatar default.', ToastAndroid.SHORT);
        }
      } catch (err) {
        console.error('Error requesting permissions:', err);
        setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
      }
    };

    requestPermissions();
  }, []);

  // Handler untuk ganti avatar (long press)
  const handleChangeAvatar = () => {
    Alert.alert(
      'Ganti Foto Asisten',
      'Pilih foto baru?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya',
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibrary({
                mediaType: 'photo',
                includeBase64: true, // AKTIFKAN INI
                maxHeight: 200,
                maxWidth: 200,
              });

              if (result.didCancel || !result.assets) return;

              const asset = result.assets[0];

              // Pastikan folder tujuan ada
              const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
              if (!dirExists) {
                await RNFS.mkdir(CUSTOM_AVATAR_DIR);
              }

              // Gunakan base64 untuk menulis file baru jika copyFile gagal
              if (asset.base64) {
                await RNFS.writeFile(CUSTOM_AVATAR_PATH, asset.base64, 'base64');
              } else if (asset.uri) {
                // Fallback jika base64 tidak ada
                await RNFS.copyFile(asset.uri, CUSTOM_AVATAR_PATH);
              } else {
                throw new Error('No valid image source available');
              }

              ToastAndroid.show('Foto berhasil diubah!', ToastAndroid.SHORT);
              await loadAvatar();

            } catch (error) {
              console.error(error);
              const errorMessage = error instanceof Error ? error.message : String(error);
              ToastAndroid.show('Gagal menyimpan foto: ' + errorMessage, ToastAndroid.LONG);
            }
          },
        },
      ]
    );
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
      {/* Grup Konten agar bisa rata tengah */}
      <View style={styles.dockContent}>

        {/* Bagian Kiri: Foto Asisten */}
        <TouchableOpacity
          style={styles.avatarContainer}
          delayLongPress={5000}
          onLongPress={handleChangeAvatar}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: avatarSource }}
            style={styles.avatar}
            resizeMode="cover"
            onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
          />
          <View style={styles.onlineIndicator} />
        </TouchableOpacity>

        {/* Bagian Kanan: Teks Pesan */}
        <View style={styles.messageContainer}>
          <Text style={styles.assistantText} numberOfLines={2}>
            {message}
          </Text>
        </View>

      </View>
    </View>
  );
  );
};

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initLoad = setTimeout(async () => {
      try {
        const result = await InstalledApps.getApps();
        const lightData = result
          .map(app => ({
            label: app.label || 'App',
            packageName: app.packageName,
          }))
          .filter(app => app.packageName)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (isMounted) {
          setApps(lightData);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) setLoading(false);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(initLoad);
    };
  }, []);

  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      if (label.toLowerCase().includes('brave')) {
        ToastAndroid.show("Browsing time? Don't get lost in your tabs, okay? 🌐😘", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show(`Opening ${label} for you 😉`, ToastAndroid.SHORT);
      }

      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      ToastAndroid.show("Failed to launch app", ToastAndroid.SHORT);
    }
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * Math.floor(index / 4),
    index,
  }), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true} />

      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} />}
        contentContainerStyle={styles.list}
        getItemLayout={getItemLayout}
        initialNumToRender={24}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        showsVerticalScrollIndicator={false}
      />

      {/* DOCK ASISTEN DITEMPEL DI SINI */}
      <AssistantDock />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },

  list: {
    paddingTop: 50,
    paddingBottom: 120,
  },

  item: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },

  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#000000',
    elevation: 2,
  },
  initial: { color: 'white', fontSize: 24, fontWeight: '700' },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', paddingHorizontal: 2 },

  dockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    borderRadius: 35,
    flexDirection: 'row', // Tetap row
    alignItems: 'center',
    justifyContent: 'center', // INI PENTING: Membuat grup di dalamnya rata tengah secara horizontal
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
  },
  dockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    // Kita tidak pakai flex: 1 di sini supaya lebarnya mengikuti isi (wrap content)
    maxWidth: '100%',
  },
  avatarContainer: {
    position: 'relative',
    // Margin kanan agar tidak terlalu nempel dengan teks
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  messageContainer: {
    // Hapus marginLeft: 15 yang lama karena sudah ada marginRight di avatar
    justifyContent: 'center',
    maxWidth: width * 0.6, // Batasi lebar teks agar tidak menabrak pinggiran dock
  },
  assistantText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.9,
  },
  onlineIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00ff00',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: 'rgba(20, 20, 20, 0.9)',
  },
});

export default App;