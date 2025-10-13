import React, { useRef } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function WeekCalendar({ events, onPressCell, hourHeight = 60 }: WeekCalendarProps) {
  const days = [
  null, // prázdný den na začátku
  ...Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + i + 1); // pondělí jako první
    return d;
  })
];


  const hours = Array.from({ length: 24 }, (_, i) => i);
  const verticalScroll = useRef<ScrollView>(null);
  const horizontalScroll = useRef<ScrollView>(null);

  const handleCellPress = (day: Date, hour: number) => {
    const date = new Date(day);
    date.setHours(hour + 2);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
    onPressCell?.(date);
  };

  const getEventsForCell = (day: Date, hour: number) => {
    return events.filter(e => e.start <= new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)
      && e.end > new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour));
  };

  return (
    <View style={{ flexDirection: 'row' }}>
  {/* Sloupec s dny */}
  <View style={{ width: 80 }}>
    {days.map((day, dayIndex) => (
      <View key={dayIndex} style={[styles.dayHeader, { height: hourHeight }]}>
        {day ? (
          <>
            <Text style={{ fontWeight: 'bold' }}>
              {day.toLocaleDateString('cs-CZ', { weekday: 'short' })}
            </Text>
            <Text>{day.getDate()}.{day.getMonth() + 1}</Text>
          </>
        ) : (
          <>
            <Text style={{ fontWeight: 'bold' }}> </Text>
            <Text> </Text>
          </>
        )}
      </View>
    ))}
  </View>

  {/* ScrollView s hodinami */}
  <ScrollView horizontal>
    <View style={{ flexDirection: 'row' }}>
      {hours.map(h => (
        <View key={h}>
          {days.map((day, dayIndex) => (
      <View key={dayIndex} style={[styles.dayHeader, { height: hourHeight }]}>
        {day ? (
          <>
          <Pressable
            key={dayIndex}
            onPress={() => day && handleCellPress(day, h)}
          >
            <View style={[styles.hourCell, { width: 80, height: hourHeight }]}></View>
          </Pressable>

          </>
        ) : (
          <>
            <View key={h} style={[styles.hourCell, { width: 80, height: hourHeight }]}>
          <Text>{h}:00</Text>
        </View>
          </>
        )}
      </View>
    ))}
        </View>
      ))}
    </View>
  </ScrollView>
</View>
  );
}

const styles = StyleSheet.create({
  hourCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  dayHeader: {
    width: 80,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f0f0f0',
    flexDirection: 'column',
    borderRightWidth: 1
  },
  cell: {
    borderWidth: 0.5,
    borderColor: '#eee',
    position: 'relative',
  },
  event: {
    position: 'absolute',
    left: 0,
    right: 0,
    margin: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  eventText: {
    color: 'white',
    fontSize: 12,
  },
});
