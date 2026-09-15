// Catalogo dos equipamentos que aparecem na tela em primeira pessoa.
//
// Os pontos abaixo sao fracoes da propria imagem, medidas nos PNGs:
//   muzzle  -> onde sai o tiro (usado no clarao e para levar a arma ao centro)
//   aimPoint-> o ponto da mira que precisa cair no centro da tela
//   hold    -> onde o item fica preso na mao (so no modo granada)

export const SLOTS = ['rifle', 'pistola', 'faca', 'escopeta', 'snipe'];

// como cada arma aparece no inventario e no chao (icone proprio, bem menor)
export const WEAPON_ITEMS = {
  rifle: { name: 'Rifle', img: 'itens/arma.png' },
  pistola: { name: 'Pistola', img: 'itens/pistola.png' },
  faca: { name: 'Faca', img: 'itens/faca.png' },
  escopeta: { name: 'Escopeta', img: 'escopeta/icone-scopeta.png' },
  snipe: { name: 'Sniper', img: 'snipe/icone-snipe.png' },
};

export const WEAPONS = {
  rifle: {
    kind: 'gun',
    name: 'Rifle',
    img: 'arma.png',
    scope: 'mira.png',
    mag: 12,
    damage: 25,
    fireDelay: 0.14,
    reloadTime: 1.15,
    auto: true,
    recoil: 9,
    spread: { pitch: 0.022, yaw: 0.008 },
    muzzle: { x: 0.90, y: 0.46 },
    aimPoint: { x: 0.394, y: 0.246 },
    scopeHeight: 112,          // vh
    view: { width: 40, right: -2, bottom: -6, originX: 0.75, originY: 1 },
    fov: 42,
  },

  pistola: {
    kind: 'gun',
    name: 'Pistola',
    img: 'pistola.png',
    scope: 'mira-pistola.png',
    mag: 8,
    damage: 34,
    fireDelay: 0.26,
    reloadTime: 0.9,
    auto: false,
    recoil: 13,
    spread: { pitch: 0.030, yaw: 0.010 },
    muzzle: { x: 0.03, y: 0.11 },
    aimPoint: { x: 0.585, y: 0.05 },
    scopeHeight: 84,
    view: { width: 38, right: -4, bottom: -10, originX: 0.7, originY: 1 },
    fov: 52,
  },

  // escopeta: cada tiro solta um leque de bolinhas; forte de perto, fraca de longe
  escopeta: {
    kind: 'gun',
    name: 'Escopeta',
    img: 'escopeta/escopeta.png',
    scope: 'escopeta/Mirando.png',
    mag: 5,
    damage: 13,              // por bolinha: 8 x 13 = 104, derruba de perto
    pellets: 8,
    cone: [0.07, 0.04],      // abertura do leque: sem mirar / mirando
    queda: [8, 30],          // dano cheio ate 8 m, cai ate 30 m
    alcance: 34,
    fireDelay: 0.85,
    reloadTime: 1.6,
    auto: false,
    recoil: 20,
    spread: { pitch: 0.05, yaw: 0.02 },
    muzzle: { x: 0.435, y: 0.02 },
    aimPoint: { x: 0.646, y: 0.02 },
    scopeHeight: 95,
    view: { width: 52, right: -6, bottom: -2, originX: 0.7, originY: 1 },
    fov: 60,
  },

  // sniper: um tiro derruba, mas sem a luneta o tiro sai torto
  snipe: {
    kind: 'gun',
    name: 'Sniper',
    img: 'snipe/snipe.png',
    scope: 'snipe/mirando-snipe.png',
    luneta: true,            // mira com lente, reticula e escurecimento em volta
    mag: 5,
    damage: 100,
    alcance: 450,            // atravessa o mapa inteiro (as outras armas vao ate 220 m)
    hipSpread: 0.08,
    fireDelay: 1.3,
    reloadTime: 2.2,
    auto: false,
    recoil: 26,
    spread: { pitch: 0.06, yaw: 0.02 },
    muzzle: { x: 0.277, y: 0.21 },
    aimPoint: { x: 0.547, y: 0.433 },   // centro do buraco da luneta, medido no PNG
    // o buraco ocupa 67,4% da altura do PNG: 104vh deixa a lente com ~70% da tela
    scopeHeight: 104,
    view: { width: 42, right: -4, bottom: -10, originX: 0.7, originY: 1 },
    fov: 14,
    adsSens: 0.82,           // mouse bem mais lento com zoom forte
  },

  // faca: sem municao, so vale de perto
  faca: {
    kind: 'melee',
    name: 'Faca',
    img: 'faca.png',
    fundoBranco: true,        // o PNG veio com fundo branco: some com multiply
    damage: 60,
    alcance: 2.4,
    fireDelay: 0.55,
    recoil: 16,
    view: { width: 40, right: -4, bottom: -12, originX: 0.75, originY: 1 },
    fov: 68,
  },

  // slot de arma vazio: so a mao
  maos: {
    kind: 'empty',
    name: 'Maos vazias',
    img: 'mão-solo.png',
    view: { width: 34, right: 0, bottom: -8, originX: 0.7, originY: 1 },
    fov: 70,
  },

  granada: {
    kind: 'throw',
    name: 'Granada',
    img: 'mão-solo.png',
    overlay: 'itens/granada.png',
    hold: { x: 0.10, y: 0.20, size: 0.30 },
    view: { width: 34, right: 0, bottom: -8, originX: 0.7, originY: 1 },
    fov: 62,
  },
};
