import { supabase } from '@/lib/supabaseClient';

export const sendSystemMessage = async ({
  type,
  message,
  user_id,
  series_id,
  instance_date
}: {
  type: 'global' | 'event';
  message: string;
  user_id: string | number;
  series_id?: number;
  instance_date?: string | null;
}) => {
  const tableName = type === 'global' ? 'global_messages' : 'event_messages';
  
  const payload: any = {
    message,
    user_id,
    is_system_message: true
  };

  if (type === 'event') {
    if (!series_id) return null;
    payload.series_id = series_id;
    if (instance_date) payload.instance_date = instance_date;
  }

  const { data, error } = await supabase
    .from(tableName)
    .insert(payload);

  if (error) {
    console.error('Error sending system message:', error);
    return null;
  }
  return data;
};
