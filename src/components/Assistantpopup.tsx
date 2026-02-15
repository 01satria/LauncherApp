import React, { memo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { getNotificationMessage } from '../utils/storage';

interface AssistantPopupProps {
  onClose: () => void;
  userName: string;
  assistantName: string;
}

const AssistantPopup = memo(({ onClose, userName, assistantName }: AssistantPopupProps) => {
  const slideAnim = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const message = getNotificationMessage(userName);

  useEffect(() => {
    // Slide up animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ]).start();

    return () => {
      slideAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, [slideAnim, opacityAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 200,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity 
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Popup Card */}
      <Animated.View 
        style={[
          styles.popupCard,
          { 
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          }
        ]}
      >
        <View style={styles.popupHeader}>
          <Text style={styles.popupTitle}>{assistantName}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.popupMessage}>{message}</Text>

        <TouchableOpacity 
          style={styles.okayBtn}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Text style={styles.okayText}>Okay</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  popupCard: {
    position: 'absolute',
    bottom: 110, // Above dock (dock is at bottom 20 + height 68 = 88, so 110 gives space)
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  popupTitle: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 12,
  },
  closeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: -2,
  },
  popupMessage: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  okayBtn: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  okayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AssistantPopup;