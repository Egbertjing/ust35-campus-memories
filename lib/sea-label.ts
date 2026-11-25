import * as THREE from 'three';

// A point in Port Shelter, east of the campus shoreline, in model metres.
export const SEA_LABEL_POSITION = [690, 0.8, -250] as const;
export const SEA_LABEL_SIZE = [245, 66] as const;

export function createSeaLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the sea label');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#285d69';
  context.font = '500 55px Arial, sans-serif';
  context.fillText('P O R T   S H E L T E R', 512, 128);
  context.font = '500 46px "PingFang SC", "Microsoft YaHei", sans-serif';


  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 0.76,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(...SEA_LABEL_SIZE),
    material,
  );
  label.name = 'Port_Shelter_world_label';
  label.rotation.x = -Math.PI / 2;
  label.position.set(...SEA_LABEL_POSITION);
  return label;
}
