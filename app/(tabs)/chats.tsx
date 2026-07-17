import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import EventChatsList from '@/components/EventChatsList';
import NotificationsInbox from '@/components/NotificationsInbox';
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext';

export default function ChatsScreen() {
    const { user } = useAuth();
    const { unreadGlobalCount, unreadEventRooms, refreshUnread } = useUnreadMessages();
    const [activeTab, setActiveTab] = useState<'notifications' | 'events'>('notifications');
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

    return (
        <ThemedSafeView style={styles.container}>
            <View style={styles.headerContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <ThemedText type="title">Chaty a oznámení</ThemedText>
                </View>

                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(value) => {
                        setActiveTab(value as 'notifications' | 'events');
                        if (value === 'notifications') refreshUnread();
                    }}
                    buttons={[
                        {
                            value: 'notifications',
                            label: unreadGlobalCount > 0 ? `Oznámení (${unreadGlobalCount})` : 'Oznámení',
                        },
                        {
                            value: 'events',
                            label: unreadEventRooms.size > 0 ? `Události (${unreadEventRooms.size})` : 'Události',
                        },
                    ]}
                    style={styles.segmentedButtons}
                    theme={{ colors: { secondaryContainer: buttonColor } }}
                />
            </View>

            {activeTab === 'notifications' && (
                <View style={styles.tabContentChat}>
                    {user ? (
                        <NotificationsInbox currentUserId={user.id as number | string} />
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
    segmentedButtons: {
        marginBottom: 16,
    },
    tabContentChat: {
        flex: 1,
        marginTop: 8,
    },
    placeholder: {
        opacity: 0.6,
        padding: 16,
    },
});
