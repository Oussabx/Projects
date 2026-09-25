import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Eyebrow, Screen } from '../components/ui';
import { CountdownRing } from '../components/CountdownRing';
import { Breathe, FadeIn, Glow, PopIn, PulseRings } from '../components/fx';
import { PRESTART_MS, playerList } from '../game/logic';
import { colors, fonts, roleColor, roleGradient } from '../theme';

export function GetReadyScreen({ lobby, me, now }) {
  const { width } = useWindowDimensions();
  const remaining = Math.max(0, lobby.startAt - now);
  const secs = Math.ceil(remaining / 1000);
  const role = me.role;
  const accent = roleColor(role);
  const grad = roleGradient(role);
  const headStart = lobby.settings.headStartMin;
  const team = playerList(lobby).filter((p) => p.role === role);

  return (
    <Screen style={styles.wrap}>
      <LinearGradient colors={[role === 'runner' ? colors.runnerDim : colors.orangeDim, colors.black]} style={StyleSheet.absoluteFill} />
      <Glow color={accent} size={width * 1.5} opacity={0.3} style={{ top: 40 }} />

      <FadeIn style={{ alignItems: 'center' }}>
        <Eyebrow>Game starts in</Eyebrow>
        <Text style={styles.title}>GET READY</Text>
      </FadeIn>

      <View style={styles.ringWrap}>
        <PulseRings color={accent} size={300} duration={1000} count={2} />
        <CountdownRing progress={remaining / PRESTART_MS} size={230} color={grad[0]} color2={grad[1]}>
          <Breathe amount={0.06} duration={500}>
            <Text style={styles.secs}>{secs}</Text>
          </Breathe>
          <Text style={styles.secsLabel}>SECONDS</Text>
        </CountdownRing>
      </View>

      <PopIn delay={250} style={{ alignItems: 'center' }}>
        <Text style={styles.roleLabel}>YOU'RE A</Text>
        <View style={styles.roleRow}>
          <LinearGradient colors={grad} style={styles.roleIcon}>
            <MaterialCommunityIcons name={role === 'runner' ? 'run-fast' : 'car-sports'} size={30} color={colors.white} />
          </LinearGradient>
          <Text style={[styles.role, { color: accent, textShadowColor: accent }]}>{role === 'runner' ? 'RUNNER' : 'HUNTER'}</Text>
        </View>
      </PopIn>

      <FadeIn delay={500} style={{ alignItems: 'center', paddingHorizontal: 30 }}>
        <Text style={styles.body}>
          {role === 'runner'
            ? `You get a ${headStart}-minute head start. Move. Hide. Stay smart.`
            : `Runners get a ${headStart}-minute head start. Get in the car and wait for the first pin.`}
        </Text>
        <View style={styles.team}>
          {team.map((p) => (
            <View key={p.id} style={{ alignItems: 'center', width: 64 }}>
              <Avatar name={p.name} size={36} ring={accent} />
              <Text style={styles.teamName} numberOfLines={1}>
                {p.id === me.id ? 'You' : p.name}
              </Text>
            </View>
          ))}
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 36, overflow: 'hidden' },
  title: { color: colors.white, fontFamily: fonts.display, fontSize: 34, letterSpacing: 3, marginTop: 4 },
  ringWrap: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secs: { color: colors.white, fontFamily: fonts.display, fontSize: 88, lineHeight: 104 },
  secsLabel: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 3, marginTop: -6 },
  roleLabel: { color: colors.sand, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 4, marginTop: 6 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  roleIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  role: { fontFamily: fonts.display, fontSize: 64, lineHeight: 78, letterSpacing: 1, textShadowRadius: 26, textShadowOffset: { width: 0, height: 0 } },
  body: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  team: { flexDirection: 'row', gap: 6, marginTop: 20, justifyContent: 'center' },
  teamName: { color: colors.sand, fontFamily: fonts.medium, fontSize: 11, marginTop: 4 },
});
