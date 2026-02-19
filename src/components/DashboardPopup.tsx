import React, {
  memo, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, TextInput, StatusBar, BackHandler,
  AppState, AppStateStatus, Image, Alert,
} from 'react-native';
import AssistantPopup, { hasUnreadMessages, setBadgeListener } from './AssistantPopup';
import { getCurrentTimePeriod } from '../utils/storage';
import { AppData } from '../types';
import { DEFAULT_ASSISTANT_AVATAR } from '../constants';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardPopupProps {
  onClose: () => void;
  userName: string;
  assistantName: string;
  avatarSource: string | null;
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface CountdownItem {
  id: string;
  name: string;
  targetDate: string; // ISO string
}

type ToolView = null | 'weather' | 'money' | 'todo' | 'countdown' | 'chat';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getClockStr = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getAssistantMessage = (userName: string, period: string): string => {
  switch (period) {
    case 'morning':    return `Good morning, ${userName}! ☀️ Rise and conquer the day. I'm always cheering for you! 😘`;
    case 'afternoon':  return `Take a break! 😊 Have you had lunch yet, ${userName}? Don't skip meals! 🍔`;
    case 'evening':    return `You must be tired, ${userName}. ☕ Go ahead and take a breather, okay? 🤗`;
    case 'night':      return `All done for the day? 🌙 Time to wind down and relax, ${userName}. You deserve it. 🥰`;
    case 'late_night': return `It's late, ${userName}. Put the phone down and get some rest! 😠 Your health comes first.`;
    default:           return `Hey ${userName}! 👋 How's everything going?`;
  }
};

// ─── Module-level todo & countdown state (RAM-only, lightweight) ──────────────
let _todos: TodoItem[] = [];
let _countdowns: CountdownItem[] = [];
let _lastPeriod = '';
let _prevMessage = '';

// ─── Weather Tool ─────────────────────────────────────────────────────────────
const WeatherTool = memo(() => {
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = useCallback(async () => {
    if (!location.trim()) return;
    setLoading(true); setError(''); setWeather(null);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();
      if (!geoData.results?.length) { setError('Location not found.'); setLoading(false); return; }
      const { latitude, longitude, name, country } = geoData.results[0];
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&timezone=auto`
      );
      const wData = await wRes.json();
      const code = wData.current.weathercode;
      const desc = weatherDesc(code);
      setWeather({
        city: `${name}, ${country}`,
        temp: Math.round(wData.current.temperature_2m),
        desc,
        wind: Math.round(wData.current.windspeed_10m),
        humidity: wData.current.relativehumidity_2m,
        icon: weatherIcon(code),
      });
    } catch { setError('Failed to fetch weather.'); }
    setLoading(false);
  }, [location]);

  const weatherDesc = (c: number) => {
    if (c === 0) return 'Clear sky';
    if (c <= 3) return 'Partly cloudy';
    if (c <= 9) return 'Foggy';
    if (c <= 19) return 'Drizzle';
    if (c <= 29) return 'Rain';
    if (c <= 39) return 'Snow';
    if (c <= 49) return 'Fog';
    if (c <= 59) return 'Drizzle';
    if (c <= 69) return 'Rain';
    if (c <= 79) return 'Snow';
    if (c <= 84) return 'Rain showers';
    if (c <= 94) return 'Thunderstorm';
    return 'Heavy thunderstorm';
  };

  const weatherIcon = (c: number) => {
    if (c === 0) return '☀️';
    if (c <= 3) return '⛅';
    if (c <= 9) return '🌫️';
    if (c <= 29) return '🌧️';
    if (c <= 39) return '❄️';
    if (c <= 69) return '🌦️';
    if (c <= 79) return '🌨️';
    if (c <= 84) return '🌩️';
    return '⛈️';
  };

  return (
    <View style={toolStyles.container}>
      <Text style={toolStyles.title}>🌤️ Weather</Text>
      <View style={toolStyles.row}>
        <TextInput
          style={toolStyles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter city name..."
          placeholderTextColor="#555"
          onSubmitEditing={fetchWeather}
          returnKeyType="search"
        />
        <TouchableOpacity style={toolStyles.btn} onPress={fetchWeather} activeOpacity={0.7}>
          <Text style={toolStyles.btnText}>Go</Text>
        </TouchableOpacity>
      </View>
      {loading && <Text style={toolStyles.info}>Fetching weather...</Text>}
      {error ? <Text style={toolStyles.error}>{error}</Text> : null}
      {weather && (
        <View style={weatherStyles.card}>
          <Text style={weatherStyles.icon}>{weather.icon}</Text>
          <Text style={weatherStyles.city}>{weather.city}</Text>
          <Text style={weatherStyles.temp}>{weather.temp}°C</Text>
          <Text style={weatherStyles.desc}>{weather.desc}</Text>
          <View style={weatherStyles.details}>
            <Text style={weatherStyles.detail}>💨 {weather.wind} km/h</Text>
            <Text style={weatherStyles.detail}>💧 {weather.humidity}%</Text>
          </View>
        </View>
      )}
    </View>
  );
});

const weatherStyles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: '#0f1923', borderRadius: 16, padding: 20, marginTop: 12 },
  icon: { fontSize: 52, marginBottom: 4 },
  city: { color: '#8ab4d4', fontSize: 13, marginBottom: 2 },
  temp: { color: '#fff', fontSize: 48, fontWeight: '200', letterSpacing: -2 },
  desc: { color: '#aaa', fontSize: 14, marginTop: 2 },
  details: { flexDirection: 'row', gap: 24, marginTop: 12 },
  detail: { color: '#8ab4d4', fontSize: 13 },
});

// ─── Money Exchange Tool ──────────────────────────────────────────────────────
const CURRENCIES = ['USD','EUR','IDR','GBP','JPY','CNY','SGD','AUD','KRW','MYR','THB','INR'];

const MoneyTool = memo(() => {
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('IDR');
  const [amount, setAmount] = useState('1');
  const [result, setResult] = useState<string | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchExchange = useCallback(async () => {
    setLoading(true); setError(''); setResult(null); setRate(null);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('API error');
      const r = data.rates[to];
      if (!r) throw new Error('Currency not found');
      const val = parseFloat(amount || '1') * r;
      setRate(r.toLocaleString('en-US', { maximumFractionDigits: 4 }));
      setResult(val.toLocaleString('en-US', { maximumFractionDigits: 2 }));
    } catch { setError('Failed to fetch exchange rate.'); }
    setLoading(false);
  }, [from, to, amount]);

  const CurrencyPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={moneyStyles.pickerRow}>
      {CURRENCIES.map(c => (
        <TouchableOpacity
          key={c}
          style={[moneyStyles.chip, value === c && moneyStyles.chipActive]}
          onPress={() => onChange(c)}
          activeOpacity={0.7}
        >
          <Text style={[moneyStyles.chipText, value === c && moneyStyles.chipTextActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={toolStyles.container}>
      <Text style={toolStyles.title}>💱 Money Exchange</Text>
      <Text style={toolStyles.label}>From</Text>
      <CurrencyPicker value={from} onChange={setFrom} />
      <Text style={toolStyles.label}>To</Text>
      <CurrencyPicker value={to} onChange={setTo} />
      <View style={[toolStyles.row, { marginTop: 12 }]}>
        <TextInput
          style={[toolStyles.input, { flex: 1 }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor="#555"
        />
        <TouchableOpacity style={toolStyles.btn} onPress={fetchExchange} activeOpacity={0.7}>
          <Text style={toolStyles.btnText}>See Exchange</Text>
        </TouchableOpacity>
      </View>
      {loading && <Text style={toolStyles.info}>Loading...</Text>}
      {error ? <Text style={toolStyles.error}>{error}</Text> : null}
      {result && (
        <View style={moneyStyles.resultCard}>
          <Text style={moneyStyles.resultMain}>{amount} {from} = <Text style={moneyStyles.resultValue}>{result} {to}</Text></Text>
          <Text style={moneyStyles.rateLine}>1 {from} = {rate} {to}</Text>
        </View>
      )}
    </View>
  );
});

const moneyStyles = StyleSheet.create({
  pickerRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e1e1e', marginRight: 6, borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: '#1a3a2a', borderColor: '#27ae60' },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#27ae60' },
  resultCard: { backgroundColor: '#0f1a14', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#1c3a26' },
  resultMain: { color: '#ccc', fontSize: 15 },
  resultValue: { color: '#27ae60', fontWeight: '700' },
  rateLine: { color: '#555', fontSize: 12, marginTop: 6 },
});

// ─── Todo Tool ────────────────────────────────────────────────────────────────
const TodoTool = memo(() => {
  const [todos, setTodos] = useState<TodoItem[]>(() => [..._todos]);
  const [input, setInput] = useState('');

  const addTodo = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const next = [...todos, { id: makeId(), text, done: false }];
    setTodos(next); _todos = next; setInput('');
  }, [input, todos]);

  const toggle = useCallback((id: string) => {
    const next = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(next); _todos = next;
  }, [todos]);

  const remove = useCallback((id: string) => {
    const next = todos.filter(t => t.id !== id);
    setTodos(next); _todos = next;
  }, [todos]);

  return (
    <View style={toolStyles.container}>
      <Text style={toolStyles.title}>📝 To Do</Text>
      <View style={toolStyles.row}>
        <TextInput
          style={toolStyles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Add a task..."
          placeholderTextColor="#555"
          onSubmitEditing={addTodo}
          returnKeyType="done"
        />
        <TouchableOpacity style={toolStyles.btn} onPress={addTodo} activeOpacity={0.7}>
          <Text style={toolStyles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={todoStyles.list} showsVerticalScrollIndicator={false}>
        {todos.length === 0 && <Text style={toolStyles.info}>No tasks yet. Add one!</Text>}
        {todos.map(t => (
          <View key={t.id} style={todoStyles.item}>
            <TouchableOpacity onPress={() => toggle(t.id)} style={todoStyles.checkWrap} activeOpacity={0.7}>
              <View style={[todoStyles.check, t.done && todoStyles.checkDone]}>
                {t.done && <Text style={todoStyles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={[todoStyles.text, t.done && todoStyles.textDone]} numberOfLines={2}>{t.text}</Text>
            <TouchableOpacity onPress={() => remove(t.id)} activeOpacity={0.7}>
              <Text style={todoStyles.del}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const todoStyles = StyleSheet.create({
  list: { maxHeight: 260, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 10 },
  checkWrap: { padding: 2 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#27ae60', justifyContent: 'center', alignItems: 'center' },
  checkDone: { backgroundColor: '#27ae60', borderColor: '#27ae60' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  text: { flex: 1, color: '#ddd', fontSize: 14 },
  textDone: { color: '#555', textDecorationLine: 'line-through' },
  del: { color: '#555', fontSize: 16, paddingHorizontal: 4 },
});

// ─── Countdown Tool ───────────────────────────────────────────────────────────
const CountdownTool = memo(() => {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(() => [..._countdowns]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const getDaysLeft = useCallback((iso: string) => {
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(iso); target.setHours(0,0,0,0);
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }, []);

  const addCountdown = useCallback(() => {
    if (!name.trim() || !date.trim()) return;
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) { Alert.alert('Invalid date', 'Please enter a valid date (YYYY-MM-DD)'); return; }
    const next = [...countdowns, { id: makeId(), name: name.trim(), targetDate: parsed.toISOString() }];
    setCountdowns(next); _countdowns = next;
    setName(''); setDate('');
  }, [name, date, countdowns]);

  const remove = useCallback((id: string) => {
    const next = countdowns.filter(c => c.id !== id);
    setCountdowns(next); _countdowns = next;
  }, [countdowns]);

  return (
    <View style={toolStyles.container}>
      <Text style={toolStyles.title}>⏳ Countdown</Text>
      <TextInput
        style={[toolStyles.input, { marginBottom: 8 }]}
        value={name}
        onChangeText={setName}
        placeholder="Event name..."
        placeholderTextColor="#555"
      />
      <View style={toolStyles.row}>
        <TextInput
          style={toolStyles.input}
          value={date}
          onChangeText={setDate}
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor="#555"
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={toolStyles.btn} onPress={addCountdown} activeOpacity={0.7}>
          <Text style={toolStyles.btnText}>Start</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={cdStyles.list} showsVerticalScrollIndicator={false}>
        {countdowns.length === 0 && <Text style={toolStyles.info}>No countdowns yet.</Text>}
        {countdowns.map(c => {
          const days = getDaysLeft(c.targetDate);
          const past = days < 0;
          return (
            <View key={c.id} style={cdStyles.item}>
              <View style={cdStyles.info}>
                <Text style={cdStyles.eventName}>{c.name}</Text>
                <Text style={cdStyles.targetDate}>{new Date(c.targetDate).toDateString()}</Text>
              </View>
              <View style={cdStyles.daysWrap}>
                <Text style={[cdStyles.days, past && cdStyles.daysPast]}>
                  {past ? `${Math.abs(days)}d ago` : days === 0 ? 'Today!' : `${days}d`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => remove(c.id)} activeOpacity={0.7}>
                <Text style={todoStyles.del}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

const cdStyles = StyleSheet.create({
  list: { maxHeight: 240, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 10 },
  info: { flex: 1 },
  eventName: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  targetDate: { color: '#555', fontSize: 11, marginTop: 2 },
  daysWrap: { backgroundColor: '#1a3a2a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  days: { color: '#27ae60', fontSize: 14, fontWeight: '700' },
  daysPast: { color: '#e05' },
});

// ─── Tool button shared styles ─────────────────────────────────────────────────
const toolStyles = StyleSheet.create({
  container: { flex: 1, padding: 4 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 40, backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  btn: { backgroundColor: '#27ae60', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  label: { color: '#666', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  info: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 },
  error: { color: '#e05', fontSize: 13, marginTop: 10, textAlign: 'center' },
});

// ─── Tool card ─────────────────────────────────────────────────────────────────
interface ToolCardProps {
  icon: string;
  label: string;
  onPress: () => void;
  preview?: string;
}

const ToolCard = memo(({ icon, label, onPress, preview }: ToolCardProps) => (
  <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.7}>
    <Text style={cardStyles.icon}>{icon}</Text>
    <Text style={cardStyles.label}>{label}</Text>
    {preview ? <Text style={cardStyles.preview} numberOfLines={2}>{preview}</Text> : null}
  </TouchableOpacity>
));

const cardStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#111', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#222', minHeight: 90, justifyContent: 'center' },
  icon: { fontSize: 26, marginBottom: 4 },
  label: { color: '#ddd', fontSize: 12, fontWeight: '700' },
  preview: { color: '#555', fontSize: 10, marginTop: 4, lineHeight: 14 },
});

// ─── Clock ────────────────────────────────────────────────────────────────────
const Clock = memo(() => {
  const [time, setTime] = useState(getClockStr());
  useEffect(() => {
    const id = setInterval(() => setTime(getClockStr()), 10_000);
    return () => clearInterval(id);
  }, []);
  return <Text style={dashStyles.clockText}>{time}</Text>;
});

// ─── DashboardPopup ───────────────────────────────────────────────────────────
const DashboardPopup = memo(({ onClose, userName, assistantName, avatarSource }: DashboardPopupProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [activeTool, setActiveTool] = useState<ToolView>(null);
  const [showChat, setShowChat] = useState(false);
  const [period, setPeriod] = useState(() => getCurrentTimePeriod());
  const [assistantMsg, setAssistantMsg] = useState(() => {
    const p = getCurrentTimePeriod();
    const msg = getAssistantMessage(userName, p);
    _prevMessage = msg; _lastPeriod = p;
    return msg;
  });
  const [msgChanged, setMsgChanged] = useState(false);

  // Update period & message every minute
  useEffect(() => {
    const id = setInterval(() => {
      const p = getCurrentTimePeriod();
      const msg = getAssistantMessage(userName, p);
      if (msg !== _prevMessage) {
        _prevMessage = msg; _lastPeriod = p;
        setAssistantMsg(msg);
        setMsgChanged(true);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [userName]);

  // Fade + slide in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
    return () => { fadeAnim.stopAnimation(); slideAnim.stopAnimation(); };
  }, []);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 30, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  // Hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTool) { setActiveTool(null); return true; }
      handleClose(); return true;
    });
    return () => sub.remove();
  }, [handleClose, activeTool]);

  // Auto-close on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') handleClose();
    });
    return () => sub.remove();
  }, [handleClose]);

  const openTool = useCallback((tool: ToolView) => {
    if (tool === 'chat') { setShowChat(true); return; }
    setActiveTool(tool);
  }, []);

  const backToHome = useCallback(() => setActiveTool(null), []);

  // Countdown preview
  const countdownPreview = useMemo(() => {
    if (_countdowns.length === 0) return undefined;
    const c = _countdowns[0];
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(c.targetDate); target.setHours(0,0,0,0);
    const days = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    return `${c.name}: ${days >= 0 ? `${days}d left` : `${Math.abs(days)}d ago`}`;
  }, []);

  // Todo preview
  const todoPreview = useMemo(() => {
    const pending = _todos.filter(t => !t.done);
    if (pending.length === 0) return undefined;
    return `${pending.length} task${pending.length > 1 ? 's' : ''} pending`;
  }, []);

  if (showChat) {
    return (
      <AssistantPopup
        onClose={() => setShowChat(false)}
        userName={userName}
        assistantName={assistantName}
        avatarSource={avatarSource || DEFAULT_ASSISTANT_AVATAR}
      />
    );
  }

  return (
    <Animated.View style={[dashStyles.overlay, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Close strip at top */}
      <TouchableOpacity style={dashStyles.closeStrip} onPress={handleClose} activeOpacity={1} />

      <Animated.View style={[dashStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Header row */}
        <View style={dashStyles.header}>
          {/* Avatar */}
          <TouchableOpacity
            style={dashStyles.avatarWrap}
            onPress={() => { setMsgChanged(false); openTool('chat'); }}
            activeOpacity={0.8}
          >
            <View style={dashStyles.avatarCircle}>
              <Image
                source={{ uri: avatarSource || DEFAULT_ASSISTANT_AVATAR }}
                style={dashStyles.avatar}
              />
            </View>
            {msgChanged && <View style={dashStyles.badge} />}
          </TouchableOpacity>

          {/* Right side: clock + message */}
          <View style={dashStyles.headerRight}>
            <View style={dashStyles.clockBox}>
              <Clock />
            </View>
            <View style={dashStyles.msgBox}>
              <Text style={dashStyles.msgText} numberOfLines={2}>{assistantMsg}</Text>
            </View>
          </View>
        </View>

        {/* Tool content or grid */}
        {activeTool ? (
          <View style={dashStyles.toolArea}>
            <TouchableOpacity style={dashStyles.backBtn} onPress={backToHome} activeOpacity={0.7}>
              <Text style={dashStyles.backTxt}>← Back</Text>
            </TouchableOpacity>
            {activeTool === 'weather' && <WeatherTool />}
            {activeTool === 'money' && <MoneyTool />}
            {activeTool === 'todo' && <TodoTool />}
            {activeTool === 'countdown' && <CountdownTool />}
          </View>
        ) : (
          <View style={dashStyles.toolGrid}>
            <View style={dashStyles.toolRow}>
              <ToolCard icon="🌤️" label="Weather" onPress={() => openTool('weather')} />
              <ToolCard icon="💱" label="Money Exchange" onPress={() => openTool('money')} />
            </View>
            <View style={dashStyles.toolRow}>
              <ToolCard icon="📝" label="To Do" onPress={() => openTool('todo')} preview={todoPreview} />
              <ToolCard icon="⏳" label="Countdown" onPress={() => openTool('countdown')} preview={countdownPreview} />
            </View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

const dashStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900, justifyContent: 'flex-end' },
  closeStrip: { flex: 1 },
  sheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, minHeight: 420, borderWidth: 1, borderColor: '#1a1a1a', borderBottomWidth: 0 },
  header: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  avatarWrap: { position: 'relative', alignSelf: 'flex-start' },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#27ae60' },
  avatar: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff3b30', borderWidth: 2, borderColor: '#0a0a0a', zIndex: 1 },
  headerRight: { flex: 1, gap: 8 },
  clockBox: { backgroundColor: '#0e1a2e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1a3a6a' },
  clockText: { color: '#5ba3f5', fontSize: 22, fontWeight: '300', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  msgBox: { backgroundColor: '#0e2a1e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1a4a2e' },
  msgText: { color: '#7dd4a8', fontSize: 12, lineHeight: 18 },
  toolGrid: { gap: 10 },
  toolRow: { flexDirection: 'row', gap: 10 },
  toolArea: { flex: 1 },
  backBtn: { marginBottom: 12 },
  backTxt: { color: '#27ae60', fontSize: 14, fontWeight: '600' },
});

export default DashboardPopup;