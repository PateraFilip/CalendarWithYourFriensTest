import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';

export type ExceptionType = 'DELETE' | 'UPDATE';

interface UpsertExceptionInput {
  event_id: number;
  typ: ExceptionType;
  puvodni_den: Date | string;
  start?: Date | null;
  end?: Date | null;
  puvodni_cas_od?: Date | string | null;
  puvodni_cas_do?: Date | string | null;
  title?: string;
  poloha?: string;
  latitude?: number | null;
  longitude?: number | null;
  pocet_lidi?: number;
  is_group?: boolean;
}

function toDateStr(value: Date | string) {
  return dayjs(value).format('YYYY-MM-DD');
}

function toTimeStr(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }
  return dayjs(value).format('HH:mm');
}

/**
 * Upsert výjimky pro (series_id, puvodni_den).
 * Vyžaduje unique constraint series_exceptions_series_day_unique.
 */
export const createException = async (event: UpsertExceptionInput) => {
  const puvodniDen = toDateStr(event.puvodni_den);
  const seriesId = event.event_id;

  const payload: Record<string, any> = {
    series_id: seriesId,
    typ: event.typ,
    puvodni_den: puvodniDen,
    puvodni_cas_od: toTimeStr(event.puvodni_cas_od ?? event.start),
    puvodni_cas_do: toTimeStr(event.puvodni_cas_do ?? event.end),
  };

  if (event.typ === 'UPDATE') {
    payload.den_od = event.start ? toDateStr(event.start) : puvodniDen;
    payload.cas_od = toTimeStr(event.start);
    payload.den_do = event.end ? toDateStr(event.end) : payload.den_od;
    payload.cas_do = toTimeStr(event.end);
    if (event.title !== undefined) payload.title = event.title;
    if (event.poloha !== undefined) payload.poloha = event.poloha;
    if (event.latitude !== undefined) payload.latitude = event.latitude;
    if (event.longitude !== undefined) payload.longitude = event.longitude;
    if (event.pocet_lidi !== undefined) payload.pocet_lidi = event.pocet_lidi;
    if (event.is_group !== undefined) payload.is_group = event.is_group;
  } else {
    // DELETE — vyčisti UPDATE pole
    payload.den_od = null;
    payload.cas_od = null;
    payload.den_do = null;
    payload.cas_do = null;
    payload.title = null;
    payload.poloha = null;
    payload.latitude = null;
    payload.longitude = null;
    payload.pocet_lidi = null;
    payload.is_group = null;
  }

  const { data, error } = await supabase
    .from('series_exceptions')
    .upsert(payload, { onConflict: 'series_id,puvodni_den' })
    .select()
    .single();

  if (error) {
    // Fallback: delete + insert (starší DB bez unique)
    await supabase
      .from('series_exceptions')
      .delete()
      .eq('series_id', seriesId)
      .eq('puvodni_den', puvodniDen);

    const { data: inserted, error: insertError } = await supabase
      .from('series_exceptions')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message || 'Failed to create exception');
    }
    return inserted;
  }

  return data;
};
