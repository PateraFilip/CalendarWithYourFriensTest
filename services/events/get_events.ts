import { dedupeCalendarEvents } from '@/lib/calendarEvents';
import { wallTimeToLocalDate } from '@/lib/eventDates';
import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import { fetchInvitedSeriesIds } from '@/services/events/invites';
import { fetchMyFriendships } from '@/services/friends/friendships';

const DAY_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

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
  timezone?: string | null;
}) {
  const startTime = (e.cas_od ?? '00:00').toString().slice(0, 5);
  const endTime = (e.cas_do ?? '23:59').toString().slice(0, 5);
  const tz = e.timezone || undefined;

  const den = (e.instance_date ?? e.den_od ?? '').toString().slice(0, 10);
  const denDo = (e.den_do ?? den).toString().slice(0, 10);

  let rule: { type?: string; start_date?: string; end_date?: string } | undefined;
  try {
    rule = typeof e.recurrence_rule === 'string' ? JSON.parse(e.recurrence_rule) : e.recurrence_rule;
  } catch {
    // ignore
  }
  let originalStart: Date | undefined;
  let originalEnd: Date | undefined;

  if (rule?.type === 'once' && rule.start_date && rule.end_date) {
    originalStart = wallTimeToLocalDate(rule.start_date, startTime, tz);
    originalEnd = wallTimeToLocalDate(rule.end_date, endTime, tz);
  } else if (e.valid_from && e.valid_until && e.valid_from !== e.valid_until) {
    originalStart = wallTimeToLocalDate(e.valid_from, startTime, tz);
    originalEnd = wallTimeToLocalDate(e.valid_until, endTime, tz);
  } else if (e.den_od && e.den_do && e.den_od !== e.den_do) {
    originalStart = wallTimeToLocalDate(e.den_od, startTime, tz);
    originalEnd = wallTimeToLocalDate(e.den_do, endTime, tz);
  }

  return {
    id: e.series_id ?? e.id!,
    title: e.nazev,
    user_id: e.zakladatel_id,
    pocet_lidi: e.pocet_lidi ?? 0,
    start: wallTimeToLocalDate(den, startTime, tz),
    end: wallTimeToLocalDate(denDo, endTime, tz),
    pravidelnost: !!e.pravidelnost,
    is_group: !!e.is_group,
    poloha: e.poloha,
    latitude: e.latitude,
    longitude: e.longitude,
    recurrence_rule: e.recurrence_rule,
    group_id: e.group_id,
    original_start: originalStart,
    original_end: originalEnd,
    instance_date: den || undefined,
    den_od: den,
    den_do: denDo,
    cas_od: startTime,
    cas_do: endTime,
    timezone: tz,
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
    timezone?: string | null;
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
    timezone: s.timezone,
  });
}

async function fetchEventsFromSupabase(userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]> {
  // Optimalizace: Vždy stáhneme +/- 45 dní (cca 1,5 měsíce) kolem vybraného data.
  // Díky tomu uživatel vidí předchozí, aktuální a následující měsíc bez zpoždění.
  const from = startDate ? dayjs(startDate).subtract(60, 'day') : dayjs().subtract(60, 'day');
  const to = endDate ? dayjs(endDate).add(60, 'day') : dayjs().add(60, 'day');

  // Vlastní + osobní přátel + skupinové, kam jsem pozván
  const userIdStr = userId.toString();
  const [invitedSeriesIds, friendships] = await Promise.all([
    fetchInvitedSeriesIds(userIdStr),
    fetchMyFriendships(userIdStr),
  ]);
  const friendIds = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (String(f.user_id) === userIdStr ? String(f.friend_id) : String(f.user_id)));

  const { data: ownSeries, error: ownError } = await supabase
    .from('event_series')
    .select('*')
    .eq('zakladatel_id', userIdStr);

  if (ownError) {
    console.error('event_series own:', ownError.message);
    return [];
  }

  let friendsPersonalSeries: any[] = [];
  if (friendIds.length > 0) {
    const { data, error: friendsError } = await supabase
      .from('event_series')
      .select('*')
      .in('zakladatel_id', friendIds)
      .eq('is_group', false);
    if (friendsError) {
      console.error('event_series friends personal:', friendsError.message);
    } else {
      friendsPersonalSeries = data ?? [];
    }
  }

  let invitedSeries: any[] = [];
  if (invitedSeriesIds.length > 0) {
    const { data, error: invitedError } = await supabase
      .from('event_series')
      .select('*')
      .in('id', invitedSeriesIds)
      .eq('is_group', true);
    if (invitedError) {
      console.error('event_series invited:', invitedError.message);
    } else {
      invitedSeries = data ?? [];
    }
  }

  const seriesById = new Map<number, any>();
  for (const s of [...(ownSeries ?? []), ...friendsPersonalSeries, ...invitedSeries]) {
    seriesById.set(s.id, s);
  }
  const seriesList = Array.from(seriesById.values());

  // Načteme výjimky jen pro viditelné série
  const seriesIds = seriesList.map((s) => s.id);
  let exceptions: any[] = [];
  if (seriesIds.length > 0) {
    const { data: excData } = await supabase
      .from('series_exceptions')
      .select('*')
      .in('series_id', seriesIds);
    exceptions = excData ?? [];
  }
  const exceptionsMap = new Map<string, any>();
  // Preferuj DELETE před UPDATE, pokud by náhodou byly obě
  for (const exc of exceptions) {
    const key = `${exc.series_id}-${String(exc.puvodni_den).slice(0, 10)}`;
    const existing = exceptionsMap.get(key);
    if (!existing || exc.typ === 'DELETE') {
      exceptionsMap.set(key, exc);
    }
  }

  const result: ReturnType<typeof mapRawToEvent>[] = [];

  const inSeriesValidity = (dateStr: string, s: any) => {
    if (s.valid_from && dateStr < String(s.valid_from).slice(0, 10)) return false;
    if (s.valid_until && dateStr > String(s.valid_until).slice(0, 10)) return false;
    return true;
  };

  const applyException = (event: any, exc: any, fallbackOd: string, fallbackDo: string) => {
    const tz = event.timezone;
    if (exc.title) event.title = exc.title;
    if (exc.poloha !== undefined && exc.poloha !== null) event.poloha = exc.poloha;
    if (exc.latitude !== undefined) event.latitude = exc.latitude;
    if (exc.longitude !== undefined) event.longitude = exc.longitude;
    if (exc.pocet_lidi !== undefined && exc.pocet_lidi !== null) event.pocet_lidi = exc.pocet_lidi;
    if (exc.is_group !== undefined && exc.is_group !== null) event.is_group = exc.is_group;
    if (exc.den_od) {
      event.start = wallTimeToLocalDate(
        String(exc.den_od).slice(0, 10),
        String(exc.cas_od || fallbackOd).slice(0, 5),
        tz
      );
      event.instance_date = String(exc.den_od).slice(0, 10);
    }
    if (exc.den_do) {
      event.end = wallTimeToLocalDate(
        String(exc.den_do).slice(0, 10),
        String(exc.cas_do || fallbackDo).slice(0, 5),
        tz
      );
    }
  };

  for (const s of seriesList) {
    const rule = s.recurrence_rule as { type?: string; start_date?: string; end_date?: string; days?: string[]; pattern?: any[]; cycle_days?: number; anchor_date?: string };
    const casOd = String(s.cas_od).slice(0, 5);
    const casDo = String(s.cas_do).slice(0, 5);

    if (rule?.type === 'once' && rule.start_date) {
      const eventValidFrom = s.valid_from || rule.start_date;
      const eventValidUntil = s.valid_until || rule.end_date || rule.start_date;

      const eventStart = dayjs(eventValidFrom);
      const eventEnd = dayjs(eventValidUntil);

      if (eventEnd.isBefore(from, 'day') || eventStart.isAfter(to, 'day')) {
        continue;
      }

      const endDate = rule.end_date ?? rule.start_date;
      let denDo = endDate;
      if (casDo <= casOd && endDate === rule.start_date) {
        denDo = dayjs(rule.start_date).add(1, 'day').format('YYYY-MM-DD');
      }
      let event = buildEventFromSeries(s, eventValidFrom, denDo, false, rule);
      if (rule.start_date && rule.end_date && rule.start_date !== rule.end_date) {
        event.start = wallTimeToLocalDate(rule.start_date, casOd, s.timezone);
        event.end = wallTimeToLocalDate(rule.end_date, casDo, s.timezone);
        event.original_start = event.start;
        event.original_end = event.end;
      }
      const excKey = `${s.id}-${String(rule.start_date).slice(0, 10)}`;
      const exc = exceptionsMap.get(excKey);
      if (exc && exc.typ === 'DELETE') {
        continue;
      }
      if (exc && exc.typ === 'UPDATE') {
        applyException(event, exc, casOd, casDo);
      }
      result.push(event);
      continue;
    }

    if (rule?.type === 'weekly' && rule.days?.length) {
      const daysSet = new Set(rule.days.map((d: string) => d.trim()));
      let cursor = from.startOf('day');
      const endCursor = to.endOf('day');

      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor, 'day')) {
        const dateStr = cursor.format('YYYY-MM-DD');
        if (!inSeriesValidity(dateStr, s)) {
          cursor = cursor.add(1, 'day');
          continue;
        }
        const dayName = DAY_SHORT[cursor.day()];
        if (!daysSet.has(dayName)) {
          cursor = cursor.add(1, 'day');
          continue;
        }

        let denDo = dateStr;
        if (casDo <= casOd) {
          denDo = cursor.add(1, 'day').format('YYYY-MM-DD');
        }
        let event = buildEventFromSeries(s, dateStr, denDo, true, rule);
        const excKey = `${s.id}-${dateStr}`;
        const exc = exceptionsMap.get(excKey);
        if (exc && exc.typ === 'DELETE') {
          cursor = cursor.add(1, 'day');
          continue;
        }
        if (exc && exc.typ === 'UPDATE') {
          applyException(event, exc, casOd, casDo);
        }
        result.push(event);
        cursor = cursor.add(1, 'day');
      }
    }

    if (rule?.type === 'pattern' && rule.pattern && rule.cycle_days && rule.anchor_date) {
      const anchor = dayjs(rule.anchor_date).startOf('day');
      let cursor = from.startOf('day');
      const endCursor = to.endOf('day');

      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor, 'day')) {
        const dateStr = cursor.format('YYYY-MM-DD');
        if (!inSeriesValidity(dateStr, s)) {
          cursor = cursor.add(1, 'day');
          continue;
        }

        const dayOffset = cursor.diff(anchor, 'day');
        if (dayOffset < 0) {
          cursor = cursor.add(1, 'day');
          continue;
        }

        const slot = rule.pattern[dayOffset % rule.cycle_days];
        if (!slot?.work) {
          cursor = cursor.add(1, 'day');
          continue;
        }

        const od = slot.start ?? casOd;
        const do_ = slot.end ?? casDo;
        let denDo = dateStr;
        if (do_ <= od && od !== '00:00') {
          denDo = cursor.add(1, 'day').format('YYYY-MM-DD');
        }

        let event = buildEventFromSeries(s, dateStr, denDo, true, rule);
        // Pattern slot times
        event.start = wallTimeToLocalDate(dateStr, String(od).slice(0, 5), s.timezone);
        event.end = wallTimeToLocalDate(denDo, String(do_).slice(0, 5), s.timezone);
        event.cas_od = String(od).slice(0, 5);
        event.cas_do = String(do_).slice(0, 5);

        const excKey = `${s.id}-${dateStr}`;
        const exc = exceptionsMap.get(excKey);
        if (exc && exc.typ === 'DELETE') {
          cursor = cursor.add(1, 'day');
          continue;
        }
        if (exc && exc.typ === 'UPDATE') {
          applyException(event, exc, String(od).slice(0, 5), String(do_).slice(0, 5));
        }
        result.push(event);
        cursor = cursor.add(1, 'day');
      }
    }
  }

  return dedupeCalendarEvents(result);
}

export const fetchEvents = async (userId: string | number, startDate?: Date, endDate?: Date): Promise<any[]> => {
  console.log('Using local fetchEventsFromSupabase (Edge Function disabled) s rozmezím:', startDate, endDate);
  return fetchEventsFromSupabase(userId, startDate, endDate);
};
