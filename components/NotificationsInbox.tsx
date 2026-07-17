import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { markNotificationRead, markAllNotificationsRead } from '@/services/notifications/notifications';
import { useAppData } from '@/contexts/AppDataContext';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

interface NotificationsInboxProps {
  currentUserId: string | number;
}

function extractEventId(message: string): number | null {
  const match = message.match(/\[EVENT:(\d+)/);
  return match ? Number(match[1]) : null;
}

export default function NotificationsInbox({ currentUserId }: NotificationsInboxProps) {
  const router = useRouter();
  const { refreshUnread } = useUnreadMessages();
  const {
    notifications,
    setNotifications,
    booting,
    ready,
    ensureLoaded,
    refreshNotifications,
  } = useAppData();

  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const secondary = useThemeColor({ light: '#666', dark: '#aaa' }, 'text');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2c2c2e' }, 'background');
  const border = useThemeColor({ light: '#e5e5ea', dark: '#38383a' }, 'text');

  useFocusEffect(
    useCallback(() => {
      ensureLoaded();
      // Stačí zobrazit seznam — všechna nepřečtená označ jako přečtená
      void (async () => {
        await markAllNotificationsRead(currentUserId);
        const now = new Date().toISOString();
        setNotifications((prev) =>
          prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
        );
        refreshUnread();
      })();
    }, [ensureLoaded, refreshUnread, currentUserId, setNotifications])
  );

  const openNotification = async (item: (typeof notifications)[0]) => {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      refreshUnread();
    }
    const seriesId = item.series_id ?? extractEventId(item.message);
    if (seriesId) {
      router.push(`/events/${seriesId}`);
    }
  };

  if (booting && !ready) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (notifications.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={{ opacity: 0.6 }}>Zatím žádná oznámení</ThemedText>
        <Pressable onPress={() => refreshNotifications()} style={{ marginTop: 12 }}>
          <ThemedText style={{ color: '#FF00AA' }}>Obnovit</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const actor = item.users?.username || item.users?.jmeno || 'Někdo';
        const unread = !item.read_at;
        return (
          <Pressable
            onPress={() => openNotification(item)}
            style={[
              styles.row,
              { backgroundColor: cardBg, borderColor: border },
              unread && styles.unread,
            ]}
          >
            <View style={{ flex: 1 }}>
              <ThemedText
                style={{ color: textColor, fontWeight: unread ? '700' : '500' }}
              >
                {actor} {item.message.replace(/\[EVENT:[^\]]+\]/g, '').trim()}
              </ThemedText>
              <ThemedText style={{ color: secondary, fontSize: 12, marginTop: 4 }}>
                {dayjs(item.created_at).format('D.M.YYYY HH:mm')}
              </ThemedText>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 32 },
  row: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF00AA',
  },
});
