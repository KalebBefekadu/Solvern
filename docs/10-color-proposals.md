# 10. Trade color proposals

Status: **proposed, owner approval needed.** Carpentry, HVAC and masonry are unchanged (approved).

## Why
The computed v1 values for the other 20 trades used tints with almost no hue, and 11 values read as gray (`npm run check:brand` flags them in the original file). The five Structure & Shell trades also had gray base colors.

## What changed
1. **Tint, tint-strong and deep for all 20 trades** were regenerated with the same lightness and chroma pattern as the three approved trades (OKLCH: tint L 0.965 C 0.014, tint-strong L 0.905 C 0.034, deep L 0.41), so every trade page has the same structure and visible hue. Script: `site/scripts/derive-trade-colors.mjs`.
2. **New base hues for five gray-reading trades** (Structure & Shell stays a blue family, carpentry blue sits in the middle):

| Trade | v1 color | Proposed | Reads as |
| --- | --- | --- | --- |
| Roofing & Gutters | #2E3C48 | #1d406b | Deep navy |
| Garage Doors | #5C7185 | #514ea1 | Indigo |
| Siding / Exterior Cladding | #7D92A8 | #317ca8 | Steel blue |
| Windows & Doors | #93A4B6 | #4ba4c9 | Sky blue |
| Insulation | #B3C0CC | #aaa1e0 | Periwinkle |

All other base colors are unchanged.

## Full table

| Trade | Family | Color | Text on color | Tint | Tint strong | Deep | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Demolition | Groundwork | #8A3516 | white | #fcf1ed | #f5d9cf | #783219 | proposed |
| Site Work / Excavation | Groundwork | #9C5A2E | white | #fcf1eb | #f3dacb | #6f3b15 | proposed |
| Concrete / Foundation / Driveway | Groundwork | #C9875E | ink | #fcf1eb | #f3dacb | #6d3c1a | proposed |
| Masonry | Groundwork | #B04F2A | white | #FBF0EB | #F2D8CC | #7A3316 | approved |
| Tree Service | Groundwork | #6F4A2C | white | #fbf1ea | #f2dbca | #634228 | proposed |
| Roofing & Gutters | Structure & Shell | #1d406b | white | #edf4fd | #d1e1f7 | #2e4c71 | proposed |
| Carpentry | Structure & Shell | #2D5BA8 | white | #EEF3FB | #D6E1F4 | #1D3F7A | approved |
| Garage Doors | Structure & Shell | #514ea1 | white | #f2f3fd | #dbddf6 | #424084 | proposed |
| Siding / Exterior Cladding | Structure & Shell | #317ca8 | white | #ebf5fc | #cce4f4 | #0d5073 | proposed |
| Windows & Doors | Structure & Shell | #4ba4c9 | ink | #eaf6fb | #c9e5f2 | #00526c | proposed |
| Insulation | Structure & Shell | #aaa1e0 | ink | #f3f2fd | #dfdcf5 | #4a4271 | proposed |
| Countertops | Interior Finishes | #8C722C | white | #f7f3e9 | #e9dfc7 | #5c4708 | proposed |
| Tile | Interior Finishes | #A8862A | ink | #f7f3e9 | #e9dfc7 | #5d4700 | proposed |
| Drywall | Interior Finishes | #B39A63 | ink | #f8f3e9 | #eadfc7 | #5b471a | proposed |
| Flooring | Interior Finishes | #C79A1E | ink | #f8f3e9 | #eadfc7 | #5e4600 | proposed |
| Painting | Interior Finishes | #E3BC4F | ink | #f7f3e9 | #e9dfc7 | #5c4700 | proposed |
| Plumbing | Home Systems | #0B5A63 | white | #e9f6f8 | #c7e7eb | #19535b | proposed |
| Electrical | Home Systems | #0E6F6A | white | #eaf7f5 | #c7e7e4 | #055652 | proposed |
| Low Voltage / Smart Home | Home Systems | #3D7F8C | white | #e9f6f9 | #c7e6ed | #1a535d | proposed |
| HVAC / Mechanical | Home Systems | #46AFA6 | ink | #EAF6F5 | #CBE9E6 | #0B5E58 | approved |
| Fencing & Gates | Outdoor Living | #48702A | white | #f0f6ec | #d7e5ce | #34551c | proposed |
| Landscaping / Irrigation | Outdoor Living | #86AE45 | ink | #f1f5eb | #d9e4cc | #3a5400 | proposed |
| Specialty Trades | Specialty | #6D4A82 | white | #f7f1fa | #e7daf1 | #593c6a | proposed |

Every theme passes WCAG AA (`npm run check:colors`): text on the trade color, ink on tint and tint-strong, deep on white and on tint.

## Watch
- Windows & Doors (sky blue) sits close to the Home Systems teals. If they feel too alike side by side, shift it toward periwinkle.
- Siding and Smart Home white button text clears AA at about 4.6:1, the minimum.
