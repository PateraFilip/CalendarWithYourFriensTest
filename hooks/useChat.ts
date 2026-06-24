import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ChatType = 'global' | 'series' | 'instance';

export interface ChatMessage {
  id: number;
  user_id: number | string;
  message: string;
  created_at: string;
  series_id?: number;
  instance_date?: string | null;
  is_system_message?: boolean;
  users?: {
    username: string;
    jmeno: string;
    prijmeni: string;
  };
}

interface UseChatProps {
  type: ChatType;
  series_id?: number;
  instance_date?: string;
  currentUserId?: number | string;
}

export const useChat = ({ type, series_id, instance_date, currentUserId }: UseChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabulka podle typu chatu
  const tableName = type === 'global' ? 'global_messages' : 'event_messages';

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const userSelect = type === 'global' ? 'users!global_messages_user_id_fkey (username, jmeno, prijmeni)' : 'users (username, jmeno, prijmeni)';
      let query = supabase
        .from(tableName)
        .select(`*, ${userSelect}`)
        .order('created_at', { ascending: true }) // starší nahoře, novější dole (ScrollView půjde dolů)
        .limit(100);

      if (type === 'global' && currentUserId) {
        const { data: netData } = await supabase.rpc('get_extended_network_ids', { p_user_id: currentUserId });
        const netIds = netData ? netData.map((r: any) => typeof r === 'string' ? r : r.u_id).filter(Boolean) : [];
        if (currentUserId) netIds.push(currentUserId);
        
        const validIds = netIds.filter((id: any) => id && id.toString().trim() !== '');
        
        if (validIds.length > 0) {
          query = query.or(`is_system_message.eq.false,related_user_id.is.null,related_user_id.in.(${validIds.join(',')})`);
        } else {
          query = query.or(`is_system_message.eq.false,related_user_id.is.null`);
        }
      }

      // Přidání filtrů pro event_messages
      if (type === 'series' && series_id) {
        query = query.eq('series_id', series_id).is('instance_date', null);
      } else if (type === 'instance' && series_id && instance_date) {
        query = query.eq('series_id', series_id).eq('instance_date', instance_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data as any || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tableName, type, series_id, instance_date]);

  useEffect(() => {
    fetchMessages();

    // Přihlášení k Realtime updatům
    const channelName = `realtime:public:${tableName}:${type}-${series_id || 'none'}-${instance_date || 'none'}`;
    const channel = supabase.channel(channelName);

    // Filtr pro Realtime (nelze složitě filtrovat jako eq() nad více sloupci v Realtime filtru,
    // proto přijmeme všechno z dané tabulky a vyfiltrujeme lokálně)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: tableName },
      (payload) => {
        const newMsg = payload.new as ChatMessage;
        
        // Zkontrolovat, zda zpráva patří do tohoto chatu
        let shouldAdd = false;
        if (type === 'global') {
          shouldAdd = true;
        } else if (type === 'series') {
          if (newMsg.series_id === series_id && !newMsg.instance_date) shouldAdd = true;
        } else if (type === 'instance') {
          if (newMsg.series_id === series_id && newMsg.instance_date === instance_date) shouldAdd = true;
        }

        if (shouldAdd) {
          // Protože payload.new neobsahuje join tabulky (users), musíme ho dotáhnout (nebo použít lokální cache, pokud známe)
          // Rychlé řešení: fetchneme dodatečně novou zprávu s joinem
          const fetchNewMessage = async () => {
            const { data } = await supabase
              .from(tableName)
              .select(`*, ${type === 'global' ? 'users!global_messages_user_id_fkey(username, jmeno, prijmeni)' : 'users(username, jmeno, prijmeni)'}`)
              .eq('id', newMsg.id)
              .single();
            if (data) {
              setMessages((prev) => {
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data as any];
              });
            }
          };
          fetchNewMessage();
        }
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, tableName, type, series_id, instance_date]);

  const sendMessage = async (messageText: string) => {
    if (!currentUserId || !messageText.trim()) return null;

    const payload: any = {
      user_id: currentUserId,
      message: messageText.trim(),
    };

    if (type !== 'global') {
      if (!series_id) return null;
      payload.series_id = series_id;
      if (type === 'instance') {
        payload.instance_date = instance_date;
      }
    }

    // Optimistic update (volitelně)
    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select(`*, ${type === 'global' ? 'users!global_messages_user_id_fkey(username, jmeno, prijmeni)' : 'users(username, jmeno, prijmeni)'}`)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return null;
    }
    
    // Není potřeba přidávat optimistically, Realtime event ho přidá.
    // Ale můžeme ho přidat rovnou, pokud chceme instantní reakci, a v Realtime eventu ho odfiltrovat podle ID.
    // Pro jednoduchost necháme Realtime, ať ho přidá (nebo ho přidáme a v Realtime zkontrolujeme duplikaci).
    setMessages(prev => {
      if (prev.some(m => m.id === data.id)) return prev;
      return [...prev, data as any];
    });

    return data;
  };

  return { messages, isLoading, sendMessage };
};
