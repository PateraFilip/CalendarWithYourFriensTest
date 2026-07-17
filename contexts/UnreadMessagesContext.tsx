import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import { countUnreadNotifications } from '@/services/notifications/notifications';

interface UnreadMessagesContextType {
    unreadGlobalCount: number;
    unreadEventRooms: Set<string>;
    totalUnread: number;
    refreshUnread: () => Promise<void>;
    markRoomAsRead: (roomId: string, timestamp?: string) => Promise<void>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType>({
    unreadGlobalCount: 0,
    unreadEventRooms: new Set(),
    totalUnread: 0,
    refreshUnread: async () => {},
    markRoomAsRead: async () => {},
});

export const useUnreadMessages = () => useContext(UnreadMessagesContext);

export const UnreadMessagesProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [unreadGlobalCount, setUnreadGlobalCount] = useState(0);
    const [unreadEventRooms, setUnreadEventRooms] = useState<Set<string>>(new Set());

    const refreshUnread = useCallback(async () => {
        if (!user) {
            setUnreadGlobalCount(0);
            setUnreadEventRooms(new Set());
            return;
        }

        try {
            const unreadNotifications = await countUnreadNotifications(user.id);
            setUnreadGlobalCount(unreadNotifications);

            const { data: readsData, error: readsError } = await supabase
                .from('chat_reads')
                .select('room_id, last_read_at')
                .eq('user_id', user.id);

            if (readsError) throw readsError;

            const readsMap = new Map<string, string>();
            readsData?.forEach(r => {
                readsMap.set(r.room_id, r.last_read_at);
            });

            // Event chats: jen místnosti, kde jsem účastník nebo zakladatel
            const { data: myParticipations } = await supabase
                .from('event_users')
                .select('series_id')
                .eq('user_id', user.id);

            const { data: mySeries } = await supabase
                .from('event_series')
                .select('id')
                .eq('zakladatel_id', user.id);

            const allowedSeries = new Set<number>([
                ...(myParticipations ?? []).map((p) => Number(p.series_id)),
                ...(mySeries ?? []).map((s) => Number(s.id)),
            ]);

            if (allowedSeries.size === 0) {
                setUnreadEventRooms(new Set());
                return;
            }

            const { data: eventMessages, error: eventsError } = await supabase
                .from('event_messages')
                .select('series_id, instance_date, created_at, is_system_message')
                .in('series_id', Array.from(allowedSeries))
                .or('is_system_message.is.null,is_system_message.eq.false')
                .order('created_at', { ascending: false })
                .limit(400);

            if (eventsError) throw eventsError;

            const roomLastMessage = new Map<string, string>();
            eventMessages?.forEach(msg => {
                const iDate = msg.instance_date ? dayjs(msg.instance_date).format('YYYY-MM-DD') : null;
                const roomId = iDate ? `instance-${msg.series_id}-${iDate}` : `series-${msg.series_id}`;
                if (!roomLastMessage.has(roomId)) {
                    roomLastMessage.set(roomId, msg.created_at);
                }
            });

            const unreadRooms = new Set<string>();
            roomLastMessage.forEach((lastMessageAt, roomId) => {
                const readAt = readsMap.get(roomId);
                if (!readAt || new Date(lastMessageAt) > new Date(readAt)) {
                    unreadRooms.add(roomId);
                }
            });

            setUnreadEventRooms(unreadRooms);

        } catch (err) {
            console.error('Error refreshing unread messages:', err);
        }
    }, [user]);

    const markRoomAsRead = useCallback(async (roomId: string, timestamp?: string) => {
        if (!user) return;
        try {
            let readAt = new Date(Date.now() + 5000).toISOString();
            if (timestamp) {
                readAt = new Date(new Date(timestamp).getTime() + 1000).toISOString();
            }

            if (roomId === 'notifications' || roomId === 'global') {
                const { markAllNotificationsRead } = await import('@/services/notifications/notifications');
                await markAllNotificationsRead(user.id);
                setUnreadGlobalCount(0);
                return;
            }

            const { error } = await supabase.from('chat_reads').upsert({
                user_id: user.id,
                room_id: roomId,
                last_read_at: readAt
            });
            if (error) throw error;
            
            setUnreadEventRooms(prev => {
                const next = new Set(prev);
                next.delete(roomId);
                return next;
            });
        } catch (err) {
            console.error('Error marking room as read:', err);
        }
    }, [user]);

    useEffect(() => {
        refreshUnread();
        
        if (!user) return;

        const channel = supabase
            .channel(`unread_notifications_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `recipient_id=eq.${user.id}`,
                },
                () => {
                    refreshUnread();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'event_messages' },
                () => {
                    refreshUnread();
                }
            )
            .subscribe();

        // Záloha — hlavní cesta je realtime + AppData prefetch
        const interval = setInterval(refreshUnread, 120000);
        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [refreshUnread, user]);

    const totalUnread = unreadGlobalCount + unreadEventRooms.size;

    return (
        <UnreadMessagesContext.Provider value={{ unreadGlobalCount, unreadEventRooms, totalUnread, refreshUnread, markRoomAsRead }}>
            {children}
        </UnreadMessagesContext.Provider>
    );
};
