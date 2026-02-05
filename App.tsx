import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  NativeModules, // Kita pakai NativeModules langsung biar stabil
  ToastAndroid,
} from 'react-native';

import { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
}

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      // Ambil data aplikasi
      const result = await InstalledApps.getApps();
      
      // PENTING: Kita HAPUS data icon (base64) dari memori agar RAM tidak meledak
      // Kita cuma simpan Label dan PackageName
      const lightData = result.map(app => ({
        label: app.label,
        packageName: app.packageName
      }));

      // Sortir A-Z
      const sorted = lightData.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      
      setApps(sorted);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  const launchApp = (packageName: string, label: string) => {
    try {
      ToastAndroid.show(`Membuka ${label}...`, ToastAndroid.SHORT);

      // --- METODE ANTI-CRASH ---
      // Kita cari modul Native Android-nya secara manual
      const Launcher = NativeModules.LauncherKit 
                    || NativeModules.RNLauncherKitHelper 
                    || NativeModules.RNLauncherKit;

      if (Launcher && Launcher.launchApplication) {
        Launcher.launchApplication(packageName);
      } else {
        // Fallback terakhir: Coba pakai InstalledApps (kalau library versi lama)
        if (InstalledApps && typeof (InstalledApps as any).launchApplication === 'function') {
          (InstalledApps as any).launchApplication(packageName);
        } else {
          Alert.alert("Gagal", "Modul Launcher tidak ditemukan di HP ini.");
        }
      }
    } catch (err) {
      Alert.alert("Error", "Gagal membuka aplikasi.");
    }
  };

  // Komponen Item Super Ringan (Cuma Teks & Kotak Warna)
  const renderItem = ({ item }: { item: AppData }) => {
    // Warna background acak berdasarkan huruf depan
    const colors = ['#C62828', '#AD1457', '#6A1B9A', '#4527A0', '#283593', '#1565C0', '#00695C', '#2E7D32', '#EF6C00', '#D84315'];
    const colorIndex = item.label ? item.label.charCodeAt(0) % colors.length : 0;
    const bgColor = colors[colorIndex];

    return (
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => launchApp(item.packageName, item.label)}
        activeOpacity={0.7}
      >
        {/* Pengganti Icon: Kotak Warna dengan Inisial */}
        <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
          <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
        </View>
        
        <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{color:'#fff', marginTop: 10}}>Memuat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        // Optimasi FlatList biar scroll enteng
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { padding: 10 },
  item: { 
    flex: 1, 
    alignItems: 'center', 
    margin: 8, 
    maxWidth: '25%' // Grid 4 kolom
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  initial: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  label: { 
    color: '#ddd', 
    fontSize: 11, 
    textAlign: 'center',
  },
});

export default App;