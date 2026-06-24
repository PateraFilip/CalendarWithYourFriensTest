import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';

interface UpdateEventInput {
  id: number
  title: string
  start: Date
  end: Date | null
  peopleCount?: number
  pravidelnost?: boolean
  is_group?: boolean
  poloha?: string
  latitude?: number | null
  longitude?: number | null
  recurrence_rule?: any
  valid_from?: string
  valid_until?: string
}

interface UpdateWeeklyEventInput {
  title: string
  id: number
  start: Date
  end: Date | null
  poloha?: string
  latitude?: number | null
  longitude?: number | null
  peopleCount?: number
  is_group?: boolean
  recurrence_rule?: any
  valid_from?: string
  valid_until?: string
  cas_od?: string
  cas_do?: string
}

export const updateEvent = async (event: Partial<UpdateEventInput> & { id: number }) => {
  const payload: any = {};
  if (event.title !== undefined) payload.nazev = event.title;
  if (event.start !== undefined) payload.cas_od = dayjs(event.start).format('HH:mm');
  if (event.end !== undefined) payload.cas_do = event.end ? dayjs(event.end).format('HH:mm') : null;
  if (event.peopleCount !== undefined) payload.pocet_lidi = event.peopleCount;
  if (event.is_group !== undefined) payload.is_group = event.is_group;
  if (event.poloha !== undefined) payload.poloha = event.poloha;
  if (event.latitude !== undefined) payload.latitude = event.latitude;
  if (event.longitude !== undefined) payload.longitude = event.longitude;
  if (event.recurrence_rule !== undefined) payload.recurrence_rule = event.recurrence_rule;
  if (event.valid_from !== undefined) payload.valid_from = event.valid_from;
  if (event.valid_until !== undefined) payload.valid_until = event.valid_until;

  const { data, error } = await supabase
    .from('event_series')
    .update(payload)
    .eq('id', event.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update event');
  }

  return data;
}

export const updateWeeklyEvent = async (event: Partial<UpdateWeeklyEventInput> & { id: number }) => {
  const payload: any = {};
  if (event.title !== undefined) payload.nazev = event.title;
  if (event.cas_od !== undefined || event.start !== undefined) payload.cas_od = event.cas_od || dayjs(event.start).format('HH:mm');
  if (event.cas_do !== undefined || event.end !== undefined) payload.cas_do = event.cas_do || (event.end ? dayjs(event.end).format('HH:mm') : null);
  if (event.poloha !== undefined) payload.poloha = event.poloha;
  if (event.latitude !== undefined) payload.latitude = event.latitude;
  if (event.longitude !== undefined) payload.longitude = event.longitude;
  if (event.peopleCount !== undefined) payload.pocet_lidi = event.peopleCount;
  if (event.is_group !== undefined) payload.is_group = event.is_group;
  if (event.recurrence_rule !== undefined) payload.recurrence_rule = event.recurrence_rule;
  if (event.valid_from !== undefined) payload.valid_from = event.valid_from;
  if (event.valid_until !== undefined) payload.valid_until = event.valid_until;

  const { data, error } = await supabase
    .from('event_series')
    .update(payload)
    .eq('id', event.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update weekly event');
  }

  return data;
}
