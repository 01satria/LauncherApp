import React, { memo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import SafeAppIcon from './SafeAppIcon';
import { AppData } from '../types';

interface AppListItemProps {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  showNames: boolean;
}

const AppListItem = memo(({ item, onPress, onLongPress, showNames }: AppListItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onPress(item.packageName)}
      onLongPress={() => onLongPress(item.packageName, item.label)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={400}
    >
      <Animated.View style={[
        styles.listItem,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        {showNames ? (
          // WITH NAMES: Icon + Text (both centered together)
          <View style={styles.contentWithName}>
            <SafeAppIcon iconUri={item.icon} size={52} />
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ) : (
          // WITHOUT NAMES: Icon only (centered)
          <View style={styles.contentIconOnly}>
            <SafeAppIcon iconUri={item.icon} size={52} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginVertical: 2,
  },
  // WITH NAMES: horizontal layout, centered
  contentWithName: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  // WITHOUT NAMES: icon centered
  contentIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  label: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});

export default AppListItem;