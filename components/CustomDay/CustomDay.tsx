import { fetchUsers } from '@/services/users/get_users';
import { fetchUserEvents, UserEvent } from '@/services/events/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { dedupeCalendarEvents, eventInstanceKey, eventsOverlappingDay, visibleSegmentOnDay } from '@/lib/calendarEvents';
import { supabase } from '@/lib/supabaseClient';
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
  user_id: number;
}

interface DayCalendarProps {
  events: Event[];
  eventsException: EventException[];
  weeklyEvents: WeeklyEvent[];
  onPressCell?: (date: Date) => void;
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
  email: string;
  datum_narozeni: string
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DayCalendar({
  events,
  weeklyEvents,
  eventsException,
  onPressCell,
  hourHeight = 100,
  defaultDate,
  colors,
  onVisibleDateChange
}: DayCalendarProps) {
  const date = defaultDate || new Date();
  const [ticker, setTicker] = useState(0);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const scrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([])

  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dayjs(date).isSame(new Date(), 'day') && verticalScrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollPosition = currentHour * hourHeight;
      verticalScrollRef.current.scrollTo({ y: scrollPosition, animated: true });
    }
  }, [date, hourHeight]);

  const changeDay = (offset: number) => {
    console.log('--- CHANGE DAY CLICKED --- offset:', offset);
    onVisibleDateChange?.((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset);
      console.log(`[CustomDay] prev=${prev.toISOString()} -> new=${d.toISOString()}`);
      return d;
    });
  };

  const loadUsers = async () => {
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (err) {
      console.error(err)
    }
  }

  const loadUserEvent = async () => {
    try {
      const data = await fetchUserEvents()
      setUserEvents(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    let mounted = true;

    loadUsers(); // načtení na start

    const channel = supabase.channel('realtime:public:users');

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'users'
    }, (payload) => {
      console.log('Change in users:', payload);
      if (mounted) {
        loadUsers(); // načti nové eventy
      }
    });

    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    loadUserEvent()

    const channel = supabase.channel('realtime:public:user_events');

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'event_users'
    }, (payload) => {
      console.log('Change in events:', payload);
      if (mounted) loadUserEvent(); // načti nové eventy
    });

    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

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

  const { eventColumns, totalColumns } = useMemo(() => {
    const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
    const columns: Event[][] = [];
    sorted.forEach(event => {
      let placed = false;
      for (let col of columns) {
        const last = col[col.length - 1];
        if (last.end <= event.start) { col.push(event); placed = true; break; }
      }
      if (!placed) columns.push([event]);
    });
    const map = new Map<Event, number>();
    columns.forEach((col, i) => col.forEach(e => map.set(e, i)));
    return { eventColumns: map, totalColumns: columns.length };
  }, [dayEvents]);

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Navigace */}
      <ThemedView style={styles.navBar}>
        <Pressable onPress={() => { const newD = new Date(date); newD.setDate(date.getDate() - 1); onVisibleDateChange?.(newD); }} style={styles.navButton}><ThemedText style={styles.navText}>← Předchozí</ThemedText></Pressable>
        <ThemedText style={styles.headerTitle}>{date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</ThemedText>
        <Pressable onPress={() => { const newD = new Date(date); newD.setDate(date.getDate() + 1); onVisibleDateChange?.(newD); }} style={styles.navButton}><ThemedText style={styles.navText}>Další →</ThemedText></Pressable>
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

          {/* Eventy */}
          <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator>
            <ThemedView style={{ flexDirection: 'column' }}>
              {hours.map(h => {
                const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

                const now = dayjs();
                const isToday = dayjs(date).isSame(now, 'day');
                const nowMs = now.valueOf();

                // Eventy viditelné v aktuální hodině
                const cellEvents = dayEvents.filter(e =>
                  e.end > new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0, 0) &&
                  e.start < new Date(date.getFullYear(), date.getMonth(), date.getDate(), h + 1, 0, 0, 0)
                );

                return (
                  <View key={h} style={{ position: 'relative', height: hourHeight }}>
                    <Pressable
                      onPress={() => handleCellPress(h)}
                      style={{
                        width: Math.max(totalColumns * 60, SCREEN_WIDTH - 50),
                        height: hourHeight,
                        borderWidth: 0.5,
                        borderColor: '#ccc'
                      }}
                    >
                      {cellEvents.map((e) => {
                        const { startHourOffset, segmentHours } = visibleSegmentOnDay(e, date);
                        const segmentStartHour = Math.floor(startHourOffset);
                        if (h !== segmentStartHour) return null;

                        const topOffset = (startHourOffset - segmentStartHour) * hourHeight;
                        // Pro pravidelné události filtrujeme podle instance_date
                        const itemInstanceDate = dayjs(e.start).format('YYYY-MM-DD');
                        // Check for CLEARED marker for this specific instance
                        const clearedMarker = userEvents.find(u => u.event_id === e.id && u.instance_date === `CLEARED-${itemInstanceDate}`);
                        const instanceSpecificEvents = userEvents.filter(u => u.event_id === e.id && u.instance_date === itemInstanceDate);
                        let relevantUserEvents: any[];
                        if (e.pravidelnost) {
                          if (clearedMarker) {
                            relevantUserEvents = [];
                          } else if (instanceSpecificEvents.length > 0) {
                            relevantUserEvents = instanceSpecificEvents;
                          } else {
                            relevantUserEvents = userEvents.filter(u => u.event_id === e.id && !u.instance_date);
                          }
                        } else {
                          relevantUserEvents = userEvents.filter(u => u.event_id === e.id && !u.instance_date);
                        }
                        const count = relevantUserEvents.length;
                        const col = eventColumns.get(e) || 0;
                        const colorObj = colors.find(c => c.user_id === e.user_id);
                        const backgroundColor = e.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc';
                        const textColor = e.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';

                        return (
                          <ThemedView
                            key={eventInstanceKey(e)}
                            style={{
                              position: 'absolute',
                              top: topOffset,
                              left: col * 60,

                              width: 60,
                              height: hourHeight * segmentHours,
                              backgroundColor: backgroundColor,
                              borderRadius: 6,
                              padding: 2,

                              borderWidth: 0.5,
                              borderColor: e.is_group ? "yellow" : borderColor,
                              borderLeftWidth: e.group_id ? 4 : 0.5,
                              borderLeftColor: e.group_id ? '#FF6B6B' : (e.is_group ? "yellow" : borderColor),
                            }}
                          >
                            <ThemedText style={{ fontSize: 10, fontWeight: '600', color: textColor, lineHeight: 12 }} numberOfLines={1}>
                              {e.title}
                            </ThemedText>
                            <ThemedText style={{ fontSize: 9, color: textColor, opacity: 0.8, marginTop: 0, lineHeight: 11 }} numberOfLines={1}>
                              {dayjs(clampTimeToDay(e.start, date, true)).format('HH:mm')} - {dayjs(clampTimeToDay(e.end, date, false)).format('HH:mm')}
                            </ThemedText>
                            {e.is_group && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ThemedText style={{ fontSize: 8, color: textColor, marginRight: 2, lineHeight: 10 }} numberOfLines={1}>
                                  {count}/{e.pocet_lidi}
                                </ThemedText>
                                <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10, flex: 1 }} numberOfLines={1}>
                                  {relevantUserEvents.map((ue, idx) => {
                                    const participant = users.find(u => u.id === ue.user_id);
                                    const name = participant ? participant.username : `User ${ue.user_id}`;
                                    const userColorObj = colors.find(c => String(c.user_id) === String(ue.user_id));
                                    const userColor = userColorObj?.background_color || '#ccc';
                                    return (
                                      <ThemedText key={`${ue.event_id}-${ue.user_id}-${idx}`} style={{ fontSize: 8, color: textColor, lineHeight: 10 }}>
                                        <ThemedText style={{ color: userColor, fontSize: 8, lineHeight: 10 }}>● </ThemedText>
                                        {name}{idx < relevantUserEvents.length - 1 ? ', ' : ''}
                                      </ThemedText>
                                    );
                                  })}
                                </ThemedText>
                              </View>
                            )}
                            {!e.is_group && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0 }}>
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: backgroundColor,
                                    marginRight: 2,
                                    borderColor: textColor,
                                    borderWidth: 0.5,
                                  }}
                                />
                                <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10 }} numberOfLines={1}>
                                  {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý'}
                                </ThemedText>
                              </View>
                            )}
                          </ThemedView>
                        );
                      })}
                    </Pressable>
                  </View>
                )
              })}

            </ThemedView>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  navButton: { padding: 6 },
  navText: { fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
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
