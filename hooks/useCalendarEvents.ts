import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { fetchEventsBundle } from '@/services/events/get_events';
import { useAppDataOptional } from '@/contexts/AppDataContext';
import { monthCacheKey } from '@/lib/calendarPeriod';
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

type MonthBundle = {
  events: Event[];
  exceptions: EventException[];
  /** true = kompletní měsíc z DB / plně pokryté AppData; false = nepoužívat jako cache hit */
  complete: boolean;
};

/** Module-level cache so adjacent months survive remounts / rapid swipes. */
const monthEventsCache = new Map<string, MonthBundle>();
/** In-flight fetches — rapid swipe nezačne 5× stejný měsíc. */
const monthInflight = new Map<string, Promise<MonthBundle>>();

const PREFETCH_RADIUS = 3;

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

function filterEventsForMonth(events: Event[], month: Date): Event[] {
  const monthStart = dayjs(month).startOf('month').subtract(7, 'day');
  const monthEnd = dayjs(month).endOf('month').add(7, 'day');
  return events.filter(
    (e) =>
      dayjs(e.start).isBefore(monthEnd) && dayjs(e.end).isAfter(monthStart)
  );
}

function filterExceptionsForMonth(
  exceptions: EventException[],
  month: Date
): EventException[] {
  const monthStart = dayjs(month).startOf('month').subtract(7, 'day');
  const monthEnd = dayjs(month).endOf('month').add(7, 'day');
  return exceptions.filter((ex) => {
    const s = dayjs(ex.start);
    const e = dayjs(ex.end);
    return s.isBefore(monthEnd) && e.isAfter(monthStart);
  });
}

function getCompleteCache(key: string): MonthBundle | undefined {
  const cached = monthEventsCache.get(key);
  return cached?.complete ? cached : undefined;
}

/** Naplní cache jen měsíci, které AppData pokrývá celé. */
function seedCacheFromAppData(
  events: Event[],
  exceptions: EventException[],
  range: { from: string; to: string } | null | undefined
) {
  if (!range || events.length === 0) return;
  let cursor = dayjs(range.from).startOf('month');
  const last = dayjs(range.to).startOf('month');
  while (cursor.isBefore(last) || cursor.isSame(last, 'month')) {
    if (!monthCoveredByRange(cursor.toDate(), range)) {
      // Neúplný hraniční měsíc — ať se načte z DB, neuložit jako complete
      monthEventsCache.delete(monthCacheKey(cursor.toDate()));
      cursor = cursor.add(1, 'month');
      continue;
    }
    const key = monthCacheKey(cursor.toDate());
    monthEventsCache.set(key, {
      events: filterEventsForMonth(events, cursor.toDate()),
      exceptions: filterExceptionsForMonth(exceptions, cursor.toDate()),
      complete: true,
    });
    cursor = cursor.add(1, 'month');
  }
}

async function fetchMonthBundle(
  userId: string | number,
  date: Date,
  opts?: {
    friendships?: any[];
    invitedSeriesIds?: number[];
  }
): Promise<MonthBundle> {
  const key = monthCacheKey(date);
  const existing = monthInflight.get(key);
  if (existing) return existing;

  const start = dayjs(date).startOf('month').toDate();
  const end = dayjs(date).endOf('month').toDate();
  const promise = fetchEventsBundle(userId, start, end, {
    paddingDays: 10,
    friendships: opts?.friendships,
    invitedSeriesIds: opts?.invitedSeriesIds,
  })
    .then((bundle) => {
      const result: MonthBundle = {
        events: bundle.events as Event[],
        exceptions: bundle.exceptions as EventException[],
        complete: true,
      };
      monthEventsCache.set(key, result);
      return result;
    })
    .finally(() => {
      monthInflight.delete(key);
    });

  monthInflight.set(key, promise);
  return promise;
}

export function useCalendarEvents(user: any, selectedDate: Date | null) {
  const appData = useAppDataOptional();
  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [eventException, setEventException] = useState<EventException[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Bump při zápisu do module cache → ať useMemo vidí complete fetch. */
  const [cacheTick, setCacheTick] = useState(0);

  const selectedDateRef = useRef(selectedDate);
  const appRangeRef = useRef(appData?.eventsRange);
  const friendshipsRef = useRef(appData?.friendships);
  const invitedSeriesIdsRef = useRef<number[] | undefined>(undefined);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    appRangeRef.current = appData?.eventsRange;
  }, [appData?.eventsRange]);
  useEffect(() => {
    friendshipsRef.current = appData?.friendships;
  }, [appData?.friendships]);

  // Sync invited series from friendships/AppData when available via loadAll side channel
  useEffect(() => {
    // AppData neexportuje invitedSeriesIds — fetchMonthBundle si je případně načte sám
    invitedSeriesIdsRef.current = undefined;
  }, [appData?.lastFetchedAt]);

  const monthKey = selectedDate ? monthCacheKey(selectedDate) : '';

  const d = selectedDate ?? new Date();
  const coveredByApp = monthCoveredByRange(d, appData?.eventsRange);

  const events = useMemo(() => {
    if (coveredByApp) {
      return filterEventsForMonth((appData?.events || []) as Event[], d);
    }

    const cached = getCompleteCache(monthKey);
    if (cached) return filterEventsForMonth(cached.events, d);

    // Žádný partial AppData řez — to dřív „zalepilo“ červen jen pár dny z konce
    // a vypadalo to, že cyklus v měsíci chybí.
    return filterEventsForMonth(localEvents, d);
  }, [appData?.events, coveredByApp, localEvents, d, monthKey, cacheTick]);

  const applyBundle = useCallback((bundle: MonthBundle) => {
    setLocalEvents(bundle.events);
    setEventException(bundle.exceptions);
    setCacheTick((t) => t + 1);
  }, []);

  const fetchOpts = useCallback(
    () => ({
      friendships: friendshipsRef.current,
      invitedSeriesIds: invitedSeriesIdsRef.current,
    }),
    []
  );

  const prefetchAdjacentMonths = useCallback(
    (center: Date) => {
      if (!user?.id) return;
      for (let offset = -PREFETCH_RADIUS; offset <= PREFETCH_RADIUS; offset++) {
        if (offset === 0) continue;
        const neighbor = dayjs(center).add(offset, 'month').toDate();
        const key = monthCacheKey(neighbor);
        if (getCompleteCache(key) || monthInflight.has(key)) continue;
        if (monthCoveredByRange(neighbor, appRangeRef.current)) continue;

        void fetchMonthBundle(user.id, neighbor, fetchOpts())
          .then(() => setCacheTick((t) => t + 1))
          .catch((err) => console.error(err));
      }
    },
    [user?.id, fetchOpts]
  );

  const loadEvents = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      try {
        const date = selectedDateRef.current ?? new Date();
        if (!user?.id) return;

        const key = monthCacheKey(date);

        if (monthCoveredByRange(date, appRangeRef.current)) {
          setIsLoading(false);
          prefetchAdjacentMonths(date);
          return;
        }

        const cached = getCompleteCache(key);
        if (cached && !opts?.force) {
          applyBundle(cached);
          setIsLoading(false);
          prefetchAdjacentMonths(date);
          return;
        }

        if (!opts?.silent) setIsLoading(true);

        const bundle = await fetchMonthBundle(user.id, date, fetchOpts());
        const stillHere =
          monthCacheKey(selectedDateRef.current ?? new Date()) === key;
        if (stillHere) applyBundle(bundle);

        prefetchAdjacentMonths(date);
      } catch (err) {
        console.error(err);
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [user?.id, applyBundle, prefetchAdjacentMonths, fetchOpts]
  );

  // Po každém AppData refreshi — dropnout starou cache a znovu prefetch okolí
  useEffect(() => {
    if (!appData?.lastFetchedAt) return;
    monthEventsCache.clear();
    if (appData.events?.length && appData.eventsRange) {
      seedCacheFromAppData(
        appData.events as Event[],
        (appData.eventExceptions || []) as EventException[],
        appData.eventsRange
      );
    }
    setCacheTick((t) => t + 1);

    const date = selectedDateRef.current ?? new Date();
    if (!monthCoveredByRange(date, appData.eventsRange) && user?.id) {
      void loadEvents({ silent: true, force: true });
    } else if (monthCoveredByRange(date, appData.eventsRange)) {
      const key = monthCacheKey(date);
      const cached = getCompleteCache(key);
      if (cached) applyBundle(cached);
      prefetchAdjacentMonths(date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData?.lastFetchedAt]);

  useEffect(() => {
    if (coveredByApp) {
      const cached = getCompleteCache(monthKey);
      if (cached) applyBundle(cached);
      setIsLoading(false);
      prefetchAdjacentMonths(d);
      return;
    }

    const cached = getCompleteCache(monthKey);
    if (cached) {
      applyBundle(cached);
      setIsLoading(false);
      prefetchAdjacentMonths(d);
      return;
    }

    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, monthKey, coveredByApp]);

  useEffect(() => {
    if (coveredByApp) setIsLoading(false);
  }, [coveredByApp, appData?.events?.length]);

  const mergedExceptions = useMemo(() => {
    if (coveredByApp) {
      return filterExceptionsForMonth(
        (appData?.eventExceptions || []) as EventException[],
        d
      );
    }
    if (eventException.length > 0) return eventException;
    const cached = getCompleteCache(monthKey);
    if (cached?.exceptions?.length) return cached.exceptions;
    return filterExceptionsForMonth(
      (appData?.eventExceptions || []) as EventException[],
      d
    );
  }, [
    coveredByApp,
    appData?.eventExceptions,
    eventException,
    monthKey,
    d,
    cacheTick,
  ]);

  return {
    events,
    eventException: mergedExceptions,
    isLoading: isLoading && !coveredByApp && !getCompleteCache(monthKey),
    loadEvents,
  };
}
