import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Brand } from '@/constants/brand'
import { Colors } from '@/constants/theme'
import { NewEventProvider } from '@/contexts/NewEventContext'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/hooks/useAuth'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { MD3DarkTheme, MD3LightTheme, Portal, Provider } from 'react-native-paper'

export default function TabLayout() {
    const colorScheme = useColorScheme()
    const { user } = useAuth()
    const router = useRouter()
    const { totalUnread } = useUnreadMessages()
    const scheme = colorScheme ?? 'light'
    const paperTheme = {
        ...(scheme === 'dark' ? MD3DarkTheme : MD3LightTheme),
        colors: {
            ...(scheme === 'dark' ? MD3DarkTheme.colors : MD3LightTheme.colors),
            primary: Brand.primary,
            secondary: Brand.primaryMuted,
        },
    }

    useEffect(() => {
        if (!user) {
            router.replace('/(login)')
        }
    }, [user]);

    return (
        <Provider theme={paperTheme}>
            <Portal.Host>
                <NewEventProvider>
                    <Tabs
                        screenOptions={{
                            tabBarActiveTintColor: Colors[scheme].tabIconSelected,
                            tabBarInactiveTintColor: Colors[scheme].tabIconDefault,
                            tabBarStyle: {
                                backgroundColor: Colors[scheme].surface,
                                borderTopColor: Colors[scheme].border,
                            },
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
                                href: null,
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
                            name="chats"
                            options={{
                                title: 'Oznámení',
                                tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="bell.fill" color={color} />
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
                            name="settings"
                            options={{
                                title: 'Nastavení',
                                tabBarIcon: ({ color }) => (
                                    <IconSymbol size={28} name="gearshape.fill" color={color} />
                                ),
                            }}
                        />
                        <Tabs.Screen
                            name="newEvent"
                            options={{ href: null }}
                        />
                    </Tabs>
                </NewEventProvider>
            </Portal.Host>
        </Provider>
    )
}
