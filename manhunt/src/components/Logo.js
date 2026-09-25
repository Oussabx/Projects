import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function Logo({ size = 64, tagline = false }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.25 }]}>
        <Text style={{ color: colors.white }}>MAN</Text>
        <Text style={{ color: colors.orange }}>HUNT</Text>
      </Text>
      {tagline ? (
        <Text style={[styles.tagline, { fontSize: Math.max(10, size * 0.16) }]}>
          RUN  /  DRIVE  /  HIDE  /  HUNT
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: fonts.display, letterSpacing: 1 },
  tagline: { color: colors.sand, fontFamily: fonts.medium, letterSpacing: 4, marginTop: 2 },
});
