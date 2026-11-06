# Visual direction · учебный БЩУ / TVTest1

Version 1.0 · 2026-11-06 · owner: visual/figure implementation · output: desktop web, SVG and Three.js. This packet accompanies the original fictional training prototype. It describes a communication system, not the appearance or operation of any real station.

## Brief, assumptions and evidence

The student must recognize a physical control surface, distinguish a requested command from a measured response, identify an unresolved signal after acknowledging it, and continue the lesson through semantic HTML. Technical detail earns its place by showing attachment, travel, containment, or state. The UI is Russian; educational values use a fictional 0–100 scale.

Authoritative constraints are `docs/superpowers/specs/2026-11-06-bshu-web-prototype-design.md`, the original specification and `anatomy_bshu_prompt_visual_v2.md`. The revised desktop/Three.js/build123d requirement overrides earlier SVG-only proposals. The local Anatomy kit supplies a rendering technique; it does not supply a plant design.

Reversible production assumptions:

- Desktop browser at 1280×800, 1440×900, 1920×1080; no mobile, VR, portrait, print or HDR master in this delivery.
- No identity assets, proprietary station drawings or licensed photographs have been supplied. All housing geometry, placement and material relationships are original procedural work.
- The default theme is dark; light is an equal supported review state. Color output is CSS sRGB on ordinary SDR displays. There is no ACES transform or embedded photographic profile because the artwork is code and vector geometry.
- The Figure remains one removable instrument module across all three zones. Zone changes select the measured quantity; they do not construct an extra room or third Hero.
- The application owns model state, HTML duplicates, session persistence and persistent educational disclosure. The Figure owns only display interpolation and transient button travel.

Evidence labels: all art-direction choices below are **production heuristics**, tested against the brief. The contrast ratios are **computed measurements** of the shipping CSS sRGB pairs. No visual preference is presented as a standard or legal conclusion. Open assumption: the final browser review may require minor size/spacing repairs at 1280 pixels; the root integration owner records those captures.

## Reference ledger and originality

No external image, brand board or photo has been imported. References below are supplied project resources; the purpose/mechanism/surface/identity split prevents one example from becoming a template.

| ID / source / permission | Observed evidence | Purpose and interpretation | Transferable mechanism | Excluded surface / identity | Confidence |
|---|---|---|---|---|---|
| R1 · supplied `anatomy_bshu_prompt_visual_v2.md` · user brief | Instrument, knob, button, independent lamp; three zones | Learner can see command, response and signal separately | One model drives every representation | No claimed reactor manufacturer, real setpoint or operational marking | High; requirements, not reference art |
| R2 · local Anatomy `examples/dial-indicator/build.mjs` · repository MIT kit/examples | Foot-mounted base, bezel, scale and moving needle | Depth explains how a reading belongs to an instrument | Projected solids, attached tick marks, containment and painter order | Stand silhouette, magnetic fixture, rail carriage, exact dimensions and composition | High; code inspected |
| R3 · local Anatomy `examples/test-rig` and `references/craft.md` · repository MIT | Springs, plunger guide, interrupted wrapping elements, framed Figure | Travel becomes legible through fixed supports | A moving cap has a guide, seat, return spring and guard | Test rig carriage, finger probe and glass subject | High for documented technique; no rendered image copied |
| R4 · local Anatomy `references/motion.md` · repository MIT | Time-based follow; offscreen stop; reduced-motion target | Motion reveals a causal change without continuous distraction | One bounded frame loop; semantic values separate from animation | Idle tour: expressly excluded here because it could imply simulation actions | High; direct implementation reference |

Originality test: with all examples hidden, this arrangement follows from the brief's need for one analogue quantity, an independently operated command, acknowledgement and a signal. The low wide steel enclosure, left dial/window pair, right indexed grip, separate upper indicator and open guard derive from those roles. No example's silhouette, camera sequence, branding or distinctive prop set is retained. Appearance does not imply affiliation. MIT notices remain in the copied skill repository; locally imported kit source is not claimed as newly authored.

## Alternative routes and decision

| Route | Thesis and three rules | Signature / proof frame | Strength / failure / cost |
|---|---|---|---|
| A · Instrument bench — selected | Material precision carries the lesson: one solid mass; quiet metal with one state accent; motion only after a cause | Whole physical module, left inset gauge and a visible spring under the guarded cap, fixed oblique camera | Recognizable control/response relationship; could become too fine at small widths; moderate geometry effort and low runtime cost |
| B · Cutaway teaching wall — rejected | Explain connections through exposed infrastructure: tall frontal assembly; cables and sectional cavities; staged reveals and larger diagram labels | Upright open cabinet, transparent lower service bay and step-by-step animated routing | Better for maintenance anatomy; distracts from operator training, multiplies hypothetical plant connections; higher 3D/audit and accessibility cost |

Route B differs in composition, information density, material exposure, camera distance and motion structure, not only color. Both could use attachment logic from R2/R3; neither inherits their objects. A is selected because users need to operate a lesson, and the larger 3D overview already supplies spatial context. B is preserved as history and must not be blended into A through transparent cabinets or animated cable tours.

## Thesis and grammar

**Make technical precision tangible: a calm, firmly assembled metal instrument contains legible controls, while only a change in the shared lesson state moves its parts or changes its signal.**

| Rule ID | Invariant / rationale | Controlled variable | Failure and test |
|---|---|---|---|
| MASS-01 | One dominant supported enclosure; no floating cards inside the artwork | Frame occupies about 80–90% of SVG width, within 40-unit fit padding | At 1× the first reading must be “instrument module” |
| ATTACH-01 | Every fitting touches its named mount; solids have thickness and bevel/edge evidence | Hardware radius 2–51 fictional units | At 4× no unmounted knobs, suspended screws or terminating seams |
| ROLE-01 | Dial = measured quantity; grip = requested command; cap = acknowledgement; lamp = signal | Three zone-selected readings, five command detents | Acknowledging changes acknowledgement only; does not extinguish active cause |
| COLOR-01 | Metal is neutral; selection teal and signal colors have different jobs | Dark/light ramps; normal, warning, alarm lenses | No entire panel turning red, no red=button=alarm ambiguity |
| VIEW-01 | Fixed parallel projection, same mount coordinates across state changes | Figure azimuth 38°, elevation 48°; room camera may differ but keeps left-to-right roles | No camera animation, no scale change on state update |
| TYPE-01 | Russian explanatory text is HTML; only numeric instrument content is on the plate | Wrapping outside SVG, never truncated labels | 1280 width and long signal labels retain content |
| MOVE-01 | Movement explains a cause and ends | Follow time constant 140 ms; button 55 ms; travel 4 units | No idle tour, spinning knob, alarm flash or pulsing lights |

Exceptions: an active warning or alarm may introduce one amber/red patch in the indicator and matching caption. The Figure uses SVG `role="group"` instead of `role="img"` so its slider and button remain exposed as interactive children; title and description name the complete object. A native HTML control pair beside it remains the integration's accessible duplicate. No phone proof is required by the user.

Anti-patterns: blueprint leaders over the object, ornamental pseudo-wires, neon rim lighting, grain over labels, glossy black luxury staging, purely colored state changes, a third scene, autonomous demo inputs, opaque real-world reactor mnemonics, false units or unverified operational procedures.

## Palette and tested pairings

Color authority is `src/styles/tokens.css`: one hex sRGB value per token/theme, no conflicting redundant RGB representation. These are UI/illustration colors, not calibrated metal measurements. All essential labels sit on solid backing. Texture is never introduced behind text.

| Pair | Dark ratio | Light ratio | Application rule |
|---|---:|---:|---|
| `--ink` / `--surface` | 14.32:1 | 13.89:1 | Primary text and numeric labels |
| `--muted` / `--surface-raised` | 6.90:1 | 5.23:1 | Secondary text; never lower its opacity |
| `--warning` / `--surface-raised` | 8.12:1 | 5.24:1 | Warning label plus triangle |
| `--alarm` / `--surface-raised` | 5.26:1 | 5.20:1 | Alarm label plus octagonal symbol |
| `--success` / `--surface-raised` | 7.77:1 | 5.49:1 | Normal label plus circle |
| `--accent` / `--surface` | 9.98:1 | 6.06:1 | Focus and selected relationship |

Target: ≥4.5:1 for normal-size informational text, ≥3:1 for meaningful control boundaries/focus cues. Decorative seams do not carry state. Ratios computed using linearized sRGB relative luminance `(Lmax+.05)/(Lmin+.05)` on 2026-11-06. Recheck final browser pixels if backgrounds, opacity or blending change. The display uses a dedicated dark backing in both themes and the dial uses a paper-like opaque face, preventing signal or room colors from impairing reading.

## Type, layout and surface

`--font-sans`: Inter if already locally installed, then Segoe UI, Arial, sans-serif; no remote font request or font redistribution. Body text should be 14–16 px with 1.5 line height, page title 28–36 px, labels 12–13 px. `--font-mono`: SFMono-Regular, Consolas, Liberation Mono, monospace. Tabular numerals for every live quantity; the readout remains a normal DOM output. Figure metadata is 12 px with restrained tracking, live number 22 px. Never generate raster text.

Spacing primitive is 4 px: 8/12/16/24/32 form the primary rhythm. Figure card has a header band, clear centered object, interaction/readout band, then caption. Borders are 1 px; corner radii 6 px for controls and 10 px for panels. No nested soft shadows around every row. The room and module occupy the dominant left area; action and evidence stay in the right rail. At 1280 pixels reduce padding, wrap footnotes and retain the control rail; do not shrink essential text.

Materials: powder-coated enclosure (opaque four-tone planes); darker gasket at z=24–25.8; lighter removable top plate at z=25.8–28; rubber grip with darker ramp and narrow knurl grooves; turned metal bezel with continuous side seam; matte opaque dial at z=39 inside the bezel lip at z=40; dark window at z=30.5 inside a z=33 frame; independent lens contained by a metal retaining ring. No photographic texture/noise is used. Detail consists of closed vent slots, mount bosses, captive screws, seams that wrap corners and knobs whose grooves end at physical rims.

Lighting: stable soft upper-left key, darker lower-right sides, restrained ambient fill, a single blurred contact shadow under the support feet. No cast light splashes or transparent glare that can cover the dial. Four-tone kit surface buckets encode facing, not arbitrary gradient decoration. In dark mode lighten metal planes enough to show real depth; in light mode preserve dark cavities rather than flattening all hardware to white.

Camera: fixed orthographic/isometric SVG, 760×500 viewBox, azimuth 38° and elevation 48°, automatically fitted to actual enclosure bounds plus its highest protected mechanism. The higher elevation is intentional: all controls lie on the accessible top plate. No optical lens distortion, depth of field, chromatic aberration or camera shake.

## Mechanism and continuity ledger

The code registers 60 purposeful parts, plus live needle and hub (62 total); small scale divisions are surface marks rather than fake part-count inflation. Registry in `src/figure/geometry.ts` contains stable IDs, named mounts and purposes.

| Assembly | Parts / attachment | Continuity anchor |
|---|---|---|
| Support | Four rubber feet, four bosses, folded case, gasket and top plate | Every foot/boss shares a center; enclosure touches z=0 |
| Service | Six panel fasteners, six closed vents, two removable rails and their fasteners | Profile only changes service-bracket width/height; controls retain positions |
| Gauge | Seat, bezel, recess, dial, scale, glass retaining lip, two retainers, needle and hub | Center (-75,-30), outer radius 48; 0–100 sweeps −130° to +130° |
| Display | Raised frame, recess and four captive fasteners | Window content clipped to the inset face; three-digit widest string is 100 |
| Command | Indexed scale, shaft collar, rubber grip, inset cap and central screw | Center (50,-36); command only 0,25,50,75,100; pointer follows same angular range |
| Acknowledge | Seat, gland, one stem, five-turn spring, cap, two guard pillars, two guard screws and bridge | Center (64,56); cap stroke 4 units; spring compresses with cap; guard remains fixed |
| Signal | Gasket, metal housing, separate lens, retaining ring | Center (121,-18); kind stays alarm/warning after ACK if model cause remains |

Three zones: power reads `readings.power`; systems reads `readings.flow`; alarms reads `readings.indicatorB`. All are explicitly named in the adjacent readout. Other three readings remain available through the application's numerical rail. Both profiles retain the instrument's recognizable control grammar; the larger room supplies the strongest profile silhouette difference. Repeated shots must preserve hardware positions, count, colors under each theme and signal semantics.

Motion: one requestAnimationFrame loop writes only moving path/transform attributes; no React rerender per animation frame. Exponential time-based follow uses clamped delta ≤1/30 second. Interpolation is presentation only; displayed numbers and accessible values remain the current model snapshot. Thus while a pointer settles, the exact number is already the authoritative reading. Frames stop when settled or offscreen; re-entry follows the latest targets. Reduced motion reaches final positions immediately and suppresses animated acknowledgement travel. No idle inputs or scene tour are permitted. Button press returns to rest on release/cancel/blur and acknowledgement emits a short physical response; this never changes cause.

## Portable tokens and production rules

| Layer | Stable names | Dark / light or value | Use / permitted change |
|---|---|---|---|
| Semantic surfaces | `--bg`, `--surface`, `--surface-raised` | #10171d/#edece6; #182229/#faf9f4; #222f37/#e5e7e2 | Ground, content, secondary bands |
| Semantic text | `--ink`, `--muted` | #eff2ef/#182b34; #adbac0/#50606a | Do not use opacity to weaken labels |
| Interaction | `--accent`, `--line` | #8dd9d0/#126a68; #455a65/#9ba8a8 | Teal is selection/focus; line is structural |
| State | `--warning`, `--alarm`, `--success` | #f2bf65/#805500; #f17f79/#ab332e; #9bcfa8/#2b663e | Always pair with symbol and Russian label |
| Material primitives | `--metal-base`, `--metal-top`, `--metal-0…3`, `--metal-edge/detail/seam/faint` | Theme values in CSS | Four facing tones; no unrelated per-part colors |
| Instruments | `--recess`, `--dial-bg/ink/muted`, `--display-bg/ink`, `--signal-ink` | Theme values in CSS | Containment and highest contrast |
| Grip | `--rubber-top`, `--rubber-0…3`, `--rubber-detail`, `--pointer` | Theme values in CSS | Separate polymer from metal |
| Type | `--font-sans`, `--font-mono` | System stacks above | No provider/font download dependency |
| Space/radius | `--space-1/2/3/4/6/8`, `--radius-sm/panel` | 4/8/12/16/24/32 px; 6/10 px | Desktop hierarchy; responsive padding allowed |
| Motion | `--motion-fast/settle`, `--ease-settle` | 140/280 ms; cubic-bezier(.22,.68,0,1) | CSS transitions; reduced motion sets 0 ms |

These CSS tokens are the portable delivery format for this web prototype, not a claim of DTCG interchange compliance. Non-token rules remain in the invariant and continuity tables: physical attachment, camera stability, no autonomous actions, use of numeric duplication and signals independent of acknowledgement.

## Accessibility, rights and adaptation

The Figure is an interactive SVG group with title and description. The knob is a labelled slider with min/max/current/value text; arrow keys step 25, Home/End select bounds, Enter/Space and a click advance the detent. The cap is a labelled button with Enter/Space and pointer activation. Focus is a distinct dashed teal outline, not a glow. HTML duplicates alongside the drawing give an alternative with native form semantics. Decorative parts are aria-hidden; live numeric content is not an assertive live region. Motion cannot be required to understand any state. Alarm information has text, shape and color. No flashing.

Rights ledger: original procedural module and application styles authored for this project; local Anatomy code used under retained MIT license; platform fonts are referenced by name and not redistributed. No photographs, logos, people, station artwork, music or video source assets. This is synthetic vector illustration, clearly labelled educational fiction by the application. This packet makes no legal-clearance claim. If branded/reference imagery is added, record its source, owner, permission, scope and exclusions before integration.

Desktop adaptation: 1280×800 uses 16 px Figure padding and wrapping help; 1440×900 is the main proof; 1920×1080 keeps a readable maximum artwork height rather than stretching every object indefinitely. Retain the 760:500 drawing ratio and both control hit areas. Do not crop the feet, guard or bezel. A still export freezes one shared snapshot and the theme; no cinematic export or video master is required. A future video must use the same mounts and causal transitions, provide captions, and include a static reduced-motion equivalent. Portrait/mobile is deliberately outside scope; do not satisfy it by miniaturizing this desktop module.

## Proof frames, acceptance and repair log

The root integration review captures each state below after motion settles. Proof specifications are not assertions that screenshots have already been approved.

| Proof ID | Frame / action | Evidence to inspect |
|---|---|---|
| PF-01 | 1440×900, light, VVER, power, command 50 | Whole supported mass at 1×; gauge, window, grip, cap and separate lamp identifiable |
| PF-02 | Same frame at 4× SVG crop | Bezel lips and knurl, flush seams, fastener slots, clipped 100, spring/gland/guard junctions |
| PF-03 | 1440×900, dark, SMR, systems, command 75 | Material planes retain depth; bracket profile change visible; displayed flow equals model |
| PF-04 | Warning then alarm then acknowledgement, alarms zone | Text/symbol/lens agree; active signal remains after acknowledgement; cap returns to rest |
| PF-05 | 1280×800 and 1920×1080, both themes | No cropped controls, clipped Russian labels or collapsed numeric window |
| PF-06 | Reduced motion; keyboard Home, End, arrows; Enter on cap | Final poses immediate, focus visible, no animation loop after settle, same callbacks as pointer |

Acceptance: focused structure/state/keyboard tests pass; TypeScript integration is clean; readable 1× and purposeful 4× detail in both themes; no red indicator falsely cleared by acknowledgement; all numerical content comes from `DisplaySnapshot`; only the two callbacks emit commands; no undefined/NaN SVG paths; no runtime console errors; controls reachable by keyboard; no false real-world operating information. Actual browser screenshots and final audit evidence belong to the root gate record, not a fabricated approval here.

| Repair ID | Observation / diagnosis | Repair / evidence |
|---|---|---|
| R-001 | Baseline palette only covered dark UI and lacked material roles | Replaced with two-theme semantic and material tokens; twelve text/focus pairings computed |
| R-002 | Generic button could conflate acknowledgement and active alarm | Separate sprung guarded cap from indicator; test retains alarm after acknowledged=true |
| R-003 | Test attempted to mutate frozen model snapshot | Use a new immutable fixture; focused suite verifies immutable state and control events |
| R-004 | Physical figure could imply autonomous state changes through Anatomy idle tour | Omitted tour intentionally; display interpolates only incoming snapshot targets |
| R-005 | Final 1×/4× integration review pending | Root owner captures PF set and sends geometry/contrast repairs; do not claim passed before review |
| R-006 | Spring rear wire could visually cross its stem | Split all five turns into near/far half-turns, render back → stem → front; preserve tangent continuity |
| R-007 | Window fastener diameter exceeded the initial frame border | Widen inset frame to six units; screw centers at three units leave their full radii on metal |

Repair order: factual state mapping → keyboard/contrast → attachment and continuity → silhouette/hierarchy → material/light → causal motion → cosmetic polish. A seam or mount fault is fixed in geometry; never hide it with opacity or arbitrary painter-key offsets.
