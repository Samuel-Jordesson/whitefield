import * as THREE from 'three';

// Todas as texturas dos sprites 2D sao desenhadas em canvas, no mesmo estilo
// da arma.png: preenchimento branco + contorno preto.

const INK = '#141414';
const PAPER = '#ffffff';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  return { c, ctx };
}

function toTexture(c, { repeat = null, filter = THREE.LinearFilter } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = filter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function blob(ctx, cx, cy, r, points, wob, seed = 1) {
  // poligono organico fechado
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const n = 1 + Math.sin(a * 3 + seed) * wob + Math.cos(a * 5 - seed) * wob * 0.6;
    const x = cx + Math.cos(a) * r * n;
    const y = cy + Math.sin(a) * r * n * 0.92;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ---------------- chao ---------------- */

export function groundTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  // grade suave, para dar nocao de movimento no campo branco
  ctx.strokeStyle = '#e2e2e2';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, S, S);

  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const p = (S / 4) * i;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
  }

  // grãozinhos de textura
  ctx.fillStyle = 'rgba(0,0,0,.045)';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    ctx.fillRect(x, y, 2, 2);
  }
  return toTexture(c, { repeat: 60 });
}

/* ---------------- cenario ---------------- */

export function treeTexture(seed = 1) {
  const { c, ctx } = makeCanvas(512, 768);
  ctx.lineWidth = 9;

  // tronco
  ctx.beginPath();
  ctx.moveTo(226, 740); ctx.lineTo(238, 430);
  ctx.lineTo(286, 430); ctx.lineTo(298, 740);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // galhos
  ctx.beginPath();
  ctx.moveTo(240, 500); ctx.lineTo(170, 430);
  ctx.moveTo(285, 470); ctx.lineTo(350, 410);
  ctx.stroke();

  // copa
  blob(ctx, 262, 300, 190, 26, 0.11, seed);
  ctx.fill(); ctx.stroke();

  // sombreado interno da copa
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(20,20,20,.55)';
  blob(ctx, 300, 340, 96, 20, 0.13, seed + 2);
  ctx.stroke();
  ctx.strokeStyle = INK;

  return toTexture(c);
}

export function rockTexture(seed = 3) {
  const { c, ctx } = makeCanvas(512, 384);
  ctx.lineWidth = 9;
  blob(ctx, 256, 250, 165, 11, 0.16, seed);
  ctx.fill(); ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(150, 250); ctx.lineTo(235, 170); ctx.lineTo(330, 235);
  ctx.moveTo(235, 170); ctx.lineTo(250, 330);
  ctx.stroke();
  return toTexture(c);
}

export function crateTexture() {
  const { c, ctx } = makeCanvas(512, 512);
  ctx.lineWidth = 10;

  // face frontal + topo em perspectiva falsa
  ctx.beginPath();
  ctx.moveTo(70, 150); ctx.lineTo(330, 100); ctx.lineTo(450, 160);
  ctx.lineTo(450, 430); ctx.lineTo(70, 470);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(70, 150); ctx.lineTo(190, 205); ctx.lineTo(450, 160);
  ctx.moveTo(190, 205); ctx.lineTo(190, 470);
  ctx.stroke();

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(210, 230); ctx.lineTo(430, 200);
  ctx.moveTo(210, 440); ctx.lineTo(430, 400);
  ctx.moveTo(215, 235); ctx.lineTo(428, 398);
  ctx.stroke();
  return toTexture(c);
}

export function bushTexture(seed = 7) {
  const { c, ctx } = makeCanvas(384, 256);
  ctx.lineWidth = 8;
  blob(ctx, 192, 175, 110, 22, 0.18, seed);
  ctx.fill(); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(140, 200); ctx.lineTo(160, 140);
  ctx.moveTo(210, 210); ctx.lineTo(230, 130);
  ctx.stroke();
  return toTexture(c);
}

export function poleTexture() {
  const { c, ctx } = makeCanvas(256, 768);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.rect(100, 60, 56, 660);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(40, 120); ctx.lineTo(216, 120);
  ctx.moveTo(60, 150); ctx.lineTo(196, 150);
  ctx.stroke();
  return toTexture(c);
}

/* ---------------- PNGs externos ---------------- */

// Carrega um PNG e recorta a moldura transparente em volta do desenho.
// Devolve a textura ja aparada + o tamanho util em pixels, para o sprite
// receber a proporcao certa no mundo (sem esticar nem flutuar).
export function loadTrimmedTexture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { try { resolve(trim(img)); } catch (e) { reject(e); } };
    img.onerror = () => reject(new Error('nao consegui carregar ' + url));
    img.src = url;
  });
}

function trim(img, alphaCut = 16) {
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);

  const { data } = sctx.getImageData(0, 0, src.width, src.height);
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (data[(y * src.width + x) * 4 + 3] > alphaCut) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = src.width - 1; y1 = src.height - 1; }

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, w, h);

  return { texture: toTexture(out), width: w, height: h };
}

/* ---------------- efeitos ---------------- */

export function puffTexture() {
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(30,30,30,.55)');
  g.addColorStop(1, 'rgba(30,30,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

/* ---------------- paredes das cabanas ---------------- */

// traco tremido, desenhado em duas passadas como caneta em papel
function rabisco(ctx, x1, y1, x2, y2, wob = 1.6, passadas = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const passos = Math.max(3, Math.round(Math.hypot(dx, dy) / 14));
  for (let p = 0; p < passadas; p++) {
    ctx.beginPath();
    for (let i = 0; i <= passos; i++) {
      const t = i / passos;
      const x = x1 + dx * t + (Math.random() - 0.5) * wob;
      const y = y1 + dy * t + (Math.random() - 0.5) * wob;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Tabuas verticais com veios. Repetivel na horizontal: as tabuas caem em
// posicoes fixas e os veios ficam longe das bordas.
export function plankTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = INK;

  const tabuas = 3;
  const larg = S / tabuas;
  for (let i = 0; i <= tabuas; i++) {
    ctx.lineWidth = 3.5;
    rabisco(ctx, i * larg, 0, i * larg, S, 2.2);
  }

  // veios e nós dentro de cada tabua
  ctx.lineWidth = 1.6;
  for (let i = 0; i < tabuas; i++) {
    const x0 = i * larg + 10, x1 = (i + 1) * larg - 10;
    for (let v = 0; v < 5; v++) {
      const y = 30 + Math.random() * (S - 60);
      rabisco(ctx, x0 + Math.random() * 20, y, x1 - Math.random() * 20, y + (Math.random() - 0.5) * 26, 2.6, 1);
    }
    if (Math.random() < 0.7) {
      const cx = x0 + Math.random() * (x1 - x0), cy = 60 + Math.random() * (S - 120);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7 + Math.random() * 5, 4 + Math.random() * 3, Math.random(), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return toTexture(c, { repeat: null });
}

// Tijolos rabiscados, em fiadas alternadas.
export function brickTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = INK;

  const fiadas = 8;
  const alt = S / fiadas;
  const larg = S / 4;

  ctx.lineWidth = 2.6;
  for (let f = 0; f <= fiadas; f++) rabisco(ctx, 0, f * alt, S, f * alt, 2);

  for (let f = 0; f < fiadas; f++) {
    const desl = (f % 2) * (larg / 2);
    for (let x = desl; x < S + 1; x += larg) {
      rabisco(ctx, x, f * alt, x, (f + 1) * alt, 1.8);
    }
    // marquinhas soltas dentro dos tijolos
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const x = 20 + Math.random() * (S - 40);
      const y = f * alt + alt * 0.4 + Math.random() * alt * 0.2;
      rabisco(ctx, x, y, x + 10 + Math.random() * 14, y + (Math.random() - 0.5) * 5, 1.6, 1);
    }
    ctx.lineWidth = 2.6;
  }
  return toTexture(c);
}

// Telhado: telhas em escamas rabiscadas.
export function roofTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;

  const fiadas = 7, alt = S / fiadas, larg = S / 6;
  for (let f = 0; f <= fiadas; f++) rabisco(ctx, 0, f * alt, S, f * alt, 2.2);
  for (let f = 0; f < fiadas; f++) {
    const desl = (f % 2) * (larg / 2);
    ctx.lineWidth = 2;
    for (let x = desl; x < S + 1; x += larg) {
      rabisco(ctx, x, f * alt + alt * 0.25, x, (f + 1) * alt, 1.8, 1);
    }
  }
  return toTexture(c);
}

// Piso interno: tabuas largas com juntas.
export function floorTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;

  const tabuas = 5, alt = S / tabuas;
  for (let i = 0; i <= tabuas; i++) rabisco(ctx, 0, i * alt, S, i * alt, 2.2);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < tabuas; i++) {
    for (let k = 0; k < 3; k++) {
      const x = 30 + Math.random() * (S - 60);
      const y = i * alt + alt * 0.5 + (Math.random() - 0.5) * alt * 0.4;
      rabisco(ctx, x, y, x + 40 + Math.random() * 60, y + (Math.random() - 0.5) * 6, 2, 1);
    }
    // junta entre tabuas
    const jx = 40 + Math.random() * (S - 80);
    ctx.lineWidth = 2.2;
    rabisco(ctx, jx, i * alt, jx, (i + 1) * alt, 1.8, 1);
    ctx.lineWidth = 1.4;
  }
  return toTexture(c);
}

// Tufo de grama: folhas curvas de contorno preto e miolo branco, base
// transparente. A base fica levemente cortada para o tufo "brotar" do chao.
export function grassTexture() {
  const S = 320;
  const { c, ctx } = makeCanvas(S, S);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // folha gorda e curva, contorno fino: de longe o tufo continua claro
  const folha = (baseX, topX, topoY, larg, curva) => {
    const baseY = S - 2;
    const meioY = (baseY + topoY) * 0.5;
    const meioX = (baseX + topX) * 0.5 + curva;

    ctx.beginPath();
    ctx.moveTo(baseX - larg / 2, baseY);
    ctx.quadraticCurveTo(meioX - larg * 0.45, meioY, topX, topoY);
    ctx.quadraticCurveTo(meioX + larg * 0.45, meioY, baseX + larg / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(baseX, baseY - 10);
    ctx.quadraticCurveTo(meioX, meioY + 10, topX, topoY + 22);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };

  // poucas folhas, largas, uma atras da outra
  folha(70, 26, 120, 62, -14);
  folha(250, 292, 128, 60, 14);
  folha(118, 86, 44, 70, -8);
  folha(206, 236, 52, 68, 8);
  folha(162, 158, 14, 78, 0);

  return toTexture(c);
}

// bolinha usada nos pontos da trajetoria da granada
export function dotTexture() {
  const { c, ctx } = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(20,20,20,1)');
  g.addColorStop(.55, 'rgba(20,20,20,.9)');
  g.addColorStop(1, 'rgba(20,20,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

export function blobShadowTexture() {
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.42)');
  g.addColorStop(.6, 'rgba(0,0,0,.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}
