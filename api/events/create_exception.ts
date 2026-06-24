import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';

interface CreateExceptionInput {
    event_id: number
    start: Date
    end: Date | null
    typ: string
    puvodni_den: Date
    puvodni_cas_od: Date
    puvodni_cas_do: Date
    title?: string
    poloha?: string
    latitude?: number | null
    longitude?: number | null
    pocet_lidi?: number
    is_group?: boolean
}

export const createException = async (event: CreateExceptionInput) => {
    const { data, error } = await supabase
        .from('series_exceptions')
        .insert({
            series_id: event.event_id,
            den_od: dayjs(event.start).format('YYYY-MM-DD'),
            cas_od: dayjs(event.start).format('HH:mm'),
            den_do: event.end ? dayjs(event.end).format('YYYY-MM-DD') : null,
            cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
            typ: event.typ,
            puvodni_den: dayjs(event.puvodni_den).format('YYYY-MM-DD'),
            puvodni_cas_od: dayjs(event.puvodni_cas_od).format('HH:mm'),
            puvodni_cas_do: dayjs(event.puvodni_cas_do).format('HH:mm'),
            title: event.title,
            poloha: event.poloha,
            latitude: event.latitude,
            longitude: event.longitude,
            pocet_lidi: event.pocet_lidi,
            is_group: event.is_group
        })
        .select()
        .single();

    if (error) {
        throw new Error(error.message || 'Failed to create exception');
    }

    return data;
}


