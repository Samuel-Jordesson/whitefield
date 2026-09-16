import * as THREE from 'three';

// Configuracoes graficas e de controle. Tudo aqui muda o jogo de verdade —
// nada de opcao que so fica bonita na tela.
//
// Dois tipos: opcoes com botoes (`valores`) e barras deslizantes (`tipo: 'barra'`),
// que guardam um numero.

const CHAVE = 'wf-config';

// 1 ponto da barra de sensibilidade = este tanto de radiano por pixel do mouse
export const SENS_POR_PONTO = 0.00044;

export const OPCOES = {
  grama: {
    titulo: 'Distancia da grama',
    ajuda: 'ate onde a grama e desenhada',
    valores: {
      baixo: { nome: 'Baixa', area: 46, count: 6000 },
      medio: { nome: 'Media', area: 96, count: 17000 },
      alto: { nome: 'Alta (mapa todo)', area: 260, count: 60000 },
    },
    padrao: 'medio',
  },
  resolucao: {
    titulo: 'Resolucao',
    ajuda: 'menos pixels = mais quadros por segundo',
    valores: {
      baixa: { nome: '60%', escala: 0.6 },
      media: { nome: '80%', escala: 0.8 },
      alta: { nome: '100%', escala: 1 },
      max: { nome: 'Nitida (2x)', escala: 2 },
    },
    padrao: 'alta',
  },
  texturas: {
    titulo: 'Qualidade das texturas',
    ajuda: 'nitidez das texturas vistas de lado',
    valores: {
      baixa: { nome: 'Baixa', aniso: 1 },
      media: { nome: 'Media', aniso: 4 },
      alta: { nome: 'Alta', aniso: 16 },
    },
    padrao: 'media',
  },
  sombras: {
    titulo: 'Sombras',
    ajuda: 'sombra do sol no chao e nas cabanas',
    valores: {
      off: { nome: 'Desligadas', mapa: 0 },
      media: { nome: 'Medias', mapa: 1024 },
      alta: { nome: 'Altas', mapa: 2048 },
      ultra: { nome: 'Ultra', mapa: 4096 },
    },
    padrao: 'alta',
  },
  alcance: {
    titulo: 'Distancia de visao',
    ajuda: 'onde a neblina come o cenario',
    valores: {
      curta: { nome: 'Curta', near: 25, far: 120 },
      media: { nome: 'Media', near: 40, far: 190 },
      longa: { nome: 'Longa', near: 70, far: 300 },
    },
    padrao: 'media',
  },
  fov: {
    titulo: 'Campo de visao',
    ajuda: 'o quanto cabe na tela',
    valores: {
      p70: { nome: '70', fov: 70 },
      p75: { nome: '75', fov: 75 },
      p85: { nome: '85', fov: 85 },
      p95: { nome: '95', fov: 95 },
    },
    padrao: 'p75',
  },
  sensibilidade: {
    tipo: 'barra',
    titulo: 'Sensibilidade do mouse',
    ajuda: 'quanto a camera gira com o mouse',
    min: 0.5, max: 15, passo: 0.1, padrao: 5,
    formato: (v) => v.toFixed(1),
    // salvos antigos eram botoes: converte para a barra
    antigos: { baixa: 3.2, media: 5, alta: 7.7, altissima: 11.4 },
  },
  sensMira: {
    tipo: 'barra',
    titulo: 'Sensibilidade mirando',
    ajuda: 'botao direito: 100% = igual sem mirar (a sniper sempre fica mais lenta)',
    min: 10, max: 150, passo: 5, padrao: 80,
    formato: (v) => Math.round(v) + '%',
  },
  corMira: {
    titulo: 'Cor da mira',
    ajuda: 'a cruz e o ponto no centro, inclusive mirando',
    valores: {
      vermelho: { nome: 'Vermelho', cor: '#ff2a2a' },
      verde: { nome: 'Verde', cor: '#1fe05a' },
      ciano: { nome: 'Ciano', cor: '#18d4ff' },
      amarelo: { nome: 'Amarelo', cor: '#ffd21f' },
      rosa: { nome: 'Rosa', cor: '#ff3df2' },
      branco: { nome: 'Branco', cor: '#ffffff' },
      preto: { nome: 'Preto', cor: '#111111' },
    },
    padrao: 'vermelho',
  },
};

const ehBarra = (chave) => OPCOES[chave].tipo === 'barra';

export class Settings {
  constructor() {
    this.valores = {};
    for (const [chave, op] of Object.entries(OPCOES)) this.valores[chave] = op.padrao;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
      for (const [chave, op] of Object.entries(OPCOES)) {
        const v = salvo[chave];
        if (v === undefined) continue;
        if (ehBarra(chave)) {
          const n = typeof v === 'number' ? v : op.antigos?.[v];
          if (Number.isFinite(n)) this.valores[chave] = this._limitar(chave, n);
        } else if (op.valores[v]) {
          this.valores[chave] = v;
        }
      }
    } catch { /* usa o padrao */ }
  }

  _limitar(chave, n) {
    const op = OPCOES[chave];
    // toFixed tira o lixo de ponto flutuante (1.2000000000000002)
    return Math.min(op.max, Math.max(op.min, +(Math.round(n / op.passo) * op.passo).toFixed(4)));
  }

  // barra devolve o numero; botao devolve o objeto da opcao escolhida
  get(chave) {
    return ehBarra(chave) ? this.valores[chave] : OPCOES[chave].valores[this.valores[chave]];
  }
  chaveDe(chave) { return this.valores[chave]; }

  set(chave, valor) {
    if (ehBarra(chave)) {
      const n = Number(valor);
      if (!Number.isFinite(n)) return;
      this.valores[chave] = this._limitar(chave, n);
    } else {
      if (!OPCOES[chave]?.valores[valor]) return;
      this.valores[chave] = valor;
    }
    try { localStorage.setItem(CHAVE, JSON.stringify(this.valores)); } catch { /* ok */ }
    this.aplicar(chave);
  }

  // liga as configuracoes nas pecas do jogo
  ligar({ renderer, camera, scene, world, player, grass }) {
    this.alvo = { renderer, camera, scene, world, player, grass };
    for (const chave of Object.keys(OPCOES)) this.aplicar(chave);
  }

  aplicar(chave) {
    const a = this.alvo;
    if (!a) return;
    const v = this.get(chave);

    switch (chave) {
      case 'resolucao':
        a.renderer.setPixelRatio(Math.min(devicePixelRatio, v.escala));
        a.renderer.setSize(innerWidth, innerHeight);
        break;

      case 'sombras': {
        a.renderer.shadowMap.enabled = v.mapa > 0;
        const sol = a.world.sun;
        if (v.mapa > 0 && sol) {
          sol.shadow.mapSize.set(v.mapa, v.mapa);
          sol.shadow.map?.dispose();
          sol.shadow.map = null;              // obriga o three a refazer
        }
        a.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
        break;
      }

      case 'texturas':
        a.scene.traverse((o) => {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m?.map) { m.map.anisotropy = v.aniso; m.map.needsUpdate = true; }
          }
        });
        break;

      case 'alcance':
        if (a.scene.fog) { a.scene.fog.near = v.near; a.scene.fog.far = v.far; }
        break;

      case 'fov':
        a.camera.userData.fovBase = v.fov;
        break;

      case 'sensibilidade':
        a.player.sensitivity = v * SENS_POR_PONTO;
        break;

      case 'sensMira':
        break;                                // lido a cada quadro no loop do jogo

      case 'corMira':
        document.documentElement.style.setProperty('--mira', v.cor);
        break;

      case 'grama':
        a.grass.setQuality(v.area, v.count);
        break;
    }
  }
}

// o quanto o mouse anda com a mira armada, para esta arma (1 = igual sem mirar)
// adsSens de cada arma diz o quanto ela freia; a barra escala isso
export function escalaMirando(settings, adsSens = 0.55) {
  const porArma = (1 - adsSens) / 0.45;       // rifle/pistola = 1, sniper ~0.4
  return Math.min(1.5, Math.max(0.05, porArma * settings.get('sensMira') / 100));
}
