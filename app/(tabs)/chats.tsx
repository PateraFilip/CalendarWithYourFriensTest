import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
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
    const { unreadGlobalCount, unreadEventRooms } = useUnreadMessages();
    const [activeTab, setActiveTab] = useState<'notifications' | 'events'>('notifications');
    const secondary = useThemeColor({ light: '#687076', dark: '#9BA1A6' }, 'text');

    return (
        <ThemedSafeView style={styles.container}>
            <View style={styles.headerContainer}>
                <ThemedText style={styles.title}>Chaty</ThemedText>
                <ThemedText style={[styles.subtitle, { color: secondary }]}>
                    Oznámení a konverzace k událostem
                </ThemedText>

                <SegmentedButtons
                    value={activeTab}
                    onValueChange={(value) => {
                        setActiveTab(value as 'notifications' | 'events');
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
                    theme={{ colors: { secondaryContainer: Brand.primarySoft } }}
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
    title: {
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 36,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
        marginBottom: 16,
    },
    segmentedButtons: {
        marginBottom: 8,
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
