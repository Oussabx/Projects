import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Eyebrow, Pill, Screen } from '../components/ui';
import { FadeIn, Glow, PopIn, PulseRings, Streaks } from '../components/fx';
import { backToLobby } from '../game/api';
import { formatClock, playerList, timeline } from '../game/logic';
import { usePings } from '../hooks/useLobby';
import { colors, fonts } from '../theme';

const HEADLINES = {
  hunters: { top: 'HUNTERS', bottom: 'WIN', color: colors.orange, grad: [colors.orange, colors.orangeDeep], icon: 'car-sports' },
  runners: { top: 'RUNNERS', bottom: 'ESCAPE', color: colors.runner, grad: [colors.runner, colors.runnerDeep], icon: 'run-fast' },
  none: { top: 'GAME', bottom: 'ENDED', color: colors.sand, grad: ['#8C8C8C', '#4A4A4A'], icon: 'flag-checkered' },
};

const REASONS = {
  caught: 'Every runner was caught.',
  time: 'Time ran out — the runners survived.',
  forfeit: 'The hunters left the game.',
  host: 'The host ended the game.',
};

export function ResultsScreen({ lobby, uid, onLeave }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pings = usePings(lobby.code, lobby.gameId);
  const { huntStartAt } = timeline(lobby);
  const players = playerList(lobby);
  const me = lobby.players[uid];
  const h = HEADLINES[lobby.winner] || HEADLINES.none;
  const isHost = lobby.hostId === uid;
  const won = lobby.winner === 'none' ? null : (lobby.winner === 'hunters') === (me.role === 'hunter');
  const duration = lobby.endedAt ? formatClock(lobby.endedAt - lobby.startAt) : '--:--';

  const hunters = players.filter((p) => p.role === 'hunter');
  const runners = players.filter((p) => p.role === 'runner');
  const catches = (id) => runners.filter((r) => r.caughtBy === id).length;
  const topHunter = [...hunters].sort((a, b) => catches(b.id) - catches(a.id))[0];
  const mvp = lobby.winner === 'hunters' && topHunter && catches(topHunter.id) > 0 ? topHunter.id : null;

  return (
    <Screen edges={['top']}>
      <Glow color={h.color} size={width * 1.6} opacity={0.35} style={{ top: -width * 0.55, left: -width * 0.3 }} />
      <Streaks color={h.color} />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: 190 + insets.bottom }]}>
        <View style={styles.badgeWrap}>
          <PulseRings color={h.color} size={170} duration={2200} />
          <PopIn>
            <LinearGradient colors={h.grad} style={styles.badge}>
              <MaterialCommunityIcons name={h.icon} size={40} color={colors.white} />
            </LinearGradient>
          </PopIn>
        </View>

        <FadeIn delay={150} style={{ alignItems: 'center' }}>
          <Eyebrow>Game over</Eyebrow>
          <Text style={styles.headline}>{h.top}</Text>
          <Text style={[styles.headline, styles.headline2, { color: h.color, textShadowColor: h.color }]}>{h.bottom}</Text>
          <Text style={styles.reason}>{REASONS[lobby.endReason] || ''}</Text>
          {won !== null ? (
            <Pill
              icon={won ? 'trophy' : 'close-circle'}
              label={won ? 'YOU WON' : 'YOU LOST'}
              color={won ? colors.runner : colors.orange}
              bg={won ? colors.runnerDim : colors.orangeDim}
              style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 7 }}
            />
          ) : null}
        </FadeIn>

        <FadeIn delay={300} style={styles.stats}>
          <Stat icon="stopwatch-outline" label="Game time" value={duration} />
          <Stat icon="location-outline" label="Pins dropped" value={String(pings.length)} />
          <Stat icon="people-outline" label="Caught" value={`${runners.filter((r) => r.caught).length}/${runners.length}`} />
        </FadeIn>

        <FadeIn delay={420}>
          <Eyebrow style={styles.section}>Runners</Eyebrow>
          <Card>
            {runners.map((r, i) => (
              <View key={r.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Avatar name={r.name} size={34} ring={r.caught || r.left ? colors.graphite : colors.runner} />
                <Text style={styles.name} numberOfLines={1}>
                  {r.id === uid ? `${r.name} (you)` : r.name}
                </Text>
                {r.left ? (
                  <Pill label="QUIT" color={colors.muted} />
                ) : r.caught ? (
                  <Pill
                    icon="time-outline"
                    label={`CAUGHT ${r.caughtAt ? formatClock(Math.max(0, r.caughtAt - huntStartAt)) : ''}`}
                    color={colors.orange}
                    bg={colors.orangeDim}
                  />
                ) : (
                  <Pill icon="checkmark-circle" label="ESCAPED" color={colors.runner} bg={colors.runnerDim} />
                )}
              </View>
            ))}
          </Card>

          <Eyebrow style={styles.section}>Hunters</Eyebrow>
          <Card>
            {hunters.map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Avatar name={p.name} size={34} ring={colors.orange} />
                <Text style={styles.name} numberOfLines={1}>
                  {p.id === uid ? `${p.name} (you)` : p.name}
                </Text>
                {p.id === mvp ? <Pill icon="star" label="MVP" color={colors.black} bg={colors.orange} /> : null}
                <Text style={styles.catches}>
                  {p.left ? 'Quit' : `${catches(p.id)} `}
                  {!p.left ? <MaterialCommunityIcons name="handcuffs" size={14} color={colors.muted} /> : null}
                </Text>
              </View>
            ))}
          </Card>
        </FadeIn>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <LinearGradient colors={['rgba(11,11,11,0)', colors.black]} style={styles.fade} pointerEvents="none" />
        {isHost ? (
          <Button title="Play Again" icon="refresh" onPress={() => backToLobby(lobby.code)} />
        ) : (
          <View style={styles.waiting}>
            <MaterialCommunityIcons name="timer-sand" size={16} color={colors.muted} />
            <Text style={styles.waitingText}>Waiting for the host to start a rematch</Text>
          </View>
        )}
        <Button title="Leave" variant="outline" icon="exit-outline" onPress={onLeave} height={48} />
      </View>
    </Screen>
  );
}

function Stat({ icon, label, value }) {
  return (
    <Card style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.orange} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 20 },
  badgeWrap: { alignSelf: 'center', width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 86, height: 86, borderRadius: 26, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  headline: { color: colors.white, fontFamily: fonts.display, fontSize: 64, lineHeight: 74, letterSpacing: 1, marginTop: 4 },
  headline2: { marginTop: -10, textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 } },
  reason: { color: colors.sand, fontFamily: fonts.regular, fontSize: 15, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 26 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statValue: { color: colors.white, fontFamily: fonts.display, fontSize: 24, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
  section: { marginTop: 26, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  name: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
  catches: { color: colors.sand, fontFamily: fonts.display, fontSize: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, gap: 10, backgroundColor: colors.black },
  fade: { position: 'absolute', left: 0, right: 0, top: -50, height: 50 },
  waiting: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  waitingText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
});
