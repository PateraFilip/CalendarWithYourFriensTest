import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { saveFcmTokenToSupabase } from '@/lib/saveFcmToken';

export async function registerAndSavePushToken(_userId?: string) {
  try {
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging);
    console.log('FCM token:', token);

    if (!token) return null;

    await saveFcmTokenToSupabase(token);
    return token;
  } catch (err) {
    console.error('Neočekávaná chyba při registraci FCM tokenu:', err);
    return null;
  }
}
