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
  opacity?: number;
}

const AppItem = memo(({ item, onPress, onLongPress, showNames, opacity = 1 }: AppItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
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
    <View style={[styles.item, { opacity }]}>
      <TouchableOpacity
        style={styles.itemTouchable}
        onPress={() => onPress(item.packageName)}
        onLongPress={() => onLongPress(item.packageName, item.label)}
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
}, (prev, next) => 
  prev.item.packageName === next.item.packageName && 
  prev.showNames === next.showNames &&
  prev.opacity === next.opacity
);

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