import * as THREE from 'three';
import * as TEX from './textures.js';
import { Billboard, makeBlobShadow } from './billboard.js';
import { WEAPON_ITEMS } from './weapons.js';
import { LOADOUT_INICIAL } from './mapgen.js';
import { rotulo, texto } from './glifos.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();
const _tela = new THREE.Vector3();

// caixote 3D: corpo retangular + tampa com dobradica atras
const CAIXA = { w: 1.15, h: 0.52, d: 0.72, tampa: 0.1 };
const TAMPA_ABERTA = -1.95;  // radianos: caixa vazia fica com a tampa aberta
const TRACO = new THREE.LineBasicMaterial({ color: 0x141414 });
const semRaio = () => {};
const TOMB_HEIGHT = 1.15;    // altura da lapide
const REACH = 4.0;           // distancia para conseguir abrir
export const SLOTS = 9;      // espacos da mochila
export const MAX_HEAL = 100;

// campos de arma: duas armas de fogo e um so para a faca
export const CAMPOS_ARMA = [0, 1];
export const CAMPO_FACA = 2;

export const ITEMS = {
  granada: { name: 'Granada', img: 'itens/granada.png' },
  vida: { name: 'Curativo', img: 'itens/vida.png', heal: 35 },
  cigarro: {
    name: 'Cigarro', img: 'itens/cigarro.png', raro: true,
    correr: 10,     // segundos correndo mais rapido
    visao: 5,       // segundos enxergando os inimigos pelo mapa
  },
  colete: { name: 'Colete', img: 'itens/colete.svg' },
};

// item da mochila -> [acao (vira botao do controle), tecla do teclado]
const TECLA = {
  granada: ['KeyG', 'G'], vida: ['KeyQ', 'Q'], cigarro: ['KeyC', 'C'], colete: ['KeyV', 'V'],
};

// tudo que pode ser carregado: itens da mochila + as armas
export const TUDO = { ...ITEMS, ...WEAPON_ITEMS };
export const EH_ARMA = (kind) => kind in WEAPON_ITEMS;

export async function loadLootTextures() {
  // a lapide escreve RIP com a fonte do jogo: espera ela carregar antes de desenhar
  try { await document.fonts.load('700 104px "Betania Patmos"'); } catch { /* usa a reserva */ }
  const tombW = TOMB_HEIGHT * (384 / 512);
  return {
    caixote: TEX.caixoteLootTextures(),
    tombIdle: { texture: TEX.tombstoneTexture(false), w: tombW, h: TOMB_HEIGHT },
    tombFocus: { texture: TEX.tombstoneTexture(true), w: tombW, h: TOMB_HEIGHT },
  };
}

// Caixas espalhadas pelo mapa, lapides de quem morreu, a mochila do jogador e
// a tela de saque. Caixa e lapide funcionam igual: um monte de itens no chao
// que qualquer um pode abrir com E.
export class LootManager {
  constructor(scene, textures, { onTake, onLockChange, onDrop, onWeaponsChange, world }) {
    this.scene = scene;
    this.world = world;                       // o caixote 3D tambem barra quem anda
    this.tex = textures;
    this.onTake = onTake;                     // avisa o servidor que pegou um item
    this.onLockChange = onLockChange;         // trava/destrava o mouse ao abrir a tela
    this.onDrop = onDrop;                     // jogou algo fora: vira item no chao
    this.onWeaponsChange = onWeaponsChange;   // mudou a arma de algum slot
    this.shadowTex = TEX.blobShadowTexture();

    this.boxes = new Map();                   // caixas (id numerico) e lapides (id "t…")
    this.focused = null;
    this.openBox = null;
    this.slots = new Array(SLOTS).fill(null);
    this.weapons = [...LOADOUT_INICIAL];      // [arma 1, arma 2, faca]

    this.el = {
      prompt: document.getElementById('lootPrompt'),
      panel: document.getElementById('lootPanel'),
      boxCol: document.getElementById('boxCol'),
      boxTitle: document.querySelector('#boxCol h3'),
      boxGrid: document.getElementById('boxGrid'),
      bagGrid: document.getElementById('bagGrid'),
      gunGrid: document.getElementById('gunGrid'),
      trash: document.getElementById('trash'),
      bagHud: document.getElementById('bagHud'),
      gunHud: document.getElementById('gunHud'),
      drag: document.getElementById('dragGhost'),
    };

    this.drag = null;
    this._bindDrag();
    this.renderHud();
  }

  /* ---------------- caixas e lapides no mundo ---------------- */

  spawn(list, tombs = []) {
    this.clear();
    for (const info of list) this._criar(info, false);
    for (const info of tombs) this._criar(info, true);
  }

  // lapide nova: alguem acabou de morrer
  addTomb(info) {
    if (this.boxes.has(info.id)) return;
    this._criar(info, true);
  }

  removeTomb(id) {
    const b = this.boxes.get(id);
    if (!b) return;
    if (this.openBox === b) this.close();
    if (this.focused === b) this.focused = null;
    this._destruir(b);
    this.boxes.delete(id);
  }

  _criar(info, tumba) {
    if (!tumba) { this._criarCaixote(info); return; }
    const pose = this.tex.tombIdle;
    const mesh = new Billboard(pose.texture, pose.w, pose.h, { doubleSide: true });
    mesh.material.emissive = new THREE.Color(0x707070);
    mesh.position.set(info.x, info.y || 0, info.z);
    mesh.userData.box = info.id;
    this.scene.add(mesh);

    const shadow = makeBlobShadow(this.shadowTex, pose.w * 1.2);
    shadow.position.set(info.x, (info.y || 0) + 0.03, info.z);
    this.scene.add(shadow);

    this.boxes.set(info.id, { ...info, items: [...info.items], tumba, mesh, shadow, focus: false });
  }

  // Caixote retangular em 3D: corpo com as texturas desenhadas, tampa numa
  // dobradica (abre sozinha quando a caixa fica vazia), contorno a traco e
  // uma casca preta por tras que engrossa quando a caixa esta na mira.
  _criarCaixote(info) {
    const t = this.tex.caixote;
    const { w, h, d, tampa: esp } = CAIXA;
    const y = info.y || 0;

    const grupo = new THREE.Group();
    grupo.position.set(info.x, y, info.z);
    // cada caixa virada para um lado, sempre igual para todo mundo
    const giro = typeof info.id === 'number' ? (Math.sin(info.id * 127.1 + 311.7) * 43758.5453) % 1 : 0.3;
    grupo.rotation.y = Math.abs(giro) * Math.PI;

    const madeira = (map) => new THREE.MeshLambertMaterial({ map, emissive: new THREE.Color(0x4a4a4a) });
    const mats = {
      lado: madeira(t.lado), ponta: madeira(t.ponta), tampa: madeira(t.tampa),
      liso: new THREE.MeshLambertMaterial({ color: 0xefece4, emissive: new THREE.Color(0x4a4a4a) }),
      dentro: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
    };
    const casca = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });

    // faces do BoxGeometry: +x, -x, +y, -y, +z, -z
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [mats.ponta, mats.ponta, mats.dentro, mats.dentro, mats.lado, mats.lado]);
    corpo.position.y = h / 2;

    const dobra = new THREE.Group();
    dobra.position.set(0, h, -d / 2);
    const tampa = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, esp, d + 0.04),
      [mats.liso, mats.liso, mats.tampa, mats.ponta, mats.liso, mats.liso]);   // por baixo tambem e tabua
    tampa.position.set(0, esp / 2, d / 2);
    dobra.add(tampa);
    dobra.rotation.x = info.items.length ? 0 : TAMPA_ABERTA;
    grupo.add(corpo, dobra);

    const cascas = [];
    for (const m of [corpo, tampa]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.box = info.id;
      const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), TRACO);
      linhas.raycast = semRaio;
      m.add(linhas);
      const c = new THREE.Mesh(m.geometry, casca);
      c.scale.setScalar(1.035);
      c.raycast = semRaio;
      m.add(c);
      cascas.push(c);
    }
    this.scene.add(grupo);

    const shadow = makeBlobShadow(this.shadowTex, w * 1.5);
    shadow.position.set(info.x, y + 0.03, info.z);
    this.scene.add(shadow);

    // barreira do tamanho do caixote, girada junto
    const colisor = { x: info.x, z: info.z, hw: w / 2, hd: d / 2, rot: grupo.rotation.y, y0: y, y1: y + h + esp };
    this.world?.boxColliders.push(colisor);

    this.boxes.set(info.id, {
      ...info, items: [...info.items], tumba: false, mesh: grupo, shadow, focus: false,
      tres: { mats, casca, cascas, dobra, colisor },
    });
  }

  _destruir(b) {
    this.scene.remove(b.mesh, b.shadow);
    b.shadow.geometry.dispose();
    b.shadow.material.dispose();
    if (b.tres) {
      const lista = this.world?.boxColliders;
      const i = lista ? lista.indexOf(b.tres.colisor) : -1;
      if (i >= 0) lista.splice(i, 1);
      b.mesh.traverse((o) => { if (o.geometry && o !== b.shadow) o.geometry.dispose(); });
      for (const m of Object.values(b.tres.mats)) m.dispose();
      b.tres.casca.dispose();
      return;
    }
    b.mesh.material.dispose();
  }

  clear() {
    for (const b of this.boxes.values()) this._destruir(b);
    this.boxes.clear();
    this.focused = null;
    this.close();
  }

  get meshes() { return [...this.boxes.values()].map((b) => b.mesh); }

  // Destaca a caixa (ou lapide) que esta perto e sob a mira.
  // Vale o raio do centro da tela e tambem um cone curto — a caixa e baixa,
  // e seria chato ter que encaixar a mirinha exatamente nela.
  update(dt, camera, hit, active = true) {
    for (const b of this.boxes.values()) {
      if (b.tumba) { b.mesh.faceCamera(camera); continue; }
      // tampa abre quando levaram tudo (e fecha se voltar item, no checkpoint)
      const alvo = b.items.length ? 0 : TAMPA_ABERTA;
      const dobra = b.tres.dobra;
      dobra.rotation.x += (alvo - dobra.rotation.x) * Math.min(1, dt * 5);
    }

    let target = null;
    if (active) {
      if (hit && hit.object.userData.box !== undefined && hit.distance <= REACH) {
        target = this.boxes.get(hit.object.userData.box) || null;
      } else {
        target = this._boxInCone(camera);
      }
    }

    if (target !== this.focused) {
      if (this.focused) this._setFocus(this.focused, false);
      this.focused = target;
      if (target) this._setFocus(target, true);
    }

    const showPrompt = !!target && !this.aberto && this._posicionarPrompt(target, camera);
    this.el.prompt.classList.toggle('hidden', !showPrompt);
    if (showPrompt) {
      const t = texto('KeyE', 'E');
      if (this.el.prompt.textContent !== t) this.el.prompt.textContent = t;
    }
  }

  // Poe o "E" logo acima da caixa (ou da lapide) na tela. Devolve false se o
  // ponto ficou atras da camera, ai nem mostra.
  _posicionarPrompt(box, camera) {
    const alto = box.tumba ? TOMB_HEIGHT + 0.22 : CAIXA.h + CAIXA.tampa + 0.3;
    _tela.set(box.mesh.position.x, box.mesh.position.y + alto, box.mesh.position.z).project(camera);
    if (_tela.z > 1) return false;
    this.el.prompt.style.left = `${(_tela.x * 0.5 + 0.5) * window.innerWidth}px`;
    this.el.prompt.style.top = `${(-_tela.y * 0.5 + 0.5) * window.innerHeight}px`;
    return true;
  }

  // caixa mais proxima dentro do cone de visao
  _boxInCone(camera, maxDist = 3.0, maxAngle = 0.5) {
    camera.getWorldDirection(_dir);
    let best = null, bestDist = Infinity;
    for (const b of this.boxes.values()) {
      if (Math.abs(camera.position.y - 1.2 - b.mesh.position.y) > 1.6) continue;   // outro andar
      _to.set(b.mesh.position.x - camera.position.x, 0, b.mesh.position.z - camera.position.z);
      const dist = _to.length();
      if (dist > maxDist || dist > bestDist) continue;
      _to.normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, _to.x * _dir.x + _to.z * _dir.z)));
      if (ang <= maxAngle) { best = b; bestDist = dist; }
    }
    return best;
  }

  _setFocus(box, on) {
    box.focus = on;
    if (!box.tumba) {
      // na mira: a madeira clareia e o contorno de fora engrossa
      for (const m of Object.values(box.tres.mats)) if (m.emissive) m.emissive.setHex(on ? 0x8c8c8c : 0x4a4a4a);
      for (const c of box.tres.cascas) c.scale.setScalar(on ? 1.07 : 1.035);
      return;
    }
    const pose = on ? this.tex.tombFocus : this.tex.tombIdle;
    box.mesh.material.map = pose.texture;
    box.mesh.setSize(pose.w, pose.h);
    box.focus = on;
  }

  /* ---------------- mochila ---------------- */

  count(kind) { return this.slots.filter((s) => s === kind).length; }
  has(kind) { return this.slots.includes(kind); }

  addToBag(kind) {
    const i = this.slots.indexOf(null);
    if (i < 0) return false;
    this.slots[i] = kind;
    this._refresh();
    return true;
  }

  consume(kind) {
    const i = this.slots.indexOf(kind);
    if (i < 0) return false;
    this.slots[i] = null;
    this._refresh();
    return true;
  }

  // nasce com o que o operador tem no EQUIPAR (vazio = morto, esperando renascer)
  resetBag(vazio = false) {
    this.slots.fill(null);
    this.weapons = vazio ? [null, null, null] : [...(this.cargaInicial?.() || LOADOUT_INICIAL)];
    this._refresh();
    this.onWeaponsChange?.();
  }

  // troca tudo de uma vez (modo historia: comeco da fase e volta do checkpoint)
  definirCarga(armas, mochila) {
    if (armas) this.weapons = [...armas];
    if (mochila) {
      this.slots.fill(null);
      mochila.slice(0, SLOTS).forEach((k, i) => { this.slots[i] = k || null; });
    }
    this._refresh();
    this.onWeaponsChange?.();
  }

  // tudo que esta com voce, para virar o conteudo da lapide
  tudoQueCarrega() {
    return [...this.weapons, ...this.slots].filter(Boolean);
  }

  // qualquer mudanca no que se carrega redesenha o HUD e, se estiver aberto,
  // o painel — senao o item so aparecia na proxima vez que algo mudasse
  _refresh() {
    this.renderHud();
    this.renderPanel();
  }

  /* ---------------- slots de arma ---------------- */

  weaponAt(i) { return this.weapons[i] || null; }
  hasWeapon(kind) { return this.weapons.includes(kind); }

  setWeapon(i, kind) {
    this.weapons[i] = kind;
    this._refresh();
    this.onWeaponsChange?.();
  }

  // em qual campo esta arma entraria (a faca so tem um lugar)
  campoPara(kind, preferido = 0) {
    if (kind === 'faca') return CAMPO_FACA;
    const livre = CAMPOS_ARMA.find((i) => !this.weapons[i]);
    if (livre !== undefined) return livre;
    return CAMPOS_ARMA.includes(preferido) ? preferido : CAMPOS_ARMA[0];
  }

  // guarda a arma no campo certo; se estiver ocupado, devolve a que saiu
  pickWeapon(kind, preferido = 0) {
    const i = this.campoPara(kind, preferido);
    const antiga = this.weapons[i];
    this.setWeapon(i, kind);
    return { slot: i, trocada: antiga };
  }

  // tira do inventario e devolve o que saiu (para virar item no chao)
  dropFromBag(index) {
    const kind = this.slots[index];
    if (!kind) return null;
    this.slots[index] = null;
    this._refresh();
    this.onDrop?.(kind);
    return kind;
  }

  dropWeapon(i) {
    const kind = this.weapons[i];
    if (!kind) return null;
    this.setWeapon(i, null);
    this.onDrop?.(kind);
    return kind;
  }

  renderHud() {
    // item que voce nao tem nem aparece no HUD
    this.el.bagHud.innerHTML = Object.entries(ITEMS).map(([kind, info]) => {
      const n = this.count(kind);
      if (!n) return '';
      const [acao, tecla] = TECLA[kind] || ['', ''];
      return `<div class="bag-item ${info.raro ? 'raro' : ''}">
        <img src="${info.img}" alt="${info.name}"><span>${n}</span>
        ${rotulo(acao, tecla)}
      </div>`;
    }).join('');

    if (this.el.gunHud) {
      this.el.gunHud.innerHTML = this.weapons.map((kind, i) => `
        <div class="gun-slot ${kind ? '' : 'empty'}">
          <b>${i + 1}</b>
          ${kind ? `<img src="${TUDO[kind].img}" alt="${TUDO[kind].name}">` : '<span>vazio</span>'}
        </div>`).join('');
    }
  }

  /* ---------------- tela de saque ---------------- */

  get aberto() { return !this.el.panel.classList.contains('hidden'); }

  toggle() {
    if (this.aberto) this.close();
    else if (this.focused) this.open(this.focused);
  }

  // abre so a mochila (sem caixa), para trocar de arma ou jogar coisa fora
  toggleBag() {
    if (this.aberto) this.close();
    else this.open(null);
  }

  open(box) {
    this.openBox = box;
    this.el.panel.classList.remove('hidden');
    this.el.boxCol.classList.toggle('hidden', !box);
    this.el.boxCol.classList.toggle('tumba', !!box?.tumba);
    if (box && this.el.boxTitle) {
      this.el.boxTitle.innerHTML = box.tumba
        ? `RIP <small>${escapeHtml(box.name || '???')}</small>`
        : 'CAIXA';
    }
    this.el.prompt.classList.add('hidden');
    this.renderPanel();
    this.onLockChange?.(false);
  }

  close() {
    if (!this.aberto) return;
    this.openBox = null;
    this.el.panel.classList.add('hidden');
    this.onLockChange?.(true);
  }

  // chega do servidor: alguem tirou um item desta caixa
  removeItem(boxId, index) {
    const box = this.boxes.get(boxId);
    if (!box) return null;
    const [kind] = box.items.splice(index, 1);
    if (this.openBox === box) this.renderPanel();
    return kind;
  }

  _slotHtml(kind, from, i, extra = '') {
    if (!kind) return `<div class="slot ${extra}" data-from="${from}" data-index="${i}"></div>`;
    const info = TUDO[kind];
    return `<div class="slot filled ${extra}" data-from="${from}" data-index="${i}" data-kind="${kind}">
      <img src="${info.img}" alt="${info.name}" draggable="false">
      <span>${info.name}</span>
    </div>`;
  }

  renderPanel() {
    if (!this.aberto) return;
    const box = this.openBox;

    if (box) {
      this.el.boxGrid.innerHTML = box.items.length
        ? box.items.map((kind, i) => this._slotHtml(kind, 'box', i)).join('')
        : `<p class="empty-msg">${box.tumba ? 'ja levaram tudo' : 'caixa vazia'}</p>`;
    }

    this.el.bagGrid.innerHTML = this.slots
      .map((kind, i) => this._slotHtml(kind, 'bag', i)).join('');

    this.el.gunGrid.innerHTML = this.weapons
      .map((kind, i) => this._slotHtml(kind, 'gun', i, i === CAMPO_FACA ? 'gun faca' : 'gun')
        .replace('<div class="slot', `<div data-label="${i === CAMPO_FACA ? 'FACA' : 'ARMA ' + (i + 1)}" class="slot`)).join('');
  }

  _bindDrag() {
    const ghost = this.el.drag;

    const start = (e) => {
      const slot = e.target.closest('.slot.filled');
      if (!slot || !this.aberto) return;
      e.preventDefault();
      this.drag = {
        from: slot.dataset.from,
        index: Number(slot.dataset.index),
        kind: slot.dataset.kind,
        x0: e.clientX, y0: e.clientY, andou: 0,
      };
      ghost.innerHTML = `<img src="${TUDO[this.drag.kind].img}" alt="">`;
      ghost.classList.remove('hidden');
      move(e);
      slot.classList.add('dragging');
    };

    const move = (e) => {
      if (!this.drag) return;
      this.drag.andou = Math.max(this.drag.andou, Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0));
      ghost.style.transform = `translate(${e.clientX - 34}px, ${e.clientY - 34}px)`;
      const over = this._areaSob(e);
      this.el.bagGrid.classList.toggle('drop', over === this.el.bagGrid && this._podeIr('bag'));
      this.el.gunGrid.classList.toggle('drop', over === this.el.gunGrid && this._podeIr('gun'));
      this.el.trash.classList.toggle('drop', over === this.el.trash);
    };

    const end = (e) => {
      if (!this.drag) return;
      const d = this.drag;
      this.drag = null;
      ghost.classList.add('hidden');
      this.el.bagGrid.classList.remove('drop');
      this.el.gunGrid.classList.remove('drop');
      this.el.trash.classList.remove('drop');
      for (const s of document.querySelectorAll('.slot.dragging')) s.classList.remove('dragging');

      // no celular, tocar num item da caixa (sem arrastar) ja pega
      if (d.from === 'box' && d.andou < 10 && document.body.classList.contains('toque')) {
        EH_ARMA(d.kind) ? this.takeWeapon(d.index, this.campoPara(d.kind, 0)) : this.take(d.index);
        return;
      }

      const over = this._areaSob(e);
      const alvoSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
      const alvo = alvoSlot ? Number(alvoSlot.dataset.index) : 0;

      if (over === this.el.trash) {
        // jogar fora: sai do inventario e cai no chao
        if (d.from === 'bag') this.dropFromBag(d.index);
        if (d.from === 'gun') this.dropWeapon(d.index);
        return;
      }
      if (d.from === 'box' && over === this.el.bagGrid && !EH_ARMA(d.kind)) this.take(d.index);
      if (d.from === 'box' && over === this.el.gunGrid && EH_ARMA(d.kind)) {
        this.takeWeapon(d.index, this.campoPara(d.kind, alvo));
      }
      if (d.from === 'gun' && over === this.el.gunGrid && alvoSlot) {
        // trocar as duas armas de fogo de lugar (a faca fica no campo dela)
        const j = alvo;
        if (j !== d.index && CAMPOS_ARMA.includes(j) && CAMPOS_ARMA.includes(d.index)) {
          const tmp = this.weapons[j];
          this.weapons[j] = this.weapons[d.index];
          this.weapons[d.index] = tmp;
          this._refresh();
          this.onWeaponsChange?.();
        }
      }
    };

    // pointer events: vale para mouse e para o dedo
    this.el.panel.addEventListener('pointerdown', start);
    this._areaSob = (e) =>
      document.elementFromPoint(e.clientX, e.clientY)?.closest('#bagGrid, #boxGrid, #gunGrid, #trash');
    this._podeIr = (destino) => {
      if (!this.drag) return false;
      const arma = EH_ARMA(this.drag.kind);
      return destino === 'gun' ? arma : !arma;
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);

    // clique duplo tambem pega, para quem nao quiser arrastar
    this.el.panel.addEventListener('dblclick', (e) => {
      const slot = e.target.closest('.slot.filled[data-from="box"]');
      if (!slot) return;
      const i = Number(slot.dataset.index);
      const kind = slot.dataset.kind;
      EH_ARMA(kind) ? this.takeWeapon(i, this.campoPara(kind, 0)) : this.take(i);
    });
  }

  // tenta pegar o item: quem decide e o servidor, para dois jogadores nao
  // pegarem a mesma granada
  take(index) {
    const box = this.openBox;
    if (!box || !box.items[index]) return;
    if (!this.slots.includes(null)) return;
    this.onTake?.(box.id, index);
  }

  takeWeapon(index, slot = 0) {
    const box = this.openBox;
    if (!box || !box.items[index]) return;
    // so cabe uma faca: pegar outra so jogaria a sua no chao
    if (box.items[index] === 'faca' && this.weapons[CAMPO_FACA]) return;
    this.onTake?.(box.id, index, slot);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
