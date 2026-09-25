import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Button, Card, Eyebrow, RoundIcon, Screen } from '../components/ui';
import { Logo } from '../components/Logo';
import { CodeBoxes } from '../components/CodeBoxes';
import { FadeIn, Glow, PulseRings, Skyline } from '../components/fx';
import { createLobby, joinLobby } from '../game/api';
import { signOut } from '../firebase';
import { ensureLocationPermission } from '../hooks/useMyLocation';
import { colors, fonts } from '../theme';

const STEPS = [
  { icon: 'run-fast', color: colors.runner, title: 'Runners flee', text: 'On foot, with a head start' },
  { icon: 'map-marker-radius', color: colors.orange, title: 'Pins drop', text: 'Locations, never live' },
  { icon: 'car-sports', color: colors.orange, title: 'Hunters drive', text: 'Track them & catch them' },
];

export function HomeScreen({ uid, name, onEnterLobby }) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState('home'); // home | join
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);

  async function requireLocation() {
    const res = await ensureLocationPermission();
    if (res.ok) return true;
    Alert.alert(
      'Location required',
      res.reason === 'services'
        ? 'Turn on location services on your phone — Manhunt is played in the real world.'
        : 'Manhunt needs your location to drop pins during the game. Allow location access in Settings.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
    );
    return false;
  }

  async function handleCreate() {
    setBusy('create');
    try {
      if (!(await requireLocation())) return;
      onEnterLobby(await createLobby(uid, name, true));
    } catch (e) {
      Alert.alert('Could not create lobby', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (code.length !== 5) return Alert.alert('Lobby code', 'Codes are 5 characters, e.g. 7X9KQ.');
    setBusy('join');
    try {
      if (!(await requireLocation())) return;
      await joinLobby(code, uid, name, true);
      onEnterLobby(code);
    } catch (e) {
      Alert.alert('Could not join', e.message);
    } finally {
      setBusy(null);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.topBar}>
            <Avatar name={name} size={40} ring={colors.orange} />
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ fontSize: 9 }}>Welcome back</Eyebrow>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <RoundIcon name="log-out-outline" onPress={confirmSignOut} label="Sign out" />
          </View>

          <View style={styles.hero}>
            <Glow size={width * 1.4} opacity={0.4} />
            <PulseRings size={width * 0.95} color={colors.orange} />
            <FadeIn>
              <Logo size={80} tagline />
            </FadeIn>
          </View>
          <Skyline width={width} height={90} style={{ marginTop: -60 }} />

          <View style={styles.body}>
            {mode === 'home' ? (
              <>
                <View style={styles.steps}>
                  {STEPS.map((s, i) => (
                    <FadeIn key={s.title} delay={120 + i * 90} style={{ flex: 1 }}>
                      <Card style={styles.step}>
                        <MaterialCommunityIcons name={s.icon} size={24} color={s.color} />
                        <Text style={styles.stepTitle}>{s.title}</Text>
                        <Text style={styles.stepText}>{s.text}</Text>
                      </Card>
                    </FadeIn>
                  ))}
                </View>
                <FadeIn delay={420} style={{ gap: 12 }}>
                  <Button title="Create Lobby" icon="add-circle" onPress={handleCreate} loading={busy === 'create'} />
                  <Button title="Join Lobby" icon="enter-outline" variant="outline" onPress={() => setMode('join')} />
                </FadeIn>
              </>
            ) : (
              <FadeIn style={{ gap: 14 }}>
                <Card style={styles.joinCard}>
                  <Eyebrow style={{ textAlign: 'center', marginBottom: 14 }}>Enter lobby code</Eyebrow>
                  <CodeBoxes value={code} onChange={setCode} autoFocus />
                  <Text style={styles.joinHint}>Ask the host for the 5-character code.</Text>
                </Card>
                <Button title="Join Game" icon="flash" onPress={handleJoin} loading={busy === 'join'} disabled={code.length !== 5} />
                <Button title="Back" variant="ghost" onPress={() => setMode('home')} height={44} />
              </FadeIn>
            )}
          </View>

          <Text style={styles.footer}>REAL PEOPLE · REAL PLACES · NO ESCAPE</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  name: { color: colors.white, fontFamily: fonts.bold, fontSize: 17, marginTop: 1 },
  hero: { height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, padding: 12, gap: 6 },
  stepTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 15, letterSpacing: 0.8, marginTop: 2 },
  stepText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
  joinCard: { padding: 20 },
  joinHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 14 },
  footer: {
    color: colors.graphite,
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 28,
    paddingBottom: 16,
  },
});
