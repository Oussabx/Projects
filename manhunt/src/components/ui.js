import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { avatarGradient, colors, fonts } from '../theme';

export function Screen({ children, style, edges = ['top', 'bottom'] }) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({ title, eyebrow, onBack, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? <RoundIcon name="chevron-back" onPress={onBack} label="Back" /> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {eyebrow ? <Eyebrow style={{ fontSize: 9 }}>{eyebrow}</Eyebrow> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

// Circular glassy icon button.
export function RoundIcon({ name, onPress, label, color = colors.white, size = 42 }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundIcon,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { transform: [{ scale: 0.92 }] },
      ]}
    >
      <Ionicons name={name} size={size * 0.48} color={color} />
    </Pressable>
  );
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return { scale, onPressIn: () => to(0.96), onPressOut: () => to(1) };
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, colorsOverride, height = 56 }) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  const primary = variant === 'primary';
  const ghost = variant === 'ghost';
  const grad = colorsOverride || [colors.orange, colors.orangeDeep];
  const content = loading ? (
    <ActivityIndicator color={colors.white} />
  ) : (
    <View style={styles.buttonInner}>
      {icon ? <Ionicons name={icon} size={19} color={primary ? colors.white : colors.sand} /> : null}
      <Text style={[styles.buttonText, !primary && { color: colors.sand, fontFamily: fonts.medium }]}>{title}</Text>
    </View>
  );
  return (
    <Animated.View
      style={[
        { transform: [{ scale }], borderRadius: 14 },
        primary && !disabled && { shadowColor: grad[0], shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
        (disabled || loading) && { opacity: 0.4 },
        style,
      ]}
    >
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled || loading}>
        {primary ? (
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, { height }]}>
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.button, { height }, !ghost && styles.buttonOutline]}>{content}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function Card({ children, style, glow }) {
  return (
    <View style={[styles.card, glow && { borderColor: glow }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export function Avatar({ name = '?', size = 40, ring }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={[
        { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, alignItems: 'center', justifyContent: 'center' },
        ring && { borderWidth: 2, borderColor: ring },
      ]}
    >
      <LinearGradient
        colors={avatarGradient(name)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: size * 0.42, letterSpacing: 0.5 }}>
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function Pill({ icon, label, color = colors.sand, bg = 'rgba(255,255,255,0.06)', style }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Field({ icon, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
      <TextInput placeholderTextColor={colors.graphite} style={styles.fieldInput} {...props} />
    </View>
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
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  headerSide: { width: 56 },
  headerTitle: { color: colors.white, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
  roundIcon: {
    backgroundColor: 'rgba(24,24,24,0.9)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonOutline: { borderWidth: 1, borderColor: colors.graphite, backgroundColor: 'rgba(20,20,20,0.7)' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.3 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6 },
  field: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,20,20,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  fieldInput: { flex: 1, height: '100%', color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  eyebrow: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.sand, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1 },
});
