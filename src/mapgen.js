// Geracao do mapa: cabanas, caixas e o sorteio do que vem dentro.
// Fica aqui porque o servidor usa para as salas online e o cliente usa para a
// partida solo — os dois precisam gerar exatamente a mesma coisa.

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
export const ITENS_VALIDOS = ['granada', 'vida', 'cigarro', 'rifle', 'pistola', 'faca', 'escopeta', 'snipe'];

// com o que todo mundo nasce: arma 1, arma 2 e o campo da faca
export const LOADOUT_INICIAL = ['pistola', null, 'faca'];

// arma sorteada numa caixa (a sniper e a mais rara)
function sortearArma(rnd) {
  const s = rnd();
  return s < 0.48 ? 'rifle' : s < 0.82 ? 'escopeta' : 'snipe';
}

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

    // nao deixa uma cabana encostar na outra
    const longe = huts.every((h) =>
      Math.hypot(h.x - x, h.z - z) > HUT_SIZE[h.kind] + HUT_SIZE[kind] + 6);
    if (!longe) continue;

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
    // ninguem nasce com rifle, escopeta ou sniper: elas estao nas caixas
    if (rnd() < (rico ? 0.55 : 0.3)) items.unshift(sortearArma(rnd));
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

  // e as soltas pelo campo
  for (let i = 0; i < soltas; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = 12 + rnd() * 85;
    boxes.push({
      id: boxes.length,
      x: Math.cos(ang) * r,
      z: Math.sin(ang) * r,
      items: conteudo(false),
    });
  }
  return boxes;
}

