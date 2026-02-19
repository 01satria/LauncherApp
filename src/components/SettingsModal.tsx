import React, { memo, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  Animated, StyleSheet, BackHandler, PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { AnimatedToggle } from './AssistantPopup';

interface SettingsModalProps {
  visible: boolean;
  tempName: string;
  tempAssistantName: string;
  showHidden: boolean;
  showNames: boolean;
  layoutMode: 'grid' | 'list';
  scaleAnim: Animated.Value;
  onClose: () => void;
  onTempNameChange: (text: string) => void;
  onTempAssistantNameChange: (text: string) => void;
  onToggleHidden: (value: boolean) => void;
  onToggleShowNames: (value: boolean) => void;
  onLayoutModeChange: (mode: 'grid' | 'list') => void;
  onChangePhoto: () => void;
  onSave: () => void;
}

const SettingsModal = memo(({
  visible, tempName, tempAssistantName, showHidden, showNames,
  layoutMode, scaleAnim, onClose, onTempNameChange,
  onTempAssistantNameChange, onToggleHidden, onToggleShowNames,
  onLayoutModeChange, onChangePhoto, onSave,
}: SettingsModalProps) => {

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
        Animated.timing(dragY, {
          toValue: 500,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          dragY.setValue(0);
          onClose();
        });
      } else {
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
            <Text style={styles.title}>Settings</Text>
          </View>

          {/* User Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={tempName}
              onChangeText={onTempNameChange}
              placeholder="Enter your name"
              placeholderTextColor="#555"
            />
          </View>

          {/* Assistant Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Assistant Name</Text>
            <TextInput
              style={styles.input}
              value={tempAssistantName}
              onChangeText={onTempAssistantNameChange}
              placeholder="Enter assistant name"
              placeholderTextColor="#555"
            />
          </View>

          {/* Layout Mode */}
          <View style={styles.section}>
            <Text style={styles.label}>Layout Mode</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[styles.modeBtn, styles.modeBtnLeft, layoutMode === 'grid' && styles.modeBtnActive]}
                onPress={() => onLayoutModeChange('grid')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, layoutMode === 'grid' && styles.modeBtnTextActive]}>
                  ⊞  Grid
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, styles.modeBtnRight, layoutMode === 'list' && styles.modeBtnActive]}
                onPress={() => onLayoutModeChange('list')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, layoutMode === 'list' && styles.modeBtnTextActive]}>
                  ☰  List
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Show Hidden Apps */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Hidden Apps</Text>
            <AnimatedToggle value={showHidden} onValueChange={onToggleHidden} />
          </View>

          {/* Show App Names */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show App Names</Text>
            <AnimatedToggle value={showNames} onValueChange={onToggleShowNames} />
          </View>

          {/* Change Photo */}
          <TouchableOpacity style={styles.photoBtn} onPress={onChangePhoto} activeOpacity={0.7}>
            <Text style={styles.photoBtnText}>Change Assistant Photo</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.7}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>

        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0d0d0d', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '88%' },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3a3a3a' },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#aaa', marginBottom: 8 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  modeSelector: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeBtnLeft: { marginRight: 2 },
  modeBtnRight: { marginLeft: 2 },
  modeBtnActive: { backgroundColor: '#1a1a1a', margin: 12, borderColor: '#2ed373', borderWidth: 1, borderStyle: 'solid' },
  modeBtnText: { fontSize: 15, fontWeight: '600', color: '#666' },
  modeBtnTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  toggleLabel: { fontSize: 16, color: '#fff' },
  photoBtn: { marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2ed373', borderStyle: 'dashed', alignItems: 'center' },
  photoBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  saveBtn: { marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2ed373', borderStyle: 'solid', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});

export default SettingsModal;