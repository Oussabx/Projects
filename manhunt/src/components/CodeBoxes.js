import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeCode } from '../game/logic';
import { colors, fonts } from '../theme';

// Five letter tiles backed by one hidden input. Read-only when `onChange` is omitted.
export function CodeBoxes({ value = '', onChange, autoFocus, size = 54 }) {
  const input = useRef(null);
  const chars = value.padEnd(5, ' ').split('');
  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row} disabled={!onChange}>
      {chars.map((c, i) => {
        const active = onChange && i === Math.min(value.length, 4);
        const filled = c.trim();
        return (
          <View
            key={i}
            style={[
              styles.box,
              { width: size, height: size * 1.18 },
              filled && styles.boxFilled,
              active && styles.boxActive,
            ]}
          >
            <Text style={[styles.char, { fontSize: size * 0.52 }]}>{c}</Text>
          </View>
        );
      })}
      {onChange ? (
        <TextInput
          ref={input}
          value={value}
          onChangeText={(t) => onChange(normalizeCode(t))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          maxLength={5}
          caretHidden
          style={styles.hidden}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,20,20,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.graphite, backgroundColor: colors.card },
  boxActive: { borderColor: colors.orange, borderWidth: 2 },
  char: { color: colors.white, fontFamily: fonts.display, letterSpacing: 1 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
