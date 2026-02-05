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
const CUSTOM_AVATAR_DIR = `${RNFS.ExternalStorageDirectoryPath}/Android/media/satrialauncher`;
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
                includeBase64: false,
                maxHeight: 200,
                maxWidth: 200,
              });

              if (result.didCancel) {
                console.log('User cancelled image picker');
                return;
              }
              if (result.errorCode) {
                console.error('ImagePicker Error: ', result.errorMessage);
                ToastAndroid.show('Gagal memilih foto.', ToastAndroid.SHORT);
                return;
              }
              if (!result.assets || result.assets.length === 0) {
                console.log('No image selected');
                return;
              }

              const selectedUri = result.assets[0].uri;
              if (!selectedUri) {
                console.log('No URI for selected image');
                return;
              }

              console.log('Selected image URI:', selectedUri);

              // Buat folder jika belum ada (mkdir aman jika sudah ada)
              const dirExists = await RNFS.exists(CUSTOM_AVATAR_DIR);
              if (!dirExists) {
                await RNFS.mkdir(CUSTOM_AVATAR_DIR);
                console.log('Created directory:', CUSTOM_AVATAR_DIR);
              }

              // Periksa apakah file sudah ada, jika ya hapus untuk replace
              const fileExists = await RNFS.exists(CUSTOM_AVATAR_PATH);
              if (fileExists) {
                await RNFS.unlink(CUSTOM_AVATAR_PATH);
                console.log('Existing file deleted');
              }

              // Copy file baru
              await RNFS.copyFile(selectedUri, CUSTOM_AVATAR_PATH);
              console.log('File copied to:', CUSTOM_AVATAR_PATH);

              // Verifikasi setelah copy
              const copiedExists = await RNFS.exists(CUSTOM_AVATAR_PATH);
              if (copiedExists) {
                ToastAndroid.show('Foto asisten berhasil diubah!', ToastAndroid.SHORT);
                await loadAvatar();
              } else {
                throw new Error('Failed to verify copied file');
              }
            } catch (error) {
              console.error('Error changing avatar:', error);
              ToastAndroid.show('Gagal mengubah foto. Cek console untuk detail.' + error, ToastAndroid.SHORT);
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