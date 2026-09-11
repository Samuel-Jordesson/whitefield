import * as THREE from 'three';

// Configuracoes graficas e de controle. Tudo aqui muda o jogo de verdade —
// nada de opcao que so fica bonita na tela.

const CHAVE = 'wf-config';

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
    titulo: 'Sensibilidade do mouse',
    ajuda: 'quanto a mira anda com o mouse',
    valores: {
      baixa: { nome: 'Baixa', valor: 0.0014 },
      media: { nome: 'Media', valor: 0.0022 },
      alta: { nome: 'Alta', valor: 0.0034 },
      altissima: { nome: 'Altissima', valor: 0.005 },
    },
    padrao: 'media',
  },
};

export class Settings {
  constructor() {
    this.valores = {};
    for (const [chave, op] of Object.entries(OPCOES)) this.valores[chave] = op.padrao;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
      for (const chave of Object.keys(OPCOES)) {
        if (salvo[chave] && OPCOES[chave].valores[salvo[chave]]) this.valores[chave] = salvo[chave];
      }
    } catch { /* usa o padrao */ }
  }

  get(chave) { return OPCOES[chave].valores[this.valores[chave]]; }
  chaveDe(chave) { return this.valores[chave]; }

  set(chave, valor) {
    if (!OPCOES[chave]?.valores[valor]) return;
    this.valores[chave] = valor;
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
        a.player.sensitivity = v.valor;
        break;

      case 'grama':
        a.grass.setQuality(v.area, v.count);
        break;
    }
  }
}
