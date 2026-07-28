import { Brand, BrandSurfaces } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: string | null;
  username?: string | null;
}

interface ColorPickerProps {
  colors: Color[];
  selectedColor: Color | null;
  setSelectedColor: (color: Color | null) => void;
  error?: boolean;
  setError?: (value: boolean) => void;
  accentColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
}

export default function ColorPicker({
  colors,
  selectedColor,
  setSelectedColor,
  error,
  setError,
  accentColor,
  surfaceColor,
  borderColor,
  textColor,
}: ColorPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const theme = useTheme();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = accentColor ?? (scheme === 'dark' ? Brand.primaryMuted : Brand.primary);
  const surface = surfaceColor ?? surfaces.surfaceElevated;
  const border = borderColor ?? surfaces.border;
  const label = textColor ?? surfaces.text;
  const secondary = surfaces.textSecondary;

  const handleSelect = (color: Color) => {
    if (!color.user_id) {
      setSelectedColor(color);
      setModalVisible(false);
      if (setError) setError(false);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <TextInput
          mode="outlined"
          label="Barva"
          editable={false}
          error={error}
          value={selectedColor ? selectedColor.name : undefined}
          activeOutlineColor={accent}
          outlineColor={border}
          textColor={label}
          style={{ backgroundColor: surface }}
          onPressIn={() => setModalVisible(true)}
          right={
            selectedColor ? (
              <TextInput.Icon
                icon={() => (
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: selectedColor.background_color,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  />
                )}
              />
            ) : undefined
          }
          left={
            <TextInput.Icon
              icon={() => (
                <MaterialCommunityIcons
                  name="palette"
                  size={20}
                  color={error ? theme.colors.error : accent}
                />
              )}
            />
          }
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="surface" style={styles.modalContent}>
            <View style={[styles.header, { borderBottomColor: border }]}>
              <ThemedText style={styles.headerText}>Vyber barvu</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={label} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[...colors]
                .sort((a, b) => (a.user_id ? 1 : 0) - (b.user_id ? 1 : 0))
                .map((item) => {
                  const disabled = !!item.user_id;
                  const selected = selectedColor?.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id.toString()}
                      style={[
                        styles.item,
                        selected && { backgroundColor: Brand.primarySoft },
                        disabled && styles.disabledItem,
                      ]}
                      onPress={() => handleSelect(item)}
                      disabled={disabled}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: item.background_color,
                          marginRight: 10,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? accent : border,
                        }}
                      />
                      <ThemedText
                        style={{
                          color: disabled ? secondary : label,
                          flex: 1,
                        }}
                      >
                        {item.name}
                        {disabled
                          ? ` · obsazeno (${item.username || 'uživatel'})`
                          : ''}
                      </ThemedText>
                      {selected && !disabled && (
                        <MaterialCommunityIcons
                          name="check"
                          size={20}
                          color={accent}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalContent: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  disabledItem: {
    opacity: 0.55,
  },
});
