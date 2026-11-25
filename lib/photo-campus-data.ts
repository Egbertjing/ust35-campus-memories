import type { CampusData, Feature, Point } from './campus-model';

// Model-space estimates cross-checked against the user's sixteen scale-model
// photographs. Construction parcels anchor placement, not exact wall outlines.
export const PHOTO_BUILDING_IDS = {
  medical: 'photo/medical-education-research-complex',
  innovation: 'way/883647804',
  computing: 'way/1425265723',
} as const;
export const REPLACED_SERVICE_IDS = new Set([
  'way/240457945',
  'way/240457949',
  'way/303571779',
]);
export const INNOVATION_BRIDGE_POINTS: Point[] = [
  [-103, 100],
  [-101, 108],
  [-85, 114],
  [-67, 118],
  [-49, 125],
  [-36, 130],
];
export const INNOVATION_BRIDGE_LEVEL = 157;
export const COMPUTING_CENTER: Point = [231.08, -272.8];
export const PHOTO_TERRACES = [
  { xMin: -236, xMax: -179, zMin: -10, zMax: 49, base: 140 },
  { xMin: -110, xMax: -77, zMin: 33, zMax: 101, base: 138 },
];

export function photoCampusBuildings(data: CampusData): Feature[] {
  const existing = data.buildings
    .filter((b) => !REPLACED_SERVICE_IDS.has(b.id))
    .map((b) => {
      if (b.id === 'way/235858076')
        return {
          ...b,
          name: 'Waterfront sports grandstand',
          nameZh: '海滨运动场看台',
          heightMeters: 3.5,
          tags: { ...b.tags, 'model:base': '7', 'model:estimated': 'yes' },
        };
      if (b.id === 'way/235914561')
        return {
          ...b,
          heightMeters: 35,
          tags: { ...b.tags, 'model:kind': 'cheng', 'model:estimated': 'yes' },
        };
      if (b.name === 'Shaw Auditorium')
        return {
          ...b,
          heightMeters: 17,
          tags: { ...b.tags, 'model:kind': 'shaw', 'model:estimated': 'yes' },
        };
      return b;
    });
  const create = (
    id: string,
    name: string,
    nameZh: string,
    center: Point,
    points: Point[],
    height: number,
    base: number,
    kind: string,
  ): Feature => ({
    id,
    name,
    nameZh,
    center,
    points,
    holes: [],
    levels: 8,
    heightMeters: height,
    tags: {
      building: 'university',
      name,
      'name:zh': nameZh,
      'model:kind': kind,
      'model:base': String(base),
      'model:estimated': 'yes',
      'model:reference':
        kind === 'computing' ? 'IMG_0258–0260' : 'IMG_0253–0255, IMG_0261–0263',
    },
  });
  const additions = [
    create(
      PHOTO_BUILDING_IDS.medical,
      'Medical Education and Research Complex',
      '医学教研综合大楼',
      [-207, 22],
      [
        [-235, -8],
        [-178, -8],
        [-178, 45],
        [-190, 53],
        [-235, 42],
        [-235, -8],
      ],
      43,
      140,
      'medical',
    ),
    create(
      PHOTO_BUILDING_IDS.innovation,
      'Martin Ka Shing Lee Innovation Building',
      '李家诚创科大楼',
      [-94, 68],
      [
        [-108, 30],
        [-81, 34],
        [-77, 49],
        [-72, 50],
        [-72, 95],
        [-82, 103],
        [-108, 103],
        [-108, 30],
      ],
      34,
      138,
      'innovation',
    ),
    create(
      PHOTO_BUILDING_IDS.computing,
      'HKUST AI Supercomputing Center',
      '人工智能超级运算中心',
      COMPUTING_CENTER,
      [
        [206.685, -278.103],
        [236.384, -248.405],
        [255.475, -267.497],
        [225.776, -297.195],
        [206.685, -278.103],
      ],
      43,
      7,
      'computing',
    ),
  ];
  return [...existing, ...additions];
}
