import { eventBlockTitleLines, packTimedEvents } from '@/lib/calendarLayout';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { Brand } from '@/constants/brand';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  dedupeCalendarEvents,
  eventInstanceKey,
  eventsOverlappingDay,
  visibleSegmentOnDay,
} from '@/lib/calendarEvents';

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

interface WeekCalendarProps {
  events: Event[];
  weeklyEvents: WeeklyEvent[];
  eventsException: EventException[];
  onPressCell?: (date: Date) => void;
  onPressDay?: (date: Date) => void;
  onPressEvent?: (event: Event, atHour?: Date) => void;
  hourHeight?: number;
  hourWidth?: number;
  /** 7 = týden (od pondělí), 3 = tři dny od defaultDate */
  dayCount?: 3 | 7;
  defaultDate?: Date;
  colors: Color[];
  onVisibleDateChange?: (date: Date | ((prev: Date) => Date)) => void;
}

const TIME_GUTTER_WIDTH = 36;
const SCREEN_WIDTH = Dimensions.get('window').width;

function getVisibleDays(start: Date, dayCount: number): Date[] {
  return Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function WeekCalendar({
  events,
  weeklyEvents: _weeklyEvents,
  eventsException: _eventsException,
  onPressCell,
  onPressDay,
  onPressEvent,
  hourHeight = 52,
  hourWidth: _hourWidth = 80,
  dayCount = 7,
  defaultDate,
  colors,
  onVisibleDateChange: _onVisibleDateChange,
}: WeekCalendarProps) {
  const rangeStart = useMemo(() => {
    const base = defaultDate || new Date();
    if (dayCount === 7) return startOfWeekMonday(base);
    return startOfDay(base);
  }, [defaultDate, dayCount]);

  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTicker((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const borderColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const todayBg = useThemeColor(
    { light: 'rgba(65, 117, 225, 0.08)', dark: 'rgba(138, 180, 248, 0.12)' },
    'background'
  );

  const days = useMemo(() => getVisibleDays(rangeStart, dayCount), [rangeStart, dayCount]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const dayColumnWidth = Math.max(0, (SCREEN_WIDTH - TIME_GUTTER_WIDTH) / dayCount);
  const gridHeight = 24 * hourHeight;

  const verticalScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const now = new Date();
    const inRange = days.some((day) => day.toDateString() === now.toDateString());
    if (inRange && verticalScrollRef.current) {
      const scrollPosition = Math.max(0, (now.getHours() - 1) * hourHeight);
      verticalScrollRef.current.scrollTo({ y: scrollPosition, animated: true });
    }
  }, [days, hourHeight]);

  const rangeEvents = useMemo(() => {
    const endOfRange = new Date(rangeStart.getTime() + dayCount * 24 * 60 * 60 * 1000);
    return events.filter((e) => e.end > rangeStart && e.start < endOfRange);
  }, [events, rangeStart, dayCount]);

  const colorByUserId = useMemo(() => {
    const map = new Map<string, Color>();
    for (const c of colors) {
      if (c.user_id != null) map.set(String(c.user_id), c);
    }
    return map;
  }, [colors]);

  // Packed layouts per day column
  const dayLayouts = useMemo(() => {
    const map = new Map<string, { events: Event[]; layout: ReturnType<typeof packTimedEvents<Event>> }>();

    days.forEach((day) => {
      const uniqueEvents = dedupeCalendarEvents(eventsOverlappingDay(rangeEvents, day));
      map.set(day.toDateString(), {
        events: uniqueEvents,
        layout: packTimedEvents(uniqueEvents),
      });
    });

    return map;
  }, [days, rangeEvents]);

  const now = new Date();
  void ticker; // refresh current-time line
  const todayIndex = days.findIndex((day) => day.toDateString() === now.toDateString());
  const nowTop =
    todayIndex !== -1
      ? now.getHours() * hourHeight + (now.getMinutes() / 60) * hourHeight
      : null;

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Hlavička dnů */}
      <ThemedView style={styles.dayHeaderRow}>
        <ThemedView style={{ width: TIME_GUTTER_WIDTH }} />
        {days.map((day, i) => {
          const isToday = i === todayIndex;
          return (
            <Pressable
              key={i}
              onPress={() => onPressDay?.(day)}
              style={[
                styles.dayHeader,
                { width: dayColumnWidth },
                isToday && { backgroundColor: todayBg },
              ]}
            >
              <ThemedText style={[styles.dayName, isToday && styles.todayText]}>
                {day
                  .toLocaleDateString('cs-CZ', { weekday: 'short' })
                  .replace(/^./, (c) => c.toUpperCase())}
              </ThemedText>
              <ThemedText style={[styles.dayDate, isToday && styles.todayText]}>
                {day.getDate()}.{day.getMonth() + 1}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>

      {/* Tělo: časová osa + 7 denních sloupců */}
      <ScrollView ref={verticalScrollRef} style={{ flex: 1 }}>
        <ThemedView style={{ flexDirection: 'row', height: gridHeight }}>
          {/* Levý sloupec hodin */}
          <ThemedView style={{ width: TIME_GUTTER_WIDTH }}>
            {hours.map((h) => (
              <ThemedView key={h} style={[styles.hourLabel, { height: hourHeight }]}>
                <ThemedText style={styles.hourLabelText}>{h}:00</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Denní sloupce */}
          {days.map((day, dIndex) => {
            const isToday = dIndex === todayIndex;
            const { events: dayEvents, layout } = dayLayouts.get(day.toDateString())!;

            return (
              <View
                key={dIndex}
                style={[
                  styles.dayColumn,
                  { width: dayColumnWidth, height: gridHeight },
                  isToday && { backgroundColor: todayBg },
                ]}
              >
                {/* Hodinové buňky (tap targets + grid lines) */}
                {hours.map((hour) => (
                  <Pressable
                    key={hour}
                    onPress={() => {
                      const cellDate = new Date(day);
                      cellDate.setHours(hour, 0, 0, 0);
                      onPressCell?.(cellDate);
                    }}
                    style={[styles.hourCell, { height: hourHeight }]}
                  />
                ))}

                {/* Timed events – clipped to column */}
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {dayEvents.map((e) => {
                    const { startHourOffset, segmentHours } = visibleSegmentOnDay(e, day);
                    const packed = layout.get(e);
                    const column = packed?.column ?? 0;
                    const clusterColumns = packed?.clusterColumns ?? 1;
                    const eventWidth = dayColumnWidth / clusterColumns;
                    const left = (column / clusterColumns) * dayColumnWidth;
                    const top = startHourOffset * hourHeight;
                    const height = Math.max(segmentHours * hourHeight, 14);

                    const colorObj = colorByUserId.get(String(e.user_id));
                    const backgroundColor = e.is_group
                      ? Brand.groupEvent
                      : colorObj?.background_color ?? '#ccc';
                    const textColor = e.is_group ? Brand.onPrimary : colorObj?.text_color ?? '#000';

                    const TITLE_LH = 12;
                    const PAD_Y = 2;
                    const blockWidth = Math.max(eventWidth - 1, 4);
                    // Google Calendar (mobilní týden): od 3 souběžných sloupců jen barevný pruh
                    const showTitle = clusterColumns < 3 && blockWidth >= 20 && height >= TITLE_LH;
                    const titleLines = showTitle
                      ? eventBlockTitleLines(height, {
                          paddingY: PAD_Y,
                          titleLineHeight: TITLE_LH,
                        })
                      : 0;

                    return (
                      <Pressable
                        key={eventInstanceKey(e)}
                        onPress={(pressEvent) => {
                          const y = pressEvent.nativeEvent.locationY;
                          const hourFloat = startHourOffset + y / hourHeight;
                          const hour = Math.min(
                            23,
                            Math.max(0, Math.floor(hourFloat))
                          );
                          const atHour = new Date(day);
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
                          borderRadius: 3,
                          paddingHorizontal: showTitle ? 2 : 0,
                          paddingVertical: showTitle ? 1 : 0,
                          overflow: 'hidden',
                          borderWidth: 0.5,
                          borderColor: e.is_group ? Brand.groupEventBorder : borderColor,
                          zIndex: 2,
                        }}
                      >
                        {showTitle ? (
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
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Current time line */}
                {isToday && nowTop != null && (
                  <View
                    style={[styles.timeIndicatorWrapper, { top: nowTop }]}
                    pointerEvents="none"
                  >
                    <View style={styles.currentTimeDot} />
                    <View style={styles.currentTimeLine} />
                  </View>
                )}
              </View>
            );
          })}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  dayHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  dayHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#ccc',
  },
  dayName: { fontSize: 12, fontWeight: '600' },
  dayDate: { fontSize: 11, opacity: 0.8 },
  todayText: { color: Brand.primary, fontWeight: '700' },
  hourLabel: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 3,
    paddingLeft: 2,
    paddingTop: 0,
  },
  hourLabelText: { fontSize: 10, opacity: 0.65, marginTop: -6 },
  dayColumn: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#ccc',
    overflow: 'hidden',
    position: 'relative',
  },
  hourCell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  timeIndicatorWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
    elevation: 10,
    marginTop: -4,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.danger,
    marginLeft: -4,
  },
  currentTimeLine: { flex: 1, height: 2, backgroundColor: Brand.danger },
});
