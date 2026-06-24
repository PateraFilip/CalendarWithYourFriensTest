import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { createLeague } from '@/services/leagues/leagues';
import { TextInput, Button, Checkbox } from 'react-native-paper';

export default function CreateLeaderboardScreen() {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [sportName, setSportName] = useState('');
    
    const [teamSize, setTeamSize] = useState<number>(1);
    
    const [config, setConfig] = useState({
        track_elo: false,
        track_average: false,
        track_wins_losses: true,
        track_positions: false,
        track_score: false,
        track_score_diff: false,
        lower_is_better: false,
    });


    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!user || !name.trim()) return;
        setLoading(true);

        const payload = {
            name: name.trim(),
            sport_id: 'custom', 
            team_size: teamSize,
            scoring_type: 'dynamic', // už není relevantní, řazení se řeší dynamicky
            config: config,
            created_by: user.id
        };

        try {
            const league = await createLeague(payload);
            router.replace(`/leaderboards/${league.id}`);
        } catch (e) {
            console.error('Create error:', e);
            alert('Chyba při vytváření tabulky');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
                    Nová Vlastní Tabulka
                </ThemedText>

                <TextInput
                    label="Název tabulky (např. Naše nedělní liga)"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    style={{ marginBottom: 20 }}
                />

                <ThemedText style={{ fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>Velikost týmu</ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    {[1, 2, 3, 4, 5].map(size => (
                        <Button 
                            key={size}
                            mode={teamSize === size ? "contained" : "outlined"}
                            onPress={() => setTeamSize(size)}
                        >
                            {size}v{size}
                        </Button>
                    ))}
                    <Button 
                        mode={teamSize === 0 ? "contained" : "outlined"}
                        onPress={() => setTeamSize(0)}
                    >
                        Všichni proti všem
                    </Button>
                </View>

                <ThemedText style={{ fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>Zobrazované statistiky</ThemedText>
                <View style={{ marginBottom: 20 }}>
                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_wins_losses: !config.track_wins_losses, track_positions: false})}>
                        <Checkbox status={config.track_wins_losses ? 'checked' : 'unchecked'} color="#FF00AA" />
                        <ThemedText>Výhry, Prohry a Remízy</ThemedText>
                    </TouchableOpacity>

                    {teamSize === 0 && (
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_positions: !config.track_positions, track_wins_losses: false})}>
                            <Checkbox status={config.track_positions ? 'checked' : 'unchecked'} color="#FF00AA" />
                            <ThemedText>Pódiová umístění (1. - 2. - 3. místo)</ThemedText>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_elo: !config.track_elo})}>
                        <Checkbox status={config.track_elo ? 'checked' : 'unchecked'} color="#FF00AA" />
                        <ThemedText>ELO Rating</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_average: !config.track_average})}>
                        <Checkbox status={config.track_average ? 'checked' : 'unchecked'} color="#FF00AA" />
                        <ThemedText>Průměr (bodů na zápas)</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_score: !config.track_score})}>
                        <Checkbox status={config.track_score ? 'checked' : 'unchecked'} color="#FF00AA" />
                        <ThemedText>Přesné Skóre (uhrané góly / sety)</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, track_score_diff: !config.track_score_diff})}>
                        <Checkbox status={config.track_score_diff ? 'checked' : 'unchecked'} color="#FF00AA" />
                        <ThemedText>Rozdíl skóre (+ / -)</ThemedText>
                    </TouchableOpacity>

                    {(config.track_score || config.track_average) && (
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setConfig({...config, lower_is_better: !config.lower_is_better})}>
                            <Checkbox status={config.lower_is_better ? 'checked' : 'unchecked'} color="#FF00AA" />
                            <ThemedText>Menší skóre vyhrává (Golf, běh, atd.)</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>

                <Button 
                    mode="contained" 
                    onPress={handleCreate} 
                    loading={loading}
                    disabled={!name.trim() || loading}
                    style={{ marginTop: 30, paddingVertical: 5 }}
                    buttonColor="#FF00AA"
                >
                    Založit Tabulku
                </Button>

                <Button 
                    mode="text" 
                    onPress={() => router.back()} 
                    style={{ marginTop: 10 }}
                    textColor="#888"
                >
                    Zrušit
                </Button>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    }
});
