import React, { useEffect, useState } from 'react';
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
} from 'react-native';

// Perhatikan: importnya biasanya InstalledApps, bukan LauncherKit langsung
import { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon: string; // base64 string
  // opsional: versionName?: string; accentColor?: string;
}

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cek apakah module tersedia
      if (!InstalledApps) {
        throw new Error('InstalledApps module tidak ditemukan. Pastikan library terinstall & terlink dengan benar.');
      }

      // Ambil semua aplikasi
      const allApps: AppData[] = await InstalledApps.getApps({
        // Opsional: tambahkan ini jika ingin info tambahan (performa sedikit lebih lambat)
        // includeVersion: true,
        // includeAccentColor: true,
      });

      if (!allApps || !Array.isArray(allApps)) {
        throw new Error('getApps() mengembalikan data tidak valid');
      }

      // Sort berdasarkan nama aplikasi
      const sortedApps = allApps
        .filter(app => app.label && app.packageName) // filter yang invalid
        .sort((a, b) => a.label.localeCompare(b.label));

      setApps(sortedApps);
      setLoading(false);
    } catch (err: any) {
      console.error('Gagal load apps:', err);
      setError(
        err.message ||
        'Gagal memuat daftar aplikasi.\n\n' +
          'Pastikan:\n' +
          '1. Library react-native-launcher-kit sudah diinstall\n' +
          '2. Sudah di-rebuild (cd android && ./gradlew clean)\n' +
          '3. App punya permission QUERY_ALL_PACKAGES (Android 11+)\n' +
          '4. Anda sedang test di device Android (bukan emulator/iOS)'
      );
      setLoading(false);
    }
  };

  const openApp = async (packageName: string) => {
    try {
      await InstalledApps.launchApplication(packageName);
    } catch (err) {
      console.error('Gagal membuka aplikasi:', err);
      setError(`Gagal membuka ${packageName}: ${err.message || 'Unknown error'}`);
    }
  };

  const renderItem = ({ item }: { item: AppData }) => (
    <TouchableOpacity style={styles.item} onPress={() => openApp(item.packageName)}>
      <Image
        source={{ uri: `data:image/png;base64,${item.icon}` }}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Memuat daftar aplikasi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>ERROR</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadApps}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : apps.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Tidak ada aplikasi ditemukan</Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          numColumns={4}
          keyExtractor={(item) => item.packageName}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: '#ff9999',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    margin: 6,
    maxWidth: '25%',
  },
  icon: {
    width: 58,
    height: 58,
    marginBottom: 6,
    borderRadius: 12,
  },
  label: {
    color: '#e0e0e0',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default App;