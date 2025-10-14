import React, { useMemo, useState } from 'react';
import { Button, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Event {
  title: string;
  start: Date;
  end: Date;
  color?: string;
}

interface WeekCalendarProps {
  events: Event[];
  onPressCell?: (date: Date) => void;
  hourHeight?: number;
  hourWidth?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function WeekCalendar({ events, onPressCell, hourHeight = 60, hourWidth = 80 }: WeekCalendarProps) {
  // 🗓️ Udržujeme pondělí aktuálního týdne
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay(); // 0 = neděle, 1 = pondělí...
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7)); // posun na pondělí
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // 🔹 Dny aktuálního týdne
  const days = useMemo(
    () => [
      null,
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

  const changeWeek = (direction: number) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + direction * 7);
    setCurrentWeekStart(newDate);
  };

  const weekEvents = events.filter((e) => {
    const eventDate = new Date(e.start);
    return (
      eventDate >= currentWeekStart &&
      eventDate < new Date(currentWeekStart.getTime() + 7 * 86400000)
    );
  });

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
    <View style={{ flex: 1 }}>
      {/* 🔘 Tlačítka pro přepínání týdnů */}
      <View style={styles.weekHeader}>
        <Button title="← Předchozí" onPress={() => changeWeek(-1)} />
        <Text style={styles.weekTitle}>
          {currentWeekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} -{' '}
          {new Date(currentWeekStart.getTime() + 6 * 86400000).toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        <Button title="Následující →" onPress={() => changeWeek(1)} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* 🗓️ Sloupec s dny */}
        <View style={{ width: 60 }}>
          {days.map((day, dayIndex) => {
            if (!day) {
                    return (
                      <View key={dayIndex} style={[styles.dayHeader, { height: 30, width: 60 }]}>

            </View>
                    );
                  }
            return(
            <View key={dayIndex} style={[styles.dayHeader, { height: hourHeight, width: 60 }]}>
                  <Text style={{ fontWeight: 'bold' }}>
                    {day.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                  </Text>
                  <Text>
                    {day.getDate()}.{day.getMonth() + 1}
                  </Text>
            </View>
          )})}
        </View>

        {/* ⏱️ ScrollView s hodinami */}
        <ScrollView horizontal>
          <View>
            {days.map((day, dayIndex) => (
              <View key={dayIndex} style={{ backgroundColor: 'white', flexDirection:'row'}}>
                {hours.map((h) => {
                  if (!day) {
                    return (
                      <View
                        key={`${dayIndex}-${h}`}
                        style={[styles.hourCell, { height: 30, width: hourWidth }]}
                      >
                        <Text>{h}:00</Text>
                      </View>
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

                  return (
                    <Pressable
                      key={`${dayIndex}-${h}`}
                      onPress={() => handleCellPress(day, h)}
                      style={[
                        styles.hourCell,
                        {
                          width: hourWidth,
                          height: hourHeight,
                          justifyContent: 'flex-start',
                          alignItems: 'stretch',
                          position: 'relative',
                        },
                      ]}
                    >
                      <View style={{ flex: 1, backgroundColor: 'transparent', position: 'relative' }} />

                      {cellEvents.map((e, i) => {
                        const eventDurationHours = (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60); // rozdíl v hodinách
                        const eventStartHours = e.start.getMinutes() / 60;
                        const col = eventColumns.get(e) || 0;

                        return(
                        <View
                          key={i}
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: col * 20,
                            left: eventStartHours * hourWidth,
                            height: 20,
                            width: hourWidth * eventDurationHours,
                            backgroundColor: e.color || '#9cf',
                            borderRadius: 4,
                            padding: 2,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: '#000' }}>{e.title}</Text>
                        </View>

                      )})}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#eee',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#f0f0f0',
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
    color: '#000',
  },
});
