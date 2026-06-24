import { fetchUsers } from '@/services/users/get_users';
import { fetchMyFriendships, Friendship, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } from '@/services/friends/friendships';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface User {
    id: string; // changed to string according to users table
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function PeopleScreen() {
    const { user } = useAuth()
    const [users, setUsers] = useState<User[]>([]);
    const [friendships, setFriendships] = useState<Friendship[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const labelColor = useThemeColor(
        { light: '#f8f8f8ff', dark: '#1C1C1E' },
        'text'
    )
    const surfaceColor = useThemeColor({ light: '#fff', dark: '#2A2A2A' }, 'surface');
    const borderColor = useThemeColor({ light: '#E5E5E5', dark: '#444' }, 'text');
    const subTextColor = useThemeColor({ light: '#666', dark: '#CCC' }, 'text');

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const usersData = await fetchUsers() as any;
            const friendshipsData = await fetchMyFriendships(user.id);
            setUsers(usersData);
            setFriendships(friendshipsData);
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const channel = supabase.channel('explore-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                loadData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    setFriendships(prev => prev.filter(f => f.id !== payload.old.id));
                } else if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const newRecord = payload.new as Friendship;
                    setFriendships(prev => {
                        const exists = prev.some(f => f.id === newRecord.id);
                        if (exists) {
                            return prev.map(f => f.id === newRecord.id ? newRecord : f);
                        } else {
                            return [...prev, newRecord];
                        }
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleSendRequest = async (friendId: string) => {
        if (!user) return;
        try {
            setFriendships(prev => [...prev, { id: 'temp', user_id: user.id, friend_id: friendId, status: 'pending', created_at: '' }]);
            await sendFriendRequest(user.id, friendId);
        } catch (e) {
            console.error(e);
            alert("Nepodařilo se odeslat žádost.");
            loadData(); // Vrátíme to zpět na reálná data pouze při chybě
        }
    };

    const handleAccept = async (friendshipId: string) => {
        try {
            setFriendships(prev => prev.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f));
            await acceptFriendRequest(friendshipId);
        } catch (e) {
            console.error(e);
            loadData();
        }
    };

    const handleReject = async (friendshipId: string) => {
        try {
            setFriendships(prev => prev.filter(f => f.id !== friendshipId));
            await rejectFriendRequest(friendshipId);
        } catch (e) {
            console.error(e);
            loadData();
        }
    };

    const handleRemove = async (friendshipId: string) => {
        try {
            setFriendships(prev => prev.filter(f => f.id !== friendshipId));
            await removeFriend(friendshipId);
        } catch (e) {
            console.error(e);
            loadData();
        }
    };

    const formatDate = (d?: Date) => (d ? dayjs(d).format('DD. MM. YYYY') : '');

    const renderItem = ({ item }: { item: User & { friendship?: Friendship } }) => {
        if (!user) return null;
        
        const isMe = item.id.toString() === user.id.toString();
        const friendship = item.friendship;

        const isAccepted = friendship?.status === 'accepted';
        const isPending = friendship?.status === 'pending';
        const iSentRequest = isPending && friendship?.user_id.toString() === user.id.toString();
        const theySentRequest = isPending && friendship?.friend_id.toString() === user.id.toString();

        return (
            <ThemedView style={[styles.card, { backgroundColor: surfaceColor, borderColor, borderWidth: 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ fontSize: 18, fontWeight: 'bold' }}>
                        {item.username} {isMe && '(To jsi ty)'}
                    </ThemedText>

                    {!isMe && (
                        <View>
                            {isAccepted && (
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    <View style={styles.badge}>
                                        <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Přátelé</ThemedText>
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemove(friendship!.id)} style={[styles.btn, { backgroundColor: '#F44336' }]}>
                                        <ThemedText style={styles.btnText}>Odebrat</ThemedText>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {iSentRequest && (
                                <ThemedText style={{ fontSize: 12, color: '#888' }}>Žádost odeslána</ThemedText>
                            )}
                            {theySentRequest && (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity onPress={() => handleAccept(friendship!.id)} style={[styles.btn, { backgroundColor: '#4CAF50' }]}>
                                        <ThemedText style={styles.btnText}>Přijmout</ThemedText>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleReject(friendship!.id)} style={[styles.btn, { backgroundColor: '#F44336' }]}>
                                        <ThemedText style={styles.btnText}>Odmítnout</ThemedText>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {!friendship && (
                                <TouchableOpacity onPress={() => handleSendRequest(item.id)} style={[styles.btn, { backgroundColor: '#FF00AA' }]}>
                                    <ThemedText style={styles.btnText}>+ Přidat</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {(isAccepted || isMe) && (
                    <View style={[styles.details, { borderColor }]}>
                        <ThemedText style={[styles.detailText, { color: subTextColor }]}>Jméno: {item.jmeno} {item.prijmeni}</ThemedText>
                        <ThemedText style={[styles.detailText, { color: subTextColor }]}>E-mail: {item.email}</ThemedText>
                        {item.datum_narozeni && (
                            <ThemedText style={[styles.detailText, { color: subTextColor }]}>Narození: {formatDate(new Date(item.datum_narozeni))}</ThemedText>
                        )}
                    </View>
                )}
            </ThemedView>
        );
    };

    return (
        <ThemedSafeView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Lidé</ThemedText>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={users.map(u => ({
                        ...u,
                        friendship: friendships.find(f => 
                            (f.user_id.toString() === user?.id?.toString() && f.friend_id.toString() === u.id.toString()) || 
                            (f.friend_id.toString() === user?.id?.toString() && f.user_id.toString() === u.id.toString())
                        )
                    })).sort((a,b) => a.username.localeCompare(b.username))}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={styles.scrollContent}
                />
            )}
        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        paddingBottom: 8,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    badge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    btnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFF',
    },
    details: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    detailText: {
        fontSize: 14,
        marginBottom: 4,
    }
});
