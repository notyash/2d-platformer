# KamiZuki UI Development Rules

When implementing or modifying UI in the KamiZuki platformer, strictly adhere to these rules:

1. **Tokens Only**: Never hardcode colors, fonts, radii, shadows, spacing, or transitions. Always use CSS variables (`var(--token)`) or `TOKENS` from `src/theme/tokens.ts`.
2. **Zero Emojis**: Never use Unicode emojis in player-facing UI. Use inline SVG icons (`<Icon name="..." />`) or pixel sprites.
3. **Primitive Composition**: Use `<KeyCap>` for all keyboard badges and `<Panel>` for all containers/cards.
4. **Motion & Accessibility**: Use `--transition-fast/normal/slow` and ensure all animations respect `prefers-reduced-motion`.
5. **Unified Z-Index**: Use tokens `--z-canvas` (1), `--z-vignette` (5), `--z-hud` (10), `--z-overlay` (50), `--z-modal` (100), `--z-toast` (200), `--z-dev` (999). Decorative layers must have `pointer-events: none;`.
6. **Focus States**: Interactive elements must have a visible `:focus-visible` crimson glow (`box-shadow: var(--shadow-crimson-glow); border-color: var(--crimson-light)`). HUD buttons must never trap gameplay focus (`tabIndex={-1}`).
7. **Zero Event Bus in Kit Primitives**: Shared components in `src/ui/kit/` must be pure and take props only.
