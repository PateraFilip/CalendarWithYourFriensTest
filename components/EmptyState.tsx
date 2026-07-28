import { Brand } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
};

/** Jednotný prázdný stav podle finálních UI návrhů. */
export function EmptyState({
  icon = 'inbox-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
  loading,
}: Props) {
  const secondary = useThemeColor(
    { light: '#687076', dark: '#9BA1A6' },
    'text'
  );

  return (
    <ThemedView style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: Brand.primarySoft }]}>
        <MaterialCommunityIcons name={icon as any} size={36} color={Brand.primary} />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {!!subtitle && (
        <ThemedText style={[styles.subtitle, { color: secondary }]}>
          {subtitle}
        </ThemedText>
      )}
      {!!actionLabel && !!onAction && (
        <Button
          mode="contained"
          buttonColor={Brand.primary}
          textColor={Brand.onPrimary}
          onPress={onAction}
          loading={loading}
          disabled={loading}
          style={styles.btn}
        >
          {actionLabel}
        </Button>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  btn: {
    marginTop: 12,
    borderRadius: 12,
  },
});
