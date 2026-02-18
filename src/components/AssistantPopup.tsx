import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  TextInput, FlatList, KeyboardAvoidingView,
  Platform, PanResponder, GestureResponderEvent,
  StatusBar, Dimensions, AppState, AppStateStatus,
  Image,
} from 'react-native';
import { getNotificationMessage } from '../utils/storage';

const SCREEN_H = Dimensions.get('window').height;

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

interface ToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const now = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
const makeId = () => `${Date.now()}-${Math.random()}`;

const getCurrentPeriod = (): string => {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return 'late_night';
  if (h >= 4 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'afternoon';
  if (h >= 15 && h < 18) return 'evening';
  return 'night';
};

let _chatCache: Message[] | null = null;
let _cachePeriod: string = getCurrentPeriod();
let _lastAssistantMsgId: string | null = null;
let _hasUnread: boolean = false;

const loadChat = (autoMsg: Message): Message[] => {
  const h = new Date().getHours();
  if (h === 1 && _cachePeriod !== 'late_night') _chatCache = null;
  _cachePeriod = getCurrentPeriod();
  if (_chatCache === null) {
    _chatCache = [autoMsg];
    _lastAssistantMsgId = autoMsg.id;
    _hasUnread = true;
  }
  return _chatCache;
};

const saveChat = (msgs: Message[]) => { _chatCache = msgs; };

export const markAsRead = () => { _hasUnread = false; };
export const hasUnreadMessages = () => _hasUnread;
export const notifyNewMessage = (msgId: string) => {
  _lastAssistantMsgId = msgId;
  _hasUnread = true;
};

// ─── Fuzzy matching ───────────────────────────────────────────────────────────
const RE_PUNCT = /[''`.,!?]/g;
const RE_SPACE = /\s+/g;

const norm = (s: string) =>
  s.toLowerCase().replace(RE_PUNCT, '').replace(RE_SPACE, ' ').trim();

const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (let i = 0; i <= m; i++) dp[i * (n + 1)] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i * (n + 1) + j] = a[i - 1] === b[j - 1]
        ? dp[(i - 1) * (n + 1) + (j - 1)]
        : 1 + Math.min(
          dp[(i - 1) * (n + 1) + j],
          dp[i * (n + 1) + (j - 1)],
          dp[(i - 1) * (n + 1) + (j - 1)],
        );
    }
  }
  return dp[m * (n + 1) + n];
};

const sim = (a: string, b: string): number => {
  const na = norm(a), nb = norm(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - lev(na, nb) / maxLen;
};

const hasKeyword = (input: string, keywords: string[], threshold = 0.78): boolean => {
  const normInput = norm(input);
  const words = normInput.split(' ');
  for (const kw of keywords) {
    const kwNorm = norm(kw);
    if (normInput.includes(kwNorm)) return true;
    if (!kwNorm.includes(' ')) {
      for (const w of words) if (sim(w, kwNorm) >= threshold) return true;
    } else {
      const kwWords = kwNorm.split(' ');
      for (let i = 0; i <= words.length - kwWords.length; i++) {
        const chunk = words.slice(i, i + kwWords.length).join(' ');
        if (sim(chunk, kwNorm) >= threshold) return true;
      }
      if (sim(normInput, kwNorm) >= threshold) return true;
    }
  }
  return false;
};

const getReply = (input: string, userName: string, assistantName: string): string => {
  const t = norm(input);
  if (hasKeyword(t, ['hai', 'hi', 'halo', 'hello', 'hey', 'sup', 'yo', 'howdy'], 0.82))
    return `Hey ${userName}! 👋 What can I do for you?`;
  if (hasKeyword(t, ['apa kabar', 'how are you', 'gimana kabar', 'hows it going', 'how r u', 'kabar kamu']))
    return `I'm doing great, ${userName}! 😊 How about you?`;
  if (hasKeyword(t, ['siapa kamu', 'who are you', 'nama kamu', 'namamu', 'your name', 'siapa lo', 'who r u']))
    return `I'm ${assistantName}, your personal assistant! 🤖`;
  if (hasKeyword(t, ['makasih', 'thanks', 'thank you', 'thx', 'tengkyu', 'ty', 'terima kasih', 'thankyou', 'tq']))
    return `You're welcome, ${userName}! 😊`;
  if (hasKeyword(t, ['bisa apa', 'what can you do', 'kamu bisa apa', 'capabilities', 'fitur', 'apa kemampuan']))
    return `I can chat with you, tell you the time, and remind you to rest! 💬`;
  if (hasKeyword(t, [
    'jam berapa', 'what time', 'whats time', 'what is time', 'wht is time',
    'current time', 'waktu sekarang', 'jam sekarang', 'jamber', 'jamberapa',
    'time now', 'pukul berapa', 'skrg jam', 'sekarang jam',
  ], 0.72))
    return `It's ${now()} right now, ${userName}! ⏰`;
  if (hasKeyword(t, ['bored', 'bosan', 'gabut', 'nothing to do', 'iseng', 'boring']))
    return `Try opening your favorite app! 📱 Or just keep chatting with me 😄`;
  if (hasKeyword(t, ['capek', 'lelah', 'tired', 'exhausted', 'ngantuk', 'sleepy', 'kecapekan']))
    return `Take a break, ${userName}! 😴 Your health matters.`;
  if (hasKeyword(t, ['lapar', 'makan', 'hungry', 'food', 'eat', 'dinner', 'lunch', 'breakfast', 'belum makan', 'laper']))
    return `Hungry? Don't skip your meals, ${userName}! 🍔`;
  if (hasKeyword(t, ['bye', 'dadah', 'sampai jumpa', 'see you', 'goodbye', 'later', 'ciao', 'selamat tinggal', 'good bye']))
    return `Bye ${userName}! 👋 See you later~`;
  if (/^(oke|ok|sip|siap|got it|alright|sure|noted|oke deh|oke siap)$/.test(t))
    return `Got it! 👍`;
  if (hasKeyword(t, ['tolong', 'help', 'bantuan', 'assist', 'minta tolong', 'please help', 'butuh bantuan']))
    return `I'm right here, ${userName}! Tell me what's on your mind. 😊`;
  if (hasKeyword(t, ['good morning', 'selamat pagi', 'pagi pagi', 'morning', 'gm']))
    return `Good morning, ${userName}! ☀️ Hope you have a great day!`;
  if (hasKeyword(t, ['good night', 'selamat malam', 'good evening', 'malam', 'gn', 'goodnight']))
    return `Good night, ${userName}! 🌙 Sweet dreams!`;
  if (hasKeyword(t, ['i love you', 'love u', 'aku suka kamu', 'sayang kamu', 'luv u', 'i luv you']))
    return `Aww, I appreciate that, ${userName}! 🥰`;
  if (hasKeyword(t, ['miss you', 'kangen', 'i miss', 'miss u', 'kangen kamu']))
    return `I'm always right here for you, ${userName}! 💚`;
  if (hasKeyword(t, ['joke', 'jokes', 'lucu', 'funny', 'cerita lucu', 'buat lelucon', 'tell me a joke']))
    return `Why don't scientists trust atoms? Because they make up everything! 😄`;
  if (hasKeyword(t, ['weather', 'cuaca', 'hujan', 'rain', 'panas', 'hot', 'cold', 'dingin', 'mendung']))
    return `I can't check the weather, but stay safe out there, ${userName}! 🌤️`;

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

// ─── Send Icon ────────────────────────────────────────────────────────────────
const SendIcon = memo(({ active }: { active: boolean }) => (
  <View style={sendStyles.wrap}>
    <View style={[sendStyles.shaft, active && sendStyles.active]} />
    <View style={[sendStyles.tail, active && sendStyles.active]} />
    <View style={[sendStyles.headTop, active && sendStyles.active]} />
    <View style={[sendStyles.headBot, active && sendStyles.active]} />
  </View>
));

const sendStyles = StyleSheet.create({
  wrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  shaft: { position: 'absolute', width: 18, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 0, top: 11, transform: [{ rotate: '-20deg' }] },
  tail: { position: 'absolute', width: 2.5, height: 6, backgroundColor: '#555', borderRadius: 2, left: 2, top: 9, transform: [{ rotate: '90deg' }] },
  headTop: { position: 'absolute', width: 8, height: 2.5, backgroundColor: '#555', borderRadius: 2, right: 2, top: 6, transform: [{ rotate: '-50deg' }] },
  headBot: { position: 'absolute', width: 8, height: 2.5, backgroundColor: '#555', borderRadius: 2, right: 2, bottom: 6, transform: [{ rotate: '50deg' }] },
  active: { backgroundColor: '#fff' },
});

// ─── Animated Toggle ──────────────────────────────────────────────────────────
export const AnimatedToggle = memo(({ value, onValueChange, activeColor = '#27ae60' }: ToggleProps) => {
  const TRACK_W = 50, THUMB = 24, MAX_X = TRACK_W - THUMB - 4;
  const posX = useRef(new Animated.Value(value ? MAX_X : 2)).current;
  const bgAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    Animated.parallel([
      Animated.spring(posX, { toValue: value ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
      Animated.spring(bgAnim, { toValue: value ? 1 : 0, friction: 6, tension: 120, useNativeDriver: false }),
    ]).start();
  }, [value]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { posX.stopAnimation(); bgAnim.stopAnimation(); },
    onPanResponderMove: (_: GestureResponderEvent, gs) => {
      const next = Math.min(MAX_X, Math.max(2, (valueRef.current ? MAX_X : 2) + gs.dx));
      posX.setValue(next);
      bgAnim.setValue((next - 2) / MAX_X);
    },
    onPanResponderRelease: (_: GestureResponderEvent, gs) => {
      if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
        onValueChange(!valueRef.current);
        return;
      }
      const shouldOn = gs.vx > 0.3 ? true : gs.vx < -0.3 ? false : ((valueRef.current ? MAX_X : 2) + gs.dx) > MAX_X / 2 + 2;
      if (shouldOn !== valueRef.current) onValueChange(shouldOn);
      else Animated.parallel([
        Animated.spring(posX, { toValue: valueRef.current ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
        Animated.spring(bgAnim, { toValue: valueRef.current ? 1 : 0, friction: 6, tension: 120, useNativeDriver: false }),
      ]).start();
    },
    onPanResponderTerminate: () => Animated.parallel([
      Animated.spring(posX, { toValue: valueRef.current ? MAX_X : 2, friction: 6, tension: 120, useNativeDriver: false }),
      Animated.spring(bgAnim, { toValue: valueRef.current ? 1 : 0, friction: 6, tension: 120, useNativeDriver: false }),
    ]).start(),
  })).current;

  return (
    <Animated.View style={[toggleStyles.track, { backgroundColor: bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['#3a3a3a', activeColor] }) }]} {...panResponder.panHandlers}>
      <Animated.View style={[toggleStyles.thumb, { transform: [{ translateX: posX }] }]} />
    </Animated.View>
  );
});

const toggleStyles = StyleSheet.create({
  track: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', position: 'absolute', elevation: 3 },
});

// ─── ULTRA-LIGHT Message Bubble (NO IMAGES, minimal View nesting) ────────────
const Bubble = memo(({ msg, isLast }: { msg: Message; isLast: boolean }) => {
  const isUser = msg.from === 'user';

  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowRight : bubbleStyles.rowLeft]}>
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.aiBubble]}>
        <Text style={bubbleStyles.text}>{msg.text}</Text>
        <Text style={bubbleStyles.time}>{msg.time}</Text>
      </View>
    </View>
  );
});

const bubbleStyles = StyleSheet.create({
  row: { paddingHorizontal: 16, marginBottom: 8 },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#27ae60', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#2a2a2a', borderBottomLeftRadius: 4 },
  text: { color: '#fff', fontSize: 15, lineHeight: 21 },
  time: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingDot = memo(({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: -4, duration: 300, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(300),
    ]));
    loopRef.current.start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') { loopRef.current?.stop(); anim.setValue(0); }
      else loopRef.current?.start();
    });

    return () => { loopRef.current?.stop(); anim.stopAnimation(); sub.remove(); };
  }, []);

  return <Animated.View style={[typingStyles.dot, { transform: [{ translateY: anim }] }]} />;
});

const typingStyles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#666', marginHorizontal: 2 },
});

// ─── FULLSCREEN AssistantPopup ────────────────────────────────────────────────
const AssistantPopup = memo(({ onClose, userName, assistantName, avatarSource }: AssistantPopupProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<FlatList>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const autoMsg: Message = { id: 'auto', text: getNotificationMessage(userName), from: 'assistant', time: now() };
  const [messages, setMessages] = useState<Message[]>(() => loadChat(autoMsg));

  useEffect(() => {
    const checkPeriodTransition = () => {
      const currentPeriod = getCurrentPeriod();
      const h = new Date().getHours();
      if (h === 1 && _cachePeriod !== 'late_night') {
        const freshMsg: Message = { id: makeId(), text: getNotificationMessage(userName), from: 'assistant', time: now() };
        _chatCache = [freshMsg];
        _cachePeriod = currentPeriod;
        notifyNewMessage(freshMsg.id);
        setMessages([freshMsg]);
        return;
      }
      if (currentPeriod !== _cachePeriod) {
        const newMsg: Message = { id: makeId(), text: getNotificationMessage(userName), from: 'assistant', time: now() };
        setMessages(prev => {
          const updated = [...prev, newMsg];
          _chatCache = updated;
          _cachePeriod = currentPeriod;
          saveChat(updated);
          notifyNewMessage(newMsg.id);
          return updated;
        });
      }
    };
    const iv = setInterval(checkPeriodTransition, 60_000);
    return () => clearInterval(iv);
  }, [userName]);

  useEffect(() => {
    markAsRead();
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    return () => {
      fadeAnim.stopAnimation();
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onClose());
  }, [onClose]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: makeId(), text, from: 'user', time: now() };
    setMessages(prev => { const n = [...prev, userMsg]; saveChat(n); return n; });
    setInput('');
    scrollToEnd();
    setIsTyping(true);
    replyTimer.current = setTimeout(() => {
      const reply: Message = { id: makeId(), text: getReply(text, userName, assistantName), from: 'assistant', time: now() };
      setIsTyping(false);
      setMessages(prev => { const n = [...prev, reply]; saveChat(n); return n; });
      scrollToEnd();
    }, 600 + Math.random() * 600);
  }, [input, userName, assistantName, avatarSource, scrollToEnd]);

  const keyExtractor = useCallback((m: Message) => m.id, []);
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => (
    <Bubble msg={item} isLast={index === messages.length - 1} />
  ), [messages.length]);

  const hasInput = input.trim().length > 0;

  return (
    <Animated.View style={[styles.fullscreen, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {avatarSource
            ? <Image source={{ uri: avatarSource }} style={styles.headerAvatar} />
            : <Text style={styles.headerEmoji}>🤖</Text>
          }
          <View style={styles.onlineBadge} />
        </View>
        <View>
          <Text style={styles.headerName}>{assistantName}</Text>
          <Text style={styles.headerSub}>Online</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages - OPTIMIZED FlatList */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.msgList}
        contentContainerStyle={styles.msgContent}
        showsVerticalScrollIndicator={false}
        // ULTRA-LIGHT CONFIG — no clipping, no complex layout
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={scrollToEnd}
        ListFooterComponent={isTyping ? (
          <View style={[bubbleStyles.row, bubbleStyles.rowLeft]}>
            <View style={[bubbleStyles.bubble, bubbleStyles.aiBubble, { flexDirection: 'row', gap: 4 }]}>
              <TypingDot delay={0} />
              <TypingDot delay={150} />
              <TypingDot delay={300} />
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
            placeholderTextColor="#555"
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
  );
});

const styles = StyleSheet.create({
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 1000 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: StatusBar.currentHeight || 40, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#aaa', fontSize: 14, fontWeight: 'bold' },
  avatarWrap: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#27ae60' },
  headerEmoji:  { fontSize: 20 },
  onlineBadge:  { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#27ae60', borderWidth: 1.5, borderColor: '#111' },
  headerName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerSub: { color: '#555', fontSize: 12 },
  msgList: { flex: 1 },
  msgContent: { paddingTop: 12, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 8 },
  input: { flex: 1, height: 42, backgroundColor: '#1a1a1a', borderRadius: 21, paddingHorizontal: 16, color: '#fff', fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { backgroundColor: '#27ae60' },
});

export default AssistantPopup;