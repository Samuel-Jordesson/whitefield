import * as THREE from 'three';

// Todas as texturas dos sprites 2D sao desenhadas em canvas, no mesmo estilo
// da arma.png: preenchimento branco + contorno preto.

export const INK = '#141414';
export const PAPER = '#ffffff';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  return { c, ctx };
}

export function toTexture(c, { repeat = null, filter = THREE.LinearFilter } = {}) {
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

export function blob(ctx, cx, cy, r, points, wob, seed = 1) {
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

// Lapide "RIP" onde alguem morreu. `destaque` engrossa o traco e poe um
// brilho de rabisco em volta — e a versao que aparece quando da para saquear.
export function tombstoneTexture(destaque = false) {
  const { c, ctx } = makeCanvas(384, 512);
  const esq = 70, dir = 314, topo = 70, base = 452, meio = (esq + dir) / 2;

  if (destaque) {
    ctx.lineWidth = 5;
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 0.95 + (i / 13) * Math.PI * 0.9;
      const r1 = 150, r2 = 182 + (i % 2) * 14;
      rabisco(ctx, meio + Math.cos(a) * r1, 190 + Math.sin(a) * r1,
                   meio + Math.cos(a) * r2, 190 + Math.sin(a) * r2, 2, 1);
    }
  }

  // pedra com o topo arredondado
  ctx.lineWidth = destaque ? 14 : 10;
  ctx.beginPath();
  ctx.moveTo(esq, base);
  ctx.lineTo(esq, topo + 120);
  ctx.arc(meio, topo + 120, meio - esq, Math.PI, 0);
  ctx.lineTo(dir, base);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // monte de terra na frente
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(24, 492);
  ctx.quadraticCurveTo(meio, 410, 360, 492);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.lineWidth = 4;
  rabisco(ctx, 90, 472, 130, 462, 2, 1);
  rabisco(ctx, 240, 466, 290, 476, 2, 1);

  // rachadura e sombreado de lado
  ctx.lineWidth = 4;
  rabisco(ctx, 272, 150, 252, 200, 2, 1);
  rabisco(ctx, 252, 200, 268, 236, 2, 1);
  for (let y = 250; y < 420; y += 22) rabisco(ctx, 290, y, 306, y - 14, 1.5, 1);

  // RIP
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 104px "Betania Patmos", "Comic Sans MS", cursive';
  ctx.fillText('RIP', meio, 250);
  ctx.lineWidth = 5;
  rabisco(ctx, 116, 318, 268, 318, 2.5, 2);
  // cruzinha
  rabisco(ctx, meio, 356, meio, 420, 2, 2);
  rabisco(ctx, meio - 22, 376, meio + 22, 376, 2, 2);

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
// `maxLado` reduz imagens enormes (ex.: 3000 px) antes de virar textura.
export function loadTrimmedTexture(url, maxLado = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { try { resolve(trim(img, 16, maxLado)); } catch (e) { reject(e); } };
    img.onerror = () => reject(new Error('nao consegui carregar ' + url));
    img.src = url;
  });
}

function trim(img, alphaCut = 16, maxLado = 0) {
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
  const escala = maxLado > 0 ? Math.min(1, maxLado / Math.max(w, h)) : 1;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w * escala));
  out.height = Math.max(1, Math.round(h * escala));
  out.getContext('2d').drawImage(src, x0, y0, w, h, 0, 0, out.width, out.height);

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
export function rabisco(ctx, x1, y1, x2, y2, wob = 1.6, passadas = 2) {
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

/* ---------------- explosao ---------------- */

// Nuvem de fumaca: varios blocos macios sobrepostos, branca (a cor vem do
// material, que escurece ou clareia a fumaca ao longo da vida dela).
export function smokeTexture(seed = 1) {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  let a = seed * 9301 + 49297;
  const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);

  // bolas de fumaca bem definidas, cada uma com topo claro e base escura —
  // e isso que da volume de nuvem em vez de nevoa lisa
  const bolas = [];
  for (let i = 0; i < 11; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() * 52;
    bolas.push({
      x: S / 2 + Math.cos(ang) * dist,
      y: S / 2 + Math.sin(ang) * dist * 0.8,
      r: 26 + rnd() * 34,
    });
  }
  bolas.sort((p, q) => q.y - p.y);   // as de baixo primeiro, as de cima por cima

  for (const b of bolas) {
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(205,205,205,0.85)');
    g.addColorStop(0.85, 'rgba(150,150,150,0.55)');
    g.addColorStop(1, 'rgba(120,120,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // granulado fino para nao parecer plastico
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const n = (rnd() - 0.5) * 26;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // apaga as bordas para o quadrado nunca aparecer
  ctx.globalCompositeOperation = 'destination-in';
  const borda = ctx.createRadialGradient(S / 2, S / 2, S * 0.22, S / 2, S / 2, S * 0.5);
  borda.addColorStop(0, 'rgba(0,0,0,1)');
  borda.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = borda;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';

  return toTexture(c);
}

// Bola de fogo: miolo quase branco, amarelo, laranja e borda transparente.
export function fireTexture() {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,252,235,1)');
  g.addColorStop(0.22, 'rgba(255,226,140,1)');
  g.addColorStop(0.48, 'rgba(255,150,40,0.85)');
  g.addColorStop(0.75, 'rgba(210,70,10,0.35)');
  g.addColorStop(1, 'rgba(120,30,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // labaredas irregulares por cima
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 50;
    const x = S / 2 + Math.cos(ang) * d, y = S / 2 + Math.sin(ang) * d;
    const r = 18 + Math.random() * 30;
    const f = ctx.createRadialGradient(x, y, 0, x, y, r);
    f.addColorStop(0, 'rgba(255,190,70,0.7)');
    f.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = f;
    ctx.fillRect(0, 0, S, S);
  }
  return toTexture(c);
}

// Faisca: ponto quente com brilho em volta.
export function sparkTexture() {
  const { c, ctx } = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(255,190,80,0.9)');
  g.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

// Marca de queimado no chao: mancha escura de borda irregular.
export function scorchTexture() {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  for (let i = 0; i < 16; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = Math.random() * 40;
    const x = S / 2 + Math.cos(ang) * d, y = S / 2 + Math.sin(ang) * d;
    const r = 50 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(20,20,20,0.35)');
    g.addColorStop(1, 'rgba(20,20,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
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
