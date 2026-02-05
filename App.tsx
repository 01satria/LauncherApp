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
  BackHandler,
  TextInput,
  Alert,
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- DATA AVATAR PRESET (ANTI-CRASH) ---
// Kita pakai gambar online yang ringan biar tidak perlu akses galeri yang bikin crash
const AVATARS = [
  { id: '1', uri: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', name: 'Girl' },
  { id: '2', uri: 'https://cdn-icons-png.flaticon.com/512/4140/4140037.png', name: 'Boy' },
  { id: '3', uri: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png', name: 'Old' },
  { id: '4', uri: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png', name: 'Robot' },
  { id: '5', uri: 'https://cdn-icons-png.flaticon.com/512/1998/1998627.png', name: 'Cat' },
];

interface AppData { label: string; packageName: string; }
const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

// --- 1. ITEM APLIKASI ---
const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => (
  <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName, item.label)} activeOpacity={0.7}>
    <View style={styles.appIconBox}>
      <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
    </View>
    <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
  </TouchableOpacity>
), (prev, next) => prev.item.packageName === next.item.packageName);

// --- 2. LAYAR WELCOME & SETUP (YANG KAMU MINTA) ---
const SetupScreen = ({ onFinish }: { onFinish: (name: string, photo: string) => void }) => {
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].uri);

  const saveSetup = async () => {
    if (!name.trim()) {
      ToastAndroid.show("Isi nama panggilanmu dulu ya!", ToastAndroid.SHORT);
      return;
    }
    try {
      await AsyncStorage.setItem('user_name', name);
      await AsyncStorage.setItem('user_photo', selectedAvatar);
      onFinish(name, selectedAvatar);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan data.");
    }
  };

  return (
    <View style={styles.setupContainer}>
      <StatusBar hidden />
      <Text style={styles.setupTitle}>Halo!</Text>
      <Text style={styles.setupSubtitle}>Siapa nama panggilanmu?</Text>

      {/* Input Nama */}
      <TextInput 
        style={styles.input}
        placeholder="Ketik namamu..."
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.setupSubtitle}>Pilih Asistenmu:</Text>
      {/* Pilihan Avatar Horizontal */}
      <View style={styles.avatarList}>
        {AVATARS.map((av) => (
          <TouchableOpacity 
            key={av.id} 
            onPress={() => setSelectedAvatar(av.uri)}
            style={[styles.avatarOption, selectedAvatar === av.uri && styles.avatarSelected]}
          >
            <Image source={{ uri: av.uri }} style={styles.avatarImg} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveSetup}>
        <Text style={styles.saveButtonText}>SELESAI & MASUK</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- 3. DOCK ASISTEN (RATA TENGAH) ---
const AssistantDock = ({ userName, userPhoto }: { userName: string, userPhoto: string | null }) => {
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    const updateMessage = () => {
      const h = new Date().getHours();
      if (h >= 0 && h < 4) setMessage(`Selamat tidur, ${userName} 😴`);
      else if (h >= 4 && h < 11) setMessage(`Selamat pagi, ${userName} ☀️`);
      else if (h >= 11 && h < 15) setMessage(`Selamat siang, ${userName} 🌤️`);
      else if (h >= 15 && h < 18) setMessage(`Selamat sore, ${userName} 🌇`);
      else setMessage(`Selamat malam, ${userName} 🌙`);
    };
    updateMessage();
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [userName]);

  return (
    <View style={styles.dockWrapper}>
        <View style={styles.dockContainer}>
          <Image source={{ uri: userPhoto || AVATARS[0].uri }} style={styles.dockAvatar} />
          <View style={styles.messageContainer}>
              <Text style={styles.assistantText}>{message}</Text>
          </View>
        </View>
    </View>
  );
};

// --- 4. APLIKASI UTAMA ---
const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupDone, setSetupDone] = useState(false);
  const [userData, setUserData] = useState({ name: '', photo: '' });
  const [checking, setChecking] = useState(true);

  // Cek apakah user sudah pernah setup
  useEffect(() => {
    const checkUser = async () => {
      try {
        const n = await AsyncStorage.getItem('user_name');
        const p = await AsyncStorage.getItem('user_photo');
        if (n && p) {
          setUserData({ name: n, photo: p });
          setSetupDone(true);
        }
      } catch (e) {
        // Ignore error
      } finally {
        setChecking(false);
      }
    };
    checkUser();
  }, []);

  // Matikan tombol Back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, []);

  // Load Aplikasi
  useEffect(() => {
    if (!setupDone) return;
    setTimeout(async () => {
        try {
            const res = await InstalledApps.getApps();
            const data = res.map(a => ({ label: a.label || 'App', packageName: a.packageName }))
                            .filter(a => a.packageName)
                            .sort((a, b) => a.label.localeCompare(b.label));
            setApps(data);
            setLoading(false);
        } catch(e) { setLoading(false); }
    }, 500);
  }, [setupDone]);

  const launch = useCallback((pkg: string, label: string) => {
    try {
        ToastAndroid.show(`Membuka ${label}...`, ToastAndroid.SHORT);
        RNLauncherKitHelper.launchApplication(pkg);
    } catch { ToastAndroid.show("Gagal membuka", ToastAndroid.SHORT); }
  }, []);

  if (checking) return <View style={styles.center}><ActivityIndicator color="#fff"/></View>;
  
  // JIKA BELUM SETUP -> TAMPILKAN LAYAR WELCOME
  if (!setupDone) {
    return <SetupScreen onFinish={(n, p) => { setUserData({ name: n, photo: p }); setSetupDone(true); }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>
      ) : (
        <FlatList
          data={apps}
          numColumns={4}
          keyExtractor={(i) => i.packageName}
          renderItem={({ item }) => <MemoizedItem item={item} onPress={launch} />}
          contentContainerStyle={styles.list}
          initialNumToRender={24}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <AssistantDock userName={userData.name} userPhoto={userData.photo} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { paddingTop: 60, paddingBottom: 130 }, // Space buat dock
  item: { width: ITEM_WIDTH, height: ITEM_HEIGHT, alignItems: 'center', marginBottom: 10 },
  appIconBox: {
    width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    marginBottom: 6, borderWidth: 1, borderColor: '#333', backgroundColor: '#000', elevation: 2,
  },
  initial: { color: 'white', fontSize: 24, fontWeight: '700' },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', paddingHorizontal: 2 },

  // SETUP SCREEN STYLES
  setupContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  setupTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  setupSubtitle: { color: '#aaa', fontSize: 16, marginBottom: 20, marginTop: 10 },
  input: {
    width: '80%', backgroundColor: '#111', color: 'white', padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: '#333', textAlign: 'center', fontSize: 18, marginBottom: 30
  },
  avatarList: { flexDirection: 'row', justifyContent: 'center', marginBottom: 40 },
  avatarOption: { margin: 8, padding: 2, borderRadius: 50, borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#4CD964' }, // Lingkaran hijau kalau dipilih
  avatarImg: { width: 50, height: 50 },
  saveButton: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30 },
  saveButtonText: { color: 'black', fontWeight: 'bold', fontSize: 16 },

  // DOCK STYLES
  dockWrapper: { position: 'absolute', bottom: 25, width: '100%', alignItems: 'center' },
  dockContainer: {
    width: '90%', height: 75, backgroundColor: 'rgba(20, 20, 20, 0.95)', borderRadius: 40,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: '#333',
  },
  dockAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333' },
  messageContainer: { flex: 1, justifyContent: 'center', paddingLeft: 15 },
  assistantText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
});

export default App;