import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, FlatList, TouchableOpacity, StatusBar, SafeAreaView, Linking } from 'react-native';
import { LauncherKit } from 'react-native-launcher-kit';

interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

const App = () => {
  const [apps, setApps] = useState<AppData[]>([]);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const allApps = await LauncherKit.getApps();
      const sorted = allApps.sort((a, b) => a.label.localeCompare(b.label));
      setApps(sorted);
    } catch (e) {
      console.error(e);
    }
  };

  const openApp = (packageName: string) => {
    try {
      LauncherKit.launchApplication(packageName);
    } catch (e) {
      console.error("Could not open app", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      <FlatList
        data={apps}
        numColumns={4}
        keyExtractor={(item) => item.packageName}
        contentContainerStyle={styles.listContainer}

        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
            <Text style={{ color: 'white' }}>Loading Apps...</Text>
            <Text style={{ color: 'gray', fontSize: 10 }}>({apps.length} found)</Text>
          </View>
        }

        // --- TAMBAHAN OPTIMASI RAM ---
        removeClippedSubviews={true} // Hapus item yang keluar layar dari memori (PENTING!)
        initialNumToRender={12}      // Cuma render 12 biji pas awal buka
        maxToRenderPerBatch={8}      // Render 8 biji aja tiap scroll (biar enteng)
        windowSize={5}               // Jaga memori render area tetap kecil
        // -----------------------------

        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => openApp(item.packageName)}>
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={styles.icon}
            />
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  listContainer: { padding: 10 },
  item: { flex: 1, alignItems: 'center', margin: 10, maxWidth: '25%' },
  icon: { width: 48, height: 48, marginBottom: 5 },
  label: { color: '#ffffff', fontSize: 11, textAlign: 'center' },
});

export default App;