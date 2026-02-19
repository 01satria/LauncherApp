import React, { memo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import DockAppItem from './DockAppItem';
import DashboardPopup from './DashboardPopup';
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
  const [showDashboard, setShowDashboard] = useState(false);

  const handleOpenDashboard = () => {
    setShowDashboard(true);
  };

  // Calculate dynamic width
  const appCount = dockApps.length;
  const avatarWidth = DOCK_ICON_SIZE + 16;
  const separatorWidth = appCount > 0 ? 20 : 0;
  const iconWidth = DOCK_ICON_SIZE + 8;
  const appsWidth = appCount > 0 ? (iconWidth * appCount) + 12 : 0;
  const totalWidth = avatarWidth + separatorWidth + appsWidth;
  const minWidth = avatarWidth + 32;
  const calculatedWidth = Math.max(totalWidth, minWidth);

  return (
    <>
      {showDashboard && (
        <DashboardPopup
          onClose={() => setShowDashboard(false)}
          userName={userName}
          assistantName={assistantName}
          avatarSource={avatarSource}
        />
      )}

      <View style={styles.simpleDockContainer}>
        <TouchableOpacity
          style={[styles.simpleDockCard, { width: calculatedWidth }]}
          activeOpacity={1}
          onLongPress={onOpenSettings}
          delayLongPress={500}
        >
          <View style={styles.dockContent}>

            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleOpenDashboard}
              activeOpacity={0.7}
            >
                <View style={styles.avatarCircle}>
                {avatarSource ? (
                  <Image source={{ uri: avatarSource }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderTxt}>👤</Text>
                  </View>
                )}
              </View>

            </TouchableOpacity>

            {appCount > 0 && <View style={styles.separator} />}

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
    zIndex: 10,
  },
  simpleDockCard: {
    minHeight: 68,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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

  avatarWrapper: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    position: 'relative', // Anchor untuk badge
  },

  avatarCircle: {
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
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  avatarPlaceholderTxt: { fontSize: 22 },
});

export default SimpleDock;