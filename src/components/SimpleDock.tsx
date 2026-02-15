import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DockAppItem from './DockAppItem';
import { AppData } from '../types';
import { DOCK_ICON_SIZE } from '../constants';

interface SimpleDockProps {
  dockApps: AppData[];
  onLaunchApp: (pkg: string) => void;
  onLongPressApp: (pkg: string, label: string) => void;
  onOpenSettings: () => void;
}

const SimpleDock = memo(({ 
  dockApps,
  onLaunchApp,
  onLongPressApp,
  onOpenSettings,
}: SimpleDockProps) => {
  // Calculate dynamic width based on app count
  const appCount = dockApps.length;
  const minWidth = 150;
  const iconWidth = DOCK_ICON_SIZE + 8;
  const padding = 24;
  const calculatedWidth = appCount > 0 ? (iconWidth * appCount) + padding : minWidth;

  return (
    <View style={styles.simpleDockContainer}>
      <TouchableOpacity
        style={[styles.simpleDockCard, { width: calculatedWidth }]}
        activeOpacity={1}
        onLongPress={onOpenSettings}
        delayLongPress={500}
      >
        {dockApps.length === 0 ? (
          <View style={styles.emptyDockContainer}>
            <Text style={styles.emptyDockText}>Long press any app to pin</Text>
          </View>
        ) : (
          <View style={styles.dockAppsRow}>
            {dockApps.map((app: AppData) => (
              <DockAppItem 
                key={app.packageName} 
                app={app} 
                onPress={onLaunchApp}
                onLongPress={onLongPressApp}
              />
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  simpleDockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  simpleDockCard: {
    height: 68,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyDockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyDockText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dockAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flex: 1,
  },
});

export default SimpleDock;