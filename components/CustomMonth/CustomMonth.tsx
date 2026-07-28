import { Brand, BrandSurfaces } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  eventInstanceKey,
  eventsOverlappingDay,
  visibleSegmentOnDay,
} from '@/lib/calendarEvents';
import { formatShortLocation } from '@/lib/formatLocation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

dayjs.locale('cs');

interface Event {
  id: number;
  title: string;
  start: Date;
  end: Date;
  user_id: number;
  pocet_lidi: number;
  pravidelnost: boolean;
  is_group: boolean;
  poloha?: string;
  original_start?: Date;
  original_end?: Date;
}

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: number | string;
}

interface MonthCalendarProps {
  events: Event[];
  weeklyEvents?: unknown[];
  eventsException?: unknown[];
  onPressDay?: (date: Date) => void;
  onPressEvent?: (event: Event) => void;
  defaultDate?: Date;
  selectedDate?: Date | null;
  colors: Color[];
  onVisibleDateChange?: (date: Date | ((prev: Date) => Date)) => void;
}

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MAX_DOTS = 4;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventDotColor(e: Event, colors: Color[]) {
  if (e.is_group) return Brand.groupEvent;
  return (
    colors.find((c) => String(c.user_id) === String(e.user_id))
      ?.background_color || Brand.primary
  );
}

export default function MonthCalendar({
  events,
  onPressDay,
  onPressEvent,
  defaultDate,
  selectedDate: selectedDateProp,
  colors,
  onVisibleDateChange,
}: MonthCalendarProps) {
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const currentMonth = defaultDate || new Date();

  const today = useMemo(() => startOfDay(new Date()), []);

  const [internalSelected, setInternalSelected] = useState<Date>(() => {
    const base = defaultDate || new Date();
    return startOfDay(base);
  });

  const selectedDay = selectedDateProp
    ? startOfDay(selectedDateProp)
    : internalSelected;

  // Při změně měsíce drž vybraný den v zobrazeném měsíci (nebo dnešek)
  useEffect(() => {
    const inMonth =
      selectedDay.getMonth() === currentMonth.getMonth() &&
      selectedDay.getFullYear() === currentMonth.getFullYear();
    if (inMonth) return;

    const pick =
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
        ? today
        : startOfDay(
            new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
          );
    setInternalSelected(pick);
    onPressDay?.(pick);
  }, [currentMonth.getFullYear(), currentMonth.getMonth()]);

  const days = useMemo(() => {
    const first = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    const startPad = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startPad);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(startOfDay(d));
    }
    // Zkrať na 5 týdnů, pokud 6. řádek je celý mimo měsíc
    const lastRowStart = 35;
    const lastRowInMonth = cells
      .slice(lastRowStart)
      .some(
        (d) =>
          d.getMonth() === currentMonth.getMonth() &&
          d.getFullYear() === currentMonth.getFullYear()
      );
    return lastRowInMonth ? cells : cells.slice(0, 35);
  }, [currentMonth]);

  const weekCount = days.length / 7;

  const selectDay = (day: Date) => {
    const d = startOfDay(day);
    setInternalSelected(d);
    onPressDay?.(d);

    // Klik na den z jiného měsíce → přepni měsíc
    if (
      d.getMonth() !== currentMonth.getMonth() ||
      d.getFullYear() !== currentMonth.getFullYear()
    ) {
      onVisibleDateChange?.(d);
    }
  };

  const selectedEvents = useMemo(() => {
    return eventsOverlappingDay(events, selectedDay).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
  }, [events, selectedDay]);

  const dateHeader = (() => {
    const raw = dayjs(selectedDay).locale('cs').format('dddd D. MMMM YYYY');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <ThemedView style={[styles.root, { backgroundColor: surfaces.background }]}>
      <View style={styles.weekDays}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={styles.weekDayCell}>
            <ThemedText
              style={[styles.weekDayLabel, { color: surfaces.textSecondary }]}
            >
              {d}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: weekCount }).map((_, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.weekRow}>
            {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day) => {
              const inMonth =
                day.getMonth() === currentMonth.getMonth() &&
                day.getFullYear() === currentMonth.getFullYear();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selectedDay);
              const dayEvents = eventsOverlappingDay(events, day);

              const dotColors: string[] = [];
              for (const e of dayEvents) {
                const c = eventDotColor(e, colors);
                if (!dotColors.includes(c)) dotColors.push(c);
                if (dotColors.length >= MAX_DOTS) break;
              }

              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => selectDay(day)}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayNumberWrap,
                      isToday && styles.dayNumberWrapToday,
                      isSelected &&
                        !isToday && {
                          backgroundColor: Brand.primarySoft,
                          borderWidth: 1.5,
                          borderColor: Brand.primary,
                        },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.dayNumber,
                        {
                          color: isToday
                            ? '#fff'
                            : inMonth
                              ? surfaces.text
                              : surfaces.textSecondary,
                        },
                        !inMonth && { opacity: 0.45 },
                        isToday && styles.dayNumberToday,
                      ]}
                    >
                      {day.getDate()}
                    </ThemedText>
                  </View>

                  <View style={styles.dotsRow}>
                    {dotColors.map((c, i) => (
                      <View
                        key={`${day.toISOString()}-dot-${i}`}
                        style={[styles.dot, { backgroundColor: c }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View
        style={[styles.agendaHeader, { borderTopColor: surfaces.border }]}
      >
        <ThemedText style={[styles.agendaDate, { color: Brand.primary }]}>
          {dateHeader}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.agendaScroll}
        contentContainerStyle={styles.agendaContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedEvents.length === 0 ? (
          <ThemedText
            style={{
              color: surfaces.textSecondary,
              textAlign: 'center',
              marginTop: 24,
              fontSize: 14,
            }}
          >
            Žádné události
          </ThemedText>
        ) : (
          selectedEvents.map((e) => {
            const barColor = eventDotColor(e, colors);
            const { eventStart, eventEnd } = visibleSegmentOnDay(e, selectedDay);
            const timeLabel = `${dayjs(eventStart).format('H:mm')} – ${dayjs(eventEnd).format('H:mm')}`;
            const shortPoloha = formatShortLocation(e.poloha);

            return (
              <Pressable
                key={eventInstanceKey(e)}
                onPress={() => onPressEvent?.(e)}
                style={({ pressed }) => [
                  styles.eventRow,
                  pressed && {
                    backgroundColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)',
                  },
                ]}
              >
                <View style={[styles.colorBar, { backgroundColor: barColor }]} />
                <View style={styles.eventBody}>
                  <ThemedText
                    style={[styles.eventTime, { color: surfaces.textSecondary }]}
                    numberOfLines={1}
                  >
                    {timeLabel}
                  </ThemedText>
                  <ThemedText
                    style={[styles.eventTitle, { color: surfaces.text }]}
                    numberOfLines={2}
                  >
                    {e.title}
                  </ThemedText>
                  {!!shortPoloha && (
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={14}
                        color={surfaces.textSecondary}
                      />
                      <ThemedText
                        style={[
                          styles.eventMeta,
                          { color: surfaces.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {shortPoloha}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  grid: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 52,
  },
  dayNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapToday: {
    backgroundColor: Brand.primary,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '500',
  },
  dayNumberToday: {
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    minHeight: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agendaHeader: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  agendaDate: {
    fontSize: 15,
    fontWeight: '700',
  },
  agendaScroll: {
    flex: 1,
  },
  agendaContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  eventRow: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 10,
    paddingRight: 10,
    marginBottom: 4,
    gap: 12,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginLeft: 4,
    alignSelf: 'stretch',
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventMeta: {
    flex: 1,
    fontSize: 13,
  },
});
