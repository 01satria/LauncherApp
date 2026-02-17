import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Easing, TextInput, FlatList, KeyboardAvoidingView,
  Platform, PanResponder, GestureResponderEvent, Image,
} from 'react-native';
import { getNotificationMessage } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  text: string;
  from: 'user' | 'assistant';
  time: string;
}

interface AssistantPopupProps {
  onClose: () => void;
  userName: string;
  assistantName: string;
  avatarSource?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CHAT_KEY = 'assistant_chat_v1';
const now = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const makeId = () => `${Date.now()}-${Math.random()}`;

// Save / load chat from a module-level variable (avoids AsyncStorage dependency)
let _chatCache: Message[] | null = null;
let _cacheHour: number = -1;

const loadChat = (autoMsg: Message): Message[] => {
  const currentHour = new Date().getHours();
  // Reset at 01:00
  if (currentHour === 1 && _cacheHour !== 1) {
    _chatCache = null;
  }
  _cacheHour = currentHour;
  if (_chatCache === null) {
    _chatCache = [autoMsg];
  }
  return _chatCache;
};

const saveChat = (msgs: Message[]) => {
  _chatCache = msgs;
};

// Simple AI reply logic
const getReply = (input: string, userName: string, assistantName: string): string => {
  const t = input.trim().toLowerCase();

  if (/^(hai|hi|halo|hello|hey|sup|yo)\b/.test(t))
    return `Hai ${userName}! 👋 Ada yang bisa aku bantu?`;
  if (/apa kabar|how are you|gimana kabar/.test(t))
    return `Aku baik-baik aja kok, ${userName}! 😊 Kamu sendiri gimana?`;
  if (/nama(mu| kamu| lo)/.test(t) || /who are you|siapa kamu/.test(t))
    return `Aku ${assistantName}, asisten pribadimu! 🤖`;
  if (/makasih|thanks|thank you|thx|tengkyu/.test(t))
    return `Sama-sama, ${userName}! 😊`;
  if (/bisa apa|apa yang kamu bisa|what can you do/.test(t))
    return `Aku bisa nemenin ngobrol, kasih tau waktu, dan ngingetin kamu buat istirahat. 💬`;
  if (/jam berapa|what time/.test(t))
    return `Sekarang jam ${now()} nih, ${userName}! ⏰`;
  if (/bored|bosan|gabut/.test(t))
    return `Hehe, coba buka apps favoritmu deh! 📱 Atau ngobrol sama aku aja 😄`;
  if (/capek|lelah|tired/.test(t))
    return `Istirahat dulu yuk, ${userName}! 😴 Kesehatan penting loh.`;
  if (/lapar|makan|hungry|food/.test(t))
    return `Wah lapar? Jangan lupa makan yang bener ya ${userName}! 🍔`;
  if (/bye|dadah|sampai jumpa|see you/.test(t))
    return `Dadah ${userName}! 👋 Sampai ketemu lagi~`;
  if (/oke|ok|sip|siap|got it/.test(t))
    return `Oke siap! 👍`;
  if (/tolong|help|bantuan/.test(t))
    return `Aku di sini kok ${userName}! Cerita aja, aku dengerin. 😊`;

  // Default
  const defaults = [
    `Hmm, menarik! Cerita lebih lanjut dong, ${userName}. 😊`,
    `Aku belum ngerti yang itu, tapi aku selalu ada buat kamu! 🤗`,
    `Oh gitu ya! Terus? 👀`,
    `Seru juga! Ada lagi yang mau diceritain, ${userName}? 😄`,
    `Wah, aku perlu belajar lebih banyak nih! 😅`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
};

// ─── Animated Toggle with Drag Support ───────────────────────────────────────
interface ToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}

export const AnimatedToggle = memo(({ value, onValueChange, activeColor = '#27ae60' }: ToggleProps) => {
  const TRACK_W = 50;
  const THUMB   = 24;
  const MAX_X   = TRACK_W - THUMB - 4; // 22

  const posX   = useRef(new Animated.Value(value ? MAX_X : 2)).current;
  const bgAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const valueRef = useRef(value);

  // Sync when parent changes value
  useEffect(() => {
    valueRef.current = value;
    Animated.parallel([
      Animated.spring(posX,   { toValue: value ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
      Animated.spring(bgAnim, { toValue: value ? 1 : 0,     friction: 6, tension: 120, useNativeDriver: false }),
    ]).start();
  }, [value]);

  // PanResponder for drag-to-toggle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        posX.stopAnimation();
        bgAnim.stopAnimation();
      },

      onPanResponderMove: (_: GestureResponderEvent, gs) => {
        // Follow finger clamped between 2 and MAX_X
        const base = valueRef.current ? MAX_X : 2;
        const next = Math.min(MAX_X, Math.max(2, base + gs.dx));
        posX.setValue(next);
        bgAnim.setValue((next - 2) / MAX_X);
      },

      onPanResponderRelease: (_: GestureResponderEvent, gs) => {
        const isTap = Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5;

        if (isTap) {
          // Single tap → just toggle
          onValueChange(!valueRef.current);
          return;
        }

        // Drag → decide by velocity or final position
        const threshold = MAX_X / 2;
        const base = valueRef.current ? MAX_X : 2;
        const nextPos = base + gs.dx;
        const shouldBeOn = gs.vx > 0.3
          ? true
          : gs.vx < -0.3
          ? false
          : nextPos > threshold + 2;

        if (shouldBeOn !== valueRef.current) {
          onValueChange(shouldBeOn);
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(posX,   { toValue: valueRef.current ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
            Animated.spring(bgAnim, { toValue: valueRef.current ? 1 : 0,     friction: 6, tension: 120, useNativeDriver: false }),
          ]).start();
        }
      },

      onPanResponderTerminate: () => {
        // Snap back on cancel
        Animated.parallel([
          Animated.spring(posX,   { toValue: valueRef.current ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
          Animated.spring(bgAnim, { toValue: valueRef.current ? 1 : 0,     friction: 6, tension: 120, useNativeDriver: false }),
        ]).start();
      },
    })
  ).current;

  const trackColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#3a3a3a', activeColor],
  });

  return (
    <Animated.View style={[toggleStyles.track, { backgroundColor: trackColor }]} {...panResponder.panHandlers}>
      <Animated.View style={[toggleStyles.thumb, { transform: [{ translateX: posX }] }]} />
    </Animated.View>
  );
});

const toggleStyles = StyleSheet.create({
  track: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    position: 'absolute',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const Bubble = memo(({ msg, assistantName, avatarSource }: { msg: Message; assistantName: string; avatarSource?: string }) => {
  const isUser = msg.from === 'user';
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
    ]).start();
    return () => { fadeIn.stopAnimation(); slideY.stopAnimation(); };
  }, []);

  return (
    <Animated.View
      style={[
        bubbleStyles.row,
        isUser ? bubbleStyles.rowRight : bubbleStyles.rowLeft,
        { opacity: fadeIn, transform: [{ translateY: slideY }] },
      ]}
    >
      {!isUser && (
        <View style={bubbleStyles.avatar}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={bubbleStyles.avatarImg} />
          ) : (
            <Text style={bubbleStyles.avatarText}>🤖</Text>
          )}
        </View>
      )}
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.assistantBubble]}>
        {!isUser && <Text style={bubbleStyles.sender}>{assistantName}</Text>}
        <Text style={bubbleStyles.text}>{msg.text}</Text>
        <Text style={bubbleStyles.time}>{msg.time}</Text>
      </View>
    </Animated.View>
  );
});

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 12, alignItems: 'flex-end' },
  rowLeft:  { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
    marginRight: 6, marginBottom: 2,
    overflow: 'hidden',
  },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  avatarText: { fontSize: 14 },
  bubble: {
    maxWidth: '75%', borderRadius: 16, padding: 10,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#27ae60',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1e1e1e',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sender: { color: '#27ae60', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  text: { color: '#fff', fontSize: 14, lineHeight: 20 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});

// ─── AssistantPopup (Chat UI) ─────────────────────────────────────────────────
const AssistantPopup = memo(({ onClose, userName, assistantName, avatarSource }: AssistantPopupProps) => {
  const slideAnim   = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const flatRef     = useRef<FlatList>(null);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Init messages
  const autoMsg: Message = {
    id: 'auto',
    text: getNotificationMessage(userName),
    from: 'assistant',
    time: now(),
  };
  const [messages, setMessages] = useState<Message[]>(() => loadChat(autoMsg));

  // Hourly reset check (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const h = new Date().getHours();
      if (h === 1 && _cacheHour !== 1) {
        const fresh: Message[] = [{
          id: makeId(),
          text: getNotificationMessage(userName),
          from: 'assistant',
          time: now(),
        }];
        _chatCache = fresh;
        _cacheHour = 1;
        setMessages(fresh);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [userName]);

  // Slide-up open animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
    ]).start();
    return () => { slideAnim.stopAnimation(); opacityAnim.stopAnimation(); };
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 300, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,   duration: 250, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: makeId(), text, from: 'user', time: now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      saveChat(next);
      return next;
    });
    setInput('');
    scrollToEnd();

    // Assistant typing indicator → reply
    setIsTyping(true);
    setTimeout(() => {
      const reply: Message = {
        id: makeId(),
        text: getReply(text, userName, assistantName),
        from: 'assistant',
        time: now(),
      };
      setIsTyping(false);
      setMessages(prev => {
        const next = [...prev, reply];
        saveChat(next);
        return next;
      });
      scrollToEnd();
    }, 700 + Math.random() * 500);
  }, [input, userName, assistantName, scrollToEnd]);

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

      {/* Chat Card */}
      <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.onlineDot} />
            )}
            <View>
              <Text style={styles.headerName}>{assistantName}</Text>
              <Text style={styles.headerOnline}>● Online</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <Bubble msg={item} assistantName={assistantName} avatarSource={avatarSource} />}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          ListFooterComponent={
            isTyping ? (
              <View style={[bubbleStyles.row, bubbleStyles.rowLeft]}>
                <View style={bubbleStyles.avatar}>
                  {avatarSource ? (
                    <Image source={{ uri: avatarSource }} style={bubbleStyles.avatarImg} />
                  ) : (
                    <Text style={bubbleStyles.avatarText}>🤖</Text>
                  )}
                </View>
                <View style={[bubbleStyles.bubble, bubbleStyles.assistantBubble]}>
                  <Text style={{ color: '#555', fontSize: 20, letterSpacing: 4 }}>•••</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={`Message ${assistantName}...`}
              placeholderTextColor="#444"
              selectionColor="#27ae60"
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              activeOpacity={0.7}
              disabled={!input.trim()}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 998,
  },
  card: {
    position: 'absolute',
    bottom: 110, left: 12, right: 12,
    height: 420,
    backgroundColor: '#0d0d0d',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
    elevation: 16,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#111',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#27ae60',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#27ae60' },
  headerName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerOnline: { color: '#27ae60', fontSize: 10, marginTop: 1 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#222', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  messageList: { flex: 1 },
  messageContent: { paddingTop: 12, paddingBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#111', gap: 8,
  },
  input: {
    flex: 1, height: 40,
    backgroundColor: '#1e1e1e',
    borderRadius: 20, paddingHorizontal: 14,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#27ae60',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#1e1e1e' },
  sendIcon: { color: '#fff', fontSize: 15, marginLeft: 2 },
});

export default AssistantPopup;