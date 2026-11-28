'use client';
import { asset } from '@/lib/base-path'
import {CampusLightingControl} from '@/components/campus-lighting-control';
import { CampusMemories } from '@/components/campus-memories';

import { useCampusLanguage } from '@/components/campus-language';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Cable,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Focus,
  Info,
  Layers3,
  Languages,
  LoaderCircle,
  MapPin,
  Maximize,
  Minus,
  Mouse,
  MoveUpRight,
  Orbit,
  PanelLeft,
  Plus,
  Scan,
  Route,
  Crosshair,
  MessageCircle,
  Sun,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  campusToolDefinitions,
  executeCampusTool,
  type CampusToolHost,
} from '@/lib/campus-tools';
import type {
  CampusNavigation,
  NavigationLocation,
} from '@/lib/campus-navigation';
import type { CampusController, ViewId } from '@/lib/campus-scene';

const views: { id: ViewId; name: string; en: string; icon: typeof Orbit }[] = [
  { id: 'overview', name: '全校总览', en: 'CAMPUS OVERVIEW', icon: Orbit },
  { id: 'top', name: '垂直俯视', en: 'TOP VIEW', icon: Scan },
  {id:'coastal',name:'Coastal panorama',en:'COASTAL PANORAMA',icon:Eye},
  { id: 'sundial', name: '日晷广场', en: 'THE SUNDIAL', icon: Sun },
  {
    id: 'academic',
    name: '学术大楼',
    en: 'ACADEMIC BUILDING',
    icon: Building2,
  },
  { id: 'sculpture', name: '红鸟日晷', en: 'THE RED BIRD', icon: Sun },
  { id: 'sculptureTop', name: '红鸟俯视', en: 'RED BIRD PLAN', icon: Scan },
  { id: 'waterfront', name: '海滨运动场', en: 'WATERFRONT', icon: Eye },
  { id: 'bridge', name: '连桥', en: 'BRIDGE LINK · LG5', icon: Cable },
  { id: 'south', name: '李兆基校区', en: 'SOUTH CAMPUS', icon: Building2 },
  {
    id: 'innovation',
    name: '医教与创科楼',
    en: 'MEDICAL & INNOVATION',
    icon: Building2,
  },
  {
    id: 'computing',
    name: '超级运算中心',
    en: 'AI SUPERCOMPUTING',
    icon: Building2,
  },
];

export default function Home() {
  const { language, setLanguage, t } = useCampusLanguage();
  const canvasHost = useRef<HTMLDivElement>(null);
  const panelElement = useRef<HTMLElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const panelClose = useRef<HTMLButtonElement>(null);
  const engine = useRef<CampusController | null>(null);
  const toolAppliedRoute = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  const [view, setView] = useState<ViewId>('overview');
  const [labels, setLabels] = useState(true);
  const [trees, setTrees] = useState(true);
  const [textured, setTextured] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [panel, setPanel] = useState(false);
  const [heading, setHeading] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [panelMode, setPanelMode] = useState('explore');
  const [locations, setLocations] = useState<NavigationLocation[]>([]);
  const [routeStart, setRouteStart] = useState<NavigationLocation | null>(null);
  const [routeEnd, setRouteEnd] = useState<NavigationLocation | null>(null);
  const [navigation, setNavigation] = useState<CampusNavigation | null>(null);
  const [navigationError, setNavigationError] = useState('');
  const [pickMode, setPickMode] = useState<'start' | 'end' | null>(null);
  const [toolHost, setToolHost] = useState<CampusToolHost | null>(null);
  const routeResult = useMemo(
    () =>
      ready && navigation && routeStart && routeEnd
        ? navigation.findRoute(routeStart, routeEnd)
        : null,
    [ready, navigation, routeStart, routeEnd],
  );
  const route = routeResult?.route ?? null;

  useEffect(() => {
    if (ready) engine.current?.setLanguage(language);
  }, [ready, language]);

  useEffect(() => {
    const wideScreen = window.matchMedia('(min-width: 901px)');
    const updatePanel = () => setPanel(wideScreen.matches);
    updatePanel();
    wideScreen.addEventListener('change', updatePanel);
    return () => wideScreen.removeEventListener('change', updatePanel);
  }, []);

  const closePanel = useCallback(() => {
    const restoreFocus = panelElement.current?.contains(document.activeElement);
    setPanel(false);
    if (restoreFocus) {
      requestAnimationFrame(() => panelToggle.current?.focus());
    }
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pickMode) {
        setPickMode(null);
        engine.current?.setPickMode(null);
        setNavigationError('');
        return;
      }
      if (
        event.key === 'Escape' &&
        panelElement.current?.contains(document.activeElement)
      ) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closePanel, pickMode]);

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setFailure('');
    import('@/lib/campus-scene')
      .then(({ createCampusScene }) => {
        if (disposed || !canvasHost.current) return;
        return createCampusScene(canvasHost.current, {
          onHeading: setHeading,
          onView: (id) => {
            setView(id);
            setRotate(false);
          },
          onSelect: setSelected,
          onInteract: () => {
            setView('free');
            setRotate(false);
          },
          onError: setFailure,
          onNavigationPick: (location, mode) => {
            if (mode === 'start') setRouteStart(location);
            else setRouteEnd(location);
            setPickMode(null);
            setNavigationError('');
            setSelected(null);
          },
          onNavigationError: setNavigationError,
        }).then((controller) => {
          if (disposed) {
            controller.dispose();
            return;
          }
          engine.current = controller;
          toolAppliedRoute.current = null;
          const checkScene = () => {
            if (engine.current !== controller)
              throw new Error('Campus scene is not ready');
          };
          const endPicking = () => {
            setPickMode(null);
            controller.setPickMode(null);
            controller.setAutoRotate(false);
            setNavigationError('');
            setRotate(false);
          };
          setToolHost({
            places: controller.places,
            navigation: controller.navigation,
            focusPlace(id, showLabel) {
              checkScene();
              endPicking();
              if (showLabel) setLabels(true);
              controller.focusPlace(id, showLabel);
            },
            setPlaceLabel(id, visible) {
              checkScene();
              if (visible) setLabels(true);
              controller.setPlaceLabel(id, visible);
            },
            displayRoute(next) {
              checkScene();
              endPicking();
              setSelected(null);
              toolAppliedRoute.current = `${next.start.nodeId}:${next.end.nodeId}`;
              controller.setRoute(next);
              controller.focusRoute();
              setRouteStart(next.start);
              setRouteEnd(next.end);
            },
            clearRoute() {
              checkScene();
              endPicking();
              toolAppliedRoute.current = 'none';
              controller.setRoute(null);
              setRouteStart(null);
              setRouteEnd(null);
            },
          });
          setNavigation(controller.navigation);
          setLocations(controller.navigation.locations);
          setRouteStart(null);
          setRouteEnd(null);
          setPickMode(null);
          setReady(true);
        });
      })
      .catch((error: unknown) => {
        console.error('Campus initialization failed', error);
        if (!disposed)
          setFailure(
            error instanceof Error && /Campus data|WebGL/.test(error.message)
              ? error.message
              : 'The campus scene could not start. Retry, or refresh to load the latest version.',
          );
      });
    return () => {
      disposed = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [reload]);

  useEffect(() => {
    if (!ready || !engine.current) return;
    const key = route ? `${route.start.nodeId}:${route.end.nodeId}` : 'none';
    if (toolAppliedRoute.current === key) {
      toolAppliedRoute.current = null;
      return;
    }
    toolAppliedRoute.current = null;
    engine.current.setRoute(route);
    if (route) engine.current.focusRoute();
  }, [ready, route]);

  const cancelPick = () => {
    setPickMode(null);
    engine.current?.setPickMode(null);
    setNavigationError('');
  };
  const changeEndpoint = (
    mode: 'start' | 'end',
    location: NavigationLocation | null,
  ) => {
    cancelPick();
    if (mode === 'start') setRouteStart(location);
    else setRouteEnd(location);
  };
  const beginPick = (mode: 'start' | 'end') => {
    const next = pickMode === mode ? null : mode;
    setPickMode(next);
    setNavigationError('');
    setSelected(null);
    engine.current?.setPickMode(next);
    engine.current?.setAutoRotate(false);
    setRotate(false);
    if (next && window.matchMedia('(max-width: 900px)').matches) closePanel();
  };

  useEffect(() => {
    if (!ready) return;
    engine.current?.setLabels(labels);
    engine.current?.setTrees(trees);
    engine.current?.setTextures(textured);
  }, [ready, labels, trees, textured]);

  useEffect(() => {
    if (ready) engine.current?.setSidebarVisible(panel);
  }, [ready, panel]);

  const changeView = (id: ViewId) => {
    engine.current?.setView(id);
    setView(id);
    setRotate(false);
    setSelected(null);
    if (window.matchMedia('(max-width: 900px)').matches) closePanel();
  };
  useEffect(() => {
    if (!ready) return;
    type ModelContext = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => Promise<unknown>;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'set_campus_view',
            title: '切换科大校园视角',
            description:
              'Move the visible 3D campus camera to a named campus viewpoint, including new buildings reconstructed from scale-model photographs.',
            inputSchema: {
              type: 'object',
              properties: {
                view: { type: 'string', enum: views.map((v) => v.id) },
              },
              required: ['view'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                !('view' in input) ||
                !views.some(
                  (v) => v.id === (input as { view: unknown }).view,
                ) ||
                Object.keys(input).some((k) => k !== 'view')
              )
                throw new Error('Invalid campus view');
              if (!engine.current) throw new Error('Campus scene is not ready');
              const id = (input as { view: ViewId }).view;
              engine.current.setView(id);
              setView(id);
              setRotate(false);
              setSelected(null);
              if (window.matchMedia('(max-width: 900px)').matches) closePanel();
              await new Promise((resolve) => setTimeout(resolve, 1500));
              return { view: id, name: views.find((v) => v.id === id)?.name };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Unsupported draft API does not prevent manual exploration. */
    }
    if (toolHost)
      for (const tool of campusToolDefinitions(toolHost.places)) {
        try {
          void Promise.resolve(
            context.registerTool(
              {
                name: tool.function.name,
                title: tool.function.name,
                description: tool.function.description,
                inputSchema: tool.function.parameters,
                annotations: {
                  readOnlyHint: tool.function.name === 'search_places',
                  untrustedContentHint: false,
                },
                async execute(input) {
                  return executeCampusTool(toolHost, tool.function.name, input);
                },
              },
              { signal: lifecycle.signal },
            ),
          ).catch(() => {});
        } catch {
          /* The chat panel also uses these tools when WebMCP is unavailable. */
        }
      }
    return () => lifecycle.abort();
  }, [ready, closePanel, toolHost]);

  const toggleRotate = () => {
    engine.current?.setAutoRotate(!rotate);
    setRotate(!rotate);
  };
  return (
    <main className="campus-app" lang={language === 'en' ? 'en' : 'zh-CN'}>
      <header className="app-header">
        <button
          ref={panelToggle}
          type="button"
          className="panel-toggle glass-button glass-surface"
          onClick={() => {
            if (panel) closePanel();
            else {
              setPanel(true);
              requestAnimationFrame(() => panelClose.current?.focus());
            }
          }}
          aria-label={t(panel ? '收起校园导览侧栏' : '展开校园导览侧栏')}
          title={t(panel ? '收起侧栏' : '展开侧栏')}
          aria-expanded={panel}
          aria-controls="campus-explorer-panel"
        >
          <PanelLeft size={22} aria-hidden="true" />
        </button>
        <div className="header-title">
          <b className="ust35-wordmark">UST<span>35</span></b><div className="ust35-header-copy">{t('香港科技大学')}<small>CAMPUS MEMORIES</small></div>
        </div>
        <div className="header-actions">
          <CampusLightingControl ready={ready}/>

        </div>
      </header>

      <div
        className={`scene-shell ${panel ? 'panel-open' : 'panel-collapsed'}`}
      >
        <div
          ref={canvasHost}
          className="scene-canvas"
          role="img"
          aria-label={t(
            'HKUST Clear Water Bay 3D memory map. Drag to rotate, scroll to zoom, and select a photo marker to view a memory.',
          )}
        />
        <aside
          ref={panelElement}
          id="campus-explorer-panel"
          className="explorer-panel has-navigation"
          aria-hidden={!panel}
          inert={!panel}
          aria-label={t('校园导览')}
        >
          <div className="panel-head">
            <span className="eyebrow">EXPLORE THE CAMPUS</span>
            <button
              ref={panelClose}
              type="button"
              className="panel-close"
              aria-label={t('收起校园导览')}
              onClick={closePanel}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t('收起')}</span>
            </button>
          </div>
          <div className="campus-explore-content">
              <h1>
                {t('山海之间，')}
                <br />
                {t('走进科大')}
                <span>{t('。')}</span>
              </h1>
              <p className="panel-intro">
                {t('从高空俯瞰，到海滨漫游。')}
                <br />
                {t('换一个视角，发现清水湾校园。')}
              </p>
              <a
                className="reference-photo"
                href="https://xiiaba.hkust.edu.hk/symposium-info/transportation"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={asset('/campus-reference.jpg')}
                  alt={t(
                    '香港科技大学官方航拍照片，展示日晷广场、教学楼和海滨宿舍',
                  )}
                />
                <span>
                  {t('真实校园参考')}
                  <ArrowUpRight size={13} />
                </span>
              </a>
              <nav className="explore-views" aria-label={t('切换相机视角')}>
                <div className="section-label">
                  <span>{t('探索视角')}</span>
                  <span className="muted">VIEWPOINTS</span>
                </div>
                <div className="overview-views">
                  {views.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!ready}
                      aria-pressed={view === item.id}
                      onClick={() => changeView(item.id)}
                    >
                      <item.icon size={19} aria-hidden="true" />
                      <span>{t(item.name)}</span>
                      <small>{item.en}</small>
                    </button>
                  ))}
                </div>
                <div className="section-label">
                  <span>{t('校园地标')}</span>
                  <span className="muted">LANDMARKS</span>
                </div>
                <div className="landmark-list">
                  {views.slice(2).map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!ready}
                      aria-pressed={view === item.id}
                      onClick={() => changeView(item.id)}
                    >
                      <span className="landmark-number" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{t(item.name)}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </nav>
          </div>

          <div className="layer-controls">
            <div className="section-label">
              <span>{t('场景图层')}</span>
              <Layers3 size={15} />
            </div>
            <label htmlFor="textures-toggle">
              <span>{t('彩色贴图')}</span>
              <Switch
                id="textures-toggle"
                checked={textured}
                disabled={!ready}
                onCheckedChange={setTextured}
              />
            </label>
            <label htmlFor="labels-toggle">
              <span>{t('地标名称')}</span>
              <Switch
                id="labels-toggle"
                checked={labels}
                onCheckedChange={(v) => {
                  setLabels(v);
                  engine.current?.setLabels(v);
                }}
              />
            </label>
            <label htmlFor="trees-toggle">
              <span>{t('校园植被')}</span>
              <Switch
                id="trees-toggle"
                checked={trees}
                onCheckedChange={(v) => {
                  setTrees(v);
                  engine.current?.setTrees(v);
                }}
              />
            </label>
          </div>
          <div className="model-note">
            <span className="note-dot" />
            {t('照片与地图参考 · 概念级重建 · 彩色贴图')}
          </div>
          <a className="terrain-source" href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Regional terrain · Mapzen / USGS / NOAA · 100 m context</a>
          <a className="terrain-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Live weather · Open-Meteo.com (CC BY 4.0)</a>
        </aside>

        <div
          className="right-tools glass-surface"
          role="group"
          aria-label={t('场景操作')}
        >
          <button
            type="button"
            data-tooltip={t('放大')}
            aria-label={t('放大')}
            disabled={!ready}
            onClick={() => engine.current?.zoom(0.8)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-tooltip={t('缩小')}
            aria-label={t('缩小')}
            disabled={!ready}
            onClick={() => engine.current?.zoom(1.25)}
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <div className="tool-separator" aria-hidden="true" />
          <button
            type="button"
            data-tooltip={t('回到总览')}
            aria-label={t('回到总览')}
            disabled={!ready}
            onClick={() => changeView('overview')}
          >
            <Focus size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-tooltip={t('全屏')}
            aria-label={t('切换全屏')}
            onClick={() => {
              if (document.fullscreenElement)
                document.exitFullscreen().catch(() => {});
              else
                document.documentElement.requestFullscreen?.().catch(() => {});
            }}
          >
            <Maximize size={18} aria-hidden="true" />
          </button>
          <div className="tool-separator" aria-hidden="true" />
          <button
            type="button"
            className="orbit-button"
            data-tooltip={t(rotate ? '暂停环绕' : '自动环绕')}
            aria-label={t(rotate ? '暂停环绕' : '自动环绕')}
            disabled={!ready}
            onClick={toggleRotate}
            aria-pressed={rotate}
          >
            <Orbit size={21} aria-hidden="true" />
          </button>
        </div>
        {pickMode && (
          <output className="map-pick-hint">
            <Crosshair size={18} />
            <span>
              {t(
                navigationError ||
                  `点击校园道路或地标，选择${pickMode === 'start' ? '起点 A' : '终点 B'}`,
              )}
            </span>
            <button type="button" onClick={cancelPick}>
              {t('Cancel')}
            </button>
          </output>
        )}
        <button
          className="compass"
          aria-label={t('朝向正北')}
          title={t('朝向正北')}
          disabled={!ready}
          onClick={() => changeView('top')}
        >
          <span>N</span>
          <div
            className="glass-surface"
            style={{ transform: `rotate(${heading}deg)` }}
          >
            <MoveUpRight size={25} />
          </div>
        </button>
        {selected && (
          <div className="selection-card">
            <MapPin size={16} />
            <span>{t(selected)}</span>
            <button onClick={() => window.dispatchEvent(new CustomEvent('campus-memory-command', { detail: {action:'place', name:selected} }))}>＋ Add a photo here</button>
            <button
              aria-label={t('关闭建筑名称')}
              onClick={() => setSelected(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {!ready && !failure && (
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" size={27} />
            <strong>{t('正在展开清水湾校园')}</strong>
            <span>{t('构建地形、建筑与海岸线…')}</span>
          </div>
        )}
        {failure && (
          <div className="error-state" role="alert">
            <Info size={25} />
            <strong>{t(failure)}</strong>
            <button
              onClick={() => {
                setFailure('');
                if (!ready) {
                  setLabels(true);
                  setTrees(true);
                  setView('overview');
                  setReload((v) => v + 1);
                }
              }}
            >
              {t('重试')}
            </button>
          </div>
        )}

        <footer className="scene-footer">
          <span className="interaction-hint">
            <Mouse size={14} />
            {t('拖动旋转')}
            <span>·</span>
            {t('滚轮缩放')}
            <span>·</span>
            {t('右键平移')}
          </span>
          <span className="mobile-hint">{t('单指旋转 · 双指缩放 / 平移')}</span>
        </footer>
      </div>
      <CampusMemories ready={ready} places={ready ? (engine.current?.places ?? []).map(p=>({...p,name:t(p.name)})) : []} />
    </main>
  );
}
