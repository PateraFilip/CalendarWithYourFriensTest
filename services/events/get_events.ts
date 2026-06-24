import { dedupeCalendarEvents } from '@/lib/calendarEvents';
import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import { fetchMyFriendships } from '@/services/friends/friendships';

const DAY_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

const API_URL =
  'https://sdzyhihtqrgsntbxlugp.supabase.co/functions/v1/get_all_events';
const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38';

function mapRawToEvent(e: {
  id?: number;
  series_id?: number;
  nazev: string;
  zakladatel_id: number;
  pocet_lidi?: number;
  den_od: string;
  den_do?: string;
  cas_od?: string;
  cas_do?: string;
  pravidelnost?: boolean;
  is_group?: boolean;
  instance_date?: string;
  poloha?: string;
  latitude?: number | null;
  longitude?: number | null;
  recurrence_rule?: any;
  group_id?: number;
  valid_from?: string;
  valid_until?: string;
}) {
  // Backend už nám posílá přesně oříznuté časy, nemusíme nad tím přemýšlet.
  const startTime = (e.cas_od ?? '00:00').toString().slice(0, 5);
  const endTime = (e.cas_do ?? '23:59').toString().slice(0, 5);

  // Instance date je den, kam přesně tento kousek patří.
  const den = (e.instance_date ?? e.den_od ?? '').toString().slice(0, 10);
  const denDo = (e.den_do ?? den).toString().slice(0, 10);

  // Calculate original start and end for multi-day events
  let rule: { type?: string; start_date?: string; end_date?: string } | undefined;
  try {
    rule = typeof e.recurrence_rule === 'string' ? JSON.parse(e.recurrence_rule) : e.recurrence_rule;
  } catch (err) {
    // If parsing fails, rule remains undefined
  }
  let originalStart: Date | undefined;
  let originalEnd: Date | undefined;

  if (rule?.type === 'once' && rule.start_date && rule.end_date) {
    originalStart = new Date(`${rule.start_date}T${startTime}`);
    originalEnd = new Date(`${rule.end_date}T${endTime}`);
  } else if (e.valid_from && e.valid_until && e.valid_from !== e.valid_until) {
    originalStart = new Date(`${e.valid_from}T${startTime}`);
    originalEnd = new Date(`${e.valid_until}T${endTime}`);
  } else if (e.den_od && e.den_do && e.den_od !== e.den_do) {
    originalStart = new Date(`${e.den_od}T${startTime}`);
    originalEnd = new Date(`${e.den_do}T${endTime}`);
  }

  return {
    id: e.series_id ?? e.id!,
    title: e.nazev,
    user_id: e.zakladatel_id,
    pocet_lidi: e.pocet_lidi ?? 0,
    start: dayjs(`${den}T${startTime}`).toDate(),
    end: dayjs(`${den}T${endTime}`).toDate(),
    pravidelnost: !!e.pravidelnost,
    is_group: !!e.is_group,
    poloha: e.poloha,
    latitude: e.latitude,
    longitude: e.longitude,
    recurrence_rule: e.recurrence_rule,
    group_id: e.group_id,
    original_start: originalStart,
    original_end: originalEnd,
  };
}

function buildEventFromSeries(
  s: {
    id: number;
    nazev: string;
    zakladatel_id: number;
    pocet_lidi: number;
    is_group: boolean;
    cas_od: string;
    cas_do: string;
    poloha?: string;
    latitude?: number | null;
    longitude?: number | null;
    group_id?: number;
  },
  denOd: string,
  denDo: string,
  pravidelnost: boolean,
  recurrence_rule?: any,
) {
  return mapRawToEvent({
    series_id: s.id,
    nazev: s.nazev,
    zakladatel_id: s.zakladatel_id,
    pocet_lidi: s.pocet_lidi,
    den_od: denOd,
    den_do: denDo,
    cas_od: String(s.cas_od).slice(0, 5),
    cas_do: String(s.cas_do).slice(0, 5),
    pravidelnost,
    is_group: s.is_group,
    instance_date: denOd,
    poloha: s.poloha,
    latitude: s.latitude,
    longitude: s.longitude,
    recurrence_rule: recurrence_rule,
    group_id: s.group_id,
  });
}

async function fetchEventsFromSupabase(userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]> {
  // Optimalizace: Vždy stáhneme +/- 45 dní (cca 1,5 měsíce) kolem vybraného data.
  // Díky tomu uživatel vidí předchozí, aktuální a následující měsíc bez zpoždění.
  const from = startDate ? dayjs(startDate).subtract(60, 'day') : dayjs().subtract(60, 'day');
  const to = endDate ? dayjs(endDate).add(60, 'day') : dayjs().add(60, 'day');

  // Filtrujeme jen na přátele a uživatele samotného
  const userIdStr = userId.toString();
  const friendships = await fetchMyFriendships(userIdStr);
  const acceptedFriends = friendships.filter(f => f.status === 'accepted');
  const friendIds = acceptedFriends.map(f => f.user_id.toString() === userIdStr ? f.friend_id : f.user_id);
  const allowedIds = [userIdStr, ...friendIds];

  const { data: seriesList, error } = await supabase
    .from('event_series')
    .select('*')
    .in('zakladatel_id', allowedIds);
    
  if (error) {
    console.error('event_series:', error.message);
    return [];
  }

  // Načteme výjimky pro pravidelné události
  const { data: exceptions } = await supabase.from('series_exceptions').select('*');
  const exceptionsMap = new Map<string, any>();
  for (const exc of exceptions ?? []) {
    const key = `${exc.series_id}-${exc.puvodni_den}`;
    exceptionsMap.set(key, exc);
  }

  const result: ReturnType<typeof mapRawToEvent>[] = [];

  for (const s of seriesList ?? []) {
    const rule = s.recurrence_rule as { type?: string; start_date?: string; end_date?: string; days?: string[]; pattern?: any[]; cycle_days?: number; anchor_date?: string };
    const casOd = String(s.cas_od).slice(0, 5);
    const casDo = String(s.cas_do).slice(0, 5);

    if (rule?.type === 'once' && rule.start_date) {
      // Check if event is within the valid date range
      const eventValidFrom = s.valid_from || rule.start_date;
      const eventValidUntil = s.valid_until || rule.end_date || rule.start_date;

      const eventStart = dayjs(eventValidFrom);
      const eventEnd = dayjs(eventValidUntil);

      // Only include events that overlap with our date range
      if (eventEnd.isBefore(from) || eventStart.isAfter(to)) {
        continue;
      }

      const endDate = rule.end_date ?? rule.start_date;
      let denDo = endDate;
      // Pokud cas_do <= cas_od, událost překračuje půlnoc (např. 24h událost)
      if (casDo <= casOd && endDate === rule.start_date) {
        denDo = dayjs(rule.start_date).add(1, 'day').format('YYYY-MM-DD');
      }
      let event = buildEventFromSeries(s, eventValidFrom, denDo, false, rule);
      // For multi-day events, set start and end with full date+time
      if (rule.start_date && rule.end_date && rule.start_date !== rule.end_date) {
        event.start = new Date(`${rule.start_date}T${casOd}`);
        event.end = new Date(`${rule.end_date}T${casDo}`);
        event.original_start = event.start;
        event.original_end = event.end;
      }
      // Aplikujeme výjimku, pokud existuje
      const excKey = `${s.id}-${rule.start_date}`;
      const exc = exceptionsMap.get(excKey);
      if (exc && exc.typ === 'UPDATE') {
        if (exc.title) event.title = exc.title;
        if (exc.poloha !== undefined) event.poloha = exc.poloha;
        if (exc.latitude !== undefined) event.latitude = exc.latitude;
        if (exc.longitude !== undefined) event.longitude = exc.longitude;
        if (exc.pocet_lidi !== undefined) event.pocet_lidi = exc.pocet_lidi;
        if (exc.is_group !== undefined) event.is_group = exc.is_group;
        if (exc.den_od) event.start = new Date(`${exc.den_od}T${exc.cas_od || casOd}`);
        if (exc.den_do) event.end = new Date(`${exc.den_do}T${exc.cas_do || casDo}`);
      }
      result.push(event);
      continue;
    }

    if (rule?.type === 'weekly' && rule.days?.length) {
      const daysSet = new Set(rule.days.map((d: string) => d.trim()));
      
      const currentD = new Date(from.toDate());
      const endD = to.toDate();
      // Normalize times
      currentD.setHours(0,0,0,0);
      endD.setHours(23,59,59,999);

      while (currentD <= endD) {
        const dayName = DAY_SHORT[currentD.getDay()];
        if (!daysSet.has(dayName)) {
            currentD.setDate(currentD.getDate() + 1);
            continue;
        }

        const dateStr = currentD.toISOString().split('T')[0];
        let denDo = dateStr;
        // Pokud cas_do <= cas_od, událost překračuje půlnoc
        if (casDo <= casOd) {
          const nextDay = new Date(currentD);
          nextDay.setDate(nextDay.getDate() + 1);
          denDo = nextDay.toISOString().split('T')[0];
        }
        let event = buildEventFromSeries(s, dateStr, denDo, true, rule);
        // Aplikujeme výjimku, pokud existuje
        const excKey = `${s.id}-${dateStr}`;
        const exc = exceptionsMap.get(excKey);
        if (exc && exc.typ === 'UPDATE') {
          if (exc.title) event.title = exc.title;
          if (exc.poloha !== undefined) event.poloha = exc.poloha;
          if (exc.latitude !== undefined) event.latitude = exc.latitude;
          if (exc.longitude !== undefined) event.longitude = exc.longitude;
          if (exc.pocet_lidi !== undefined) event.pocet_lidi = exc.pocet_lidi;
          if (exc.is_group !== undefined) event.is_group = exc.is_group;
          if (exc.den_od) event.start = new Date(`${exc.den_od}T${exc.cas_od || casOd}`);
          if (exc.den_do) event.end = new Date(`${exc.den_do}T${exc.cas_do || casDo}`);
        }
        result.push(event);
        currentD.setDate(currentD.getDate() + 1);
      }
    }

    if (rule?.type === 'pattern' && rule.pattern && rule.cycle_days && rule.anchor_date) {
      const anchor = new Date(rule.anchor_date);
      anchor.setHours(0,0,0,0);
      
      const currentD = new Date(from.toDate());
      const endD = to.toDate();
      currentD.setHours(0,0,0,0);
      endD.setHours(23,59,59,999);

      while (currentD <= endD) {
        const diffTime = currentD.getTime() - anchor.getTime();
        const dayOffset = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (dayOffset < 0) {
            currentD.setDate(currentD.getDate() + 1);
            continue;
        }

        const slot = rule.pattern[dayOffset % rule.cycle_days];
        if (!slot?.work) {
            currentD.setDate(currentD.getDate() + 1);
            continue;
        }

        const od = slot.start ?? casOd;
        const do_ = slot.end ?? casDo;
        const dateStr = currentD.toISOString().split('T')[0];
        let denDo = dateStr;
        if (do_ <= od && od !== '00:00') {
          const nextDay = new Date(currentD);
          nextDay.setDate(nextDay.getDate() + 1);
          denDo = nextDay.toISOString().split('T')[0];
        }

        let event = buildEventFromSeries(s, dateStr, denDo, true, rule);
        // Aplikujeme výjimku, pokud existuje
        const excKey = `${s.id}-${dateStr}`;
        const exc = exceptionsMap.get(excKey);
        if (exc && exc.typ === 'UPDATE') {
          if (exc.title) event.title = exc.title;
          if (exc.poloha !== undefined) event.poloha = exc.poloha;
          if (exc.latitude !== undefined) event.latitude = exc.latitude;
          if (exc.longitude !== undefined) event.longitude = exc.longitude;
          if (exc.pocet_lidi !== undefined) event.pocet_lidi = exc.pocet_lidi;
          if (exc.is_group !== undefined) event.is_group = exc.is_group;
          if (exc.den_od) event.start = new Date(`${exc.den_od}T${exc.cas_od || od}`);
          if (exc.den_do) event.end = new Date(`${exc.den_do}T${exc.cas_do || do_}`);
        }
        result.push(event);
        currentD.setDate(currentD.getDate() + 1);
      }
    }
  }

  return dedupeCalendarEvents(result);
}

export const fetchEvents = async (userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]> => {
  console.log('Using local fetchEventsFromSupabase (Edge Function disabled) s rozmezím:', startDate, endDate);
  return fetchEventsFromSupabase(userId, startDate, endDate);
};
