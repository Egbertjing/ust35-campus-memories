import * as THREE from 'three';
import type { Feature, Point } from './campus-model';
import { detailBuilder, type Materials } from './photo-architecture';
import {
  addAtriumEntrances,
  isPiazzaDoorZone,
  PIAZZA_DOOR_CENTERS,
  PIAZZA_DOOR_HALF_WIDTH,
} from './atrium-entrances';

type Zone = { x0: number; x1: number; z0: number; z1: number; rise: number };
// Absolute roof heights are relative to the Piazza, not the hillside below.
// These tiers are inferred from IMG_0251–0257; the source footprint is retained.
export function academicRoofRise(x: number, z: number) {
  if (z < -350 && x < -139) return 8;
  if (z < -303 && x >= -139) return 12;
  if (z < -224 && x < -139) return 22;
  if (x >= -114 && z >= -285 && z < -270) return -18.2;
  if (z >= -303 && z < -246 && x >= -139 && x < -95) return 16;
  if (z < -224) return 22;
  if (x < -169) return z < -144 ? 19 : 21;
  if (x < -139) return 24;
  if ((z >= -189 && z < -162) || z >= -116) return 23;
  return 19;
}

function clip(
  poly: Point[],
  axis: 0 | 1,
  value: number,
  above: boolean,
): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const aIn = above ? a[axis] >= value : a[axis] <= value;
    const bIn = above ? b[axis] >= value : b[axis] <= value;
    if (aIn) result.push(a);
    if (aIn !== bIn) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

export function addAcademicBuilding(
  b: Feature & { base: number },
  group: THREE.Group,
  mats: Materials,
  plaza: number,
) {
  const { box, add, finish } = detailBuilder(group);
  const glazing = new THREE.MeshStandardMaterial({
    color: '#344e5b',
    roughness: 0.31,
    metalness: 0.27,
  });
  glazing.name = 'Academic_continuous_glazing';
  const mullion = new THREE.MeshStandardMaterial({
    color: '#b9c7cc',
    roughness: 0.5,
    metalness: 0.3,
  });
  const solar = new THREE.MeshStandardMaterial({
    color: '#3f576f',
    roughness: 0.45,
    metalness: 0.16,
  });
  const red = new THREE.MeshStandardMaterial({
    color: '#d74045',
    roughness: 0.6,
  });
  group.userData.photoFeatures = [
    'stepped laboratory wings',
    'open courtyards',
    'library curved curtain wall',
    'Piazza crescent',
    'barrel glazed Atrium',
    'open bridge portal',
  ];
  group.userData.reference =
    'IMG_0251–0257, sixteen user scale-model photographs';
  group.userData.heightMeters = 54;
  const shape = new THREE.Shape(
    b.points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  for (const hole of b.holes ?? [])
    shape.holes.push(
      new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))),
    );
  const plan = new THREE.ShapeGeometry(shape),
    p = plan.attributes.position,
    ids = plan.index!;
  const xs = [-300, -169, -166, -139, -114, -95, 0];
  const zs = [
    ...new Set([
      -450,
      -350,
      -303,
      -285,
      -270,
      -246,
      -224,
      -189,
      -162,
      -144,
      -116,
      0,
      ...PIAZZA_DOOR_CENTERS.flatMap((z) => [
        z - PIAZZA_DOOR_HALF_WIDTH,
        z + PIAZZA_DOOR_HALF_WIDTH,
      ]),
    ]),
  ].sort((a, b) => a - b);
  const zones: Zone[] = [];
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++)
      zones.push({
        x0: xs[i - 1],
        x1: xs[i],
        z0: zs[j - 1],
        z1: zs[j],
        rise: academicRoofRise(
          (xs[i] + xs[i - 1]) / 2,
          (zs[j] + zs[j - 1]) / 2,
        ),
      });
  // Clip triangulated roof pieces to each height zone. This preserves both
  // concave wings and real courtyard holes without inventing rectangular infill.
  for (let i = 0; i < ids.count; i += 3) {
    const tri: Point[] = [0, 1, 2].map((k) => [
      p.getX(ids.getX(i + k)),
      -p.getY(ids.getX(i + k)),
    ]);
    for (const zone of zones) {
      let poly = clip(
        clip(
          clip(clip(tri, 0, zone.x0, true), 0, zone.x1, false),
          1,
          zone.z0,
          true,
        ),
        1,
        zone.z1,
        false,
      );
      if (poly.length < 3) continue;
      const area = Math.abs(
        poly.reduce((sum, a, k) => {
          const q = poly[(k + 1) % poly.length];
          return sum + a[0] * q[1] - q[0] * a[1];
        }, 0),
      );
      if (area < 0.01) continue;
      const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
      const top = plaza + zone.rise;
      const door = isPiazzaDoorZone(
        (zone.x0 + zone.x1) / 2,
        (zone.z0 + zone.z1) / 2,
      );
      const volumes = door
        ? [
            [b.base, Math.min(top, plaza + 0.55)],
            [plaza + 9.6, top],
          ]
        : [[b.base, top]];
      for (const [bottom, ceiling] of volumes) {
        if (ceiling <= bottom) continue;
        const g = new THREE.ExtrudeGeometry(s, {
          depth: ceiling - bottom,
          bevelEnabled: false,
          steps: 1,
        });
        g.rotateX(-Math.PI / 2);
        add(g, mats.wall, 0, bottom, 0);
      }
      const cap = new THREE.ShapeGeometry(s);
      cap.rotateX(-Math.PI / 2);
      add(cap, mats.roof, 0, top + 0.025, 0);
    }
  }
  plan.dispose();

  const rings = [b.points, ...(b.holes ?? [])];
  for (const [ringIndex, ring] of rings.entries()) {
    const area = ring.reduce((sum, a, k) => {
      const q = ring[(k + 1) % ring.length];
      return sum + a[0] * q[1] - q[0] * a[1];
    }, 0);
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1],
        c = ring[i],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const side = (ringIndex === 0 ? 1 : -1) * (area > 0 ? 1 : -1);
      const nx = (side * dz) / len,
        nz = (-side * dx) / len,
        yaw = -Math.atan2(dz, dx);
      const library = ringIndex === 0 && i >= 98 && i <= 116;
      const crescent = ringIndex === 0 && i <= 23;
      const n = Math.max(1, Math.round(len / (crescent ? 3 : 3.6)));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n,
          x = a[0] + dx * t,
          z = a[1] + dz * t;
        const top = plaza + academicRoofRise(x, z);
        // Continuous glass sheets replace the generic punched-window pattern.
        if (library) {
          box(
            len / n + 0.05,
            23.5,
            0.2,
            x + nx * 0.22,
            top - 13.25,
            z + nz * 0.22,
            glazing,
            yaw,
          );
          box(
            0.1,
            23.5,
            0.24,
            x + nx * 0.36,
            top - 13.25,
            z + nz * 0.36,
            mullion,
            yaw,
          );
          for (let y = top - 23; y < top - 2; y += 3.5)
            box(
              len / n + 0.04,
              0.1,
              0.25,
              x + nx * 0.36,
              y,
              z + nz * 0.36,
              mullion,
              yaw,
            );
          box(
            len / n + 0.08,
            1.8,
            0.95,
            x + nx * 0.36,
            top - 0.65,
            z + nz * 0.36,
            mats.pale,
            yaw,
          );
          box(
            len / n + 0.08,
            0.8,
            0.7,
            x + nx * 0.35,
            top - 25.2,
            z + nz * 0.35,
            mats.pale,
            yaw,
          );
        } else {
          if (crescent) {
            box(
              len / n + 0.03,
              2.2,
              0.22,
              x + nx * 0.23,
              plaza + 19.3,
              z + nz * 0.23,
              glazing,
              yaw,
            );
            box(
              0.12,
              2.2,
              0.25,
              x + nx * 0.37,
              plaza + 19.3,
              z + nz * 0.37,
              mullion,
              yaw,
            );
          }
          for (let y = b.base + 2.5; y < top - 1.3; y += 3.5) {
            if (crescent && (y < plaza + 1 || y > plaza + 17)) continue;
            if (crescent && z > -302 && z < -254) continue;
            if (x > -95 && z > -288 && z < -267) continue;
            box(
              crescent ? 2.05 : 1.7,
              crescent ? 2.35 : 1.3,
              0.18,
              x + nx * 0.18,
              y,
              z + nz * 0.18,
              glazing,
              yaw,
            );
          }
          if (crescent && k % 2 === 0 && (z <= -302 || z >= -254))
            box(
              0.65,
              11.5,
              1,
              x + nx * 0.35,
              plaza + 5.75,
              z + nz * 0.35,
              mats.pale,
              yaw,
            );
        }
        box(
          len / n + 0.03,
          0.9,
          0.45,
          x + nx * 0.06,
          top + 0.45,
          z + nz * 0.06,
          mats.pale,
          yaw,
        );
      }
    }
  }
  // Three broad white piers interrupt the Library's continuous curved glazing.
  for (const index of [101, 108, 114]) {
    const a = b.points[index],
      c = b.points[index + 1],
      yaw = -Math.atan2(c[1] - a[1], c[0] - a[0]);
    box(2.1, 27, 1.2, a[0], plaza - 1.5, a[1], mats.pale, yaw);
  }
  // A shallow barrel roof across the Atrium; its own lower support zone stays
  // below the spring line instead of covering the glass with a solid roof.
  const vault = new THREE.Group();
  vault.name = 'Atrium_barrel_glass_roof';
  group.add(vault);
  const vaultDetails = detailBuilder(vault);
  const n = 32,
    half = 20.5,
    centerZ = -277.5,
    x0 = -139,
    x1 = -96;
  const roofY = (t: number) => plaza + 16.7 + 6 * Math.sin(Math.PI * t);
  for (let i = 0; i < n; i++) {
    const t0 = i / n,
      t1 = (i + 1) / n,
      z0 = centerZ - half + t0 * half * 2,
      z1 = centerZ - half + t1 * half * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          x0,
          roofY(t0),
          z0,
          x1,
          roofY(t0),
          z0,
          x1,
          roofY(t1),
          z1,
          x0,
          roofY(t1),
          z1,
        ],
        3,
      ),
    );
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, t0, 1, t0, 1, t1, 0, t1], 2),
    );
    g.setIndex([0, 3, 2, 0, 2, 1]);
    g.computeVertexNormals();
    vaultDetails.add(g, glazing);
    if (i % 3 === 0)
      vaultDetails.box(
        x1 - x0,
        0.12,
        0.12,
        (x0 + x1) / 2,
        roofY(t0) + 0.08,
        z0,
        mullion,
      );
  }
  for (let x = x0; x <= x1; x += 3.6)
    for (let i = 1; i <= n; i++) {
      const t = (i - 0.5) / n,
        z = centerZ - half + t * half * 2;
      const g = new THREE.BoxGeometry(
        0.12,
        0.12,
        Math.hypot((half * 2) / n, roofY(i / n) - roofY((i - 1) / n)),
      );
      g.rotateX(-Math.atan2(roofY(i / n) - roofY((i - 1) / n), (half * 2) / n));
      vaultDetails.add(g, mullion, x, roofY(t) + 0.1, z);
    }
  vaultDetails.finish();
  // Bridge entrance portal: tall side piers and lintel leave the center open.
  for (const z of [-291.3, -263.7])
    box(8, 48, 10.5, -85, b.base + 24, z, mats.wall);
  box(8.5, 6, 39, -85, plaza + 21, -277.5, mats.pale);
  box(9, 0.65, 40, -85, plaza + 24.35, -277.5, mats.roof);
  box(36.5, 0.8, 7.6, -96, plaza - 17.9, -277.5, mats.pale);

  addAtriumEntrances(b, group, mats, plaza);

  // Repeated courts have raised stair heads and precise perimeter roof plant.
  const onRoof = (x: number, z: number) => {
    const test = (ring: Point[]) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i],
          q = ring[j];
        if (
          a[1] > z !== q[1] > z &&
          x < ((q[0] - a[0]) * (z - a[1])) / (q[1] - a[1]) + a[0]
        )
          c = !c;
      }
      return c;
    };
    return test(b.points) && !(b.holes ?? []).some(test);
  };
  for (const [start, end] of [
    [1, 22],
    [98, 115],
  ])
    for (let i = start; i < end; i += 2) {
      const a = b.points[i],
        c = b.points[i + 1],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        length = Math.hypot(dx, dz);
      const cx = (a[0] + c[0]) / 2,
        cz = (a[1] + c[1]) / 2;
      const options = [-1, 1].map(
        (side) =>
          [
            cx + ((side * dz) / length) * 5,
            cz - ((side * dx) / length) * 5,
          ] as Point,
      );
      const center = options.find(([x, z]) => onRoof(x, z));
      if (!center) continue;
      const y = plaza + academicRoofRise(...center) + 0.22,
        yaw = -Math.atan2(dz, dx);
      box(5.5, 0.18, 4, center[0], y, center[1], solar, yaw);
      for (let k = -2; k <= 2; k++)
        box(
          0.05,
          0.03,
          4,
          center[0] + (k * dx) / length,
          y + 0.11,
          center[1] + (k * dz) / length,
          mullion,
          yaw,
        );
    }
  box(13, 3.2, 11, -105, plaza + 13.6, -334, mats.wall);
  box(13.5, 0.45, 11.5, -105, plaza + 15.42, -334, mats.roof);
  for (const z of [-233, -179, -105]) {
    const y = plaza + academicRoofRise(-151, z);
    box(13, 4.3, 12, -151, y + 2.15, z, mats.wall);
    box(13.5, 0.55, 12.5, -151, y + 4.57, z, mats.roof);
  }
  for (let x = -215; x < -88; x += 11)
    for (let z = -235; z < -65; z += 12) {
      if (![-3, 3].every((dx) => [-3, 3].every((dz) => onRoof(x + dx, z + dz))))
        continue;
      const top = plaza + academicRoofRise(x, z);
      if (
        Math.abs(x + 151) < 12 &&
        [-233, -179, -105].some((cz) => Math.abs(z - cz) < 11)
      )
        continue;
      box(6.8, 0.18, 4.4, x, top + 0.26, z, solar);
      for (let k = -3; k <= 3; k += 1)
        box(0.04, 0.03, 4.4, x + k, top + 0.37, z, mullion);
      box(6.8, 0.03, 0.05, x, top + 0.37, z, mullion);
    }
  for (const hole of b.holes ?? []) {
    const x = Math.min(...hole.map((p) => p[0])) - 2.8,
      z = hole.reduce((s, p) => s + p[1], 0) / hole.length;
    const top = plaza + academicRoofRise(x, z);
    const stair = new THREE.CylinderGeometry(2.6, 2.6, 18, 24);
    add(stair, mats.pale, x, top - 7, z);
    for (let y = top - 14; y < top + 2; y += 3.5)
      add(new THREE.CylinderGeometry(2.8, 2.8, 0.3, 24), mats.pale, x, y, z);
  }
  // Red caps and large dark openings of the sea-facing lower lecture volumes.
  for (const z of [-178, -153, -107]) {
    box(9, 14, 13, -72, plaza - 5, z, mats.wall);
    box(0.22, 10, 9.5, -67.37, plaza - 4, z, glazing);
    box(10, 0.6, 14, -72, plaza + 2.3, z, red);
  }
  // Northern sports hall's sawtooth roof, deliberately lower than the crescent.
  for (let z = -399; z < -353; z += 7) {
    const tri = new THREE.Shape([
      new THREE.Vector2(z, 0),
      new THREE.Vector2(z + 6.2, 0),
      new THREE.Vector2(z + 6.2, 2.5),
    ]);
    const g = new THREE.ExtrudeGeometry(tri, {
      depth: 45,
      bevelEnabled: false,
    });
    g.rotateY(-Math.PI / 2);
    add(g, mats.pale, -151, plaza + 8.04, 0);
  }
  finish();
  return true;
}
