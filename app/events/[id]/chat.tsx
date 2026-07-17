import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import ChatScreen from '@/components/ChatScreen';
import MuteChatButton from '@/components/MuteChatButton';
import AddFriendsToChatButton from '@/components/AddFriendsToChatButton';
import { useAuth } from '@/hooks/useAuth';
import { ThemedText } from '@/components/themed-text';
import dayjs from 'dayjs';

export default function EventChatScreen() {
    const { id, instance_date, event_title } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    
    if (!user) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: '#151718' }]}>
                <ThemedText style={{ padding: 16 }}>Načítání uživatele...</ThemedText>
            </SafeAreaView>
        );
    }

    const seriesId = Number(id);
    const isInstance = !!instance_date;
    const instanceDateStr = isInstance ? String(instance_date) : undefined;
    const titleStr = event_title ? String(event_title) : undefined;
    
    let headerTitle = titleStr || 'Chat události';
    if (isInstance) {
        headerTitle += ` (${dayjs(instanceDateStr).format('D. M. YYYY')})`;
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: '#151718' }]}>
            <Stack.Screen 
                options={{
                    headerShown: true,
                    title: headerTitle,
                    headerBackTitle: 'Zpět',
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AddFriendsToChatButton
                                seriesId={seriesId}
                                instanceDate={instanceDateStr}
                                currentUserId={user.id}
                                eventTitle={titleStr}
                            />
                            <MuteChatButton chatId={isInstance ? `instance_${seriesId}_${instance_date}` : `series_${seriesId}`} />
                            <TouchableOpacity onPress={() => {
                                router.push({
                                    pathname: '/events/[eventId]',
                                    params: { eventId: String(seriesId), instance_date: instanceDateStr }
                                });
                            }}>
                                <ThemedText style={{ color: '#00AAFF', marginRight: 10 }}>Detail</ThemedText>
                            </TouchableOpacity>
                        </View>
                    )
                }} 
            />
            <ChatScreen 
                type={isInstance ? 'instance' : 'series'} 
                series_id={seriesId} 
                instance_date={instanceDateStr} 
                currentUserId={user.id}
                eventTitle={titleStr}
                keyboardOffset={Platform.OS === 'ios' ? 90 : 90}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
