import { ThemedView } from '@/components/themed-view';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )



    const handleLogin = async () => {
  try {
    const response = await fetch(
      "https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/smart-processor",
      {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw"
        }
        ,
        body: JSON.stringify({ username: email, password, action: "login" }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Přihlášení selhalo");
      return;
    }

    alert("Přihlášení úspěšné!");
    router.replace("/(tabs)");
  } catch (err) {
    console.error(err);
    alert("Chyba připojení");
  }
};


    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView style={styles.box}>
                <Image
                    source={require('@/assets/images/logo.png')}
                    style={styles.logo}
                />
                <TextInput
                    label="E-mail"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    style={styles.input}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="account-outline"
                                    size={20}
                                    color={buttonColor}
                                />
                            )}
                        />
                    }
                />

                <TextInput
                    label="Heslo"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="lock-outline"
                                    size={20}
                                    color={buttonColor}
                                />
                            )}
                        />
                    }
                />

                <Button
                    mode="contained"
                    style={styles.button}
                    labelStyle={{ color: buttonTextColor }}
                    buttonColor={buttonColor}
                    onPress={handleLogin}  // volání FastAPI
                >
                    Přihlásit se
                </Button>
                <View style={{ width: '100%' }}>
                    <Link
                        href="/modal"
                        style={{
                            color: buttonColor,
                            textAlign: 'left',
                            fontWeight: 'bold',
                        }}
                    >
                        Zapomenuté heslo
                    </Link>
                </View>
            </ThemedView>
        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    logo: {
        width: 300,
        height: 300,
        resizeMode: 'contain',
    },
    box: {
        width: '85%',
        borderRadius: 16,
        padding: 20,
        elevation: 4,
        gap: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    input: {
        width: '100%',
    },
    button: {
        borderRadius: 6,
        width: '100%',
    },
})
