import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';

// Stopwatch-style ring: tick marks, a gradient progress arc, content in the middle.
export function CountdownRing({ progress, label, children, size = 220, stroke = 10, color = colors.orange, color2 }) {
  const id = useRef('ring' + Math.random().toString(36).slice(2, 8)).current;
  const r = (size - stroke) / 2 - 10;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const ticks = Array.from({ length: 60 });
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor={color2 || color} />
          </LinearGradient>
        </Defs>
        {ticks.map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const outer = size / 2 - 1;
          const inner = outer - (i % 5 === 0 ? 7 : 3);
          return (
            <Line
              key={i}
              x1={cx + Math.sin(a) * inner}
              y1={cx - Math.cos(a) * inner}
              x2={cx + Math.sin(a) * outer}
              y2={cx - Math.cos(a) * outer}
              stroke={i / 60 < clamped ? color : colors.graphite}
              strokeOpacity={i % 5 === 0 ? 0.9 : 0.5}
              strokeWidth={1.5}
            />
          );
        })}
        <Circle cx={cx} cy={cx} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      {children || <Text style={[styles.label, { fontSize: size * 0.2 }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.white, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
});
