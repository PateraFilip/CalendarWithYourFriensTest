import { supabase } from '@/lib/supabaseClient';

export interface UserEvent {
  event_id: number;
  user_id: number;
  instance_date?: string;
}

export const fetchUserEvents = async (): Promise<UserEvent[]> => {
  const { data, error } = await supabase
    .from('event_users')
    .select('series_id, user_id, instance_date');

  if (!error && data) {
    return data.map((r) => ({
      event_id: r.series_id,
      user_id: r.user_id,
      instance_date: r.instance_date,
    }));
  }

  console.error('event_users:', error?.message);
  return [];
};
