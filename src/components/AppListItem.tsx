import React, { memo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import SafeAppIcon from './SafeAppIcon';
import { AppData } from '../types';

interface AppListItemProps {
  item: AppData;
  onPress: (pkg: string) => void;
  onLongPress: (pkg: string, label: string) => void;
  showNames: boolean;
}

const SPRING_IN  = { toValue: 0.96, friction: 6, tension: 120, useNativeDriver: true };
const SPRING_OUT = { toValue: 1,    friction: 6, tension: 120, useNativeDriver: true };

const AppListItem = memo(({ item, onPress, onLongPress, showNames }: AppListItemProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn  = useCallback(() => Animated.spring(scaleAnim, SPRING_IN).start(),  []);
  const handlePressOut = useCallback(() => Animated.spring(scaleAnim, SPRING_OUT).start(), []);
  const handlePress    = useCallback(() => onPress(item.packageName),    [onPress, item.packageName]);
  const handleLongPress= useCallback(() => onLongPress(item.packageName, item.label), [onLongPress, item.packageName, item.label]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={400}
    >
      <Animated.View style={[styles.listItem, { transform: [{ scale: scaleAnim }] }]}>
        {showNames ? (
          <View style={styles.contentWithName}>
            <SafeAppIcon iconUri={item.icon} size={52} />
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </View>
        ) : (
          <View style={styles.contentIconOnly}>
            <SafeAppIcon iconUri={item.icon} size={52} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  listItem:        { paddingVertical: 8, paddingHorizontal: 20, marginVertical: 2 },
  contentWithName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 8 },
  contentIconOnly: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  label:           { marginLeft: 16, fontSize: 16, fontWeight: '500', color: '#fff' },
});

export default AppListItem;
