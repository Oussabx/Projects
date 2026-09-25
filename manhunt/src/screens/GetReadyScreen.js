import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../components/ui';
import { CountdownRing } from '../components/CountdownRing';
import { PRESTART_MS, formatClock } from '../game/logic';
import { colors, fonts, roleColor } from '../theme';

export function GetReadyScreen({ lobby, me, now }) {
  const remaining = lobby.startAt - now;
  const role = me.role;
  const headStart = lobby.settings.headStartMin;

  return (
    <Screen style={styles.wrap}>
      <Text style={styles.title}>Get Ready</Text>
      <Text style={styles.sub}>Game starts in</Text>

      <View style={{ marginTop: 28 }}>
        <CountdownRing progress={remaining / PRESTART_MS} label={formatClock(remaining)} />
      </View>

      <View style={styles.roleBox}>
        <Text style={styles.roleLabel}>You're a</Text>
        <Text style={[styles.role, { color: roleColor(role) }]}>{role === 'runner' ? 'RUNNER' : 'HUNTER'}</Text>
      </View>

      <Text style={styles.body}>
        {role === 'runner'
          ? `You get a ${headStart}-minute head start.\nMove. Hide. Stay smart.`
          : `Runners get a ${headStart}-minute head start.\nGet in the car and wait for the first pin.`}
      </Text>

      <View style={styles.icons}>
        <MaterialCommunityIcons name="run-fast" size={34} color={colors.white} />
        <MaterialCommunityIcons name="run-fast" size={34} color={colors.graphite} />
        <MaterialCommunityIcons name={role === 'runner' ? 'run-fast' : 'car-sports'} size={34} color={roleColor(role)} />
      </View>

      <Text style={styles.watermark}>MANHUNT</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 40 },
  title: { color: colors.white, fontFamily: fonts.semibold, fontSize: 22 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  roleBox: { alignItems: 'center', marginTop: 30 },
  roleLabel: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14 },
  role: { fontFamily: fonts.display, fontSize: 44, letterSpacing: 1 },
  body: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  icons: { flexDirection: 'row', gap: 22, marginTop: 30 },
  watermark: {
    position: 'absolute',
    bottom: 40,
    color: colors.border,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1,
  },
});
