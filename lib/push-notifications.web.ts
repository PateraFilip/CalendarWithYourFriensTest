import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from '@/lib/supabaseClient';

const firebaseConfig = {
  apiKey: 'AIzaSyDChsbgzCprt-_VZnx_-XzdpNjlSlE0Z8g',
  projectId: 'calendar-notifications-4c44b',
  storageBucket: 'calendar-notifications-4c44b.firebasestorage.app',
  messagingSenderId: '142991941579',
  appId: '1:142991941579:web:a8ec1a4d6896a70ea5604e',
};

let messaging: ReturnType<typeof getMessaging> | null = null;
let messagingInitPromise: Promise<ReturnType<typeof getMessaging> | null> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function getMessagingInstance() {
  if (messaging) return messaging;
  if (typeof window === 'undefined') return null;

  if (!messagingInitPromise) {
    messagingInitPromise = (async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          console.warn('[web-push] Firebase Messaging není v tomto prohlížeči podporované.');
          return null;
        }
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        return messaging;
      } catch (err) {
        console.error('Firebase initialization error on web', err);
        return null;
      }
    })();
  }
  return messagingInitPromise;
}

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  const registration = await withTimeout(
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }),
    8000,
    'SW register'
  );

  // serviceWorker.ready může viset donekonečna — čekej max pár sekund na active
  if (registration.active) return registration;

  await withTimeout(
    new Promise<void>((resolve) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        resolve();
        return;
      }
      if (worker.state === 'activated') {
        resolve();
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' || worker.state === 'redundant') resolve();
      });
    }),
    8000,
    'SW activate'
  );

  return registration;
}

export async function registerAndSavePushToken(
  userId: string,
  opts?: { skipPermissionRequest?: boolean }
) {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof Notification === 'undefined') return null;

    let permission: NotificationPermission = Notification.permission;
    if (!opts?.skipPermissionRequest && permission !== 'granted' && permission !== 'denied') {
      // Pozor: po await už Chrome často ukáže jen „zvoneček“.
      // Ideálně volej requestPermission synchronně z click handleru a sem pošli skipPermissionRequest.
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.log('Web push permission denied.');
      return null;
    }

    const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('EXPO_PUBLIC_FIREBASE_VAPID_KEY is not set — web push token skipped.');
      return null;
    }

    const messagingInstance = await getMessagingInstance();
    if (!messagingInstance) return null;

    let swRegistration: ServiceWorkerRegistration | undefined;
    try {
      swRegistration = await registerMessagingServiceWorker();
    } catch (swErr) {
      console.warn('[web-push] SW registrace selhala, zkouším getToken bez ní:', swErr);
    }

    const token = await withTimeout(
      getToken(messagingInstance, {
        vapidKey,
        ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
      }),
      15000,
      'FCM getToken'
    );

    if (!token) {
      console.warn('[web-push] getToken vrátil prázdný token');
      return null;
    }

    console.log('FCM token (WEB):', token);

    const { error } = await withTimeout(
      (async () =>
        supabase.from('user_devices').upsert(
          { user_id: userId, fcm_token: token },
          { onConflict: 'fcm_token' }
        ))(),
      10000,
      'user_devices upsert'
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
  if (typeof window === 'undefined') return () => {};

  let unsub: (() => void) | undefined;
  void getMessagingInstance().then((instance) => {
    if (!instance) return;
    unsub = onMessage(instance, (payload) => {
      handler({
        title: payload.notification?.title || 'Oznámení',
        body: payload.notification?.body || '',
        data: (payload.data || {}) as Record<string, unknown>,
      });
    });
  });

  return () => {
    unsub?.();
  };
}
