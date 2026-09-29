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

    // Orb & Magic Accents
    orbCyan: '#00f0ff',
    orbCyanGlow: 'rgba(0, 240, 255, 0.4)',
    orbPurple: '#a855f7',
    orbPurpleGlow: 'rgba(168, 85, 247, 0.4)',

    // Semantic Status Colors
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.15)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#f03e51',
    dangerBg: 'rgba(240, 62, 81, 0.15)',
  },
  fonts: {
    display: "'Cinzel Decorative', 'Cinzel', serif",
    heading: "'Cinzel', serif",
    kanji: "'Noto Serif JP', serif",
    sans: "'Inter', sans-serif",
    mono: "'Space Grotesk', monospace",
  },
  space: {
    '2xs': '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
  },
  radii: {
    xs: '4px',
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
    goldGlow: '0 0 16px rgba(212, 175, 55, 0.35)',
    orbGlow: '0 0 20px rgba(0, 240, 255, 0.45)',
  },
  zIndex: {
    canvas: 1,
    vignette: 5,
    hud: 10,
    overlay: 50,
    modal: 100,
    toast: 200,
    dev: 999,
  },
  transitions: {
    fast: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
    normal: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
    slow: '350ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type Tokens = typeof TOKENS;
