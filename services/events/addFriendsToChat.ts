import { createNotificationsForRecipients } from '@/services/notifications/notifications';
import { supabase } from '@/lib/supabaseClient';
import { addEventInvites } from '@/services/events/invites';

export async function fetchChatParticipantIds(
  seriesId: number,
  instanceDate?: string | null
): Promise<string[]> {
  let query = supabase
    .from('event_users')
    .select('user_id')
    .eq('series_id', seriesId);

  if (instanceDate) {
    query = query.eq('instance_date', instanceDate);
  } else {
    query = query.is('instance_date', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchChatParticipantIds:', error.message);
    return [];
  }
  return (data ?? []).map((r) => String(r.user_id));
}

/**
 * Přidá přátele do chatu události (pozvánka + účastník).
 * Volatelné jen zakladatelem (RLS).
 */
export async function addFriendsToEventChat({
  seriesId,
  instanceDate,
  friendIds,
  actorId,
  eventTitle,
}: {
  seriesId: number;
  instanceDate?: string | null;
  friendIds: Array<string | number>;
  actorId: string | number;
  eventTitle?: string;
}): Promise<{ added: string[] }> {
  const unique = Array.from(new Set(friendIds.map(String).filter(Boolean)));
  if (unique.length === 0) return { added: [] };

  const { data: series, error: seriesError } = await supabase
    .from('event_series')
    .select('id, zakladatel_id, is_group, nazev')
    .eq('id', seriesId)
    .single();

  if (seriesError || !series) {
    throw new Error(seriesError?.message || 'Událost nenalezena');
  }

  if (String(series.zakladatel_id) !== String(actorId)) {
    throw new Error('Přátele do chatu může přidat jen zakladatel události');
  }

  const already = new Set(await fetchChatParticipantIds(seriesId, instanceDate));
  const toAdd = unique.filter((id) => !already.has(id) && id !== String(actorId));
  if (toAdd.length === 0) return { added: [] };

  if (series.is_group) {
    await addEventInvites(seriesId, toAdd);
  }

  const rows = toAdd.map((user_id) => ({
    series_id: seriesId,
    user_id,
    instance_date: instanceDate || null,
  }));

  const { error: insertError } = await supabase.from('event_users').insert(rows);
  if (insertError) {
    throw new Error(insertError.message || 'Nepodařilo se přidat do chatu');
  }

  const title = eventTitle || series.nazev || 'událost';
  const dStr = instanceDate || '';

  createNotificationsForRecipients({
    recipientIds: toAdd,
    actorId,
    type: 'event_created',
    message: `tě přidal(a) do chatu události "${title}". [EVENT:${seriesId}:${dStr}:${title}]`,
    seriesId,
    instanceDate: instanceDate || null,
  }).catch(console.error);

  return { added: toAdd };
}
