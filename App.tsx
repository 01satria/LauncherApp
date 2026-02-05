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
  Image, // Tambahan Image untuk foto asisten
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

// URL Foto Asisten (Bisa diganti dengan require('./assets/foto.png') kalau ada file lokal)
// Saya pakai link gambar anime/avatar simple sebagai contoh
const ASSISTANT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";

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
        setMessage(`Hai Satria... ada notifikasi dari ${appNames}.`);
      } 
      // 2. Jika tidak ada notif, tampilkan Sapaan Waktu
      else {
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
    // Update setiap 1 menit agar sapaan waktu berubah otomatis
    const interval = setInterval(updateMessage, 60000);
    return () => clearInterval(interval);
  }, [notifications]);

  return (
    <View style={styles.dockContainer}>
      {/* Bagian Kiri: Foto Asisten */}
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: ASSISTANT_AVATAR }} 
          style={styles.avatar} 
          resizeMode="cover"
        />
        {/* Indikator Online Hijau kecil */}
        <View style={styles.onlineIndicator} />
      </View>

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
    bottom: 20,           // Jarak dari bawah layar
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: 'rgba(20, 20, 20, 0.9)', // Hitam agak transparan (Glassmorphism)
    borderRadius: 35,     // Rounded banget biar lonjong
    flexDirection: 'row', // Foto di kiri, Teks di kanan
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', // Garis tipis biar elegan
    elevation: 10,        // Bayangan
  },
  avatarContainer: {
    position: 'relative',
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
  messageContainer: {
    flex: 1, // Ambil sisa ruang yang ada
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