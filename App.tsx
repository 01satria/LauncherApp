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
  BackHandler, // Untuk cegah reload saat back
  TextInput,
  Alert,
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';

interface AppData {
  label: string;
  packageName: string;
}

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

// --- KOMPONEN ITEM APLIKASI ---
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

// --- KOMPONEN WELCOME SCREEN (SETUP) ---
const SetupScreen = ({ onFinish }: { onFinish: (name: string, photo: string) => void }) => {
  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri || null);
    }
  };

  const saveSetup = async () => {
    if (!name.trim()) {
      ToastAndroid.show("Masukkan nama panggilanmu dulu!", ToastAndroid.SHORT);
      return;
    }
    // Simpan ke memori HP
    try {
      await AsyncStorage.setItem('user_name', name);
      if (photoUri) await AsyncStorage.setItem('user_photo', photoUri);
      else await AsyncStorage.setItem('user_photo', 'DEFAULT'); // Penanda pakai default
      
      onFinish(name, photoUri || "");
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan data.");
    }
  };

  return (
    <View style={styles.setupContainer}>
      <StatusBar hidden />
      <Text style={styles.setupTitle}>Selamat Datang</Text>
      <Text style={styles.setupSubtitle}>Mari kenalan dulu sebelum mulai.</Text>

      {/* Input Foto */}
      <TouchableOpacity onPress={pickImage} style={styles.avatarPicker}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatarPreview} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={{color:'#555', fontSize: 30}}>+</Text>
            <Text style={{color:'#555', fontSize: 10}}>Foto</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={{color:'gray', marginBottom:20, fontSize:12}}>Ketuk lingkaran untuk pilih foto asisten</Text>

      {/* Input Nama */}
      <TextInput 
        style={styles.input}
        placeholder="Nama Panggilanmu..."
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveSetup}>
        <Text style={styles.saveButtonText}>MULAI</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- KOMPONEN DOCK ASISTEN ---
const AssistantDock = ({ userName, userPhoto }: { userName: string, userPhoto: string | null }) => {
  const [message, setMessage] = useState("");
  
  // Gunakan foto default jika user tidak upload
  const avatarSource = userPhoto && userPhoto !== 'DEFAULT' 
    ? { uri: userPhoto } 
    : { uri: "https://cdn-icons-png.flaticon.com/512/4140/4140048.png" }; // Default online

  useEffect(() => {
    const updateMessage = () => {
      const hour = new Date().getHours();
      // Logic sapaan waktu
      if (hour >= 0 && hour < 4) setMessage(`Selamat tidur, ${userName} 😴`);
      else if (hour >= 4 && hour < 11) setMessage(`Selamat pagi, ${userName} ☀️`);
      else if (hour >= 11 && hour < 15) setMessage(`Selamat siang, ${userName} 🌤️`);
      else if (hour >= 15 && hour < 18) setMessage(`Selamat sore, ${userName} 🌇`);
      else setMessage(`Selamat malam, ${userName} 🌙`);
    };

    updateMessage();
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [userName]);

  return (
    <View style={styles.dockWrapper}>
        <View style={styles.dockContainer}>
        {/* Foto Asisten */}
        <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
        
        {/* Pesan (Rata Tengah Vertikal dengan Gambar) */}
        <View style={styles.messageContainer}>
            <Text style={styles.assistantText}>{message}</Text>
        </View>
        </View>
    </View>
  );
};

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Setup
  const [isSetupDone, setIsSetupDone] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // 1. CEK SETUP PERTAMA KALI
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const storedName = await AsyncStorage.getItem('user_name');
        const storedPhoto = await AsyncStorage.getItem('user_photo');
        
        if (storedName) {
          setUserName(storedName);
          setUserPhoto(storedPhoto);
          setIsSetupDone(true);
        } else {
          setIsSetupDone(false);
        }
      } catch (e) {
        setIsSetupDone(false);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkStorage();
  }, []);

  // 2. CEGAH RELOAD SAAT BACK (Hardware Back Button Handler)
  useEffect(() => {
    const backAction = () => {
      // Return true artinya: "Saya sudah handle tombol back, sistem jangan lakukan apa-apa"
      // Ini mencegah aplikasi keluar/reload.
      return true; 
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  // 3. LOAD APLIKASI
  useEffect(() => {
    if (!isSetupDone) return; // Jangan load app kalau belum setup

    let isMounted = true;
    const initLoad = setTimeout(async () => {
      try {
        const result = await InstalledApps.getApps();
        const lightData = result
          .map(app => ({ label: app.label || 'App', packageName: app.packageName }))
          .filter(app => app.packageName)
          .sort((a, b) => a.label.localeCompare(b.label));
        
        if (isMounted) {
          setApps(lightData);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) setLoading(false);
      }
    }, 500); // Delay dikit biar transisi enak

    return () => { isMounted = false; clearTimeout(initLoad); };
  }, [isSetupDone]);

  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      ToastAndroid.show(`Opening ${label}...`, ToastAndroid.SHORT);
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      ToastAndroid.show("Failed to launch app", ToastAndroid.SHORT);
    }
  }, []);

  const handleFinishSetup = (name: string, photo: string) => {
    setUserName(name);
    setUserPhoto(photo);
    setIsSetupDone(true);
  };

  // --- RENDER ---

  // Loading Screen Awal (Cek memori)
  if (checkingSetup) {
     return <View style={styles.center}><ActivityIndicator color="white"/></View>;
  }

  // Tampilkan Welcome Screen jika belum pernah setup
  if (!isSetupDone) {
    return <SetupScreen onFinish={handleFinishSetup} />;
  }

  // Tampilkan Loading App Icons
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{color:'#fff', marginTop:10}}>Menyiapkan Launchermu...</Text>
      </View>
    );
  }

  // Tampilkan Home Screen Utama
  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar Transparan (System UI sudah dihandle Native MainActivity) */}
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true} />
      
      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} />}
        contentContainerStyle={styles.list}
        initialNumToRender={24}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />

      {/* DOCK ASISTEN */}
      <AssistantDock userName={userName} userPhoto={userPhoto} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { paddingTop: 50, paddingBottom: 120 }, 

  item: { 
    width: ITEM_WIDTH, 
    height: ITEM_HEIGHT,
    alignItems: 'center', 
    marginBottom: 10,
  },
  iconBox: {
    width: 58, height: 58, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6, borderWidth: 1, borderColor: '#333333', 
    backgroundColor: '#000000', elevation: 2,
  },
  initial: { color: 'white', fontSize: 24, fontWeight: '700' },
  label: { color: '#eee', fontSize: 11, textAlign: 'center', paddingHorizontal: 2 },

  // --- STYLE DOCK (RATA TENGAH) ---
  dockWrapper: {
      position: 'absolute', bottom: 20, width: '100%',
      alignItems: 'center', // Agar dock berada di tengah layar horizontal
  },
  dockContainer: {
    width: '90%', // Lebar dock 90% dari layar
    height: 70,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center', // Rata tengah vertikal
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#333', marginLeft: 5,
  },
  messageContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center', // Text rata tengah vertikal
    paddingHorizontal: 15,
  },
  assistantText: {
    color: '#ffffff', fontSize: 13, fontWeight: '500',
  },

  // --- STYLE SETUP SCREEN ---
  setupContainer: {
      flex: 1, backgroundColor: '#000',
      justifyContent: 'center', alignItems: 'center', padding: 30
  },
  setupTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  setupSubtitle: { color: 'gray', fontSize: 14, marginBottom: 40 },
  avatarPicker: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
      marginBottom: 10, borderWidth: 2, borderColor: '#333'
  },
  avatarPreview: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { alignItems: 'center' },
  input: {
      width: '100%', backgroundColor: '#111', color: 'white',
      padding: 15, borderRadius: 12, marginBottom: 30,
      borderWidth: 1, borderColor: '#333', textAlign: 'center'
  },
  saveButton: {
      backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 40,
      borderRadius: 30, elevation: 5
  },
  saveButtonText: { color: 'black', fontWeight: 'bold' }
});

export default App;