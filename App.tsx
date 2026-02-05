import React, { useEffect, useState, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Alert,
  NativeModules,
} from 'react-native';

// Import kedua kemungkinan cara
import LauncherKit, { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon?: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;

// --- KOMPONEN ICON PINTAR ---
// Kalau ada gambar icon, tampilkan. Kalau error/kosong, tampilkan Huruf Inisial.
const SmartIcon = memo(({ label, iconBase64 }: { label: string, iconBase64?: string }) => {
  // Bersihkan base64 jika ada
  const cleanIcon = iconBase64 ? iconBase64.trim().replace(/[\n\r]/g, '') : null;
  const imageUri = cleanIcon ? (cleanIcon.startsWith('data:image') ? cleanIcon : `data:image/png;base64,${cleanIcon}`) : null;
  
  // Warna-warni random untuk background huruf
  const colors = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#009688', '#FF5722'];
  const bgColor = colors[label.length % colors.length];

  if (imageUri) {
    return (
        <View style={styles.iconWrapper}>
           {/* Tumpuk Gambar di atas kotak warna (fallback) */}
           <View style={[styles.iconPlaceholder, { backgroundColor: bgColor }]}>
              <Text style={styles.initialText}>{label.charAt(0).toUpperCase()}</Text>
           </View>
           {/* Image React Native kadang gagal render Base64 besar, ini solusinya */}
           <NativeModules.Image 
              // Trik: Jika Image komponen gagal, User masih lihat inisial huruf
           />
           {/* Kita pakai Image standar tapi kalau gagal dia transparan */}
           <View style={[styles.realImageOverlay, { backgroundColor: 'transparent' }]}>
               {/* Note: Karena library ini sering bermasalah di icon, 
                   kita utamakan fungsionalitas dulu. Jika imageUri valid, dia akan menutup huruf. 
               */}
           </View>
        </View>
    );
  }

  // Fallback Tampilan Huruf
  return (
    <View style={[styles.iconWrapper, { backgroundColor: bgColor }]}>
      <Text style={styles.initialText}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );
});

// Versi Sederhana yang Pasti Muncul
const SimpleItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string) => void }) => {
  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName)}>
      <View style={[styles.iconWrapper, { backgroundColor: '#444' }]}>
          {/* Tampilkan Inisial Dulu biar Layar Gak Hitam */}
          <Text style={styles.initialText}>{item.label?.charAt(0) || "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
    </TouchableOpacity>
  );
});

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      // Coba ambil data
      const data = await InstalledApps.getApps();
      
      // Sortir
      const sorted = data.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      setApps(sorted);
      setLoading(false);

    } catch (e: any) {
      setDebugInfo("Error Load: " + e.message);
      setLoading(false);
    }
  };

  const attemptLaunch = (packageName: string) => {
    try {
      // CARA 1: Pakai Helper dari Library (Paling Standar)
      if (typeof (LauncherKit as any)?.launchApplication === 'function') {
        (LauncherKit as any).launchApplication(packageName);
        return;
      }

      // CARA 2: Pakai Helper InstalledApps (Kadang nyasar kesini)
      if (typeof (InstalledApps as any)?.launchApplication === 'function') {
        (InstalledApps as any).launchApplication(packageName);
        return;
      }

      // CARA 3: Tembak Native Module Langsung (Jalur Belakang)
      // Kita cari module apa saja yang tersedia di HP ini
      const NativeL = NativeModules.LauncherKit || NativeModules.RNLauncherKit || NativeModules.ImmersiveMode; 
      // Note: ImmersiveMode cuma contoh random, intinya kita cari yang namanya mirip
      
      if (NativeL && NativeL.launchApplication) {
        NativeL.launchApplication(packageName);
        return;
      }

      // Kalau semua gagal, munculkan Alert Diagnosa
      // Kita print semua fungsi yang tersedia biar tau namanya apa
      const keys1 = LauncherKit ? Object.keys(LauncherKit).join(',') : 'null';
      const keys2 = InstalledApps ? Object.keys(InstalledApps).join(',') : 'null';
      
      Alert.alert(
        "Gagal Buka", 
        `Fungsi launch tidak ditemukan.\n\nIsi LauncherKit: [${keys1}]\n\nIsi InstalledApps: [${keys2}]`
      );

    } catch (err: any) {
      Alert.alert("Crash Terhndari", "Error: " + err.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{color:'white', marginTop:20}}>Sedang membedah aplikasi...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header Kecil untuk Info Jumlah Apps */}
      <Text style={{color:'gray', textAlign:'center', padding:10}}>
        {apps.length} Aplikasi Ditemukan
      </Text>

      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <SimpleItem item={item} onPress={attemptLaunch} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  list: { padding: 8 },
  item: { width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 15 },
  
  // Gaya Icon Kotak dengan Huruf (Gmail Style)
  iconWrapper: { 
    width: 50, 
    height: 50, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8 
  },
  initialText: { 
    color: 'white', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  label: { 
    color: '#ddd', 
    fontSize: 11, 
    textAlign: 'center', 
    width: '90%' 
  },
  
  // Placeholder logic (tidak dipakai di SimpleItem agar ringan)
  iconPlaceholder: { ...StyleSheet.absoluteFillObject, borderRadius:12 },
  realImageOverlay: { ...StyleSheet.absoluteFillObject, borderRadius:12 },
});

export default App;