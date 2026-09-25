// Palette taken from the Manhunt moodboard.
export const colors = {
  orange: '#FF4B2B',
  orangeDim: 'rgba(255, 75, 43, 0.14)',
  black: '#0F0F0F',
  panel: '#161616',
  card: '#1C1C1C',
  border: '#2C2C2C',
  graphite: '#4A4A4A',
  muted: '#8C8C8C',
  olive: '#5E6B57',
  sand: '#E4DFD7',
  white: '#F5F3EF',
  runner: '#4ADE6B',
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
