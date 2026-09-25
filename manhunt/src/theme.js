// Palette taken from the Manhunt moodboard.
export const colors = {
  orange: '#FF4B2B',
  orangeDeep: '#D92E12',
  orangeGlow: 'rgba(255, 75, 43, 0.35)',
  orangeDim: 'rgba(255, 75, 43, 0.14)',
  black: '#0B0B0B',
  panel: '#141414',
  card: '#1A1A1A',
  glass: 'rgba(18, 18, 18, 0.86)',
  border: '#2A2A2A',
  borderSoft: 'rgba(255,255,255,0.08)',
  graphite: '#4A4A4A',
  muted: '#8C8C8C',
  olive: '#5E6B57',
  sand: '#E4DFD7',
  white: '#F5F3EF',
  runner: '#4ADE6B',
  runnerDeep: '#1FAE45',
  runnerGlow: 'rgba(74, 222, 107, 0.3)',
  runnerDim: 'rgba(74, 222, 107, 0.14)',
};

export const fonts = {
  display: 'Anton_400Regular',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const roleColor = (role) => (role === 'runner' ? colors.runner : colors.orange);
export const roleGradient = (role) =>
  role === 'runner' ? [colors.runner, colors.runnerDeep] : [colors.orange, colors.orangeDeep];

// Stable avatar colors per player name.
const AVATAR_GRADIENTS = [
  ['#FF4B2B', '#A8200A'],
  ['#5E6B57', '#2F382B'],
  ['#E4DFD7', '#8F887D'],
  ['#6B6B6B', '#2B2B2B'],
  ['#FF8A3D', '#C2410C'],
  ['#8FA383', '#4A5842'],
];
export function avatarGradient(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
