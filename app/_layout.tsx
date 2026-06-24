import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNotificationHandler } from '@/hooks/useNotificationHandler'
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from '@react-navigation/native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Provider } from 'react-native-paper'
import 'react-native-reanimated'
import { UnreadMessagesProvider } from '@/contexts/UnreadMessagesContext'


function RootLayoutNav() {
    const { user, sessionLoading } = useAuth()
    const router = useRouter()
    const segments = useSegments()

    useEffect(() => {
        if (sessionLoading) return;

        const inAuthGroup = segments[0] === '(login)';

        if (!user && !inAuthGroup) {
            router.replace('/(login)');
        } else if (user && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [user, sessionLoading, segments]);

    if (sessionLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        )
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(login)" />
            <Stack.Screen
                name="register"
                options={{ presentation: 'modal', title: 'Registrace' }}
            />
            <Stack.Screen
                name="reset_password"
                options={{ presentation: 'modal', title: 'Obnova hesla' }}
            />
        </Stack>
    )
}

export default function RootLayout() {
    const colorScheme = useColorScheme()
    useNotificationHandler()
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider>
                <ThemeProvider
                    value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
                >
                    <AuthProvider>
                        <UnreadMessagesProvider>
                            <RootLayoutNav />
                            <StatusBar style="auto" />
                        </UnreadMessagesProvider>
                    </AuthProvider>
                </ThemeProvider>
            </Provider>
        </GestureHandlerRootView>
    )
}
