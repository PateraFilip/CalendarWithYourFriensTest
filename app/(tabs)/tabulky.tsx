import { LeagueCover } from '@/components/LeagueCover';
import { EmptyState } from '@/components/EmptyState';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchMyLeagues, League } from '@/services/leagues/leagues';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, TextInput } from 'react-native-paper';

dayjs.extend(relativeTime);
dayjs.locale('cs');

function formatLabel(league: League): string {
  if (league.team_size === 0) return 'Všichni proti všem';
  return `${league.team_size}v${league.team_size}`;
}

function scoringHints(league: League): string {
  const c = league.config || {};
  const bits: string[] = [];
  if (c.track_elo) bits.push('ELO');
  if (c.track_wins_losses) bits.push('W/L');
  if (c.track_winrate) bits.push('Winrate');
  if (c.track_average) bits.push('Průměr');
  if (c.track_positions) bits.push('Umístění');
  if (bits.length === 0) return formatLabel(league);
  return `${formatLabel(league)} · ${bits.slice(0, 3).join(' · ')}`;
}

export default function TabulkyScreen() {
  const { user } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary;

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const loadLeagues = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchMyLeagues(user.id);
      const sorted = [...data].sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
      setLeagues(sorted);
    } catch (error) {
      console.error('Error loading leagues', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadLeagues();
    }, [loadLeagues])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeagues();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leagues;
    return leagues.filter((l) => l.name.toLowerCase().includes(q));
  }, [leagues, query]);

  const mine = useMemo(
    () =>
      filtered.filter((l) => String(l.created_by) === String(user?.id)),
    [filtered, user?.id]
  );
  const others = useMemo(
    () =>
      filtered.filter((l) => String(l.created_by) !== String(user?.id)),
    [filtered, user?.id]
  );

  const listData = useMemo(() => {
    const rows: (
      | { type: 'header'; title: string; count: number; key: string }
      | { type: 'league'; item: League; key: string; first: boolean; last: boolean }
    )[] = [];

    const pushGroup = (title: string, items: League[], key: string) => {
      if (items.length === 0) return;
      rows.push({ type: 'header', title, count: items.length, key: `h-${key}` });
      items.forEach((item, i) => {
        rows.push({
          type: 'league',
          item,
          key: `l-${item.id}`,
          first: i === 0,
          last: i === items.length - 1,
        });
      });
    };

    // Pokud jsou obě skupiny, rozděl; jinak jedna „Tabulky“
    if (mine.length > 0 && others.length > 0) {
      pushGroup('Moje tabulky', mine, 'mine');
      pushGroup('Ze sítě', others, 'net');
    } else if (filtered.length > 0) {
      pushGroup('Tabulky', filtered, 'all');
    }

    return rows;
  }, [mine, others, filtered]);

  const renderLeagueRow = (
    item: League,
    first: boolean,
    last: boolean
  ) => {
    const when = dayjs(item.updated_at || item.created_at);
    const isMine = String(item.created_by) === String(user?.id);

    return (
      <Pressable
        onPress={() => router.push(`/leaderboards/${item.id}`)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: surfaces.surface,
            borderBottomColor: surfaces.border,
          },
          first && styles.rowFirst,
          last && styles.rowLast,
          !last && styles.rowDivider,
          pressed && { opacity: 0.75 },
        ]}
      >
        <LeagueCover
          uri={item.image_url}
          size={64}
          mine={isMine}
        />

        <View style={styles.rowBody}>
          <ThemedText
            style={[styles.rowTitle, { color: surfaces.text }]}
            numberOfLines={1}
          >
            {item.name}
          </ThemedText>
          <ThemedText
            style={[styles.rowSub, { color: surfaces.textSecondary }]}
            numberOfLines={1}
          >
            {scoringHints(item)}
          </ThemedText>
          <ThemedText
            style={[styles.rowMeta, { color: surfaces.textSecondary }]}
            numberOfLines={1}
          >
            {when.isValid() ? `Upraveno ${when.fromNow()}` : ''}
          </ThemedText>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={surfaces.textSecondary}
        />
      </Pressable>
    );
  };

  return (
    <ThemedSafeView
      style={[styles.container, { backgroundColor: surfaces.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.title, { color: surfaces.text }]}>
              Tabulky
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: surfaces.textSecondary }]}>
              Ligy ze tvé sítě přátel
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/leaderboards/create')}
            style={[styles.createBtn, { backgroundColor: Brand.primary }]}
            accessibilityLabel="Nová tabulka"
          >
            <MaterialCommunityIcons name="plus" size={22} color={Brand.onPrimary} />
          </Pressable>
        </View>

        {leagues.length > 0 && (
          <TextInput
            mode="outlined"
            placeholder="Hledat tabulku"
            value={query}
            onChangeText={setQuery}
            left={<TextInput.Icon icon="magnify" />}
            right={
              query ? (
                <TextInput.Icon icon="close" onPress={() => setQuery('')} />
              ) : undefined
            }
            style={[styles.search, { backgroundColor: surfaces.surface }]}
            outlineColor={surfaces.border}
            activeOutlineColor={accent}
            textColor={surfaces.text}
            placeholderTextColor={surfaces.textSecondary}
            dense
          />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={Brand.primary} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title={query ? 'Nic nenalezeno' : 'Založ první tabulku'}
              subtitle={
                query
                  ? 'Zkus jiný název.'
                  : 'Udržuj přehled o výsledcích se svými přáteli.'
              }
              actionLabel={query ? undefined : '+ Nová tabulka'}
              onAction={
                query ? undefined : () => router.push('/leaderboards/create')
              }
            />
          }
          renderItem={({ item: row }) => {
            if (row.type === 'header') {
              return (
                <ThemedText
                  style={[styles.sectionLabel, { color: surfaces.textSecondary }]}
                >
                  {row.title}
                  {'  '}
                  <ThemedText
                    style={{ color: surfaces.textSecondary, fontWeight: '500' }}
                  >
                    {row.count}
                  </ThemedText>
                </ThemedText>
              );
            }
            return renderLeagueRow(row.item, row.first, row.last);
          }}
        />
      )}
    </ThemedSafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  search: {
    borderRadius: 12,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  rowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 1,
  },
});
