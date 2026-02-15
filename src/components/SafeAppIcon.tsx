import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Image, Animated, Easing } from 'react-native';
import { ICON_SIZE } from '../constants';

interface SafeAppIconProps {
  iconUri: string;
  size?: number;
}

const SafeAppIcon = memo(({ iconUri, size = ICON_SIZE }: SafeAppIconProps) => {
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const uri = iconUri.startsWith('file://') ? iconUri : `file://${iconUri}`;

  useEffect(() => {
    return () => {
      fadeAnim.stopAnimation();
    };
  }, [fadeAnim]);

  const handleLoad = useCallback(() => {
    setError(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const borderRadius = size * 0.22;

  if (error) {
    return <View style={{ width: size, height: size, borderRadius }} />;
  }

  return (
    <Animated.View style={{ 
      width: size, 
      height: size, 
      borderRadius,
      overflow: 'hidden',
      opacity: fadeAnim,
    }}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        fadeDuration={0}
        onError={() => setError(true)}
        onLoad={handleLoad}
      />
    </Animated.View>
  );
}, (prev, next) => prev.iconUri === next.iconUri && prev.size === next.size);

export default SafeAppIcon;