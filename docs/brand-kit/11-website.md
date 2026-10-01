# Website

## Structure
One domain. The hub at the root, one page per trade, one page per project type, one page per key neighborhood.
```
solvern.com/                     Hub: Solvern Home
solvern.com/concept-preview      The Concept Preview offer and form
solvern.com/[trade]              23 trade pages (solvern.com/flooring)
solvern.com/projects/[type]      Kitchen, bathroom, basement, additions, whole-home, outdoor living
solvern.com/areas/[neighborhood] Buckhead, Alpharetta, Decatur, Marietta and others
solvern.com/work                 Project gallery, filterable by trade
solvern.com/about                Team, process, standards
solvern.com/contact              Phone, form, service area
```

## Hub page (in order)
1. Hero: "One team for every part of your home." Primary button "Get my Concept Preview," phone number beside it.
2. The Solvern tool wall (3D): all 23 trades, grouped by family.
3. Project types: kitchen, bath, basement, additions, whole-home, outdoor living.
4. How it works: Send a photo, see your Concept Preview, get a line-by-line estimate, we build it with updates at every stage.
5. Recent work with before and after.
6. Reviews.
7. Service area map of metro Atlanta.
8. Final call to action and footer.

## Trade page template (in order)
1. Hero: trade name in `display-l`, one-line promise, the 3D tool on its stage, "Get my Concept Preview" and phone.
2. What we do: the scope list from the Trade directory.
3. See it first: example Concept Preview beside the original photo (visual trades), or "Call for a diagnosis" (plumbing, electrical, HVAC, low voltage).
4. Recent projects for this trade.
5. How it works (the same four steps as the hub).
6. Reviews that mention this trade.
7. Related trades in the same family, and the hub link: "Planning a bigger project? One team does it all."
8. Frequently asked questions for this trade.

## Header and footer
- Header: logo left; Trades (mega menu grouped by family), Projects, Our work, About; phone number and "Get my Concept Preview" button right. On mobile, a sticky bottom bar with "Call" and "Concept Preview."
- Footer: logo, one-line boilerplate, all 23 trades by family, service areas, contact, social handles, legal name and privacy policy.

## Components
| Component | Spec |
| --- | --- |
| Primary button | `ink` fill, white text, `button` style, `radius-md`, 12px by 20px padding. Hover: `graphite` |
| Secondary button | White fill, `ink` 1px border and text |
| Trade button (on trade pages) | Trade color fill, text per Trade directory |
| Links | `chalk-blue`, underline on hover |
| Focus | 2px `focus-ring` outline, 2px offset, on every interactive element |
| Inputs | White, 1px `chalk-line` border, `radius-sm`, 48px tall, label above in `label` style |
| Cards | White on primer, 1px `chalk-line` border, `radius-md`, `space-6` padding. No shadows |
| Trade badge | See Graphic language |
| Review card | Stars in `ink`, quote in `body`, name and neighborhood in `body-s` `steel` |
| Before and after slider | `radius-lg`, a `chalk-blue` divider handle |

## Performance and quality floor
- Largest contentful paint under 2.5 seconds on a mid-range phone.
- Phone number and Concept Preview button usable before any 3D loads.
- Works at 320px width and up. Every page usable by keyboard and screen reader.
- Images in WebP or AVIF with correct sizes.

## Technology
Next.js on Vercel, one codebase with a theme per trade driven by the tokens in this system. Adding a trade means adding a token, a model file and page content.
