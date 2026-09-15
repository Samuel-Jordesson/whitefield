// Servidor do WHITEFIELD: serve os arquivos do jogo e cuida das salas online.
// Roda em 0.0.0.0, entao qualquer maquina da rede abre pelo IP desta aqui.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { makeHuts, makeBoxes, ITENS_VALIDOS } from './src/mapgen.js';

const LAPIDE_DURA = 120000;   // ms ate a lapide sumir
const MAX_LAPIDES = 40;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/* ---------------- arquivos estaticos ---------------- */

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

/* ---------------- salas ---------------- */

const rooms = new Map();   // codigo -> { code, hostId, state, seed, huts, boxes, players: Map }
// cada time nasce de um lado do campo
const SPAWNS = {
  A: [[0, 34], [12, 40], [-12, 40], [22, 30], [-22, 30]],
  B: [[0, -34], [12, -40], [-12, -40], [22, -30], [-22, -30]],
};
const VITORIA = 50;   // abates que fecham a partida

let nextId = 1;

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function roomInfo(room) {
  return {
    code: room.code,
    state: room.state,
    hostId: room.hostId,
    seed: room.seed,
    score: room.score,
    goal: VITORIA,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      character: p.character,
      ready: p.ready,
      kills: p.kills,
      deaths: p.deaths,
      health: p.health,
    })),
  };
}

function send(ws, type, data = {}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(room, type, data = {}, exceptId = null) {
  for (const p of room.players.values()) {
    if (p.id !== exceptId) send(p.ws, type, data);
  }
}

function pushLobby(room) {
  broadcast(room, 'room', { room: roomInfo(room) });
}

function spawnFor(room, player) {
  const time = player.team === 'B' ? 'B' : 'A';
  const doTime = [...room.players.values()].filter((p) => p.team === time);
  const idx = Math.max(0, doTime.indexOf(player));
  const [x, z] = SPAWNS[time][idx % SPAWNS[time].length];
  const jitter = () => (Math.random() - 0.5) * 7;
  return { x: x + jitter(), z: z + jitter() };
}

// coloca o jogador no time mais vazio
function timeMaisVazio(room) {
  let a = 0, b = 0;
  for (const p of room.players.values()) (p.team === 'B' ? b++ : a++);
  return a <= b ? 'A' : 'B';
}

function leaveRoom(player) {
  const room = rooms.get(player.roomCode);
  if (!room) return;

  room.players.delete(player.id);
  player.roomCode = null;

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === player.id) {
    room.hostId = room.players.keys().next().value;
  }
  broadcast(room, 'left', { id: player.id });
  pushLobby(room);
}

/* ---------------- websocket ---------------- */

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const player = {
    id: nextId++,
    ws,
    name: '',
    roomCode: null,
    team: 'A',
    character: null,
    ready: false,
    health: 100,
    kills: 0,
    deaths: 0,
    alive: true,
  };

  send(ws, 'hello', { id: player.id });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = player.roomCode ? rooms.get(player.roomCode) : null;

    switch (msg.type) {
      /* ----- lobby ----- */
      case 'create': {
        leaveRoom(player);
        const code = makeCode();
        const newRoom = {
          code, hostId: player.id, state: 'lobby',
          seed: (Math.random() * 0xffffffff) >>> 0,
          huts: [],
          boxes: [],
          drops: new Map(),
          nextDrop: 1,
          tombs: new Map(),
          nextTomb: 1,
          score: { A: 0, B: 0 },
          players: new Map(),
        };
        rooms.set(code, newRoom);

        player.name = (msg.name || 'Jogador').slice(0, 16);
        player.roomCode = code;
        player.team = 'A';
        player.character = null;
        player.ready = false;
        player.kills = 0;
        player.deaths = 0;
        newRoom.players.set(player.id, player);

        send(ws, 'joined', { room: roomInfo(newRoom), you: player.id });
        break;
      }

      case 'join': {
        const code = String(msg.code || '').toUpperCase().trim();
        const target = rooms.get(code);
        if (!target) { send(ws, 'error', { message: 'Sala nao encontrada: ' + code }); break; }
        if (target.players.size >= 8) { send(ws, 'error', { message: 'Sala cheia (8 jogadores)' }); break; }

        leaveRoom(player);
        player.name = (msg.name || 'Jogador').slice(0, 16);
        player.roomCode = code;
        player.character = null;
        player.ready = false;
        player.kills = 0;
        player.deaths = 0;
        target.players.set(player.id, player);
        player.team = timeMaisVazio(target);

        send(ws, 'joined', { room: roomInfo(target), you: player.id });
        pushLobby(target);
        // sala ja em partida: o novo jogador escolhe o personagem e entra direto
        if (target.state !== 'lobby') send(ws, 'select', { room: roomInfo(target) });
        break;
      }

      case 'team': {
        if (!room || room.state === 'match') break;
        player.team = msg.team === 'B' ? 'B' : 'A';
        pushLobby(room);
        break;
      }

      case 'leave':
        leaveRoom(player);
        break;

      /* ----- comeco da partida ----- */
      case 'start': {
        if (!room || room.hostId !== player.id) break;
        room.state = 'select';
        room.score = { A: 0, B: 0 };
        room.seed = (Math.random() * 0xffffffff) >>> 0;
        room.huts = makeHuts(room.seed);
        room.boxes = makeBoxes(room.seed, room.huts);
        room.drops = new Map();
        room.nextDrop = 1;
        room.tombs = new Map();
        room.nextTomb = 1;
        for (const p of room.players.values()) {
          p.character = null;
          p.ready = false;
        }
        broadcast(room, 'select', { room: roomInfo(room) });
        break;
      }

      case 'character': {
        if (!room || room.state === 'lobby') break;
        player.character = [1, 2, 3].includes(msg.character) ? msg.character : 1;
        player.ready = true;
        pushLobby(room);

        // partida ja rolando: entra na hora, sem esperar ninguem
        if (room.state === 'match') {
          player.health = 100;
          player.alive = true;
          player.spawn = spawnFor(room, player);
          send(ws, 'match', {
            room: roomInfo(room), spawn: player.spawn,
            seed: room.seed, huts: room.huts, boxes: room.boxes,
            drops: [...room.drops.values()],
            tombs: [...room.tombs.values()],
          });
          break;
        }

        const todosProntos = [...room.players.values()].every((p) => p.ready);
        if (todosProntos) {
          room.state = 'match';
          for (const p of room.players.values()) {
            p.health = 100;
            p.alive = true;
            p.spawn = spawnFor(room, p);
          }
          for (const p of room.players.values()) {
            send(p.ws, 'match', {
              room: roomInfo(room), spawn: p.spawn,
              seed: room.seed, huts: room.huts, boxes: room.boxes,
              drops: [...room.drops.values()],
              tombs: [...room.tombs.values()],
            });
          }
        }
        break;
      }

      /* ----- durante a partida ----- */
      case 'state': {
        if (!room || room.state !== 'match') break;
        player.x = Number(msg.x) || 0;             // onde a lapide nasce se ele cair
        player.z = Number(msg.z) || 0;
        broadcast(room, 'state', {
          id: player.id,
          x: msg.x, y: msg.y, z: msg.z,
          yaw: msg.yaw,
          aiming: !!msg.aiming,
          moving: !!msg.moving,
        }, player.id);
        break;
      }

      case 'shot': {
        if (!room || room.state !== 'match') break;
        broadcast(room, 'shot', { id: player.id, x: msg.x, y: msg.y, z: msg.z }, player.id);
        break;
      }

      case 'hit': {
        if (!room || room.state !== 'match') break;
        if (!player.alive) break;                      // morto nao atira
        const victim = room.players.get(msg.target);
        if (!victim || !victim.alive) break;
        // aliado nao toma tiro de aliado (mas a propria granada ainda machuca)
        if (victim.id !== player.id && victim.team === player.team) break;

        victim.health = Math.max(0, victim.health - (Number(msg.damage) || 25));
        send(victim.ws, 'hurt', { by: player.id, health: victim.health });
        send(ws, 'confirmHit', { target: victim.id, health: victim.health });

        if (victim.health === 0) {
          victim.alive = false;
          victim.deaths++;
          victim.lapidePendente = true;               // uma lapide por morte
          if (victim.id !== player.id) {
            player.kills++;
            room.score[player.team]++;
          }
          broadcast(room, 'kill', {
            killer: player.id, killerName: player.name, killerTeam: player.team,
            victim: victim.id, victimName: victim.name, victimTeam: victim.team,
            room: roomInfo(room),
          });

          if (room.score[player.team] >= VITORIA) {
            room.state = 'lobby';
            for (const p of room.players.values()) { p.ready = false; p.character = null; }
            broadcast(room, 'matchEnd', { winner: player.team, room: roomInfo(room) });
          }
        }
        break;
      }

      case 'respawn': {
        if (!room || room.state !== 'match') break;
        player.health = 100;
        player.alive = true;
        player.lapidePendente = false;
        const spawn = spawnFor(room, player);
        send(ws, 'respawn', { spawn });
        broadcast(room, 'respawned', { id: player.id, x: spawn.x, z: spawn.z }, player.id);
        broadcast(room, 'scores', { room: roomInfo(room) });
        break;
      }

      // pegar item da caixa: o servidor decide quem ficou com ele
      case 'take': {
        if (!room || room.state !== 'match') break;
        // caixa tem id numero; lapide tem id "t…"
        const box = typeof msg.box === 'string' ? room.tombs.get(msg.box) : room.boxes[msg.box];
        const idx = Number(msg.index);
        if (!box || !box.items[idx]) break;
        const [kind] = box.items.splice(idx, 1);
        send(ws, 'took', { box: box.id, index: idx, kind, slot: msg.slot });
        broadcast(room, 'boxChanged', { box: box.id, index: idx }, player.id);
        break;
      }

      // quem morreu manda o que carregava: vira uma lapide RIP que qualquer um saqueia
      case 'tomb': {
        if (!room || room.state !== 'match' || player.alive || !player.lapidePendente) break;
        player.lapidePendente = false;
        const items = (Array.isArray(msg.items) ? msg.items : [])
          .filter((k) => ITENS_VALIDOS.includes(k))
          .slice(0, 12);
        const tomb = {
          id: 't' + room.nextTomb++,
          x: Number.isFinite(msg.x) ? msg.x : (player.x || 0),
          z: Number.isFinite(msg.z) ? msg.z : (player.z || 0),
          name: player.name,
          items,
        };
        const tombs = room.tombs;
        tombs.set(tomb.id, tomb);
        broadcast(room, 'tomb', { tomb });

        const tirar = (id) => {
          // `tombs` e o mapa desta partida: se outra comecou, nao mexe na nova
          if (room.tombs !== tombs || !tombs.delete(id)) return;
          broadcast(room, 'tombGone', { id });
        };
        if (tombs.size > MAX_LAPIDES) tirar(tombs.keys().next().value);
        setTimeout(() => tirar(tomb.id), LAPIDE_DURA);
        break;
      }

      // largar algo no chao
      case 'drop': {
        if (!room || room.state !== 'match') break;
        const drop = {
          id: room.nextDrop++,
          kind: String(msg.kind || '').slice(0, 16),
          x: Number(msg.x) || 0,
          y: Number(msg.y) || 0,
          z: Number(msg.z) || 0,
        };
        room.drops.set(drop.id, drop);
        broadcast(room, 'dropped', { drop });
        break;
      }

      // pegar do chao: so um leva
      case 'pick': {
        if (!room || room.state !== 'match') break;
        const drop = room.drops.get(Number(msg.id));
        if (!drop) break;
        room.drops.delete(drop.id);
        send(ws, 'picked', { id: drop.id, kind: drop.kind, slot: msg.slot });
        broadcast(room, 'dropGone', { id: drop.id });
        break;
      }

      case 'heal': {
        if (!room || room.state !== 'match' || !player.alive) break;
        const antes = player.health;
        player.health = Math.min(100, player.health + (Number(msg.amount) || 35));
        send(ws, 'healed', { health: player.health, ganho: player.health - antes });
        break;
      }

      // granada arremessada: os outros veem a mesma trajetoria
      case 'grenade': {
        if (!room || room.state !== 'match' || !player.alive) break;
        broadcast(room, 'grenade', {
          id: player.id,
          x: msg.x, y: msg.y, z: msg.z,
          vx: msg.vx, vy: msg.vy, vz: msg.vz,
        }, player.id);
        break;
      }

      case 'backToLobby': {
        if (!room || room.hostId !== player.id) break;
        room.state = 'lobby';
        for (const p of room.players.values()) { p.ready = false; p.character = null; }
        pushLobby(room);
        break;
      }
    }
  });

  ws.on('close', () => leaveRoom(player));
  ws.on('error', () => leaveRoom(player));
});

/* ---------------- sobe ---------------- */

function localIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  WHITEFIELD online\n');
  console.log('  nesta maquina:  http://localhost:' + PORT);
  for (const ip of localIPs()) {
    console.log('  na rede local:  http://' + ip + ':' + PORT);
  }
  console.log('\n  (Ctrl+C para parar)\n');
});
