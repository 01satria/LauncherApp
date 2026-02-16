import React, { memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Animated,
  StyleSheet
} from 'react-native';
import { width } from '../constants';

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
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [
                { scale: scaleAnim },
                {
                  translateY: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })
                }
              ],
              opacity: scaleAnim
            }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Ur Name</Text>
          <TextInput
            style={styles.modernInput}
            value={tempName}
            onChangeText={onTempNameChange}
            placeholder="Enter name..."
            placeholderTextColor="#666"
          />

          <Text style={styles.inputLabel}>Assistant Name</Text>
          <TextInput
            style={styles.modernInput}
            value={tempAssistantName}
            onChangeText={onTempAssistantNameChange}
            placeholder="Enter assistant name..."
            placeholderTextColor="#666"
          />

          <View style={styles.rowBetween}>
            <Text style={styles.settingText}>Show Hidden Apps</Text>
            <Switch
              value={showHidden}
              onValueChange={onToggleHidden}
              thumbColor={showHidden ? "#27ae60" : "#f4f3f4"}
              trackColor={{ false: "#767577", true: "#2ecc7130" }}
            />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.settingText}>Show App Names</Text>
            <Switch
              value={showNames}
              onValueChange={onToggleShowNames}
              thumbColor={showNames ? "#27ae60" : "#f4f3f4"}
              trackColor={{ false: "#767577", true: "#2ecc7130" }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.verticalBtnGroup}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnBlue, styles.btnFull]}
              onPress={onChangePhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Change Avatar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnGreen, styles.btnFull]}
              onPress={onSave}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1
  },
  closeBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 15
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -2
  },
  inputLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  modernInput: {
    backgroundColor: '#2C2C2C',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  settingText: {
    color: '#fff',
    fontSize: 16
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
    width: '100%'
  },
  verticalBtnGroup: {
    width: '100%',
    gap: 10
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnFull: {
    width: '100%'
  },
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
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
});

export default SettingsModal;