import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
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

interface WeekCalendarProps {
  events: Event[];
  weeklyEvents: WeeklyEvent[];
  onPressCell?: (date: Date) => void;
  onPressDay?: (date: Date) => void;
  hourHeight?: number;
  hourWidth?: number;
}

export default function WeekCalendar({
  events,
  weeklyEvents,
  onPressCell,
  onPressDay,
  hourHeight = 60,
  hourWidth = 80,
}: WeekCalendarProps) {
  // 🗓️ Start aktuálního týdne (pondělí)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
  ];

  const COLORS_TEXT = [
    '#FFF', '#FFF', '#000', '#FFF', '#FFF', '#FFF', '#000', '#FFF', '#000', '#000',
    '#FFF', '#000', '#FFF', '#000', '#FFF', '#000', '#FFF', '#000', '#FFF', '#FFF'
  ];

  const getColorByUserId = (id: string | number) => {
    const n = typeof id === 'string'
      ? [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : id;
    return COLORS[n % COLORS.length];
  };

  const getColorTextByUserId = (id: string | number) => {
    const n = typeof id === 'string'
      ? [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : id;
    return COLORS_TEXT[n % COLORS_TEXT.length];
  };

  const days = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const calendarRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const isSyncingScroll = useRef(false);

  const handleScroll = (e: any) => {
    if (isSyncingScroll.current) return;
    const x = e.nativeEvent.contentOffset.x;
    hourScrollRef.current?.scrollTo({ x, animated: false });
  };

  const changeWeek = (offset: number) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + offset * 7);
    setCurrentWeekStart(newDate);
  };

  // 🔹 Události aktuálního týdne
  const weekEvents = events.filter(e => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const weekEnd = new Date(currentWeekStart.getTime() + 7 * 86400000);
    return (
      (start >= currentWeekStart && start < weekEnd) ||
      (start < currentWeekStart && end >= currentWeekStart)
    );
  });

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
    const daysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

    days.forEach(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const eventsOfDay: Event[] = [];

      // 🔹 Jednorázové eventy
      weekEvents.forEach(e => {
        if (e.start < dayEnd && e.end > dayStart) eventsOfDay.push(e);
      });

      // 🔹 Týdenní eventy
      weeklyEvents.forEach(w => {
        const eventDay = daysShort[day.getDay()];
        const eventDayPrev = daysShort[(day.getDay() + 6) % 7]
        if ((normalizeDayName(w.den) !== eventDay && normalizeDayName(w.den) !== eventDayPrev) || (normalizeDayName(w.den) === eventDayPrev && w.cas_do > w.cas_od)) return;

        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
        let end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
        if (end < start && normalizeDayName(w.den) === eventDay) end.setDate(end.getDate() + 1);
        else if (end < start && normalizeDayName(w.den) === eventDayPrev) start.setDate(start.getDate() - 1);

        if (end > dayStart && start < dayEnd) {
          eventsOfDay.push({
            id: w.id,
            title: w.title,
            start,
            end,
            user_id: w.user_id,
            pocet_lidi: 1,
            pravidelnost: true,
            is_group: false,
          });
        }
      });

      map.set(day.toDateString(), assignEventColumns(eventsOfDay));
    });

    return map;
  }, [days, weekEvents, weeklyEvents]);

  // 🔹 Vrátí eventy pro konkrétní buňku
  function mergeEventsForCell(day: Date, hour: number): Event[] {
    const dayStart = new Date(day);
    dayStart.setHours(hour, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(hour + 1);

    const eventsOfDay = Array.from(dayEventColumns.get(day.toDateString())?.eventColumns.keys() || []);
    return eventsOfDay.filter(e => e.start < dayEnd && e.end > dayStart);
  }

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
          {hours.map(h => (
            <ThemedView key={h} style={[styles.hourCell, { height: 30, width: hourWidth }]}>
              <ThemedText>{h}:00</ThemedText>
            </ThemedView>
          ))}
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
                <Pressable key={i} onPress={() => onPressDay?.(day)} style={[styles.dayHeader, { minHeight: hourHeight, height: totalColumns * 20 }]}>
                  <ThemedText style={{ fontWeight: 'bold' }}>
                    {day.toLocaleDateString('cs-CZ', { weekday: 'short' }).replace(/^./, c => c.toUpperCase())}
                  </ThemedText>
                  <ThemedText>{day.getDate()}.{day.getMonth() + 1}</ThemedText>
                </Pressable>
              )
            })}
          </ThemedView>

          {/* Tělo kalendáře */}
          <ScrollView ref={calendarRef} horizontal onScroll={handleScroll} scrollEventThrottle={16}>
            <ThemedView>
              {days.map((day, dIndex) => (
                <ThemedView key={dIndex} style={{ flexDirection: 'row' }}>
                  {hours.map(hour => {
                    const cellEvents = mergeEventsForCell(day, hour);
                    const { eventColumns, totalColumns } = dayEventColumns.get(day.toDateString())!;

                    return (
                      <Pressable
                        key={`${dIndex}-${hour}`}
                        onPress={() => onPressCell?.(new Date(day.setHours(hour)))}
                        style={[styles.hourCell, { width: hourWidth, minHeight: hourHeight, height: totalColumns * 20, position: 'relative' }]}
                      >
                        {cellEvents.map((e, i) => {
                          const duration = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
                          const offset = e.start.getMinutes() / 60;
                          const col = eventColumns.get(e) || 0;
                          if (e.start.getHours() === hour && e.start.getDate() === day.getDate() && e.start.getMonth() === day.getMonth() && e.start.getFullYear() === day.getFullYear()) {
                            return (
                              <ThemedView
                                key={i}
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: col * 20,
                                  left: offset * hourWidth,
                                  height: 20,
                                  width: hourWidth * duration,
                                  backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                                  borderRadius: 4,
                                  padding: 2,
                                }}
                              >
                                <ThemedText style={{
                                  fontSize: 10,
                                  lineHeight: 18,
                                  color: e.is_group ? "white" : getColorTextByUserId(e.user_id)
                                }}>
                                  {e.title}
                                </ThemedText>
                              </ThemedView>
                            );
                          }
                          else if (hour === 0 && e.end.getDate() === day.getDate() && e.end.getMonth() === day.getMonth() && e.end.getFullYear() === day.getFullYear()) {
                            const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0); const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
                            const eventStart = e.start < dayStart ? dayStart : e.start;
                            const eventEnd = e.end > dayEnd ? dayEnd : e.end;
                            const dayDuration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
                            return (
                              <ThemedView
                                key={i}
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: col * 20,
                                  left: 0,
                                  height: 20,
                                  width: hourWidth * dayDuration,
                                  backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                                  borderRadius: 4,
                                  padding: 2,
                                }}
                              >
                                <ThemedText style={{
                                  fontSize: 10,
                                  lineHeight: 18,
                                  color: e.is_group ? "white" : getColorTextByUserId(e.user_id)
                                }}>
                                  {e.title}
                                </ThemedText>
                              </ThemedView>
                            );
                          }
                          else if (hour === 0) {
                            return (
                              <ThemedView
                                key={i}
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: col * 20,
                                  left: 0,
                                  height: 20,
                                  width: hourWidth * duration,
                                  backgroundColor: e.is_group ? "red" : getColorByUserId(e.user_id),
                                  borderRadius: 4,
                                  padding: 2,
                                }}
                              >
                                <ThemedText style={{
                                  fontSize: 10,
                                  lineHeight: 18,
                                  color: e.is_group ? "white" : getColorTextByUserId(e.user_id)
                                }}>
                                  {e.title}
                                </ThemedText>
                              </ThemedView>
                            );
                          }
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
  hourCell: { justifyContent: 'center', alignItems: 'center', borderColor: '#ccc', borderWidth: 0.5 },
});
