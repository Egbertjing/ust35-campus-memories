import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Feature, Point } from './campus-model';
import {
  INNOVATION_BRIDGE_LEVEL,
  INNOVATION_BRIDGE_POINTS,
} from './photo-campus-data';

export type Materials = {
  pale: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
};
type Building = Feature & { base: number };

// Shared geometry batches keep the individual fins, rails and solar panels
// inexpensive to render. Every completed mesh inherits its building's metadata.
export function detailBuilder(group: THREE.Group) {
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    yaw = 0,
  ) => {
    // Extruded wings, indexed boxes and custom curved sheets share batches.
    // Normalize their indexing before merging or Three.js drops the batch.
    if (geometry.index) {
      const unindexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = unindexed;
    }
    if (
      material instanceof THREE.MeshStandardMaterial &&
      material.map &&
      material.name !== 'campus_window_glass'
    ) {
      const p = geometry.attributes.position,
        n = geometry.attributes.normal,
        uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++)
        uv.setXY(
          i,
          Math.abs(n.getY(i)) > 0.7
            ? p.getX(i) / 8
            : (Math.abs(n.getX(i)) > 0.7 ? p.getZ(i) : p.getX(i)) / 8,
          Math.abs(n.getY(i)) > 0.7 ? p.getZ(i) / 8 : p.getY(i) / 8,
        );
    }
    geometry.rotateY(yaw);
    geometry.translate(x, y, z);
    const list = batches.get(material) ?? [];
    list.push(geometry);
    batches.set(material, list);
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    yaw = 0,
  ) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, yaw);
  const finish = () => {
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (merged) {
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { ...group.userData };
        group.add(mesh);
      }
      geometries.forEach((g) => g.dispose());
    }
  };
  return { add, box, finish };
}

export function addPhotoBuilding(
  b: Building,
  group: THREE.Group,
  mats: Materials,
) {
  const kind = b.tags['model:kind'];
  if (!['medical', 'innovation', 'computing', 'shaw', 'cheng'].includes(kind))
    return false;
  const { pale, wall, roof } = mats;
  const glazing = new THREE.MeshStandardMaterial({
    color: '#526971',
    roughness: 0.38,
    metalness: 0.2,
  });
  const shadow = new THREE.MeshStandardMaterial({
    color: '#354b56',
    roughness: 0.66,
  });
  const solar = new THREE.MeshStandardMaterial({
    color: '#405b73',
    roughness: 0.43,
    metalness: 0.15,
  });
  const aluminum = new THREE.MeshStandardMaterial({
    color: '#c3ccd0',
    roughness: 0.54,
    metalness: 0.25,
  });
  const builder = detailBuilder(group),
    { box, add } = builder;
  const panel = (x: number, y: number, z: number, w: number, d: number) => {
    box(w, 0.18, d, x, y, z, solar);
    for (let p = -w / 2; p <= w / 2 + 0.01; p += 1.1)
      box(0.045, 0.035, d, x + p, y + 0.11, z, aluminum);
    for (let p = -d / 2; p <= d / 2 + 0.01; p += 1.6)
      box(w, 0.035, 0.045, x, y + 0.11, z + p, aluminum);
  };
  const parapet = (w: number, d: number, y: number, x = 0, z = 0) => {
    for (const side of [-1, 1]) {
      box(w, 0.7, 0.32, x, y, z + (side * d) / 2, pale);
      box(0.32, 0.7, d, x + (side * w) / 2, y, z, pale);
    }
  };
  if (kind === 'medical') {
    group.position.set(-207, b.base, 18);
    group.userData.photoFeatures = [
      'eight storeys',
      'stepped podium',
      'horizontal glazing bands',
      'recessed rooftop plant',
    ];
    // Three tapered podium plates facing Shaw, with the upper tower recessed.
    for (let i = 0; i < 3; i++) {
      const w = 56 - i * 3,
        d = 58 - i * 2;
      box(w, 2.3, d, -0.5, 1.3 + i * 2.5, 1.5, glazing, i * 0.035);
      box(w + 0.8, 0.55, d + 0.8, -0.5, 2.6 + i * 2.5, 1.5, pale, i * 0.035);
    }
    box(49, 31, 46, 0, 23, 0, glazing);
    for (let floor = 0; floor < 8; floor++) {
      const y = 8 + floor * 4.25;
      box(50, 0.55, 47, 0, y, 0, pale);
    }
    for (let x = -23; x <= 23; x += 3.9)
      for (const side of [-1, 1])
        box(0.16, 30, 0.2, x, 23, side * 23.1, aluminum);
    for (let z = -21; z <= 21; z += 4)
      for (const side of [-1, 1])
        box(0.2, 30, 0.16, side * 24.6, 23, z, aluminum);
    box(50, 0.7, 47, 0, 39, 0, roof);
    parapet(49, 46, 39.8);
    box(40, 2.4, 36, 0, 40.5, 0, aluminum);
    box(39, 0.4, 35, 0, 41.9, 0, roof);
    box(24, 1.5, 3, -4, 42.7, -12, pale);
    box(5, 1.5, 22, 13, 42.7, 0, pale);
    box(6, 0.3, 6, 0, 42.3, 0, shadow);
  } else if (kind === 'innovation') {
    group.position.set(-94, b.base, 68);
    group.userData.photoFeatures = [
      'narrow slab',
      'two-storey east podium',
      'horizontal sunshades',
      'roof solar arrays',
    ];
    box(32, 8, 53, 1, 4, 6, wall);
    box(33, 0.6, 54, 1, 8.3, 6, roof);
    box(29, 25, 67, -1, 20.7, -1, wall);
    // Long dark ribbon windows are recessed behind projecting white shades.
    for (let level = 0; level < 6; level++) {
      const y = 11.5 + level * 3.6;
      for (const side of [-1, 1]) {
        box(0.18, 1.5, 55, -1 + side * 14.6, y, -1, glazing);
        box(1.1, 0.32, 56, -1 + side * 14.8, y + 1.02, -1, pale);
      }
      box(23, 1.5, 0.2, -1, y, 32.6, glazing);
      box(24, 0.32, 1.1, -1, y + 1.02, 32.9, pale);
    }
    for (const z of [-31, 28]) {
      box(4, 35, 7, -13, 17.5, z, pale);
      box(4.4, 0.55, 7.4, -13, 35.2, z, roof);
    }
    for (let z = -16; z < 30; z += 6)
      for (const side of [-1, 1])
        box(0.18, 1.5, 1.7, 1 + side * 16.1, 3.6, z, glazing);
    box(29.8, 0.7, 67.8, -1, 33.6, -1, roof);
    parapet(29, 67, 34.3, -1, -1);
    for (let z = -22; z < 25; z += 10) panel(-1, 34.12, z, 18, 6);
    box(6, 2, 9, -7, 35, -21, pale);
    box(5, 1.6, 5, 8, 34.8, 22, pale);
  } else if (kind === 'computing') {
    group.position.set(b.center[0], b.base, b.center[1]);
    group.rotation.y = -Math.PI / 4;
    group.userData.photoFeatures = [
      'vertical louver facade',
      'four dark equipment bands',
      'corner ledges',
      'nine rooftop plant blocks',
    ];
    // Local X points SE, local Z points SW, aligning with the mapped parcel.
    box(42, 43, 27, 0, 21.5, 0, wall);
    for (const side of [-1, 1]) {
      box(32, 29, 0.22, 0, 26, side * 13.64, shadow);
      for (let x = -15.8; x <= 16; x += 0.66)
        box(0.19, 28.4, 0.38, x, 26, side * 13.9, aluminum);
      box(33, 0.8, 0.75, 0, 11.3, side * 13.8, pale);
      box(33, 0.8, 0.75, 0, 40.7, side * 13.8, pale);
    }
    for (let floor = 0; floor < 4; floor++) {
      const y = 20 + floor * 5.4;
      box(0.24, 3.8, 20, 21.15, y, -1, shadow);
      box(0.7, 0.48, 21, 21.35, y + 2.1, -1, pale);
    }
    for (let y = 2; y < 42; y += 2.4) {
      box(3.7, 0.65, 2.2, 19.4, y, 12.6, pale);
      box(3.1, 0.65, 2.2, -19.2, y, -12.6, pale);
    }
    box(43, 0.7, 28, 0, 43.35, 0, roof);
    parapet(42, 27, 44.05);
    for (let i = 0; i < 6; i++)
      box(4.6, 3.4, 7, -15 + i * 5.7, 45.2, -6.2, pale);
    for (let i = 0; i < 3; i++) box(4.6, 3.2, 5, 3 + i * 5.7, 45.1, 6.9, pale);
    box(13, 2.1, 6, -8, 44.6, 6, pale);
  } else if (kind === 'shaw') {
    group.position.set(b.center[0], b.base, b.center[1]);
    group.rotation.y = 0.48;
    group.userData.photoFeatures = [
      'three elliptical terraces',
      'recessed glazing',
      'roof solar arrays',
    ];
    for (let i = 0; i < 3; i++) {
      const w = 40 - i * 2.3,
        d = 28 - i * 1.5;
      const body = new THREE.CylinderGeometry(1, 1, 4.3, 96);
      body.scale(w - 0.8, 1, d - 0.8);
      add(body, glazing, 0, 2.4 + i * 4.7, 0);
      const slab = new THREE.CylinderGeometry(1, 1, 0.75, 96);
      slab.scale(w, 1, d);
      add(slab, pale, 0, 4.8 + i * 4.7, 0);
    }
    const crown = new THREE.CylinderGeometry(1, 1, 2.5, 96);
    crown.scale(30, 1, 20.3);
    add(crown, wall, 0, 15.7, 0);
    const cap = new THREE.CylinderGeometry(1, 1, 0.6, 96);
    cap.scale(30.5, 1, 20.8);
    add(cap, roof, 0, 17.2, 0);
    for (let z = -13; z <= 13; z += 6.5) panel(0, 17.58, z, 38, 3.3);
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const x = 33 * Math.cos(angle),
        z = 23 * Math.sin(angle);
      box(4.5, 0.2, 2.2, x, 14.68, z, solar, -angle);
    }
  } else if (kind === 'cheng') {
    // Retain its mapped outline; strengthen the nine-storey proportions and
    // central glass recess visible in IMG_0254/0255 instead of a generic block.
    group.position.set(-145, b.base, 21);
    box(36, 35, 66, 0, 17.5, 0, wall);
    box(36.8, 0.8, 66.8, 0, 35.4, 0, roof);
    parapet(36, 66, 36.1);
    for (const side of [-1, 1]) {
      box(0.2, 24, 13, side * 18.1, 19, 0, glazing);
      for (let floor = 0; floor < 8; floor++) {
        const y = 3 + floor * 4;
        for (let z = -28; z <= 28; z += 5)
          if (Math.abs(z) > 8) box(0.2, 1.7, 2.3, side * 18.15, y, z, glazing);
        for (const z of [-18, 18])
          box(1, 0.4, 18, side * 18.4, y + 1.4, z, pale);
        for (let x = -13; x <= 13; x += 5)
          box(2, 1.7, 0.2, x, y, 33.15, glazing);
      }
    }
    box(22, 2.3, 35, -2, 36.7, 0, pale);
    for (let z = -25; z <= 25; z += 10) panel(13, 36, z, 6, 6);
  }
  builder.finish();
  return true;
}

export function addInnovationBridge(
  parent: THREE.Group,
  mats: Materials,
  heightAt: (x: number, z: number) => number,
) {
  const group = new THREE.Group();
  group.name = 'Innovation_to_Business_curved_footbridge';
  group.userData = {
    name: '创科楼—商学院连接桥',
    heightEstimated: true,
    reference: 'IMG_0261, IMG_0263',
    endpoints: INNOVATION_BRIDGE_POINTS.filter(
      (_, i) => i === 0 || i === INNOVATION_BRIDGE_POINTS.length - 1,
    ),
    deckLevel: INNOVATION_BRIDGE_LEVEL,
  };
  parent.add(group);
  const { box, finish } = detailBuilder(group),
    level = INNOVATION_BRIDGE_LEVEL;
  const curve = new THREE.CatmullRomCurve3(
    INNOVATION_BRIDGE_POINTS.map(([x, z]) => new THREE.Vector3(x, level, z)),
    false,
    'centripetal',
  );
  const n = 40,
    width = 4.6,
    points = curve.getSpacedPoints(n);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      mid = a.clone().add(b).multiplyScalar(0.5),
      yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    const length = a.distanceTo(b) + 0.06;
    box(length, 0.7, width, mid.x, level - 0.35, mid.z, mats.pale, yaw);
    box(length, 0.38, width + 0.15, mid.x, level + 3.25, mid.z, mats.pale, yaw);
    const dx = (b.x - a.x) / a.distanceTo(b),
      dz = (b.z - a.z) / a.distanceTo(b);
    for (const side of [-1, 1]) {
      const x = mid.x - dz * side * width * 0.48,
        z = mid.z + dx * side * width * 0.48;
      box(length, 1.25, 0.1, x, level + 0.85, z, mats.glass, yaw);
      box(length, 0.15, 0.17, x, level + 1.55, z, mats.pale, yaw);
    }
    // Rectangular white ribs and dark inset roof glazing follow the bend.
    if (i % 2 === 0) {
      box(0.24, 0.3, width, mid.x, level + 3.52, mid.z, mats.pale, yaw);
      for (const side of [-1, 1])
        box(
          0.24,
          3.25,
          0.26,
          mid.x - dz * side * width * 0.48,
          level + 1.6,
          mid.z + dx * side * width * 0.48,
          mats.pale,
          yaw,
        );
    }
  }
  // A continuous inset roof strip makes the repeated white ribs legible.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      mid = a.clone().add(b).multiplyScalar(0.5),
      yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    box(
      a.distanceTo(b) * 0.75,
      0.05,
      width - 1.1,
      mid.x,
      level + 3.47,
      mid.z,
      mats.glass,
      yaw,
    );
  }
  const pier = curve.getPointAt(0.53);
  const ground =
    Math.min(
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) =>
          heightAt(
            pier.x + sx * 1.2 * Math.cos(0.28) + sz * 2.9 * Math.sin(0.28),
            pier.z - sx * 1.2 * Math.sin(0.28) + sz * 2.9 * Math.cos(0.28),
          ),
        ),
      ),
    ) - 0.25;
  box(
    2.4,
    Math.max(1, level + 4 - ground),
    5.8,
    pier.x,
    (ground + level + 4) / 2,
    pier.z,
    mats.pale,
    -0.28,
  );
  finish();
  return group;
}

export function addExistingBuildingDetails(
  b: Building,
  group: THREE.Group,
  mats: Materials,
  height: number,
) {
  const business = b.id === 'way/315573847';
  const hallSix = b.id === 'way/235329019',
    hallFour = b.id === 'way/235329015';
  if (!business && !hallSix && !hallFour) return;
  const { box, add, finish } = detailBuilder(group),
    top = b.base + height;
  const glass = new THREE.MeshStandardMaterial({
    color: '#465e6b',
    roughness: 0.37,
    metalness: 0.2,
  });
  const solar = new THREE.MeshStandardMaterial({
    color: '#425b72',
    roughness: 0.5,
  });
  if (business) {
    group.userData.photoFeatures = [
      'two raised wings',
      'setback roof terraces',
      'white horizontal sunshades',
    ];
    for (const [x, z, w, d, h, yaw] of [
      [-14, 146, 51, 18, 5, -0.58],
      [-6, 211, 44, 17, 7.5, -0.87],
    ]) {
      box(w, h, d, x, top + h / 2, z, mats.wall, yaw);
      for (let y = top + 1.4; y < top + h; y += 3) {
        for (const side of [-1, 1]) {
          const nx = Math.sin(yaw) * side,
            nz = Math.cos(yaw) * side;
          box(
            w - 4,
            1.5,
            0.15,
            x + nx * (d / 2 + 0.12),
            y,
            z + nz * (d / 2 + 0.12),
            glass,
            yaw,
          );
          box(w + 0.6, 0.45, d + 1.2, x, y + 1, z, mats.pale, yaw);
        }
      }
      box(w + 1, 0.5, d + 1, x, top + h + 0.3, z, mats.roof, yaw);
      box(w * 0.52, 2.2, d * 0.7, x, top + h + 1.6, z, mats.wall, yaw);
      box(w * 0.54, 0.45, d * 0.73, x, top + h + 2.92, z, mats.roof, yaw);
      for (const side of [-1, 1])
        box(
          w * 0.28,
          0.18,
          4,
          x + side * w * 0.32 * Math.cos(yaw),
          top + h + 0.65,
          z - side * w * 0.32 * Math.sin(yaw),
          solar,
          yaw,
        );
    }
  } else {
    group.userData.photoFeatures = [
      'projecting floor balconies',
      'rounded stair core',
      'roof equipment',
    ];
    const cores = hallSix
      ? [[163, -224, 3.1]]
      : [
          [235.6, -211, 2.35],
          [240.2, -183.5, 2.2],
        ];
    for (const [x, z, r] of cores) {
      add(
        new THREE.CylinderGeometry(r, r, height + 2.3, 32),
        mats.wall,
        x,
        b.base + (height + 2.3) / 2,
        z,
      );
      for (let y = b.base + 2; y < top + 2; y += 3.3) {
        add(
          new THREE.CylinderGeometry(r + 0.3, r + 0.3, 0.3, 32),
          mats.pale,
          x,
          y,
          z,
        );
        box(0.16, 1.7, 1.1, x + r + 0.08, y - 1, z, glass);
      }
      add(
        new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.45, 32),
        mats.roof,
        x,
        top + 2.55,
        z,
      );
    }
    if (hallFour) {
      box(7, 3.1, 14, 232, top + 1.6, -205, mats.wall, -0.2);
      box(7.5, 0.45, 14.5, 232, top + 3.37, -205, mats.roof, -0.2);
    }
  }
  finish();
}
