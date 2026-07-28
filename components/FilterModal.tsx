import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { Modal, Portal } from 'react-native-paper';

interface User {
  id: number;
  username: string;
  jmeno: string;
  prijmeni: string;
  email: string;
  datum_narozeni: string;
}

interface FilterModalProps {
  visible: boolean;
  onDismiss: () => void;
  onToggleUser: (id: number) => void;
  colors: {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number;
  }[];
  users: User[];
  uncheckedUserIds: number[];
}

function initials(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || '?';
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  colors,
  onDismiss,
  onToggleUser,
  uncheckedUserIds,
  users,
}) => {
  const scheme = useColorScheme();
  const surfaces = scheme === 'dark' ? BrandSurfaces.dark : BrandSurfaces.light;
  const { height } = useWindowDimensions();

  const backgroundColor = useThemeColor(
    { light: BrandSurfaces.light.surface, dark: BrandSurfaces.dark.surface },
    'background'
  );
  const textColor = useThemeColor({}, 'text');
  const secondary = useThemeColor(
    { light: BrandSurfaces.light.textSecondary, dark: BrandSurfaces.dark.textSecondary },
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

  const visibleCount = useMemo(
    () => users.filter((u) => !uncheckedUserIds.some((id) => String(id) === String(u.id))).length,
    [users, uncheckedUserIds]
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor, maxHeight: height * 0.78 },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View style={styles.headerText}>
            <ThemedText style={[styles.title, { color: textColor }]}>Filtry</ThemedText>
            <ThemedText style={[styles.subtitle, { color: secondary }]}>
              {users.length === 0
                ? 'Zatím nemáš přátele'
                : `Zobrazeno ${visibleCount} z ${users.length}`}
            </ThemedText>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel="Zavřít"
          >
            <MaterialCommunityIcons name="close" size={22} color={secondary} />
          </Pressable>
        </View>

        {users.length > 0 ? (
          <FlatList
            data={users}
            extraData={uncheckedUserIds}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const colorObj = colors.find((c) => String(c.user_id) === String(item.id));
              const accent = colorObj?.background_color ?? Brand.primary;
              const onAccent = colorObj?.text_color ?? Brand.onPrimary;
              const isChecked = !uncheckedUserIds.some(
                (id) => String(id) === String(item.id)
              );

              return (
                <Pressable
                  onPress={() => onToggleUser(item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: rowBg,
                      borderColor: isChecked ? accent : borderColor,
                      opacity: pressed ? 0.85 : isChecked ? 1 : 0.72,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                >
                  <View style={[styles.avatar, { backgroundColor: accent }]}>
                    <ThemedText style={[styles.avatarText, { color: onAccent }]}>
                      {initials(item.username)}
                    </ThemedText>
                  </View>

                  <ThemedText
                    style={[styles.username, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {item.username}
                  </ThemedText>

                  <View
                    style={[
                      styles.check,
                      {
                        backgroundColor: isChecked ? accent : 'transparent',
                        borderColor: isChecked ? accent : secondary,
                      },
                    ]}
                  >
                    {isChecked ? (
                      <MaterialCommunityIcons name="check" size={16} color={onAccent} />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: Brand.primarySoft }]}>
              <MaterialCommunityIcons name="account-filter-outline" size={28} color={Brand.primary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
              Žádní přátelé
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: secondary }]}>
              Přidej přátele a pak si je tady můžeš zapínat ve filtru kalendáře.
            </ThemedText>
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: surfaces.surface }]}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.doneBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <ThemedText style={styles.doneLabel}>Hotovo</ThemedText>
          </Pressable>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primarySoft,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
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
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  username: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
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
    paddingHorizontal: 28,
    paddingVertical: 36,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    color: Brand.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
