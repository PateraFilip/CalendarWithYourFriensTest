// hooks/useNotificationHandler.web.ts
import { loadNotificationSettings } from '@/lib/notificationSettings';
import { subscribeWebForegroundMessages } from '@/lib/push-notifications.web';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export async function requestUserPermission() {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function showBrowserNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, data });
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const unsub = subscribeWebForegroundMessages(({ title, body, data }) => {
      showBrowserNotification(title, body, data);
      if (data?.eventId) {
        // click path is limited in foreground; deep link via notification click when supported
      }
    });

    const onClick = (event: Event) => {
      const ce = event as NotificationEvent;
      const data = (ce.notification as any)?.data;
      if (data?.eventId) {
        router.push(`/events/${data.eventId}`);
      }
    };
    // NotificationEvent is SW-only; keep no-op for window

    return () => {
      unsub();
      void onClick;
    };
  }, [router]);
}

export async function useRealtimeNotifications(
  payload: { eventType?: string; new?: Record<string, unknown> },
  user: { id: number } | null
) {
  if (!user?.id) return;

  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.eventChanges) return;

  const record = payload.new;
  if (!record) return;

  const isGroup = !!record.is_group;
  if (isGroup && !settings.groupEvents) return;

  const title =
    payload.eventType === 'INSERT'
      ? 'Nová událost'
      : payload.eventType === 'DELETE'
        ? 'Událost smazána'
        : 'Událost upravena';

  const body =
    typeof record.nazev === 'string' ? record.nazev : 'Došlo ke změně v kalendáři';

  showBrowserNotification(title, body, {
    eventId: record.id,
    eventDay: record.den_od,
  });
}

export async function notifyChatMessage(eventTitle: string, eventId: number, senderName: string) {
  const settings = await loadNotificationSettings();
  if (!settings.enabled || !settings.chatMessages) return;

  showBrowserNotification(`Chat: ${eventTitle}`, `${senderName} napsal(a) zprávu`, {
    eventId,
  });
}
