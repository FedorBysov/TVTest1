import { Box3, Mesh, Object3D, OrthographicCamera, Vector3 } from 'three';

export interface ConsoleView {
  focus?: Object3D;
  zoom?: number;
  panX?: number;
  panY?: number;
  padding?: number;
}

/** Keep every upper panel and the operator row visible in the page overview. */
export function frameOverview(camera: OrthographicCamera, subjects: readonly Object3D[], aspect: number) {
  frameConsole(camera, subjects, aspect, { padding: 1.16 });
}

/** Fit the physical console and chair in the fixed camera plane, excluding the floor platform. */
export function frameConsole(camera: OrthographicCamera, subjects: readonly Object3D[], aspect: number, view: ConsoleView = {}) {
  camera.updateMatrixWorld(true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const point = new Vector3();
  for (const subject of subjects) {
    subject.updateWorldMatrix(true, true);
    subject.traverse(object => {
      if (!(object instanceof Mesh)) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const bounds = object.geometry.boundingBox!;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
    });
  }
  if (!Number.isFinite(minX)) return;
  const zoom = Math.min(5, Math.max(1, view.zoom ?? 1));
  const height = Math.max(maxY - minY, (maxX - minX) / aspect) * (view.padding ?? 1.1) / zoom;
  let centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  if (view.focus) {
    const focusPoint = new Box3().setFromObject(view.focus).getCenter(new Vector3()).applyMatrix4(camera.matrixWorldInverse);
    centerX = focusPoint.x; centerY = focusPoint.y;
  }
  centerX += Math.min(1, Math.max(-1, view.panX ?? 0)) * height * aspect;
  centerY += Math.min(1, Math.max(-1, view.panY ?? 0)) * height;
  camera.left = centerX - height * aspect / 2; camera.right = centerX + height * aspect / 2;
  camera.top = centerY + height / 2; camera.bottom = centerY - height / 2;
  camera.updateProjectionMatrix();
}
