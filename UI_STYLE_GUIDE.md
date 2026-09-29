# KamiZuki UI Style Guide & Design System Rules

This document establishes the mandatory design rules and coding standards for all user interface components and screens in the KamiZuki platformer.

---

## 🏛️ Core Principles

### 1. Tokens Only
- **Never hardcode values** for colors, fonts, radii, shadows, spacing, or animation durations in CSS or inline styles.
- Always use CSS variables (`var(--bg-card)`, `var(--crimson-glow)`, `var(--font-heading)`) or import `TOKENS` from `src/theme/tokens.ts`.
- If a new style value is needed, add it to `src/theme/tokens.ts` and `src/theme/tokens.css` first.

### 2. Zero Emojis in Player-Facing UI
- **No Unicode emojis** (e.g., 🪙, ⚔️, 💀, 🔊, 🔄, ☰, ⚡, 🏆) anywhere in player-facing UI components or game modals.
- Use **inline SVG icons** via the `<Icon name="..." />` kit component or the game's authentic pixel sprite assets.

### 3. Component Composition & Primitives
- Every keybind badge / shortcut indicator (e.g., `[E]`, `[SPACE]`, `[W]`, `[ESC]`) **must** use the `<KeyCap>` primitive.
- Every container, card, modal body, or HUD chip **must** use `<Panel>` (`variant="default" | "crimson-border" | "parchment"`).

### 4. Motion & Accessibility
- All CSS transitions and animations must use `--transition-fast`, `--transition-normal`, or `--transition-slow`.
- All custom CSS animations **must respect `prefers-reduced-motion: reduce`**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### 5. Unified Z-Index Scale & Interaction Discipline
- Always use the predefined z-index hierarchy:
  - `canvas`: `var(--z-canvas)` (1)
  - `vignette`: `var(--z-vignette)` (5)
  - `hud`: `var(--z-hud)` (10)
  - `overlay`: `var(--z-overlay)` (50)
  - `modal`: `var(--z-modal)` (100)
  - `toast`: `var(--z-toast)` (200)
  - `dev`: `var(--z-dev)` (999)
- Decorative overlays and passive visual frames **must** specify `pointer-events: none;`.
- Interactive regions within overlays must explicitly use `pointer-events: auto;` (or `.react-interactive`).

### 6. Focus & Keyboard States
- Every interactive element (buttons, selectable menu cards, tabs) **must have a prominent `:focus-visible` or `.is-focused` state** featuring a crimson glow (`box-shadow: var(--shadow-crimson-glow); border-color: var(--crimson-light); outline: none;`).
- HUD action buttons must never trap gameplay focus (`tabIndex={-1}` and immediate `.blur()` on click).

---

## 🎨 Color Tokens Reference

| Token Name | CSS Variable | Hex / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **bgVoid** | `--bg-void` | `#08090d` | Deep space background & letterbox fill |
| **bgPanel** | `--bg-panel` | `#11131c` | Dark navy container base |
| **bgPanelHover**| `--bg-panel-hover` | `#171924` | Hovered panel surface |
| **bgCard** | `--bg-card` | `#151722` | Card & slot background |
| **borderLine** | `--border-line` | `rgba(255, 255, 255, 0.09)`| Subtle glass border |
| **borderCrimson**| `--border-crimson` | `rgba(200, 28, 46, 0.4)` | Thematic crimson border |
| **crimson** | `--crimson` | `#c81c2e` | Primary brand red |
| **crimsonLight**| `--crimson-light` | `#f03e51` | Glow highlights & active border |
| **crimsonDark** | `--crimson-dark` | `#780d19` | Pressed / selected backdrop |
| **parchment** | `--parchment` | `#f2e7d3` | Japanese warm ivory text |
| **parchmentDim**| `--parchment-dim` | `#c5b8a0` | Muted subtitle text |
| **gold** | `--gold` | `#d4af37` | Coins & legendary accents |
| **orbCyan** | `--orb-cyan` | `#00f0ff` | Victory Orb & electric powerup glow |
| **success** | `--color-success` | `#22c55e` | Confirmation / verified status |
| **warning** | `--color-warning` | `#f59e0b` | Caution / checkpoint warning |
| **danger** | `--color-danger` | `#f03e51` | Fatal damage / low health |
| **hazardRed** | `--hazard-red` | `#ff0000` | Gameplay hazard & boss damage flash tint |

---

## 🔤 Typography

- **Display**: `'Cinzel Decorative', 'Cinzel', serif` (`--font-display`) — Stage titles, victory fanfare
- **Heading**: `'Cinzel', serif` (`--font-heading`) — Modal headers, button labels, boss names
- **Kanji**: `'Noto Serif JP', serif` (`--font-kanji`) — Hanko stamps, Japanese decorative subtitles
- **Sans**: `'Inter', sans-serif` (`--font-sans`) — Descriptions, helper copy, body text
- **Mono**: `'Space Grotesk', monospace` (`--font-mono`) — Timers, stats, KeyCaps, numeric readouts (always `font-variant-numeric: tabular-nums`)

---

## 📐 Layout Tokens Reference

| Token Name | CSS Variable | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **uiScale** | `--ui-scale` | `1.15` | Global React UI overlay rem-scale factor |
| **bossBarWidthPct** | `--boss-bar-width-pct` | `36%` | Target boss bar width percentage relative to game stage |
| **bossBarMinWidth** | `--boss-bar-min-width` | `22rem` | Minimum responsive boss bar width |
| **bossBarMaxWidth** | `--boss-bar-max-width` | `40rem` | Maximum responsive boss bar width |
| **bossBarHeight** | `--boss-bar-height` | `1rem` | Boss health bar track height |

