import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import React, { useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { SegmentedButtons, Badge } from 'react-native-paper';
import ChatScreen from '@/components/ChatScreen';
import EventChatsList from '@/components/EventChatsList';
import MuteChatButton from '@/components/MuteChatButton';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

export default function ChatsScreen() {
    const { user } = useAuth();
    const { unreadGlobalCount, unreadEventRooms } = useUnreadMessages();
    const [activeTab, setActiveTab] = useState<'global' | 'events'>('global');
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');

    return (
        <ThemedSafeView style={styles.container}>
            <View style={styles.headerContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <ThemedText type="title">Chaty</ThemedText>
                    {activeTab === 'global' && <MuteChatButton chatId="global" />}
                </View>

                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as 'global' | 'events')}
                    buttons={[
                        {
                            value: 'global',
                            label: unreadGlobalCount > 0 ? `Globální (${unreadGlobalCount})` : 'Globální chat',
                        },
                        {
                            value: 'events',
                            label: unreadEventRooms.size > 0 ? `Události (${unreadEventRooms.size})` : 'Události',
                        },
                    ]}
                    style={styles.segmentedButtons}
                />
            </View>

            {activeTab === 'global' && (
                <View style={styles.tabContentChat}>
                    {user ? (
                        <ChatScreen type="global" currentUserId={user.id as number | string} keyboardOffset={Platform.OS === 'ios' ? 90 : 160} />
                    ) : (
                        <ThemedText style={styles.placeholder}>Načítám uživatele...</ThemedText>
                    )}
                </View>
            )}

            {activeTab === 'events' && (
                <View style={styles.tabContentChat}>
                    {user ? (
                        <EventChatsList currentUserId={user.id as number | string as number} />
                    ) : (
                        <ThemedText style={styles.placeholder}>Načítám uživatele...</ThemedText>
                    )}
                </View>
            )}
        </ThemedSafeView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    header: {
        marginBottom: 16,
    },
    segmentedButtons: {
        marginBottom: 16,
    },
    tabContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContentChat: {
        flex: 1,
        marginTop: 8,
    },
    placeholder: {
        opacity: 0.6,
    },
});
