import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Colors } from '@/constants/theme'
import { NewEventProvider, useNewEvent } from '@/contexts/NewEventContext'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/hooks/useAuth'
import { Tabs, useRouter, usePathname } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { FAB, Portal, Provider } from 'react-native-paper'

function FabButton() {
    const { openNewEvent } = useNewEvent();
    const router = useRouter();
    const pathname = usePathname();
    const [fabVisible, setFabVisible] = useState(true);

    // Skrýt FAB pokud jsme v chatu
    if (pathname.includes('/chats') || pathname.includes('/chat') || pathname.includes('/leaderboards')) {
        return null;
    }

    return (
        <>
            {fabVisible && (
                <>
                    <FAB
                        icon="cog"
                        style={{
                            position: 'absolute',
                            margin: 16,
                            marginRight: 5,
                            right: 0,
                            bottom: 170,
                            backgroundColor: '#666',
                            borderRadius: 30,
                        }}
                        color="white"
                        onPress={() => router.push('/(tabs)/settings')}
                    />
                    <FAB
                        icon="plus"
                        style={{
                            position: 'absolute',
                            margin: 16,
                            marginRight: 5,
                            right: 0,
                            bottom: 110,
                            backgroundColor: '#FF00AA',
                            borderRadius: 30,
                        }}
                        color="white"
                        onPress={() => {
                            if (pathname.includes('/tabulky')) {
                                router.push('/leaderboards/create');
                            } else {
                                openNewEvent();
                            }
                        }}
                    />
                    <FAB
                        icon="eye-off"
                        size="small"
                        style={{
                            position: 'absolute',
                            margin: 16,
                            marginRight: 5,
                            right: 0,
                            bottom: 70,
                            backgroundColor: '#666',
                            borderRadius: 30,
                        }}
                        color="white"
                        onPress={() => setFabVisible(false)}
                    />
                </>
            )}
            {!fabVisible && (
                <FAB
                    icon="eye"
                    size="small"
                    style={{
                        position: 'absolute',
                        margin: 16,
                        marginRight: 5,
                        right: 0,
                        bottom: 70,
                        backgroundColor: '#666',
                        borderRadius: 30,
                    }}
                    color="white"
                    onPress={() => setFabVisible(true)}
                />
            )}
        </>
    );
}

export default function TabLayout() {
    const colorScheme = useColorScheme()
    const { user } = useAuth()
    const router = useRouter()
    const { totalUnread } = useUnreadMessages()

    useEffect(() => {
        if (!user) {
            router.replace('/(login)')
        }
    }, [user]);

    return (
        <Provider>
            <Portal.Host>
                <NewEventProvider>
                    <Tabs
                        screenOptions={{
                            tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                            headerShown: false,
                            tabBarButton: HapticTab,
                            tabBarHideOnKeyboard: true,
                        }}
                    >
                        <Tabs.Screen
                            name="index"
                            options={{
                                title: 'Kalendář',
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="calendar.fill" color={color} />
                                ),
                            }}
                        />
                        <Tabs.Screen
                            name="myEvents"
                            options={{
                                title: 'Moje osa',
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="timeline.fill" color={color} />
                                ),
                            }}
                        />
                        <Tabs.Screen
                            name="chats"
                            options={{
                                title: 'Chaty',
                                tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="paperplane.fill" color={color} />
                                ),
                            }}
                        />
                        <Tabs.Screen
                            name="tabulky"
                            options={{
                                title: 'Tabulky',
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="list.bullet.rectangle.fill" color={color} />
                                ),
                            }}
                        />

                        <Tabs.Screen
                            name="explore"
                            options={{
                                title: 'Lidé',
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="person.fill" color={color} />
                                ),
                            }}
                        />
                        <Tabs.Screen
                            name="newEvent"
                            options={{ href: null }}
                        />
                        <Tabs.Screen
                            name="settings"
                            options={{ href: null }}
                        />
                    </Tabs>

                    <FabButton />
                </NewEventProvider>
            </Portal.Host>
        </Provider>
    )
}
