import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

export function Screen({ children, style, edges = ['top', 'bottom'] }) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({ name, onPress, label, color = colors.white }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityLabel={label}>
      <Ionicons name={name} size={22} color={color} />
    </Pressable>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }) {
  const outline = variant === 'outline';
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        outline && styles.buttonOutline,
        ghost && styles.buttonGhost,
        (disabled || loading) && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={18} color={colors.white} /> : null}
          <Text style={[styles.buttonText, (outline || ghost) && { fontFamily: fonts.medium }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Divider({ width = 44, color = colors.orange, style }) {
  return <View style={[{ width, height: 3, backgroundColor: color, borderRadius: 2 }, style]} />;
}

export function Chip({ label, selected, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipSelected, disabled && !selected && { opacity: 0.35 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ label }) {
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.orange} size="large" />
      {label ? <Text style={[styles.eyebrow, { marginTop: 16 }]}>{label}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerSide: { width: 48 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  button: {
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.graphite },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 16 },
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.sand, fontFamily: fonts.medium, fontSize: 13, letterSpacing: 1 },
});
