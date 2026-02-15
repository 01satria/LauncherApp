import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  ToastAndroid,
  Dimensions,
  TextInput,
  Modal,
  useColorScheme,
  ListRenderItem,
  NativeModules,
} from 'react-native';
import { InstalledApps, RNLauncherKitHelper } from 'react-native-launcher-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { UninstallModule } = NativeModules;

interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const ITEM_WIDTH = width / COLUMN_COUNT;
const ICON_SIZE = ITEM_WIDTH * 0.6;
const DOCK_HEIGHT = 80;
const DOCK_ICON_SIZE = 56;

// Theme colors
const lightTheme = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  primary: '#2196F3',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
  notification: '#FF5252',
};

const darkTheme = {
  background: '#121212',
  surface: '#1E1E1E',
  primary: '#64B5F6',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#333333',
  notification: '#FF5252',
};

// App Icon Component
const AppIcon = React.memo(({ item, onPress, onLongPress, theme }: {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  theme: typeof lightTheme;
}) => {
  // Map package names to Material Icons
  const getIconName = (packageName: string, label: string): string => {
    const pkg = packageName.toLowerCase();
    const lbl = label.toLowerCase();
    
    if (pkg.includes('camera') || lbl.includes('camera')) return 'camera-alt';
    if (pkg.includes('gallery') || lbl.includes('gallery') || lbl.includes('photo')) return 'photo';
    if (pkg.includes('calendar') || lbl.includes('calendar')) return 'event';
    if (pkg.includes('clock') || lbl.includes('clock')) return 'access-time';
    if (pkg.includes('settings') || lbl.includes('settings')) return 'settings';
    if (pkg.includes('phone') || lbl.includes('phone') || lbl.includes('dialer')) return 'phone';
    if (pkg.includes('contacts') || lbl.includes('contacts')) return 'contacts';
    if (pkg.includes('messages') || lbl.includes('messages') || pkg.includes('sms')) return 'message';
    if (pkg.includes('browser') || lbl.includes('browser') || pkg.includes('chrome')) return 'public';
    if (pkg.includes('mail') || lbl.includes('mail') || lbl.includes('email')) return 'email';
    if (pkg.includes('map') || lbl.includes('map')) return 'map';
    if (pkg.includes('music') || lbl.includes('music')) return 'music-note';
    if (pkg.includes('video') || lbl.includes('video')) return 'play-circle-outline';
    if (pkg.includes('download') || lbl.includes('download')) return 'download';
    if (pkg.includes('file') || lbl.includes('file')) return 'folder';
    if (pkg.includes('calculator') || lbl.includes('calculator')) return 'calculate';
    if (pkg.includes('store') || lbl.includes('store') || lbl.includes('play')) return 'store';
    
    return 'apps'; // Default icon
  };

  return (
    <Pressable
      style={styles.appItem}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      android_ripple={{
        color: theme.primary,
        radius: ITEM_WIDTH / 2,
        borderless: false,
      }}
    >
      <MaterialIcons 
        name={getIconName(item.packageName, item.label)} 
        size={ICON_SIZE} 
        color={theme.text} 
      />
      <Text style={[styles.appLabel, { color: theme.text }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName && prev.theme === next.theme);

// Dock Component
const Dock = React.memo(({ 
  dockApps, 
  onLaunchApp, 
  onLongPressApp,
  onOpenAssistant,
  theme 
}: {
  dockApps: AppData[];
  onLaunchApp: (pkg: string) => void;
  onLongPressApp: (pkg: string, label: string) => void;
  onOpenAssistant: () => void;
  theme: typeof lightTheme;
}) => {
  const renderDockIcon = (iconName: string, onPress: () => void, isAssistant = false) => (
    <Pressable
      style={[
        styles.dockIcon,
        { 
          backgroundColor: isAssistant ? theme.primary : theme.surface,
        }
      ]}
      onPress={onPress}
      android_ripple={{ color: theme.primary, borderless: true }}
    >
      <MaterialIcons 
        name={iconName} 
        size={28} 
        color={isAssistant ? '#FFFFFF' : theme.text} 
      />
    </Pressable>
  );

  return (
    <View style={[styles.dock, { 
      backgroundColor: theme.background,
      borderTopColor: theme.border,
    }]}>
      {dockApps.slice(0, 3).map((app, index) => (
        <Pressable
          key={app.packageName}
          style={[styles.dockIcon, { backgroundColor: theme.surface }]}
          onPress={() => onLaunchApp(app.packageName)}
          onLongPress={() => onLongPressApp(app.packageName, app.label)}
          android_ripple={{ color: theme.primary, borderless: true }}
        >
          <MaterialIcons name="apps" size={28} color={theme.text} />
        </Pressable>
      ))}
      {renderDockIcon('smart-toy', onOpenAssistant, true)}
    </View>
  );
});

// Assistant Modal Component
const AssistantModal = ({ visible, onClose, theme }: {
  visible: boolean;
  onClose: () => void;
  theme: typeof lightTheme;
}) => {
  const [messages, setMessages] = useState<{text: string; isUser: boolean}[]>([
    { text: "Hello! I'm your assistant. How can I help you today?", isUser: false }
  ]);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    setMessages(prev => [...prev, { text: inputText, isUser: true }]);
    
    // Simple AI response
    setTimeout(() => {
      const responses = [
        "I'm here to help!",
        "That's a great question!",
        "Let me think about that...",
        "I understand. How else can I assist?",
      ];
      setMessages(prev => [...prev, { 
        text: responses[Math.floor(Math.random() * responses.length)], 
        isUser: false 
      }]);
    }, 500);
    
    setInputText('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.assistantContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.assistantHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.assistantTitle, { color: theme.text }]}>Assistant</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          style={styles.messageList}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.isUser ? styles.userBubble : styles.botBubble,
              { backgroundColor: item.isUser ? theme.primary : theme.surface }
            ]}>
              <Text style={[
                styles.messageText,
                { color: item.isUser ? '#FFFFFF' : theme.text }
              ]}>
                {item.text}
              </Text>
            </View>
          )}
        />
        
        <View style={[styles.inputContainer, { 
          borderTopColor: theme.border,
          backgroundColor: theme.background 
        }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.surface,
              color: theme.text 
            }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: theme.primary }]}
            onPress={sendMessage}
          >
            <MaterialIcons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Main App Component
const App = () => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkTheme : lightTheme;
  
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getSortedApps();
      const apps = result.map((a: any) => ({
        label: a.label || 'App',
        packageName: a.packageName,
        icon: a.icon,
      }));
      setAllApps(apps);
      setFilteredApps(apps);
      setLoading(false);
    } catch (e) {
      console.error('refreshApps failed:', e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshApps();
    
    const installSub = InstalledApps.startListeningForAppInstallations(() => {
      refreshApps();
    });

    return () => {
      InstalledApps.stopListeningForAppInstallations();
    };
  }, [refreshApps]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredApps(allApps);
    } else {
      const filtered = allApps.filter(app =>
        app.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredApps(filtered);
    }
  }, [searchQuery, allApps]);

  const handleLongPress = useCallback((pkg: string, label: string) => {
    setSelectedPkg(pkg);
    setSelectedLabel(label);
    setActionModal(true);
  }, []);

  const handleUninstall = () => {
    setActionModal(false);
    setTimeout(() => {
      if (UninstallModule) {
        UninstallModule.uninstallApp(selectedPkg);
      }
    }, 300);
    setTimeout(() => refreshApps(), 2000);
  };

  const launchApp = (pkg: string) => {
    try {
      RNLauncherKitHelper.launchApplication(pkg);
    } catch {
      ToastAndroid.show("Cannot Open", ToastAndroid.SHORT);
    }
  };

  const renderItem: ListRenderItem<AppData> = useCallback(({ item }) => (
    <AppIcon 
      item={item} 
      onPress={launchApp} 
      onLongPress={handleLongPress}
      theme={theme}
    />
  ), [handleLongPress, theme]);

  const dockApps = allApps.slice(0, 3);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle={systemTheme === 'dark' ? 'light-content' : 'dark-content'} 
      />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search apps..."
            placeholderTextColor={theme.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* App Grid */}
      <FlatList
        data={filteredApps}
        numColumns={COLUMN_COUNT}
        keyExtractor={item => item.packageName}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />

      {/* Dock */}
      <Dock
        dockApps={dockApps}
        onLaunchApp={launchApp}
        onLongPressApp={handleLongPress}
        onOpenAssistant={() => setAssistantVisible(true)}
        theme={theme}
      />

      {/* Assistant Modal */}
      <AssistantModal
        visible={assistantVisible}
        onClose={() => setAssistantVisible(false)}
        theme={theme}
      />

      {/* Action Modal */}
      <Modal
        visible={actionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.actionModalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.actionModalTitle, { color: theme.text }]}>
              {selectedLabel}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                launchApp(selectedPkg);
                setActionModal(false);
              }}
            >
              <Text style={styles.actionButtonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.notification }]}
              onPress={handleUninstall}
            >
              <Text style={styles.actionButtonText}>Uninstall</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.border }]}
              onPress={() => setActionModal(false)}
            >
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  list: {
    paddingBottom: DOCK_HEIGHT + 20,
  },
  appItem: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH + 30,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  appLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DOCK_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  dockIcon: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    borderRadius: DOCK_ICON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantContainer: {
    flex: 1,
  },
  assistantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  assistantTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  botBubble: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContent: {
    width: width * 0.8,
    borderRadius: 16,
    padding: 20,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;