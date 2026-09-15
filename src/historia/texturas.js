import * as THREE from 'three';
import { makeCanvas, toTexture, rabisco, INK, PAPER } from '../textures.js';

// Texturas do predio do modo historia, no mesmo traco de caneta do resto do
// jogo: branco com contorno e hachura preta. Tudo gerado em canvas.

// sorteio com semente, para a textura nao mudar a cada vez que carrega
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function repetivel(c) {
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// parede rebocada: quase branca, com manchas de umidade e rachaduras finas
export function rebocoTexture(seed = 3) {
  const { c, ctx } = makeCanvas(512, 512);
  const r = rng(seed);
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(20,20,20,.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = 20 + r() * 472, y = 20 + r() * 472, l = 6 + r() * 16;
    rabisco(ctx, x, y, x + l, y - l * 0.6, 1, 1);
  }
  ctx.strokeStyle = 'rgba(20,20,20,.45)';
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 3; k++) {
    let x = 60 + r() * 390, y = 60 + r() * 390;
    for (let s = 0; s < 5; s++) {
      const nx = x + (r() - 0.5) * 50, ny = y + 14 + r() * 26;
      rabisco(ctx, x, y, nx, ny, 1.5, 1);
      x = nx; y = ny;
    }
  }
  // rodape escuro na base do tile (a parede tem 1 tile de altura por andar)
  ctx.fillStyle = 'rgba(20,20,20,.10)';
  ctx.fillRect(0, 488, 512, 24);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  rabisco(ctx, 0, 488, 512, 488, 1.2, 2);
  return repetivel(c);
}

// concreto aparente da escada e do terraco: poros e marcas da forma
export function concretoTexture(seed = 7) {
  const { c, ctx } = makeCanvas(512, 512);
  const r = rng(seed);
  ctx.fillStyle = '#e9e9e6';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = 'rgba(20,20,20,.35)';
  for (let i = 0; i < 260; i++) {
    ctx.beginPath();
    ctx.arc(r() * 512, r() * 512, 0.8 + r() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,20,20,.28)';
  ctx.lineWidth = 3;
  for (const y of [0, 256]) rabisco(ctx, 0, y + 2, 512, y + 2, 1.5, 1);
  for (const x of [0, 256]) rabisco(ctx, x + 2, 0, x + 2, 512, 1.5, 1);
  ctx.fillStyle = 'rgba(20,20,20,.5)';
  for (const [x, y] of [[40, 40], [216, 40], [40, 216], [216, 216]]) {
    for (const [dx, dy] of [[0, 0], [256, 0], [0, 256], [256, 256]]) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  return repetivel(c);
}

// azulejo do banheiro
export function azulejoTexture() {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(20,20,20,.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    rabisco(ctx, i * 64, 0, i * 64, 256, 1, 1);
    rabisco(ctx, 0, i * 64, 256, i * 64, 1, 1);
  }
  ctx.strokeStyle = 'rgba(20,20,20,.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    rabisco(ctx, i * 64 + 12, j * 64 + 44, i * 64 + 26, j * 64 + 30, 0.8, 1);
  }
  return repetivel(c);
}

// carpete do corredor: faixas nas bordas e um losango repetido
export function carpeteTexture() {
  const { c, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#dcdcd8';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(20,20,20,.35)';
  ctx.lineWidth = 3;
  for (let y = 32; y < 512; y += 128) {
    for (let x = 32; x < 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x + 32, y); ctx.lineTo(x + 64, y + 32); ctx.lineTo(x + 32, y + 64); ctx.lineTo(x, y + 32);
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(20,20,20,.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 6) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); }
  return repetivel(c);
}

// porta de apartamento: almofadas, macaneta e olho magico
export function portaTexture({ numero = '', arrombada = false } = {}) {
  const { c, ctx } = makeCanvas(256, 512);
  ctx.fillStyle = '#f7f7f5';
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 500);
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 50, 176, 170);
  ctx.strokeRect(40, 270, 176, 190);
  ctx.beginPath(); ctx.arc(210, 270, 12, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(128, 30, 6, 0, Math.PI * 2); ctx.stroke();
  if (numero) {
    ctx.fillStyle = INK;
    ctx.font = '700 44px "Betania Patmos", "Comic Sans MS", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(numero, 128, 150);
  }
  if (arrombada) {
    ctx.lineWidth = 5;
    rabisco(ctx, 190, 240, 150, 300, 3, 2);
    rabisco(ctx, 150, 300, 176, 360, 3, 2);
    rabisco(ctx, 196, 250, 240, 230, 3, 1);
    for (let i = 0; i < 8; i++) rabisco(ctx, 160 + i * 9, 300, 150 + i * 11, 330, 2, 1);
  }
  return toTexture(c);
}

// placa com texto (numero de andar, SAIDA, aviso)
export function placaTexture(texto, { sub = '', seta = 0, fundo = PAPER, cor = INK, w = 512, h = 192 } = {}) {
  const { c, ctx } = makeCanvas(w, h);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = cor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(h * 0.42)}px "Betania Patmos", "Comic Sans MS", cursive`;
  ctx.fillText(texto, w / 2 + (seta ? -seta * 30 : 0), sub ? h * 0.4 : h / 2);
  if (sub) {
    ctx.font = `${Math.round(h * 0.18)}px "Betania Patmos", "Comic Sans MS", cursive`;
    ctx.fillText(sub, w / 2, h * 0.76);
  }
  if (seta) {
    const x = seta > 0 ? w - 70 : 70, y = h / 2;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(x - seta * 40, y); ctx.lineTo(x + seta * 20, y);
    ctx.moveTo(x, y - 26); ctx.lineTo(x + seta * 22, y); ctx.lineTo(x, y + 26);
    ctx.stroke();
  }
  return toTexture(c);
}

// poster de banda na parede do quarto
export function posterTexture() {
  const { c, ctx } = makeCanvas(384, 512);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 384, 512);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 364, 492);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = '700 70px "Betania Patmos", "Comic Sans MS", cursive';
  ctx.fillText('RUIDO', 192, 100);
  ctx.font = '26px "Betania Patmos", "Comic Sans MS", cursive';
  ctx.fillText('turne do fim do mundo', 192, 460);
  // caveira rabiscada
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(192, 260, 90, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
  rabisco(ctx, 110, 290, 130, 360, 2, 2);
  rabisco(ctx, 274, 290, 254, 360, 2, 2);
  rabisco(ctx, 130, 360, 254, 360, 2, 2);
  ctx.beginPath(); ctx.arc(155, 262, 24, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(229, 262, 24, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) rabisco(ctx, 150 + i * 21, 340, 150 + i * 21, 372, 1.5, 1);
  return toTexture(c);
}

// quadrinho de paisagem (familia/montanha)
export function quadroTexture() {
  const { c, ctx } = makeCanvas(256, 200);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 256, 200);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 186);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(24, 170); ctx.lineTo(96, 70); ctx.lineTo(140, 130); ctx.lineTo(176, 90); ctx.lineTo(232, 170);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(196, 52, 18, 0, Math.PI * 2); ctx.stroke();
  return toTexture(c);
}

// tapete do quarto
export function tapeteTexture() {
  const { c, ctx } = makeCanvas(512, 384);
  ctx.fillStyle = '#efefec';
  ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, 464, 336);
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 416, 288);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.ellipse(256, 192, 40 + i * 30, 26 + i * 22, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let x = 30; x < 490; x += 14) {
    rabisco(ctx, x, 10, x, 24, 1, 1);
    rabisco(ctx, x, 360, x, 374, 1, 1);
  }
  return toTexture(c);
}

// cobertor amarrotado da cama
export function cobertorTexture() {
  const { c, ctx } = makeCanvas(512, 512);
  const r = rng(11);
  ctx.fillStyle = '#f2f2ef';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(20,20,20,.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = r() * 512, y = r() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40 + r() * 40, y + (r() - 0.5) * 60, x + 90 + r() * 60, y + (r() - 0.5) * 40);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,20,20,.18)';
  for (let y = 0; y < 512; y += 64) rabisco(ctx, 0, y, 512, y + 8, 2, 1);
  return repetivel(c);
}

// tela do computador ligado (a unica coisa acesa no quarto)
export function telaPcTexture() {
  const { c, ctx } = makeCanvas(320, 200);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '18px monospace';
  const linhas = ['> ALERTA: invasao no bloco C', '> portaria sem resposta', '> cameras 3,4,7 offline', '> heliponto: aeronave OK', '> ...', '_'];
  linhas.forEach((l, i) => ctx.fillText(l, 14, 30 + i * 28));
  return toTexture(c);
}

// silhueta da cidade para as janelas (transparente em cima)
export function skylineTexture(seed = 5) {
  const { c, ctx } = makeCanvas(1024, 512);
  const r = rng(seed);
  let x = 0;
  while (x < 1024) {
    const w = 50 + r() * 110, h = 140 + r() * 330;
    ctx.fillStyle = '#f3f3f1';
    ctx.fillRect(x, 512 - h, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, 512 - h, w, h + 10);
    ctx.fillStyle = 'rgba(20,20,20,.55)';
    for (let wy = 512 - h + 16; wy < 500; wy += 26) {
      for (let wx = x + 10; wx < x + w - 14; wx += 20) {
        if (r() < 0.7) ctx.fillRect(wx, wy, 9, 13);
      }
    }
    if (r() < 0.3) rabisco(ctx, x + w / 2, 512 - h, x + w / 2, 512 - h - 40, 1, 2);
    x += w + r() * 18;
  }
  return toTexture(c);
}

// H do heliponto pintado no chao
export function helipontoTexture() {
  const { c, ctx } = makeCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(256, 256, 226, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.setLineDash([26, 18]);
  ctx.beginPath(); ctx.arc(256, 256, 190, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.fillRect(160, 130, 48, 252);
  ctx.fillRect(304, 130, 48, 252);
  ctx.fillRect(160, 232, 192, 48);
  return toTexture(c);
}

// pilha de entulho (billboard com fundo transparente)
export function entulhoTexture(seed = 2) {
  const { c, ctx } = makeCanvas(512, 384);
  const r = rng(seed);
  ctx.clearRect(0, 0, 512, 384);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  for (let i = 0; i < 16; i++) {
    const cx = 60 + r() * 392, cy = 170 + r() * 190 - (1 - Math.abs(cx - 256) / 256) * 110;
    const s = 26 + r() * 50, a = r() * Math.PI;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s * 0.7, -s * 0.7); ctx.lineTo(s, s * 0.4); ctx.lineTo(-s * 0.6, s * 0.6);
    ctx.closePath();
    ctx.fillStyle = r() < 0.3 ? '#d6d6d2' : PAPER;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // vergalhoes torcidos saindo da pilha
  ctx.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    const x = 120 + r() * 270;
    ctx.beginPath();
    ctx.moveTo(x, 250); ctx.quadraticCurveTo(x + 30, 150, x + (r() - 0.5) * 120, 60 + r() * 60);
    ctx.stroke();
  }
  return toTexture(c);
}

// pichacao dos invasores
export function pichacaoTexture(texto = 'FORA') {
  const { c, ctx } = makeCanvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 120px "Betania Patmos", "Comic Sans MS", cursive';
  ctx.save();
  ctx.translate(256, 128); ctx.rotate(-0.08);
  ctx.fillText(texto, 0, 0);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i++) rabisco(ctx, 110 + i * 60, 190, 110 + i * 60, 230 + (i % 3) * 10, 1, 1);
  return toTexture(c);
}

// buraco de bala / marca na parede (decalque transparente)
export function furoTexture() {
  const { c, ctx } = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(32, 32, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    rabisco(ctx, 32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 1, 1);
  }
  return toTexture(c);
}
