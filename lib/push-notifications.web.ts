import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/lib/supabaseClient';

const firebaseConfig = {
    apiKey: "AIzaSyDChsbgzCprt-_VZnx_-XzdpNjlSlE0Z8g",
    projectId: "calendar-notifications-4c44b",
    storageBucket: "calendar-notifications-4c44b.firebasestorage.app",
    messagingSenderId: "142991941579",
    appId: "1:142991941579:web:a8ec1a4d6896a70ea5604e",
};

let messaging: ReturnType<typeof getMessaging> | null = null;

if (typeof window !== 'undefined' && 'navigator' in window) {
    try {
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messaging = getMessaging(app);
    } catch (err) {
        console.error('Firebase initialization error on web', err);
    }
}

export async function registerAndSavePushToken(userId: string) {
    try {
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Web push permission denied.');
            return null;
        }

        const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.warn('EXPO_PUBLIC_FIREBASE_VAPID_KEY is not set — web push token skipped.');
            return null;
        }

        const token = await getToken(messaging, { vapidKey });
        console.log('FCM token (WEB):', token);

        const { error } = await supabase
            .from('user_devices')
            .upsert(
                { user_id: userId, fcm_token: token },
                { onConflict: 'fcm_token' }
            );

        if (error) {
            console.error('Chyba při ukládání tokenu:', error);
        } else {
            console.log('Token uložen (WEB) ✅');
        }

        return token;
    } catch (err) {
        console.error('Chyba při registraci FCM tokenu (WEB):', err);
        return null;
    }
}

/** Foreground web notifications (FCM). */
export function subscribeWebForegroundMessages(
    handler: (payload: { title: string; body: string; data?: Record<string, unknown> }) => void
) {
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
        handler({
            title: payload.notification?.title || 'Oznámení',
            body: payload.notification?.body || '',
            data: (payload.data || {}) as Record<string, unknown>,
        });
    });
}
