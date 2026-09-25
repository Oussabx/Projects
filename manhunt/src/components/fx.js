import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

// Soft radial light, used behind logos and headline moments.
const uid = () => 'fx' + Math.random().toString(36).slice(2, 9);

export function Glow({ color = colors.orange, size = 420, opacity = 0.45, style }) {
  const id = useRef(uid()).current;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

// Radar-style rings expanding outward on a loop.
export function PulseRings({ color = colors.orange, size = 220, count = 3, duration = 2600 }) {
  const values = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((duration / count) * i),
          Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [values, duration, count]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: color,
            opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

// Gentle breathing scale for a hero element.
export function Breathe({ children, amount = 0.04, duration = 1800, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [v, duration]);
  return (
    <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amount] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Fade + rise in on mount; `delay` staggers lists.
export function FadeIn({ children, delay = 0, from = 16, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

// Pop-in for dramatic reveals.
export function PopIn({ children, delay = 0, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

// Dusk city skyline, echoing the moodboard photography.
const SKYLINE =
  'M0,120 L0,78 L14,78 L14,62 L26,62 L26,84 L38,84 L38,50 L46,50 L46,40 L54,40 L54,50 L62,50 L62,88 L78,88 L78,66 L92,66 L92,92 ' +
  'L104,92 L104,30 L110,30 L110,14 L114,14 L114,30 L120,30 L120,80 L134,80 L134,58 L150,58 L150,94 L162,94 L162,70 L176,70 L176,44 ' +
  'L186,44 L186,36 L196,36 L196,44 L206,44 L206,86 L222,86 L222,64 L236,64 L236,96 L250,96 L250,54 L258,54 L258,24 L264,24 L264,54 ' +
  'L272,54 L272,90 L288,90 L288,72 L302,72 L302,48 L316,48 L316,98 L330,98 L330,68 L346,68 L346,84 L360,84 L360,56 L374,56 L374,92 ' +
  'L390,92 L390,120 Z';

export function Skyline({ width, height = 160, style }) {
  const id = useRef(uid()).current;
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox="0 0 390 120" preserveAspectRatio="none">
        <Defs>
          <SvgLinear id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.orange} stopOpacity="0" />
            <Stop offset="0.7" stopColor={colors.orange} stopOpacity="0.28" />
            <Stop offset="1" stopColor="#FF8A3D" stopOpacity="0.45" />
          </SvgLinear>
          <SvgLinear id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A1A1A" />
            <Stop offset="1" stopColor={colors.black} />
          </SvgLinear>
        </Defs>
        <Rect x="0" y="0" width="390" height="120" fill={`url(#${id}s)`} />
        <Path d={SKYLINE} fill={`url(#${id}c)`} />
      </Svg>
    </View>
  );
}

// Diagonal light streaks, like car tail-lights in the moodboard.
export function Streaks({ style, color = colors.orange }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path d="M-10,72 L110,40" stroke={color} strokeOpacity={0.22} strokeWidth={0.4} />
        <Path d="M-10,78 L110,48" stroke={color} strokeOpacity={0.12} strokeWidth={0.25} />
        <Path d="M-10,84 L110,58" stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={0.2} />
      </Svg>
    </View>
  );
}
