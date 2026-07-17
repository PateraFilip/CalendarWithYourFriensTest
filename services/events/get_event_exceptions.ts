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

/** Načte výjimky jen pro zadané série (ne celou tabulku). */
export const fetchEventsException = async (
  seriesIds?: number[]
): Promise<EventException[]> => {
  if (seriesIds && seriesIds.length === 0) return [];

  let query = supabase.from('series_exceptions').select('*');
  if (seriesIds && seriesIds.length > 0) {
    query = query.in('series_id', seriesIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Failed to fetch event exceptions');
  }

  return (data || []).map((e: any) => {
    const startTime = e.cas_od ?? '00:00';
    const endTime = e.cas_do ?? '23:59';
    const startTimeOriginal = e.puvodni_cas_od ?? '00:00';
    const endTimeOriginal = e.puvodni_cas_do ?? '23:59';

    return {
      id: e.id,
      start: new Date(`${e.den_od}T${startTime}`),
      end: new Date(`${e.den_do ?? e.den_od}T${endTime}`),
      event_id: e.series_id ?? e.event_id,
      typ: e.typ,
      puvodni_start: new Date(`${e.puvodni_den}T${startTimeOriginal}`),
      puvodni_end: new Date(`${e.puvodni_den}T${endTimeOriginal}`),
    };
  });
};
