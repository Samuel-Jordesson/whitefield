import * as THREE from 'three';
import * as TEX from './textures.js';

const GRAVITY = 22;
const THROW_SPEED = 17;
const THROW_LIFT = 3.2;
const FUSE = 2.4;              // segundos ate estourar
export const BLAST_RADIUS = 6.5;
const ARC_DOTS = 40;       // bolinhas desenhadas na curva
const ARC_EVERY = 2;       // uma bolinha a cada N passos de fisica
const ARC_SKIP = 5;        // pula o comeco, que sairia de dentro da camera
export const BLAST_DAMAGE = 95;

// Quanto de dano a explosao faz a uma certa distancia.
export function blastDamage(dist) {
  if (dist >= BLAST_RADIUS) return 0;
  const t = 1 - dist / BLAST_RADIUS;
  return Math.round(BLAST_DAMAGE * t * t);
}

// Velocidade inicial de um arremesso olhando para `dir`.
export function throwVelocity(dir) {
  return new THREE.Vector3(
    dir.x * THROW_SPEED,
    dir.y * THROW_SPEED + THROW_LIFT,
    dir.z * THROW_SPEED
  );
}

// Um passo da fisica, usado tanto pela granada de verdade quanto pela
// linha que mostra onde ela vai cair — assim a previsao nao mente.
function step(pos, vel, dt) {
  vel.y -= GRAVITY * dt;
  pos.addScaledVector(vel, dt);
  if (pos.y <= 0.12) {
    pos.y = 0.12;
    vel.y = Math.abs(vel.y) * 0.35;
    vel.x *= 0.55;
    vel.z *= 0.55;
    if (vel.y < 1.2) vel.y = 0;
    return true;      // bateu no chao
  }
  return false;
}

export class GrenadeManager {
  constructor(scene, { onExplode }) {
    this.scene = scene;
    this.onExplode = onExplode;
    this.live = [];
    this.blasts = [];

    this.tex = new THREE.TextureLoader().load('itens/granada.png');
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.puffTex = TEX.puffTexture();

    // trajetoria desenhada como uma fileira de bolinhas: linha de 1px sumiria
    // no fundo branco, e as bolinhas ainda encolhem com a distancia
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_DOTS * 3), 3));
    this.arc = new THREE.Points(geo, new THREE.PointsMaterial({
      map: TEX.dotTexture(),
      size: 7,
      sizeAttenuation: false,   // tamanho em pixels: nao vira borrao de perto
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
      opacity: 0.5,
    }));
    this.arc.renderOrder = 3;
    this.arc.visible = false;
    this.arc.frustumCulled = false;
    scene.add(this.arc);

    this.mark = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 32),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false })
    );
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.renderOrder = 3;
    this.mark.visible = false;
    scene.add(this.mark);
  }

  /* ---------------- linha de arremesso ---------------- */

  // `forte` = mirando com o botao direito (a curva fica mais marcada)
  showArc(origin, dir, forte = false) {
    const pos = origin.clone();
    const vel = throwVelocity(dir);
    const pts = [];

    for (let i = 0; pts.length < ARC_DOTS * 3; i++) {
      if (i >= ARC_SKIP && (i - ARC_SKIP) % ARC_EVERY === 0) pts.push(pos.x, pos.y, pos.z);
      if (step(pos, vel, 1 / 60) && vel.y === 0) break;
    }
    // se caiu antes, repete o ultimo ponto para nao sobrar lixo do frame anterior
    while (pts.length < ARC_DOTS * 3) pts.push(pos.x, pos.y, pos.z);

    const attr = this.arc.geometry.getAttribute('position');
    attr.array.set(pts);
    attr.needsUpdate = true;
    this.arc.geometry.computeBoundingSphere();
    this.arc.material.opacity = forte ? 0.85 : 0.45;
    this.arc.material.size = forte ? 9 : 7;
    this.arc.visible = true;

    this.mark.position.set(pos.x, 0.05, pos.z);
    this.mark.material.opacity = forte ? 0.75 : 0.4;
    this.mark.visible = true;
  }

  hideArc() {
    this.arc.visible = false;
    this.mark.visible = false;
  }

  /* ---------------- granadas ---------------- */

  spawn(origin, velocity, ownerId, mine) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex, transparent: true, depthWrite: false,
    }));
    sprite.scale.set(0.26, 0.42, 1);
    sprite.position.copy(origin);
    this.scene.add(sprite);

    this.live.push({
      sprite,
      pos: origin.clone(),
      vel: velocity.clone(),
      fuse: FUSE,
      ownerId,
      mine,
    });
  }

  _explode(g) {
    this.scene.remove(g.sprite);
    g.sprite.material.dispose();

    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.puffTex, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    puff.position.copy(g.pos);
    puff.scale.setScalar(1);
    this.scene.add(puff);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.9, 40),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(g.pos.x, 0.06, g.pos.z);
    this.scene.add(ring);

    this.blasts.push({ puff, ring, life: 0.7, max: 0.7 });
    this.onExplode?.(g.pos.clone(), g);
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      const sub = Math.max(1, Math.ceil(dt / 0.012));
      for (let s = 0; s < sub; s++) step(g.pos, g.vel, dt / sub);
      g.sprite.position.copy(g.pos);
      g.sprite.material.rotation += dt * 6;

      g.fuse -= dt;
      if (g.fuse <= 0) {
        this._explode(g);
        this.live.splice(i, 1);
      }
    }

    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.life -= dt;
      const t = 1 - b.life / b.max;
      b.puff.scale.setScalar(1 + t * BLAST_RADIUS * 1.6);
      b.puff.material.opacity = Math.max(0, 0.95 * (1 - t));
      b.ring.scale.setScalar(1 + t * BLAST_RADIUS);
      b.ring.material.opacity = Math.max(0, 0.5 * (1 - t));
      if (b.life <= 0) {
        this.scene.remove(b.puff, b.ring);
        b.puff.material.dispose();
        b.ring.geometry.dispose();
        b.ring.material.dispose();
        this.blasts.splice(i, 1);
      }
    }
  }

  clear() {
    for (const g of this.live) { this.scene.remove(g.sprite); g.sprite.material.dispose(); }
    this.live.length = 0;
    this.hideArc();
  }
}
