import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { createLeague } from '@/services/leagues/leagues';
import { TextInput, Button, Checkbox } from 'react-native-paper';

type ConfigKey =
  | 'track_elo'
  | 'track_average'
  | 'track_wins_losses'
  | 'track_positions'
  | 'track_score'
  | 'track_score_diff'
  | 'track_winrate'
  | 'track_form'
  | 'track_set_stats'
  | 'track_best_score'
  | 'track_last_played'
  | 'lower_is_better';

function OptionRow({
  label,
  help,
  checked,
  onPress,
}: {
  label: string;
  help: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress}>
      <Checkbox status={checked ? 'checked' : 'unchecked'} color="#FF00AA" />
      <View style={{ flex: 1 }}>
        <ThemedText>{label}</ThemedText>
        <ThemedText style={styles.help}>{help}</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

export default function CreateLeaderboardScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [teamSize, setTeamSize] = useState<number>(1);

  const [config, setConfig] = useState({
    track_elo: false,
    track_average: false,
    track_wins_losses: true,
    track_positions: false,
    track_score: false,
    track_score_diff: false,
    track_winrate: true,
    track_form: true,
    track_set_stats: false,
    track_best_score: false,
    track_last_played: false,
    lower_is_better: false,
  });

  const [loading, setLoading] = useState(false);

  const toggle = (key: ConfigKey, extras?: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key], ...extras }));
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setLoading(true);

    try {
      const league = await createLeague({
        name: name.trim(),
        sport_id: 'custom',
        team_size: teamSize,
        scoring_type: 'dynamic',
        config,
        created_by: String(user.id),
      });
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
          Nová vlastní tabulka
        </ThemedText>
        <ThemedText style={{ color: '#888', marginBottom: 20, fontSize: 13 }}>
          Tabulku uvidíš ty, tvoji přátelé a přátelé přátel. Zapsat výsledek může kdokoli, kdo ji vidí.
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
          {[1, 2, 3, 4, 5].map((size) => (
            <Button
              key={size}
              mode={teamSize === size ? 'contained' : 'outlined'}
              onPress={() => setTeamSize(size)}
            >
              {size}v{size}
            </Button>
          ))}
          <Button mode={teamSize === 0 ? 'contained' : 'outlined'} onPress={() => setTeamSize(0)}>
            Všichni proti všem
          </Button>
        </View>

        <ThemedText style={{ fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
          Statistiky a řazení
        </ThemedText>

        <OptionRow
          label="Výhry, remízy a prohry"
          help="Sloupec V–R–P: kolikrát hráč vyhrál, remízoval a prohrál."
          checked={config.track_wins_losses}
          onPress={() => toggle('track_wins_losses', { track_positions: false })}
        />

        {teamSize === 0 && (
          <OptionRow
            label="Pódiová umístění (1.–2.–3.)"
            help="Počet prvních, druhých a třetích míst (typicky FFA turnaje)."
            checked={config.track_positions}
            onPress={() => toggle('track_positions', { track_wins_losses: false })}
          />
        )}

        <OptionRow
          label="% výher"
          help="Podíl výher ze všech zápasů hráče (0–100 %)."
          checked={config.track_winrate}
          onPress={() => toggle('track_winrate')}
        />

        <OptionRow
          label="Forma (posledních 5)"
          help="Řetězec W/L/D z posledních pěti zápasů (např. WWLWD)."
          checked={config.track_form}
          onPress={() => toggle('track_form')}
        />

        <OptionRow
          label="ELO rating"
          help="Skill rating (start 1500). Po zápase se mění podle soupeře; u setů bere v úvahu sety i gamy."
          checked={config.track_elo}
          onPress={() => toggle('track_elo')}
        />

        <ThemedText style={{ fontSize: 13, color: '#888', marginTop: 12, marginBottom: 4 }}>
          Způsob skóre (vyber jedno)
        </ThemedText>

        <OptionRow
          label="Přesné skóre (góly / sety)"
          help="Ukládá skóre pro i proti soupeři. Umožní zápis po setech (padel, tenis…)."
          checked={config.track_score}
          onPress={() =>
            setConfig((prev) => ({
              ...prev,
              track_score: !prev.track_score,
              track_average: false,
              track_score_diff: !prev.track_score ? prev.track_score_diff : false,
              track_set_stats: !prev.track_score ? prev.track_set_stats : false,
              track_best_score: false,
            }))
          }
        />

        <OptionRow
          label="Průměr bodů na zápas"
          help="Součet bodů ÷ počet zápasů (bowling, šipky). Bez soupeřova skóre."
          checked={config.track_average}
          onPress={() =>
            setConfig((prev) => ({
              ...prev,
              track_average: !prev.track_average,
              track_score: false,
              track_score_diff: false,
              track_set_stats: false,
              track_best_score: !prev.track_average ? true : prev.track_best_score,
            }))
          }
        />

        {config.track_score && (
          <>
            <OptionRow
              label="Rozdíl skóre (+ / −)"
              help="Součet (skóre pro − skóre proti) přes všechny zápasy."
              checked={config.track_score_diff}
              onPress={() => toggle('track_score_diff')}
            />
            <OptionRow
              label="Sety a gamy"
              help="Součty vyhraných/prohraných setů a gamů z zápasů zapsaných po setech."
              checked={config.track_set_stats}
              onPress={() => toggle('track_set_stats')}
            />
          </>
        )}

        {config.track_average && (
          <OptionRow
            label="Nejlepší výkon"
            help="Nejvyšší (nebo nejnižší, pokud „menší vyhrává“) skóre v jednom zápase."
            checked={config.track_best_score}
            onPress={() => toggle('track_best_score')}
          />
        )}

        <OptionRow
          label="Poslední zápas"
          help="Datum posledního odehraného zápasu hráče."
          checked={config.track_last_played}
          onPress={() => toggle('track_last_played')}
        />

        {(config.track_score || config.track_average) && (
          <OptionRow
            label="Menší skóre vyhrává"
            help="Pro golf, běh atd. — nižší číslo = lepší výsledek."
            checked={config.lower_is_better}
            onPress={() => toggle('lower_is_better')}
          />
        )}

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={!name.trim() || loading}
          style={{ marginTop: 30, paddingVertical: 5 }}
          buttonColor="#FF00AA"
        >
          Založit tabulku
        </Button>

        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 10 }} textColor="#888">
          Zrušit
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 4,
  },
  help: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    lineHeight: 16,
  },
});
