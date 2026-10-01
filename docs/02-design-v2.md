# 02. Design direction v2 (approved)

v2 is the current direction. It overrides `brand-kit/` wherever they conflict. Visual targets: `design/reference-pages/`.

## What changed from the v1 brand kit
| Area | v1 brand kit | v2 (use this) |
| --- | --- | --- |
| Font | Archivo + Public Sans | **Plus Jakarta Sans** only, weights 400 to 800 |
| Neutrals | Primer #EEF0EE, graphite, steel, chalk-line grays | **No gray.** White ground, ink #1B2330 for all text |
| Structure | Hairlines and gray borders | Trade tints: `--trade-tint` sections, `--trade-tint-strong` borders |
| Buttons | 4px radius rectangles | Pills (999px), 52px tall, 44px in header |
| Cards | White on gray with borders | Rounded panels (20 to 32px) on tint, few borders |
| Carpentry color | Slate #4A5D6E | **Blue #2D5BA8** (slate read as gray) |
| Services | Five cards | Numbered list with tint dividers |

Kept from v1: logo (mitered S), ink color, chalk blue for measurement lines and focus, trade colors and six families, voice and banned words, Concept Preview naming, photography rules, SEO rules.

## Per-trade theming
Each trade page sets five CSS variables from `trades.json`: `--trade`, `--trade-on`, `--trade-tint`, `--trade-tint-strong`, `--trade-deep`. Everything else is shared. Carpentry, HVAC and masonry values are approved. The other 20 are computed and must be reviewed; slate-family trades (roofing, siding, windows and doors, garage doors, insulation) may read as gray and likely need new hues.

## Trade illustrations
Status: **not final.** Every trade hero uses `assets/illustrations/placeholder-trade-illustration.svg` (560 x 440, dashed frame, hammer, "Add final illustration"). The long-term plan is one signature tool per trade (listed in `trades.json`), eventually as a lightweight interactive 3D model. Direction under consideration: industrial design product render (brushed aluminum, graphite, one trade-color accent, white studio background, three-quarter view). Drafts in `design/brainstorm-tools/` are exploration only.

## Imagery
Real photos only for people: Solvern technicians in branded uniforms, working, next to homeowners. No stock photos of contractors. Until photos exist, show tinted placeholders with the shot description (see `content/trade-pages.json` > `teamPhotoShotList`).
