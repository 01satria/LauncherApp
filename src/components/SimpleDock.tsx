import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
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

  // Calculate dynamic width
  const appCount = dockApps.length;
  const avatarWidth = DOCK_ICON_SIZE + 16; // Avatar + padding
  const separatorWidth = appCount > 0 ? 20 : 0; // Separator only if there are apps
  const iconWidth = DOCK_ICON_SIZE + 8; // Icon + spacing
  const appsWidth = appCount > 0 ? (iconWidth * appCount) + 12 : 0;
  const totalWidth = avatarWidth + separatorWidth + appsWidth;
  const minWidth = avatarWidth + 32; // Avatar + padding

  const calculatedWidth = Math.max(totalWidth, minWidth);

  return (
    <>
      {/* Assistant Popup */}
      {showPopup && (
        <AssistantPopup
          onClose={() => setShowPopup(false)}
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
            {/* Avatar Assistant (Always on Left) */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setShowPopup(true)}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
                style={styles.avatar} 
              />
            </TouchableOpacity>

            {/* Separator (Only if there are dock apps) */}
            {appCount > 0 && (
              <View style={styles.separator} />
            )}

            {/* Dock Apps (Right side) */}
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
});

const styles = StyleSheet.create({
  simpleDockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10, // Higher than fade overlay
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
    justifyContent: 'center', // Center semua elemen
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