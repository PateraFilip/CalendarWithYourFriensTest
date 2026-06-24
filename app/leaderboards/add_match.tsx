import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router } from 'expo-router';
import { fetchLeagueDetails, fetchLeagueLeaderboard, League, LeaguePlayer } from '@/services/leagues/leagues';
import { fetchUsers } from '@/services/users/get_users';
import { submitMatch, SubmitMatchData } from '@/services/leagues/submit_match';
import { Button, ActivityIndicator, TextInput, Checkbox } from 'react-native-paper';

export default function AddMatchScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    
    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const surfaceColor = useThemeColor({ light: '#fff', dark: '#222' }, 'surface');
    const primaryTextColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'text');

    // Form state pro Týmové zápasy (team_size > 0)
    const [team1Players, setTeam1Players] = useState<string[]>([]);
    const [team2Players, setTeam2Players] = useState<string[]>([]);
    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');
    const [winner, setWinner] = useState<1 | 2 | 0 | null>(null); // 0 = remíza

    // Form state pro FFA (team_size === 0)
    const [ffaParticipants, setFfaParticipants] = useState<{user_id: string, score: string}[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [l, p, u] = await Promise.all([
                    fetchLeagueDetails(Number(id)),
                    fetchLeagueLeaderboard(Number(id)),
                    fetchUsers()
                ]);
                setLeague(l);
                
                const allCandidates = u.map(user => {
                    const inLeague = p.some(player => player.user_id === user.id.toString());
                    return {
                        user_id: user.id.toString(),
                        name: user.username || user.jmeno || 'Neznámý',
                        inLeague
                    };
                });
                
                // Ti, co už v lize jsou, dáme nahoru
                allCandidates.sort((a, b) => (a.inLeague === b.inLeague ? 0 : a.inLeague ? -1 : 1));
                setPlayers(allCandidates);
            } catch (e) {
                console.error(e);
                Alert.alert("Chyba", "Nepodařilo se načíst data.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const handlePlayerToggle = (userId: string, team: 1 | 2) => {
        if (team === 1) {
            if (team1Players.includes(userId)) setTeam1Players(p => p.filter(id => id !== userId));
            else if (team1Players.length < (league?.team_size || 99)) {
                setTeam1Players(p => [...p, userId]);
                setTeam2Players(p => p.filter(id => id !== userId)); // odebere z druhého týmu
            }
        } else {
            if (team2Players.includes(userId)) setTeam2Players(p => p.filter(id => id !== userId));
            else if (team2Players.length < (league?.team_size || 99)) {
                setTeam2Players(p => [...p, userId]);
                setTeam1Players(p => p.filter(id => id !== userId)); // odebere z prvního týmu
            }
        }
    };

    const handleFfaToggle = (userId: string) => {
        const exists = ffaParticipants.find(p => p.user_id === userId);
        if (exists) {
            setFfaParticipants(p => p.filter(x => x.user_id !== userId));
        } else {
            setFfaParticipants(p => [...p, { user_id: userId, score: '' }]);
        }
    };

    const updateFfaScore = (userId: string, score: string) => {
        setFfaParticipants(p => p.map(x => x.user_id === userId ? { ...x, score } : x));
    };

    const handleSubmit = async () => {
        if (!league || !user) return;
        setSubmitting(true);

        try {
            let data: SubmitMatchData = {
                league_id: league.id,
                created_by: user.id,
                teams: []
            };

            if (league.team_size > 0) {
                // Team zápas
                if (team1Players.length === 0 || team2Players.length === 0) {
                    Alert.alert('Pozor', 'Oba týmy musí mít alespoň jednoho hráče!');
                    setSubmitting(false);
                    return;
                }

                const s1 = parseInt(team1Score) || 0;
                const s2 = parseInt(team2Score) || 0;

                // Určení vítěze: pokud se zadává skóre, určíme podle něj. Jinak z checkboxů.
                let t1Wins = false;
                let t2Wins = false;
                let isDraw = false;

                if (league.config?.track_score && team1Score !== '' && team2Score !== '') {
                    if (league.config?.lower_is_better) {
                        if (s1 < s2) t1Wins = true;
                        else if (s2 < s1) t2Wins = true;
                        else isDraw = true;
                    } else {
                        if (s1 > s2) t1Wins = true;
                        else if (s2 > s1) t2Wins = true;
                        else isDraw = true;
                    }
                } else {
                    if (winner === 1) t1Wins = true;
                    if (winner === 2) t2Wins = true;
                    if (winner === 0) isDraw = true;
                }

                data.teams = [
                    { team_index: 1, user_ids: team1Players, score: s1, is_winner: t1Wins, is_draw: isDraw },
                    { team_index: 2, user_ids: team2Players, score: s2, is_winner: t2Wins, is_draw: isDraw }
                ];
            } else {
                // FFA (Bowling, atd.)
                if (ffaParticipants.length < 1) {
                    Alert.alert('Pozor', 'Vyberte alespoň jednoho účastníka.');
                    setSubmitting(false);
                    return;
                }

                // Najdeme vítěze (nejvyšší nebo nejnižší skóre, pokud se eviduje skóre/průměr)
                let bestScore = league.config?.lower_is_better ? Infinity : -Infinity;
                if (league.config?.track_score || league.config?.track_average) {
                    if (league.config?.lower_is_better) {
                        bestScore = Math.min(...ffaParticipants.map(p => parseInt(p.score) || 0));
                    } else {
                        bestScore = Math.max(...ffaParticipants.map(p => parseInt(p.score) || 0));
                    }
                }

                data.teams = ffaParticipants.map((p, idx) => {
                    const sc = parseInt(p.score) || 0;
                    const win = (league.config?.track_score || league.config?.track_average) ? (sc === bestScore) : false;
                    return {
                        team_index: idx + 1,
                        user_ids: [p.user_id],
                        score: sc,
                        is_winner: win,
                        is_draw: false
                    };
                });
            }

            await submitMatch(data);
            Alert.alert("Úspěch", "Výsledek byl zapsán!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert("Chyba", "Nepodařilo se zapsat výsledek.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !league) {
        return <ThemedView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></ThemedView>;
    }

    const isFfa = league.team_size === 0;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                <ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
                    Zapsat výsledek
                </ThemedText>

                {!isFfa && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 15 }}>
                        {/* TÝM 1 */}
                        <ThemedView style={{ flex: 1, backgroundColor: surfaceColor, padding: 10, borderRadius: 10, borderWidth: 1, borderColor }}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#FF00AA' }}>Tým 1</ThemedText>
                            {players.map(p => (
                                <TouchableOpacity key={p.user_id} onPress={() => handlePlayerToggle(p.user_id, 1)} style={styles.playerRow}>
                                    <Checkbox status={team1Players.includes(p.user_id) ? 'checked' : 'unchecked'} color="#FF00AA" />
                                    <ThemedText style={{ flex: 1, color: p.inLeague ? primaryTextColor : '#888' }}>{p.name}</ThemedText>
                                </TouchableOpacity>
                            ))}

                            {league.config?.track_score && (
                                <TextInput
                                    label="Skóre (Tým 1)"
                                    value={team1Score}
                                    onChangeText={setTeam1Score}
                                    keyboardType="number-pad"
                                    mode="outlined"
                                    style={{ marginTop: 15 }}
                                />
                            )}
                        </ThemedView>

                        {/* TÝM 2 */}
                        <ThemedView style={{ flex: 1, backgroundColor: surfaceColor, padding: 10, borderRadius: 10, borderWidth: 1, borderColor }}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#00E5FF' }}>Tým 2</ThemedText>
                            {players.map(p => (
                                <TouchableOpacity key={p.user_id} onPress={() => handlePlayerToggle(p.user_id, 2)} style={styles.playerRow}>
                                    <Checkbox status={team2Players.includes(p.user_id) ? 'checked' : 'unchecked'} color="#00E5FF" />
                                    <ThemedText style={{ flex: 1, color: p.inLeague ? primaryTextColor : '#888' }}>{p.name}</ThemedText>
                                </TouchableOpacity>
                            ))}

                            {league.config?.track_score && (
                                <TextInput
                                    label="Skóre (Tým 2)"
                                    value={team2Score}
                                    onChangeText={setTeam2Score}
                                    keyboardType="number-pad"
                                    mode="outlined"
                                    style={{ marginTop: 15 }}
                                />
                            )}
                        </ThemedView>
                    </View>
                )}

                {/* FFA Zobrazení */}
                {isFfa && (
                    <ThemedView style={{ backgroundColor: surfaceColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor }}>
                        <ThemedText style={{ fontSize: 16, marginBottom: 10, color: '#888' }}>
                            Vyberte hráče a zadejte jejich výsledky
                        </ThemedText>
                        
                        {players.map(p => {
                            const isSelected = !!ffaParticipants.find(x => x.user_id === p.user_id);
                            return (
                                <View key={p.user_id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <TouchableOpacity onPress={() => handleFfaToggle(p.user_id)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Checkbox status={isSelected ? 'checked' : 'unchecked'} color="#FF00AA" />
                                        <ThemedText style={{ flex: 1, color: p.inLeague ? primaryTextColor : '#888' }}>{p.name}</ThemedText>
                                    </TouchableOpacity>
                                    
                                    {(isSelected && (league.config?.track_score || league.config?.track_average)) && (
                                        <TextInput
                                            label="Skóre"
                                            value={ffaParticipants.find(x => x.user_id === p.user_id)?.score || ''}
                                            onChangeText={(val) => updateFfaScore(p.user_id, val)}
                                            keyboardType="number-pad"
                                            mode="outlined"
                                            style={{ width: 100, height: 45 }}
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </ThemedView>
                )}

                {/* Manuální výběr vítěze pokud se nesleduje skóre */}
                {!isFfa && !league.config?.track_score && league.config?.track_wins_losses && (
                    <View style={{ marginTop: 25 }}>
                        <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Kdo vyhrál?</ThemedText>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Button mode={winner === 1 ? 'contained' : 'outlined'} onPress={() => setWinner(1)} style={{ flex: 1 }} buttonColor={winner === 1 ? '#FF00AA' : undefined}>Tým 1</Button>
                            <Button mode={winner === 2 ? 'contained' : 'outlined'} onPress={() => setWinner(2)} style={{ flex: 1 }} buttonColor={winner === 2 ? '#00E5FF' : undefined}>Tým 2</Button>
                            <Button mode={winner === 0 ? 'contained' : 'outlined'} onPress={() => setWinner(0)} style={{ flex: 1 }} buttonColor={winner === 0 ? '#666' : undefined}>Remíza</Button>
                        </View>
                    </View>
                )}

                <Button 
                    mode="contained" 
                    onPress={handleSubmit} 
                    loading={submitting}
                    disabled={submitting}
                    style={{ marginTop: 40, paddingVertical: 5 }}
                    buttonColor="#FF00AA"
                >
                    Uložit výsledek
                </Button>

                <Button 
                    mode="text" 
                    onPress={() => router.back()} 
                    style={{ marginTop: 10 }}
                    textColor="#888"
                >
                    Zrušit
                </Button>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5
    }
});
