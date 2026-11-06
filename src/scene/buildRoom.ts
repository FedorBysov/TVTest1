import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import type { DisplaySnapshot, Profile, StageId, ZoneId } from '../sim/model';
import type { SceneControl } from './picking';
import { CAD_ASSETS, consoleLayout, motionPose, ZONE_READINGS } from './config';
import type { CadId } from './config';
import { animateToPose } from './motion';

type Reading = keyof DisplaySnapshot['readings'];
type Motion = ReturnType<typeof animateToPose>;

export function buildRoom(profile: Profile, assetBase: string, invalidate: () => void = () => {}) {
  const root = new THREE.Group();
  root.name = 'training-console';
  const subjects: THREE.Object3D[] = [];
  const layout = consoleLayout(profile);
  const compact = profile === 'smr';
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: compact ? '#34434e' : '#a9b2ae', roughness: .78, metalness: .3 }),
    panel: new THREE.MeshStandardMaterial({ color: compact ? '#61737c' : '#d1d8d0', roughness: .72, metalness: .24 }),
    desk: new THREE.MeshStandardMaterial({ color: compact ? '#586a72' : '#b9c2b9', roughness: .77, metalness: .2 }),
    metal: new THREE.MeshStandardMaterial({ color: '#bac3c2', roughness: .42, metalness: .78 }),
    dark: new THREE.MeshStandardMaterial({ color: '#182426', roughness: .76, metalness: .2 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#151c1d', roughness: .94 }),
    ivory: new THREE.MeshStandardMaterial({ color: '#dfded0', roughness: .66 }),
    face: new THREE.MeshStandardMaterial({ color: '#e3e7d9', roughness: .95 }),
    accent: new THREE.MeshStandardMaterial({ color: '#59b6c2', emissive: '#1b5059', emissiveIntensity: .3, roughness: .5 }),
    floor: new THREE.MeshStandardMaterial({ color: '#647273', roughness: .92, metalness: .1 }),
  };
  const textures: THREE.Texture[] = [];
  const motionBindings: { root: THREE.Group; reading: Reading }[] = [];
  const selections = new Map<ZoneId, THREE.MeshStandardMaterial>();
  const lamps: { material: THREE.MeshStandardMaterial; systemId: 'power' | 'flow' | 'indicators' }[] = [];
  const displays: { texture: THREE.CanvasTexture; context: CanvasRenderingContext2D; key: Reading }[] = [];
  const auxiliaryDisplays: { texture: THREE.CanvasTexture; context: CanvasRenderingContext2D | null; key: Reading; caption: string }[] = [];
  const stageIndicators: { stage: StageId; cap: THREE.Mesh; material: THREE.MeshStandardMaterial; socketMaterial: THREE.MeshStandardMaterial }[] = [];
  const cadInstances: { id: CadId; group: THREE.Group; material: THREE.Material }[] = [];
  let motions: Motion[] = [];
  let disposed = false;
  let initialized = false;

  const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    object.position.set(x, y, z);
    object.castShadow = w > .3 && h > .12;
    object.receiveShadow = true;
    parent.add(object); return object;
  };
  const round = (parent: THREE.Object3D, r: number, depth: number, x: number, y: number, z: number, material: THREE.Material, segments = 28) => {
    const geometry = new THREE.CylinderGeometry(r, r, depth, segments);
    geometry.rotateX(Math.PI / 2);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); parent.add(object); return object;
  };
  const screw = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    round(parent, .019, .012, x, y, z, materials.metal, 10);
    box(parent, .021, .004, .002, x, y, z + .007, materials.dark);
  };
  const cad = (parent: THREE.Object3D, id: CadId, material: THREE.Material) => {
    const group = new THREE.Group(); parent.add(group);
    // Complete procedural substitutes remain until a successfully parsed CAD mesh arrives.
    if (id === 'bezel') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.208, .023, 8, 40), material);
      ring.position.z = .021; group.add(ring);
    } else if (id === 'knob') {
      round(group, .058, .075, 0, 0, .0375, material);
      box(group, .014, .08, .01, 0, 0, .08, material);
    } else {
      round(group, .07, .035, 0, 0, .035, material);
    }
    cadInstances.push({ id, group, material }); return group;
  };
  const labelPlate = (parent: THREE.Object3D, label: string, x: number, y: number, z: number, width: number, height = .1) => {
    box(parent, width + .035, height + .025, .018, x, y, z - .013, materials.dark);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = compact ? '#172b32' : '#f1f2e9'; context.fillRect(0, 0, 512, 80);
      context.fillStyle = compact ? '#e1e9e3' : '#1b2829'; context.font = 'bold 38px Arial';
      context.textAlign = 'center'; context.fillText(label, 256, 53);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    face.position.set(x, y, z); parent.add(face);
  };
  const liveScreen = (parent: THREE.Object3D, name: string, key: Reading, caption: string,
    x: number, y: number, z: number, width: number, height: number) => {
    box(parent, width + .08, height + .09, .09, x, y, z - .035, materials.dark).name = `${name}-frame`;
    box(parent, width + .1, .025, .11, x, y - height / 2 - .065, z - .04, materials.metal);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    screen.name = name; screen.position.set(x, y, z + .016); parent.add(screen);
    auxiliaryDisplays.push({ context, texture, key, caption });
    return screen;
  };
  const gauge = (parent: THREE.Group, x: number, y: number, reading: Reading) => {
    const instrument = new THREE.Group(); instrument.position.set(x, y, .117); parent.add(instrument);
    box(instrument, .51, .51, .055, 0, 0, -.015, materials.dark);
    round(instrument, .193, .014, 0, 0, .018, materials.face, 48).name = 'gauge-dial-face';
    cad(instrument, 'bezel', materials.metal);
    for (let n = 0; n <= 20; n++) {
      const angle = (.75 - n / 20 * 1.5) * Math.PI;
      const radius = .16;
      const tick = box(instrument, n % 5 === 0 ? .009 : .004, n % 5 === 0 ? .027 : .015, .002,
        -Math.sin(angle) * radius, Math.cos(angle) * radius, .029, materials.dark);
      tick.rotation.z = angle;
    }
    const needle = new THREE.Group(); needle.name = 'needle'; needle.position.z = .038; instrument.add(needle);
    box(needle, .009, .135, .004, 0, .053, 0, materials.dark);
    round(instrument, .023, .013, 0, 0, .042, materials.metal);
    box(instrument, .06, .007, .003, 0, -.092, .03, materials.dark);
    motionBindings.push({ root: instrument, reading });
    for (const sx of [-.2, .2]) for (const sy of [-.2, .2]) screw(instrument, sx, sy, .024);
  };

  // Grounded raised floor; cabinet plinths, foot plates and a cable tray explain support.
  box(root, layout.width + .6, .12, layout.depth, 0, -.07, .38, materials.floor).name = 'floor-platform';
  box(root, layout.width + .66, .045, layout.depth + .06, 0, -.14, .38, materials.dark);
  for (let x = -layout.width / 2; x <= layout.width / 2; x += .8) {
    box(root, .008, .003, layout.depth, x, -.006, .38, materials.panel);
  }
  for (const z of [-.65, .15, .95]) box(root, layout.width + .6, .003, .008, 0, -.005, z, materials.panel);
  box(root, layout.width - .1, .13, .21, 0, .1, -.73, materials.dark);
  box(root, layout.width - .3, .09, .11, 0, .79, -.72, materials.metal);

  // A rear instrument wall makes the physical room legible at a glance. Its
  // upper tier stays behind the interactive desks and never masks their hits.
  const wall = new THREE.Group(); wall.name = compact ? 'digital-display-wall' : 'hybrid-instrument-wall';
  root.add(wall); subjects.push(wall);
  box(wall, layout.width - .16, 3.96, .28, 0, 2.0, -1.14, materials.body);
  box(wall, layout.width - .06, .075, .33, 0, 3.99, -1.14, materials.metal);
  box(wall, layout.width - .04, .16, .39, 0, .12, -1.14, materials.dark);
  for (const x of [-layout.width / 2 + .23, layout.width / 2 - .23]) {
    box(wall, .14, .25, .45, x, .14, -1.14, materials.metal).name = 'wall-foot';
  }
  if (compact) {
    const keys: Reading[] = ['power', 'temperature', 'pressure', 'flow', 'indicatorB'];
    for (let i = 0; i < 5; i++) {
      const bay = new THREE.Group(); bay.position.set((i - 2) * 1.14, 3.29, -1.14); wall.add(bay);
      bay.userData.zone = i < 2 ? 'power' : i < 4 ? 'systems' : 'alarms';
      box(bay, 1.1, 1.16, .045, 0, .03, .17, materials.dark);
      liveScreen(bay, 'wall-digital-screen', keys[i], `МОДУЛЬ ${String(i + 1).padStart(2, '0')}`,
        0, .13, .235, 1.0, .76);
      labelPlate(bay, `М${i + 1} · ${['МОЩН.', 'ТЕМП.', 'ДАВЛ.', 'РАСХОД', 'СРАВН.'][i]}`, 0, -.42, .25, .94, .11);
      for (const sx of [-.48, .48]) screw(bay, sx, -.52, .25);
    }
    for (let i = 0; i < 4; i++) box(wall, .013, 1.31, .02, (i - 1.5) * 1.14, 3.28, -.94, materials.metal);
  } else {
    for (let i = 0; i < 7; i++) {
      const bay = new THREE.Group(); bay.name = 'wall-instrument-bay';
      bay.position.set((i - 3) * 1.26, 3.29, -1.14); wall.add(bay);
      bay.userData.zone = (['power', 'systems', 'alarms'] as const)[i % 3];
      box(bay, 1.2, 1.17, .055, 0, .02, .17, materials.panel);
      labelPlate(bay, `СЕКЦИЯ ${String(i + 1).padStart(2, '0')}`, 0, .47, .22, 1.05, .11);
      for (const sx of [-.53, .53]) for (const sy of [-.52, .52]) screw(bay, sx, sy, .23);
      if (i % 3 === 0) {
        for (const sx of [-.31, .31]) {
          round(bay, .17, .018, sx, .08, .225, materials.dark, 32);
          round(bay, .136, .008, sx, .08, .239, materials.face, 32);
          for (let t = 0; t < 7; t++) {
            const angle = -1.2 + t * .4;
            const tick = box(bay, .007, .026, .003, sx + Math.sin(angle) * .108,
              .08 + Math.cos(angle) * .108, .246, materials.dark);
            tick.rotation.z = -angle;
          }
          box(bay, .012, .088, .005, sx, .12, .25, materials.dark);
          round(bay, .016, .008, sx, .08, .254, materials.metal, 12);
        }
      } else if (i % 3 === 1) {
        box(bay, .86, .012, .004, 0, .12, .235, materials.dark);
        for (const sx of [-.4, 0, .4]) {
          box(bay, .011, .42, .004, sx, -.085, .235, materials.dark);
          const systemId = sx < -.1 ? 'power' : sx > .1 ? 'indicators' : 'flow';
          const lamp = new THREE.MeshStandardMaterial({ color: '#6eac98', emissive: '#6eac98', emissiveIntensity: .2 });
          const node = round(bay, .038, .014, sx, .12, .252, lamp, 18);
          node.name = 'wall-mimic-lamp'; node.userData.systemId = systemId;
          lamps.push({ material: lamp, systemId });
        }
      } else {
        box(bay, .96, .66, .065, 0, .045, .23, materials.dark).name = 'annunciator-housing';
        for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
          const systemId = (['power', 'flow', 'indicators'] as const)[row];
          const lamp = new THREE.MeshStandardMaterial({ color: '#6eac98', emissive: '#6eac98', emissiveIntensity: .2 });
          const tile = box(bay, .18, .11, .018, (col - 1.5) * .22, .23 - row * .19, .275, lamp);
          tile.name = 'wall-annunciator-tile'; tile.userData.systemId = systemId;
          lamps.push({ material: lamp, systemId });
        }
      }
      box(bay, 1.14, .035, .09, 0, -.55, .2, materials.metal);
    }
  }

  for (const sector of layout.sectors) {
    const module = new THREE.Group(); module.position.set(sector.x, 0, sector.z); module.rotation.y = sector.yaw;
    module.userData.zone = sector.id; root.add(module);
    subjects.push(module);
    const w = sector.width;
    for (const x of [-w * .36, w * .36]) {
      box(module, .16, .88, .42, x, .49, -.16, materials.body);
      box(module, .35, .07, .74, x, .025, -.05, materials.dark).name = 'cabinet-foot';
      box(module, .21, .035, .56, x, .105, -.05, materials.metal);
    }
    box(module, w - .08, .11, .66, 0, .76, -.14, materials.body);
    box(module, w - .15, .92, .44, 0, .56, -.44, materials.body);
    box(module, w - .26, .77, .035, 0, .57, -.2, materials.panel);
    for (const y of [.29, .78]) box(module, .05, .085, .04, -w * .41, y, -.172, materials.metal);
    box(module, .12, .037, .025, w * .31, .75, -.17, materials.dark);
    for (let i = 0; i < 10; i++) box(module, w * .52, .011, .01, 0, .27 + i * .027, -.173, materials.dark);
    for (const x of [-w * .41, w * .41]) for (const y of [.21, .91]) screw(module, x, y, -.173);

    const panel = new THREE.Group(); panel.position.set(0, 1.15, -.4); module.add(panel);
    const panelH = sector.height - 1.15;
    box(panel, w, panelH, .27, 0, panelH / 2, -.06, materials.body);
    box(panel, w - .095, panelH - .1, .025, 0, panelH / 2, .09, materials.panel);
    box(panel, w + .025, .065, .32, 0, panelH, -.06, materials.metal);
    for (const x of [-w / 2 + .023, w / 2 - .023]) box(panel, .035, panelH, .025, x, panelH / 2, .1, materials.dark);
    const selection = materials.accent.clone(); selections.set(sector.id, selection);
    box(panel, w - .2, .034, .015, 0, panelH - .105, .117, selection);
    labelPlate(panel, ({ power: '01 · МОЩНОСТЬ', systems: '02 · СИСТЕМЫ', alarms: '03 · СИГНАЛЫ' })[sector.id],
      0, panelH + .035, .125, w - .18, .12);
    for (const x of [-w * .43, w * .43]) for (const y of [.12, panelH - .19]) screw(panel, x, y, .118);

    const [primary, secondary] = ZONE_READINGS[sector.id];
    gauge(panel, -w * .205, panelH * .59, primary);
    gauge(panel, w * .205, panelH * .59, secondary);
    // Small inset status window: actual shared reading, never decorative random data.
    const displayCanvas = document.createElement('canvas'); displayCanvas.width = 256; displayCanvas.height = 80;
    const context = displayCanvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(displayCanvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    // The complete mount clears the desktop's high rear edge, including its lower frame lip.
    const displayMount = new THREE.Group(); displayMount.name = 'status-display-mount';
    displayMount.position.y = .4; panel.add(displayMount);
    box(displayMount, .57, .19, .02, 0, 0, .115, materials.dark).name = 'status-display-frame';
    const display = new THREE.Mesh(new THREE.PlaneGeometry(.51, .145), new THREE.MeshBasicMaterial({ map: texture }));
    display.name = 'status-display-screen';
    display.position.set(0, 0, .127); displayMount.add(display); displays.push({ context, texture, key: primary });
    for (const x of [-.29, .29]) screw(displayMount, x, 0, .132);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .15;
      round(panel, .047, .025, x, panelH - .25, .13, materials.dark);
      const lamp = new THREE.MeshStandardMaterial({ color: '#77a499', emissive: '#77a499', emissiveIntensity: .22, roughness: .4 });
      round(panel, .03, .024, x, panelH - .25, .15, lamp, 18);
      lamps.push({ material: lamp, systemId: sector.id === 'power' ? 'power' : sector.id === 'systems' ? 'flow' : 'indicators' });
    }
    const systemId = sector.id === 'power' ? 'power' : sector.id === 'systems' ? 'flow' : 'indicators';
    round(panel, .075, .015, w * .34, .26, .13, materials.dark, 24);
    const statusMaterial = new THREE.MeshStandardMaterial({ color: '#6eac98', emissive: '#6eac98', emissiveIntensity: .2, roughness: .4 });
    const statusLamp = round(panel, .052, .019, w * .34, .26, .151, statusMaterial, 24);
    statusLamp.name = 'system-status-lamp'; statusLamp.userData.systemId = systemId;
    lamps.push({ material: statusMaterial, systemId });
    labelPlate(panel, ({ power: 'КАНАЛ', flow: 'КОНТУР', indicators: 'ПАРА' })[systemId],
      w * .34, .14, .155, .32, .08);

    // A solid wedge joins the upright enclosure and desktop; its top follows the desk pitch.
    box(module, w - .08, .22, .28, 0, 1.1, -.46, materials.body);
    const wedgeGeometry = new THREE.BoxGeometry(w, .5, 1.05);
    const vertices = wedgeGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const z = vertices.getZ(i);
      vertices.setY(i, vertices.getY(i) > 0 ? 1.37 - (z + .525) / 1.05 * .5 : .77);
      vertices.setZ(i, z + .175);
    }
    wedgeGeometry.computeVertexNormals();
    const wedge = new THREE.Mesh(wedgeGeometry, materials.body); wedge.castShadow = true; module.add(wedge);
    const desk = new THREE.Group(); desk.position.set(0, 1.15, .175); desk.rotation.x = -1.119; module.add(desk);
    box(desk, w + .06, 1.15, .065, 0, 0, 0, materials.desk);
    box(desk, w + .1, .065, .11, 0, -.575, -.006, materials.dark);
    for (const x of [-w * .43, w * .43]) screw(desk, x, -.49, .042);
    const controls = new THREE.Group(); controls.position.set(-w * .26, -.04, .05); desk.add(controls);
    round(controls, .108, .023, 0, 0, 0, materials.metal);
    const knob = new THREE.Group(); knob.name = 'knob'; controls.add(knob); cad(knob, 'knob', materials.rubber);
    knob.userData.control = { kind: 'command' } satisfies SceneControl;
    box(knob, .009, .039, .004, 0, .022, .087, materials.ivory);
    const buttonMount = new THREE.Group(); buttonMount.position.x = w * .51; controls.add(buttonMount);
    round(buttonMount, .095, .026, 0, 0, 0, materials.dark);
    const button = new THREE.Group(); button.name = 'button'; buttonMount.add(button); cad(button, 'ack-button', materials.ivory);
    button.userData.control = { kind: 'acknowledge' } satisfies SceneControl;
    for (const x of [-.105, .105]) box(buttonMount, .024, .205, .09, x, 0, .037, materials.metal);
    motionBindings.push({ root: controls, reading: primary });
    // Switch bank and a small mimic route, both mounted into the desk face.
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * .12;
      const stageSwitch = new THREE.Group(); stageSwitch.name = `stage-switch-${i}`;
      stageSwitch.userData.control = { kind: 'stage', stage: i as StageId } satisfies SceneControl;
      stageSwitch.position.set(x, .235, 0); desk.add(stageSwitch);
      const socketMaterial = materials.dark.clone();
      box(stageSwitch, .077, .09, .018, 0, 0, .046, socketMaterial).name = 'stage-switch-socket';
      const capMaterial = materials.ivory.clone();
      const cap = box(stageSwitch, .048, .044, .026, 0, 0, .062, capMaterial);
      cap.name = 'stage-switch-cap';
      stageIndicators.push({ stage: i as StageId, cap, material: capMaterial, socketMaterial });
    }
    box(panel, w * .7, .008, .004, 0, .075, .114, materials.dark);
    for (const x of [-w * .3, 0, w * .3]) round(panel, .022, .008, x, .075, .119, materials.metal, 12);
  }

  // Front operator workstations sit at the side of the main control sightline.
  // Their own screens repeat live values; no static mock readings are shown.
  for (const side of [-1, 1]) {
    const station = new THREE.Group(); station.name = 'operator-workstation';
    station.position.set(side * (compact ? 2.7 : 4.08), 0, 1.13); root.add(station); subjects.push(station);
    const width = compact ? 1.12 : 1.3;
    box(station, width, .095, .73, 0, .79, 0, materials.desk).name = 'workstation-desk';
    for (const sx of [-width * .42, width * .42]) {
      box(station, .09, .69, .58, sx, .405, -.035, materials.body).name = 'workstation-support';
      box(station, .14, .055, .64, sx, .04, -.035, materials.dark).name = 'workstation-foot';
    }
    box(station, width - .18, .035, .65, 0, .43, -.03, materials.metal).name = 'cable-tray';
    for (let i = 0; i < (compact ? 2 : 1); i++) {
      const x = compact ? (i - .5) * .56 : 0;
      box(station, .09, .21, .07, x, .96, -.18, materials.metal).name = 'monitor-stand';
      liveScreen(station, 'operator-screen', i ? 'flow' : 'power', compact ? 'ПОСТ СМР' : 'ПОСТ ВВЭР',
        x, 1.16, -.15, compact ? .5 : .75, .43);
    }
    box(station, .52, .025, .16, 0, .865, .22, materials.dark).name = 'operator-keyboard';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++)
      box(station, .048, .013, .035, (i - 2.5) * .075, .884, .19 + j * .055, materials.ivory);
    if (!compact) {
      box(station, .22, .035, .13, -width * .32, .865, .26, materials.ivory).name = 'procedure-binder';
      round(station, .06, .034, width * .33, .85, .21, materials.dark, 16).name = 'desk-telephone';
    }
  }

  // Ergonomic chair in front of the centre desk; five spokes, wheels and arm mounts.
  const chair = new THREE.Group(); chair.position.set(.15, 0, 1.6); chair.rotation.y = -.24; root.add(chair);
  chair.name = 'operator-chair'; subjects.push(chair);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 5; chair.add(arm);
    box(arm, .075, .06, .39, 0, .12, .15, materials.metal);
    const wheel = round(arm, .066, .055, 0, .065, .34, materials.rubber, 14); wheel.rotation.y = Math.PI / 2;
  }
  const stem = round(chair, .052, .45, 0, .32, 0, materials.metal); stem.rotation.x = Math.PI / 2;
  box(chair, .56, .075, .52, 0, .57, 0, materials.dark);
  box(chair, .57, .1, .53, 0, .65, 0, materials.rubber).name = 'chair-seat';
  box(chair, .09, .48, .07, 0, .85, .24, materials.metal);
  const back = box(chair, .5, .47, .095, 0, 1.01, .28, materials.rubber); back.rotation.x = -.1;
  for (const x of [-.3, .3]) {
    box(chair, .035, .24, .045, x, .75, .04, materials.metal).name = 'chair-arm-support';
    box(chair, .09, .05, .32, x, .88, -.01, materials.rubber);
  }

  const loader = new STLLoader();
  for (const asset of CAD_ASSETS) {
    loader.load(`${assetBase}${asset.path}`, geometry => {
      if (disposed) { geometry.dispose(); return; }
      geometry.scale(asset.scale, asset.scale, asset.scale);
      geometry.computeVertexNormals();
      for (const instance of cadInstances.filter(i => i.id === asset.id)) {
        for (const child of [...instance.group.children]) {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
          instance.group.remove(child);
        }
        const mesh = new THREE.Mesh(geometry, instance.material);
        mesh.name = `cad-${asset.id}`; instance.group.add(mesh);
      }
      invalidate();
    }, undefined, () => { /* Geometry substitutes remain mounted and interactive. */ });
  }

  return {
    root, layout, subjects,
    update(snapshot: DisplaySnapshot, selected: ZoneId, reducedMotion: boolean) {
      motions.forEach(m => m.dispose());
      motions = motionBindings.map(b => animateToPose(b.root,
        motionPose(snapshot.command, snapshot.readings[b.reading], snapshot.signal.acknowledged), !initialized || reducedMotion));
      initialized = true;
      for (const indicator of stageIndicators) {
        const active = indicator.stage === snapshot.stage;
        indicator.cap.position.z = active ? .052 : .062;
        indicator.material.color.set(active ? '#72cdd1' : '#dfded0');
        indicator.material.emissive.set(active ? '#245c61' : '#000000');
        indicator.material.emissiveIntensity = active ? .35 : 0;
        indicator.socketMaterial.color.set(active ? '#41b8c9' : '#182426');
        indicator.socketMaterial.emissive.set(active ? '#1f6c7a' : '#000000');
        indicator.socketMaterial.emissiveIntensity = active ? .8 : 0;
      }
      for (const [zone, material] of selections) {
        material.color.set(zone === selected ? '#65d3dc' : '#475a5e');
        material.emissiveIntensity = zone === selected ? .65 : 0;
      }
      for (const lamp of lamps) {
        const status = snapshot.systems.find(system => system.id === lamp.systemId)?.status ?? 'normal';
        const color = status === 'alarm' ? '#ea694e' : status === 'warning' ? '#e5ae4e' : '#6eac98';
        lamp.material.color.set(color); lamp.material.emissive.set(color);
        lamp.material.emissiveIntensity = status === 'normal' ? .17 : snapshot.signal.acknowledged ? .28 : .65;
      }
      for (const { context, texture, key } of displays) {
        context.fillStyle = '#12282b'; context.fillRect(0, 0, 256, 80);
        context.fillStyle = '#b5d8cb'; context.font = '52px monospace'; context.textAlign = 'center';
        context.fillText(String(snapshot.readings[key]).padStart(2, '0'), 128, 58); texture.needsUpdate = true;
      }
      for (const { context, texture, key, caption } of auxiliaryDisplays) {
        if (!context) continue;
        context.fillStyle = '#101c2b'; context.fillRect(0, 0, 512, 320);
        context.fillStyle = '#1d3850'; context.fillRect(24, 66, 464, 2);
        context.fillRect(24, 255, 464, 2);
        context.fillStyle = '#a9d2dc'; context.font = 'bold 31px Arial'; context.textAlign = 'left';
        context.fillText(caption, 29, 47);
        context.font = 'bold 116px monospace'; context.textAlign = 'center';
        context.fillText(String(snapshot.readings[key]).padStart(2, '0'), 256, 200);
        context.font = '24px Arial'; context.fillText('УСЛОВНАЯ ШКАЛА', 256, 291);
        texture.needsUpdate = true;
      }
    },
    tick(delta: number) {
      motions.forEach(m => m.mixer.update(delta));
      return motions.some(m => m.isRunning());
    },
    dispose() {
      disposed = true; motions.forEach(m => m.dispose());
      const geometries = new Set<THREE.BufferGeometry>();
      const usedMaterials = new Set<THREE.Material>(Object.values(materials));
      root.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => usedMaterials.add(m));
        }
      });
      geometries.forEach(g => g.dispose()); usedMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
