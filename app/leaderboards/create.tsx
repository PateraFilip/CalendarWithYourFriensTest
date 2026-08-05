import { LeagueCover } from '@/components/LeagueCover';
import { BackButton } from '@/components/BackButton';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createLeague } from '@/services/leagues/leagues';
import {
  pickLeagueImage,
  updateLeagueImageUrl,
  uploadLeagueCover,
  type PickedLeagueImage,
} from '@/services/leagues/league_image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

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

type Surfaces = (typeof BrandSurfaces)['light'];

function SectionLabel({
  children,
  color,
}: {
  children: string;
  color: string;
}) {
  return <ThemedText style={[styles.sectionLabel, { color }]}>{children}</ThemedText>;
}

function OptionRow({
  label,
  help,
  checked,
  onPress,
  surfaces,
  accent,
  last,
}: {
  label: string;
  help: string;
  checked: boolean;
  onPress: () => void;
  surfaces: Surfaces;
  accent: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: surfaces.border,
        },
      ]}
    >
      <View style={styles.optionText}>
        <ThemedText style={[styles.optionTitle, { color: surfaces.text }]}>
          {label}
        </ThemedText>
        <ThemedText style={[styles.optionHelp, { color: surfaces.textSecondary }]}>
          {help}
        </ThemedText>
      </View>
      <Switch value={checked} onValueChange={() => onPress()} color={accent} />
    </Pressable>
  );
}

export default function CreateLeaderboardScreen() {
  const { user } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary;
  const onAccent = scheme === 'dark' ? '#0B1220' : Brand.onPrimary;

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
    /** Plný set = N bodů (Elo). null = Auto z historie. */
    set_points_to: null as number | null,
  });
  const [loading, setLoading] = useState(false);
  const [cover, setCover] = useState<PickedLeagueImage | null>(null);

  const setPointsPresets: { value: number | null; label: string; hint?: string }[] = [
    { value: null, label: 'Auto', hint: 'podle historie' },
    { value: 6, label: '6', hint: 'padel' },
    { value: 11, label: '11' },
    { value: 15, label: '15' },
    { value: 21, label: '21', hint: 'badminton' },
  ];

  const toggle = (key: ConfigKey, extras?: Partial<typeof config>) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key], ...extras }));
  };

  const handlePickCover = async () => {
    const picked = await pickLeagueImage();
    if (picked) setCover(picked);
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

      if (cover) {
        try {
          const url = await uploadLeagueCover(String(user.id), league.id, cover);
          await updateLeagueImageUrl(league.id, url);
        } catch (imgErr) {
          console.error('Cover upload failed:', imgErr);
          alert(
            'Tabulka vznikla, ale obrázek se nepodařilo nahrát. Můžeš ho doplnit v detailu.'
          );
        }
      }

      router.replace(`/leaderboards/${league.id}`);
    } catch (e) {
      console.error('Create error:', e);
      alert('Chyba při vytváření tabulky');
    } finally {
      setLoading(false);
    }
  };

  const teamOptions = [
    { value: 1, label: '1v1' },
    { value: 2, label: '2v2' },
    { value: 3, label: '3v3' },
    { value: 4, label: '4v4' },
    { value: 5, label: '5v5' },
    { value: 0, label: 'FFA' },
  ];

  return (
    <ThemedSafeView style={[styles.container, { backgroundColor: surfaces.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <BackButton
          fallbackHref="/(tabs)/tabulky"
          color={surfaces.text}
          style={styles.backBtn}
          accessibilityLabel="Zpět"
        />
        <ThemedText style={[styles.topTitle, { color: surfaces.text }]}>
          Nová tabulka
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardScreen scroll contentContainerStyle={styles.scroll}>
        <ThemedText style={[styles.subtitle, { color: surfaces.textSecondary }]}>
          Uvidíš ji ty, přátelé a přátelé přátel. Výsledek může zapsat kdokoli, kdo ji
          vidí.
        </ThemedText>

        <Pressable
          onPress={handlePickCover}
          style={[styles.coverCard, { backgroundColor: surfaces.surface }]}
        >
          {cover ? (
            <Image source={{ uri: cover.uri }} style={styles.coverPreview} />
          ) : (
            <LeagueCover size={112} mine />
          )}
          <View style={styles.coverMeta}>
            <ThemedText style={[styles.coverTitle, { color: surfaces.text }]}>
              Obrázek tabulky
            </ThemedText>
            <ThemedText style={{ color: accent, fontWeight: '600' }}>
              {cover ? 'Změnit fotku' : 'Vybrat z galerie'}
            </ThemedText>
            {cover && (
              <Pressable onPress={() => setCover(null)} hitSlop={8}>
                <ThemedText style={{ color: Brand.danger, marginTop: 4 }}>
                  Odebrat
                </ThemedText>
              </Pressable>
            )}
          </View>
          <MaterialCommunityIcons
            name="camera-plus-outline"
            size={22}
            color={surfaces.textSecondary}
          />
        </Pressable>

        <SectionLabel color={surfaces.textSecondary}>Základ</SectionLabel>
        <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
          <TextInput
            label="Název tabulky"
            placeholder="např. Naše nedělní liga"
            value={name}
            onChangeText={setName}
            mode="outlined"
            activeOutlineColor={accent}
            outlineColor={surfaces.border}
            textColor={surfaces.text}
            style={[styles.nameInput, { backgroundColor: surfaces.surfaceElevated }]}
          />
        </View>

        <SectionLabel color={surfaces.textSecondary}>Formát</SectionLabel>
        <View style={[styles.group, styles.chipGroup, { backgroundColor: surfaces.surface }]}>
          <View style={styles.chipRow}>
            {teamOptions.map((opt) => {
              const selected = teamSize === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setTeamSize(opt.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? Brand.primarySoft
                        : surfaces.surfaceElevated,
                      borderColor: selected ? accent : surfaces.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.chipLabel,
                      { color: selected ? accent : surfaces.text },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={[styles.chipHint, { color: surfaces.textSecondary }]}>
            {teamSize === 0
              ? 'Všichni proti všem (FFA)'
              : `Týmy po ${teamSize} hráči`}
          </ThemedText>
        </View>

        <SectionLabel color={surfaces.textSecondary}>Statistiky</SectionLabel>
        <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
          <OptionRow
            label="Výhry, remízy a prohry"
            help="Sloupec V–R–P"
            checked={config.track_wins_losses}
            onPress={() => toggle('track_wins_losses', { track_positions: false })}
            surfaces={surfaces}
            accent={accent}
          />
          {teamSize === 0 && (
            <OptionRow
              label="Pódiová umístění (1.–2.–3.)"
              help="Typicky FFA turnaje"
              checked={config.track_positions}
              onPress={() => toggle('track_positions', { track_wins_losses: false })}
              surfaces={surfaces}
              accent={accent}
            />
          )}
          <OptionRow
            label="% výher"
            help="Podíl výher ze všech zápasů"
            checked={config.track_winrate}
            onPress={() => toggle('track_winrate')}
            surfaces={surfaces}
            accent={accent}
          />
          <OptionRow
            label="Forma (posledních 5)"
            help="např. WWLWD"
            checked={config.track_form}
            onPress={() => toggle('track_form')}
            surfaces={surfaces}
            accent={accent}
          />
          <OptionRow
            label="ELO rating"
            help="Skill rating, start 1500"
            checked={config.track_elo}
            onPress={() => toggle('track_elo')}
            surfaces={surfaces}
            accent={accent}
            last
          />
        </View>

        <SectionLabel color={surfaces.textSecondary}>Skóre</SectionLabel>
        <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
          <OptionRow
            label="Přesné skóre (góly / sety)"
            help="Skóre pro i proti; zápis po setech"
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
            surfaces={surfaces}
            accent={accent}
          />
          <OptionRow
            label="Průměr bodů na zápas"
            help="Bowling, šipky… bez soupeřova skóre"
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
            surfaces={surfaces}
            accent={accent}
            last={!config.track_score && !config.track_average}
          />
          {config.track_score && (
            <>
              <OptionRow
                label="Rozdíl skóre (+ / −)"
                help="Součet (pro − proti)"
                checked={config.track_score_diff}
                onPress={() => toggle('track_score_diff')}
                surfaces={surfaces}
                accent={accent}
              />
              <OptionRow
                label="Zapisovat sety"
                help="Padel, tenis, badminton — výchozí zápis po setech + statistiky"
                checked={config.track_set_stats}
                onPress={() => toggle('track_set_stats')}
                surfaces={surfaces}
                accent={accent}
              />
              <View
                style={[
                  styles.setPointsBlock,
                  !config.track_average && { borderBottomWidth: 0 },
                  { borderBottomColor: surfaces.border },
                ]}
              >
                <ThemedText style={[styles.optionTitle, { color: surfaces.text }]}>
                  Délka setu
                </ThemedText>
                <ThemedText
                  style={[styles.optionHelp, { color: surfaces.textSecondary, marginBottom: 10 }]}
                >
                  Kolik bodů má plný set (pro Elo). Auto odvodí z historie zápasů.
                </ThemedText>
                <View style={styles.chipRow}>
                  {setPointsPresets.map((p) => {
                    const selected = config.set_points_to === p.value;
                    return (
                      <Pressable
                        key={String(p.value)}
                        onPress={() =>
                          setConfig((prev) => ({ ...prev, set_points_to: p.value }))
                        }
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? accent : surfaces.border,
                            backgroundColor: selected ? accent : 'transparent',
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.chipLabel,
                            { color: selected ? onAccent : surfaces.text },
                          ]}
                        >
                          {p.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}
          {config.track_average && (
            <OptionRow
              label="Nejlepší výkon"
              help="Nejvyšší / nejnižší skóre v zápase"
              checked={config.track_best_score}
              onPress={() => toggle('track_best_score')}
              surfaces={surfaces}
              accent={accent}
              last
            />
          )}
        </View>

        <SectionLabel color={surfaces.textSecondary}>Další</SectionLabel>
        <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
          <OptionRow
            label="Poslední zápas"
            help="Datum posledního zápasu hráče"
            checked={config.track_last_played}
            onPress={() => toggle('track_last_played')}
            surfaces={surfaces}
            accent={accent}
            last={!(config.track_score || config.track_average)}
          />
          {(config.track_score || config.track_average) && (
            <OptionRow
              label="Menší skóre vyhrává"
              help="Golf, běh…"
              checked={config.lower_is_better}
              onPress={() => toggle('lower_is_better')}
              surfaces={surfaces}
              accent={accent}
              last
            />
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={!name.trim() || loading}
          style={styles.createBtn}
          contentStyle={styles.createBtnContent}
          buttonColor={accent}
          textColor={onAccent}
          labelStyle={{ fontWeight: '700', fontSize: 16 }}
          icon="trophy"
        >
          Založit tabulku
        </Button>
      </KeyboardScreen>
    </ThemedSafeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
  },
  backBtn: { padding: 8, width: 40 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  coverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  coverPreview: { width: 96, height: 96, borderRadius: 48 },
  coverMeta: { flex: 1, gap: 2 },
  coverTitle: { fontSize: 16, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: { borderRadius: 16, overflow: 'hidden' },
  nameInput: { margin: 12 },
  chipGroup: { padding: 12, gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipLabel: { fontSize: 14, fontWeight: '700' },
  chipHint: { fontSize: 12, marginTop: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionHelp: { fontSize: 12, lineHeight: 16 },
  setPointsBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  createBtn: { marginTop: 28, borderRadius: 14 },
  createBtnContent: { paddingVertical: 6 },
});
