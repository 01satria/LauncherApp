import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Easing, TextInput, FlatList, KeyboardAvoidingView,
  Platform, PanResponder, GestureResponderEvent, Image,
  Dimensions,
} from 'react-native';
import { getNotificationMessage } from '../utils/storage';

const SCREEN_H = Dimensions.get('window').height;
const CARD_H   = Math.min(480, SCREEN_H * 0.62); // max 62% of screen, centered

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
const now = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
const makeId = () => `${Date.now()}-${Math.random()}`;

let _chatCache: Message[] | null = null;
let _cacheHour: number = -1;

const loadChat = (autoMsg: Message): Message[] => {
  const h = new Date().getHours();
  if (h === 1 && _cacheHour !== 1) _chatCache = null;
  _cacheHour = h;
  if (_chatCache === null) _chatCache = [autoMsg];
  return _chatCache;
};
const saveChat = (msgs: Message[]) => { _chatCache = msgs; };

// ─── Bilingual AI reply ───────────────────────────────────────────────────────
const getReply = (input: string, userName: string, assistantName: string): string => {
  const t = input.trim().toLowerCase();

  // Greetings
  if (/^(hai|hi|halo|hello|hey|sup|yo|howdy)\b/.test(t))
    return `Hey ${userName}! 👋 What can I do for you?`;

  // How are you
  if (/apa kabar|how are you|gimana kabar|how's it going|how r u/.test(t))
    return `I'm doing great, ${userName}! 😊 How about you?`;

  // Identity
  if (/nama(mu| kamu| lo)/.test(t) || /who are you|siapa kamu|your name|siapa lo/.test(t))
    return `I'm ${assistantName}, your personal assistant! 🤖`;

  // Thanks
  if (/makasih|thanks|thank you|thx|tengkyu|ty|terima kasih/.test(t))
    return `You're welcome, ${userName}! 😊`;

  // Capabilities
  if (/bisa apa|apa yang kamu bisa|what can you do|capabilities|fitur/.test(t))
    return `I can chat with you, tell you the time, and remind you to rest! 💬`;

  // Time
  if (/jam berapa|what time|current time|waktu sekarang/.test(t))
    return `It's ${now()} right now, ${userName}! ⏰`;

  // Bored
  if (/bored|bosan|gabut|nothing to do|iseng/.test(t))
    return `Try opening your favorite app! 📱 Or just keep chatting with me 😄`;

  // Tired
  if (/capek|lelah|tired|exhausted|ngantuk|sleepy/.test(t))
    return `Take a break, ${userName}! 😴 Your health matters.`;

  // Hungry
  if (/lapar|makan|hungry|food|eat|dinner|lunch|breakfast/.test(t))
    return `Hungry? Don't skip your meals, ${userName}! 🍔`;

  // Goodbye
  if (/bye|dadah|sampai jumpa|see you|goodbye|later|ciao|selamat tinggal/.test(t))
    return `Bye ${userName}! 👋 See you later~`;

  // Okay / Acknowledged
  if (/^(oke|ok|sip|siap|got it|alright|sure|noted|oke deh|oke siap)$/.test(t))
    return `Got it! 👍`;

  // Help
  if (/tolong|help|bantuan|assist|please|minta tolong/.test(t))
    return `I'm right here, ${userName}! Tell me what's on your mind. 😊`;

  // Good morning / night
  if (/good morning|selamat pagi|pagi/.test(t))
    return `Good morning, ${userName}! ☀️ Hope you have a great day!`;
  if (/good night|selamat malam|malam|good evening/.test(t))
    return `Good night, ${userName}! 🌙 Sweet dreams!`;

  // Love / miss
  if (/i love you|aku suka kamu|love u|sayang/.test(t))
    return `Aww, I appreciate that, ${userName}! 🥰`;
  if (/miss you|kangen|i miss/.test(t))
    return `I'm always right here for you, ${userName}! 💚`;

  // Joke
  if (/joke|jokes|lucu|funny|cerita lucu/.test(t))
    return `Why don't scientists trust atoms? Because they make up everything! 😄`;

  // Weather (can't check but respond naturally)
  if (/weather|cuaca|hujan|rain|panas|hot|cold|dingin/.test(t))
    return `I can't check the weather, but stay safe out there, ${userName}! 🌤️`;

  // Default pool
  const defaults = [
    `Interesting! Tell me more, ${userName}. 😊`,
    `I'm not sure about that, but I'm always here for you! 🤗`,
    `Oh really? Go on! 👀`,
    `Sounds fun! Anything else on your mind, ${userName}? 😄`,
    `I still have a lot to learn! 😅`,
    `Hmm, that's a new one for me! Care to explain? 🤔`,
    `You always surprise me, ${userName}! 😄`,
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
};

// ─── Send Icon (pure RN, no library needed) ───────────────────────────────────
const SendIcon = memo(({ active }: { active: boolean }) => (
  <View style={sendIconStyles.wrap}>
    {/* Arrow body */}
    <View style={[sendIconStyles.shaft, active && sendIconStyles.shaftActive]} />
    {/* Arrowhead top */}
    <View style={[sendIconStyles.headTop, active && sendIconStyles.headActive]} />
    {/* Arrowhead bottom */}
    <View style={[sendIconStyles.headBot, active && sendIconStyles.headActive]} />
  </View>
));

const sendIconStyles = StyleSheet.create({
  wrap: {
    width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  shaft: {
    position: 'absolute',
    width: 13, height: 2,
    backgroundColor: '#555',
    borderRadius: 1,
    left: 1,
    transform: [{ rotate: '0deg' }],
  },
  shaftActive: { backgroundColor: '#fff' },
  headTop: {
    position: 'absolute',
    width: 7, height: 2,
    backgroundColor: '#555',
    borderRadius: 1,
    right: 1,
    top: 6,
    transform: [{ rotate: '-40deg' }],
  },
  headBot: {
    position: 'absolute',
    width: 7, height: 2,
    backgroundColor: '#555',
    borderRadius: 1,
    right: 1,
    bottom: 6,
    transform: [{ rotate: '40deg' }],
  },
  headActive: { backgroundColor: '#fff' },
});

// ─── Animated Toggle ──────────────────────────────────────────────────────────
interface ToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}

export const AnimatedToggle = memo(({ value, onValueChange, activeColor = '#27ae60' }: ToggleProps) => {
  const TRACK_W = 50;
  const THUMB   = 24;
  const MAX_X   = TRACK_W - THUMB - 4;

  const posX     = useRef(new Animated.Value(value ? MAX_X : 2)).current;
  const bgAnim   = useRef(new Animated.Value(value ? 1 : 0)).current;
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    Animated.parallel([
      Animated.spring(posX,   { toValue: value ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
      Animated.spring(bgAnim, { toValue: value ? 1 : 0,     friction: 6, tension: 120, useNativeDriver: false }),
    ]).start();
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: () => {
        posX.stopAnimation();
        bgAnim.stopAnimation();
      },

      onPanResponderMove: (_: GestureResponderEvent, gs) => {
        const base = valueRef.current ? MAX_X : 2;
        const next = Math.min(MAX_X, Math.max(2, base + gs.dx));
        posX.setValue(next);
        bgAnim.setValue((next - 2) / MAX_X);
      },

      onPanResponderRelease: (_: GestureResponderEvent, gs) => {
        // Tap detection
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          onValueChange(!valueRef.current);
          return;
        }
        // Drag decision
        const base     = valueRef.current ? MAX_X : 2;
        const nextPos  = base + gs.dx;
        const shouldOn = gs.vx > 0.3 ? true : gs.vx < -0.3 ? false : nextPos > MAX_X / 2 + 2;
        if (shouldOn !== valueRef.current) {
          onValueChange(shouldOn);
        } else {
          Animated.parallel([
            Animated.spring(posX,   { toValue: valueRef.current ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
            Animated.spring(bgAnim, { toValue: valueRef.current ? 1 : 0,     friction: 6, tension: 120, useNativeDriver: false }),
          ]).start();
        }
      },

      onPanResponderTerminate: () => {
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
  track: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', position: 'absolute',
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25, shadowRadius: 2,
  },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const Bubble = memo(({ msg, assistantName, avatarSource }: {
  msg: Message; assistantName: string; avatarSource?: string;
}) => {
  const isUser = msg.from === 'user';
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
    ]).start();
    return () => { fadeIn.stopAnimation(); slideY.stopAnimation(); };
  }, []);

  return (
    <Animated.View style={[
      bubbleStyles.row,
      isUser ? bubbleStyles.rowRight : bubbleStyles.rowLeft,
      { opacity: fadeIn, transform: [{ translateY: slideY }] },
    ]}>
      {!isUser && (
        <View style={bubbleStyles.avatar}>
          {avatarSource
            ? <Image source={{ uri: avatarSource }} style={bubbleStyles.avatarImg} />
            : <Text style={bubbleStyles.avatarEmoji}>🤖</Text>
          }
        </View>
      )}
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.aiBubble]}>
        {!isUser && <Text style={bubbleStyles.sender}>{assistantName}</Text>}
        <Text style={bubbleStyles.text}>{msg.text}</Text>
        <Text style={bubbleStyles.time}>{msg.time}</Text>
      </View>
    </Animated.View>
  );
});

const bubbleStyles = StyleSheet.create({
  row:       { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 12, alignItems: 'flex-end' },
  rowLeft:   { justifyContent: 'flex-start' },
  rowRight:  { justifyContent: 'flex-end' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6, marginBottom: 2, overflow: 'hidden',
  },
  avatarImg:   { width: 28, height: 28, borderRadius: 14 },
  avatarEmoji: { fontSize: 14 },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10, elevation: 2 },
  userBubble: { backgroundColor: '#27ae60', borderBottomRightRadius: 4 },
  aiBubble:   { backgroundColor: '#1e1e1e', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  sender: { color: '#27ae60', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  text:   { color: '#fff', fontSize: 14, lineHeight: 20 },
  time:   { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingDot = memo(({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -4, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[typingStyles.dot, { transform: [{ translateY: anim }] }]} />;
});

const typingStyles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#555', marginHorizontal: 2 },
});

// ─── AssistantPopup ───────────────────────────────────────────────────────────
const AssistantPopup = memo(({ onClose, userName, assistantName, avatarSource }: AssistantPopupProps) => {
  const slideAnim   = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const flatRef     = useRef<FlatList>(null);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const autoMsg: Message = {
    id: 'auto',
    text: getNotificationMessage(userName),
    from: 'assistant',
    time: now(),
  };
  const [messages, setMessages] = useState<Message[]>(() => loadChat(autoMsg));

  // Hourly reset at 01:00
  useEffect(() => {
    const iv = setInterval(() => {
      const h = new Date().getHours();
      if (h === 1 && _cacheHour !== 1) {
        const fresh: Message[] = [{ id: makeId(), text: getNotificationMessage(userName), from: 'assistant', time: now() }];
        _chatCache = fresh; _cacheHour = 1;
        setMessages(fresh);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [userName]);

  // Open animation — scale + fade (feels centered)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 280, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease),      useNativeDriver: true }),
    ]).start();
    return () => { slideAnim.stopAnimation(); opacityAnim.stopAnimation(); };
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 30, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,  duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: makeId(), text, from: 'user', time: now() };
    setMessages(prev => { const n = [...prev, userMsg]; saveChat(n); return n; });
    setInput('');
    scrollToEnd();

    setIsTyping(true);
    setTimeout(() => {
      const reply: Message = { id: makeId(), text: getReply(text, userName, assistantName), from: 'assistant', time: now() };
      setIsTyping(false);
      setMessages(prev => { const n = [...prev, reply]; saveChat(n); return n; });
      scrollToEnd();
    }, 600 + Math.random() * 600);
  }, [input, userName, assistantName, scrollToEnd]);

  const hasInput = input.trim().length > 0;

  return (
    <>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

      <Animated.View style={[
        styles.card,
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarWrap}>
              {avatarSource
                ? <Image source={{ uri: avatarSource }} style={styles.headerAvatar} />
                : <Text style={{ fontSize: 20 }}>🤖</Text>
              }
              <View style={styles.onlineBadge} />
            </View>
            <View>
              <Text style={styles.headerName}>{assistantName}</Text>
              <Text style={styles.headerSub}>● Online</Text>
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
          style={styles.msgList}
          contentContainerStyle={styles.msgContent}
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          ListFooterComponent={isTyping ? (
            <View style={[bubbleStyles.row, bubbleStyles.rowLeft]}>
              <View style={bubbleStyles.avatar}>
                {avatarSource
                  ? <Image source={{ uri: avatarSource }} style={bubbleStyles.avatarImg} />
                  : <Text style={bubbleStyles.avatarEmoji}>🤖</Text>
                }
              </View>
              <View style={[bubbleStyles.bubble, bubbleStyles.aiBubble, styles.typingBubble]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TypingDot delay={0} />
                  <TypingDot delay={150} />
                  <TypingDot delay={300} />
                </View>
              </View>
            </View>
          ) : null}
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
            />
            <TouchableOpacity
              style={[styles.sendBtn, hasInput && styles.sendBtnActive]}
              onPress={sendMessage}
              activeOpacity={0.7}
              disabled={!hasInput}
            >
              <SendIcon active={hasInput} />
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
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 998,
  },
  // Centered card
  card: {
    position: 'absolute',
    top: '50%',
    left: 16, right: 16,
    height: CARD_H,
    marginTop: -(CARD_H / 2),   // offset by half height = true center
    backgroundColor: '#0d0d0d',
    borderRadius: 24,
    borderWidth: 1, borderColor: '#1e1e1e',
    overflow: 'hidden',
    elevation: 20,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    backgroundColor: '#111',
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap:   { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#27ae60' },
  onlineBadge:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#27ae60', borderWidth: 1.5, borderColor: '#111',
  },
  headerName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerSub:  { color: '#27ae60', fontSize: 10, marginTop: 1 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#aaa', fontSize: 12, fontWeight: 'bold' },

  msgList:    { flex: 1 },
  msgContent: { paddingTop: 12, paddingBottom: 8 },
  typingBubble: { paddingVertical: 10, paddingHorizontal: 14 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#111', gap: 8,
  },
  input: {
    flex: 1, height: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 20, paddingHorizontal: 14,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: '#252525',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderStyle: 'dashed',
    borderWidth: 1, borderColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
});

export default AssistantPopup;