import type { CampusData, Point } from './campus-model';
import { navigationDestinations } from './campus-navigation';
import { photoCampusBuildings, PHOTO_BUILDING_IDS } from './photo-campus-data';

export type CampusPlace = {
  id: string;
  name: string;
  englishName: string;
  aliases: string[];
  point: Point;
  buildingId?: string;
  navigationId?: string;
};

const buildingsByDestination: Record<string, string> = {
  atrium: 'relation/3174704',
  library: 'way/240394873',
  hall1: 'way/233624053',
  hall2: 'way/233624047',
  hall3: 'way/235329012',
  business: 'way/315573847',
  shaw: 'way/1010089329',
  medical: PHOTO_BUILDING_IDS.medical,
  innovation: PHOTO_BUILDING_IDS.innovation,
  computing: PHOTO_BUILDING_IDS.computing,
};
const aliases: Record<string, string[]> = {
  sundial: [
    '日晷',
    '红鸟',
    '紅鳥',
    '火鸡',
    '火雞',
    'sundial',
    'red bird',
    'piazza',
  ],
  atrium: [
    '学术大楼',
    '學術大樓',
    '教学楼',
    '中庭',
    'atrium',
    'academic building',
  ],
  concourse: ['学术廊', '學術廊', '吴家玮学术廊', 'academic concourse'],
  library: ['图书馆', '圖書館', 'library', '李兆基图书馆'],
  bridge: ['连桥', '連橋', 'bridge link', 'LG5', '连桥入口'],
  hall1: ['hall 1', 'hall i', '一座', '宿舍一座', '学生宿舍第一座'],
  hall2: ['hall 2', 'hall ii', '二座', '宿舍二座', '学生宿舍第二座'],
  hall3: [
    'hall 3',
    'hall iii',
    '三座',
    '宿舍三座',
    '学生宿舍第三座',
    '海滨宿舍',
  ],
  waterfront: [
    '海滨运动场',
    '运动场',
    '田径场',
    '跑道',
    'sports ground',
    'waterfront',
  ],
  computing: [
    '超算中心',
    '超级运算中心',
    '超算',
    'supercomputing',
    'AI supercomputing center',
  ],
  business: [
    '李兆基',
    '商学院',
    '商學院',
    '商学大楼',
    'LSK',
    'business school',
  ],
  shaw: ['逸夫', '演艺中心', '演藝中心', 'shaw auditorium'],
  medical: ['医学楼', '医教楼', '医学教研', 'medical education'],
  innovation: ['创科楼', '创科大楼', '李家诚', '李家誠', 'innovation building'],
  'north-gate': ['北门', '北門', '大学道', 'north gate', 'university road'],
};

export function createCampusPlaces(data: CampusData): CampusPlace[] {
  const buildings = photoCampusBuildings(data).filter(
    (building) => !['roof', 'construction'].includes(building.tags.building),
  );
  const represented = new Set(Object.values(buildingsByDestination));
  const destinations = navigationDestinations.map((location): CampusPlace => {
    const building = buildings.find(
      (b) => b.id === buildingsByDestination[location.id],
    );
    return {
      id: location.id,
      name: location.name,
      englishName: building?.name ?? '',
      point: building?.center ?? location.point,
      aliases: [
        ...(aliases[location.id] ?? []),
        ...(building?.nameZh ? [building.nameZh] : []),
      ],
      navigationId: location.id,
      ...(building ? { buildingId: building.id } : {}),
    };
  });
  return [
    ...destinations,
    ...buildings
      .filter((b) => (b.name || b.nameZh) && !represented.has(b.id))
      .map(
        (b): CampusPlace => ({
          id: b.id,
          name: b.nameZh || b.name,
          englishName: b.name,
          aliases: [],
          point: b.center,
          buildingId: b.id,
        }),
      ),
  ];
}

const variants: Record<string, string> = {
  學: '学',
  圖: '图',
  書: '书',
  館: '馆',
  醫: '医',
  藝: '艺',
  樓: '楼',
  誠: '诚',
  運: '运',
  動: '动',
  場: '场',
  濱: '滨',
  連: '连',
  門: '门',
  華: '华',
  樹: '树',
  廣: '广',
  創: '创',
  見: '见',
  國: '国',
  際: '际',
  灣: '湾',
  紅: '红',
  鳥: '鸟',
  體: '体',
  偉: '伟',
  瑋: '玮',
};
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(
      /[學圖書館醫藝樓誠運動場濱連門華樹廣創見國際灣紅鳥體偉瑋]/g,
      (char) => variants[char],
    )
    .replace(/[\s·・()（）_-]/g, '');
export function searchCampusPlaces(
  places: CampusPlace[],
  query: string,
): CampusPlace[] {
  const term = normalize(query.trim());
  if (!term) return places;
  return places
    .map((place) => {
      const names = [place.id, place.name, place.englishName, ...place.aliases]
        .filter(Boolean)
        .map(normalize);
      const score = names.some((name) => name === term)
        ? 3
        : names.some((name) => name.startsWith(term))
          ? 2
          : names.some((name) => name.includes(term))
            ? 1
            : 0;
      return { place, score };
    })
    .filter((match) => match.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name),
    )
    .map((match) => match.place);
}
