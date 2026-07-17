import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from './themed-text';
import { router, useFocusEffect } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import dayjs from 'dayjs';
import { useAppData, type ChatRoom } from '@/contexts/AppDataContext';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

interface EventChatsListProps {
  currentUserId: number | string;
}

export default function EventChatsList(_props: EventChatsListProps) {
  const {
    chatRooms,
    availableChatRooms,
    users,
    colors,
    booting,
    ready,
    refreshing,
    ensureLoaded,
  } = useAppData();
  const { unreadEventRooms } = useUnreadMessages();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'group' | 'personal'>('all');

  const borderColor = useThemeColor({ light: '#ccc', dark: '#444' }, 'text');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');

  useFocusEffect(
    useCallback(() => {
      ensureLoaded();
    }, [ensureLoaded])
  );

  const handlePress = (room: ChatRoom) => {
    router.push({
      pathname: `/events/[id]/chat`,
      params: {
        id: room.series_id,
        event_title: room.nazev,
        instance_date: room.instance_date || undefined,
      },
    });
  };

  const renderRoom = (item: ChatRoom, compact = false) => {
    const owner = users.find((u) => String(u.id) === String(item.user_id));
    const ownerName = owner ? owner.username : 'Neznámý';
    const userColorInfo = colors.find((c) => String(c.user_id) === String(item.user_id));
    const userColor = userColorInfo ? userColorInfo.background_color : '#FF00AA';
    const isGroup = item.is_group;
    const itemBorderColor = isGroup ? '#FF00AA' : userColor;
    const itemBgColor = isGroup ? 'rgba(255,0,170,0.08)' : `${userColor}1A`;

    return (
      <TouchableOpacity
        style={[
          styles.roomItem,
          {
            borderLeftWidth: 4,
            borderLeftColor: itemBorderColor,
            backgroundColor: itemBgColor,
            marginBottom: compact ? 8 : 12,
            borderRadius: compact ? 6 : 8,
            borderBottomWidth: 0,
          },
        ]}
        onPress={() => {
          if (compact) setIsModalVisible(false);
          handlePress(item);
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={styles.roomTitle}>{item.nazev}</ThemedText>
          {!compact && unreadEventRooms.has(item.id) && (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: 'red',
                marginLeft: 8,
              }}
            />
          )}
        </View>
        <ThemedText
          style={{
            fontSize: 12,
            opacity: 0.8,
            color: isGroup ? '#FF00AA' : userColor,
            fontWeight: 'bold',
          }}
        >
          {isGroup ? 'Skupinová událost' : `Od: ${ownerName}`}
        </ThemedText>
        <ThemedText style={[styles.roomType, { marginTop: 4 }]}>
          {item.instance_date
            ? `Chat k datu: ${dayjs(item.instance_date).format('D. M. YYYY')}`
            : !item.is_recurring && item.event_start
              ? `Chat k datu: ${dayjs(item.event_start).format('D. M. YYYY')}`
              : 'Obecný chat události'}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  if (booting && !ready) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const filteredAvailable = availableChatRooms.filter(
    (r) =>
      filterMode === 'all' || (filterMode === 'group' ? r.is_group : !r.is_group)
  );

  return (
    <View style={styles.container}>
      {refreshing && chatRooms.length > 0 && (
        <ThemedText
          style={{ textAlign: 'center', opacity: 0.5, paddingTop: 8, fontSize: 12 }}
        >
          Aktualizuji chaty…
        </ThemedText>
      )}
      {chatRooms.length === 0 ? (
        <View style={[styles.container, styles.centered]}>
          <ThemedText style={{ opacity: 0.6 }}>Zatím nemáš žádné aktivní chaty.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 80,
          }}
          renderItem={({ item }) => renderRoom(item)}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <ThemedText style={styles.fabText}>+ Zahájit chat</ThemedText>
      </TouchableOpacity>

      {isModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor, borderColor }]}>
            <ThemedText style={styles.modalTitle}>Vyber událost pro chat</ThemedText>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: 12,
                gap: 10,
              }}
            >
              {(['all', 'group', 'personal'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setFilterMode(mode)}
                  style={[styles.filterChip, filterMode === mode && styles.filterChipActive]}
                >
                  <ThemedText
                    style={[styles.filterChipText, filterMode === mode && { color: '#fff' }]}
                  >
                    {mode === 'all' ? 'Vše' : mode === 'group' ? 'Skupinové' : 'Osobní'}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {filteredAvailable.length === 0 ? (
              <ThemedText style={{ opacity: 0.6, marginBottom: 20 }}>
                Nemáš žádné události bez chatu.
              </ThemedText>
            ) : (
              <FlatList
                data={filteredAvailable}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300, width: '100%' }}
                renderItem={({ item }) => renderRoom(item, true)}
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
  container: { flex: 1, width: '100%' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  roomItem: { paddingVertical: 16, paddingHorizontal: 20 },
  roomTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, flex: 1 },
  roomType: { fontSize: 13, color: '#888' },
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
  fabText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF00AA',
  },
  filterChipActive: { backgroundColor: '#FF00AA' },
  filterChipText: { fontSize: 13, color: '#FF00AA' },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
});
