import React, { memo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import SafeAppIcon from './SafeAppIcon';
import { AppData } from '../types';
import { ITEM_WIDTH, ICON_SIZE } from '../constants';

interface AppItemProps {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  showNames: boolean;
}

// Shared Animated config — defined once outside component, not per render
const SPRING_IN  = { toValue: 0.85, friction: 5, tension: 100, useNativeDriver: true };
const SPRING_OUT = { toValue: 1,    friction: 5, tension: 100, useNativeDriver: true };

const AppItem = memo(({ item, onPress, onLongPress, showNames }: AppItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn  = useCallback(() => Animated.spring(scaleAnim, SPRING_IN).start(),  []);
  const handlePressOut = useCallback(() => Animated.spring(scaleAnim, SPRING_OUT).start(), []);

  const handlePress = useCallback(() => {
    scaleAnim.setValue(1);
    onPress(item.packageName);
  }, [onPress, item.packageName]);

  const handleLongPress = useCallback(() => {
    scaleAnim.setValue(1);
    onLongPress(item.packageName, item.label);
  }, [onLongPress, item.packageName, item.label]);

  return (
    <View style={styles.item}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={300}
      >
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <SafeAppIcon iconUri={item.icon} />
        </Animated.View>
        {showNames && (
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}, (prev, next) =>
  prev.item.packageName === next.item.packageName && prev.showNames === next.showNames
);

const styles = StyleSheet.create({
  item:     { width: ITEM_WIDTH, height: 90, alignItems: 'center', marginBottom: 8, justifyContent: 'center' },
  touchable:{ alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: ICON_SIZE, height: ICON_SIZE, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  label:    { color: '#eee', fontSize: 11, textAlign: 'center', marginHorizontal: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
});

export default AppItem;
