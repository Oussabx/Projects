import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

export function CountdownRing({ progress, label, size = 220, stroke = 8, color = colors.orange }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.label, { fontSize: size * 0.22 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.white, fontFamily: fonts.medium, fontVariant: ['tabular-nums'] },
});
