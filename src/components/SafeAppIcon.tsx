import React, { useState, useCallback, memo } from 'react';
import { View, Image } from 'react-native';
import { ICON_SIZE } from '../constants';

// NO Animated.Value per icon — saves ~100+ Animated nodes for a full app list.
// Simple opacity toggle via state is invisible to users at 150ms load.
interface SafeAppIconProps {
  iconUri: string;
  size?: number;
}

const SafeAppIcon = memo(({ iconUri, size = ICON_SIZE }: SafeAppIconProps) => {
  const [visible, setVisible] = useState(false);
  const [error,   setError]   = useState(false);

  const uri = iconUri.startsWith('file://') ? iconUri : `file://${iconUri}`;
  const borderRadius = size * 0.22;

  const handleLoad  = useCallback(() => setVisible(true),  []);
  const handleError = useCallback(() => setError(true),    []);

  if (error) {
    return <View style={{ width: size, height: size, borderRadius }} />;
  }

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius,
        opacity: visible ? 1 : 0,
      }}
      fadeDuration={0}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}, (prev, next) => prev.iconUri === next.iconUri && prev.size === next.size);

export default SafeAppIcon;
