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

interface DayCalendarProps {
  events: Event[];
  weeklyEvents: WeeklyEvent[];
  onPressCell?: (date: Date) => void;
  hourHeight?: number;
  defaultDate?: Date;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DayCalendar({
  events,
  weeklyEvents,
  onPressCell,
  hourHeight = 100,
  defaultDate,
}: DayCalendarProps) {
  const [date, setDate] = useState(defaultDate || new Date());
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const scrollRef = useRef<ScrollView>(null);

  const COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
  ];
  const COLORS_TEXT = [
    '#FFF', '#FFF', '#000', '#FFF', '#FFF', '#FFF', '#000', '#FFF', '#000', '#000',
    '#FFF', '#000', '#FFF', '#000', '#FFF', '#000', '#FFF', '#000', '#FFF', '#FFF'
  ];

  const getColorByUserId = (id: string | number) => {
    const n = typeof id === 'string' ? [...id].reduce((a, c) => a + c.charCodeAt(0), 0) : id;
    return COLORS[n % COLORS.length];
  };

  const getColorTextByUserId = (id: string | number) => {
    const n = typeof id === 'string' ? [...id].reduce((a, c) => a + c.charCodeAt(0), 0) : id;
    return COLORS_TEXT[n % COLORS.length];
  };

  useEffect(() => { if (defaultDate) setDate(defaultDate); }, [defaultDate]);

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
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
      let end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
      if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
      else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);
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

                      const col = eventColumns.get(e) || 0;
                      const duration = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
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
                              backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 11, fontWeight: '500', color: e.is_group ? "white" : getColorTextByUserId(e.user_id) }}>
                              {e.title}
                            </ThemedText>
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
                              backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 11, fontWeight: '500', color: e.is_group ? "white" : getColorTextByUserId(e.user_id) }}>
                              {e.title}
                            </ThemedText>
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
                              backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 11, fontWeight: '500', color: e.is_group ? "white" : getColorTextByUserId(e.user_id) }}>
                              {e.title}
                            </ThemedText>
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
