import type { Object3D } from 'three';
import type { DisplaySnapshot, StageId, ZoneId } from '../sim/model';

export type SceneControl = { kind: 'command' } | { kind: 'acknowledge' } | { kind: 'stage'; stage: StageId };
export type SceneAction = SceneControl | { kind: 'zone'; zone: ZoneId };
export interface SceneCallbacks {
  onSelectZone: (zone: ZoneId) => void;
  onCommand?: (value: number) => void;
  onAcknowledge?: () => void;
  onStage?: (stage: StageId) => void;
}

export function isSelectionPointer(event: Pick<PointerEvent, 'button' | 'isPrimary'>) {
  return event.button === 0 && event.isPrimary;
}

/** The first intersection occludes everything behind it, even if it is not selectable. */
export function actionFromIntersections(hits: readonly { object: Object3D }[]): SceneAction | undefined {
  let object: Object3D | null = hits[0]?.object ?? null;
  while (object) {
    const control = object.userData.control as SceneControl | undefined;
    if (control?.kind === 'command' || control?.kind === 'acknowledge') return { kind: control.kind };
    if (control?.kind === 'stage' && Number.isInteger(control.stage) && control.stage >= 0 && control.stage <= 4) {
      return { kind: 'stage', stage: control.stage };
    }
    const zone = object.userData.zone;
    if (zone === 'power' || zone === 'systems' || zone === 'alarms') return { kind: 'zone', zone };
    object = object.parent;
  }
}

export function zoneFromIntersections(hits: readonly { object: Object3D }[]): ZoneId | undefined {
  const action = actionFromIntersections(hits);
  return action?.kind === 'zone' ? action.zone : undefined;
}

/** All actions use the latest model snapshot; meshes never maintain their own control state. */
export function dispatchScenePointer(
  event: Pick<PointerEvent, 'button' | 'isPrimary' | 'shiftKey'>,
  hits: readonly { object: Object3D }[],
  snapshot: Pick<DisplaySnapshot, 'command' | 'signal'>,
  callbacks: SceneCallbacks,
) {
  if (!isSelectionPointer(event)) return;
  const action = actionFromIntersections(hits);
  if (!action) return;
  switch (action.kind) {
    case 'zone': callbacks.onSelectZone(action.zone); break;
    case 'stage': callbacks.onStage?.(action.stage); break;
    case 'command': {
      const next = Math.max(0, Math.min(100, snapshot.command + (event.shiftKey ? -25 : 25)));
      if (next !== snapshot.command) callbacks.onCommand?.(next);
      break;
    }
    case 'acknowledge':
      if (snapshot.signal.kind !== 'normal' && !snapshot.signal.acknowledged) callbacks.onAcknowledge?.();
      break;
  }
}
