import { usarControle } from './glifos.js';

// Controle de videogame (Xbox e qualquer um que o navegador reconheca como
// "standard"). Nao existe evento de botao na web: o jeito e ler o estado do
// controle uma vez por quadro, que e o que o `update` faz.
//
// Na partida os analogicos andam e olham e os botoes fazem o que as teclas
// fazem. Fora dela (menu, pausa, tela de saque) o controle navega pela tela:
// o direcional pula de botao em botao e o A aperta.

const MORTA_ANDAR = 0.24;
const MORTA_OLHAR = 0.14;
const VEL_OLHAR = 1500;      // "pixels de mouse" por segundo com o analogico no fim
const REPETE_1 = 0.38;       // segurando o direcional no menu: primeira espera
const REPETE_N = 0.14;       // e as seguintes

// numeros dos botoes no layout padrao
export const BT = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  VIEW: 8, MENU: 9, L3: 10, R3: 11, CIMA: 12, BAIXO: 13, ESQ: 14, DIR: 15,
};

// o que nao pode receber o foco do controle
const FORA = '#hud, #toque, #dragGhost';
const FOCAVEL = 'button, input, select, textarea, [tabindex], .slot.filled, .card, .aba';

export class Controle {
  constructor({ player, acoes }) {
    this.player = player;
    this.acoes = acoes;
    this.conectado = false;
    this.antes = [];           // botoes apertados no quadro passado
    this.espera = 0;           // tempo ate o direcional repetir no menu
    this.repetindo = false;
    this.atirando = false;
    this.mirando = false;
    this.placar = false;
    this.emMenu = false;

    // o navegador so mostra o controle depois do primeiro aperto, entao alem
    // dos eventos o `update` tambem fica de olho
    addEventListener('gamepadconnected', () => this._conferir());
    addEventListener('gamepaddisconnected', () => this._conferir());
  }

  _pad() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of lista) if (p && p.connected && p.buttons?.length) return p;
    return null;
  }

  _conferir() {
    const tem = !!this._pad();
    if (tem === this.conectado) return;
    this.conectado = tem;
    usarControle(tem);
    if (!tem) this._soltarTudo();
  }

  _soltarTudo() {
    if (this.player.toque) this.player.toque = null;
    this.player.keys.Space = false;
    this.player.keys.ControlLeft = false;
    if (this.atirando) { this.atirando = false; this.acoes.atirar(false); }
    if (this.mirando) { this.mirando = false; this.acoes.mirar(false); }
    if (this.placar) { this.placar = false; this._tecla('Tab', false); }
    this.antes = [];
  }

  /* ---------------- leitura ---------------- */

  _eixo(pad, i) { return pad.axes.length > i ? pad.axes[i] : 0; }

  // tira a zona morta e reescala, para o analogico comecar suave
  _stick(pad, ix, iy, morta) {
    const x = this._eixo(pad, ix), y = this._eixo(pad, iy);
    const d = Math.hypot(x, y);
    if (d < morta) return [0, 0, 0];
    const f = (d - morta) / (1 - morta) / d;
    return [x * f, y * f, Math.min(1, d)];
  }

  _segura(pad, i) {
    const b = pad.buttons[i];
    return !!b && (b.pressed || b.value > 0.4);
  }

  _apertou(pad, i) { return this._segura(pad, i) && !this.antes[i]; }

  _tecla(code, apertando = true) {
    dispatchEvent(new KeyboardEvent(apertando ? 'keydown' : 'keyup', { code, key: code }));
  }

  /* ---------------- quadro ---------------- */

  update(dt, est) {
    const pad = this._pad();
    if (!!pad !== this.conectado) this._conferir();
    if (!pad) return;

    if (est.jogando) {
      if (this.emMenu) { this.emMenu = false; document.activeElement?.blur?.(); }
      this._jogando(pad, dt);
    } else {
      if (!this.emMenu) { this.emMenu = true; this._primeiroFoco(); }
      if (this.player.toque) this.player.toque = null;
      this.player.keys.Space = false;
      this.player.keys.ControlLeft = false;
      if (this.atirando) { this.atirando = false; this.acoes.atirar(false); }
      if (this.mirando) { this.mirando = false; this.acoes.mirar(false); }
      if (!est.emCena) this._menu(pad, dt);
      else if (this._apertou(pad, BT.A) || this._apertou(pad, BT.MENU)) this.acoes.pularCena();
    }

    this.antes = pad.buttons.map((b) => b.pressed || b.value > 0.4);
  }

  _jogando(pad, dt) {
    // analogico esquerdo anda; no fim do curso (ou apertando ele) corre
    const [lx, ly, forca] = this._stick(pad, 0, 1, MORTA_ANDAR);
    if (lx || ly) {
      this.player.toque = { x: lx, y: -ly, correr: this._segura(pad, BT.L3) || (forca > 0.92 && -ly > 0.7) };
    } else if (this.player.toque) {
      this.player.toque = null;
    }

    // analogico direito olha: curva quadratica, mais precisao no comeco
    const [rx, ry] = this._stick(pad, 2, 3, MORTA_OLHAR);
    if (rx || ry) {
      const curva = (v) => v * Math.abs(v);
      this.acoes.olhar(curva(rx) * VEL_OLHAR * dt, curva(ry) * VEL_OLHAR * dt);
    }

    // gatilhos: RT atira, LT mira (segurando)
    const rt = this._segura(pad, BT.RT);
    if (rt !== this.atirando) { this.atirando = rt; this.acoes.atirar(rt); }
    const lt = this._segura(pad, BT.LT);
    if (lt !== this.mirando) { this.mirando = lt; this.acoes.mirar(lt); }

    // A pula e B agacha enquanto estiverem apertados
    this.player.keys.Space = this._segura(pad, BT.A);
    this.player.keys.ControlLeft = this._segura(pad, BT.B);

    if (this._apertou(pad, BT.X)) this.acoes.tecla('KeyR');
    if (this._apertou(pad, BT.Y)) this.acoes.trocarArma();
    if (this._apertou(pad, BT.RB)) this.acoes.tecla('KeyE');
    if (this._apertou(pad, BT.LB)) this.acoes.tecla('KeyG');
    if (this._apertou(pad, BT.R3)) this.acoes.tecla('Digit3');
    if (this._apertou(pad, BT.CIMA)) this.acoes.tecla('KeyQ');
    if (this._apertou(pad, BT.BAIXO)) this.acoes.tecla('KeyV');
    if (this._apertou(pad, BT.ESQ)) this.acoes.tecla('KeyC');
    if (this._apertou(pad, BT.DIR)) this.acoes.tecla('KeyI');
    if (this._apertou(pad, BT.MENU)) this.acoes.pausar();

    // VIEW segura o placar, igual ao Tab
    const view = this._segura(pad, BT.VIEW);
    if (view !== this.placar) { this.placar = view; this._tecla('Tab', view); }
  }

  /* ---------------- navegando pela tela ---------------- */

  _menu(pad, dt) {
    if (this._apertou(pad, BT.A)) { this._acionar(); return; }
    if (this._apertou(pad, BT.B)) { this.acoes.voltar(); return; }
    if (this._apertou(pad, BT.MENU)) { this.acoes.pausar(); return; }

    const [lx, ly] = this._stick(pad, 0, 1, 0.6);
    let dx = (this._segura(pad, BT.DIR) ? 1 : 0) - (this._segura(pad, BT.ESQ) ? 1 : 0);
    let dy = (this._segura(pad, BT.BAIXO) ? 1 : 0) - (this._segura(pad, BT.CIMA) ? 1 : 0);
    if (!dx && !dy) {
      if (Math.abs(lx) > Math.abs(ly)) dx = Math.sign(lx);
      else dy = Math.sign(ly);
    }

    if (!dx && !dy) { this.espera = 0; this.repetindo = false; return; }
    this.espera -= dt;
    if (this.espera > 0) return;
    this.espera = this.repetindo ? REPETE_N : REPETE_1;
    this.repetindo = true;
    this._mover(dx, dy);
  }

  // ao abrir um menu (ou a caixa) ja deixa algo escolhido, senao o A nao teria
  // em que bater
  _primeiroFoco() {
    const alvo = document.querySelector('#lootPanel:not(.hidden) #boxGrid .slot.filled')
      || document.querySelector('#lootPanel:not(.hidden) .slot.filled')
      || document.querySelector('.screen:not(.hidden) button.primary')
      || this._focaveis()[0];
    this._focar(alvo);
  }

  _focaveis() {
    return [...document.querySelectorAll(FOCAVEL)].filter((el) =>
      el.offsetParent !== null && !el.disabled && el.tabIndex !== -2 && !el.closest(FORA));
  }

  _focar(el) {
    if (!el) return;
    if (!el.hasAttribute('tabindex') && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.tabIndex = -1;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // pula para o botao mais proximo naquela direcao (vale para o menu e para os
  // quadradinhos da tela de saque)
  _mover(dx, dy) {
    const itens = this._focaveis();
    if (!itens.length) return;
    const atual = document.activeElement;
    if (!itens.includes(atual)) { this._focar(itens[0]); return; }

    const r = atual.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let melhor = null, nota = Infinity;
    for (const el of itens) {
      if (el === atual) continue;
      const q = el.getBoundingClientRect();
      const ex = q.left + q.width / 2 - cx, ey = q.top + q.height / 2 - cy;
      if (dx ? ex * dx < 6 : ey * dy < 6) continue;             // esta para tras
      const frente = Math.abs(dx ? ex : ey), lado = Math.abs(dx ? ey : ex);
      const n = frente + lado * 2.5;
      if (n < nota) { nota = n; melhor = el; }
    }
    this._focar(melhor);
  }

  _acionar() {
    const el = document.activeElement;
    if (!el || el === document.body || el.closest(FORA)) { this._focar(this._focaveis()[0]); return; }
    // item da caixa: o duplo clique ja e o "pegar" da tela de saque
    if (el.classList.contains('slot')) {
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return;
    }
    el.click();
  }
}
