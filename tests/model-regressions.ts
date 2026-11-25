import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  buildCampus,
  inside,
  type CampusData,
  type TerrainData,
} from '../lib/campus-model';
import { createSeaLabel, SEA_LABEL_POSITION } from '../lib/sea-label';
import { redBirdMainWing, redBirdShortWing } from '../lib/red-bird';
import {
  photoCampusBuildings,
  PHOTO_BUILDING_IDS,
  REPLACED_SERVICE_IDS,
  INNOVATION_BRIDGE_POINTS,
  INNOVATION_BRIDGE_LEVEL,
} from '../lib/photo-campus-data';

const data = JSON.parse(
  readFileSync('public/data/campus.json', 'utf8'),
) as CampusData;
const dem = JSON.parse(
  readFileSync('public/data/terrain.json', 'utf8'),
) as TerrainData;
const wall = new THREE.Texture();
const window = new THREE.Texture();
const grass = new THREE.Texture();
const campus = buildCampus(data, dem, { wall, window, grass });
campus.root.updateMatrixWorld(true);

// Raycast the visible surfaces, rather than accepting maps on hidden geometry.
let visibleTexturedRoofs = 0;
const ray = new THREE.Raycaster();
for (const building of campus.buildingsGroup.children) {
  if (!(building instanceof THREE.Group)) continue;
  const center = new THREE.Box3()
    .setFromObject(building)
    .getCenter(new THREE.Vector3());
  ray.set(
    new THREE.Vector3(center.x, 500, center.z),
    new THREE.Vector3(0, -1, 0),
  );
  const hit = ray.intersectObject(building, true)[0];
  if (hit?.object.name !== 'Textured_roof_cap') continue;
  const mesh = hit.object as THREE.Mesh;
  const material = (
    Array.isArray(mesh.material)
      ? mesh.material[hit.face!.materialIndex]
      : mesh.material
  ) as THREE.MeshStandardMaterial;
  assert.equal(
    material.map,
    wall,
    `${building.name}: the exposed roof must use the tile map`,
  );
  visibleTexturedRoofs++;
}
const genericRoofCount = campus.buildingsGroup.children.filter((b) =>
  b.getObjectByName('Textured_roof_cap'),
).length;
assert(
  visibleTexturedRoofs / genericRoofCount > 0.85,
  `Expected exposed mapped surfaces on most generic roofs; got ${visibleTexturedRoofs}/${genericRoofCount}`,
);

// New buildings must be real, selectable geometry with mapped roof materials.
const sourceBuildings = photoCampusBuildings(data);
for (const id of Object.values(PHOTO_BUILDING_IDS)) {
  const building = campus.buildingsGroup.children.find(
    (g) => g.userData.osmId === id,
  );
  assert(building, `Missing photo-reference building ${id}`);
  const box = new THREE.Box3().setFromObject(building);
  assert(box.max.y - box.min.y >= 34, `${id}: should be a multi-storey tower`);
  let mappedRoof = false;
  building.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (
          m.name === 'campus_roof' &&
          (m as THREE.MeshStandardMaterial).map === wall
        )
          mappedRoof = true;
  });
  assert(mappedRoof, `${id}: detailed roof must retain its material map`);
}
for (const id of REPLACED_SERVICE_IDS)
  assert(!sourceBuildings.some((b) => b.id === id));
const bridge = campus.buildingsGroup.getObjectByName(
  'Innovation_to_Business_curved_footbridge',
);
assert(bridge);
const innovation = sourceBuildings.find(
  (b) => b.id === PHOTO_BUILDING_IDS.innovation,
)!;
const business = sourceBuildings.find((b) => b.id === 'way/315573847')!;
assert(
  inside(...INNOVATION_BRIDGE_POINTS[0], innovation.points),
  'New bridge must meet innovation tower',
);
const bridgeEnd = INNOVATION_BRIDGE_POINTS.at(-1)!;
assert(
  inside(bridgeEnd[0] + 0.15, bridgeEnd[1] + 0.15, business.points),
  'New bridge must reach the business facade',
);
assert(INNOVATION_BRIDGE_LEVEL > Number(innovation.tags['model:base']) + 3);
assert(
  INNOVATION_BRIDGE_LEVEL <
    Number(innovation.tags['model:base']) + innovation.heightMeters!,
);

// Test the rendered terrain triangles, not just the analytic grading function.
const ground = campus.root.getObjectByName(
  'Terrain_Mapzen_DEM_approximate_terraces',
) as THREE.Mesh;
const track = data.areas.find((a) => a.id === 'relation/3173913')!;
let trackSamples = 0;
for (let x = 267; x <= 423; x += 8)
  for (let z = -315; z <= -165; z += 8) {
    if (
      !inside(x, z, track.points) ||
      (track.holes ?? []).some((h) => inside(x, z, h))
    )
      continue;
    ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(ground)[0];
    assert(
      hit && hit.point.y < 7.4,
      `Terrain protrudes through track at ${x},${z}: ${hit?.point.y}`,
    );
    trackSamples++;
  }
assert(trackSamples > 30);

// Inspect actual visible courtyard glazing; the academic facade is now custom
// batched geometry rather than part of the campus-wide window instances.
const academic = campus.buildingsGroup.children.find(
  (g) => g.userData.osmId === 'relation/3174704',
)!;
assert(academic);
const holes = data.buildings.find(
  (b) => b.name === 'Academic Building',
)!.holes!;
let exposedCourtyardWindows = 0;
for (const hole of holes) {
  const minX = Math.min(...hole.map((p) => p[0])),
    maxX = Math.max(...hole.map((p) => p[0]));
  const minZ = Math.min(...hole.map((p) => p[1])),
    maxZ = Math.max(...hole.map((p) => p[1]));
  // Sky must remain open all the way down through each court.
  ray.set(
    new THREE.Vector3((minX + maxX) / 2, 400, (minZ + maxZ) / 2),
    new THREE.Vector3(0, -1, 0),
  );
  assert.equal(
    ray.intersectObject(academic, true).length,
    0,
    'A roof must not fill an open courtyard',
  );
  for (let z = minZ + 5; z < maxZ - 4; z += 1.2)
    for (let y = 115.79; y < 144; y += 3.5) {
      ray.set(
        new THREE.Vector3((minX + maxX) / 2, y, z),
        new THREE.Vector3(1, 0, 0),
      );
      const hit = ray.intersectObject(academic, true)[0];
      if (
        hit &&
        (hit.object as THREE.Mesh).material instanceof
          THREE.MeshStandardMaterial &&
        ((hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial)
          .name === 'Academic_continuous_glazing'
      )
        exposedCourtyardWindows++;
    }
}
assert(
  exposedCourtyardWindows > 50,
  'Courtyard glazing must sit in front of the opaque walls',
);
for (const name of [
  'campus_facade_tiles',
  'campus_roof',
  'Academic_continuous_glazing',
]) {
  assert(
    academic.children.some(
      (o) =>
        o instanceof THREE.Mesh && (o.material as THREE.Material).name === name,
    ),
    `Missing academic geometry batch: ${name}`,
  );
}
const academicRoofSamples = [
  [-180, -377],
  [-111, -344],
  [-210, -166],
  [-150, -172],
  [-93, -205],
];
const roofHeights = academicRoofSamples.map(([x, z]) => {
  ray.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(academic, true)[0];
  assert(hit, `Missing academic roof at ${x},${z}`);
  return hit.point.y;
});
assert(
  Math.max(...roofHeights) - Math.min(...roofHeights) > 10,
  'Academic wings must have visibly different roof levels',
);
// Doors must be holes with usable depth, and the bridge has an unbroken floor.
for (const z of [-291.5, -278.5, -265.5]) {
  for (const y of [campus.plazaHeight + 2, campus.plazaHeight + 7]) {
    ray.set(new THREE.Vector3(-169, y, z), new THREE.Vector3(1, 0, 0));
    const hit = ray.intersectObject(academic, true)[0];
    assert(
      !hit || hit.point.x > -128,
      `Piazza entrance is blocked at ${hit?.point.x},${y},${z}`,
    );
  }
}
for (let x = -110; x < -73; x += 2) {
  ray.set(
    new THREE.Vector3(x, campus.plazaHeight - 14, -277.5),
    new THREE.Vector3(0, -1, 0),
  );
  const floorHit = ray.intersectObject(campus.root, true)[0];
  assert(
    floorHit && Math.abs(floorHit.point.y - (campus.plazaHeight - 17.5)) < 0.8,
    `Bridge floor discontinuity at ${x}: ${floorHit?.point.y}`,
  );
  const terrainHit = ray.intersectObject(ground)[0];
  assert(
    terrainHit && terrainHit.point.y < campus.plazaHeight - 18,
    `Ground blocks bridge entrance at ${x}`,
  );
}
const bird = campus.root.getObjectByName('Red_Bird_curved_steel_shells')!;
assert(bird);
const assembly = bird.getObjectByName('Red_Bird_orthogonal_tilted_assembly')!;
assert(assembly, 'The whole sculpture must share one inclined assembly');
const assemblyInverse = assembly.matrixWorld.clone().invert();
const basis = [0, 1, 2].map((i) =>
  new THREE.Vector3().setFromMatrixColumn(assembly.matrixWorld, i),
);
const assemblyScale = basis[0].length();
assert(assemblyScale > 0);
for (let i = 0; i < 3; i++) {
  assert(
    Math.abs(basis[i].length() - assemblyScale) < 1e-9,
    'The assembly may only use uniform scale',
  );
  for (let j = i + 1; j < 3; j++)
    assert(
      Math.abs(basis[i].dot(basis[j])) < 1e-9,
      'The common inclination must not shear the sculpture',
    );
}
assert(assembly.matrixWorld.determinant() > 0, 'Do not reflect the sculpture');
assert(
  basis[1]
    .clone()
    .normalize()
    .distanceTo(new THREE.Vector3(0, 1, 0)) > 0.01,
  'The whole four-arm sculpture should be inclined',
);

// Read the generated tip vertices as well as the exported surfaces. Metadata
// can describe a cross even when independently offset or rotated wings do not.
const tipSources = [
  { name: 'Red_Bird_continuous_S_crescent', surface: redBirdMainWing },
  { name: 'Red_Bird_low_crescent_front', surface: redBirdShortWing(1) },
];
const localTips: THREE.Vector3[] = [];
for (const { name, surface } of tipSources) {
  const mesh = bird.getObjectByName(name) as THREE.Mesh;
  assert(mesh instanceof THREE.Mesh, `Missing radial crescent ${name}`);
  const position = mesh.geometry.getAttribute('position');
  const uv = mesh.geometry.getAttribute('uv');
  const localMatrix = assemblyInverse.clone().multiply(mesh.matrixWorld);
  for (const u of [0, 1]) {
    const surfaceTip = new THREE.Vector3();
    for (let j = 0; j <= 8; j++) surfaceTip.add(surface(u, j / 8));
    surfaceTip.divideScalar(9);
    for (let j = 0; j <= 8; j++)
      assert(
        surface(u, j / 8).distanceTo(surfaceTip) < 0.01,
        `${name}: radial arms must close to pointed tips`,
      );
    const geometryTip = new THREE.Vector3();
    let tipVertices = 0;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(uv.getX(i) - u) > 1e-6) continue;
      geometryTip.add(
        new THREE.Vector3()
          .fromBufferAttribute(position, i)
          .applyMatrix4(localMatrix),
      );
      tipVertices++;
    }
    assert(tipVertices > 0, `${name}: no generated vertices at the arm tip`);
    geometryTip.divideScalar(tipVertices);
    assert(
      geometryTip.distanceTo(surfaceTip) < 0.001,
      `${name}: rendered tips must retain the shared local coordinate system`,
    );
    assert(
      Math.hypot(geometryTip.x, geometryTip.z) > 2,
      'Each arm must extend out from the common centre',
    );
    assert(
      Math.min(Math.abs(geometryTip.x), Math.abs(geometryTip.z)) < 0.001,
      'Actual arm tips must lie on the local X/Z axes through the same centre',
    );
    localTips.push(geometryTip);
  }
}
const tipAngles = localTips
  .map((p) => Math.atan2(p.z, p.x))
  .sort((a, b) => a - b);
const armAnglesDegrees = tipAngles.map((angle, i) => {
  const next = tipAngles[(i + 1) % tipAngles.length];
  const gap = (next - angle + Math.PI * 2) % (Math.PI * 2);
  assert(
    Math.abs(gap - Math.PI / 2) < 1e-5,
    `Actual adjacent tips must be 90 degrees apart; got ${(gap * 180) / Math.PI}`,
  );
  return (gap * 180) / Math.PI;
});

// Select the upper wing by height, not by a fixed u value: its parameter now
// also traverses the entire lower crescent.
let upperWingWidth = 0;
for (let i = 0; i <= 200; i++) {
  const a = redBirdMainWing(i / 200, 0);
  const b = redBirdMainWing(i / 200, 1);
  if (Math.min(a.y, b.y) > 4.5 && Math.max(a.y, b.y) < 7.5)
    upperWingWidth = Math.max(upperWingWidth, a.distanceTo(b) * assemblyScale);
}
assert(
  upperWingWidth > 0.75,
  'The upper S-wing must retain a broad steel face',
);

const anchors = bird.userData.gnomonAnchors as number[][];
assert.equal(anchors.length, 2);
for (const [i, u] of [0, 1].entries())
  assert(
    new THREE.Vector3(...anchors[i]).distanceTo(redBirdShortWing(1)(u, 1)) <
      0.001,
    'The sundial rod must meet the actual low-crescent endpoint',
  );
assert(
  Math.abs(anchors[0][1] - anchors[1][1]) > 0.05,
  'The two low-crescent endpoints have different heights',
);

const steelBounds = new THREE.Box3();
let lowestPoint = new THREE.Vector3(0, Infinity, 0);
let birdMeshCount = 0;
const metalMeshes: THREE.Mesh[] = [];
bird.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  birdMeshCount++;
  let ancestor: THREE.Object3D | null = o;
  while (ancestor && ancestor !== assembly) ancestor = ancestor.parent;
  assert(
    ancestor,
    `${o.name}: all steel, marks and the rod must share the inclination`,
  );
  const relative = assemblyInverse.clone().multiply(o.matrixWorld);
  for (let i = 0; i < 3; i++)
    assert(
      new THREE.Vector3()
        .setFromMatrixColumn(relative, i)
        .distanceTo(
          new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0),
        ) < 1e-8,
      `${o.name}: individual pieces must not introduce another rotation or scale`,
    );
  const position = o.geometry.attributes.position;
  const normal = o.geometry.attributes.normal;
  assert(position?.count > 0, `${o.name}: empty sculpture mesh`);
  assert(normal?.count === position.count, `${o.name}: missing vertex normals`);
  for (const attribute of Object.values(
    o.geometry.attributes,
  ) as THREE.BufferAttribute[])
    for (const value of attribute.array)
      assert(
        Number.isFinite(value),
        `${o.name}: non-finite geometry attribute`,
      );
  const index = o.geometry.index;
  assert((index?.count ?? position.count) > 0, `${o.name}: missing triangles`);
  assert.equal((index?.count ?? position.count) % 3, 0);
  if (index)
    for (const value of index.array)
      assert(
        value >= 0 && value < position.count,
        `${o.name}: invalid triangle index`,
      );
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  const isSteel = materials.some(
    (m) => m.name === 'Red_Bird_red_painted_steel',
  );
  if (materials.some((m) => m.name === 'Red_Bird_metal_hour_marks'))
    metalMeshes.push(o);
  for (let i = 0; i < position.count; i++) {
    const normalLength = Math.hypot(
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i),
    );
    assert(
      Math.abs(normalLength - 1) < 1e-5,
      `${o.name}: zero or invalid normal`,
    );
    if (!isSteel) continue;
    const p = new THREE.Vector3()
      .fromBufferAttribute(position, i)
      .applyMatrix4(o.matrixWorld);
    steelBounds.expandByPoint(p);
    if (p.y < lowestPoint.y) lowestPoint = p;
  }
});
assert(!steelBounds.isEmpty());
assert(metalMeshes.length > 0, 'The metal rod, numerals and ticks must exist');
const worldAnchors = anchors.map((p) =>
  new THREE.Vector3(...p).applyMatrix4(assembly.matrixWorld),
);
const rodDirection = worldAnchors[1].clone().sub(worldAnchors[0]).normalize();
const rodPerpendicular = rodDirection
  .clone()
  .cross(new THREE.Vector3(1, 0, 0))
  .normalize();
assert(rodPerpendicular.length() > 0.99);
// Check the real merged rod geometry at both attachments and along its span.
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  const centre = worldAnchors[0].clone().lerp(worldAnchors[1], t);
  ray.set(
    centre.clone().addScaledVector(rodPerpendicular, 0.2 * assemblyScale),
    rodPerpendicular.clone().negate(),
  );
  const rodHit = ray.intersectObjects(metalMeshes)[0];
  assert(
    rodHit && rodHit.point.distanceTo(centre) < 0.08 * assemblyScale,
    `The rendered rod must connect its tilted anchors without a gap at t=${t}`,
  );
}
ray.set(
  lowestPoint.clone().add(new THREE.Vector3(0, 0.02, 0)),
  new THREE.Vector3(0, -1, 0),
);
const plinthHit = ray.intersectObjects(
  bird.parent!.children.filter((o) => o !== bird),
  true,
)[0];
assert(
  plinthHit && Math.abs(plinthHit.point.y - lowestPoint.y) < 0.005,
  'The steel body must touch the stone plinth',
);
assert(
  bird.getObjectByName('Red_Bird_hour_marks_and_Arabic_numerals')?.children
    .length,
  'The curved dial must retain its metal numerals and tick marks',
);
assert(
  Math.abs(steelBounds.max.y - steelBounds.min.y - 8.5) < 0.01,
  'The actual tilted steel vertices, not transformed bounding-box corners, must span 8.5 metres',
);
assert(
  steelBounds.max.z - steelBounds.min.z > 2 &&
    steelBounds.max.x - steelBounds.min.x > 2,
  'Sundial must have depth, not a flat silhouette',
);
const windows = campus.buildingsGroup.getObjectByName(
  'Facade_windows_approximate',
) as THREE.InstancedMesh;

// Only the canvas text drawing is stubbed; mesh geometry and camera projection are real.
Object.assign(globalThis, {
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillText() {} }),
    }),
  },
});
const seaLabel = createSeaLabel();
assert.deepEqual(seaLabel.position.toArray(), [...SEA_LABEL_POSITION]);
assert.equal(seaLabel.material.depthTest, true);
assert.equal(seaLabel.material.depthWrite, false);
assert.equal(campus.isLand(seaLabel.position.x, seaLabel.position.z), false);
seaLabel.updateMatrixWorld(true);
const normal = new THREE.Vector3(0, 0, 1).transformDirection(
  seaLabel.matrixWorld,
);
assert(
  normal.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6,
  'Sea text should lie on the water plane',
);
const camera = new THREE.PerspectiveCamera(39, 1.5, 1, 6500);
const project = (eye: THREE.Vector3) => {
  camera.position.copy(eye);
  camera.lookAt(0, 40, -160);
  camera.updateMatrixWorld(true);
  return seaLabel.position.clone().project(camera);
};
const first = project(new THREE.Vector3(1170, 1090, 1020));
const second = project(new THREE.Vector3(1300, 700, -600));
assert(
  Math.hypot(first.x - second.x, first.y - second.y) > 0.1,
  'Sea label must move on screen when the camera orbits',
);
const terrain = campus.root.getObjectByName(
  'Terrain_Mapzen_DEM_approximate_terraces',
) as THREE.Mesh;
assert.equal((terrain.material as THREE.MeshStandardMaterial).map, grass);
assert.equal((windows.material as THREE.MeshStandardMaterial).map, window);
console.log(
  JSON.stringify({
    visibleTexturedRoofs,
    exposedCourtyardWindows,
    photoBuildings: Object.keys(PHOTO_BUILDING_IDS).length,
    trackSamples,
    redBird: {
      armAnglesDegrees,
      steelHeight: steelBounds.max.y - steelBounds.min.y,
      birdMeshCount,
      rod: 'connected after the common rigid inclination',
    },
    seaLabel: 'world anchored; follows camera; depth tested',
    status: 'passed',
  }),
);
