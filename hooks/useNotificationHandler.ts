// hooks/useNotificationHandler.ts
import { createClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';


// Nastavení chování notifikace
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,   // zobrazit banner (iOS 16+)
    shouldShowList: true,     // zobrazit i v notifikačním centru
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {

    // Listener pro kliknutí na notifikaci (background nebo foreground)
    const subscriptionResponse = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('📬 Notification opened:', response.notification.request.content.data);

        const data = response.notification.request.content.data;
        if (data?.eventId && data?.eventDay) {
          router.push({
            pathname: '/(tabs)/explore',
            params: { calendar: '0', day: data.eventDay },
          });
        }
      }
    );

    return () => {
      subscriptionResponse.remove();
    };
  }, []);
}


export async function useRealtimeNotifications(payload: any, user: any) {
  const state = AppState.currentState;


  // Když appka není aktivní, neplánuj lokální notifikaci
  if (state !== 'active') {
    console.log('⏭️ App není aktivní – neplánuji lokální notifikaci');
    return;
  }

  if (payload.new.is_group == false || payload.old.is_group == false) {
    return
  }

  if (payload.new.zakladatel_id == user?.id || payload.old.zakladatel_id == user?.id) {
    return
  }

  let title = `Neznámé oznámení`;
  let body = `Neznámé oznámení`
  if (payload.eventType == "INSERT") {
    const nazev = payload?.new?.nazev ?? 'Neznámá událost';
    const denOd = payload?.new?.den_od ?? 'Neznámé datum';
    const eventDayFormat = new Date(denOd);
    const formattedDate = `${eventDayFormat.getDate().toString().padStart(2, "0")}.${(eventDayFormat.getMonth() + 1).toString().padStart(2, "0")}.${eventDayFormat.getFullYear()}`;
    const casOd = payload?.new?.cas_od ?? '';
    title = `Nová skupinová událost!`;
    body = `Událost "${nazev} ${formattedDate}" byla přidána.`
  }
  else if (payload.eventType == "UPDATE") {
    const nazev = payload?.new?.nazev ?? 'Neznámá událost';
    const denOd = payload?.new?.den_od ?? 'Neznámé datum';
    const eventDayFormat = new Date(denOd);
    const formattedDate = `${eventDayFormat.getDate().toString().padStart(2, "0")}.${(eventDayFormat.getMonth() + 1).toString().padStart(2, "0")}.${eventDayFormat.getFullYear()}`;
    const casOd = payload?.new?.cas_od ?? '';
    title = `Událost upravena!`;
    body = `Událost "${nazev} ${formattedDate}" byla změněna.`
  }
  else if (payload.eventType == "DELETE") {
    title = `Událost odstraněna!`;
    body = `Událost byla odstraněna.`
  }


  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      data: payload.new, // můžeš přidat, pokud chceš při kliknutí otevřít event
    },
    trigger: null,
  });

}