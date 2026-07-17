import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchEvents } from '@/services/events/get_events';
import { fetchEventsException } from '@/services/events/get_event_exceptions';
import { useAppDataOptional } from '@/contexts/AppDataContext';
import dayjs from 'dayjs';

interface Event {
  id: number;
  title: string;
  start: Date;
  end: Date;
  user_id: number;
  pocet_lidi: number;
  pravidelnost: boolean;
  is_group: boolean;
  original_start?: Date;
  original_end?: Date;
}
interface EventException {
  id: number;
  start: Date;
  end: Date;
  event_id: number;
  typ: string;
  puvodni_start: Date;
  puvodni_end: Date;
}

function monthCoveredByRange(
  month: Date,
  range: { from: string; to: string } | null | undefined
) {
  if (!range) return false;
  const start = dayjs(month).startOf('month');
  const end = dayjs(month).endOf('month');
  return (
    !start.isBefore(dayjs(range.from), 'day') &&
    !end.isAfter(dayjs(range.to), 'day')
  );
}

export function useCalendarEvents(user: any, selectedDate: Date | null) {
  const appData = useAppDataOptional();
  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [eventException, setEventException] = useState<EventException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localReady, setLocalReady] = useState(false);

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const monthKey = selectedDate
    ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`
    : '';

  const d = selectedDate ?? new Date();
  const coveredByApp = monthCoveredByRange(d, appData?.eventsRange);

  const events = useMemo(() => {
    const monthStart = dayjs(d).startOf('month').subtract(7, 'day');
    const monthEnd = dayjs(d).endOf('month').add(7, 'day');

    if (coveredByApp) {
      const fromApp = (appData?.events || []) as Event[];
      const filtered = fromApp.filter(
        (e) =>
          dayjs(e.start).isBefore(monthEnd) && dayjs(e.end).isAfter(monthStart)
      );
      if (localEvents.length > 0) {
        const map = new Map<string, Event>();
        [...fromApp, ...localEvents].forEach((e) => {
          const key = `${e.id}-${dayjs(e.start).format('YYYY-MM-DD-HH:mm')}`;
          map.set(key, e);
        });
        return Array.from(map.values()).filter(
          (e) =>
            dayjs(e.start).isBefore(monthEnd) &&
            dayjs(e.end).isAfter(monthStart)
        );
      }
      return filtered;
    }
    return localEvents;
  }, [appData?.events, coveredByApp, localEvents, d, monthKey]);

  const loadEvents = async (opts?: { silent?: boolean }) => {
    try {
      const date = selectedDateRef.current ?? new Date();
      if (!user?.id) return;

      const start = dayjs(date).startOf('month').toDate();
      const end = dayjs(date).endOf('month').toDate();
      const data = await fetchEvents(user.id, start, end, { paddingDays: 10 });
      setLocalEvents(data);
      setLocalReady(true);

      const seriesIds = [...new Set(data.map((e) => e.id))];
      try {
        const exceptions = await fetchEventsException(seriesIds);
        setEventException(exceptions as EventException[]);
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // AppData už pokrývá měsíc → žádný další request
    if (coveredByApp) {
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    setIsLoading(true);
    loadEvents().then(() => {
      if (mounted) setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [user?.id, monthKey, coveredByApp]);

  useEffect(() => {
    if (coveredByApp) setIsLoading(false);
  }, [coveredByApp, appData?.events?.length]);

  useEffect(() => {
    let mounted = true;

    const channelEvents = supabase
      .channel('realtime:public:event_series')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_series' },
        () => {
          if (mounted) {
            loadEvents({ silent: true });
          }
        }
      )
      .subscribe();

    const channelExceptions = supabase
      .channel('realtime:public:event_exceptions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'series_exceptions' },
        () => {
          if (mounted) loadEvents({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => {
          if (mounted) loadEvents({ silent: true });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channelEvents);
      supabase.removeChannel(channelExceptions);
    };
  }, [user?.id]);

  const mergedExceptions =
    eventException.length > 0
      ? eventException
      : ((appData?.eventExceptions || []) as EventException[]);

  return {
    events,
    eventException: mergedExceptions,
    isLoading: isLoading && !localReady && !coveredByApp,
    loadEvents,
  };
}
