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
  const isAnimating = useRef(false);

  const handlePressIn = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
    });
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
    });
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    onPress(item.packageName);
  }, [item.packageName, onPress]);

  const handleLongPressCallback = useCallback(() => {
    onLongPress(item.packageName, item.label);
  }, [item.packageName, item.label, onLongPress]);

  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [scaleAnim]);

  return (
    <View style={styles.item}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={handlePress}
        onLongPress={handleLongPressCallback}
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
}, (prev, next) => {
  // Optimized comparison
  return prev.item.packageName === next.item.packageName && 
         prev.showNames === next.showNames &&
         prev.item.icon === next.item.icon;
});

AppItem.displayName = 'AppItem';

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