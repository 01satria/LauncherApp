import React, { memo, useRef, useCallback } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import SafeAppIcon from './SafeAppIcon';
import { AppData } from '../types';
import { DOCK_ICON_SIZE } from '../constants';

interface DockAppItemProps {
  app: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
}

const SPRING_IN  = { toValue: 0.8, friction: 5, tension: 100, useNativeDriver: true };
const SPRING_OUT = { toValue: 1,   friction: 5, tension: 100, useNativeDriver: true };

const DockAppItem = memo(({ app, onPress, onLongPress }: DockAppItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn  = useCallback(() => Animated.spring(scaleAnim, SPRING_IN).start(),  []);
  const handlePressOut = useCallback(() => Animated.spring(scaleAnim, SPRING_OUT).start(), []);

  const handlePress = useCallback(() => {
    scaleAnim.setValue(1);
    onPress(app.packageName);
  }, [onPress, app.packageName]);

  const handleLongPress = useCallback(() => {
    scaleAnim.setValue(1);
    onLongPress(app.packageName, app.label);
  }, [onLongPress, app.packageName, app.label]);

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={handlePress}
      onLongPress={handleLongPress}
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
  wrap: { width: DOCK_ICON_SIZE, height: DOCK_ICON_SIZE, justifyContent: 'center', alignItems: 'center' },
});

export default DockAppItem;
