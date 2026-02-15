import React, { memo, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing, AppState, StyleSheet } from 'react-native';
import { DEFAULT_ASSISTANT_AVATAR } from '../constants';
import { getNotificationMessage } from '../utils/storage';

interface AssistantNotificationProps {
  userName: string;
  assistantName: string;
  avatarSource: string | null;
  onDismiss: () => void;
}

const AssistantNotification = memo(({ 
  userName,
  assistantName,
  avatarSource,
  onDismiss,
}: AssistantNotificationProps) => {
  const [message, setMessage] = useState("");
  const slideAnim = useRef(new Animated.Value(-250)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const updateMessage = () => {
      setMessage(getNotificationMessage(userName));
    };

    updateMessage();

    // Smooth slide in with opacity
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ]).start();

    let timer: NodeJS.Timeout | null = null;
    const startTimer = () => {
      if (timer) clearInterval(timer);
      updateMessage();
      timer = setInterval(updateMessage, 60000);
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      if (nextAppState === 'active') startTimer();
      else if (timer) clearInterval(timer);
    });

    startTimer();

    return () => {
      if (timer) clearInterval(timer);
      subscription.remove();
      slideAnim.stopAnimation();
      opacityAnim.stopAnimation();
    };
  }, [userName, slideAnim, opacityAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -250,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss();
    });
  };

  return (
    <Animated.View 
      style={[
        styles.notificationCard,
        { 
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        }
      ]}
    >
      <View style={styles.notifTopRow}>
        <View style={styles.notifAvatarContainer}>
          <Image 
            source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }} 
            style={styles.notifAvatar} 
          />
        </View>
        
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{assistantName}</Text>
          <Text style={styles.notifMessage} numberOfLines={4}>{message}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.notifOkayBtn}
        onPress={handleDismiss}
        activeOpacity={0.7}
      >
        <Text style={styles.notifOkayText}>Okay</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  notificationCard: {
    position: 'absolute',
    top: 60,
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
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notifAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  notifAvatar: {
    width: '100%',
    height: '100%',
  },
  notifContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifMessage: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
  },
  notifOkayBtn: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  notifOkayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AssistantNotification;