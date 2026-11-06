import { AnimationClip, AnimationMixer, LoopOnce, NumberKeyframeTrack, Object3D } from 'three';
import type { MotionPose } from './config';

/** The clip interpolates actual object transforms; the shared snapshot owns the end pose. */
export function animateToPose(root: Object3D, target: MotionPose, reducedMotion: boolean) {
  const mixer = new AnimationMixer(root);
  const bindings = [
    { name: 'knob', property: 'rotation[z]', value: target.knob, current: root.getObjectByName('knob')?.rotation.z ?? 0 },
    { name: 'needle', property: 'rotation[z]', value: target.needle, current: root.getObjectByName('needle')?.rotation.z ?? 0 },
    { name: 'button', property: 'position[z]', value: target.button, current: root.getObjectByName('button')?.position.z ?? 0 },
  ].filter(b => root.getObjectByName(b.name));
  const duration = .44;
  const tracks = bindings.map(b => new NumberKeyframeTrack(
    `${b.name}.${b.property}`, [0, duration * .5, duration],
    [b.current, b.current + (b.value - b.current) * .76, b.value],
  ));
  const clip = new AnimationClip('snapshot-pose', duration, tracks);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const unchanged = bindings.every(b => Math.abs(b.value - b.current) < 1e-6);
  if (reducedMotion || unchanged) mixer.update(duration);
  return {
    mixer,
    isRunning: () => action.isRunning(),
    dispose() {
      // Stopping an action restores its original values. Preserve the visible pose
      // so the next snapshot starts exactly where this transition stopped.
      const poses = bindings.map(b => {
        const object = root.getObjectByName(b.name)!;
        return { object, rotation: object.rotation.z, position: object.position.z };
      });
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      for (const p of poses) { p.object.rotation.z = p.rotation; p.object.position.z = p.position; }
    },
  };
}
