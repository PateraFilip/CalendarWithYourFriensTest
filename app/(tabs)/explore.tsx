import { EmptyState } from '@/components/EmptyState';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useAppDataOptional } from '@/contexts/AppDataContext';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabaseClient';
import {
  acceptFriendRequest,
  fetchMyFriendships,
  Friendship,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/services/friends/friendships';
import { fetchUsers } from '@/services/users/get_users';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { TextInput } from 'react-native-paper';

dayjs.locale('cs');

interface User {
  id: string;
  username: string;
  jmeno: string;
  prijmeni: string;
  email: string;
  datum_narozeni: string;
}

type PersonRow = User & { friendship?: Friendship };

type SectionKey = 'requests' | 'friends' | 'people';

function initials(user: User): string {
  const a = (user.jmeno || '').trim().charAt(0);
  const b = (user.prijmeni || '').trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  return (user.username || '?').slice(0, 2).toUpperCase();
}

function displayName(user: User): string {
  const full = [user.jmeno, user.prijmeni].filter(Boolean).join(' ');
  return full || user.username;
}

export default function PeopleScreen() {
  const { user } = useAuth();
  const appData = useAppDataOptional();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary;

  const [users, setUsers] = useState<User[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const colors = appData?.colors ?? [];

  const colorForUser = (userId: string) =>
    colors.find((c: any) => String(c.user_id) === String(userId));

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const usersData = (await fetchUsers()) as any;
      const friendshipsData = await fetchMyFriendships(user.id);
      setUsers(usersData);
      setFriendships(friendshipsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('explore-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setFriendships((prev) =>
              prev.filter((f) => f.id !== payload.old.id)
            );
          } else if (
            payload.eventType === 'UPDATE' ||
            payload.eventType === 'INSERT'
          ) {
            const newRecord = payload.new as Friendship;
            setFriendships((prev) => {
              const exists = prev.some((f) => f.id === newRecord.id);
              if (exists) {
                return prev.map((f) =>
                  f.id === newRecord.id ? newRecord : f
                );
              }
              return [...prev, newRecord];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSendRequest = async (friendId: string) => {
    if (!user) return;
    try {
      setFriendships((prev) => [
        ...prev,
        {
          id: 'temp-' + friendId,
          user_id: user.id,
          friend_id: friendId,
          status: 'pending',
          created_at: '',
        },
      ]);
      await sendFriendRequest(user.id, friendId);
    } catch (e) {
      console.error(e);
      alert('Nepodařilo se odeslat žádost.');
      loadData();
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      setFriendships((prev) =>
        prev.map((f) =>
          f.id === friendshipId ? { ...f, status: 'accepted' } : f
        )
      );
      await acceptFriendRequest(friendshipId);
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const handleReject = async (friendshipId: string) => {
    try {
      setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
      await rejectFriendRequest(friendshipId);
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const handleRemove = async (friendshipId: string) => {
    try {
      setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
      await removeFriend(friendshipId);
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  const enriched = useMemo((): PersonRow[] => {
    return users
      .map((u) => ({
        ...u,
        friendship: friendships.find(
          (f) =>
            (f.user_id.toString() === user?.id?.toString() &&
              f.friend_id.toString() === u.id.toString()) ||
            (f.friend_id.toString() === user?.id?.toString() &&
              f.user_id.toString() === u.id.toString())
        ),
      }))
      .sort((a, b) => a.username.localeCompare(b.username, 'cs'));
  }, [users, friendships, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((u) => {
      const hay = [
        u.username,
        u.jmeno,
        u.prijmeni,
        u.email,
        `${u.jmeno} ${u.prijmeni}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, query]);

  const sections = useMemo(() => {
    if (!user) return [];

    const meId = user.id.toString();
    const others = filtered.filter((u) => u.id.toString() !== meId);

    const requests = others.filter((u) => {
      const f = u.friendship;
      return (
        f?.status === 'pending' && f.friend_id.toString() === meId
      );
    });

    const friends = others.filter((u) => u.friendship?.status === 'accepted');

    const people = others.filter((u) => {
      const f = u.friendship;
      if (!f) return true;
      return (
        f.status === 'pending' && f.user_id.toString() === meId
      );
    });

    const result: { key: SectionKey; title: string; data: PersonRow[] }[] = [];
    if (requests.length)
      result.push({ key: 'requests', title: 'Žádosti', data: requests });
    if (friends.length)
      result.push({ key: 'friends', title: 'Přátelé', data: friends });
    if (people.length)
      result.push({ key: 'people', title: 'Najít lidi', data: people });

    return result;
  }, [filtered, user?.id]);

  const renderActions = (item: PersonRow) => {
    if (!user) return null;
    const friendship = item.friendship;
    const isAccepted = friendship?.status === 'accepted';
    const isPending = friendship?.status === 'pending';
    const iSentRequest =
      isPending && friendship?.user_id.toString() === user.id.toString();
    const theySentRequest =
      isPending && friendship?.friend_id.toString() === user.id.toString();

    if (isAccepted) {
      return (
        <Pressable
          onPress={() => handleRemove(friendship!.id)}
          hitSlop={8}
          style={[styles.iconBtn, { backgroundColor: Brand.primarySoft }]}
          accessibilityLabel="Odebrat z přátel"
        >
          <MaterialCommunityIcons
            name="account-remove-outline"
            size={20}
            color={Brand.danger}
          />
        </Pressable>
      );
    }

    if (theySentRequest) {
      return (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => handleAccept(friendship!.id)}
            style={[styles.pillBtn, { backgroundColor: Brand.success }]}
          >
            <ThemedText style={styles.pillBtnText}>Přijmout</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleReject(friendship!.id)}
            style={[styles.iconBtn, { backgroundColor: Brand.primarySoft }]}
            accessibilityLabel="Odmítnout"
          >
            <MaterialCommunityIcons name="close" size={20} color={Brand.danger} />
          </Pressable>
        </View>
      );
    }

    if (iSentRequest) {
      return (
        <View style={styles.actionRow}>
          <ThemedText style={[styles.pendingLabel, { color: surfaces.textSecondary }]}>
            Čeká
          </ThemedText>
          <Pressable
            onPress={() => handleReject(friendship!.id)}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: Brand.primarySoft }]}
            accessibilityLabel="Zrušit žádost"
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={surfaces.textSecondary}
            />
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => handleSendRequest(item.id)}
        style={[styles.pillBtn, { backgroundColor: Brand.primary }]}
      >
        <MaterialCommunityIcons name="account-plus" size={16} color={Brand.onPrimary} />
        <ThemedText style={styles.pillBtnText}>Přidat</ThemedText>
      </Pressable>
    );
  };

  const renderItem = ({
    item,
    section,
    index,
  }: {
    item: PersonRow;
    section: { data: PersonRow[]; key: SectionKey };
    index: number;
  }) => {
    const color = colorForUser(item.id);
    const bg = color?.background_color || Brand.primary;
    const fg = color?.text_color || Brand.onPrimary;
    const isLast = index === section.data.length - 1;
    const isFriend = item.friendship?.status === 'accepted';

    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: surfaces.surface,
            borderBottomColor: surfaces.border,
          },
          index === 0 && styles.rowFirst,
          isLast && styles.rowLast,
          !isLast && styles.rowDivider,
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: bg }]}>
          <ThemedText style={[styles.avatarText, { color: fg }]}>
            {initials(item)}
          </ThemedText>
        </View>

        <View style={styles.rowBody}>
          <ThemedText style={[styles.rowTitle, { color: surfaces.text }]} numberOfLines={1}>
            {displayName(item)}
          </ThemedText>
          <ThemedText
            style={[styles.rowSub, { color: surfaces.textSecondary }]}
            numberOfLines={1}
          >
            @{item.username}
            {isFriend && item.datum_narozeni
              ? ` · ${dayjs(item.datum_narozeni).format('D. M. YYYY')}`
              : ''}
          </ThemedText>
          {isFriend && !!item.email && (
            <ThemedText
              style={[styles.rowMeta, { color: surfaces.textSecondary }]}
              numberOfLines={1}
            >
              {item.email}
            </ThemedText>
          )}
        </View>

        {renderActions(item)}
      </View>
    );
  };

  return (
    <ThemedSafeView
      style={[styles.container, { backgroundColor: surfaces.background }]}
    >
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: surfaces.text }]}>Lidé</ThemedText>
        <ThemedText style={[styles.subtitle, { color: surfaces.textSecondary }]}>
          Přátelé a žádosti o spojení
        </ThemedText>

        <TextInput
          mode="outlined"
          placeholder="Hledat jméno nebo @uživatele"
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
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={Brand.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem as any}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <ThemedText
              style={[styles.sectionLabel, { color: surfaces.textSecondary }]}
            >
              {section.title}
              {'  '}
              <ThemedText style={{ color: surfaces.textSecondary, fontWeight: '500' }}>
                {section.data.length}
              </ThemedText>
            </ThemedText>
          )}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title={query ? 'Nikdo nenalezen' : 'Zatím tu nikdo není'}
              subtitle={
                query
                  ? 'Zkus jiné jméno nebo přezdívku.'
                  : 'Až se objeví další uživatelé, můžeš je tu přidat mezi přátele.'
              }
            />
          }
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
    marginBottom: 14,
  },
  search: {
    borderRadius: 12,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillBtnText: {
    color: Brand.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
