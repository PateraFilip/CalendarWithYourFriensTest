import { EventCreateForm } from '@/components/EventCreateForm';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Modal, Portal } from 'react-native-paper';

interface NewEventModalProps {
  visible: boolean;
  onDismiss: () => void;
  pickedDate?: Date;
  onSuccess?: () => void;
  formKey?: number;
}

export function NewEventModal({
  visible,
  onDismiss,
  pickedDate,
  onSuccess,
  formKey = 0,
}: NewEventModalProps) {
  const { height } = useWindowDimensions();
  const backgroundColor = useThemeColor(
    { light: '#fff', dark: '#1C1C1E' },
    'background'
  );
  const textColor = useThemeColor({}, 'text');
  const secondary = useThemeColor(
    { light: '#5f6368', dark: '#9aa0a6' },
    'text'
  );
  const borderColor = useThemeColor(
    { light: '#dadce0', dark: '#3c4043' },
    'background'
  );

  const handleSuccess = () => {
    onSuccess?.();
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor, maxHeight: height * 0.92 },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <View style={styles.headerText}>
            <ThemedText style={[styles.title, { color: textColor }]}>
              Nová událost
            </ThemedText>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityLabel="Zavřít"
          >
            <MaterialCommunityIcons name="close" size={22} color={secondary} />
          </Pressable>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <EventCreateForm
            key={formKey}
            pickedDate={pickedDate?.toISOString()}
            onSuccess={handleSuccess}
          />
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 12,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primarySoft,
  },
});
