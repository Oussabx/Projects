import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Field, Screen } from '../components/ui';
import { Logo } from '../components/Logo';
import { FadeIn, Glow, Skyline } from '../components/fx';
import { authErrorMessage, logIn, resetPassword, signUp } from '../firebase';
import { colors, fonts } from '../theme';

const USERNAME_RE = /^[A-Za-z0-9 _.-]{2,16}$/;

export function AuthScreen({ onSignedUp }) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState('signup'); // signup | login
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (mode === 'signup' && !USERNAME_RE.test(username.trim())) {
      return Alert.alert('Username', 'Use 2–16 letters, numbers, spaces, dots or dashes.');
    }
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Enter your email and password.');
    setBusy(true);
    try {
      if (mode === 'signup') onSignedUp(await signUp({ username, email, password }));
      else await logIn({ email, password });
    } catch (e) {
      Alert.alert(mode === 'signup' ? 'Could not sign up' : 'Could not log in', authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return Alert.alert('Reset password', 'Type your email above first.');
    try {
      await resetPassword(email);
      Alert.alert('Check your inbox', `We sent a reset link to ${email.trim()}.`);
    } catch (e) {
      Alert.alert('Reset password', authErrorMessage(e));
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Glow size={width * 1.3} opacity={0.35} style={{ top: -width * 0.35 }} />
            <FadeIn>
              <Logo size={68} tagline />
            </FadeIn>
            <FadeIn delay={150}>
              <Text style={styles.script}>Same city. Different sides.{'\n'}Let the chase begin.</Text>
            </FadeIn>
            <Skyline width={width} height={110} style={styles.skyline} />
          </View>

          <FadeIn delay={250} style={styles.form}>
            <View style={styles.segment}>
              {[
                ['signup', 'Sign up'],
                ['login', 'Log in'],
              ].map(([key, label]) => (
                <Pressable key={key} onPress={() => setMode(key)} style={styles.segmentItem}>
                  {mode === key ? (
                    <LinearGradient
                      colors={[colors.orange, colors.orangeDeep]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <Text style={[styles.segmentText, mode === key && { color: colors.white }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'signup' ? (
              <>
                <Field
                  icon="person-outline"
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={16}
                  textContentType="username"
                />
                <Text style={styles.hint}>This is the name other players see in lobbies and on the map.</Text>
              </>
            ) : null}
            <Field
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <View>
              <Field
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                onSubmitEditing={submit}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eye} hitSlop={10}>
                <Text style={styles.eyeText}>{showPw ? 'HIDE' : 'SHOW'}</Text>
              </Pressable>
            </View>

            <Button
              title={mode === 'signup' ? 'Create account' : 'Log in'}
              icon={mode === 'signup' ? 'flash' : 'log-in-outline'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: 8 }}
            />
            {mode === 'login' ? (
              <Pressable onPress={forgot} style={{ alignSelf: 'center', padding: 8 }}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            ) : null}
          </FadeIn>

          <Text style={styles.footer}>REAL PEOPLE · REAL PLACES · NO ESCAPE</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 48, overflow: 'hidden' },
  script: {
    color: colors.sand,
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: 1,
    transform: [{ rotate: '-3deg' }],
    opacity: 0.9,
  },
  skyline: { marginTop: 18 },
  form: { paddingHorizontal: 24, gap: 12, marginTop: 6 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 6,
  },
  segmentItem: { flex: 1, height: 42, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: -4, marginLeft: 4 },
  eye: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { color: colors.orange, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5 },
  link: { color: colors.sand, fontFamily: fonts.medium, fontSize: 13, textDecorationLine: 'underline' },
  footer: {
    color: colors.graphite,
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 'auto',
    paddingVertical: 24,
  },
});
