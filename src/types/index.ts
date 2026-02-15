export interface AppData {
  label: string;
  packageName: string;
  icon: string;
}

export interface ModalAnimations {
  modalScale: any;
  settingsModalScale: any;
}

export interface UserPreferences {
  userName: string;
  assistantName: string;
  hiddenPackages: string[];
  dockPackages: string[];
  showHidden: boolean;
  showNames: boolean;
  avatarSource: string | null;
  showNotification: boolean;
}