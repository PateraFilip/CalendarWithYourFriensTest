import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export type PeopleListUser = {
  id: string | number;
  username: string;
};

export type PeopleListColor = {
  user_id: string | number;
  background_color: string;
  text_color?: string;
};

export function peopleInitials(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || '?';
}

type SelectablePeopleListProps = {
  users: PeopleListUser[];
  selectedIds: Array<string | number>;
  onToggle: (id: string | number) => void;
  colors?: PeopleListColor[];
  /** When true, non-selected rows cannot be selected. */
  limitReached?: boolean;
  disabled?: boolean;
  emptyText?: string;
};

export function SelectablePeopleList({
  users,
  selectedIds,
  onToggle,
  colors,
  limitReached = false,
  disabled = false,
  emptyText = 'Žádní lidé k výběru.',
}: SelectablePeopleListProps) {
  const textColor = useThemeColor({}, 'text');
  const secondary = useThemeColor(
    {
      light: BrandSurfaces.light.textSecondary,
      dark: BrandSurfaces.dark.textSecondary,
    },
    'text'
  );
  const borderColor = useThemeColor(
    { light: BrandSurfaces.light.border, dark: BrandSurfaces.dark.border },
    'background'
  );
  const rowBg = useThemeColor(
    { light: '#F7F8FA', dark: BrandSurfaces.dark.surfaceElevated },
    'background'
  );

  const selectedSet = new Set(selectedIds.map(String));

  if (users.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: Brand.primarySoft }]}>
          <MaterialCommunityIcons
            name="account-multiple-outline"
            size={26}
            color={Brand.primary}
          />
        </View>
        <ThemedText style={[styles.emptyText, { color: secondary }]}>
          {emptyText}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {users.map((u) => {
        const idStr = String(u.id);
        const isSelected = selectedSet.has(idStr);
        const blocked = !isSelected && limitReached;
        const colorObj = colors?.find((c) => String(c.user_id) === idStr);
        const accent = colorObj?.background_color ?? Brand.primary;
        const onAccent = colorObj?.text_color ?? Brand.onPrimary;

        return (
          <Pressable
            key={idStr}
            disabled={disabled || blocked}
            onPress={() => onToggle(u.id)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: rowBg,
                borderColor: isSelected ? accent : borderColor,
                opacity: blocked ? 0.4 : pressed ? 0.85 : isSelected ? 1 : 0.78,
              },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: blocked || disabled }}
          >
            <View style={[styles.avatar, { backgroundColor: accent }]}>
              <ThemedText style={[styles.avatarText, { color: onAccent }]}>
                {peopleInitials(u.username)}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.username, { color: textColor }]}
              numberOfLines={1}
            >
              {u.username}
            </ThemedText>
            <View
              style={[
                styles.check,
                {
                  backgroundColor: isSelected ? accent : 'transparent',
                  borderColor: isSelected ? accent : secondary,
                },
              ]}
            >
              {isSelected ? (
                <MaterialCommunityIcons name="check" size={16} color={onAccent} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  username: { flex: 1, fontSize: 16, fontWeight: '600' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
