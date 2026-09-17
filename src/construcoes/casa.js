import * as M from '../historia/moveis.js';
import { interior } from './util.js';
import { CASA } from './pontos.js';

// A casa do meio do campo: dez andares, escada de verdade ligando todos eles,
// terraco em cima e um comodo diferente em cada andar. Planta (metros, com a
// casa centrada em 0,0):
//
//   corpo da casa      x -8..8, z -6.5..6.5, um andar a cada 3 m
//   caixa de escada    x 4.3..8, z -6.5..1.6 (vazio ate z 0.4, patamar depois)
//   varanda da frente   z 6.5..8.9, na porta de entrada
//
// A escada e o de sempre: um lance sobe meio andar ate o patamar do fundo,
// o outro volta ao lado dele e chega no andar de cima.

const H = CASA.h;
const ANDARES = CASA.andares;
const TOPO = ANDARES * H;

const X0 = -8, X1 = 8;         // paredes de fora (eixo do bloco)
const Z0 = -6.5, Z1 = 6.5;
const EX = 4.3;                // parede que fecha a escada
const VZ = 0.4;                // limite do vazio da escada
const PZ = 1.6;                // parede norte do patamar de chegada
const MEIO = 6.15;             // parede entre os dois lances

const ESP = 0.24;              // parede de fora
const INT = 0.16;              // parede de dentro

const jan = (de, ate) => ({ de, ate, base: 0.95, topo: 2.25, janela: true });
const janelao = (de, ate) => ({ de, ate, base: 0.35, topo: 2.55, janela: true });
const vao = (de, ate, topo = 2.15) => ({ de, ate, base: 0, topo });
const porta = (de, ate, tex, extra = {}) => ({ de, ate, base: 0, topo: 2.15, porta: { tex, ...extra } });

const fora = { mat: 'reboco', esp: ESP, externa: true, molduras: false, contorno: true };
const dentro = { mat: 'reboco', esp: INT };

// painel de luz no teto (so o desenho: luz de verdade custa caro no campo)
function lampada(k, x, y, z, w = 0.9) {
  k.caixa({
    x, y: y - 0.08, z, w, h: 0.07, d: 0.3, mat: '#ffffff',
    colide: false, solido: false, sombra: false, contorno: true,
  });
}

function tapete(k, T, x, y, z, w, d) {
  k.plano(T.tapete, w, d, { x, y: y + 0.015, z, rx: -Math.PI / 2, transparente: false });
}

/* ---------------- casca: lajes, paredes de fora e escada ---------------- */

// laje de um andar: tudo menos o vazio da escada
function lajeAndar(k, y, comTeto, mat = 'piso') {
  const op = { mat, teto: comTeto ? '#f1f1ee' : null };
  k.laje(X0, EX, Z0, Z1, y, op);
  k.laje(EX, X1, VZ, Z1, y, op);
}

// friso que marca a laje por fora, para a casa nao virar um bloco branco so
function friso(k, y) {
  for (const z of [Z0, Z1]) {
    k.caixa({ x: 0, y: y - 0.16, z, w: X1 - X0 + 0.5, h: 0.16, d: ESP + 0.26, mat: 'concreto', colide: false, solido: false, contorno: true });
  }
  for (const x of [X0, X1]) {
    k.caixa({ x, y: y - 0.16, z: 0, w: ESP + 0.26, h: 0.16, d: Z1 - Z0 + 0.5, mat: 'concreto', colide: false, solido: false, contorno: true });
  }
}

function externas(k, T, y, n) {
  const ultimo = n === ANDARES - 1;
  const J = ultimo ? janelao : jan;

  // frente (sul): no terreo e a porta de entrada
  k.parede('x', Z1, X0, X1, y, H, n === 0
    ? [jan(-6.2, -4.4), porta(-1.4, 0.0, T.porta('1'), { aberta: true, lado: 1, angulo: 1.9 }), jan(2.4, 4.2), jan(5.6, 7.2)]
    : [J(-6.2, -4.4), J(-1.6, 0.4), J(2.4, 4.2), J(5.6, 7.2)], fora);

  k.parede('x', Z0, X0, X1, y, H, [J(-6.6, -4.8), J(-1.2, 0.8), J(5.0, 7.0)], fora);
  k.parede('z', X0, Z0, Z1, y, H, [J(-5.2, -3.4), J(-0.9, 0.9), J(3.2, 5.0)], fora);
  k.parede('z', X1, Z0, Z1, y, H, [J(-5.0, -3.2), J(-1.6, 0.0), J(2.6, 4.6)], fora);
}

// paredes e degraus da caixa de escada de um andar
function escada(k, T, y, n) {
  // parede da escada, com a porta do patamar de chegada
  k.parede('z', EX, Z0, PZ, y, H, [porta(0.55, 1.5, T.porta(''), { aberta: true, lado: 1, angulo: 1.6 })], dentro);
  k.parede('x', PZ, EX, X1, y, H, [], dentro);
  // parede entre os dois lances
  k.caixa({ x: MEIO, y, z: (VZ - 5.1) / 2, w: 0.12, h: H, d: 5.5, mat: 'concreto' });

  // sobe meio andar ate o patamar do fundo e volta pelo lance de baixo
  k.lance(4.42, MEIO, -5.1, VZ, y, y + H / 2, 'z', 'max', { mat: 'concreto' });
  k.laje(EX + 0.1, X1 - 0.1, Z0 + 0.15, -5.1, y + H / 2, { mat: 'concreto', esp: 0.25 });
  k.lance(MEIO, 7.88, -5.1, VZ, y + H / 2, y + H, 'z', 'min', { mat: 'concreto' });

  k.plano(T.placa(String(n), { sub: 'andar', w: 256, h: 256 }), 0.5, 0.5,
    { x: EX + 0.11, y: y + 1.9, z: 1.0, ry: Math.PI / 2 });
  lampada(k, 6.1, y + H, -2.2, 0.7);
}

// terraco: mureta em volta, casinha da escada e os cacarecos de telhado
function terraco(k, T) {
  const y = TOPO;
  lajeAndar(k, y, true, 'concreto');   // ceu aberto: piso de concreto, nao tabua
  friso(k, y);

  // mureta
  const mur = (eixo, fixo, de, ate) => k.parede(eixo, fixo, de, ate, y, 1.05, [], { mat: 'concreto', esp: ESP });
  mur('x', Z1, X0, X1);
  mur('x', Z0, X0, X1);
  mur('z', X0, Z0, Z1);
  mur('z', X1, VZ, Z1);

  // casinha da escada: fecha o vazio e da para sair no terraco
  k.parede('z', EX, Z0, PZ, y, 2.5, [porta(0.55, 1.5, T.porta('T'), { aberta: true, lado: 1, angulo: 1.7 })], { mat: 'concreto', esp: INT });
  k.parede('x', PZ, EX, X1, y, 2.5, [], { mat: 'concreto', esp: INT });
  k.parede('z', X1, Z0, PZ, y, 2.5, [], { mat: 'concreto', esp: ESP, externa: true });
  k.parede('x', Z0, EX, X1, y, 2.5, [], { mat: 'concreto', esp: ESP, externa: true });
  k.laje(EX - 0.2, X1 + 0.2, Z0 - 0.2, PZ + 0.2, y + 2.7, { pisavel: false, mat: 'concreto', esp: 0.2 });

  M.caixaDagua(k, { x: -5.0, y, z: -3.4 });
  M.antena(k, { x: -6.6, y, z: 3.6, h: 6 });
  M.arCondicionado(k, { x: 1.8, y, z: -4.8 });
  M.arCondicionado(k, { x: 1.8, y, z: -2.6, w: 1.2, d: 0.9 });
  M.caixaPapelao(k, { x: 2.2, y, z: 1.4, s: 0.7 });
  M.caixaPapelao(k, { x: 2.9, y, z: 1.6, s: 0.55, rot: 0.5 });
  k.plano(T.pichacao('CASA'), 3.0, 1.5, { x: 0, y: y + 0.6, z: Z0 + 0.13, ry: 0 });
}

// varanda da frente, embaixo da porta de entrada
function varanda(k, T) {
  k.laje(-3.4, 1.8, Z1, Z1 + 2.4, 0.14, { mat: 'concreto', esp: 0.14 });
  for (const x of [-3.1, 1.5]) k.cilindro({ x, y: 0.14, z: Z1 + 2.1, r: 0.11, h: 2.7, mat: '#f0f0f0' });
  k.caixa({ x: -0.8, y: 2.84, z: Z1 + 1.2, w: 5.4, h: 0.16, d: 2.8, mat: 'telha', colide: false, contorno: true });
  k.plano(T.placa('10', { sub: 'andares', w: 256, h: 160 }), 0.5, 0.32, { x: 0.9, y: 2.2, z: Z1 + 0.14, ry: 0 });
  M.vaso(k, { x: -3.0, y: 0.14, z: Z1 + 1.0 });
}

/* ---------------- os dez andares ---------------- */

// cada planta: paredes de dentro + moveis do andar
const PLANTAS = [
  // 0 — terreo: entrada, sala, cozinha e lavabo
  {
    nome: 'sala',
    monta(k, T, y) {
      k.parede('z', -2.2, Z0, 0.9, y, H, [vao(-3.7, -2.5)], dentro);
      k.parede('x', 0.9, X0, -2.2, y, H, [], dentro);
      k.parede('x', 4.2, EX, X1, y, H, [porta(6.2, 7.3, T.porta(''), { aberta: true, lado: -1, angulo: 1.5 })], { mat: 'azulejo', esp: INT });

      // cozinha
      M.bancada(k, { x0: -7.5, x1: -3.7, z: -6.0, y, pia: true });
      M.geladeira(k, { x: -7.3, y, z: -4.6 });
      M.mesa(k, { x: -5.0, y, z: -2.6, w: 1.3, d: 0.9 });
      M.cadeira(k, { x: -5.0, y, z: -1.5, encosto: '+z' });
      M.cadeira(k, { x: -5.0, y, z: -3.7, encosto: '-z' });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -2.7, y, z: -5.0, w: 1.6, eixo: 'z', seed: 3 });

      // sala
      M.sofa(k, { x: 1.2, y, z: 4.7, w: 2.2, costas: '+z' });
      M.mesa(k, { x: 1.2, y, z: 2.9, w: 1.2, d: 0.7 });
      M.tv(k, { x: 1.2, y, z: 1.0, eixo: 'x' });
      M.vaso(k, { x: 3.6, y, z: 5.8 });
      tapete(k, T, 1.2, y, 3.2, 3.0, 2.2);
      k.plano(T.quadro, 0.7, 0.55, { x: -2.05, y: y + 1.8, z: 2.4, ry: Math.PI / 2 });

      // lavabo
      M.vasoSanitario(k, { x: 5.1, y, z: 4.9 });
      M.pia(k, { x: 7.0, y, z: 5.0 });
    },
  },

  // 1 — sala de jantar e despensa
  {
    nome: 'jantar',
    monta(k, T, y) {
      k.parede('z', -3.2, Z0, -1.2, y, H, [vao(-3.1, -2.0)], dentro);
      k.parede('x', -1.2, X0, -3.2, y, H, [], dentro);

      M.mesa(k, { x: 0.6, y, z: 2.2, w: 2.4, d: 1.1 });
      M.cadeira(k, { x: -0.3, y, z: 1.2, encosto: '-z' });
      M.cadeira(k, { x: 1.5, y, z: 1.2, encosto: '-z' });
      M.cadeira(k, { x: -0.3, y, z: 3.2, encosto: '+z' });
      M.cadeira(k, { x: 1.5, y, z: 3.2, encosto: '+z' });
      tapete(k, T, 0.6, y, 2.2, 3.4, 2.4);
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: -3.0, w: 2.2, eixo: 'z', seed: 5 });
      M.vaso(k, { x: -1.6, y, z: 5.6 });
      M.tv(k, { x: -2.6, y, z: 0.2, eixo: 'z' });

      // despensa
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -7.4, y, z: -4.0, w: 2.4, eixo: 'z', seed: 7 });
      M.caixaPapelao(k, { x: -4.2, y, z: -5.6, s: 0.7 });
      M.caixaPapelao(k, { x: -4.4, y, z: -4.7, s: 0.55, rot: 0.4 });
      M.sacoLixo(k, { x: -3.9, y, z: -2.2 });
    },
  },

  // 2 — quarto do casal e banheiro
  {
    nome: 'quarto',
    monta(k, T, y) {
      k.parede('z', -1.4, Z0, 1.2, y, H, [porta(-4.5, -3.4, T.porta(''), { aberta: true, lado: 1, angulo: 1.5 })], dentro);
      k.parede('x', 1.2, X0, -1.4, y, H, [], dentro);
      k.parede('x', 4.0, EX, X1, y, H, [porta(6.3, 7.4, T.porta(''), { aberta: true, lado: -1, angulo: 1.4 })], { mat: 'azulejo', esp: INT });

      M.cama(k, { x: -5.2, y, z: -5.0, larg: 1.7, comp: 2.0, cabeceira: '-z' });
      M.mesaCabeceira(k, { x: -6.6, y, z: -5.6 });
      M.mesaCabeceira(k, { x: -3.8, y, z: -5.6 });
      M.guardaRoupa(k, { x: -7.4, y, z: -2.4, w: 0.62, d: 1.9, frente: '+x' });
      tapete(k, T, -4.6, y, -2.6, 2.6, 1.8);
      k.plano(T.quadro, 0.7, 0.55, { x: -5.2, y: y + 2.0, z: -6.33, ry: 0 });
      M.cadeira(k, { x: -2.2, y, z: -1.0, encosto: '+x' });

      M.vasoSanitario(k, { x: 5.1, y, z: 4.7 });
      M.pia(k, { x: 7.0, y, z: 4.8 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: 3.4, w: 2.0, eixo: 'z', seed: 11 });
      M.sofa(k, { x: 0.6, y, z: 5.4, w: 1.8, costas: '+z' });
    },
  },

  // 3 — quarto das criancas
  {
    nome: 'criancas',
    monta(k, T, y) {
      k.parede('x', 0.6, X0, EX, y, H, [vao(-3.3, -2.1)], dentro);

      M.cama(k, { x: -6.2, y, z: -4.9, larg: 0.95, comp: 1.9, cabeceira: '-z' });
      M.cama(k, { x: -3.6, y, z: -4.9, larg: 0.95, comp: 1.9, cabeceira: '-z' });
      M.mesaCabeceira(k, { x: -4.9, y, z: -5.6 });
      k.plano(T.poster, 0.8, 1.05, { x: -6.2, y: y + 1.9, z: -6.33, ry: 0 });
      k.plano(T.poster, 0.8, 1.05, { x: -3.6, y: y + 1.9, z: -6.33, ry: 0 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: -3.6, w: 2.2, eixo: 'z', seed: 13 });
      M.caixaPapelao(k, { x: 1.4, y, z: -1.4, s: 0.6 });
      M.caixaPapelao(k, { x: 2.1, y, z: -1.6, s: 0.5, rot: 0.5 });
      M.guardaRoupa(k, { x: -7.4, y, z: -1.6, w: 0.62, d: 1.7, frente: '+x' });

      M.sofa(k, { x: 1.0, y, z: 5.4, w: 1.8, costas: '+z' });
      tapete(k, T, 0.4, y, 3.4, 3.2, 2.4);
      M.vaso(k, { x: 3.6, y, z: -1.6 });
    },
  },

  // 4 — escritorio e biblioteca
  {
    nome: 'escritorio',
    monta(k, T, y) {
      M.escrivaninha(k, { x: -5.6, y, z: -3.2, w: 1.7, d: 0.8, telaTex: T.telaPc, virada: '+x' });
      M.cadeira(k, { x: -4.3, y, z: -3.2, encosto: '+x' });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -5.6, y, z: -6.0, w: 2.6, eixo: 'x', seed: 17 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -2.6, y, z: -6.0, w: 2.2, eixo: 'x', seed: 19 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -7.5, y, z: 1.6, w: 3.0, eixo: 'z', seed: 23 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: 3.6, w: 2.4, eixo: 'z', seed: 29 });
      M.mesa(k, { x: 0.4, y, z: 3.6, w: 1.8, d: 1.0 });
      M.cadeira(k, { x: -0.6, y, z: 3.6, encosto: '-x' });
      M.cadeira(k, { x: 1.4, y, z: 3.6, encosto: '+x' });
      tapete(k, T, 0.4, y, 3.6, 3.0, 2.2);
      k.plano(T.quadro, 0.7, 0.55, { x: -0.6, y: y + 1.9, z: -6.33, ry: 0 });
    },
  },

  // 5 — lavanderia e despensa
  {
    nome: 'lavanderia',
    monta(k, T, y) {
      k.parede('x', -1.0, X0, EX, y, H, [vao(1.4, 2.7)], { mat: 'azulejo', esp: INT });

      M.maquinaLavar(k, { x: -7.2, y, z: -5.6, frente: '+z' });
      M.maquinaLavar(k, { x: -6.4, y, z: -5.6, frente: '+z' });
      M.bancada(k, { x0: -5.4, x1: -2.4, z: -6.0, y, pia: true });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: -4.0, w: 2.4, eixo: 'z', seed: 31 });
      M.caixaPapelao(k, { x: -6.6, y, z: -2.6, s: 0.7 });
      M.caixaPapelao(k, { x: -5.8, y, z: -2.4, s: 0.55, rot: 0.6 });
      M.sacoLixo(k, { x: -4.6, y, z: -2.2 });
      M.sacoLixo(k, { x: -4.1, y, z: -2.6, s: 0.42 });

      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -7.5, y, z: 2.6, w: 3.0, eixo: 'z', seed: 37 });
      M.mesa(k, { x: 0.6, y, z: 1.6, w: 1.6, d: 0.9 });
      M.cadeira(k, { x: 0.6, y, z: 2.7, encosto: '+z', caida: true });
      M.caixaPapelao(k, { x: 2.6, y, z: 5.6, s: 0.8 });
    },
  },

  // 6 — sala de tv
  {
    nome: 'tv',
    monta(k, T, y) {
      M.sofa(k, { x: -2.0, y, z: 1.8, w: 2.8, costas: '+z' });
      M.sofa(k, { x: -5.6, y, z: -0.6, w: 2.0, costas: '-x' });
      M.tv(k, { x: -2.0, y, z: -2.6, eixo: 'x' });
      M.mesa(k, { x: -2.0, y, z: 0.2, w: 1.4, d: 0.8 });
      tapete(k, T, -2.2, y, 0.0, 4.0, 3.0);
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: 3.4, w: 2.4, eixo: 'z', seed: 41 });
      M.vaso(k, { x: 3.5, y, z: -5.4 });
      M.vaso(k, { x: -7.3, y, z: 5.6 });
      M.mesa(k, { x: 1.0, y, z: 5.4, w: 1.4, d: 0.9 });
      M.cadeira(k, { x: 1.0, y, z: 4.4, encosto: '-z' });
      k.plano(T.quadro, 0.7, 0.55, { x: -2.0, y: y + 2.0, z: -6.33, ry: 0 });
    },
  },

  // 7 — quarto de hospedes e closet
  {
    nome: 'hospedes',
    monta(k, T, y) {
      k.parede('z', -0.6, Z0, 2.0, y, H, [porta(-3.3, -2.2, T.porta(''), { aberta: true, lado: -1, angulo: 1.7 })], dentro);
      k.parede('x', 2.0, X0, -0.6, y, H, [], dentro);

      M.cama(k, { x: -5.4, y, z: -4.9, larg: 1.2, comp: 2.0, cabeceira: '-z' });
      M.mesaCabeceira(k, { x: -4.0, y, z: -5.6 });
      M.guardaRoupa(k, { x: -7.4, y, z: -3.4, w: 0.62, d: 1.8, frente: '+x' });
      M.guardaRoupa(k, { x: -7.4, y, z: -1.4, w: 0.62, d: 1.6, frente: '+x' });
      M.cadeira(k, { x: -2.0, y, z: -2.0, encosto: '+x' });
      tapete(k, T, -4.6, y, -2.4, 2.4, 1.8);

      M.mesa(k, { x: 0.6, y, z: 4.0, w: 1.8, d: 1.0 });
      M.cadeira(k, { x: -0.4, y, z: 4.0, encosto: '-x' });
      M.vaso(k, { x: -7.2, y, z: 5.6 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: 3.5, y, z: -3.0, w: 2.2, eixo: 'z', seed: 43 });
    },
  },

  // 8 — deposito: o andar que ninguem arrumou
  {
    nome: 'deposito',
    monta(k, T, y) {
      M.entulho(k, { x: -5.2, y, z: -4.0, w: 3.0, h: 2.0, tex: T.entulho, blocos: 6, seed: 9 });
      M.caixaPapelao(k, { x: -2.4, y, z: -5.4, s: 0.8 });
      M.caixaPapelao(k, { x: -2.6, y, z: -4.4, s: 0.6, rot: 0.5 });
      M.caixaPapelao(k, { x: -1.6, y, z: -5.2, s: 0.55, rot: 0.2 });
      M.caixaPapelao(k, { x: 3.2, y, z: 4.8, s: 0.75 });
      M.caixaPapelao(k, { x: 3.4, y, z: 3.8, s: 0.6, rot: 0.7 });
      M.mesa(k, { x: 1.6, y, z: -2.0, virada: true });
      M.cadeira(k, { x: -1.0, y, z: 2.0, caida: true });
      M.sacoLixo(k, { x: -6.4, y, z: 1.0 });
      M.sacoLixo(k, { x: -5.9, y, z: 1.4, s: 0.42 });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -7.5, y, z: 4.0, w: 2.6, eixo: 'z', seed: 47 });
      k.plano(T.pichacao('SOBE'), 2.4, 1.2, { x: -3.0, y: y + 1.8, z: -6.33, ry: 0 });
    },
  },

  // 9 — cobertura: pouca parede e muita janela
  {
    nome: 'cobertura',
    monta(k, T, y) {
      M.sofa(k, { x: 0.4, y, z: 4.8, w: 2.8, costas: '+z' });
      M.mesa(k, { x: 0.4, y, z: 2.8, w: 1.8, d: 1.0 });
      M.cadeira(k, { x: -0.8, y, z: 2.8, encosto: '-x' });
      M.cadeira(k, { x: 1.6, y, z: 2.8, encosto: '+x' });
      tapete(k, T, 0.4, y, 3.6, 4.0, 3.0);
      M.tv(k, { x: 0.4, y, z: 0.8, eixo: 'x' });
      M.estante(k, { grosso: 2.6, prateleiras: 3, x: -7.5, y, z: -2.0, w: 3.2, eixo: 'z', seed: 53 });
      M.vaso(k, { x: -7.2, y, z: 5.6 });
      M.vaso(k, { x: 3.5, y, z: 5.6 });
      M.vaso(k, { x: -2.0, y, z: -5.8 });
      M.escrivaninha(k, { x: -5.0, y, z: -4.6, w: 1.6, d: 0.8, telaTex: T.telaPc, virada: '+z' });
      M.cadeira(k, { x: -5.0, y, z: -3.4, encosto: '+z' });
    },
  },
];

/* ---------------- montagem ---------------- */

export function montarCasa(k, T) {
  const andares = [];
  for (let n = 0; n < ANDARES; n++) {
    const y = n * H;
    lajeAndar(k, y, n > 0);
    if (n) friso(k, y);
    externas(k, T, y, n);
    escada(k, T, y, n);
    andares.push({ y, grupo: interior(k, () => {
      PLANTAS[n].monta(k, T, y);
      lampada(k, -3.0, y + H, -2.0);
      lampada(k, 0.8, y + H, 3.0);
    }) });
  }
  terraco(k, T);
  varanda(k, T);
  return andares;
}
