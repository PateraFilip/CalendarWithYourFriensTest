import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router } from 'expo-router';
import { fetchLeagueDetails, fetchLeagueLeaderboard, fetchNetworkIds, League } from '@/services/leagues/leagues';
import { fetchUsers } from '@/services/users/get_users';
import { submitMatch, SubmitMatchData } from '@/services/leagues/submit_match';
import { buildSetsMetadata, summarizeSets } from '@/services/leagues/match_sets';
import { supabase } from '@/lib/supabaseClient';
import { Button, ActivityIndicator, TextInput, Checkbox, Switch, IconButton } from 'react-native-paper';

type SetRow = { team1: string; team2: string };

export default function AddMatchScreen() {
    const { id, matchId } = useLocalSearchParams();
    const { user } = useAuth();
    const editingMatchId = matchId ? Number(matchId) : null;
    
    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const surfaceColor = useThemeColor({ light: '#fff', dark: '#222' }, 'surface');
    const primaryTextColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'text');

    const [team1Players, setTeam1Players] = useState<string[]>([]);
    const [team2Players, setTeam2Players] = useState<string[]>([]);
    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');
    const [winner, setWinner] = useState<1 | 2 | 0 | null>(null);

    const [useSets, setUseSets] = useState(false);
    const [sets, setSets] = useState<SetRow[]>([{ team1: '', team2: '' }]);

    const [ffaParticipants, setFfaParticipants] = useState<{user_id: string, score: string}[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const leagueId = Number(id);
                const [l, p, u, networkIds] = await Promise.all([
                    fetchLeagueDetails(leagueId),
                    fetchLeagueLeaderboard(leagueId),
                    fetchUsers(),
                    fetchNetworkIds(String(user?.id)),
                ]);
                setLeague(l);

                const networkSet = new Set(networkIds.map(String));
                const allCandidates = u
                    .filter((usr: any) => networkSet.has(String(usr.id)))
                    .map((usr: any) => {
                        const inLeague = p.some(player => String(player.user_id) === String(usr.id));
                        return {
                            user_id: String(usr.id),
                            name: usr.username || usr.jmeno || 'Neznámý',
                            inLeague
                        };
                    });
                
                allCandidates.sort((a, b) => (a.inLeague === b.inLeague ? 0 : a.inLeague ? -1 : 1));
                setPlayers(allCandidates);

                if (editingMatchId) {
                    const { data: match } = await supabase
                        .from('league_matches')
                        .select('*, league_match_participants(*)')
                        .eq('id', editingMatchId)
                        .single();
                    if (match) {
                        const parts = match.league_match_participants || [];
                        if (l.team_size === 0) {
                            setFfaParticipants(
                                parts.map((part: any) => ({
                                    user_id: String(part.user_id),
                                    score: String(part.score ?? ''),
                                }))
                            );
                        } else {
                            const t1 = parts.filter((p: any) => Number(p.team) === 1).map((p: any) => String(p.user_id));
                            const t2 = parts.filter((p: any) => Number(p.team) === 2).map((p: any) => String(p.user_id));
                            setTeam1Players(t1);
                            setTeam2Players(t2);
                            const s1 = parts.find((p: any) => Number(p.team) === 1)?.score;
                            const s2 = parts.find((p: any) => Number(p.team) === 2)?.score;
                            setTeam1Score(s1 != null ? String(s1) : '');
                            setTeam2Score(s2 != null ? String(s2) : '');
                            if (match.metadata?.scoring_mode === 'sets' && match.metadata.sets?.length) {
                                setUseSets(true);
                                setSets(
                                    match.metadata.sets.map((s: any) => ({
                                        team1: String(s.team1),
                                        team2: String(s.team2),
                                    }))
                                );
                            }
                            const t1Win = parts.some((p: any) => Number(p.team) === 1 && p.is_winner);
                            const t2Win = parts.some((p: any) => Number(p.team) === 2 && p.is_winner);
                            if (t1Win) setWinner(1);
                            else if (t2Win) setWinner(2);
                            else setWinner(0);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                Alert.alert("Chyba", "Nepodařilo se načíst data.");
            } finally {
                setLoading(false);
            }
        }
        if (user?.id) load();
    }, [id, user?.id, editingMatchId]);

    const setsSummary = useMemo(() => {
        const parsed = sets
            .map((s) => ({ team1: parseInt(s.team1, 10), team2: parseInt(s.team2, 10) }))
            .filter((s) => !Number.isNaN(s.team1) && !Number.isNaN(s.team2));
        return summarizeSets(parsed);
    }, [sets]);

    const handlePlayerToggle = (userId: string, team: 1 | 2) => {
        if (team === 1) {
            if (team1Players.includes(userId)) setTeam1Players(p => p.filter(id => id !== userId));
            else if (team1Players.length < (league?.team_size || 99)) {
                setTeam1Players(p => [...p, userId]);
                setTeam2Players(p => p.filter(id => id !== userId));
            }
        } else {
            if (team2Players.includes(userId)) setTeam2Players(p => p.filter(id => id !== userId));
            else if (team2Players.length < (league?.team_size || 99)) {
                setTeam2Players(p => [...p, userId]);
                setTeam1Players(p => p.filter(id => id !== userId));
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

    const updateSet = (index: number, side: 'team1' | 'team2', value: string) => {
        setSets((prev) => prev.map((row, i) => (i === index ? { ...row, [side]: value } : row)));
    };

    const handleSubmit = async () => {
        if (!league || !user) return;
        setSubmitting(true);

        try {
            let data: SubmitMatchData = {
                league_id: league.id,
                created_by: String(user.id),
                teams: [],
                replace_match_id: editingMatchId || undefined,
            };

            if (league.team_size > 0) {
                if (team1Players.length === 0 || team2Players.length === 0) {
                    Alert.alert('Pozor', 'Oba týmy musí mít alespoň jednoho hráče!');
                    setSubmitting(false);
                    return;
                }

                let s1 = parseInt(team1Score) || 0;
                let s2 = parseInt(team2Score) || 0;
                let t1Wins = false;
                let t2Wins = false;
                let isDraw = false;

                if (useSets && league.config?.track_score) {
                    const parsedSets = sets
                        .map((s) => ({ team1: parseInt(s.team1, 10), team2: parseInt(s.team2, 10) }))
                        .filter((s) => !Number.isNaN(s.team1) && !Number.isNaN(s.team2));

                    if (parsedSets.length === 0) {
                        Alert.alert('Pozor', 'Zadejte alespoň jeden set.');
                        setSubmitting(false);
                        return;
                    }
                    if (parsedSets.some((s) => s.team1 === s.team2)) {
                        Alert.alert('Pozor', 'Set nemůže skončit remízou — upravte gamy.');
                        setSubmitting(false);
                        return;
                    }

                    const meta = buildSetsMetadata(parsedSets);
                    data.metadata = meta;
                    s1 = meta.sets_won.team1;
                    s2 = meta.sets_won.team2;
                    if (s1 > s2) t1Wins = true;
                    else if (s2 > s1) t2Wins = true;
                    else isDraw = true;
                } else if (league.config?.track_score && team1Score !== '' && team2Score !== '') {
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
                if (ffaParticipants.length < 1) {
                    Alert.alert('Pozor', 'Vyberte alespoň jednoho účastníka.');
                    setSubmitting(false);
                    return;
                }

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
            Alert.alert("Úspěch", editingMatchId ? "Zápas byl upraven." : "Výsledek byl zapsán!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert("Chyba", "Nepodařilo se uložit výsledek.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !league) {
        return <ThemedView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></ThemedView>;
    }

    const isFfa = league.team_size === 0;
    const canUseSets = !isFfa && !!league.config?.track_score;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                <ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
                    {editingMatchId ? 'Upravit zápas' : 'Zapsat výsledek'}
                </ThemedText>
                <ThemedText style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
                    Zobrazují se jen lidé z tvé sítě (přátelé a přátelé přátel).
                </ThemedText>

                {!isFfa && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 15 }}>
                        <ThemedView style={{ flex: 1, backgroundColor: surfaceColor, padding: 10, borderRadius: 10, borderWidth: 1, borderColor }}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#FF00AA' }}>Tým 1</ThemedText>
                            {players.map(p => (
                                <TouchableOpacity key={p.user_id} onPress={() => handlePlayerToggle(p.user_id, 1)} style={styles.playerRow}>
                                    <Checkbox status={team1Players.includes(p.user_id) ? 'checked' : 'unchecked'} color="#FF00AA" />
                                    <ThemedText style={{ flex: 1, color: p.inLeague ? primaryTextColor : '#888' }}>{p.name}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ThemedView>

                        <ThemedView style={{ flex: 1, backgroundColor: surfaceColor, padding: 10, borderRadius: 10, borderWidth: 1, borderColor }}>
                            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#00E5FF' }}>Tým 2</ThemedText>
                            {players.map(p => (
                                <TouchableOpacity key={p.user_id} onPress={() => handlePlayerToggle(p.user_id, 2)} style={styles.playerRow}>
                                    <Checkbox status={team2Players.includes(p.user_id) ? 'checked' : 'unchecked'} color="#00E5FF" />
                                    <ThemedText style={{ flex: 1, color: p.inLeague ? primaryTextColor : '#888' }}>{p.name}</ThemedText>
                                </TouchableOpacity>
                            ))}
                        </ThemedView>
                    </View>
                )}

                {canUseSets && (
                    <ThemedView style={{ marginTop: 20, backgroundColor: surfaceColor, padding: 14, borderRadius: 10, borderWidth: 1, borderColor }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <ThemedText style={{ fontWeight: '600' }}>Zapsat po setech</ThemedText>
                                <ThemedText style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                    Např. 6:1 a 2:6 jako jeden zápas. ELO zohlední sety i gamy.
                                </ThemedText>
                            </View>
                            <Switch
                                value={useSets}
                                onValueChange={(v) => {
                                    setUseSets(v);
                                    if (v && sets.length === 0) setSets([{ team1: '', team2: '' }]);
                                }}
                                color="#FF00AA"
                            />
                        </View>

                        {useSets && (
                            <View style={{ marginTop: 16 }}>
                                {sets.map((set, index) => (
                                    <View key={index} style={styles.setRow}>
                                        <ThemedText style={{ width: 56, color: '#888' }}>Set {index + 1}</ThemedText>
                                        <TextInput
                                            label="T1"
                                            value={set.team1}
                                            onChangeText={(v) => updateSet(index, 'team1', v)}
                                            keyboardType="number-pad"
                                            mode="outlined"
                                            style={styles.setInput}
                                            dense
                                        />
                                        <ThemedText style={{ marginHorizontal: 6 }}>:</ThemedText>
                                        <TextInput
                                            label="T2"
                                            value={set.team2}
                                            onChangeText={(v) => updateSet(index, 'team2', v)}
                                            keyboardType="number-pad"
                                            mode="outlined"
                                            style={styles.setInput}
                                            dense
                                        />
                                        {sets.length > 1 && (
                                            <IconButton
                                                icon="close"
                                                size={18}
                                                onPress={() => setSets((prev) => prev.filter((_, i) => i !== index))}
                                            />
                                        )}
                                    </View>
                                ))}

                                <Button
                                    mode="outlined"
                                    icon="plus"
                                    onPress={() => setSets((prev) => [...prev, { team1: '', team2: '' }])}
                                    style={{ marginTop: 4, borderColor: '#FF00AA' }}
                                    textColor="#FF00AA"
                                >
                                    Přidat set
                                </Button>

                                <ThemedText style={{ marginTop: 12, color: '#888' }}>
                                    Sety {setsSummary.sets_won.team1}:{setsSummary.sets_won.team2}
                                    {'  ·  '}
                                    Gamy {setsSummary.games.team1}:{setsSummary.games.team2}
                                </ThemedText>
                            </View>
                        )}
                    </ThemedView>
                )}

                {!isFfa && league.config?.track_score && !useSets && (
                    <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
                        <TextInput
                            label="Skóre (Tým 1)"
                            value={team1Score}
                            onChangeText={setTeam1Score}
                            keyboardType="number-pad"
                            mode="outlined"
                            style={{ flex: 1 }}
                        />
                        <TextInput
                            label="Skóre (Tým 2)"
                            value={team2Score}
                            onChangeText={setTeam2Score}
                            keyboardType="number-pad"
                            mode="outlined"
                            style={{ flex: 1 }}
                        />
                    </View>
                )}

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
                    {editingMatchId ? 'Uložit změny' : 'Uložit výsledek'}
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
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    setInput: {
        flex: 1,
        height: 44,
        backgroundColor: 'transparent',
    },
});
