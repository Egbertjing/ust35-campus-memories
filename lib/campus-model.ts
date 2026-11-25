import * as THREE from 'three';
import {clipSubmergedTerrain} from './terrain-water-clip';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  photoCampusBuildings,
  PHOTO_BUILDING_IDS,
  INNOVATION_BRIDGE_POINTS,
  PHOTO_TERRACES,
} from './photo-campus-data';
import {
  addPhotoBuilding,
  addInnovationBridge,
  addExistingBuildingDetails,
} from './photo-architecture';
import { addAcademicBuilding } from './academic-architecture';
import { addSundial } from './sundial-landmark';
import {createCampusVehicles} from './campus-vehicles';

export type Point = [number, number];
export type Feature = {
  id: string;
  name: string;
  nameZh: string;
  tags: Record<string, string>;
  center: Point;
  points: Point[];
  holes?: Point[][];
  levels: number | null;
  heightMeters: number | null;
};
export type CampusData = {
  buildings: Feature[];
  roads: Feature[];
  areas: Feature[];
  coastline: Feature[];
  campusBoundary: { points: Point[] };
  metadata: Record<string, unknown>;
};
export type TerrainData = {
  rows: number;
  cols: number;
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  heights: number[][];
};
export const landmarks = [
  { name: '日晷广场', view: 'sundial', x: -207, z: -281, lift: 16 },
  { name: '学术大楼', view: 'academic', x: -129, z: -140, lift: 29 },
  { name: '海滨宿舍', view: 'waterfront', x: 65, z: -420, lift: 35 },
  { name: '海滨运动场', view: 'waterfront', x: 355, z: -236, lift: 6 },
  { name: '李兆基商学大楼', view: 'south', x: -4, z: 177, lift: 30 },
  { name: '逸夫演艺中心', view: 'south', x: -159, z: 121, lift: 20 },
  { name: '连桥 · Bridge Link', view: 'bridge', x: 22, z: -278, lift: 35 },
  { name: '医学教研综合大楼', view: 'innovation', x: -207, z: 18, lift: 47 },
  { name: '李家诚创科大楼', view: 'innovation', x: -94, z: 68, lift: 38 },
  {
    name: '人工智能超级运算中心',
    view: 'computing',
    x: 231,
    z: -273,
    lift: 48,
  },
];
export function inside(x: number, z: number, ring: Point[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
const material = (
  color: string,
  opts: THREE.MeshStandardMaterialParameters = {},
) => new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...opts });
function shapeOf(points: Point[], holes: Point[][] = []) {
  const s = new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], -p[1])));
  for (const h of holes)
    s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], -p[1]))));
  return s;
}
function extrude(
  points: Point[],
  height: number,
  y: number,
  mats: THREE.Material | THREE.Material[],
  holes: Point[][] = [],
  wallTile: Point = [8, 8],
  roofTile = 8,
) {
  const g = new THREE.ExtrudeGeometry(shapeOf(points, holes), {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const uv = g.attributes.uv,
    pos = g.attributes.position,
    norm = g.attributes.normal;
  // Unwrap along each perimeter so curved walls keep a continuous window
  // rhythm; projecting each face from world X/Z makes windows jump at corners.
  const edges = [points, ...holes].flatMap((ring) => {
    let distance = 0;
    return ring
      .slice(1)
      .map((p, i) => {
        const a = ring[i],
          dx = p[0] - a[0],
          dz = p[1] - a[1];
        const length = Math.hypot(dx, dz);
        const edge = { a, dx, dz, length, distance };
        distance += length;
        return edge;
      })
      .filter((edge) => edge.length > 1e-6);
  });
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(norm.getY(i)) > 0.7)
      uv.setXY(i, pos.getX(i) / roofTile, pos.getZ(i) / roofTile);
    else {
      let best = Infinity,
        along = 0;
      for (const edge of edges) {
        const t = THREE.MathUtils.clamp(
          ((pos.getX(i) - edge.a[0]) * edge.dx +
            (pos.getZ(i) - edge.a[1]) * edge.dz) /
            edge.length ** 2,
          0,
          1,
        );
        const distance = Math.hypot(
          pos.getX(i) - edge.a[0] - t * edge.dx,
          pos.getZ(i) - edge.a[1] - t * edge.dz,
        );
        const alignment = Math.abs(
          (norm.getX(i) * edge.dx + norm.getZ(i) * edge.dz) / edge.length,
        );
        const score = distance + alignment * 100;
        if (score < best) {
          best = score;
          along = edge.distance + t * edge.length;
        }
      }
      uv.setXY(i, along / wallTile[0], (pos.getY(i) - y) / wallTile[1]);
    }
  }
  const mesh = new THREE.Mesh(g, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export type CampusTextures = {
  wall?: THREE.Texture;
  window?: THREE.Texture;
  grass?: THREE.Texture;
};
export function buildCampus(
  data: CampusData,
  dem: TerrainData,
  textures: CampusTextures = {},
) {
  const root = new THREE.Group();
  root.name = 'HKUST_Clear_Water_Bay';
  root.userData = {
    attribution:
      '© OpenStreetMap contributors, ODbL 1.0; Terrain: Mapzen / USGS / NOAA',
    precision:
      'Concept model. Estimated elevations, heights and facades. Not photogrammetry.',
    units: 'meters',
    origin: [114.265, 22.335],
    axes: 'X east, Y up, Z south',
  };
  const vegetation = new THREE.Group();
  vegetation.name = 'Vegetation';
  root.add(vegetation);
  const buildingsGroup = new THREE.Group();
  buildingsGroup.name = 'Buildings';
  root.add(buildingsGroup);
  const surfaces = new THREE.Group();
  surfaces.name = 'Roads_and_landmarks';
  root.add(surfaces);
  const rawHeight = (x: number, z: number) => {
    const u = THREE.MathUtils.clamp(
        ((x - dem.xMin) / (dem.xMax - dem.xMin)) * (dem.cols - 1),
        0,
        dem.cols - 1.001,
      ),
      v = THREE.MathUtils.clamp(
        ((z - dem.zMin) / (dem.zMax - dem.zMin)) * (dem.rows - 1),
        0,
        dem.rows - 1.001,
      );
    const i = Math.floor(u),
      j = Math.floor(v),
      a = u - i,
      b = v - j;
    return Math.max(
      1,
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(dem.heights[j][i], dem.heights[j][i + 1], a),
        THREE.MathUtils.lerp(
          dem.heights[j + 1][i],
          dem.heights[j + 1][i + 1],
          a,
        ),
        b,
      ),
    );
  };
  const domain = {
    xMin: -800,
    xMax: dem.xMax,
    zMin: dem.zMin,
    zMax: dem.zMax + 10,
  };
  const coastline = data.coastline.flatMap((f) => f.points);
  const coast: Point[] = [
    [coastline[0][0], domain.zMax + 1],
    ...coastline,
    [coastline[coastline.length - 1][0], domain.zMin - 1],
  ];
  const landRing: Point[] = [
    ...coast,
    [-1000, coast[coast.length - 1][1]],
    [-1000, coast[0][1]],
  ];
  const isLand = (x: number, z: number) => inside(x, z, landRing);
  const coastDistance = (x: number, z: number) => {
    let dist = Infinity;
    for (let i = 1; i < coast.length; i++) {
      const a = coast[i - 1],
        b = coast[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = THREE.MathUtils.clamp(
          ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
          0,
          1,
        );
      dist = Math.min(dist, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
    }
    return dist;
  };
  const bounds = (f: Feature) => ({
    minX: Math.min(...f.points.map((p) => p[0])),
    maxX: Math.max(...f.points.map((p) => p[0])),
    minZ: Math.min(...f.points.map((p) => p[1])),
    maxZ: Math.max(...f.points.map((p) => p[1])),
  });
  const bData = photoCampusBuildings(data)
    .filter(
      (b) => b.tags.building !== 'roof' && b.tags.building !== 'construction',
    )
    .map((b) => ({
      ...b,
      ...bounds(b),
      base: b.tags['model:base']
        ? Number(b.tags['model:base'])
        : rawHeight(...b.center),
    }));
  const piazza = data.areas.find((a) => a.name === 'HKUST Piazza')!;
  const plazaHeight = rawHeight(-207, -281);
  for (const b of bData)
    if (b.name === 'Academic Building') b.base = plazaHeight - 27;
  const bridgeLevel = plazaHeight - 5 * 3.5;
  const pavilion = bData.find((b) => b.id === 'way/233624044');
  const track = data.areas.find((a) => a.id === 'relation/3173913');
  const sportAreas = data.areas
    .filter(
      (a) =>
        a.tags.leisure === 'pitch' ||
        a.tags.leisure === 'swimming_pool' ||
        a.tags.leisure === 'track',
    )
    .map((a) => ({
      ...a,
      ...bounds(a),
      base:
        a.center[0] > 170 && a.center[1] < -170 ? 7 : rawHeight(...a.center),
    }));
  const computingParcel = data.areas.find(
    (a) => a.id === PHOTO_BUILDING_IDS.computing,
  );
  // Match the existing radial forecourt in sundial-landmark.ts; no new pavement is added.
  const forecourtFootprint: Point[] = Array.from({length:97},(_,i)=>{
    const a=-1.45+i/96*3.12;
    return [-210.35+56.8*Math.cos(a),-278.44+56.8*Math.sin(a)];
  });
  forecourtFootprint.push(forecourtFootprint[0]);
  const plazaMargin = (x:number,z:number) => {
    let distance=Infinity;
    for(const ring of [piazza.points,forecourtFootprint])for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
      distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
    }
    return distance;
  };
  const heightAt = (x: number, z: number) => {
    let h = rawHeight(x, z);
    const edge = coastDistance(x, z);
    if (!isLand(x, z)) return -2;
    if (edge < 30)
      h = THREE.MathUtils.lerp(2, h, THREE.MathUtils.smoothstep(edge, 0, 30));
    if (inside(x, z, piazza.points) || inside(x,z,forecourtFootprint) || Math.hypot(x + 207, z + 281) < 22)
      return plazaHeight;
    if(Math.hypot(x+207,z+281)<90){
      const margin=plazaMargin(x,z);
      if(margin<12)return plazaHeight;
      if(margin<24)h=THREE.MathUtils.lerp(plazaHeight,h,THREE.MathUtils.smoothstep(margin,12,24));
    }
    if (x > -124 && x < -65 && z > -295 && z < -260)
      return Math.min(h, bridgeLevel - 1.5);
    for (const t of PHOTO_TERRACES) {
      const distance = Math.max(
        t.xMin - x,
        x - t.xMax,
        t.zMin - z,
        z - t.zMax,
        0,
      );
      if (distance < 2) return t.base;
      if (distance < 7)
        h = THREE.MathUtils.lerp(
          t.base,
          h,
          THREE.MathUtils.smoothstep(distance, 2, 7),
        );
    }
    // The western teaching wings open onto a broad paved terrace in the
    // scale model. The DEM instead places an uncut hillside at roof height.
    const academicTerraceDistance = Math.max(
      -244 - x,
      x + 165,
      -224 - z,
      z + 54,
      0,
    );
    if (academicTerraceDistance < 18) {
      const grade =
        plazaHeight + 2 + THREE.MathUtils.clamp((z + 224) / 170, 0, 1) * 2;
      h = Math.min(
        h,
        THREE.MathUtils.lerp(
          grade,
          h,
          THREE.MathUtils.smoothstep(academicTerraceDistance, 0, 18),
        ),
      );
    }
    // The coarse DEM raises this small waterfront plot by over 15 metres.
    // Grade the mapped parcel to the contiguous sports/pool terrace in photos.
    if (computingParcel) {
      if (inside(x, z, computingParcel.points)) return 7;
      let distance = Infinity;
      for (let i = 1; i < computingParcel.points.length; i++) {
        const a = computingParcel.points[i - 1],
          b = computingParcel.points[i];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = THREE.MathUtils.clamp(
            ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
            0,
            1,
          );
        distance = Math.min(
          distance,
          Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz),
        );
      }
      if (distance < 9)
        h = THREE.MathUtils.lerp(
          7,
          h,
          THREE.MathUtils.smoothstep(distance, 0, 9),
        );
    }
    for (const b of bData) {
      if (
        x >= b.minX - 2 &&
        x <= b.maxX + 2 &&
        z >= b.minZ - 2 &&
        z <= b.maxZ + 2 &&
        inside(x, z, b.points)
      )
        return b.name === 'Academic Building'
          ? Math.min(h, plazaHeight)
          : b.base;
    }
    // Flat interiors take precedence over the feathered margin of any other
    // overlapping court. The outer track needs one terrain-cell margin so
    // coarse triangles cannot slope through its visible surface.
    for (const a of sportAreas) {
      const pad = a.id === 'relation/3173913' ? 9 : 0;
      if (
        x >= a.minX - pad &&
        x <= a.maxX + pad &&
        z >= a.minZ - pad &&
        z <= a.maxZ + pad
      )
        return a.base;
    }
    for (const a of sportAreas) {
      const pad = a.id === 'relation/3173913' ? 9 : 0;
      if (
        x > a.minX - pad - 5 &&
        x < a.maxX + pad + 5 &&
        z > a.minZ - pad - 5 &&
        z < a.maxZ + pad + 5
      ) {
        const dx = Math.max(a.minX - pad - x, x - a.maxX - pad, 0),
          dz = Math.max(a.minZ - pad - z, z - a.maxZ - pad, 0);
        h = Math.min(
          h,
          THREE.MathUtils.lerp(
            a.base,
            h,
            THREE.MathUtils.smoothstep(Math.max(dx, dz), 0, 5),
          ),
        );
      }
    }
    if (x > -85 && x < -20 && Math.abs(z + 277.5) < 15) {
      const blend = 1 - THREE.MathUtils.smoothstep(Math.abs(z + 277.5), 5, 15);
      h = THREE.MathUtils.lerp(h, Math.min(h, bridgeLevel - 6), blend);
    }
    return h;
  };
  const grass = material(textures.grass ? '#ffffff' : '#80a381', {
    vertexColors: true,
    flatShading: false,
    map: textures.grass ?? null,
  });
  grass.name = 'campus_grass';
  // Keep fine texture detail subtle: the original grass bitmap overwhelms close views.
  const lawnTint = new THREE.Color('#849b7c');
  grass.onBeforeCompile = shader => {
    shader.uniforms.uLawnTint = {value:lawnTint};
    shader.fragmentShader = 'uniform vec3 uLawnTint;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n diffuseColor.rgb = mix(uLawnTint, diffuseColor.rgb, 0.30);'
    );
  };
  grass.customProgramCacheKey = () => 'ust35-soft-lawn-v1';
  clipSubmergedTerrain(grass);
  const terrainGeometry = new THREE.PlaneGeometry(
    domain.xMax - domain.xMin,
    domain.zMax - domain.zMin,
    300,
    260,
  );
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.translate(
    (domain.xMax + domain.xMin) / 2,
    0,
    (domain.zMax + domain.zMin) / 2,
  );
  const pos = terrainGeometry.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      h = heightAt(x, z);
    pos.setY(i, h);
    terrainGeometry.attributes.uv.setXY(i, x / 8.4, z / 8.4);
    const f =
      0.5 +
      0.2 * Math.sin(x * 0.03) * Math.cos(z * 0.024) +
      0.15 * Math.sin(x * 0.008 + z * 0.017);
    color.set('#b0c19a').lerp(new THREE.Color('#6c916e'), f);
    if (textures.grass)
      color.setRGB(0.89 + f * 0.1, 0.91 + f * 0.09, 0.83 + f * 0.1);
    if (coastDistance(x, z) < 14) color.set('#b5b69d');
    colors.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  );
  // Sample the actual rendered triangles, not the pre-tessellation height function.
  // This keeps road ribbons from disappearing into interpolated hillside triangles.
  const renderedGroundHeight = (x:number,z:number) => {
    const cols=terrainGeometry.parameters.widthSegments,rows=terrainGeometry.parameters.heightSegments;
    const u=THREE.MathUtils.clamp((x-domain.xMin)/(domain.xMax-domain.xMin)*cols,0,cols-0.00001);
    const v=THREE.MathUtils.clamp((z-domain.zMin)/(domain.zMax-domain.zMin)*rows,0,rows-0.00001);
    const ix=Math.floor(u),iz=Math.floor(v),tx=u-ix,tz=v-iz,n=cols+1;
    const a=pos.getY(iz*n+ix),b=pos.getY((iz+1)*n+ix),c=pos.getY((iz+1)*n+ix+1),d=pos.getY(iz*n+ix+1);
    return tx+tz<=1?a+(d-a)*tx+(b-a)*tz:c+(b-c)*(1-tx)+(d-c)*(1-tz);
  };
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, grass);
  terrain.name = 'Terrain_Mapzen_DEM_approximate_terraces';
  terrain.receiveShadow = true;
  root.add(terrain);
  const pale = material('#e8e6de'),
    wall = material(textures.wall ? '#ffffff' : '#e9e8da', {
      map: textures.wall ?? null,
    }),
    roof = material('#e1e5e0', {
      map: textures.wall ?? null,
    }),
    foundation = material('#9fa89c'),
    glass = material('#3f6978', { metalness: 0.32, roughness: 0.27 });
  wall.name = 'campus_facade_tiles';
  roof.name = 'campus_roof';
  const glassDark = material(textures.window ? '#ffffff' : '#466467', {
    map: textures.window ?? null,
    metalness: 0.12,
    roughness: 0.36,
    side: THREE.DoubleSide,
  });
  glassDark.name = 'campus_window_glass';
  const windows: THREE.Matrix4[] = [];
  const windowBuildingIds:string[]=[];
  const wallDetails: THREE.BufferGeometry[] = [];
  const dummy = new THREE.Object3D();
  let rng = 57;
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    parent: THREE.Group = surfaces,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  for (const b of bData) {
    const special = b.name === 'Academic Building';
    const dorm = /Hall|Quarters|Apartments|Tower/i.test(b.name);
    const business = /Business|Advanced Study|Innovation/i.test(b.name);
    const auditorium = /Shaw Auditorium/.test(b.name);
    const floors = b.levels ?? (dorm ? 9 : business ? 6 : 4);
    const h =
      b.heightMeters ??
      (special
        ? 56
        : b.id === pavilion?.id
          ? bridgeLevel - b.base + 5.8
          : auditorium
            ? 17
            : floors * 3.3);
    const group = new THREE.Group();
    group.name = b.name || 'Campus building';
    group.userData = {
      osmId: b.id,
      name: b.nameZh || b.name || '校园建筑',
      heightMeters: h,
      heightEstimated:
        special ||
        b.heightMeters == null ||
        b.tags['model:estimated'] === 'yes',
      reference:
        b.tags['model:reference'] ??
        'OSM footprint and official campus photographs',
    };
    buildingsGroup.add(group);
    if (special) {
      addAcademicBuilding(b, group, { pale, wall, roof, glass }, plazaHeight);
      continue;
    }
    if (addPhotoBuilding(b, group, { pale, wall, roof, glass })) continue;
    const foot = extrude(
      b.points,
      Math.max(3, b.base - rawHeight(...b.center) + 3),
      b.base - 3,
      foundation,
      b.holes,
    );
    group.add(foot);
    const body = extrude(b.points, h, b.base, [roof, wall], b.holes);
    body.userData = group.userData;
    group.add(body);
    // The top of the cap is the visible roof; texturing only the body below
    // leaves every rooftop covered by an untextured slab.
    const cap = extrude(b.points, 1, b.base + h, [roof, pale], b.holes);
    cap.name = 'Textured_roof_cap';
    group.add(cap);
    const rings = [b.points, ...(b.holes ?? [])];
    if (!auditorium) {
      for (const [ringIndex, ring] of rings.entries()) {
        const area = ring.reduce((s, p, i) => {
          const q = ring[(i + 1) % ring.length];
          return s + p[0] * q[1] - q[0] * p[1];
        }, 0);
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1],
            c = ring[i],
            dx = c[0] - a[0],
            dz = c[1] - a[1],
            len = Math.hypot(dx, dz);
          if (len < 2.7) continue;
          // Courtyards expose the inside of their rings, unlike outer walls.
          const exposedSide = ringIndex === 0 ? 1 : -1;
          const nx = (exposedSide * (area > 0 ? 1 : -1) * dz) / len,
            nz = (exposedSide * (area > 0 ? -1 : 1) * dx) / len;
          const count = Math.floor(len / (special ? 4.7 : 4.0));
          const levels = Math.floor(h / 3.5);
          for (let level = 0; level < levels; level++)
            for (let k = 0; k < count; k++) {
              const t = (k + 0.5) / count;
              dummy.position.set(
                a[0] + t * dx + nx * 0.13,
                b.base + 2.1 + level * 3.5,
                a[1] + t * dz + nz * 0.13,
              );
              dummy.rotation.set(0, Math.atan2(nx, nz), 0);
              dummy.scale.set(
                business ? 2.9 : special ? 2.8 : 1.85,
                business ? 2.55 : 1.7,
                1,
              );
              dummy.updateMatrix();
              windows.push(dummy.matrix.clone());
              windowBuildingIds.push(b.id);
            }
          // Continuous slab edges emphasize the horizontal white campus facades.
          if (len > 10) {
            for (let y = 3.5; y < h; y += 3.5) {
              const balcony =
                b.id === 'way/235329019' || b.id === 'way/235329015';
              const g = new THREE.BoxGeometry(len, 0.3, balcony ? 1.5 : 0.24);
              g.rotateY(-Math.atan2(dz, dx));
              g.translate(
                (a[0] + c[0]) / 2 + nx * (balcony ? 0.6 : 0.2),
                b.base + y,
                (a[1] + c[1]) / 2 + nz * (balcony ? 0.6 : 0.2),
              );
              wallDetails.push(g);
            }
          }
        }
      }
    }
    if (auditorium) {
      for (let i = 0; i < 3; i++) {
        const slab = new THREE.Mesh(
          new THREE.CylinderGeometry(29 + i * 1.2, 29 + i * 1.2, 1.25, 64),
          pale,
        );
        slab.position.set(b.center[0], b.base + 5 + i * 5, b.center[1]);
        slab.scale.set(0.85, 1, 1.25);
        slab.rotation.y = 0.52;
        group.add(slab);
      }
    }
    addExistingBuildingDetails(b, group, { pale, wall, roof, glass }, h);
    // Roof plant is placed only inside roofs, never in courtyard holes.
    for (let x = b.minX + 8; x < b.maxX - 4; x += special ? 18 : 25)
      for (let z = b.minZ + 8; z < b.maxZ - 4; z += 24) {
        if (
          inside(x, z, b.points) &&
          !(b.holes ?? []).some((r) => inside(x, z, r)) &&
          random() > 0.45
        ) {
          box(3.6, 1.6, 5, x, b.base + h + 1.3, z, foundation, group);
        }
      }
  }
  const windowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    glassDark,
    windows.length,
  );
  windows.forEach((m, i) => windowMesh.setMatrixAt(i, m));
  windowMesh.name = 'Facade_windows_approximate';
  windowMesh.userData.windowBuildingIds=windowBuildingIds;
  windowMesh.computeBoundingSphere();
  buildingsGroup.add(windowMesh);
  if (wallDetails.length) {
    const geometry = mergeGeometries(wallDetails);
    if (geometry) {
      const detail = new THREE.Mesh(geometry, pale);
      buildingsGroup.add(detail);
    }
    wallDetails.forEach((g) => g.dispose());
  }
  const pathMaterial = material('#d8d5c9'),
    roadMaterial = material('#889692');
  const line = (
    points: THREE.Vector3[],
    color: string,
    group: THREE.Group = surfaces,
  ) => {
    const mesh = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color }),
    );
    group.add(mesh);
    return mesh;
  };
  const strip = (
    p: Point[],
    width: number,
    mat: THREE.Material,
    lift = 0.3,
    fixedY?: number,
  ) => {
    if (p.length < 2) return;
    const points: Point[] = [];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.5));
      for (let k = 0; k < n; k++)
        points.push([
          THREE.MathUtils.lerp(a[0], b[0], k / n),
          THREE.MathUtils.lerp(a[1], b[1], k / n),
        ]);
    }
    points.push(p[p.length - 1]);
    const vs: number[] = [],
      ids: number[] = [];
    points.forEach((p, i) => {
      const prev = points[Math.max(0, i - 1)],
        next = points[Math.min(points.length - 1, i + 1)],
        dx = next[0] - prev[0],
        dz = next[1] - prev[1],
        len = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        const x = p[0] + (dz / len) * width * 0.5 * side,
          z = p[1] - (dx / len) * width * 0.5 * side;
        vs.push(x, (fixedY ?? renderedGroundHeight(x, z)) + lift, z);
      }
      if (i) {
        const j = i * 2;
        ids.push(j - 2, j - 1, j, j, j - 1, j + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    g.setIndex(ids);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
    surfaces.add(m);
  };
  for (const r of data.roads) {
    if (
      r.name === 'Bridge Link' ||
      r.name === 'Fong Shu Chuen Promenade' ||
      (r.center[0] > -85 &&
        r.center[0] < 155 &&
        Math.abs(r.center[1] + 278) < 18) ||
      r.tags.area === 'yes' ||
      r.tags.tunnel === 'yes' ||
      r.tags.indoor === 'yes' ||
      Number(r.tags.layer ?? 0) < 0
    )
      continue;
    const hw = r.tags.highway;
    const major = [
      'secondary',
      'tertiary',
      'residential',
      'service',
      'unclassified',
    ].includes(hw);
    const bridge = r.tags.bridge === 'yes';
    strip(
      r.points,
      major ? (hw === 'secondary' ? 13 : 7) : 2.7,
      major ? roadMaterial : pathMaterial,
      bridge ? 5 : 0.45,
    );
  }
  for (const a of data.areas) {
    const isCourt = a.tags.leisure === 'pitch';
    const isPool = a.tags.leisure === 'swimming_pool';
    const isTrack = a.id === 'relation/3173913';
    const isPlaza = a.name === 'HKUST Piazza';
    if (!isCourt && !isPool && !isTrack && !isPlaza) continue;
    const y = isPlaza
      ? plazaHeight + 0.3
      : a.center[0] > 170 && a.center[1] < -170
        ? 7.2
        : heightAt(...a.center) + 0.6;
    const mat = isPool
      ? material('#4eaab7', { roughness: 0.22, metalness: 0.25 })
      : isTrack
        ? material('#c07862')
        : isCourt
          ? material(a.tags.sport === 'tennis' ? '#77948b' : '#63916c')
          : material('#d9d8c5');
    surfaces.add(extrude(a.points, 0.25, y, mat, a.holes));
    if (isCourt || isPool) {
      line(
        a.points.map((p) => new THREE.Vector3(p[0], y + 0.33, p[1])),
        '#eeeede',
      );
      const ring = a.points.slice(0, -1);
      if (ring.length === 4) {
        const [a0, a1, a2, a3] = ring;
        const p = (s: number, t: number) =>
          new THREE.Vector3(
            THREE.MathUtils.lerp(
              THREE.MathUtils.lerp(a0[0], a1[0], s),
              THREE.MathUtils.lerp(a3[0], a2[0], s),
              t,
            ),
            y + 0.35,
            THREE.MathUtils.lerp(
              THREE.MathUtils.lerp(a0[1], a1[1], s),
              THREE.MathUtils.lerp(a3[1], a2[1], s),
              t,
            ),
          );
        if (isPool) {
          for (let lane = 1; lane < 8; lane++)
            line([p(lane / 8, 0.04), p(lane / 8, 0.96)], '#c0e2dd');
        } else {
          line([p(0.5, 0), p(0.5, 1)], '#eff0db');
          line(
            [
              p(0.06, 0.08),
              p(0.94, 0.08),
              p(0.94, 0.92),
              p(0.06, 0.92),
              p(0.06, 0.08),
            ],
            '#eff0db',
          );
          if (a.tags.sport === 'tennis') {
            line([p(0.25, 0.08), p(0.25, 0.92)], '#eff0db');
            line([p(0.75, 0.08), p(0.75, 0.92)], '#eff0db');
          } else {
            const pts: THREE.Vector3[] = [];
            for (let k = 0; k <= 48; k++) {
              const t = (k / 48) * Math.PI * 2;
              pts.push(
                new THREE.Vector3(
                  a.center[0] + Math.cos(t) * 9,
                  y + 0.4,
                  a.center[1] + Math.sin(t) * 9,
                ),
              );
            }
            line(pts, '#eff0db');
          }
        }
      }
    }
  }
  if (track && track.holes?.[0]) {
    const outer = track.points,
      inner = track.holes[0];
    for (let k = 1; k < 7; k++) {
      const pts = outer.map((p) => {
        let nearest = inner[0],
          dist = Infinity;
        for (const q of inner) {
          const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (d < dist) {
            dist = d;
            nearest = q;
          }
        }
        return new THREE.Vector3(
          THREE.MathUtils.lerp(p[0], nearest[0], k / 7),
          7.52,
          THREE.MathUtils.lerp(p[1], nearest[1], k / 7),
        );
      });
      line(pts, '#e2b4a0');
    }
  }
  // Bridge Link starts at LG5. The separate promenade is reached by lifts.
  // Plan coordinates are mapped; absolute deck levels remain estimated from photos.
  const bridge = new THREE.Group();
  bridge.name = 'Bridge_Link_LG5_and_lower_Promenade';
  bridge.userData = {
    heightEstimated: true,
    source:
      'HKUST Registry venue signage: Atrium to LG5, Bridge Link, then lifts to G/F',
  };
  surfaces.add(bridge);
  const railMaterial = material('#b55642');
  const beamGeometries: THREE.BufferGeometry[] = [];
  const canopyGlass = material('#93bdc4', {
    transparent: true,
    opacity: 0.63,
    metalness: 0.15,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });
  const beam = (a: THREE.Vector3, b: THREE.Vector3, r = 0.13) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6),
      pale,
    );
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    m.updateMatrix();
    beamGeometries.push(m.geometry.applyMatrix4(m.matrix));
  };
  const coveredSpan = (a: Point, b: Point, level: number, width: number) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      nx = -dz / length,
      nz = dx / length;
    const at = (t: number, side: number, dy: number) =>
      new THREE.Vector3(
        a[0] + dx * t + nx * side,
        level + dy,
        a[1] + dz * t + nz * side,
      );
    const deck = box(
      length,
      0.85,
      width,
      (a[0] + b[0]) / 2,
      level - 0.4,
      (a[1] + b[1]) / 2,
      pale,
      bridge,
    );
    deck.rotation.y = -Math.atan2(dz, dx);
    const n = Math.ceil(length / 4.3);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      for (const side of [-1, 1]) {
        beam(
          at(t, side * width * 0.48, 0),
          at(t, side * width * 0.48, 2.7),
          0.1,
        );
        beam(at(t, side * width * 0.48, 2.7), at(t, 0, 3.8), 0.13);
      }
    }
    for (const side of [-1, 1]) {
      for (const h of [0.65, 1.15, 2.7])
        beam(
          at(0, side * width * 0.48, h),
          at(1, side * width * 0.48, h),
          0.08,
        );
      const rail = box(
        length,
        0.12,
        0.13,
        (a[0] + b[0]) / 2 + nx * side * width * 0.48,
        level + 1.2,
        (a[1] + b[1]) / 2 + nz * side * width * 0.48,
        railMaterial,
        bridge,
      );
      rail.rotation.y = -Math.atan2(dz, dx);
      const pts = [
        at(0, side * width * 0.48, 2.72),
        at(1, side * width * 0.48, 2.72),
        at(1, 0, 3.82),
        at(0, 0, 3.82),
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      bridge.add(new THREE.Mesh(g, canopyGlass));
    }
    beam(at(0, 0, 3.84), at(1, 0, 3.84), 0.12);
  };
  coveredSpan([-78.091, -277.32], [-20.161, -277.231], bridgeLevel, 7.6);
  coveredSpan([-0.154, -277.699], [58.023, -278.066], bridgeLevel, 7.6);
  // Central pavilion has an open skylight, while lift shafts terminate the spans.
  if (pavilion) {
    const sky = new THREE.Mesh(new THREE.ConeGeometry(5, 2.8, 4), canopyGlass);
    sky.rotation.y = Math.PI / 4;
    sky.position.set(-10.3, bridgeLevel + 7, -278);
    bridge.add(sky);
  }
  const hallOne = bData.find((b) => b.id === 'way/233624053')!;
  const hallTwo = bData.find((b) => b.id === 'way/233624047')!;
  const promenadeLevel = hallOne.base + 1.2;
  const liftTower = (
    x: number,
    z: number,
    w: number,
    d: number,
    base: number,
    top: number,
  ) => {
    const tower = box(w, top - base, d, x, (top + base) / 2, z, wall, bridge);
    tower.userData = { name: '宿舍连桥电梯塔', heightEstimated: true };
    box(w + 0.5, 1, d + 0.5, x, top + 0.5, z, pale, bridge);
    for (let y = base + 3; y < top - 2; y += 3.5)
      box(1.2, 1.6, 0.15, x - 2, y, z + d / 2 + 0.1, glassDark, bridge);
  };
  liftTower(63, -279, 16, 24, hallOne.base, bridgeLevel + 5);
  // D-shaped lower landing around Hall I; the promenade starts after it.
  const landing: Point[] = [
    [67, -289],
    [74, -289],
    [81, -286],
    [86, -281],
    [88, -276],
    [86, -270],
    [81, -265],
    [74, -263],
    [67, -263],
    [67, -289],
  ];
  const opening: Point[] = [
    [72, -284],
    [77, -283],
    [82, -280],
    [83, -276],
    [80, -269],
    [74, -268],
    [72, -268],
    [72, -284],
  ];
  bridge.add(extrude(landing, 0.7, promenadeLevel - 0.7, pale, [opening]));
  // Curved lower transfer ring is open to the sky; roof restarts after it.
  box(5, 1, 6, 90, promenadeLevel - 0.5, -276, pale, bridge);
  coveredSpan([92.002, -276.051], [153.804, -276.408], promenadeLevel, 5.8);
  liftTower(156, -278, 12, 14, hallTwo.base, promenadeLevel + 4.8);
  const mergedBeams = mergeGeometries(beamGeometries);
  if (mergedBeams) bridge.add(new THREE.Mesh(mergedBeams, pale));
  beamGeometries.forEach((g) => g.dispose());
  addInnovationBridge(buildingsGroup, { pale, wall, roof, glass }, heightAt);
  addSundial(surfaces, plazaHeight, { pale, wall, roof, glass });
  root.add(createCampusVehicles(data,renderedGroundHeight,(x,z)=>isLand(x,z)&&inside(x,z,data.campusBoundary.points)&&!bData.some(b=>x>b.minX-2&&x<b.maxX+2&&z>b.minZ-2&&z<b.maxZ+2)));
  // Campus grove: shared instanced geometry keeps the model light on mobile.
  const treePositions: THREE.Vector3[] = [];
  const blockedAreas = data.areas.filter(
    (a) =>
      ['pitch', 'track', 'swimming_pool'].includes(a.tags.leisure) ||
      a.tags.highway === 'pedestrian',
  );
  const nearRoad = (x: number, z: number) => {
    for (const r of data.roads) {
      if (r.tags.indoor) continue;
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i];
        if (
          x < Math.min(a[0], b[0]) - 5 ||
          x > Math.max(a[0], b[0]) + 5 ||
          z < Math.min(a[1], b[1]) - 5 ||
          z > Math.max(a[1], b[1]) + 5
        )
          continue;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = THREE.MathUtils.clamp(
            ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
            0,
            1,
          );
        if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 5) return true;
      }
    }
    return false;
  };
  for (let k = 0; k < 16000; k++) {
    const x = domain.xMin + 10 + random() * (domain.xMax - domain.xMin - 20),
      z = domain.zMin + 10 + random() * (domain.zMax - domain.zMin - 20);
    if (!isLand(x, z) || coastDistance(x, z) < 9) continue;
    if (
      bData.some(
        (b) =>
          x > b.minX - 5 && x < b.maxX + 5 && z > b.minZ - 5 && z < b.maxZ + 5,
      )
    )
      continue;
    if (blockedAreas.some((a) => inside(x, z, a.points))) continue;
    if (inside(x, z, piazza.points)) continue;
    if (Math.hypot(x + 210.35, z + 278.44) < 64) continue;
    if (x > -120 && x < 135 && Math.abs(z + 279) < 10) continue;
    if (
      INNOVATION_BRIDGE_POINTS.slice(1).some((b, i) => {
        const a = INNOVATION_BRIDGE_POINTS[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = THREE.MathUtils.clamp(
          ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
          0,
          1,
        );
        return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < 6;
      })
    )
      continue;
    if (nearRoad(x, z)) continue;
    const y = heightAt(x, z);
    if (y < 3) continue;
    treePositions.push(new THREE.Vector3(x, y, z));
  }
  // One shared, gently lobed crown keeps instancing efficient without balloon-like trees.
  const leafGeo = new THREE.SphereGeometry(1, 12, 9);
  const crownPositions = leafGeo.getAttribute('position');
  for(let i=0;i<crownPositions.count;i++){
    const x=crownPositions.getX(i),y=crownPositions.getY(i),z=crownPositions.getZ(i);
    const lobes=1+0.075*Math.sin(x*5.4+z*2.3)*Math.cos(z*5.1-y*2.6);
    const crownY=y<0?y*0.60:y*0.88;
    crownPositions.setXYZ(i,x*lobes,crownY,z*lobes);
  }
  leafGeo.computeVertexNormals();
  leafGeo.computeBoundingSphere();
  const leaves = new THREE.InstancedMesh(
    leafGeo,
    material('#9caf8c', { roughness: 0.95, flatShading: false }),
    treePositions.length,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.7, 1, 8),
    material('#796c56'),
    treePositions.length,
  );
  treePositions.forEach((p, i) => {
    const s = 2.7 + random() * 3.0;
    dummy.position.copy(p).add(new THREE.Vector3(0, s * 0.76 + 2.4, 0));
    dummy.rotation.set(random() * 0.3, random() * 6, random() * 0.2);
    dummy.scale.set(s * 1.08, s * (0.9 + random() * 0.3), s * 0.94);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(
      i,
      new THREE.Color().setHSL(
        0.245 + random() * 0.045,
        0.20 + random() * 0.13,
        0.25 + random() * 0.11,
      ),
    );
    dummy.position.copy(p).add(new THREE.Vector3(0, 2, 0));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 4, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  leaves.name = 'Tree_canopies';
  trunks.name = 'Tree_trunks';
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.computeBoundingSphere();
  trunks.computeBoundingSphere();
  vegetation.add(leaves, trunks);
  // Batch subtle roof silhouette edges in one draw call; footprint geometry is unchanged.
  root.updateMatrixWorld(true);
  const roofEdges: THREE.BufferGeometry[] = [];
  buildingsGroup.traverse(object => {
    if(object instanceof THREE.Mesh && object.name === 'Textured_roof_cap'){
      const edges = new THREE.EdgesGeometry(object.geometry, 40);
      edges.applyMatrix4(object.matrixWorld);
      edges.translate(0,0.035,0);
      roofEdges.push(edges);
    }
  });
  if(roofEdges.length){
    const geometry=mergeGeometries(roofEdges);
    roofEdges.forEach(g=>g.dispose());
    if(geometry){
      const edges=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#6e8586',transparent:true,opacity:0.22,depthWrite:false}));
      edges.name='Architectural_roof_silhouettes';
      root.add(edges);
    }
  }
  const boundary = data.campusBoundary.points.map(
    (p) => new THREE.Vector3(p[0], heightAt(...p) + 1.3, p[1]),
  );
  const boundaryLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(boundary),
    new THREE.LineDashedMaterial({
      color: '#c5d4ad',
      dashSize: 5,
      gapSize: 4,
      transparent: true,
      opacity: 0.5,
    }),
  );
  boundaryLine.computeLineDistances();
  surfaces.add(boundaryLine);
  return {
    root,
    vegetation,
    buildingsGroup,
    heightAt,
    isLand,
    plazaHeight,
    bridgeLevel,
    promenadeLevel,
    stats: {
      buildings: bData.length,
      trees: treePositions.length,
      windows: windows.length,
    },
  };
}
