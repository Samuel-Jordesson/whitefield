// Medidas e pontos das duas construcoes fixas do mapa: a casa de dez andares
// no meio do campo e o predio do lado leste.
//
// De proposito este arquivo nao importa o three: o servidor tambem le daqui
// (pelo mapgen) para saber onde nascem as caixas e onde nao pode ter cabana.

export const CASA = {
  kind: 'casa',
  x: 0, z: 0, rot: 0,
  w: 16, d: 13,        // x -8..8, z -6.5..6.5
  h: 3.0,              // pe-direito de cada andar
  andares: 10,
  raio: 13,            // area limpa em volta (nada de arvore nem cabana)
};

export const PREDIO = {
  kind: 'predio',
  x: 58, z: 26, rot: 0,
  w: 22, d: 17,        // x -11..11, z -8.5..8.5 (em volta do centro dele)
  h: 3.4,
  andares: 5,
  raio: 17,
};

export const CONSTRUCOES = [CASA, PREDIO];

// o que a grama precisa saber para nao nascer dentro da construcao
export const FOOTPRINTS = CONSTRUCOES.map((c) => ({
  kind: c.kind, x: c.x, z: c.z, rot: 0, w: c.w, d: c.d,
}));

// true se o ponto cai em cima (ou colado) de alguma construcao
export function emConstrucao(x, z, folga = 0) {
  return CONSTRUCOES.some((c) => Math.hypot(c.x - x, c.z - z) < c.raio + folga);
}

// Caixas de suprimento la dentro. `andar` vira altura pelo pe-direito, entao
// a caixa nasce em cima da laje certa.
const spot = (c) => (andar, x, z) => ({ x: c.x + x, y: andar * c.h, z: c.z + z });

const naCasa = spot(CASA);
export const CAIXAS_CASA = [
  naCasa(0, 2.8, -5.0),    // sala, perto da escada
  naCasa(1, 2.6, 4.6),     // sala de jantar
  naCasa(2, 1.4, -5.2),    // quarto do casal
  naCasa(3, -6.6, 4.4),    // quarto das criancas
  naCasa(4, 2.4, -1.4),    // escritorio
  naCasa(5, -3.2, 4.8),    // lavanderia
  naCasa(6, -6.8, -5.0),   // sala de tv
  naCasa(7, 2.8, 3.0),     // quarto de hospedes
  naCasa(8, 0.2, -4.2),    // deposito
  naCasa(9, -6.0, 0.4),    // cobertura
  naCasa(10, -4.4, 3.6),   // terraco
];

const noPredio = spot(PREDIO);
export const CAIXAS_PREDIO = [
  noPredio(0, -9.4, 3.6),   // sala do terreo
  noPredio(1, -6.8, -4.6),  // apartamento sul
  noPredio(1, 9.2, 5.0),    // apartamento norte
  noPredio(2, 1.6, 4.0),
  noPredio(3, -7.4, -5.4),  // o apartamento abandonado
  noPredio(3, 5.0, -5.6),   // deposito do fim do corredor
  noPredio(4, 1.6, 4.0),
  noPredio(5, 0.6, -4.0),   // terraco
];

export const CAIXAS_CONSTRUCOES = [...CAIXAS_CASA, ...CAIXAS_PREDIO];
