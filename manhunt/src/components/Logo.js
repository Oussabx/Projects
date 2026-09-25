import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function Logo({ size = 64, tagline = false }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={[
          styles.word,
          { fontSize: size, lineHeight: size * 1.22 },
        ]}
      >
        <Text style={{ color: colors.white }}>MAN</Text>
        <Text style={styles.hunt}>HUNT</Text>
      </Text>
      {tagline ? (
        <View style={styles.taglineRow}>
          {['RUN', 'DRIVE', 'HIDE', 'HUNT'].map((w, i) => (
            <Text key={w} style={[styles.tagline, { fontSize: Math.max(10, size * 0.15) }]}>
              {i ? <Text style={{ color: colors.orange }}>{'  /  '}</Text> : null}
              {w}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  word: {
    fontFamily: fonts.display,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 6 },
  },
  hunt: {
    color: colors.orange,
    textShadowColor: 'rgba(255,75,43,0.55)',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  taglineRow: { flexDirection: 'row', marginTop: 4 },
  tagline: { color: colors.sand, fontFamily: fonts.semibold, letterSpacing: 4 },
});
