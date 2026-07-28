import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { Brand } from '@/constants/brand';
import { useAppData } from '@/contexts/AppDataContext';
import { useNewEvent } from '@/contexts/NewEventContext';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { computeSharedFreeByDay, type FreeSlot } from '@/lib/freeSlots';
import { formatShortLocation } from '@/lib/formatLocation';
import { getMyUpcomingEvents, type CalendarEvent } from '@/lib/myEventsHelpers';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

dayjs.locale('cs');

type AgendaRow =
  | { kind: 'event'; event: CalendarEvent; sortAt: number }
  | { kind: 'free'; slot: FreeSlot; sortAt: number }
  | { kind: 'now'; sortAt: number };

type DaySection = {
  key: string;
  date: Date;
  rows: AgendaRow[];
};

function NowOverlay({ progress }: { progress: number }) {
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <View
      style={[styles.nowOverlay, { top: `${pct * 100}%` }]}
      pointerEvents="none"
    >
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
      <ThemedText style={styles.nowLabel}>{dayjs().format('H:mm')}</ThemedText>
    </View>
  );
}

/** 0 = začátek, 1 = konec intervalu. */
function elapsedProgress(start: Date | string, end: Date | string): number {
  const s = dayjs(start).valueOf();
  const e = dayjs(end).valueOf();
  const dur = e - s;
  if (dur <= 0) return 0;
  return (Date.now() - s) / dur;
}

function spansNow(start: Date | string, end: Date | string): boolean {
  const now = Date.now();
  return dayjs(start).valueOf() <= now && now < dayjs(end).valueOf();
}

type AgendaTimelineProps = {
  showHeader?: boolean;
  /** When set (from shared calendar filter), hide those users' personal events. */
  uncheckedUserIds?: Array<number | string>;
};

function isAllDay(event: CalendarEvent): boolean {
  const start = dayjs(event.start);
  const end = dayjs(event.end);
  const coversDay =
    start.format('HH:mm') === '00:00' &&
    (end.format('HH:mm') === '23:59' || end.diff(start, 'hour') >= 23);
  return coversDay;
}

export function AgendaTimeline({
  showHeader = true,
  uncheckedUserIds = [],
}: AgendaTimelineProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { openNewEvent } = useNewEvent();
  const {
    events,
    eventExceptions,
    joinedEventIds,
    friendIds,
    colors,
    users,
    booting,
    ready,
    ensureLoaded,
    refreshTimeline,
  } = useAppData();

  const [ticker, setTicker] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [showFree, setShowFree] = useState(true);

  const textColor = useThemeColor({}, 'text');
  const secondary = useThemeColor(
    { light: '#5f6368', dark: '#9aa0a6' },
    'text'
  );
  const todayAccent = Brand.primary;
  const borderColor = useThemeColor(
    { light: '#dadce0', dark: '#3c4043' },
    'background'
  );
  const rowHover = useThemeColor(
    { light: 'rgba(60,64,67,0.04)', dark: 'rgba(255,255,255,0.04)' },
    'background'
  );
  const freeBar = useThemeColor(
    { light: '#9AA0A6', dark: '#5F6368' },
    'text'
  );

  useEffect(() => {
    const interval = setInterval(() => setTicker((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      ensureLoaded();
    }, [ensureLoaded])
  );

  const onRefresh = async () => {
    setPullRefreshing(true);
    await refreshTimeline(true);
    setPullRefreshing(false);
  };

  const uncheckedSet = useMemo(
    () => new Set(uncheckedUserIds.map(String)),
    [uncheckedUserIds]
  );

  /** Lidé zapnutí ve filtru (já + přátelé, kteří nejsou odškrtnutí). */
  const visibleUserIds = useMemo(() => {
    if (!user?.id) return [] as string[];
    const all = [String(user.id), ...friendIds.map(String)];
    return all.filter((id) => !uncheckedSet.has(id));
  }, [user?.id, friendIds, uncheckedSet]);

  const allTimeline = useMemo(() => {
    if (!user?.id) return [];
    const allIds = [String(user.id), ...friendIds];
    return getMyUpcomingEvents(
      events,
      [],
      eventExceptions,
      allIds,
      joinedEventIds,
      365
    );
  }, [events, eventExceptions, joinedEventIds, user?.id, friendIds, ticker]);

  const filteredEvents = useMemo(() => {
    if (uncheckedSet.size === 0) return allTimeline;
    return allTimeline.filter(
      (e) => e.is_group === true || !uncheckedSet.has(String(e.user_id))
    );
  }, [allTimeline, uncheckedSet]);

  /** Busy = přesně to, co je ve vyfiltrované ose (osobní viditelných + skupinové). */
  const freeByDay = useMemo(() => {
    if (!showFree || visibleUserIds.length === 0) {
      return new Map<string, FreeSlot[]>();
    }
    return computeSharedFreeByDay({
      events: filteredEvents,
      daysAhead: 90,
      minMinutes: 30,
    });
  }, [showFree, visibleUserIds.length, filteredEvents, ticker]);

  const sections = useMemo((): DaySection[] => {
    const map = new Map<string, DaySection>();

    const ensure = (key: string, date: Date) => {
      let section = map.get(key);
      if (!section) {
        section = { key, date, rows: [] };
        map.set(key, section);
      }
      return section;
    };

    for (const event of filteredEvents) {
      if (!event) continue;
      const key = dayjs(event.start).format('YYYY-MM-DD');
      const section = ensure(
        key,
        dayjs(event.start).startOf('day').toDate()
      );
      section.rows.push({
        kind: 'event',
        event,
        sortAt: dayjs(event.start).valueOf() + (isAllDay(event) ? -1 : 0),
      });
    }

    const nowMs = Date.now();
    const todayKey = dayjs().format('YYYY-MM-DD');
    let nowInsideItem = false;

    if (showFree) {
      for (const [key, slots] of freeByDay.entries()) {
        const section = ensure(key, dayjs(key).startOf('day').toDate());
        for (const slot of slots) {
          const startMs = slot.start.getTime();
          const endMs = slot.end.getTime();
          if (key === todayKey && startMs <= nowMs && nowMs < endMs) {
            nowInsideItem = true;
          }
          section.rows.push({
            kind: 'free',
            slot,
            sortAt: startMs,
          });
        }
      }
    }

    if (!nowInsideItem) {
      for (const event of filteredEvents) {
        if (!event || isAllDay(event)) continue;
        if (dayjs(event.start).format('YYYY-MM-DD') !== todayKey) continue;
        const s = dayjs(event.start).valueOf();
        const e = dayjs(event.end).valueOf();
        if (s <= nowMs && nowMs < e) {
          nowInsideItem = true;
          break;
        }
      }
    }

    if (!nowInsideItem) {
      const todaySection =
        map.get(todayKey) ?? ensure(todayKey, dayjs().startOf('day').toDate());
      todaySection.rows.push({ kind: 'now', sortAt: nowMs });
    }

    for (const section of map.values()) {
      section.rows.sort((a, b) => a.sortAt - b.sortAt);
    }

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [filteredEvents, freeByDay, showFree, ticker]);

  const openEvent = (event: CalendarEvent) => {
    const originalEvent = events.find((e) => e.id === event.id) || event;
    const isRecurringOrMulti =
      !!originalEvent.pravidelnost || !!(originalEvent as any).group_id;

    const params: any = {
      eventId: String(originalEvent.id),
      event: JSON.stringify(originalEvent),
    };
    if (isRecurringOrMulti) {
      params.instance_date =
        (event as any).instance_date || dayjs(event.start).format('YYYY-MM-DD');
    }

    router.push({
      pathname: '/events/[eventId]',
      params,
    });
  };

  const Wrapper = showHeader ? ThemedSafeView : ThemedView;

  const freePeopleLabel = useMemo(() => {
    const names = visibleUserIds
      .map((id) => {
        const u = users.find((x) => x != null && String(x.id) === id);
        return u?.username || null;
      })
      .filter(Boolean) as string[];
    return names.join(' · ');
  }, [visibleUserIds, users]);

  if (booting && !ready) {
    return (
      <Wrapper style={styles.center}>
        <ActivityIndicator size="large" />
      </Wrapper>
    );
  }

  const freeHint =
    visibleUserIds.length <= 1
      ? 'Tvoje volno (celý den)'
      : `Společné volno ${visibleUserIds.length} lidí (celý den)`;

  const renderDay = ({ item: section }: { item: DaySection }) => {
    const now = dayjs();
    const isToday = dayjs(section.date).isSame(now, 'day');
    const weekday = dayjs(section.date)
      .format('ddd')
      .replace(/\.$/, '')
      .replace(/^./, (c) => c.toUpperCase());
    const dayNum = dayjs(section.date).format('D');
    const monthLabel = dayjs(section.date).format('MMM').replace(/\.$/, '');

    return (
      <View style={[styles.dayRow, { borderBottomColor: borderColor }]}>
        <View style={styles.dateCol}>
          <ThemedText
            style={[
              styles.weekday,
              { color: isToday ? todayAccent : secondary },
            ]}
          >
            {weekday}
          </ThemedText>
          <View
            style={[
              styles.dayNumberWrap,
              isToday && { backgroundColor: todayAccent },
            ]}
          >
            <ThemedText
              style={[
                styles.dayNumber,
                { color: isToday ? '#fff' : textColor },
              ]}
            >
              {dayNum}
            </ThemedText>
          </View>
          {!isToday && (
            <ThemedText style={[styles.monthHint, { color: secondary }]}>
              {monthLabel}
            </ThemedText>
          )}
        </View>

        <View style={styles.eventsCol}>
          {section.rows.map((row, idx) => {
            if (row.kind === 'now') {
              return (
                <View
                  key={`now-${section.key}`}
                  style={styles.nowRow}
                  pointerEvents="none"
                >
                  <View style={styles.nowDot} />
                  <View style={styles.nowLine} />
                  <ThemedText style={styles.nowLabel}>
                    {dayjs().format('H:mm')}
                  </ThemedText>
                </View>
              );
            }

            if (row.kind === 'free') {
              const { slot } = row;
              const timeLabel = `${dayjs(slot.start).format('H:mm')} – ${dayjs(slot.end).format('H:mm')}`;
              const showNow = isToday && spansNow(slot.start, slot.end);
              return (
                <Pressable
                  key={`free-${section.key}-${slot.start.getTime()}-${idx}`}
                  onPress={() => openNewEvent(slot.start)}
                  style={({ pressed }) => [
                    styles.eventRow,
                    pressed && { backgroundColor: rowHover },
                  ]}
                >
                  <View
                    style={[
                      styles.colorBar,
                      styles.freeBar,
                      { borderColor: freeBar },
                    ]}
                  />
                  <View style={styles.eventBody}>
                    <ThemedText
                      style={[styles.eventTime, { color: secondary }]}
                      numberOfLines={1}
                    >
                      {timeLabel}
                    </ThemedText>
                    <ThemedText
                      style={[styles.eventTitle, { color: secondary }]}
                      numberOfLines={1}
                    >
                      Volno
                    </ThemedText>
                    {!!freePeopleLabel && (
                      <ThemedText
                        style={[styles.eventMeta, { color: secondary }]}
                        numberOfLines={1}
                      >
                        {freePeopleLabel}
                      </ThemedText>
                    )}
                  </View>
                  {showNow && (
                    <NowOverlay progress={elapsedProgress(slot.start, slot.end)} />
                  )}
                </Pressable>
              );
            }

            if (row.kind !== 'event' || !row.event) {
              return null;
            }

            const event = row.event;
            const userColor = colors.find(
              (c) => c != null && String(c.user_id) === String(event.user_id)
            );
            const barColor = event.is_group
              ? Brand.groupEvent
              : userColor?.background_color || Brand.primary;
            const allDay = isAllDay(event);
            const owner = users.find(
              (u) => u != null && String(u.id) === String(event.user_id)
            );
            const showOwner =
              String(event.user_id) !== String(user?.id) && !event.is_group;
            const showNow =
              isToday && !allDay && spansNow(event.start, event.end);

            const timeLabel = allDay
              ? 'Celý den'
              : `${dayjs(event.start).format('H:mm')} – ${dayjs(event.end).format('H:mm')}`;

            return (
              <Pressable
                key={`ev-${event.id}-${dayjs(event.start).valueOf()}-${idx}`}
                onPress={() => openEvent(event)}
                style={({ pressed }) => [
                  styles.eventRow,
                  pressed && { backgroundColor: rowHover },
                ]}
              >
                <View style={[styles.colorBar, { backgroundColor: barColor }]} />
                <View style={styles.eventBody}>
                  <ThemedText
                    style={[styles.eventTime, { color: secondary }]}
                    numberOfLines={1}
                  >
                    {timeLabel}
                  </ThemedText>
                  <ThemedText
                    style={[styles.eventTitle, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {event.title}
                  </ThemedText>
                  {(showOwner || event.poloha) && (
                    <ThemedText
                      style={[styles.eventMeta, { color: secondary }]}
                      numberOfLines={1}
                    >
                      {[
                        showOwner ? owner?.username : null,
                        formatShortLocation(event.poloha) || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  )}
                </View>
                {showNow && (
                  <NowOverlay
                    progress={elapsedProgress(event.start, event.end)}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Wrapper style={styles.container}>
      {showHeader && (
        <View style={styles.headerContainer}>
          <ThemedText style={styles.header}>Osa</ThemedText>
        </View>
      )}

      <View style={styles.freeToggleRow}>
        <Pressable
          onPress={() => setShowFree((v) => !v)}
          style={[
            styles.freeToggle,
            {
              backgroundColor: showFree ? Brand.primarySoft : 'transparent',
              borderColor: showFree ? Brand.primary : borderColor,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={showFree ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
            size={18}
            color={showFree ? Brand.primary : secondary}
          />
          <ThemedText
            style={{
              color: showFree ? Brand.primary : secondary,
              fontWeight: '700',
              fontSize: 13,
            }}
          >
            Volno
          </ThemedText>
        </Pressable>
        {showFree && (
          <ThemedText style={[styles.freeHint, { color: secondary }]} numberOfLines={1}>
            {freeHint}
          </ThemedText>
        )}
      </View>

      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-blank-outline"
            title={showFree ? 'Žádné volno ani události' : 'Žádné nadcházející události'}
            subtitle={
              showFree
                ? 'Uprav filtr lidí, nebo vypni Volno.'
                : 'Až budeš mít něco v plánu, uvidíš to tady v ose.'
            }
            actionLabel="+ Nová událost"
            onAction={() => openNewEvent()}
          />
        }
        renderItem={renderDay}
      />
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  header: { fontSize: 22, fontWeight: '700' },
  freeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  freeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  freeHint: {
    flex: 1,
    fontSize: 12,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 100, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dayRow: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  dateCol: {
    width: 56,
    alignItems: 'center',
    paddingTop: 2,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayNumberWrap: {
    marginTop: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '500',
  },
  monthHint: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  eventsCol: {
    flex: 1,
    paddingLeft: 8,
    gap: 2,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    marginLeft: -18,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.danger,
    marginRight: 0,
    zIndex: 1,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: Brand.danger,
    marginRight: 8,
  },
  nowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.danger,
    minWidth: 36,
    textAlign: 'right',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    paddingVertical: 8,
    paddingRight: 8,
    minHeight: 48,
    position: 'relative',
    overflow: 'visible',
  },
  nowOverlay: {
    position: 'absolute',
    left: -18,
    right: 0,
    marginTop: -5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 10,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  freeBar: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  eventBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventMeta: {
    fontSize: 12,
    marginTop: 1,
  },
});
