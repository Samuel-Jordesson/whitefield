import * as THREE from 'three';
import * as TEX from './textures.js';
import { Billboard, makeBlobShadow } from './billboard.js';
import { buildHut, hutRadius } from './huts.js';

export const WORLD_SIZE = 220;      // metade do lado do campo
export const FOG_NEAR = 40;
export const FOG_FAR = 190;

// Gerador de numeros com semente: o servidor manda a mesma semente para todo
// mundo, entao o cenario (e as caixas em cima dele) nasce igual em todas as
// telas — sem isso um jogador teria arvore onde o outro tem campo aberto.
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.props = [];         // billboards do cenario
    this.colliders = [];     // { x, z, r } — arvores, pedras, caixotes
    this.boxColliders = [];  // { x, z, hw, hd, rot } — paredes das cabanas
    this.shadows = [];       // manchas de contato dos props
    this.huts = [];          // grupos 3D das cabanas

    this.shadowTex = TEX.blobShadowTexture();
    this.textures = {
      trees: [TEX.treeTexture(1), TEX.treeTexture(4), TEX.treeTexture(9)],
      rocks: [TEX.rockTexture(2), TEX.rockTexture(6)],
      bushes: [TEX.bushTexture(3), TEX.bushTexture(8)],
      crate: TEX.crateTexture(),
      pole: TEX.poleTexture(),
    };

    this._setupSky(scene);
    this._setupGround(scene);
    this._setupLights(scene);
    this.rebuild(seed);
  }

  // Refaz o cenario com a semente da partida. `huts` vem do servidor, entao
  // as cabanas ficam no mesmo lugar para todo mundo.
  rebuild(seed, huts = []) {
    this.seed = seed;
    for (const p of this.props) { this.scene.remove(p); p.material.dispose(); }
    for (const s of this.shadows) { this.scene.remove(s); s.geometry.dispose(); s.material.dispose(); }
    for (const h of this.huts) this.scene.remove(h);
    this.props.length = 0;
    this.shadows.length = 0;
    this.colliders.length = 0;
    this.boxColliders.length = 0;
    this.huts.length = 0;

    this.hutSpots = huts.map((h) => ({ ...h, r: hutRadius(h.kind) }));
    for (const h of huts) {
      const { grupo, barreiras } = buildHut(h);
      this.scene.add(grupo);
      this.huts.push(grupo);
      this.boxColliders.push(...barreiras);
    }

    this._scatterProps(this.scene, makeRng(seed));
  }

  // true se o ponto cai em cima de alguma cabana
  _dentroDeCabana(x, z, folga = 0) {
    for (const h of this.hutSpots || []) {
      if (Math.hypot(x - h.x, z - h.z) < h.r + folga) return true;
    }
    return false;
  }

  _setupSky(scene) {
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, FOG_NEAR, FOG_FAR);
  }

  _setupGround(scene) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2),
      new THREE.MeshLambertMaterial({ map: TEX.groundTexture(), color: 0xffffff })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.ground = ground;

    // linha de horizonte discreta, para o branco nao virar vazio total
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(WORLD_SIZE - 2, WORLD_SIZE, 96),
      new THREE.MeshBasicMaterial({ color: 0xdddddd, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);
  }

  _setupLights(scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d6d6, 1.5));

    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(48, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    const d = 60;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // leve luz de preenchimento vinda do lado oposto
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-40, 30, -25);
    scene.add(fill);
  }

  _addProp(scene, texture, w, h, x, z, radius) {
    const b = new Billboard(texture, w, h);
    b.position.set(x, 0, z);
    scene.add(b);
    this.props.push(b);

    const sh = makeBlobShadow(this.shadowTex, w * 0.9);
    sh.position.set(x, 0.02, z);
    scene.add(sh);
    this.shadows.push(sh);

    if (radius > 0) this.colliders.push({ x, z, r: radius });
    return b;
  }

  _scatterProps(scene, rng) {
    const { trees, rocks, bushes, crate, pole } = this.textures;

    const rand = (a, b) => a + rng() * (b - a);

    const place = (min = 12, max = WORLD_SIZE - 20) => {
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2;
        const r = rand(min, max);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.hypot(x, z) < min) continue;
        if (this._dentroDeCabana(x, z, 1.5)) continue;   // nada de arvore na sala
        return [x, z];
      }
      return [rand(-max, max), rand(-max, max)];
    };

    for (let i = 0; i < 60; i++) {
      const [x, z] = place(14);
      const h = rand(7, 12);
      this._addProp(scene, trees[i % trees.length], h * 0.66, h, x, z, 0.9);
    }
    for (let i = 0; i < 34; i++) {
      const [x, z] = place(10);
      const h = rand(1.2, 2.6);
      this._addProp(scene, rocks[i % rocks.length], h * 1.33, h, x, z, h * 0.5);
    }
    for (let i = 0; i < 46; i++) {
      const [x, z] = place(8);
      const h = rand(0.8, 1.4);
      this._addProp(scene, bushes[i % bushes.length], h * 1.5, h, x, z, 0);
    }
    for (let i = 0; i < 18; i++) {
      const [x, z] = place(9, 70);
      const s = rand(1.1, 1.7);
      this._addProp(scene, crate, s, s, x, z, s * 0.5);
    }
    for (let i = 0; i < 10; i++) {
      const [x, z] = place(20, 120);
      this._addProp(scene, pole, 1.6, rand(6, 9), x, z, 0.4);
    }
  }

  update(camera) {
    // billboards acompanham a camera; o sol segue o jogador para a sombra
    // sempre cobrir a area util do mapa
    for (const p of this.props) p.faceCamera(camera);

    this.sun.target.position.set(camera.position.x, 0, camera.position.z);
    this.sun.position.set(camera.position.x + 48, 70, camera.position.z + 30);
  }
}
