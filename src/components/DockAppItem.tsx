import React, { memo, useRef, useCallback, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import SafeAppIcon from './SafeAppIcon';
import { AppData } from '../types';
import { DOCK_ICON_SIZE } from '../constants';

interface DockAppItemProps {
  app: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}

const DockAppItem = memo(({ app, onPress, onLongPress }: DockAppItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.8,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [scaleAnim]);

  return (
    <TouchableOpacity
      style={styles.dockAppItem}
      onPress={() => onPress(app.packageName)}
      onLongPress={() => onLongPress(app.packageName, app.label)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      delayLongPress={300}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <SafeAppIcon iconUri={app.icon} size={DOCK_ICON_SIZE} />
      </Animated.View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.app.packageName === next.app.packageName);

const styles = StyleSheet.create({
  dockAppItem: {
    width: DOCK_ICON_SIZE,
    height: DOCK_ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DockAppItem;