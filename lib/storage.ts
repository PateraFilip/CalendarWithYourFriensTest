// lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveStorage = async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
};

export const loadStorage = async (key: string) => {
    return await AsyncStorage.getItem(key);
};