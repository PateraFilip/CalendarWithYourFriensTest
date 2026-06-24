import { supabase } from '@/lib/supabaseClient';

interface CancelEvent {
    user_id: string
    event_id: number
    instance_date?: string
}

export const cancelEvent = async (event: CancelEvent) => {
    let query = supabase
        .from('event_users')
        .delete()
        .eq('series_id', event.event_id)
        .eq('user_id', event.user_id);

    if (event.instance_date) {
        query = query.eq('instance_date', event.instance_date);
    } else {
        query = query.is('instance_date', null);
    }

    const { data, error } = await query.select();

    if (error) {
        throw new Error(error.message || 'Failed to cancel event');
    }

    return data;
}
