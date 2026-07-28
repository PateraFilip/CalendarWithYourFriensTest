import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export function FormChip({
  label,
  active,
  onPress,
  activeColor = Brand.primary,
  inactiveColor,
  inactiveBorder,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor?: string;
  inactiveColor: string;
  inactiveBorder: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? `${activeColor}28` : 'transparent',
          borderColor: active ? activeColor : inactiveBorder,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.chipText,
          {
            color: active ? activeColor : inactiveColor,
            fontWeight: active ? '700' : '600',
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function WhenRow({
  label,
  value,
  onPress,
  onPressCalendar,
  barColor,
  secondary,
  borderColor,
}: {
  label: string;
  value: string;
  onPress: () => void;
  onPressCalendar?: () => void;
  barColor: string;
  secondary: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.whenRow, { borderBottomColor: borderColor }]}>
      <View style={[styles.colorBar, { backgroundColor: barColor }]} />
      <Pressable onPress={onPress} style={styles.whenBody}>
        <ThemedText style={[styles.whenLabel, { color: secondary }]}>
          {label}
        </ThemedText>
        <ThemedText style={styles.whenValue} numberOfLines={1}>
          {value}
        </ThemedText>
      </Pressable>
      {onPressCalendar && (
        <Pressable onPress={onPressCalendar} hitSlop={10} style={styles.whenIcon}>
          <MaterialCommunityIcons
            name="calendar-outline"
            size={22}
            color={secondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13 },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  whenBody: { flex: 1, gap: 2 },
  whenLabel: { fontSize: 12, fontWeight: '500' },
  whenValue: { fontSize: 16, fontWeight: '600' },
  whenIcon: { padding: 6 },
});
