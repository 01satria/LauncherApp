import React, { memo, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Animated,
  StyleSheet, BackHandler, PanResponder, GestureResponderEvent,
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
  visible, selectedLabel, actionType, isDocked, dockCount,
  scaleAnim, onClose, onPinToDock, onHideAction, onUninstall,
}: AppActionModalProps) => {

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_: GestureResponderEvent, gs) => gs.dy > 0,
    onPanResponderMove: (_: GestureResponderEvent, gs) => {
      if (gs.dy > 0) dragY.setValue(gs.dy);
    },
    onPanResponderRelease: (_: GestureResponderEvent, gs) => {
      if (gs.dy > 80 || gs.vy > 0.5) {
        // Drag cukup jauh atau cepat → close
        dragY.setValue(0);
        onClose();
      } else {
        // Snap kembali ke posisi semula
        Animated.spring(dragY, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragY, {
        toValue: 0,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    },
  })).current;

  const showPinButton = isDocked || dockCount < 4;

  const animStyle = {
    transform: [
      {
        translateY: Animated.add(
          scaleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [300, 0],
          }),
          dragY,
        ),
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
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, animStyle]}
          onStartShouldSetResponder={() => true}
        >
          {/* Drag handle */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
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
                  {isDocked ? 'Unpin from Dock' : 'Pin to Dock'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnGreen]}
              onPress={onHideAction}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {actionType === 'unhide' ? 'Unhide' : 'Hide'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnRed]}
              onPress={onUninstall}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Uninstall</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay:        { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end' },
  sheet:          { backgroundColor:'#1c1c1e', borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:34 },
  handleContainer:{ alignItems:'center', paddingTop:10, paddingBottom:8 },
  handle:         { width:36, height:4, borderRadius:2, backgroundColor:'#3a3a3c' },
  header:         { paddingHorizontal:20, paddingTop:6, paddingBottom:16, borderBottomWidth:1, borderBottomColor:'#2c2c2e', alignItems:'center' },
  title:          { fontSize:17, fontWeight:'600', color:'#fff', textAlign:'center' },
  subtitle:       { fontSize:13, color:'#8e8e93', marginTop:4, textAlign:'center' },
  btnGroup:       { paddingHorizontal:16, paddingTop:16, gap:8 },
  actionBtn:      { paddingVertical:15, borderRadius:12, alignItems:'center', justifyContent:'center', backgroundColor:'#2c2c2e' },
  btnGreen:       { backgroundColor:'#1c3a28' },
  btnRed:         { backgroundColor:'#3a1c1c' },
  btnPurple:      { backgroundColor:'#2a1c3a' },
  btnOrange:      { backgroundColor:'#3a2a1c' },
  actionBtnText:  { color:'#fff', fontSize:15, fontWeight:'500' },
});

export default AppActionModal;