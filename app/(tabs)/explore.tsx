import { StyleSheet } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@/hooks/useAuth'

export default function TabTwoScreen() {
    const { user } = useAuth()
    return (
        <ThemedView style={styles.titleContainer}>
            <ThemedText>Přezdívka: {user?.username}</ThemedText>
            <ThemedText>Jméno: {user?.name}</ThemedText>
            <ThemedText>Příjmení: {user?.lastname}</ThemedText>
            <ThemedText>Email: {user?.email}</ThemedText>
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
