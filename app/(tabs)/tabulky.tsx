import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { router, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, RefreshControl, View } from 'react-native';
import { fetchMyLeagues, League } from '@/api/leagues/leagues';
import { ActivityIndicator } from 'react-native-paper';

export default function TabulkyScreen() {
    const { user } = useAuth();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const surfaceColor = useThemeColor({ light: '#fff', dark: '#2A2A2A' }, 'surface');
    const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'text'); // optionally use it if needed

    const loadLeagues = async () => {
        if (!user) return;
        try {
            console.log('Loading leagues for user:', user.id);
            const data = await fetchMyLeagues(user.id);
            
            const sorted = [...data].sort((a, b) => {
                const timeA = new Date(a.updated_at || a.created_at).getTime();
                const timeB = new Date(b.updated_at || b.created_at).getTime();
                return timeB - timeA;
            });
            
            console.log('Set leagues state with length:', sorted.length);
            setLeagues(sorted);
        } catch (error) {
            console.error('Error loading leagues', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadLeagues();
        }, [user])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLeagues();
        setRefreshing(false);
    };

    return (
        <ThemedSafeView style={{ flex: 1 }}>
            <ThemedView style={{ flex: 1 }}>
                <View style={{ padding: 16 }}>
                    <ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>Tabulky a Výsledky</ThemedText>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={leagues}
                        keyExtractor={(item) => item.id.toString()}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        ListEmptyComponent={
                            <ThemedText style={{ textAlign: 'center', marginTop: 40, color: '#888', fontSize: 16 }}>
                                Zatím nejsi v žádné tabulce. {"\n\n"}
                                Vytvoř si vlastní ligu pomocí růžového tlačítka + vpravo dole!
                            </ThemedText>
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                onPress={() => router.push(`/leaderboards/${item.id}`)}
                                style={{
                                    backgroundColor: surfaceColor,
                                    padding: 16,
                                    borderRadius: 12,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: borderColor
                                }}
                            >
                                <ThemedText style={{ fontSize: 18, fontWeight: 'bold' }}>
                                    {item.name}
                                </ThemedText>
                                <ThemedText style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
                                    {item.team_size === 0 ? 'Všichni proti všem' : `${item.team_size}v${item.team_size}`}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    />
                )}

            </ThemedView>
        </ThemedSafeView>
    );
}
