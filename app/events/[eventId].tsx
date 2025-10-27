import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'
import dayjs from 'dayjs'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'; // nebo jiná ikona
import React from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Button } from 'react-native-paper'


export default function EventDetail() {
    const router = useRouter()
    const { event: eventParam } = useLocalSearchParams<{ event: string }>()
    const eventObj = eventParam ? JSON.parse(eventParam) : null

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');


    if (!eventObj) return <ThemedSafeView><ThemedText>Event nenalezen</ThemedText></ThemedSafeView>

    const formatDate = (d: string | Date) => dayjs(d).format('DD. MM. YYYY')
    const formatTime = (d: string | Date) => dayjs(d).format('HH:mm')

    const handleEdit = () => {
        Alert.alert('in progress')
    }

    const handleDelete = () => {
        Alert.alert(
            'Smazat událost',
            'Opravdu chcete tuto událost smazat?',
            [
                { text: 'Zrušit', style: 'cancel' },
                {
                    text: 'Smazat',
                    style: 'destructive',
                    onPress: () => {
                        console.log('Smazat event', eventObj.id)
                        router.back()
                    }
                }
            ]
        )
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ThemedSafeView style={styles.container}>
                {/* Vlastní header uvnitř SafeArea */}
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Pressable onPress={() => router.back()} >
                        <ArrowLeft size={30} color={buttonColor} />
                    </Pressable>
                    <ThemedText type='subtitle' style={{ marginLeft: 20 }}>
                        Detail události
                    </ThemedText>
                </ThemedView>


                <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Název události</ThemedText>
                        <ThemedText>{eventObj.title}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Zakladatel ID</ThemedText>
                        <ThemedText>{eventObj.user_id}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Den</ThemedText>
                        <ThemedText>{eventObj.den || formatDate(eventObj.start)}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Od</ThemedText>
                        <ThemedText>{formatTime(eventObj.cas_od || eventObj.start)}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Do</ThemedText>
                        <ThemedText>{formatTime(eventObj.cas_do || eventObj.end)}</ThemedText>
                    </ThemedView>

                    <View style={styles.buttons}>
                        <Button
                            mode="contained"
                            onPress={handleEdit}
                            style={[styles.button, { backgroundColor: buttonColor }]}
                            labelStyle={{ color: buttonTextColor }}
                        >
                            Upravit
                        </Button>

                        <Button
                            mode="contained"
                            onPress={handleDelete}
                            style={[styles.button, { backgroundColor: 'red' }]}
                            labelStyle={{ color: '#fff' }}
                        >
                            Smazat
                        </Button>
                    </View>
                </ScrollView>
            </ThemedSafeView>
        </>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, paddingTop: 0 },
    field: { marginBottom: 16 },
    label: { fontWeight: '600', marginBottom: 4 },
    buttons: { flexDirection: 'column', marginTop: 24, gap: 12 },
    button: { borderRadius: 6, width: '100%' },
})
