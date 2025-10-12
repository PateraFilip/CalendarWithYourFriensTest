import { ThemedView } from '@/components/themed-view'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Card, TextInput } from 'react-native-paper'

export default function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const router = useRouter()

    const handleLogin = () => {
        // TODO: Implement login logic
        console.log('Login with:', username, password)

        router.replace('/(tabs)')
    }

    return (
        <ThemedView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <TextInput
                        label="Uživatelské jméno"
                        value={username}
                        onChangeText={setUsername}
                        mode="outlined"
                        style={styles.input}
                    />
                    <TextInput
                        label="Heslo"
                        value={password}
                        onChangeText={setPassword}
                        mode="outlined"
                        secureTextEntry
                        style={styles.input}
                    />
                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        style={styles.button}
                    >
                        Přihlásit se
                    </Button>
                </Card.Content>
            </Card>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        marginBottom: 20,
    },
    modalContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '90%',
        maxWidth: 400,
        paddingVertical: 10,
    },
    input: {
        marginBottom: 15,
    },
    button: {
        marginTop: 10,
    },
})
