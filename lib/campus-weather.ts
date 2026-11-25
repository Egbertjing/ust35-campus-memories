/**
 * Live weather for the HKUST campus scene.
 *
 * Data: Open-Meteo current conditions (https://open-meteo.com, CC BY 4.0), fetched by the
 * visitor's browser (the site's own server has no outbound internet). Values are mapped to a
 * small set of visual presets; this is an illustration of the reported conditions, not a
 * weather simulation.
 */
export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm';
export type WeatherMode = 'live' | WeatherKind;

export type WeatherVisual = {
  /** 0 = clear sky, 1 = full cloud deck */
  cloud: number;
  /** 0 = bright, 1 = heavy overcast (dims sun, greys the sky) */
  gloom: number;
  /** 0 = dry, 1 = heavy rain */
  rain: number;
  /** 0 = normal visibility, 1 = thick fog */
  fog: number;
  lightning: boolean;
};

export type WeatherReport = {
  kind: WeatherKind;
  label: string;
  temperature?: number;
  precipitation?: number;
  windSpeed?: number;
  windDirection?: number;
  /** ISO time of the observation, Hong Kong time */
  observed?: string;
};

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  cloudy: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  storm: 'Thunderstorm',
};

export const WEATHER_VISUALS: Record<WeatherKind, WeatherVisual> = {
  clear: { cloud: 0.08, gloom: 0, rain: 0, fog: 0, lightning: false },
  partly: { cloud: 0.48, gloom: 0.08, rain: 0, fog: 0, lightning: false },
  cloudy: { cloud: 0.9, gloom: 0.55, rain: 0, fog: 0.3, lightning: false },
  fog: { cloud: 0.75, gloom: 0.45, rain: 0, fog: 1, lightning: false },
  drizzle: { cloud: 0.95, gloom: 0.55, rain: 0.3, fog: 0.3, lightning: false },
  rain: { cloud: 1, gloom: 0.68, rain: 0.75, fog: 0.45, lightning: false },
  storm: { cloud: 1, gloom: 0.82, rain: 1, fog: 0.55, lightning: true },
};

/** WMO weather interpretation code (as used by Open-Meteo) → visual preset. */
export function weatherKindFromCode(code: number, cloudCover = 0): WeatherKind {
  if (code === 0) return cloudCover > 35 ? 'partly' : 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 95) return 'storm';
  // 61–67 rain, 71–77 snow, 80–86 showers: Hong Kong snow is effectively never; show as rain.
  if (code >= 61 && code <= 86) return 'rain';
  return 'cloudy';
}

/** Rain strength from precipitation (mm/h), so light showers and downpours differ. */
export function rainStrength(kind: WeatherKind, precipitation?: number) {
  const base = WEATHER_VISUALS[kind].rain;
  if (!base || precipitation === undefined) return base;
  return Math.min(1, Math.max(0.25, precipitation / 6));
}

const HKUST = { latitude: 22.3364, longitude: 114.2655 };
const CACHE_KEY = 'ust35-weather-v1';
export const WEATHER_TTL_MS = 15 * 60 * 1000;

type Cached = { fetchedAt: number; report: WeatherReport };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    return cached?.report?.kind ? cached : null;
  } catch {
    return null;
  }
}

export function cachedWeather(maxAge = WEATHER_TTL_MS): WeatherReport | null {
  const cached = readCache();
  return cached && Date.now() - cached.fetchedAt < maxAge ? cached.report : null;
}

export async function fetchLiveWeather(signal?: AbortSignal): Promise<WeatherReport> {
  const fresh = cachedWeather();
  if (fresh) return fresh;
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${HKUST.latitude}&longitude=${HKUST.longitude}` +
    '&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m' +
    '&timezone=Asia%2FHong_Kong';
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const data = (await response.json()) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      cloud_cover?: number;
      precipitation?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
    };
  };
  const current = data.current;
  if (!current || typeof current.weather_code !== 'number') throw new Error('Weather data missing');
  const kind = weatherKindFromCode(current.weather_code, current.cloud_cover ?? 0);
  const report: WeatherReport = {
    kind,
    label: WEATHER_LABELS[kind],
    temperature: current.temperature_2m,
    precipitation: current.precipitation,
    windSpeed: current.wind_speed_10m,
    windDirection: current.wind_direction_10m,
    observed: current.time,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), report } satisfies Cached));
  } catch {
    /* private mode: no cache */
  }
  return report;
}
