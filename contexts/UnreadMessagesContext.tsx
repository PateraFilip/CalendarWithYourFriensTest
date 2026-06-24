import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';

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
            // 1. Get user's read receipts
            const { data: readsData, error: readsError } = await supabase
                .from('chat_reads')
                .select('room_id, last_read_at')
                .eq('user_id', user.id);

            if (readsError) throw readsError;

            const readsMap = new Map<string, string>();
            readsData?.forEach(r => {
                readsMap.set(r.room_id, r.last_read_at);
            });

            // 2. Check Global Chat unread
            const globalReadAt = readsMap.get('global');
            
            let globalQuery = supabase.from('global_messages').select('id', { count: 'exact', head: true });
            
            // Aplikovat filtr pro systémové zprávy jako v chatu
            const { data: netData } = await supabase.rpc('get_extended_network_ids', { p_user_id: user.id });
            const netIds = netData ? netData.map((r: any) => typeof r === 'string' ? r : r.u_id).filter(Boolean) : [];
            netIds.push(user.id);
            const validIds = netIds.filter((id: any) => id && id.toString().trim() !== '');
            if (validIds.length > 0) {
                globalQuery = globalQuery.or(`is_system_message.eq.false,related_user_id.is.null,related_user_id.in.(${validIds.join(',')})`);
            } else {
                globalQuery = globalQuery.or(`is_system_message.eq.false,related_user_id.is.null`);
            }

            if (globalReadAt) {
                globalQuery = globalQuery.gt('created_at', globalReadAt);
            }
            const { count: globalCount } = await globalQuery;
            setUnreadGlobalCount(globalCount || 0);

            // 3. Check Event Chats unread
            // Fetch all event messages
            const { data: eventMessages, error: eventsError } = await supabase
                .from('event_messages')
                .select('series_id, instance_date, created_at')
                .order('created_at', { ascending: false });

            if (eventsError) throw eventsError;

            // Group by room_id to find last_message_at
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
            // Pokud máme timestamp poslední zprávy, použijeme ho + přidáme 1s pro jistotu.
            // Jinak použijeme aktuální čas a přidáme 5s jako prevenci proti nesynchronizovaným hodinám
            let readAt = new Date(Date.now() + 5000).toISOString();
            if (timestamp) {
                readAt = new Date(new Date(timestamp).getTime() + 1000).toISOString();
            }

            const { error } = await supabase.from('chat_reads').upsert({
                user_id: user.id,
                room_id: roomId,
                last_read_at: readAt
            });
            if (error) throw error;
            
            // Okamžitá lokální aktualizace UI
            if (roomId === 'global') {
                setUnreadGlobalCount(0);
            } else {
                setUnreadEventRooms(prev => {
                    const next = new Set(prev);
                    next.delete(roomId);
                    return next;
                });
            }
        } catch (err) {
            console.error('Error marking room as read:', err);
        }
    }, [user]);

    useEffect(() => {
        refreshUnread();
        
        // Polling as a fallback, or we can rely on focus events
        const interval = setInterval(refreshUnread, 30000); // 30s
        return () => clearInterval(interval);
    }, [refreshUnread]);

    const totalUnread = unreadGlobalCount + unreadEventRooms.size;

    return (
        <UnreadMessagesContext.Provider value={{ unreadGlobalCount, unreadEventRooms, totalUnread, refreshUnread, markRoomAsRead }}>
            {children}
        </UnreadMessagesContext.Provider>
    );
};
