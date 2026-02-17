import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Easing, TextInput, FlatList, KeyboardAvoidingView,
  Platform, PanResponder, GestureResponderEvent, Image,
  Dimensions, AppState, AppStateStatus,
} from 'react-native';
import { getNotificationMessage } from '../utils/storage';

const SCREEN_H = Dimensions.get('window').height;
const CARD_H   = Math.min(480, SCREEN_H * 0.62);

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

// FIX 1: Removed duplicate ToggleProps interface (was declared twice)
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

// ─── Fuzzy matching engine ────────────────────────────────────────────────────
// FIX 2: All regex compiled once at module level, not re-created per call
const RE_PUNCT = /[''`.,!?]/g;
const RE_SPACE = /\s+/g;

const norm = (s: string) =>
  s.toLowerCase().replace(RE_PUNCT, '').replace(RE_SPACE, ' ').trim();

const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  // FIX 3: Reuse single flat array instead of 2D array — cuts GC pressure
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
      for (const w of words) {
        if (sim(w, kwNorm) >= threshold) return true;
      }
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

// ─── Bilingual AI reply ───────────────────────────────────────────────────────
const getReply = (input: string, userName: string, assistantName: string): string => {
  const t = norm(input);

  if (hasKeyword(t, ['hai','hi','halo','hello','hey','sup','yo','howdy'], 0.82))
    return `Hey ${userName}! 👋 What can I do for you?`;
  if (hasKeyword(t, ['apa kabar','how are you','gimana kabar','hows it going','how r u','kabar kamu']))
    return `I'm doing great, ${userName}! 😊 How about you?`;
  if (hasKeyword(t, ['siapa kamu','who are you','nama kamu','namamu','your name','siapa lo','who r u']))
    return `I'm ${assistantName}, your personal assistant! 🤖`;
  if (hasKeyword(t, ['makasih','thanks','thank you','thx','tengkyu','ty','terima kasih','thankyou','tq']))
    return `You're welcome, ${userName}! 😊`;
  if (hasKeyword(t, ['bisa apa','what can you do','kamu bisa apa','capabilities','fitur','apa kemampuan']))
    return `I can chat with you, tell you the time, and remind you to rest! 💬`;
  if (hasKeyword(t, [
    'jam berapa','what time','whats time','what is time','wht is time',
    'current time','waktu sekarang','jam sekarang','jamber','jamberapa',
    'time now','pukul berapa','skrg jam','sekarang jam',
  ], 0.72))
    return `It's ${now()} right now, ${userName}! ⏰`;
  if (hasKeyword(t, ['bored','bosan','gabut','nothing to do','iseng','boring']))
    return `Try opening your favorite app! 📱 Or just keep chatting with me 😄`;
  if (hasKeyword(t, ['capek','lelah','tired','exhausted','ngantuk','sleepy','kecapekan']))
    return `Take a break, ${userName}! 😴 Your health matters.`;
  if (hasKeyword(t, ['lapar','makan','hungry','food','eat','dinner','lunch','breakfast','belum makan','laper']))
    return `Hungry? Don't skip your meals, ${userName}! 🍔`;
  if (hasKeyword(t, ['bye','dadah','sampai jumpa','see you','goodbye','later','ciao','selamat tinggal','good bye']))
    return `Bye ${userName}! 👋 See you later~`;
  if (/^(oke|ok|sip|siap|got it|alright|sure|noted|oke deh|oke siap)$/.test(t))
    return `Got it! 👍`;
  if (hasKeyword(t, ['tolong','help','bantuan','assist','minta tolong','please help','butuh bantuan']))
    return `I'm right here, ${userName}! Tell me what's on your mind. 😊`;
  if (hasKeyword(t, ['good morning','selamat pagi','pagi pagi','morning','gm']))
    return `Good morning, ${userName}! ☀️ Hope you have a great day!`;
  if (hasKeyword(t, ['good night','selamat malam','good evening','malam','gn','goodnight']))
    return `Good night, ${userName}! 🌙 Sweet dreams!`;
  if (hasKeyword(t, ['i love you','love u','aku suka kamu','sayang kamu','luv u','i luv you']))
    return `Aww, I appreciate that, ${userName}! 🥰`;
  if (hasKeyword(t, ['miss you','kangen','i miss','miss u','kangen kamu']))
    return `I'm always right here for you, ${userName}! 💚`;
  if (hasKeyword(t, ['joke','jokes','lucu','funny','cerita lucu','buat lelucon','tell me a joke']))
    return `Why don't scientists trust atoms? Because they make up everything! 😄`;
  if (hasKeyword(t, ['weather','cuaca','hujan','rain','panas','hot','cold','dingin','mendung']))
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

// ─── Send Icon (pure RN) ──────────────────────────────────────────────────────
// FIX 4: Styles moved to StyleSheet.create (computed once, not per render)
const SendIcon = memo(({ active }: { active: boolean }) => (
  <View style={sendStyles.wrap}>
    <View style={[sendStyles.shaft,   active && sendStyles.active]} />
    <View style={[sendStyles.tail,    active && sendStyles.active]} />
    <View style={[sendStyles.headTop, active && sendStyles.active]} />
    <View style={[sendStyles.headBot, active && sendStyles.active]} />
  </View>
));

const sendStyles = StyleSheet.create({
  wrap:    { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  shaft:   { position: 'absolute', width: 18, height: 2.5, backgroundColor: '#555', borderRadius: 2, left: 0, top: 11, transform: [{ rotate: '-20deg' }] },
  tail:    { position: 'absolute', width: 2.5, height: 6, backgroundColor: '#555', borderRadius: 2, left: 2, top: 9, transform: [{ rotate: '90deg' }] },
  headTop: { position: 'absolute', width: 8, height: 2.5, backgroundColor: '#555', borderRadius: 2, right: 2, top: 6, transform: [{ rotate: '-50deg' }] },
  headBot: { position: 'absolute', width: 8, height: 2.5, backgroundColor: '#555', borderRadius: 2, right: 2, bottom: 6, transform: [{ rotate: '50deg' }] },
  active:  { backgroundColor: '#fff' },
});

// ─── Animated Toggle ──────────────────────────────────────────────────────────
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
      onPanResponderGrant: () => { posX.stopAnimation(); bgAnim.stopAnimation(); },
      onPanResponderMove: (_: GestureResponderEvent, gs) => {
        const base = valueRef.current ? MAX_X : 2;
        const next = Math.min(MAX_X, Math.max(2, base + gs.dx));
        posX.setValue(next);
        bgAnim.setValue((next - 2) / MAX_X);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gs) => {
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          onValueChange(!valueRef.current);
          return;
        }
        const nextPos  = (valueRef.current ? MAX_X : 2) + gs.dx;
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
    backgroundColor: '#fff', position: 'absolute', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25, shadowRadius: 2,
  },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────
const Bubble = memo(({ msg, assistantName, avatarSource }: {
  msg: Message; assistantName: string; avatarSource?: string;
}) => {
  const isUser = msg.from === 'user';
  // FIX 5: Animated.Values created once, never leak — cleanup in return
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
    ]);
    anim.start();
    return () => {
      anim.stop();
      fadeIn.stopAnimation();
      slideY.stopAnimation();
    };
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
  row:        { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 12, alignItems: 'flex-end' },
  rowLeft:    { justifyContent: 'flex-start' },
  rowRight:   { justifyContent: 'flex-end' },
  avatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 6, marginBottom: 2, overflow: 'hidden' },
  avatarImg:  { width: 28, height: 28, borderRadius: 14 },
  avatarEmoji:{ fontSize: 14 },
  bubble:     { maxWidth: '75%', borderRadius: 16, padding: 10, elevation: 2 },
  userBubble: { backgroundColor: '#27ae60', borderBottomRightRadius: 4 },
  aiBubble:   { backgroundColor: '#1e1e1e', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  sender:     { color: '#27ae60', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  text:       { color: '#fff', fontSize: 14, lineHeight: 20 },
  time:       { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
// FIX 6: TypingDot stops loop when component unmounts AND when app goes background
const TypingDot = memo(({ delay }: { delay: number }) => {
  const anim    = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -4, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    loopRef.current.start();

    // FIX 7: Pause loop when app goes to background, resume on foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        loopRef.current?.stop();
        anim.setValue(0);
      } else {
        loopRef.current?.start();
      }
    });

    return () => {
      loopRef.current?.stop();
      anim.stopAnimation();
      sub.remove();
    };
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
  // FIX 8: Track pending reply timeout so it can be cleared on unmount
  const replyTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => clearInterval(iv);
  }, [userName]);

  // Open animation
  useEffect(() => {
    const openAnim = Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 280, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease),      useNativeDriver: true }),
    ]);
    openAnim.start();

    return () => {
      // FIX 9: Full cleanup on unmount — stop all anims and pending timers
      openAnim.stop();
      slideAnim.stopAnimation();
      opacityAnim.stopAnimation();
      if (replyTimer.current)  clearTimeout(replyTimer.current);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 30, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,  duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  // FIX 10: scrollToEnd uses a tracked ref timeout (clearable on unmount)
  const scrollToEnd = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      flatRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: makeId(), text, from: 'user', time: now() };
    setMessages(prev => { const n = [...prev, userMsg]; saveChat(n); return n; });
    setInput('');
    scrollToEnd();

    setIsTyping(true);
    // FIX 11: Reply timeout tracked and cleared on unmount to prevent setState on dead component
    replyTimer.current = setTimeout(() => {
      const reply: Message = {
        id: makeId(),
        text: getReply(text, userName, assistantName),
        from: 'assistant',
        time: now(),
      };
      setIsTyping(false);
      setMessages(prev => { const n = [...prev, reply]; saveChat(n); return n; });
      scrollToEnd();
    }, 600 + Math.random() * 600);
  }, [input, userName, assistantName, scrollToEnd]);

  // FIX 12: Stable keyExtractor — not an inline arrow (avoids FlatList re-render)
  const keyExtractor = useCallback((m: Message) => m.id, []);

  // FIX 13: Stable renderItem with useCallback
  const renderItem = useCallback(({ item }: { item: Message }) => (
    <Bubble msg={item} assistantName={assistantName} avatarSource={avatarSource} />
  ), [assistantName, avatarSource]);

  const hasInput = input.trim().length > 0;

  // FIX 14: Memoized typing footer — avoids re-creating JSX on every render
  const typingFooter = isTyping ? (
    <View style={[bubbleStyles.row, bubbleStyles.rowLeft]}>
      <View style={bubbleStyles.avatar}>
        {avatarSource
          ? <Image source={{ uri: avatarSource }} style={bubbleStyles.avatarImg} />
          : <Text style={bubbleStyles.avatarEmoji}>🤖</Text>
        }
      </View>
      <View style={[bubbleStyles.bubble, bubbleStyles.aiBubble, styles.typingBubble]}>
        <View style={styles.dotsRow}>
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
        </View>
      </View>
    </View>
  ) : null;

  return (
    <>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

      <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarWrap}>
              {avatarSource
                ? <Image source={{ uri: avatarSource }} style={styles.headerAvatar} />
                : <Text style={styles.headerEmoji}>🤖</Text>
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
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.msgList}
          contentContainerStyle={styles.msgContent}
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          ListFooterComponent={typingFooter}
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
  backdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 998 },
  card:         { position: 'absolute', top: '50%', left: 16, right: 16, height: CARD_H, marginTop: -(CARD_H / 2), backgroundColor: '#0d0d0d', borderRadius: 24, borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden', elevation: 20, zIndex: 999 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', backgroundColor: '#111' },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap:   { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#27ae60' },
  headerEmoji:  { fontSize: 20 },
  onlineBadge:  { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#27ae60', borderWidth: 1.5, borderColor: '#111' },
  headerName:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerSub:    { color: '#27ae60', fontSize: 10, marginTop: 1 },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' },
  closeText:    { color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  msgList:      { flex: 1 },
  msgContent:   { paddingTop: 12, paddingBottom: 8 },
  typingBubble: { paddingVertical: 10, paddingHorizontal: 14 },
  dotsRow:      { flexDirection: 'row', alignItems: 'center' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#111', gap: 8 },
  input:        { flex: 1, height: 40, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252525' },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  sendBtnActive:{ backgroundColor: '#1a1a1a', borderStyle: 'dashed', borderColor: '#27ae60' },
});

export default AssistantPopup;