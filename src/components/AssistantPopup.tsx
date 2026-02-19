import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  TextInput, FlatList, KeyboardAvoidingView,
  Platform, PanResponder, GestureResponderEvent,
  StatusBar, AppState, AppStateStatus,
  Image, BackHandler, Alert,
} from 'react-native';

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
const getTimeStr = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const makeId = () => `${Date.now()}-${Math.random()}`;

// ─── Module-level chat cache ──────────────────────────────────────────────────
let _chatCache: Message[] | null = null;

const initChat = (): Message[] => {
  if (_chatCache !== null) return _chatCache;
  _chatCache = [];
  return _chatCache;
};

const saveChat = (msgs: Message[]) => { _chatCache = msgs; };

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

const simScore = (a: string, b: string): number => {
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
      for (const w of words) if (simScore(w, kwNorm) >= threshold) return true;
    } else {
      const kwWords = kwNorm.split(' ');
      for (let i = 0; i <= words.length - kwWords.length; i++) {
        const chunk = words.slice(i, i + kwWords.length).join(' ');
        if (simScore(chunk, kwNorm) >= threshold) return true;
      }
      if (simScore(normInput, kwNorm) >= threshold) return true;
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
    return `I can chat with you, tell you the time, and help with reminders! 💬`;
  if (hasKeyword(t, [
    'jam berapa', 'what time', 'whats time', 'what is time', 'wht is time',
    'current time', 'waktu sekarang', 'jam sekarang', 'jamber', 'jamberapa',
    'time now', 'pukul berapa', 'skrg jam', 'sekarang jam',
  ], 0.72))
    return `It's ${getTimeStr()} right now, ${userName}! ⏰`;
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
    <View style={[sendStyles.shaft1, active && sendStyles.active]} />
    <View style={[sendStyles.headTop, active && sendStyles.active]} />
    <View style={[sendStyles.headBot, active && sendStyles.active]} />
  </View>
));

const sendStyles = StyleSheet.create({
  wrap: { width: 25, height: 25, justifyContent: 'center', alignItems: 'center' },
  shaft: { position: 'absolute', width: 24, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 1, bottom: 7, transform: [{ rotate: '-22deg' }] },
  shaft1: { position: 'absolute', width: 24, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 1, top: 7, transform: [{ rotate: '22deg' }] },
  headTop: { position: 'absolute', width: 12, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 0, bottom: 7, transform: [{ rotate: '-55deg' }] },
  headBot: { position: 'absolute', width: 12, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 0, top: 7, transform: [{ rotate: '55deg' }] },
  active: { backgroundColor: '#27ae60' },
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
      if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) { onValueChange(!valueRef.current); return; }
      const shouldOn = gs.vx > 0.3 ? true : gs.vx < -0.3 ? false
        : ((valueRef.current ? MAX_X : 2) + gs.dx) > MAX_X / 2 + 2;
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
    <Animated.View
      style={[toggleStyles.track, {
        backgroundColor: bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['#3a3a3a', activeColor] }),
      }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[toggleStyles.thumb, { transform: [{ translateX: posX }] }]} />
    </Animated.View>
  );
});

const toggleStyles = StyleSheet.create({
  track: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', position: 'absolute', elevation: 3 },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const Bubble = memo(({ msg }: { msg: Message }) => {
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
const TypingIndicator = memo(() => {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const startLoop = () => {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.stagger(160, dots.map(d =>
            Animated.sequence([
              Animated.timing(d, { toValue: -5, duration: 280, useNativeDriver: true }),
              Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
            ])
          )),
          Animated.delay(300),
        ])
      );
      loopRef.current.start();
    };

    startLoop();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        loopRef.current?.stop();
        dots.forEach(d => d.setValue(0));
        startLoop();
      } else {
        loopRef.current?.stop();
        dots.forEach(d => d.setValue(0));
      }
    });

    return () => {
      loopRef.current?.stop();
      dots.forEach(d => d.stopAnimation());
      sub.remove();
    };
  }, []);

  return (
    <View style={typingStyles.row}>
      {dots.map((anim, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { transform: [{ translateY: anim }] }]} />
      ))}
    </View>
  );
});

const TypingBubble = memo(() => (
  <View style={[bubbleStyles.row, bubbleStyles.rowLeft]}>
    <View style={[bubbleStyles.bubble, bubbleStyles.aiBubble]}>
      <TypingIndicator />
    </View>
  </View>
));

const typingStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#888', marginHorizontal: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});

// ─── Trash Icon ───────────────────────────────────────────────────────────────
const TrashIcon = memo(() => (
  <View style={trashStyles.wrap}>
    <View style={trashStyles.lidHandle} />
    <View style={trashStyles.lid} />
    <View style={trashStyles.body}>
      <View style={trashStyles.line} />
      <View style={trashStyles.line} />
      <View style={trashStyles.line} />
    </View>
  </View>
));

const trashStyles = StyleSheet.create({
  wrap: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  lid: { width: 16, height: 2, backgroundColor: '#aaa', borderRadius: 1.5, marginBottom: 1 },
  lidHandle: { width: 6, height: 2, backgroundColor: '#aaa', borderRadius: 1, marginBottom: 1, top: 1 },
  body: { width: 14, height: 14, borderWidth: 2, borderColor: '#aaa', borderRadius: 2, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingTop: 1 },
  line: { width: 1.5, height: 8, backgroundColor: '#aaa', borderRadius: 1 },
});

// ─── AssistantPopup ───────────────────────────────────────────────────────────
const AssistantPopup = memo(({ onClose, userName, assistantName, avatarSource }: AssistantPopupProps) => {
  const flatRef = useRef<FlatList>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => initChat());

  const handleClearChat = useCallback(() => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to delete all messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => { _chatCache = []; setMessages([]); } },
      ],
      { cancelable: true },
    );
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleClose(); return true; });
    return () => sub.remove();
  }, [handleClose]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') handleClose();
    });
    return () => sub.remove();
  }, [handleClose]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => flatRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: makeId(), text, from: 'user', time: getTimeStr() };
    setMessages(prev => { const n = [...prev, userMsg]; saveChat(n); return n; });
    setInput('');
    scrollToEnd();
    setIsTyping(true);

    replyTimer.current = setTimeout(() => {
      const reply: Message = {
        id: makeId(),
        text: getReply(text, userName, assistantName),
        from: 'assistant',
        time: getTimeStr(),
      };
      setIsTyping(false);
      setMessages(prev => { const n = [...prev, reply]; saveChat(n); return n; });
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    }, 600 + Math.random() * 600);
  }, [input, userName, assistantName, scrollToEnd]);

  const keyExtractor = useCallback((m: Message) => m.id, []);
  const renderItem = useCallback(({ item }: { item: Message }) => <Bubble msg={item} />, []);

  const hasInput = input.trim().length > 0;

  return (
    <View style={styles.fullscreen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarWrap}>
            {avatarSource
              ? <Image source={{ uri: avatarSource }} style={styles.headerAvatar} />
              : <Text style={styles.headerEmoji}>🤖</Text>
            }
          </View>
          <View>
            <Text style={styles.headerName}>{assistantName}</Text>
            <Text style={styles.headerSub}>Online</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleClearChat} style={styles.trashBtn} activeOpacity={0.7}>
            <TrashIcon />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.msgList}
        contentContainerStyle={styles.msgContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={5}
        windowSize={3}
        removeClippedSubviews={true}
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={scrollToEnd}
        ListFooterComponent={isTyping ? <TypingBubble /> : null}
        onContentSizeChange={scrollToEnd}
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
    </View>
  );
});

const styles = StyleSheet.create({
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 1000 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: StatusBar.currentHeight || 40, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#aaa', fontSize: 14, fontWeight: 'bold' },
  avatarWrap: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#27ae60' },
  headerEmoji: { fontSize: 20 },
  headerName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerSub: { color: '#00d134', fontSize: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  msgList: { flex: 1 },
  msgContent: { paddingTop: 12, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 8 },
  input: { flex: 1, height: 42, backgroundColor: '#1a1a1a', borderRadius: 21, paddingHorizontal: 16, color: '#fff', fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  sendBtnActive: { backgroundColor: '#1a1a1a', borderColor: '#27ae60', borderWidth: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trashBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
});

export default AssistantPopup;
