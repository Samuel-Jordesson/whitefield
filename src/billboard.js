import * as THREE from 'three';

// Plano unitario com o pivo no pe do sprite — o tamanho vem do scale,
// entao todos os sprites compartilham a mesma geometria.
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
UNIT_PLANE.translate(0, 0.5, 0);

// Sprite 2D dentro do mundo 3D: sempre gira no eixo Y para encarar a camera.
// Diferente de THREE.Sprite, ele projeta sombra recortada pelo alpha da textura.
export class Billboard extends THREE.Mesh {
  constructor(texture, width, height, { doubleSide = false } = {}) {
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      alphaTest: 0.5,
      transparent: false,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      shadowSide: THREE.DoubleSide,
    });

    super(UNIT_PLANE, mat);
    this.castShadow = true;
    this.receiveShadow = false;
    this.setSize(width, height);
  }

  setSize(width, height) {
    this.spriteWidth = width;
    this.spriteHeight = height;
    this.scale.set(width, height, 1);
  }

  faceCamera(camera) {
    this.rotation.y = Math.atan2(
      camera.position.x - this.position.x,
      camera.position.z - this.position.z
    );
  }
}

// Sombra de contato (mancha no chao) — ajuda o sprite a "grudar" no piso.
export function makeBlobShadow(texture, size) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}
