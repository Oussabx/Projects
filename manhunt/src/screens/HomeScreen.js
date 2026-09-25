import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Divider, Eyebrow, Screen } from '../components/ui';
import { Logo } from '../components/Logo';
import { TopoBackground } from '../components/TopoBackground';
import { createLobby, joinLobby } from '../game/api';
import { normalizeCode } from '../game/logic';
import { ensureLocationPermission } from '../hooks/useMyLocation';
import { colors, fonts } from '../theme';

export function HomeScreen({ uid, initialName, onEnterLobby }) {
  const [name, setName] = useState(initialName || '');
  const [mode, setMode] = useState('home'); // home | join
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);

  const trimmed = name.trim();

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
    if (!trimmed) return Alert.alert('Your name', 'Enter a name so the others know who you are.');
    setBusy('create');
    try {
      if (!(await requireLocation())) return;
      const newCode = await createLobby(uid, trimmed, true);
      onEnterLobby(newCode, trimmed);
    } catch (e) {
      Alert.alert('Could not create lobby', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!trimmed) return Alert.alert('Your name', 'Enter a name so the others know who you are.');
    if (code.length !== 5) return Alert.alert('Lobby code', 'Codes are 5 characters, e.g. 7X9KQ.');
    setBusy('join');
    try {
      if (!(await requireLocation())) return;
      await joinLobby(code, uid, trimmed, true);
      onEnterLobby(code, trimmed);
    } catch (e) {
      Alert.alert('Could not join', e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <TopoBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <Logo size={78} tagline />
          <Divider style={{ marginTop: 28 }} />
        </View>

        <View style={styles.form}>
          <Eyebrow style={styles.label}>Your name</Eyebrow>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alex"
            placeholderTextColor={colors.graphite}
            maxLength={16}
            autoCorrect={false}
            style={styles.input}
          />

          {mode === 'home' ? (
            <View style={styles.actions}>
              <Button title="Create Lobby" onPress={handleCreate} loading={busy === 'create'} />
              <Button title="Join Lobby" variant="outline" onPress={() => setMode('join')} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Eyebrow style={styles.label}>Lobby code</Eyebrow>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(normalizeCode(t))}
                placeholder="7X9KQ"
                placeholderTextColor={colors.graphite}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                style={[styles.input, styles.codeInput]}
              />
              <Button title="Join" onPress={handleJoin} loading={busy === 'join'} />
              <Button title="Cancel" variant="ghost" onPress={() => setMode('home')} />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>REAL PEOPLE</Text>
          <Text style={styles.footerText}>REAL PLACES</Text>
          <Text style={styles.footerText}>NO ESCAPE.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  form: { paddingHorizontal: 28 },
  label: { marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(22,22,22,0.9)',
    color: colors.white,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  codeInput: { fontSize: 26, letterSpacing: 10, textAlign: 'center', fontFamily: fonts.semibold, marginBottom: 4 },
  actions: { marginTop: 22, gap: 12 },
  footer: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  footerText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 3 },
});
