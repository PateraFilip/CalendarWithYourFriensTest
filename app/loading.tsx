import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'
import { ActivityIndicator } from 'react-native-paper'

export default function Loading() {
    const spinnerColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

    return (
        <ThemedView
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
            <ActivityIndicator size="large" color={spinnerColor} />
        </ThemedView>
    )
}
