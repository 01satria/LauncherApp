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
const CUSTOM_AVATAR_PATH = `${RNFS.ExternalStorageDirectoryPath}/Android/media/satrialauncher/asist.jpg`;

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
        const appNames = uniqueApps.join(", ");
        setMessage(`Hai Satria... ada notifikasi dari ${appNames}.`);
      } else {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) {
          setMessage("Selamat tidur, Satria 😴 Jangan begadang ya.");
        } else if (hour >= 4 && hour < 11) {
          setMessage("Selamat pagi, Satria ☀️ Semangat aktivitas!");
        } else if (hour >= 11 && hour < 15) {
          setMessage("Selamat siang, Satria 🌤️ Jangan lupa makan.");
        } else if (hour >= 15 && hour < 18) {
          setMessage("Selamat sore, Satria 🌇");
        } else {
          setMessage("Selamat malam, Satria 🌙 Istirahatlah.");
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
      if (exists) {
        const fileData = await RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64');
        const base64Uri = `data:image/jpeg;base64,${fileData}`;
        setAvatarSource(base64Uri);
      } else {
        setAvatarSource(DEFAULT_ASSISTANT_AVATAR);
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
        // Request READ_EXTERNAL_STORAGE / READ_MEDIA_IMAGES
        let readPermission = PermissionsAndroid.RESULTS.GRANTED;
        if (Platform.OS === 'android') {
          if (Platform.Version < 33) {
            readPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          } else {
            readPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
          }
        }

        // Request WRITE_EXTERNAL_STORAGE jika diperlukan (untuk simpan file)
        let writePermission = PermissionsAndroid.RESULTS.GRANTED;
        if (Platform.OS === 'android' && Platform.Version < 33) { // WRITE dibutuhkan untuk < Android 13
          writePermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }

        if (readPermission === PermissionsAndroid.RESULTS.GRANTED && writePermission === PermissionsAndroid.RESULTS.GRANTED) {
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
                includeBase64: false,
                maxHeight: 200,
                maxWidth: 200,
              });

              if (result.didCancel) {
                console.log('User cancelled image picker');
              } else if (result.errorCode) {
                console.error('ImagePicker Error: ', result.errorMessage);
              } else if (result.assets && result.assets.length > 0) {
                const selectedUri = result.assets[0].uri;
                if (selectedUri) {
                  // Buat folder jika belum ada
                  const dirPath = `${RNFS.ExternalStorageDirectoryPath}/Android/media/satrialauncher`;
                  await RNFS.mkdir(dirPath);

                  // Copy file ke custom path
                  await RNFS.copyFile(selectedUri, CUSTOM_AVATAR_PATH);
                  ToastAndroid.show('Foto asisten berhasil diubah!', ToastAndroid.SHORT);

                  // Reload avatar
                  await loadAvatar();
                }
              }
            } catch (error) {
              console.error('Error changing avatar:', error);
              ToastAndroid.show('Gagal mengubah foto.', ToastAndroid.SHORT);
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
      {/* Bagian Kiri: Foto Asisten dengan Long Press */}
      <TouchableOpacity
        style={styles.avatarContainer}
        delayLongPress={7000} // 7 detik (7000 ms)
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
        <Text style={styles.assistantText}>
          {message}
        </Text>
      </View>
    </View>
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
      ToastAndroid.show(`Opening ${label}...`, ToastAndroid.SHORT);
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  messageContainer: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  assistantText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.9,
  }
});

export default App;