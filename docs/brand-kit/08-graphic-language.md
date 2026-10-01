# Graphic language

## Dimension lines (the signature device)
Thin `chalk-blue` lines, 1px on screen, with 8px end ticks, that measure something: the width of a photo, the height of a tool, the span of a section. A small measurement label in the `dimension` style sits centered on the line in `ink`.
- Use one or two per screen, never as decoration without a subject.
- Measurements should be real or plausible ("12 ft 4 in," "48 hr," "23 trades").
- On print, use 0.5pt lines.

## The build grid
- 12-column grid, 24px gutters on desktop (`space-6`), 4 columns with 16px gutters on mobile (`space-4`).
- Maximum content width 1200px; text columns max 680px.
- All spacing uses the `space-*` tokens on a 4px base.

## Structure
- Separate areas with `chalk-line` hairlines and white cards on primer, not shadows.
- Radius: 2px for inputs and badges, 4px for buttons and cards, 8px for photos and the 3D stage.
- Layouts are asymmetric and measured: a large visual on one side, text on the other, aligned to the grid.

## Iconography
- Line icons, 1.5px stroke, 24px grid, square caps and joins.
- Color: `ink` or a family `-deep` token.
- Icons label actions and facts (phone, calendar, ruler, shield, camera). They never stand in for trade identity.
- Recommended base set: Lucide, adjusted to square caps.

## Trade badge
A small rectangle, `radius-sm`, filled with the trade color and the short trade name in `label` style, text color per the Trade directory. Used on project photos, cards and the navigation.

## Patterns and textures
- Allowed: real material textures in photography (wood grain, brick, stone, metal).
- Not allowed: circuit patterns, glowing lines, hologram effects, abstract blobs, gradient meshes, stock "tech" backgrounds.

## Motion
- One orchestrated moment per page: the 3D tool's entrance. Everything else is still.
- Interface motion answers an action: opening, expanding, confirming. 150 to 250ms, ease-out.
- Respect reduced-motion settings: show the tool's still poster image instead.
