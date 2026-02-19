import { Dimensions } from 'react-native';
import RNFS from 'react-native-fs';

export const { width } = Dimensions.get('window');

// Sizes
export const ITEM_WIDTH = width / 4;
export const ICON_SIZE = 55;
export const DOCK_ICON_SIZE = 56;

// File paths
export const CUSTOM_AVATAR_DIR = `${RNFS.DocumentDirectoryPath}/satrialauncher`;
export const CUSTOM_AVATAR_PATH = `${CUSTOM_AVATAR_DIR}/asist.jpg`;
export const CUSTOM_USER_PATH = `${CUSTOM_AVATAR_DIR}/user.txt`;
export const CUSTOM_ASSISTANT_NAME_PATH = `${CUSTOM_AVATAR_DIR}/assistant_name.txt`;
export const CUSTOM_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/hidden.json`;
export const CUSTOM_SHOW_HIDDEN_PATH = `${CUSTOM_AVATAR_DIR}/show_hidden.txt`;
export const CUSTOM_DOCK_PATH = `${CUSTOM_AVATAR_DIR}/dock.json`;
export const CUSTOM_SHOW_NAMES_PATH = `${CUSTOM_AVATAR_DIR}/show_names.txt`;
export const CUSTOM_NOTIF_DISMISSED_PATH = `${CUSTOM_AVATAR_DIR}/notif_dismissed.txt`;
export const CUSTOM_LAYOUT_MODE_PATH = `${CUSTOM_AVATAR_DIR}/layout_mode.txt`;

// Default values
// Empty fallback — app uses local avatar if set, shows blank circle otherwise (no network fetch)
export const DEFAULT_ASSISTANT_AVATAR = "";

// FlatList optimization — tuned for lower RAM usage
export const INITIAL_NUM_TO_RENDER = 12;       // render 1 screen worth on mount
export const MAX_TO_RENDER_PER_BATCH = 5;       // smaller batches = less JS pressure
export const WINDOW_SIZE = 3;                   // 1 visible + 1 above + 1 below viewport
export const UPDATE_CELLS_BATCHING_PERIOD = 100; // batch more aggressively