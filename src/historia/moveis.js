import * as THREE from 'three';

// Moveis e objetos do predio, montados com os blocos do Construtor.
// Tudo alinhado aos eixos; `y` e a altura do piso onde o objeto esta.

const texFaca = () => {
  const t = new THREE.TextureLoader().load('itens/faca.png');
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// cama com colchao, cobertor amarrotado, travesseiro e cabeceira.
// `cabeceira` diz para que lado fica a cabeca: '+z', '-z', '+x', '-x'
export function cama(k, { x, y, z, larg = 1.1, comp = 2.0, cabeceira = '+z' }) {
  const emZ = cabeceira.endsWith('z');
  const W = emZ ? larg : comp, D = emZ ? comp : larg;
  const s = cabeceira.startsWith('+') ? 1 : -1;
  k.caixa({ x, y, z, w: W, h: 0.34, d: D, mat: 'madeira', contorno: true });
  k.caixa({ x, y: y + 0.34, z, w: W - 0.06, h: 0.18, d: D - 0.06, mat: '#f7f7f7', colide: false, contorno: true });
  // cobertor cobre 2/3 do lado dos pes, um pouco caido para fora
  const cx = emZ ? x : x - s * comp / 6, cz = emZ ? z - s * comp / 6 : z;
  k.caixa({ x: cx, y: y + 0.4, z: cz, w: emZ ? W + 0.08 : comp * 0.68, h: 0.16, d: emZ ? comp * 0.68 : D + 0.08, mat: 'cobertor', colide: false, contorno: true });
  const px = emZ ? x : x + s * (comp / 2 - 0.3), pz = emZ ? z + s * (comp / 2 - 0.3) : z;
  k.caixa({ x: px, y: y + 0.52, z: pz, w: emZ ? W * 0.7 : 0.4, h: 0.14, d: emZ ? 0.4 : D * 0.7, mat: '#ffffff', colide: false, contorno: true });
  const hx = emZ ? x : x + s * (comp / 2 + 0.04), hz = emZ ? z + s * (comp / 2 + 0.04) : z;
  k.caixa({ x: hx, y, z: hz, w: emZ ? W + 0.1 : 0.08, h: 1.0, d: emZ ? 0.08 : D + 0.1, mat: 'madeira', contorno: true });
}

export function mesaCabeceira(k, { x, y, z }) {
  k.caixa({ x, y, z, w: 0.5, h: 0.55, d: 0.45, mat: 'madeira', contorno: true });
  k.caixa({ x, y: y + 0.3, z: z + 0.23, w: 0.36, h: 0.02, d: 0.01, mat: '#222222', colide: false, solido: false });
  return y + 0.55;
}

// abajur aceso: a luz quente do quarto
export function abajur(k, { x, y, z, intensidade = 5 }) {
  k.cilindro({ x, y, z, r: 0.07, rTopo: 0.05, h: 0.3, mat: '#dddddd', colide: false });
  const cupula = k.cilindro({ x, y: y + 0.28, z, r: 0.2, rTopo: 0.12, h: 0.24, mat: '#ffffff', colide: false });
  cupula.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const luz = new THREE.PointLight(0xfff4e0, intensidade, 7, 1.5);
  luz.position.set(x, y + 0.45, z);
  k.grupo.add(luz);
  return luz;
}

// a faca em cima do movel (sai da cena quando o personagem pega)
export function faca(k, { x, y, z, ang = 0.5 }) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.13),
    new THREE.MeshBasicMaterial({ map: texFaca(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })
  );
  m.rotation.set(-Math.PI / 2, 0, ang);
  m.position.set(x, y + 0.012, z);
  k.grupo.add(m);
  return m;
}

export function escrivaninha(k, { x, y, z, w = 1.4, d = 0.7, telaTex, virada = '-x' }) {
  k.caixa({ x, y: y + 0.72, z, w, h: 0.05, d, mat: 'madeira', colide: false, contorno: true });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.caixa({ x: x + dx * (w / 2 - 0.05), y, z: z + dz * (d / 2 - 0.05), w: 0.05, h: 0.72, d: 0.05, mat: '#e5e5e5', colide: false, contorno: true, solido: false });
  }
  k.barreira(x, z, w, d, y, y + 0.77);
  // monitor + teclado
  const emX = virada.endsWith('x');
  const s = virada.startsWith('+') ? 1 : -1;
  const mx = emX ? x - s * (w / 2 - 0.2) : x, mz = emX ? z : z - s * (d / 2 - 0.15);
  k.caixa({ x: mx, y: y + 0.77, z: mz, w: 0.2, h: 0.04, d: 0.2, mat: '#333333', colide: false });
  k.caixa({ x: mx, y: y + 0.81, z: mz, w: 0.05, h: 0.2, d: 0.05, mat: '#333333', colide: false });
  const tela = k.caixa({ x: mx, y: y + 0.95, z: mz, w: emX ? 0.06 : 0.62, h: 0.4, d: emX ? 0.62 : 0.06, mat: '#2a2a2a', colide: false, contorno: true });
  if (telaTex) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), new THREE.MeshBasicMaterial({ map: telaTex }));
    p.position.set(mx + (emX ? s * 0.035 : 0), y + 1.15, mz + (emX ? 0 : s * 0.035));
    p.rotation.y = emX ? s * Math.PI / 2 : (s > 0 ? 0 : Math.PI);
    k.grupo.add(p);
    const brilho = new THREE.PointLight(0xdfe8ff, 2.2, 3.5, 1.8);
    brilho.position.set(mx + (emX ? s * 0.4 : 0), y + 1.1, mz + (emX ? 0 : s * 0.4));
    k.grupo.add(brilho);
  }
  const tx = emX ? x + s * 0.05 : x, tz = emX ? z : z + s * 0.05;
  k.caixa({ x: tx, y: y + 0.77, z: tz, w: emX ? 0.18 : 0.46, h: 0.02, d: emX ? 0.46 : 0.18, mat: '#dddddd', colide: false, contorno: true });
}

export function cadeira(k, { x, y, z, encosto = '+x', caida = false }) {
  if (caida) {
    k.caixa({ x, y, z, w: 0.5, h: 0.08, d: 0.9, mat: '#e8e8e8', rot: 0.4, colide: false, contorno: true });
    return;
  }
  k.caixa({ x, y: y + 0.45, z, w: 0.48, h: 0.06, d: 0.48, mat: '#e8e8e8', colide: false, contorno: true });
  k.cilindro({ x, y, z, r: 0.04, h: 0.45, mat: '#555555', colide: false, contorno: false });
  const emX = encosto.endsWith('x'), s = encosto.startsWith('+') ? 1 : -1;
  k.caixa({ x: x + (emX ? s * 0.22 : 0), y: y + 0.5, z: z + (emX ? 0 : s * 0.22), w: emX ? 0.05 : 0.48, h: 0.5, d: emX ? 0.48 : 0.05, mat: '#e8e8e8', colide: false, contorno: true });
  k.barreira(x, z, 0.5, 0.5, y, y + 0.9);
}

export function guardaRoupa(k, { x, y, z, w = 1.6, d = 0.6, h = 2.1, frente = '-z' }) {
  k.caixa({ x, y, z, w, h, d, mat: 'madeira', contorno: true });
  const emZ = frente.endsWith('z'), s = frente.startsWith('+') ? 1 : -1;
  // vao entre as portas e macanetas
  const fx = emZ ? x : x + s * (w / 2 + 0.005), fz = emZ ? z + s * (d / 2 + 0.005) : z;
  k.caixa({ x: fx, y: y + 0.1, z: fz, w: emZ ? 0.02 : 0.01, h: h - 0.2, d: emZ ? 0.01 : 0.02, mat: '#222222', colide: false, solido: false });
  for (const o of [-0.08, 0.08]) {
    k.caixa({ x: fx + (emZ ? o : 0), y: y + h * 0.48, z: fz + (emZ ? 0 : o), w: 0.03, h: 0.16, d: 0.03, mat: '#222222', colide: false, solido: false });
  }
}

// `grosso` junta os livros em volumes maiores: menos pecas para desenhar,
// util onde tem estante demais (a casa e o predio do mapa)
export function estante(k, { x, y, z, w = 1.2, d = 0.35, h = 1.8, eixo = 'x', seed = 1, grosso = 1, prateleiras = 4 }) {
  const W = eixo === 'x' ? w : d, D = eixo === 'x' ? d : w;
  k.caixa({ x, y, z, w: W, h, d: D, mat: 'madeira', contorno: true });
  let a = seed;
  const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  for (let prat = 0; prat < prateleiras; prat++) {
    let p = -w / 2 + 0.06;
    while (p < w / 2 - 0.12) {
      const lw = (0.04 + r() * 0.05) * grosso, lh = 0.2 + r() * 0.15;
      const px = eixo === 'x' ? x + p : x, pz = eixo === 'x' ? z : z + p;
      k.caixa({
        x: px + (eixo === 'x' ? 0 : (d / 2 + 0.01)), y: y + 0.08 + prat * 0.44, z: pz + (eixo === 'x' ? (d / 2 + 0.01) : 0),
        w: eixo === 'x' ? lw : 0.02, h: lh, d: eixo === 'x' ? 0.02 : lw,
        mat: r() < 0.5 ? '#ffffff' : '#bdbdbd', colide: false, solido: false, sombra: false,
      });
      p += lw + 0.01;
    }
  }
}

export function sofa(k, { x, y, z, w = 2.0, d = 0.9, costas = '+z' }) {
  const emZ = costas.endsWith('z'), s = costas.startsWith('+') ? 1 : -1;
  const W = emZ ? w : d, D = emZ ? d : w;
  k.caixa({ x, y, z, w: W, h: 0.45, d: D, mat: '#e9e9e6', contorno: true, altoColisao: y + 0.95 });
  k.caixa({ x: x + (emZ ? 0 : s * (d / 2 - 0.12)), y: y + 0.45, z: z + (emZ ? s * (d / 2 - 0.12) : 0), w: emZ ? W : 0.24, h: 0.5, d: emZ ? 0.24 : D, mat: '#e9e9e6', colide: false, contorno: true });
  for (const l of [-1, 1]) {
    k.caixa({ x: x + (emZ ? l * (w / 2 - 0.1) : 0), y: y + 0.45, z: z + (emZ ? 0 : l * (w / 2 - 0.1)), w: emZ ? 0.2 : D, h: 0.22, d: emZ ? D : 0.2, mat: '#e9e9e6', colide: false, contorno: true });
  }
}

export function mesa(k, { x, y, z, w = 1.4, d = 0.9, virada = false }) {
  if (virada) {
    // mesa tombada virou barricada: tampo em pe
    k.caixa({ x, y, z, w, h: 0.9, d: 0.06, mat: 'madeira', contorno: true, altoColisao: y + 1.2 });
    for (const l of [-1, 1]) k.caixa({ x: x + l * (w / 2 - 0.08), y: y + 0.4, z: z + 0.36, w: 0.06, h: 0.06, d: 0.7, mat: 'madeira', colide: false, contorno: true });
    return;
  }
  k.caixa({ x, y: y + 0.74, z, w, h: 0.05, d, mat: 'madeira', colide: false, contorno: true });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.caixa({ x: x + dx * (w / 2 - 0.06), y, z: z + dz * (d / 2 - 0.06), w: 0.06, h: 0.74, d: 0.06, mat: 'madeira', colide: false, solido: false, contorno: true });
  }
  k.barreira(x, z, w, d, y, y + 0.79);
}

export function tv(k, { x, y, z, eixo = 'x' }) {
  const W = eixo === 'x' ? 1.6 : 0.45, D = eixo === 'x' ? 0.45 : 1.6;
  k.caixa({ x, y, z, w: W, h: 0.5, d: D, mat: 'madeira', contorno: true });
  k.caixa({ x, y: y + 0.5, z, w: eixo === 'x' ? 1.2 : 0.06, h: 0.7, d: eixo === 'x' ? 0.06 : 1.2, mat: '#2a2a2a', colide: false, contorno: true });
}

export function geladeira(k, { x, y, z }) {
  k.caixa({ x, y, z, w: 0.75, h: 1.8, d: 0.7, mat: '#f5f5f5', contorno: true });
  k.caixa({ x, y: y + 1.2, z: z + 0.36, w: 0.72, h: 0.015, d: 0.01, mat: '#333333', colide: false, solido: false });
}

export function bancada(k, { x0, x1, z, y, d = 0.65, pia = true }) {
  const w = x1 - x0, x = (x0 + x1) / 2;
  k.caixa({ x, y, z, w, h: 0.88, d, mat: '#efefef', contorno: true });
  k.caixa({ x, y: y + 0.88, z, w: w + 0.04, h: 0.05, d: d + 0.04, mat: 'concreto', colide: false, contorno: true });
  for (let px = x0 + 0.6; px < x1; px += 0.6) {
    k.caixa({ x: px, y: y + 0.05, z: z + d / 2 + 0.005, w: 0.015, h: 0.78, d: 0.01, mat: '#333333', colide: false, solido: false });
  }
  if (pia) k.caixa({ x: x0 + w * 0.3, y: y + 0.9, z, w: 0.55, h: 0.04, d: 0.4, mat: '#aaaaaa', colide: false });
}

export function maquinaLavar(k, { x, y, z, frente = '+z' }) {
  k.caixa({ x, y, z, w: 0.65, h: 0.88, d: 0.65, mat: '#f7f7f7', contorno: true });
  const s = frente.startsWith('+') ? 1 : -1;
  const porta = k.cilindro({ x, y: y + 0.28, z: z + s * 0.33, r: 0.22, h: 0.04, mat: '#555555', colide: false });
  porta.rotation.x = Math.PI / 2;
  porta.position.y = y + 0.45;
}

export function vasoSanitario(k, { x, y, z }) {
  k.caixa({ x, y, z: z - 0.25, w: 0.4, h: 0.75, d: 0.18, mat: '#ffffff', contorno: true });
  k.cilindro({ x, y, z, r: 0.2, rTopo: 0.22, h: 0.42, mat: '#ffffff', colide: true });
}

export function pia(k, { x, y, z }) {
  k.cilindro({ x, y, z, r: 0.08, h: 0.8, mat: '#ffffff', colide: false });
  k.caixa({ x, y: y + 0.8, z, w: 0.55, h: 0.12, d: 0.42, mat: '#ffffff', contorno: true, altoColisao: y + 0.92 });
}

export function caixaPapelao(k, { x, y, z, s = 0.6, rot = 0 }) {
  k.caixa({ x, y, z, w: s, h: s * 0.75, d: s, mat: '#e2ddd2', rot, contorno: true, colide: !rot });
  k.caixa({ x, y: y + s * 0.75, z, w: s * 0.08, h: 0.005, d: s, mat: '#8a8378', rot, colide: false, solido: false });
}

export function sacoLixo(k, { x, y, z, s = 0.5 }) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s / 2, 10, 8), k.mat('#3a3a3a'));
  m.scale.set(1, 1.15, 0.9);
  m.position.set(x, y + s * 0.5, z);
  m.castShadow = true;
  k.contorno(m);
  k.grupo.add(m);
}

export function extintor(k, { x, y, z }) {
  k.cilindro({ x, y: y + 0.9, z, r: 0.09, h: 0.5, mat: '#333333', colide: false });
  k.caixa({ x, y: y + 1.3, z, w: 0.07, h: 0.08, d: 0.07, mat: '#333333', colide: false, solido: false });
}

export function vaso(k, { x, y, z }) {
  k.cilindro({ x, y, z, r: 0.22, rTopo: 0.28, h: 0.5, mat: '#e0e0e0' });
  const folhas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), k.mat('#f2f2f2'));
  folhas.position.set(x, y + 0.95, z);
  folhas.scale.set(1, 1.3, 1);
  folhas.castShadow = true;
  k.contorno(folhas);
  k.grupo.add(folhas);
}

// monte de entulho: planos cruzados com o desenho + blocos quebrados
export function entulho(k, { x, y, z, w = 3.2, h = 2.2, tex, blocos = 7, seed = 3 }) {
  for (const ry of [0, Math.PI / 2, Math.PI / 4]) {
    k.plano(tex, w, h, { x, y: y + h / 2 - 0.05, z, ry, duplo: true });
  }
  let a = seed;
  const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < blocos; i++) {
    const s = 0.3 + r() * 0.6;
    const m = k.caixa({
      x: x + (r() - 0.5) * w * 0.8, y: y - 0.05, z: z + (r() - 0.5) * w * 0.5,
      w: s * 1.4, h: s * 0.6, d: s, mat: 'concreto', rot: r() * Math.PI, colide: false, contorno: true,
    });
    m.rotation.z = (r() - 0.5) * 0.8;
  }
}

/* ---------------- terraco ---------------- */

export function arCondicionado(k, { x, y, z, w = 1.5, d = 1.1 }) {
  k.caixa({ x, y, z, w, h: 1.05, d, mat: '#f0f0f0', contorno: true, altoColisao: y + 1.25 });
  const helice = k.cilindro({ x, y: y + 1.05, z, r: Math.min(w, d) * 0.35, h: 0.05, mat: '#444444', colide: false });
  for (let i = -2; i <= 2; i++) {
    k.caixa({ x: x + i * (w / 6), y: y + 0.15, z: z + d / 2 + 0.005, w: 0.02, h: 0.75, d: 0.01, mat: '#555555', colide: false, solido: false });
  }
  return helice;
}

export function caixaDagua(k, { x, y, z }) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.caixa({ x: x + dx * 1.1, y, z: z + dz * 1.1, w: 0.14, h: 1.6, d: 0.14, mat: '#777777', contorno: true });
  }
  k.caixa({ x, y: y + 1.6, z, w: 2.6, h: 0.1, d: 2.6, mat: 'concreto', colide: false, contorno: true });
  k.cilindro({ x, y: y + 1.7, z, r: 1.25, h: 2.0, mat: '#f2f2f2', colide: false, lados: 20 });
  k.cilindro({ x, y: y + 3.7, z, r: 1.28, rTopo: 0.2, h: 0.5, mat: '#e5e5e5', colide: false, lados: 20 });
}

export function antena(k, { x, y, z, h = 7 }) {
  k.cilindro({ x, y, z, r: 0.08, h, mat: '#555555', colide: true, lados: 8 });
  for (let i = 1; i <= 3; i++) {
    k.caixa({ x, y: y + h * (0.45 + i * 0.15), z, w: 1.6 - i * 0.35, h: 0.05, d: 0.05, mat: '#555555', colide: false, contorno: true });
  }
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  luz.position.set(x, y + h + 0.05, z);
  k.grupo.add(luz);
  return luz;
}

// Helicoptero da fuga. Bico para -x. Devolve as pecas que giram.
export function helicoptero(k, { x, y, z }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.grupo.add(g);
  const branco = k.mat('#f4f4f4', { emissivo: 0x4a4a4a });
  const escuro = k.mat('#2a2a2a', { emissivo: 0x111111 });
  const add = (geo, mat, px, py, pz, contorno = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    if (contorno) k.contorno(m);
    g.add(m);
    k.solidos.push(m);
    return m;
  };

  const corpo = add(new THREE.SphereGeometry(1, 20, 14), branco, 0, 1.45, 0);
  corpo.scale.set(2.3, 1.15, 1.2);
  const cabine = add(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), escuro, -1.25, 1.45, 0);
  cabine.scale.set(1.2, 0.95, 1.05);
  cabine.rotation.z = Math.PI / 2 + 0.25;
  add(new THREE.BoxGeometry(1.2, 0.95, 0.04), escuro, 0.4, 1.45, 1.19, false);        // porta aberta (vao escuro)
  const cauda = add(new THREE.CylinderGeometry(0.14, 0.3, 4.6, 12), branco, 3.9, 1.75, 0);
  cauda.rotation.z = Math.PI / 2 - 0.06;
  add(new THREE.BoxGeometry(0.9, 1.2, 0.08), branco, 6.1, 2.25, 0).rotation.z = -0.35;
  add(new THREE.BoxGeometry(0.7, 0.06, 1.3), branco, 5.9, 1.9, 0);
  // esquis
  for (const l of [-1, 1]) {
    const esqui = add(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8), escuro, 0, 0.12, l * 1.0);
    esqui.rotation.z = Math.PI / 2;
    for (const px of [-0.9, 0.9]) {
      const haste = add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), escuro, px, 0.45, l * 0.85, false);
      haste.rotation.x = l * 0.3;
    }
  }
  add(new THREE.CylinderGeometry(0.25, 0.35, 0.35, 12), branco, 0.1, 2.65, 0);

  const rotor = new THREE.Group();
  rotor.position.set(0.1, 2.9, 0);
  g.add(rotor);
  for (let i = 0; i < 4; i++) {
    const pa = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.04, 0.3), escuro);
    pa.position.x = 2.7;
    const braco = new THREE.Group();
    braco.rotation.y = (i / 4) * Math.PI * 2;
    braco.add(pa);
    rotor.add(braco);
  }
  const rotorCauda = new THREE.Group();
  rotorCauda.position.set(6.15, 2.2, 0.12);
  g.add(rotorCauda);
  for (let i = 0; i < 2; i++) {
    const pa = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.03), escuro);
    pa.rotation.z = i * Math.PI / 2;
    rotorCauda.add(pa);
  }

  k.barreira(x + 0.8, z, 6.6, 2.6, y, y + 3);
  return { grupo: g, rotor, rotorCauda };
}
