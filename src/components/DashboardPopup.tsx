import React, {
  memo, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, StatusBar, BackHandler,
  AppState, AppStateStatus, Image, Alert, Modal,
} from 'react-native';
import RNFS from 'react-native-fs';
import AssistantPopup from './AssistantPopup';
import { getCurrentTimePeriod, saveTodos, loadTodos, saveCountdowns, loadCountdowns } from '../utils/storage';
import { DEFAULT_ASSISTANT_AVATAR } from '../constants';

const STATUS_BAR_H = StatusBar.currentHeight || 24;

interface DashboardPopupProps {
  onClose: () => void;
  userName: string;
  assistantName: string;
  avatarSource: string | null;
}
type ToolView = null | 'weather' | 'money' | 'todo' | 'countdown';
interface TodoItem { id: string; text: string; done: boolean; }
interface CountdownItem { id: string; name: string; targetDate: string; }

// Module-level state — survives re-renders, zero re-allocation
let _todos: TodoItem[] = [];
let _countdowns: CountdownItem[] = [];
let _prevMessage = '';
type PreviewListener = () => void;
let _todoListener: PreviewListener | null = null;
let _cdListener:   PreviewListener | null = null;

const makeId     = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const getClockStr = () => { const d=new Date(); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; };
const getAssistantMessage = (userName: string, period: string): string => {
  switch (period) {
    case 'morning':    return `Good morning, ${userName}! ☀️ Rise and conquer the day. I'm always cheering for you! 😘`;
    case 'afternoon':  return `Take a break! 😊 Have you had lunch yet, ${userName}? Don't skip meals! 🍔`;
    case 'evening':    return `You must be tired, ${userName}. ☕ Go ahead and take a breather, okay? 🤗`;
    case 'night':      return `All done for the day? 🌙 Time to wind down and relax, ${userName}. You deserve it. 🥰`;
    case 'late_night': return `It\'s late, ${userName}. Put the phone down and get some rest! 😠 Your health comes first.`;
    default:           return `Hey ${userName}! 👋 How\'s everything going?`;
  }
};
const daysLeft = (iso: string) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const t = new Date(iso); t.setHours(0,0,0,0);
  return Math.ceil((t.getTime() - now.getTime()) / 86400000);
};

// ──────────────────────────────────────────────────────────────────────────────
// DATE PICKER MODAL
// ──────────────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW    = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface DatePickerModalProps {
  visible: boolean;
  initialDate: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}

const DatePickerModal = memo(({ visible, initialDate, onConfirm, onCancel }: DatePickerModalProps) => {
  const today = useRef(new Date()).current;  // stable ref, not recreated
  const [year,  setYear]  = useState(() => initialDate.getFullYear());
  const [month, setMonth] = useState(() => initialDate.getMonth());
  const [day,   setDay]   = useState(() => initialDate.getDate());

  // Derived — computed inline, no extra state
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const safeDay     = Math.min(day, daysInMonth);
  const firstDow    = new Date(year, month, 1).getDay();

  // Build cells array — memoized so it only recalculates on month/year change
  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstDow, daysInMonth]);

  const prevMonth = useCallback(() => {
    if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
  }, [month]);
  const nextMonth = useCallback(() => {
    if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
  }, [month]);
  const handleConfirm = useCallback(() => onConfirm(new Date(year, month, safeDay)), [year, month, safeDay, onConfirm]);

  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
  const todayMs = today.getTime();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={dp.card} onPress={NOOP}>
          <View style={dp.nav}>
            <TouchableOpacity onPress={prevMonth} style={dp.navBtn}><Text style={dp.navArrow}>‹</Text></TouchableOpacity>
            <Text style={dp.navTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navBtn}><Text style={dp.navArrow}>›</Text></TouchableOpacity>
          </View>
          <View style={dp.dowRow}>
            {DOW.map(d => <Text key={d} style={dp.dowLabel}>{d}</Text>)}
          </View>
          <View style={dp.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`e${i}`} style={dp.cell} />;
              const past     = new Date(year, month, d).getTime() < new Date(todayY, todayM, todayD).getTime();
              const selected = d === safeDay;
              const isTodayD = d === todayD && month === todayM && year === todayY;
              return (
                <TouchableOpacity
                  key={d}
                  style={[dp.cell, selected && dp.cellSelected, isTodayD && !selected && dp.cellToday]}
                  onPress={() => { if (!past) setDay(d); }}
                  activeOpacity={past ? 1 : 0.7}
                  disabled={past}
                >
                  <Text style={[dp.cellTxt, past && dp.cellPast, selected && dp.cellTxtSel]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={dp.yearRow}>
            <Text style={dp.yearLabel}>Year:</Text>
            <TouchableOpacity onPress={() => setYear(y => y-1)} style={dp.yearBtn}><Text style={dp.yearArrow}>−</Text></TouchableOpacity>
            <Text style={dp.yearNum}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(y => y+1)} style={dp.yearBtn}><Text style={dp.yearArrow}>+</Text></TouchableOpacity>
          </View>
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

// Stable no-op — avoids creating inline arrow on every render
const NOOP = () => {};

const dp = StyleSheet.create({
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  card:        { backgroundColor:'#141414', borderRadius:20, padding:20, width:320 },
  nav:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  navBtn:      { width:36, height:36, justifyContent:'center', alignItems:'center', backgroundColor:'#1e1e1e', borderRadius:18 },
  navArrow:    { color:'#fff', fontSize:22, lineHeight:26 },
  navTitle:    { color:'#fff', fontSize:16, fontWeight:'700' },
  dowRow:      { flexDirection:'row', marginBottom:6 },
  dowLabel:    { flex:1, textAlign:'center', color:'#555', fontSize:12, fontWeight:'600' },
  grid:        { flexDirection:'row', flexWrap:'wrap' },
  cell:        { width:`${100/7}%` as any, aspectRatio:1, justifyContent:'center', alignItems:'center', marginVertical:2 },
  cellSelected:{ backgroundColor:'#27ae60', borderRadius:20 },
  cellToday:   { borderWidth:1, borderColor:'#27ae60', borderRadius:20 },
  cellTxt:     { color:'#ddd', fontSize:14 },
  cellTxtSel:  { color:'#fff', fontWeight:'700' },
  cellPast:    { color:'#333' },
  yearRow:     { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:14, gap:12 },
  yearLabel:   { color:'#777', fontSize:13 },
  yearBtn:     { width:32, height:32, backgroundColor:'#1e1e1e', borderRadius:16, justifyContent:'center', alignItems:'center' },
  yearArrow:   { color:'#fff', fontSize:18, lineHeight:22 },
  yearNum:     { color:'#fff', fontSize:16, fontWeight:'700', minWidth:44, textAlign:'center' },
  btnRow:      { flexDirection:'row', gap:10, marginTop:18 },
  btnCancel:   { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'#1e1e1e', alignItems:'center' },
  btnCancelTxt:{ color:'#aaa', fontSize:14, fontWeight:'600' },
  btnOk:       { flex:1, paddingVertical:12, borderRadius:12, backgroundColor:'#27ae60', alignItems:'center' },
  btnOkTxt:    { color:'#fff', fontSize:14, fontWeight:'700' },
});

// ──────────────────────────────────────────────────────────────────────────────
// WEATHER TOOL
// ──────────────────────────────────────────────────────────────────────────────
const weatherDesc = (c: number) => {
  if (c===0) return 'Clear sky'; if (c<=3) return 'Partly cloudy';
  if (c<=9) return 'Foggy'; if (c<=29) return 'Rain'; if (c<=39) return 'Snow';
  if (c<=69) return 'Drizzle / Rain'; if (c<=79) return 'Snow showers';
  if (c<=84) return 'Rain showers'; return 'Thunderstorm';
};
const weatherIcon = (c: number) => {
  if (c===0) return '☀️'; if (c<=3) return '⛅'; if (c<=9) return '🌫️';
  if (c<=29) return '🌧️'; if (c<=39) return '❄️'; if (c<=69) return '🌦️';
  if (c<=79) return '🌨️'; if (c<=84) return '🌩️'; return '⛈️';
};

const WEATHER_LOCATIONS_PATH = `${RNFS.DocumentDirectoryPath}/satrialauncher/weather_locations.json`;
const MAX_WEATHER_LOCATIONS  = 8;

// Weather result type — avoids `any` which bypasses memo comparison
interface WeatherResult {
  city: string; temp: number; desc: string; wind: number;
  humidity: number; icon: string; rawQuery: string;
  forecast: ForecastItem[];
}
interface ForecastItem {
  label: string; temp: number; icon: string; pop: number; isNow: boolean;
}

const WeatherTool = memo(() => {
  const [location,       setLocation]       = useState('');
  const [weather,        setWeather]        = useState<WeatherResult|null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [showSaved,      setShowSaved]      = useState(false);

  useEffect(() => {
    RNFS.exists(WEATHER_LOCATIONS_PATH).then(exists => {
      if (!exists) return;
      RNFS.readFile(WEATHER_LOCATIONS_PATH, 'utf8').then(data => {
        try { setSavedLocations(JSON.parse(data)); } catch {}
      });
    });
  }, []);

  const writeLocs = useCallback((locs: string[]) => {
    RNFS.writeFile(WEATHER_LOCATIONS_PATH, JSON.stringify(locs), 'utf8').catch(NOOP);
  }, []);

  const addCurrentLocation = useCallback((cityName: string) => {
    setSavedLocations(prev => {
      if (prev.includes(cityName) || prev.length >= MAX_WEATHER_LOCATIONS) return prev;
      const next = [...prev, cityName];
      RNFS.writeFile(WEATHER_LOCATIONS_PATH, JSON.stringify(next), 'utf8').catch(NOOP);
      return next;
    });
  }, []);

  const removeLocation = useCallback((loc: string) => {
    setSavedLocations(prev => {
      const next = prev.filter(l => l !== loc);
      RNFS.writeFile(WEATHER_LOCATIONS_PATH, JSON.stringify(next), 'utf8').catch(NOOP);
      return next;
    });
  }, []);

  const fetchWeather = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? location).trim();
    if (!query) return;
    setLoading(true); setError(''); setWeather(null); setShowSaved(false);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
      const gd  = await geo.json();
      if (!gd.results?.length) { setError('Location not found.'); setLoading(false); return; }
      const { latitude, longitude, name, country } = gd.results[0];
      const wr  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&hourly=temperature_2m,weathercode,precipitation_probability&forecast_days=2&timezone=auto`);
      const wd  = await wr.json();

      const times: string[] = wd.hourly.time;
      const temps: number[] = wd.hourly.temperature_2m;
      const codes: number[] = wd.hourly.weathercode;
      const pops:  number[] = wd.hourly.precipitation_probability;
      const todayStr    = new Date().toISOString().slice(0, 10);
      const currentHour = new Date().getHours();

      // Build forecast array — only future hours of today
      const forecast: ForecastItem[] = [];
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (!t.startsWith(todayStr)) continue;
        const h = parseInt(t.slice(11, 13), 10);
        if (h < currentHour) continue;  // skip past — no isPast objects in memory
        forecast.push({ label:`${h.toString().padStart(2,'0')}:00`, temp:Math.round(temps[i]), icon:weatherIcon(codes[i]), pop:pops[i]??0, isNow:h===currentHour });
      }

      const code = wd.current.weathercode;
      setWeather({ city:`${name}, ${country}`, temp:Math.round(wd.current.temperature_2m),
        desc:weatherDesc(code), wind:Math.round(wd.current.windspeed_10m),
        humidity:wd.current.relativehumidity_2m, icon:weatherIcon(code),
        rawQuery:query, forecast });
    } catch { setError('Failed to fetch weather.'); }
    setLoading(false);
  }, [location]);

  // Derived flags — no useState needed
  const canSave    = !!weather && savedLocations.length < MAX_WEATHER_LOCATIONS && !savedLocations.includes(weather.rawQuery);
  const alreadySaved = !!weather && savedLocations.includes(weather.rawQuery);
  const limitHit   = !!weather && !canSave && !alreadySaved && savedLocations.length >= MAX_WEATHER_LOCATIONS;

  return (
    <View style={ts.container}>
      <Text style={ts.title}>🌤️ Weather</Text>
      <View style={ts.row}>
        <TextInput style={ts.input} value={location} onChangeText={setLocation}
          placeholder="Enter city name..." placeholderTextColor="#555"
          onSubmitEditing={() => fetchWeather()} returnKeyType="search" />
        <TouchableOpacity style={ts.btn} onPress={() => fetchWeather()} activeOpacity={0.7}>
          <Text style={ts.btnTxt}>Go</Text>
        </TouchableOpacity>
      </View>

      {savedLocations.length > 0 && (
        <TouchableOpacity style={ws.savedToggle} onPress={() => setShowSaved(v => !v)} activeOpacity={0.7}>
          <Text style={ws.savedToggleTxt}>📌 Saved ({savedLocations.length}/{MAX_WEATHER_LOCATIONS})</Text>
          <Text style={ws.savedToggleArrow}>{showSaved ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      )}
      {showSaved && (
        <View style={ws.savedList}>
          {savedLocations.map(loc => (
            <View key={loc} style={ws.savedItem}>
              <TouchableOpacity style={ws.savedItemBtn} onPress={() => fetchWeather(loc)} activeOpacity={0.7}>
                <Text style={ws.savedItemTxt} numberOfLines={1}>📍 {loc}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeLocation(loc)} activeOpacity={0.7} style={ws.savedDeleteBtn}>
                <Text style={ws.savedDeleteTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {loading   && <Text style={ts.info}>Fetching weather...</Text>}
      {!!error   && <Text style={ts.error}>{error}</Text>}

      {weather && (
        <View style={ws.card}>
          <Text style={ws.icon}>{weather.icon}</Text>
          <Text style={ws.city}>{weather.city}</Text>
          <Text style={ws.temp}>{weather.temp}°C</Text>
          <Text style={ws.desc}>{weather.desc}</Text>
          <View style={ws.detailRow}>
            <Text style={ws.detail}>💨 {weather.wind} km/h</Text>
            <Text style={ws.detail}>💧 {weather.humidity}%</Text>
          </View>
          {canSave && (
            <TouchableOpacity style={ws.saveBtn} onPress={() => addCurrentLocation(weather!.rawQuery)} activeOpacity={0.7}>
              <Text style={ws.saveBtnTxt}>+ Save Location</Text>
            </TouchableOpacity>
          )}
          {alreadySaved && <Text style={ws.savedBadge}>✓ Saved</Text>}
          {limitHit     && <Text style={ws.savedBadge}>⚠ Max {MAX_WEATHER_LOCATIONS} locations</Text>}
        </View>
      )}

      {weather && weather.forecast.length > 0 && (
        <View style={ws.forecastWrap}>
          <Text style={ws.forecastTitle}>Today's Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ws.forecastScroll}>
            {weather.forecast.map(f => (
              <View key={f.label} style={[ws.forecastItem, f.isNow && ws.forecastItemNow]}>
                <Text style={[ws.forecastTime, f.isNow && ws.forecastTimeNow]}>{f.label}</Text>
                <Text style={ws.forecastIcon}>{f.icon}</Text>
                <Text style={[ws.forecastTemp, f.isNow && ws.forecastTempNow]}>{f.temp}°</Text>
                {f.pop > 0 && <Text style={ws.forecastPopTxt}>💧{f.pop}%</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});
const ws = StyleSheet.create({
  card:            { alignItems:'center', backgroundColor:'#141414', borderRadius:16, padding:20, marginTop:14 },
  icon:            { fontSize:52, marginBottom:4 },
  city:            { color:'#8e8e93', fontSize:13, marginBottom:2 },
  temp:            { color:'#fff', fontSize:52, fontWeight:'200', letterSpacing:-2 },
  desc:            { color:'#8e8e93', fontSize:14, marginTop:2 },
  detailRow:       { flexDirection:'row', gap:24, marginTop:12 },
  detail:          { color:'#8e8e93', fontSize:13 },
  saveBtn:         { marginTop:14, backgroundColor:'#2c2c2e', borderRadius:10, paddingVertical:9, paddingHorizontal:20 },
  saveBtnTxt:      { color:'#fff', fontSize:14, fontWeight:'500' },
  savedBadge:      { marginTop:12, color:'#8e8e93', fontSize:12 },
  savedToggle:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#1c1c1e', borderRadius:10, paddingVertical:10, paddingHorizontal:14, marginTop:10 },
  savedToggleTxt:  { color:'#ccc', fontSize:14, fontWeight:'500' },
  savedToggleArrow:{ color:'#666', fontSize:11 },
  savedList:       { backgroundColor:'#1c1c1e', borderRadius:10, marginTop:4, overflow:'hidden' },
  savedItem:       { flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#2c2c2e' },
  savedItemBtn:    { flex:1, paddingVertical:11, paddingHorizontal:14 },
  savedItemTxt:    { color:'#ddd', fontSize:14 },
  savedDeleteBtn:  { paddingVertical:11, paddingHorizontal:14 },
  savedDeleteTxt:  { color:'#ff453a', fontSize:14, fontWeight:'500' },
  forecastWrap:    { marginTop:14, backgroundColor:'#141414', borderRadius:16, paddingTop:12, paddingBottom:10 },
  forecastTitle:   { color:'#8e8e93', fontSize:11, fontWeight:'600', letterSpacing:0.5, paddingHorizontal:14, marginBottom:10, textTransform:'uppercase' },
  forecastScroll:  { paddingHorizontal:10, gap:6 },
  forecastItem:    { alignItems:'center', backgroundColor:'#1c1c1e', borderRadius:12, paddingVertical:10, paddingHorizontal:8, width:60 },
  forecastItemNow: { backgroundColor:'#2c2c2e', borderWidth:1, borderColor:'#444' },
  forecastTime:    { color:'#666', fontSize:10, marginBottom:5 },
  forecastTimeNow: { color:'#fff', fontWeight:'700' },
  forecastIcon:    { fontSize:20, marginBottom:4 },
  forecastTemp:    { color:'#ccc', fontSize:14, fontWeight:'400' },
  forecastTempNow: { color:'#fff', fontWeight:'700' },
  forecastPopTxt:  { color:'#8e8e93', fontSize:9, marginTop:3 },
});

// ──────────────────────────────────────────────────────────────────────────────
// MONEY TOOL
// ──────────────────────────────────────────────────────────────────────────────
const CURRENCIES = ['USD','EUR','IDR','GBP','JPY','CNY','SGD','AUD','KRW','MYR','THB','INR'];

// CurrencyPicker extracted and memoized — won't re-render unless value changes
const CurrencyPicker = memo(({ value, onChange }: { value:string; onChange:(v:string)=>void }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={CPS.scroll}>
    {CURRENCIES.map(c => (
      <TouchableOpacity key={c} style={[ms.chip, value===c && ms.chipActive]} onPress={() => onChange(c)} activeOpacity={0.7}>
        <Text style={[ms.chipTxt, value===c && ms.chipTxtActive]}>{c}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
));
const CPS = StyleSheet.create({ scroll: { marginBottom:4 } });

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
      if (data.result !== 'success') throw new Error();
      const r = data.rates[to];
      setRate(r.toLocaleString('en-US', { maximumFractionDigits:4 }));
      setResult((parseFloat(amount||'1')*r).toLocaleString('en-US', { maximumFractionDigits:2 }));
    } catch { setError('Failed to fetch rate.'); }
    setLoading(false);
  }, [from, to, amount]);

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
          <Text style={ts.btnTxt}>Convert</Text>
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
  chip:         { paddingHorizontal:13, paddingVertical:7, borderRadius:8, backgroundColor:'#1c1c1e', marginRight:6 },
  chipActive:   { backgroundColor:'#3a3a3c' },
  chipTxt:      { color:'#8e8e93', fontSize:13, fontWeight:'500' },
  chipTxtActive:{ color:'#fff' },
  resultCard:   { backgroundColor:'#1c1c1e', borderRadius:12, padding:16, marginTop:12 },
  resultMain:   { color:'#ccc', fontSize:15 },
  resultVal:    { color:'#fff', fontWeight:'600' },
  rateLine:     { color:'#555', fontSize:12, marginTop:6 },
});

// ──────────────────────────────────────────────────────────────────────────────
// TODO TOOL
// ──────────────────────────────────────────────────────────────────────────────
// TodoRow extracted + memoized — only re-renders when its own item changes
const TodoRow = memo(({ item, onToggle, onRemove }: { item:TodoItem; onToggle:(id:string)=>void; onRemove:(id:string)=>void }) => (
  <View style={tod.item}>
    <TouchableOpacity onPress={() => onToggle(item.id)} style={tod.checkWrap} activeOpacity={0.7}>
      <View style={[tod.check, item.done && tod.checkDone]}>
        {item.done && <Text style={tod.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
    <Text style={[tod.text, item.done && tod.textDone]} numberOfLines={2}>{item.text}</Text>
    <TouchableOpacity onPress={() => onRemove(item.id)} activeOpacity={0.7}>
      <Text style={tod.del}>✕</Text>
    </TouchableOpacity>
  </View>
));

const TodoTool = memo(() => {
  const [todos, setTodos] = useState<TodoItem[]>(() => [..._todos]);
  const [input, setInput] = useState('');

  // Load from disk on first mount
  useEffect(() => {
    loadTodos().then(saved => {
      if (saved.length > 0) { _todos = saved; setTodos(saved); _todoListener?.(); }
    });
  }, []);

  const sync = useCallback((next: TodoItem[]) => {
    _todos = next; setTodos(next); _todoListener?.();
    saveTodos(next).catch(() => {});
  }, []);

  const addTodo = useCallback(() => {
    const text = input.trim(); if (!text) return;
    sync([..._todos, { id:makeId(), text, done:false }]); setInput('');
  }, [input, sync]);

  const toggle = useCallback((id: string) => {
    sync(_todos.map(t => t.id===id ? {...t,done:!t.done} : t));
  }, [sync]);

  const remove = useCallback((id: string) => {
    sync(_todos.filter(t => t.id!==id));
  }, [sync]);

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
      {todos.map(t => <TodoRow key={t.id} item={t} onToggle={toggle} onRemove={remove} />)}
    </View>
  );
});
const tod = StyleSheet.create({
  item:     { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#222', gap:10 },
  checkWrap:{ padding:2 },
  check:    { width:22, height:22, borderRadius:11, borderWidth:1.5, borderColor:'#555', justifyContent:'center', alignItems:'center' },
  checkDone:{ backgroundColor:'#fff', borderColor:'#fff' },
  checkMark:{ color:'#000', fontSize:12, fontWeight:'700' },
  text:     { flex:1, color:'#ddd', fontSize:15 },
  textDone: { color:'#444', textDecorationLine:'line-through' },
  del:      { color:'#444', fontSize:16, paddingHorizontal:4 },
});

// ──────────────────────────────────────────────────────────────────────────────
// COUNTDOWN TOOL
// ──────────────────────────────────────────────────────────────────────────────
// CountdownRow extracted + memoized
const CountdownRow = memo(({ item, onRemove }: { item:CountdownItem; onRemove:(id:string)=>void }) => {
  const days = daysLeft(item.targetDate);
  const past = days < 0;
  return (
    <View style={cdst.item}>
      <View style={ROW_FLEX}>
        <Text style={cdst.name}>{item.name}</Text>
        <Text style={cdst.dateStr}>{new Date(item.targetDate).toDateString()}</Text>
      </View>
      <View style={[cdst.pill, past && cdst.pillPast]}>
        <Text style={[cdst.days, past && cdst.daysPast]}>
          {past ? `${Math.abs(days)}d ago` : days===0 ? 'Today!' : `${days}d`}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onRemove(item.id)} activeOpacity={0.7}>
        <Text style={tod.del}>✕</Text>
      </TouchableOpacity>
    </View>
  );
});
const ROW_FLEX = { flex:1 }; // stable style object — avoids inline object allocation

const CountdownTool = memo(() => {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(() => [..._countdowns]);
  const [name,       setName]       = useState('');
  const [pickedDate, setPickedDate] = useState<Date|null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Tick for live refresh — only runs while CountdownTool is mounted
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t+1), 60_000); return () => clearInterval(id); }, []);

  // Load from disk on first mount
  useEffect(() => {
    loadCountdowns().then(saved => {
      if (saved.length > 0) { _countdowns = saved; setCountdowns(saved); _cdListener?.(); }
    });
  }, []);

  const syncCd = useCallback((next: CountdownItem[]) => {
    _countdowns = next; setCountdowns(next); _cdListener?.();
    saveCountdowns(next).catch(() => {});
  }, []);

  const add = useCallback(() => {
    if (!name.trim())  { Alert.alert('Missing name', 'Please enter an event name.'); return; }
    if (!pickedDate)   { Alert.alert('Missing date', 'Please pick a date first.'); return; }
    syncCd([..._countdowns, { id:makeId(), name:name.trim(), targetDate:pickedDate.toISOString() }]);
    setName(''); setPickedDate(null);
  }, [name, pickedDate, syncCd]);

  const remove = useCallback((id: string) => {
    syncCd(_countdowns.filter(c => c.id!==id));
  }, [syncCd]);

  const handleConfirm = useCallback((d: Date) => { setPickedDate(d); setPickerOpen(false); }, []);
  const handleCancelPicker = useCallback(() => setPickerOpen(false), []);
  const handleOpenPicker   = useCallback(() => setPickerOpen(true), []);

  const dateLabel = pickedDate
    ? pickedDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : 'Pick a date';

  return (
    <View style={ts.container}>
      <Text style={ts.title}>⏳ Countdown</Text>
      <TextInput style={[ts.input,{marginBottom:10}]} value={name} onChangeText={setName}
        placeholder="Event name..." placeholderTextColor="#555" />
      <TouchableOpacity style={cdst.dateBtn} onPress={handleOpenPicker} activeOpacity={0.7}>
        <Text style={cdst.dateBtnIcon}>📅</Text>
        <Text style={[cdst.dateBtnTxt, !pickedDate && {color:'#555'}]}>{dateLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[ts.btn,{marginTop:10,alignSelf:'stretch',alignItems:'center'}]} onPress={add} activeOpacity={0.7}>
        <Text style={ts.btnTxt}>Start Countdown</Text>
      </TouchableOpacity>
      {countdowns.length===0 && <Text style={ts.info}>No countdowns yet.</Text>}
      {countdowns.map(c => <CountdownRow key={c.id} item={c} onRemove={remove} />)}
      <DatePickerModal
        visible={pickerOpen}
        initialDate={pickedDate || new Date()}
        onConfirm={handleConfirm}
        onCancel={handleCancelPicker}
      />
    </View>
  );
});
const cdst = StyleSheet.create({
  dateBtn:    { flexDirection:'row', alignItems:'center', backgroundColor:'#1c1c1e', borderRadius:10, paddingHorizontal:14, paddingVertical:12, gap:8 },
  dateBtnIcon:{ fontSize:18 },
  dateBtnTxt: { color:'#fff', fontSize:15 },
  item:       { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#222', gap:10, marginTop:4 },
  name:       { color:'#ddd', fontSize:15, fontWeight:'500' },
  dateStr:    { color:'#555', fontSize:11, marginTop:2 },
  pill:       { backgroundColor:'#2c2c2e', borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  pillPast:   { backgroundColor:'#2a1a1a' },
  days:       { color:'#fff', fontSize:13, fontWeight:'600' },
  daysPast:   { color:'#ff453a' },
});

// ─── Shared tool styles ────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  container:{ paddingBottom:20 },
  title:    { color:'#fff', fontSize:17, fontWeight:'600', marginBottom:14 },
  row:      { flexDirection:'row', gap:8, alignItems:'center' },
  input:    { flex:1, height:44, backgroundColor:'#1c1c1e', borderRadius:10, paddingHorizontal:14, color:'#fff', fontSize:15 },
  btn:      { backgroundColor:'#2c2c2e', borderRadius:10, paddingHorizontal:16, paddingVertical:12 },
  btnTxt:   { color:'#fff', fontSize:15, fontWeight:'500' },
  label:    { color:'#8e8e93', fontSize:12, fontWeight:'500', marginBottom:6, marginTop:10, textTransform:'uppercase', letterSpacing:0.4 },
  info:     { color:'#555', fontSize:13, textAlign:'center', marginTop:20 },
  error:    { color:'#ff453a', fontSize:13, marginTop:10, textAlign:'center' },
});

// ─── Clock — updates every 30s only ──────────────────────────────────────────
const Clock = memo(() => {
  const [time, setTime] = useState(getClockStr);
  useEffect(() => { const id = setInterval(() => setTime(getClockStr()), 30_000); return () => clearInterval(id); }, []);
  return <Text style={ds.clockText}>{time}</Text>;
});

// ─── Tool card ────────────────────────────────────────────────────────────────
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
  wrap:   { flex:1, backgroundColor:'#1c1c1e', borderRadius:14, padding:14, minHeight:88, justifyContent:'center' },
  icon:   { fontSize:24, marginBottom:6 },
  label:  { color:'#ddd', fontSize:13, fontWeight:'500' },
  preview:{ color:'#555', fontSize:10, marginTop:4, lineHeight:14 },
});

// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD POPUP
// ──────────────────────────────────────────────────────────────────────────────
const DashboardPopup = memo(({ onClose, userName, assistantName, avatarSource }: DashboardPopupProps) => {
  const [activeTool, setActiveTool] = useState<ToolView>(null);
  const [showChat,   setShowChat]   = useState(false);

  const [todoPrev, setTodoPrev] = useState<string|undefined>(() => {
    const p = _todos.filter(t => !t.done).length;
    return p ? `${p} task${p>1?'s':''} pending` : undefined;
  });
  const [cdPrev, setCdPrev] = useState<string|undefined>(() => {
    if (!_countdowns.length) return undefined;
    const c = _countdowns[0], d = daysLeft(c.targetDate);
    return `${c.name}: ${d>=0?`${d}d left`:`${Math.abs(d)}d ago`}`;
  });

  // Listeners — sync preview text when todo/countdown state changes
  useEffect(() => {
    _todoListener = () => {
      const p = _todos.filter(t => !t.done).length;
      setTodoPrev(p ? `${p} task${p>1?'s':''} pending` : undefined);
    };
    _cdListener = () => {
      if (!_countdowns.length) { setCdPrev(undefined); return; }
      const c = _countdowns[0], d = daysLeft(c.targetDate);
      setCdPrev(`${c.name}: ${d>=0?`${d}d left`:`${Math.abs(d)}d ago`}`);
    };
    return () => { _todoListener = null; _cdListener = null; };
  }, []);

  // Assistant message — interval updates, but only re-renders when period actually changes
  const [assistantMsg, setAssistantMsg] = useState(() => {
    const msg = getAssistantMessage(userName, getCurrentTimePeriod());
    _prevMessage = msg; return msg;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const msg = getAssistantMessage(userName, getCurrentTimePeriod());
      if (msg !== _prevMessage) { _prevMessage = msg; setAssistantMsg(msg); }
    }, 60_000);
    return () => clearInterval(id);
  }, [userName]);

  // Hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTool) { setActiveTool(null); return true; }
      onClose(); return true;
    });
    return () => sub.remove();
  }, [activeTool, onClose]);

  // Close on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => { if (s !== 'active') onClose(); });
    return () => sub.remove();
  }, [onClose]);

  // Stable tool setters — avoid inline arrow functions in JSX
  const openWeather   = useCallback(() => setActiveTool('weather'),   []);
  const openMoney     = useCallback(() => setActiveTool('money'),     []);
  const openTodo      = useCallback(() => setActiveTool('todo'),      []);
  const openCountdown = useCallback(() => setActiveTool('countdown'), []);
  const clearTool     = useCallback(() => setActiveTool(null),        []);
  const openChat      = useCallback(() => setShowChat(true),          []);
  const closeChat     = useCallback(() => setShowChat(false),         []);

  if (showChat) {
    return <AssistantPopup onClose={closeChat} userName={userName} assistantName={assistantName} avatarSource={avatarSource || DEFAULT_ASSISTANT_AVATAR} />;
  }

  return (
    <View style={ds.fullscreen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={ds.header}>
        <TouchableOpacity style={ds.avatarWrap} onPress={openChat} activeOpacity={0.8}>
          <View style={ds.avatarCircle}>
            {avatarSource
              ? <Image source={{uri:avatarSource}} style={ds.avatar} />
              : <View style={ds.avatarPlaceholder}><Text style={ds.avatarPlaceholderTxt}>👤</Text></View>
            }
          </View>
        </TouchableOpacity>
        <View style={ds.headerCenter}>
          <Clock />
          <Text style={ds.msgText} numberOfLines={2}>{assistantMsg}</Text>
        </View>
        <TouchableOpacity style={ds.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={ds.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={ds.scroll} contentContainerStyle={ds.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTool ? (
          <View>
            {activeTool==='weather'   && <WeatherTool />}
            {activeTool==='money'     && <MoneyTool />}
            {activeTool==='todo'      && <TodoTool />}
            {activeTool==='countdown' && <CountdownTool />}
          </View>
        ) : (
          <View style={ds.grid}>
            <View style={ds.gridRow}>
              <ToolCard icon="🌤️" label="Weather"       onPress={openWeather} />
              <ToolCard icon="💱" label="Money Exchange" onPress={openMoney} />
            </View>
            <View style={ds.gridRow}>
              <ToolCard icon="📝" label="To Do"      preview={todoPrev} onPress={openTodo} />
              <ToolCard icon="⏳" label="Countdown"  preview={cdPrev}   onPress={openCountdown} />
            </View>
          </View>
        )}
      </ScrollView>

      {activeTool && (
        <View style={ds.backBarWrap}>
          <TouchableOpacity style={ds.backBtn} onPress={clearTool} activeOpacity={0.7}>
            <Text style={ds.backTxt}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const ds = StyleSheet.create({
  fullscreen:          { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#000', zIndex:1000 },
  header:              { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingTop:STATUS_BAR_H+8, paddingBottom:14, borderBottomWidth:1, borderBottomColor:'#1a1a1a' },
  avatarWrap:          { flexShrink:0 },
  avatarCircle:        { width:44, height:44, borderRadius:22, overflow:'hidden', backgroundColor:'#1c1c1e' },
  avatar:              { width:'100%', height:'100%' },
  avatarPlaceholder:   { flex:1, justifyContent:'center', alignItems:'center' },
  avatarPlaceholderTxt:{ fontSize:22 },
  headerCenter:        { flex:1, gap:2 },
  clockText:           { color:'#fff', fontSize:20, fontWeight:'300', letterSpacing:3, fontVariant:['tabular-nums'] as any },
  msgText:             { color:'#8e8e93', fontSize:12, lineHeight:17 },
  closeBtn:            { width:32, height:32, borderRadius:16, backgroundColor:'#1c1c1e', justifyContent:'center', alignItems:'center' },
  closeTxt:            { color:'#8e8e93', fontSize:14 },
  scroll:              { flex:1 },
  scrollContent:       { paddingHorizontal:20, paddingTop:20, paddingBottom:40 },
  grid:                { gap:10 },
  gridRow:             { flexDirection:'row', gap:10 },
  backBarWrap:         { paddingHorizontal:20, paddingTop:10, paddingBottom:24, borderTopWidth:1, borderTopColor:'#1a1a1a', backgroundColor:'#000' },
  backBtn:             { paddingVertical:13, borderRadius:12, backgroundColor:'#1c1c1e', alignItems:'center' },
  backTxt:             { color:'#fff', fontSize:15, fontWeight:'400' },
});

export default DashboardPopup;