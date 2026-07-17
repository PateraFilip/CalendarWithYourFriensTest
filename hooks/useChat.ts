import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { notifyChatMessage } from '@/hooks/useNotificationHandler';

export type ChatType = 'series' | 'instance';

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
  eventTitle?: string;
}

export const useChat = ({
  type,
  series_id,
  instance_date,
  currentUserId,
  eventTitle,
}: UseChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!series_id) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('event_messages')
        .select(`*, users (username, jmeno, prijmeni)`)
        .eq('series_id', series_id)
        .or('is_system_message.is.null,is_system_message.eq.false')
        .order('created_at', { ascending: true })
        .limit(100);

      if (type === 'series') {
        query = query.is('instance_date', null);
      } else if (type === 'instance' && instance_date) {
        query = query.eq('instance_date', instance_date);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [type, series_id, instance_date]);

  useEffect(() => {
    fetchMessages();

    const channelName = `realtime:event_messages:${type}-${series_id || 'none'}-${instance_date || 'none'}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          let shouldAdd = false;
          if (type === 'series') {
            if (newMsg.series_id === series_id && !newMsg.instance_date) shouldAdd = true;
          } else if (type === 'instance') {
            if (newMsg.series_id === series_id && newMsg.instance_date === instance_date)
              shouldAdd = true;
          }

          if (!shouldAdd) return;
          if (newMsg.is_system_message) return;

          const fetchNewMessage = async () => {
            const { data } = await supabase
              .from('event_messages')
              .select(`*, users(username, jmeno, prijmeni)`)
              .eq('id', newMsg.id)
              .single();
            if (data) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data as ChatMessage];
              });

              // Lokální chat notifikace pro příjemce (ne pro odesílatele)
              if (
                currentUserId &&
                String(data.user_id) !== String(currentUserId) &&
                !data.is_system_message
              ) {
                const sender =
                  data.users?.jmeno ||
                  data.users?.username ||
                  'Někdo';
                notifyChatMessage(
                  eventTitle || 'Událost',
                  Number(series_id),
                  sender
                ).catch(console.error);
              }
            }
          };
          fetchNewMessage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, type, series_id, instance_date, currentUserId, eventTitle]);

  const sendMessage = async (messageText: string) => {
    if (!currentUserId || !messageText.trim() || !series_id) return null;

    const payload: Record<string, unknown> = {
      user_id: currentUserId,
      message: messageText.trim(),
      series_id,
    };
    if (type === 'instance') {
      payload.instance_date = instance_date;
    }

    const { data, error } = await supabase
      .from('event_messages')
      .insert(payload)
      .select(`*, users(username, jmeno, prijmeni)`)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return null;
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev;
      return [...prev, data as ChatMessage];
    });

    return data;
  };

  return { messages, isLoading, sendMessage };
};
