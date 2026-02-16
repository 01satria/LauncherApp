import React, { memo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, BackHandler } from 'react-native';
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
  const isClosing = useRef(false);

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

    // Android back button handler
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => {
      slideAnim.stopAnimation();
      opacityAnim.stopAnimation();
      backHandler.remove();
    };
  }, [slideAnim, opacityAnim]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;

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
  }, [slideAnim, opacityAnim, onClose]);

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
}, (prev, next) => {
  // Prevent unnecessary re-renders
  return prev.userName === next.userName && prev.assistantName === next.assistantName;
});

AssistantPopup.displayName = 'AssistantPopup';

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
    bottom: 110,
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
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
    backgroundColor: '#131313',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  okayText: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AssistantPopup;