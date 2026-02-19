import React, { memo, useState, useEffect } from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import DockAppItem from './DockAppItem';
import DashboardPopup from './DashboardPopup';
import { hasUnreadMessages, setBadgeListener } from './AssistantPopup';
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
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    setHasUnread(hasUnreadMessages());
    setBadgeListener(() => { setHasUnread(true); });
    const interval = setInterval(() => { setHasUnread(hasUnreadMessages()); }, 10_000);
    return () => { clearInterval(interval); setBadgeListener(null); };
  }, []);

  const handleOpenDashboard = () => {
    setShowDashboard(true);
    setHasUnread(false);
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

            {/* Avatar — pakai wrapper luar agar badge tidak terpotong overflow */}
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleOpenDashboard}
              activeOpacity={0.7}
            >
              {/* Lingkaran avatar dengan overflow hidden — hanya untuk gambar */}
              <View style={styles.avatarCircle}>
                <Image 
                  source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
                  style={styles.avatar} 
                />
              </View>

              {/* Badge di luar avatarCircle agar tidak terpotong */}
              {hasUnread && (
                <View style={styles.unreadBadge} />
              )}
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

  // Wrapper luar: TANPA overflow hidden, agar badge bisa muncul di luar lingkaran
  avatarWrapper: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    position: 'relative', // Anchor untuk badge
  },

  // Lingkaran avatar: overflow hidden HANYA untuk memotong gambar
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

  // Badge di pojok kanan atas avatarWrapper (bukan avatarCircle)
  unreadBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#ff3b30',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.92)',
    zIndex: 1,
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