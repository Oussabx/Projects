import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, Eyebrow, Divider } from '../components/ui';
import { Logo } from '../components/Logo';
import { colors, fonts } from '../theme';

// Shown when the Firebase keys are missing from .env.
export function SetupScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Logo size={56} />
        <Divider style={{ marginVertical: 24, alignSelf: 'center' }} />
        <Eyebrow>Setup needed</Eyebrow>
        <Text style={styles.title}>Connect a Firebase project</Text>
        <Text style={styles.body}>
          Manhunt syncs lobbies and location pins through Firebase. Copy{' '}
          <Text style={styles.code}>.env.example</Text> to <Text style={styles.code}>.env</Text>, paste your
          Firebase web config values, then restart with <Text style={styles.code}>npx expo start -c</Text>.
        </Text>
        <View style={styles.box}>
          <Text style={styles.step}>1. Create a project at console.firebase.google.com</Text>
          <Text style={styles.step}>2. Build → Authentication → enable Email/Password</Text>
          <Text style={styles.step}>3. Build → Firestore Database → create</Text>
          <Text style={styles.step}>4. Deploy the rules in firestore.rules</Text>
          <Text style={styles.step}>5. Project settings → add a Web app → copy config into .env</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, paddingTop: 60 },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 22, marginTop: 8 },
  body: { color: colors.sand, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 12 },
  code: { fontFamily: fonts.semibold, color: colors.orange },
  box: { marginTop: 24, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
  step: { color: colors.sand, fontFamily: fonts.regular, fontSize: 14 },
});
