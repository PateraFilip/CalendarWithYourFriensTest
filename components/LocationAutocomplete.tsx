import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface LocationAutocompleteProps {
    poloha: string;
    setPoloha: (p: string) => void;
    latitude: number | null;
    setLatitude: (l: number | null) => void;
    setLongitude: (l: number | null) => void;
    buttonColor: string;
    borderColorTheme: string;
}

export const LocationAutocomplete = React.memo(({
    poloha,
    setPoloha,
    latitude,
    setLatitude,
    setLongitude,
    buttonColor,
    borderColorTheme
}: LocationAutocompleteProps) => {
    const [locationResults, setLocationResults] = useState<any[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (poloha.length > 2 && !latitude) {
                setIsSearchingLocation(true);
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(poloha)}&format=json&addressdetails=1&limit=5&countrycodes=cz,sk`,
                        { headers: { 'User-Agent': 'share calendar with you friends/1.0', 'Accept': 'application/json' } }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        setLocationResults(data);
                    }
                } catch (err) { } finally { setIsSearchingLocation(false); }
            } else { setLocationResults([]); }
        }, 600);
        return () => clearTimeout(delayDebounceFn);
    }, [poloha, latitude]);

    return (
        <ThemedView style={[styles.field, { zIndex: 1000 }]}>
            <ThemedText style={styles.label}>Poloha (Místo konání)</ThemedText>
            <PaperTextInput
                placeholder="Zadejte název podniku, adresu nebo město..."
                value={poloha}
                onChangeText={(text) => { setPoloha(text); setLatitude(null); setLongitude(null); }}
                mode="outlined" style={styles.input} activeOutlineColor={buttonColor}
                right={isSearchingLocation ? <PaperTextInput.Icon icon={() => <ActivityIndicator size="small" color={buttonColor} />} /> : <PaperTextInput.Icon icon="map-marker-outline" />}
            />
            {locationResults.length > 0 && (
                <ThemedView style={[styles.autocompleteContainer, { borderColor: borderColorTheme }]}>
                    {locationResults.map((item, index) => (
                        <Pressable key={index} style={[styles.autocompleteItem, { borderBottomColor: borderColorTheme }]} onPress={() => { setPoloha(item.display_name); setLatitude(parseFloat(item.lat)); setLongitude(parseFloat(item.lon)); setLocationResults([]); }}>
                            <ThemedText style={{ fontSize: 13 }} numberOfLines={2}>{item.display_name}</ThemedText>
                        </Pressable>
                    ))}
                </ThemedView>
            )}
        </ThemedView>
    );
});

const styles = StyleSheet.create({
    field: { marginBottom: 12, zIndex: 1 },
    label: { fontSize: 14, marginBottom: 6, fontWeight: '600' },
    input: { fontSize: 16, backgroundColor: 'transparent' },
    autocompleteContainer: {
        position: 'absolute',
        top: 78,
        left: 0,
        right: 0,
        borderRadius: 6,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#ddd',
        maxHeight: 200,
        overflow: 'hidden'
    },
    autocompleteItem: {
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    }
});
