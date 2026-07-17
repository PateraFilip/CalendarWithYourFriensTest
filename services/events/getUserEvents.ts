import { supabase } from '@/lib/supabaseClient';

export interface UserEvent {
  event_id: number;
  user_id: string | number;
  instance_date?: string | null;
}

export const fetchUserEvents = async (): Promise<UserEvent[]> => {
  // RPC: spolehlivě vidí účastníky i u skupin, které vlastním / kam jsem pozván
  const { data: rpcData, error: rpcError } = await supabase.rpc('list_event_users');

  if (!rpcError && rpcData) {
    return (rpcData as Array<{ series_id: number; user_id: string; instance_date: string | null }>).map(
      (r) => ({
        event_id: r.series_id,
        user_id: r.user_id,
        instance_date: r.instance_date,
      })
    );
  }

  if (rpcError) {
    console.warn('[fetchUserEvents] RPC list_event_users:', rpcError.message);
  }

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
