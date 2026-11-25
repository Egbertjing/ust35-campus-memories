import * as THREE from 'three';
import { detailBuilder } from './photo-architecture';

type Surface = (u: number, v: number) => THREE.Vector3;
export const RED_BIRD_HEIGHT = 8.5;
// The tall wing is one end of a continuous crescent, not a separate blade
// across its axis. Both sides share the rounded lower envelope.
const curve = (points: number[][]) =>
  new THREE.CatmullRomCurve3(
    points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
const lowerOutline = curve([
  [-2.3, 4.1],
  [-2.3, 2.5],
  [-1.4, 0.6],
  [0, 0],
  [1.55, 0.55],
  [2.5, 1.75],
  [2.75, 3.25],
]);
const dialGuide = curve([
  [-2.3, 4.1],
  [-1.6, 2.8],
  [-0.85, 1.9],
  [0.1, 1.65],
  [1.25, 1.9],
  [2.25, 2.45],
  [2.75, 3.25],
]);
const axisY = new THREE.Vector3(0, 1, 0);
export const RED_BIRD_TILT = new THREE.Euler(0, 0, 0.12, 'XYZ');
export const RED_BIRD_ARM_DIRECTIONS = [
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
];
function bodyOuter(u: number) {
  const p = lowerOutline.getPoint(u);
  p.y = Math.max(0, p.y);
  return p;
}
function dialEdge(u: number) {
  return dialGuide.getPoint(u);
}
const highOutside = curve([
  [-2.6, 8.5],
  [-1.92, 7.55],
  [-1.65, 6.25],
  [-1.92, 5.3],
  [-2.25, 4.65],
  bodyOuter(0).toArray(),
]);
const highInside = curve([
  [-2.597, 8.5],
  [-1.0, 7.3],
  [-0.45, 5.9],
  [-0.62, 4.5],
  [-1.0, 2.65],
  dialEdge(0.35).toArray(),
]);
const HIGH_WING_FRACTION = 0.43;
// Two continuous crescent profiles occupy perpendicular planes through the
// SAME centre. Curved paired faces give each radial arm a pointed lens section.
// No wing has its own offset or yaw: all four directions remain exactly 90°.
export const redBirdMainWing: Surface = (u, v) => {
  let outside: THREE.Vector3, inside: THREE.Vector3;
  if (u < HIGH_WING_FRACTION) {
    const t = u / HIGH_WING_FRACTION;
    outside = highOutside.getPoint(t);
    inside = highInside.getPoint(t);
  } else {
    const t = (u - HIGH_WING_FRACTION) / (1 - HIGH_WING_FRACTION);
    outside = bodyOuter(t);
    inside = dialEdge(0.35 + t * 0.65);
  }
  const p = outside.lerp(inside, v);
  // The S-shaped upper extension stays thin. The lower body rounds out into
  // the other crescent and closes at its outer and inner silhouette edges.
  const lower = THREE.MathUtils.smoothstep(u, 0.28, 0.6);
  p.z =
    (0.055 + 0.4 * lower) *
    Math.sin(Math.PI * v) *
    Math.sin(Math.PI * u) ** 1.15;
  return p;
};
export function redBirdShortWing(side: number): Surface {
  return (u, v) => {
    const p = bodyOuter(u).lerp(dialEdge(u), v);
    p.z = side * 0.455 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u) ** 1.15;
    return p.applyAxisAngle(axisY, Math.PI / 2);
  };
}
export const redBirdMainBack: Surface = (u, v) => {
  const p = redBirdMainWing(u, v);
  p.z *= -1;
  return p;
};
export const redBirdDialSurface: Surface = (u, v) => {
  const p = dialGuide.getPoint(u);
  // The hour strip belongs to the low crescent; it narrows into both tips.
  const width = 0.82 * Math.sin(Math.PI * u) ** 1.3 + 0.004;
  p.z = (v - 0.5) * width;
  p.y -= 0.045 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u);
  return p.applyAxisAngle(axisY, Math.PI / 2);
};

function normalAt(surface: Surface, u: number, v: number) {
  const du = surface(Math.min(1, u + 0.0005), v).sub(
    surface(Math.max(0, u - 0.0005), v),
  );
  const dv = surface(u, Math.min(1, v + 0.0005)).sub(
    surface(u, Math.max(0, v - 0.0005)),
  );
  const normal = du.cross(dv);
  return normal.lengthSq() > 1e-14
    ? normal.normalize()
    : new THREE.Vector3(1, 0, 0);
}

// Both sides and the perimeter are real geometry, so grazing views show a
// narrow steel edge instead of revealing a zero-thickness plane.
function steelGeometry(
  surface: Surface,
  rows: number,
  cols: number,
  thickness: number,
) {
  const vertices: number[] = [],
    uv: number[] = [],
    ids: number[] = [];
  const count = (rows + 1) * (cols + 1);
  for (const side of [-1, 1])
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= cols; j++) {
        const u = i / rows,
          v = j / cols;
        const p = surface(u, v).addScaledVector(
          normalAt(surface, u, v),
          (side * thickness) / 2,
        );
        vertices.push(...p.toArray());
        uv.push(u, v);
      }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j,
        b = a + cols + 1;
      ids.push(a, a + 1, b, b, a + 1, b + 1);
      ids.push(
        a + count,
        b + count,
        a + count + 1,
        b + count,
        b + count + 1,
        a + count + 1,
      );
    }
  const boundary: number[] = [];
  for (let j = 0; j <= cols; j++) boundary.push(j);
  for (let i = 1; i <= rows; i++) boundary.push(i * (cols + 1) + cols);
  for (let j = cols - 1; j >= 0; j--) boundary.push(rows * (cols + 1) + j);
  for (let i = rows - 1; i > 0; i--) boundary.push(i * (cols + 1));
  for (let k = 0; k < boundary.length; k++) {
    const a = boundary[k],
      b = boundary[(k + 1) % boundary.length];
    ids.push(a, a + count, b, b, a + count, b + count);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}

// Small raised Arabic numerals, drawn as rounded metal strokes rather than a
// bitmap. They remain in the reusable GLB and follow the curved dial surface.
const glyphs: Record<string, number[][][]> = {
  '0': [
    [
      [0.15, 0],
      [0, 0.18],
      [0, 0.8],
      [0.15, 1],
      [0.5, 1],
      [0.65, 0.8],
      [0.65, 0.18],
      [0.5, 0],
      [0.15, 0],
    ],
  ],
  '1': [
    [
      [0.12, 0.76],
      [0.35, 1],
      [0.35, 0],
    ],
    [
      [0.12, 0],
      [0.58, 0],
    ],
  ],
  '2': [
    [
      [0, 0.8],
      [0.1, 0.97],
      [0.46, 1],
      [0.64, 0.84],
      [0.64, 0.65],
      [0, 0],
      [0.65, 0],
    ],
  ],
  '3': [
    [
      [0, 0.94],
      [0.46, 1],
      [0.65, 0.82],
      [0.5, 0.55],
      [0.23, 0.51],
    ],
    [
      [0.5, 0.55],
      [0.65, 0.3],
      [0.56, 0.07],
      [0.15, 0],
      [0, 0.13],
    ],
  ],
  '4': [
    [
      [0.52, 0],
      [0.52, 1],
      [0, 0.3],
      [0.67, 0.3],
    ],
  ],
  '5': [
    [
      [0.65, 1],
      [0.03, 1],
      [0, 0.55],
      [0.48, 0.55],
      [0.65, 0.38],
      [0.64, 0.16],
      [0.48, 0],
      [0.11, 0],
      [0, 0.13],
    ],
  ],
  '6': [
    [
      [0.6, 0.94],
      [0.38, 1],
      [0.12, 0.85],
      [0, 0.49],
      [0, 0.18],
      [0.14, 0],
      [0.48, 0],
      [0.65, 0.18],
      [0.65, 0.39],
      [0.48, 0.57],
      [0.12, 0.54],
      [0, 0.36],
    ],
  ],
  '7': [
    [
      [0, 1],
      [0.65, 1],
      [0.18, 0],
    ],
  ],
  '8': [
    [
      [0.15, 0.52],
      [0, 0.72],
      [0.03, 0.9],
      [0.17, 1],
      [0.48, 1],
      [0.63, 0.88],
      [0.65, 0.72],
      [0.48, 0.52],
      [0.15, 0.52],
      [0, 0.3],
      [0.03, 0.12],
      [0.17, 0],
      [0.48, 0],
      [0.63, 0.12],
      [0.65, 0.3],
      [0.48, 0.52],
    ],
  ],
  '9': [
    [
      [0.02, 0.07],
      [0.29, 0],
      [0.53, 0.2],
      [0.65, 0.52],
      [0.65, 0.83],
      [0.48, 1],
      [0.16, 1],
      [0, 0.83],
      [0, 0.61],
      [0.17, 0.46],
      [0.53, 0.49],
      [0.65, 0.66],
    ],
  ],
};

export function createRedBird() {
  const bird = new THREE.Group();
  bird.name = 'Red_Bird_curved_steel_shells';
  bird.userData = {
    name: '红鸟日晷',
    sculptureHeight: RED_BIRD_HEIGHT,
    reference: 'Three user ground photographs; HKUST Campus Management Office',
    photoFeatures: [
      'continuous S-wing and crescent shell',
      'four orthogonal radial arms sharing one central body',
      'one rigid tilt applied to the whole sculpture',
      'unequal crescent wings',
      'curved Arabic-hour dial',
      'gnomon across the low crescent opening',
      'thin steel edges',
    ],
  };
  const red = new THREE.MeshPhysicalMaterial({
    color: '#e21a23',
    roughness: 0.3,
    metalness: 0.14,
    clearcoat: 0.28,
    clearcoatRoughness: 0.25,
  });
  red.name = 'Red_Bird_red_painted_steel';
  const shell = (
    name: string,
    surface: Surface,
    nu: number,
    nv: number,
    thickness: number,
  ) => {
    const mesh = new THREE.Mesh(steelGeometry(surface, nu, nv, thickness), red);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...bird.userData };
    bird.add(mesh);
  };
  shell('Red_Bird_continuous_S_crescent', redBirdMainWing, 180, 24, 0.036);
  shell('Red_Bird_continuous_S_crescent_back', redBirdMainBack, 180, 24, 0.036);
  shell('Red_Bird_low_crescent_front', redBirdShortWing(1), 96, 20, 0.036);
  shell('Red_Bird_low_crescent_back', redBirdShortWing(-1), 96, 20, 0.036);
  shell('Red_Bird_curved_hour_dial', redBirdDialSurface, 96, 18, 0.035);

  const metal = new THREE.MeshStandardMaterial({
    color: '#e4e2d6',
    metalness: 0.48,
    roughness: 0.35,
  });
  metal.name = 'Red_Bird_metal_hour_marks';
  const marks = new THREE.Group();
  marks.name = 'Red_Bird_hour_marks_and_Arabic_numerals';
  bird.add(marks);
  const builder = detailBuilder(marks);
  const rod = (
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
    builder.add(g, material, mid.x, mid.y, mid.z);
  };
  const dialPoint = (u: number, v: number) => {
    const normal = normalAt(redBirdDialSurface, u, v);
    if (normal.y < 0) normal.negate();
    return redBirdDialSurface(u, v).addScaledVector(normal, 0.032);
  };
  for (let i = 0; i <= 48; i++) {
    const u = 0.07 + (i / 48) * 0.86,
      major = i % 4 === 0;
    for (const side of [-1, 1]) {
      const edge = side === -1 ? 0.06 : 0.94;
      rod(
        dialPoint(u, edge),
        dialPoint(u, edge - side * (major ? 0.18 : 0.09)),
        major ? 0.012 : 0.008,
        metal,
      );
    }
  }
  const hours = [
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
  ];
  for (let i = 0; i < hours.length; i++) {
    const u = 0.085 + (i / 12) * 0.83;
    const tangentLength =
      redBirdDialSurface(u + 0.001, 0.5).distanceTo(
        redBirdDialSurface(u - 0.001, 0.5),
      ) / 0.002;
    const width = hours[i].length * 0.21;
    for (const [characterIndex, character] of [...hours[i]].entries())
      for (const stroke of glyphs[character]) {
        const points = stroke.map(([x, y]) =>
          dialPoint(
            u - (characterIndex * 0.21 + x * 0.25 - width / 2) / tangentLength,
            0.38 + y * 0.23,
          ),
        );
        for (let k = 1; k < points.length; k++)
          rod(points[k - 1], points[k], 0.009, metal);
      }
  }
  const start = redBirdShortWing(1)(0, 1),
    end = redBirdShortWing(1)(1, 1);
  // Both anchors belong to the same low crescent, before the entire
  // rigid four-arm assembly is inclined.
  rod(start, end, 0.028, metal);
  bird.userData.gnomonAnchors = [start.toArray(), end.toArray()];
  for (const p of [start, end])
    builder.add(new THREE.SphereGeometry(0.062, 12, 8), metal, p.x, p.y, p.z);
  builder.finish();
  // Use one transform for the steel, dial, figures and rod. Inclination must
  // never change the 90-degree relationship of the radial wing axes.
  const structure = new THREE.Group();
  structure.name = 'Red_Bird_orthogonal_tilted_assembly';
  const members = [...bird.children];
  for (const member of members) structure.add(member);
  structure.rotation.copy(RED_BIRD_TILT);
  const bounds = new THREE.Box3().setFromObject(structure, true);
  structure.scale.setScalar(RED_BIRD_HEIGHT / (bounds.max.y - bounds.min.y));
  bird.add(structure);
  bird.userData.armDirections = RED_BIRD_ARM_DIRECTIONS.map((p) => p.toArray());
  bird.userData.wholeTiltRadians = RED_BIRD_TILT.toArray();
  return bird;
}
