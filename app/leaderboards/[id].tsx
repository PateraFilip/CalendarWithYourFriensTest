import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import {
    fetchLeagueDetails,
    fetchLeagueLeaderboard,
    fetchLeagueMatches,
    canViewLeague,
    League,
    LeaguePlayer,
} from '@/services/leagues/leagues';
import { deleteMatch } from '@/services/leagues/recompute_league';
import { enrichPlayersFromMatches, formatLastPlayed } from '@/services/leagues/derived_stats';
import { fetchLeaguePairRatings, makePairKey } from '@/services/leagues/pair_ratings';
import { Button, ActivityIndicator, FAB, Menu } from 'react-native-paper';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';

dayjs.locale('cs');

type MatchFilter = 'all' | 'mine' | string; // string = vs user_id

export default function LeaderboardDetailScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();

    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<LeaguePlayer[]>([]);
    const [teamStats, setTeamStats] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [forbidden, setForbidden] = useState(false);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ranking' | 'teams' | 'matches'>('ranking');
    const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);

    const borderColor = useThemeColor({ light: '#ddd', dark: '#444' }, 'background');
    const surfaceColor = useThemeColor({ light: '#fff', dark: '#2A2A2A' }, 'surface');
    const primaryTextColor = useThemeColor({}, 'text');

    const [sortBy, setSortBy] = useState<
        'default' | 'matches' | 'win_ratio' | 'winrate' | 'score_diff' | 'elo' | 'avg' | 'positions' | 'form' | 'sets' | 'best' | 'last'
    >('default');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const enrichedMap = useMemo(
        () => enrichPlayersFromMatches(players, matches, league?.config, league?.config?.lower_is_better),
        [players, matches, league?.config]
    );

    const handleSort = (column: typeof sortBy) => {
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
            if (!user?.id) return;

            const allowed = await canViewLeague(leagueId, String(user.id));
            if (!allowed) {
                setForbidden(true);
                setLoading(false);
                return;
            }

            const l = await fetchLeagueDetails(leagueId);
            setLeague(l);

            const [p, m] = await Promise.all([
                fetchLeagueLeaderboard(leagueId),
                fetchLeagueMatches(leagueId),
            ]);

            setPlayers(p);
            setMatches(m);

            if (l.team_size > 1) {
                let pairRatings: Awaited<ReturnType<typeof fetchLeaguePairRatings>> = [];
                try {
                    pairRatings = await fetchLeaguePairRatings(leagueId);
                } catch (pairErr: any) {
                    console.error(pairErr);
                    Alert.alert(
                        'Párová hodnocení',
                        pairErr?.message || 'Nepodařilo se načíst hodnocení týmů.'
                    );
                }

                // Jména sestav z historie (pro páry, které mají rating)
                const namesByKey = new Map<string, string>();
                m.forEach((match) => {
                    const teamsInMatch = new Map<number, any[]>();
                    match.league_match_participants.forEach((part: any) => {
                        if (!teamsInMatch.has(part.team)) teamsInMatch.set(part.team, []);
                        teamsInMatch.get(part.team)!.push(part);
                    });
                    teamsInMatch.forEach((participants) => {
                        if (participants.length < 2) return;
                        const sortedParts = [...participants].sort((a, b) =>
                            String(a.user_id).localeCompare(String(b.user_id))
                        );
                        const teamKey = makePairKey(sortedParts.map((x) => x.user_id));
                        if (!namesByKey.has(teamKey)) {
                            namesByKey.set(
                                teamKey,
                                sortedParts
                                    .map((x) => x.users?.username || x.users?.jmeno)
                                    .join(' & ')
                            );
                        }
                    });
                });

                const teamStatsArray = pairRatings.map((row) => ({
                    id: row.pair_key,
                    names: namesByKey.get(row.pair_key) || row.pair_key.slice(0, 12) + '…',
                    matches_played: row.matches_played,
                    wins: row.wins,
                    losses: row.losses,
                    draws: row.draws,
                    score_for: row.score_for,
                    score_against: row.score_against,
                    score_diff: row.score_diff,
                    rating: row.rating,
                    last_rating_change: row.last_rating_change,
                    user_ids: row.pair_key.split('_'),
                }));

                // Fallback: pokud migrace ještě neběžela / prázdné, spočti z historie (bez pair ELO)
                if (teamStatsArray.length === 0) {
                    const teamsMap = new Map<string, any>();
                    m.forEach((match) => {
                        const teamsInMatch = new Map<number, any[]>();
                        match.league_match_participants.forEach((part: any) => {
                            if (!teamsInMatch.has(part.team)) teamsInMatch.set(part.team, []);
                            teamsInMatch.get(part.team)!.push(part);
                        });
                        teamsInMatch.forEach((participants, teamIndex) => {
                            if (participants.length < 2) return;
                            const sortedParts = [...participants].sort((a, b) =>
                                String(a.user_id).localeCompare(String(b.user_id))
                            );
                            const teamKey = makePairKey(sortedParts.map((x) => x.user_id));
                            if (!teamsMap.has(teamKey)) {
                                teamsMap.set(teamKey, {
                                    id: teamKey,
                                    names: sortedParts
                                        .map((x) => x.users?.username || x.users?.jmeno)
                                        .join(' & '),
                                    matches_played: 0,
                                    wins: 0,
                                    losses: 0,
                                    draws: 0,
                                    score_for: 0,
                                    score_against: 0,
                                    score_diff: 0,
                                    rating: l.config?.track_elo ? 1500 : 0,
                                    user_ids: sortedParts.map((x) => x.user_id),
                                });
                            }
                            const stats = teamsMap.get(teamKey)!;
                            stats.matches_played += 1;
                            const isWinner = participants[0].is_winner;
                            const matchHasWinner = match.league_match_participants.some(
                                (x: any) => x.is_winner
                            );
                            if (isWinner) stats.wins += 1;
                            else if (!matchHasWinner) stats.draws += 1;
                            else stats.losses += 1;
                            const games =
                                match.metadata?.scoring_mode === 'sets'
                                    ? match.metadata.games
                                    : null;
                            if (l.config?.track_score) {
                                if (games) {
                                    const gf = teamIndex === 1 ? games.team1 : games.team2;
                                    const ga = teamIndex === 1 ? games.team2 : games.team1;
                                    stats.score_for += gf;
                                    stats.score_against += ga;
                                    stats.score_diff += gf - ga;
                                } else {
                                    const teamScore = participants[0].score || 0;
                                    const other = match.league_match_participants.filter(
                                        (x: any) => x.team !== teamIndex
                                    );
                                    const against = other[0]?.score || 0;
                                    stats.score_for += teamScore;
                                    stats.score_against += against;
                                    stats.score_diff += teamScore - against;
                                }
                            }
                        });
                    });
                    setTeamStats(Array.from(teamsMap.values()));
                } else {
                    setTeamStats(teamStatsArray);
                }
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
        }, [id, user?.id])
    );

    const filteredMatches = useMemo(() => {
        if (matchFilter === 'all') return matches;
        if (matchFilter === 'mine' && user?.id) {
            return matches.filter((m) =>
                m.league_match_participants?.some(
                    (p: any) => String(p.user_id) === String(user.id)
                )
            );
        }
        // vs specific player
        return matches.filter((m) =>
            m.league_match_participants?.some((p: any) => String(p.user_id) === String(matchFilter))
        );
    }, [matches, matchFilter, user?.id]);

    const filterLabel = useMemo(() => {
        if (matchFilter === 'all') return 'Všechny zápasy';
        if (matchFilter === 'mine') return 'Moje zápasy';
        const p = players.find((x) => String(x.user_id) === String(matchFilter));
        return `S: ${p?.users?.username || p?.users?.jmeno || 'hráč'}`;
    }, [matchFilter, players]);

    const handleDeleteMatch = (matchId: number) => {
        Alert.alert('Smazat zápas', 'Opravdu smazat? Statistiky a ELO se přepočítají.', [
            { text: 'Zrušit', style: 'cancel' },
            {
                text: 'Smazat',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteMatch(matchId, Number(id));
                        await loadData();
                    } catch (e) {
                        console.error(e);
                        Alert.alert('Chyba', 'Zápas se nepodařilo smazat.');
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator />
            </ThemedView>
        );
    }

    if (forbidden || !league) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <ThemedText style={{ textAlign: 'center', marginBottom: 16 }}>
                    Tuto tabulku nevidíš — je jen pro přátele a přátele přátel zakladatele / hráčů.
                </ThemedText>
                <Button onPress={() => router.back()}>Zpět</Button>
            </ThemedView>
        );
    }

    const getSortedArray = (arr: any[], isTeam = false) => {
        return [...arr].sort((a, b) => {
            let valA = 0;
            let valB = 0;
            const enA = !isTeam ? enrichedMap.get(String(a.user_id)) : undefined;
            const enB = !isTeam ? enrichedMap.get(String(b.user_id)) : undefined;

            if (sortBy === 'matches') {
                valA = a.matches_played;
                valB = b.matches_played;
            } else if (sortBy === 'win_ratio' || sortBy === 'winrate') {
                valA = a.matches_played ? a.wins / a.matches_played : 0;
                valB = b.matches_played ? b.wins / b.matches_played : 0;
                if (valA === valB) {
                    valA = a.wins;
                    valB = b.wins;
                }
            } else if (sortBy === 'positions') {
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
            } else if (sortBy === 'sets') {
                valA = enA?.sets_won || 0;
                valB = enB?.sets_won || 0;
            } else if (sortBy === 'best') {
                valA = enA?.best_score ?? 0;
                valB = enB?.best_score ?? 0;
            } else if (sortBy === 'last') {
                valA = enA?.last_played ? new Date(enA.last_played).getTime() : 0;
                valB = enB?.last_played ? new Date(enB.last_played).getTime() : 0;
            } else {
                if (league?.config?.track_elo) {
                    valA = a.rating;
                    valB = b.rating;
                } else if (league?.config?.track_average) {
                    valA = a.matches_played ? a.total_score / a.matches_played : 0;
                    valB = b.matches_played ? b.total_score / b.matches_played : 0;
                } else {
                    valA = a.matches_played ? a.wins / a.matches_played : 0;
                    valB = b.matches_played ? b.wins / b.matches_played : 0;
                    if (valA === valB) {
                        valA = a.wins;
                        valB = b.wins;
                    }
                }
            }

            let isLowerBetter = false;
            if (league?.config?.lower_is_better) {
                if (sortBy === 'avg' || sortBy === 'score_diff' || sortBy === 'best') {
                    isLowerBetter = true;
                } else if (
                    sortBy === 'default' &&
                    !league?.config?.track_elo &&
                    league?.config?.track_average
                ) {
                    isLowerBetter = true;
                }
            }
            if (isLowerBetter) {
                const temp = valA;
                valA = valB;
                valB = temp;
            }

            if (valA === valB) {
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
            if (league?.config?.track_elo) isActive = column === 'elo';
            else if (league?.config?.track_average) isActive = column === 'avg';
            else if (league?.config?.track_positions) isActive = column === 'positions';
            else isActive = column === 'win_ratio';
        }

        return (
            <TouchableOpacity onPress={() => handleSort(column)} style={style}>
                <ThemedText
                    style={{
                        textAlign: style.textAlign || 'center',
                        fontWeight: 'bold',
                        color: isActive ? '#FF00AA' : primaryTextColor,
                        fontSize: 12,
                    }}
                >
                    {label} {isActive ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </ThemedText>
            </TouchableOpacity>
        );
    };

    const renderRanking = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View style={{ padding: 16, minWidth: '100%' }}>
                <View
                    style={{
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderColor,
                        paddingBottom: 8,
                        marginBottom: 8,
                        alignItems: 'flex-end',
                    }}
                >
                    <ThemedText style={{ width: 30, fontWeight: 'bold' }}>#</ThemedText>
                    <ThemedText style={{ minWidth: 110, flex: 1, fontWeight: 'bold' }}>Hráč</ThemedText>
                    <HeaderItem label="Záp" column="matches" style={{ width: 40 }} />
                    {league.config?.track_wins_losses && (
                        <HeaderItem label="V-R-P" column="win_ratio" style={{ width: 60 }} />
                    )}
                    {league.config?.track_winrate && (
                        <HeaderItem label="%" column="winrate" style={{ width: 42 }} />
                    )}
                    {league.config?.track_form && (
                        <ThemedText style={{ width: 70, textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
                            Forma
                        </ThemedText>
                    )}
                    {league.config?.track_positions && (
                        <HeaderItem label="1-2-3" column="positions" style={{ width: 60 }} />
                    )}
                    {league.config?.track_score && (
                        <ThemedText style={{ width: 58, textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
                            Skóre
                        </ThemedText>
                    )}
                    {league.config?.track_score_diff && (
                        <HeaderItem label="Rozd" column="score_diff" style={{ width: 48 }} />
                    )}
                    {league.config?.track_set_stats && (
                        <HeaderItem label="Sety" column="sets" style={{ width: 55 }} />
                    )}
                    {league.config?.track_elo && (
                        <HeaderItem label="ELO" column="elo" style={{ width: 52, textAlign: 'right' }} />
                    )}
                    {league.config?.track_average && (
                        <HeaderItem label="Prům" column="avg" style={{ width: 52, textAlign: 'right' }} />
                    )}
                    {league.config?.track_best_score && (
                        <HeaderItem label="Best" column="best" style={{ width: 48, textAlign: 'right' }} />
                    )}
                    {league.config?.track_last_played && (
                        <HeaderItem label="Posl" column="last" style={{ width: 48, textAlign: 'right' }} />
                    )}
                </View>

                {getSortedArray(players).map((p, index) => {
                    const en = enrichedMap.get(String(p.user_id));
                    return (
                        <View
                            key={p.id}
                            style={{
                                flexDirection: 'row',
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderColor,
                                alignItems: 'center',
                            }}
                        >
                            <ThemedText
                                style={{
                                    width: 30,
                                    fontWeight: 'bold',
                                    color:
                                        index === 0
                                            ? '#FFD700'
                                            : index === 1
                                              ? '#C0C0C0'
                                              : index === 2
                                                ? '#CD7F32'
                                                : primaryTextColor,
                                }}
                            >
                                {index + 1}.
                            </ThemedText>
                            <ThemedText style={{ minWidth: 110, flex: 1 }} numberOfLines={1}>
                                {p.users?.username || p.users?.jmeno}
                            </ThemedText>
                            <ThemedText style={{ width: 40, textAlign: 'center' }}>{p.matches_played}</ThemedText>

                            {league.config?.track_wins_losses && (
                                <ThemedText style={{ width: 60, textAlign: 'center', color: '#888', fontSize: 12 }}>
                                    {p.wins}-{p.draws}-{p.losses}
                                </ThemedText>
                            )}
                            {league.config?.track_winrate && (
                                <ThemedText style={{ width: 42, textAlign: 'center', fontSize: 12 }}>
                                    {en?.winrate ?? 0}%
                                </ThemedText>
                            )}
                            {league.config?.track_form && (
                                <ThemedText
                                    style={{
                                        width: 70,
                                        textAlign: 'center',
                                        fontSize: 11,
                                        letterSpacing: 1,
                                        color: '#888',
                                    }}
                                >
                                    {en?.form || '—'}
                                </ThemedText>
                            )}
                            {league.config?.track_positions && (
                                <ThemedText style={{ width: 60, textAlign: 'center', color: '#888', fontSize: 12 }}>
                                    {p.first_places || 0}-{p.second_places || 0}-{p.third_places || 0}
                                </ThemedText>
                            )}
                            {league.config?.track_score && (
                                <ThemedText style={{ width: 58, textAlign: 'center', fontSize: 12 }}>
                                    {league.team_size === 0
                                        ? p.score_for
                                        : `${p.score_for}:${p.score_against}`}
                                </ThemedText>
                            )}
                            {league.config?.track_score_diff && (
                                <ThemedText
                                    style={{
                                        width: 48,
                                        textAlign: 'center',
                                        fontSize: 12,
                                        color:
                                            p.score_diff > 0
                                                ? '#4CAF50'
                                                : p.score_diff < 0
                                                  ? '#F44336'
                                                  : '#888',
                                    }}
                                >
                                    {p.score_diff > 0 ? '+' : ''}
                                    {p.score_diff}
                                </ThemedText>
                            )}
                            {league.config?.track_set_stats && (
                                <ThemedText style={{ width: 55, textAlign: 'center', fontSize: 11, color: '#888' }}>
                                    {en?.sets_won || 0}:{en?.sets_lost || 0}
                                </ThemedText>
                            )}
                            {league.config?.track_elo && (
                                <ThemedText
                                    style={{
                                        width: 52,
                                        textAlign: 'right',
                                        fontWeight: 'bold',
                                        color: '#FFD700',
                                    }}
                                >
                                    {Math.round(p.rating)}
                                </ThemedText>
                            )}
                            {league.config?.track_average && (
                                <ThemedText
                                    style={{
                                        width: 52,
                                        textAlign: 'right',
                                        fontWeight: 'bold',
                                        color: '#00E5FF',
                                    }}
                                >
                                    {p.matches_played
                                        ? (p.total_score / p.matches_played).toFixed(1)
                                        : '0.0'}
                                </ThemedText>
                            )}
                            {league.config?.track_best_score && (
                                <ThemedText style={{ width: 48, textAlign: 'right', fontSize: 12 }}>
                                    {en?.best_score ?? '—'}
                                </ThemedText>
                            )}
                            {league.config?.track_last_played && (
                                <ThemedText style={{ width: 48, textAlign: 'right', fontSize: 11, color: '#888' }}>
                                    {formatLastPlayed(en?.last_played)}
                                </ThemedText>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );

    const renderTeams = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View style={{ padding: 16, minWidth: '100%' }}>
                <ThemedText style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                    ELO sestavy je samostatný rating páru/týmu (ne průměr hráčů). Každá sestava má vlastní ELO.
                </ThemedText>
                <View
                    style={{
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderColor,
                        paddingBottom: 8,
                        marginBottom: 8,
                    }}
                >
                    <ThemedText style={{ width: 30, fontWeight: 'bold' }}>#</ThemedText>
                    <ThemedText style={{ minWidth: 160, flex: 1, fontWeight: 'bold' }}>Tým</ThemedText>
                    <HeaderItem label="Záp" column="matches" style={{ width: 45 }} />
                    {league.config?.track_wins_losses && (
                        <HeaderItem label="V-R-P" column="win_ratio" style={{ width: 65 }} />
                    )}
                    {league.config?.track_score && (
                        <ThemedText style={{ width: 60, textAlign: 'center', fontWeight: 'bold' }}>
                            Skóre
                        </ThemedText>
                    )}
                    {league.config?.track_score_diff && (
                        <HeaderItem label="Rozd" column="score_diff" style={{ width: 50 }} />
                    )}
                    {league.config?.track_elo && (
                        <HeaderItem label="ELO" column="elo" style={{ width: 60, textAlign: 'right' }} />
                    )}
                </View>

                {getSortedArray(teamStats, true).map((t, index) => (
                    <View
                        key={t.id}
                        style={{
                            flexDirection: 'row',
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderColor,
                        }}
                    >
                        <ThemedText
                            style={{
                                width: 30,
                                fontWeight: 'bold',
                                color:
                                    index === 0
                                        ? '#FFD700'
                                        : index === 1
                                          ? '#C0C0C0'
                                          : index === 2
                                            ? '#CD7F32'
                                            : primaryTextColor,
                            }}
                        >
                            {index + 1}.
                        </ThemedText>
                        <ThemedText style={{ minWidth: 160, flex: 1, fontSize: 13 }} numberOfLines={1}>
                            {t.names}
                        </ThemedText>
                        <ThemedText style={{ width: 45, textAlign: 'center' }}>{t.matches_played}</ThemedText>

                        {league.config?.track_wins_losses && (
                            <ThemedText style={{ width: 65, textAlign: 'center', color: '#888' }}>
                                {t.wins}-{t.draws}-{t.losses}
                            </ThemedText>
                        )}
                        {league.config?.track_score && (
                            <ThemedText style={{ width: 60, textAlign: 'center' }}>
                                {`${t.score_for}:${t.score_against}`}
                            </ThemedText>
                        )}
                        {league.config?.track_score_diff && (
                            <ThemedText
                                style={{
                                    width: 50,
                                    textAlign: 'center',
                                    color:
                                        t.score_diff > 0
                                            ? '#4CAF50'
                                            : t.score_diff < 0
                                              ? '#F44336'
                                              : '#888',
                                }}
                            >
                                {t.score_diff > 0 ? '+' : ''}
                                {t.score_diff}
                            </ThemedText>
                        )}
                        {league.config?.track_elo && (
                            <View style={{ width: 70, alignItems: 'flex-end' }}>
                                <ThemedText style={{ fontWeight: 'bold', color: '#FFD700' }}>
                                    {Math.round(t.rating)}
                                </ThemedText>
                                {typeof t.last_rating_change === 'number' && t.matches_played > 0 && (
                                    <ThemedText
                                        style={{
                                            fontSize: 10,
                                            color: t.last_rating_change > 0 ? '#4CAF50' : '#888',
                                        }}
                                    >
                                        {t.last_rating_change > 0 ? '+' : ''}
                                        {Math.round(t.last_rating_change)}
                                    </ThemedText>
                                )}
                            </View>
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
        <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <Menu
                    visible={filterMenuOpen}
                    onDismiss={() => setFilterMenuOpen(false)}
                    anchor={
                        <Button
                            mode="outlined"
                            onPress={() => setFilterMenuOpen(true)}
                            icon="filter"
                            textColor={primaryTextColor}
                            style={{ borderColor }}
                        >
                            {filterLabel}
                        </Button>
                    }
                >
                    <Menu.Item
                        onPress={() => {
                            setMatchFilter('all');
                            setFilterMenuOpen(false);
                        }}
                        title="Všechny zápasy"
                    />
                    <Menu.Item
                        onPress={() => {
                            setMatchFilter('mine');
                            setFilterMenuOpen(false);
                        }}
                        title="Moje zápasy"
                    />
                    {players
                        .filter((p) => String(p.user_id) !== String(user?.id))
                        .map((p) => (
                            <Menu.Item
                                key={p.user_id}
                                onPress={() => {
                                    setMatchFilter(String(p.user_id));
                                    setFilterMenuOpen(false);
                                }}
                                title={`Zápasy: ${p.users?.username || p.users?.jmeno}`}
                            />
                        ))}
                </Menu>
            </View>

            <FlatList
                data={filteredMatches}
                keyExtractor={(m) => m.id.toString()}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListEmptyComponent={
                    <ThemedText style={{ textAlign: 'center', marginTop: 20 }}>
                        Žádné zápasy v tomto filtru.
                    </ThemedText>
                }
                renderItem={({ item }) => {
                    const sortedParticipants =
                        league?.team_size === 0
                            ? [...item.league_match_participants].sort((a: any, b: any) => {
                                  if (league?.config?.lower_is_better) {
                                      return (a.score || 0) - (b.score || 0);
                                  }
                                  return (b.score || 0) - (a.score || 0);
                              })
                            : item.league_match_participants;

                    const setsMeta =
                        item.metadata?.scoring_mode === 'sets' ? item.metadata : null;
                    const setsLabel = setsMeta?.sets?.length
                        ? setsMeta.sets.map((s: any) => `${s.team1}:${s.team2}`).join(', ')
                        : null;

                    return (
                        <ThemedView
                            style={{
                                backgroundColor: surfaceColor,
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 12,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                }}
                            >
                                <ThemedText style={{ fontSize: 12, color: '#888' }}>
                                    {dayjs(item.played_at).format('D. MMMM YYYY HH:mm')}
                                </ThemedText>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <Button
                                        compact
                                        mode="text"
                                        onPress={() =>
                                            router.push(
                                                `/leaderboards/add_match?id=${league.id}&matchId=${item.id}`
                                            )
                                        }
                                        textColor="#00E5FF"
                                    >
                                        Upravit
                                    </Button>
                                    <Button
                                        compact
                                        mode="text"
                                        onPress={() => handleDeleteMatch(item.id)}
                                        textColor="#F44336"
                                    >
                                        Smazat
                                    </Button>
                                </View>
                            </View>

                            {setsLabel && (
                                <ThemedText
                                    style={{ fontSize: 13, marginBottom: 6, color: primaryTextColor }}
                                >
                                    Sety {setsMeta.sets_won?.team1 ?? '?'}:
                                    {setsMeta.sets_won?.team2 ?? '?'}
                                    {'  ·  '}
                                    {setsLabel}
                                    {setsMeta.games
                                        ? `  ·  Gamy ${setsMeta.games.team1}:${setsMeta.games.team2}`
                                        : ''}
                                </ThemedText>
                            )}

                            {sortedParticipants.map((p: any, idx: number) => (
                                <View
                                    key={p.id}
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        marginVertical: 2,
                                    }}
                                >
                                    <ThemedText
                                        style={{
                                            fontWeight: p.is_winner ? 'bold' : 'normal',
                                            color: p.is_winner ? primaryTextColor : '#888',
                                        }}
                                    >
                                        {league?.team_size === 0
                                            ? `${p.position || idx + 1}. `
                                            : p.is_winner
                                              ? '👑 '
                                              : ''}
                                        {p.users?.username || p.users?.jmeno}
                                        {p.team && league?.team_size !== 0
                                            ? ` (Tým ${p.team})`
                                            : ''}
                                    </ThemedText>
                                    <ThemedText
                                        style={{
                                            color: p.rating_change > 0 ? '#4CAF50' : '#888',
                                        }}
                                    >
                                        {p.score !== null
                                            ? `${p.score}${setsMeta ? ' set' : ' b'} `
                                            : ''}
                                        {league?.config?.track_elo
                                            ? `(${p.rating_change > 0 ? '+' : ''}${Math.round(p.rating_change)})`
                                            : ''}
                                    </ThemedText>
                                </View>
                            ))}
                        </ThemedView>
                    );
                }}
            />
        </View>
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
                        {league.team_size === 0
                            ? '(Všichni proti všem)'
                            : league.team_size > 1
                              ? `(Týmy ${league.team_size}v${league.team_size})`
                              : '(1v1)'}
                    </ThemedText>
                </View>
            </View>

            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor }}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'ranking' && styles.activeTab]}
                    onPress={() => setActiveTab('ranking')}
                >
                    <ThemedText style={{ fontWeight: activeTab === 'ranking' ? 'bold' : 'normal' }}>
                        Hráči
                    </ThemedText>
                </TouchableOpacity>

                {league.team_size > 1 && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
                        onPress={() => setActiveTab('teams')}
                    >
                        <ThemedText style={{ fontWeight: activeTab === 'teams' ? 'bold' : 'normal' }}>
                            Týmy
                        </ThemedText>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
                    onPress={() => setActiveTab('matches')}
                >
                    <ThemedText style={{ fontWeight: activeTab === 'matches' ? 'bold' : 'normal' }}>
                        Zápasy
                    </ThemedText>
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
    },
});
