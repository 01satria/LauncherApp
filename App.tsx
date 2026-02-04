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
} from 'react-native';

import { InstalledApps } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon: string; // base64
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4;
const ITEM_HEIGHT = 100; // estimasi tetap: icon 58 + label + margin

const MemoizedAppItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string) => void }) => (
  <TouchableOpacity style={styles.item} onPress={() => onPress(item.packageName)}>
    <Image
      source={{ uri: `data:image/png;base64,${item.icon}` }}
      style={styles.icon}
      resizeMode="contain"
    />
    <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
      {item.label}
    </Text>
  </TouchableOpacity>
));

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadApps = async () => {
      try {
        setLoading(true);
        setError(null);

        const allApps: AppData[] = await InstalledApps.getApps();

        if (!allApps || !Array.isArray(allApps)) {
          throw new Error('Data aplikasi tidak valid');
        }

        const sorted = allApps
          .filter(app => app.label && app.packageName && app.icon)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (isMounted) {
          setApps(sorted);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            'Gagal memuat aplikasi.\n\n' +
              'Pastikan:\n' +
              '• Permission QUERY_ALL_PACKAGES ada\n' +
              '• Library terinstall & rebuild\n' +
              `Detail: ${err?.message || 'Unknown error'}`
          );
          setLoading(false);
        }
      }
    };

    loadApps();

    return () => {
      isMounted = false;
    };
  }, []);

  const openApp = (packageName: string) => {
    InstalledApps.launchApplication(packageName).catch(err => {
      console.log('Gagal buka app:', err);
    });
  };

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Memuat aplikasi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
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
        keyExtractor={item => item.packageName}
        renderItem={({ item }) => <MemoizedAppItem item={item} onPress={openApp} />}
        getItemLayout={getItemLayout}
        initialNumToRender={12}           // mulai kecil
        maxToRenderPerBatch={8}           // batch kecil
        windowSize={9}                    // ~2 layar di atas & bawah
        updateCellsBatchingPeriod={50}    // lebih hemat
        removeClippedSubviews={false}     // matikan, kadang bermasalah
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
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
    color: '#ff5555',
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
  list: {
    padding: 8,
    paddingBottom: 40,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
  },
  icon: {
    width: 58,
    height: 58,
    marginBottom: 6,
    borderRadius: 12,
  },
  label: {
    color: '#ddd',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default App;