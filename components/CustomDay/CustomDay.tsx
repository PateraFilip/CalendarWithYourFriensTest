import { Brand } from '@/constants/brand';
import { UserEvent } from '@/services/events/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAppData } from '@/contexts/AppDataContext';
import { dedupeCalendarEvents, eventInstanceKey, eventsOverlappingDay, visibleSegmentOnDay } from '@/lib/calendarEvents';
import { eventBlockLineSplit, packTimedEvents } from '@/lib/calendarLayout';
import { getEventParticipants } from '@/lib/eventParticipants';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface Event {
  id: number;
  title: string;
  start: Date;
  end: Date;
  user_id: number;
  pocet_lidi: number;
  pravidelnost: boolean;
  is_group: boolean;
  group_id?: number;
  original_start?: Date;
  original_end?: Date;
}

interface WeeklyEvent {
  id: number;
  title: string;
  cas_od: Date;
  cas_do: Date;
  user_id: number;
  den: string;
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

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: number | string | null;
}

interface DayCalendarProps {
  events: Event[];
  eventsException: EventException[];
  weeklyEvents: WeeklyEvent[];
  onPressCell?: (date: Date) => void;
  onPressEvent?: (event: Event, atHour?: Date) => void;
  hourHeight?: number;
  defaultDate?: Date;
  colors: Color[];
  onVisibleDateChange?: (date: Date | ((prev: Date) => Date)) => void;
}

interface User {
  id: number;
  username: string;
  jmeno: string;
  prijmeni: string;
  email?: string;
  datum_narozeni?: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DayCalendar({
  events,
  weeklyEvents,
  eventsException,
  onPressCell,
  onPressEvent,
  hourHeight = 100,
  defaultDate,
  colors,
  onVisibleDateChange: _onVisibleDateChange,
}: DayCalendarProps) {
  void weeklyEvents;
  void eventsException;
  const date = defaultDate || new Date();
  const [ticker, setTicker] = useState(0);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const verticalScrollRef = useRef<ScrollView>(null);
  const { userEvents: appUserEvents, users: appUsers } = useAppData();
  const userEvents = (appUserEvents as UserEvent[] | undefined) || [];
  const users = (appUsers as User[] | undefined) || [];

  const colorByUserId = useMemo(() => {
    const map = new Map<string, Color>();
    for (const c of colors) {
      if (c.user_id != null) map.set(String(c.user_id), c);
    }
    return map;
  }, [colors]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) {
      map.set(String(u.id), u);
    }
    return map;
  }, [users]);

  useEffect(() => {
    const interval = setInterval(() => setTicker((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ticker drives current-time line refresh
  void ticker;
  useEffect(() => {
    if (dayjs(date).isSame(new Date(), 'day') && verticalScrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollPosition = currentHour * hourHeight;
      verticalScrollRef.current.scrollTo({ y: scrollPosition, animated: true });
    }
  }, [date, hourHeight]);

  const borderColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

  const handleCellPress = (hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    onPressCell?.(d);
  };

  const dayEvents = useMemo(() => {
    const eventsOfDay: Event[] = [...eventsOverlappingDay(events, date)];
    return dedupeCalendarEvents(eventsOfDay);
  }, [events, date]);

  // Clamp event times to day boundaries for display
  function clampTimeToDay(eventTime: Date, day: Date, isStart: boolean): Date {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    if (isStart) {
      return eventTime < dayStart ? dayStart : eventTime;
    } else {
      return eventTime > dayEnd ? dayEnd : eventTime;
    }
  }

  const packedLayout = useMemo(() => packTimedEvents(dayEvents), [dayEvents]);
  const dayGridWidth = SCREEN_WIDTH - 50;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.dayHeader}>
        <ThemedText style={styles.dayHeaderWeekday}>
          {date
            .toLocaleDateString('cs-CZ', { weekday: 'long' })
            .replace(/^./, (c) => c.toUpperCase())}
        </ThemedText>
        <ThemedText style={styles.dayHeaderDate}>
          {date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })}
        </ThemedText>
      </ThemedView>

      <ScrollView ref={verticalScrollRef}>
        <ThemedView style={{ flexDirection: 'row', position: 'relative' }}>
          {dayjs(date).isSame(new Date(), 'day') && (() => {
            const now = new Date();
            const currentHour = now.getHours(); // Vezme přesně 21
            const currentMinute = now.getMinutes(); // Vezme 35
            const topPos = (currentHour * hourHeight) + ((currentMinute / 60) * hourHeight);

            return (
              <View style={[styles.timeIndicatorWrapper, { top: topPos, left: 0, right: 0 }]} pointerEvents="none">
                <View style={styles.currentTimeDot} />
                <View style={styles.currentTimeLine} />
              </View>
            );
          })()}
          {/* Hodiny */}
          <ThemedView style={{ position: 'relative' }}>
            {hours.map(h => (
              <ThemedView key={h} style={[styles.hourLabel, { height: hourHeight }]}><ThemedText>{h}:00</ThemedText></ThemedView>
            ))}
          </ThemedView>

          {/* Eventy – Google-style full-width split by overlap cluster */}
          <ThemedView style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {hours.map((h) => (
              <Pressable
                key={h}
                onPress={() => handleCellPress(h)}
                style={{
                  width: dayGridWidth,
                  height: hourHeight,
                  borderWidth: 0.5,
                  borderColor: '#ccc',
                }}
              />
            ))}

            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {dayEvents.map((e) => {
                const { startHourOffset, segmentHours } = visibleSegmentOnDay(e, date);
                const packed = packedLayout.get(e);
                const column = packed?.column ?? 0;
                const clusterColumns = packed?.clusterColumns ?? 1;
                const left = (column / clusterColumns) * dayGridWidth;
                const width = dayGridWidth / clusterColumns;
                const top = startHourOffset * hourHeight;
                const height = Math.max(segmentHours * hourHeight, 14);

                const relevantUserEvents = e.is_group ? getEventParticipants(userEvents, e) : [];
                const count = relevantUserEvents.length;
                const colorObj = colorByUserId.get(String(e.user_id));
                const backgroundColor = e.is_group
                  ? Brand.groupEvent
                  : colorObj?.background_color ?? '#ccc';
                const textColor = e.is_group ? Brand.onPrimary : colorObj?.text_color ?? '#000';

                const TITLE_LH = 12;
                const META_LH = 11;
                const PAD_Y = 4;
                const blockWidth = Math.max(width - 1, 4);
                const { titleLines, metaLines } = eventBlockLineSplit(height, {
                  paddingY: PAD_Y,
                  titleLineHeight: TITLE_LH,
                  metaLineHeight: META_LH,
                });
                const showMeta = metaLines > 0;

                const timeLabel = `${dayjs(clampTimeToDay(e.start, date, true)).format('HH:mm')}–${dayjs(clampTimeToDay(e.end, date, false)).format('HH:mm')}`;
                const ownerLabel = e.is_group
                  ? `${count}/${e.pocet_lidi}`
                  : userById.get(String(e.user_id))?.username ?? 'Neznámý';
                const metaLabel = `${timeLabel} · ${ownerLabel}`;

                return (
                  <Pressable
                    key={eventInstanceKey(e)}
                    onPress={(pressEvent) => {
                      const y = pressEvent.nativeEvent.locationY;
                      const hourFloat = startHourOffset + y / hourHeight;
                      const hour = Math.min(23, Math.max(0, Math.floor(hourFloat)));
                      const atHour = new Date(date);
                      atHour.setHours(hour, 0, 0, 0);
                      onPressEvent?.(e, atHour);
                    }}
                    style={{
                      position: 'absolute',
                      top,
                      left,
                      width: blockWidth,
                      height,
                      backgroundColor,
                      borderRadius: 6,
                      padding: 2,
                      overflow: 'hidden',
                      borderWidth: 0.5,
                      borderColor: e.is_group ? Brand.groupEventBorder : borderColor,
                      borderLeftWidth: e.group_id ? 4 : 0.5,
                      borderLeftColor: e.group_id
                        ? '#FF6B6B'
                        : e.is_group
                          ? Brand.groupEventBorder
                          : borderColor,
                      zIndex: 2,
                    }}
                  >
                    {showMeta ? (
                      <>
                        <ThemedText
                          style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: textColor,
                            lineHeight: TITLE_LH,
                          }}
                          numberOfLines={titleLines}
                          ellipsizeMode="tail"
                        >
                          {e.title}
                        </ThemedText>
                        <ThemedText
                          style={{
                            fontSize: 9,
                            color: textColor,
                            opacity: 0.9,
                            lineHeight: META_LH,
                          }}
                          numberOfLines={metaLines}
                          ellipsizeMode="tail"
                        >
                          {metaLabel}
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText
                        style={{
                          fontSize: 9,
                          fontWeight: '600',
                          color: textColor,
                          lineHeight: 11,
                        }}
                        numberOfLines={Math.max(1, Math.floor((height - PAD_Y) / 11))}
                        ellipsizeMode="tail"
                      >
                        {`${dayjs(clampTimeToDay(e.start, date, true)).format('HH:mm')} ${e.title}`}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  dayHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  dayHeaderWeekday: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  dayHeaderDate: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  hourLabel: { width: 50, justifyContent: 'flex-start', alignItems: 'center', borderRightWidth: 0.5, borderTopWidth: 1, borderColor: '#ccc' },
  timeIndicatorWrapper: {
    position: 'absolute',
    left: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
    elevation: 10,
    marginTop: -5,
  },
  currentTimeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff0000' },
  currentTimeLine: { flex: 1, height: 2, backgroundColor: '#ff0000' },
});
