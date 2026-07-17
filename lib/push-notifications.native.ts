import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { supabase } from '@/lib/supabaseClient';

export async function registerAndSavePushToken(userId: string) {
    try {
        const messaging = getMessaging(getApp());
        const token = await getToken(messaging);
        console.log('FCM token:', token);

        const { error } = await supabase
            .from('user_devices')
            .upsert(
                { user_id: userId, fcm_token: token },
                { onConflict: 'fcm_token' }
            );

        if (error) {
            console.error('Chyba při ukládání tokenu:', error);
        } else {
            console.log('Token uložen nebo již existoval ✅');
        }

        return token;
    } catch (err) {
        console.error('Neočekávaná chyba při registraci FCM tokenu:', err);
        return null;
    }
}
