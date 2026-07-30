import { Brand } from '@/constants/brand'
import { Colors } from '@/constants/theme'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNotificationHandler } from '@/hooks/useNotificationHandler'
import { supabaseConfigError } from '@/lib/supabaseClient'
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from '@react-navigation/native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MD3DarkTheme, MD3LightTheme, Provider } from 'react-native-paper'
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
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="reset_password"
                options={{ headerShown: false }}
            />
        </Stack>
    )
}

export default function RootLayout() {
    const colorScheme = useColorScheme()
    const scheme = colorScheme ?? 'light'
    const paperTheme = useMemo(() => ({
        ...(scheme === 'dark' ? MD3DarkTheme : MD3LightTheme),
        colors: {
            ...(scheme === 'dark' ? MD3DarkTheme.colors : MD3LightTheme.colors),
            primary: Brand.primary,
            secondary: Brand.primaryMuted,
            background: Colors[scheme].background,
            surface: Colors[scheme].surface,
        },
    }), [scheme])

    const navTheme = useMemo(() => {
        const base = scheme === 'dark' ? DarkTheme : DefaultTheme
        return {
            ...base,
            colors: {
                ...base.colors,
                primary: Brand.primary,
                background: Colors[scheme].background,
                card: Colors[scheme].surface,
                text: Colors[scheme].text,
                border: Colors[scheme].border,
            },
        }
    }, [scheme])

    if (supabaseConfigError) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 24,
                    backgroundColor: Colors.light.background,
                }}
            >
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: '700',
                        marginBottom: 8,
                        textAlign: 'center',
                    }}
                >
                    {Platform.OS === 'web'
                        ? 'Web není nakonfigurovaný'
                        : 'Aplikace není nakonfigurovaná'}
                </Text>
                <Text style={{ fontSize: 14, textAlign: 'center', opacity: 0.8, lineHeight: 20 }}>
                    {supabaseConfigError}
                </Text>
            </View>
        )
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider theme={paperTheme}>
                <ThemeProvider value={navTheme}>
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
