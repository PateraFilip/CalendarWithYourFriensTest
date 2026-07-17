import { supabase } from '@/lib/supabaseClient';

export const sendSystemMessage = async ({
  type,
  message,
  user_id,
  series_id,
  instance_date,
}: {
  type: 'event' | 'global';
  message: string;
  user_id: string | number;
  series_id?: number;
  instance_date?: string | null;
}) => {
  // Global chat odstraněn — systémové zprávy jdou jen do event_messages
  if (type === 'global' || !series_id) {
    console.warn('sendSystemMessage: global/missing series ignored; use user_notifications');
    return null;
  }

  const payload: Record<string, unknown> = {
    message,
    user_id,
    is_system_message: true,
    series_id,
  };
  if (instance_date) payload.instance_date = instance_date;

  const { data, error } = await supabase.from('event_messages').insert(payload);

  if (error) {
    console.error('Error sending system message:', error);
    return null;
  }
  return data;
};
