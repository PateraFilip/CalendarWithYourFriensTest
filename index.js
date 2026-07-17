// Musí běžet před expo-router — jinak Android nedoručí FCM při zabité appce.
// Na webu RN Firebase neexistuje → jen entry.
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApp } = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
    const messaging = getMessaging(getApp());
    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      console.log('[FCM] background:', remoteMessage?.messageId, remoteMessage?.notification?.title);
    });
  } catch (e) {
    console.warn('[FCM] background handler skip:', e?.message ?? e);
  }
}

import 'expo-router/entry';
