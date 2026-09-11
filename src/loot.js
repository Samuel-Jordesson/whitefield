import * as THREE from 'three';
import * as TEX from './textures.js';
import { Billboard, makeBlobShadow } from './billboard.js';
import { WEAPON_ITEMS } from './weapons.js';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

const BOX_HEIGHT = 0.9;      // altura da caixa em metros
const REACH = 4.0;           // distancia para conseguir abrir
export const SLOTS = 9;      // espacos da mochila
export const MAX_HEAL = 100;

export const ITEMS = {
  granada: { name: 'Granada', img: 'itens/granada.png' },
  vida: { name: 'Curativo', img: 'itens/vida.png', heal: 35 },
  cigarro: {
    name: 'Cigarro', img: 'itens/cigarro.png', raro: true,
    correr: 10,     // segundos correndo mais rapido
    visao: 5,       // segundos enxergando os inimigos pelo mapa
  },
};

// tudo que pode ser carregado: itens da mochila + as duas armas
export const TUDO = { ...ITEMS, ...WEAPON_ITEMS };
export const EH_ARMA = (kind) => kind in WEAPON_ITEMS;

export async function loadLootTextures() {
  const [fechada, aberta] = await Promise.all([
    TEX.loadTrimmedTexture('caixa/caixa.png'),
    TEX.loadTrimmedTexture('caixa/caixa-e.png'),
  ]);
  const scale = BOX_HEIGHT / fechada.height;
  return {
    idle: { texture: fechada.texture, w: fechada.width * scale, h: fechada.height * scale },
    focus: { texture: aberta.texture, w: aberta.width * scale, h: aberta.height * scale },
  };
}

// Caixas espalhadas pelo mapa + a mochila do jogador + a tela de saque.
export class LootManager {
  constructor(scene, textures, { onTake, onLockChange, onDrop, onWeaponsChange }) {
    this.scene = scene;
    this.tex = textures;
    this.onTake = onTake;                     // avisa o servidor que pegou um item
    this.onLockChange = onLockChange;         // trava/destrava o mouse ao abrir a tela
    this.onDrop = onDrop;                     // jogou algo fora: vira item no chao
    this.onWeaponsChange = onWeaponsChange;   // mudou a arma de algum slot
    this.shadowTex = TEX.blobShadowTexture();

    this.boxes = new Map();
    this.focused = null;
    this.openBox = null;
    this.slots = new Array(SLOTS).fill(null);
    this.weapons = ['rifle', 'pistola', 'faca'];   // os tres slots de arma

    this.el = {
      prompt: document.getElementById('lootPrompt'),
      panel: document.getElementById('lootPanel'),
      boxCol: document.getElementById('boxCol'),
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

  /* ---------------- caixas no mundo ---------------- */

  spawn(list) {
    this.clear();
    for (const info of list) {
      const pose = this.tex.idle;
      const mesh = new Billboard(pose.texture, pose.w, pose.h, { doubleSide: true });
      mesh.material.emissive = new THREE.Color(0x707070);
      mesh.position.set(info.x, 0, info.z);
      mesh.userData.box = info.id;
      this.scene.add(mesh);

      const shadow = makeBlobShadow(this.shadowTex, pose.w * 1.2);
      shadow.position.set(info.x, 0.03, info.z);
      this.scene.add(shadow);

      this.boxes.set(info.id, { ...info, items: [...info.items], mesh, shadow, focus: false });
    }
  }

  clear() {
    for (const b of this.boxes.values()) {
      this.scene.remove(b.mesh, b.shadow);
      b.mesh.material.dispose();
      b.shadow.geometry.dispose();
      b.shadow.material.dispose();
    }
    this.boxes.clear();
    this.focused = null;
    this.close();
  }

  get meshes() { return [...this.boxes.values()].map((b) => b.mesh); }

  // Troca caixa.png por caixa-e.png quando a caixa esta perto e sob a mira.
  // Vale o raio do centro da tela e tambem um cone curto — a caixa e baixa,
  // e seria chato ter que encaixar a mirinha exatamente nela.
  update(dt, camera, hit, active = true) {
    for (const b of this.boxes.values()) b.mesh.faceCamera(camera);

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

    const showPrompt = !!target && !this.aberto;
    this.el.prompt.classList.toggle('hidden', !showPrompt);
    if (showPrompt) {
      const n = target.items.length;
      this.el.prompt.innerHTML = n
        ? `<b>E</b> abrir caixa <span>${n} ${n === 1 ? 'item' : 'itens'}</span>`
        : '<b>E</b> abrir caixa <span>vazia</span>';
    }
  }

  // caixa mais proxima dentro do cone de visao
  _boxInCone(camera, maxDist = 3.0, maxAngle = 0.5) {
    camera.getWorldDirection(_dir);
    let best = null, bestDist = Infinity;
    for (const b of this.boxes.values()) {
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
    const pose = on ? this.tex.focus : this.tex.idle;
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

  resetBag() {
    this.slots.fill(null);
    this.weapons = ['rifle', 'pistola', 'faca'];
    this._refresh();
    this.onWeaponsChange?.();
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

  // guarda a arma no primeiro slot livre; se nao tiver, troca pela de indice `preferido`
  pickWeapon(kind, preferido = 0) {
    const livre = this.weapons.indexOf(null);
    if (livre >= 0) { this.setWeapon(livre, kind); return { slot: livre, trocada: null }; }
    const i = Math.min(Math.max(preferido, 0), this.weapons.length - 1);
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
      const tecla = kind === 'granada' ? 'G' : kind === 'vida' ? 'Q' : 'C';
      return `<div class="bag-item ${info.raro ? 'raro' : ''}">
        <img src="${info.img}" alt="${info.name}"><span>${n}</span>
        <b>${tecla}</b>
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
        : '<p class="empty-msg">caixa vazia</p>';
    }

    this.el.bagGrid.innerHTML = this.slots
      .map((kind, i) => this._slotHtml(kind, 'bag', i)).join('');

    this.el.gunGrid.innerHTML = this.weapons
      .map((kind, i) => this._slotHtml(kind, 'gun', i, 'gun')
        .replace('<div class="slot', `<div data-label="ARMA ${i + 1}" class="slot`)).join('');
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
      };
      ghost.innerHTML = `<img src="${TUDO[this.drag.kind].img}" alt="">`;
      ghost.classList.remove('hidden');
      move(e);
      slot.classList.add('dragging');
    };

    const move = (e) => {
      if (!this.drag) return;
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
      for (const s of document.querySelectorAll('.slot.dragging')) s.classList.remove('dragging');

      const over = this._areaSob(e);
      const alvoSlot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');

      if (over === this.el.trash) {
        // jogar fora: sai do inventario e cai no chao
        if (d.from === 'bag') this.dropFromBag(d.index);
        if (d.from === 'gun') this.dropWeapon(d.index);
        return;
      }
      if (d.from === 'box' && over === this.el.bagGrid && !EH_ARMA(d.kind)) this.take(d.index);
      if (d.from === 'box' && over === this.el.gunGrid && EH_ARMA(d.kind)) {
        this.takeWeapon(d.index, Number(alvoSlot?.dataset.index) || 0);
      }
      if (d.from === 'gun' && over === this.el.gunGrid && alvoSlot) {
        // trocar as duas armas de lugar
        const j = Number(alvoSlot.dataset.index);
        if (j !== d.index) {
          const tmp = this.weapons[j];
          this.weapons[j] = this.weapons[d.index];
          this.weapons[d.index] = tmp;
          this._refresh();
          this.onWeaponsChange?.();
        }
      }
    };

    this.el.panel.addEventListener('mousedown', start);
    this._areaSob = (e) =>
      document.elementFromPoint(e.clientX, e.clientY)?.closest('#bagGrid, #boxGrid, #gunGrid, #trash');
    this._podeIr = (destino) => {
      if (!this.drag) return false;
      const arma = EH_ARMA(this.drag.kind);
      return destino === 'gun' ? arma : !arma;
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', end);

    // clique duplo tambem pega, para quem nao quiser arrastar
    this.el.panel.addEventListener('dblclick', (e) => {
      const slot = e.target.closest('.slot.filled[data-from="box"]');
      if (!slot) return;
      const i = Number(slot.dataset.index);
      EH_ARMA(slot.dataset.kind) ? this.takeWeapon(i, 0) : this.take(i);
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
    this.onTake?.(box.id, index, slot);
  }
}
