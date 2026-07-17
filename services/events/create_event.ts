import { supabase } from '@/lib/supabaseClient';
import { getDeviceTimezone } from '@/lib/eventDates';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { setEventInvites, setEventInvitesForSeriesIds } from '@/services/events/invites';
import { createNotificationsForRecipients } from '@/services/notifications/notifications';

/** Aktuální auth.uid() — musí existovat i řádek v public.users se stejným id. */
async function resolveZakladatelId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('Nejste přihlášeni — obnovte session a zkuste znovu.');
  }

  const authId = user.id;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id')
    .eq('id', authId)
    .maybeSingle();

  if (profileError) {
    console.error('[resolveZakladatelId] users lookup:', profileError.message);
    throw new Error(profileError.message);
  }

  if (!profile?.id) {
    throw new Error(
      'V tabulce users chybí profil pro tvůj účet (id ≠ auth.uid()). Odhlas se, přihlas znovu, nebo oprav řádek users.id.'
    );
  }

  return String(profile.id);
}

interface CreateEventInput {
  title: string
  user_id: number | string
  start: Date
  end: Date | null
  peopleCount?: number
  pravidelnost?: boolean
  is_group?: boolean
  poloha?: string
  latitude?: number | null
  longitude?: number | null
  inviteUserIds?: Array<string | number>
}

interface CreatePatternEventInput {
  title: string
  user_id: number | string
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
  inviteUserIds?: Array<string | number>
}

interface CreateMultiDateEventInput {
  title: string
  user_id: number | string
  dates: Date[]
  times: Record<string, { start?: Date; end?: Date }>
  is_group?: boolean
  peopleCount?: number
  poloha?: string
  latitude?: number | null
  longitude?: number | null
  inviteUserIds?: Array<string | number>
}

async function notifyInvitesAboutNewEvent(
  seriesId: number,
  title: string,
  userId: string | number,
  inviteUserIds: Array<string | number> | undefined,
  suffix = ''
) {
  if (!inviteUserIds?.length) return;
  await setEventInvites(seriesId, inviteUserIds);
  await createNotificationsForRecipients({
    recipientIds: inviteUserIds,
    actorId: userId,
    type: 'event_created',
    message: `vytvořil(a) novou skupinovou událost${suffix}: ${title} [EVENT:${seriesId}::${title}]`,
    seriesId,
  });
}

export const createEvent = async (event: CreateEventInput) => {
  const timezone = getDeviceTimezone();
  const zakladatelId = await resolveZakladatelId();
  const { data, error } = await supabase
    .from('event_series')
    .insert({
      nazev: event.title,
      zakladatel_id: zakladatelId,
      cas_od: dayjs(event.start).format('HH:mm'),
      cas_do: event.end ? dayjs(event.end).format('HH:mm') : null,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      timezone,
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
    console.error('[createEvent] RLS/insert:', error.message, { zakladatelId, code: error.code });
    throw new Error(error.message || 'Failed to create event');
  }

  if (event.is_group) {
    await notifyInvitesAboutNewEvent(data.id, event.title, zakladatelId, event.inviteUserIds);
  }

  return data;
}


export const createPatternEvent = async (event: CreatePatternEventInput) => {
  const timezone = getDeviceTimezone();
  const zakladatelId = await resolveZakladatelId();
  const { data, error } = await supabase
    .from('event_series')
    .insert({
      nazev: event.title,
      zakladatel_id: zakladatelId,
      cas_od: event.cas_od,
      cas_do: event.cas_do,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      timezone,
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
    console.error('[createPatternEvent] RLS/insert:', error.message, { zakladatelId, code: error.code });
    throw new Error(error.message || 'Failed to create pattern event');
  }

  if (event.is_group) {
    await notifyInvitesAboutNewEvent(data.id, event.title, zakladatelId, event.inviteUserIds, ' (cyklus)');
  }

  return data;
}

export const createMultiDateEvent = async (event: CreateMultiDateEventInput) => {
  const zakladatelId = await resolveZakladatelId();
  const sortedDates = event.dates.sort((a, b) => a.getTime() - b.getTime());
  const dateStrings = sortedDates.map(d => dayjs(d).format('YYYY-MM-DD'));

  const { data: groupData } = await supabase
    .from('event_series')
    .select('group_id')
    .not('group_id', 'is', null)
    .order('group_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextGroupId = (groupData?.group_id || 0) + 1;

  const eventsToInsert = dateStrings.map(dateStr => {
    const timeForDate = event.times[dateStr];
    const startTime = timeForDate?.start ? dayjs(timeForDate.start).format('HH:mm') : '08:00';
    const endTime = timeForDate?.end ? dayjs(timeForDate.end).format('HH:mm') : '09:00';
    const timezone = getDeviceTimezone();

    return {
      nazev: event.title,
      zakladatel_id: zakladatelId,
      cas_od: startTime,
      cas_do: endTime,
      pocet_lidi: event.peopleCount ?? 1,
      is_group: event.is_group ?? false,
      poloha: event.poloha,
      latitude: event.latitude,
      longitude: event.longitude,
      timezone,
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
    console.error('[createMultiDateEvent] RLS/insert:', error.message, { zakladatelId, code: error.code });
    throw new Error(error.message || 'Failed to create multi-date events');
  }

  if (data && data.length > 0 && event.is_group) {
    const ids = data.map((e) => e.id);
    if (event.inviteUserIds?.length) {
      await setEventInvitesForSeriesIds(ids, event.inviteUserIds);
      await createNotificationsForRecipients({
        recipientIds: event.inviteUserIds,
        actorId: zakladatelId,
        type: 'event_created',
        message: `vytvořil(a) novou skupinu událostí: ${event.title} [EVENT:${data[0].id}::${event.title}]`,
        seriesId: data[0].id,
      });
    }
  }

  return data;
}
