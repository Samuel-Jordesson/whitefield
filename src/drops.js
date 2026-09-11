import * as THREE from 'three';
import * as TEX from './textures.js';
import { TUDO, EH_ARMA } from './loot.js';

// Itens largados no chao. Ficam flutuando e girando, e ganham volume por
// empilhamento: varias copias do mesmo PNG separadas em profundidade, as de
// tras mais escuras — de lado da para ver a "espessura" do desenho.

const CAMADAS = 14;         // mais camadas = lateral menos listrada
const ESPESSURA = 0.13;     // espessura TOTAL do objeto, em metros
const ALTURA_ITEM = 0.46;   // altura do desenho para granada/cura
const ALTURA_ARMA = 0.72;
const FLUTUA = 0.85;        // altura media, acima da grama
const ALCANCE = 2.6;        // distancia para conseguir pegar

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

const cacheTex = new Map();
function textura(kind) {
  if (!cacheTex.has(kind)) {
    const t = new THREE.TextureLoader().load(TUDO[kind].img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cacheTex.set(kind, t);
  }
  return cacheTex.get(kind);
}

export class DropManager {
  constructor(scene, { onPick }) {
    this.scene = scene;
    this.onPick = onPick;
    this.drops = new Map();
    this.focused = null;
    this.shadowTex = TEX.blobShadowTexture();
    this.prompt = document.getElementById('dropPrompt');
    this.time = 0;
  }

  // Monta o "objeto": copias do PNG empilhadas dando espessura.
  _build(kind) {
    const grupo = new THREE.Group();
    const tex = textura(kind);
    const alt = EH_ARMA(kind) ? ALTURA_ARMA : ALTURA_ITEM;
    const larg = alt;   // a proporcao real chega quando a textura carrega

    for (let i = 0; i < CAMADAS; i++) {
      const t = i / (CAMADAS - 1);
      const frente = i === CAMADAS - 1;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        // as copias de tras vao escurecendo: e isso que vira "profundidade"
        color: new THREE.Color().setScalar(frente ? 1 : 0.62 + t * 0.32),
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), mat);
      m.position.z = (t - 0.5) * ESPESSURA;
      grupo.add(m);
    }

    // corrige a proporcao assim que a imagem estiver carregada
    const ajusta = () => {
      const img = tex.image;
      if (!img?.width) return;
      const escala = img.width / img.height;
      for (const m of grupo.children) m.scale.x = escala;
    };
    if (tex.image?.width) ajusta();
    else tex.addEventListener?.('update', ajusta);
    setTimeout(ajusta, 300);

    return grupo;
  }

  spawn(info) {
    if (this.drops.has(info.id)) return;
    const grupo = this._build(info.kind);
    grupo.position.set(info.x, FLUTUA, info.z);
    this.scene.add(grupo);

    const sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({
        map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.4,
      })
    );
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.set(info.x, 0.03, info.z);
    this.scene.add(sombra);

    this.drops.set(info.id, {
      ...info, grupo, sombra,
      fase: Math.random() * Math.PI * 2,
    });
  }

  remove(id) {
    const d = this.drops.get(id);
    if (!d) return;
    this.scene.remove(d.grupo, d.sombra);
    for (const m of d.grupo.children) { m.geometry.dispose(); m.material.dispose(); }
    d.sombra.geometry.dispose();
    d.sombra.material.dispose();
    this.drops.delete(id);
    if (this.focused === d) this.focused = null;
  }

  clear() {
    for (const id of [...this.drops.keys()]) this.remove(id);
    this.prompt.classList.add('hidden');
  }

  sync(lista) {
    const vistos = new Set();
    for (const info of lista || []) { vistos.add(info.id); this.spawn(info); }
    for (const id of [...this.drops.keys()]) if (!vistos.has(id)) this.remove(id);
  }

  // o item mais proximo dentro do alcance, olhando mais ou menos para ele
  _maisProximo(camera) {
    camera.getWorldDirection(_dir);
    let melhor = null, melhorDist = Infinity;
    for (const d of this.drops.values()) {
      _to.set(d.grupo.position.x - camera.position.x, 0, d.grupo.position.z - camera.position.z);
      const dist = _to.length();
      if (dist > ALCANCE || dist > melhorDist) continue;
      _to.normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, _to.x * _dir.x + _to.z * _dir.z)));
      if (ang < 1.1) { melhor = d; melhorDist = dist; }
    }
    return melhor;
  }

  update(dt, camera, ativo = true) {
    this.time += dt;

    for (const d of this.drops.values()) {
      d.grupo.rotation.y += dt * 1.5;                       // girando
      d.grupo.position.y = FLUTUA + Math.sin(this.time * 2 + d.fase) * 0.1;   // flutuando
      d.sombra.material.opacity = 0.42 - (d.grupo.position.y - FLUTUA) * 0.5;
    }

    const alvo = ativo ? this._maisProximo(camera) : null;
    this.focused = alvo;
    this.prompt.classList.toggle('hidden', !alvo);
    if (alvo) {
      this.prompt.innerHTML = `<b>E</b> pegar <span>${TUDO[alvo.kind].name}</span>`;
    }
  }

  // tenta pegar o item que esta em foco
  take() {
    if (!this.focused) return null;
    const d = this.focused;
    this.onPick?.(d.id, d.kind);
    return d;
  }
}
