# 3D trade tools

Every trade has one signature tool rendered in 3D. The tools are designed objects, like precision instruments on display. They must feel like one family: same material language, same light, same camera, same motion. Only the object and its trade color change. The full tool list is in the Trade directory.

## Rendering style (locked): sleek metal and glass
- **Form:** refined, product-photography realism. Accurate proportions, clean simplified detail, crisp edges with soft bevels. Not cartoon.
- **Materials:** three only.
  - **Brushed and polished steel** for the body, base and fittings, with visible horizontal brushing and bright specular edges.
  - **Tinted glass** in the trade color: a window or housing that reveals the tool's inner mechanism. The glass carries the trade identity.
  - **Dark chrome and ink rubber** for caps, grips and handles, with a soft top highlight.
- **Trade color:** appears in the tinted glass and in one solid internal part seen through it (a piston, a motor, a blade core), plus one thin accent line on the base. Never paint the whole tool in the trade color.
- **Surface:** no logos or brand names of real tool makers. A small Solvern mark etched into the chrome cap.
- **Lighting:** bright studio key from upper left, cool fill, crisp rim light so metal edges glow. One or two long diagonal reflections across the glass. Soft contact shadow; an optional faint floor reflection. No colored lights, no glow effects.
- **Camera:** three-quarter view, about 30 degrees above, 35mm-equivalent lens. The tool fills about 60% of the stage.
- **Stage:** `white` ground with a `radius-lg` stage on the page. A single `chalk-blue` dimension line measures the tool.

## Motion (locked)
- **Entrance:** the tool settles into place over 900ms while the dimension line draws in. Plays once.
- **Idle:** a slow turn of about 20 degrees back and forth, one cycle every 8 seconds.
- **Interaction:** drag to rotate on desktop and mobile; release eases back to the rest angle.
- **Reduced motion:** show the still poster image only.

## The hub tool wall
All 23 tools hang on one wall in their trade colors, grouped by family. Hovering or tapping a tool lifts it slightly and shows its trade name; selecting it opens that trade's page.

## Performance budget
| Item | Budget |
| --- | --- |
| Model format | glTF binary (.glb), Draco or Meshopt compressed |
| Triangles per tool | 15,000 to 40,000 |
| File size per tool | Under 500 KB compressed, textures included |
| Textures | KTX2, 1024px max, shared steel, glass and chrome materials across all tools (one environment map for reflections) |
| Poster image | WebP, under 60 KB, shown instantly and used as the fallback |
| Load order | Load the 3D only after the page is visible and the phone and Concept Preview buttons work |
| Hub tool wall | One combined scene under 3 MB, loaded after the hero text |

## Build approach
Three.js with React Three Fiber in the site's codebase, one shared scene setup, lighting rig and material library, with one model file per trade. A new trade tool is a new model file and a color token, nothing else.

## Never
- Never let the 3D block scrolling, the phone number or the Concept Preview button.
- Never add particles, sparks, smoke or glow.
- Never show a tool in a color other than its trade color.
- Never show a person using the tool in 3D.
