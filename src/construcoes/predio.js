import * as M from '../historia/moveis.js';
import { interior } from './util.js';
import { PREDIO } from './pontos.js';

// O predio do mapa, no mesmo espirito do predio do modo historia: corredor no
// meio, apartamentos dos dois lados, escada que sobe ate o terraco. Planta
// (metros, em volta do centro do predio):
//
//   corpo         x -11..11, z -8.5..8.5, um andar a cada 3,4 m
//   corredor      z -1.7..1.7 de ponta a ponta
//   escada        x 7..11, z -8.5..-1.7 (vazio ate z -3.3, patamar depois)
//   terraco       y 17, com heliponto, caixa d'agua e antena

const H = PREDIO.h;
const ANDARES = PREDIO.andares;
const TOPO = ANDARES * H;

const X0 = -11, X1 = 11;
const Z0 = -8.5, Z1 = 8.5;
const CS = -1.7, CN = 1.7;     // paredes do corredor (sul e norte)
const EX = 7;                  // parede oeste da escada
const VZ = -3.3;               // limite do vazio da escada
const MEIO = 9.0;              // parede entre os dois lances

const ESP = 0.26;
const INT = 0.18;

const jan = (de, ate) => ({ de, ate, base: 0.95, topo: 2.3, janela: true });
const vao = (de, ate, topo = 2.2) => ({ de, ate, base: 0, topo });
const porta = (de, ate, tex, extra = {}) => ({ de, ate, base: 0, topo: 2.2, porta: { tex, ...extra } });

const fora = { mat: 'reboco', esp: ESP, externa: true, molduras: false, contorno: true };
const dentro = { mat: 'reboco', esp: INT };
const box = { mat: 'azulejo', esp: INT };

function lampada(k, x, y, z, w = 1.1) {
  k.caixa({
    x, y: y - 0.08, z, w, h: 0.07, d: 0.32, mat: '#ffffff',
    colide: false, solido: false, sombra: false, contorno: true,
  });
}

/* ---------------- casca ---------------- */

function lajeAndar(k, y, comTeto, mat = 'piso') {
  const op = { mat, teto: comTeto ? '#f1f1ee' : null };
  k.laje(X0, EX, Z0, Z1, y, op);
  k.laje(EX, X1, VZ, Z1, y, op);
}

// friso da laje por fora, igual o da casa
function friso(k, y) {
  for (const z of [Z0, Z1]) {
    k.caixa({ x: 0, y: y - 0.18, z, w: X1 - X0 + 0.5, h: 0.18, d: ESP + 0.28, mat: 'concreto', colide: false, solido: false, contorno: true });
  }
  for (const x of [X0, X1]) {
    k.caixa({ x, y: y - 0.18, z: 0, w: ESP + 0.28, h: 0.18, d: Z1 - Z0 + 0.5, mat: 'concreto', colide: false, solido: false, contorno: true });
  }
}

function externas(k, T, y, n) {
  const jansul = [jan(-9.4, -7.4), jan(-5.2, -3.2), jan(-1.0, 1.0), jan(3.4, 5.4), jan(8.2, 10.2)];
  k.parede('x', Z0, X0, X1, y, H, jansul, fora);
  k.parede('x', Z1, X0, X1, y, H, [jan(-9.4, -7.4), jan(-5.2, -3.2), jan(-1.0, 1.0), jan(3.4, 5.4), jan(7.8, 9.8)], fora);
  k.parede('z', X1, Z0, Z1, y, H, [jan(-6.6, -5.0), jan(3.0, 5.0)], fora);
  // no terreo a fachada oeste tem a porta da rua
  k.parede('z', X0, Z0, Z1, y, H, n === 0
    ? [jan(-6.6, -4.6), porta(-1.0, 1.0, T.porta('ENTRADA'), { aberta: true, lado: 1, angulo: 1.8 }), jan(4.6, 6.6)]
    : [jan(-6.6, -4.6), jan(-1.0, 1.0), jan(4.6, 6.6)], fora);
}

function escada(k, T, y, n) {
  k.parede('z', EX, Z0, CS, y, H, [], dentro);
  k.caixa({ x: MEIO, y, z: (VZ - 7.3) / 2, w: 0.12, h: H, d: 4.0, mat: 'concreto' });

  k.lance(7.15, MEIO, -7.3, VZ, y, y + H / 2, 'z', 'max', { mat: 'concreto' });
  k.laje(EX, X1 - 0.13, Z0 + 0.15, -7.3, y + H / 2, { mat: 'concreto', esp: 0.25 });
  k.lance(MEIO, 10.85, -7.3, VZ, y + H / 2, y + H, 'z', 'min', { mat: 'concreto' });

  k.plano(T.placa(String(n), { sub: 'andar', w: 256, h: 256 }), 0.55, 0.55,
    { x: 8.0, y: y + 1.9, z: CS - 0.12, ry: Math.PI });
  lampada(k, 9.0, y + H, -2.6, 0.8);
  M.extintor(k, { x: 10.6, y, z: -2.2 });
}

// corredor: as duas paredes com as portas dos apartamentos
function corredor(k, T, y, n) {
  const num = (i) => `${n}${i}`;
  // toda porta nasce aberta: no meio do tiroteio ninguem para para abrir porta
  const escancarada = (i) => ({ aberta: true, lado: i % 2 ? 1 : -1, angulo: 1.5 + ((n + i) % 4) * 0.22 });
  k.parede('x', CS, X0, X1, y, H, [
    porta(-8.4, -7.2, T.porta(num(1), n === 3), escancarada(0)),
    porta(-1.4, -0.2, T.porta(num(2)), escancarada(1)),
    porta(4.2, 5.4, T.porta('DEP'), escancarada(2)),
    vao(8.4, 9.6, 2.3),                     // entrada da escada
  ], dentro);

  k.parede('x', CN, X0, X1, y, H, [
    porta(-8.4, -7.2, T.porta(num(3)), escancarada(3)),
    porta(-1.4, -0.2, T.porta(num(4), n === 4), escancarada(4)),
    porta(5.2, 6.4, T.porta(num(5)), escancarada(5)),
  ], dentro);

  k.plano(T.carpete, 21.6, 3.2, { x: 0, y: y + 0.012, z: 0, rx: -Math.PI / 2, transparente: false });
  for (const x of [-7.5, -1.5, 4.5]) lampada(k, x, y + H, 0);

  // par de elevadores (so a porta: o poco esta interditado)
  for (const x of [-4.2, -3.0]) {
    k.caixa({ x, y, z: CN - 0.1, w: 1.0, h: 2.2, d: 0.08, mat: '#dcdcdc', colide: false, contorno: true });
  }
  k.plano(T.placa('ELEVADOR', { w: 512, h: 128 }), 1.5, 0.38, { x: -3.6, y: y + 2.45, z: CN - 0.13, ry: Math.PI });
  k.plano(T.placa('SAIDA', { seta: 1, w: 512, h: 160 }), 1.1, 0.34, { x: 7.4, y: y + 2.4, z: CS - 0.12, ry: Math.PI });
}

// paredes que separam os apartamentos
function divisorias(k, y) {
  for (const x of [-4.2, 2.6]) {
    k.parede('z', x, Z0, CS, y, H, [], dentro);
    k.parede('z', x, CN, Z1, y, H, [], dentro);
  }
}

/* ---------------- os kits de apartamento ---------------- */

// r: { x0, x1, lado } — lado +1 apartamento do norte, -1 do sul.
// zf = parede da fachada, zc = parede do corredor.
function area(r) {
  const lado = r.lado;
  return {
    ...r, lado,
    zf: lado > 0 ? Z1 : Z0,
    zc: lado > 0 ? CN : CS,
    xm: (r.x0 + r.x1) / 2,
  };
}

// banheirinho no canto do corredor
function banheiro(k, T, y, a) {
  const xw = a.x0 + 2.1;
  const za = a.zc, zb = a.zc + a.lado * 2.5;
  k.parede('z', xw, Math.min(za, zb), Math.max(za, zb), y, H, [], box);
  k.parede('x', zb, a.x0, xw, y, H, [vao(a.x0 + 0.5, a.x0 + 1.6)], box);
  M.vasoSanitario(k, { x: a.x0 + 0.7, y, z: za + a.lado * 0.7 });
  M.pia(k, { x: a.x0 + 1.6, y, z: za + a.lado * 0.55 });
}

const KITS = {
  quarto(k, T, y, a) {
    banheiro(k, T, y, a);
    M.cama(k, { x: a.xm + 1.0, y, z: a.zf - a.lado * 1.3, larg: 1.4, comp: 2.0, cabeceira: a.lado > 0 ? '+z' : '-z' });
    M.mesaCabeceira(k, { x: a.xm + 2.1, y, z: a.zf - a.lado * 0.9 });
    M.guardaRoupa(k, { x: a.x1 - 0.55, y, z: a.zf - a.lado * 3.4, w: 0.62, d: 1.8, frente: '-x' });
    M.cadeira(k, { x: a.xm - 0.6, y, z: a.zf - a.lado * 3.6, encosto: '+x' });
    k.plano(T.poster, 0.85, 1.1, { x: a.xm + 1.0, y: y + 2.0, z: a.zf - a.lado * 0.14, ry: a.lado > 0 ? Math.PI : 0 });
  },

  sala(k, T, y, a) {
    M.sofa(k, { x: a.xm, y, z: a.zf - a.lado * 1.1, w: 2.2, costas: a.lado > 0 ? '+z' : '-z' });
    M.mesa(k, { x: a.xm, y, z: a.zf - a.lado * 2.6, w: 1.3, d: 0.8 });
    M.tv(k, { x: a.xm + 2.0, y, z: a.zc + a.lado * 1.0, eixo: 'x' });
    M.estante(k, { grosso: 2.6, prateleiras: 3, x: a.x0 + 0.5, y, z: a.zf - a.lado * 2.6, w: 2.2, eixo: 'z', seed: 5 });
    M.vaso(k, { x: a.x1 - 0.6, y, z: a.zf - a.lado * 0.8 });
    k.plano(T.quadro, 0.75, 0.6, { x: a.xm + 1.6, y: y + 2.0, z: a.zf - a.lado * 0.14, ry: a.lado > 0 ? Math.PI : 0 });
  },

  cozinha(k, T, y, a) {
    M.bancada(k, { x0: a.x0 + 0.4, x1: a.x0 + 3.6, z: a.zf - a.lado * 0.55, y, pia: true });
    M.geladeira(k, { x: a.x1 - 0.7, y, z: a.zf - a.lado * 0.6 });
    M.mesa(k, { x: a.xm, y, z: a.zf - a.lado * 2.8, w: 1.4, d: 0.9 });
    M.cadeira(k, { x: a.xm - 1.0, y, z: a.zf - a.lado * 2.8, encosto: '-x' });
    M.cadeira(k, { x: a.xm + 1.0, y, z: a.zf - a.lado * 2.8, encosto: '+x' });
    M.estante(k, { grosso: 2.6, prateleiras: 3, x: a.x0 + 0.5, y, z: a.zc + a.lado * 1.4, w: 1.8, eixo: 'z', seed: 9 });
    M.sacoLixo(k, { x: a.x1 - 0.7, y, z: a.zc + a.lado * 0.9 });
  },

  escritorio(k, T, y, a) {
    M.escrivaninha(k, { x: a.xm, y, z: a.zf - a.lado * 1.0, w: 1.8, d: 0.8, telaTex: T.telaPc, virada: a.lado > 0 ? '+z' : '-z' });
    M.cadeira(k, { x: a.xm, y, z: a.zf - a.lado * 2.1, encosto: a.lado > 0 ? '+z' : '-z' });
    M.estante(k, { grosso: 2.6, prateleiras: 3, x: a.x0 + 0.5, y, z: a.zf - a.lado * 2.4, w: 2.6, eixo: 'z', seed: 13 });
    M.estante(k, { grosso: 2.6, prateleiras: 3, x: a.x1 - 0.5, y, z: a.zf - a.lado * 2.4, w: 2.6, eixo: 'z', seed: 17 });
    M.mesa(k, { x: a.xm + 1.9, y, z: a.zc + a.lado * 1.4, virada: true });
    M.caixaPapelao(k, { x: a.x0 + 1.2, y, z: a.zc + a.lado * 0.9, s: 0.6, rot: 0.4 });
  },

  vazio(k, T, y, a) {
    M.entulho(k, { x: a.xm, y, z: a.zf - a.lado * 1.6, w: 3.0, h: 2.0, tex: T.entulho, blocos: 6, seed: 21 });
    M.caixaPapelao(k, { x: a.x0 + 1.0, y, z: a.zc + a.lado * 1.2, s: 0.75 });
    M.caixaPapelao(k, { x: a.x0 + 1.8, y, z: a.zc + a.lado * 1.0, s: 0.55, rot: 0.6 });
    M.sacoLixo(k, { x: a.x1 - 1.0, y, z: a.zc + a.lado * 1.0 });
    M.sacoLixo(k, { x: a.x1 - 1.5, y, z: a.zc + a.lado * 1.5, s: 0.42 });
    M.cadeira(k, { x: a.xm + 1.4, y, z: a.zc + a.lado * 2.2, caida: true });
    k.plano(T.pichacao('FORA'), 2.6, 1.3, { x: a.xm, y: y + 1.7, z: a.zc + a.lado * 0.12, ry: a.lado > 0 ? 0 : Math.PI });
  },

  deposito(k, T, y, a) {
    M.estante(k, { grosso: 2.6, prateleiras: 3, x: a.x0 + 0.5, y, z: a.zf - a.lado * 2.0, w: 3.0, eixo: 'z', seed: 23 });
    M.caixaPapelao(k, { x: a.xm, y, z: a.zf - a.lado * 0.9, s: 0.8 });
    M.caixaPapelao(k, { x: a.xm + 0.9, y, z: a.zf - a.lado * 1.0, s: 0.6, rot: 0.3 });
    M.caixaPapelao(k, { x: a.xm + 0.2, y, z: a.zf - a.lado * 2.0, s: 0.55, rot: 0.8 });
    M.maquinaLavar(k, { x: a.x1 - 0.6, y, z: a.zf - a.lado * 0.6, frente: a.lado > 0 ? '-z' : '+z' });
    M.extintor(k, { x: a.x0 + 0.4, y, z: a.zc + a.lado * 0.6 });
  },
};

// o que tem em cada unidade de cada andar (sul: 1,2,DEP — norte: 3,4,5)
const ANDARES_PLANTA = [
  { sul: ['sala', 'cozinha', 'deposito'], norte: ['sala', 'escritorio', 'cozinha'] },
  { sul: ['quarto', 'sala', 'deposito'], norte: ['cozinha', 'quarto', 'sala'] },
  { sul: ['cozinha', 'quarto', 'deposito'], norte: ['quarto', 'sala', 'escritorio'] },
  { sul: ['vazio', 'quarto', 'deposito'], norte: ['sala', 'cozinha', 'quarto'] },
  { sul: ['quarto', 'vazio', 'deposito'], norte: ['escritorio', 'sala', 'vazio'] },
];

const UNIDADES = {
  sul: [{ x0: X0, x1: -4.2 }, { x0: -4.2, x1: 2.6 }, { x0: 2.6, x1: EX }],
  norte: [{ x0: X0, x1: -4.2 }, { x0: -4.2, x1: 2.6 }, { x0: 2.6, x1: X1 }],
};

/* ---------------- terreo e terraco ---------------- */

// no terreo o corredor vira saguao: portaria, bancos e a caixa de correio
function saguao(k, T) {
  const y = 0;
  k.caixa({ x: -9.2, y, z: 0.7, w: 2.6, h: 1.05, d: 0.6, mat: 'madeira', contorno: true });   // balcao
  k.caixa({ x: -9.2, y: 1.05, z: 0.7, w: 2.8, h: 0.06, d: 0.8, mat: 'concreto', colide: false, contorno: true });
  M.cadeira(k, { x: -9.2, y, z: 1.5, encosto: '+z' });
  for (const x of [-6.4, -5.6]) {
    k.caixa({ x, y: y + 1.1, z: CS + 0.16, w: 0.7, h: 1.0, d: 0.12, mat: '#e4e4e4', colide: false, contorno: true });
  }
  k.plano(T.placa('PORTARIA', { w: 512, h: 128 }), 1.6, 0.4, { x: -9.2, y: y + 2.4, z: 0.9, ry: Math.PI });
  M.vaso(k, { x: 6.0, y, z: 1.1 });
  M.extintor(k, { x: -0.2, y, z: CS + 0.14 });
}

function terraco(k, T) {
  const y = TOPO;
  lajeAndar(k, y, true, 'concreto');   // ceu aberto: piso de concreto, nao tabua
  friso(k, y);

  const mur = (eixo, fixo, de, ate) => k.parede(eixo, fixo, de, ate, y, 1.05, [], { mat: 'concreto', esp: ESP });
  mur('x', Z1, X0, X1);
  mur('x', Z0, X0, EX);
  mur('z', X0, Z0, Z1);
  mur('z', X1, VZ, Z1);

  // casinha da escada
  k.parede('x', CS, EX, X1, y, 2.6, [porta(8.4, 9.6, T.porta('T'), { aberta: true, lado: 1, angulo: 1.7 })], { mat: 'concreto', esp: INT });
  k.parede('z', EX, Z0, CS, y, 2.6, [], { mat: 'concreto', esp: INT });
  k.parede('z', X1, Z0, CS, y, 2.6, [], { mat: 'concreto', esp: ESP, externa: true });
  k.parede('x', Z0, EX, X1, y, 2.6, [], { mat: 'concreto', esp: ESP, externa: true });
  k.laje(EX - 0.2, X1 + 0.2, Z0 - 0.2, CS + 0.2, y + 2.8, { pisavel: false, mat: 'concreto', esp: 0.2 });

  k.plano(T.heliponto, 8.0, 8.0, { x: -3.0, y: y + 0.02, z: 1.0, rx: -Math.PI / 2 });
  M.caixaDagua(k, { x: 4.0, y, z: 5.4 });
  M.antena(k, { x: -9.4, y, z: -6.6, h: 7 });
  M.arCondicionado(k, { x: -9.2, y, z: 6.6 });
  M.arCondicionado(k, { x: -9.2, y, z: 4.4, w: 1.2, d: 0.9 });
  M.entulho(k, { x: 3.2, y, z: -6.6, w: 2.6, h: 1.8, tex: T.entulho, blocos: 5, seed: 33 });
  M.caixaPapelao(k, { x: 5.2, y, z: -3.0, s: 0.7 });
}

/* ---------------- montagem ---------------- */

export function montarPredio(k, T) {
  const andares = [];
  for (let n = 0; n < ANDARES; n++) {
    const y = n * H;
    lajeAndar(k, y, n > 0);
    if (n) friso(k, y);
    externas(k, T, y, n);
    corredor(k, T, y, n);
    divisorias(k, y);
    escada(k, T, y, n);

    const planta = ANDARES_PLANTA[n];
    andares.push({ y, grupo: interior(k, () => {
      for (const lado of ['sul', 'norte']) {
        UNIDADES[lado].forEach((u, i) => {
          const a = area({ ...u, lado: lado === 'norte' ? 1 : -1 });
          const kit = n === 0 && lado === 'sul' && i === 0 ? null : KITS[planta[lado][i]];
          kit?.(k, T, y, a);
          lampada(k, a.xm, y + H, a.zf - a.lado * 2.2);
        });
      }
      if (n === 0) saguao(k, T);
    }) });
  }
  terraco(k, T);
  return andares;
}
