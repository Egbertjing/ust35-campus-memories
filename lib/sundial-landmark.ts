import * as THREE from 'three';
import { detailBuilder, type Materials } from './photo-architecture';
import { createRedBird } from './red-bird';

// Thin, double-sided shells preserve the Red Bird's concave three-dimensional
// silhouette. Overall sculpture height: 8.5m (HKUST Campus Management Office).
function sheet(
  point: (u: number, v: number) => THREE.Vector3,
  nu: number,
  nv: number,
) {
  const p: number[] = [],
    uv: number[] = [],
    ids: number[] = [];
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      p.push(...point(i / nu, j / nv).toArray());
      uv.push(i / nu, j / nv);
      if (i < nu && j < nv) {
        const a = i * (nv + 1) + j,
          b = a + nv + 1;
        ids.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}

export function addSundial(
  parent: THREE.Group,
  plaza: number,
  mats: Materials,
) {
  const landmark = new THREE.Group();
  landmark.name = 'Red_Bird_Sundial_photo_interpretation';
  landmark.position.set(-207, plaza + 0.65, -281);
  landmark.userData = {
    name: '红鸟日晷',
    sculptureHeight: 8.5,
    reference:
      'IMG_0252, IMG_0256, IMG_0257; user ground photographs and four-arm clarification; cmo.hkust.edu.hk/sundial-sculpture',
    photoFeatures: [
      'four orthogonal arms under a single rigid inclination',
      'tapered swept wing',
      'curved numbered hour dial',
      'gnomon across the low crescent',
      'shallow reflecting basin',
    ],
  };
  parent.add(landmark);
  const { add, box, finish } = detailBuilder(landmark);
  const stone = new THREE.MeshStandardMaterial({
    color: '#e2e0d4',
    roughness: 0.82,
  });
  const water = new THREE.MeshStandardMaterial({
    color: '#7facac',
    metalness: 0.2,
    roughness: 0.24,
  });
  const joints = new THREE.MeshStandardMaterial({
    color: '#b2b8ac',
    roughness: 0.9,
  });
  for (let i = 0; i < 3; i++)
    add(
      new THREE.CylinderGeometry(6.1 - 0.25 * i, 6.1 - 0.25 * i, 0.18, 96),
      stone,
      0,
      i * 0.16,
      0,
    );
  const ring = new THREE.RingGeometry(4.4, 5.6, 96);
  ring.rotateX(-Math.PI / 2);
  add(ring, stone, 0, 0.47, 0);
  const pool = new THREE.CircleGeometry(4.38, 96);
  pool.rotateX(-Math.PI / 2);
  add(pool, water, 0, 0.425, 0);
  for (let i = 0; i < 3; i++)
    add(
      new THREE.CylinderGeometry(1.6 - i * 0.1, 1.6 - i * 0.1, 0.12, 64),
      stone,
      0,
      0.47 + i * 0.11,
      0,
    );
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    box(1.18, 0.012, 0.022, Math.cos(a) * 5, 0.48, Math.sin(a) * 5, joints, -a);
  }
  finish();

  const bird = createRedBird();
  bird.rotation.y = -2.0;
  const birdBounds = new THREE.Box3().setFromObject(bird, true);
  bird.position.y = 0.75 - birdBounds.min.y;
  landmark.add(bird);

  const paving = new THREE.Group();
  paving.name = 'Piazza_radial_paving_and_palms';
  parent.add(paving);
  const details = detailBuilder(paving);
  const plazaDisc = new THREE.CircleGeometry(18.5, 96);
  plazaDisc.rotateX(-Math.PI / 2);
  details.add(plazaDisc, stone, -207, plaza + 0.568, -281);
  const arc = Array.from({ length: 97 }, (_, i) => {
    const a = -1.45 + (i / 96) * 3.12;
    return new THREE.Vector2(
      -210.35 + 56.8 * Math.cos(a),
      -(-278.44 + 56.8 * Math.sin(a)),
    );
  });
  const forecourt = new THREE.ShapeGeometry(new THREE.Shape(arc));
  forecourt.rotateX(-Math.PI / 2);
  details.add(forecourt, stone, 0, plaza + 0.565, 0);
  const line = (x1: number, z1: number, x2: number, z2: number) =>
    details.box(
      Math.hypot(x2 - x1, z2 - z1),
      0.024,
      0.085,
      (x1 + x2) / 2,
      plaza + 0.58,
      (z1 + z2) / 2,
      joints,
      -Math.atan2(z2 - z1, x2 - x1),
    );
  for (let radius = 19; radius <= 53; radius += 4.5)
    for (let i = 0; i < 72; i++) {
      const a = -1.45 + (i / 72) * 3.12,
        b = -1.45 + ((i + 1) / 72) * 3.12;
      line(
        -210.35 + radius * Math.cos(a),
        -278.44 + radius * Math.sin(a),
        -210.35 + radius * Math.cos(b),
        -278.44 + radius * Math.sin(b),
      );
    }
  for (let i = 0; i <= 24; i++) {
    const a = -1.45 + (i / 24) * 3.12;
    line(
      -210.35 + 19 * Math.cos(a),
      -278.44 + 19 * Math.sin(a),
      -210.35 + 53 * Math.cos(a),
      -278.44 + 53 * Math.sin(a),
    );
  }
  const bark = new THREE.MeshStandardMaterial({
    color: '#8f8c73',
    roughness: 0.9,
  });
  const leaves = new THREE.MeshStandardMaterial({
    color: '#588065',
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 11; i++) {
    const angle = -1.29 + i * 0.27,
      x = -210.35 + 51.5 * Math.cos(angle),
      z = -278.44 + 51.5 * Math.sin(angle);
    details.add(
      new THREE.CylinderGeometry(0.19, 0.29, 6.2, 8),
      bark,
      x,
      plaza + 3.65,
      z,
    );
    for (let k = 0; k < 9; k++) {
      const yaw = (k / 9) * Math.PI * 2;
      const leaf = sheet(
        (u, v) =>
          new THREE.Vector3(
            (v - 0.5) * 0.78 * Math.sin(Math.PI * u),
            Math.sin(Math.PI * u) * 1.1 - u * 0.5,
            u * 3.4,
          ),
        9,
        2,
      );
      details.add(leaf, leaves, x, plaza + 6.75, z, yaw);
    }
  }
  details.finish();
  return landmark;
}
