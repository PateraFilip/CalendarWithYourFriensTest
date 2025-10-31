import { HapticTab } from '@/components/haptic-tab'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/hooks/useAuth'
import { Tabs, useRouter } from 'expo-router'
import React, { useEffect } from 'react'

export default function TabLayout() {
    const colorScheme = useColorScheme()
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!user) {
            router.replace('/(login)')
        }
    }, [user]);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                headerShown: false,
                tabBarButton: HapticTab,
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
                name="explore"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol
                            size={28}
                            name="person.fill"
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="newEvent"
                options={{
                    title: 'Nová událost',
                    tabBarIcon: ({ color }) => (
                        <IconSymbol
                            size={28}
                            name="plus.circle.fill"
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    )
}
