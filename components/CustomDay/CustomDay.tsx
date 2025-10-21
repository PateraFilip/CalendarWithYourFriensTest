import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface Event {
  title: string;
  start: Date;
  end: Date;
  user_id: number;
  pocet_lidi: number;
  pravidelnost: boolean;
  is_group: boolean;
}

interface DayCalendarProps {
  events: Event[];
  onPressCell?: (date: Date) => void;
  hourHeight?: number;
  defaultDate?: Date;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DayCalendar({
  events,
  onPressCell,
  hourHeight = 100,
  defaultDate,
}: DayCalendarProps) {
  const [date, setDate] = useState(defaultDate || new Date());
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const horizontalScrollRef = useRef<ScrollView>(null);

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

  // Pokud se defaultDate změní, aktualizujeme date
  useEffect(() => {
    if (defaultDate) setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    horizontalScrollRef.current?.scrollTo({ x: 0, animated: true })
  }, [date]);

  const handleCellPress = (hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    onPressCell?.(d);
  };

  const handlePrevDay = () => {
    setDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 1);
      return newDate;
    });
  };

  const handleNextDay = () => {
    setDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 1);
      return newDate;
    });
  };

  const dayEvents = events.filter(
    (e) =>
      e.start.getFullYear() === date.getFullYear() &&
      e.start.getMonth() === date.getMonth() &&
      e.start.getDate() === date.getDate()
  );

  function assignEventColumns(eventsCurrent: Event[], previousEvents: Event[]) {
    const events = [...eventsCurrent, ...previousEvents];
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    const columns: Event[][] = [];

    sorted.forEach((event) => {
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
        columns.push([event]);
      }
    });

    const eventColumns: Map<Event, number> = new Map();
    columns.forEach((col, idx) => {
      col.forEach((e) => eventColumns.set(e, idx));
    });

    return { eventColumns, totalColumns: columns.length };
  }

  // Nejprve zjistíme maximální počet sloupců přes všechny hodiny
  const maxColumns = useMemo(() => {
    let max = 0;
    for (let h of hours) {
      const cellEvents = dayEvents.filter((e) => e.start.getHours() === h);
      const cellPrevious = dayEvents.filter((e) => e.start.getHours() < h && e.end.getHours() >= h);
      const cellPreviousLong = events.filter((e) =>
        e.start.getTime() < date.getTime() &&
        e.end.getTime() >= date.getTime() &&
        h === 0
      )
      const { totalColumns } = assignEventColumns(cellEvents, cellPrevious);
      if (totalColumns > max) max = totalColumns;
    }

    return max;
  }, [dayEvents]);

  return (
    <ThemedView style={{ flex: 1 }}>
      {/* 🔹 Horní navigace */}
      <ThemedView style={styles.navBar}>
        <Pressable onPress={handlePrevDay} style={styles.navButton}>
          <ThemedText style={styles.navText}>← Předchozí</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>
          {date.toLocaleDateString('cs-CZ', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </ThemedText>
        <Pressable onPress={handleNextDay} style={styles.navButton}>
          <ThemedText style={styles.navText}>Další →</ThemedText>
        </Pressable>
      </ThemedView>

      {/* 📅 Kalendářní den */}
      <ScrollView style={{ flex: 1 }}>
        <ThemedView style={{ flexDirection: 'row' }}>
          {/* ⏰ Levý sloupec s hodinami */}
          <ThemedView>
            {hours.map((h) => (
              <ThemedView key={h} style={[styles.hourLabel, { height: hourHeight }]}>
                <ThemedText style={{ fontSize: 12 }}>{`${h}:00`}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* 🟦 Eventy - horizontální ScrollView přes všechny hodiny */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
          >
            <ThemedView>
              {hours.map((h) => {
                const cellEvents = dayEvents.filter((e) => e.start.getHours() === h);
                const cellPrevious = events.filter(
                  (e) => (e.start.getTime() < date.getTime() + h * 60 * 60 * 1000 && e.end.getTime() >= date.getTime() + h * 60 * 60 * 1000) ||
                    (e.start.getTime() < date.getTime() && e.end.getDate() === date.getDate())
                );
                const cellPreviousLong = events.filter((e) =>
                  e.start.getTime() < date.getTime() &&
                  e.end.getTime() >= date.getTime() &&
                  h === 0
                )

                const { eventColumns } = assignEventColumns(cellEvents, cellPrevious);

                return (
                  <View key={h} style={{ height: hourHeight, flex: 1 }}>
                    <Pressable
                      onPress={() => handleCellPress(h)}
                      style={{
                        height: hourHeight,
                        width: Math.max(maxColumns * 60, SCREEN_WIDTH - 50),
                        position: 'relative',
                        borderWidth: 0.5,
                        borderColor: '#ccc',
                      }}
                    >
                      {cellEvents.map((e, i) => {
                        const duration = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
                        const topOffset = (e.start.getMinutes() / 60) * hourHeight;
                        const col = eventColumns.get(e) || 0;

                        return (
                          <ThemedView
                            key={i}
                            style={{
                              position: 'absolute',
                              top: topOffset,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * duration,
                              backgroundColor: getColorByUserId(e.user_id),
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 11, color: getColorTextByUserId(e.user_id), fontWeight: '500' }}>
                              {e.title}
                            </ThemedText>
                          </ThemedView>
                        );
                      })}
                      {cellPreviousLong.map((e, i) => {
                        const duration = (e.end.getTime() - date.getTime()) / (1000 * 60 * 60);
                        const topOffset = (e.start.getMinutes() / 60) * hourHeight;
                        const col = eventColumns.get(e) || 0;

                        return (
                          <ThemedView
                            key={i}
                            style={{
                              position: 'absolute',
                              top: topOffset,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * duration,
                              backgroundColor: getColorByUserId(e.user_id),
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 11, color: getColorTextByUserId(e.user_id), fontWeight: '500' }}>
                              {e.title}
                            </ThemedText>
                          </ThemedView>
                        );
                      })}
                    </Pressable>
                  </View>
                );
              })}
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navButton: {
    padding: 6,
  },
  navText: {
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  hourLabel: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderColor: '#ccc',
  },
});