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
const ITEM_WIDTH = width / 4 - 20; // Slightly more spacing for modern feel
const ITEM_HEIGHT = 90; // Slightly taller for better touch targets

const MemoizedItem = memo(({ item, onPress }: { item: AppData; onPress: (pkg: string, label: string) => void }) => {
  const colors = ['#FF3B30', '#FF2D55', '#AF52DE', '#007AFF', '#34C759', '#FF9500', '#FFCC00', '#5AC8FA', '#4CD964', '#5856D6'];
  const colorIndex = item.label ? item.label.charCodeAt(0) % colors.length : 0;
  const bgColor = colors[colorIndex];

  return (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item.packageName, item.label)}
      activeOpacity={0.6} // Smoother press feedback
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
        contentContainerStyle={styles.list}
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
  container: { flex: 1, backgroundColor: '#000' }, // Keep dark for consistency, but modernized
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { padding: 16, paddingBottom: 32 }, // More padding for airy feel
  item: { 
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center', 
    marginHorizontal: 10,
    marginVertical: 8,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20, // More rounded like iOS icons
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
    fontSize: 26, // Larger for modern look
    fontWeight: '600', // Semi-bold like iOS
  },
  label: { 
    color: '#eee', // Brighter white for contrast
    fontSize: 12, // Standard iOS label size
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', // iOS-like font
  },
});

export default App;