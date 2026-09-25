import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Faint topographic contour lines, like the moodboard's backdrop.
function contour(cx, cy, radius, seed) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble =
      1 + 0.14 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2) + 0.05 * Math.cos(a * 2 + seed * 3);
    pts.push([cx + Math.cos(a) * radius * wobble, cy + Math.sin(a) * radius * wobble * 0.8]);
  }
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + 'Z';
}

export function TopoBackground({ opacity = 0.07 }) {
  const { width, height } = useWindowDimensions();
  const paths = useMemo(() => {
    const out = [];
    const centers = [
      [width * 0.15, height * 0.2, 1.3],
      [width * 0.9, height * 0.65, 2.1],
    ];
    for (const [cx, cy, seed] of centers) {
      for (let r = 30; r < Math.max(width, height) * 0.7; r += 26) {
        out.push(contour(cx, cy, r, seed + r / 90));
      }
    }
    return out;
  }, [width, height]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke="#FFFFFF" strokeOpacity={opacity} strokeWidth={1} fill="none" />
      ))}
    </Svg>
  );
}
