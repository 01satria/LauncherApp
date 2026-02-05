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
} from 'react-native';

// UPDATE IMPORT: Ambil LauncherKit (Objek Utama)
import LauncherKit, { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon: string; // base64
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100;

// Component Item yang Lebih Pintar
const MemoizedAppItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string) => void }) => {
  
  // LOGIC FIX ICON: Cek apakah icon sudah punya header 'data:image...' atau belum
  const iconSource = item.icon.startsWith('data:image')
    ? { uri: item.icon } // Kalau sudah ada, pakai langsung
    : { uri: `data:image/png;base64,${item.icon}` }; // Kalau belum, tambahkan

  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName)}>
      <Image
        source={iconSource}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadApps = async () => {
      try {
        setLoading(true);
        
        // Menggunakan InstalledApps untuk mengambil data
        const allApps = await InstalledApps.getApps();

        if (isMounted) {
          const sorted = allApps
            .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
          setApps(sorted);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Gagal memuat aplikasi');
          setLoading(false);
        }
      }
    };

    loadApps();

    return () => { isMounted = false; };
  }, []);

  const openApp = (packageName: string) => {
    try {
      // FIX CRASH: Gunakan LauncherKit.launchApplication, bukan InstalledApps
      // Jika LauncherKit undefined, coba fallback ke InstalledApps (untuk jaga-jaga)
      if (LauncherKit && typeof LauncherKit.launchApplication === 'function') {
        LauncherKit.launchApplication(packageName);
      } else if (typeof InstalledApps.launchApplication === 'function') {
        InstalledApps.launchApplication(packageName);
      } else {
        Alert.alert("Error", "Fungsi launchApplication tidak ditemukan di library ini.");
      }
    } catch (err) {
      console.log('Gagal buka app:', err);
      Alert.alert("Gagal", "Tidak bisa membuka aplikasi ini.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Memuat aplikasi...</Text>
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
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true} 
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
  item: { width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 10, height: ITEM_HEIGHT },
  icon: { width: 50, height: 50, marginBottom: 8, borderRadius: 10 },
  label: { color: '#ddd', fontSize: 11, textAlign: 'center', width: '90%' },
});

export default App;