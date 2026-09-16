// Controles de toque para jogar no celular, no mesmo traco de caneta do jogo:
// joystick na metade esquerda (andar; empurrado ate a borda para frente corre),
// arrastar na metade direita para olhar, e botoes redondos desenhados a mao.
//
// Usa Pointer Events: cada dedo tem seu pointerId, entao da para andar, olhar e
// atirar ao mesmo tempo.

const R_STICK = 58;                      // raio do joystick em pixels

// icones desenhados em SVG (so traco, sem preenchimento)
const ICONE = {
  atirar: '<path d="M32 8v14M32 42v14M8 32h14M42 32h14"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="2.5" class="cheio"/>',
  mirar: '<circle cx="32" cy="32" r="21"/><path d="M32 4v12M32 48v12M4 32h12M48 32h12"/><circle cx="32" cy="32" r="3" class="cheio"/>',
  pular: '<path d="M32 50V16M18 29l14-14 14 14"/><path d="M16 56h32"/>',
  agachar: '<path d="M32 12v30M18 30l14 14 14-14"/><path d="M14 54h36"/>',
  recarregar: '<path d="M48 26a18 18 0 1 0 3 12"/><path d="M50 12v15H35"/>',
  arma: '<path d="M10 24h38l-8-8M54 40H16l8 8"/>',
  usar: '<text x="32" y="44" text-anchor="middle" class="letra">E</text>',
  mochila: '<path d="M18 24h28v28a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z"/><path d="M25 24v-6a7 7 0 0 1 14 0v6M24 38h16"/>',
  granada: '<ellipse cx="32" cy="38" rx="14" ry="16"/><path d="M26 22v-6h12v6M38 16l8-6M26 34h12M26 42h12"/>',
  vida: '<rect x="12" y="12" width="40" height="40" rx="6"/><path d="M32 20v24M20 32h24"/>',
  colete: '<path d="M22 10l6 2c2 6 6 6 8 0l6-2 4 12c6 2 8 6 8 10l-2 22c-10 4-26 4-36 0l-2-22c0-4 2-8 8-10z"/><path d="M32 18v36"/>',
  cigarro: '<rect x="8" y="30" width="40" height="9" rx="2"/><path d="M38 30v9M52 26c-3-4 3-6 0-12M58 26c-3-4 3-6 0-12"/>',
  pausa: '<path d="M24 16v32M40 16v32"/>',
};

const svg = (nome) => `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONE[nome]}</svg>`;

export class ControlesToque {
  constructor({ player, acoes }) {
    this.player = player;
    this.acoes = acoes;
    this.mirando = false;
    this.agachado = false;

    const raiz = document.createElement('div');
    raiz.id = 'toque';
    raiz.innerHTML = `
      <div class="tq-zona tq-andar"></div>
      <div class="tq-zona tq-olhar"></div>
      <div class="tq-stick"><i></i></div>

      <button class="tq-bt tq-pausa" data-tq="pausa" aria-label="pausa">${svg('pausa')}</button>
      <button class="tq-texto tq-pular-cena" data-tq="pularCena">PULAR ▸▸</button>

      <div class="tq-itens">
        <button class="tq-bt tq-usar" data-tq="usar" aria-label="usar">${svg('usar')}</button>
        <button class="tq-bt tq-p" data-tq="mochila" aria-label="mochila">${svg('mochila')}</button>
        <button class="tq-bt tq-p" data-tq="granada" aria-label="granada">${svg('granada')}<b class="qtd"></b></button>
        <button class="tq-bt tq-p" data-tq="vida" aria-label="curativo">${svg('vida')}<b class="qtd"></b></button>
        <button class="tq-bt tq-p" data-tq="colete" aria-label="colete">${svg('colete')}<b class="qtd"></b></button>
        <button class="tq-bt tq-p" data-tq="cigarro" aria-label="cigarro">${svg('cigarro')}<b class="qtd"></b></button>
      </div>

      <button class="tq-bt tq-atirar" data-tq="atirar" aria-label="atirar">${svg('atirar')}</button>
      <button class="tq-bt tq-mirar" data-tq="mirar" aria-label="mirar">${svg('mirar')}</button>
      <button class="tq-bt tq-pular" data-tq="pular" aria-label="pular">${svg('pular')}</button>
      <button class="tq-bt tq-agachar" data-tq="agachar" aria-label="agachar">${svg('agachar')}</button>
      <button class="tq-bt tq-recarregar" data-tq="recarregar" aria-label="recarregar">${svg('recarregar')}</button>
      <button class="tq-bt tq-arma" data-tq="arma" aria-label="trocar arma">${svg('arma')}</button>`;
    document.body.appendChild(raiz);
    this.raiz = raiz;
    this.stick = raiz.querySelector('.tq-stick');
    this.bola = this.stick.querySelector('i');
    this.bt = Object.fromEntries([...raiz.querySelectorAll('[data-tq]')].map((b) => [b.dataset.tq, b]));

    this._ligarAndar(raiz.querySelector('.tq-andar'));
    this._ligarOlhar(raiz.querySelector('.tq-olhar'));
    this._ligarBotoes();
    // nenhum toque aqui vira clique/zoom/menu do navegador
    raiz.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------- joystick ---------------- */

  _ligarAndar(zona) {
    let dedo = null, cx = 0, cy = 0;
    const soltar = () => {
      dedo = null;
      this.player.toque = null;
      this.stick.classList.remove('ativo');
      this.stick.style.left = this.stick.style.top = '';
      this.bola.style.transform = '';
    };
    zona.addEventListener('pointerdown', (e) => {
      if (dedo !== null) return;
      e.preventDefault();
      dedo = e.pointerId;
      zona.setPointerCapture(dedo);
      cx = e.clientX; cy = e.clientY;
      this.stick.classList.add('ativo');
      this.stick.style.left = cx + 'px';
      this.stick.style.top = cy + 'px';
      this.player.toque = { x: 0, y: 0, correr: false };
    });
    zona.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dedo) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R_STICK) { dx *= R_STICK / d; dy *= R_STICK / d; }
      this.bola.style.transform = `translate(${dx}px, ${dy}px)`;
      const x = dx / R_STICK, y = -dy / R_STICK;
      // encostado na borda, para frente: corre
      this.player.toque = { x, y, correr: d > R_STICK * 0.95 && y > 0.7 };
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      zona.addEventListener(ev, (e) => { if (e.pointerId === dedo) soltar(); });
    }
    this._soltarStick = soltar;
  }

  /* ---------------- olhar arrastando ---------------- */

  _arrastarOlhar(el, aoComecar, aoTerminar) {
    const dedos = new Map();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      aoComecar?.(e);
    });
    el.addEventListener('pointermove', (e) => {
      const p = dedos.get(e.pointerId);
      if (!p) return;
      this.acoes.olhar(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      el.addEventListener(ev, (e) => {
        if (!dedos.delete(e.pointerId)) return;
        aoTerminar?.(e);
      });
    }
  }

  _ligarOlhar(zona) {
    this._arrastarOlhar(zona);
  }

  /* ---------------- botoes ---------------- */

  _ligarBotoes() {
    const b = this.bt;
    const apertou = (el) => { el.classList.add('apertado'); setTimeout(() => el.classList.remove('apertado'), 130); };

    // atirar: segurando atira, e o mesmo dedo arrastando mira (como nos FPS de celular)
    this._arrastarOlhar(b.atirar,
      () => { b.atirar.classList.add('on'); this.acoes.atirar(true); },
      () => { b.atirar.classList.remove('on'); this.acoes.atirar(false); });

    // pular: segurando = barra de espaco apertada
    b.pular.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.pular.setPointerCapture(e.pointerId);
      b.pular.classList.add('on');
      this.player.keys.Space = true;
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      b.pular.addEventListener(ev, () => { b.pular.classList.remove('on'); this.player.keys.Space = false; });
    }

    const toque = (el, fn) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      apertou(el);
      fn();
    });

    toque(b.mirar, () => { this.mirando = !this.mirando; this.acoes.mirar(this.mirando); });
    toque(b.agachar, () => { this.agachado = !this.agachado; this.player.keys.ControlLeft = this.agachado; });
    toque(b.recarregar, () => this.acoes.tecla('KeyR'));
    toque(b.arma, () => this.acoes.trocarArma());
    toque(b.usar, () => this.acoes.tecla('KeyE'));
    toque(b.mochila, () => this.acoes.tecla('KeyI'));
    toque(b.granada, () => this.acoes.tecla('KeyG'));
    toque(b.vida, () => this.acoes.tecla('KeyQ'));
    toque(b.colete, () => this.acoes.tecla('KeyV'));
    toque(b.cigarro, () => this.acoes.tecla('KeyC'));
    toque(b.pausa, () => this.acoes.pausar());
    toque(b.pularCena, () => this.acoes.pularCena());
  }

  // solta tudo que estiver apertado (pausa, morte, tela de saque)
  soltarTudo() {
    this._soltarStick?.();
    this.player.keys.Space = false;
    this.acoes.atirar(false);
    this.bt.atirar.classList.remove('on');
    if (this.mirando) { this.mirando = false; this.acoes.mirar(false); }
  }

  // chamado todo quadro pelo jogo
  update(est) {
    const jogando = est.jogando && !est.emCena;
    if (this.jogandoAntes && !jogando) this.soltarTudo();
    this.jogandoAntes = jogando;

    this.raiz.classList.toggle('cena', !!est.emCena);
    this.raiz.classList.toggle('parado', !jogando);
    this.bt.mirar.classList.toggle('on', est.mirando);
    this.bt.mirar.classList.toggle('vazio', !est.isGun);
    this.bt.agachar.classList.toggle('on', this.agachado);
    this.bt.usar.classList.toggle('pronto', !!est.usar);
    if (!est.mirando && this.mirando) this.mirando = false;   // trocou de arma, recarregou...

    for (const k of ['granada', 'vida', 'colete', 'cigarro']) {
      const n = est.qtd[k] || 0;
      const el = this.bt[k];
      el.classList.toggle('vazio', n === 0);
      const q = el.querySelector('.qtd');
      const t = n ? String(n) : '';
      if (q.textContent !== t) q.textContent = t;
    }
  }
}
