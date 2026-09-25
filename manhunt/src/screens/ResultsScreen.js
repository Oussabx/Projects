import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Divider, Eyebrow, Screen } from '../components/ui';
import { TopoBackground } from '../components/TopoBackground';
import { backToLobby } from '../game/api';
import { formatClock, playerList, timeline } from '../game/logic';
import { usePings } from '../hooks/useLobby';
import { colors, fonts } from '../theme';

const HEADLINES = {
  hunters: { top: 'HUNTERS', bottom: 'WIN', color: colors.orange },
  runners: { top: 'RUNNERS', bottom: 'ESCAPE', color: colors.runner },
  none: { top: 'GAME', bottom: 'ENDED', color: colors.sand },
};

const REASONS = {
  caught: 'Every runner was caught.',
  time: 'Time ran out — the runners survived.',
  forfeit: 'The hunters left the game.',
  host: 'The host ended the game.',
};

export function ResultsScreen({ lobby, uid, onLeave }) {
  const pings = usePings(lobby.code, lobby.gameId);
  const { huntStartAt } = timeline(lobby);
  const players = playerList(lobby);
  const me = lobby.players[uid];
  const headline = HEADLINES[lobby.winner] || HEADLINES.none;
  const isHost = lobby.hostId === uid;
  const won =
    lobby.winner === 'none' ? null : (lobby.winner === 'hunters') === (me.role === 'hunter');
  const duration = lobby.endedAt ? formatClock(lobby.endedAt - lobby.startAt) : '--:--';

  const hunters = players.filter((p) => p.role === 'hunter');
  const runners = players.filter((p) => p.role === 'runner');

  return (
    <Screen>
      <TopoBackground />
      <ScrollView contentContainerStyle={styles.wrap}>
        <Eyebrow>Game over</Eyebrow>
        <Text style={styles.headline}>{headline.top}</Text>
        <Text style={[styles.headline, { color: headline.color, marginTop: -12 }]}>{headline.bottom}</Text>
        <Divider style={{ marginVertical: 18 }} color={headline.color} />
        <Text style={styles.reason}>{REASONS[lobby.endReason] || ''}</Text>
        {won !== null ? (
          <Text style={[styles.you, { color: won ? colors.runner : colors.orange }]}>{won ? 'You won.' : 'You lost.'}</Text>
        ) : null}

        <View style={styles.stats}>
          <Stat label="Game time" value={duration} />
          <Stat label="Pins dropped" value={String(pings.length)} />
          <Stat label="Caught" value={`${runners.filter((r) => r.caught).length}/${runners.length}`} />
        </View>

        <Eyebrow style={styles.section}>Runners</Eyebrow>
        {runners.map((r) => (
          <View key={r.id} style={styles.row}>
            <MaterialCommunityIcons name="run-fast" size={18} color={r.caught ? colors.graphite : colors.runner} />
            <Text style={styles.name}>{r.id === uid ? `${r.name} (you)` : r.name}</Text>
            <Text style={[styles.status, !r.caught && !r.left && { color: colors.runner }]}>
              {r.left
                ? 'Quit'
                : r.caught
                  ? `Caught at ${r.caughtAt ? formatClock(Math.max(0, r.caughtAt - huntStartAt)) : '—'}`
                  : 'Escaped'}
            </Text>
          </View>
        ))}

        <Eyebrow style={styles.section}>Hunters</Eyebrow>
        {hunters.map((h) => (
          <View key={h.id} style={styles.row}>
            <MaterialCommunityIcons name="car-sports" size={18} color={colors.orange} />
            <Text style={styles.name}>{h.id === uid ? `${h.name} (you)` : h.name}</Text>
            <Text style={styles.status}>
              {h.left ? 'Quit' : `${runners.filter((r) => r.caughtBy === h.id).length} caught`}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {isHost ? (
          <Button title="Play Again" icon="refresh" onPress={() => backToLobby(lobby.code)} />
        ) : (
          <Text style={styles.waiting}>Waiting for the host to start a rematch…</Text>
        )}
        <Button title="Leave" variant="outline" onPress={onLeave} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, paddingTop: 48 },
  headline: { color: colors.white, fontFamily: fonts.display, fontSize: 68, lineHeight: 84, marginTop: 6 },
  reason: { color: colors.sand, fontFamily: fonts.regular, fontSize: 15 },
  you: { fontFamily: fonts.semibold, fontSize: 15, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 28 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(22,22,22,0.9)',
  },
  statValue: { color: colors.white, fontFamily: fonts.semibold, fontSize: 20, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  section: { marginTop: 28, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { flex: 1, color: colors.white, fontFamily: fonts.medium, fontSize: 15 },
  status: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  footer: { paddingHorizontal: 28, paddingBottom: 12, gap: 10 },
  waiting: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginBottom: 4 },
});
