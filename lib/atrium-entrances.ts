import * as THREE from 'three';
import type { Feature } from './campus-model';
import { detailBuilder, type Materials } from './photo-architecture';

export const PIAZZA_DOOR_CENTERS = [-291.5, -278.5, -265.5];
export const PIAZZA_DOOR_HALF_WIDTH = 4.65;
export function isPiazzaDoorZone(x: number, z: number) {
  return (
    x >= -166 &&
    x < -114 &&
    PIAZZA_DOOR_CENTERS.some(
      (center) => Math.abs(z - center) < PIAZZA_DOOR_HALF_WIDTH,
    )
  );
}

// The user's close-up distinguishes three walk-through openings from windows:
// rectangle / inverted triangle / rectangle glazing above, with fine red trims.
export function addAtriumEntrances(
  b: Feature,
  parent: THREE.Group,
  mats: Materials,
  plaza: number,
) {
  const group = new THREE.Group();
  group.name = 'Atrium_open_Piazza_doors_and_recessed_sea_portal';
  group.userData = {
    ...parent.userData,
    photoFeatures: [
      'three tall open entrances',
      'inverted triangular glazing',
      'red reveals',
      'deep curved sea-facing recess',
    ],
  };
  parent.add(group);
  const { add, box, finish } = detailBuilder(group);
  const glass = new THREE.MeshStandardMaterial({
    color: '#557b8b',
    roughness: 0.32,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });
  glass.name = 'Atrium_entrance_glazing';
  const dark = new THREE.MeshStandardMaterial({
    color: '#334d59',
    roughness: 0.44,
    side: THREE.DoubleSide,
  });
  const red = new THREE.MeshStandardMaterial({
    color: '#b33840',
    roughness: 0.65,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: '#dcded4',
    roughness: 0.8,
  });
  const faceX = (z: number) => {
    for (let i = 1; i < 24; i++) {
      const a = b.points[i - 1],
        q = b.points[i];
      if (z >= a[1] && z <= q[1])
        return (
          THREE.MathUtils.lerp(a[0], q[0], (z - a[1]) / (q[1] - a[1])) - 0.28
        );
    }
    return -153.5;
  };
  const at = (z: number, y: number, offset = 0) =>
    new THREE.Vector3(faceX(z) + offset, plaza + y, z);
  const beam = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    material: THREE.Material,
  ) => {
    const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      ),
    );
    const mid = a.clone().add(b).multiplyScalar(0.5);
    add(g, material, mid.x, mid.y, mid.z);
  };
  const panel = (points: THREE.Vector3[], material: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        points.flatMap((p) => p.toArray()),
        3,
      ),
    );
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        points.flatMap((p) => [(p.z + 300) / 10, (p.y - plaza) / 10]),
        2,
      ),
    );
    g.setIndex(points.length === 3 ? [0, 2, 1] : [0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    add(g, material);
  };
  for (const [index, z] of PIAZZA_DOOR_CENTERS.entries()) {
    for (const side of [-1, 1]) {
      const edge = z + side * PIAZZA_DOOR_HALF_WIDTH;
      box(0.7, 9.05, 0.52, faceX(edge), plaza + 5.075, edge, mats.pale);
      beam(at(edge, 0.56, -0.4), at(edge, 9.6, -0.4), 0.065, red);
    }
    for (let i = 0; i < 12; i++) {
      const a =
          z - PIAZZA_DOOR_HALF_WIDTH + (i / 12) * PIAZZA_DOOR_HALF_WIDTH * 2,
        q = a + (PIAZZA_DOOR_HALF_WIDTH * 2) / 12;
      beam(at(a, 9.65, -0.35), at(q, 9.65, -0.35), 0.075, red);
    }
    const low = 10.05,
      high = 16.65,
      half = 4.5;
    if (index === 1) {
      panel([at(z - half, high), at(z + half, high), at(z, low)], glass);
      beam(at(z - half, high, -0.08), at(z + half, high, -0.08), 0.07, red);
      beam(at(z - half, high, -0.08), at(z, low, -0.08), 0.07, red);
      beam(at(z + half, high, -0.08), at(z, low, -0.08), 0.07, red);
      for (let y = low + 1.3; y < high; y += 1.3) {
        const width = (half * (y - low)) / (high - low);
        beam(at(z - width, y, -0.05), at(z + width, y, -0.05), 0.045, dark);
      }
      for (let dz = -3; dz <= 3; dz += 1.5)
        beam(
          at(z + dz, low + (Math.abs(dz) / half) * (high - low), -0.05),
          at(z + dz, high, -0.05),
          0.045,
          dark,
        );
    } else {
      for (let i = 0; i < 6; i++) {
        const a = z - half + i * 1.5,
          q = a + 1.5;
        panel([at(a, low), at(a, high), at(q, high), at(q, low)], glass);
        beam(at(a, low, -0.05), at(a, high, -0.05), 0.045, dark);
      }
      for (let y = low + 1.3; y < high; y += 1.3)
        beam(at(z - half, y, -0.05), at(z + half, y, -0.05), 0.045, dark);
      for (const dz of [-half, half])
        beam(at(z + dz, low, -0.08), at(z + dz, high, -0.08), 0.07, red);
      beam(at(z - half, high, -0.08), at(z + half, high, -0.08), 0.07, red);
    }
    // A real floor and side columns continue into the atrium, behind each door.
    box(49, 0.4, 9.25, -138.5, plaza + 0.35, z, floor);
  }
  box(40, 0.5, 40, -133, plaza + 0.35, -278.5, floor);
  for (const z of [-298, -258])
    for (const x of [-139, -122])
      box(0.8, 13, 0.8, x, plaza + 7.05, z, mats.pale);
  for (const z of [-297, -285, -273, -259])
    box(35, 0.35, 0.45, -130, plaza + 12.7, z, mats.pale);

  // The bridge portal is a deep recess above the LG5 entrance, not a blank
  // flat frame. The glass ends well above the pedestrian bridge's headroom.
  const seaFace = (z: number) => -87.3 - 2.5 * (1 - ((z + 277.5) / 8.7) ** 2);
  for (let i = 0; i < 16; i++) {
    const z0 = -286.2 + (i * 17.4) / 16,
      z1 = z0 + 17.4 / 16;
    panel(
      [
        new THREE.Vector3(seaFace(z0), plaza - 7, z0),
        new THREE.Vector3(seaFace(z0), plaza + 15, z0),
        new THREE.Vector3(seaFace(z1), plaza + 15, z1),
        new THREE.Vector3(seaFace(z1), plaza - 7, z1),
      ],
      dark,
    );
    box(0.13, 22, 0.09, seaFace(z0) + 0.08, plaza + 4, z0, mats.pale);
  }
  for (let y = plaza - 3.5; y < plaza + 15; y += 3.5)
    for (let i = 0; i < 16; i++) {
      const z0 = -286.2 + (i * 17.4) / 16,
        z1 = z0 + 17.4 / 16;
      beam(
        new THREE.Vector3(seaFace(z0) + 0.1, y, z0),
        new THREE.Vector3(seaFace(z1) + 0.1, y, z1),
        0.055,
        mats.pale,
      );
    }
  // Projecting crescent-shaped sill and eyebrow, with white side reveals.
  const curvedLedge = (y: number, width: number, depth: number) => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40,
        z = -277.5 - width / 2 + t * width,
        x = -81 + depth * Math.sin(Math.PI * t);
      points.push(new THREE.Vector2(x, -z));
    }
    points.push(
      new THREE.Vector2(-85, 277.5 - width / 2),
      new THREE.Vector2(-85, 277.5 + width / 2),
    );
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
      depth: 0.75,
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    add(g, mats.pale, 0, y, 0);
  };
  curvedLedge(plaza - 10.6, 20, 3.8);
  curvedLedge(plaza + 15.8, 21, 2.5);
  for (const z of [-287.1, -267.9])
    box(9.5, 27.5, 0.65, -86.3, plaza + 2.65, z, mats.pale);
  const oculus = new THREE.Shape();
  oculus.moveTo(-1.35, 0);
  oculus.absarc(0, 0, 1.35, Math.PI, 0, true);
  oculus.closePath();
  const g = new THREE.ShapeGeometry(oculus);
  g.rotateY(Math.PI / 2);
  add(g, dark, -80.7, plaza + 18.6, -277.5);
  curvedLedge(plaza + 18.4, 10, 1.7);
  finish();
  return group;
}
