import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  formatLocationFromNominatim,
  formatShortLocation,
} from '@/lib/formatLocation';

interface LocationAutocompleteProps {
  poloha: string;
  setPoloha: (p: string) => void;
  latitude: number | null;
  setLatitude: (l: number | null) => void;
  setLongitude: (l: number | null) => void;
  accentColor: string;
  borderColorTheme: string;
  /** @deprecated use accentColor */
  buttonColor?: string;
}

export const LocationAutocomplete = React.memo(
  ({
    poloha,
    setPoloha,
    latitude,
    setLatitude,
    setLongitude,
    accentColor,
    buttonColor,
    borderColorTheme,
  }: LocationAutocompleteProps) => {
    const color = accentColor || buttonColor || '#4175E1';
    const [locationResults, setLocationResults] = useState<any[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);

    const secondary = useThemeColor(
      { light: '#5f6368', dark: '#9aa0a6' },
      'text'
    );
    const textColor = useThemeColor({}, 'text');
    const surface = useThemeColor(
      { light: '#fff', dark: '#2c2c2e' },
      'background'
    );
    const rowHover = useThemeColor(
      { light: 'rgba(60,64,67,0.06)', dark: 'rgba(255,255,255,0.06)' },
      'background'
    );

    useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
        if (poloha.length > 2 && !latitude) {
          setIsSearchingLocation(true);
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(poloha)}&format=json&addressdetails=1&limit=5&countrycodes=cz,sk`,
              {
                headers: {
                  'User-Agent': 'share calendar with you friends/1.0',
                  Accept: 'application/json',
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              setLocationResults(data);
            }
          } catch {
            // ignore
          } finally {
            setIsSearchingLocation(false);
          }
        } else {
          setLocationResults([]);
        }
      }, 600);
      return () => clearTimeout(delayDebounceFn);
    }, [poloha, latitude]);

    const clearLocation = () => {
      setPoloha('');
      setLatitude(null);
      setLongitude(null);
      setLocationResults([]);
    };

    const formatSuggestion = (item: {
      display_name?: string;
      address?: Record<string, string>;
      name?: string;
    }) => {
      const short =
        formatLocationFromNominatim(item.address, item.name) ||
        formatShortLocation(item.display_name);
      const parts = short.split(',').map((p) => p.trim()).filter(Boolean);
      const title = parts[0] || item.name || 'Místo';
      const subtitle = parts.slice(1).join(', ');
      return { title, subtitle };
    };

    return (
      <View style={styles.wrap}>
        <View style={[styles.row, { borderBottomColor: borderColorTheme }]}>
          <View style={[styles.colorBar, { backgroundColor: color }]} />
          <MaterialCommunityIcons
            name={latitude ? 'map-marker-check' : 'map-marker-outline'}
            size={22}
            color={latitude ? color : secondary}
            style={styles.leadingIcon}
          />
          <View style={styles.inputCol}>
            <ThemedText style={[styles.label, { color: secondary }]}>
              Místo
            </ThemedText>
            <TextInput
              value={poloha}
              onChangeText={(text) => {
                setPoloha(text);
                setLatitude(null);
                setLongitude(null);
              }}
              placeholder="Adresa, podnik nebo město"
              placeholderTextColor={secondary}
              style={[styles.input, { color: textColor }]}
            />
            {latitude != null && (
              <ThemedText style={[styles.resolved, { color }]} numberOfLines={1}>
                Poloha uložena na mapě
              </ThemedText>
            )}
          </View>
          {isSearchingLocation ? (
            <ActivityIndicator size="small" color={color} style={styles.trail} />
          ) : poloha.length > 0 ? (
            <Pressable onPress={clearLocation} hitSlop={10} style={styles.trail}>
              <MaterialCommunityIcons name="close" size={20} color={secondary} />
            </Pressable>
          ) : null}
        </View>

        {locationResults.length > 0 && (
          <View
            style={[
              styles.suggestions,
              {
                borderColor: borderColorTheme,
                backgroundColor: surface,
              },
            ]}
          >
            {locationResults.map((item, index) => (
              <Pressable
                key={`${item.place_id || index}`}
                onPress={() => {
                  const short =
                    formatLocationFromNominatim(item.address, item.name) ||
                    formatShortLocation(item.display_name) ||
                    item.display_name;
                  setPoloha(short);
                  setLatitude(parseFloat(item.lat));
                  setLongitude(parseFloat(item.lon));
                  setLocationResults([]);
                }}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  { borderBottomColor: borderColorTheme },
                  pressed && { backgroundColor: rowHover },
                  index === locationResults.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View
                  style={[styles.suggestionPin, { backgroundColor: `${color}22` }]}
                >
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={18}
                    color={color}
                  />
                </View>
                <View style={styles.suggestionText}>
                  {(() => {
                    const { title, subtitle } = formatSuggestion(item);
                    return (
                      <>
                        <ThemedText
                          style={[styles.suggestionTitle, { color: textColor }]}
                          numberOfLines={2}
                        >
                          {title}
                        </ThemedText>
                        {!!subtitle && (
                          <ThemedText
                            style={[styles.suggestionSub, { color: secondary }]}
                            numberOfLines={2}
                          >
                            {subtitle}
                          </ThemedText>
                        )}
                      </>
                    );
                  })()}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    zIndex: 1000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
    minHeight: 40,
  },
  leadingIcon: {
    marginRight: 8,
  },
  inputCol: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 2,
    margin: 0,
  },
  resolved: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  trail: {
    padding: 6,
    marginLeft: 4,
  },
  suggestions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionSub: {
    fontSize: 12,
  },
});
