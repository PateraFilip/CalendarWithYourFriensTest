import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dayjs from 'dayjs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { fetchEventsBundle } from '@/services/events/get_events';
import { fetchUserEvents } from '@/services/events/getUserEvents';
import { fetchColors } from '@/services/users/get_colors';
import { fetchMyFriendships, type Friendship } from '@/services/friends/friendships';
import { fetchInvitedSeriesIds } from '@/services/events/invites';
import {
  fetchMyNotifications,
  type UserNotification,
} from '@/services/notifications/notifications';
import { getMyUpcomingEvents, type CalendarEvent, type EventException } from '@/lib/myEventsHelpers';

const STALE_MS = 45_000;
const TIMELINE_DAYS = 365;

export type ChatRoom = {
  id: string;
  series_id: number;
  instance_date?: string | null;
  nazev: string;
  last_message_at?: string;
  user_id?: number | string;
  is_group?: boolean;
  event_start?: string;
  is_recurring?: boolean;
};

type AppDataContextType = {
  /** Prioritní měsíc (kalendář) už je v cache */
  ready: boolean;
  /** Celá timeline (rok + chaty) je v cache */
  timelineReady: boolean;
  /** Probíhá první načtení bez cache */
  booting: boolean;
  refreshing: boolean;
  lastFetchedAt: number | null;
  /** Rozsah dat, která jsou teď v `events` (ISO date strings) */
  eventsRange: { from: string; to: string } | null;

  events: CalendarEvent[];
  eventExceptions: EventException[];
  userEvents: any[];
  joinedEventIds: number[];
  friendships: Friendship[];
  friendIds: string[];
  colors: any[];
  users: any[];
  notifications: UserNotification[];
  chatRooms: ChatRoom[];
  availableChatRooms: ChatRoom[];

  /** Načti / obnov; showSpinner jen když ještě není ready */
  ensureLoaded: (opts?: { force?: boolean }) => Promise<void>;
  refreshTimeline: (force?: boolean) => Promise<void>;
  /** Doplň starší události před aktuální `eventsRange.from` (osa — scroll nahoru). */
  extendEventsBackward: (days?: number) => Promise<{ extended: boolean; from: string | null }>;
  refreshNotifications: () => Promise<void>;
  refreshChatRooms: () => Promise<void>;
  /** Obnov jen barvy (po změně v nastavení) */
  refreshColors: () => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<UserNotification[]>>;
};

const AppDataContext = createContext<AppDataContextType | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}

/** Volitelný hook — null mimo provider (neměl by nastat) */
export function useAppDataOptional() {
  return useContext(AppDataContext);
}

function buildChatRoomsFromTimeline(params: {
  events: CalendarEvent[];
  exceptions: EventException[];
  userEvents: any[];
  friendIds: string[];
  currentUserId: string;
  messagedEvents: any[];
  latestMessages: { series_id: number; instance_date: string | null; created_at: string }[];
}): { active: ChatRoom[]; inactive: ChatRoom[] } {
  const {
    events,
    exceptions,
    userEvents,
    friendIds,
    currentUserId,
    messagedEvents,
    latestMessages,
  } = params;

  const joinedEventIds = userEvents
    .filter((ue) => String(ue.user_id) === currentUserId)
    .map((ue) => ue.event_id);

  const allowedIds = [currentUserId, ...friendIds];
  const myTimeline = getMyUpcomingEvents(
    events,
    [],
    exceptions,
    allowedIds,
    joinedEventIds,
    TIMELINE_DAYS
  );

  const roomsMap = new Map<string, ChatRoom>();

  const processMessaged = (e: any) => {
    const sId = e.series_id;
    const iDate = e.instance_date;
    const series = e.event_series || {};
    const nazev = series.nazev || 'Neznámá událost';
    const key = iDate ? `instance-${sId}-${iDate}` : `series-${sId}`;
    const is_recurring = series.recurrence_rule?.type === 'pattern';
    if (!roomsMap.has(key)) {
      roomsMap.set(key, {
        id: key,
        series_id: sId,
        instance_date: iDate,
        nazev,
        user_id: series.zakladatel_id,
        is_group: !!series.is_group,
        event_start: series.valid_from,
        is_recurring,
      });
    }
  };

  messagedEvents.forEach(processMessaged);

  myTimeline.forEach((e) => {
    const isOwner = String(e.user_id) === currentUserId;
    const isParticipant = joinedEventIds.includes(e.id);
    if (!isOwner && !isParticipant) return;

    const sId = e.id;
    const iDate = !e.pravidelnost ? undefined : dayjs(e.start).format('YYYY-MM-DD');
    const key = iDate ? `instance-${sId}-${iDate}` : `series-${sId}`;
    if (!roomsMap.has(key)) {
      roomsMap.set(key, {
        id: key,
        series_id: sId,
        instance_date: iDate,
        nazev: e.title,
        user_id: e.user_id,
        is_group: e.is_group,
        event_start: dayjs(e.start).format('YYYY-MM-DD'),
        is_recurring: !!e.pravidelnost,
      });
    }
  });

  const roomsArray = Array.from(roomsMap.values());
  roomsArray.forEach((room) => {
    const roomMsg = latestMessages.find(
      (m) =>
        m.series_id === room.series_id &&
        (room.instance_date ? m.instance_date === room.instance_date : !m.instance_date)
    );
    if (roomMsg) room.last_message_at = roomMsg.created_at;
  });

  const active = roomsArray
    .filter((r) => r.last_message_at)
    .sort(
      (a, b) =>
        new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime()
    );
  const getDateForSorting = (r: ChatRoom) => r.instance_date || r.event_start || '9999-12-31';
  const inactive = roomsArray
    .filter((r) => !r.last_message_at)
    .sort((a, b) => getDateForSorting(a).localeCompare(getDateForSorting(b)));

  return { active, inactive };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, sessionLoading } = useAuth();
  const userId = user?.id ? String(user.id) : null;

  const [ready, setReady] = useState(false);
  const [timelineReady, setTimelineReady] = useState(false);
  const [booting, setBooting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [eventsRange, setEventsRange] = useState<{ from: string; to: string } | null>(
    null
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventExceptions, setEventExceptions] = useState<EventException[]>([]);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [availableChatRooms, setAvailableChatRooms] = useState<ChatRoom[]>([]);

  const inflightRef = useRef<Promise<void> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRef = useRef<number | null>(null);
  const eventsRangeRef = useRef<{ from: string; to: string } | null>(null);
  const friendshipsRef = useRef<Friendship[]>([]);
  const invitedSeriesIdsRef = useRef<number[]>([]);
  const extendInflightRef = useRef<Promise<{ extended: boolean; from: string | null }> | null>(null);

  const joinedEventIds = useMemo(
    () =>
      userId
        ? userEvents.filter((ue) => String(ue.user_id) === userId).map((ue) => ue.event_id)
        : [],
    [userEvents, userId]
  );

  const loadGeneration = useRef(0);

  const loadAll = useCallback(
    async (force: boolean) => {
      if (!userId) return;
      if (inflightRef.current) {
        await inflightRef.current;
        if (!force) return;
      }

      const run = (async () => {
        const gen = ++loadGeneration.current;
        const hasCache = lastFetchedRef.current != null;
        if (!hasCache) setBooting(true);
        else setRefreshing(true);

        try {
          // ── Fáze 1: jen aktuální měsíc (+ malý padding) → kalendář hned ──
          const monthStart = dayjs().startOf('month');
          const monthEnd = dayjs().endOf('month');
          const priorityFrom = monthStart.subtract(14, 'day');
          const priorityTo = monthEnd.add(14, 'day');

          const [userEv, col, fr, notif, invitedSeriesIds] = await Promise.all([
            fetchUserEvents(),
            fetchColors(),
            fetchMyFriendships(userId),
            fetchMyNotifications(userId),
            fetchInvitedSeriesIds(userId),
          ]);

          if (gen !== loadGeneration.current) return;

          const priorityBundle = await fetchEventsBundle(
            userId,
            monthStart.toDate(),
            monthEnd.toDate(),
            {
              paddingDays: 14,
              friendships: fr,
              invitedSeriesIds,
            }
          );

          if (gen !== loadGeneration.current) return;

          const accepted = fr.filter((f) => f.status === 'accepted');
          const fIds = accepted.map((f) =>
            String(f.user_id) === userId ? String(f.friend_id) : String(f.user_id)
          );

          // Phase 1: events už mají výjimky aplikované; bundle.exceptions pro UI
          setEvents(priorityBundle.events as CalendarEvent[]);
          setEventExceptions(priorityBundle.exceptions as EventException[]);
          setUserEvents(userEv);
          setColors(col);
          setFriendships(fr);
          setFriendIds(fIds);
          friendshipsRef.current = fr;
          invitedSeriesIdsRef.current = invitedSeriesIds;
          setNotifications(notif);
          setEventsRange({
            from: priorityFrom.format('YYYY-MM-DD'),
            to: priorityTo.format('YYYY-MM-DD'),
          });
          eventsRangeRef.current = {
            from: priorityFrom.format('YYYY-MM-DD'),
            to: priorityTo.format('YYYY-MM-DD'),
          };
          setTimelineReady(false);

          const nowPriority = Date.now();
          lastFetchedRef.current = nowPriority;
          setLastFetchedAt(nowPriority);
          setReady(true);
          setBooting(false);
          // refreshing necháme true do konce fáze 2 (jen indikátor na pozadí)

          // ── Fáze 2: 3 měsíce historie (celé měsíce) + rok dopředu + chaty ──
          // Celé měsíce dozadu — ať květen/červen při červencovém refreshi
          // nejsou „oříznuté“ jen na posledních 30 dní.
          const rangeStart = dayjs().subtract(3, 'month').startOf('month');
          const rangeEnd = dayjs().add(TIMELINE_DAYS, 'day');

          const [fullBundle, usersRes, messagedRes] = await Promise.all([
            fetchEventsBundle(userId, rangeStart.toDate(), rangeEnd.toDate(), {
              paddingDays: 0,
              friendships: fr,
              invitedSeriesIds,
            }),
            supabase
              .from('users')
              .select('id, username, jmeno, prijmeni, email, datum_narozeni'),
            supabase
              .from('event_messages')
              .select(
                'series_id, instance_date, event_series!inner(nazev, recurrence_rule, group_id, zakladatel_id, valid_from, is_group)'
              )
              .eq('user_id', userId),
          ]);

          if (gen !== loadGeneration.current) return;

          setEvents(fullBundle.events as CalendarEvent[]);
          setEventExceptions(fullBundle.exceptions as EventException[]);
          setUsers(usersRes.data || []);
          setEventsRange({
            from: rangeStart.format('YYYY-MM-DD'),
            to: rangeEnd.format('YYYY-MM-DD'),
          });
          eventsRangeRef.current = {
            from: rangeStart.format('YYYY-MM-DD'),
            to: rangeEnd.format('YYYY-MM-DD'),
          };
          setTimelineReady(true);

          const seriesFromMessages = Array.from(
            new Set((messagedRes.data || []).map((m: any) => m.series_id))
          );
          const joinedIds = userEv
            .filter((ue) => String(ue.user_id) === userId)
            .map((ue) => ue.event_id);
          const seriesIds = Array.from(
            new Set([...seriesFromMessages, ...joinedIds])
          );

          let latestMessages: any[] = [];
          if (seriesIds.length > 0) {
            const { data } = await supabase
              .from('event_messages')
              .select('series_id, instance_date, created_at')
              .in('series_id', seriesIds.slice(0, 200))
              .order('created_at', { ascending: false })
              .limit(500);
            latestMessages = data || [];
          }

          if (gen !== loadGeneration.current) return;

          const rooms = buildChatRoomsFromTimeline({
            events: fullBundle.events as CalendarEvent[],
            exceptions: fullBundle.exceptions as EventException[],
            userEvents: userEv,
            friendIds: fIds,
            currentUserId: userId,
            messagedEvents: messagedRes.data || [],
            latestMessages,
          });
          setChatRooms(rooms.active);
          setAvailableChatRooms(rooms.inactive);

          const now = Date.now();
          lastFetchedRef.current = now;
          setLastFetchedAt(now);
        } catch (e) {
          console.error('[AppData] loadAll:', e);
          setReady(true);
        } finally {
          if (gen === loadGeneration.current) {
            setBooting(false);
            setRefreshing(false);
          }
          inflightRef.current = null;
        }
      })();

      inflightRef.current = run;
      await run;
    },
    [userId]
  );

  const ensureLoaded = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!userId) return;
      const force = !!opts?.force;
      const ts = lastFetchedRef.current;
      const fresh = ts != null && Date.now() - ts < STALE_MS;
      if (!force && fresh) return;
      // Máme cache → obnov na pozadí bez blokování UI
      if (!force && ts != null) {
        void loadAll(false);
        return;
      }
      await loadAll(true);
    },
    [userId, loadAll]
  );

  const refreshTimeline = useCallback(
    async (force = true) => {
      await loadAll(force);
    },
    [loadAll]
  );

  const extendEventsBackward = useCallback(
    async (days = 30) => {
      if (!userId) return { extended: false, from: null };
      if (extendInflightRef.current) return extendInflightRef.current;

      const run = (async () => {
        const range = eventsRangeRef.current;
        if (!range?.from) return { extended: false, from: null };

        const chunk = Math.max(1, Math.min(days, 90));
        const newFrom = dayjs(range.from).subtract(chunk, 'day');
        const newTo = dayjs(range.from).subtract(1, 'day');
        if (!newTo.isValid() || newTo.isBefore(newFrom)) {
          return { extended: false, from: range.from };
        }

        try {
          let invited = invitedSeriesIdsRef.current;
          if (!invited.length) {
            invited = await fetchInvitedSeriesIds(userId);
            invitedSeriesIdsRef.current = invited;
          }

          const bundle = await fetchEventsBundle(
            userId,
            newFrom.toDate(),
            newTo.toDate(),
            {
              paddingDays: 0,
              friendships: friendshipsRef.current,
              invitedSeriesIds: invited,
            }
          );

          setEvents((prev) => {
            const byKey = new Map<string, CalendarEvent>();
            for (const e of prev) {
              byKey.set(`${e.id}-${dayjs(e.start).valueOf()}`, e);
            }
            for (const e of bundle.events as CalendarEvent[]) {
              byKey.set(`${e.id}-${dayjs(e.start).valueOf()}`, e);
            }
            return Array.from(byKey.values());
          });

          setEventExceptions((prev) => {
            const byId = new Map<number, EventException>();
            for (const ex of prev) byId.set(ex.id, ex);
            for (const ex of bundle.exceptions as EventException[]) {
              byId.set(ex.id, ex);
            }
            return Array.from(byId.values());
          });

          const nextRange = {
            from: newFrom.format('YYYY-MM-DD'),
            to: range.to,
          };
          eventsRangeRef.current = nextRange;
          setEventsRange(nextRange);
          return { extended: true, from: nextRange.from };
        } catch (e) {
          console.error('[AppData] extendEventsBackward:', e);
          return { extended: false, from: range.from };
        } finally {
          extendInflightRef.current = null;
        }
      })();

      extendInflightRef.current = run;
      return run;
    },
    [userId]
  );

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    const notif = await fetchMyNotifications(userId);
    setNotifications(notif);
  }, [userId]);

  const refreshColors = useCallback(async () => {
    try {
      const col = await fetchColors();
      setColors(col);
    } catch (e) {
      console.error('[AppData] refreshColors:', e);
    }
  }, []);

  const refreshChatRooms = useCallback(async () => {
    await loadAll(true);
  }, [loadAll]);

  // Prefetch po přihlášení
  useEffect(() => {
    if (sessionLoading) return;
    if (!userId) {
      setReady(false);
      setTimelineReady(false);
      setBooting(false);
      lastFetchedRef.current = null;
      setLastFetchedAt(null);
      setEventsRange(null);
      eventsRangeRef.current = null;
      friendshipsRef.current = [];
      invitedSeriesIdsRef.current = [];
      setEvents([]);
      setEventExceptions([]);
      setUserEvents([]);
      setFriendships([]);
      setFriendIds([]);
      setColors([]);
      setUsers([]);
      setNotifications([]);
      setChatRooms([]);
      setAvailableChatRooms([]);
      return;
    }
    void loadAll(true);
  }, [userId, sessionLoading, loadAll]);

  // Realtime: debounce refresh (jen změny, ne plný reload při každém eventu)
  useEffect(() => {
    if (!userId) return;

    const scheduleRefresh = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        loadAll(true);
      }, 400);
    };

    const channel = supabase
      .channel(`app-data-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_series' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_users' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'series_exceptions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colors' }, () => {
        void refreshColors();
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          refreshNotifications();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages' },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, loadAll, refreshNotifications, refreshColors]);

  const value = useMemo(
    () => ({
      ready,
      timelineReady,
      booting,
      refreshing,
      lastFetchedAt,
      eventsRange,
      events,
      eventExceptions,
      userEvents,
      joinedEventIds,
      friendships,
      friendIds,
      colors,
      users,
      notifications,
      chatRooms,
      availableChatRooms,
      ensureLoaded,
      refreshTimeline,
      extendEventsBackward,
      refreshNotifications,
      refreshChatRooms,
      refreshColors,
      setNotifications,
    }),
    [
      ready,
      timelineReady,
      booting,
      refreshing,
      lastFetchedAt,
      eventsRange,
      events,
      eventExceptions,
      userEvents,
      joinedEventIds,
      friendships,
      friendIds,
      colors,
      users,
      notifications,
      chatRooms,
      availableChatRooms,
      ensureLoaded,
      refreshTimeline,
      extendEventsBackward,
      refreshNotifications,
      refreshChatRooms,
      refreshColors,
      setNotifications,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
