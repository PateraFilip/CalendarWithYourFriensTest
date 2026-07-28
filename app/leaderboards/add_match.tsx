import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    ScrollView,
    Pressable,
    StyleSheet,
    TextInput as RNTextInput,
    ActivityIndicator as RNActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { FormChip } from '@/components/formUi';
import { BackButton } from '@/components/BackButton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { useAppDataOptional } from '@/contexts/AppDataContext';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import {
    fetchLeagueDetails,
    fetchLeagueLeaderboard,
    fetchNetworkIds,
    League,
} from '@/services/leagues/leagues';
import { fetchUsers } from '@/services/users/get_users';
import { submitMatch, SubmitMatchData } from '@/services/leagues/submit_match';
import { buildSetsMetadata, summarizeSets } from '@/services/leagues/match_sets';
import { supabase } from '@/lib/supabaseClient';
import { showAlert, showAlertThen } from '@/lib/alert';
import { safeGoBack } from '@/lib/navigation';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type SetRow = { team1: string; team2: string };

type PlayerOption = {
    user_id: string;
    name: string;
    jmeno?: string | null;
    prijmeni?: string | null;
    username?: string | null;
    inLeague: boolean;
};

const TEAM1 = Brand.primary;
const TEAM2 = '#00BCD4';

function playerInitials(p: {
    jmeno?: string | null;
    prijmeni?: string | null;
    username?: string | null;
    name?: string;
}): string {
    const a = (p.jmeno || '').trim().charAt(0);
    const b = (p.prijmeni || '').trim().charAt(0);
    if (a || b) return `${a}${b}`.toUpperCase();
    return (p.username || p.name || '?').slice(0, 2).toUpperCase();
}

export default function AddMatchScreen() {
    const { id, matchId } = useLocalSearchParams();
    const { user } = useAuth();
    const editingMatchId = matchId ? Number(matchId) : null;
    const scheme = useColorScheme() ?? 'light';
    const surfaces = BrandSurfaces[scheme];
    const appData = useAppDataOptional();
    const colors = appData?.colors ?? [];

    const chipInactive = scheme === 'dark' ? '#E8EAED' : '#3c4043';
    const chipInactiveBorder = scheme === 'dark' ? '#BDC1C6' : '#80868b';

    const [league, setLeague] = useState<League | null>(null);
    const [players, setPlayers] = useState<PlayerOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [team1Players, setTeam1Players] = useState<string[]>([]);
    const [team2Players, setTeam2Players] = useState<string[]>([]);
    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');
    const [winner, setWinner] = useState<1 | 2 | 0 | null>(null);

    const [useSets, setUseSets] = useState(false);
    const [sets, setSets] = useState<SetRow[]>([{ team1: '', team2: '' }]);

    const [ffaParticipants, setFfaParticipants] = useState<
        { user_id: string; score: string }[]
    >([]);

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
                const allCandidates: PlayerOption[] = u
                    .filter((usr: any) => networkSet.has(String(usr.id)))
                    .map((usr: any) => {
                        const inLeague = p.some(
                            (player) =>
                                String(player.user_id) === String(usr.id)
                        );
                        return {
                            user_id: String(usr.id),
                            name: usr.username || usr.jmeno || 'Neznámý',
                            jmeno: usr.jmeno,
                            prijmeni: usr.prijmeni,
                            username: usr.username,
                            inLeague,
                        };
                    });

                allCandidates.sort((a, b) =>
                    a.inLeague === b.inLeague ? 0 : a.inLeague ? -1 : 1
                );
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
                            const t1 = parts
                                .filter((p: any) => Number(p.team) === 1)
                                .map((p: any) => String(p.user_id));
                            const t2 = parts
                                .filter((p: any) => Number(p.team) === 2)
                                .map((p: any) => String(p.user_id));
                            setTeam1Players(t1);
                            setTeam2Players(t2);
                            const s1 = parts.find(
                                (p: any) => Number(p.team) === 1
                            )?.score;
                            const s2 = parts.find(
                                (p: any) => Number(p.team) === 2
                            )?.score;
                            setTeam1Score(s1 != null ? String(s1) : '');
                            setTeam2Score(s2 != null ? String(s2) : '');
                            if (
                                match.metadata?.scoring_mode === 'sets' &&
                                match.metadata.sets?.length
                            ) {
                                setUseSets(true);
                                setSets(
                                    match.metadata.sets.map((s: any) => ({
                                        team1: String(s.team1),
                                        team2: String(s.team2),
                                    }))
                                );
                            }
                            const t1Win = parts.some(
                                (p: any) =>
                                    Number(p.team) === 1 && p.is_winner
                            );
                            const t2Win = parts.some(
                                (p: any) =>
                                    Number(p.team) === 2 && p.is_winner
                            );
                            if (t1Win) setWinner(1);
                            else if (t2Win) setWinner(2);
                            else setWinner(0);
                        }
                    }
                } else {
                    const preferSets =
                        !!l.config?.track_score &&
                        !!l.config?.track_set_stats &&
                        l.team_size !== 0;
                    setUseSets(preferSets);
                    if (preferSets) setSets([{ team1: '', team2: '' }]);
                }
            } catch (e) {
                console.error(e);
                showAlert('Chyba', 'Nepodařilo se načíst data.');
            } finally {
                setLoading(false);
            }
        }
        if (user?.id) load();
    }, [id, user?.id, editingMatchId]);

    const setsSummary = useMemo(() => {
        const parsed = sets
            .map((s) => ({
                team1: parseInt(s.team1, 10),
                team2: parseInt(s.team2, 10),
            }))
            .filter((s) => !Number.isNaN(s.team1) && !Number.isNaN(s.team2));
        return summarizeSets(parsed);
    }, [sets]);

    const handlePlayerToggle = (userId: string, team: 1 | 2) => {
        if (team === 1) {
            if (team1Players.includes(userId))
                setTeam1Players((p) => p.filter((id) => id !== userId));
            else if (team1Players.length < (league?.team_size || 99)) {
                setTeam1Players((p) => [...p, userId]);
                setTeam2Players((p) => p.filter((id) => id !== userId));
            }
        } else {
            if (team2Players.includes(userId))
                setTeam2Players((p) => p.filter((id) => id !== userId));
            else if (team2Players.length < (league?.team_size || 99)) {
                setTeam2Players((p) => [...p, userId]);
                setTeam1Players((p) => p.filter((id) => id !== userId));
            }
        }
    };

    const handleFfaToggle = (userId: string) => {
        const exists = ffaParticipants.find((p) => p.user_id === userId);
        if (exists) {
            setFfaParticipants((p) => p.filter((x) => x.user_id !== userId));
        } else {
            setFfaParticipants((p) => [
                ...p,
                { user_id: userId, score: '' },
            ]);
        }
    };

    const updateFfaScore = (userId: string, score: string) => {
        setFfaParticipants((p) =>
            p.map((x) => (x.user_id === userId ? { ...x, score } : x))
        );
    };

    const updateSet = (
        index: number,
        side: 'team1' | 'team2',
        value: string
    ) => {
        setSets((prev) =>
            prev.map((row, i) =>
                i === index ? { ...row, [side]: value } : row
            )
        );
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
                    showAlert(
                        'Pozor',
                        'Oba týmy musí mít alespoň jednoho hráče!'
                    );
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
                        .map((s) => ({
                            team1: parseInt(s.team1, 10),
                            team2: parseInt(s.team2, 10),
                        }))
                        .filter(
                            (s) =>
                                !Number.isNaN(s.team1) &&
                                !Number.isNaN(s.team2)
                        );

                    if (parsedSets.length === 0) {
                        showAlert('Pozor', 'Zadejte alespoň jeden set.');
                        setSubmitting(false);
                        return;
                    }
                    if (parsedSets.some((s) => s.team1 === s.team2)) {
                        showAlert(
                            'Pozor',
                            'Set nemůže skončit remízou — upravte gamy.'
                        );
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
                } else if (
                    league.config?.track_score &&
                    team1Score !== '' &&
                    team2Score !== ''
                ) {
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
                    {
                        team_index: 1,
                        user_ids: team1Players,
                        score: s1,
                        is_winner: t1Wins,
                        is_draw: isDraw,
                    },
                    {
                        team_index: 2,
                        user_ids: team2Players,
                        score: s2,
                        is_winner: t2Wins,
                        is_draw: isDraw,
                    },
                ];
            } else {
                if (ffaParticipants.length < 1) {
                    showAlert('Pozor', 'Vyberte alespoň jednoho účastníka.');
                    setSubmitting(false);
                    return;
                }

                let bestScore = league.config?.lower_is_better
                    ? Infinity
                    : -Infinity;
                if (
                    league.config?.track_score ||
                    league.config?.track_average
                ) {
                    if (league.config?.lower_is_better) {
                        bestScore = Math.min(
                            ...ffaParticipants.map((p) => parseInt(p.score) || 0)
                        );
                    } else {
                        bestScore = Math.max(
                            ...ffaParticipants.map((p) => parseInt(p.score) || 0)
                        );
                    }
                }

                data.teams = ffaParticipants.map((p, idx) => {
                    const sc = parseInt(p.score) || 0;
                    const win =
                        league.config?.track_score ||
                        league.config?.track_average
                            ? sc === bestScore
                            : false;
                    return {
                        team_index: idx + 1,
                        user_ids: [p.user_id],
                        score: sc,
                        is_winner: win,
                        is_draw: false,
                    };
                });
            }

            await submitMatch(data);
            showAlertThen(
                'Úspěch',
                editingMatchId ? 'Zápas byl upraven.' : 'Výsledek byl zapsán!',
                () =>
                    safeGoBack(
                        router,
                        `/leaderboards/${id}` as `/leaderboards/${string}`
                    )
            );
        } catch (e: any) {
            console.error(e);
            const msg =
                e?.message ||
                e?.error_description ||
                e?.details ||
                'Nepodařilo se uložit výsledek.';
            showAlert('Chyba', String(msg));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !league) {
        return (
            <ThemedSafeView
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: surfaces.background,
                }}
            >
                <Stack.Screen options={{ headerShown: false }} />
                <RNActivityIndicator size="large" color={Brand.primary} />
            </ThemedSafeView>
        );
    }

    const isFfa = league.team_size === 0;
    const canUseSets = !isFfa && !!league.config?.track_score;

    const colorForUser = (userId: string) =>
        colors.find((c: any) => String(c.user_id) === String(userId));

    const renderPlayerRow = (
        p: PlayerOption,
        selected: boolean,
        accent: string,
        onPress: () => void
    ) => {
        const color = colorForUser(p.user_id);
        const bg = color?.background_color || Brand.primary;
        const fg = color?.text_color || Brand.onPrimary;
        return (
            <Pressable
                key={p.user_id}
                onPress={onPress}
                style={[
                    styles.playerRow,
                    { borderBottomColor: surfaces.border },
                ]}
            >
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                    <ThemedText style={[styles.avatarText, { color: fg }]}>
                        {playerInitials(p)}
                    </ThemedText>
                </View>
                <ThemedText
                    style={{
                        flex: 1,
                        fontWeight: selected ? '700' : '500',
                        color: p.inLeague
                            ? surfaces.text
                            : surfaces.textSecondary,
                    }}
                    numberOfLines={1}
                >
                    {p.name}
                </ThemedText>
                <MaterialCommunityIcons
                    name={
                        selected
                            ? 'checkbox-marked'
                            : 'checkbox-blank-outline'
                    }
                    size={22}
                    color={selected ? accent : surfaces.textSecondary}
                />
            </Pressable>
        );
    };

    return (
        <ThemedSafeView
            style={{ flex: 1, backgroundColor: surfaces.background }}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.topBar}>
                    <BackButton
                        fallbackHref={
                            `/leaderboards/${id}` as `/leaderboards/${string}`
                        }
                        color={surfaces.text}
                        style={styles.backBtn}
                    />
                    <ThemedText
                        style={[styles.title, { color: surfaces.text }]}
                    >
                        {editingMatchId
                            ? 'Upravit zápas'
                            : 'Zapsat výsledek'}
                    </ThemedText>
                </View>
                <ThemedText
                    style={[
                        styles.subtitle,
                        { color: surfaces.textSecondary },
                    ]}
                >
                    Zobrazují se jen lidé z tvé sítě (přátelé a přátelé
                    přátel).
                </ThemedText>

                {!isFfa && (
                    <View style={styles.teamsRow}>
                        <View
                            style={[
                                styles.teamCol,
                                {
                                    backgroundColor: surfaces.surface,
                                    borderColor: surfaces.border,
                                },
                            ]}
                        >
                            <View style={styles.teamHeader}>
                                <View
                                    style={[
                                        styles.teamBar,
                                        { backgroundColor: TEAM1 },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.teamTitle,
                                        { color: TEAM1 },
                                    ]}
                                >
                                    Tým 1
                                </ThemedText>
                                <ThemedText
                                    style={{
                                        color: surfaces.textSecondary,
                                        fontSize: 12,
                                        fontWeight: '600',
                                    }}
                                >
                                    {team1Players.length}/
                                    {league.team_size}
                                </ThemedText>
                            </View>
                            {players.map((p) =>
                                renderPlayerRow(
                                    p,
                                    team1Players.includes(p.user_id),
                                    TEAM1,
                                    () => handlePlayerToggle(p.user_id, 1)
                                )
                            )}
                        </View>

                        <View
                            style={[
                                styles.teamCol,
                                {
                                    backgroundColor: surfaces.surface,
                                    borderColor: surfaces.border,
                                },
                            ]}
                        >
                            <View style={styles.teamHeader}>
                                <View
                                    style={[
                                        styles.teamBar,
                                        { backgroundColor: TEAM2 },
                                    ]}
                                />
                                <ThemedText
                                    style={[
                                        styles.teamTitle,
                                        { color: TEAM2 },
                                    ]}
                                >
                                    Tým 2
                                </ThemedText>
                                <ThemedText
                                    style={{
                                        color: surfaces.textSecondary,
                                        fontSize: 12,
                                        fontWeight: '600',
                                    }}
                                >
                                    {team2Players.length}/
                                    {league.team_size}
                                </ThemedText>
                            </View>
                            {players.map((p) =>
                                renderPlayerRow(
                                    p,
                                    team2Players.includes(p.user_id),
                                    TEAM2,
                                    () => handlePlayerToggle(p.user_id, 2)
                                )
                            )}
                        </View>
                    </View>
                )}

                {canUseSets && (
                    <View style={styles.section}>
                        <ThemedText
                            style={[
                                styles.sectionLabel,
                                { color: surfaces.textSecondary },
                            ]}
                        >
                            Režim skóre
                        </ThemedText>
                        <View style={styles.chipRow}>
                            <FormChip
                                label="Skóre"
                                active={!useSets}
                                onPress={() => setUseSets(false)}
                                activeColor={Brand.primary}
                                inactiveColor={chipInactive}
                                inactiveBorder={chipInactiveBorder}
                            />
                            <FormChip
                                label="Sety"
                                active={useSets}
                                onPress={() => {
                                    setUseSets(true);
                                    if (sets.length === 0)
                                        setSets([{ team1: '', team2: '' }]);
                                }}
                                activeColor={Brand.primary}
                                inactiveColor={chipInactive}
                                inactiveBorder={chipInactiveBorder}
                            />
                        </View>
                    </View>
                )}

                {canUseSets && useSets && (
                    <View
                        style={[
                            styles.scoreCard,
                            {
                                backgroundColor: surfaces.surface,
                                borderColor: surfaces.border,
                            },
                        ]}
                    >
                        {sets.map((set, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.setRow,
                                    { borderBottomColor: surfaces.border },
                                ]}
                            >
                                <ThemedText
                                    style={[
                                        styles.setLabel,
                                        { color: surfaces.textSecondary },
                                    ]}
                                >
                                    Set {index + 1}
                                </ThemedText>
                                <View style={styles.setInputs}>
                                    <RNTextInput
                                        value={set.team1}
                                        onChangeText={(v) =>
                                            updateSet(index, 'team1', v)
                                        }
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor={
                                            surfaces.textSecondary
                                        }
                                        style={[
                                            styles.setInput,
                                            {
                                                color: TEAM1,
                                                borderColor: surfaces.border,
                                                backgroundColor:
                                                    surfaces.surfaceElevated,
                                            },
                                        ]}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.setColon,
                                            { color: surfaces.textSecondary },
                                        ]}
                                    >
                                        :
                                    </ThemedText>
                                    <RNTextInput
                                        value={set.team2}
                                        onChangeText={(v) =>
                                            updateSet(index, 'team2', v)
                                        }
                                        keyboardType="number-pad"
                                        placeholder="0"
                                        placeholderTextColor={
                                            surfaces.textSecondary
                                        }
                                        style={[
                                            styles.setInput,
                                            {
                                                color: TEAM2,
                                                borderColor: surfaces.border,
                                                backgroundColor:
                                                    surfaces.surfaceElevated,
                                            },
                                        ]}
                                    />
                                </View>
                                {sets.length > 1 ? (
                                    <Pressable
                                        onPress={() =>
                                            setSets((prev) =>
                                                prev.filter(
                                                    (_, i) => i !== index
                                                )
                                            )
                                        }
                                        hitSlop={8}
                                        style={styles.setRemove}
                                    >
                                        <MaterialCommunityIcons
                                            name="close"
                                            size={18}
                                            color={Brand.danger}
                                        />
                                    </Pressable>
                                ) : (
                                    <View style={styles.setRemove} />
                                )}
                            </View>
                        ))}

                        <Pressable
                            onPress={() =>
                                setSets((prev) => [
                                    ...prev,
                                    { team1: '', team2: '' },
                                ])
                            }
                            style={[
                                styles.addSetBtn,
                                {
                                    borderColor: Brand.primary,
                                    backgroundColor: Brand.primarySoft,
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="plus"
                                size={18}
                                color={Brand.primary}
                            />
                            <ThemedText
                                style={{
                                    color: Brand.primary,
                                    fontWeight: '700',
                                    fontSize: 13,
                                }}
                            >
                                Přidat set
                            </ThemedText>
                        </Pressable>

                        <View style={styles.summaryRow}>
                            <ThemedText
                                style={[
                                    styles.summaryMain,
                                    { color: surfaces.text },
                                ]}
                            >
                                Sety {setsSummary.sets_won.team1}:
                                {setsSummary.sets_won.team2}
                            </ThemedText>
                            <ThemedText
                                style={{
                                    color: surfaces.textSecondary,
                                    fontWeight: '600',
                                }}
                            >
                                Gamy {setsSummary.games.team1}:
                                {setsSummary.games.team2}
                            </ThemedText>
                        </View>
                    </View>
                )}

                {!isFfa && league.config?.track_score && !useSets && (
                    <View
                        style={[
                            styles.scoreCard,
                            {
                                backgroundColor: surfaces.surface,
                                borderColor: surfaces.border,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.simpleScoreRow,
                                { borderBottomColor: surfaces.border },
                            ]}
                        >
                            <View
                                style={[
                                    styles.teamBar,
                                    { backgroundColor: TEAM1 },
                                ]}
                            />
                            <View style={{ flex: 1 }}>
                                <ThemedText
                                    style={{
                                        color: surfaces.textSecondary,
                                        fontSize: 12,
                                        fontWeight: '500',
                                    }}
                                >
                                    Tým 1
                                </ThemedText>
                                <RNTextInput
                                    value={team1Score}
                                    onChangeText={setTeam1Score}
                                    keyboardType="number-pad"
                                    placeholder="Skóre"
                                    placeholderTextColor={
                                        surfaces.textSecondary
                                    }
                                    style={[
                                        styles.simpleScoreInput,
                                        { color: surfaces.text },
                                    ]}
                                />
                            </View>
                        </View>
                        <View style={styles.simpleScoreRow}>
                            <View
                                style={[
                                    styles.teamBar,
                                    { backgroundColor: TEAM2 },
                                ]}
                            />
                            <View style={{ flex: 1 }}>
                                <ThemedText
                                    style={{
                                        color: surfaces.textSecondary,
                                        fontSize: 12,
                                        fontWeight: '500',
                                    }}
                                >
                                    Tým 2
                                </ThemedText>
                                <RNTextInput
                                    value={team2Score}
                                    onChangeText={setTeam2Score}
                                    keyboardType="number-pad"
                                    placeholder="Skóre"
                                    placeholderTextColor={
                                        surfaces.textSecondary
                                    }
                                    style={[
                                        styles.simpleScoreInput,
                                        { color: surfaces.text },
                                    ]}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {isFfa && (
                    <View
                        style={[
                            styles.scoreCard,
                            {
                                backgroundColor: surfaces.surface,
                                borderColor: surfaces.border,
                            },
                        ]}
                    >
                        <ThemedText
                            style={[
                                styles.sectionLabel,
                                {
                                    color: surfaces.textSecondary,
                                    marginBottom: 8,
                                },
                            ]}
                        >
                            Vyberte hráče a zadejte výsledky
                        </ThemedText>
                        {players.map((p) => {
                            const isSelected = !!ffaParticipants.find(
                                (x) => x.user_id === p.user_id
                            );
                            const color = colorForUser(p.user_id);
                            const bg =
                                color?.background_color || Brand.primary;
                            const fg =
                                color?.text_color || Brand.onPrimary;
                            return (
                                <View
                                    key={p.user_id}
                                    style={[
                                        styles.ffaRow,
                                        {
                                            borderBottomColor:
                                                surfaces.border,
                                        },
                                    ]}
                                >
                                    <Pressable
                                        onPress={() =>
                                            handleFfaToggle(p.user_id)
                                        }
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.avatar,
                                                { backgroundColor: bg },
                                            ]}
                                        >
                                            <ThemedText
                                                style={[
                                                    styles.avatarText,
                                                    { color: fg },
                                                ]}
                                            >
                                                {playerInitials(p)}
                                            </ThemedText>
                                        </View>
                                        <ThemedText
                                            style={{
                                                flex: 1,
                                                fontWeight: isSelected
                                                    ? '700'
                                                    : '500',
                                                color: p.inLeague
                                                    ? surfaces.text
                                                    : surfaces.textSecondary,
                                            }}
                                            numberOfLines={1}
                                        >
                                            {p.name}
                                        </ThemedText>
                                        <MaterialCommunityIcons
                                            name={
                                                isSelected
                                                    ? 'checkbox-marked'
                                                    : 'checkbox-blank-outline'
                                            }
                                            size={22}
                                            color={
                                                isSelected
                                                    ? Brand.primary
                                                    : surfaces.textSecondary
                                            }
                                        />
                                    </Pressable>
                                    {isSelected &&
                                        (league.config?.track_score ||
                                            league.config
                                                ?.track_average) && (
                                            <RNTextInput
                                                value={
                                                    ffaParticipants.find(
                                                        (x) =>
                                                            x.user_id ===
                                                            p.user_id
                                                    )?.score || ''
                                                }
                                                onChangeText={(val) =>
                                                    updateFfaScore(
                                                        p.user_id,
                                                        val
                                                    )
                                                }
                                                keyboardType="number-pad"
                                                placeholder="0"
                                                placeholderTextColor={
                                                    surfaces.textSecondary
                                                }
                                                style={[
                                                    styles.ffaScoreInput,
                                                    {
                                                        color: surfaces.text,
                                                        borderColor:
                                                            surfaces.border,
                                                        backgroundColor:
                                                            surfaces.surfaceElevated,
                                                    },
                                                ]}
                                            />
                                        )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {!isFfa &&
                    !league.config?.track_score &&
                    league.config?.track_wins_losses && (
                        <View style={styles.section}>
                            <ThemedText
                                style={[
                                    styles.sectionLabel,
                                    { color: surfaces.textSecondary },
                                ]}
                            >
                                Kdo vyhrál?
                            </ThemedText>
                            <View style={styles.chipRow}>
                                <FormChip
                                    label="Tým 1"
                                    active={winner === 1}
                                    onPress={() => setWinner(1)}
                                    activeColor={TEAM1}
                                    inactiveColor={chipInactive}
                                    inactiveBorder={chipInactiveBorder}
                                />
                                <FormChip
                                    label="Tým 2"
                                    active={winner === 2}
                                    onPress={() => setWinner(2)}
                                    activeColor={TEAM2}
                                    inactiveColor={chipInactive}
                                    inactiveBorder={chipInactiveBorder}
                                />
                                <FormChip
                                    label="Remíza"
                                    active={winner === 0}
                                    onPress={() => setWinner(0)}
                                    activeColor="#666"
                                    inactiveColor={chipInactive}
                                    inactiveBorder={chipInactiveBorder}
                                />
                            </View>
                        </View>
                    )}

                <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [
                        styles.saveBtn,
                        {
                            backgroundColor: submitting
                                ? '#9AA0A6'
                                : Brand.primary,
                            opacity: pressed && !submitting ? 0.9 : 1,
                        },
                    ]}
                >
                    {submitting ? (
                        <RNActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.saveBtnText}>
                            {editingMatchId
                                ? 'Uložit změny'
                                : 'Uložit výsledek'}
                        </ThemedText>
                    )}
                </Pressable>

                <Pressable
                    onPress={() =>
                        safeGoBack(
                            router,
                            `/leaderboards/${id}` as `/leaderboards/${string}`
                        )
                    }
                    disabled={submitting}
                    style={styles.cancelBtn}
                >
                    <ThemedText
                        style={{
                            color: surfaces.textSecondary,
                            fontWeight: '600',
                        }}
                    >
                        Zrušit
                    </ThemedText>
                </Pressable>
            </ScrollView>
        </ThemedSafeView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        paddingHorizontal: 16,
        paddingBottom: 48,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
        minHeight: 44,
    },
    backBtn: {
        padding: 4,
        marginLeft: -4,
    },
    title: {
        flex: 1,
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 13,
        marginBottom: 20,
        lineHeight: 18,
        marginLeft: 2,
    },
    teamsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    teamCol: {
        flex: 1,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        paddingBottom: 4,
    },
    teamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingTop: 12,
        paddingBottom: 8,
    },
    teamBar: {
        width: 4,
        borderRadius: 2,
        alignSelf: 'stretch',
        minHeight: 18,
    },
    teamTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '800',
    },
    section: {
        marginTop: 20,
        gap: 10,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    scoreCard: {
        marginTop: 16,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        gap: 4,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 8,
        width: '100%',
        minWidth: 0,
    },
    setLabel: {
        width: 52,
        flexShrink: 0,
        fontSize: 13,
        fontWeight: '600',
    },
    setInputs: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minWidth: 0,
    },
    setInput: {
        width: 72,
        flexShrink: 0,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: '800',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10,
        borderWidth: 1,
    },
    setColon: {
        fontSize: 20,
        fontWeight: '700',
        flexShrink: 0,
    },
    setRemove: {
        width: 28,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addSetBtn: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    summaryRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryMain: {
        fontSize: 16,
        fontWeight: '800',
    },
    simpleScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minWidth: 0,
        width: '100%',
    },
    simpleScoreInput: {
        fontSize: 24,
        fontWeight: '800',
        paddingVertical: 4,
        maxWidth: 160,
        width: '100%',
    },
    ffaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minWidth: 0,
        width: '100%',
    },
    ffaScoreInput: {
        width: 72,
        flexShrink: 0,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    saveBtn: {
        marginTop: 28,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
});
