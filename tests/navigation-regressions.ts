import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  buildCampus,
  type CampusData,
  type Feature,
  type Point,
  type TerrainData,
} from '../lib/campus-model';
import {
  createCampusNavigation,
  isWalkableRoad,
  type CampusRoute,
} from '../lib/campus-navigation';
import { createRouteOverlay } from '../lib/campus-route-overlay';

const data = JSON.parse(
  readFileSync('public/data/campus.json', 'utf8'),
) as CampusData;
const dem = JSON.parse(
  readFileSync('public/data/terrain.json', 'utf8'),
) as TerrainData;
const campus = buildCampus(data, dem);
const navigation = createCampusNavigation(data, campus);
assert.equal(
  navigation.locations.length,
  15,
  'Every advertised destination has a mapped approach',
);
let pairs = 0;
for (const start of navigation.locations) {
  for (const end of navigation.locations) {
    const result = navigation.findRoute(start, end);
    if (start.id === end.id) {
      assert.match(result.error!, /同一位置/);
      continue;
    }
    assert.ok(result.route, `${start.name} → ${end.name}: ${result.error}`);
    const route = result.route;
    assert.deepEqual(route.points[0], start.position);
    assert.deepEqual(route.points.at(-1), end.position);
    assert.ok(route.points.flat().every(Number.isFinite));
    const geometricDistance = route.points
      .slice(1)
      .reduce(
        (sum, p, i) =>
          sum +
          Math.hypot(
            p[0] - route.points[i][0],
            p[1] - route.points[i][1],
            p[2] - route.points[i][2],
          ),
        0,
      );
    assert.ok(
      Math.abs(route.distance - geometricDistance) < 0.01,
      'Reported distance follows the 3D polyline',
    );
    assert.ok(
      Math.abs(
        route.distance -
          route.steps.reduce((sum, step) => sum + step.distance, 0),
      ) < 0.01,
    );
    assert.ok(route.minutes >= 1 && Number.isFinite(route.minutes));
    pairs++;
  }
}
const start = navigation.locations.find((l) => l.id === 'sundial')!;
const end = navigation.locations.find((l) => l.id === 'waterfront')!;
const route = navigation.findRoute(start, end).route!;
const reverse = navigation.findRoute(end, start).route!;
assert.ok(Math.abs(route.distance - reverse.distance) < 0.01);
assert.equal(route.steps.filter((s) => s.kind === 'lift').length, 3);
for (const step of route.steps.filter((s) => s.kind === 'lift')) {
  assert.equal(step.from[0], step.to[0]);
  assert.equal(step.from[2], step.to[2]);
  assert.ok(step.from[1] > step.to[1], 'Outbound lift instructions descend');
}
assert.ok(
  reverse.steps
    .filter((s) => s.kind === 'lift')
    .every((s) => s.to[1] > s.from[1]),
  'Return lift instructions ascend',
);
const bridge = route.steps.find((s) => s.name === '连桥 · Bridge Link')!;
assert.ok(Math.abs(bridge.from[1] - (campus.bridgeLevel + 0.8)) < 0.01);
assert.equal(
  bridge.to[1],
  bridge.from[1],
  'LG5 bridge stays on its deck level',
);
const upper = navigation.pickLocation(
  [63, -279],
  'Upper floor',
  campus.bridgeLevel + 0.8,
)!;
const lower = navigation.pickLocation(
  [63, -279],
  'Lower floor',
  campus.promenadeLevel + 0.8,
)!;
assert.notEqual(
  upper.nodeId,
  lower.nodeId,
  'Map picking distinguishes floors at the same X/Z',
);
assert.equal(navigation.findRoute(upper, lower).route!.steps[0].kind, 'lift');
assert.equal(navigation.pickLocation([10000, -10000]), null);
assert.equal(navigation.pickLocation([NaN, 0]), null);
assert.equal(navigation.pickLocation([63, -279], 'Invalid', Infinity), null);
assert.ok(navigation.findRoute({ ...start, nodeId: -1 }, end).error);

const road = (
  id: string,
  points: Point[],
  tags: Record<string, string> = {},
): Feature => ({
  id,
  name: id,
  nameZh: '',
  tags: { highway: 'footway', ...tags },
  center: points[0],
  points,
  levels: null,
  heightMeters: null,
});
const flat = {
  heightAt: () => 10,
  plazaHeight: 100,
  bridgeLevel: 82.5,
  promenadeLevel: 50,
};
const graph = (roads: Feature[]) =>
  createCampusNavigation({ ...data, roads }, flat);
const from: Point = [500, 500],
  to: Point = [540, 500];
const shortest = graph([
  road('direct', [from, to]),
  road('detour', [from, [500, 550], [540, 550], to]),
]);
assert.equal(
  shortest.findRoute(shortest.pickLocation(from)!, shortest.pickLocation(to)!)
    .route!.distance,
  40,
);
const disconnected = graph([
  road('west', [
    [500, 500],
    [510, 500],
  ]),
  road('east', [
    [520, 500],
    [530, 500],
  ]),
]);
assert.match(
  disconnected.findRoute(
    disconnected.pickLocation([500, 500])!,
    disconnected.pickLocation([530, 500])!,
  ).error!,
  /暂无连通/,
);
const crossing = graph([
  road(
    'over',
    [
      [500, 500],
      [540, 500],
    ],
    { bridge: 'yes', layer: '1' },
  ),
  road('under', [
    [520, 480],
    [520, 520],
  ]),
]);
assert.ok(
  crossing.findRoute(
    crossing.pickLocation([500, 500])!,
    crossing.pickLocation([520, 520])!,
  ).error,
  'Geometric crossings without mapped junctions must not connect',
);
const motorOneWay = graph([
  road('motor-one-way', [from, to], { oneway: 'yes' }),
]);
assert.ok(
  motorOneWay.findRoute(
    motorOneWay.pickLocation(to)!,
    motorOneWay.pickLocation(from)!,
  ).route,
  'Vehicle one-way rules do not restrict pedestrians',
);
const directionCases: Record<string, string>[] = [
  { 'oneway:foot': 'yes' },
  { highway: 'steps', conveying: 'forward' },
];
for (const tags of directionCases) {
  const directed = graph([road('directed', [from, to], tags)]);
  assert.deepEqual(
    directed.pickLocation(to)!.position,
    [540, 10.8, 500],
    'A node with incoming edges only is still a selectable destination',
  );
  assert.ok(
    directed.findRoute(directed.pickLocation(from)!, directed.pickLocation(to)!)
      .route,
  );
  assert.ok(
    directed.findRoute(directed.pickLocation(to)!, directed.pickLocation(from)!)
      .error,
  );
}
assert.equal(
  isWalkableRoad(road('restricted', [from, to], { foot: 'no' })),
  false,
);
assert.equal(
  isWalkableRoad(road('private', [from, to], { access: 'private' })),
  false,
);
assert.equal(
  isWalkableRoad(
    road('pedestrian-exception', [from, to], {
      access: 'private',
      foot: 'yes',
    }),
  ),
  true,
);
assert.equal(isWalkableRoad(road('area', [from, to], { area: 'yes' })), false);
assert.equal(
  isWalkableRoad(road('construction', [from, to], { construction: 'footway' })),
  false,
);
assert.equal(
  isWalkableRoad(road('tunnel', [from, to], { tunnel: 'yes' })),
  false,
);

// CPU-side overlay checks exercise geometry, animation and resource cleanup;
// these do not claim browser rendering or interaction coverage.
const element = () => ({
  className: '',
  textContent: '',
  hidden: false,
  style: {},
  dataset: {} as Record<string, string>,
  children: [] as unknown[],
  setAttribute() {},
  appendChild(child: unknown) {
    this.children.push(child);
  },
  replaceChildren() {
    this.children = [];
  },
  remove() {},
});
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: element },
});
const overlayHost = element();
const overlay = createRouteOverlay(
  overlayHost as unknown as HTMLElement,
  false,
);
const camera = new THREE.PerspectiveCamera(39, 1.5, 1, 6500);
camera.position.set(800, 800, 800);
camera.lookAt(0, 80, -250);
camera.updateMatrixWorld();
const vertical: CampusRoute = {
  ...route,
  points: [upper.position, lower.position],
  start: upper,
  end: lower,
  distance: Math.abs(upper.position[1] - lower.position[1]),
  steps: navigation.findRoute(upper, lower).route!.steps,
};
let released = 0;
for (const candidate of [route, reverse, vertical, route]) {
  overlay.setRoute(candidate);
  for (const now of [0, 1000, 2500]) {
    overlay.update(now, camera, 1200, 800);
    overlay.group.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
      if (object instanceof THREE.Mesh) {
        const geometry: THREE.BufferGeometry = object.geometry;
        for (const attribute of Object.values(geometry.attributes)) {
          assert.ok(
            Array.from(attribute.array).every(Number.isFinite),
            'Route geometry must remain finite',
          );
        }
      }
    });
  }
  const geometry = (overlay.group.children[0] as THREE.Mesh).geometry;
  geometry.addEventListener('dispose', () => {
    released++;
  });
}
const animatedArrow = overlay.group.children.find(
  (object) =>
    object instanceof THREE.Mesh &&
    object.geometry instanceof THREE.ConeGeometry,
) as THREE.Mesh | undefined;
assert(animatedArrow, 'A navigation route includes direction arrows');
overlay.update(0, camera, 1200, 800);
const arrowStart = animatedArrow.position.clone();
overlay.update(1000, camera, 1200, 800);
assert(
  arrowStart.distanceTo(animatedArrow.position) > 1,
  'Navigation arrows must advance with elapsed time even when the camera is stationary',
);
const geometryBeforeLanguage = (overlay.group.children[0] as THREE.Mesh)
  .geometry;
const endpointNames = () =>
  (overlayHost.children[0] as ReturnType<typeof element>).children.map(
    (pin) =>
      (
        (pin as ReturnType<typeof element>).children[1] as ReturnType<
          typeof element
        >
      ).textContent,
  );
overlay.setLanguage('en');
assert.deepEqual(endpointNames(), [
  'Sundial Piazza',
  'Waterfront Sports Ground',
]);
assert.equal(
  (overlay.group.children[0] as THREE.Mesh).geometry,
  geometryBeforeLanguage,
  'Switching language updates labels without recreating route geometry',
);
overlay.setLanguage('zh');
assert.deepEqual(endpointNames(), [route.start.name, route.end.name]);
overlay.setRoute(null);
assert.equal(
  overlay.group.children.length,
  0,
  'Clearing the route removes the overlay',
);
assert.equal(
  released,
  4,
  'Changing and clearing routes releases old geometries',
);
overlay.dispose();
console.log(
  `Navigation regressions passed: ${pairs} destination pairs, vertical connections, picking, directed/restricted/disconnected paths, overlay geometry and cleanup.`,
);
