// lib/push-notifications.web.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { createClient } from '@supabase/supabase-js';

// Supabase config
const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Firebase Web Config (z firebase-messaging-sw.js)
const firebaseConfig = {
    apiKey: "AIzaSyDChsbgzCprt-_VZnx_-XzdpNjlSlE0Z8g",
    projectId: "calendar-notifications-4c44b",
    storageBucket: "calendar-notifications-4c44b.firebasestorage.app",
    messagingSenderId: "142991941579",
    appId: "1:142991941579:web:a8ec1a4d6896a70ea5604e" // Zde se může hodit aktualizovat
};

let messaging: any = null;

try {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
} catch (err) {
    console.error('Firebase initialization error on web', err);
}

export async function registerAndSavePushToken(userId: string) {
    try {
        if (!messaging) return null;

        // Na webu je nejprve nutné požádat uživatele o oprávnění
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Web push permission denied.');
            return null;
        }

        const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
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
