import { fetchUsers } from '@/services/users/get_users';
import { fetchUserEvents, UserEvent } from '@/services/events/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAppData } from '@/contexts/AppDataContext';
import { eventsOverlappingDay, visibleSegmentOnDay } from '@/lib/calendarEvents';
import { getEventParticipants } from '@/lib/eventParticipants';
import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

interface WeekCalendarProps {
  events: Event[];
  weeklyEvents: WeeklyEvent[];
  eventsException: EventException[];
  onPressCell?: (date: Date) => void;
  onPressDay?: (date: Date) => void;
  onPressEvent?: (event: Event) => void;
  hourHeight?: number;
  hourWidth?: number;
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

export default function WeekCalendar({
  events,
  weeklyEvents,
  eventsException,
  onPressCell,
  onPressDay,
  onPressEvent,
  hourHeight = 60,
  hourWidth = 80,
  defaultDate,
  colors,
  onVisibleDateChange
}: WeekCalendarProps) {
  // 🗓️ Start aktuálního týdne (pondělí)
  const currentWeekStart = useMemo(() => {
    const today = defaultDate || new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [defaultDate]);

  const [users, setUsers] = useState<User[]>([]);
  const [localUserEvents, setLocalUserEvents] = useState<UserEvent[]>([])
  const { userEvents: appUserEvents } = useAppData()
  const userEvents = useMemo(() => {
    const map = new Map<string, UserEvent>()
    for (const ue of [...(appUserEvents as UserEvent[] | undefined || []), ...localUserEvents]) {
      map.set(`${ue.event_id}|${ue.user_id}|${ue.instance_date ?? ''}`, ue)
    }
    return Array.from(map.values())
  }, [appUserEvents, localUserEvents])
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const borderColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

  const days = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const calendarRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);
  const isSyncingScroll = useRef(false);

  useEffect(() => {
    const now = new Date();
    const currentDayIndex = days.findIndex(day => day.toDateString() === now.toDateString());
    const currentHour = now.getHours();

    // Vertikální scroll na aktuální den
    if (currentDayIndex !== -1 && verticalScrollRef.current) {
      const scrollPosition = currentDayIndex * 60;
      verticalScrollRef.current.scrollTo({ y: scrollPosition, animated: true });
    }

    // Horizontální scroll na aktuální hodinu
    if (calendarRef.current) {
      const scrollPosition = currentHour * hourWidth;
      calendarRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  }, [days, hourWidth]);

  const handleScroll = (e: any) => {
    if (isSyncingScroll.current) return;
    const x = e.nativeEvent.contentOffset.x;
    hourScrollRef.current?.scrollTo({ x, animated: false });
  };

  const changeWeek = (offset: number) => {
    console.log('--- CHANGE WEEK CLICKED --- offset:', offset);
    onVisibleDateChange?.((prev: Date) => {
      const today = prev || new Date();
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const newDate = new Date(monday);
      newDate.setDate(monday.getDate() + offset * 7);
      console.log(`[CustomWeek] changeWeek prev=${prev?.toISOString()} -> newDate=${newDate.toISOString()}`);
      return newDate;
    });
  };

  // 🔹 Události aktuálního týdne
  const weekEvents = useMemo(() => {
    const endOfWeek = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events.filter(e => e.end > currentWeekStart && e.start < endOfWeek);
  }, [events, currentWeekStart]);

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
      setLocalUserEvents(data)
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

  function getWeekDays(start: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  function assignEventColumns(events: Event[]) {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const columns: Event[][] = [];

    sorted.forEach(event => {
      let placed = false;
      for (let col of columns) {
        const last = col[col.length - 1];
        if (last.end <= event.start) {
          col.push(event);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([event]);
    });

    const eventColumns = new Map<Event, number>();
    columns.forEach((col, i) => col.forEach(e => eventColumns.set(e, i)));

    return { eventColumns, totalColumns: columns.length };
  }

  function normalizeDayName(day: string) {
    return day.trim().normalize();
  }

  // 🔹 Spočítat sloupce pro každý den (pro všechny hodiny najednou)
  const dayEventColumns = useMemo(() => {
    const map = new Map<string, { eventColumns: Map<Event, number>; totalColumns: number }>();

    days.forEach(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const eventsOfDay: Event[] = [];

      // 1. Získáme VŠECHNY události (nové API už je umí rozbalit)
      eventsOverlappingDay(weekEvents, day).forEach(e => eventsOfDay.push(e));

      // ⚠️ STARÁ LOGIKA weeklyEvents.forEach BYLA KOMPLETNĚ SMAZÁNA ⚠️
      // Právě ta vytvářela falešné "duchy" na druhý den.

      // 2. Deduplikace (pokud by API omylem poslalo událost víckrát)
      const uniqueEvents = [];
      const seen = new Set();
      for (const e of eventsOfDay) {
        const key = `${e.id}-${e.start.getTime()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEvents.push(e);
        }
      }

      map.set(day.toDateString(), assignEventColumns(uniqueEvents));
    });

    return map;
  }, [days, weekEvents]);

  // 🔹 Vrátí eventy pro konkrétní buňku
  function mergeEventsForCell(day: Date, hour: number): Event[] {
    const dayStart = new Date(day);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(hour + 1);

    const eventsOfDay = Array.from(dayEventColumns.get(day.toDateString())?.eventColumns.keys() || []);
    return eventsOfDay.filter(e => e.start < dayEnd && e.end > dayStart);
  }

  const dayGridWidth = hours.length * hourWidth;

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* Navigace */}
      <ThemedView style={styles.navBar}>
        <Pressable onPress={() => changeWeek(-1)} style={styles.navButton}>
          <ThemedText style={styles.navText}>← Předchozí</ThemedText>
        </Pressable>
        <ThemedText style={styles.weekTitle}>
          {currentWeekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} -{' '}
          {new Date(currentWeekStart.getTime() + 6 * 86400000).toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </ThemedText>
        <Pressable onPress={() => changeWeek(1)} style={styles.navButton}>
          <ThemedText style={styles.navText}>Další →</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Hlavička hodin */}
      <ThemedView style={{ flexDirection: 'row' }}>
        <ThemedView style={[styles.dayHeader, { height: 30, width: 60 }]} />
        <ScrollView ref={hourScrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          <View style={{ width: dayGridWidth, flexDirection: 'row' }}>
            {hours.map(h => (
              <ThemedView key={h} style={[styles.hourCell, { height: 30, width: hourWidth }]}>
                <ThemedText>{h}:00</ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>
      </ThemedView>

      {/* Kalendář */}
      <ScrollView>
        <ThemedView style={{ flexDirection: 'row' }}>
          {/* Levý sloupec s dny */}
          <ThemedView style={{ width: 60 }}>
            {days.map((day, i) => {
              const { eventColumns, totalColumns } = dayEventColumns.get(day.toDateString())!;
              return (
                <Pressable key={i} onPress={() => onPressDay?.(day)} style={[styles.dayHeader, { minHeight: hourHeight, height: (totalColumns * 37) + 12 }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>
                    {day.toLocaleDateString('cs-CZ', { weekday: 'short' }).replace(/^./, c => c.toUpperCase())}
                  </ThemedText>
                  <ThemedText>{day.getDate()}.{day.getMonth() + 1}</ThemedText>
                </Pressable>
              )
            })}
          </ThemedView>

          {/* Tělo kalendáře */}
          <ScrollView
            ref={calendarRef}
            horizontal
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ width: dayGridWidth }}
          >
            <ThemedView style={{ width: dayGridWidth, overflow: 'hidden' }}>
              {days.map((day, dIndex) => (
                <ThemedView key={dIndex} style={{ flexDirection: 'row', width: dayGridWidth, overflow: 'hidden' }}>
                  {hours.map(hour => {
                    const cellEvents = mergeEventsForCell(day, hour);
                    const { eventColumns, totalColumns } = dayEventColumns.get(day.toDateString())!;

                    return (
                      <Pressable
                        key={`${dIndex}-${hour}`}
                        onPress={() => {
                          const cellDate = new Date(day);
                          cellDate.setHours(hour, 0, 0, 0);
                          onPressCell?.(cellDate);
                        }}
                        style={[styles.hourCell, { width: hourWidth, minHeight: hourHeight, height: (totalColumns * 37) + 12, position: 'relative' }]}
                      >
                        {cellEvents.map((e, i) => {
                          const { eventStart, eventEnd, startHourOffset, segmentHours } = visibleSegmentOnDay(e, day);
                          const startHour = Math.floor(startHourOffset);
                          if (hour !== startHour) return null;

                          const left = (startHourOffset - startHour) * hourWidth;
                          const width = Math.min(
                            segmentHours * hourWidth,
                            dayGridWidth - (startHour * hourWidth + left)
                          );

                          const relevantUserEvents = e.is_group ? getEventParticipants(userEvents, e) : [];
                          const count = relevantUserEvents.length;
                          const col = eventColumns.get(e) || 0;
                          const colorObj = colors.find(c => c.user_id === e.user_id);
                          const backgroundColor = e.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc';
                          const textColor = e.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';

                          return (
                            <Pressable
                              key={i}
                              onPress={() => onPressEvent?.(e)}
                              style={{
                                position: 'absolute',
                                top: col * 37,
                                left,
                                height: 37,
                                width,
                                backgroundColor: backgroundColor,
                                borderRadius: 4,
                                padding: 2,
                                borderWidth: 0.5,
                                borderColor: e.is_group ? "yellow" : borderColor
                              }}
                            >
                              <ThemedText style={{ fontSize: 10, fontWeight: '600', color: textColor, lineHeight: 12 }} numberOfLines={1}>
                                {e.title}
                              </ThemedText>
                              <ThemedText style={{ fontSize: 9, color: textColor, opacity: 0.8, lineHeight: 11 }} numberOfLines={1}>
                                {dayjs(eventStart).format('HH:mm')} - {dayjs(eventEnd).format('HH:mm')}
                              </ThemedText>
                              {e.is_group && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0 }}>
                                  <ThemedText style={{ fontSize: 8, color: textColor, marginRight: 2, lineHeight: 10 }} numberOfLines={1}>
                                    {count}/{e.pocet_lidi}
                                  </ThemedText>
                                  <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10, flex: 1 }} numberOfLines={1}>
                                    {relevantUserEvents.map((ue, idx) => {
                                      const participant = users.find(u => String(u.id) === String(ue.user_id));
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
                                      borderRadius: 2,
                                      backgroundColor: backgroundColor,
                                      marginRight: 1,
                                      borderColor: textColor,
                                      borderWidth: 0.5
                                    }}
                                  />
                                  <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10 }} numberOfLines={1}>
                                    {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý'}
                                  </ThemedText>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </Pressable>
                    );
                  })}
                </ThemedView>
              ))}
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  navButton: { padding: 6 },
  navText: { fontWeight: '500' },
  weekTitle: { fontSize: 16, fontWeight: 'bold' },
  dayHeader: { width: 60, justifyContent: 'center', alignItems: 'center', borderColor: '#ccc', borderBottomWidth: 0.5, borderRightWidth: 0.5 },
  hourCell: { justifyContent: 'center', alignItems: 'center', borderLeftColor: '#ccc', borderLeftWidth: 0.5, borderBottomWidth: 2, borderBottomColor: '#ccc', borderTopWidth: 0.5, borderTopColor: '#ccc' },
});
