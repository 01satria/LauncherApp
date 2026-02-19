import React, {
  memo, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, TextInput, StatusBar, BackHandler,
  AppState, AppStateStatus, Image, Alert, Dimensions,
  PanResponder, GestureResponderEvent, NativeScrollEvent,
  NativeSyntheticEvent, Modal,
} from 'react-native';
import AssistantPopup from './AssistantPopup';
import { getCurrentTimePeriod } from '../utils/storage';
import { DEFAULT_ASSISTANT_AVATAR } from '../constants';

const { height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_H = StatusBar.currentHeight || 24;

const SNAP_CLOSED  = SCREEN_H;
const SNAP_HALF    = SCREEN_H * 0.55;
const SNAP_FULL    = STATUS_BAR_H + 8;
const SHEET_RADIUS = 24;

interface DashboardPopupProps {
  onClose: () => void;
  userName: string;
  assistantName: string;
  avatarSource: string | null;
}
type ToolView = null | 'weather' | 'money' | 'todo' | 'countdown';
interface TodoItem { id: string; text: string; done: boolean; }
interface CountdownItem { id: string; name: string; targetDate: string; }

let _todos: TodoItem[] = [];
let _countdowns: CountdownItem[] = [];
let _prevMessage = '';
type PreviewListener = () => void;
let _todoListener: PreviewListener | null = null;
let _cdListener: PreviewListener | null = null;

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const getClockStr = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
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
const daysLeft = (iso: string) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const t = new Date(iso); t.setHours(0,0,0,0);
  return Math.ceil((t.getTime() - now.getTime()) / 86400000);
};
const pad = (n: number) => n.toString().padStart(2, '0');

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOM DATE PICKER — pure React Native, no external deps
// ══════════════════════════════════════════════════════════════════════════════
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface DatePickerModalProps {
  visible: boolean;
  initialDate: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}

const DatePickerModal = memo(({ visible, initialDate, onConfirm, onCancel }: DatePickerModalProps) => {
  const today = new Date();
  const [year,  setYear]  = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [day,   setDay]   = useState(initialDate.getDate());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isPast = (d: number) => new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const handleConfirm = () => onConfirm(new Date(year, month, safeDay));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={dp.card} onPress={() => {}}>
          {/* Month / Year nav */}
          <View style={dp.nav}>
            <TouchableOpacity onPress={prevMonth} style={dp.navBtn}>
              <Text style={dp.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={dp.navTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navBtn}>
              <Text style={dp.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={dp.dowRow}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <Text key={d} style={dp.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={dp.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`e${i}`} style={dp.cell} />;
              const past     = isPast(d);
              const selected = d === safeDay;
              const todayMark = isToday(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[dp.cell, selected && dp.cellSelected, todayMark && !selected && dp.cellToday]}
                  onPress={() => { if (!past) setDay(d); }}
                  activeOpacity={past ? 1 : 0.7}
                  disabled={past}
                >
                  <Text style={[dp.cellTxt, past && dp.cellPast, selected && dp.cellTxtSel]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Year scroller */}
          <View style={dp.yearRow}>
            <Text style={dp.yearLabel}>Year:</Text>
            <TouchableOpacity onPress={() => setYear(y => y - 1)} style={dp.yearBtn}>
              <Text style={dp.yearArrow}>−</Text>
            </TouchableOpacity>
            <Text style={dp.yearNum}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(y => y + 1)} style={dp.yearBtn}>
              <Text style={dp.yearArrow}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Buttons */}
          <View style={dp.btnRow}>
            <TouchableOpacity style={dp.btnCancel} onPress={onCancel} activeOpacity={0.7}>
              <Text style={dp.btnCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.btnOk} onPress={handleConfirm} activeOpacity={0.7}>
              <Text style={dp.btnOkTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

const dp = StyleSheet.create({
  overlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  card:       { backgroundColor:'#141414', borderRadius:20, padding:20, width:320, borderWidth:1, borderColor:'#2a2a2a' },
  nav:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  navBtn:     { width:36, height:36, justifyContent:'center', alignItems:'center', backgroundColor:'#1e1e1e', borderRadius:18 },
  navArrow:   { color:'#fff', fontSize:22, lineHeight:26 },
  navTitle:   { color:'#fff', fontSize:16, fontWeight:'700' },
  dowRow:     { flexDirection:'row', marginBottom:6 },
  dowLabel:   { flex:1, textAlign:'center', color:'#555', fontSize:12, fontWeight:'600' },
  grid:       { flexDirection:'row', flexWrap:'wrap' },
  cell:       { width:`${100/7}%` as any, aspectRatio:1, justifyContent:'center', alignItems:'center', marginVertical:2 },
  cellSelected:{ backgroundColor:'#27ae60', borderRadius:20 },
  cellToday:  { borderWidth:1, borderColor:'#27ae60', borderRadius:20 },
  cellTxt:    { color:'#ddd', fontSize:14 },
  cellTxtSel: { color:'#fff', fontWeight:'700' },
  cellPast:   { color:'#333' },
  yearRow:    { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:14, gap:12 },
  yearLabel:  { color:'#777', fontSize:13 },
  yearBtn:    { width:32, height:32, backgroundColor:'#1e1e1e', borderRadius:16, justifyContent:'center', alignItems:'center' },
  yearArrow:  { color:'#fff', fontSize:18, lineHeight:22 },
  yearNum:    { color:'#fff', fontSize:16, fontWeight:'700', minWidth:44, textAlign:'center' },
  btnRow:     { flexDirection:'row', gap:10, marginTop:18 },
  btnCancel:  { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'#1e1e1e', alignItems:'center' },
  btnCancelTxt:{ color:'#aaa', fontSize:14, fontWeight:'600' },
  btnOk:      { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'#27ae60', alignItems:'center' },
  btnOkTxt:   { color:'#fff', fontSize:14, fontWeight:'700' },
});

// ══════════════════════════════════════════════════════════════════════════════
// WEATHER TOOL
// ══════════════════════════════════════════════════════════════════════════════
const weatherDesc = (c: number) => {
  if (c === 0) return 'Clear sky'; if (c <= 3) return 'Partly cloudy';
  if (c <= 9) return 'Foggy'; if (c <= 29) return 'Rain';
  if (c <= 39) return 'Snow'; if (c <= 69) return 'Drizzle / Rain';
  if (c <= 79) return 'Snow showers'; if (c <= 84) return 'Rain showers';
  return 'Thunderstorm';
};
const weatherIcon = (c: number) => {
  if (c === 0) return '☀️'; if (c <= 3) return '⛅'; if (c <= 9) return '🌫️';
  if (c <= 29) return '🌧️'; if (c <= 39) return '❄️'; if (c <= 69) return '🌦️';
  if (c <= 79) return '🌨️'; if (c <= 84) return '🌩️'; return '⛈️';
};

const WeatherTool = memo(() => {
  const [location, setLocation] = useState('');
  const [weather,  setWeather]  = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const fetchWeather = useCallback(async () => {
    if (!location.trim()) return;
    setLoading(true); setError(''); setWeather(null);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`);
      const gd  = await geo.json();
      if (!gd.results?.length) { setError('Location not found.'); setLoading(false); return; }
      const { latitude, longitude, name, country } = gd.results[0];
      const wr  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&timezone=auto`);
      const wd  = await wr.json();
      const code = wd.current.weathercode;
      setWeather({ city:`${name}, ${country}`, temp:Math.round(wd.current.temperature_2m),
        desc:weatherDesc(code), wind:Math.round(wd.current.windspeed_10m),
        humidity:wd.current.relativehumidity_2m, icon:weatherIcon(code) });
    } catch { setError('Failed to fetch weather.'); }
    setLoading(false);
  }, [location]);

  return (
    <View style={ts.container}>
      <Text style={ts.title}>🌤️ Weather</Text>
      <View style={ts.row}>
        <TextInput style={ts.input} value={location} onChangeText={setLocation}
          placeholder="Enter city name..." placeholderTextColor="#555"
          onSubmitEditing={fetchWeather} returnKeyType="search" />
        <TouchableOpacity style={ts.btn} onPress={fetchWeather} activeOpacity={0.7}>
          <Text style={ts.btnTxt}>Go</Text>
        </TouchableOpacity>
      </View>
      {loading && <Text style={ts.info}>Fetching weather...</Text>}
      {!!error  && <Text style={ts.error}>{error}</Text>}
      {weather  && (
        <View style={ws.card}>
          <Text style={ws.icon}>{weather.icon}</Text>
          <Text style={ws.city}>{weather.city}</Text>
          <Text style={ws.temp}>{weather.temp}°C</Text>
          <Text style={ws.desc}>{weather.desc}</Text>
          <View style={ws.detailRow}>
            <Text style={ws.detail}>💨 {weather.wind} km/h</Text>
            <Text style={ws.detail}>💧 {weather.humidity}%</Text>
          </View>
        </View>
      )}
    </View>
  );
});
const ws = StyleSheet.create({
  card:      { alignItems:'center', backgroundColor:'#0f1923', borderRadius:16, padding:20, marginTop:14 },
  icon:      { fontSize:52, marginBottom:4 },
  city:      { color:'#8ab4d4', fontSize:13, marginBottom:2 },
  temp:      { color:'#fff', fontSize:52, fontWeight:'200', letterSpacing:-2 },
  desc:      { color:'#aaa', fontSize:14, marginTop:2 },
  detailRow: { flexDirection:'row', gap:24, marginTop:12 },
  detail:    { color:'#8ab4d4', fontSize:13 },
});

// ══════════════════════════════════════════════════════════════════════════════
// MONEY TOOL
// ══════════════════════════════════════════════════════════════════════════════
const CURRENCIES = ['USD','EUR','IDR','GBP','JPY','CNY','SGD','AUD','KRW','MYR','THB','INR'];
const MoneyTool = memo(() => {
  const [from,    setFrom]    = useState('USD');
  const [to,      setTo]      = useState('IDR');
  const [amount,  setAmount]  = useState('1');
  const [result,  setResult]  = useState<string|null>(null);
  const [rate,    setRate]    = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const fetchExchange = useCallback(async () => {
    setLoading(true); setError(''); setResult(null); setRate(null);
    try {
      const res  = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('API error');
      const r   = data.rates[to];
      const val = parseFloat(amount || '1') * r;
      setRate(r.toLocaleString('en-US', { maximumFractionDigits:4 }));
      setResult(val.toLocaleString('en-US', { maximumFractionDigits:2 }));
    } catch { setError('Failed to fetch rate.'); }
    setLoading(false);
  }, [from, to, amount]);

  const CurrencyPicker = ({ value, onChange }: { value:string; onChange:(v:string)=>void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:4}}>
      {CURRENCIES.map(c => (
        <TouchableOpacity key={c} style={[ms.chip, value===c && ms.chipActive]}
          onPress={() => onChange(c)} activeOpacity={0.7}>
          <Text style={[ms.chipTxt, value===c && ms.chipTxtActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={ts.container}>
      <Text style={ts.title}>💱 Money Exchange</Text>
      <Text style={ts.label}>From</Text>
      <CurrencyPicker value={from} onChange={setFrom} />
      <Text style={ts.label}>To</Text>
      <CurrencyPicker value={to} onChange={setTo} />
      <View style={[ts.row, {marginTop:12}]}>
        <TextInput style={[ts.input,{flex:1}]} value={amount} onChangeText={setAmount}
          keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor="#555" />
        <TouchableOpacity style={ts.btn} onPress={fetchExchange} activeOpacity={0.7}>
          <Text style={ts.btnTxt}>See Exchange</Text>
        </TouchableOpacity>
      </View>
      {loading && <Text style={ts.info}>Loading...</Text>}
      {!!error  && <Text style={ts.error}>{error}</Text>}
      {result   && (
        <View style={ms.resultCard}>
          <Text style={ms.resultMain}>{amount} {from} = <Text style={ms.resultVal}>{result} {to}</Text></Text>
          <Text style={ms.rateLine}>1 {from} = {rate} {to}</Text>
        </View>
      )}
    </View>
  );
});
const ms = StyleSheet.create({
  chip:       { paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'#1e1e1e', marginRight:6, borderWidth:1, borderColor:'#333' },
  chipActive: { backgroundColor:'#1a3a2a', borderColor:'#27ae60' },
  chipTxt:    { color:'#aaa', fontSize:12, fontWeight:'600' },
  chipTxtActive:{ color:'#27ae60' },
  resultCard: { backgroundColor:'#0f1a14', borderRadius:14, padding:16, marginTop:12, borderWidth:1, borderColor:'#1c3a26' },
  resultMain: { color:'#ccc', fontSize:15 },
  resultVal:  { color:'#27ae60', fontWeight:'700' },
  rateLine:   { color:'#555', fontSize:12, marginTop:6 },
});

// ══════════════════════════════════════════════════════════════════════════════
// TODO TOOL
// ══════════════════════════════════════════════════════════════════════════════
const TodoTool = memo(() => {
  const [todos, setTodos] = useState<TodoItem[]>(() => [..._todos]);
  const [input, setInput] = useState('');

  const sync = (next: TodoItem[]) => {
    _todos = next; setTodos(next); _todoListener?.();
  };

  const addTodo = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    sync([..._todos, { id:makeId(), text, done:false }]);
    setInput('');
  }, [input]);

  const toggle = useCallback((id: string) => {
    sync(_todos.map(t => t.id===id ? {...t, done:!t.done} : t));
  }, []);

  const remove = useCallback((id: string) => {
    sync(_todos.filter(t => t.id!==id));
  }, []);

  return (
    <View style={ts.container}>
      <Text style={ts.title}>📝 To Do</Text>
      <View style={ts.row}>
        <TextInput style={ts.input} value={input} onChangeText={setInput}
          placeholder="Add a task..." placeholderTextColor="#555"
          onSubmitEditing={addTodo} returnKeyType="done" />
        <TouchableOpacity style={ts.btn} onPress={addTodo} activeOpacity={0.7}>
          <Text style={ts.btnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      {todos.length===0 && <Text style={ts.info}>No tasks yet. Add one!</Text>}
      {todos.map(t => (
        <View key={t.id} style={tod.item}>
          <TouchableOpacity onPress={() => toggle(t.id)} style={tod.checkWrap} activeOpacity={0.7}>
            <View style={[tod.check, t.done && tod.checkDone]}>
              {t.done && <Text style={tod.checkMark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <Text style={[tod.text, t.done && tod.textDone]} numberOfLines={2}>{t.text}</Text>
          <TouchableOpacity onPress={() => remove(t.id)} activeOpacity={0.7}>
            <Text style={tod.del}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
});
const tod = StyleSheet.create({
  item:     { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#1a1a1a', gap:10 },
  checkWrap:{ padding:2 },
  check:    { width:22, height:22, borderRadius:11, borderWidth:2, borderColor:'#27ae60', justifyContent:'center', alignItems:'center' },
  checkDone:{ backgroundColor:'#27ae60' },
  checkMark:{ color:'#fff', fontSize:12, fontWeight:'700' },
  text:     { flex:1, color:'#ddd', fontSize:14 },
  textDone: { color:'#555', textDecorationLine:'line-through' },
  del:      { color:'#555', fontSize:16, paddingHorizontal:4 },
});

// ══════════════════════════════════════════════════════════════════════════════
// COUNTDOWN TOOL
// ══════════════════════════════════════════════════════════════════════════════
const CountdownTool = memo(() => {
  const [countdowns,  setCountdowns] = useState<CountdownItem[]>(() => [..._countdowns]);
  const [name,        setName]       = useState('');
  const [pickedDate,  setPickedDate] = useState<Date|null>(null);
  const [pickerOpen,  setPickerOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 60_000);
    return () => clearInterval(id);
  }, []);

  const syncCd = (next: CountdownItem[]) => {
    _countdowns = next; setCountdowns(next); _cdListener?.();
  };

  const add = useCallback(() => {
    if (!name.trim())  { Alert.alert('Missing name', 'Please enter an event name.'); return; }
    if (!pickedDate)   { Alert.alert('Missing date', 'Please pick a date first.'); return; }
    syncCd([..._countdowns, { id:makeId(), name:name.trim(), targetDate:pickedDate.toISOString() }]);
    setName(''); setPickedDate(null);
  }, [name, pickedDate]);

  const remove = useCallback((id: string) => {
    syncCd(_countdowns.filter(c => c.id!==id));
  }, []);

  const dateLabel = pickedDate
    ? pickedDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : 'Pick a date';

  return (
    <View style={ts.container}>
      <Text style={ts.title}>⏳ Countdown</Text>

      <TextInput style={[ts.input, {marginBottom:10}]} value={name} onChangeText={setName}
        placeholder="Event name..." placeholderTextColor="#555" />

      <TouchableOpacity style={cdst.dateBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.7}>
        <Text style={cdst.dateBtnIcon}>📅</Text>
        <Text style={[cdst.dateBtnTxt, !pickedDate && {color:'#555'}]}>{dateLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[ts.btn, {marginTop:10, alignSelf:'stretch', alignItems:'center'}]}
        onPress={add} activeOpacity={0.7}>
        <Text style={ts.btnTxt}>Start Countdown</Text>
      </TouchableOpacity>

      {countdowns.length===0 && <Text style={ts.info}>No countdowns yet.</Text>}

      {countdowns.map(c => {
        const days = daysLeft(c.targetDate);
        const past = days < 0;
        return (
          <View key={c.id} style={cdst.item}>
            <View style={{flex:1}}>
              <Text style={cdst.name}>{c.name}</Text>
              <Text style={cdst.dateStr}>{new Date(c.targetDate).toDateString()}</Text>
            </View>
            <View style={[cdst.pill, past && cdst.pillPast]}>
              <Text style={[cdst.days, past && cdst.daysPast]}>
                {past ? `${Math.abs(days)}d ago` : days===0 ? 'Today!' : `${days}d`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => remove(c.id)} activeOpacity={0.7}>
              <Text style={tod.del}>✕</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Custom date picker modal — zero external deps */}
      <DatePickerModal
        visible={pickerOpen}
        initialDate={pickedDate || new Date()}
        onConfirm={(d) => { setPickedDate(d); setPickerOpen(false); }}
        onCancel={() => setPickerOpen(false)}
      />
    </View>
  );
});
const cdst = StyleSheet.create({
  dateBtn:   { flexDirection:'row', alignItems:'center', backgroundColor:'#1a1a1a', borderRadius:12, paddingHorizontal:14, paddingVertical:12, borderWidth:1, borderColor:'#2a2a2a', gap:8 },
  dateBtnIcon:{ fontSize:18 },
  dateBtnTxt:{ color:'#fff', fontSize:14 },
  item:      { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#1a1a1a', gap:10, marginTop:4 },
  name:      { color:'#ddd', fontSize:14, fontWeight:'600' },
  dateStr:   { color:'#555', fontSize:11, marginTop:2 },
  pill:      { backgroundColor:'#1a3a2a', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  pillPast:  { backgroundColor:'#2a0a0a' },
  days:      { color:'#27ae60', fontSize:13, fontWeight:'700' },
  daysPast:  { color:'#e05' },
});

// ─── Shared tool styles ───────────────────────────────────────────────────────
const ts = StyleSheet.create({
  container:{ paddingBottom:20 },
  title:    { color:'#fff', fontSize:17, fontWeight:'700', marginBottom:14 },
  row:      { flexDirection:'row', gap:8, alignItems:'center' },
  input:    { flex:1, height:42, backgroundColor:'#1a1a1a', borderRadius:12, paddingHorizontal:14, color:'#fff', fontSize:14, borderWidth:1, borderColor:'#2a2a2a' },
  btn:      { backgroundColor:'#27ae60', borderRadius:12, paddingHorizontal:16, paddingVertical:11 },
  btnTxt:   { color:'#fff', fontSize:13, fontWeight:'700' },
  label:    { color:'#666', fontSize:11, fontWeight:'600', marginBottom:6, marginTop:10, textTransform:'uppercase', letterSpacing:0.5 },
  info:     { color:'#555', fontSize:13, textAlign:'center', marginTop:20 },
  error:    { color:'#e05', fontSize:13, marginTop:10, textAlign:'center' },
});

// ─── Clock ─────────────────────────────────────────────────────────────────────
const Clock = memo(() => {
  const [time, setTime] = useState(getClockStr());
  useEffect(() => { const id = setInterval(() => setTime(getClockStr()), 10_000); return () => clearInterval(id); }, []);
  return <Text style={ds.clockText}>{time}</Text>;
});

// ─── Tool card ─────────────────────────────────────────────────────────────────
const ToolCard = memo(({ icon, label, onPress, preview }: {
  icon:string; label:string; onPress:()=>void; preview?:string;
}) => (
  <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.7}>
    <Text style={card.icon}>{icon}</Text>
    <Text style={card.label}>{label}</Text>
    {preview ? <Text style={card.preview} numberOfLines={2}>{preview}</Text> : null}
  </TouchableOpacity>
));
const card = StyleSheet.create({
  wrap:   { flex:1, backgroundColor:'#111', borderRadius:16, padding:14, borderWidth:1, borderColor:'#222', minHeight:92, justifyContent:'center' },
  icon:   { fontSize:26, marginBottom:4 },
  label:  { color:'#ddd', fontSize:12, fontWeight:'700' },
  preview:{ color:'#555', fontSize:10, marginTop:4, lineHeight:14 },
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD POPUP — draggable bottom sheet
// ══════════════════════════════════════════════════════════════════════════════
const DashboardPopup = memo(({ onClose, userName, assistantName, avatarSource }: DashboardPopupProps) => {
  const translateY     = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const snapTarget     = useRef(SNAP_HALF);
  const scrollRef      = useRef<ScrollView>(null);
  const scrollAtTop    = useRef(true);

  const [activeTool, setActiveTool] = useState<ToolView>(null);
  const [showChat,   setShowChat]   = useState(false);
  const [visible,    setVisible]    = useState(true);

  const [todoPrev, setTodoPrev] = useState<string|undefined>(() => {
    const p = _todos.filter(t => !t.done).length;
    return p ? `${p} task${p>1?'s':''} pending` : undefined;
  });
  const [cdPrev, setCdPrev] = useState<string|undefined>(() => {
    if (!_countdowns.length) return undefined;
    const c = _countdowns[0];
    const d = daysLeft(c.targetDate);
    return `${c.name}: ${d>=0?`${d}d left`:`${Math.abs(d)}d ago`}`;
  });

  useEffect(() => {
    _todoListener = () => {
      const p = _todos.filter(t => !t.done).length;
      setTodoPrev(p ? `${p} task${p>1?'s':''} pending` : undefined);
    };
    _cdListener = () => {
      if (!_countdowns.length) { setCdPrev(undefined); return; }
      const c = _countdowns[0];
      const d = daysLeft(c.targetDate);
      setCdPrev(`${c.name}: ${d>=0?`${d}d left`:`${Math.abs(d)}d ago`}`);
    };
    return () => { _todoListener = null; _cdListener = null; };
  }, []);

  const [assistantMsg, setAssistantMsg] = useState(() => {
    const msg = getAssistantMessage(userName, getCurrentTimePeriod());
    _prevMessage = msg; return msg;
  });
  const [msgChanged, setMsgChanged] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      const msg = getAssistantMessage(userName, getCurrentTimePeriod());
      if (msg !== _prevMessage) { _prevMessage = msg; setAssistantMsg(msg); setMsgChanged(true); }
    }, 60_000);
    return () => clearInterval(id);
  }, [userName]);

  // ── Snap ──────────────────────────────────────────────────────────────────
  const snapTo = useCallback((toValue: number, cb?: () => void) => {
    snapTarget.current = toValue;
    const opacity = toValue===SNAP_CLOSED ? 0 : toValue===SNAP_HALF ? 0.55 : 0.75;
    Animated.parallel([
      Animated.spring(translateY, { toValue, friction:22, tension:200, useNativeDriver:true }),
      Animated.timing(overlayOpacity, { toValue:opacity, duration:200, useNativeDriver:true }),
    ]).start(({ finished }) => { if (finished && cb) cb(); });
  }, []);

  useEffect(() => {
    translateY.setValue(SNAP_CLOSED);
    overlayOpacity.setValue(0);
    snapTo(SNAP_HALF);
  }, []); // eslint-disable-line

  const handleClose = useCallback(() => {
    snapTo(SNAP_CLOSED, () => { setVisible(false); onClose(); });
  }, [snapTo, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTool) { setActiveTool(null); return true; }
      handleClose(); return true;
    });
    return () => sub.remove();
  }, [handleClose, activeTool]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') handleClose();
    });
    return () => sub.remove();
  }, [handleClose]);

  // ── PanResponder ──────────────────────────────────────────────────────────
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_: GestureResponderEvent, gs) => {
      if (snapTarget.current === SNAP_FULL)
        return gs.dy > 0 && scrollAtTop.current && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;
      return Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2 && Math.abs(gs.dy) > 6;
    },
    onStartShouldSetPanResponder: () => false,
    onPanResponderGrant: () => {
      translateY.stopAnimation(); overlayOpacity.stopAnimation();
    },
    onPanResponderMove: (_: GestureResponderEvent, gs) => {
      let next = snapTarget.current + gs.dy;
      if (next < SNAP_FULL) next = SNAP_FULL + (next - SNAP_FULL) * 0.2;
      translateY.setValue(next);
      const ratio = 1 - (next - SNAP_FULL) / (SNAP_CLOSED - SNAP_FULL);
      overlayOpacity.setValue(Math.min(0.75, Math.max(0, ratio * 0.75)));
    },
    onPanResponderRelease: (_: GestureResponderEvent, gs) => {
      if (gs.vy > 0.8 && gs.dy > 30) { handleClose(); return; }
      if (gs.vy < -0.5) { snapTo(SNAP_FULL); return; }
      translateY.stopAnimation(val => {
        const mid = (SNAP_FULL + SNAP_HALF) / 2;
        if (val < mid) snapTo(SNAP_FULL);
        else if (val > SCREEN_H * 0.75) handleClose();
        else snapTo(SNAP_HALF);
      });
    },
    onPanResponderTerminate: () => snapTo(snapTarget.current),
  })).current;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollAtTop.current = e.nativeEvent.contentOffset.y <= 2;
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

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      {/* Dim overlay */}
      <Animated.View style={[ds.overlay, {opacity: overlayOpacity}]} pointerEvents="box-none">
        <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[ds.sheet, {transform:[{translateY}]}]}>

        {/* Pill handle */}
        <View style={ds.handleArea} {...panResponder.panHandlers}>
          <View style={ds.pill} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={ds.scroll}
          contentContainerStyle={ds.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={snapTarget.current === SNAP_FULL}
        >
          {/* Header: clock → avatar → message */}
          <View style={ds.headerCol}>
            <View style={ds.clockBox}>
              <Clock />
            </View>

            <TouchableOpacity style={ds.avatarWrap}
              onPress={() => { setMsgChanged(false); setShowChat(true); }}
              activeOpacity={0.8}>
              <View style={ds.avatarCircle}>
                <Image source={{uri: avatarSource || DEFAULT_ASSISTANT_AVATAR}} style={ds.avatar} />
              </View>
              {msgChanged && <View style={ds.badge} />}
            </TouchableOpacity>

            <View style={ds.msgBox}>
              <Text style={ds.msgText} numberOfLines={3}>{assistantMsg}</Text>
            </View>
          </View>

          {/* Tool grid or active tool */}
          {activeTool ? (
            <View>
              <TouchableOpacity style={ds.backBtn} onPress={() => setActiveTool(null)} activeOpacity={0.7}>
                <Text style={ds.backTxt}>← Back</Text>
              </TouchableOpacity>
              {activeTool==='weather'   && <WeatherTool />}
              {activeTool==='money'     && <MoneyTool />}
              {activeTool==='todo'      && <TodoTool />}
              {activeTool==='countdown' && <CountdownTool />}
            </View>
          ) : (
            <View style={ds.grid}>
              <View style={ds.gridRow}>
                <ToolCard icon="🌤️" label="Weather"       onPress={() => { setActiveTool('weather');   snapTo(SNAP_FULL); }} />
                <ToolCard icon="💱" label="Money Exchange" onPress={() => { setActiveTool('money');     snapTo(SNAP_FULL); }} />
              </View>
              <View style={ds.gridRow}>
                <ToolCard icon="📝" label="To Do"       preview={todoPrev} onPress={() => { setActiveTool('todo');      snapTo(SNAP_FULL); }} />
                <ToolCard icon="⏳" label="Countdown"   preview={cdPrev}   onPress={() => { setActiveTool('countdown'); snapTo(SNAP_FULL); }} />
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
});

const ds = StyleSheet.create({
  overlay:     { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#000' },
  sheet:       { position:'absolute', left:0, right:0, height:SCREEN_H, backgroundColor:'#0a0a0a', borderTopLeftRadius:SHEET_RADIUS, borderTopRightRadius:SHEET_RADIUS, borderWidth:1, borderColor:'#1e1e1e', borderBottomWidth:0, elevation:24 },
  handleArea:  { alignItems:'center', paddingTop:12, paddingBottom:10 },
  pill:        { width:40, height:4, borderRadius:2, backgroundColor:'#3a3a3a' },
  scroll:      { flex:1 },
  scrollContent:{ paddingHorizontal:20, paddingBottom:40 },
  headerCol:   { alignItems:'center', gap:12, marginBottom:20 },
  clockBox:    { width:'100%', backgroundColor:'#0e1a2e', borderRadius:12, paddingHorizontal:14, paddingVertical:10, borderWidth:1, borderColor:'#1a3a6a', alignItems:'center' },
  clockText:   { color:'#5ba3f5', fontSize:26, fontWeight:'300', letterSpacing:3, fontVariant:['tabular-nums'] as any },
  avatarWrap:  { position:'relative' },
  avatarCircle:{ width:72, height:72, borderRadius:36, overflow:'hidden', backgroundColor:'#1a1a1a', borderWidth:2.5, borderColor:'#27ae60' },
  avatar:      { width:'100%', height:'100%' },
  badge:       { position:'absolute', top:0, right:0, width:16, height:16, borderRadius:8, backgroundColor:'#ff3b30', borderWidth:2, borderColor:'#0a0a0a', zIndex:1 },
  msgBox:      { width:'100%', backgroundColor:'#0e2a1e', borderRadius:12, paddingHorizontal:14, paddingVertical:10, borderWidth:1, borderColor:'#1a4a2e' },
  msgText:     { color:'#7dd4a8', fontSize:12, lineHeight:18, textAlign:'center' },
  grid:        { gap:10 },
  gridRow:     { flexDirection:'row', gap:10 },
  backBtn:     { marginBottom:14 },
  backTxt:     { color:'#27ae60', fontSize:14, fontWeight:'600' },
});

export default DashboardPopup;