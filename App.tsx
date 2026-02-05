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
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

// HAPUS ARRAY COLORS KARENA SUDAH TIDAK DIPAKAI
// const COLORS = [...]; 

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  // Tidak perlu hitung warna lagi, langsung render
  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.7}
    >
      {/* UBAH: backgroundColor langsung di-hardcode jadi hitam (#000000) */}
      <View style={[styles.iconBox, { backgroundColor: '#000000' }]}>
        <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName);

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
      ToastAndroid.show(`${label} dibuka`, ToastAndroid.SHORT);
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
        initialNumToRender={24}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
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
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    // Kita tambahkan border tipis warna abu-abu gelap 
    // supaya kotak hitamnya tetap kelihatan kalau wallpapermu juga gelap/hitam
    borderWidth: 1,
    borderColor: '#333333', 
    elevation: 2,
  },
  initial: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
  },
  label: { 
    color: '#eee',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
});

export default App;