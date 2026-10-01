# Color

## The system in three layers
1. **Core neutrals** carry every page: `primer`, `white`, `ink`, `graphite`, `steel`, `chalk-line`.
2. **One parent accent:** `chalk-blue`, the color of a builder's chalk line. It marks measurement and action.
3. **Families and trades:** six family colors, each with a `-deep` shade for text, and 23 `trade-*` shades.

## Core palette
| Token | Hex | Role |
| --- | --- | --- |
| `ink` | #1B2330 | Blueprint Ink. Text, logo, hub fills |
| `graphite` | #4A5361 | Secondary text |
| `steel` | #5F6874 | Muted text, 13px and up |
| `chalk-line` | #C9CED3 | Hairlines and borders |
| `primer` | #EEF0EE | Page background |
| `white` | #FFFFFF | Cards, forms, documents |
| `chalk-blue` | #2F63D6 | Accent: dimension lines, links, focus |
| `signal-error` | #B3261E | Errors only |
| `signal-success` | #34501A | Confirmations only |

## Family palette
| Family | Base | Deep (text-safe) |
| --- | --- | --- |
| Groundwork | `clay` #A4471F | `clay-deep` #6E2E14 |
| Structure & Shell | `slate` #4F6272 | `slate-deep` #2B3845 |
| Interior Finishes | `gold` #C79A1E | `gold-deep` #6B5210 |
| Home Systems | `verdigris` #0E6F6A | `verdigris-deep` #094744 |
| Outdoor Living | `leaf` #5E8A2C | `leaf-deep` #34501A |
| Specialty | `plum` #6D4A82 | `plum-deep` #432C52 |

Trade shades are listed in the Trade directory and in the tokens.

## Proportion on a trade page
Roughly 70% neutrals (primer, white), 20% ink, 10% trade color. `chalk-blue` appears only as lines, links and focus.

## Proportion on the hub
Roughly 60% neutrals, 35% ink, 5% color: family colors appear only on the tool wall and in family navigation.

## Rules
- Body text is always `ink`, `graphite` or `steel`. Never a trade or family base color.
- Colored text (a family label, a small icon, a thin line) uses the family `-deep` token.
- Text on a trade fill follows the "Text on fill" column of the Trade directory: ink or white, never anything else.
- Light trade fills (painting, insulation, windows and doors, landscaping, HVAC, flooring, drywall, concrete, tile, siding) are for large blocks or on ink. Do not use them as thin lines or icons on primer.
- Two trades never share one hero. Each page carries exactly one trade color.
- No gradients, glows or color overlays on photos.

## Accessibility
All text pairings in this system meet WCAG 2.1 AA (4.5:1 for body text, 3:1 for text 24px and up). Contrast values are in each token's usage note. Test any new pairing before it ships.

## Print and paint equivalents
Before printing vehicles or signs, have the print vendor match each hex to Pantone and to their vinyl range, and approve a physical proof. Keep a swatch card for the paint supplier matching `ink` and `primer` for office and trailer paint.
