import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const webStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(window.localStorage.getItem(key));
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const saveStorage = async (key: string, value: string) => {
  if (value === '') {
    await storage.removeItem(key);
    return;
  }
  await storage.setItem(key, value);
};

export const loadStorage = async (key: string) => {
  return await storage.getItem(key);
};

export const removeStorage = async (key: string) => {
  await storage.removeItem(key);
};
