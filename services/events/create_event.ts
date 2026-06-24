import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { sendSystemMessage } from '@/services/system/send_system_message';

interface CreateEventInput {
  title: string
  user_id: number
  start: Date
  end: Date | null
  peopleCount?: number
  pravidelnost?: boolean
  is_group?: boolean
  poloha?: string
  latitude?: number | null
  longitude?: number | null
}


interface CreatePatternEventInput {
  title: string
  user_id: number
  anchor_date: Date
  cycle_days: number
  pattern: { work: boolean; start?: string; end?: string }[]
  cas_od: string
  cas_do: string
  is_group?: boolean
  peopleCount?: number
  poloha?: string
  latitude?: number | null
  longitude?: number | null
  valid_until?: string
}

interface CreateMultiDateEventInput {
  title: string
  user_id: number
  dates: Date[]
  times: Record<string, { start?: Date; end?: Date }>
  is_group?: boolean
  peopleCount?: number
  poloha?: string
  latitude?: number | null
  longitude?: number | null
}

export const createEvent = async (event: CreateEventInput) => {
  const { data, error } = await supabase
    .from('event_series')
    .insert({
      nazev: event.title,
      zakladatel_id: event.user_id,
      cas_od: dayjs(event.start).format('HH:mm'),
      cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      recurrence_rule: {
        type: 'once',
        start_date: dayjs(event.start).format('YYYY-MM-DD'),
        end_date: event.end ? dayjs(event.end).format('YYYY-MM-DD') : dayjs(event.start).format('YYYY-MM-DD'),
      },
      valid_from: dayjs(event.start).format('YYYY-MM-DD'),
      valid_until: event.end ? dayjs(event.end).format('YYYY-MM-DD') : dayjs(event.start).format('YYYY-MM-DD'),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create event');
  }

  // Zpráva do globálního chatu pokud je skupinová
  if (event.is_group) {
    sendSystemMessage({ type: 'global', message: `vytvořil(a) novou skupinovou událost: ${event.title} [EVENT:${data.id}::${event.title}]`, user_id: event.user_id }).catch(console.error);
  }

  return data;
}


export const createPatternEvent = async (event: CreatePatternEventInput) => {
  const { data, error } = await supabase
    .from('event_series')
    .insert({
      nazev: event.title,
      zakladatel_id: event.user_id,
      cas_od: event.cas_od,
      cas_do: event.cas_do,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      recurrence_rule: {
        type: 'pattern',
        cycle_days: event.cycle_days,
        anchor_date: dayjs(event.anchor_date).format('YYYY-MM-DD'),
        pattern: event.pattern,
      },
      valid_from: dayjs(event.anchor_date).format('YYYY-MM-DD'),
      valid_until: event.valid_until,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create pattern event');
  }

  if (event.is_group) {
    sendSystemMessage({ type: 'global', message: `vytvořil(a) novou skupinovou událost (cyklus): ${event.title} [EVENT:${data.id}::${event.title}]`, user_id: event.user_id }).catch(console.error);
  }

  return data;
}

export const createMultiDateEvent = async (event: CreateMultiDateEventInput) => {
  const sortedDates = event.dates.sort((a, b) => a.getTime() - b.getTime());
  const dateStrings = sortedDates.map(d => dayjs(d).format('YYYY-MM-DD'));

  // Generate a unique group_id for this set of events
  const { data: groupData, error: groupError } = await supabase
    .from('event_series')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  const nextGroupId = (groupData?.id || 0) + 1;

  // Create individual events for each date with shared group_id
  const eventsToInsert = dateStrings.map(dateStr => {
    const timeForDate = event.times[dateStr];
    const startTime = timeForDate?.start ? dayjs(timeForDate.start).format('HH:mm') : '08:00';
    const endTime = timeForDate?.end ? dayjs(timeForDate.end).format('HH:mm') : '09:00';

    return {
      nazev: event.title,
      zakladatel_id: event.user_id,
      cas_od: startTime,
      cas_do: endTime,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      recurrence_rule: {
        type: 'once',
        start_date: dateStr,
        end_date: dateStr,
      },
      valid_from: dateStr,
      valid_until: dateStr,
      group_id: nextGroupId,
    };
  });

  const { data, error } = await supabase
    .from('event_series')
    .insert(eventsToInsert)
    .select();

  if (error) {
    throw new Error(error.message || 'Failed to create multi-date events');
  }

  if (data && data.length > 0) {
    if (event.is_group) {
      sendSystemMessage({ type: 'global', message: `vytvořil(a) novou skupinu událostí: ${event.title} [EVENT:${data[0].id}::${event.title}]`, user_id: event.user_id }).catch(console.error);
    }
  }

  return data;
}
