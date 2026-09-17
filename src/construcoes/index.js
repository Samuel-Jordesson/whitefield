import { Construtor } from '../historia/construtor.js';
import { texturasConstrucoes } from './texturas.js';
import { montarCasa } from './casa.js';
import { montarPredio } from './predio.js';
import { CASA, PREDIO } from './pontos.js';

// A casa e o predio que ficam de pe no mapa do jogo online e do solo. Sao
// sempre iguais (nao dependem da semente da partida), entao dao para montar
// uma vez so e reaproveitar de partida em partida.

export { CASA, PREDIO, CONSTRUCOES, FOOTPRINTS, emConstrucao } from './pontos.js';

let cache = null;

// o Construtor monta tudo em volta da origem; aqui a construcao inteira
// (desenho, paredes que barram e pisos onde da para pisar) vai para o lugar
function deslocar(k, dx, dz) {
  k.grupo.position.set(dx, 0, dz);
  for (const b of k.barreiras) { b.x += dx; b.z += dz; }
  for (const p of k.pisos) { p.x0 += dx; p.x1 += dx; p.z0 += dz; p.z1 += dz; }
}

export function construcoesDoMapa() {
  if (cache) return cache;

  const tex = texturasConstrucoes();
  const grupos = [], barreiras = [], pisos = [], solidos = [], andares = [];

  for (const [montar, spec] of [[montarCasa, CASA], [montarPredio, PREDIO]]) {
    const k = new Construtor(tex.blocos);
    // cada andar devolve o grupo do recheio dele (moveis e paredes de dentro)
    for (const a of montar(k, tex.mapa)) {
      andares.push({ ...a, x: spec.x, z: spec.z, perto: Math.max(spec.w, spec.d) / 2 + 22 });
    }
    deslocar(k, spec.x, spec.z);
    k.grupo.name = spec.kind;
    // predio parado: calcula as matrizes uma vez e some com o custo por quadro
    k.grupo.updateMatrixWorld(true);
    k.grupo.matrixWorldAutoUpdate = false;
    grupos.push(k.grupo);
    barreiras.push(...k.barreiras);
    pisos.push(...k.pisos);
    solidos.push(...k.solidos);
  }

  cache = { grupos, barreiras, pisos, solidos, andares };
  return cache;
}

// Chamado a cada quadro: so os andares perto de quem esta jogando ficam
// ligados. De longe a construcao vira so a casca, que e o que da para ver
// mesmo — e o jogo economiza alguns milhares de pecas por quadro.
export function atualizarConstrucoes(pos) {
  if (!cache) return;
  for (const a of cache.andares) {
    const perto = Math.abs(pos.y - a.y) < 5.5
      && Math.hypot(pos.x - a.x, pos.z - a.z) < a.perto;
    if (a.grupo.visible !== perto) a.grupo.visible = perto;
  }
}
