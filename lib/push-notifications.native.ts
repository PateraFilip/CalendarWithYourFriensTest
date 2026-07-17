import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { saveFcmTokenToSupabase } from '@/lib/saveFcmToken';

let tokenRefreshUnsub: (() => void) | null = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Oznámení',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

async function ensurePermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[push] Oprávnění k notifikacím zamítnuto (expo)');
      return false;
    }
  }

  try {
    const messaging = getMessaging(getApp());
    const authStatus = await requestPermission(messaging);
    const ok =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    if (!ok) {
      console.warn('[push] Oprávnění FCM zamítnuto:', authStatus);
      return false;
    }
  } catch (e) {
    console.warn('[push] requestPermission FCM:', e);
  }

  return true;
}

export async function registerAndSavePushToken(_userId?: string) {
  try {
    const allowed = await ensurePermission();
    if (!allowed) return null;

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging);
    console.log('FCM token:', token);

    if (!token) return null;

    await saveFcmTokenToSupabase(token);

    if (!tokenRefreshUnsub) {
      tokenRefreshUnsub = onTokenRefresh(messaging, async (newToken) => {
        console.log('FCM token refresh:', newToken);
        await saveFcmTokenToSupabase(newToken);
      });
    }

    return token;
  } catch (err) {
    console.error('Neočekávaná chyba při registraci FCM tokenu:', err);
    return null;
  }
}
