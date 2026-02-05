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
} from 'react-native';

import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 4 - 16; // Adjust for margins
const ITEM_HEIGHT = 80; // Fixed height: icon 50 + label 20 + margins

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  const colors = ['#C62828', '#AD1457', '#6A1B9A', '#4527A0', '#283593', '#1565C0', '#00695C', '#2E7D32', '#EF6C00', '#D84315'];
  const colorIndex = item.label ? item.label.charCodeAt(0) % colors.length : 0;
  const bgColor = colors[colorIndex];

  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Text style={styles.initial}>{item.label ? item.label.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
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
          .filter(app => app.packageName) // Filter invalid
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
    offset: ITEM_HEIGHT * Math.floor(index / 4), // Adjust for numColumns=4
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
        contentContainerStyle={styles.list}
        getItemLayout={getItemLayout}
        initialNumToRender={10}          // Mulai dengan 10 item saja
        maxToRenderPerBatch={10}         // Batch kecil
        windowSize={5}                   // Kurangi window untuk hemat RAM
        updateCellsBatchingPeriod={100}  // Lebih lambat update, hemat resource
        removeClippedSubviews={true}      // Hapus item off-screen
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { padding: 10, paddingBottom: 20 },
  item: { 
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center', 
    margin: 8,
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