import React, { memo } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  TextInput, Animated, StyleSheet,
} from 'react-native';
import { width } from '../constants';
import { AnimatedToggle } from './AssistantPopup';

interface SettingsModalProps {
  visible: boolean;
  tempName: string;
  tempAssistantName: string;
  showHidden: boolean;
  showNames: boolean;
  scaleAnim: Animated.Value;
  onClose: () => void;
  onTempNameChange: (text: string) => void;
  onTempAssistantNameChange: (text: string) => void;
  onToggleHidden: (value: boolean) => void;
  onToggleShowNames: (value: boolean) => void;
  onChangePhoto: () => void;
  onSave: () => void;
}

const SettingsModal = memo(({
  visible,
  tempName,
  tempAssistantName,
  showHidden,
  showNames,
  scaleAnim,
  onClose,
  onTempNameChange,
  onTempAssistantNameChange,
  onToggleHidden,
  onToggleShowNames,
  onChangePhoto,
  onSave,
}: SettingsModalProps) => {
  const animStyle = {
    transform: [
      { scale: scaleAnim },
      {
        translateY: scaleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [40, 0],
        }),
      },
    ],
    opacity: scaleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, animStyle]}>

          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            value={tempName}
            onChangeText={onTempNameChange}
            placeholder="Enter name..."
            placeholderTextColor="#555"
            selectionColor="#27ae60"
          />

          <Text style={styles.label}>ASSISTANT NAME</Text>
          <TextInput
            style={styles.input}
            value={tempAssistantName}
            onChangeText={onTempAssistantNameChange}
            placeholder="Enter assistant name..."
            placeholderTextColor="#555"
            selectionColor="#27ae60"
          />

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowText}>Show Hidden Apps</Text>
            <AnimatedToggle value={showHidden} onValueChange={onToggleHidden} />
          </View>

          <View style={styles.row}>
            <Text style={styles.rowText}>Show App Names</Text>
            <AnimatedToggle value={showNames} onValueChange={onToggleShowNames} />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={onChangePhoto} activeOpacity={0.8}>
            <Text style={styles.btnText}>Change Avatar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={onSave} activeOpacity={0.8}>
            <Text style={styles.btnText}>Save Changes</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: width * 0.85,
    backgroundColor: '#0d0d0d',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#222',
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 30, height: 30,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#222', borderRadius: 15,
  },
  closeText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  label: {
    color: '#555', fontSize: 11,
    letterSpacing: 1.2, marginBottom: 8, marginLeft: 2,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    paddingHorizontal: 15, paddingVertical: 13,
    borderRadius: 14, fontSize: 15, marginBottom: 18,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  divider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 14 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 2, marginBottom: 4,
  },
  rowText: { color: '#ddd', fontSize: 15 },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  btnGreen: {
    backgroundColor: '#131313',
    color: '#11a34e',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#11a34e'
  },
  btnBlue: {
    backgroundColor: '#131313',
    color: '#2980b9',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2980b9'
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
});

export default SettingsModal;