import * as THREE from 'three';
import * as TEX from '../textures.js';
import { Cinematica } from './cinematica.js';
import { criarFase1 } from './fase1.js';
import { definirChao } from '../grenade.js';
import { COLETE, danoComColete } from '../mapgen.js';

// Modo historia. Igual ao SoloGame, finge ser o servidor: recebe as mensagens
// que o jogo mandaria pela rede e devolve os mesmos eventos. Por cima disso
// cuida do roteiro: cinematicas, inimigos com visao de verdade, areas que
// disparam coisas, checkpoints e o helicoptero do final.

const FASES = { fase1: criarFase1 };

const ARMAS_INIMIGO = {
  pistola: { dano: 9, entre: [0.5, 0.85], rajada: 1, pausa: [0.4, 0.8], alcance: 30, precisao: 0.55 },
  rifle: { dano: 7, entre: [0.11, 0.15], rajada: 4, pausa: [1.0, 1.6], alcance: 42, precisao: 0.42 },
  escopeta: { dano: 24, entre: [1.2, 1.6], rajada: 1, pausa: [0.2, 0.4], alcance: 10, precisao: 0.8 },
};

const VISAO = 26;            // ate onde um inimigo desatento enxerga
const VISAO_ALERTA = 48;
const CONE = Math.cos(THREE.MathUtils.degToRad(62));
const ANDAR = 2.1, CORRE = 3.1;
const RAIO = 0.42;

const _ray = new THREE.Raycaster();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

export class Historia {
  constructor(net, { world, player, remote, loot, scene, camera, characters, profile, toast, equiparSlot }) {
    Object.assign(this, { net, world, player, remote, loot, scene, camera, characters, profile, toast, equiparSlot });
    this.ativo = false;
    this.cine = new Cinematica(camera);
    this.atores = [];
    this.efeitos = [];
    this.fogoTex = TEX.fireTexture();

    const $ = (id) => document.getElementById(id);
    this.el = {
      objetivo: $('objetivo'), objetivoTexto: $('objetivoTexto'),
      fala: $('historiaFala'), prompt: $('historiaPrompt'),
    };
  }

  get emCena() { return this.ativo && this.cine.ativa; }

  /* ---------------- comeco e fim ---------------- */

  comecar(faseId = 'fase1', operador = 1) {
    this.parar();
    const fase = FASES[faseId]();
    this.fase = fase;
    this.faseId = faseId;
    this.operador = operador;
    this.ativo = true;
    this.abates = 0;
    this.mortes = 0;
    this.tempo = 0;
    this.vida = 100;
    this.colete = 0;
    this.falaTempo = 0;
    this.rotorVel = 0;
    this.limpo = false;
    this.fim = false;

    this.world.entrarHistoria(fase.nivel);
    definirChao((x, z, y) => this.world.alturaChao(x, z, y));
    document.body.classList.add('historia');

    this.inimigos = fase.inimigos.map((d, i) => this._novoInimigo(d, -(i + 1)));
    this.caixas = fase.caixas.map((c) => ({ ...c, items: [...c.items] }));
    this.tombs = new Map();
    this.seqLapide = 1;
    this.drops = new Map();
    this.seqDrop = 1;
    this.gatilhos = fase.gatilhos.map((g) => ({ ...g, feito: false }));

    this.net.id = 1;
    this.net.room = this._sala();
    this.net._emit('match', {
      room: this.net.room, historia: true,
      spawn: fase.inicio,
      boxes: this.caixas.map((c) => ({ ...c, items: [...c.items] })),
      drops: [], tombs: [],
      armas: fase.armasInicio,
    });

    this._objetivo(fase.objetivoInicial);
    this.el.objetivo.classList.add('hidden');

    const ctx = {
      scene: this.scene, characters: this.characters, operador,
      atores: this.atores, ref: fase.ref,
      fovBase: this.camera.userData.fovBase || 75,
      apagao: (on) => this._apagao(on),
      rotor: (v) => { this.rotorVel = v; },
      jogador: this.player.position,
    };
    this.cine.tocar(fase.cenaInicial(ctx), { aoTerminar: () => this._depoisDaIntro() });
  }

  _depoisDaIntro() {
    const ini = this.fase.inicio;
    this.player.position.set(ini.x, ini.y, ini.z);
    this.player.velocity.set(0, 0, 0);
    // o jogador olha para onde a camera terminou (a porta)
    const dir = this.camera.getWorldDirection(_d);
    this.player.yaw = Math.atan2(-dir.x, -dir.z);
    this.player.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    this.loot.setWeapon(2, 'faca');
    this.equiparSlot(2);
    this.el.objetivo.classList.remove('hidden');
    this._objetivo('Saia do apartamento. Os invasores estao no corredor');
    this._fala('Devagar... pelas costas eles nem vao me ouvir.');
    this._salvarCheckpoint(0);
  }

  parar() {
    if (!this.ativo) return;
    this.ativo = false;
    if (this.cine.ativa) { this.cine.aoTerminarCena = null; this.cine.pular(); }
    for (const b of [...this.atores]) { this.scene.remove(b); b.material.dispose(); }
    this.atores.length = 0;
    for (const e of this.efeitos) { this.scene.remove(e.obj); e.obj.material.dispose(); e.obj.geometry?.dispose(); }
    this.efeitos.length = 0;
    this.world.sairHistoria();
    definirChao(null);
    document.body.classList.remove('historia', 'cinema');
    this.el.objetivo.classList.add('hidden');
    this.el.fala.classList.add('hidden');
    this.el.prompt.classList.add('hidden');
  }

  _novoInimigo(d, id) {
    const arma = ARMAS_INIMIGO[d.arma] || ARMAS_INIMIGO.pistola;
    return {
      ...d, id, spec: arma,
      pos: new THREE.Vector3(d.x, d.y, d.z),
      vidaMax: d.vida || 100, hp: d.vida || 100, vivo: true,
      dir: angulo(d.olhar), alerta: false, vendo: false, suspeita: 0,
      olho: Math.random() * 0.2, reacao: 0, tiro: 0, rajada: 0,
      patrulhaI: 0, espera: 0, alvo: null, semVer: 0, trocaPosicao: 0,
      ultimo: new THREE.Vector3(d.x, d.y, d.z), andando: false,
    };
  }

  _sala() {
    return {
      code: 'HISTORIA', state: 'match', hostId: 1, score: { A: this.abates, B: this.mortes }, goal: 999,
      players: [
        { id: 1, name: this.profile.nome, team: 'A', character: this.operador, ready: true, kills: this.abates, deaths: this.mortes },
        ...this.inimigos.map((e) => ({
          id: e.id, name: e.nome, team: 'B', character: e.char, ready: true,
          kills: 0, deaths: e.vivo ? 0 : 1, x: e.pos.x, y: e.pos.y, z: e.pos.z,
        })),
      ],
    };
  }

  /* ---------------- mensagens do jogo ---------------- */

  send(type, msg = {}) {
    if (!this.ativo) return false;
    switch (type) {
      case 'hit': {
        if (msg.target === 1) { this._machucar(Number(msg.damage) || 0, null); break; }
        const e = this.inimigos.find((x) => x.id === msg.target);
        if (!e || !e.vivo) break;
        let dano = Number(msg.damage) || 25;
        // faca em quem nao te viu: abate silencioso
        const silencioso = msg.faca && !e.alerta;
        if (silencioso) dano = e.hp;
        e.hp = Math.max(0, e.hp - dano);
        this.net._emit('confirmHit', { target: e.id, health: e.hp });
        if (e.hp === 0) {
          this._matar(e);
          if (silencioso) this.toast('abate silencioso');
        } else {
          this._alertar(e, true);
        }
        break;
      }
      case 'shot':
        this._barulho(this.player.position, 24);
        break;
      case 'respawn':
        this._voltarCheckpoint();
        break;
      case 'take': {
        const box = typeof msg.box === 'string' ? this.tombs.get(msg.box) : this.caixas[msg.box];
        const idx = Number(msg.index);
        if (!box || !box.items[idx]) break;
        const [kind] = box.items.splice(idx, 1);
        this.net._emit('took', { box: box.id, index: idx, kind, slot: msg.slot });
        break;
      }
      case 'drop': {
        const drop = { id: this.seqDrop++, kind: msg.kind, x: msg.x, y: msg.y || 0, z: msg.z };
        this.drops.set(drop.id, drop);
        this.net._emit('dropped', { drop });
        break;
      }
      case 'pick': {
        const drop = this.drops.get(Number(msg.id));
        if (!drop) break;
        this.drops.delete(drop.id);
        this.net._emit('picked', { id: drop.id, kind: drop.kind, slot: msg.slot });
        break;
      }
      case 'colete':
        this.colete = COLETE.max;
        this.net._emit('vestiu', { colete: this.colete });
        break;
      case 'heal': {
        const antes = this.vida;
        this.vida = Math.min(100, this.vida + (msg.amount || 35));
        this.net._emit('healed', { health: this.vida, ganho: this.vida - antes });
        break;
      }
      case 'grenade':
        this._barulho(this.player.position, 18);
        break;
      // tomb (a lapide do jogador): na historia voce volta do checkpoint com o que tinha
      // state / leave / o resto: nada a fazer
    }
    return true;
  }

  /* ---------------- vida, morte, checkpoint ---------------- */

  _machucar(dano, quem) {
    if (this.vida <= 0 || this.emCena || this.fim) return;
    const r = danoComColete(dano, this.colete || 0);
    this.colete = r.colete;
    this.vida = Math.max(0, Math.round(this.vida - r.dano));
    this.net._emit('hurt', { by: quem?.id ?? 0, health: this.vida, colete: this.colete });
    if (this.vida === 0) {
      this.mortes++;
      this.net.room = this._sala();
      this.net._emit('kill', {
        killer: quem?.id ?? 1, killerName: quem?.nome ?? 'voce mesmo', killerTeam: 'B',
        victim: 1, victimName: this.profile.nome, victimTeam: 'A', room: this.net.room,
      });
    }
  }

  _matar(e) {
    e.vivo = false;
    this.abates++;
    this.net.room = this._sala();
    this.net._emit('kill', {
      killer: 1, killerName: this.profile.nome, killerTeam: 'A',
      victim: e.id, victimName: e.nome, victimTeam: 'B', room: this.net.room,
    });
    const tomb = {
      id: 't' + this.seqLapide++, seq: this.seqLapide,
      x: e.pos.x, y: e.pos.y, z: e.pos.z, name: e.nome, items: [...(e.itens || [])],
    };
    this.tombs.set(tomb.id, tomb);
    this.net._emit('tomb', { tomb: { ...tomb, items: [...tomb.items] } });
    // quem estava perto ouviu o companheiro cair
    for (const o of this.inimigos) {
      if (o.vivo && o.grupo === e.grupo && !o.alerta) this._alertar(o, false);
    }
  }

  _salvarCheckpoint(idx) {
    if (this.cp && this.cp.idx >= idx) return;
    this.cp = {
      idx,
      armas: [...this.loot.weapons],
      mochila: [...this.loot.slots],
      vida: Math.max(this.vida, 60),
      seqLapide: this.seqLapide,
      seqDrop: this.seqDrop,
      caixas: this.caixas.map((c) => [...c.items]),
      tombs: [...this.tombs.values()].map((t) => ({ id: t.id, items: [...t.items] })),
      objetivo: this.objetivoAtual,
    };
    if (idx > 0) this.toast('checkpoint');
  }

  _voltarCheckpoint() {
    const cp = this.cp;
    const pos = this.fase.checkpoints[cp.idx];

    // inimigos da secao voltam; os de antes, se vivos, voltam ao posto
    for (const e of this.inimigos) {
      if (e.cp < cp.idx && !e.vivo) continue;
      const estavaMorto = !e.vivo;
      Object.assign(e, this._novoInimigo(e, e.id));
      e.pos.set(e.x, e.y, e.z);
      if (estavaMorto) this.net._emit('respawned', { id: e.id, x: e.x, y: e.y, z: e.z });
    }
    // o que nasceu depois do checkpoint some; caixas e lapides voltam a ter o que tinham
    for (const t of [...this.tombs.values()]) {
      if (t.seq > cp.seqLapide) { this.tombs.delete(t.id); this.net._emit('tombGone', { id: t.id }); }
    }
    for (const salvo of cp.tombs) {
      const t = this.tombs.get(salvo.id);
      if (t) { t.items = [...salvo.items]; this.net._emit('boxItems', { box: t.id, items: t.items }); }
    }
    this.caixas.forEach((c, i) => { c.items = [...cp.caixas[i]]; this.net._emit('boxItems', { box: c.id, items: c.items }); });
    for (const d of [...this.drops.values()]) {
      if (d.id >= cp.seqDrop) { this.drops.delete(d.id); this.net._emit('dropGone', { id: d.id }); }
    }
    // o que aconteceu depois do checkpoint volta a acontecer — inclusive a area
    // do proprio checkpoint, que realerta os inimigos daquela secao
    for (const g of this.gatilhos) {
      if (g.feito && (g.cpNoDisparo >= cp.idx || g.checkpoint === cp.idx)) g.feito = false;
    }

    this.vida = cp.vida;
    this.colete = 0;
    this.net.room = this._sala();
    this._objetivo(cp.objetivo);
    this.net._emit('respawn', {
      spawn: pos, armas: [...cp.armas], mochila: [...cp.mochila], health: this.vida,
    });
    this.net._emit('room', { room: this.net.room });
  }

  /* ---------------- HUD ---------------- */

  _objetivo(texto) {
    if (!texto || texto === this.objetivoAtual) return;
    this.objetivoAtual = texto;
    this.el.objetivoTexto.textContent = texto;
    this.el.objetivo.classList.remove('novo');
    void this.el.objetivo.offsetWidth;          // reinicia a animacao
    this.el.objetivo.classList.add('novo');
  }

  _fala(texto, dura = 4.5) {
    this.el.fala.textContent = texto;
    this.el.fala.classList.remove('hidden');
    this.falaTempo = dura;
  }

  _apagao(on) {
    this.apagado = on;
    for (const l of this.fase.ref.piscar) l.luz.intensity = on ? 0 : l.base;
  }

  /* ---------------- helicoptero ---------------- */

  _pertoDoHeli() {
    const h = this.fase.helicoptero;
    const p = this.player.position;
    return Math.abs(p.y - h.y) < 1.5 && Math.hypot(p.x - h.x, p.z - h.z) < h.raio;
  }

  interagir() {
    if (!this.ativo || this.emCena || this.fim) return false;
    if (!this._pertoDoHeli()) return false;
    if (!this.limpo) { this._fala('Ainda tem gente atirando. Limpa o terraco primeiro.'); return true; }
    this.fim = true;
    this.el.prompt.classList.add('hidden');
    this.el.objetivo.classList.add('hidden');
    const ctx = {
      scene: this.scene, characters: this.characters, operador: this.operador,
      atores: this.atores, ref: this.fase.ref,
      jogador: this.player.position.clone(),
      rotor: (v) => { this.rotorVel = v; },
    };
    this.cine.tocar(this.fase.cenaFinal(ctx), { aoTerminar: () => this._concluir() });
    return true;
  }

  _concluir() {
    const premio = this.profile.concluirFase(this.faseId, this.tempo, this.abates);
    this.net._emit('historiaFim', {
      fase: this.fase.nome, tempo: this.tempo, abates: this.abates, mortes: this.mortes, premio,
    });
  }

  /* ---------------- loop ---------------- */

  update(dt) {
    if (!this.ativo) return;
    const f = this.fase;

    // cenario vivo: luz piscando, ventoinhas, rotor, luz da antena
    this._t = (this._t || 0) + dt;
    if (!this.apagado) {
      for (const l of f.ref.piscar) {
        const liga = Math.sin(this._t * 13 + l.base) > -0.85 && Math.random() > 0.03;
        l.luz.intensity = liga ? l.base : 0.2;
        l.painel.material.color.setScalar(liga ? 1 : 0.4);
      }
    }
    for (const v of f.ref.ventoinhas || []) v.rotation.y += dt * 5;
    if (f.ref.luzAntena) f.ref.luzAntena.visible = Math.sin(this._t * 3) > 0;
    const heli = f.ref.helicoptero;
    if (heli) {
      const alvoVel = this.rotorVel || (this.limpo ? 6 : 0);
      heli.vel = (heli.vel || 0) + (alvoVel - (heli.vel || 0)) * Math.min(1, dt * 0.8);
      heli.rotor.rotation.y += heli.vel * dt;
      heli.rotorCauda.rotation.z += heli.vel * dt * 2.2;
    }
    for (const b of this.atores) b.faceCamera(this.camera);
    this._atualizarEfeitos(dt);

    if (this.cine.ativa) { this.cine.update(dt); return; }
    if (this.fim) return;

    this.tempo += dt;
    if (this.falaTempo > 0) {
      this.falaTempo -= dt;
      if (this.falaTempo <= 0) this.el.fala.classList.add('hidden');
    }

    this._gatilhos();
    for (const e of this.inimigos) if (e.vivo) this._pensar(e, dt);

    // terraco limpo: o helicoptero liga
    if (!this.limpo) {
      const grupo = f.helicoptero.grupoLimpo;
      const restam = this.inimigos.filter((e) => e.grupo === grupo && e.vivo).length;
      const disparou = this.gatilhos.find((g) => g.alerta?.includes(grupo))?.feito;
      if (disparou && restam === 0) {
        this.limpo = true;
        this._objetivo('Entre no helicoptero');
        this._fala('O motor ainda funciona. Agora!');
      }
    }
    const perto = this._pertoDoHeli();
    this.el.prompt.classList.toggle('hidden', !perto);
    if (perto) {
      this.el.prompt.innerHTML = this.limpo
        ? '<b>E</b> entrar no helicoptero'
        : '<span>elimine os invasores do terraco</span>';
    }

    // queda do predio (nao deveria acontecer, mas nao trava o jogo)
    if (this.player.position.y < -8 && this.vida > 0) this._machucar(999, null);

    this.tempoEstado = (this.tempoEstado || 0) - dt;
    if (this.tempoEstado <= 0) {
      this.tempoEstado = 0.05;
      for (const e of this.inimigos) {
        if (!e.vivo) continue;
        this.net._emit('state', {
          id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z,
          aiming: e.alerta, moving: e.andando,
        });
      }
    }
  }

  _gatilhos() {
    const p = this.player.position;
    for (const g of this.gatilhos) {
      if (g.feito) continue;
      const [x0, x1, z0, z1, y0, y1] = g.area;
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1 || p.y < y0 || p.y > y1) continue;
      g.feito = true;
      g.cpNoDisparo = this.cp?.idx ?? 0;
      for (const grupo of g.alerta || []) {
        for (const e of this.inimigos) if (e.vivo && e.grupo === grupo) this._alertar(e, false);
      }
      if (g.objetivo) this._objetivo(g.objetivo);
      if (g.legenda) this._fala(g.legenda);
      if (g.checkpoint !== undefined) this._salvarCheckpoint(g.checkpoint);
    }
  }

  /* ---------------- inimigos ---------------- */

  _alertar(e, sabeOnde) {
    if (!e.alerta) {
      e.alerta = true;
      e.reacao = 0.45 + Math.random() * 0.45;
      e.rajada = 0;
    }
    if (sabeOnde) { e.ultimo.copy(this.player.position); e.semVer = 0; }
  }

  _barulho(ponto, raio) {
    for (const e of this.inimigos) {
      if (!e.vivo) continue;
      const dy = Math.abs(e.pos.y - ponto.y);
      const d = Math.hypot(e.pos.x - ponto.x, e.pos.z - ponto.z);
      if (dy < 3 && d < raio) this._alertar(e, d < raio * 0.6);
    }
  }

  // o inimigo enxerga o jogador? (linha livre ate o olho da camera)
  _enxerga(e, dist) {
    if (dist > (e.alerta ? VISAO_ALERTA : VISAO)) return false;
    _a.set(e.pos.x, e.pos.y + 1.5, e.pos.z);
    _b.copy(this.camera.position);
    _d.subVectors(_b, _a);
    const len = _d.length();
    _d.divideScalar(len);
    _ray.set(_a, _d);
    _ray.near = 0.3;
    _ray.far = len - 0.35;
    return _ray.intersectObjects(this.fase.nivel.solidos, false).length === 0;
  }

  _pensar(e, dt) {
    const p = this.player.position;
    const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const vivo = this.vida > 0;

    e.olho -= dt;
    if (e.olho <= 0) {
      e.olho = 0.15 + Math.random() * 0.05;
      e.vendo = vivo && Math.abs(p.y - e.pos.y) < 6 && this._enxerga(e, Math.hypot(dist, p.y - e.pos.y));
    }

    if (!e.alerta) {
      // desatento: so ve o que esta na frente; ouve quem corre ou chega colado
      const frente = dist > 0.01 ? (Math.cos(e.dir) * dx + Math.sin(e.dir) * dz) / dist : 1;
      if (e.vendo && frente > CONE) {
        e.suspeita += dt * (dist < 8 ? 4 : 1.6);
        if (e.suspeita > 0.7) { this._alertar(e, true); this._fala(`${e.nome}: ALI! ATIRA!`, 2.5); }
      } else {
        e.suspeita = Math.max(0, e.suspeita - dt * 0.5);
      }
      const passo = this.player.speed2D;
      const ouve = passo > 6.5 ? 8 : (passo > 0.5 && !this.player.crouching ? 1.9 : 0);
      if (vivo && dist < ouve && Math.abs(p.y - e.pos.y) < 2) this._alertar(e, true);
      this._patrulhar(e, dt);
      return;
    }

    // alerta
    if (e.vendo) {
      e.ultimo.copy(p);
      e.semVer = 0;
      e.dir = Math.atan2(dz, dx);
      e.reacao -= dt;
      if (e.reacao <= 0 && vivo) this._disparar(e, dt, dist);

      // se mexe atras de cobertura: passos de lado de tempos em tempos
      e.trocaPosicao -= dt;
      if (!e.alvo || e.trocaPosicao <= 0) {
        e.trocaPosicao = 1.2 + Math.random() * 1.6;
        const lado = Math.random() < 0.5 ? -1 : 1;
        const perto = e.arma === 'escopeta' ? Math.min(dist - 2, 3) : (dist < 4 ? -2 : 0);
        e.alvo = new THREE.Vector2(
          e.pos.x + (-dz / (dist || 1)) * lado * 1.8 + (dx / (dist || 1)) * perto,
          e.pos.z + (dx / (dist || 1)) * lado * 1.8 + (dz / (dist || 1)) * perto
        );
      }
      this._andar(e, e.alvo.x, e.alvo.y, e.chefe ? CORRE * 0.8 : ANDAR, dt);
    } else {
      // perdeu de vista: vai atras de onde viu por ultimo (sem sair do posto)
      e.semVer += dt;
      e.reacao = Math.max(e.reacao, 0.3);
      if (e.semVer > 0.8) this._andar(e, e.ultimo.x, e.ultimo.z, CORRE, dt);
      else e.andando = false;
      e.dir = Math.atan2(e.ultimo.z - e.pos.z, e.ultimo.x - e.pos.x);
    }
  }

  _patrulhar(e, dt) {
    if (!e.patrulha) { e.andando = false; return; }
    if (e.espera > 0) { e.espera -= dt; e.andando = false; return; }
    const [tx, tz] = e.patrulha[e.patrulhaI];
    if (Math.hypot(tx - e.pos.x, tz - e.pos.z) < 0.3) {
      e.patrulhaI = (e.patrulhaI + 1) % e.patrulha.length;
      e.espera = 1.5 + Math.random() * 2.5;
      return;
    }
    e.dir = Math.atan2(tz - e.pos.z, tx - e.pos.x);
    this._andar(e, tx, tz, ANDAR * 0.6, dt);
  }

  _andar(e, tx, tz, vel, dt) {
    const [x0, x1, z0, z1] = e.area;
    tx = Math.min(x1, Math.max(x0, tx));
    tz = Math.min(z1, Math.max(z0, tz));
    const dx = tx - e.pos.x, dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) { e.andando = false; return; }
    const passo = Math.min(d, vel * dt);
    e.pos.x += (dx / d) * passo;
    e.pos.z += (dz / d) * passo;
    e.andando = true;

    for (const b of this.world.boxColliders) {
      if (b.y1 !== undefined && (e.pos.y >= b.y1 - 0.05 || e.pos.y + 1.8 <= b.y0)) continue;
      const sin = Math.sin(b.rot), cos = Math.cos(b.rot);
      const px = e.pos.x - b.x, pz = e.pos.z - b.z;
      const lx = px * cos - pz * sin, lz = px * sin + pz * cos;
      const invX = b.hw + RAIO - Math.abs(lx), invZ = b.hd + RAIO - Math.abs(lz);
      if (invX <= 0 || invZ <= 0) continue;
      let ex = 0, ez = 0;
      if (invX < invZ) ex = Math.sign(lx || 1) * invX; else ez = Math.sign(lz || 1) * invZ;
      e.pos.x += ex * cos + ez * sin;
      e.pos.z += -ex * sin + ez * cos;
    }
    e.pos.x = Math.min(x1, Math.max(x0, e.pos.x));
    e.pos.z = Math.min(z1, Math.max(z0, e.pos.z));
    const chao = this.world.alturaChao(e.pos.x, e.pos.z, e.pos.y + 0.3);
    if (chao > -50) e.pos.y = chao;
  }

  _disparar(e, dt, dist) {
    const a = e.spec;
    e.tiro -= dt;
    if (e.tiro > 0) return;
    if (dist > a.alcance * 1.5) { e.tiro = 0.3; return; }

    e.rajada++;
    if (e.rajada >= a.rajada) {
      e.rajada = 0;
      e.tiro = a.pausa[0] + Math.random() * (a.pausa[1] - a.pausa[0]);
    } else {
      e.tiro = a.entre[0] + Math.random() * (a.entre[1] - a.entre[0]);
    }

    let chance = a.precisao * (1 - Math.min(1, dist / (a.alcance * 1.5)) * 0.7);
    if (this.player.speed2D > 4) chance *= 0.7;
    if (this.player.crouching) chance *= 0.8;
    if (e.chefe) chance *= 1.15;
    const acertou = Math.random() < chance;

    this._clarao(e, acertou);
    if (acertou) {
      const dano = a.dano * (e.arma === 'escopeta' && dist > a.alcance ? 0.35 : 1);
      this._machucar(dano, e);
    }
  }

  // clarao na ponta da arma do inimigo + risco da bala
  _clarao(e, acertou) {
    _a.set(e.pos.x, e.pos.y + 1.25, e.pos.z);
    _d.subVectors(this.camera.position, _a).normalize();
    _a.addScaledVector(_d, 0.5);

    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fogoTex, transparent: true, depthWrite: false }));
    sp.position.copy(_a);
    sp.scale.setScalar(0.55);
    this.scene.add(sp);
    this.efeitos.push({ obj: sp, vida: 0.07 });

    const fim = this.camera.position.clone();
    fim.y -= 0.35;
    if (!acertou) fim.add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.3) * 1.0, (Math.random() - 0.5) * 1.6));
    const geo = new THREE.BufferGeometry().setFromPoints([_a.clone(), fim]);
    const linha = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 }));
    linha.raycast = () => {};
    this.scene.add(linha);
    this.efeitos.push({ obj: linha, vida: 0.06 });
  }

  _atualizarEfeitos(dt) {
    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const ef = this.efeitos[i];
      ef.vida -= dt;
      if (ef.vida <= 0) {
        this.scene.remove(ef.obj);
        ef.obj.material.dispose();
        ef.obj.geometry?.dispose();
        this.efeitos.splice(i, 1);
      }
    }
  }
}

function angulo(olhar = '+x') {
  return { '+x': 0, '-x': Math.PI, '+z': Math.PI / 2, '-z': -Math.PI / 2 }[olhar] ?? 0;
}
