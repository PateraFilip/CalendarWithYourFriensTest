import { supabase } from '@/lib/supabaseClient';

export type UserNotification = {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  message: string;
  series_id: number | null;
  instance_date: string | null;
  read_at: string | null;
  created_at: string;
  users?: { username?: string; jmeno?: string; prijmeni?: string } | null;
};

export async function createNotificationsForRecipients({
  recipientIds,
  actorId,
  type,
  message,
  seriesId,
  instanceDate,
}: {
  recipientIds: Array<string | number>;
  actorId: string | number;
  type: string;
  message: string;
  seriesId?: number;
  instanceDate?: string | null;
}) {
  const actor = String(actorId);
  const unique = Array.from(
    new Set(recipientIds.map(String).filter((id) => id && id !== actor))
  );

  if (unique.length === 0) return;

  const rows = unique.map((recipient_id) => ({
    recipient_id,
    actor_id: actor,
    type,
    message,
    series_id: seriesId ?? null,
    instance_date: instanceDate ?? null,
  }));

  const { error } = await supabase.from('user_notifications').insert(rows);
  if (error) {
    console.error('createNotificationsForRecipients:', error.message);
  }
}

export async function fetchMyNotifications(userId: string | number, limit = 100): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*, users:actor_id (username, jmeno, prijmeni)')
    .eq('recipient_id', String(userId))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchMyNotifications:', error.message);
    return [];
  }
  return (data ?? []) as UserNotification[];
}

export async function countUnreadNotifications(userId: string | number): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', String(userId))
    .is('read_at', null);

  if (error) {
    console.error('countUnreadNotifications:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markAllNotificationsRead(userId: string | number) {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', String(userId))
    .is('read_at', null);

  if (error) {
    console.error('markAllNotificationsRead:', error.message);
  }
}

export async function markNotificationRead(id: number) {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('markNotificationRead:', error.message);
  }
}
