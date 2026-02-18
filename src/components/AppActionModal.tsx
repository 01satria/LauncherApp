import React, { memo } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  Animated,
  StyleSheet 
} from 'react-native';
import { width } from '../constants';

interface AppActionModalProps {
  visible: boolean;
  selectedLabel: string;
  actionType: 'hide' | 'unhide';
  isDocked: boolean;
  dockCount: number;  // Current number of apps in dock
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
  // Hide "Pin to Dock" button if dock is full (4 apps) and app is not already docked
  const showPinButton = isDocked || dockCount < 4;
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
            <Text style={styles.modalTitle} numberOfLines={1}>{selectedLabel}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Select an action for this app:</Text>

          <View style={styles.verticalBtnGroup}>
            {/* Only show Pin/Unpin button if dock not full OR app already docked */}
            {showPinButton && (
              <TouchableOpacity 
                style={[styles.actionBtn, isDocked ? styles.btnOrange : styles.btnPurple, styles.btnFull]} 
                onPress={onPinToDock} 
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {isDocked ? '📌 Unpin from Dock' : '📌 Pin to Dock'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.actionBtn, styles.btnGreen, styles.btnFull]} 
              onPress={onHideAction} 
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {actionType === 'unhide' ? '👁️ Unhide' : '🙈 Hide'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.btnRed, styles.btnFull]} 
              onPress={onUninstall} 
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>🗑️ Uninstall</Text>
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
  modalSubtitle: { 
    color: '#aaa', 
    fontSize: 14, 
    marginBottom: 25 
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
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#11a34e'
  },
  btnRed: {
    backgroundColor: '#131313',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#c0392b'
  },
  btnPurple: {
    backgroundColor: '#131313',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#8e44ad'
  },
  btnOrange: {
    backgroundColor: '#131313',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e67e22'
  },
  actionBtnText: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: 'bold', 
    letterSpacing: 0.5 
  },
});

export default AppActionModal;