# Branding & theming

The portal is styled to sit alongside [trianglemathinstitute.com](https://trianglemathinstitute.com/).
Colors and logo assets are taken from the institute's own logo; the tagline is theirs.

> **Exploring the fun of Math** — Mathematics Institute of the Triangle

## Logo

`apps/web/public/` holds three assets, all derived from the institute's logo with the white
background keyed out so the mark sits cleanly on light *and* dark surfaces:

| File | Size | Used for |
| --- | --- | --- |
| `logo-mark.png` | 512×512 | Penrose triangle alone — sidebar, dashboard hero, apple-touch-icon |
| `logo-full.png` | 900×~400 | Mark plus wordmark — sign-in and print surfaces |
| `favicon.png` | 64×64 | Browser tab |

Use the components in `src/components/brand/logo.tsx` (`LogoMark`, `LogoFull`, `LogoLockup`)
rather than referencing the files directly. `LogoMark` is `aria-hidden` — it is decorative
wherever the institute's name is already in the text — while `LogoFull` carries the full name
as its `alt`.

## Color

Sampled from the logo artwork:

| Role in the logo | Hex | Ramp step |
| --- | --- | --- |
| Wordmark and darkest face — the primary brand color | `#773C7D` | `brand-700` |
| Mid face of the triangle | `#985D88` | ~`brand-600` |
| Lightest face | `#AB6F9A` | ~`brand-500` |
| Deepest shadow | `#502358` | `brand-900` |

`apps/web/src/index.css` extends these into a full 50–950 ramp expressed in **OKLCH** at a
single hue (≈324°). OKLCH is used because its lightness axis is perceptually even, so the steps
read as evenly spaced and the ramp stays on one hue instead of drifting blue in the shadows —
which plain hex interpolation does.

## Two layers of tokens

This is the part to understand before touching any styling.

```
--brand-50 … --brand-950      raw brand colors. Never used directly in markup.
        ↓
--primary, --muted, --card,   semantic tokens. What components actually consume.
--sidebar, --destructive, …   ONLY this layer differs between light and dark.
        ↓
bg-primary, text-muted-foreground, bg-sidebar-accent, …
```

Components reference **semantic** tokens. That is what makes dark mode a stylesheet change
rather than a per-component `dark:` variant on every element, and what makes a future
rebrand a single-file edit.

### Rules

- **Never hardcode a color in a component.** No `#773C7D`, no `bg-purple-700`. Neither follows
  dark mode.
- Reach for a semantic token first (`bg-primary`, `border-border`, `text-muted-foreground`).
- `bg-brand-*` is acceptable for decorative brand moments — the avatar circles, the role badge —
  where a light tint is wanted in both themes. Pair it with a `dark:` counterpart, as
  `user-badges.tsx` does.
- A new semantic token goes in three places in `index.css`: `:root`, `.dark`, and `@theme inline`.
  All three, or Tailwind will not generate the utility.

### Dark mode

`--primary` in dark mode is **not** `#773C7D`. The brand purple is too dark on a dark surface to
carry white text at accessible contrast, so the dark theme lifts it to a brighter tint at the
same hue. This is deliberate — do not "fix" it back to the logo value.

The `dark` class on `<html>` is owned solely by `src/providers/theme-provider.tsx`, which
supports light / dark / system, persists the choice to `localStorage`, and follows the OS only
while the user has not chosen explicitly.

## Typography

| Token | Family | Used for |
| --- | --- | --- |
| `--font-sans` | Inter | Body, UI, tables, forms |
| `--font-display` | Poppins | `h1`–`h3` and numerals in stat cards, via `font-display` |

Poppins is a geometric sans close to the institute's wordmark, which keeps headings recognisably
on-brand without trying to pass as the logo. Both load from Google Fonts in `index.html`.

## Other conventions

- `--radius` is `0.625rem`; `radius-sm/md/lg/xl` derive from it. Change the one variable to
  restyle every corner in the app.
- `brand-gradient` is a custom utility (defined with `@utility` at the bottom of `index.css`)
  for hero surfaces — currently the dashboard banner. Content on it is always white.
- Reduced motion is honoured globally in `@layer base`; do not re-enable animation past it.

## Retheming

To move the portal to a different palette, edit **only** `apps/web/src/index.css`: replace the
`--brand-*` ramp, then check the semantic tokens that reference it in `:root` and `.dark`. No
component should need to change.
