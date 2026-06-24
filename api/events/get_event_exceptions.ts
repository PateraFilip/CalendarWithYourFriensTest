import { supabase } from '@/lib/supabaseClient';

interface EventException {
    id: number;
    start: Date;
    end: Date;
    event_id: number;
    typ: string;
    puvodni_start: Date;
    puvodni_end: Date;
}

export const fetchEventsException = async (): Promise<EventException[]> => {
    const { data, error } = await supabase
        .from('series_exceptions')
        .select('*');

    if (error) {
        throw new Error(error.message || 'Failed to fetch event exceptions');
    }

    const events: EventException[] = data.map((e: any) => {
        const startTime = e.cas_od ?? '00:00'
        const endTime = e.cas_do ?? '23:59'

        const startTimeOriginal = e.puvodni_cas_od ?? '00:00'
        const endTimeOriginal = e.puvodni_cas_do ?? '23:59'

        return {
            id: e.id,
            start: new Date(`${e.den_od}T${startTime}`),
            end: new Date(`${e.den_do ?? e.den_od}T${endTime}`),
            event_id: e.series_id ?? e.event_id,
            typ: e.typ,
            puvodni_start: new Date(`${e.puvodni_den}T${startTimeOriginal}`),
            puvodni_end: new Date(`${e.puvodni_den}T${endTimeOriginal}`)
        }
    })

    return events
}
