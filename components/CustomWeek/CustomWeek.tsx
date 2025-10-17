import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface Event {
  title: string;
  start: Date;
  end: Date;
  user_id: number;
}

interface WeekCalendarProps {
  events: Event[];
  onPressCell?: (date: Date) => void;
  onPressDay?: (date: Date) => void;
  hourHeight?: number;
  hourWidth?: number;
}

export default function WeekCalendar({ events, onPressCell, onPressDay, hourHeight = 60, hourWidth = 80 }: WeekCalendarProps) {
  // 🗓️ Udržujeme pondělí aktuálního týdne
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay(); // 0 = neděle, 1 = pondělí...
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7)); // posun na pondělí
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
    '#FFFFFF', // e6194b
    '#FFFFFF', // 3cb44b
    '#000000', // ffe119
    '#FFFFFF', // 4363d8
    '#FFFFFF', // f58231
    '#FFFFFF', // 911eb4
    '#000000', // 46f0f0
    '#FFFFFF', // f032e6
    '#000000', // bcf60c
    '#000000', // fabebe
    '#FFFFFF', // 008080
    '#000000', // e6beff
    '#FFFFFF', // 9a6324
    '#000000', // fffac8
    '#FFFFFF', // 800000
    '#000000', // aaffc3
    '#FFFFFF', // 808000
    '#000000', // ffd8b1
    '#FFFFFF', // 000075
    '#FFFFFF', // 808080
  ];

  // Funkce na přiřazení barvy podle userId
  function getColorByUserId(userId: string | number) {
    const idNum = typeof userId === 'string'
      ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : userId;

    return COLORS[idNum % COLORS.length];
  }

  function getColorTextByUserId(userId: string | number) {
    const idNum = typeof userId === 'string'
      ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : userId;

    return COLORS_TEXT[idNum % COLORS.length];
  }

  const calendarRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);

  const isSyncingScroll = useRef(false);

  const onCalendarScroll = (e: any) => {
    if (isSyncingScroll.current) return;

    const x = e.nativeEvent.contentOffset.x;

    hourScrollRef.current?.scrollTo({ x, animated: false });
  };




  // 🔹 Dny aktuálního týdne
  const days = useMemo(
    () => [
      ...Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        return d;
      }),
    ],
    [currentWeekStart]
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleCellPress = (day: Date, hour: number) => {
    const date = new Date(day);
    date.setHours(hour);
    date.setMinutes(0, 0, 0);
    onPressCell?.(date);
  };

  const handlePressDay = (day: Date) => {
    const date = new Date(day);
    onPressDay?.(date);
  };

  const changePrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 1 * 7);
    setCurrentWeekStart(newDate);
  };

  const changeNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 1 * 7);
    setCurrentWeekStart(newDate);
  };

  const weekEvents = events.filter((e) => {
    const eventDate = new Date(e.start);
    return (
      eventDate >= currentWeekStart &&
      eventDate < new Date(currentWeekStart.getTime() + 7 * 86400000)
    );
  });

  function getColumnsForDay(day: Date, weekEvents: Event[]) {
    // všechny eventy toho dne
    const dayEvents = weekEvents.filter(e =>
      e.start.getFullYear() === day.getFullYear() &&
      e.start.getMonth() === day.getMonth() &&
      e.start.getDate() === day.getDate()
    );

    // přiřazení sloupců pro všechny eventy
    const { totalColumns } = assignEventColumns(dayEvents, []);
    return totalColumns;
  }



  function assignEventColumns(eventsCurrent: Event[], previousEvents: Event[]) {
    const events = [...eventsCurrent, ...previousEvents];
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const columns: Event[][] = [];

    sorted.forEach(event => {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (lastInCol.end <= event.start) {
          columns[col].push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // vytvoř nový sloupec
        columns.push([event]);
      }
    });

    // přiřadíme sloupec každému eventu
    const eventColumns: Map<Event, number> = new Map();
    columns.forEach((col, idx) => {
      col.forEach(e => eventColumns.set(e, idx));
    });

    return { eventColumns, totalColumns: columns.length };
  }


  return (
    <ThemedView style={{ flex: 1 }}>
      {/* 🔘 Tlačítka pro přepínání týdnů */}
      <ThemedView style={styles.navBar}>
        <Pressable onPress={changePrevWeek} style={styles.navButton}>
          <ThemedText style={styles.navText}>← Předchozí</ThemedText>
        </Pressable>
        <ThemedText style={styles.weekTitle}>
          {currentWeekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} -{' '}
          {new Date(currentWeekStart.getTime() + 6 * 86400000).toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'short',
          })} {currentWeekStart.getFullYear()}
        </ThemedText>
        <Pressable onPress={changeNextWeek} style={styles.navButton}>
          <ThemedText style={styles.navText}>Další →</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedView style={{ flexDirection: "row" }}>
        <ThemedView style={[styles.dayHeader, { height: 30, width: 60 }]}></ThemedView>
        <ScrollView ref={hourScrollRef} scrollEnabled={false} scrollEventThrottle={16} showsHorizontalScrollIndicator={false} horizontal>
          {hours.map((h) => {
            return (

              <ThemedView
                key={`${h}`}
                style={[styles.hourCell, { height: 30, width: hourWidth }]}
              >
                <ThemedText>{h}:00</ThemedText>
              </ThemedView>
            );
          })}
        </ScrollView>
      </ThemedView>

      <ScrollView>
        <ThemedView style={{ flexDirection: 'row' }}>
          {/* 🗓️ Sloupec s dny */}

          <ThemedView style={{ width: 60 }}>
            {days.map((day, dayIndex) => {
              const totalCols = day ? getColumnsForDay(day, weekEvents) : 0;



              return (
                <Pressable
                  key={dayIndex}
                  onPress={() => handlePressDay(day)}
                  style={[
                    styles.dayHeader,
                    { minHeight: hourHeight, height: totalCols * 20, width: 60 },
                  ]}
                >
                  <ThemedText style={{ fontWeight: 'bold' }}>
                    {day.toLocaleDateString('cs-CZ', { weekday: 'short' }).replace(/^./, c => c.toUpperCase())}
                  </ThemedText>
                  <ThemedText>
                    {day.getDate()}.{day.getMonth() + 1}
                  </ThemedText>
                </Pressable>
              )
            })}
          </ThemedView>

          {/* ⏱️ ScrollView s hodinami */}
          <ScrollView ref={calendarRef} onScroll={onCalendarScroll} scrollEventThrottle={16} horizontal>
            <ThemedView>
              {days.map((day, dayIndex) => (
                <ThemedView key={dayIndex} style={{ flexDirection: 'row' }}>
                  {hours.map((h) => {
                    if (!day) {
                      return (
                        <ThemedView
                          key={`${dayIndex}-${h}`}
                          style={[styles.hourCell, { height: 30, width: hourWidth }]}
                        >
                          <ThemedText>{h}:00</ThemedText>
                        </ThemedView>
                      );
                    }

                    // eventy, které začínají v této hodině
                    const cellEvents = weekEvents.filter((e) => {
                      return (
                        e.start.getFullYear() === day.getFullYear() &&
                        e.start.getMonth() === day.getMonth() &&
                        e.start.getDate() === day.getDate() &&
                        e.start.getHours() == h
                      );
                    });

                    const cellPrevious = weekEvents.filter((e) => {
                      return (
                        e.start.getFullYear() === day.getFullYear() &&
                        e.start.getMonth() === day.getMonth() &&
                        e.start.getDate() === day.getDate() &&
                        e.start.getHours() < h &&
                        e.end.getHours() >= h
                      );
                    });

                    const { eventColumns, totalColumns } = assignEventColumns(cellEvents, cellPrevious);
                    const totalCols = day ? getColumnsForDay(day, weekEvents) : 0;
                    return (
                      <Pressable
                        key={`${dayIndex}-${h}`}
                        onPress={() => handleCellPress(day, h)}
                        style={[
                          styles.hourCell,
                          {
                            width: hourWidth,
                            minHeight: hourHeight,
                            height: totalCols * 20,
                            justifyContent: 'flex-start',
                            alignItems: 'stretch',
                            position: 'relative',
                          },
                        ]}
                      >
                        <ThemedView style={{ flex: 1, backgroundColor: 'transparent', position: 'relative' }} />

                        {cellEvents.map((e, i) => {
                          const eventDurationHours = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60); // rozdíl v hodinách
                          const eventStartHours = e.start.getMinutes() / 60;
                          const col = eventColumns.get(e) || 0;

                          return (
                            <ThemedView
                              key={i}
                              pointerEvents="none"
                              style={{
                                position: 'absolute',
                                top: col * 20,
                                left: eventStartHours * hourWidth,
                                height: 20,
                                width: hourWidth * eventDurationHours,
                                backgroundColor: getColorByUserId(e.user_id),
                                borderRadius: 4,
                                padding: 2,
                              }}
                            >
                              <ThemedText style={{ fontSize: 10, lineHeight: 18, color: getColorTextByUserId(e.user_id) }}>{e.title}</ThemedText>
                            </ThemedView>

                          )
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
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  hourCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  dayHeader: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
    flexDirection: 'column',
    borderRightWidth: 0.5,
  },
  eventBox: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 6,
    padding: 4,
    elevation: 2,
  },
  eventText: {
    fontSize: 12,
  },
  navButton: {
    padding: 6,
  },
  navText: {
    fontWeight: '500',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
});
