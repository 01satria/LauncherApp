import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, AppState } from 'react-native';
import DockAppItem from './DockAppItem';
import AssistantPopup from './AssistantPopup';
import { AppData } from '../types';
import { DOCK_ICON_SIZE, DEFAULT_ASSISTANT_AVATAR } from '../constants';

interface SimpleDockProps {
  dockApps: AppData[];
  onLaunchApp: (pkg: string) => void;
  onLongPressApp: (pkg: string, label: string) => void;
  onOpenSettings: () => void;
  avatarSource: string | null;
  assistantName: string;
  userName: string;
}

const SimpleDock = memo(({ 
  dockApps,
  onLaunchApp,
  onLongPressApp,
  onOpenSettings,
  avatarSource,
  assistantName,
  userName,
}: SimpleDockProps) => {
  const [showPopup, setShowPopup] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  // Background state management
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState.match(/inactive|background/)) {
        setIsActive(false);
        // Auto-close popup when going to background
        setShowPopup(false);
      } else if (nextAppState === 'active') {
        setIsActive(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Calculate dynamic width - memoized
  const appCount = dockApps.length;
  const avatarWidth = DOCK_ICON_SIZE + 16;
  const separatorWidth = appCount > 0 ? 20 : 0;
  const iconWidth = DOCK_ICON_SIZE + 8;
  const appsWidth = appCount > 0 ? (iconWidth * appCount) + 12 : 0;
  const totalWidth = avatarWidth + separatorWidth + appsWidth;
  const minWidth = avatarWidth + 32;
  const calculatedWidth = Math.max(totalWidth, minWidth);

  const handleAvatarPress = () => {
    if (!isActive) return;
    setShowPopup(true);
  };

  const handleClosePopup = () => {
    setShowPopup(false);
  };

  return (
    <>
      {/* Assistant Popup - only render when needed */}
      {showPopup && isActive && (
        <AssistantPopup
          onClose={handleClosePopup}
          userName={userName}
          assistantName={assistantName}
        />
      )}

      {/* Dock Container */}
      <View style={styles.simpleDockContainer}>
        <TouchableOpacity
          style={[styles.simpleDockCard, { width: calculatedWidth }]}
          activeOpacity={1}
          onLongPress={onOpenSettings}
          delayLongPress={500}
        >
          <View style={styles.dockContent}>
            {/* Avatar Assistant */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarPress}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
                style={styles.avatar} 
              />
            </TouchableOpacity>

            {/* Separator */}
            {appCount > 0 && (
              <View style={styles.separator} />
            )}

            {/* Dock Apps */}
            {appCount > 0 && (
              <View style={styles.dockAppsRow}>
                {dockApps.slice(0, 4).map((app: AppData) => (
                  <DockAppItem 
                    key={app.packageName} 
                    app={app} 
                    onPress={onLaunchApp}
                    onLongPress={onLongPressApp}
                  />
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
}, (prev, next) => {
  // Optimized comparison
  if (prev.dockApps.length !== next.dockApps.length) return false;
  if (prev.avatarSource !== next.avatarSource) return false;
  if (prev.userName !== next.userName) return false;
  if (prev.assistantName !== next.assistantName) return false;
  
  // Compare dock apps
  for (let i = 0; i < prev.dockApps.length; i++) {
    if (prev.dockApps[i].packageName !== next.dockApps[i].packageName) {
      return false;
    }
  }
  
  return true;
});

SimpleDock.displayName = 'SimpleDock';

const styles = StyleSheet.create({
  simpleDockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  simpleDockCard: {
    minHeight: 68,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    borderRadius: DOCK_ICON_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  separator: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 10,
  },
  dockAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default SimpleDock;