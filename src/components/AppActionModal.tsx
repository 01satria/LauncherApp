import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  BackHandler,
} from 'react-native';

interface AppActionModalProps {
  visible: boolean;
  selectedLabel: string;
  actionType: 'hide' | 'unhide';
  isDocked: boolean;
  dockCount: number;
  scaleAnim: Animated.Value;
  onClose: () => void;
  onPinToDock: () => void;
  onHideAction: () => void;
  onUninstall: () => void;
}

const AppActionModal = memo(({
  visible,
  selectedLabel,
  actionType,
  isDocked,
  dockCount,
  scaleAnim,
  onClose,
  onPinToDock,
  onHideAction,
  onUninstall,
}: AppActionModalProps) => {

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const showPinButton = isDocked || dockCount < 4;

  const animStyle = {
    transform: [
      {
        translateY: scaleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [300, 0],
        }),
      },
    ],
    opacity: scaleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[styles.sheet, animStyle]}
          onStartShouldSetResponder={() => true}
        >
          {/* iOS-style drag handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header — nama app, tanpa tombol silang */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{selectedLabel}</Text>
            <Text style={styles.subtitle}>Select an action for this app</Text>
          </View>

          {/* Buttons */}
          <View style={styles.btnGroup}>
            {showPinButton && (
              <TouchableOpacity
                style={[styles.actionBtn, isDocked ? styles.btnOrange : styles.btnPurple]}
                onPress={onPinToDock}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {isDocked ? '📌 Unpin from Dock' : '📌 Pin to Dock'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnGreen]}
              onPress={onHideAction}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {actionType === 'unhide' ? '👁️ Unhide' : '🙈 Hide'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnRed]}
              onPress={onUninstall}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>🗑️ Uninstall</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    textAlign: 'center',
  },
  btnGroup: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    backgroundColor: '#131313',
  },
  btnGreen: { borderColor: '#11a34e' },
  btnRed: { borderColor: '#c0392b' },
  btnPurple: { borderColor: '#8e44ad' },
  btnOrange: { borderColor: '#e67e22' },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default AppActionModal;