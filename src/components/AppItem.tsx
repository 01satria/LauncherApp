import React, { memo, useRef, useCallback, useEffect } from 'react';
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

const AppItem = memo(({ item, onPress, onLongPress, showNames }: AppItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isPressed = useRef(false);

  const handlePressIn = useCallback(() => {
    isPressed.current = true;
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    isPressed.current = false;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    // Force reset scale before launching app
    scaleAnim.setValue(1);
    onPress(item.packageName);
  }, [scaleAnim, onPress, item.packageName]);

  const handleLongPress = useCallback(() => {
    // Force reset scale when opening modal
    scaleAnim.setValue(1);
    onLongPress(item.packageName, item.label);
  }, [scaleAnim, onLongPress, item.packageName, item.label]);

  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
      // Force reset on unmount
      scaleAnim.setValue(1);
    };
  }, [scaleAnim]);

  return (
    <View style={styles.item}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        delayLongPress={300}
      >
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <SafeAppIcon iconUri={item.icon} />
        </Animated.View>
        {showNames && <Text style={styles.label} numberOfLines={1}>{item.label}</Text>}
      </TouchableOpacity>
    </View>
  );
}, (prev, next) => prev.item.packageName === next.item.packageName && prev.showNames === next.showNames);

const styles = StyleSheet.create({
  item: { 
    width: ITEM_WIDTH, 
    height: 90, 
    alignItems: 'center', 
    marginBottom: 8,
    justifyContent: 'center',
  },
  itemTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: { 
    width: ICON_SIZE, 
    height: ICON_SIZE, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  label: { 
    color: '#eee', 
    fontSize: 11, 
    textAlign: 'center', 
    marginHorizontal: 4, 
    textShadowColor: 'rgba(0,0,0,0.8)', 
    textShadowRadius: 3 
  },
});

export default AppItem;