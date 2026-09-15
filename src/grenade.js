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
// no campo o chao e 0; no predio do modo historia cada andar tem o seu
let alturaChao = () => 0;
export function definirChao(fn) { alturaChao = fn || (() => 0); }

function step(pos, vel, dt) {
  vel.y -= GRAVITY * dt;
  pos.addScaledVector(vel, dt);
  const chao = alturaChao(pos.x, pos.z, pos.y + 0.3) + 0.12;
  if (pos.y <= chao) {
    pos.y = chao;
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

    this.tex = new THREE.TextureLoader().load('itens/granada.png');
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.puffTex = TEX.puffTexture();

    // texturas da explosao
    this.smokeTex = [1, 2, 3, 4, 5].map((n) => TEX.smokeTexture(n));
    this.fireTex = TEX.fireTexture();
    this.sparkTex = TEX.sparkTexture();
    this.scorchTex = TEX.scorchTexture();

    // uma luz so, reaproveitada: colocar e tirar luz da cena obriga o three a
    // recompilar todos os materiais, e isso daria um engasgo em cada explosao
    this.luz = new THREE.PointLight(0xffa24a, 0, 22, 2);
    this.luz.position.set(0, -50, 0);
    scene.add(this.luz);
    this.clarao = 0;
    this.efeitos = [];

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

    this.mark.position.set(pos.x, pos.y - 0.07, pos.z);
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

  // cria um sprite solto da explosao
  _sprite(tex, pos, escala, cor = 0xffffff, opacidade = 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: cor, transparent: true, depthWrite: false, opacity: opacidade,
    }));
    sp.position.copy(pos);
    sp.scale.setScalar(escala);
    sp.material.rotation = Math.random() * Math.PI * 2;
    this.scene.add(sp);
    return sp;
  }

  // A explosao em camadas, cada uma no seu tempo: clarao, bola de fogo,
  // faiscas, onda de choque no chao, marca de queimado e a fumaca que fica.
  _explode(g) {
    this.scene.remove(g.sprite);
    g.sprite.material.dispose();

    const centro = g.pos.clone();
    const chao = alturaChao(centro.x, centro.z, centro.y + 0.3);
    centro.y = Math.max(centro.y, chao + 0.3);
    const r = (a, b) => a + Math.random() * (b - a);

    // clarao: ilumina o cenario em volta por um instante
    this.luz.position.set(centro.x, centro.y + 1.2, centro.z);
    this.clarao = 1;

    // bola de fogo: cresce rapido e apaga em meio segundo
    for (let i = 0; i < 9; i++) {
      const p = centro.clone().add(new THREE.Vector3(r(-0.7, 0.7), r(0, 0.9), r(-0.7, 0.7)));
      this.efeitos.push({
        tipo: 'fogo', sprite: this._sprite(this.fireTex, p, 0.5),
        s0: r(0.6, 1.2), s1: r(3.2, 5.2), vida: r(0.32, 0.6),
        vel: new THREE.Vector3(r(-1, 1), r(1.5, 3.5), r(-1, 1)),
      });
    }

    // fumaca: comeca escura e densa no miolo, se abre, sobe e clareia
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2;
      const forca = r(1.2, 5.5);
      const p = centro.clone().add(new THREE.Vector3(r(-0.5, 0.5), r(0, 0.8), r(-0.5, 0.5)));
      this.efeitos.push({
        tipo: 'fumaca',
        sprite: this._sprite(this.smokeTex[i % this.smokeTex.length], p, 1, 0x2a2a2a, 0),
        s0: r(0.9, 1.8), s1: r(3.5, 7.5), vida: r(3, 5.5), tom: r(-0.08, 0.08),
        vel: new THREE.Vector3(Math.cos(ang) * forca, r(1.2, 4), Math.sin(ang) * forca),
        giro: r(-0.35, 0.35), pico: r(0.55, 0.85), atraso: r(0, 0.18),
      });
    }

    // faiscas e estilhacos: voam longe, caem com gravidade e quicam
    for (let i = 0; i < 34; i++) {
      const ang = Math.random() * Math.PI * 2;
      const forca = r(6, 17);
      const quente = i < 22;
      this.efeitos.push({
        tipo: 'faisca', chao,
        sprite: this._sprite(this.sparkTex, centro, quente ? r(0.12, 0.26) : r(0.08, 0.14),
          quente ? 0xffffff : 0x333333),
        vida: r(0.5, 1.2),
        vel: new THREE.Vector3(Math.cos(ang) * forca, r(2, 10), Math.sin(ang) * forca),
      });
    }

    // onda de choque: anel de poeira rente ao chao
    const anel = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.25, 48),
      new THREE.MeshBasicMaterial({ color: 0x6d6a64, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    anel.rotation.x = -Math.PI / 2;
    anel.position.set(centro.x, chao + 0.08, centro.z);
    this.scene.add(anel);
    this.efeitos.push({ tipo: 'anel', mesh: anel, vida: 0.55 });

    // marca de queimado: fica no chao e some devagar
    const marca = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.scorchTex, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    marca.rotation.x = -Math.PI / 2;
    marca.rotation.z = Math.random() * Math.PI;
    marca.scale.setScalar(BLAST_RADIUS * 0.9);
    marca.position.set(centro.x, chao + 0.045, centro.z);
    this.scene.add(marca);
    this.efeitos.push({ tipo: 'marca', mesh: marca, vida: 16 });

    this.onExplode?.(g.pos.clone(), g);
  }

  _atualizarEfeitos(dt) {
    // o clarao some em um quarto de segundo
    if (this.clarao > 0) {
      this.clarao = Math.max(0, this.clarao - dt * 4);
      this.luz.intensity = 90 * this.clarao * this.clarao;
    }

    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const e = this.efeitos[i];
      e.max ??= e.vida;
      e.vida -= dt;
      const t = Math.min(1, 1 - e.vida / e.max);          // 0 -> 1 ao longo da vida
      const sp = e.sprite, m = sp?.material;

      switch (e.tipo) {
        case 'fogo': {
          const cresce = 1 - (1 - t) ** 3;
          sp.scale.setScalar(e.s0 + (e.s1 - e.s0) * cresce);
          sp.position.addScaledVector(e.vel, dt);
          m.opacity = (1 - t) ** 1.6;
          // do branco quente para laranja e depois brasa
          m.color.setRGB(1, 1 - t * 0.45, 1 - t * 0.9);
          break;
        }
        case 'fumaca': {
          if (e.atraso > 0) { e.atraso -= dt; e.vida += dt; break; }
          e.vel.multiplyScalar(Math.max(0, 1 - dt * 1.8));  // o ar segura a fumaca
          e.vel.y += dt * 0.35;                              // e ela sobe
          sp.position.addScaledVector(e.vel, dt);
          const abre = 1 - (1 - t) ** 2.2;
          sp.scale.setScalar(e.s0 + (e.s1 - e.s0) * abre);
          m.rotation += e.giro * dt;
          // aparece rapido, some devagar
          m.opacity = Math.min(1, t * 8) * (1 - t) ** 1.4 * e.pico;
          // fuligem escura no comeco, cinza claro no fim
          const cinza = Math.min(1, 0.22 + t * 0.6 + e.tom);
          m.color.setRGB(cinza, cinza, cinza * 0.97);
          break;
        }
        case 'faisca': {
          e.vel.y -= GRAVITY * dt;
          sp.position.addScaledVector(e.vel, dt);
          if (sp.position.y < e.chao + 0.05) {
            sp.position.y = e.chao + 0.05;
            e.vel.y = Math.abs(e.vel.y) * 0.25;
            e.vel.x *= 0.4; e.vel.z *= 0.4;
          }
          m.opacity = 1 - t * t;
          break;
        }
        case 'anel': {
          e.mesh.scale.setScalar(1 + (1 - (1 - t) ** 2) * BLAST_RADIUS * 1.3);
          e.mesh.material.opacity = 0.55 * (1 - t);
          break;
        }
        case 'marca': {
          e.mesh.material.opacity = 0.85 * Math.min(1, (1 - t) * 3);
          break;
        }
      }

      if (e.vida <= 0) {
        const obj = sp || e.mesh;
        this.scene.remove(obj);
        obj.material.dispose();
        if (e.mesh) e.mesh.geometry.dispose();
        this.efeitos.splice(i, 1);
      }
    }
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

    this._atualizarEfeitos(dt);
  }

  clear() {
    for (const g of this.live) { this.scene.remove(g.sprite); g.sprite.material.dispose(); }
    this.live.length = 0;
    for (const e of this.efeitos) {
      const obj = e.sprite || e.mesh;
      this.scene.remove(obj);
      obj.material.dispose();
      if (e.mesh) e.mesh.geometry.dispose();
    }
    this.efeitos.length = 0;
    this.clarao = 0;
    this.luz.intensity = 0;
    this.hideArc();
  }
}
