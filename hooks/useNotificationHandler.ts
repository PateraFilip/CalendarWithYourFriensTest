// hooks/useNotificationHandler.ts

import { loadNotificationSettings } from '@/lib/notificationSettings';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestUserPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return null;
  }
  return status;
}

export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscriptionResponse = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        if (data?.eventId) {
          router.push({
            pathname: `/events/${data.eventId}`,
            params: data.eventParam ? { event: data.eventParam as string } : {},
          });
        } else if (data?.eventDay) {
          router.push({
            pathname: '/(tabs)/explore',
            params: { calendar: '0', day: data.eventDay as string },
          });
        }
      }
    );

    return () => {
      subscriptionResponse.remove();
    };
  }, [router]);
}

export async function useRealtimeNotifications(payload: { eventType?: string; new?: Record<string, unknown> }, user: { id: number } | null) {
  if (!user?.id) return;

  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.eventChanges) return;

  const record = payload.new;
  if (!record) return;

  const isGroup = !!record.is_group;
  if (isGroup && !settings.groupEvents) return;

  const title = payload.eventType === 'INSERT'
    ? 'Nová událost'
    : payload.eventType === 'DELETE'
      ? 'Událost smazána'
      : 'Událost upravena';

  const body = typeof record.nazev === 'string'
    ? record.nazev
    : 'Došlo ke změně v kalendáři';

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { eventId: record.id, eventDay: record.den_od },
    },
    trigger: null,
  });
}

export async function notifyChatMessage(eventTitle: string, eventId: number, senderName: string) {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.chatMessages) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Chat: ${eventTitle}`,
      body: `${senderName} napsal(a) zprávu`,
      data: { eventId },
    },
    trigger: null,
  });
}
