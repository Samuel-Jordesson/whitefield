import * as THREE from 'three';
import { makeHuts, makeBoxes, LOADOUT_INICIAL, COLETE, danoComColete } from './mapgen.js';

// Partida solo: roda tudo na sua maquina, sem servidor.
//
// Em vez de um monte de "se for solo faz diferente" espalhado pelo jogo, esta
// classe finge ser o servidor: recebe as mesmas mensagens que o `Net` mandaria
// e devolve os mesmos eventos. Para o resto do jogo nao muda nada.

const BOTS_POR_TIME = 5;
const VITORIA = 50;
const RESSURGE = 4;          // segundos ate o bot voltar
const ALCANCE_TIRO = 55;     // ate onde o bot consegue acertar
const ALCANCE_BUSCA = 160;   // ate onde ele percebe que tem briga para o lado de la
const DANO_BOT = 18;
const CADENCIA = [0.9, 1.8]; // intervalo entre os tiros do bot
const LAPIDE_DURA = 120;     // segundos ate a lapide sumir
const MAX_LAPIDES = 40;
const VELOCIDADE = [3.2, 4.6];

const NOMES = [
  'Zeca', 'Duda', 'Nino', 'Bel', 'Tuca', 'Pipo', 'Lila', 'Bruno',
  'Cacau', 'Vito', 'Mel', 'Juca',
];

const SPAWNS = {
  A: [[0, 34], [12, 40], [-12, 40], [22, 30], [-22, 30], [6, 46], [-6, 46]],
  B: [[0, -34], [12, -40], [-12, -40], [22, -30], [-22, -30], [6, -46], [-6, -46]],
};

export class SoloGame {
  constructor(net, { world, player, remote }) {
    this.net = net;
    this.world = world;
    this.player = player;
    this.remote = remote;
    this.ativo = false;
    this.bots = [];
    this.score = { A: 0, B: 0 };
    this.tempoEstado = 0;
  }

  /* ---------------- comeco ---------------- */

  comecar({ time = 'A', character = 1 } = {}) {
    this.ativo = true;
    this.score = { A: 0, B: 0 };
    this.meuTime = time;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.huts = makeHuts(this.seed);
    this.boxes = makeBoxes(this.seed, this.huts);
    this.drops = new Map();
    this.proximoDrop = 1;
    this.tombs = new Map();
    this.proximaLapide = 1;
    this.vidaJogador = 100;
    this.coleteJogador = 0;

    // seus aliados usam o seu operador; o time de frente sorteia entre os
    // outros (Jaime incluso), para nunca confundir inimigo com aliado
    const outros = [1, 2, 3].filter((c) => c !== character);
    const opDoBot = (t) => (t === time ? character : outros[Math.floor(Math.random() * outros.length)]);

    this.bots = [];
    let id = -1;
    for (const t of ['A', 'B']) {
      const quantos = t === time ? BOTS_POR_TIME : BOTS_POR_TIME;
      for (let i = 0; i < quantos; i++) {
        this.bots.push(this._novoBot(id--, t, opDoBot(t), i));
      }
    }

    this.net.id = 1;
    this.net.room = this._sala();

    // avisa o jogo exatamente como o servidor faria
    this.net._emit('joined', { room: this.net.room, you: 1 });
    this.net._emit('match', {
      room: this.net.room,
      spawn: this._spawn(time, 0),
      seed: this.seed,
      huts: this.huts,
      boxes: this.boxes,
      drops: [],
      tombs: [],
    });
  }

  parar() {
    this.ativo = false;
    this.bots = [];
  }

  _novoBot(id, team, character, idx) {
    const spawn = this._spawn(team, idx + 1);
    return {
      id, team, character,
      name: NOMES[(Math.abs(id) - 1) % NOMES.length],
      kills: 0, deaths: 0, health: 100, alive: true,
      pos: new THREE.Vector3(spawn.x, 0, spawn.z),
      alvo: new THREE.Vector2(spawn.x, spawn.z),
      velocidade: VELOCIDADE[0] + Math.random() * (VELOCIDADE[1] - VELOCIDADE[0]),
      recarga: CADENCIA[0] + Math.random() * CADENCIA[1],
      mirando: false,
      renasce: 0,
      pensa: 0,
    };
  }

  _spawn(team, idx) {
    const lista = SPAWNS[team];
    const [x, z] = lista[idx % lista.length];
    const j = () => (Math.random() - 0.5) * 6;
    return { x: x + j(), z: z + j() };
  }

  _sala() {
    return {
      code: 'SOLO',
      state: 'match',
      hostId: 1,
      seed: this.seed,
      score: this.score,
      goal: VITORIA,
      players: [
        {
          id: 1, name: this.player.nome || 'Voce', team: this.meuTime,
          character: this.meuCharacter, ready: true,
          kills: this.meusAbates || 0, deaths: this.minhasMortes || 0, health: 100,
        },
        ...this.bots.map((b) => ({
          id: b.id, name: b.name, team: b.team, character: b.character,
          ready: true, kills: b.kills, deaths: b.deaths, health: b.health,
        })),
      ],
    };
  }

  /* ---------------- mensagens que viriam do jogo ---------------- */

  // devolve true se tratou (em solo, trata tudo)
  send(type, msg = {}) {
    if (!this.ativo) return false;

    switch (type) {
      case 'state':
        break;                                   // o proprio jogo ja sabe onde voce esta

      case 'hit': {
        const bot = this.bots.find((b) => b.id === msg.target);
        if (msg.target === 1) { this._machucarJogador(msg.damage, null); break; }
        if (!bot || !bot.alive) break;
        bot.health = Math.max(0, bot.health - (msg.damage || 25));
        this.net._emit('confirmHit', { target: bot.id, health: bot.health });
        if (bot.health === 0) this._morrer(bot, { id: 1, name: this.player.nome || 'Voce', team: this.meuTime });
        break;
      }

      case 'respawn': {
        const spawn = this._spawn(this.meuTime, 0);
        this.vidaJogador = 100;
        this.coleteJogador = 0;
        this.net._emit('respawn', { spawn });
        break;
      }

      case 'tomb':
        this._lapide(msg.x, msg.z, this.player.nome || 'Voce', msg.items || []);
        break;

      case 'take': {
        const box = typeof msg.box === 'string' ? this.tombs.get(msg.box) : this.boxes[msg.box];
        const idx = Number(msg.index);
        if (!box || !box.items[idx]) break;
        const [kind] = box.items.splice(idx, 1);
        this.net._emit('took', { box: box.id, index: idx, kind, slot: msg.slot });
        break;
      }

      case 'drop': {
        const drop = { id: this.proximoDrop++, kind: msg.kind, x: msg.x, y: msg.y || 0, z: msg.z };
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
        this.coleteJogador = COLETE.max;
        this.net._emit('vestiu', { colete: this.coleteJogador });
        break;

      case 'heal': {
        this.vidaJogador = Math.min(100, (this.vidaJogador ?? 100) + (msg.amount || 35));
        this.net._emit('healed', { health: this.vidaJogador, ganho: msg.amount || 35 });
        break;
      }

      case 'grenade':
        break;                                   // a granada ja e simulada na sua tela

      case 'leave':
        this.parar();
        break;
    }
    return true;
  }

  /* ---------------- vida e abates ---------------- */

  _machucarJogador(dano, quem) {
    if (this.vidaJogador <= 0) return;             // ja esta morto, esperando renascer
    const r = danoComColete(dano, this.coleteJogador || 0);
    this.coleteJogador = r.colete;
    this.vidaJogador = Math.max(0, (this.vidaJogador ?? 100) - r.dano);
    this.net._emit('hurt', { by: quem?.id ?? 0, health: this.vidaJogador, colete: this.coleteJogador });
    if (this.vidaJogador === 0) {
      this.minhasMortes = (this.minhasMortes || 0) + 1;
      this._abate(quem, { id: 1, name: this.player.nome || 'Voce', team: this.meuTime });
    }
  }

  _morrer(bot, assassino) {
    bot.alive = false;
    bot.deaths++;
    bot.renasce = RESSURGE;
    this._lapide(bot.pos.x, bot.pos.z, bot.name, this._mochilaDoBot());
    this._abate(assassino, bot);
  }

  // bot nao saqueia de verdade: sorteia o que ele "tinha" quando caiu
  _mochilaDoBot() {
    const itens = LOADOUT_INICIAL.filter(Boolean);
    if (Math.random() < 0.4) itens.unshift(['rifle', 'escopeta', 'snipe'][Math.floor(Math.random() * 3)]);
    if (Math.random() < 0.45) itens.push('vida');
    if (Math.random() < 0.25) itens.push('granada');
    if (Math.random() < 0.04) itens.push('cigarro');
    return itens;
  }

  // lapide com RIP onde alguem morreu, igual o servidor faz
  _lapide(x, z, name, items) {
    const tomb = {
      id: 't' + this.proximaLapide++,
      x: Number(x) || 0, z: Number(z) || 0,
      name, items: [...items].slice(0, 12),
    };
    this.tombs.set(tomb.id, { ...tomb, dura: LAPIDE_DURA });
    this.net._emit('tomb', { tomb: { ...tomb, items: [...tomb.items] } });

    // muita gente morrendo: a mais antiga some primeiro
    if (this.tombs.size > MAX_LAPIDES) this._tirarLapide(this.tombs.keys().next().value);
  }

  _tirarLapide(id) {
    if (!this.tombs.delete(id)) return;
    this.net._emit('tombGone', { id });
  }

  // soma o placar e avisa a tela, igual o servidor faz
  _abate(assassino, vitima) {
    if (assassino && assassino.team !== vitima.team) {
      if (assassino.id === 1) this.meusAbates = (this.meusAbates || 0) + 1;
      else { const b = this.bots.find((x) => x.id === assassino.id); if (b) b.kills++; }
      this.score[assassino.team]++;
    }

    this.net.room = this._sala();
    this.net._emit('kill', {
      killer: assassino?.id ?? 0, killerName: assassino?.name ?? '—', killerTeam: assassino?.team,
      victim: vitima.id, victimName: vitima.name, victimTeam: vitima.team,
      room: this.net.room,
    });

    if (assassino && this.score[assassino.team] >= VITORIA) {
      this.ativo = false;
      this.net._emit('matchEnd', { winner: assassino.team, room: this.net.room });
    }
  }

  /* ---------------- cerebro dos bots ---------------- */

  update(dt) {
    if (!this.ativo) return;
    this.vidaJogador = this.vidaJogador ?? 100;

    for (const t of this.tombs.values()) {
      t.dura -= dt;
      if (t.dura <= 0) this._tirarLapide(t.id);
    }

    for (const bot of this.bots) {
      if (!bot.alive) {
        bot.renasce -= dt;
        if (bot.renasce <= 0) {
          const spawn = this._spawn(bot.team, Math.abs(bot.id));
          bot.pos.set(spawn.x, 0, spawn.z);
          bot.health = 100;
          bot.alive = true;
          this.net._emit('respawned', { id: bot.id, x: spawn.x, z: spawn.z });
        }
        continue;
      }
      this._pensar(bot, dt);
    }

    // manda a posicao dos bots para o jogo desenhar, no mesmo ritmo da rede
    this.tempoEstado -= dt;
    if (this.tempoEstado <= 0) {
      this.tempoEstado = 0.05;
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        this.net._emit('state', {
          id: bot.id, x: bot.pos.x, y: 0, z: bot.pos.z,
          yaw: 0, aiming: bot.mirando, moving: true,
        });
      }
    }
  }

  _pensar(bot, dt) {
    const inimigo = this._inimigoMaisPerto(bot);
    bot.pensa -= dt;

    // ninguem em lugar nenhum: ronda o miolo do mapa, que e onde a briga acontece
    if (!inimigo) {
      bot.mirando = false;
      const longe = Math.hypot(bot.alvo.x - bot.pos.x, bot.alvo.y - bot.pos.z) < 4;
      if (bot.pensa <= 0 || longe) {
        bot.pensa = 4 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 45;                  // puxa para o centro
        bot.alvo.set(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      this._andar(bot, bot.alvo.x, bot.alvo.y, dt, bot.velocidade * 0.85);
      return;
    }

    const dist = Math.hypot(inimigo.x - bot.pos.x, inimigo.z - bot.pos.z);

    // viu de longe: vai para cima ate chegar na distancia de tiro
    if (dist > ALCANCE_TIRO) {
      bot.mirando = false;
      this._andar(bot, inimigo.x, inimigo.z, dt, bot.velocidade);
      return;
    }

    // na distancia: se posiciona e atira
    bot.mirando = true;
    if (dist > 16) this._andar(bot, inimigo.x, inimigo.z, dt, bot.velocidade);
    else if (dist < 7) this._andar(bot, bot.pos.x * 2 - inimigo.x, bot.pos.z * 2 - inimigo.z, dt, bot.velocidade * 0.7);

    bot.recarga -= dt;
    if (bot.recarga <= 0) {
      bot.recarga = CADENCIA[0] + Math.random() * CADENCIA[1];
      const chance = Math.max(0.12, 1 - dist / ALCANCE_TIRO);   // longe, erra mais
      if (Math.random() < chance) this._atirar(bot, inimigo);
    }
  }

  _atirar(bot, alvo) {
    if (alvo.souEu) { this._machucarJogador(DANO_BOT, bot); return; }

    // `ref` e o bot de verdade — sem isso o dano cairia numa copia e sumiria
    const vitima = alvo.ref;
    vitima.health = Math.max(0, vitima.health - DANO_BOT);
    if (vitima.health === 0) this._morrer(vitima, bot);
  }

  // inimigo vivo mais proximo (o jogador conta como um deles)
  _inimigoMaisPerto(bot) {
    let melhor = null, melhorDist = ALCANCE_BUSCA;

    if (bot.team !== this.meuTime && this.vidaJogador > 0) {
      const d = Math.hypot(this.player.position.x - bot.pos.x, this.player.position.z - bot.pos.z);
      if (d < melhorDist) {
        melhor = { souEu: true, x: this.player.position.x, z: this.player.position.z };
        melhorDist = d;
      }
    }
    for (const outro of this.bots) {
      if (!outro.alive || outro.team === bot.team) continue;
      const d = Math.hypot(outro.pos.x - bot.pos.x, outro.pos.z - bot.pos.z);
      if (d < melhorDist) {
        melhor = { souEu: false, ref: outro, x: outro.pos.x, z: outro.pos.z };
        melhorDist = d;
      }
    }
    return melhor;
  }

  // anda na direcao do ponto desviando do que estiver no caminho
  _andar(bot, alvoX, alvoZ, dt, velocidade) {
    const dx = alvoX - bot.pos.x, dz = alvoZ - bot.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    bot.pos.x += (dx / d) * velocidade * dt;
    bot.pos.z += (dz / d) * velocidade * dt;

    for (const c of this.world.colliders) {
      const ox = bot.pos.x - c.x, oz = bot.pos.z - c.z;
      const min = c.r + 0.5;
      const dd = Math.hypot(ox, oz);
      if (dd < min && dd > 0.001) {
        bot.pos.x += (ox / dd) * (min - dd);
        bot.pos.z += (oz / dd) * (min - dd);
      }
    }
    for (const b of this.world.boxColliders) {
      const sin = Math.sin(b.rot), cos = Math.cos(b.rot);
      const px = bot.pos.x - b.x, pz = bot.pos.z - b.z;
      const lx = px * cos - pz * sin, lz = px * sin + pz * cos;
      const invX = b.hw + 0.5 - Math.abs(lx);
      const invZ = b.hd + 0.5 - Math.abs(lz);
      if (invX <= 0 || invZ <= 0) continue;
      let ex = 0, ez = 0;
      if (invX < invZ) ex = Math.sign(lx || 1) * invX;
      else ez = Math.sign(lz || 1) * invZ;
      bot.pos.x += ex * cos + ez * sin;
      bot.pos.z += -ex * sin + ez * cos;
    }
  }
}
