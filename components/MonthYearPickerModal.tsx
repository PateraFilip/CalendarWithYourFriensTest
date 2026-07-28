import { Brand } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

dayjs.locale('cs');

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

type Props = {
  visible: boolean;
  date: Date;
  onDismiss: () => void;
  onSelect: (date: Date) => void;
};

export function MonthYearPickerModal({
  visible,
  date,
  onDismiss,
  onSelect,
}: Props) {
  const [year, setYear] = useState(date.getFullYear());
  const textColor = useThemeColor({}, 'text');
  const bg = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const muted = useThemeColor(
    { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.1)' },
    'background'
  );
  const { width } = useWindowDimensions();
  const sheetWidth = Math.min(360, width - 32);

  useEffect(() => {
    if (visible) setYear(date.getFullYear());
  }, [visible, date]);

  const selectedMonth = date.getMonth();
  const selectedYear = date.getFullYear();

  const monthLabels = useMemo(
    () =>
      MONTHS.map((m) =>
        dayjs().month(m).format('MMM').replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase())
      ),
    []
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: bg, width: sheetWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.yearRow}>
            <Pressable
              onPress={() => setYear((y) => y - 1)}
              hitSlop={12}
              accessibilityLabel="Předchozí rok"
              style={styles.yearBtn}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
            </Pressable>
            <ThemedText style={[styles.yearTitle, { color: textColor }]}>{year}</ThemedText>
            <Pressable
              onPress={() => setYear((y) => y + 1)}
              hitSlop={12}
              accessibilityLabel="Další rok"
              style={styles.yearBtn}
            >
              <MaterialCommunityIcons name="chevron-right" size={28} color={textColor} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {MONTHS.map((month) => {
              const selected = month === selectedMonth && year === selectedYear;
              return (
                <Pressable
                  key={month}
                  onPress={() => {
                    const day = Math.min(
                      date.getDate(),
                      dayjs().year(year).month(month).daysInMonth()
                    );
                    onSelect(new Date(year, month, day));
                    onDismiss();
                  }}
                  style={styles.monthCell}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.monthChip,
                      {
                        backgroundColor: selected ? Brand.primary : muted,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.monthLabel,
                        { color: selected ? '#fff' : textColor },
                      ]}
                    >
                      {monthLabels[month]}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  yearBtn: {
    padding: 4,
  },
  yearTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  monthChip: {
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
