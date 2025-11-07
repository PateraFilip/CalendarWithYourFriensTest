import { fetchUsers } from '@/api/get_users';
import { fetchUserEvents } from '@/api/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet } from 'react-native';
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
}

interface User {
  id: number;
  username: string;
  jmeno: string;
  prijmeni: string;
  email: string;
  datum_narozeni: string
}

interface UserEvent {
  event_id: number;
  user_id: number;
}

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DayCalendar({
  events,
  weeklyEvents,
  eventsException,
  onPressCell,
  hourHeight = 100,
  defaultDate,
  colors
}: DayCalendarProps) {
  const [date, setDate] = useState(defaultDate || new Date());
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const scrollRef = useRef<ScrollView>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([])

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

  useEffect(() => { if (defaultDate) setDate(defaultDate); }, [defaultDate]);
  const borderColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

  const handleCellPress = (hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    onPressCell?.(d);
  };

  const dayEvents = useMemo(() => {
    const startDay = new Date(date); startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(date); endDay.setHours(23, 59, 59, 999);
    const eventsOfDay: Event[] = [];

    // Jednorázové eventy
    events.forEach(e => { if (e.end > startDay && e.start < endDay) eventsOfDay.push(e); });

    // Týdenní eventy
    const daysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    weeklyEvents.forEach(w => {
      const eventDay = daysShort[date.getDay()];
      const eventDayPrev = daysShort[(date.getDay() + 6) % 7]

      if ((w.den.trim().normalize() !== eventDay && w.den.trim().normalize() !== eventDayPrev) || (w.den.trim().normalize() === eventDayPrev && w.cas_do > w.cas_od)) return;
      let start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
      let end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
      if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
      else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);
      const exceptionDelete = eventsException.some(ex =>
        ex.event_id === w.id &&
        new Date(ex.puvodni_start).getTime() === start.getTime() &&
        ex.typ == "DELETE"
      );
      const exception = eventsException.find(ex =>
        ex.event_id === w.id &&
        new Date(ex.puvodni_start).getTime() === start.getTime()
      );
      if (exception) {
        console.log(`⚙️ Výjimka nalezena pro event ${w.id}, upravuji časy`);
        start.setTime(new Date(exception.start).getTime());
        end.setTime(new Date(exception.end).getTime());
        if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
        else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);
      }
      if (exceptionDelete) {
        console.log(`⏭️ Event ${w.id} přeskočen kvůli výjimce`);
        return; // nepushuj tento event
      }

      eventsOfDay.push({ id: w.id, title: w.title, start, end, user_id: w.user_id, pocet_lidi: 1, pravidelnost: true, is_group: false });
    });

    return eventsOfDay;
  }, [events, weeklyEvents, date]);

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
        <Pressable onPress={() => setDate(d => new Date(d.setDate(d.getDate() - 1)))} style={styles.navButton}><ThemedText style={styles.navText}>← Předchozí</ThemedText></Pressable>
        <ThemedText style={styles.headerTitle}>{date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</ThemedText>
        <Pressable onPress={() => setDate(d => new Date(d.setDate(d.getDate() + 1)))} style={styles.navButton}><ThemedText style={styles.navText}>Další →</ThemedText></Pressable>
      </ThemedView>

      <ScrollView>
        <ThemedView style={{ flexDirection: 'row' }}>
          {/* Hodiny */}
          <ThemedView>
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

                // Eventy viditelné v aktuální hodině
                const cellEvents = dayEvents.filter(e =>
                  e.end > new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0, 0) &&
                  e.start < new Date(date.getFullYear(), date.getMonth(), date.getDate(), h + 1, 0, 0, 0)
                );

                return (
                  <Pressable
                    key={h}
                    onPress={() => handleCellPress(h)}
                    style={{
                      width: Math.max(totalColumns * 60, SCREEN_WIDTH - 50),
                      height: hourHeight,
                      position: 'relative',
                      borderWidth: 0.5,
                      borderColor: '#ccc'
                    }}
                  >
                    {cellEvents.map((e, i) => {
                      const eventStart = e.start < dayStart ? dayStart : e.start;
                      const eventEnd = e.end > dayEnd ? dayEnd : e.end;

                      const startHourOffset = (eventStart.getHours() + eventStart.getMinutes() / 60);
                      const endHourOffset = (eventEnd.getHours() + eventEnd.getMinutes() / 60);

                      // Přesná výška eventu v rámci hodiny
                      let topOffset = 0;
                      let height = hourHeight;

                      if (h >= Math.floor(startHourOffset) && h <= Math.floor(endHourOffset)) {
                        topOffset = h === Math.floor(startHourOffset) ? (startHourOffset - h) * hourHeight : 0;
                        height = (Math.min(endHourOffset, h + 1) - Math.max(startHourOffset, h)) * hourHeight;
                      }

                      const count = userEvents.filter(u => u.event_id === e.id).length;
                      const col = eventColumns.get(e) || 0;
                      const duration = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
                      const colorObj = colors.find(c => c.user_id === e.user_id); // najde barvu pro daného uživatele
                      const backgroundColor = e.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc'; // fallback pokud není barva
                      const textColor = e.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';
                      if (e.start.getHours() === h && e.start.getDate() === date.getDate() && e.start.getMonth() === date.getMonth() && e.start.getFullYear() === date.getFullYear()) {
                        return (
                          <ThemedView
                            key={i}
                            style={{
                              position: 'absolute',
                              top: topOffset,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * duration,
                              backgroundColor: backgroundColor,
                              borderRadius: 6,
                              padding: 2,
                              borderWidth: 0.5,
                              borderColor: e.is_group ? "yellow" : borderColor
                            }}
                          >
                            {!e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý uživatel'}
                              </ThemedText>)}
                            {e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {count}/{e.pocet_lidi}
                              </ThemedText>)}
                          </ThemedView>
                        );
                      }
                      else if (h === 0 && e.end.getDate() === date.getDate() && e.end.getMonth() === date.getMonth() && e.end.getFullYear() === date.getFullYear()) {
                        const dayDuration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
                        return (
                          <ThemedView
                            key={i}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * dayDuration,
                              backgroundColor: backgroundColor,
                              borderRadius: 6,
                              padding: 2,
                              borderWidth: 0.5,
                              borderColor: e.is_group ? "yellow" : borderColor
                            }}
                          >
                            {!e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý uživatel'}
                              </ThemedText>)}
                            {e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {count}/{e.pocet_lidi}
                              </ThemedText>)}
                          </ThemedView>
                        );
                      }
                      else if (h === 0) {
                        return (
                          <ThemedView
                            key={i}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * duration,
                              backgroundColor: backgroundColor,
                              borderRadius: 6,
                              padding: 2,
                              borderWidth: 0.5,
                              borderColor: e.is_group ? "yellow" : borderColor
                            }}
                          >
                            {!e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý uživatel'}
                              </ThemedText>)}
                            {e.is_group && (
                              <ThemedText style={{ fontSize: 11, fontWeight: '500', color: textColor }}>
                                {e.title} - {count}/{e.pocet_lidi}
                              </ThemedText>)}
                          </ThemedView>
                        );
                      }
                    })}
                  </Pressable>
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
  hourLabel: { width: 50, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, borderColor: '#ccc' }
});
