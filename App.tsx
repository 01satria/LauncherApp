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
  Alert,
  NativeModules,
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
// UBAH 1: Lebar item dibagi 4 pas, tanpa dikurangi angka aneh-aneh
const ITEM_WIDTH = width / 4; 
const ITEM_HEIGHT = 100;

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  const colors = ['#FF3B30', '#FF2D55', '#AF52DE', '#007AFF', '#34C759', '#FF9500', '#FFCC00', '#5AC8FA', '#4CD964', '#5856D6'];
  const colorIndex = item.label ? item.label.charCodeAt(0) % colors.length : 0;
  const bgColor = colors[colorIndex];

  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.6}
    >
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{item.label}</Text>
    </TouchableOpacity>
  );
});

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadApps = async () => {
      try {
        setLoading(true);
        const result = await InstalledApps.getApps();
        
        const lightData = result
          .map(app => ({
            label: app.label || 'Unnamed',
            packageName: app.packageName,
          }))
          .filter(app => app.packageName)
          .sort((a, b) => a.label.localeCompare(b.label));
        
        if (isMounted) {
          setApps(lightData);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) {
          setLoading(false);
          Alert.alert("Error Load Apps", String(e));
        }
      }
    };

    loadApps();

    return () => { isMounted = false; };
  }, []);

  const launchApp = (packageName: string, label: string) => {
    try {
      ToastAndroid.show(`Membuka ${label}...`, ToastAndroid.SHORT);
      RNLauncherKitHelper.launchApplication(packageName);
    } catch (err) {
      console.error('Launch error:', err);
      Alert.alert("Error Launch", `Gagal membuka ${label}: ${String(err)}`);
    }
  };

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * Math.floor(index / 4),
    index,
  });

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
        renderItem={({ item }) => <MemoizedItem item={item} onPress={launchApp} />}
        contentContainerStyle={styles.list} // Style list diperbaiki
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000000' },
  
  // UBAH 2: Padding horizontal dihapus agar ITEM_WIDTH bisa pas 100%
  list: { 
    paddingTop: 32, // Padding atas biar ga nempel status bar
    paddingBottom: 32, 
    // paddingHorizontal dihapus
  }, 

  // UBAH 3: Item menjadi container kolom yang presisi
  item: { 
    width: ITEM_WIDTH, // Lebar pas 25% layar
    height: ITEM_HEIGHT,
    alignItems: 'center', // Konten di tengah kolom
    justifyContent: 'flex-start',
    // marginHorizontal dihapus agar tidak menggeser grid
    marginBottom: 10,
  },
  
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  initial: {
    color: 'white',
    fontSize: 26,
    fontWeight: '600',
  },
  label: { 
    color: '#eee',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    paddingHorizontal: 4, // Supaya teks panjang ga nempel pinggir
  },
});

export default App;