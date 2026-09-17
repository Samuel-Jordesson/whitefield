// Geracao do mapa: cabanas, caixas e o sorteio do que vem dentro.
// Fica aqui porque o servidor usa para as salas online e o cliente usa para a
// partida solo — os dois precisam gerar exatamente a mesma coisa.

import { CAIXAS_CONSTRUCOES, emConstrucao } from './construcoes/pontos.js';

export function makeRng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x9E3779B9) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tudo que existe para carregar — o servidor confere a lapide contra esta lista
export const ITENS_VALIDOS = ['granada', 'vida', 'cigarro', 'colete', 'rifle', 'pistola', 'faca', 'escopeta', 'snipe'];

// Colete: absorve parte do dano ate acabar os pontos dele
export const COLETE = { max: 100, absorve: 0.6 };

// divide o dano entre o colete e a vida; devolve quanto sobra de cada
export function danoComColete(dano, colete = 0) {
  const noColete = Math.min(colete, Math.round(dano * COLETE.absorve));
  return { dano: dano - noColete, colete: colete - noColete };
}

// carga padrao (arma 1, arma 2, faca) de quem ainda nao escolheu no EQUIPAR
export const LOADOUT_INICIAL = ['pistola', null, 'faca'];

export const HUT_KINDS = ['madeira', 'tijolo', 'barracao'];
export const HUT_SIZE = { madeira: 5.0, tijolo: 5.6, barracao: 6.5 };   // raio ocupado

// Cabanas: onde ficam, qual modelo e para que lado estao viradas.
// Vao junto com a semente, entao nascem iguais em todas as telas.
export function makeHuts(seed, count = 7) {
  const rnd = makeRng(seed ^ 0x5bf03635);
  const huts = [];

  // roda os tres modelos em ordem embaralhada, para nao sair so barracao
  const sorteio = [];
  while (sorteio.length < count) {
    const baralho = [...HUT_KINDS];
    while (baralho.length) sorteio.push(baralho.splice(Math.floor(rnd() * baralho.length), 1)[0]);
  }

  for (let i = 0; huts.length < count && i < count * 40; i++) {
    const kind = sorteio[huts.length];
    const ang = rnd() * Math.PI * 2;
    const r = 22 + rnd() * 78;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;

    // nao deixa uma cabana encostar na outra nem na casa/predio do mapa
    const longe = huts.every((h) =>
      Math.hypot(h.x - x, h.z - z) > HUT_SIZE[h.kind] + HUT_SIZE[kind] + 6);
    if (!longe || emConstrucao(x, z, HUT_SIZE[kind] + 4)) continue;

    huts.push({ id: huts.length, kind, x, z, rot: rnd() * Math.PI * 2 });
  }
  return huts;
}

// Caixas de suprimento: as melhores ficam dentro das cabanas, o resto fica
// espalhado pelo campo. O conteudo e decidido aqui, no servidor.
export function makeBoxes(seed, huts = [], soltas = 8) {
  const rnd = makeRng(seed);
  const boxes = [];

  const conteudo = (rico) => {
    const sorteio = rnd();
    const items = rico
      ? (sorteio < 0.3 ? ['granada', 'granada'] : sorteio < 0.6 ? ['vida', 'vida'] : ['granada', 'vida'])
      : (sorteio < 0.35 ? ['granada'] : sorteio < 0.7 ? ['vida'] : ['granada', 'vida']);
    if (rnd() < 0.3) items.push(rnd() < 0.5 ? 'granada' : 'vida');
    // cigarro: item raro, so aparece nas caixas boas e mesmo assim quase nunca
    if (rnd() < (rico ? 0.12 : 0.03)) items.push('cigarro');
    // arma voce escolhe no EQUIPAR do operador; caixa tem so suprimento e colete
    if (rnd() < (rico ? 0.4 : 0.15)) items.unshift('colete');
    return items;
  };

  // 1 ou 2 caixas dentro de cada cabana
  for (const h of huts) {
    const dentro = 1 + (rnd() < 0.45 ? 1 : 0);
    const meia = HUT_SIZE[h.kind] * 0.42;
    for (let k = 0; k < dentro; k++) {
      const lx = (rnd() - 0.5) * 2 * meia;
      const lz = (rnd() - 0.5) * 2 * meia;
      boxes.push({
        id: boxes.length,
        x: h.x + lx * Math.cos(h.rot) + lz * Math.sin(h.rot),
        z: h.z - lx * Math.sin(h.rot) + lz * Math.cos(h.rot),
        dentroDe: h.id,
        items: conteudo(true),
      });
    }
  }

  // caixas da casa do meio e do predio: uma em cada andar, sempre no mesmo
  // canto (a construcao nao muda de partida para partida, so o conteudo)
  for (const p of CAIXAS_CONSTRUCOES) {
    boxes.push({ id: boxes.length, x: p.x, y: p.y, z: p.z, items: conteudo(true) });
  }

  // e as soltas pelo campo (sorteia de novo se cair em cima da casa ou do predio)
  for (let i = 0; i < soltas; i++) {
    let x = 0, z = 0;
    for (let tenta = 0; tenta < 12; tenta++) {
      const ang = rnd() * Math.PI * 2;
      const r = 12 + rnd() * 85;
      x = Math.cos(ang) * r; z = Math.sin(ang) * r;
      if (!emConstrucao(x, z, 3)) break;
    }
    boxes.push({ id: boxes.length, x, z, items: conteudo(false) });
  }
  return boxes;
}

