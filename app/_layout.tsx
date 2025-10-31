import { AuthProvider } from '@/contexts/AuthContext'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useNotificationHandler } from '@/hooks/useNotificationHandler'
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Provider } from 'react-native-paper'
import 'react-native-reanimated'


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
                        <Stack initialRouteName="(login)">
                            <Stack.Screen
                                name="(login)"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="(tabs)"
                                options={{ headerShown: false }}
                            />
                            <Stack.Screen
                                name="modal"
                                options={{ presentation: 'modal', title: 'Modal' }}
                            />
                        </Stack>
                        <StatusBar style="auto" />
                    </AuthProvider>
                </ThemeProvider>
            </Provider>
        </GestureHandlerRootView>
    )
}
