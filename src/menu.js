import { OPERADORES, FUNDOS, xpDoNivel } from './profile.js';
import { OPCOES } from './settings.js';
import { WEAPONS, WEAPON_ITEMS } from './weapons.js';

const ARMAS_DE_FOGO = Object.keys(WEAPONS).filter((k) => WEAPONS[k].kind === 'gun' && WEAPON_ITEMS[k]);
const ROTULO_CAMPO = ['ARMA 1', 'ARMA 2', 'FACA'];

// resumo de uma arma para o cartao do EQUIPAR
function descricaoArma(k) {
  const w = WEAPONS[k];
  if (w.kind === 'melee') return `golpe de perto · dano ${w.damage}`;
  const dano = w.pellets ? `${w.pellets} bolinhas x ${w.damage}` : `dano ${w.damage}`;
  return `${dano} · pente ${w.mag}${w.auto ? ' · automatica' : ''}${w.luneta ? ' · luneta' : ''}`;
}

// Menu inicial no estilo dos Call of Duty: abas na lateral, painel ao lado e
// a arte de fundo cobrindo a tela.

const LOJA = [
  { id: 'skin-rifle-riscado', nome: 'Rifle Riscado', tipo: 'Skin de arma', preco: 40 },
  { id: 'skin-pistola-carvao', nome: 'Pistola Carvao', tipo: 'Skin de arma', preco: 35 },
  { id: 'acessorio-bandana', nome: 'Bandana', tipo: 'Acessorio', preco: 25 },
  { id: 'acessorio-oculos', nome: 'Oculos escuros', tipo: 'Acessorio', preco: 30 },
  { id: 'granada-fumaca', nome: 'Granada de fumaca', tipo: 'Item', preco: 50, embreve: true },
  { id: 'passe', nome: 'Passe de temporada', tipo: 'Em breve', preco: 0, embreve: true },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menu {
  constructor({ profile, settings, onCriarSala, onEntrarSala, onJogarSolo, onHistoria, toast }) {
    this.profile = profile;
    this.settings = settings;
    this.onCriarSala = onCriarSala;
    this.onEntrarSala = onEntrarSala;
    this.onJogarSolo = onJogarSolo;
    this.onHistoria = onHistoria;
    this.toast = toast;
    this.aba = 'entrar';

    this.el = {
      raiz: $('menu'),
      fundo: $('menuFundo'),
      abas: $('menuAbas'),
      pagina: $('menuPagina'),
      painel: $('menuPainel'),
      nome: $('perfilNome'),
      nivel: $('perfilNivel'),
      barra: $('perfilBarra'),
      xp: $('perfilXp'),
      dinheiro: $('perfilDinheiro'),
    };

    this.el.abas.addEventListener('click', (e) => {
      const b = e.target.closest('.aba');
      if (b) this.abrir(b.dataset.aba);
    });

    this.el.nome.addEventListener('change', () => {
      this.profile.nome = this.el.nome.value.trim() || 'Jogador';
      this.renderPerfil();
    });

    $('btnMenuVoltar').onclick = () => this.fechar();

    this.profile.aoMudar(() => this.renderPerfil());
    this.renderPerfil();
    this.fechar();
  }

  // volta para a lista de abas (a arte de fundo fica livre)
  fechar() {
    this.aba = null;
    this.el.abas.classList.remove('hidden');
    this.el.pagina.classList.add('hidden');
    for (const b of this.el.abas.querySelectorAll('.aba')) b.classList.remove('ativa');
  }

  renderPerfil() {
    const p = this.profile;
    if (document.activeElement !== this.el.nome) this.el.nome.value = p.dados.nome;
    this.el.nivel.textContent = p.nivel;
    this.el.barra.style.width = Math.min(100, p.progresso * 100) + '%';
    this.el.xp.textContent = `${p.xp} / ${xpDoNivel(p.nivel)} XP`;
    this.el.dinheiro.textContent = p.dinheiro;
    this.el.fundo.style.backgroundImage = `url('${FUNDOS[p.dados.fundo]?.img || 'fundo1.jpeg'}')`;
  }

  // cada aba vira uma pagina inteira, sem o menu do lado
  abrir(aba) {
    this.aba = aba;
    this.el.abas.classList.add('hidden');
    this.el.pagina.classList.remove('hidden');
    this.el.painel.innerHTML = this['_' + aba]?.() || '';
    this['_ligar_' + aba]?.();
  }

  /* ---------------- abas ---------------- */

  _historia() {
    const prog = this.profile.dados.historia || {};
    const tempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const f1 = prog.fase1;
    return `
      <h2>MODO HISTORIA</h2>
      <p class="menu-sub">uma noite, um predio invadido e nenhum lugar para correr — so para cima</p>
      <div class="fases">
        <button class="fase-card" data-fase="fase1">
          <span class="fase-num">1</span>
          <span>
            <span class="fase-nome">A SUBIDA</span>
            <span class="fase-desc">Invadiram o seu predio no meio da noite. Sem arma, so com uma faca,
              atravesse os corredores, suba as escadas e chegue ao helicoptero no terraco.</span>
          </span>
          <span class="fase-tag">${f1?.concluida ? `CONCLUIDA<br>melhor ${tempo(f1.melhorTempo)}` : 'JOGAR'}</span>
        </button>
        <div class="fase-card bloqueado">
          <span class="fase-num">2</span>
          <span>
            <span class="fase-nome">???</span>
            <span class="fase-desc">${f1?.concluida ? 'o helicoptero pousou em algum lugar... em breve' : 'termine a fase 1'}</span>
          </span>
          <span class="fase-tag">EM BREVE</span>
        </div>
      </div>
      <ul class="lista-info">
        <li>seu operador escolhido e o protagonista</li>
        <li>chegue perto sem correr e use a faca pelas costas: abate silencioso</li>
        <li>morreu? volta do ultimo checkpoint com o que tinha</li>
      </ul>`;
  }

  _ligar_historia() {
    for (const b of this.el.painel.querySelectorAll('[data-fase]')) {
      b.onclick = () => this.onHistoria?.(b.dataset.fase, Number(this.profile.dados.operador) || 1);
    }
  }

  _solo() {
    const p = this.profile;
    const cards = Object.entries(OPERADORES).map(([id, o]) => {
      const meu = p.temItem('op' + id);
      const usando = String(p.dados.operador) === String(id);
      return `<button class="card op-card ${usando ? 'ativo' : ''} ${meu ? '' : 'bloqueado'}" data-solo-op="${id}">
        <img src="${o.img}" alt="${esc(o.nome)}">
        <span class="card-nome">${esc(o.nome)}</span>
        <span class="card-tag">${usando ? 'ESCOLHIDO' : meu ? 'usar este' : 'bloqueado'}</span>
      </button>`;
    }).join('');

    return `
      <h2>JOGAR SOLO</h2>
      <p class="menu-sub">voce e mais 4 bots contra um time de 5 — primeiro a 50 abates ganha</p>
      <h3 class="bloco">ESCOLHA O OPERADOR</h3>
      <div class="cards">${cards}</div>
      <h3 class="bloco">ARMAS INICIAIS</h3>
      <div class="op-carga grande">${this._miniCarga(p.dados.operador)}</div>
      <div class="row"><button class="opt" id="btnSoloEquipar">EQUIPAR</button></div>
      <ul class="lista-info">
        <li>os bots do time de frente usam os outros operadores, para nao confundir</li>
        <li>aliado nao toma tiro de aliado, igual no online</li>
      </ul>
      <div class="row"><button id="btnSolo" class="primary">COMECAR PARTIDA</button></div>`;
  }

  _ligar_solo() {
    for (const b of this.el.painel.querySelectorAll('[data-solo-op]')) {
      b.onclick = () => {
        const id = b.dataset.solo_op || b.dataset.soloOp;
        if (!this.profile.temItem('op' + id)) { this.toast('libere este operador na loja'); return; }
        this.profile.escolherOperador(id);
        this.abrir('solo');
      };
    }
    $('btnSolo').onclick = () => this.onJogarSolo(Number(this.profile.dados.operador) || 1);
    $('btnSoloEquipar').onclick = () => this._abrirEquipar(this.profile.dados.operador, 'solo');
  }

  _entrar() {
    return `
      <h2>ENTRAR NA SALA</h2>
      <p class="menu-sub">cole o codigo que o dono da sala mandou</p>
      <input id="codeInput" class="code-input" maxlength="5" placeholder="ABCDE" autocomplete="off">
      <div class="row"><button id="btnJoin" class="primary">ENTRAR</button></div>
      <p class="hint error" id="joinError"></p>`;
  }

  _ligar_entrar() {
    const entrar = () => {
      const code = $('codeInput').value.trim().toUpperCase();
      if (code.length < 4) { $('joinError').textContent = 'digite o codigo da sala'; return; }
      this.onEntrarSala(code);
    };
    $('btnJoin').onclick = entrar;
    $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
    $('codeInput').focus();
  }

  _criar() {
    return `
      <h2>CRIAR SALA</h2>
      <p class="menu-sub">voce vira o dono e recebe o codigo para chamar a galera</p>
      <ul class="lista-info">
        <li>time A contra time B, primeiro a 50 abates leva</li>
        <li>da para comecar sozinho so para treinar</li>
        <li>quem entrar depois cai direto na partida</li>
      </ul>
      <div class="row"><button id="btnCreate" class="primary">CRIAR SALA</button></div>`;
  }

  _ligar_criar() { $('btnCreate').onclick = () => this.onCriarSala(); }

  _fundo() {
    const p = this.profile;
    const cards = Object.entries(FUNDOS).map(([id, f]) => {
      const meu = p.temItem(id);
      const usando = p.dados.fundo === id;
      return `<button class="card fundo-card ${usando ? 'ativo' : ''}" data-fundo="${id}">
        <img src="${f.img}" alt="${esc(f.nome)}">
        <span class="card-nome">${esc(f.nome)}</span>
        <span class="card-tag">${usando ? 'EM USO' : meu ? 'usar' : f.preco + ' moedas'}</span>
      </button>`;
    }).join('');

    return `
      <h2>PLANO DE FUNDO</h2>
      <p class="menu-sub">a arte que aparece aqui no menu</p>
      <div class="cards">${cards}
        <div class="card vazio"><span>mais fundos<br>em breve</span></div>
      </div>`;
  }

  _ligar_fundo() {
    for (const b of this.el.painel.querySelectorAll('[data-fundo]')) {
      b.onclick = () => {
        const id = b.dataset.fundo;
        const f = FUNDOS[id];
        if (!this.profile.temItem(id) && !this.profile.comprar(id, f.preco)) {
          this.toast('moedas insuficientes');
          return;
        }
        this.profile.escolherFundo(id);
        this.abrir('fundo');
      };
    }
  }

  _operador() {
    const p = this.profile;
    const cards = Object.entries(OPERADORES).map(([id, o]) => {
      const meu = p.temItem('op' + id);
      const usando = String(p.dados.operador) === String(id);
      return `<div class="op-bloco">
        <button class="card op-card ${usando ? 'ativo' : ''} ${meu ? '' : 'bloqueado'}" data-op="${id}">
          <img src="${o.img}" alt="${esc(o.nome)}">
          <span class="card-nome">${esc(o.nome)}</span>
          <span class="card-tag">${usando ? 'EM USO' : meu ? 'usar' : o.preco + ' moedas'}</span>
        </button>
        ${meu ? `<div class="op-carga">${this._miniCarga(id)}</div>
        <button class="opt eq-botao" data-equipar="${id}">EQUIPAR</button>` : ''}
      </div>`;
    }).join('');

    return `
      <h2>OPERADOR</h2>
      <p class="menu-sub">quem voce leva para a partida</p>
      <div class="cards">${cards}
        <div class="card vazio"><span>novos operadores<br>em breve</span></div>
      </div>`;
  }

  _ligar_operador() {
    for (const b of this.el.painel.querySelectorAll('[data-equipar]')) {
      b.onclick = () => this._abrirEquipar(b.dataset.equipar, 'operador');
    }
    for (const b of this.el.painel.querySelectorAll('[data-op]')) {
      b.onclick = () => {
        const id = b.dataset.op;
        const o = OPERADORES[id];
        if (!this.profile.temItem('op' + id)) {
          if (!this.profile.comprar('op' + id, o.preco)) { this.toast('moedas insuficientes'); return; }
          this.toast(o.nome + ' liberado!');
        }
        this.profile.escolherOperador(id);
        this.abrir('operador');
      };
    }
  }

  // iconezinhos das 3 armas iniciais de um operador
  _miniCarga(id) {
    return this.profile.cargaDe(id).map((k, i) => `<span class="mini ${k ? '' : 'vazio'}" title="${ROTULO_CAMPO[i]}">
      ${k ? `<img src="${WEAPON_ITEMS[k].img}" alt="${esc(WEAPON_ITEMS[k].name)}">` : '—'}</span>`).join('');
  }

  _abrirEquipar(id, voltar) {
    this.opEquipar = String(id);
    this.slotEquipar = 0;
    this.voltarEquipar = voltar;
    this.abrir('equipar');
  }

  _equipar() {
    const id = this.opEquipar;
    const o = OPERADORES[id];
    const carga = this.profile.cargaDe(id);
    const sel = this.slotEquipar ?? 0;

    const campos = carga.map((k, i) => `
      <button class="eq-slot ${i === sel ? 'ativo' : ''}" data-eq-slot="${i}">
        <span class="eq-rotulo">${ROTULO_CAMPO[i]}</span>
        ${k ? `<img src="${WEAPON_ITEMS[k].img}" alt=""><span class="eq-nome">${esc(WEAPON_ITEMS[k].name)}</span>`
            : '<span class="eq-vazio">vazio</span>'}
      </button>`).join('');

    const lista = sel === 2 ? ['faca'] : ARMAS_DE_FOGO;
    const opcoes = lista.map((k) => {
      const usando = carga[sel] === k;
      const noOutro = sel < 2 && carga[1 - sel] === k;
      return `<button class="card eq-arma ${usando ? 'ativo' : ''}" data-eq-arma="${k}">
        <img src="${WEAPON_ITEMS[k].img}" alt="">
        <span class="card-nome">${esc(WEAPON_ITEMS[k].name)}</span>
        <span class="card-tipo">${descricaoArma(k)}</span>
        <span class="card-tag">${usando ? 'EQUIPADA' : noOutro ? `troca com ${ROTULO_CAMPO[1 - sel]}` : 'equipar'}</span>
      </button>`;
    }).join('') + `<button class="card eq-arma vazio ${carga[sel] ? '' : 'ativo'}" data-eq-arma="">
        <span class="card-nome">nenhuma</span><span class="card-tag">${carga[sel] ? 'deixar vazio' : 'VAZIO'}</span>
      </button>`;

    return `
      <h2>EQUIPAR</h2>
      <p class="menu-sub">com o que <b>${esc(o.nome)}</b> nasce na partida — nas caixas do mapa agora so tem vida, granada e colete</p>
      <div class="equipar">
        <div class="eq-op"><img src="${o.img}" alt="${esc(o.nome)}"><span>${esc(o.nome)}</span></div>
        <div class="eq-slots">${campos}</div>
      </div>
      <h3 class="bloco">ESCOLHA PARA ${ROTULO_CAMPO[sel]}</h3>
      <div class="cards">${opcoes}</div>
      <div class="row"><button id="btnEqPronto" class="primary">PRONTO</button></div>`;
  }

  _ligar_equipar() {
    const id = this.opEquipar;
    for (const b of this.el.painel.querySelectorAll('[data-eq-slot]')) {
      b.onclick = () => { this.slotEquipar = Number(b.dataset.eqSlot); this.abrir('equipar'); };
    }
    for (const b of this.el.painel.querySelectorAll('[data-eq-arma]')) {
      b.onclick = () => {
        const sel = this.slotEquipar ?? 0;
        const carga = this.profile.cargaDe(id);
        const k = b.dataset.eqArma || null;
        // a mesma arma nos dois campos nao: troca de lugar
        if (k && sel < 2 && carga[1 - sel] === k) carga[1 - sel] = carga[sel];
        carga[sel] = k;
        this.profile.definirCarga(id, carga);
        // escolheu a arma 1: ja pula para a arma 2
        if (sel === 0 && k) this.slotEquipar = 1;
        this.abrir('equipar');
      };
    }
    $('btnEqPronto').onclick = () => this.abrir(this.voltarEquipar || 'operador');
  }

  _loja() {
    const p = this.profile;
    const itens = LOJA.map((it) => {
      const meu = p.temItem(it.id);
      return `<button class="card loja-card ${it.embreve ? 'bloqueado' : ''}" data-loja="${it.id}" data-preco="${it.preco}">
        <span class="card-tipo">${esc(it.tipo)}</span>
        <span class="card-nome">${esc(it.nome)}</span>
        <span class="card-tag">${it.embreve ? 'em breve' : meu ? 'COMPRADO' : it.preco + ' moedas'}</span>
      </button>`;
    }).join('');

    return `
      <h2>LOJA</h2>
      <p class="menu-sub">skins de arma, acessorios e o que vier por ai</p>
      <div class="cards">${itens}</div>`;
  }

  _ligar_loja() {
    for (const b of this.el.painel.querySelectorAll('[data-loja]')) {
      b.onclick = () => {
        const id = b.dataset.loja;
        const item = LOJA.find((i) => i.id === id);
        if (item.embreve) { this.toast('ainda nao esta pronto'); return; }
        if (this.profile.temItem(id)) { this.toast('voce ja tem isso'); return; }
        if (!this.profile.comprar(id, item.preco)) { this.toast('moedas insuficientes'); return; }
        this.toast(item.nome + ' comprado');
        this.abrir('loja');
      };
    }
  }

  // desenha as configuracoes em outro lugar (usado tambem na pausa do jogo)
  configEm(container) {
    container.innerHTML = this._config();
    this._ligar_config(container);
  }

  _config() {
    const grupos = Object.entries(OPCOES).map(([chave, op]) => {
      if (op.tipo === 'barra') {
        const v = this.settings.get(chave);
        return `<div class="cfg">
          <div class="cfg-nome">${esc(op.titulo)}<small>${esc(op.ajuda)}</small></div>
          <div class="cfg-barra">
            <input type="range" min="${op.min}" max="${op.max}" step="${op.passo}" value="${v}" data-barra="${chave}">
            <output>${op.formato(v)}</output>
          </div>
        </div>`;
      }
      const atual = this.settings.chaveDe(chave);
      const botoes = Object.entries(op.valores).map(([v, info]) =>
        `<button class="opt ${v === atual ? 'ativa' : ''} ${info.cor ? 'com-cor' : ''}" ${info.cor ? `style="--amostra:${info.cor}"` : ''} data-cfg="${chave}" data-val="${v}">${esc(info.nome)}</button>`
      ).join('');
      return `<div class="cfg">
        <div class="cfg-nome">${esc(op.titulo)}<small>${esc(op.ajuda)}</small></div>
        <div class="cfg-opts">${botoes}</div>
      </div>`;
    }).join('');

    return `
      <h2>CONFIGURACOES</h2>
      <p class="menu-sub">vale para esta maquina e fica salvo</p>
      ${grupos}`;
  }

  _ligar_config(container = this.el.painel) {
    // barra: aplica enquanto arrasta, sem redesenhar (senao solta o arraste)
    for (const r of container.querySelectorAll('[data-barra]')) {
      const chave = r.dataset.barra;
      const saida = r.parentElement.querySelector('output');
      r.oninput = () => {
        this.settings.set(chave, r.value);
        saida.textContent = OPCOES[chave].formato(this.settings.get(chave));
      };
    }
    for (const b of container.querySelectorAll('[data-cfg]')) {
      b.onclick = () => {
        this.settings.set(b.dataset.cfg, b.dataset.val);
        // redesenha no mesmo lugar em que o painel esta
        if (container === this.el.painel) this.abrir('config');
        else this.configEm(container);
      };
    }
  }
}
