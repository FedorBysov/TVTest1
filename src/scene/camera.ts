import { Mesh, Object3D, OrthographicCamera, Vector3 } from 'three';

/** Fit the physical console and chair in the fixed camera plane, excluding the floor platform. */
export function frameConsole(camera: OrthographicCamera, subjects: readonly Object3D[], aspect: number) {
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
  const height = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.1;
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  camera.left = centerX - height * aspect / 2; camera.right = centerX + height * aspect / 2;
  camera.top = centerY + height / 2; camera.bottom = centerY - height / 2;
  camera.updateProjectionMatrix();
}
