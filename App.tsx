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
  Alert,
  ToastAndroid,
  Dimensions,
  Platform,
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

// OPTIMASI 1: Pindahkan array warna keluar agar tidak dibuat berulang-ulang (Hemat CPU)
const COLORS = ['#FF3B30', '#FF2D55', '#AF52DE', '#007AFF', '#34C759', '#FF9500', '#FFCC00', '#5AC8FA', '#4CD964', '#5856D6'];

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  // Kalkulasi warna sangat ringan
  const colorIndex = item.label ? item.label.charCodeAt(0) % COLORS.length : 0;
  const bgColor = COLORS[colorIndex];

  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.7} // Sedikit lebih transparan saat disentuh
    >
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName); // Custom comparator biar super efisien

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Gunakan setTimeout agar UI muncul dulu, baru load data berat (Interaction Manager versi manual)
    const initLoad = setTimeout(async () => {
      try {
        const result = await InstalledApps.getApps();
        
        // Mapping data se-minimal mungkin
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

  // OPTIMASI 2: useCallback agar fungsi tidak dire-create
  const launchApp = useCallback((packageName: string, label: string) => {
    try {
      ToastAndroid.show(`${label} dibuka untukmu 😉`, ToastAndroid.SHORT);
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      Alert.alert("Gagal", "Tidak bisa membuka aplikasi.");
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
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} />}
        contentContainerStyle={styles.list}
        getItemLayout={getItemLayout}
        
        // --- SETTINGAN PERFORMANCE EKSTREM ---
        initialNumToRender={24}       // Render pas satu layar penuh aja (biar start cepat)
        maxToRenderPerBatch={8}       // Render sedikit-sedikit saat scroll (biar FPS tinggi)
        windowSize={3}                // HAPUS item yang jauh dari layar dari memori (RAM super hemat)
        removeClippedSubviews={true}  // Pastikan item di luar layar tidak dirender
        updateCellsBatchingPeriod={50}
        // -------------------------------------
        
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  
  list: { 
    paddingTop: 40, 
    paddingBottom: 40, 
  }, 

  item: { 
    width: ITEM_WIDTH, 
    height: ITEM_HEIGHT,
    alignItems: 'center', 
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  
  iconBox: {
    width: 58,  // Sedikit diperkecil agar terlihat lebih rapi
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 2, // Shadow dikurangi biar render lebih enteng
  },
  initial: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700', // Lebih tebal dikit
  },
  label: { 
    color: '#eee',
    fontSize: 11, // Font size dikecilkan dikit agar muat banyak
    textAlign: 'center',
    paddingHorizontal: 2,
  },
});

export default App;