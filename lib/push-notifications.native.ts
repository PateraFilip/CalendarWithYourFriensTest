// lib/push-notifications.ts
// Sem přesuneme logiku pro mobilní notifikace

import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { createClient } from '@supabase/supabase-js';

// Tyto údaje si vezmi ze svého supabaseClient.ts
const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function registerAndSavePushToken(userId: string) {
    try {
        const messaging = getMessaging(getApp());
        const token = await getToken(messaging);
        console.log('FCM token:', token);

        const { error } = await supabase
            .from('user_devices')
            .upsert(
                { user_id: userId, fcm_token: token },
                { onConflict: 'fcm_token' } // <– musí odpovídat UNIQUE constraintu v DB
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