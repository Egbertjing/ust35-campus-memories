import { asset } from './base-path';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSeaLabel } from './sea-label';
import {createOceanDepthTexture} from './campus-water';
import {createCampusSurroundings,type RegionalTerrain} from './campus-surroundings';
import {campusWaterFragment} from './campus-atmosphere';
import { createCampusLighting } from './campus-lighting';
import { createCampusShoreline } from './campus-shoreline';
import {
  createCampusNavigation,
  type CampusNavigation,
  type CampusRoute,
  type NavigationLocation,
} from './campus-navigation';
import { createRouteOverlay } from './campus-route-overlay';
import { createDemandRenderLoop } from './campus-render-loop';
import { translateCampusText, type CampusLanguage } from './campus-language';
import { createCampusPlaces, type CampusPlace } from './campus-places';
import type { AssistantSceneContext } from './campus-assistant';
import {
  buildCampus,
  inside,
  landmarks,
  type CampusData,
  type TerrainData,
} from './campus-model';
export type ViewId =
  | 'coastal'
  | 'overview'
  | 'top'
  | 'sundial'
  | 'waterfront'
  | 'south'
  | 'bridge'
  | 'innovation'
  | 'computing'
  | 'academic'
  | 'sculpture'
  | 'sculptureTop'
  | 'free';
export type CampusController = {
  setLanguage: (language: CampusLanguage) => void;
  places: CampusPlace[];
  focusPlace: (id: string, showLabel: boolean) => void;
  setPlaceLabel: (id: string, visible: boolean) => void;
  getAssistantContext: () => AssistantSceneContext;
  navigation: CampusNavigation;
  setRoute: (route: CampusRoute | null) => void;
  focusRoute: () => void;
  setPickMode: (mode: 'start' | 'end' | null) => void;
  setView: (id: ViewId) => void;
  setAutoRotate: (v: boolean) => void;
  setLabels: (v: boolean) => void;
  setSidebarVisible: (v: boolean) => void;
  setTrees: (v: boolean) => void;
  setTextures: (v: boolean) => void;
  zoom: (factor: number) => void;
  download: () => Promise<void>;
  dispose: () => void;
};
type Callbacks = {
  onHeading: (v: number) => void;
  onView: (v: ViewId) => void;
  onSelect: (v: string) => void;
  onInteract: () => void;
  onError: (v: string) => void;
  onNavigationPick: (
    location: NavigationLocation,
    mode: 'start' | 'end',
  ) => void;
  onNavigationError: (message: string) => void;
};
export async function createCampusScene(
  host: HTMLDivElement,
  callbacks: Callbacks,
): Promise<CampusController> {
  async function loadSceneData<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json() as T;
      } catch (error) {
        if (attempt === 2) throw new Error(`Campus data could not be loaded（${url}）. Check your connection and retry.`);
        await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
    throw new Error('Campus data could not be loaded');
  }
  const [data, dem, regional] = await Promise.all([
    loadSceneData<CampusData>(asset('/data/campus.json')),
    loadSceneData<TerrainData>(asset('/data/terrain.json')),
    loadSceneData<RegionalTerrain>(asset('/data/surroundings.json')),
  ]);
  let renderer: THREE.WebGLRenderer;
  let reducedGraphics = false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    reducedGraphics = true;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'default' });
    } catch {
      throw new Error('WebGL could not start, including compatibility mode. Close other 3D tabs and retry, or use a WebGL-capable browser.');
    }
  }
  renderer.setPixelRatio(reducedGraphics ? 1 : Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = !reducedGraphics;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The sun and campus geometry are fixed; camera motion can reuse this map.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    '三维校园：方向键平移，使用页面按钮切换视角或缩放',
  );
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cbdde1');
  scene.fog = new THREE.Fog('#cbdde1', 6000, 16000);
  const camera = new THREE.PerspectiveCamera(
    39,
    host.clientWidth / host.clientHeight,
    3,
    40000,
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 22;
  controls.maxDistance = 3900;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.minPolarAngle = 0.02;
  controls.autoRotateSpeed = 0.38;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.65;
  controls.target.set(0, 40, -160);
  controls.listenToKeyEvents(renderer.domElement);
  let renderLoop: ReturnType<typeof createDemandRenderLoop> | null = null;
  let contextIsLost = false;
  const invalidate = () => renderLoop?.invalidate();
  const hemisphere=new THREE.HemisphereLight('#e6f0fa', '#69776a', 1.8);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff0da', 2.5);
  sun.position.set(-520, 800, 480);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -850,
    right: 850,
    top: 800,
    bottom: -800,
    near: 10,
    far: 2200,
  });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.45;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 20, -140);
  scene.add(sun, sun.target);
  const loader = new THREE.TextureLoader();
  const [wallTexture, windowTexture, grassTexture] = await Promise.all([
    loader.loadAsync(asset('/textures/facade-tiles.png')),
    loader.loadAsync(asset('/textures/window-glass.png')),
    loader.loadAsync(asset('/textures/grass-ground.png')),
  ]);
  const loadedTextures: THREE.Texture[] = [wallTexture, windowTexture, grassTexture];
  for (const t of loadedTextures) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  const campus = buildCampus(data, dem, {
    wall: wallTexture,
    window: windowTexture,
    grass: grassTexture,
  });
  const navigation = createCampusNavigation(data, campus);
  const places = createCampusPlaces(data);
  let language: CampusLanguage = 'en';
  let focusedPlaceId: string | null = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const routeOverlay = createRouteOverlay(host, reduced);
  scene.add(routeOverlay.group);
  let currentRoute: CampusRoute | null = null;
  let pickMode: 'start' | 'end' | null = null;
  const selectNavigationPoint = (
    x: number,
    z: number,
    name?: string,
    elevation?: number,
  ) => {
    if (!pickMode) return;
    const named =
      name &&
      navigation.locations.find(
        (l) => l.name === name || l.name.startsWith(`${name} ·`),
      );
    const location =
      named ||
      navigation.pickLocation(
        [x, z],
        name || `地图${pickMode === 'start' ? '起点' : '终点'}`,
        elevation,
      );
    if (!location) {
      callbacks.onNavigationError(
        '这里附近没有已连接的步道，请点击道路、广场或选择列表中的地点。',
      );
      return;
    }
    callbacks.onNavigationPick(location, pickMode);
    controller.setPickMode(null);
  };
  const mappedMaterials = new Map<
    THREE.MeshStandardMaterial,
    { map: THREE.Texture; color: THREE.Color }
  >();
  const untexturedColors: Record<string, string> = {
    campus_grass: '#80a381',
    campus_facade_tiles: '#e9e8da',
    campus_window_glass: '#466467',
    campus_roof: '#f0f0e7',
  };
  campus.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const mat of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (mat instanceof THREE.MeshStandardMaterial && mat.map)
        mappedMaterials.set(mat, { map: mat.map, color: mat.color.clone() });
    }
  });
  scene.add(campus.root);
  const surroundings=createCampusSurroundings(regional,campus);
  scene.add(surroundings.group);
  // Animated water is independent from the reusable exported campus model.
  const oceanDepth=createOceanDepthTexture(regional);loadedTextures.push(oceanDepth);
  const seaMaterial = new THREE.ShaderMaterial({
    depthTest:true,depthWrite:true,transparent:false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#68a6b4') },
      uHorizon: {value:new THREE.Color('#cbdde1')},
      uWaterLight: {value:1},
      uDepthMap:{value:oceanDepth},uDepthBounds:{value:new THREE.Vector4(regional.xMin,regional.zMin,regional.xMax-regional.xMin,regional.zMax-regional.zMin)},
      uSunDir:{value:new THREE.Vector3(0,1,0)},uSunColor:{value:new THREE.Color('#fff0da')},uSunStrength:{value:1},
    },
    vertexShader: `varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: campusWaterFragment,
  });
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(100000, 100000),
    seaMaterial,
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.name = 'Port_Shelter';
  scene.add(sea);
  const lighting=createCampusLighting({scene,camera,renderer,sun,hemisphere,sea:seaMaterial,root:campus.root,invalidate,onAmbientFps:fps=>renderLoop?.setIdleFrameRate(reduced?0:fps)});
  scene.add(createCampusShoreline(data.coastline.map(feature=>feature.points),seaMaterial.uniforms.uTime));
  const seaLabel = createSeaLabel();
  scene.add(seaLabel);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'map-label-layer';
  host.appendChild(labelLayer);
  const placeLabels = new Map<
    string,
    { button: HTMLButtonElement; point: THREE.Vector3; visible: boolean }
  >();
  const placeLabelOverrides = new Set<string>();
  const selectionBounds = new THREE.Box3Helper(
    new THREE.Box3(),
    new THREE.Color('#2385ff'),
  );
  selectionBounds.visible = false;
  selectionBounds.renderOrder = 29;
  const boundsMaterial = selectionBounds.material as THREE.LineBasicMaterial;
  boundsMaterial.depthTest = false;
  boundsMaterial.depthWrite = false;
  boundsMaterial.transparent = true;
  boundsMaterial.opacity = 0.75;
  scene.add(selectionBounds);
  const boundsForPlace = (place: CampusPlace) => {
    const building =
      place.buildingId &&
      campus.buildingsGroup.children.find(
        (group) => group.userData.osmId === place.buildingId,
      );
    return building
      ? new THREE.Box3().setFromObject(building)
      : new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(
            place.point[0],
            campus.heightAt(...place.point) + 6,
            place.point[1],
          ),
          new THREE.Vector3(30, 12, 30),
        );
  };
  let showLabels = true;
  let texturesEnabled = true;
  const labels = landmarks.map((l, i) => {
    const button = document.createElement('button');
    button.className = 'map-label';
    button.textContent = l.name;
    button.ariaLabel = `前往${l.name}`;
    labelLayer.appendChild(button);
    button.onclick = () => {
      if (pickMode) {
        selectNavigationPoint(l.x, l.z, l.name);
        return;
      }
      controller.setView(l.view as ViewId);
      callbacks.onSelect(l.name);
    };
    return {
      button,
      name: l.name,
      placeId: places.find(
        (place) => place.name === l.name || place.aliases.includes(l.name),
      )?.id,
      point: new THREE.Vector3(l.x, campus.heightAt(l.x, l.z) + l.lift, l.z),
      i,
    };
  });
  const presets: Record<
    Exclude<ViewId, 'free'>,
    { position: THREE.Vector3; target: THREE.Vector3 }
  > = {
    coastal: {position:new THREE.Vector3(1100,280,-50),target:new THREE.Vector3(-40,80,-170)},
    overview: {
      position: new THREE.Vector3(1170, 1090, 1020),
      target: new THREE.Vector3(-20, 62, -170),
    },
    top: {
      position: new THREE.Vector3(30, 1450, -159),
      target: new THREE.Vector3(30, 30, -160),
    },
    sundial: {
      position: new THREE.Vector3(-344, campus.plazaHeight + 82, -182),
      target: new THREE.Vector3(-170, campus.plazaHeight + 13, -280),
    },
    academic: {
      position: new THREE.Vector3(236, 258, -382),
      target: new THREE.Vector3(-137, 137, -238),
    },
    sculpture: {
      position: new THREE.Vector3(-231, campus.plazaHeight + 9.5, -278),
      target: new THREE.Vector3(-207, campus.plazaHeight + 4.6, -281),
    },
    sculptureTop: {
      position: new THREE.Vector3(-207, campus.plazaHeight + 100, -280.99),
      target: new THREE.Vector3(-207, campus.plazaHeight + 3, -281),
    },
    waterfront: {
      position: new THREE.Vector3(692, 205, -5),
      target: new THREE.Vector3(275, 25, -278),
    },
    bridge: {
      position: new THREE.Vector3(219, 188, -68),
      target: new THREE.Vector3(8, 103, -278),
    },
    south: {
      position: new THREE.Vector3(470, 440, 510),
      target: new THREE.Vector3(25, 104, 140),
    },
    innovation: {
      position: new THREE.Vector3(125, 325, 342),
      target: new THREE.Vector3(-127, 156, 76),
    },
    computing: {
      position: new THREE.Vector3(439, 162, -444),
      target: new THREE.Vector3(229, 33, -277),
    },
  };
  let transition: {
    lift?: number;
    duration?: number;
    from: THREE.Vector3;
    targetFrom: THREE.Vector3;
    to: THREE.Vector3;
    targetTo: THREE.Vector3;
    start: number;
    fovFrom: number;
    fovTo: number;
  } | null = null;
  let lastView: ViewId = 'overview';
  let sidebarVisible = host.clientWidth > 900;
  let sidebarOffset = sidebarVisible ? 155 : 0;
  let sidebarTransition: {
    from: number;
    to: number;
    start: number;
    duration: number;
  } | null = null;
  for (const p of Object.values(presets)) {
    if (host.clientWidth < 600) {
      p.position.sub(p.target).multiplyScalar(1.48).add(p.target);
    }
  }
  const initial = presets.overview;
  camera.position.copy(initial.position);
  controls.target.copy(initial.target);
  controls.update();
  const updateSidebarProjection = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (w > 900 && sidebarOffset > 0)
      camera.setViewOffset(w, h, -sidebarOffset, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    sidebarTransition = null;
    sidebarOffset = w > 900 && sidebarVisible ? 155 : 0;
    updateSidebarProjection();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let memoryMode = false;
  const draftPosition = new THREE.Vector3();
  const draftHandle = document.createElement('button');
  draftHandle.className = 'memory-drag-handle';
  draftHandle.type = 'button';
  draftHandle.setAttribute('aria-label','Drag photo locator');
  draftHandle.innerHTML = '<span class="memory-drag-dot">＋</span><span class="memory-drag-label">Drag to adjust</span>';
  draftHandle.style.display = 'none';
  host.appendChild(draftHandle);
  let draftVisible = false;
  const projectDraft = () => {
    if (!draftVisible) { draftHandle.style.display='none'; return; }
    const p=draftPosition.clone().project(camera);
    draftHandle.style.display=p.z>-1&&p.z<1?'block':'none';
    draftHandle.style.left=`${(p.x+1)*host.clientWidth/2}px`;
    draftHandle.style.top=`${(1-p.y)*host.clientHeight/2}px`;
  };
  const markDraft = (point: {x:number;y:number;z:number}) => {
    draftPosition.set(point.x,point.y,point.z);
    draftVisible=true;projectDraft();invalidate();
  };
  const savedPins: {element: HTMLButtonElement; point: THREE.Vector3}[]=[];
  const savedPinScreens:{x:number;y:number;width:number}[]=[];
  const projectSavedPins = () => {
    savedPinScreens.length=0;
    for(const pin of savedPins){
      const p=pin.point.clone().project(camera);
      pin.element.style.display=p.z>-1&&p.z<1&&Math.abs(p.x)<1.15&&Math.abs(p.y)<1.15?'block':'none';
      pin.element.style.left=`${(p.x+1)*host.clientWidth/2}px`;
      pin.element.style.top=`${(1-p.y)*host.clientHeight/2}px`;
      if(pin.element.style.display!=='none')savedPinScreens.push({x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2-18,width:54});
    }
  };
  const memoryCommand = (event: Event) => {
    const d = (event as CustomEvent).detail;
    if(d.action==='touring'){controls.enabled=!d.enabled;controls.autoRotate=false;if(!d.enabled)transition=null;}
    if(d.action==='pause-motion'){transition=null;}
    if(d.action==='restore-draft')markDraft(d.point);
    if (d.action === 'clear-draft') { draftVisible=false; projectDraft(); }
    if (d.action === 'mode') {
      memoryMode = d.enabled;
      savedPins.forEach(pin=>{pin.element.disabled=memoryMode;});
      host.classList.toggle('memory-picking', memoryMode);
      renderer.domElement.style.cursor = memoryMode ? 'crosshair' : '';
      if (memoryMode) {
        controls.autoRotate = false;
        pickMode = null;
        selectionBounds.visible = false;
      }
    }
    if (d.action === 'place') {
      const place = places.find(p => p.id === d.id || p.name === d.name);
      if (place) {
        markDraft({x:place.point[0],y:campus.heightAt(...place.point),z:place.point[1]});
        controller.focusPlace(place.id, true);
        window.dispatchEvent(new CustomEvent('campus-memory-point', {detail:{x:place.point[0],y:campus.heightAt(...place.point),z:place.point[1],name:translateCampusText(place.name,'en')}}));
      }
    }

    if (d.action === 'pins') {
      for(const pin of savedPins)pin.element.remove();savedPins.length=0;
      for(const item of d.items){
        const button=document.createElement('button');button.className='memory-saved-marker';button.type='button';
        button.setAttribute('aria-label',`View photo: ${item.title}`);
        const img=document.createElement('img');img.src=item.photo;img.alt='';img.draggable=false;
        const label=document.createElement('span');label.textContent=item.title;
        const badge=document.createElement('b');badge.textContent='▣';badge.setAttribute('aria-hidden','true');
        button.appendChild(img);button.appendChild(badge);button.appendChild(label);host.appendChild(button);
        button.onclick=e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent('campus-memory-open',{detail:item.id}));};
        savedPins.push({element:button,point:new THREE.Vector3(item.point.x,item.point.y+0.4,item.point.z)});
      }
      projectSavedPins();
    }
    if (d.action === 'focus') {
      controls.autoRotate = false;
      lastView = 'free';
      if(d.smooth){
        if(d.edit)markDraft(d.point);else{draftVisible=false;projectDraft();}
        const target=new THREE.Vector3(d.point.x,d.point.y,d.point.z);
        const destination=target.clone().add(new THREE.Vector3(d.tour?95:65,d.tour?120:85,d.tour?130:95));
        destination.y=Math.max(destination.y,campus.heightAt(destination.x,destination.z)+35);
        transition={from:camera.position.clone(),targetFrom:controls.target.clone(),to:destination,lift:d.tour?Math.max(40,camera.position.distanceTo(destination)*0.18):0,duration:d.tour?3000:1400,targetTo:target,start:performance.now(),fovFrom:camera.fov,fovTo:39};
      } else {
        markDraft(d.point);transition=null;
        controls.target.set(d.point.x,d.point.y,d.point.z);
        camera.position.set(d.point.x+65,d.point.y+85,d.point.z+95);
        controls.update();
      }
    }
    invalidate();
  };
  window.addEventListener('campus-memory-command', memoryCommand);
  const pointerRay = (e: Pick<PointerEvent,'clientX'|'clientY'>) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1),camera);
    return ray;
  };
  const moveDraft = (e: PointerEvent) => {
    const hit = pointerRay(pinPointer===null?e:{clientX:e.clientX-grabOffset.x,clientY:e.clientY-grabOffset.y}).intersectObjects(campus.root.children.filter(o=>o!==campus.vegetation&&!o.userData.decorative),true).find(h=>(h.object as THREE.Mesh).isMesh && h.object.visible);
    if (!hit) { window.dispatchEvent(new CustomEvent('campus-memory-miss')); return; }
    markDraft(hit.point);
    const nearest = [...places].sort((a,b)=>Math.hypot(a.point[0]-hit.point.x,a.point[1]-hit.point.z)-Math.hypot(b.point[0]-hit.point.x,b.point[1]-hit.point.z))[0];
    window.dispatchEvent(new CustomEvent('campus-memory-draft',{detail:{x:hit.point.x,y:hit.point.y,z:hit.point.z,name:translateCampusText(nearest?.name??'Campus','en')+' · Custom photo spot'}}));
  };
  let pinPointer: number | null = null;
  const grabOffset=new THREE.Vector2();
  const pinDown = (e: PointerEvent) => {
    if (e.button !== 0 || pinPointer !== null) return;
    const projected=draftPosition.clone().project(camera),rect=renderer.domElement.getBoundingClientRect();
    grabOffset.set(e.clientX-(rect.left+(projected.x+1)*rect.width/2),e.clientY-(rect.top+(1-projected.y)*rect.height/2));
    pinPointer=e.pointerId; controls.enabled=false; controls.autoRotate=false; transition=null;
    memoryMode=true;host.classList.add('memory-picking');
    draftHandle.classList.add('is-dragging');
    draftHandle.setPointerCapture(e.pointerId);
    window.dispatchEvent(new CustomEvent('campus-memory-edit'));
    e.stopPropagation();e.preventDefault();
  };
  const pinMove = (e: PointerEvent) => {
    if (pinPointer!==e.pointerId) return;
    e.stopPropagation();e.preventDefault();moveDraft(e);
  };
  const pinUp = (e: PointerEvent) => {
    if(pinPointer!==e.pointerId)return;
    e.stopPropagation();e.preventDefault();
    if(e.type==='pointerup')moveDraft(e);
    pinPointer=null;controls.enabled=true;draftHandle.classList.remove('is-dragging');
    if(draftHandle.hasPointerCapture(e.pointerId))draftHandle.releasePointerCapture(e.pointerId);
  };
  draftHandle.addEventListener('pointerdown',pinDown);
  draftHandle.addEventListener('pointermove',pinMove);
  draftHandle.addEventListener('pointerup',pinUp);
  draftHandle.addEventListener('pointercancel',pinUp);
  draftHandle.addEventListener('lostpointercapture',pinUp);
  const down = new THREE.Vector2();
  const activePointers = new Set<number>();
  let dragged = false;
  const pointerdown = (e: PointerEvent) => {
    activePointers.add(e.pointerId);
    dragged = activePointers.size > 1;
    down.set(e.clientX, e.clientY);
  };
  const pointermove = (e: PointerEvent) => {
    if (
      activePointers.has(e.pointerId) &&
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
    )
      dragged = true;
  };
  const pointercancel = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    dragged = true;
  };
  const pick = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (
      dragged ||
      activePointers.size ||
      e.button !== 0 ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    if (memoryMode) { moveDraft(e); return; }
    if (pickMode) {
      const target = ray.intersectObjects(
        campus.root.children.filter((o) => o !== campus.vegetation && !o.userData.decorative),
        true,
      )[0];
      if (
        target &&
        campus.isLand(target.point.x, target.point.z) &&
        inside(target.point.x, target.point.z, data.campusBoundary.points)
      ) {
        selectNavigationPoint(
          target.point.x,
          target.point.z,
          target.object.userData.name,
          target.point.y,
        );
      } else callbacks.onNavigationError('请在校园内的道路或广场上选点。');
      return;
    }
    const hit = ray
      .intersectObjects(campus.buildingsGroup.children, true)
      .find((h) => !!h.object.userData.name);
    if (hit) callbacks.onSelect(hit.object.userData.name);
    if (hit)
      focusedPlaceId =
        places.find((place) => place.buildingId === hit.object.userData.osmId)
          ?.id ?? null;
  };
  const interact = () => {
    transition = null;
    controls.autoRotate = false;
    lastView = 'free';
    callbacks.onInteract();
    invalidate();
  };
  controls.addEventListener('start', interact);
  controls.addEventListener('change', invalidate);
  renderer.domElement.addEventListener('pointerdown', pointerdown);
  renderer.domElement.addEventListener('pointermove', pointermove);
  renderer.domElement.addEventListener('pointercancel', pointercancel);
  renderer.domElement.addEventListener('pointerup', pick);
  const contextLost = (e: Event) => {
    e.preventDefault();
    contextIsLost = true;
    renderLoop?.setPaused(true);
    callbacks.onError('The graphics context was interrupted. Refresh to reload the campus.');
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const scratch = new THREE.Vector3();
  let animationTime = 0;
  let lastHeading: number | null = null;
  const draw = (now: number, delta: number, elapsed: number) => {
    // Keep ambient speed consistent at low FPS; controls still use bounded delta.
    animationTime += elapsed * 1000;
    if (sidebarTransition) {
      const p = THREE.MathUtils.clamp(
        (now - sidebarTransition.start) / sidebarTransition.duration,
        0,
        1,
      );
      const eased = sidebarVisible ? 1 - (1 - p) ** 3 : p * p * (3 - 2 * p);
      sidebarOffset = THREE.MathUtils.lerp(
        sidebarTransition.from,
        sidebarTransition.to,
        eased,
      );
      updateSidebarProjection();
      if (p === 1) sidebarTransition = null;
    }
    if (transition) {
      const p = THREE.MathUtils.clamp(
          (now - transition.start) / (reduced ? 1 : transition.duration ?? 1400),
          0,
          1,
        ),
        t = p * p * (3 - 2 * p);
      camera.fov = THREE.MathUtils.lerp(
        transition.fovFrom,
        transition.fovTo,
        t,
      );
      camera.updateProjectionMatrix();
      camera.position.lerpVectors(transition.from, transition.to, t);
      camera.position.y += Math.sin(Math.PI*t)*(transition.lift??0);
      camera.position.y = Math.max(camera.position.y,12,surroundings.heightAt(camera.position.x,camera.position.z)+12);
      controls.target.lerpVectors(
        transition.targetFrom,
        transition.targetTo,
        t,
      );
      if (p === 1) transition = null;
    }
    const controlsChanged = controls.update(delta);
    lighting.followCamera();
    projectDraft();
    projectSavedPins();
    // Keep the orbit pivot inside the model bounds.
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -550, 680);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -670, 500);
    if (!transition && lastView === 'free') {
      const ground = surroundings.heightAt(camera.position.x, camera.position.z);
      camera.position.y = Math.max(camera.position.y, 5, ground + 5);
    }
    const occupied: { x: number; y: number; width?:number }[] = [...savedPinScreens];
    for (const location of currentRoute
      ? [currentRoute.start, currentRoute.end]
      : []) {
      scratch
        .set(...location.position)
        .add(new THREE.Vector3(0, 12, 0))
        .project(camera);
      occupied.push({
        x: (scratch.x * 0.5 + 0.5) * host.clientWidth,
        y: (-scratch.y * 0.5 + 0.5) * host.clientHeight,
      });
    }
    for (const l of labels) {
      const labelWidth=Math.max(75,Math.min(230,(l.button.textContent?.length??16)*6.4+20));
      scratch.copy(l.point).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * host.clientWidth,
        y = (-scratch.y * 0.5 + 0.5) * host.clientHeight;
      const visible =
        showLabels &&
        !(l.placeId && placeLabelOverrides.has(l.placeId)) &&
        lastView !== 'sculptureTop' &&
        !(
          camera.position.distanceTo(controls.target) < 65 &&
          Math.hypot(controls.target.x + 207, controls.target.z + 281) < 12
        ) &&
        l.point.distanceTo(controls.target) <
          Math.max(90, camera.position.distanceTo(controls.target) * 0.85) &&
        scratch.z > -1 &&
        scratch.z < 1 &&
        x > 15 &&
        x < host.clientWidth - 60 &&
        y > 50 &&
        y < host.clientHeight - 130 &&
        !(host.clientWidth > 900 && sidebarVisible && x < 360) &&
        !occupied.some(
          (p) =>
            Math.abs(p.x - x) < ((p.width??110)+labelWidth)/2+12 &&
            Math.abs(p.y - y) < 42,
        ) &&
        (host.clientWidth > 600 || l.i % 2 === 0);
      l.button.style.display = visible ? 'block' : 'none';
      if (visible) {
        l.button.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        occupied.push({ x, y, width:labelWidth });
      }
    }
    for (const label of placeLabels.values()) {
      scratch.copy(label.point).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * host.clientWidth;
      const y = (-scratch.y * 0.5 + 0.5) * host.clientHeight;
      const visible =
        showLabels &&
        label.visible &&
        scratch.z > -1 &&
        scratch.z < 1 &&
        x > 8 &&
        x < host.clientWidth - 8 &&
        y > 8 &&
        y < host.clientHeight - 40;
      label.button.style.display = visible ? 'block' : 'none';
      if (visible)
        label.button.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
    const heading =
      Math.round(-THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) * 10) /
      10;
    if (heading !== lastHeading) {
      lastHeading = heading;
      callbacks.onHeading(heading);
    }
    seaMaterial.uniforms.uTime.value = reduced ? 0 : animationTime * 0.001;
    routeOverlay.update(
      animationTime,
      camera,
      host.clientWidth,
      host.clientHeight,
    );
    renderer.render(scene, camera);
    return !!(
      transition ||
      sidebarTransition ||
      controls.autoRotate ||
      controlsChanged
    );
  };
  const visibilityChanged = () =>
    renderLoop?.setPaused(document.hidden || contextIsLost);
  const controller: CampusController = {
    places,
    setLanguage(next) {
      language = next;
      renderer.domElement.setAttribute(
        'aria-label',
        translateCampusText(
          '三维校园：方向键平移，使用页面按钮切换视角或缩放',
          language,
        ),
      );
      for (const label of labels) {
        label.button.textContent = translateCampusText(label.name, language);
        label.button.ariaLabel = translateCampusText(
          `前往${label.name}`,
          language,
        );
      }
      for (const [id, label] of placeLabels) {
        const place = places.find((candidate) => candidate.id === id);
        if (!place) continue;
        label.button.textContent = translateCampusText(place.name, language);
        label.button.ariaLabel = translateCampusText(
          `定位${place.name}`,
          language,
        );
      }
      routeOverlay.setLanguage(language);
      invalidate();
    },
    getAssistantContext() {
      const placeForLocation = (location: NavigationLocation | undefined) =>
        location
          ? (places.find(
              (place) =>
                place.navigationId === location.id ||
                place.name === location.name,
            )?.id ?? null)
          : null;
      return {
        focused_place_id: focusedPlaceId,
        route_start_id: placeForLocation(currentRoute?.start),
        route_end_id: placeForLocation(currentRoute?.end),
      };
    },
    setPlaceLabel(id, visible) {
      const place = places.find((candidate) => candidate.id === id);
      if (!place) throw new Error('Unknown campus place');
      placeLabelOverrides.add(id);
      let label = placeLabels.get(id);
      if (!label && visible) {
        const bounds = boundsForPlace(place);
        const point = bounds.getCenter(new THREE.Vector3());
        point.y = bounds.max.y + 10;
        const button = document.createElement('button');
        button.className = 'map-label assistant-place-label';
        button.textContent = translateCampusText(place.name, language);
        button.ariaLabel = translateCampusText(`定位${place.name}`, language);
        button.onclick = () => {
          if (pickMode) selectNavigationPoint(...place.point, place.name);
          else controller.focusPlace(id, true);
        };
        labelLayer.appendChild(button);
        label = { button, point, visible };
        placeLabels.set(id, label);
      }
      if (label) {
        label.visible = visible;
        label.button.style.display = visible ? 'block' : 'none';
      }
      if (visible) showLabels = true;
      invalidate();
    },
    focusPlace(id, showLabel) {
      const place = places.find((candidate) => candidate.id === id);
      if (!place) throw new Error('Unknown campus place');
      const bounds = boundsForPlace(place);
      const target = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(
        45,
        bounds.getSize(new THREE.Vector3()).length() / 2,
      );
      const halfFov = Math.atan(
        Math.tan(THREE.MathUtils.degToRad(39 / 2)) *
          Math.min(0.68, camera.aspect * 0.62),
      );
      const distance = Math.min(
        controls.maxDistance,
        radius / Math.sin(halfFov),
      );
      controller.setPlaceLabel(id, showLabel);
      selectionBounds.box.copy(bounds).expandByScalar(2);
      selectionBounds.visible = true;
      focusedPlaceId = id;
      controls.autoRotate = false;
      transition = {
        from: camera.position.clone(),
        targetFrom: controls.target.clone(),
        to: target
          .clone()
          .add(
            new THREE.Vector3(0.9, 0.9, 1).normalize().multiplyScalar(distance),
          ),
        targetTo: target,
        start: performance.now(),
        fovFrom: camera.fov,
        fovTo: 39,
      };
      lastView = 'free';
      callbacks.onView('free');
      callbacks.onSelect(place.name);
      invalidate();
    },
    navigation,
    setRoute(route) {
      currentRoute = route;
      routeOverlay.setRoute(route);
      renderLoop?.setIdleFrameRate(reduced ? 0 : route ? 15 : 2);
      invalidate();
    },
    focusRoute() {
      if (!currentRoute) return;
      const bounds = new THREE.Box3().setFromPoints(
        currentRoute.points.map((p) => new THREE.Vector3(...p)),
      );
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(
        38,
        bounds.getSize(new THREE.Vector3()).length() / 2,
      );
      const verticalFov = THREE.MathUtils.degToRad(39 / 2);
      const widthRatio = Math.max(
        0.3,
        (host.clientWidth -
          (sidebarVisible && host.clientWidth > 900 ? 410 : 90)) /
          host.clientWidth,
      );
      const heightRatio = Math.max(
        0.3,
        (host.clientHeight - 260) / host.clientHeight,
      );
      const halfFov = Math.min(
        Math.atan(Math.tan(verticalFov) * camera.aspect * widthRatio),
        Math.atan(Math.tan(verticalFov) * heightRatio),
      );
      const distance = Math.min(
        controls.maxDistance,
        (radius / Math.sin(halfFov)) * 1.08,
      );
      controls.autoRotate = false;
      transition = {
        from: camera.position.clone(),
        targetFrom: controls.target.clone(),
        to: center
          .clone()
          .add(
            new THREE.Vector3(0.65, 1.25, 0.9)
              .normalize()
              .multiplyScalar(distance),
          ),
        targetTo: center,
        start: performance.now(),
        fovFrom: camera.fov,
        fovTo: 39,
      };
      lastView = 'free';
      callbacks.onView('free');
      invalidate();
    },
    setPickMode(mode) {
      pickMode = mode;
      renderer.domElement.style.cursor = mode ? 'crosshair' : '';
    },
    setView(id) {
      if (id === 'free') return;
      const p = presets[id];
      controls.autoRotate = false;
      controls.enabled = false;
      controls.update();
      transition = {
        from: camera.position.clone(),
        targetFrom: controls.target.clone(),
        to: p.position.clone(),
        targetTo: p.target.clone(),
        start: performance.now(),
        fovFrom: camera.fov,
        fovTo: id === 'sculptureTop' ? 11 : 39,
      };
      controls.enabled = true;
      lastView = id;
      callbacks.onView(id);
      invalidate();
    },
    setAutoRotate(v) {
      transition = null;
      controls.autoRotate = v;
      invalidate();
    },
    setSidebarVisible(v) {
      if (sidebarVisible === v) return;
      sidebarVisible = v;
      const targetOffset = v && host.clientWidth > 900 ? 155 : 0;
      if (reduced || host.clientWidth <= 900) {
        sidebarTransition = null;
        sidebarOffset = targetOffset;
        updateSidebarProjection();
      } else {
        sidebarTransition = {
          from: sidebarOffset,
          to: targetOffset,
          start: performance.now(),
          duration: v ? 520 : 420,
        };
      }
      invalidate();
    },
    setLabels(v) {
      showLabels = v;
      seaLabel.visible = v;
      invalidate();
    },
    setTrees(v) {
      if (campus.vegetation.visible === v) return;
      campus.vegetation.visible = v;
      for(const name of ['Illustrative_surrounding_slope_trees','Illustrative_surrounding_tree_trunks']){const mesh=surroundings.group.getObjectByName(name);if(mesh)mesh.visible=v;}
      renderer.shadowMap.needsUpdate = true;
      invalidate();
    },
    setTextures(v) {
      if (texturesEnabled === v) return;
      texturesEnabled = v;
      mappedMaterials.forEach(({ map, color }, mat) => {
        mat.map = v ? map : null;
        if (v) mat.color.copy(color);
        else mat.color.set(untexturedColors[mat.name] ?? '#ffffff');
        mat.needsUpdate = true;
      });
      invalidate();
    },
    zoom(factor) {
      transition = null;
      const v = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(
        v.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      v.setLength(distance);
      camera.position.copy(controls.target).add(v);
      invalidate();
    },
    async download() {
      // The 31 MB model is stored in two parts: Cloudflare Workers serves files up to 25 MiB each.
      const parts = await Promise.all(['part0', 'part1'].map(async part => {
        const response = await fetch(asset(`/model/hkust-clear-water-bay.glb.${part}`));
        if (!response.ok) throw new Error('Model download failed');
        return response.blob();
      }));
      const blob = new Blob(parts, { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'hkust-clear-water-bay.glb';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    dispose() {
      lighting.dispose();
      savedPins.forEach(pin=>pin.element.remove());
      draftHandle.remove();
      host.classList.remove('memory-picking');
      window.removeEventListener('campus-memory-command', memoryCommand);
      renderLoop?.dispose();
      document.removeEventListener('visibilitychange', visibilityChanged);
      observer.disconnect();
      controls.removeEventListener('start', interact);
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      routeOverlay.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerdown);
      renderer.domElement.removeEventListener('pointermove', pointermove);
      renderer.domElement.removeEventListener('pointercancel', pointercancel);
      renderer.domElement.removeEventListener('pointerup', pick);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          geometries.add(obj.geometry);
          for (const m of Array.isArray(obj.material)
            ? obj.material
            : [obj.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      loadedTextures.forEach((t) => t.dispose());
      seaLabel.material.map?.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
  renderLoop = createDemandRenderLoop(draw);
  renderLoop.setIdleFrameRate(reduced ? 0 : lighting.ambientFps());
  document.addEventListener('visibilitychange', visibilityChanged);
  visibilityChanged();
  invalidate();
  return controller;
}
