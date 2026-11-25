'use client';

import { useCampusLanguage } from '@/components/campus-language';

import {
  ArrowDownUp,
  ArrowUpDown,
  Cable,
  Crosshair,
  Focus,
  Footprints,
  MapPin,
  Route,
  Trash2,
} from 'lucide-react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type {
  CampusRoute,
  NavigationLocation,
  RouteKind,
} from '@/lib/campus-navigation';
import type { CampusLanguage } from '@/lib/campus-language';

type Props = {
  ready: boolean;
  locations: NavigationLocation[];
  start: NavigationLocation | null;
  end: NavigationLocation | null;
  route: CampusRoute | null;
  error: string;
  pickMode: 'start' | 'end' | null;
  onChange: (
    mode: 'start' | 'end',
    location: NavigationLocation | null,
  ) => void;
  onPick: (mode: 'start' | 'end') => void;
  onSwap: () => void;
  onClear: () => void;
  onFocus: () => void;
};
const kindLabels: Record<RouteKind, string> = {
  walk: '步行',
  steps: '楼梯',
  lift: '电梯',
  bridge: '连桥',
};
export const formatDistance = (
  meters: number,
  language: CampusLanguage = 'zh',
) =>
  meters >= 1000
    ? `${(meters / 1000).toFixed(2)} ${language === 'en' ? 'km' : '公里'}`
    : `${Math.max(1, Math.round(meters))} ${language === 'en' ? 'm' : '米'}`;

export function NavigationPanel({
  ready,
  locations,
  start,
  end,
  route,
  error,
  pickMode,
  onChange,
  onPick,
  onSwap,
  onClear,
  onFocus,
}: Props) {
  const { language, t } = useCampusLanguage();
  return (
    <section className="navigation-panel" aria-label={t('步行路线规划')}>
      <div className="navigation-heading">
        <span className="navigation-symbol">
          <Route size={23} />
        </span>
        <div>
          <h1>{t('3D 路线导航')}</h1>
          <p>{t('选择两点，探索校园。')}</p>
        </div>
      </div>
      <div className="route-inputs">
        {(['start', 'end'] as const).map((mode) => {
          const location = mode === 'start' ? start : end;
          const title = mode === 'start' ? '起点' : '终点';
          return (
            <div className="route-field" data-endpoint={mode} key={mode}>
              <span className="route-letter" aria-hidden="true">
                {mode === 'start' ? 'A' : 'B'}
              </span>
              <div className="route-field-control">
                <label htmlFor={`route-${mode}`}>{t(title)}</label>
                <NativeSelect
                  id={`route-${mode}`}
                  className="route-select"
                  disabled={!ready}
                  value={location?.id ?? ''}
                  onChange={(event) =>
                    onChange(
                      mode,
                      locations.find((l) => l.id === event.target.value) ??
                        null,
                    )
                  }
                >
                  <NativeSelectOption value="">
                    {t(`选择${title}`)}
                  </NativeSelectOption>
                  {location && !locations.some((l) => l.id === location.id) && (
                    <NativeSelectOption value={location.id}>
                      {t(location.name)}
                    </NativeSelectOption>
                  )}
                  {locations.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {t(item.name)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <button
                type="button"
                className="map-pick-button"
                disabled={!ready}
                aria-label={t(`在地图上选择${title}`)}
                title={t(`在地图上选择${title}`)}
                aria-pressed={pickMode === mode}
                onClick={() => onPick(mode)}
              >
                <Crosshair size={18} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="swap-route"
          onClick={onSwap}
          disabled={!ready || (!start && !end)}
          aria-label={t('交换起点和终点')}
          title={t('交换起点和终点')}
        >
          <ArrowDownUp size={15} />
        </button>
      </div>
      <div className="route-actions">
        <button
          type="button"
          className="focus-route"
          onClick={onFocus}
          disabled={!ready || !route}
        >
          <Focus size={17} />
          {t('查看全程')}
        </button>
        <button
          type="button"
          className="clear-route"
          onClick={onClear}
          disabled={!start && !end}
          aria-label={t('清空路线')}
          title={t('清空路线')}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div aria-live="polite" aria-atomic="true" className="route-status">
        {error ? (
          <p className="route-error">{t(error)}</p>
        ) : !route ? (
          <p className="route-empty">
            <MapPin size={17} />
            {t(
              !ready
                ? '校园加载后即可选择地点。'
                : '选择起点和终点，或点击准星在地图上选点。',
            )}
          </p>
        ) : (
          <div className="route-stats">
            <Footprints size={23} />
            <div>
              <strong>
                {t('约')} {route.minutes} <small>{t('分钟')}</small>
              </strong>
              <span>
                {t('步行')} · {formatDistance(route.distance, language)}
              </span>
            </div>
            <span className="route-status-badge">{t('路线已高亮')}</span>
          </div>
        )}
      </div>
      {route && (
        <>
          <div className="route-legend">
            <span>
              <i className="walk-line" />
              {t('步行路线')}
            </span>
            <span>
              <i className="lift-line" />
              {t('电梯换层')}
            </span>
          </div>
          <details className="route-directions" open>
            <summary>
              {t('路线详情')}
              <span>
                {route.steps.length}{' '}
                {language === 'en'
                  ? route.steps.length === 1
                    ? 'step'
                    : 'steps'
                  : '段'}
              </span>
            </summary>
            <ol>
              <li className="route-stop" data-endpoint="start">
                <span className="step-dot">A</span>
                <div>
                  <strong>{t(route.start.name)}</strong>
                  <small>{t('从这里出发')}</small>
                </div>
              </li>
              {route.steps.map((step, i) => {
                const Icon =
                  step.kind === 'bridge'
                    ? Cable
                    : step.kind === 'lift' || step.kind === 'steps'
                      ? ArrowUpDown
                      : Footprints;
                return (
                  <li
                    key={`${step.name}-${i}`}
                    className={`route-step ${step.kind}`}
                  >
                    <span className="step-dot">
                      <Icon size={14} />
                    </span>
                    <div>
                      <strong>{t(step.name)}</strong>
                      <small>
                        {t(kindLabels[step.kind])}
                        {step.kind === 'lift'
                          ? ` · ${t(step.to[1] < step.from[1] ? '下行' : '上行')} ${t('约')} ${formatDistance(Math.abs(step.to[1] - step.from[1]), language)}`
                          : ` · ${formatDistance(step.distance, language)}`}
                      </small>
                    </div>
                  </li>
                );
              })}
              <li className="route-stop" data-endpoint="end">
                <span className="step-dot">B</span>
                <div>
                  <strong>{t(route.end.name)}</strong>
                  <small>{t('到达附近入口')}</small>
                </div>
              </li>
            </ol>
          </details>
        </>
      )}
      <p className="navigation-note">
        {t(
          '路线连接地图中的步道与附近入口。高程、入口和用时为模型估算，实际通行请以现场指引为准。',
        )}
      </p>
    </section>
  );
}
