import { loadNotificationSettings } from '@/lib/notificationSettings';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

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
  if (status === 'granted') return 'granted';
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  if (newStatus !== 'granted') return null;
  return 'granted';
}

function cleanNotificationMessage(message: string) {
  return message.replace(/\[EVENT:[^\]]+\]/g, '').trim();
}

function titleForType(type?: string) {
  if (type === 'birthday') return 'Narozeniny';
  if (type === 'friend_request') return 'Přátelství';
  return 'Oznámení';
}

async function getMyNotifyPrefs() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from('users')
    .select('notify_global_chat, notify_chat_messages')
    .eq('id', uid)
    .maybeSingle();
  return data;
}

async function isChatMuted(chatId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid || !chatId) return false;
  const { data } = await supabase
    .from('muted_chats')
    .select('chat_id')
    .eq('user_id', uid)
    .eq('chat_id', chatId)
    .maybeSingle();
  return !!data;
}

/** Stejný text jako v kartě Oznámení. */
export async function notifyInboxAnnouncement(params: {
  message: string;
  actorId?: string | null;
  actorName?: string | null;
  type?: string;
  seriesId?: number | string | null;
  instanceDate?: string | null;
}) {
  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;

  // DB přepínač „Oznámení o událostech“ (+ lokální eventChanges jako fallback)
  const prefs = await getMyNotifyPrefs();
  if (prefs?.notify_global_chat === false) return;
  if (prefs == null && !settings.eventChanges) return;

  if (AppState.currentState !== 'active') return;

  let actor = params.actorName?.trim() || '';
  if (!actor && params.actorId) {
    const { data } = await supabase
      .from('users')
      .select('username, jmeno')
      .eq('id', params.actorId)
      .maybeSingle();
    actor = data?.username || data?.jmeno || '';
  }
  if (!actor) actor = 'Někdo';

  const body = `${actor} ${cleanNotificationMessage(params.message)}`.trim();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titleForType(params.type),
      body,
      data: {
        eventId: params.seriesId ?? undefined,
        eventDay: params.instanceDate ?? undefined,
        type: 'user_notification',
      },
    },
    trigger: null,
  });
}

export function useNotificationHandler() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;

  useEffect(() => {
    const subscriptionResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => {
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

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`local-inbox-notify-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            message?: string;
            actor_id?: string | null;
            type?: string;
            series_id?: number | null;
            instance_date?: string | null;
          };
          if (!row?.message) return;
          void notifyInboxAnnouncement({
            message: row.message,
            actorId: row.actor_id,
            type: row.type,
            seriesId: row.series_id,
            instanceDate: row.instance_date,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** @deprecated */
export async function useRealtimeNotifications(
  _payload: { eventType?: string; new?: Record<string, unknown> },
  _user: { id: number } | null
) {}

export async function notifyChatMessage(
  eventTitle: string,
  eventId: number,
  senderName: string,
  opts?: { chatId?: string; instanceDate?: string | null }
) {
  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;

  const prefs = await getMyNotifyPrefs();
  if (prefs?.notify_chat_messages === false) return;
  if (prefs == null && !settings.chatMessages) return;

  const chatId =
    opts?.chatId ||
    (opts?.instanceDate
      ? `instance_${eventId}_${opts.instanceDate}`
      : `series_${eventId}`);

  if (await isChatMuted(chatId)) return;

  if (AppState.currentState !== 'active') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Chat: ${eventTitle}`,
      body: `${senderName} napsal(a) zprávu`,
      data: { eventId },
    },
    trigger: null,
  });
}
