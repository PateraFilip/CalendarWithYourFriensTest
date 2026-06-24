import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { supabase } from '@/lib/supabaseClient';
import { router, useFocusEffect } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import dayjs from 'dayjs';
import { fetchEvents } from '@/api/events/get_events';
import { fetchEventsException } from '@/api/events/get_event_exceptions';
import { fetchUserEvents } from '@/api/events/getUserEvents';
import { fetchMyFriendships } from '@/api/friends/friendships';
import { getMyUpcomingEvents } from '@/lib/myEventsHelpers';
import { fetchColors } from '@/api/users/get_colors';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

interface EventChatsListProps {
  currentUserId: number;
}

interface ChatRoom {
  id: string; // unique key
  series_id: number;
  instance_date?: string | null;
  nazev: string;
  last_message_at?: string;
  user_id?: number;
  is_group?: boolean;
  event_start?: string;
  is_recurring?: boolean;
}

export default function EventChatsList({ currentUserId }: EventChatsListProps) {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [availableRooms, setAvailableRooms] = useState<ChatRoom[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'personal'>('all');
  const { unreadEventRooms } = useUnreadMessages();
  const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#444' }, 'text');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');

  useFocusEffect(
    useCallback(() => {
      const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const [evs, exceptions, userEv, fr, usersData, colorsData] = await Promise.all([
          fetchEvents(currentUserId, undefined, dayjs().add(1, 'year').toDate()),
          fetchEventsException(),
          fetchUserEvents(),
          fetchMyFriendships(currentUserId.toString()),
          supabase.from('users').select('id, username'),
          fetchColors()
        ]);
        
        setUsers(usersData?.data || []);
        setColors(colorsData || []);
        
        const joinedEventIds = userEv.filter(ue => ue.user_id === currentUserId).map(ue => ue.event_id);
        const friendIds = fr.filter(f => f.status === 'accepted').map(f => f.user_id.toString() === currentUserId.toString() ? f.friend_id : f.user_id);
        const allowedIds = [currentUserId.toString(), ...friendIds];

        // Získáme kompletní osu (tím získáme i všechny události přátel, vlastní atd.) na 365 dní dopředu
        const myTimeline = getMyUpcomingEvents(evs, [], exceptions, allowedIds, joinedEventIds, 365);

        const roomsMap = new Map<string, ChatRoom>();

        // 1. Získáme všechny historicky komunikované události
        const { data: messagedEvents } = await supabase
          .from('event_messages')
          .select('series_id, instance_date, event_series!inner(nazev, recurrence_rule, group_id, zakladatel_id, valid_from, is_group)')
          .eq('user_id', currentUserId);

        const processEvent = (e: any) => {
          const sId = e.series_id;
          const iDate = e.instance_date;
          const series = e.event_series || {};
          const nazev = series.nazev || 'Neznámá událost';
          const key = iDate ? `instance-${sId}-${iDate}` : `series-${sId}`;
          const is_recurring = series.recurrence_rule?.type === 'pattern';
          if (!roomsMap.has(key)) {
            roomsMap.set(key, { 
                id: key, 
                series_id: sId, 
                instance_date: iDate, 
                nazev, 
                user_id: series.zakladatel_id, 
                is_group: !!series.is_group,
                event_start: series.valid_from,
                is_recurring
            });
          }
        };

        messagedEvents?.forEach(processEvent);

        // 2. Přidáme všechny události z osy
        myTimeline.forEach(e => {
            const isOwner = String(e.user_id) === String(currentUserId);
            const isParticipant = joinedEventIds.includes(e.id);
            if (!isOwner && !isParticipant) return; // Skip events where I am neither owner nor participant

            const sId = e.id;
            const iDate = (!e.pravidelnost) ? undefined : dayjs(e.start).format('YYYY-MM-DD');
            const nazev = e.title;
            const key = iDate ? `instance-${sId}-${iDate}` : `series-${sId}`;
            if (!roomsMap.has(key)) {
                roomsMap.set(key, { 
                    id: key, 
                    series_id: sId, 
                    instance_date: iDate, 
                    nazev, 
                    user_id: e.user_id, 
                    is_group: e.is_group,
                    event_start: dayjs(e.start).format('YYYY-MM-DD'),
                    is_recurring: !!e.pravidelnost
                });
            }
        });

        const roomsArray = Array.from(roomsMap.values());
        
        // Získáme čas poslední zprávy pro každou sérii
        if (roomsArray.length > 0) {
          const seriesIds = Array.from(new Set(roomsArray.map(r => r.series_id)));
          
          const { data: latestMessages } = await supabase
            .from('event_messages')
            .select('series_id, instance_date, created_at')
            .in('series_id', seriesIds)
            .order('created_at', { ascending: false });
            
          if (latestMessages) {
            roomsArray.forEach(room => {
              const roomMsg = latestMessages.find(m => 
                m.series_id === room.series_id && 
                (room.instance_date ? m.instance_date === room.instance_date : !m.instance_date)
              );
              if (roomMsg) {
                room.last_message_at = roomMsg.created_at;
              }
            });
          }
        }
        
        // Rozdělit roomsArray na ty s aktivním chatem a ty bez
        const activeRooms = roomsArray.filter(r => r.last_message_at).sort((a, b) => {
          return new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime();
        });
        const getDateForSorting = (r: ChatRoom) => r.instance_date || r.event_start || '9999-12-31';
        const inactiveRooms = roomsArray.filter(r => !r.last_message_at).sort((a, b) => getDateForSorting(a).localeCompare(getDateForSorting(b)));

        setChatRooms(activeRooms);
        setAvailableRooms(inactiveRooms);
      } catch (err) {
        console.error('Error fetching chat rooms:', err);
      } finally {
        setIsLoading(false);
      }
    };

      fetchRooms();
    }, [currentUserId])
  );

  const handlePress = (room: ChatRoom) => {
    router.push({
      pathname: `/events/[id]/chat`,
      params: { 
        id: room.series_id, 
        event_title: room.nazev,
        instance_date: room.instance_date || undefined
      }
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {chatRooms.length === 0 ? (
          <View style={[styles.container, styles.centered]}>
            <ThemedText style={{ opacity: 0.6 }}>Zatím nemáš žádné aktivní chaty.</ThemedText>
          </View>
      ) : (
          <FlatList
            data={chatRooms}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}
            renderItem={({ item }) => {
              const owner = users.find(u => String(u.id) === String(item.user_id));
              const ownerName = owner ? owner.username : 'Neznámý';
              const userColorInfo = colors.find(c => String(c.user_id) === String(item.user_id));
              const userColor = userColorInfo ? userColorInfo.background_color : '#FF00AA';
              const isGroup = item.is_group;
              const itemBorderColor = isGroup ? '#FF00AA' : userColor;
              const itemBgColor = isGroup ? 'rgba(255,0,170,0.08)' : `${userColor}1A`;

              return (
                <TouchableOpacity 
                  style={[styles.roomItem, { borderLeftWidth: 4, borderLeftColor: itemBorderColor, backgroundColor: itemBgColor, marginBottom: 12, borderRadius: 8, borderBottomWidth: 0 }]} 
                  onPress={() => handlePress(item)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedText style={styles.roomTitle}>{item.nazev}</ThemedText>
                    {unreadEventRooms.has(item.id) && (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginLeft: 8 }} />
                    )}
                  </View>
                  <ThemedText style={{ fontSize: 12, opacity: 0.8, color: isGroup ? '#FF00AA' : userColor, fontWeight: 'bold' }}>
                      {isGroup ? 'Skupinová událost' : `Od: ${ownerName}`}
                  </ThemedText>
                  <ThemedText style={[styles.roomType, { marginTop: 4 }]}>
                    {item.instance_date 
                      ? `Chat k datu: ${dayjs(item.instance_date).format('D. M. YYYY')}` 
                      : (!item.is_recurring && item.event_start ? `Chat k datu: ${dayjs(item.event_start).format('D. M. YYYY')}` : 'Obecný chat události')}
                  </ThemedText>
                </TouchableOpacity>
              );
            }}
          />
      )}
      
      {/* Tlačítko pro zahájení chatu */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
      >
        <ThemedText style={styles.fabText}>+ Zahájit chat</ThemedText>
      </TouchableOpacity>

      {/* Modal pro výběr chatu */}
      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor, borderColor }]}>
            <ThemedText style={styles.modalTitle}>Vyber událost pro chat</ThemedText>
            
            {/* Filtr modalu */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 10 }}>
              <TouchableOpacity onPress={() => setFilterMode('all')} style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'all' && { color: '#fff' }]}>Vše</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterMode('group')} style={[styles.filterChip, filterMode === 'group' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'group' && { color: '#fff' }]}>Skupinové</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterMode('personal')} style={[styles.filterChip, filterMode === 'personal' && styles.filterChipActive]}>
                <ThemedText style={[styles.filterChipText, filterMode === 'personal' && { color: '#fff' }]}>Osobní</ThemedText>
              </TouchableOpacity>
            </View>

            {availableRooms.filter(r => filterMode === 'all' || (filterMode === 'group' ? r.is_group : !r.is_group)).length === 0 ? (
              <ThemedText style={{ opacity: 0.6, marginBottom: 20 }}>Nemáš žádné události bez chatu.</ThemedText>
            ) : (
              <FlatList
                data={availableRooms.filter(r => filterMode === 'all' || (filterMode === 'group' ? r.is_group : !r.is_group))}
                keyExtractor={item => item.id}
                style={{ maxHeight: 300, width: '100%' }}
                renderItem={({ item }) => {
                  const owner = users.find(u => String(u.id) === String(item.user_id));
                  const ownerName = owner ? owner.username : 'Neznámý';
                  const userColorInfo = colors.find(c => String(c.user_id) === String(item.user_id));
                  const userColor = userColorInfo ? userColorInfo.background_color : '#FF00AA';
                  const isGroup = item.is_group;
                  const itemBorderColor = isGroup ? '#FF00AA' : userColor;
                  const itemBgColor = isGroup ? 'rgba(255,0,170,0.1)' : `${userColor}1A`;

                  return (
                    <TouchableOpacity 
                      style={[styles.roomItem, { borderLeftWidth: 4, borderLeftColor: itemBorderColor, backgroundColor: itemBgColor, marginBottom: 8, borderRadius: 6, borderBottomWidth: 0 }]} 
                      onPress={() => {
                          setIsModalVisible(false);
                          handlePress(item);
                      }}
                    >
                      <ThemedText style={styles.roomTitle}>{item.nazev}</ThemedText>
                      <ThemedText style={{ fontSize: 12, opacity: 0.8, color: isGroup ? '#FF00AA' : userColor, fontWeight: 'bold' }}>
                          {isGroup ? 'Skupinová událost' : `Od: ${ownerName}`}
                      </ThemedText>
                      <ThemedText style={[styles.roomType, { marginTop: 4 }]}>
                        {item.instance_date 
                           ? dayjs(item.instance_date).format('D. M. YYYY') 
                           : (!item.is_recurring && item.event_start ? dayjs(item.event_start).format('D. M. YYYY') : 'Obecný chat události')}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity 
              style={[styles.closeButton, { borderColor }]} 
              onPress={() => setIsModalVisible(false)}
            >
              <ThemedText style={{ color: '#FF00AA' }}>Zavřít</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roomType: {
    fontSize: 13,
    color: '#888',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#FF00AA',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF00AA',
  },
  filterChipActive: {
    backgroundColor: '#FF00AA',
  },
  filterChipText: {
    fontSize: 13,
    color: '#FF00AA',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  }
});
