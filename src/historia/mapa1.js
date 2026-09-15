import * as THREE from 'three';
import * as M from './moveis.js';

// Fase 1 — o predio. Planta (metros):
//
//   nucleo do predio   x -2..34, z -10..10, andares a cada 3,4 m
//   corredor           z -1.6..1.6 em todo andar
//   escada LESTE       x 34..45.7  (andar 0 -> 1; acima dela o teto caiu)
//   escada OESTE       x -13.7..-2 (andar 1 -> terraco; no andar 0 esta trancada)
//   terraco            y 10.2, heliponto no meio
//
// Caminho: quarto (andar 0) -> corredor -> escada leste -> andar 1, corredor
// bloqueado pelo desabamento -> atravessa os apartamentos 46 e 45 pelo buraco
// na parede -> escada oeste -> sobe dois andares -> terraco -> helicoptero.

export const H = 3.4;
export const Y_TERRACO = 3 * H;

const JANELA = { base: 0.95, topo: 2.2, janela: true };
const porta = (de, ate, tex, extra = {}) => ({ de, ate, base: 0, topo: 2.15, porta: { tex, ...extra } });
const vao = (de, ate, topo = 2.15) => ({ de, ate, base: 0, topo });
const janela = (de, ate) => ({ de, ate, ...JANELA });

export function construirMapa(k, T) {
  const ref = { piscar: [], luzes: [] };

  rua(k, T);
  fachada(k, T);
  andar0(k, T, ref);
  andar1(k, T, ref);
  andar2(k, T);
  escadaLeste(k, T, ref);
  escadaOeste(k, T, ref);
  terraco(k, T, ref);
  return ref;
}

/* ---------------- fora do predio ---------------- */

function rua(k, T) {
  // rua 3 andares abaixo (o quarto e no "3o andar")
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshLambertMaterial({ map: T.rua, emissive: new THREE.Color(0x333333) }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = -10;
  chao.receiveShadow = true;
  k.grupo.add(chao);

  // horizonte da cidade em volta
  const cilindro = new THREE.Mesh(
    new THREE.CylinderGeometry(150, 150, 70, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: T.skyline, transparent: true, alphaTest: 0.2, side: THREE.BackSide, fog: false })
  );
  cilindro.position.y = 25;
  k.grupo.add(cilindro);

  // predios vizinhos, para as tomadas de fora terem escala
  const vizinhos = [
    [-40, 30, 16, 34, 14], [-36, -28, 12, 22, 18], [70, 24, 20, 40, 14], [66, -30, 14, 26, 16],
    [16, 46, 30, 18, 12], [10, -46, 26, 30, 12], [-70, 0, 18, 46, 20], [100, 0, 20, 30, 24],
  ];
  for (const [x, z, w, h, d] of vizinhos) {
    k.caixa({ x, y: -10, z, w, h, d, mat: 'fachada', colide: false, solido: false, contorno: true });
  }
}

// paredes de fora abaixo do andar 0 (os andares de baixo, que nao se visita)
function fachada(k) {
  const y = -10, h = 10;
  const faixas = [
    ['x', 10.1, -2.1, 34.1], ['x', -10.1, -2.1, 34.1],
    ['z', -2.1, -10.1, 10.1], ['z', 34.1, -10.1, 10.1],
  ];
  for (const [eixo, fixo, de, ate] of faixas) {
    const len = ate - de, meio = (de + ate) / 2;
    if (eixo === 'x') k.caixa({ x: meio, y, z: fixo, w: len, h, d: 0.3, mat: 'fachada', colide: false, solido: false });
    else k.caixa({ x: fixo, y, z: meio, w: 0.3, h, d: len, mat: 'fachada', colide: false, solido: false });
  }
  for (const [x0, x1] of [[-13.8, -2], [34, 45.8]]) {
    k.caixa({ x: (x0 + x1) / 2, y, z: 0, w: x1 - x0, h, d: 8.8, mat: 'fachada', colide: false, solido: false });
  }
}

// paredes de fora de um andar do nucleo
function externas(k, y, { oeste = [], leste = [], norte = [], sul = [] }) {
  k.parede('z', -2, -10, 10, y, H, oeste, { externa: true });
  k.parede('z', 34, -10, 10, y, H, leste, { externa: true });
  k.parede('x', 10, -2, 34, y, H, norte, { externa: true });
  k.parede('x', -10, -2, 34, y, H, sul, { externa: true });
}

const JANELAS_NORTE = [janela(1, 3), janela(10.5, 12.5), janela(19.5, 21.5), janela(30, 32)];
const JANELAS_SUL = [janela(0.5, 2.5), janela(12, 14), janela(25, 27), janela(30.5, 32.5)];

/* ---------------- andar 0: o quarto e o corredor ---------------- */

function andar0(k, T, ref) {
  const y = 0;
  k.laje(-2, 34, -10, 10, y, { mat: 'piso' });
  // carpete no corredor (decalque por cima do piso)
  k.plano(T.carpete, 35.6, 3.0, { x: 16, y: y + 0.01, z: 0, rx: -Math.PI / 2, transparente: false });
  k.laje(-2, 34, -10, 10, y + H, { pisavel: false, mat: 'concreto', teto: 'forro' });

  externas(k, y, {
    oeste: [janela(-8, -6.5), porta(-1.3, 1.3, T.portaSaida), janela(5, 6.9)],
    leste: [janela(-8.5, -6.5), vao(-1.5, 1.5, 2.4), janela(6.5, 8.5)],
    norte: JANELAS_NORTE,
    sul: JANELAS_SUL,
  });

  // corredor
  k.parede('x', 1.6, -2, 34, y, H, [
    porta(4.5, 5.9, T.porta31, { aberta: true, lado: -1, angulo: 1.9 }),
    porta(8, 9.2, T.porta32),
    porta(16.9, 18.3, T.porta33arrombada, { aberta: true, lado: -1, angulo: 2.3 }),
    vao(25.5, 27.5, 2.3),
    porta(29.9, 31.3, T.porta34, { aberta: true, lado: -1, angulo: 1.6 }),
  ]);
  k.parede('x', -1.6, -2, 34, y, H, [
    porta(5, 6.4, T.portaLavanderia, { aberta: true, lado: 1, angulo: 1.7 }),
    porta(12, 13.2, T.porta35),
    porta(22, 23.4, T.porta36arrombada, { aberta: true, lado: 1, angulo: 2.1 }),
  ]);

  // divisorias norte
  k.parede('z', 7, 1.6, 10, y, H);
  k.parede('z', 16, 1.6, 10, y, H);
  k.parede('z', 25, 1.6, 10, y, H);
  k.parede('z', 28.5, 1.6, 10, y, H);
  k.parede('x', 4.6, 25, 28.5, y, H);
  // banheiro e armario atras do quarto
  k.parede('x', 7.5, -2, 7, y, H, [porta(1.5, 2.5, T.portaBanheiro, { aberta: true, lado: -1, angulo: 1.4 })]);
  k.parede('z', 3, 7.5, 10, y, H);
  // divisorias sul
  k.parede('z', 8, -10, -1.6, y, H);
  k.parede('z', 20, -10, -1.6, y, H);

  // ----- o quarto (x -2..7, z 1.6..7.5) -----
  M.cama(k, { x: -1.2, y, z: 5.9, larg: 1.3, comp: 2.1, cabeceira: '+z' });
  const topo = M.mesaCabeceira(k, { x: 0.05, y, z: 7.1 });
  ref.abajur = M.abajur(k, { x: 0.12, y: topo, z: 7.2 });
  ref.faca = M.faca(k, { x: -0.02, y: topo, z: 6.98, ang: 0.6 });
  ref.facaPos = new THREE.Vector3(-0.02, topo, 6.98);
  M.escrivaninha(k, { x: 6.5, y, z: 4.2, w: 0.75, d: 1.5, telaTex: T.telaPc, virada: '-x' });
  ref.monitorPos = new THREE.Vector3(6.6, y + 1.15, 4.2);
  M.cadeira(k, { x: 5.6, y, z: 4.1, encosto: '-x' });
  M.guardaRoupa(k, { x: 5.2, y, z: 7.15, w: 2.2, d: 0.6, frente: '-z' });
  M.estante(k, { x: -1.78, y, z: 2.9, w: 1.4, d: 0.36, eixo: 'z', seed: 4 });
  k.plano(T.tapete, 2.6, 1.9, { x: 2.3, y: y + 0.012, z: 4.4, rx: -Math.PI / 2, transparente: false });
  k.plano(T.poster, 0.75, 1.0, { x: 6.89, y: y + 1.75, z: 6.2, ry: -Math.PI / 2, transparente: false });
  k.plano(T.quadro, 0.7, 0.55, { x: 2.0, y: y + 1.7, z: 7.39, ry: Math.PI, transparente: false });
  M.caixaPapelao(k, { x: 3.4, y, z: 6.9, s: 0.55 });
  M.caixaPapelao(k, { x: 3.4, y: y + 0.42, z: 6.9, s: 0.42, rot: 0.3 });
  // roupa jogada e tenis
  k.caixa({ x: 1.8, y, z: 2.6, w: 0.7, h: 0.08, d: 0.5, mat: 'cobertor', rot: 0.5, colide: false, contorno: true });
  k.caixa({ x: 0.9, y, z: 4.1, w: 0.3, h: 0.1, d: 0.12, mat: '#dddddd', rot: 0.2, colide: false, contorno: true });
  k.caixa({ x: 1.05, y, z: 4.3, w: 0.3, h: 0.1, d: 0.12, mat: '#dddddd', rot: -0.4, colide: false, contorno: true });

  // banheiro
  M.vasoSanitario(k, { x: -1.2, y, z: 9.5 });
  M.pia(k, { x: 1.2, y, z: 9.6 });
  k.plano(T.azulejoParede, 4.8, 2.0, { x: 0.5, y: y + 1.0, z: 9.89, ry: Math.PI, transparente: false });

  // ----- corredor -----
  for (const lx of [2, 10, 18, 26, 32]) {
    const l = k.luminaria(lx, y + H - 0.25, 0, { intensidade: lx === 18 ? 4 : 6 });
    if (lx === 18) ref.piscar.push(l);
  }
  M.extintor(k, { x: 14.5, y, z: 1.45 });
  M.vaso(k, { x: -1.4, y, z: -1.1 });
  M.vaso(k, { x: 33.4, y, z: 1.1 });
  M.sacoLixo(k, { x: 11, y, z: -1.25 });
  M.sacoLixo(k, { x: 11.5, y, z: -1.2, s: 0.4 });
  k.plano(T.placa('301', { h: 128, w: 256 }), 0.36, 0.18, { x: 5.2, y: y + 2.35, z: 1.49, ry: Math.PI });
  k.plano(T.placa('SAIDA', { seta: 1, sub: 'escada leste' }), 1.2, 0.45, { x: 12, y: y + 2.6, z: -1.49 });
  k.plano(T.placa('SAIDA', { seta: 1 }), 1.0, 0.38, { x: 28, y: y + 2.6, z: 1.49, ry: Math.PI });
  k.plano(T.placa('TRANCADA', { sub: 'saida oeste bloqueada' }), 1.1, 0.42, { x: -1.89, y: y + 2.45, z: 0, ry: Math.PI / 2 });
  k.plano(T.pichacao('FORA'), 2.4, 1.2, { x: 20, y: y + 1.3, z: -1.49 });
  k.plano(T.placa('FORA DE SERVICO', { h: 160 }), 1.6, 0.5, { x: 26.5, y: y + 2.55, z: 1.49, ry: Math.PI });
  // elevador arrombado: poco escuro atras das portas abertas
  k.caixa({ x: 26.75, y: -10, z: 3.1, w: 3.2, h: 13.2, d: 2.8, mat: '#161616', colide: false, emissivo: 0x000000 });
  k.barreira(26.5, 1.9, 2.2, 0.3, y, y + H);
  k.caixa({ x: 25.9, y, z: 1.72, w: 0.9, h: 2.3, d: 0.06, mat: '#9a9a9a', colide: false, contorno: true });
  k.caixa({ x: 27.1, y, z: 1.72, w: 0.9, h: 2.3, d: 0.06, mat: '#9a9a9a', colide: false, contorno: true, rot: 0.5 });
  k.plano(T.fita, 2.2, 0.25, { x: 26.5, y: y + 1.2, z: 1.5, ry: Math.PI, duplo: true });

  // ----- ap 33 (arrombado, bagunca e caixa de suprimento) -----
  M.sofa(k, { x: 20.5, y, z: 8.9, w: 2.2, costas: '+z' });
  M.tv(k, { x: 20.5, y, z: 3.0, eixo: 'x' });
  M.mesa(k, { x: 22.5, y, z: 5.8, w: 1.3, d: 0.8, virada: true });
  M.cadeira(k, { x: 18.6, y, z: 5.5, caida: true });
  M.estante(k, { x: 16.3, y, z: 7.5, w: 1.6, d: 0.36, eixo: 'z', seed: 9 });
  k.luminaria(20.5, y + H - 0.25, 6, { intensidade: 3 });

  // ----- ap 34 (emboscada perto da escada) -----
  M.cama(k, { x: 32.9, y, z: 8.4, larg: 1.2, comp: 2.0, cabeceira: '+x' });
  M.guardaRoupa(k, { x: 29.1, y, z: 7.4, w: 1.6, d: 0.6, frente: '+x' });
  M.caixaPapelao(k, { x: 31.5, y, z: 5.2 });
  M.caixaPapelao(k, { x: 32.2, y, z: 5.0, s: 0.5 });

  // ----- lavanderia (sul, x -2..8) -----
  for (let i = 0; i < 4; i++) M.maquinaLavar(k, { x: -1.2 + i * 0.75, y, z: -9.55, frente: '+z' });
  M.bancada(k, { x0: 3.5, x1: 7.8, z: -9.6, y, pia: true });
  M.sacoLixo(k, { x: 6.8, y, z: -3.0 });
  M.caixaPapelao(k, { x: 1.0, y, z: -4.5, s: 0.7 });
  M.caixaPapelao(k, { x: 1.7, y, z: -4.2, s: 0.5, rot: 0.6 });
  k.luminaria(3, y + H - 0.25, -6, { intensidade: 3.5 });

  // ----- ap 36 (barricada dos invasores) -----
  M.mesa(k, { x: 25.5, y, z: -4.5, w: 1.6, virada: true });
  M.sofa(k, { x: 29.5, y, z: -5.2, w: 2.0, costas: '-x' });
  M.caixaPapelao(k, { x: 23.8, y, z: -6.8, s: 0.7 });
  M.caixaPapelao(k, { x: 24.6, y, z: -7.2, s: 0.7 });
  M.caixaPapelao(k, { x: 24.2, y: y + 0.52, z: -7.0, s: 0.55, rot: 0.2 });
  M.geladeira(k, { x: 33.4, y, z: -9.4 });
  M.bancada(k, { x0: 28, x1: 33, z: -9.6, y });
  k.luminaria(27, y + H - 0.25, -6, { intensidade: 4 });
}

/* ---------------- andar 1: corredor desabado ---------------- */

function andar1(k, T, ref) {
  const y = H;
  k.laje(-2, 34, -10, 10, y, { mat: 'piso' });
  k.plano(T.carpete, 35.6, 3.0, { x: 16, y: y + 0.01, z: 0, rx: -Math.PI / 2, transparente: false });
  k.laje(-2, 34, -10, 10, y + H, { pisavel: false, mat: 'concreto', teto: 'forro' });

  externas(k, y, {
    oeste: [janela(-8, -6.5), vao(-1.2, 1.2), janela(5.5, 7.5)],
    leste: [janela(-8.5, -6.5), vao(-1.5, 1.5, 2.4), janela(6.5, 8.5)],
    norte: JANELAS_NORTE,
    sul: JANELAS_SUL,
  });

  k.parede('x', 1.6, -2, 34, y, H, [
    porta(4.6, 5.8, T.porta44),
    porta(10, 11.2, T.porta43),
    porta(20, 21.2, T.porta42),
    porta(29.9, 31.3, T.porta41, { aberta: true, lado: -1, angulo: 1.5 }),
  ]);
  k.parede('x', -1.6, -2, 34, y, H, [
    porta(3, 4.4, T.porta45, { aberta: true, lado: 1, angulo: 1.8 }),
    porta(19.5, 20.9, T.porta46arrombada, { aberta: true, lado: 1, angulo: 2.2 }),
    porta(27, 28.2, T.porta47),
  ]);
  k.parede('z', 7, 1.6, 10, y, H);
  k.parede('z', 16, 1.6, 10, y, H);
  k.parede('z', 25, 1.6, 10, y, H);
  k.parede('z', 28.5, 1.6, 10, y, H);
  k.parede('x', 4.6, 25, 28.5, y, H);
  k.caixa({ x: 26.75, y, z: 1.72, w: 2.1, h: 2.3, d: 0.08, mat: '#9a9a9a', contorno: true });
  k.caixa({ x: 26.75, y: -10 + 13.3, z: 3.1, w: 3.2, h: H, d: 2.8, mat: '#161616', colide: false, emissivo: 0x000000 });
  // ap 46 -> ap 45: buraco na parede
  k.parede('z', 8, -10, -1.6, y, H, [{ de: -6.9, ate: -4.5, base: 0, topo: 2.3 }]);
  k.parede('z', 22, -10, -1.6, y, H);
  M.entulho(k, { x: 8, y, z: -5.7, w: 1.6, h: 0.7, tex: T.entulho, blocos: 4, seed: 12 });
  k.plano(T.pichacao('>>'), 1.5, 0.75, { x: 8.11, y: y + 2.6, z: -5.7, ry: Math.PI / 2 });

  // desabamento no corredor (x 12.5..17.5): passagem fechada
  M.entulho(k, { x: 15, y, z: 0, w: 3.4, h: 2.8, tex: T.entulho, blocos: 10, seed: 5 });
  k.caixa({ x: 15, y: y + 1.0, z: 0.2, w: 5.4, h: 0.4, d: 0.4, mat: 'concreto', rot: 0, colide: false, contorno: true }).rotation.z = 0.45;
  k.barreira(15, 0, 5.2, 3.2, y, y + H);
  k.plano(T.placa('PERIGO', { sub: 'desabamento' }), 1.1, 0.42, { x: 18.2, y: y + 1.5, z: 0, ry: Math.PI / 2, duplo: true });

  for (const lx of [2, 8, 22, 28, 32]) {
    const l = k.luminaria(lx, y + H - 0.25, 0, { intensidade: 5 });
    if (lx === 22 || lx === 2) ref.piscar.push(l);
  }
  k.plano(T.placa('SAIDA', { seta: -1, sub: 'escada oeste' }), 1.2, 0.45, { x: 26, y: y + 2.6, z: -1.49 });

  // corredor: armarios tombados servem de cobertura
  k.caixa({ x: 24.5, y, z: 0.7, w: 0.6, h: 1.1, d: 1.6, mat: 'madeira', contorno: true });
  k.caixa({ x: 21.8, y, z: -0.9, w: 1.7, h: 0.9, d: 0.6, mat: 'madeira', contorno: true });
  M.caixaPapelao(k, { x: 29.5, y, z: -1.1 });
  M.sacoLixo(k, { x: 19, y, z: 1.2 });

  // ----- ap 41 (suprimento perto da escada leste) -----
  M.cama(k, { x: 32.8, y, z: 8.6, cabeceira: '+x' });
  M.estante(k, { x: 29.0, y, z: 6.5, w: 1.4, eixo: 'z', seed: 7 });
  k.luminaria(31, y + H - 0.25, 5, { intensidade: 3 });

  // ----- ap 46 (x 8..22, sul): sala e cozinha, caminho obrigatorio -----
  M.bancada(k, { x0: 9, x1: 14, z: -9.6, y });
  M.geladeira(k, { x: 8.6, y, z: -9.4 });
  M.mesa(k, { x: 12.5, y, z: -6.8, w: 1.4, d: 0.9 });
  M.cadeira(k, { x: 11.5, y, z: -6.8, encosto: '-x' });
  M.cadeira(k, { x: 13.8, y, z: -7.2, caida: true });
  M.sofa(k, { x: 18.5, y, z: -5.5, w: 2.2, costas: '+x' });
  M.tv(k, { x: 21.5, y, z: -5.5, eixo: 'z' });
  M.estante(k, { x: 15.5, y, z: -9.75, w: 1.8, eixo: 'x', seed: 2 });
  M.mesa(k, { x: 16.5, y, z: -3.2, w: 1.4, virada: true });
  k.luminaria(15, y + H - 0.25, -6, { intensidade: 3.5 });

  // ----- ap 45 (x -2..8, sul) -----
  M.cama(k, { x: -1.0, y, z: -8.6, larg: 1.4, comp: 2.0, cabeceira: '-x' });
  M.guardaRoupa(k, { x: 3.2, y, z: -9.6, w: 2.0, d: 0.6, frente: '+z' });
  M.caixaPapelao(k, { x: 5.5, y, z: -4.0, s: 0.7 });
  M.caixaPapelao(k, { x: 6.3, y, z: -4.4, s: 0.6 });
  M.caixaPapelao(k, { x: 5.9, y: y + 0.52, z: -4.2, s: 0.5, rot: 0.4 });
  M.sofa(k, { x: 1.5, y, z: -4.4, w: 2.0, costas: '-z' });
  k.luminaria(3, y + H - 0.25, -6, { intensidade: 2.5 });
}

/* ---------------- andar 2: nao se visita, so fecha o predio ---------------- */

function andar2(k, T) {
  const y = 2 * H;
  k.laje(-2, 34, -10, 10, y, { mat: 'piso' });
  externas(k, y, {
    oeste: [janela(-8, -6.5), porta(-1.2, 1.2, T.portaBarricada), janela(5.5, 7.5)],
    leste: [janela(-8.5, -6.5), janela(-1, 1), janela(6.5, 8.5)],
    norte: JANELAS_NORTE,
    sul: JANELAS_SUL,
  });
  // tabuas pregadas na porta da escada
  for (const [dy, a] of [[0.7, 0.3], [1.4, -0.25], [1.9, 0.15]]) {
    k.caixa({ x: -2.18, y: y + dy, z: 0, w: 0.05, h: 0.16, d: 2.8, mat: 'madeira', colide: false, contorno: true }).rotation.x = a;
  }
}

/* ---------------- escada leste (andar 0 -> 1) ---------------- */

function escadaLeste(k, T, ref) {
  const x0 = 34, x1 = 45.7, zl = 4.3;
  k.laje(x0, x1, -zl, zl, 0, { mat: 'concreto' });
  k.parede('x', zl, x0, x1, 0, 2 * H, [janela(40, 41.5)], { mat: 'concreto', externa: true });
  k.parede('x', -zl, x0, x1, 0, 2 * H, [janela(40, 41.5)], { mat: 'concreto', externa: true });
  k.parede('z', x1, -zl, zl, 0, 2 * H, [{ de: -1, ate: 1, base: 2.2, topo: 3.2, janela: true }], { mat: 'concreto', externa: true });
  k.caixa({ x: 39.75, y: 0, z: 0, w: 6.5, h: 2 * H, d: 0.3, mat: 'concreto' });   // parede do meio

  k.lance(36.5, 43, 0.15, 4.1, 0, H / 2, 'x', 'min');
  k.laje(43, 45.6, -4.1, 4.1, H / 2, { mat: 'concreto', esp: 0.3 });
  k.lance(36.5, 43, -4.1, -0.15, H / 2, H, 'x', 'max');
  k.laje(34, 36.5, -4.1, 4.1, H, { mat: 'concreto', esp: 0.3 });
  k.laje(x0, x1, -zl, zl, 2 * H, { pisavel: false, mat: 'concreto' });

  // guarda-corpo do patamar de cima: nao cai no lance de baixo
  k.caixa({ x: 36.55, y: H, z: 2.1, w: 0.08, h: 1.0, d: 3.9, mat: '#777777', contorno: true, altoColisao: 2 * H });
  // o teto caiu em cima do lance que subiria mais
  M.entulho(k, { x: 38.5, y: H, z: 2.2, w: 2.6, h: 2.4, tex: T.entulho, blocos: 5, seed: 21 });

  k.plano(T.placa('1', { sub: 'andar', w: 256, h: 256 }), 0.5, 0.5, { x: 34.3, y: H + 1.8, z: -3.2, ry: Math.PI / 2 });
  k.plano(T.placa('0', { sub: 'andar', w: 256, h: 256 }), 0.5, 0.5, { x: 34.3, y: 1.8, z: 3.2, ry: Math.PI / 2 });
  ref.luzes.push(k.luminaria(44.3, H / 2 + 2.9, 0, { intensidade: 4 }));
  ref.luzes.push(k.luminaria(35.2, H + 2.9, 0, { intensidade: 4 }));
}

/* ---------------- escada oeste (andar 1 -> terraco) ---------------- */

function escadaOeste(k, T, ref) {
  const x0 = -13.7, x1 = -2, zl = 4.3, topo = Y_TERRACO + 3;
  k.laje(x0, x1, -zl, zl, H, { mat: 'concreto' });
  k.parede('x', zl, x0, x1, 0, topo, [], { mat: 'concreto', externa: true });
  k.parede('x', -zl, x0, x1, 0, topo, [], { mat: 'concreto', externa: true });
  k.parede('z', x0, -zl, zl, 0, topo, [], { mat: 'concreto', externa: true });
  // janelinhas para entrar luz nos patamares
  for (const yy of [H * 1.5, H * 2.5]) {
    k.plano(T.janelinha, 1.2, 0.9, { x: x0 + 0.11, y: yy + 1.5, z: 0, ry: Math.PI / 2, transparente: false });
  }
  k.caixa({ x: -7.75, y: H, z: 0, w: 6.5, h: topo - H, d: 0.3, mat: 'concreto' });

  for (const andar of [1, 2]) {
    const y = andar * H;
    k.lance(-11, -4.5, 0.15, 4.1, y, y + H / 2, 'x', 'max');
    k.laje(-13.6, -11, -4.1, 4.1, y + H / 2, { mat: 'concreto', esp: 0.3 });
    k.lance(-11, -4.5, -4.1, -0.15, y + H / 2, y + H, 'x', 'min');
    k.laje(-4.5, -2.1, -4.1, 4.1, y + H, { mat: 'concreto', esp: 0.3 });
    ref.luzes.push(k.luminaria(-12.3, y + H / 2 + 2.9, 0, { intensidade: 3.5 }));
    ref.luzes.push(k.luminaria(-3.3, y + H + 2.9, 0, { intensidade: andar === 2 ? 2 : 3.5 }));
    k.plano(T.placa(String(andar + 1), { sub: andar === 2 ? 'terraco' : 'andar', w: 256, h: 256 }), 0.5, 0.5, { x: -2.3, y: y + H + 1.8, z: 3.3, ry: -Math.PI / 2 });
  }
  // casa de maquinas no terraco: porta para fora
  k.parede('z', -2, -zl, zl, Y_TERRACO, 3, [porta(-0.7, 0.7, T.portaTerraco, { aberta: true, lado: -1, angulo: 1.7 })], { mat: 'concreto' });
  k.laje(x0, x1, -zl, zl, topo, { pisavel: false, mat: 'concreto' });
  k.plano(T.pichacao('SOBE'), 1.8, 0.9, { x: -4.4, y: 2 * H + 1.6, z: -4.18 });
}

/* ---------------- terraco ---------------- */

function terraco(k, T, ref) {
  const y = Y_TERRACO;
  k.laje(-2, 34, -10, 10, y, { mat: 'concreto', teto: 'forro' });

  // mureta com barreira alta (nao da para pular para a rua)
  const mureta = (eixo, fixo, de, ate) => {
    const len = ate - de, meio = (de + ate) / 2;
    if (eixo === 'x') k.caixa({ x: meio, y, z: fixo, w: len, h: 1.05, d: 0.3, mat: 'concreto', altoColisao: y + 4, contorno: true });
    else k.caixa({ x: fixo, y, z: meio, w: 0.3, h: 1.05, d: len, mat: 'concreto', altoColisao: y + 4, contorno: true });
  };
  mureta('x', 9.95, -2, 34);
  mureta('x', -9.95, -2, 34);
  mureta('z', 33.95, -10, 10);
  mureta('z', -1.95, -10, -4.3);
  mureta('z', -1.95, 4.3, 10);

  // heliponto
  k.plano(T.heliponto, 11, 11, { x: 17, y: y + 0.015, z: 0, rx: -Math.PI / 2 });
  ref.helicoptero = M.helicoptero(k, { x: 17, y, z: 0 });
  ref.helicopteroPos = new THREE.Vector3(17, y, 0);

  // cobertura para o tiroteio
  ref.ventoinhas = [
    M.arCondicionado(k, { x: 4, y, z: -7 }),
    M.arCondicionado(k, { x: 6.2, y, z: -7 }),
    M.arCondicionado(k, { x: 7.5, y, z: 5.5, w: 2.2, d: 1.4 }),
    M.arCondicionado(k, { x: 27, y, z: -6.5, w: 2.4, d: 1.4 }),
    M.arCondicionado(k, { x: 11, y, z: -2.8 }),
  ];
  M.caixaDagua(k, { x: 29.5, y, z: 6 });
  ref.luzAntena = M.antena(k, { x: 31.5, y, z: -8, h: 8 });
  k.caixa({ x: 12, y, z: 7, w: 3, h: 0.7, d: 1.6, mat: '#dedede', contorno: true });            // claraboia
  k.caixa({ x: 24, y, z: 3.6, w: 1.2, h: 1.2, d: 1.2, mat: 'caixote', contorno: true });
  k.caixa({ x: 24.9, y, z: 4.3, w: 1.0, h: 1.0, d: 1.0, mat: 'caixote', contorno: true });
  k.caixa({ x: 22.5, y, z: -4.4, w: 1.2, h: 1.2, d: 1.2, mat: 'caixote', contorno: true });
  k.cilindro({ x: 2, y, z: 7.8, r: 0.35, h: 1.4, mat: '#bbbbbb' });
  k.cilindro({ x: 19, y, z: -8.6, r: 0.3, h: 1.1, mat: '#bbbbbb' });
  k.luminaria(-3.3, y + 2.75, 0, { intensidade: 2 });
}
