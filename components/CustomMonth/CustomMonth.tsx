import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Event {
  title: string;
  start: Date;
  end: Date;
  color?: string;
}

interface MonthCalendarProps {
  events: Event[];
  onPressDay?: (date: Date) => void;
  defaultDate?: Date;
}

export default function MonthCalendar({ events, onPressDay, defaultDate }: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(defaultDate || new Date());
  const SCREEN_HEIGHT = Dimensions.get('window').height;

  // Funkce pro získání prvního dne v měsíci
  const firstDayOfMonth = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return d;
  }, [currentMonth]);

  // Funkce pro získání všech dní viditelných v kalendáři (včetně "padding" dní před a po)
  const days = useMemo(() => {
    const startDay = firstDayOfMonth.getDay(); // 0 = neděle
    const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

    const daysArray: (Date | null)[] = [];

    // přidání prázdných dní před začátkem měsíce (pondělí = 1, pokud chceme pondělí jako první den)
    const paddingBefore = (startDay + 6) % 7;
    for (let i = 0; i < paddingBefore; i++) daysArray.push(null);

    // samotné dny měsíce
    for (let i = 1; i <= totalDays; i++) {
      daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }

    // doplnění prázdných dní, aby byl počet dnů násobkem 7
    while (daysArray.length % 7 !== 0) daysArray.push(null);

    return daysArray;
  }, [currentMonth, firstDayOfMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(
      e =>
        e.start.getFullYear() === day.getFullYear() &&
        e.start.getMonth() === day.getMonth() &&
        e.start.getDate() === day.getDate()
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 🔹 Navigace mezi měsíci */}
      <View style={styles.navBar}>
        <Pressable onPress={handlePrevMonth} style={styles.navButton}>
          <Text style={styles.navText}>← Předchozí</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {currentMonth.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={handleNextMonth} style={styles.navButton}>
          <Text style={styles.navText}>Další →</Text>
        </Pressable>
      </View>

      {/* 📅 Kalendářní mřížka */}
      <View style={{ flex: 1, backgroundColor: "white", height: SCREEN_HEIGHT - 100 }}>
        <View style={styles.weekDays}>
          {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d, i) => (
            <View key={i} style={styles.weekDayCell}>
              <Text style={{ fontWeight: '600' }}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 0, flex: 1 }}>
  {Array.from({ length: days.length / 7 }).map((_, rowIndex) => (
    <View key={rowIndex} style={{ flexDirection: 'row', flex: 1 }}>
      {days.slice(rowIndex * 7, rowIndex * 7 + 7).map((day, index) => {
        if (!day) return <View key={index} style={styles.dayCell} />;

        const dayEvents = getEventsForDay(day);

        return (
            <View style={styles.dayCell}>
  <Pressable
    onPress={() => onPressDay?.(day)}
  >
    <Text style={{ fontWeight: '500', margin: 2 }}>{day.getDate()}</Text>
  </Pressable>

  {dayEvents.length > 0 && (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {dayEvents.map((e, idx) => (
        <Pressable
          key={idx}
          style={styles.eventBadge}
          onPress={() => onPressDay?.(day)}
        >
          <Text style={{ fontSize: 10, color: 'white' }}>{e.title}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )}
  <Pressable
    onPress={() => onPressDay?.(day)}
    style={{flex: 1}}
  >
  </Pressable>
</View>

        );
      })}
    </View>
  ))}
</View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#eee',
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
  weekDays: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
  },
  weekDayCell: {
    flex: 1,
    padding: 6,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRightWidth: 0.5,
    borderColor: '#ccc',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: "100%",
    borderWidth: 0.5,
    borderColor: '#ccc'
  },
  dayCellPress: {
    width: `100%`,
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#ccc'
  },
  eventBadge: {
    top: 0,
    left: 0,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    height: 18
  },
});
