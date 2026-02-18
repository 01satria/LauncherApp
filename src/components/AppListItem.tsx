import React, { memo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated } from 'react-native';
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
      toValue: 0.95,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
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
        showNames ? styles.listItemWithName : styles.listItemIconOnly,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Image source={{ uri: `data:image/png;base64,${item.icon}` }} style={styles.icon} />
        {showNames && (
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 16,
  },
  listItemWithName: {
    justifyContent: 'flex-start',
  },
  listItemIconOnly: {
    justifyContent: 'center',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  label: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
});

export default AppListItem;