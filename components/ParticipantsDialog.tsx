import { SelectablePeopleList, type PeopleListColor } from '@/components/SelectablePeopleList';
import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { Modal, Portal } from 'react-native-paper';

export type SelectableUserId = string | number;

interface ParticipantsDialogProps {
  visible: boolean;
  onDismiss: () => void;
  users: any[];
  currentUserId?: SelectableUserId;
  selectedParticipants: SelectableUserId[];
  setSelectedParticipants: (ids: SelectableUserId[]) => void;
  /** Pokud je nastaveno, omezí počet vybraných (+ zakladatel). Pro pozvané nechte undefined. */
  peopleCount?: number;
  title?: string;
  subtitle?: string;
  buttonColor: string;
  cardBackgroundColor: string;
  colors?: PeopleListColor[];
  headerActionLabel?: string;
  onHeaderAction?: () => void;
  /** Pokud je nastaveno, zobrazí potvrzovací tlačítko místo pouhého zavření. */
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmLoading?: boolean;
  emptyText?: string;
}

export const ParticipantsDialog = React.memo(function ParticipantsDialog({
  visible,
  onDismiss,
  users,
  currentUserId,
  selectedParticipants,
  setSelectedParticipants,
  peopleCount,
  title = 'Vyber účastníky',
  subtitle,
  buttonColor,
  cardBackgroundColor,
  colors,
  headerActionLabel,
  onHeaderAction,
  onConfirm,
  confirmLabel = 'Přidat',
  confirmLoading = false,
  emptyText = 'Žádní přátelé k výběru.',
}: ParticipantsDialogProps) {
  const scheme = useColorScheme();
  const surfaces = scheme === 'dark' ? BrandSurfaces.dark : BrandSurfaces.light;
  const { height } = useWindowDimensions();

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

  const selectedSet = useMemo(
    () => new Set(selectedParticipants.map(String)),
    [selectedParticipants]
  );
  const enforceLimit = typeof peopleCount === 'number' && peopleCount > 0;
  const list = users.filter((u) => String(u.id) !== String(currentUserId));
  const limitReached =
    enforceLimit && selectedParticipants.length + 1 >= peopleCount!;

  const resolvedSubtitle =
    subtitle ??
    (list.length === 0
      ? undefined
      : enforceLimit
        ? `Vybráno ${selectedParticipants.length + 1} / ${peopleCount}`
        : `Vybráno ${selectedParticipants.length} z ${list.length}`);

  const accent = buttonColor || Brand.primary;

  const toggle = (id: SelectableUserId) => {
    if (confirmLoading) return;
    const idStr = String(id);
    if (selectedSet.has(idStr)) {
      setSelectedParticipants(
        selectedParticipants.filter((x) => String(x) !== idStr)
      );
    } else if (!limitReached) {
      setSelectedParticipants([...selectedParticipants, id]);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => {
          if (!confirmLoading) onDismiss();
        }}
        contentContainerStyle={[
          styles.modal,
          {
            backgroundColor: cardBackgroundColor || surfaces.surface,
            maxHeight: height * 0.8,
          },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View style={styles.headerText}>
            <ThemedText style={[styles.title, { color: textColor }]}>
              {title}
            </ThemedText>
            {resolvedSubtitle ? (
              <ThemedText style={[styles.subtitle, { color: secondary }]}>
                {resolvedSubtitle}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              if (!confirmLoading) onDismiss();
            }}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel="Zavřít"
          >
            <MaterialCommunityIcons name="close" size={22} color={secondary} />
          </Pressable>
        </View>

        {headerActionLabel && onHeaderAction ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={onHeaderAction}
              disabled={confirmLoading}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedText style={[styles.actionLabel, { color: accent }]}>
                {headerActionLabel}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SelectablePeopleList
            users={list}
            selectedIds={selectedParticipants}
            onToggle={toggle}
            colors={colors}
            limitReached={limitReached}
            disabled={confirmLoading}
            emptyText={emptyText}
          />
        </ScrollView>

        <View
          style={[
            styles.footer,
            { borderTopColor: borderColor, backgroundColor: cardBackgroundColor },
          ]}
        >
          {onConfirm ? (
            <View style={styles.footerRow}>
              <Pressable
                onPress={onDismiss}
                disabled={confirmLoading}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor, opacity: pressed || confirmLoading ? 0.7 : 1 },
                ]}
              >
                <ThemedText style={[styles.secondaryLabel, { color: textColor }]}>
                  Zrušit
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={confirmLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: accent,
                    flex: 1,
                    opacity: pressed || confirmLoading ? 0.88 : 1,
                  },
                ]}
              >
                {confirmLoading ? (
                  <ActivityIndicator color={Brand.onPrimary} />
                ) : (
                  <ThemedText style={styles.primaryLabel}>{confirmLabel}</ThemedText>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: accent, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <ThemedText style={styles.primaryLabel}>Hotovo</ThemedText>
            </Pressable>
          )}
        </View>
      </Modal>
    </Portal>
  );
});

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
  headerText: { flex: 1, gap: 2, paddingRight: 8 },
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
  actionRow: {
    paddingHorizontal: 18,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  actionLabel: { fontSize: 13, fontWeight: '700' },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: Brand.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  secondaryLabel: { fontSize: 16, fontWeight: '600' },
});
