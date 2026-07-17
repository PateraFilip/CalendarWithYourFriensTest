import React, { useEffect, useState } from 'react';
import { IconButton } from 'react-native-paper';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export default function MuteChatButton({ chatId }: { chatId: string }) {
    const { user } = useAuth();
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!user || !chatId) {
            setLoading(false);
            return;
        }

        const fetchMutedState = async () => {
            const { data, error } = await supabase
                .from('muted_chats')
                .select('*')
                .eq('user_id', user.id)
                .eq('chat_id', chatId)
                .maybeSingle();

            if (!error && data) {
                setIsMuted(true);
            } else {
                setIsMuted(false);
            }
            setLoading(false);
        };

        fetchMutedState();
    }, [user, chatId]);

    const toggleMute = async () => {
        if (!user || !chatId) return;

        const previousState = isMuted;
        setIsMuted(!isMuted); // Optimistic update

        if (previousState) {
            // Unmute
            const { error } = await supabase
                .from('muted_chats')
                .delete()
                .eq('user_id', user.id)
                .eq('chat_id', chatId);
            
            if (error) {
                console.error('Error unmuting chat', error);
                setIsMuted(previousState);
            }
        } else {
            // Mute
            const { error } = await supabase
                .from('muted_chats')
                .upsert(
                    { user_id: user.id, chat_id: chatId },
                    { onConflict: 'user_id,chat_id', ignoreDuplicates: true }
                );
                
            if (error) {
                console.error('Error muting chat', error);
                setIsMuted(previousState);
            }
        }
    };

    if (loading) return null;

    return (
        <IconButton
            icon={isMuted ? "bell-off" : "bell"}
            size={24}
            onPress={toggleMute}
            iconColor={isMuted ? "red" : "gray"}
            style={{ margin: 0 }}
        />
    );
}
