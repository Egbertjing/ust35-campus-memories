import { searchCampusPlaces, type CampusPlace } from './campus-places';
import type {
  CampusNavigation,
  CampusRoute,
  NavigationLocation,
} from './campus-navigation';

export const CAMPUS_TOOL_NAMES = [
  'search_places',
  'focus_place',
  'set_place_label',
  'show_route',
  'clear_route',
] as const;
export type CampusToolName = (typeof CAMPUS_TOOL_NAMES)[number];
export type CampusToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
export type CampusToolResult = {
  ok: boolean;
  action: string;
  message: string;
  [key: string]: unknown;
};
export type CampusToolHost = {
  places: CampusPlace[];
  navigation: CampusNavigation;
  focusPlace: (id: string, showLabel: boolean) => void;
  setPlaceLabel: (id: string, visible: boolean) => void;
  displayRoute: (route: CampusRoute) => void;
  clearRoute: () => void;
};

export function campusToolDefinitions(places: CampusPlace[]) {
  const placeId = {
    type: 'string',
    enum: places.map((p) => p.id),
    description:
      '使用地点目录或 search_places 返回的确切 id，不要传地点名称或坐标。',
  };
  const object = (
    properties: Record<string, unknown>,
    required = Object.keys(properties),
  ) => ({ type: 'object', properties, required, additionalProperties: false });
  const tools = [
    {
      name: 'search_places',
      description:
        '搜索校园建筑和地标，支持中英文、简繁体和别名。名称不清楚或有歧义时先搜索；query 为空返回地点目录。',
      parameters: object({
        query: {
          type: 'string',
          description: '地点名称、简称、英文名；不要包含整句问路问题。',
        },
      }),
    },
    {
      name: 'focus_place',
      description:
        '移动 3D 相机到指定建筑或地标，高亮该位置，可同时显示世界坐标标签。回答“某地在哪儿”时调用此工具。',
      parameters: object({
        place_id: placeId,
        show_label: {
          type: 'boolean',
          description: '通常为 true；用户明确要求不显示名称时为 false。',
        },
      }),
    },
    {
      name: 'set_place_label',
      description: '显示或隐藏指定地点的 3D 标签，不移动相机。',
      parameters: object({ place_id: placeId, visible: { type: 'boolean' } }),
    },
    {
      name: 'show_route',
      description:
        '在现有校园模型路网中规划步行路线，并在当前 3D 场景高亮显示、填入起终点和调整相机。返回实际计算的距离、预计时间及换层步骤。缺少出发地点时先询问用户，不要假设 GPS 位置。',
      parameters: object({ start_id: placeId, end_id: placeId }),
    },
    {
      name: 'clear_route',
      description: '清除当前 3D 路线和导航面板中的起终点。',
      parameters: object({}),
    },
  ];
  return tools.map((tool) => ({ type: 'function' as const, function: tool }));
}

export function executeCampusTool(
  host: CampusToolHost,
  name: string,
  input: unknown,
): CampusToolResult {
  const fail = (message: string): CampusToolResult => ({
    ok: false,
    action: name,
    message,
  });
  if (!CAMPUS_TOOL_NAMES.some((tool) => tool === name))
    return fail('不支持这个工具。');
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return fail('工具参数必须为 JSON 对象。');
  const args = input as Record<string, unknown>;
  const definition = campusToolDefinitions(host.places).find(
    (tool) => tool.function.name === name,
  )!;
  const schema = definition.function.parameters;
  if (
    Object.keys(args).some((key) => !Object.hasOwn(schema.properties, key)) ||
    schema.required.some((key) => !Object.hasOwn(args, key))
  )
    return fail('工具参数缺失或包含不支持的字段。');
  const getPlace = (key: string) =>
    typeof args[key] === 'string'
      ? host.places.find((place) => place.id === args[key])
      : undefined;
  const getLocation = (place: CampusPlace): NavigationLocation | null =>
    host.navigation.locations.find(
      (location) => location.id === place.navigationId,
    ) ?? host.navigation.pickLocation(place.point, place.name);
  try {
    if (name === 'search_places') {
      if (typeof args.query !== 'string' || args.query.length > 100)
        return fail('搜索词应为 100 字以内的地点名称。');
      const matches = searchCampusPlaces(host.places, args.query);
      return {
        ok: true,
        action: name,
        message: matches.length
          ? `找到 ${matches.length} 个地点`
          : '没有找到这个地点，请确认名称。',
        total: matches.length,
        places: matches.slice(0, args.query.trim() ? 10 : 80).map((place) => ({
          id: place.id,
          name: place.name,
          english_name: place.englishName,
          navigation_available: !!getLocation(place),
        })),
      };
    }
    if (name === 'clear_route') {
      host.clearRoute();
      return { ok: true, action: name, message: '已清除路线。' };
    }
    if (name === 'show_route') {
      const start = getPlace('start_id'),
        end = getPlace('end_id');
      if (!start || !end) return fail('地点 id 不存在，请先搜索地点。');
      const from = getLocation(start),
        to = getLocation(end);
      if (!from || !to)
        return fail(
          `${!from ? start.name : end.name}暂未连接可用的步行入口，请选择附近已连接的地点。`,
        );
      const result = host.navigation.findRoute(from, to);
      if (!result.route) return fail(result.error);
      host.displayRoute(result.route);
      return {
        ok: true,
        action: name,
        message: `已显示 ${start.name} → ${end.name} 的路线`,
        start: { id: start.id, name: start.name },
        end: { id: end.id, name: end.name },
        distance_m: Math.round(result.route.distance),
        estimated_minutes: result.route.minutes,
        steps: result.route.steps.map((step) => ({
          name: step.name,
          kind: step.kind,
          distance_m: Math.round(step.distance),
          ...(step.kind === 'lift'
            ? { direction: step.to[1] < step.from[1] ? '下行' : '上行' }
            : {}),
        })),
        note: '入口、高程和用时为概念模型估算，实际通行以现场指引为准。',
      };
    }
    const place = getPlace('place_id');
    if (!place) return fail('地点 id 不存在，请先搜索地点。');
    const visible = name === 'focus_place' ? args.show_label : args.visible;
    if (typeof visible !== 'boolean') return fail('标签开关必须为布尔值。');
    if (name === 'focus_place') host.focusPlace(place.id, visible);
    else host.setPlaceLabel(place.id, visible);
    return {
      ok: true,
      action: name,
      message:
        name === 'focus_place'
          ? `已定位${place.name}${visible ? '并显示标签' : ''}`
          : `${visible ? '已显示' : '已隐藏'}${place.name}的标签`,
      place: { id: place.id, name: place.name },
      label_visible: visible,
    };
  } catch {
    return fail('场景操作未完成，请等待校园加载完成后重试。');
  }
}
