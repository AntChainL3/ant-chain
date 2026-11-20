# ANT CHAIN design system

Direction: **field notebook for a colony.** A light, cool paper surface with ink-black type, ruled grid lines and one amber "pheromone" signal. Data looks like it was measured, not marketed: real chain values, read live from the RPC, set in a mono face only where the value is machine-readable.

Why: the reference set splits into dark-with-one-neon (nvdachain `#050605` + `#76b900`, Monad `#141414` + `#836ef9`) and light editorial (Base `#dde3e9` + `#0000ff`, MegaETH `#ece8e8` + `#1a1a1b`). Our direct competitor is dark and green, so ANT CHAIN is light and amber. Warm cream with a clay accent is avoided on purpose: it reads as Anthropic's own palette and would imply an affiliation we do not have.

## Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#eef1f3` | `#0c0f12` | page background |
| `--sheet` | `#f8fafb` | `#14181d` | raised panels, tables, code |
| `--ink` | `#0e1116` | `#e9edf1` | body text, primary buttons |
| `--ink-2` | `#4a5562` | `#a3aeba` | secondary text (contrast ≥ 4.5:1 on both surfaces) |
| `--rule` | `#cfd6dd` | `#262d35` | grid lines, borders, dividers |
| `--signal` | `#f2a900` | `#f5b82e` | the one accent: live dot, highlights, trail, focus ring. Never body text on paper. |
| `--signal-ink` | `#7a5200` | `#f5b82e` | amber used as text (links in prose), 4.5:1 on paper |
| `--ok` | `#1f7a4d` | `#4cc38a` | healthy status |
| `--warn` | `#a35a00` | `#f0a04b` | degraded status, risk notes |
| `--bad` | `#b42318` | `#f97066` | errors |

## Typography

- **Display**: Bricolage Grotesque, width 75–85, weights 700/800. Headings only.
- **Body**: IBM Plex Sans 400/500/600.
- **Data**: IBM Plex Mono 400/500, only for addresses, chain IDs, RPC URLs, code and measured numbers.

| Step | Size / line height | Use |
|---|---|---|
| display | clamp(3rem, 8vw, 6.5rem) / 0.95 | hero headline |
| h2 | clamp(2rem, 4vw, 3rem) / 1.05 | section titles |
| h3 | 1.375rem / 1.25 | sub-heads |
| lead | 1.25rem / 1.5 | intros |
| body | 1.0625rem / 1.6 | prose, max 68ch |
| small | 0.9375rem / 1.5 | captions, table labels |
| mono | 0.9375rem / 1.5 | data |

Sentence case everywhere. No all-caps eyebrows, no gradient text.

## Spacing and layout

- 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Content width 1180px, gutter clamp(16px, 4vw, 48px), section padding clamp(64px, 10vw, 128px).
- Left-aligned 12-column grid; sections break it asymmetrically (7/5, 5/7). Nothing centered except the footer legal line.
- Ruled lines (1px `--rule`) separate content instead of card boxes.

## Shape and depth

- Radius: 2px (inputs, code, tables), 999px (buttons, status pills). Nothing in between.
- No shadows. Depth comes from `--sheet` on `--paper` and rules.

## Components

- **Button primary**: ink fill, paper text, pill. Hover: signal underline bar. Focus: 3px signal ring. Disabled: 40% opacity, no pointer.
- **Button secondary**: transparent, 1px ink border, pill.
- **Quiet link**: ink text, 1px underline offset 3px; prose links use `--signal-ink`.
- **Live readout**: label in small sans `--ink-2`, value in mono `--ink`; a 8px signal dot that pulses only when a new block arrives.
- **Data table**: rows divided by rules, label column sans, value column mono with a Copy button.
- **Code block**: `--sheet`, 2px radius, mono, comment lines in `--ink-2`.
- **Nav**: sticky, paper background with a bottom rule, wordmark left, 4 links, one primary button.
- **Footer**: rules, three short link groups, disclaimer paragraph.

## Motion

Rule: at most two things move per view, and every movement means something.

| Token | Value | Use |
|---|---|---|
| `--dur-quick` | 120ms | hover and press feedback |
| `--dur-state` | 220ms | tabs, toggles, a trail station turning amber |
| `--dur-enter` | 520ms | the one page-load sequence |
| `--dur-tick` | 600ms | a live value that just changed |
| `--ease-out` | cubic-bezier(.2,.7,.2,1) | anything arriving |
| `--ease-in` | cubic-bezier(.4,0,1,1) | anything leaving |

- **Load**: status pill, headline, lede, buttons and the live readout rise 14px in a 70ms stagger; the colony canvas fades in after. Pure CSS, so content shows even if JS fails.
- **Scroll**: the dotted ant trail in "Where a transaction goes" fills with amber and each station turns amber as it reaches 60% of the viewport. No scroll-jacking, no parallax.
- **Live data**: values start as skeleton bars (no layout shift). A changed value lifts 4px and draws a short amber underline that retracts.
- **Ambient**: the colony is the only continuous animation. It pauses off screen, and a node flashes only when a real block lands.
- **Reduced motion**: every animation above is off; the trail is drawn and all stations are amber from the start.
- No animation library. Researched GSAP presets (stagger 250–700ms) informed the timings; none are needed at this scale.

## Type details

- Live numbers use tabular figures so digits do not shift as they change.
- Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.
- Plex Sans and Plex Mono are one family on purpose: data and prose share proportions. Bricolage Grotesque gives the headlines their own voice; Inter was rejected as the default every chain site uses.

## Imagery and icons

- One signature visual: the colony trail canvas in the hero (ink trails on paper, amber nodes; a node flashes when a real block lands). Respects reduced motion.
- Diagrams in inline SVG with the same tokens.
- Icons: none, or simple 1.5px stroke inline SVG where an action needs one (copy, external link). No emoji.
- No Anthropic logo, mark, colors or product names other than the factual ticker "ANT" and "Anthropic, PBC" in disclosures.
