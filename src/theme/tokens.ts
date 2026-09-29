// src/theme/tokens.ts
export const TOKENS = {
  colors: {
    bgVoid: '#08090d',
    bgPanel: '#11131c',
    bgPanelHover: '#171924',
    bgCard: '#151722',
    borderLine: 'rgba(255, 255, 255, 0.09)',
    borderCrimson: 'rgba(200, 28, 46, 0.4)',
    crimson: '#c81c2e',
    crimsonLight: '#f03e51',
    crimsonDark: '#780d19',
    crimsonGlow: 'rgba(240, 62, 81, 0.35)',
    parchment: '#f2e7d3',
    parchmentDim: '#c5b8a0',
    parchmentDark: '#241d1a',
    inkBlack: '#120e0e',
    gold: '#d4af37',
    goldGlow: 'rgba(212, 175, 55, 0.3)',
  },
  fonts: {
    display: "'Cinzel Decorative', 'Cinzel', serif",
    heading: "'Cinzel', serif",
    kanji: "'Noto Serif JP', serif",
    sans: "'Inter', sans-serif",
    mono: "'Space Grotesk', monospace",
  },
  radii: {
    sm: '6px',
    md: '12px',
    lg: '20px',
    full: '9999px',
  },
  shadows: {
    crimsonGlow: '0 4px 20px rgba(240, 62, 81, 0.35)',
    crimsonHover: '0 6px 28px rgba(240, 62, 81, 0.5)',
    panel: '0 10px 30px rgba(0, 0, 0, 0.4)',
    parchment: '0 18px 45px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(184, 142, 90, 0.3)',
  }
} as const;
