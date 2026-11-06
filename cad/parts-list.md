# Original training-console hardware

This is a fictional classroom object, not a replica of any plant. The Three.js scene is a Hero-size assembled object. The operator's chair provides scale. Gauge needles represent the shared 0–100 training readings, the knob represents the command, and the acknowledgment plunger follows confirmation without clearing the warning.

## Assembly inventory, written before geometry

Ground: floor plate, inset floor panel, perimeter strip, four corner fasteners, four anti-vibration feet, plinth, front toe recess, rear cable trunk.

Each of three sectors: two pedestal legs, two foot plates, two transverse braces, lower cabinet, removable cabinet door, two door hinges, recessed handle, ten ventilation louvres, four door screws, upright rear enclosure, inset front fascia, top cap, left/right edge trims, two fascia screws, sloped desk housing, desktop front lip, two desktop corner screws, selection strip, two gauge housings, two recessed white dial faces, two CAD bezels, two needle hubs, two moving pointers, 42 scale ticks, two mounting brackets, one status display, two display retaining rails, four display screws, one mimic line with three terminals, four status lamps, four lamp sockets, knob collar, CAD knurled knob, knob index stripe, acknowledgment socket, CAD button cap, two button guard rails, one identification plate.

Shared structure: back cross rail, left/right end covers, continuous floor cable channel, three cable entries. Chair: five-star foot, five wheels, gas lift, lift collar, seat pan, upholstered seat, back support, upholstered back, two arm supports, two arm pads. Every part is supported by a visible enclosing surface or frame.

## Axes and motion

CAD dimensions are millimetres. Every part is centred in X/Y; Z=0 is its mounting plane, positive Z points out toward the operator. Three.js uses x right, y up, z toward the operator; CAD is scaled by 0.005 scene units per mm with no axis conversion. Desk controls inherit the desktop tilt. Build123d joints record the same motion: bezel rigid; knob revolute around +Z with −126°…126° travel; acknowledgment cap linear along +Z with −5…0 mm travel. Dial needles pivot around local +Z through +135°…−135°.

| Export | Construction | Mounting and finish |
|---|---|---|
| bezel.stl | 96 mm square flanged frame, round 76 mm aperture, four through holes, stepped upper ring | Fixed to fascia; brushed grey metal |
| knob.stl | 24 mm diameter hub, 24 radial grip ribs, raised pointer ridge, mounting spindle | Revolute on a fixed collar; dark rubber |
| ack-button.stl | 28 mm cap, stepped shoulder and plunger | Linear in guard socket; warm ivory |

Run `./.venv/bin/python cad/generate_parts.py` to regenerate. `--check` rebuilds into a temporary directory inside `cad/`, validates solids and joint limits, then compares deterministic mesh geometry and metadata with the committed assets; it does not alter the committed outputs. STL is binary and uses modest tessellation for browser delivery. A procedural substitute remains visible if an STL request fails.

Implementation references: [build123d joints](https://build123d.readthedocs.io/en/latest/joints.html), [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html). CAD joints specify travel; the browser uses clips sampled by AnimationMixer for the corresponding meshes.
