import { Brand } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CalendarViewMode } from '@/lib/calendarViewPrefs';
import { CALENDAR_VIEW_OPTIONS } from '@/lib/calendarViewPrefs';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  visible: boolean;
  current: CalendarViewMode;
  onDismiss: () => void;
  onSelect: (mode: CalendarViewMode) => void;
};

/**
 * Custom view picker (avoids Paper Menu + gesture-handler touch conflicts).
 */
export function CalendarViewMenu({
  visible,
  current,
  onDismiss,
  onSelect,
}: Props) {
  const textColor = useThemeColor({}, 'text');
  const bg = useThemeColor({ light: '#fff', dark: '#2C2C2E' }, 'background');
  const muted = useThemeColor(
    { light: 'rgba(0,0,0,0.06)', dark: 'rgba(255,255,255,0.08)' },
    'background'
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: bg }]}
          onPress={(e) => e.stopPropagation()}
        >
          {CALENDAR_VIEW_OPTIONS.map((opt) => {
            const selected = opt.value === current;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  onDismiss();
                }}
                style={[
                  styles.item,
                  selected && { backgroundColor: muted },
                ]}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
              >
                <ThemedText
                  style={[
                    styles.itemLabel,
                    { color: selected ? Brand.primary : textColor },
                    selected && styles.itemLabelSelected,
                  ]}
                >
                  {opt.label}
                </ThemedText>
                {selected && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={Brand.primary}
                  />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: 56,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  sheet: {
    minWidth: 200,
    borderRadius: 12,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 24,
  },
  itemLabel: {
    fontSize: 16,
  },
  itemLabelSelected: {
    fontWeight: '700',
  },
});
