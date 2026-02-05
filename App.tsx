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
  BackHandler, // Tambahan untuk handle back button
  TextInput, // Untuk input nama di setup
  Button, // Untuk tombol di setup
} from 'react-native';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Tambahan untuk simpan data local
import * as ImagePicker from 'react-native-image-picker'; // Tambahan untuk pilih foto (pastikan install library ini: npm i react-native-image-picker)

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100;

// KOMPONEN SETUP SCREEN
const SetupScreen = ({ onSetupComplete }: { onSetupComplete: (name: string, photo: string) => void }) => {
  const [userName, setUserName] = useState('');
  const [assistantPhoto, setAssistantPhoto] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
    });
    if (!result.didCancel && result.assets && result.assets[0].uri) {
      setAssistantPhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (userName && assistantPhoto) {
      onSetupComplete(userName, assistantPhoto);
    } else {
      ToastAndroid.show('Mohon isi nama dan pilih foto asisten.', ToastAndroid.SHORT);
    }
  };

  return (
    <View style={styles.setupContainer}>
      <Text style={styles.setupTitle}>Selamat Datang!</Text>
      <Text style={styles.setupSubtitle}>Masukkan nama panggilan Anda:</Text>
      <TextInput
        style={styles.input}
        value={userName}
        onChangeText={setUserName}
        placeholder="Nama panggilan (misal: Satria)"
        placeholderTextColor="#aaa"
      />
      <Text style={styles.setupSubtitle}>Pilih foto asisten:</Text>
      {assistantPhoto && <Image source={{ uri: assistantPhoto }} style={styles.previewImage} />}
      <Button title="Pilih Foto" onPress={pickImage} color="#007AFF" />
      <View style={styles.submitButton}>
        <Button title="Simpan dan Lanjut" onPress={handleSubmit} color="#4CD964" />
      </View>
    </View>
  );
};

// KOMPONEN DOCK ASISTEN
const AssistantDock = ({ userName }: { userName: string }) => {
  const [message, setMessage] = useState('');
  
  // Simulasi Notifikasi (Nanti bisa disambung ke library notifikasi kalau sudah siap)
  // Biarkan array ini kosong [] jika ingin melihat pesan sapaan waktu
  const [notifications, setNotifications] = useState<string[]>([]);
  // Contoh jika ada notif: const [notifications, setNotifications] = useState<string[]>(["WhatsApp", "Instagram"]);

  useEffect(() => {
    const updateMessage = () => {
      // 1. Cek apakah ada notifikasi?
      if (notifications.length > 0) {
        // Gabungkan nama aplikasi yang unik
        const uniqueApps = [...new Set(notifications)];
        const appNames = uniqueApps.join(", ");
        setMessage(`Hai ${userName}... ada notifikasi dari ${appNames}.`);
      }
      // 2. Jika tidak ada notif, tampilkan Sapaan Waktu
      else {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) {
          setMessage(`Selamat tidur, ${userName} 😴 Jangan begadang ya.`);
        } else if (hour >= 4 && hour < 11) {
          setMessage(`Selamat pagi, ${userName} ☀️ Semangat aktivitas!`);
        } else if (hour >= 11 && hour < 15) {
          setMessage(`Selamat siang, ${userName} 🌤️ Jangan lupa makan.`);
        } else if (hour >= 15 && hour < 18) {
          setMessage(`Selamat sore, ${userName} 🌇`);
        } else {
          setMessage(`Selamat malam, ${userName} 🌙 Istirahatlah.`);
        }
      }
    };
    updateMessage();
    // Update setiap 1 menit agar sapaan waktu berubah otomatis
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [notifications, userName]);

  return (
    <View style={styles.dockContainer}>
      {/* Grup Avatar dan Teks, Rata Tengah */}
      <View style={styles.dockContent}>
        {/* Foto Asisten */}
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: ASSISTANT_AVATAR }}
            style={styles.avatar}
            resizeMode="cover"
          />
          {/* Indikator Online Hijau kecil */}
          <View style={styles.onlineIndicator} />
        </View>
        {/* Teks Pesan */}
        <Text style={styles.assistantText}>
          {message}
        </Text>
      </View>
    </View>
  );
};

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

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSetupDone, setIsSetupDone] = useState(false);
  const [userName, setUserName] = useState('Satria'); // Default jika belum setup
  const [assistantAvatar, setAssistantAvatar] = useState("https://cdn-icons-png.flaticon.com/512/4140/4140048.png"); // Default

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const setupDone = await AsyncStorage.getItem('setupDone');
        if (setupDone === 'true') {
          const storedName = await AsyncStorage.getItem('userName');
          const storedPhoto = await AsyncStorage.getItem('assistantPhoto');
          if (storedName) setUserName(storedName);
          if (storedPhoto) setAssistantAvatar(storedPhoto);
          setIsSetupDone(true);
        } else {
          setIsSetupDone(false);
        }
      } catch (e) {
        console.error('Error checking setup:', e);
      }
    };
    checkSetup();
  }, []);

  const handleSetupComplete = async (name: string, photo: string) => {
    try {
      await AsyncStorage.setItem('setupDone', 'true');
      await AsyncStorage.setItem('userName', name);
      await AsyncStorage.setItem('assistantPhoto', photo);
      setUserName(name);
      setAssistantAvatar(photo);
      setIsSetupDone(true);
    } catch (e) {
      console.error('Error saving setup:', e);
    }
  };

  useEffect(() => {
    if (!isSetupDone) return; // Tunggu setup selesai baru load apps

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
  }, [isSetupDone]);

  // Handle Back Button untuk cegah reload/exit (bisa minimize app atau ignore)
  useEffect(() => {
    const backAction = () => {
      // Di sini bisa minimize app atau return true untuk ignore back
      // Untuk minimize: BackHandler.exitApp(); tapi jika ingin cegah exit, return true
      return true; // Cegah default behavior (exit/reload)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
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

  if (!isSetupDone) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar diubah: background hitam, light-content, dan translucent false untuk non-transparan */}
      {/* Untuk fullscreen/hide navigation bar, bisa tambah immersive mode via AndroidManifest atau library */}
      {/* Catatan: Untuk hide navigation bar sepenuhnya, tambah di AndroidManifest.xml: android:windowSoftInputMode="adjustResize" dan gunakan SystemNavigationBar dari react-native-system-navigation-bar jika perlu */}
      <StatusBar backgroundColor="#000000" barStyle="light-content" translucent={false} />
      
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
      {/* DOCK ASISTEN DITEMPEL DI SINI, dengan userName */}
      <AssistantDock userName={userName} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' }, // Ubah bg ke hitam non-transparan
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  
  // Padding Bawah dibesarkan agar icon paling bawah tidak ketutupan Dock
  list: {
    paddingTop: 50,
    paddingBottom: 120, // <--- PENTING: Space untuk Dock
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
  // --- STYLE KHUSUS DOCK ---
  dockContainer: {
    position: 'absolute', // Melayang
    bottom: 20, // Jarak dari bawah layar
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: 'rgba(20, 20, 20, 0.9)', // Hitam agak transparan (Glassmorphism)
    borderRadius: 35, // Rounded banget biar lonjong
    alignItems: 'center', // Rata tengah vertikal
    justifyContent: 'center', // Rata tengah horizontal
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', // Garis tipis biar elegan
    elevation: 10, // Bayangan
  },
  dockContent: {
    flexDirection: 'row', // Avatar dan teks sejajar
    alignItems: 'center', // Rata tengah vertikal
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10, // Jarak antara avatar dan teks
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25, // Lingkaran penuh
    backgroundColor: '#333',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CD964', // Hijau Online iOS
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  assistantText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.9,
    flexShrink: 1, // Agar teks wrap jika terlalu panjang
  },
  // --- STYLE SETUP SCREEN ---
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  setupTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  setupSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    width: '80%',
    height: 40,
    backgroundColor: '#333',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  submitButton: {
    marginTop: 20,
    width: '80%',
  },
});

export default App;