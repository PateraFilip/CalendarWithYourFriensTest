import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Event {
  title: string;
  start: Date;
  end: Date;
  color?: string;
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

  // Pokud se defaultDate změní, aktualizujeme date
  useEffect(() => {
    if (defaultDate) setDate(defaultDate);
  }, [defaultDate]);

  useEffect(() => {
    horizontalScrollRef.current?.scrollTo({x:0, animated: true})
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
      const { totalColumns } = assignEventColumns(cellEvents, cellPrevious);
      if (totalColumns > max) max = totalColumns;
    }
    return max;
  }, [dayEvents]);

  return (
    <View style={{ flex: 1 }}>
      {/* 🔹 Horní navigace */}
      <View style={styles.navBar}>
        <Pressable onPress={handlePrevDay} style={styles.navButton}>
          <Text style={styles.navText}>← Předchozí</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {date.toLocaleDateString('cs-CZ', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        <Pressable onPress={handleNextDay} style={styles.navButton}>
          <Text style={styles.navText}>Další →</Text>
        </Pressable>
      </View>

      {/* 📅 Kalendářní den */}
      <ScrollView style={{ flex: 1, backgroundColor: "white" }}>
        <View style={{ flexDirection: 'row' }}>
          {/* ⏰ Levý sloupec s hodinami */}
          <View>
            {hours.map((h) => (
              <View key={h} style={[styles.hourLabel, { height: hourHeight }]}>
                <Text style={{ fontSize: 12, color: '#333' }}>{`${h}:00`}</Text>
              </View>
            ))}
          </View>

          {/* 🟦 Eventy - horizontální ScrollView přes všechny hodiny */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
          >
            <View>
              {hours.map((h) => {
                const cellEvents = dayEvents.filter((e) => e.start.getHours() === h);
                const cellPrevious = dayEvents.filter(
                  (e) => e.start.getHours() < h && e.end.getHours() >= h
                );
                const { eventColumns } = assignEventColumns(cellEvents, cellPrevious);

                return (
                  <View key={h} style={{ height: hourHeight, flex: 1 }}>
                    <Pressable
                      onPress={() => handleCellPress(h)}
                      style={{
                        height: hourHeight,
                        width: Math.max(maxColumns * 60, SCREEN_WIDTH - 50),
                        position: 'relative',
                        borderWidth: 0.5
                      }}
                    >
                      {cellEvents.map((e, i) => {
                        const duration = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60);
                        const topOffset = (e.start.getMinutes() / 60) * hourHeight;
                        const col = eventColumns.get(e) || 0;

                        return (
                          <View
                            key={i}
                            style={{
                              position: 'absolute',
                              top: topOffset,
                              left: col * 60,
                              width: 60,
                              height: hourHeight * duration,
                              backgroundColor: e.color || '#9cf',
                              borderRadius: 6,
                              padding: 2,
                            }}
                          >
                            <Text style={{ fontSize: 11, color: '#000', fontWeight: '500' }}>
                              {e.title}
                            </Text>
                          </View>
                        );
                      })}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eee',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navButton: {
    padding: 6,
  },
  navText: {
    color: '#007AFF',
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
    backgroundColor: '#fafafa',
  },
});
