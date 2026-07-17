import { supabase } from '@/lib/supabaseClient';
import { notifyEventParticipants } from '@/services/notifications/eventNotify';
import { fetchChatParticipantIds } from '@/services/events/addFriendsToChat';

interface JoinEvent {
  user_id: string
  event_id: number
  instance_date?: string
  /** @deprecated oznámení jdou do inboxu, ne do chatu */
  skipSystemMessage?: boolean
  skipNotify?: boolean
}

export const joinEvent = async (event: JoinEvent) => {
  const { data: series } = await supabase
    .from('event_series')
    .select('zakladatel_id, is_group, nazev')
    .eq('id', event.event_id)
    .single();

  if (series?.is_group && String(series.zakladatel_id) !== String(event.user_id)) {
    const { data: invite } = await supabase
      .from('event_invites')
      .select('id')
      .eq('series_id', event.event_id)
      .eq('user_id', event.user_id)
      .maybeSingle();

    if (!invite) {
      throw new Error('Nejste pozváni na tuto událost');
    }
  }

  const { data, error } = await supabase
    .from('event_users')
    .insert({
      series_id: event.event_id,
      user_id: event.user_id,
      instance_date: event.instance_date,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to join event');
  }

  if (!event.skipNotify && !event.skipSystemMessage) {
    const title = series?.nazev || 'událost';
    const dStr = event.instance_date || '';
    const existing = await fetchChatParticipantIds(
      event.event_id,
      event.instance_date || null
    );
    const recipients = Array.from(
      new Set([
        ...existing,
        String(series?.zakladatel_id || ''),
      ].filter(Boolean))
    );

    notifyEventParticipants({
      participantIds: recipients,
      actorId: event.user_id,
      message: `se přihlásil(a) k události "${title}". [EVENT:${event.event_id}:${dStr}:${title}]`,
      seriesId: event.event_id,
      instanceDate: event.instance_date || null,
    }).catch(console.error);
  }

  return data;
}
