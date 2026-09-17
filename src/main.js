import * as THREE from 'three';
import { World } from './world.js';
import * as TEX from './textures.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { Net } from './net.js';
import { PlayerManager, loadCharacters } from './players.js';
import { LootManager, loadLootTextures, ITEMS, TUDO, EH_ARMA } from './loot.js';
import { DropManager } from './drops.js';
import { GrenadeManager, throwVelocity, blastDamage, BLAST_RADIUS, definirChao } from './grenade.js';
import { Grass } from './grass.js';
import { Profile } from './profile.js';
import { Settings, escalaMirando } from './settings.js';
import { Menu } from './menu.js';
import { SoloGame } from './solo.js';
import { Historia } from './historia/historia.js';
import { HUT_TYPES } from './huts.js';
import { FOOTPRINTS } from './construcoes/index.js';
import { Bussola } from './bussola.js';
import { ControlesToque } from './toque.js';
import { Controle } from './controle.js';
import { aoTrocarControle } from './glifos.js';

/* ---------------- render ---------------- */

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);
const FOV_HIP = 75;
const FOV_ADS = 42;

const world = new World(scene);
const player = new Player(camera, world);
// granada quica no andar em que caiu, nao no chao la embaixo
definirChao((x, z, y) => world.alturaChao(x, z, y));
const raycaster = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);
const MIRA_TIRO = new THREE.Vector2();

const $ = (id) => document.getElementById(id);

// celular/tablet (ou ?mobile=1 para testar no PC): controles de toque, sem pointer lock
const MOBILE = /[?&]mobile=1/.test(location.search) || matchMedia('(pointer: coarse)').matches;
if (MOBILE) document.body.classList.add('toque');

let characters, lootTextures, arvore;
try {
  [characters, lootTextures, arvore] = await Promise.all([
    loadCharacters(), loadLootTextures(), TEX.loadTrimmedTexture('Arvore.png', 1024),
  ]);
  world.setTreeImage(arvore);
} catch (err) {
  $('loading').textContent = err.message;
  throw err;
}

const remote = new PlayerManager(scene, characters);
const bussola = new Bussola();
const weapon = new Weapon({ onShoot: shoot, onThrow: throwGrenade });
const net = new Net();

const loot = new LootManager(scene, lootTextures, {
  world,
  onTake: (box, index, slot) => net.send('take', { box, index, slot }),
  onLockChange: (lock) => {
    if (lock) lockMouse();
    else soltarMouse();
  },
  onDrop: (kind) => largarNoChao(kind),
  onWeaponsChange: () => conferirArmaNaMao(),
});

const drops = new DropManager(scene, {
  onPick: (id, kind) => net.send('pick', { id, slot: slotParaArma(kind) }),
});

const grenades = new GrenadeManager(scene, { onExplode: explode });
const grass = new Grass(scene);

const profile = new Profile();
// cada operador nasce com as armas escolhidas no EQUIPAR
loot.cargaInicial = () => profile.cargaDe(net.me?.character ?? profile.dados.operador);
const settings = new Settings();
settings.ligar({ renderer, camera, scene, world, player, grass });

/* ---------------- estado ---------------- */

const DAMAGE = 25;
const RESPAWN_TIME = 3;

let phase = 'home';        // home | join | lobby | select | match
let running = false;       // pointer lock ativo
let dead = false;
let respawnLeft = 0;
let health = 100;
let colete = 0;          // pontos do colete vestido (0 = sem colete)
let sendTimer = 0;
const aiming = { dx: 0, dy: 0 };
const CENTER_DIR = new THREE.Vector3();

/* ---------------- armas e itens no chao ---------------- */

// joga o item alguns passos a frente, para nao cair dentro do jogador
function largarNoChao(kind) {
  camera.getWorldDirection(CENTER_DIR);
  net.send('drop', {
    kind,
    x: player.position.x + CENTER_DIR.x * 1.4,
    z: player.position.z + CENTER_DIR.z * 1.4,
    y: player.position.y,                        // cai no andar em que voce esta
  });
  toast(TUDO[kind].name + ' no chao');
}

// em qual slot a arma pega do chao deve entrar
function slotParaArma(kind) {
  if (!EH_ARMA(kind)) return undefined;
  return loot.campoPara(kind, SLOT_ATUAL);   // sem espaco: troca a que esta na mao
}

let SLOT_ATUAL = 0;
let abatesNaPartida = 0;

// se a arma que esta na mao saiu do inventario, a mao fica vazia
function conferirArmaNaMao() {
  if (weapon.isThrow) return;                  // granada na mao: deixa
  const esperado = loot.weaponAt(SLOT_ATUAL) || 'maos';
  if (weapon.key !== esperado) {
    weapon.equip(esperado);
  }
}

/* ---------------- telas ---------------- */

const screens = $('screens');
const SCREEN_IDS = ['home', 'lobby', 'select', 'pause', 'end'];

function show(name) {
  phase = name;
  if (MOBILE && name !== 'match') running = false;          // no celular "rodando" = estar na partida
  document.body.classList.toggle('em-partida', name === 'match');
  screens.classList.toggle('hidden', name === 'match');
  for (const id of SCREEN_IDS) $('screen-' + id).classList.toggle('hidden', id !== name);
  $('hud').classList.toggle('hidden', name !== 'match' && name !== 'pause');
  $('weaponWrap').classList.toggle('hidden', name !== 'match' && name !== 'pause');
  atualizarTelaCheia();          // botao de tela cheia: sempre no menu, na partida so no celular
}

let toastTimer = 0;
function toast(text, secs = 2.5) {
  $('toast').textContent = text;
  $('toast').classList.add('on');
  toastTimer = secs;
}

/* ---------------- menu ---------------- */

function myName() { return profile.nome; }

async function withServer(fn) {
  try {
    await net.connect();
    fn();
  } catch {
    toast('servidor fora do ar — rode "node server.js"', 4);
  }
}

// partida solo: uma copia local do servidor, com bots
const solo = new SoloGame(net, { world, player, remote });
player.nome = profile.nome;

// modo historia: tambem finge ser o servidor, com roteiro, cinematicas e checkpoints
const historia = new Historia(net, {
  world, player, remote, loot, scene, camera, characters, profile, toast,
  equiparSlot: (i) => usarSlot(i),
});

// tudo que iria para a rede passa por aqui; em solo, resolve na propria maquina
const enviarRede = net.send.bind(net);
net.send = (type, data) => {
  if (historia.ativo && historia.send(type, data)) return;
  if (solo.ativo && solo.send(type, data)) return;
  enviarRede(type, data);
};

const menu = new Menu({
  profile,
  settings,
  toast,
  onCriarSala: () => withServer(() => net.send('create', { name: myName() })),
  onEntrarSala: (code) => withServer(() => net.send('join', { code, name: myName() })),
  onHistoria: (fase, operador) => {
    player.nome = profile.nome;
    historia.comecar(fase, operador);
  },
  onJogarSolo: (character) => {
    player.nome = profile.nome;
    solo.meuCharacter = character;
    solo.comecar({ time: 'A', character });
  },
});

$('btnCopy').onclick = async () => {
  const code = $('roomCode').textContent;
  try {
    await navigator.clipboard.writeText(code);
    toast('codigo ' + code + ' copiado');
  } catch {
    toast('copie na mao: ' + code);
  }
};

for (const btn of document.querySelectorAll('.team')) {
  btn.onclick = () => net.send('team', { team: btn.dataset.team });
}

$('btnEndOk').onclick = () => {
  if (net.room?.code === 'HISTORIA') { net.room = null; remote.clear(); show('home'); menu.abrir('historia'); return; }
  if (net.room?.code === 'SOLO') { solo.parar(); remote.clear(); show('home'); menu.fechar(); return; }
  show('lobby');
  renderLobby();
};
$('btnStart').onclick = () => net.send('start');
$('btnLeave').onclick = () => { net.send('leave'); net.room = null; show('home'); };

for (const btn of document.querySelectorAll('.char')) {
  btn.onclick = () => {
    const id = Number(btn.dataset.char);
    if (!profile.temItem('op' + id)) { toast('libere este operador na loja'); return; }
    net.send('character', { character: id });
    renderSelect();
  };
}

$('btnResume').onclick = () => lockMouse();

// pausa: continuar / configuracoes / sair
function mostrarPausaConfig(on) {
  $('pausaMenu').classList.toggle('hidden', on);
  $('pausaConfig').classList.toggle('hidden', !on);
  if (on) menu.configEm($('pausaConfigPainel'));
}
$('btnPauseConfig').onclick = () => mostrarPausaConfig(true);
$('btnPauseVoltar').onclick = () => mostrarPausaConfig(false);
$('btnQuit').onclick = () => {
  net.send('leave');
  solo.parar();
  historia.parar();
  loot.clear();
  drops.clear();
  net.room = null;
  remote.clear();
  show('home');
  menu.fechar();
};

/* ---------------- lobby / selecao ---------------- */

function renderLobby() {
  const room = net.room;
  if (!room) return;

  $('roomCode').textContent = room.code;
  const n = room.players.length;
  $('playerCount').textContent = n;
  $('playerCountLabel').textContent = n === 1 ? 'jogador na sala' : 'jogadores na sala';

  const meuTime = net.me?.team || 'A';
  for (const time of ['A', 'B']) {
    const doTime = room.players.filter((p) => (p.team || 'A') === time);
    $('teamList' + time).innerHTML = doTime.length
      ? doTime.map((p) => {
          const marcas = [];
          if (p.id === room.hostId) marcas.push('dono');
          if (p.id === net.id) marcas.push('voce');
          const marca = marcas.length ? ` <span class="tag">(${marcas.join(', ')})</span>` : '';
          return `<li class="${p.id === net.id ? 'me' : ''}">${escapeHtml(p.name)}${marca}</li>`;
        }).join('')
      : '<li class="vazio">ninguem ainda</li>';

    const btn = document.querySelector(`.team[data-team="${time}"]`);
    btn.classList.toggle('mine', meuTime === time);
    btn.querySelector('.team-tag').textContent =
      meuTime === time ? 'VOCE ESTA AQUI' : 'clique para entrar';
  }

  const host = net.isHost;
  $('btnStart').disabled = !host;
  $('lobbyHint').textContent = host
    ? 'da pra comecar sozinho para treinar'
    : 'esperando o dono da sala iniciar a partida';
}

function renderSelect() {
  const room = net.room;
  if (!room) return;

  for (const btn of document.querySelectorAll('.char')) {
    const id = Number(btn.dataset.char);
    const meu = profile.temItem('op' + id);
    btn.classList.toggle('bloqueado', !meu);
    btn.disabled = !meu;
    const quem = room.players.filter((p) => p.character === id);
    const eu = quem.some((p) => p.id === net.id);
    btn.classList.toggle('picked', eu);
    btn.classList.toggle('taken', quem.length > 0 && !eu);
    btn.querySelector('.char-tag').textContent = quem.map((p) => (p.id === net.id ? 'VOCE' : p.name.toUpperCase())).join(' · ');
  }

  const faltam = room.players.filter((p) => !p.ready).length;
  $('selectHint').textContent = faltam === 0
    ? 'comecando…'
    : (net.me?.ready ? `esperando mais ${faltam} jogador(es)` : 'clique em um deles');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------- rede ---------------- */

net.on('error', (m) => {
  const erro = $('joinError');
  if (erro) erro.textContent = m.message;
  toast(m.message, 3);
});

net.on('joined', () => { remote.clear(); show('lobby'); renderLobby(); });

net.on('room', () => {
  if (phase === 'lobby') renderLobby();
  if (phase === 'select') renderSelect();
  if (phase === 'match' || phase === 'pause') {
    remote.myTeam = net.me?.team || 'A';
    remote.sync(net.room.players, net.id);
    renderScoreboard();
  }
});

net.on('select', () => { show('select'); renderSelect(); });

net.on('match', (m) => {
  remote.myTeam = net.me?.team || 'A';
  remote.sync(net.room.players, net.id);
  if (!m.historia) {
    if (historia.ativo) historia.parar();
    world.sairHistoria();
    if (m.seed !== undefined) world.rebuild(m.seed, m.huts || []);   // mesmo cenario para todos
    // a grama tambem nao nasce dentro da casa nem do predio
    grass.setHuts([...(m.huts || []), ...FOOTPRINTS],
      (h) => (h.w ? h : HUT_TYPES[h.kind] || HUT_TYPES.madeira));
  }
  grass.mesh.visible = !m.historia;     // nada de grama dentro do predio
  abatesNaPartida = 0;
  correrAte = 0; visaoAte = 0;
  player.speedBoost = 1;
  remote.verTodos(false);
  loot.spawn(m.boxes || [], m.tombs || []);
  SLOT_ATUAL = 0;
  loot.resetBag();                 // nasce so com pistola e faca
  if (m.armas || m.mochila) loot.definirCarga(m.armas, m.mochila);
  usarSlot(0);
  drops.clear();
  drops.sync(m.drops || []);
  grenades.clear();
  startMatch(m.spawn);
});

net.on('took', (m) => {
  loot.removeItem(m.box, m.index);
  guardar(m.kind, m.slot);
});

net.on('dropped', (m) => drops.spawn(m.drop));
net.on('dropGone', (m) => drops.remove(m.id));

net.on('picked', (m) => {
  drops.remove(m.id);
  guardar(m.kind, m.slot);
});

// guarda o que veio da caixa ou do chao no lugar certo
function guardar(kind, slot) {
  if (EH_ARMA(kind)) {
    const { trocada } = loot.pickWeapon(kind, slot ?? SLOT_ATUAL);
    if (trocada) largarNoChao(trocada);       // sem espaco: a antiga cai no chao
    conferirArmaNaMao();
    toast(TUDO[kind].name + ' equipada');
  } else if (loot.addToBag(kind)) {
    toast(TUDO[kind].name + ' na mochila');
  } else {
    toast('mochila cheia');
  }
}

net.on('boxChanged', (m) => loot.removeItem(m.box, m.index));

// lapides: aparecem onde alguem morreu e somem sozinhas depois de um tempo
net.on('tomb', (m) => loot.addTomb(m.tomb));
net.on('tombGone', (m) => loot.removeTomb(m.id));

// historia: caixa/lapide volta a ter o que tinha no checkpoint
net.on('boxItems', (m) => {
  const b = loot.boxes.get(m.box);
  if (!b) return;
  b.items = [...m.items];
  if (loot.openBox === b) loot.renderPanel();
});

// historia: fase concluida (depois da cinematica do helicoptero)
net.on('historiaFim', (m) => {
  const t = `${Math.floor(m.tempo / 60)}:${String(Math.floor(m.tempo % 60)).padStart(2, '0')}`;
  $('endTitle').textContent = 'FASE CONCLUIDA';
  $('endSub').textContent = m.fase;
  $('endPremio').innerHTML = `
    <li>tempo <b>${t}</b>${m.premio.recorde ? ' · <b>novo recorde</b>' : ''}</li>
    <li><b>${m.abates}</b> abates · <b>${m.mortes}</b> ${m.mortes === 1 ? 'morte' : 'mortes'}</li>
    <li><b>+${m.premio.xp}</b> XP${m.premio.subiu ? ` · subiu para o <b>nivel ${profile.nivel}</b>!` : ''}</li>
    ${m.premio.dinheiro ? `<li><b>+${m.premio.dinheiro}</b> moedas <small>(primeira vez)</small></li>` : ''}`;
  $('btnEndOk').textContent = 'VOLTAR AO MENU';
  soltarMouse();
  weapon.setAiming(false);
  weapon.releaseTrigger();
  loot.clear();
  drops.clear();
  grenades.clear();
  remote.clear();
  historia.parar();
  show('end');
});

// morreu: tudo o que carregava fica na lapide, para qualquer um pegar
function deixarLapide() {
  net.send('tomb', {
    x: player.position.x,
    z: player.position.z,
    items: loot.tudoQueCarrega(),
  });
  loot.resetBag(true);
}

net.on('vestiu', (m) => {
  colete = m.colete;
  updateHealth();
  toast('colete vestido');
});

net.on('healed', (m) => {
  health = m.health;
  updateHealth();
  if (m.ganho > 0) toast('+' + m.ganho + ' de vida');
});

net.on('grenade', (m) => {
  grenades.spawn(
    new THREE.Vector3(m.x, m.y, m.z),
    new THREE.Vector3(m.vx, m.vy, m.vz),
    m.id, false
  );
});

net.on('state', (m) => remote.get(m.id)?.applyState(m));

net.on('left', (m) => remote.remove(m.id));

net.on('hurt', (m) => {
  health = m.health;
  if (m.colete !== undefined) colete = m.colete;
  updateHealth();
  $('damage').classList.add('on');
  damageTimer = 0.3;
});

net.on('confirmHit', () => weapon.showHit());

net.on('kill', (m) => {
  if (m.killer === net.id && m.victim !== net.id) abatesNaPartida++;
  killfeed(m.killerName, m.victimName, m.killerTeam);
  remote.get(m.victim)?.die();
  if (m.victim === net.id) { deixarLapide(); startDeath(m.killerName); }
  if (net.room) { remote.sync(net.room.players, net.id); renderScoreboard(); }
});

net.on('scores', () => renderScoreboard());

net.on('matchEnd', (m) => {
  const s = m.room?.score || { A: 0, B: 0 };
  const meu = net.me?.team;
  const venceu = meu === m.winner;

  $('endTitle').textContent = meu
    ? (venceu ? 'SEU TIME VENCEU!' : 'SEU TIME PERDEU')
    : `TIME ${m.winner} VENCEU`;
  $('endSub').textContent = `time A ${s.A} x ${s.B} time B`;
  $('btnEndOk').textContent = net.room?.code === 'SOLO' ? 'VOLTAR AO MENU' : 'VOLTAR PARA A SALA';

  // 1 moeda por abate, dobrada na vitoria; perdendo, nao leva o que juntou
  const premio = profile.fecharPartida({ abates: abatesNaPartida, venceu });
  $('endPremio').innerHTML = `
    <li><b>${abatesNaPartida}</b> abates na partida</li>
    <li><b>+${premio.xp}</b> XP${premio.subiu ? ` · subiu para o <b>nivel ${profile.nivel}</b>!` : ''}</li>
    <li>${venceu
      ? `<b>+${premio.dinheiro}</b> moedas <small>(dobrado pela vitoria)</small>`
      : `<b>0</b> moedas <small>(perdeu as ${premio.perdido} que juntou na partida)</small>`}</li>`;
  abatesNaPartida = 0;
  soltarMouse();
  weapon.setAiming(false);
  weapon.releaseTrigger();
  loot.close();
  grenades.clear();
  remote.clear();
  dead = false;
  $('respawn').classList.add('hidden');
  show('end');
});

net.on('respawned', (m) => remote.get(m.id)?.respawn(m.x, m.z, m.y || 0));

net.on('respawn', (m) => {
  dead = false;
  health = m.health ?? 100;
  colete = 0;
  updateHealth();
  weapon.refill();
  SLOT_ATUAL = 0;
  loot.resetBag();                 // volta so com pistola e faca
  if (m.armas || m.mochila) loot.definirCarga(m.armas, m.mochila);   // historia: o que tinha no checkpoint
  usarSlot(m.armas && !m.armas[0] ? 2 : 0);
  $('respawn').classList.add('hidden');
  player.position.set(m.spawn.x, m.spawn.y || 0, m.spawn.z);
  player.velocity.set(0, 0, 0);
  if (m.spawn.yaw !== undefined) { player.yaw = m.spawn.yaw; player.pitch = 0; }
  net.send('state', stateMsg());
});

net.on('close', () => {
  remote.clear();
  net.room = null;
  toast('conexao com o servidor caiu', 4);
  show('home');
});

/* ---------------- partida ---------------- */

function startMatch(spawn) {
  dead = false;
  health = 100;
  colete = 0;
  loot.close();
  weapon.refill();
  updateHealth();
  $('respawn').classList.add('hidden');
  $('killfeed').innerHTML = '';
  player.position.set(spawn.x, spawn.y || 0, spawn.z);
  player.velocity.set(0, 0, 0);
  player.yaw = spawn.yaw ?? Math.atan2(spawn.x, spawn.z);   // olhando para o meio do campo
  player.pitch = 0;
  renderScoreboard();
  show('match');
  lockMouse();
}

function lockMouse() {
  // celular nao tem pointer lock: voltar ao jogo e so liberar os controles
  if (MOBILE) {
    running = true;
    $('voltarJogo').classList.add('hidden');
    if (phase === 'pause') show('match');
    return;
  }
  // Com controle o jogo volta na hora, sem depender do mouse: o navegador so
  // deixa prender o ponteiro logo depois de um clique, e apertar o botao do
  // controle nao conta como clique. Ainda assim tenta prender, para quem usa
  // os dois juntos.
  if (controle.conectado) {
    running = true;
    $('voltarJogo').classList.add('hidden');
    if (phase === 'pause') show('match');
  }
  // em alguns contextos (iframe, aba sem foco) o navegador recusa — e tudo bem
  try {
    const p = canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => pedirClique());
  } catch { pedirClique(); }
  // navegador que nao devolve promise: confere um pouco depois se prendeu
  setTimeout(() => { if (document.pointerLockElement !== canvas) pedirClique(); }, 350);
}

// Fechar o inventario com ESC nao conta como gesto do usuario, e o navegador
// recusa prender o mouse. Em vez de o jogo ficar parado sem mira, aparece um
// "clique para voltar" — o clique conta, e o mouse volta preso.
function pedirClique() {
  if (phase !== 'match' || loot.aberto || historia.emCena || dead) return;
  if (document.pointerLockElement === canvas) return;
  if (controle.conectado) { running = true; return; }   // de controle segue sem clique
  $('voltarJogo').classList.remove('hidden');
}
$('voltarJogo').onclick = () => { $('voltarJogo').classList.add('hidden'); lockMouse(); };

function soltarMouse() {
  // sem mouse preso (celular ou controle) e o `running` que segura o jogador
  if (MOBILE || document.pointerLockElement !== canvas) running = false;
  else document.exitPointerLock();
}

// pausa sem ESC (botao do celular)
function pausar() {
  if (phase !== 'match') return;
  running = false;
  weapon.setAiming(false);
  weapon.releaseTrigger();
  mostrarPausaConfig(false);
  show('pause');
}

$('lootFechar').onclick = () => loot.close();

/* ---------------- celular ---------------- */

// O que os botoes fazem, seja o botao na tela do celular ou o do controle.
const acoes = {
  // reaproveita todo o teclado: o botao "aperta" a tecla
  tecla: (code) => dispatchEvent(new KeyboardEvent('keydown', { code, key: code })),
  olhar: (dx, dy) => {
    if (!running || dead || historia.emCena) return;
    aiming.dx = dx; aiming.dy = dy;
    player.look(dx * 1.5, dy * 1.5);
  },
  atirar: (on) => {
    if (!on) { weapon.releaseTrigger(); return; }
    if (running && !dead && !historia.emCena) weapon.pullTrigger();
  },
  mirar: (on) => { if (running && !dead) { weapon.setAiming(on); sendStateNow(); } },
  trocarArma: () => { if (running && !dead && !historia.emCena) cycleWeapon(1); },
  pausar: () => (phase === 'pause' ? lockMouse() : pausar()),
  pularCena: () => dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })),
  // B do controle: fecha o que estiver aberto
  voltar: () => {
    if (loot.aberto) { loot.close(); return; }
    if (phase === 'pause') { document.getElementById('pausaConfig').classList.contains('hidden') ? lockMouse() : mostrarPausaConfig(false); return; }
    const aberta = document.querySelector('.screen:not(.hidden)');
    const sair = aberta?.querySelector('#btnMenuVoltar, #btnPauseVoltar, #btnEndOk, #btnLeave');
    sair?.click();
  },
};

const toque = MOBILE ? new ControlesToque({ player, acoes }) : null;

// controle de videogame: entra e sai a qualquer hora, sem configurar nada
const controle = new Controle({ player, acoes });
// os rotulos do HUD trocam junto (E vira RB, G vira LB...)
aoTrocarControle(() => { loot.renderHud(); loot.renderPanel(); });

// Tela cheia (como o F11). O botao fica sempre na pagina inicial e, no celular,
// tambem durante a partida; some quando a tela ja esta cheia (ou quando o jogo
// foi aberto pelo atalho da tela de inicio, que ja abre sem barra).
const IPHONE = /iPhone|iPod/.test(navigator.userAgent);
function atualizarTelaCheia() {
  const el = document.documentElement;
  const pode = !!(el.requestFullscreen || el.webkitRequestFullscreen) || IPHONE;
  const cheia = !!(document.fullscreenElement || document.webkitFullscreenElement)
    || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  const lugar = phase === 'home' || MOBILE;
  $('telaCheia').classList.toggle('hidden', !pode || cheia || !lugar);
}
$('telaCheia').onclick = async () => {
  const el = document.documentElement;
  if (!el.requestFullscreen && !el.webkitRequestFullscreen) {
    // iPhone: o Safari nao deixa pagina ficar em tela cheia; o atalho na tela de inicio deixa
    toast('no iPhone: toque em Compartilhar e depois em "Adicionar a Tela de Inicio" — abrindo por la o jogo fica em tela cheia', 7);
    return;
  }
  try {
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen());
  } catch { /* navegador recusou */ }
  // deitado fica melhor para jogar (so funciona em tela cheia, e nem todo celular deixa)
  try { await screen.orientation?.lock?.('landscape'); } catch { /* ok */ }
  atualizarTelaCheia();
};
document.addEventListener('fullscreenchange', atualizarTelaCheia);
document.addEventListener('webkitfullscreenchange', atualizarTelaCheia);
atualizarTelaCheia();

// avisa os outros na hora (sem esperar o proximo tick de 50ms)
function sendStateNow() {
  if (phase === 'match' && net.connected && !dead) net.send('state', stateMsg());
}

function stateMsg() {
  return {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: player.yaw,
    aiming: weapon.aiming,      // intencao, nao a animacao do zoom
    moving: player.speed2D > 0.5,
  };
}

function startDeath(killerName) {
  dead = true;
  correrAte = 0; visaoAte = 0;
  player.speedBoost = 1;
  remote.verTodos(false);
  respawnLeft = RESPAWN_TIME;
  weapon.setAiming(false);
  weapon.releaseTrigger();
  loot.close();
  grenades.hideArc();
  if (!weapon.isGun) usarSlot(SLOT_ATUAL);
  $('respawnTitle').textContent = 'VOCE MORREU';
  $('respawnSub').textContent = killerName ? `abatido por ${killerName}` : '';
  $('respawn').classList.remove('hidden');
}

function updateHealth() {
  $('health').textContent = health;
  $('health').classList.toggle('low', health <= 35);
  $('colete').textContent = colete;
  $('coleteStat').classList.toggle('hidden', colete <= 0);
}

function killfeed(killer, victim, time) {
  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = `<b>${escapeHtml(killer)}</b> <small>[${time || '?'}]</small> abateu <b>${escapeHtml(victim)}</b>`;
  const feed = $('killfeed');
  feed.prepend(line);
  while (feed.children.length > 5) feed.lastElementChild.remove();   // nao vira parede de texto
  setTimeout(() => line.remove(), 5000);
}

function renderTeamBars() {
  const room = net.room;
  if (!room?.score) return;
  const meta = room.goal || 50;
  for (const time of ['A', 'B']) {
    const n = room.score[time] || 0;
    $('num' + time).textContent = n;
    $('bar' + time).style.width = Math.min(100, (n / meta) * 100) + '%';
  }
}

function renderScoreboard() {
  const room = net.room;
  if (!room) return;
  renderTeamBars();
  const rows = [...room.players]
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map((p) => `<tr class="${p.id === net.id ? 'me' : ''}"><td>${(p.team || 'A')}</td><td>${escapeHtml(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`)
    .join('');
  const s = room.score || { A: 0, B: 0 };
  $('scoreboard').innerHTML =
    `<h3>SALA ${room.code} — TIME A ${s.A} x ${s.B} TIME B</h3>` +
    `<table><tr><td></td><td></td><td>K</td><td>D</td></tr>${rows}</table>`;

  const me = net.me;
  if (me) $('kills').textContent = me.kills;
}

/* ---------------- pointer lock e controles ---------------- */

document.addEventListener('pointerlockchange', () => {
  running = document.pointerLockElement === canvas;
  if (running) $('voltarJogo').classList.add('hidden');
  if (running) {
    show('match');
  } else if (phase === 'match' && !loot.aberto) {   // o inventario solta o mouse de proposito
    weapon.setAiming(false);
    weapon.releaseTrigger();
    mostrarPausaConfig(false);
    show('pause');
  }
});

addEventListener('mousemove', (e) => {
  if (!running || dead || historia.emCena) return;
  aiming.dx = e.movementX;
  aiming.dy = e.movementY;
  player.look(e.movementX, e.movementY);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('mousedown', (e) => {
  if (MOBILE) return;                    // o toque tambem gera mouse falso: os botoes cuidam disso
  if (!running || dead || historia.emCena) return;
  if (e.button === 0) weapon.pullTrigger();
  if (e.button === 2) { weapon.setAiming(true); sendStateNow(); }
});

addEventListener('mouseup', (e) => {
  if (MOBILE) return;
  if (e.button === 0) weapon.releaseTrigger();
  if (e.button === 2) { weapon.setAiming(false); sendStateNow(); }
});

// roda do mouse troca de arma
addEventListener('wheel', (e) => {
  if (MOBILE) return;
  if (!running || dead) return;
  cycleWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

function cycleWeapon(dir) {
  const n = loot.weapons.length;
  usarSlot((SLOT_ATUAL + dir + n) % n);
}

// pega o que estiver no slot de arma 0 ou 1 (vazio = maos)
function usarSlot(i) {
  SLOT_ATUAL = i;
  equipSlot(loot.weaponAt(i) || 'maos');
}

function equipSlot(key) {
  if (weapon.key === key) return;
  weapon.releaseTrigger();
  weapon.setAiming(false);
  grenades.hideArc();
  weapon.equip(key);
  sendStateNow();
}

// G pega a granada da mochila (e volta para a arma se apertar de novo)
function toggleGrenade() {
  if (weapon.key === 'granada') { usarSlot(SLOT_ATUAL); return; }
  if (!loot.has('granada')) { toast('sem granada na mochila'); return; }
  equipSlot('granada');
}

// C acende o cigarro: corre mais rapido e enxerga os inimigos por um tempo
let correrAte = 0, visaoAte = 0;

function useCigarro() {
  if (!loot.consume('cigarro')) { toast('sem cigarro na mochila'); return; }
  const info = ITEMS.cigarro;
  const agora = performance.now() / 1000;
  correrAte = agora + info.correr;
  visaoAte = agora + info.visao;

  player.speedBoost = 1.45;
  remote.verTodos(true);

  $('fumaca').classList.remove('hidden');
  $('fumaca').classList.add('on');
  setTimeout(() => $('fumaca').classList.remove('on'), 900);
  setTimeout(() => $('fumaca').classList.add('hidden'), 1500);
  toast('cigarro aceso: ' + info.correr + 's de folego, ' + info.visao + 's de visao');
}

// desliga os efeitos quando o tempo acaba
function atualizarCigarro() {
  const agora = performance.now() / 1000;
  if (player.speedBoost > 1 && agora > correrAte) player.speedBoost = 1;
  if (remote.vendoTodos && agora > visaoAte) remote.verTodos(false);

  const ligado = agora < correrAte || agora < visaoAte;
  $('cigarroHud').classList.toggle('hidden', !ligado);
  if (ligado) {
    const corrida = Math.max(0, correrAte - agora);
    const visao = Math.max(0, visaoAte - agora);
    $('cigarroHud').innerHTML = `
      <img src="itens/cigarro.png" alt="">
      <span>${corrida > 0 ? `correndo ${corrida.toFixed(1)}s` : ''}${corrida > 0 && visao > 0 ? ' · ' : ''}${visao > 0 ? `visao ${visao.toFixed(1)}s` : ''}</span>`;
  }
}

// V veste um colete da mochila (so troca se o atual ja levou tiro)
function useColete() {
  if (colete >= 100) { toast('colete ainda inteiro'); return; }
  if (!loot.consume('colete')) { toast('sem colete na mochila'); return; }
  net.send('colete');
}

// Q usa um curativo
function useHeal() {
  if (health >= 100) { toast('vida cheia'); return; }
  if (!loot.consume('vida')) { toast('sem curativo na mochila'); return; }
  net.send('heal', { amount: ITEMS.vida.heal });
}

addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && (phase === 'match' || phase === 'pause')) {
    e.preventDefault();
    $('scoreboard').classList.add('on');
  }
  // com a caixa aberta o teclado so serve para fechar
  if (loot.aberto) {
    // E, I ou ESC fecham (o ESC ja chega aqui porque o mouse esta solto)
    if (['KeyE', 'KeyI', 'Escape'].includes(e.code)) { e.preventDefault(); loot.close(); }
    return;
  }
  if (!running || dead || historia.emCena) return;

  switch (e.code) {
    case 'KeyR': weapon.reload(); break;
    case 'Digit1': usarSlot(0); break;
    case 'Digit2': usarSlot(1); break;
    case 'KeyG': toggleGrenade(); break;
    case 'KeyQ': useHeal(); break;
    case 'KeyC': useCigarro(); break;
    case 'KeyV': useColete(); break;
    case 'Digit3': usarSlot(2); break;
    case 'KeyE':
      if (historia.interagir()) break;           // helicoptero do final
      drops.focused ? drops.take() : loot.toggle();
      break;
    case 'KeyI': loot.toggleBag(); break;
  }
});

addEventListener('keyup', (e) => {
  if (e.code === 'Tab') $('scoreboard').classList.remove('on');
});

/* ---------------- tiro ---------------- */

function shoot() {
  if (weapon.isMelee) return facada();
  const spec = weapon.spec;
  const kick = spec.spread;
  const calm = weapon.aim > 0.5 ? 0.4 : 1;
  player.pitch = Math.min(Math.PI / 2 - 0.02, player.pitch + (kick.pitch + Math.random() * 0.012) * calm);
  player.yaw += (Math.random() - 0.5) * kick.yaw * calm;
  net.send('shot', { x: player.position.x, y: player.position.y + 1.5, z: player.position.z });

  // escopeta abre um leque; sniper sem luneta sai desviado; o resto vai reto
  const bolinhas = spec.pellets || 1;
  const abertura = spec.pellets
    ? (weapon.aim > 0.5 ? spec.cone[1] : spec.cone[0])
    : (spec.hipSpread || 0) * (1 - weapon.aim);

  // soma o dano de todas as bolinhas por alvo e manda um hit so por pessoa
  const danoPorAlvo = new Map();
  for (let i = 0; i < bolinhas; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * abertura;
    // x dividido pelo aspecto: sem isso o leque sai achatado, mais largo que alto
    const hit = aimRay(spec.alcance || 220, Math.cos(ang) * r / camera.aspect, Math.sin(ang) * r);
    if (!hit) continue;
    remote.puff(hit.point);
    const alvo = hit.object.userData.player;
    if (alvo && alvo.alive && !alvo.aliado) {
      danoPorAlvo.set(alvo, (danoPorAlvo.get(alvo) || 0) + danoNaDistancia(spec, hit.distance));
    }
  }
  for (const [alvo, dano] of danoPorAlvo) {
    alvo.hurt();
    net.send('hit', { target: alvo.id, damage: Math.round(dano) });
  }
}

// escopeta perde forca com a distancia; as outras armas batem igual
function danoNaDistancia(spec, dist) {
  if (!spec.queda) return spec.damage;
  const [perto, longe] = spec.queda;
  const t = Math.min(1, Math.max(0, (dist - perto) / (longe - perto)));
  return spec.damage * (1 - t * 0.8);
}

// golpe de faca: mesmo raio do tiro, so que bem curtinho
function facada() {
  const hit = aimRay(weapon.spec.alcance);
  if (!hit) return;
  const alvo = hit.object.userData.player;
  remote.puff(hit.point);
  if (alvo && alvo.alive && !alvo.aliado) {
    alvo.hurt();
    net.send('hit', { target: alvo.id, damage: weapon.spec.damage, faca: true });
  }
}

// O raycaster so enxerga o retangulo do sprite, nao o desenho: a arvore vira um
// muro invisivel de 5 a 8 m e a bala parava no vazio ao lado do tronco. Aqui a
// transparencia de cada textura e lida uma vez so, e o raio atravessa o vazio.
const ALPHA_CACHE = new WeakMap();
function alphaNoAcerto(hit) {
  const mat = hit.object.material;
  if (!(mat?.alphaTest > 0) || !mat.map || !hit.uv) return 1;   // cabana, chao: solido
  let d = ALPHA_CACHE.get(mat.map);
  if (!d) {
    let img = mat.map.image;
    if (!img?.width) return 1;
    if (!img.getContext) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      img = c;
    }
    d = { w: img.width, h: img.height, px: img.getContext('2d').getImageData(0, 0, img.width, img.height).data };
    ALPHA_CACHE.set(mat.map, d);
  }
  const x = Math.min(d.w - 1, Math.max(0, Math.floor(hit.uv.x * d.w)));
  const y = Math.min(d.h - 1, Math.max(0, Math.floor((1 - hit.uv.y) * d.h)));
  return d.px[(y * d.w + x) * 4 + 3] / 255;
}

// raycast do centro da tela (com desvio opcional) contra jogadores, caixas e cenario
function aimRay(far = 220, desvioX = 0, desvioY = 0) {
  MIRA_TIRO.set(desvioX, desvioY);
  raycaster.setFromCamera(MIRA_TIRO, camera);
  raycaster.near = 0.7;
  raycaster.far = far;
  const hits = raycaster.intersectObjects(
    [...remote.hittables, ...loot.meshes, ...world.props, ...world.huts, world.ground], true
  );
  // mesmo limite do alphaTest dos sprites: o que nao aparece na tela nao segura bala
  return hits.find((h) => alphaNoAcerto(h) >= 0.5) || null;
}

/* ---------------- granada ---------------- */

function grenadeOrigin() {
  camera.getWorldDirection(CENTER_DIR);
  return new THREE.Vector3(
    camera.position.x + CENTER_DIR.x * 0.6,
    camera.position.y + CENTER_DIR.y * 0.6 - 0.15,
    camera.position.z + CENTER_DIR.z * 0.6
  );
}

function throwGrenade() {
  if (!loot.consume('granada')) { usarSlot(SLOT_ATUAL); return; }
  camera.getWorldDirection(CENTER_DIR);
  const origin = grenadeOrigin();
  const vel = throwVelocity(CENTER_DIR);

  grenades.spawn(origin, vel, net.id, true);
  net.send('grenade', {
    x: origin.x, y: origin.y, z: origin.z,
    vx: vel.x, vy: vel.y, vz: vel.z,
  });
  grenades.hideArc();

  // sem mais granada na mochila, volta para a arma
  if (!loot.has('granada')) setTimeout(() => usarSlot(SLOT_ATUAL), 400);
}

// so quem jogou calcula quem estava perto — mesma regra do tiro
function explode(point, g) {
  // o chao treme para todo mundo que estiver perto, nao so para quem jogou
  const perto = camera.position.distanceTo(point);
  tremor = Math.max(tremor, Math.max(0, 1 - perto / 30));

  if (!g.mine) return;
  for (const p of remote.list) {
    if (!p.alive || p.aliado) continue;
    const d = Math.hypot(p.mesh.position.x - point.x, p.mesh.position.z - point.z,
                         (p.mesh.position.y + 0.9) - point.y);
    const dano = blastDamage(d);
    if (dano > 0) { p.hurt(); net.send('hit', { target: p.id, damage: dano }); }
  }
  const own = Math.hypot(player.position.x - point.x, player.position.z - point.z,
                         (player.position.y + 0.9) - point.y);
  const auto = blastDamage(own);
  if (auto > 0 && !dead) net.send('hit', { target: net.id, damage: auto });
}

/* ---------------- loop ---------------- */

const clock = new THREE.Clock();
let damageTimer = 0;
let tremor = 0;     // tremida da camera depois de uma explosao (0 a 1)

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  // durante a cinematica quem manda na camera e ela, nao o jogador
  const emCena = historia.emCena;
  const jogando = running && phase === 'match' && !dead && !emCena;
  if (!emCena) player.update(jogando ? dt : 0);
  if (historia.ativo && phase === 'match') historia.update(dt);

  // a camera chacoalha e vai acalmando
  if (tremor > 0) {
    const f = tremor * tremor;
    camera.position.x += (Math.random() - 0.5) * f * 0.35;
    camera.position.y += (Math.random() - 0.5) * f * 0.25;
    camera.rotation.z = (Math.random() - 0.5) * f * 0.06;
    tremor = Math.max(0, tremor - dt * 1.6);
  }

  // mira: zoom na camera e mouse mais lento (cada arma tem o seu zoom)
  weapon.update(dt, player, aiming);
  // mirando, o mouse anda o que a barra "sensibilidade mirando" mandar
  player.lookScale = 1 + (escalaMirando(settings, weapon.spec.adsSens) - 1) * weapon.aim;
  const base = camera.userData.fovBase || FOV_HIP;
  const alvoFov = weapon.spec.fov ?? FOV_ADS;
  const fov = base + (alvoFov - base) * weapon.aim;
  if (!historia.emCena && Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  world.update(camera);
  grass.update(dt, player.position);
  remote.update(dt, camera);
  grenades.update(dt);

  // caixas: destaca a que esta na mira e mostra o "E"
  if (phase === 'match') {
    loot.update(dt, camera, jogando ? aimRay(6) : null, jogando && !loot.aberto);
    drops.update(dt, camera, jogando && !loot.aberto && !loot.focused);
  }

  // a curva so faz sentido com a granada na mao (nao com a faca nem de mao vazia)
  if (jogando && weapon.isThrow) {
    camera.getWorldDirection(CENTER_DIR);
    grenades.showArc(grenadeOrigin(), CENTER_DIR, weapon.aiming);
  } else {
    grenades.hideArc();
  }

  // manda a posicao para o servidor 20x por segundo
  if (phase === 'match' && net.connected && !dead) {
    sendTimer -= dt;
    if (sendTimer <= 0) {
      sendTimer = 0.05;
      net.send('state', stateMsg());
    }
  }

  if (dead && respawnLeft > 0) {
    respawnLeft -= dt;
    $('respawnSub').textContent = `renascendo em ${Math.ceil(respawnLeft)}…`;
    if (respawnLeft <= 0) net.send('respawn');
  }

  if (solo.ativo && phase === 'match') solo.update(dt);
  atualizarCigarro();
  if (phase === 'match' || phase === 'pause') bussola.update(player, remote);
  controle.update(dt, { jogando, emCena });

  if (toque) {
    toque.update({
      jogando: phase === 'match' && running && !dead && !loot.aberto,
      emCena: historia.emCena,
      isGun: weapon.isGun,
      mirando: weapon.wantAim,
      usar: !!(loot.focused || drops.focused || (historia.ativo && historia.fase && historia._pertoDoHeli())),
      qtd: { granada: loot.count('granada'), vida: loot.count('vida'), colete: loot.count('colete'), cigarro: loot.count('cigarro') },
    });
  }

  aiming.dx *= 0.8;
  aiming.dy *= 0.8;

  if (damageTimer > 0) {
    damageTimer -= dt;
    if (damageTimer <= 0) $('damage').classList.remove('on');
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('on');
  }

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  settings.aplicar('resolucao');    // reaplica a escala escolhida
});

// primeiro frame antes de liberar o menu
player.update(0.016);
world.update(camera);
renderer.render(scene, camera);
$('loading').classList.add('hidden');
show('home');
frame();

// atalho para inspecionar/depurar pelo console do navegador
window.__wf = { scene, camera, renderer, world, player, weapon, remote, net, loot, grenades,
  raycaster,
  profile, settings, menu, fase: () => phase, show,
  grass, drops, solo, equipSlot, usarSlot, toggleGrenade, useHeal, useCigarro, aimRay,
  throwGrenade, largarNoChao, historia, toque, pausar, MOBILE,
  estadoJogo: () => ({ running, phase, dead }) };
