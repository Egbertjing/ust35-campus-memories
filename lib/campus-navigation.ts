import type { CampusData, Feature, Point } from './campus-model';

export type Position3D = [number, number, number];
export type RouteKind = 'walk' | 'steps' | 'lift' | 'bridge';
export type NavigationLocation = {
  id: string;
  name: string;
  nodeId: number;
  position: Position3D;
};
export type RouteStep = {
  name: string;
  kind: RouteKind;
  distance: number;
  from: Position3D;
  to: Position3D;
};
export type CampusRoute = {
  start: NavigationLocation;
  end: NavigationLocation;
  points: Position3D[];
  steps: RouteStep[];
  distance: number;
  minutes: number;
  ascent: number;
};
export type NavigationResult =
  | { route: CampusRoute; error?: never }
  | { route?: never; error: string };
type Edge = { to: number; distance: number; kind: RouteKind; name: string };
type Node = { position: Position3D; edges: Edge[]; connected: boolean };
type Levels = {
  heightAt: (x: number, z: number) => number;
  plazaHeight: number;
  bridgeLevel: number;
  promenadeLevel: number;
};

// These are approach points on mapped paths, rather than building centroids.
// Entrances and the model's vertical connections remain conceptual estimates.
export const navigationDestinations: {
  id: string;
  name: string;
  point: Point;
  level?: string;
}[] = [
  { id: 'sundial', name: '日晷广场', point: [-192.942, -280.771] },
  {
    id: 'atrium',
    name: '学术大楼 · 中庭',
    point: [-132, -278.5],
    level: 'piazza',
  },
  { id: 'concourse', name: '吴家玮学术廊', point: [-142.57, -151.195] },
  { id: 'library', name: '图书馆', point: [-122.059, -370.05] },
  {
    id: 'bridge',
    name: '连桥 · LG5 入口',
    point: [-78.091, -277.32],
    level: 'lg5',
  },
  {
    id: 'hall1',
    name: '本科生宿舍一座',
    point: [63, -279],
    level: 'promenade',
  },
  {
    id: 'hall2',
    name: '本科生宿舍二座',
    point: [153.804, -276.408],
    level: 'promenade',
  },
  { id: 'hall3', name: '本科生宿舍三座', point: [83, -405] },
  { id: 'waterfront', name: '海滨运动场', point: [278.52, -236.377] },
  { id: 'computing', name: '人工智能超级运算中心', point: [212.187, -299.017] },
  { id: 'business', name: '李兆基商学大楼', point: [-28.852, 162.516] },
  { id: 'shaw', name: '逸夫演艺中心', point: [-164.4, 88.778] },
  { id: 'medical', name: '医学教研综合大楼', point: [-179.155, 22.932] },
  { id: 'innovation', name: '李家诚创科大楼', point: [-89.974, 113.279] },
  { id: 'north-gate', name: '北门 · 大学道', point: [-329.51, -426.367] },
];

export function isWalkableRoad(road: Feature) {
  const t = road.tags;
  const pedestrianPermission = ['yes', 'designated', 'permissive'].includes(
    t.foot,
  );
  return (
    [
      'footway',
      'pedestrian',
      'path',
      'steps',
      'service',
      'residential',
      'living_street',
      'unclassified',
      'track',
    ].includes(t.highway) &&
    road.points.length > 1 &&
    t.area !== 'yes' &&
    t.tunnel !== 'yes' &&
    t.indoor !== 'yes' &&
    Number(t.layer ?? 0) >= 0 &&
    !['no', 'private'].includes(t.foot) &&
    (pedestrianPermission || !['no', 'private'].includes(t.access)) &&
    t.construction === undefined
  );
}

const distance3D = (a: Position3D, b: Position3D) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createCampusNavigation(data: CampusData, levels: Levels) {
  const nodes: Node[] = [];
  const keys = new Map<string, number>();
  const nodeLevels: string[] = [];
  const pointKey = (p: Point, level: string) =>
    `${p[0].toFixed(3)},${p[1].toFixed(3)},${level}`;
  let pathCount = 0;
  const addNode = (
    p: Point,
    y: number,
    level = 'ground',
    sampleKey?: string,
  ) => {
    const key = sampleKey ?? pointKey(p, level);
    const found = keys.get(key);
    if (found !== undefined) return found;
    const id = nodes.length;
    nodes.push({ position: [p[0], y, p[1]], edges: [], connected: false });
    nodeLevels.push(level);
    keys.set(key, id);
    return id;
  };
  const addEdge = (
    a: number,
    b: number,
    kind: RouteKind,
    name: string,
    oneWay = false,
  ) => {
    const distance = distance3D(nodes[a].position, nodes[b].position);
    if (a === b || distance < 0.001) return;
    nodes[a].connected = nodes[b].connected = true;
    nodes[a].edges.push({ to: b, distance, kind, name });
    if (!oneWay) nodes[b].edges.push({ to: a, distance, kind, name });
  };
  const addPath = (
    points: Point[],
    name: string,
    kind: RouteKind = 'walk',
    height: (x: number, z: number) => number = (x, z) =>
      levels.heightAt(x, z) + 0.8,
    level = 'ground',
    oneWay = false,
  ) => {
    const pathId = pathCount++;
    let previous: number | undefined;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)];
      const count =
        i === 0
          ? 1
          : Math.max(1, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / 4));
      for (let j = 1; j <= count; j++) {
        const q: Point = [
          a[0] + ((p[0] - a[0]) * j) / count,
          a[1] + ((p[1] - a[1]) * j) / count,
        ];
        // Terrain samples are private to this segment. Only original mapped
        // vertices may form junctions, even if two samples happen to coincide.
        const id = addNode(
          q,
          height(...q),
          level,
          j < count ? `sample:${pathId}:${i}:${j}` : undefined,
        );
        if (previous !== undefined) addEdge(previous, id, kind, name, oneWay);
        previous = id;
      }
    }
  };

  for (const road of data.roads) {
    if (
      !isWalkableRoad(road) ||
      ['Bridge Link', 'Fong Shu Chuen Promenade'].includes(road.name)
    )
      continue;
    const concourse =
      road.tags.layer === '2' && road.center[0] > -155 && road.center[0] < -115;
    const kind: RouteKind =
      road.tags.highway === 'steps'
        ? 'steps'
        : road.tags.bridge === 'yes'
          ? 'bridge'
          : 'walk';
    const name =
      road.nameZh ||
      road.name ||
      (kind === 'steps'
        ? '校园阶梯'
        : kind === 'bridge'
          ? '校园步行桥'
          : road.tags.highway === 'service'
            ? '校园道路'
            : '校园步道');
    let points = road.points;
    if (road.tags['oneway:foot'] === '-1' || road.tags.conveying === 'backward')
      points = [...points].reverse();
    addPath(
      points,
      name,
      kind,
      (x, z) =>
        concourse
          ? levels.plazaHeight + 0.8
          : levels.heightAt(x, z) + (kind === 'bridge' ? 5 : 0.8),
      'ground',
      ['yes', '-1'].includes(road.tags['oneway:foot']) ||
        ['forward', 'backward'].includes(road.tags.conveying),
    );
  }

  const plaza = levels.plazaHeight + 0.8;
  const lg5 = levels.bridgeLevel + 0.8;
  const promenade = levels.promenadeLevel + 0.8;
  // Explicit, model-aligned connections. Coincident X/Z positions on different
  // floors are deliberately distinct nodes; only a lift joins those floors.
  addPath(
    [
      [-192.942, -280.771],
      [-177, -278.5],
      [-154, -278.5],
      [-132, -278.5],
      [-112, -278.5],
    ],
    '日晷广场 · 中庭通道',
    'walk',
    () => plaza,
    'piazza',
  );
  const join = (
    p: Point,
    a: string,
    ya: number,
    b: string,
    yb: number,
    name: string,
    kind: RouteKind = 'walk',
  ) => {
    const first = addNode(p, ya, a),
      second = addNode(p, yb, b);
    // Equal-height boundaries still need graph connectivity.
    if (distance3D(nodes[first].position, nodes[second].position) < 0.001) {
      nodes[first].connected = nodes[second].connected = true;
      nodes[first].edges.push({ to: second, distance: 0, kind, name });
      nodes[second].edges.push({ to: first, distance: 0, kind, name });
    } else addEdge(first, second, kind, name);
  };
  join([-192.942, -280.771], 'ground', plaza, 'piazza', plaza, '日晷广场');
  addPath(
    [
      [-132, -278.5],
      [-130.657, -251.216],
    ],
    '中庭 · 学术廊通道',
    'walk',
    () => plaza,
    'piazza',
  );
  join([-130.657, -251.216], 'piazza', plaza, 'ground', plaza, '学术廊入口');
  join(
    [-112, -278.5],
    'piazza',
    plaza,
    'lg5',
    lg5,
    '中庭电梯 · G/F ↔ LG5',
    'lift',
  );
  addPath(
    [
      [-112, -278.5],
      [-78.091, -277.32],
      [-20.161, -277.231],
      [-0.154, -277.699],
      [58.023, -278.066],
      [63, -279],
    ],
    '连桥 · Bridge Link',
    'bridge',
    () => lg5,
    'lg5',
  );
  join(
    [63, -279],
    'lg5',
    lg5,
    'promenade',
    promenade,
    '宿舍一座电梯 · 10/F ↔ G/F',
    'lift',
  );
  addPath(
    [
      [63, -279],
      [69, -286],
      [74, -287],
      [82, -284],
      [85, -279],
      [86, -276],
      [92.002, -276.051],
      [153.804, -276.408],
    ],
    '方树泉廊',
    'bridge',
    () => promenade,
    'promenade',
  );
  join(
    [153.804, -276.408],
    'promenade',
    promenade,
    'ground',
    levels.heightAt(153.804, -276.408) + 0.8,
    '宿舍二座电梯 · 廊桥 ↔ 地面',
    'lift',
  );
  join(
    [63, -279],
    'promenade',
    promenade,
    'ground',
    levels.heightAt(63, -279) + 0.8,
    '宿舍一座地面出口',
    'steps',
  );
  addPath(
    [
      [63, -279],
      [54.882, -278.044],
    ],
    '宿舍一座入口',
  );

  const nearestNode = (
    point: Point,
    maxDistance: number,
    level?: string,
    elevation?: number,
  ) => {
    let best = Infinity,
      result: number | undefined;
    nodes.forEach((node, id) => {
      if (!node.connected || (level && nodeLevels[id] !== level)) return;
      const distance = Math.hypot(
        node.position[0] - point[0],
        node.position[2] - point[1],
      );
      if (distance > maxDistance) return;
      const score =
        distance +
        (elevation === undefined
          ? 0
          : Math.abs(node.position[1] - elevation) * 0.4);
      if (score < best) {
        best = score;
        result = id;
      }
    });
    return result;
  };
  const locations: NavigationLocation[] = navigationDestinations.flatMap(
    (destination) => {
      const nodeId = nearestNode(
        destination.point,
        35,
        destination.level ?? 'ground',
      );
      return nodeId === undefined
        ? []
        : [
            {
              id: destination.id,
              name: destination.name,
              nodeId,
              position: nodes[nodeId].position,
            },
          ];
    },
  );

  const pickLocation = (
    point: Point,
    name = '地图选点',
    elevation?: number,
  ): NavigationLocation | null => {
    if (
      !point.every(Number.isFinite) ||
      (elevation !== undefined && !Number.isFinite(elevation))
    )
      return null;
    // Snap only to a nearby mapped path. Never invent a straight crossing of
    // buildings, sea, or disconnected components to make a route succeed.
    const nodeId = nearestNode(point, 28, undefined, elevation);
    if (nodeId === undefined) return null;
    return {
      id: `map-${nodeId}`,
      name,
      nodeId,
      position: nodes[nodeId].position,
    };
  };

  const findRoute = (
    start: NavigationLocation,
    end: NavigationLocation,
  ): NavigationResult => {
    if (!nodes[start.nodeId] || !nodes[end.nodeId])
      return { error: '位置已失效，请重新选择起点和终点。' };
    if (start.nodeId === end.nodeId)
      return { error: '起点和终点是同一位置，请选择另一个地点。' };
    const costs = new Float64Array(nodes.length).fill(Infinity);
    const previous = new Map<number, { node: number; edge: Edge }>();
    const visited = new Set<number>();
    const pending = new Set([start.nodeId]);
    costs[start.nodeId] = 0;
    // Dijkstra over a small campus graph. Every edge is a mapped path or an
    // explicit model connection, including the measured model-space height.
    while (pending.size) {
      let current = -1,
        best = Infinity;
      for (const id of pending)
        if (costs[id] < best) {
          current = id;
          best = costs[id];
        }
      if (current === end.nodeId) break;
      pending.delete(current);
      visited.add(current);
      for (const edge of nodes[current].edges) {
        if (visited.has(edge.to)) continue;
        const cost = best + edge.distance;
        if (cost < costs[edge.to]) {
          costs[edge.to] = cost;
          previous.set(edge.to, { node: current, edge });
          pending.add(edge.to);
        }
      }
    }
    if (!Number.isFinite(costs[end.nodeId]))
      return { error: '这两个位置之间暂无连通的步行路线，请换一个附近入口。' };
    const chain: { node: number; edge: Edge }[] = [];
    for (let id = end.nodeId; id !== start.nodeId;) {
      const entry = previous.get(id)!;
      chain.push(entry);
      id = entry.node;
    }
    chain.reverse();
    const steps: RouteStep[] = [];
    const points: Position3D[] = [nodes[start.nodeId].position];
    let seconds = 0,
      ascent = 0;
    for (const { node, edge } of chain) {
      const from = nodes[node].position,
        to = nodes[edge.to].position;
      if (edge.distance < 0.001) continue;
      points.push(to);
      ascent += Math.max(0, to[1] - from[1]);
      const last = steps.at(-1);
      if (last?.name === edge.name && last.kind === edge.kind) {
        last.distance += edge.distance;
        last.to = to;
      } else {
        steps.push({
          name: edge.name,
          kind: edge.kind,
          distance: edge.distance,
          from,
          to,
        });
        if (edge.kind === 'lift') seconds += 35;
      }
      seconds +=
        edge.distance /
        (edge.kind === 'steps' ? 0.7 : edge.kind === 'lift' ? 1.5 : 1.2);
    }
    return {
      route: {
        start,
        end,
        points,
        steps,
        distance: costs[end.nodeId],
        minutes: Math.max(1, Math.ceil(seconds / 60)),
        ascent,
      },
    };
  };
  return { locations, pickLocation, findRoute, nodeCount: nodes.length };
}

export type CampusNavigation = ReturnType<typeof createCampusNavigation>;
