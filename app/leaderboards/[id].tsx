import React, { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { fetchLeagueDetails, fetchLeagueLeaderboard, fetchLeagueMatches, League, LeaguePlayer } from '@/services/leagues/leagues';
import { Button, ActivityIndicator, FAB } from 'react-native-paper';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/system/supabaseClient';

export default function LeaderboardDetailScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    
    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<LeaguePlayer[]>([]);
    const [teamStats, setTeamStats] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ranking' | 'teams' | 'matches'>('ranking');

    const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
    const surfaceColor = useThemeColor({ light: '#fff', dark: '#2A2A2A' }, 'surface');
    const primaryTextColor = useThemeColor({}, 'text');

    const [sortBy, setSortBy] = useState<'default' | 'matches' | 'win_ratio' | 'score_diff' | 'elo' | 'avg' | 'positions'>('default');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const handleSort = (column: 'default' | 'matches' | 'win_ratio' | 'score_diff' | 'elo' | 'avg' | 'positions') => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const loadData = async () => {
        try {
            const leagueId = Number(id);
            const l = await fetchLeagueDetails(leagueId);
            setLeague(l);
            
            const [p, m] = await Promise.all([
                fetchLeagueLeaderboard(leagueId),
                fetchLeagueMatches(leagueId)
            ]);
            
            setPlayers(p);
            setMatches(m);

            // VÝPOČET TÝMOVÝCH STATISTIK POKUD JE TEAM SIZE > 1
            if (l.team_size > 1) {
                const teamsMap = new Map<string, any>();
                m.forEach(match => {
                    const teamsInMatch = new Map<number, any[]>();
                    match.league_match_participants.forEach((part: any) => {
                        if (!teamsInMatch.has(part.team)) teamsInMatch.set(part.team, []);
                        teamsInMatch.get(part.team)!.push(part);
                    });
                    
                    teamsInMatch.forEach((participants, teamIndex) => {
                        if (participants.length < 2) return; // ignorujeme sólo hráče v týmových hrách
                        
                        const sortedParts = [...participants].sort((a, b) => a.user_id.localeCompare(b.user_id));
                        const teamKey = sortedParts.map(p => p.user_id).join('_');
                        
                        if (!teamsMap.has(teamKey)) {
                            teamsMap.set(teamKey, {
                                id: teamKey,
                                names: sortedParts.map(p => p.users?.username || p.users?.jmeno).join(' & '),
                                matches_played: 0,
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                score_for: 0,
                                score_against: 0,
                                score_diff: 0,
                                rating: 0,
                                user_ids: sortedParts.map(p => p.user_id)
                            });
                        }
                        
                        const stats = teamsMap.get(teamKey)!;
                        stats.matches_played += 1;
                        
                        const isWinner = participants[0].is_winner;
                        const matchHasWinner = match.league_match_participants.some((p: any) => p.is_winner);
                        
                        if (isWinner) stats.wins += 1;
                        else if (!matchHasWinner) stats.draws += 1;
                        else stats.losses += 1;
                        
                        const teamScore = participants[0].score || 0;
                        const otherTeamParts = match.league_match_participants.filter((p: any) => p.team !== teamIndex);
                        const againstScore = otherTeamParts.length > 0 ? (otherTeamParts[0].score || 0) : 0;
                        
                        if (l.config?.track_score) {
                            stats.score_for += teamScore;
                            stats.score_against += againstScore;
                            stats.score_diff += (teamScore - againstScore);
                        }
                    });
                });
                
                const teamStatsArray = Array.from(teamsMap.values()).map(team => {
                    const teamPlayers = p.filter((player: any) => team.user_ids.includes(player.user_id));
                    if (teamPlayers.length > 0) {
                        team.rating = teamPlayers.reduce((sum: number, pl: any) => sum + pl.rating, 0) / teamPlayers.length;
                    }
                    return team;
                });
                
                setTeamStats(teamStatsArray);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [id])
    );

    if (loading || !league) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator />
            </ThemedView>
        );
    }

    // --- LOGIKA ŘAZENÍ ---
    const getSortedArray = (arr: any[]) => {
        return [...arr].sort((a, b) => {
            let valA = 0;
            let valB = 0;

            if (sortBy === 'matches') {
                valA = a.matches_played;
                valB = b.matches_played;
            } else if (sortBy === 'win_ratio') {
                valA = a.matches_played ? a.wins / a.matches_played : 0;
                valB = b.matches_played ? b.wins / b.matches_played : 0;
                if (valA === valB) { valA = a.wins; valB = b.wins; }
            } else if (sortBy === 'positions') {
                // Přepočet hodnoty pro 1-2-3: Primárně 1. místa, pak 2. místa, pak 3. místa
                valA = (a.first_places || 0) * 10000 + (a.second_places || 0) * 100 + (a.third_places || 0);
                valB = (b.first_places || 0) * 10000 + (b.second_places || 0) * 100 + (b.third_places || 0);
            } else if (sortBy === 'score_diff') {
                valA = a.score_diff;
                valB = b.score_diff;
            } else if (sortBy === 'elo') {
                valA = a.rating;
                valB = b.rating;
            } else if (sortBy === 'avg') {
                valA = a.matches_played ? a.total_score / a.matches_played : 0;
                valB = b.matches_played ? b.total_score / b.matches_played : 0;
            } else {
                // Default fallback
                if (league?.config?.track_elo) { valA = a.rating; valB = b.rating; }
                else if (league?.config?.track_average) {
                    valA = a.matches_played ? a.total_score / a.matches_played : 0;
                    valB = b.matches_played ? b.total_score / b.matches_played : 0;
                } else {
                    valA = a.matches_played ? a.wins / a.matches_played : 0;
                    valB = b.matches_played ? b.wins / b.matches_played : 0;
                    if (valA === valB) { valA = a.wins; valB = b.wins; }
                }
            }

            let isLowerBetter = false;
            if (league?.config?.lower_is_better) {
                if (sortBy === 'avg' || sortBy === 'score_diff') {
                    isLowerBetter = true;
                } else if (sortBy === 'default' && !league?.config?.track_elo && league?.config?.track_average) {
                    isLowerBetter = true;
                }
            }
            if (isLowerBetter) {
                const temp = valA;
                valA = valB;
                valB = temp;
            }

            if (valA === valB) {
                // Tiebreaker: více zápasů
                valA = a.matches_played;
                valB = b.matches_played;
            }

            return sortOrder === 'desc' ? valB - valA : valA - valB;
        });
    };

    const HeaderItem = ({ label, column, style }: any) => {
        let isActive = false;
        if (sortBy === column) {
            isActive = true;
        } else if (sortBy === 'default') {
            if (league?.config?.track_elo) {
                isActive = column === 'elo';
            } else if (league?.config?.track_average) {
                isActive = column === 'avg';
            } else if (league?.config?.track_positions) {
                isActive = column === 'positions';
            } else {
                isActive = column === 'win_ratio';
            }
        }
        
        return (
            <TouchableOpacity onPress={() => handleSort(column)} style={style}>
                <ThemedText style={{ textAlign: style.textAlign || 'center', fontWeight: 'bold', color: isActive ? '#FF00AA' : primaryTextColor }}>
                    {label} {isActive ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </ThemedText>
            </TouchableOpacity>
        );
    };

    const renderRanking = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flex: 1 }}>
            <View style={{ padding: 16, minWidth: '100%' }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor, paddingBottom: 8, marginBottom: 8 }}>
                    <ThemedText style={{ width: 30, fontWeight: 'bold' }}>#</ThemedText>
                    <ThemedText style={{ minWidth: 120, flex: 1, fontWeight: 'bold' }}>Hráč</ThemedText>
                    <HeaderItem label="Záp" column="matches" style={{ width: 45 }} />
                    {league.config?.track_wins_losses && (
                        <HeaderItem label="V-R-P" column="win_ratio" style={{ width: 65 }} />
                    )}
                    {league.config?.track_positions && (
                        <HeaderItem label="1-2-3" column="positions" style={{ width: 65 }} />
                    )}
                    {league.config?.track_score && (
                        <ThemedText style={{ width: 60, textAlign: 'center', fontWeight: 'bold' }}>Skóre</ThemedText>
                    )}
                    {league.config?.track_score_diff && (
                        <HeaderItem label="Rozd" column="score_diff" style={{ width: 50 }} />
                    )}
                    {league.config?.track_elo && (
                        <HeaderItem label="ELO" column="elo" style={{ width: 60, textAlign: 'right' }} />
                    )}
                    {league.config?.track_average && (
                        <HeaderItem label="Průměr" column="avg" style={{ width: 70, textAlign: 'right' }} />
                    )}
                </View>

                {getSortedArray(players).map((p, index) => (
                    <View key={p.id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor }}>
                        <ThemedText style={{ width: 30, fontWeight: 'bold', color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : primaryTextColor }}>
                            {index + 1}.
                        </ThemedText>
                        <ThemedText style={{ minWidth: 120, flex: 1 }} numberOfLines={1}>{p.users?.username || p.users?.jmeno}</ThemedText>
                        <ThemedText style={{ width: 45, textAlign: 'center' }}>{p.matches_played}</ThemedText>
                        
                        {league.config?.track_wins_losses && (
                            <ThemedText style={{ width: 65, textAlign: 'center', color: '#888' }}>
                                {p.wins}-{p.draws}-{p.losses}
                            </ThemedText>
                        )}

                        {league.config?.track_positions && (
                            <ThemedText style={{ width: 65, textAlign: 'center', color: '#888' }}>
                                <ThemedText style={{ color: '#FFD700' }}>{p.first_places || 0}</ThemedText>-
                                <ThemedText style={{ color: '#C0C0C0' }}>{p.second_places || 0}</ThemedText>-
                                <ThemedText style={{ color: '#CD7F32' }}>{p.third_places || 0}</ThemedText>
                            </ThemedText>
                        )}

                        {league.config?.track_score && (
                            <ThemedText style={{ width: 60, textAlign: 'center' }}>
                                {league.team_size === 0 ? p.score_for : `${p.score_for}:${p.score_against}`}
                            </ThemedText>
                        )}
                        {league.config?.track_score_diff && (
                            <ThemedText style={{ width: 50, textAlign: 'center', color: p.score_diff > 0 ? '#4CAF50' : p.score_diff < 0 ? '#F44336' : '#888' }}>
                                {p.score_diff > 0 ? '+' : ''}{p.score_diff}
                            </ThemedText>
                        )}
                        
                        {league.config?.track_elo && (
                            <ThemedText style={{ width: 60, textAlign: 'right', fontWeight: 'bold', color: '#FFD700' }}>
                                {Math.round(p.rating)}
                            </ThemedText>
                        )}

                        {league.config?.track_average && (
                            <ThemedText style={{ width: 70, textAlign: 'right', fontWeight: 'bold', color: '#00E5FF' }}>
                                {p.matches_played ? (p.total_score / p.matches_played).toFixed(1) : '0.0'}
                            </ThemedText>
                        )}
                    </View>
                ))}
            </View>
        </ScrollView>
    );

    const renderTeams = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flex: 1 }}>
            <View style={{ padding: 16, minWidth: '100%' }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor, paddingBottom: 8, marginBottom: 8 }}>
                    <ThemedText style={{ width: 30, fontWeight: 'bold' }}>#</ThemedText>
                    <ThemedText style={{ minWidth: 160, flex: 1, fontWeight: 'bold' }}>Tým</ThemedText>
                    <HeaderItem label="Záp" column="matches" style={{ width: 45 }} />
                    {league.config?.track_wins_losses && (
                        <HeaderItem label="V-R-P" column="win_ratio" style={{ width: 65 }} />
                    )}
                    {league.config?.track_score && (
                        <ThemedText style={{ width: 60, textAlign: 'center', fontWeight: 'bold' }}>Skóre</ThemedText>
                    )}
                    {league.config?.track_score_diff && (
                        <HeaderItem label="Rozd" column="score_diff" style={{ width: 50 }} />
                    )}
                    {league.config?.track_elo && (
                        <HeaderItem label="ELO" column="elo" style={{ width: 60, textAlign: 'right' }} />
                    )}
                </View>

                {getSortedArray(teamStats).map((t, index) => (
                    <View key={t.id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor }}>
                        <ThemedText style={{ width: 30, fontWeight: 'bold', color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : primaryTextColor }}>
                            {index + 1}.
                        </ThemedText>
                        <ThemedText style={{ minWidth: 160, flex: 1, fontSize: 13 }} numberOfLines={1}>{t.names}</ThemedText>
                        <ThemedText style={{ width: 45, textAlign: 'center' }}>{t.matches_played}</ThemedText>
                        
                        {league.config?.track_wins_losses && (
                            <ThemedText style={{ width: 65, textAlign: 'center', color: '#888' }}>
                                {t.wins}-{t.draws}-{t.losses}
                            </ThemedText>
                        )}

                        {league.config?.track_positions && (
                            <ThemedText style={{ width: 65, textAlign: 'center', color: '#888' }}>
                                <ThemedText style={{ color: '#FFD700' }}>{t.first_places || 0}</ThemedText>-
                                <ThemedText style={{ color: '#C0C0C0' }}>{t.second_places || 0}</ThemedText>-
                                <ThemedText style={{ color: '#CD7F32' }}>{t.third_places || 0}</ThemedText>
                            </ThemedText>
                        )}

                        {league.config?.track_score && (
                            <ThemedText style={{ width: 60, textAlign: 'center' }}>
                                {league.team_size === 0 ? t.score_for : `${t.score_for}:${t.score_against}`}
                            </ThemedText>
                        )}
                        {league.config?.track_score_diff && (
                            <ThemedText style={{ width: 50, textAlign: 'center', color: t.score_diff > 0 ? '#4CAF50' : t.score_diff < 0 ? '#F44336' : '#888' }}>
                                {t.score_diff > 0 ? '+' : ''}{t.score_diff}
                            </ThemedText>
                        )}
                        
                        {league.config?.track_elo && (
                            <ThemedText style={{ width: 60, textAlign: 'right', fontWeight: 'bold', color: '#FFD700' }}>
                                {Math.round(t.rating)}
                            </ThemedText>
                        )}
                    </View>
                ))}
                {teamStats.length === 0 && (
                    <ThemedText style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>
                        Zatím nebyly odehrány žádné týmové zápasy.
                    </ThemedText>
                )}
            </View>
        </ScrollView>
    );

    const renderMatches = () => (
        <FlatList 
            data={matches}
            keyExtractor={m => m.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: 20 }}>Zatím žádné zápasy.</ThemedText>}
            renderItem={({ item }) => {
                // Pro FFA (Bowling) seřadíme účastníky podle skóre
                const sortedParticipants = league?.team_size === 0 
                    ? [...item.league_match_participants].sort((a: any, b: any) => {
                        if (league?.config?.lower_is_better) {
                            return (a.score || 0) - (b.score || 0);
                        }
                        return (b.score || 0) - (a.score || 0);
                    })
                    : item.league_match_participants;

                return (
                    <ThemedView style={{ backgroundColor: surfaceColor, padding: 12, borderRadius: 8, marginBottom: 12 }}>
                        <ThemedText style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                            {dayjs(item.played_at).format('D. MMMM YYYY HH:mm')}
                        </ThemedText>
                        
                        {sortedParticipants.map((p: any, idx: number) => (
                            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
                                <ThemedText style={{ fontWeight: p.is_winner ? 'bold' : 'normal', color: p.is_winner ? primaryTextColor : '#888' }}>
                                    {league?.team_size === 0 ? `${p.position || idx + 1}. ` : (p.is_winner && '👑 ')} 
                                    {p.users?.username || p.users?.jmeno}
                                    {p.team && league?.team_size !== 0 ? ` (Tým ${p.team})` : ''}
                                </ThemedText>
                                <ThemedText style={{ color: p.rating_change > 0 ? '#4CAF50' : '#888' }}>
                                    {p.score !== null ? `${p.score} b ` : ''}
                                    {league?.config?.track_elo ? `(${p.rating_change > 0 ? '+' : ''}${Math.round(p.rating_change)})` : ''}
                                </ThemedText>
                            </View>
                        ))}
                    </ThemedView>
                );
            }}
        />
    );

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={{ padding: 16, paddingTop: 40, flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <ThemedText style={{ fontSize: 24 }}>←</ThemedText>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 22, fontWeight: 'bold' }}>{league.name}</ThemedText>
                    <ThemedText style={{ fontSize: 14, color: '#888' }}>
                        {league.sport} {league.team_size === 0 ? '(Všichni proti všem)' : (league.team_size > 1 ? `(Týmy ${league.team_size}v${league.team_size})` : '(1v1)')}
                    </ThemedText>
                </View>
            </View>

            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor }}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'ranking' && styles.activeTab]}
                    onPress={() => setActiveTab('ranking')}
                >
                    <ThemedText style={{ fontWeight: activeTab === 'ranking' ? 'bold' : 'normal' }}>Hráči</ThemedText>
                </TouchableOpacity>

                {league.team_size > 1 && (
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
                        onPress={() => setActiveTab('teams')}
                    >
                        <ThemedText style={{ fontWeight: activeTab === 'teams' ? 'bold' : 'normal' }}>Týmy</ThemedText>
                    </TouchableOpacity>
                )}

                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
                    onPress={() => setActiveTab('matches')}
                >
                    <ThemedText style={{ fontWeight: activeTab === 'matches' ? 'bold' : 'normal' }}>Zápasy</ThemedText>
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
                {activeTab === 'ranking' && renderRanking()}
                {activeTab === 'teams' && renderTeams()}
                {activeTab === 'matches' && renderMatches()}
            </View>

            <FAB
                icon="plus"
                label="Zapsat výsledek"
                style={{
                    position: 'absolute',
                    margin: 16,
                    right: 0,
                    bottom: 20,
                    backgroundColor: '#FF00AA',
                    borderRadius: 30,
                }}
                color="white"
                onPress={() => router.push(`/leaderboards/add_match?id=${league.id}`)}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    tab: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#FF00AA',
    }
});
