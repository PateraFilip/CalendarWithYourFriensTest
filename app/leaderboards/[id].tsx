import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { LeagueCover } from '@/components/LeagueCover';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import {
    fetchLeagueDetails,
    fetchLeagueLeaderboard,
    fetchLeagueMatches,
    canViewLeague,
    updateLeagueConfig,
    League,
    LeaguePlayer,
} from '@/services/leagues/leagues';
import {
    pickLeagueImage,
    updateLeagueImageUrl,
    uploadLeagueCover,
} from '@/services/leagues/league_image';
import { deleteMatch } from '@/services/leagues/recompute_league';
import {
    buildMatchEloHistory,
    enrichPlayersFromMatches,
    formatLastPlayed,
    type EloSnap,
} from '@/services/leagues/derived_stats';
import { fetchLeaguePairRatings, makePairKey } from '@/services/leagues/pair_ratings';
import { showAlert, showConfirm } from '@/lib/alert';
import { Button, ActivityIndicator, FAB, Menu, Switch } from 'react-native-paper';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Brand, BrandSurfaces } from '@/constants/brand';

dayjs.locale('cs');

type MatchFilter = 'all' | 'mine' | string; // string = vs user_id

export default function LeaderboardDetailScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const scheme = useColorScheme() ?? 'light';
    const surfaces = BrandSurfaces[scheme];
    const insets = useSafeAreaInsets();

    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<LeaguePlayer[]>([]);
    const [teamStats, setTeamStats] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [forbidden, setForbidden] = useState(false);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ranking' | 'teams' | 'matches'>('ranking');
    const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);

    const borderColor = surfaces.border;
    const primaryTextColor = surfaces.text;

    const [sortBy, setSortBy] = useState<
        'default' | 'matches' | 'win_ratio' | 'winrate' | 'score_diff' | 'elo' | 'avg' | 'positions' | 'form' | 'sets' | 'best' | 'last'
    >('default');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [uploadingCover, setUploadingCover] = useState(false);
    const [savingSetsConfig, setSavingSetsConfig] = useState(false);

    const isCreator = String(league?.created_by) === String(user?.id);

    const handleToggleSetsDefault = async (value: boolean) => {
        if (!league || !isCreator || savingSetsConfig) return;
        setSavingSetsConfig(true);
        try {
            const updated = await updateLeagueConfig(league.id, {
                track_set_stats: value,
            });
            setLeague(updated);
        } catch (e) {
            console.error(e);
            showAlert('Nastavení', 'Nepodařilo se uložit nastavení setů.');
        } finally {
            setSavingSetsConfig(false);
        }
    };

    const handleChangeCover = async () => {
        if (!user || !league || !isCreator || uploadingCover) return;
        const picked = await pickLeagueImage();
        if (!picked) return;
        setUploadingCover(true);
        try {
            const url = await uploadLeagueCover(String(user.id), league.id, picked);
            await updateLeagueImageUrl(league.id, url);
            setLeague({ ...league, image_url: url });
        } catch (e) {
            console.error(e);
            showAlert('Obrázek', 'Nahrání selhalo. Zkontroluj, že v Supabase běží migrace league-covers.');
        } finally {
            setUploadingCover(false);
        }
    };

    const enrichedMap = useMemo(
        () => enrichPlayersFromMatches(players, matches, league?.config, league?.config?.lower_is_better),
        [players, matches, league?.config]
    );

    const matchEloHistory = useMemo(
        () => buildMatchEloHistory(matches, league),
        [matches, league]
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
                    showAlert(
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
        showConfirm(
            'Smazat zápas',
            'Opravdu smazat? Statistiky a ELO se přepočítají.',
            async () => {
                try {
                    await deleteMatch(matchId, Number(id));
                    await loadData();
                } catch (e) {
                    console.error(e);
                    showAlert('Chyba', 'Zápas se nepodařilo smazat.');
                }
            },
            { confirmLabel: 'Smazat', destructive: true }
        );
    };

    if (loading) {
        return (
            <ThemedSafeView style={[styles.center, { backgroundColor: surfaces.background }]}>
                <ActivityIndicator color={Brand.primary} />
            </ThemedSafeView>
        );
    }

    if (forbidden || !league) {
        return (
            <ThemedSafeView style={[styles.center, { backgroundColor: surfaces.background, padding: 24 }]}>
                <MaterialCommunityIcons name="lock-outline" size={40} color={surfaces.textSecondary} />
                <ThemedText style={[styles.forbiddenText, { color: surfaces.text }]}>
                    Tuto tabulku nevidíš — je jen pro přátele a přátele přátel zakladatele / hráčů.
                </ThemedText>
                <Button mode="contained" onPress={() => router.back()} buttonColor={Brand.primary}>
                    Zpět
                </Button>
            </ThemedSafeView>
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

    const rankColor = (index: number) =>
        index === 0 ? '#E6B800' : index === 1 ? '#9AA0A6' : index === 2 ? '#C47B3A' : surfaces.textSecondary;

    const primaryMetricLabel = () => {
        if (league?.config?.track_elo) return 'ELO';
        if (league?.config?.track_average) return 'Průměr';
        if (league?.config?.track_winrate || league?.config?.track_wins_losses) return '%';
        return 'Záp';
    };

    const playerPrimaryValue = (p: any, en?: ReturnType<typeof enrichedMap.get>) => {
        if (league?.config?.track_elo) return String(Math.round(p.rating));
        if (league?.config?.track_average) {
            return p.matches_played ? (p.total_score / p.matches_played).toFixed(1) : '0.0';
        }
        if (league?.config?.track_winrate || league?.config?.track_wins_losses) {
            return `${en?.winrate ?? 0}%`;
        }
        return String(p.matches_played);
    };

    const SortChips = ({ forTeams = false }: { forTeams?: boolean }) => {
        const chips: { key: typeof sortBy; label: string }[] = [
            { key: 'default', label: 'Výchozí' },
            { key: 'matches', label: 'Zápasy' },
        ];
        if (league?.config?.track_wins_losses) chips.push({ key: 'win_ratio', label: 'V-R-P' });
        if (league?.config?.track_winrate) chips.push({ key: 'winrate', label: '%' });
        if (!forTeams && league?.config?.track_positions) chips.push({ key: 'positions', label: '1-2-3' });
        if (league?.config?.track_score_diff) chips.push({ key: 'score_diff', label: 'Rozdíl' });
        if (!forTeams && league?.config?.track_set_stats) chips.push({ key: 'sets', label: 'Sety' });
        if (league?.config?.track_elo) chips.push({ key: 'elo', label: 'ELO' });
        if (!forTeams && league?.config?.track_average) chips.push({ key: 'avg', label: 'Průměr' });
        if (!forTeams && league?.config?.track_best_score) chips.push({ key: 'best', label: 'Best' });
        if (!forTeams && league?.config?.track_last_played) chips.push({ key: 'last', label: 'Posl.' });

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortChips}
            >
                {chips.map((c) => {
                    const active = sortBy === c.key;
                    return (
                        <Pressable
                            key={c.key}
                            onPress={() => handleSort(c.key)}
                            style={[
                                styles.sortChip,
                                {
                                    backgroundColor: active ? Brand.primarySoft : surfaces.surface,
                                    borderColor: active ? Brand.primary : surfaces.border,
                                },
                            ]}
                        >
                            <ThemedText
                                style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: active ? Brand.primary : surfaces.textSecondary,
                                }}
                            >
                                {c.label}
                                {active ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </ScrollView>
        );
    };

    const StatChip = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
        <View style={[styles.statChip, { backgroundColor: surfaces.surfaceElevated }]}>
            <ThemedText style={[styles.statChipLabel, { color: surfaces.textSecondary }]}>
                {label}
            </ThemedText>
            <ThemedText style={[styles.statChipValue, { color: tone || surfaces.text }]}>
                {value}
            </ThemedText>
        </View>
    );

    const renderRanking = () => (
        <FlatList
            data={getSortedArray(players)}
            keyExtractor={(p) => String(p.id)}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listPad}
            ListHeaderComponent={
                <View style={{ marginBottom: 8 }}>
                    <SortChips />
                    <ThemedText style={[styles.metricHint, { color: surfaces.textSecondary }]}>
                        Hlavní hodnota vpravo: {primaryMetricLabel()}
                    </ThemedText>
                </View>
            }
            ListEmptyComponent={
                <ThemedText style={{ textAlign: 'center', color: surfaces.textSecondary, marginTop: 24 }}>
                    Zatím žádní hráči.
                </ThemedText>
            }
            renderItem={({ item: p, index }) => {
                const en = enrichedMap.get(String(p.user_id));
                const name = p.users?.username || p.users?.jmeno || 'Neznámý';
                const isMe = String(p.user_id) === String(user?.id);

                return (
                    <View
                        style={[
                            styles.playerCard,
                            {
                                backgroundColor: surfaces.surface,
                                borderColor: isMe ? Brand.primary : surfaces.border,
                                borderWidth: isMe ? 1.5 : StyleSheet.hairlineWidth,
                            },
                        ]}
                    >
                        <View style={styles.playerTop}>
                            <View
                                style={[
                                    styles.rankBadge,
                                    { backgroundColor: index < 3 ? Brand.primarySoft : surfaces.surfaceElevated },
                                ]}
                            >
                                <ThemedText style={[styles.rankText, { color: rankColor(index) }]}>
                                    {index + 1}
                                </ThemedText>
                            </View>
                            <View style={styles.playerIdentity}>
                                <ThemedText
                                    style={[styles.playerName, { color: surfaces.text }]}
                                    numberOfLines={1}
                                >
                                    {name}
                                    {isMe ? ' · ty' : ''}
                                </ThemedText>
                                <ThemedText style={{ color: surfaces.textSecondary, fontSize: 12 }}>
                                    {p.matches_played} zápas{p.matches_played === 1 ? '' : 'ů'}
                                    {league.config?.track_form && en?.form ? ` · ${en.form}` : ''}
                                </ThemedText>
                            </View>
                            <View style={styles.primaryMetric}>
                                <ThemedText style={[styles.primaryValue, { color: Brand.primary }]}>
                                    {playerPrimaryValue(p, en)}
                                </ThemedText>
                                <ThemedText style={[styles.primaryLabel, { color: surfaces.textSecondary }]}>
                                    {primaryMetricLabel()}
                                </ThemedText>
                            </View>
                        </View>

                        <View style={styles.statRow}>
                            {league.config?.track_wins_losses && (
                                <StatChip label="V–R–P" value={`${p.wins}-${p.draws}-${p.losses}`} />
                            )}
                            {league.config?.track_winrate && (
                                <StatChip label="Výhry" value={`${en?.winrate ?? 0}%`} />
                            )}
                            {league.config?.track_positions && (
                                <StatChip
                                    label="1–2–3"
                                    value={`${p.first_places || 0}-${p.second_places || 0}-${p.third_places || 0}`}
                                />
                            )}
                            {league.config?.track_score && (
                                <StatChip
                                    label="Skóre"
                                    value={
                                        league.team_size === 0
                                            ? String(p.score_for)
                                            : `${p.score_for}:${p.score_against}`
                                    }
                                />
                            )}
                            {league.config?.track_score_diff && (
                                <StatChip
                                    label="Rozdíl"
                                    value={`${p.score_diff > 0 ? '+' : ''}${p.score_diff}`}
                                    tone={
                                        p.score_diff > 0
                                            ? Brand.success
                                            : p.score_diff < 0
                                              ? Brand.danger
                                              : undefined
                                    }
                                />
                            )}
                            {league.config?.track_set_stats && (
                                <StatChip
                                    label="Sety"
                                    value={`${en?.sets_won || 0}:${en?.sets_lost || 0}`}
                                />
                            )}
                            {league.config?.track_elo && league.config?.track_average && (
                                <StatChip
                                    label="Průměr"
                                    value={
                                        p.matches_played
                                            ? (p.total_score / p.matches_played).toFixed(1)
                                            : '0.0'
                                    }
                                />
                            )}
                            {league.config?.track_best_score && (
                                <StatChip label="Best" value={String(en?.best_score ?? '—')} />
                            )}
                            {league.config?.track_last_played && (
                                <StatChip
                                    label="Poslední"
                                    value={formatLastPlayed(en?.last_played) || '—'}
                                />
                            )}
                            {league.config?.track_elo && !league.config?.track_average && (
                                <StatChip label="Zápasy" value={String(p.matches_played)} />
                            )}
                        </View>
                    </View>
                );
            }}
        />
    );

    const renderTeams = () => (
        <FlatList
            data={getSortedArray(teamStats, true)}
            keyExtractor={(t) => String(t.id)}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listPad}
            ListHeaderComponent={
                <View style={{ marginBottom: 8, gap: 8 }}>
                    <SortChips forTeams />
                    <ThemedText style={[styles.metricHint, { color: surfaces.textSecondary }]}>
                        ELO sestavy je rating páru/týmu, ne průměr hráčů.
                    </ThemedText>
                </View>
            }
            ListEmptyComponent={
                <ThemedText style={{ color: surfaces.textSecondary, textAlign: 'center', marginTop: 24 }}>
                    Zatím nebyly odehrány žádné týmové zápasy.
                </ThemedText>
            }
            renderItem={({ item: t, index }) => (
                <View
                    style={[
                        styles.playerCard,
                        {
                            backgroundColor: surfaces.surface,
                            borderColor: surfaces.border,
                            borderWidth: StyleSheet.hairlineWidth,
                        },
                    ]}
                >
                    <View style={styles.playerTop}>
                        <View
                            style={[
                                styles.rankBadge,
                                { backgroundColor: index < 3 ? Brand.primarySoft : surfaces.surfaceElevated },
                            ]}
                        >
                            <ThemedText style={[styles.rankText, { color: rankColor(index) }]}>
                                {index + 1}
                            </ThemedText>
                        </View>
                        <View style={styles.playerIdentity}>
                            <ThemedText
                                style={[styles.playerName, { color: surfaces.text }]}
                                numberOfLines={2}
                            >
                                {t.names}
                            </ThemedText>
                            <ThemedText style={{ color: surfaces.textSecondary, fontSize: 12 }}>
                                {t.matches_played} zápas{t.matches_played === 1 ? '' : 'ů'}
                            </ThemedText>
                        </View>
                        {league.config?.track_elo && (
                            <View style={styles.primaryMetric}>
                                <ThemedText style={[styles.primaryValue, { color: Brand.primary }]}>
                                    {Math.round(t.rating)}
                                </ThemedText>
                                <ThemedText style={[styles.primaryLabel, { color: surfaces.textSecondary }]}>
                                    ELO
                                    {typeof t.last_rating_change === 'number' && t.matches_played > 0
                                        ? ` ${t.last_rating_change > 0 ? '+' : ''}${Math.round(t.last_rating_change)}`
                                        : ''}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                    <View style={styles.statRow}>
                        {league.config?.track_wins_losses && (
                            <StatChip label="V–R–P" value={`${t.wins}-${t.draws}-${t.losses}`} />
                        )}
                        {league.config?.track_score && (
                            <StatChip label="Skóre" value={`${t.score_for}:${t.score_against}`} />
                        )}
                        {league.config?.track_score_diff && (
                            <StatChip
                                label="Rozdíl"
                                value={`${t.score_diff > 0 ? '+' : ''}${t.score_diff}`}
                                tone={
                                    t.score_diff > 0
                                        ? Brand.success
                                        : t.score_diff < 0
                                          ? Brand.danger
                                          : undefined
                                }
                            />
                        )}
                    </View>
                </View>
            )}
        />
    );

    const formatEloChange = (change: number) => {
        const rounded = Math.round(change);
        if (rounded === 0) return '±0';
        return `${rounded > 0 ? '+' : ''}${rounded}`;
    };

    const eloTone = (change: number) => {
        if (change > 0) return Brand.success;
        if (change < 0) return Brand.danger;
        return surfaces.textSecondary;
    };

    const EloBadge = ({ snap, label }: { snap?: EloSnap; label?: string }) => {
        if (!snap) return null;
        return (
            <View style={styles.eloBadge}>
                {label ? (
                    <ThemedText style={[styles.eloBadgeLabel, { color: surfaces.textSecondary }]}>
                        {label}
                    </ThemedText>
                ) : null}
                <ThemedText style={[styles.eloAfter, { color: surfaces.text }]}>
                    {Math.round(snap.after)}
                </ThemedText>
                <ThemedText style={[styles.eloDelta, { color: eloTone(snap.change) }]}>
                    {formatEloChange(snap.change)}
                </ThemedText>
            </View>
        );
    };

    const renderMatches = () => {
        const trackElo = !!league?.config?.track_elo;

        return (
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
                    contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
                    ListEmptyComponent={
                        <ThemedText
                            style={{
                                textAlign: 'center',
                                marginTop: 24,
                                color: surfaces.textSecondary,
                            }}
                        >
                            Žádné zápasy v tomto filtru.
                        </ThemedText>
                    }
                    renderItem={({ item }) => {
                        const parts = item.league_match_participants || [];
                        const eloSnap = matchEloHistory.get(Number(item.id));
                        const setsMeta =
                            item.metadata?.scoring_mode === 'sets' ? item.metadata : null;
                        const setsLabel = setsMeta?.sets?.length
                            ? setsMeta.sets.map((s: any) => `${s.team1}:${s.team2}`).join(', ')
                            : null;
                        const isFfa = league?.team_size === 0;

                        const byTeam = new Map<number, any[]>();
                        for (const p of parts) {
                            const t = Number(p.team ?? 0);
                            if (!byTeam.has(t)) byTeam.set(t, []);
                            byTeam.get(t)!.push(p);
                        }
                        const teamEntries = [...byTeam.entries()].sort(([a], [b]) => a - b);

                        const nameOf = (p: any) => p.users?.username || p.users?.jmeno || '?';

                        return (
                            <View
                                style={[
                                    styles.matchCard,
                                    {
                                        backgroundColor: surfaces.surface,
                                        borderColor: surfaces.border,
                                    },
                                ]}
                            >
                                <View style={styles.matchHeader}>
                                    <ThemedText
                                        style={{ fontSize: 12, color: surfaces.textSecondary }}
                                    >
                                        {dayjs(item.played_at).format('D. MMMM YYYY · HH:mm')}
                                    </ThemedText>
                                    <View style={styles.matchActions}>
                                        <Pressable
                                            hitSlop={8}
                                            onPress={() =>
                                                router.push(
                                                    `/leaderboards/add_match?id=${league.id}&matchId=${item.id}`
                                                )
                                            }
                                            style={styles.matchIconBtn}
                                        >
                                            <MaterialCommunityIcons
                                                name="pencil-outline"
                                                size={18}
                                                color={Brand.primary}
                                            />
                                        </Pressable>
                                        <Pressable
                                            hitSlop={8}
                                            onPress={() => handleDeleteMatch(item.id)}
                                            style={styles.matchIconBtn}
                                        >
                                            <MaterialCommunityIcons
                                                name="trash-can-outline"
                                                size={18}
                                                color={Brand.danger}
                                            />
                                        </Pressable>
                                    </View>
                                </View>

                                {setsLabel && (
                                    <View
                                        style={[
                                            styles.setsBar,
                                            { backgroundColor: surfaces.surfaceElevated },
                                        ]}
                                    >
                                        <ThemedText
                                            style={{
                                                fontSize: 12,
                                                fontWeight: '600',
                                                color: surfaces.textSecondary,
                                            }}
                                        >
                                            Sety {setsMeta.sets_won?.team1 ?? '?'}:
                                            {setsMeta.sets_won?.team2 ?? '?'}
                                            {' · '}
                                            {setsLabel}
                                            {setsMeta.games
                                                ? ` · Gamy ${setsMeta.games.team1}:${setsMeta.games.team2}`
                                                : ''}
                                        </ThemedText>
                                    </View>
                                )}

                                {isFfa ? (
                                    [...parts]
                                        .sort((a: any, b: any) => {
                                            if (league?.config?.lower_is_better) {
                                                return (a.score || 0) - (b.score || 0);
                                            }
                                            return (b.score || 0) - (a.score || 0);
                                        })
                                        .map((p: any, idx: number) => {
                                            const snap = eloSnap?.players.get(String(p.user_id));
                                            return (
                                                <View
                                                    key={p.id}
                                                    style={[
                                                        styles.ffaRow,
                                                        idx > 0 && {
                                                            borderTopWidth: StyleSheet.hairlineWidth,
                                                            borderTopColor: surfaces.border,
                                                        },
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            styles.rankBadge,
                                                            {
                                                                backgroundColor:
                                                                    idx < 3
                                                                        ? Brand.primarySoft
                                                                        : surfaces.surfaceElevated,
                                                            },
                                                        ]}
                                                    >
                                                        <ThemedText
                                                            style={[
                                                                styles.rankText,
                                                                { color: rankColor(idx) },
                                                            ]}
                                                        >
                                                            {p.position || idx + 1}
                                                        </ThemedText>
                                                    </View>
                                                    <View style={{ flex: 1, minWidth: 0 }}>
                                                        <ThemedText
                                                            style={[
                                                                styles.matchPlayerName,
                                                                {
                                                                    color: p.is_winner
                                                                        ? surfaces.text
                                                                        : surfaces.textSecondary,
                                                                    fontWeight: p.is_winner
                                                                        ? '700'
                                                                        : '500',
                                                                },
                                                            ]}
                                                            numberOfLines={1}
                                                        >
                                                            {nameOf(p)}
                                                        </ThemedText>
                                                    </View>
                                                    <ThemedText
                                                        style={[
                                                            styles.matchScore,
                                                            { color: surfaces.text },
                                                        ]}
                                                    >
                                                        {p.score !== null && p.score !== undefined
                                                            ? `${p.score}`
                                                            : '—'}
                                                    </ThemedText>
                                                    {trackElo && <EloBadge snap={snap} />}
                                                </View>
                                            );
                                        })
                                ) : (
                                    <View style={styles.vsRow}>
                                        {(() => {
                                            const left = teamEntries[0];
                                            const right = teamEntries[1];
                                            if (!left) return null;

                                            const renderSide = (
                                                entry: [number, any[]] | undefined,
                                                side: 'left' | 'right'
                                            ) => {
                                                if (!entry) return <View style={styles.vsSide} />;
                                                const [, members] = entry;
                                                const isWinner = members.some((m: any) => m.is_winner);
                                                const pairKey =
                                                    members.length >= 2
                                                        ? makePairKey(
                                                              members.map((m: any) => m.user_id)
                                                          )
                                                        : null;
                                                const pairSnap = pairKey
                                                    ? eloSnap?.pairs.get(pairKey)
                                                    : undefined;

                                                return (
                                                    <View
                                                        style={[
                                                            styles.vsSide,
                                                            {
                                                                alignItems:
                                                                    side === 'left'
                                                                        ? 'flex-start'
                                                                        : 'flex-end',
                                                            },
                                                        ]}
                                                    >
                                                        {members.map((m: any) => {
                                                            const snap = eloSnap?.players.get(
                                                                String(m.user_id)
                                                            );
                                                            return (
                                                                <View
                                                                    key={m.id}
                                                                    style={{
                                                                        alignItems:
                                                                            side === 'left'
                                                                                ? 'flex-start'
                                                                                : 'flex-end',
                                                                        gap: 2,
                                                                    }}
                                                                >
                                                                    <ThemedText
                                                                        style={[
                                                                            styles.matchPlayerName,
                                                                            {
                                                                                color: isWinner
                                                                                    ? surfaces.text
                                                                                    : surfaces.textSecondary,
                                                                                fontWeight: isWinner
                                                                                    ? '700'
                                                                                    : '500',
                                                                                textAlign:
                                                                                    side === 'left'
                                                                                        ? 'left'
                                                                                        : 'right',
                                                                            },
                                                                        ]}
                                                                        numberOfLines={1}
                                                                    >
                                                                        {nameOf(m)}
                                                                    </ThemedText>
                                                                    {trackElo && members.length === 1 && (
                                                                        <EloBadge snap={snap} />
                                                                    )}
                                                                    {trackElo &&
                                                                        members.length > 1 &&
                                                                        snap && (
                                                                            <ThemedText
                                                                                style={{
                                                                                    fontSize: 11,
                                                                                    fontWeight: '600',
                                                                                    color: eloTone(
                                                                                        snap.change
                                                                                    ),
                                                                                }}
                                                                            >
                                                                                {Math.round(snap.after)}{' '}
                                                                                {formatEloChange(
                                                                                    snap.change
                                                                                )}
                                                                            </ThemedText>
                                                                        )}
                                                                </View>
                                                            );
                                                        })}
                                                        {trackElo && pairSnap && (
                                                            <EloBadge snap={pairSnap} label="Tým" />
                                                        )}
                                                    </View>
                                                );
                                            };

                                            const leftScore = left[1]?.[0]?.score;
                                            const rightScore = right?.[1]?.[0]?.score;

                                            return (
                                                <>
                                                    {renderSide(left, 'left')}
                                                    <View style={styles.vsCenter}>
                                                        <ThemedText
                                                            style={[
                                                                styles.vsScore,
                                                                { color: surfaces.text },
                                                            ]}
                                                        >
                                                            {`${leftScore ?? '—'} — ${rightScore ?? '—'}`}
                                                        </ThemedText>
                                                    </View>
                                                    {renderSide(right, 'right')}
                                                </>
                                            );
                                        })()}
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
            </View>
        );
    };

    return (
        <ThemedSafeView style={[styles.screen, { backgroundColor: surfaces.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={surfaces.text} />
                </Pressable>

                <Pressable
                    onPress={isCreator ? handleChangeCover : undefined}
                    disabled={!isCreator || uploadingCover}
                    style={styles.coverWrap}
                >
                    <LeagueCover uri={league.image_url} size={52} mine={isCreator} />
                    {isCreator && (
                        <View style={styles.cameraBadge}>
                            <MaterialCommunityIcons name="camera" size={12} color="#fff" />
                        </View>
                    )}
                </Pressable>

                <View style={styles.headerText}>
                    <ThemedText style={[styles.leagueName, { color: surfaces.text }]} numberOfLines={1}>
                        {league.name}
                    </ThemedText>
                    <ThemedText style={{ color: surfaces.textSecondary, fontSize: 13 }} numberOfLines={1}>
                        {league.team_size === 0
                            ? 'Všichni proti všem'
                            : league.team_size > 1
                              ? `Týmy ${league.team_size}v${league.team_size}`
                              : '1v1'}
                        {isCreator ? ' · změnit obrázek' : ''}
                    </ThemedText>
                </View>
            </View>

            {isCreator &&
                !!league.config?.track_score &&
                league.team_size !== 0 && (
                    <View
                        style={[
                            styles.setsConfigRow,
                            {
                                backgroundColor: surfaces.surface,
                                borderBottomColor: surfaces.border,
                            },
                        ]}
                    >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <ThemedText
                                style={{ fontWeight: '700', fontSize: 14 }}
                            >
                                Zapisovat sety
                            </ThemedText>
                            <ThemedText
                                style={{
                                    color: surfaces.textSecondary,
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                            >
                                Výchozí zápis po setech + statistiky ve žebříčku
                            </ThemedText>
                        </View>
                        <Switch
                            value={!!league.config?.track_set_stats}
                            onValueChange={handleToggleSetsDefault}
                            disabled={savingSetsConfig}
                            color={Brand.primary}
                        />
                    </View>
                )}

            <View style={[styles.tabs, { borderBottomColor: surfaces.border, backgroundColor: surfaces.surface }]}>
                {(
                    [
                        { key: 'ranking' as const, label: 'Hráči' },
                        ...(league.team_size > 1
                            ? [{ key: 'teams' as const, label: 'Týmy' }]
                            : []),
                        { key: 'matches' as const, label: 'Zápasy' },
                    ]
                ).map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[styles.tab, active && { borderBottomColor: Brand.primary }]}
                        >
                            <ThemedText
                                style={{
                                    fontWeight: active ? '700' : '500',
                                    color: active ? Brand.primary : surfaces.textSecondary,
                                }}
                            >
                                {tab.label}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </View>

            <View style={{ flex: 1 }}>
                {activeTab === 'ranking' && renderRanking()}
                {activeTab === 'teams' && renderTeams()}
                {activeTab === 'matches' && renderMatches()}
            </View>

            <FAB
                icon="plus"
                label="Zapsat výsledek"
                style={[
                    styles.fab,
                    { bottom: Math.max(insets.bottom, 12) + 16 },
                ]}
                color={Brand.onPrimary}
                customSize={56}
                onPress={() => router.push(`/leaderboards/add_match?id=${league.id}`)}
            />
        </ThemedSafeView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    forbiddenText: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        marginHorizontal: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        gap: 10,
    },
    backBtn: { padding: 8 },
    coverWrap: { position: 'relative' },
    cameraBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Brand.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: { flex: 1, minWidth: 0, gap: 2 },
    leagueName: { fontSize: 20, fontWeight: '700' },
    setsConfigRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        backgroundColor: Brand.primary,
        borderRadius: 28,
    },
    listPad: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 130,
    },
    sortChips: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    sortChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    metricHint: {
        fontSize: 12,
        marginTop: 8,
        marginBottom: 4,
    },
    playerCard: {
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        gap: 10,
    },
    playerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        fontSize: 15,
        fontWeight: '800',
    },
    playerIdentity: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '700',
    },
    primaryMetric: {
        alignItems: 'flex-end',
        minWidth: 56,
    },
    primaryValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    primaryLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    statRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statChip: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 72,
    },
    statChipLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    statChipValue: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 1,
    },
    matchCard: {
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    matchActions: {
        flexDirection: 'row',
        gap: 4,
    },
    matchIconBtn: {
        padding: 6,
        borderRadius: 8,
    },
    setsBar: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    ffaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
    },
    vsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    vsSide: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    vsCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingTop: 2,
        minWidth: 72,
    },
    vsScore: {
        fontSize: 20,
        fontWeight: '800',
    },
    matchPlayerName: {
        fontSize: 15,
    },
    matchScore: {
        fontSize: 16,
        fontWeight: '700',
        minWidth: 28,
        textAlign: 'right',
    },
    eloBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    eloBadgeLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    eloAfter: {
        fontSize: 13,
        fontWeight: '700',
    },
    eloDelta: {
        fontSize: 12,
        fontWeight: '700',
    },
});
