import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { CampusRoute } from './campus-navigation';
import { translateCampusText, type CampusLanguage } from './campus-language';

export function createRouteOverlay(host: HTMLElement, reducedMotion: boolean) {
  let language: CampusLanguage = 'zh';
  const group = new THREE.Group();
  group.name = 'Navigation_route';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'route-label-layer';
  labelLayer.setAttribute('aria-hidden', 'true');
  host.appendChild(labelLayer);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const lineMaterials: LineMaterial[] = [];
  const labels: {
    element: HTMLDivElement;
    point: THREE.Vector3;
    name: string;
    nameElement: HTMLSpanElement;
  }[] = [];
  const arrows: THREE.Mesh[] = [];
  const path = new THREE.CurvePath<THREE.Vector3>();
  let route: CampusRoute | null = null;

  const clear = () => {
    group.clear();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    geometries.clear();
    materials.clear();
    lineMaterials.length = 0;
    labels.length = 0;
    arrows.length = 0;
    path.curves.length = 0;
    path.updateArcLengths();
    labelLayer.replaceChildren();
  };
  const addLine = (
    points: number[],
    color: string,
    width: number,
    depthTest: boolean,
    opacity = 1,
    dashed = false,
  ) => {
    const geometry = new LineGeometry();
    geometry.setPositions(points);
    const material = new LineMaterial({
      color,
      linewidth: width,
      depthTest,
      depthWrite: false,
      transparent: true,
      opacity,
      dashed,
      dashSize: 5,
      gapSize: 3,
      toneMapped: false,
    });
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.renderOrder = depthTest ? 32 + (color === '#ffffff' ? 0 : 1) : 30;
    line.frustumCulled = false;
    geometries.add(geometry);
    materials.add(material);
    lineMaterials.push(material);
    group.add(line);
    return line;
  };
  const setRoute = (next: CampusRoute | null) => {
    clear();
    route = next;
    if (!next) return;
    const vectors = next.points.map((p) =>
      new THREE.Vector3(...p).add(new THREE.Vector3(0, 0.7, 0)),
    );
    const positions = vectors.flatMap((v) => v.toArray());
    // Dashed x-ray trace keeps covered passages readable. The solid route
    // respects scene depth so bridges still read at their actual model level.
    addLine(positions, '#1677ff', 4, false, 0.6, true);
    addLine(positions, '#ffffff', 9, true, 0.96);
    addLine(positions, '#1677ff', 5, true);
    for (const step of next.steps.filter((s) => s.kind === 'lift')) {
      const liftLine = addLine(
        [
          step.from[0],
          step.from[1] + 0.7,
          step.from[2],
          step.to[0],
          step.to[1] + 0.7,
          step.to[2],
        ],
        '#ed9a21',
        5,
        false,
        0.95,
        true,
      );
      liftLine.renderOrder = 34;
    }
    for (let i = 1; i < vectors.length; i++)
      path.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]));
    path.updateArcLengths();
    const arrowGeometry = new THREE.ConeGeometry(1.9, 6, 3);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    geometries.add(arrowGeometry);
    materials.add(arrowMaterial);
    const count = Math.min(18, Math.max(2, Math.floor(next.distance / 32)));
    for (let i = 0; i < count; i++) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.renderOrder = 35;
      group.add(arrow);
      arrows.push(arrow);
    }
    for (const [i, location] of [next.start, next.end].entries()) {
      const point = new THREE.Vector3(...location.position);
      const color = i === 0 ? '#0b8b67' : '#e3624d';
      const pinMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      materials.add(pinMaterial);
      const ringGeometry = new THREE.TorusGeometry(4.5, 1.1, 8, 32);
      const stemGeometry = new THREE.CylinderGeometry(0.7, 0.7, 10, 8);
      for (const geometry of [ringGeometry, stemGeometry])
        geometries.add(geometry);
      const ring = new THREE.Mesh(ringGeometry, pinMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(point).y += 1.5;
      const stem = new THREE.Mesh(stemGeometry, pinMaterial);
      stem.position.copy(point).y += 6;
      ring.renderOrder = stem.renderOrder = 36;
      group.add(ring, stem);
      const element = document.createElement('div');
      element.className = 'route-pin';
      element.dataset.endpoint = i === 0 ? 'start' : 'end';
      const badge = document.createElement('b');
      badge.textContent = i === 0 ? 'A' : 'B';
      const name = document.createElement('span');
      name.textContent = translateCampusText(location.name, language);
      element.appendChild(badge);
      element.appendChild(name);
      labelLayer.appendChild(element);
      labels.push({
        element,
        name: location.name,
        nameElement: name,
        point: point.clone().add(new THREE.Vector3(0, 12, 0)),
      });
    }
  };
  const scratch = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const update = (
    now: number,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) => {
    if (!route) return;
    for (const material of lineMaterials)
      material.resolution.set(width, height);
    arrows.forEach((arrow, i) => {
      const t =
        (i / arrows.length +
          (reducedMotion ? 0 : (now * 0.012) / route!.distance)) %
        1;
      arrow.position.copy(path.getPoint(t));
      arrow.quaternion.setFromUnitVectors(up, path.getTangent(t));
    });
    for (const { element, point } of labels) {
      scratch.copy(point).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * width;
      const y = (-scratch.y * 0.5 + 0.5) * height;
      const visible =
        scratch.z > -1 &&
        scratch.z < 1 &&
        x > 0 &&
        x < width &&
        y > 0 &&
        y < height;
      element.hidden = !visible;
      if (visible)
        element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  };
  return {
    group,
    setRoute,
    setLanguage(next: CampusLanguage) {
      language = next;
      for (const label of labels)
        label.nameElement.textContent = translateCampusText(
          label.name,
          language,
        );
    },
    update,
    dispose() {
      clear();
      labelLayer.remove();
    },
  };
}
