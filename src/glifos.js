// Os rotulos de tecla que aparecem na tela. Com um controle ligado eles viram
// os botoes do Xbox; sem controle continuam sendo as teclas do teclado.
//
// Quem desenha HUD chama `rotulo()`; o que ja esta escrito no index.html leva
// um `data-controle` e e trocado aqui mesmo quando o controle entra ou sai.

// nome da acao -> [o que escrever no botao, tipo do desenho]
const XBOX = {
  atirar: ['RT', 'gatilho'],
  mirar: ['LT', 'gatilho'],
  mover: ['L', 'stick'],
  olhar: ['R', 'stick'],
  correr: ['L3', 'stick'],
  armas: ['Y', 'face'],
  faca: ['R3', 'stick'],
  Space: ['A', 'face'],
  ControlLeft: ['B', 'face'],
  KeyR: ['X', 'face'],
  KeyE: ['RB', 'ombro'],
  KeyG: ['LB', 'ombro'],
  KeyQ: ['▲', 'seta'],
  KeyV: ['▼', 'seta'],
  KeyC: ['◀', 'seta'],
  KeyI: ['▶', 'seta'],
  Tab: ['VIEW', 'sistema'],
  Escape: ['MENU', 'sistema'],
};

let ligado = false;
const ouvintes = new Set();

export function comControle() { return ligado; }

// avisa quem desenha HUD que precisa redesenhar com o outro rotulo
export function aoTrocarControle(fn) { ouvintes.add(fn); }

export function usarControle(on) {
  if (ligado === on) return;
  ligado = on;
  document.body.classList.toggle('controle', on);
  _trocarEstaticos();
  for (const fn of ouvintes) fn(on);
}

export function glifo(acao) {
  const [texto, tipo] = XBOX[acao] || [acao, ''];
  return `<i class="glifo ${tipo}">${texto}</i>`;
}

// rotulo pronto: o botao do controle ou a tecla do teclado
export function rotulo(acao, tecla) {
  return ligado ? glifo(acao) : `<b>${tecla}</b>`;
}

// so o texto (para quem nao pode receber HTML, como o "E" em cima da caixa)
export function texto(acao, tecla) {
  return ligado ? (XBOX[acao]?.[0] || tecla) : tecla;
}

function _trocarEstaticos() {
  for (const el of document.querySelectorAll('[data-controle]')) {
    if (el.dataset.teclado === undefined) el.dataset.teclado = el.innerHTML;
    el.innerHTML = ligado ? glifo(el.dataset.controle) : el.dataset.teclado;
  }
}
