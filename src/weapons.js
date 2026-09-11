// Catalogo dos equipamentos que aparecem na tela em primeira pessoa.
//
// Os pontos abaixo sao fracoes da propria imagem, medidas nos PNGs:
//   muzzle  -> onde sai o tiro (usado no clarao e para levar a arma ao centro)
//   aimPoint-> o ponto da mira que precisa cair no centro da tela
//   hold    -> onde o item fica preso na mao (so no modo granada)

export const SLOTS = ['rifle', 'pistola', 'faca'];

// como cada arma aparece no inventario e no chao (icone proprio, bem menor)
export const WEAPON_ITEMS = {
  rifle: { name: 'Rifle', img: 'itens/arma.png' },
  pistola: { name: 'Pistola', img: 'itens/pistola.png' },
  faca: { name: 'Faca', img: 'itens/faca.png' },
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
