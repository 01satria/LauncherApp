import { useState, useEffect, useCallback } from 'react';
import { ToastAndroid, NativeModules } from 'react-native';
import { InstalledApps } from 'react-native-launcher-kit';
import { AppData } from '../types';
import {
  saveHiddenPackages,
  saveDockPackages,
  saveShowHidden,
  saveShowNames,
  saveUserName,
  saveAssistantName,
} from '../utils/storage';

const { UninstallModule } = NativeModules;

export const useAppManagement = () => {
  const [allApps, setAllApps] = useState<AppData[]>([]);
  const [hiddenPackages, setHiddenPackages] = useState<string[]>([]);
  const [dockPackages, setDockPackages] = useState<string[]>([]);
  const [listKey, setListKey] = useState(0);

  const refreshApps = useCallback(async () => {
    try {
      const result = await InstalledApps.getSortedApps();
      const apps = result.map((a: any) => ({
        label: a.label || 'App',
        packageName: a.packageName,
        icon: a.icon,
      }));
      setAllApps(apps);
      setListKey(prev => prev + 1); // Force FlatList re-render after app list changes
    } catch (e) {
      console.error('refreshApps failed:', e);
    }
  }, []);

  const hideApp = useCallback(async (pkg: string) => {
    const newList = [...hiddenPackages];
    if (!newList.includes(pkg)) {
      newList.push(pkg);
    }
    
    // Auto-remove from dock when hiding
    if (dockPackages.includes(pkg)) {
      const newDock = dockPackages.filter(p => p !== pkg);
      setDockPackages(newDock);
      await saveDockPackages(newDock);
    }
    
    setHiddenPackages(newList);
    await saveHiddenPackages(newList);
    ToastAndroid.show('App Hidden', ToastAndroid.SHORT);
  }, [hiddenPackages, dockPackages]);

  const unhideApp = useCallback(async (pkg: string) => {
    const newList = hiddenPackages.filter(p => p !== pkg);
    setHiddenPackages(newList);
    await saveHiddenPackages(newList);
    ToastAndroid.show('App Visible', ToastAndroid.SHORT);
  }, [hiddenPackages]);

  const pinToDock = useCallback(async (pkg: string) => {
    const isDocked = dockPackages.includes(pkg);
    const isHidden = hiddenPackages.includes(pkg);
    let newDock = [...dockPackages];
    
    if (isDocked) {
      newDock = newDock.filter(p => p !== pkg);
      ToastAndroid.show('Unpinned from Dock', ToastAndroid.SHORT);
    } else {
      if (newDock.length >= 5) {
        ToastAndroid.show('Dock is full (max 5 apps)', ToastAndroid.LONG);
        return false;
      }
      newDock.push(pkg);
      
      // Auto-unhide when pinning to dock
      if (isHidden) {
        const newHidden = hiddenPackages.filter(p => p !== pkg);
        setHiddenPackages(newHidden);
        await saveHiddenPackages(newHidden);
        ToastAndroid.show('Pinned to Dock & Unhidden', ToastAndroid.SHORT);
      } else {
        ToastAndroid.show('Pinned to Dock', ToastAndroid.SHORT);
      }
    }
    
    setDockPackages(newDock);
    await saveDockPackages(newDock);
    return true;
  }, [dockPackages, hiddenPackages]);

  const uninstallApp = useCallback((pkg: string) => {
    setAllApps(prev => prev.filter(app => app.packageName !== pkg));
    setDockPackages(prev => {
      const newDock = prev.filter(p => p !== pkg);
      saveDockPackages(newDock);
      return newDock;
    });
    setListKey(prev => prev + 1);

    setTimeout(() => {
      if (UninstallModule) {
        UninstallModule.uninstallApp(pkg);
      }
    }, 420);

    // Single refresh after uninstall dialog — one is enough
    setTimeout(() => refreshApps(), 2500);
  }, [refreshApps]);

  return {
    allApps,
    setAllApps,
    hiddenPackages,
    setHiddenPackages,
    dockPackages,
    setDockPackages,
    listKey,
    refreshApps,
    hideApp,
    unhideApp,
    pinToDock,
    uninstallApp,
  };
};

export const useUserSettings = () => {
  const [userName, setUserName] = useState("User");
  const [assistantName, setAssistantName] = useState("Assistant");
  const [showHidden, setShowHidden] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [avatarSource, setAvatarSource] = useState<string | null>(null);

  const updateUserName = useCallback(async (name: string) => {
    setUserName(name);
    await saveUserName(name);
  }, []);

  const updateAssistantName = useCallback(async (name: string) => {
    setAssistantName(name);
    await saveAssistantName(name);
  }, []);

  const toggleShowHidden = useCallback(async (value: boolean) => {
    setShowHidden(value);
    await saveShowHidden(value);
  }, []);

  const toggleShowNames = useCallback(async (value: boolean) => {
    setShowNames(value);
    await saveShowNames(value);
  }, []);

  return {
    userName,
    setUserName,
    assistantName,
    setAssistantName,
    showHidden,
    setShowHidden,
    showNames,
    setShowNames,
    avatarSource,
    setAvatarSource,
    updateUserName,
    updateAssistantName,
    toggleShowHidden,
    toggleShowNames,
  };
};