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
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Provider } from 'react-native-paper'
import 'react-native-reanimated'
import { UnreadMessagesProvider } from '@/contexts/UnreadMessagesContext'
import { AppDataProvider } from '@/contexts/AppDataContext'
import { NetworkBanner } from '@/components/NetworkBanner'
import { WebNotificationPrompt } from '@/components/WebNotificationPrompt'
import { AppUpdatePrompt } from '@/components/AppUpdatePrompt'


function RootLayoutNav() {
    const { user, sessionLoading } = useAuth()
    const router = useRouter()
    const segments = useSegments()
    useNotificationHandler()

    useEffect(() => {
        if (sessionLoading) return;

        const root = segments[0] as string | undefined;
        // register / reset_password jsou mimo (login), ale musí zůstat veřejné
        const publicRoutes = new Set(['(login)', 'register', 'reset_password']);
        const isPublic = !!root && publicRoutes.has(root);

        if (!user && !isPublic) {
            router.replace('/(login)');
        } else if (user && root === '(login)') {
            // Po ověření recovery OTP zůstává uživatel na reset_password (veřejná route)
            router.replace('/(tabs)');
        }

        // Vynuceně skryjeme splash screen, jakmile máme jasno o přihlášení
        setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
        }, 500);

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
                options={{ title: 'Registrace' }}
            />
            <Stack.Screen
                name="reset_password"
                options={{ title: 'Obnova hesla' }}
            />
        </Stack>
    )
}

export default function RootLayout() {
    const colorScheme = useColorScheme()
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider>
                <ThemeProvider
                    value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
                >
                    <AuthProvider>
                        <AppDataProvider>
                            <UnreadMessagesProvider>
                                <NetworkBanner />
                                <RootLayoutNav />
                                <WebNotificationPrompt />
                                <AppUpdatePrompt />
                                <StatusBar style="auto" />
                            </UnreadMessagesProvider>
                        </AppDataProvider>
                    </AuthProvider>
                </ThemeProvider>
            </Provider>
        </GestureHandlerRootView>
    )
}
