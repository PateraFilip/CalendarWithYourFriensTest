import { supabase } from '@/lib/supabaseClient';
import { sendSystemMessage } from '@/api/system/send_system_message';

interface JoinEvent {
  user_id: string
  event_id: number
  instance_date?: string
  skipSystemMessage?: boolean
}

export const joinEvent = async (event: JoinEvent) => {
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

  if (!event.skipSystemMessage) {
    sendSystemMessage({
      type: 'event',
      message: 'se přihlásil(a) k události.',
      user_id: event.user_id,
      series_id: event.event_id,
      instance_date: event.instance_date
    }).catch(console.error);
  }

  return data;
}
