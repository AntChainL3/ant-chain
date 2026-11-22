# ANT CHAIN design system

Direction: **tokenized equity, as an instrument panel.** ANT is Anthropic's ticker, not an insect: the visual language comes from securities (guilloché engraving from share certificates, a reeded coin, a stock-exchange ticker tape), set in a dark live hero and light technical sheets, with one amber signal throughout.

## Current layer (2026-11-21, overrides older notes below)

- **All black.** The light "sheets" are flipped to black tokens; a fixed amber/white glow sits behind everything so glass has something to refract.
- **Glassmorphism** on header, telemetry, cards, boards, chips: `linear-gradient(155deg, rgba(255,255,255,.075), rgba(255,255,255,.018))`, 1px `rgba(255,255,255,.1)` border, `blur(16px) saturate(140%)`, inset top highlight.
- **Header** (after getcofer.com, reworked): glass bar, icons over labels, amber top indicator + glow tab on the section in view, live ANT mini-ticker, outlined pill CTA with live dot.
- **Hero**: halftone dot-matrix (after getcofer.com) that sweeps between ANT → candlesticks → linked blocks → neural network; pointer lens; new block advances it. Footer has a large "ANT CHAIN" dot wordmark.
- **02 showcase** (after getcofer.com section 04): pinned full-screen band, 3D point cloud morphing linked chain → blockspace surface → globe with scroll, live glass tags with parallax, 00–100 ruler.
- **Motion** (after motion.zajno.com principles): titles rise word by word from behind a mask with offset delay; the CTA has a disc that zooms with scroll and inverts the words it covers (difference blend).

## Identity

- **Mark**: a guilloché rosette (a 7-lobe hypotrochoid inside a ring), in amber line on black. It turns 60° on hover. No ant shapes, no colony or trail metaphors.
- **Hero object**: an obsidian equity coin with a gold reeded rim, guilloché engraving on both faces and the ANT ticker plate. It is wrapped by a ticker tape that scrolls the live ANT price from our fee pricer. Amber particles orbit it as transactions, and a real new block speeds them up.
- **Anthropic** is named only as fact (ticker ANT, "Anthropic, PBC" in disclosures). Its logo, its spark/asterisk shapes, its colors (cream, clay) and its typefaces are never used. Every page says the chain is independent.

Built from three references the owner chose, each for one thing:

- **corbel.finance**: dark full-screen hero with dotted arcs between named stops, mono uppercase nav with a chain status pill, a section progress bar under the nav, and a fixed live telemetry bar at the bottom.
- **getcofer.com**: light framed sections on a faint grid with corner marks, bracketed labels (`[ 01 / Route ]`), two-line titles (sans, then a mono line in grey), "F/01" figure cards with dot-matrix illustrations, black terminal blocks and a staged flow.
- **equiagent.trade**: a canvas that fills the first viewport, a fixed nav that turns solid on scroll, and sizes that scale with the viewport.

A fourth suggested reference, antchain.lol, is a separate project with the same concept and a near-identical name. Its design was deliberately not used, so ANT CHAIN does not look like a copy of it.

Amber stays the only accent, which keeps us distinct from corbel's green and equiagent's purple. Warm cream and clay stay out because they read as Anthropic's palette.

## Color

| Token | Value | Role |
|---|---|---|
| `--night` | `#0a0a0a` | hero, network band, footer, terminals, bars |
| `--night-line` | `#262626` | borders on night |
| `--night-ink` / `--night-mute` | `#ededed` / `#8f8f8f` | text on night |
| `--paper` | `#f3f3f1` | light sheets, with a 40px grid at 4.5% ink |
| `--sheet` | `#fafaf8` | cells, cards and boards on paper |
| `--ink` / `--mute` | `#0a0a0a` / `#5f5f5f` | text on paper (mute is 5.6:1) |
| `--line` | `#d4d4cf` | frames and dividers on paper |
| `--amber` | `#ffb21a` | the one signal: CTAs, live packets, the active stage, the headline accent. Never text on paper. |
| `--amber-ink` | `#8a5800` | amber as text on paper |
| `--ok` / `--ok-ink` | `#2fbf72` / `#1a7a4a` | live and healthy |
| `--warn-ink` | `#9a5300` | issuer powers, withdrawal wait |

## Type

- **Geist** 400/500 for headlines and prose. Headlines use weight 500 and tight tracking (−0.035 to −0.045em).
- **Geist Mono** 400/500 for labels (uppercase, +0.08em), buttons, data, addresses, code, and the second line of each section title.
- Hero clamp(2.75rem, 7.4vw, 6.25rem) / 0.98. h2 clamp(2rem, 4.4vw, 3.5rem) / 1.04. Body 1rem / 1.6. Labels 0.6875–0.75rem.
- Live numbers use tabular figures.

## Layout

- Content width 1240px, gutter clamp(16px, 4vw, 40px), section padding clamp(64px, 9vw, 120px).
- Each section is a frame with ruled sides and a `+` mark at each top corner (hidden below 1290px). The head row has a bracketed label on the left and a mono meta line on the right.
- Title row splits 7/4: the title on the left and a short aside on the right.
- Grids of cells share borders (cofer style). There are no shadows. Radius is 2–3px, 6px on the floating bars, and 999px on pills.

## Components

- **Nav**: wordmark, Beta badge, mono links, a chain status pill, and an amber "Add to wallet" button. Transparent over the hero, then solid night after 24px of scroll.
- **Progress**: 01–05 section links on a dotted track that fills amber with scroll position. The current section turns white with an amber number.
- **Hero**: centered. Kicker, two-line headline (the second line amber), lede, an RPC command bar with a Copy button, fact chips, then two CTAs.
- **Telemetry bar**: fixed at the bottom. Shows block, gas, transfer fee, batches, validator, escrow and the ANT contract address with Copy. Items drop out at narrow widths.
- **Stage board**: tabs 01–05, a board head (stage / route / status), a terminal next to the explanation, and an SVG flow whose nodes turn ink when done and ink-with-amber when active.
- **Figure card**: F/0n label and tag, a dot-matrix canvas with two real captions, a title, text, and an ↗ link.
- **Buttons**: rectangular, mono uppercase. Primary is amber with ink text; the ghost button has a 1px border. The arrow nudges 3px on hover.

## Motion

| Token | Value | Use |
|---|---|---|
| `--dur-quick` | 120ms | hover and press |
| `--dur-state` | 220ms | stage switch, flow nodes, nav solidifying |
| `--dur-enter` | 560ms | hero load stagger (70ms steps), section reveal |
| `--dur-tick` | 600ms | a live value that changed flashes amber |
| `--ease-out` | cubic-bezier(.2,.7,.2,1) | everything arriving |

- **Hero field**: a breathing dot dune and slow columns of hex behind the equity coin (see Identity). The coin, tape and orbit pause off screen, when the tab is hidden, or when motion is off.
- **Headline** letters resolve from blur in sequence; section titles resolve word by word as they enter.
- **Motion toggle** in the top bar turns every animation off, like reduced motion.
- **Sphere** (F/02) turns only while it is in view. Every other figure is static.
- **Reveal**: section heads and blocks rise 16px once. Content stays visible without JS.
- **Reduced motion** turns all of it off: figures and the field draw once, and everything is visible.

---

## v7 (22 Nov 2026): "Terminal on ice". Supersedes every layer above.

References studied: delira.cc (giant wordmark over a chrome 3D object, engraved linework, mono `<tags>`, serif italic accent, pill UI), vulpineapp.com (instrument-screen corner brackets, live status row, live chain card, scroll as a clock), syncronixai.xyz (contract strip on top, live/planned labelling), casebookduel.com (live numbers as the hero, block ledger, runnable terminal), plus getcofer.com halftone and motion.zajno.com masking from earlier.

- **Files**: `site/css/core.css` (tokens, header, buttons, tags, tables, terminal, footer, orbit dial), `site/css/home.css`, `site/css/legacy.css` (maps the app pages' old variables to these tokens), `site/js/site.js` (Lenis, menu, header hide, reveals, orbit dial), `site/js/home.js` (live data, ledger, packets, scroll route, console), `site/js/knot.js` (three.js chrome knot).
- **Colour**: ground `--bg #f1f4fa`, surface `--paper #fff`, ink `#0b0e1a`, muted `#5d6585`, line `rgba(11,14,26,.11)`. Cobalt `#2a3ef5` is the only accent for links, linework and serif accents. Amber `#ffb21a` only for live signals (dots, the route packet, block bursts). Green/amber/red only for status. Anthropic colours stay out.
- **Type**: Archivo (wdth 118, 800) uppercase for display words; Geist for UI and body; Geist Mono for data and `<tags>`; Instrument Serif italic in cobalt for one accent phrase per heading.
- **Shape**: radius 14 / 22 px, pills for header and tags, 1 px lines, no shadows, no glass, no glow. Hover = ink fill, arrow nudge, lift of 3 to 4 px.
- **Signature pieces**: viewport corner brackets; floating three-pill header with a dark contract strip; hero wordmark ANT / outlined CHAIN with the chrome knot crossing it; live "CHAIN LINK" card; block ledger; pinned route scrubbed by scroll with a frame counter; live/planned status board; console that really calls the RPC.
- **Banned** (user feedback): numbered section labels, preloaders, custom cursor, motion toggle, neon hover glows, glassmorphism everywhere.

### v7.1 (22 Nov 2026): colour back to black + amber
User kept the v7 layout and motion but wanted the earlier palette. Tokens now: `--bg #050505`, `--paper #111`, `--ink #ededed`, `--muted #8c8c8c`, lines `rgba(255,255,255,.09)`. The accent tokens keep their names (`--cobalt*`) but hold amber (`#ffb21a`, text `#ffc24d`). Buttons are light fills with black text and turn amber on hover. The chrome knot reflects warm panels; data packets are amber with white bursts on each new block. App pages use their original dark sheets through css/legacy.css.

### v7.2 (22 Nov 2026): hero object = the chain stack
The chrome knot (js/knot.js, now unused) was replaced by js/stack3d.js after the user found it ugly and added mantle.xyz, sui.io and ton.org as references. Those heroes all show how the network works (TON's node globe, Sui's transaction streaks, Mantle's rising bars). Ours: three plates (Ethereum, Robinhood Chain 46630, ANT CHAIN 26801) joined by dashed pillars. The latest real ANT CHAIN blocks stand on the top plate as amber bars (height = gas used; data from home.js via the `antchain:ledger` / `antchain:newblock` events). A new block drops in as it is made. Small packets sinking down the pillars illustrate batches settling. Crisp edges, no glow.
