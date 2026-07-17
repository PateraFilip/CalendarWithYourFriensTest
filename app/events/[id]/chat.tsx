import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import ChatScreen from '@/components/ChatScreen';
import MuteChatButton from '@/components/MuteChatButton';
import { useAuth } from '@/hooks/useAuth';
import { ThemedText } from '@/components/themed-text';
import { TouchableOpacity } from 'react-native';
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
    
    let headerTitle = event_title ? String(event_title) : 'Chat události';
    if (isInstance) {
        headerTitle += ` (${dayjs(String(instance_date)).format('D. M. YYYY')})`;
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
                            <MuteChatButton chatId={isInstance ? `instance_${seriesId}_${instance_date}` : `series_${seriesId}`} />
                            <TouchableOpacity onPress={() => {
                                router.push({
                                    pathname: '/events/[eventId]',
                                    params: { eventId: String(seriesId), instance_date: instance_date ? String(instance_date) : undefined }
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
                instance_date={isInstance ? String(instance_date) : undefined} 
                currentUserId={user.id}
                eventTitle={event_title ? String(event_title) : undefined}
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
