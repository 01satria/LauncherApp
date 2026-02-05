import React, { useEffect, useState, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Alert,
  NativeModules, // Import NativeModules untuk bypass
} from 'react-native';

import { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100;

// --- FIX 1: FUNGSI PEMBERSIH ICON ---
const getIconSource = (base64Icon: string) => {
  if (!base64Icon) return null;
  
  // Hapus spasi/newline yang mungkin merusak gambar
  let cleanIcon = base64Icon.trim().replace(/[\n\r]/g, '');

  // Cek apakah sudah ada header data:image
  if (cleanIcon.startsWith('data:image')) {
    return { uri: cleanIcon };
  } else {
    // Tambahkan header manual jika belum ada
    return { uri: `data:image/png;base64,${cleanIcon}` };
  }
};

const MemoizedAppItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string) => void }) => {
  const iconSource = getIconSource(item.icon);

  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName)}>
      {/* Tambahkan background abu-abu sementara biar ketahuan area iconnya */}
      <View style={styles.iconContainer}>
        {iconSource ? (
          <Image
            source={iconSource}
            style={styles.icon}
            resizeMode="cover" // Ganti ke cover biar full
          />
        ) : (
          <View style={[styles.icon, { backgroundColor: '#333' }]} /> // Kotak abu jika icon rusak
        )}
      </View>
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  // --- FIX 2: TEMBAK LANGSUNG NATIVE MODULE ---
  // Kita cari modul aslinya, namanya bisa 'LauncherKit' atau 'RNLauncherKit'
  const NativeLauncher = NativeModules.LauncherKit || NativeModules.RNLauncherKit;

  useEffect(() => {
    let isMounted = true;
    const loadApps = async () => {
      try {
        setLoading(true);
        const allApps = await InstalledApps.getApps();
        if (isMounted) {
          // Sortir dan pastikan icon ada isinya
          const sorted = allApps
            .filter(app => app.packageName) // Buang yang corrupt
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
          setApps(sorted);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };
    loadApps();
    return () => { isMounted = false; };
  }, []);

  const openApp = (packageName: string) => {
    // Logic Launch yang Lebih Kuat
    if (NativeLauncher && NativeLauncher.launchApplication) {
      NativeLauncher.launchApplication(packageName);
    } else if (InstalledApps && typeof (InstalledApps as any).launchApplication === 'function') {
      (InstalledApps as any).launchApplication(packageName);
    } else {
      Alert.alert(
        "Gagal Membuka", 
        "Modul Launcher tidak ditemukan.\nCoba restart HP atau install ulang app."
      );
      // Debugging: Cek isi NativeModules di Console kalau masih gagal
      console.log("NativeLauncher is:", NativeLauncher);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedAppItem item={item} onPress={openApp} />}
        initialNumToRender={20}
        removeClippedSubviews={false} // Matikan dulu biar icon tidak kedip
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#aaa', marginTop: 16 },
  list: { padding: 8, paddingBottom: 40 },
  item: { width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 12, height: ITEM_HEIGHT },
  iconContainer: { marginBottom: 8 },
  icon: { width: 52, height: 52, borderRadius: 12, backgroundColor: 'transparent' }, // Transparan default
  label: { color: '#ddd', fontSize: 11, textAlign: 'center', width: '90%' },
});

export default App;