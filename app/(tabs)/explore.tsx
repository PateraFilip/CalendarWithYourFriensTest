import { StyleSheet } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@/hooks/useAuth'

export default function TabTwoScreen() {
    const { user } = useAuth()
    return (
        <ThemedView style={styles.titleContainer}>
            <ThemedText>{user?.username}</ThemedText>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
})
