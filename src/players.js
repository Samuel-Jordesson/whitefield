import * as THREE from 'three';
import * as TEX from './textures.js';
import { Billboard, makeBlobShadow } from './billboard.js';

const HEIGHT = 1.85;         // altura do personagem em metros
const LERP = 12;             // suavizacao da posicao que chega pela rede

export const CHARACTERS = {
  1: { name: 'Personagem 1', dir: 'perssonagem1/' },
  2: { name: 'Personagem 2', dir: 'perssonagem2/' },
};

// Carrega parado.png e mirando.png dos dois personagens. A pose "parado"
// define a altura; a de mira mantem a proporcao original do desenho.
export async function loadCharacters() {
  const out = {};
  for (const [id, info] of Object.entries(CHARACTERS)) {
    const [idle, aim] = await Promise.all([
      TEX.loadTrimmedTexture(info.dir + 'parado.png'),
      TEX.loadTrimmedTexture(info.dir + 'mirando.png'),
    ]);
    const scale = HEIGHT / idle.height;
    out[id] = {
      name: info.name,
      idle: { texture: idle.texture, w: idle.width * scale, h: idle.height * scale },
      aim: { texture: aim.texture, w: aim.width * scale, h: aim.height * scale },
    };
  }
  return out;
}

// Um adversario na partida: sprite 2D que encara a camera, troca entre
// parado/mirando e interpola a posicao que chega do servidor.
// etiqueta com o nome do aliado, desenhada em canvas
function tagSprite(nome) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 72;
  const ctx = c.getContext('2d');
  ctx.font = '600 30px "Betania Patmos", "Comic Sans MS", cursive, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // seta apontando para baixo + nome
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(128, 68); ctx.lineTo(112, 44); ctx.lineTo(144, 44); ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#111';
  ctx.fillText(nome.slice(0, 14), 128, 22);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: t, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
  }));
  sp.scale.set(1.5, 0.42, 1);
  sp.renderOrder = 4;
  return sp;
}

class RemotePlayer {
  constructor(scene, info, characters, shadowTex, aliado = false) {
    this.id = info.id;
    this.name = info.name;
    this.team = info.team || 'A';
    this.aliado = aliado;
    this.chars = characters;
    this.character = String(info.character || 1);
    this.alive = true;
    this.aiming = false;
    this.health = info.health ?? 100;

    const pose = this.chars[this.character].idle;
    this.mesh = new Billboard(pose.texture, pose.w, pose.h, { doubleSide: true });
    // um pouco de luz propria: o desenho e so contorno, entao no contraluz
    // ele viraria uma silhueta cinza e ninguem enxergaria o personagem
    this.mesh.material.emissive = new THREE.Color(0x6a6a6a);
    this.mesh.position.set(info.x || 0, 0, info.z || 0);
    this.mesh.userData.player = this;
    scene.add(this.mesh);

    this.shadow = makeBlobShadow(shadowTex, pose.w * 1.4);
    this.shadow.position.set(this.mesh.position.x, 0.03, this.mesh.position.z);
    scene.add(this.shadow);

    // aliado ganha uma plaquinha com o nome, para nao levar tiro de amigo
    this.tag = aliado ? tagSprite(this.name) : null;
    if (this.tag) scene.add(this.tag);

    this.target = this.mesh.position.clone();
    this.hitFlash = 0;
    this.deathTime = -1;
    this.pose = 'idle';
    this.scene = scene;
  }

  setCharacter(id) {
    const key = String(id || 1);
    if (!this.chars[key]) return;
    this.character = key;
    this.pose = null;          // forca o refresh da textura
  }

  applyState(msg) {
    if (!this.alive) return;          // cadaver nao anda
    this.target.set(msg.x, Math.max(0, msg.y || 0), msg.z);
    this.aiming = !!msg.aiming;
  }

  setPose(name) {
    if (this.pose === name) return;
    this.pose = name;
    const pose = this.chars[this.character][name];
    this.mesh.material.map = pose.texture;
    this.mesh.setSize(pose.w, pose.h);
  }

  hurt() { this.hitFlash = 0.12; }

  setDestaque(on) {
    this.destaque = on;
    const m = this.mesh.material;
    m.depthTest = !on;                 // aparece por cima das paredes
    m.emissive.setHex(on ? 0xcc1111 : 0x6a6a6a);
    m.color.setHex(on ? 0xff5a5a : 0xffffff);
    m.needsUpdate = true;
    this.mesh.renderOrder = on ? 5 : 0;
  }

  die() {
    this.alive = false;
    this.deathTime = 0;
    this.mesh.castShadow = false;
    this.mesh.material.transparent = true;
  }

  respawn(x, z) {
    this.alive = true;
    this.deathTime = -1;
    this.health = 100;
    this.mesh.castShadow = true;
    this.mesh.material.transparent = false;
    this.mesh.material.opacity = 1;
    this.mesh.rotation.z = 0;
    this.mesh.position.set(x, 0, z);
    this.target.set(x, 0, z);
    this.shadow.material.opacity = 0.55;
  }

  update(dt, camera) {
    const m = this.mesh;
    m.faceCamera(camera);
    this.setPose(this.aiming ? 'aim' : 'idle');

    if (this.tag) {
      this.tag.position.set(m.position.x, m.position.y + this.mesh.spriteHeight + 0.45, m.position.z);
      this.tag.visible = this.alive;
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (!this.destaque) m.material.color.setHex(this.hitFlash > 0 ? 0xff7070 : 0xffffff);
    }

    if (!this.alive) {
      this.deathTime += dt;
      const t = Math.min(1, this.deathTime / 0.8);
      m.rotation.z = t * 1.4;
      m.material.opacity = 1 - t * 0.85;
      this.shadow.material.opacity = 0.55 * (1 - t);
      return;
    }

    const k = Math.min(1, dt * LERP);
    m.position.x += (this.target.x - m.position.x) * k;
    m.position.y += (this.target.y - m.position.y) * k;
    m.position.z += (this.target.z - m.position.z) * k;

    this.shadow.position.set(m.position.x, 0.03, m.position.z);
    this.shadow.material.opacity = 0.5 * Math.max(0.25, 1 - m.position.y * 2);
  }

  dispose() {
    if (this.tag) {
      this.scene.remove(this.tag);
      this.tag.material.map.dispose();
      this.tag.material.dispose();
    }
    this.scene.remove(this.mesh, this.shadow);
    this.mesh.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

// Cuida de todos os adversarios da partida.
export class PlayerManager {
  constructor(scene, characters) {
    this.scene = scene;
    this.characters = characters;
    this.shadowTex = TEX.blobShadowTexture();
    this.puffTex = TEX.puffTexture();
    this.players = new Map();
    this.puffs = [];
    this.myTeam = 'A';
  }

  get list() { return [...this.players.values()]; }

  // efeito do cigarro: inimigo em vermelho e visivel atraves do cenario
  verTodos(on) {
    this.vendoTodos = on;
    for (const p of this.players.values()) p.setDestaque(on && !p.aliado);
  }
  get hittables() { return this.list.filter((p) => p.alive).map((p) => p.mesh); }

  sync(infos, myId) {
    const seen = new Set();
    for (const info of infos) {
      if (info.id === myId) continue;
      seen.add(info.id);
      const aliado = (info.team || 'A') === this.myTeam;
      const existing = this.players.get(info.id);
      if (existing && existing.aliado === aliado) {
        existing.name = info.name;
        existing.setCharacter(info.character);
      } else {
        // trocou de time: refaz para ganhar (ou perder) a etiqueta
        if (existing) { existing.dispose(); this.players.delete(info.id); }
        const novo = new RemotePlayer(this.scene, info, this.characters, this.shadowTex, aliado);
        if (this.vendoTodos && !aliado) novo.setDestaque(true);
        this.players.set(info.id, novo);
      }
    }
    for (const [id, p] of this.players) {
      if (!seen.has(id)) { p.dispose(); this.players.delete(id); }
    }
  }

  remove(id) {
    const p = this.players.get(id);
    if (p) { p.dispose(); this.players.delete(id); }
  }

  clear() {
    for (const p of this.players.values()) p.dispose();
    this.players.clear();
  }

  get(id) { return this.players.get(id); }

  puff(point) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.puffTex, transparent: true, depthWrite: false, opacity: 0.9,
    }));
    s.position.copy(point);
    s.scale.setScalar(0.35);
    this.scene.add(s);
    this.puffs.push({ sprite: s, life: 0.45, max: 0.45 });
  }

  update(dt, camera) {
    for (const p of this.players.values()) p.update(dt, camera);

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      const t = 1 - p.life / p.max;
      p.sprite.scale.setScalar(0.35 + t * 0.9);
      p.sprite.material.opacity = Math.max(0, 0.9 * (1 - t));
      p.sprite.position.y += dt * 0.5;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        this.puffs.splice(i, 1);
      }
    }
  }
}
