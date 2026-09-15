// Perfil do jogador: nome, nivel, dinheiro e o que ja foi comprado.
// Fica no localStorage do navegador — cada maquina tem o seu.

const CHAVE = 'wf-perfil';

export const OPERADORES = {
  1: { nome: 'Personagem 1', img: 'perssonagem1/parado.png', preco: 0 },
  2: { nome: 'Personagem 2', img: 'perssonagem2/parado.png', preco: 60 },
  3: { nome: 'Jaime', img: 'Jaime/1.png', preco: 0 },
};

export const FUNDOS = {
  fundo1: { nome: 'Trincheira', img: 'fundo1.jpeg', preco: 0 },
};

// XP que cada nivel exige (vai ficando mais caro)
export function xpDoNivel(nivel) {
  return 100 + (nivel - 1) * 60;
}

const PADRAO = {
  nome: '',
  nivel: 1,
  xp: 0,
  dinheiro: 0,
  operador: 1,
  fundo: 'fundo1',
  comprados: ['op1', 'fundo1'],
  partidas: 0,
  vitorias: 0,
  abates: 0,
};

export class Profile {
  constructor() {
    this.dados = { ...PADRAO };
    this.ouvintes = [];
    this.carregar();
  }

  carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
      this.dados = { ...PADRAO, ...salvo, comprados: salvo.comprados || [...PADRAO.comprados] };
    } catch { /* perfil novo */ }
    if (!this.dados.nome) this.dados.nome = localStorage.getItem('wf-name') || '';
  }

  salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.dados));
      localStorage.setItem('wf-name', this.dados.nome);
    } catch { /* modo anonimo: fica so na memoria */ }
    for (const fn of this.ouvintes) fn(this.dados);
  }

  aoMudar(fn) { this.ouvintes.push(fn); return this; }

  get nome() { return this.dados.nome || 'Jogador'; }
  set nome(v) { this.dados.nome = String(v).slice(0, 16); this.salvar(); }
  get nivel() { return this.dados.nivel; }
  get xp() { return this.dados.xp; }
  get dinheiro() { return this.dados.dinheiro; }
  get xpFalta() { return xpDoNivel(this.dados.nivel) - this.dados.xp; }
  get progresso() { return this.dados.xp / xpDoNivel(this.dados.nivel); }

  // operador de graca vale como ja comprado (inclusive em perfis antigos)
  temItem(id) {
    if (id.startsWith('op') && OPERADORES[id.slice(2)]?.preco === 0) return true;
    return this.dados.comprados.includes(id);
  }

  // devolve true se deu para pagar
  comprar(id, preco) {
    if (this.temItem(id)) return true;
    if (this.dados.dinheiro < preco) return false;
    this.dados.dinheiro -= preco;
    this.dados.comprados.push(id);
    this.salvar();
    return true;
  }

  escolherOperador(id) {
    if (!this.temItem('op' + id)) return false;
    this.dados.operador = Number(id);
    this.salvar();
    return true;
  }

  escolherFundo(id) {
    if (!this.temItem(id)) return false;
    this.dados.fundo = id;
    this.salvar();
    return true;
  }

  ganharXp(quanto) {
    const antes = this.dados.nivel;
    this.dados.xp += quanto;
    while (this.dados.xp >= xpDoNivel(this.dados.nivel)) {
      this.dados.xp -= xpDoNivel(this.dados.nivel);
      this.dados.nivel++;
    }
    this.salvar();
    return this.dados.nivel - antes;   // quantos niveis subiu
  }

  // Modo historia: a primeira vez da moedas e bastante XP; repetir so da XP.
  concluirFase(id, tempo, abates) {
    const hist = (this.dados.historia ||= {});
    const antes = hist[id];
    const primeira = !antes?.concluida;
    const recorde = !antes?.melhorTempo || tempo < antes.melhorTempo;
    hist[id] = { concluida: true, melhorTempo: recorde ? tempo : antes.melhorTempo };
    const dinheiro = primeira ? 30 : 0;
    const xp = (primeira ? 250 : 60) + abates * 5;
    this.dados.dinheiro += dinheiro;
    this.dados.abates += abates;
    const subiu = this.ganharXp(xp);   // ja salva
    return { dinheiro, xp, subiu, primeira, recorde };
  }

  // Fim de partida. Ganha 1 por abate; vencendo, dobra; perdendo, nao leva
  // nada do que juntou (mas o saldo antigo fica intacto).
  fecharPartida({ abates, venceu }) {
    const dinheiro = venceu ? abates * 2 : 0;
    const xp = abates * 12 + (venceu ? 80 : 25);

    this.dados.partidas++;
    this.dados.abates += abates;
    if (venceu) this.dados.vitorias++;
    this.dados.dinheiro += dinheiro;

    const subiu = this.ganharXp(xp);   // ja salva
    return { dinheiro, xp, subiu, perdido: venceu ? 0 : abates };
  }
}
