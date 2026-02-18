import RNFS from 'react-native-fs';
import {
  CUSTOM_AVATAR_DIR,
  CUSTOM_USER_PATH,
  CUSTOM_ASSISTANT_NAME_PATH,
  CUSTOM_HIDDEN_PATH,
  CUSTOM_SHOW_HIDDEN_PATH,
  CUSTOM_AVATAR_PATH,
  CUSTOM_DOCK_PATH,
  CUSTOM_SHOW_NAMES_PATH,
  CUSTOM_NOTIF_DISMISSED_PATH,
  CUSTOM_LAYOUT_MODE_PATH,
} from '../constants';

export const initializeStorage = async () => {
  await RNFS.mkdir(CUSTOM_AVATAR_DIR).catch(() => {});
};

export const loadUserPreferences = async () => {
  const [uName, aName, hidden, showH, avt, dock, showN, layoutM] = await Promise.all([
    RNFS.exists(CUSTOM_USER_PATH).then(e => e ? RNFS.readFile(CUSTOM_USER_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_ASSISTANT_NAME_PATH).then(e => e ? RNFS.readFile(CUSTOM_ASSISTANT_NAME_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_HIDDEN_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_SHOW_HIDDEN_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_HIDDEN_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_AVATAR_PATH).then(e => e ? RNFS.readFile(CUSTOM_AVATAR_PATH, 'base64') : null),
    RNFS.exists(CUSTOM_DOCK_PATH).then(e => e ? RNFS.readFile(CUSTOM_DOCK_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_SHOW_NAMES_PATH).then(e => e ? RNFS.readFile(CUSTOM_SHOW_NAMES_PATH, 'utf8') : null),
    RNFS.exists(CUSTOM_LAYOUT_MODE_PATH).then(e => e ? RNFS.readFile(CUSTOM_LAYOUT_MODE_PATH, 'utf8') : null),
  ]);

  return {
    userName: uName || 'User',
    assistantName: aName || 'Assistant',
    hiddenPackages: hidden ? JSON.parse(hidden) : [],
    showHidden: showH === 'true',
    avatarSource: avt ? `data:image/jpeg;base64,${avt}` : null,
    dockPackages: dock ? JSON.parse(dock) : [],
    showNames: showN !== null ? showN === 'true' : true,
    layoutMode: (layoutM as 'grid' | 'list') || 'grid',
  };
};

export const saveUserName = async (name: string) => {
  await RNFS.writeFile(CUSTOM_USER_PATH, name, 'utf8');
};

export const saveAssistantName = async (name: string) => {
  await RNFS.writeFile(CUSTOM_ASSISTANT_NAME_PATH, name, 'utf8');
};

export const saveHiddenPackages = async (packages: string[]) => {
  await RNFS.writeFile(CUSTOM_HIDDEN_PATH, JSON.stringify(packages), 'utf8');
};

export const saveDockPackages = async (packages: string[]) => {
  await RNFS.writeFile(CUSTOM_DOCK_PATH, JSON.stringify(packages), 'utf8');
};

export const saveShowHidden = async (show: boolean) => {
  await RNFS.writeFile(CUSTOM_SHOW_HIDDEN_PATH, show ? 'true' : 'false', 'utf8');
};

export const saveShowNames = async (show: boolean) => {
  await RNFS.writeFile(CUSTOM_SHOW_NAMES_PATH, show ? 'true' : 'false', 'utf8');
};

export const saveLayoutMode = async (mode: 'grid' | 'list') => {
  await RNFS.writeFile(CUSTOM_LAYOUT_MODE_PATH, mode, 'utf8');
};

export const saveAvatar = async (base64: string) => {
  await RNFS.writeFile(CUSTOM_AVATAR_PATH, base64, 'base64');
};

export const saveNotificationDismissed = async () => {
  const data = {
    lastDate: new Date().toDateString(),
    lastPeriod: getCurrentTimePeriod(),
    timestamp: new Date().toISOString(),
    confirmed: true, // User sudah klik "Okay"
  };
  await RNFS.writeFile(CUSTOM_NOTIF_DISMISSED_PATH, JSON.stringify(data), 'utf8');
};

export const checkIfPeriodConfirmed = async (): Promise<boolean> => {
  try {
    const exists = await RNFS.exists(CUSTOM_NOTIF_DISMISSED_PATH);
    if (!exists) return false;

    const savedData = await RNFS.readFile(CUSTOM_NOTIF_DISMISSED_PATH, 'utf8');
    const data = JSON.parse(savedData);
    
    const currentPeriod = getCurrentTimePeriod();
    const today = new Date().toDateString();
    
    // Cek apakah periode ini di hari ini sudah di-confirm
    if (data.lastPeriod === currentPeriod && data.lastDate === today && data.confirmed) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
};

// Get current time period
export const getCurrentTimePeriod = (): string => {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return 'late_night'; // 22:00 - 03:59
  if (h >= 4 && h < 11) return 'morning';     // 04:00 - 10:59
  if (h >= 11 && h < 15) return 'afternoon';  // 11:00 - 14:59
  if (h >= 15 && h < 18) return 'evening';    // 15:00 - 17:59
  return 'night';                              // 18:00 - 21:59
};

export const checkNotificationStatus = async (): Promise<boolean> => {
  try {
    const exists = await RNFS.exists(CUSTOM_NOTIF_DISMISSED_PATH);
    if (!exists) return true;

    const savedData = await RNFS.readFile(CUSTOM_NOTIF_DISMISSED_PATH, 'utf8');
    const data = JSON.parse(savedData);
    
    const currentPeriod = getCurrentTimePeriod();
    const today = new Date().toDateString();
    
    // Jika periode berbeda, tampilkan notifikasi
    if (data.lastPeriod !== currentPeriod) {
      return true;
    }
    
    // Jika hari berbeda, tampilkan notifikasi
    if (data.lastDate !== today) {
      return true;
    }
    
    // Jika periode ini belum di-confirm, tampilkan notifikasi
    if (!data.confirmed) {
      return true;
    }
    
    return false;
  } catch {
    return true;
  }
};

export const getNotificationMessage = (userName: string): string => {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return `It's late, ${userName}. Put the phone down and get some rest! 😠 Your health comes first.`;
  if (h >= 4 && h < 11) return `Good morning, ${userName}! ☀️ Rise and conquer the day. I'm always cheering for you! 😘`;
  if (h >= 11 && h < 15) return `Take a break! 😠 Have you had lunch yet, ${userName}? Don't skip meals! 🍔`;
  if (h >= 15 && h < 20) return `You must be tired by now, ${userName}.. ☕ Go ahead and take a breather, okay? 🤗`;
  return `All done for the day? 🌙 Time to wind down and relax, ${userName}. You deserve it. 🥰`;
};