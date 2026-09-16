// Bussola simples no alto da tela: so as letras (N, NE, L, SE, S, SO, O, NO)
// correndo conforme voce gira, um tracinho no centro e um pontinho azul para
// cada aliado vivo. Aliado atras de voce fica preso na beirada.
//
// Norte e -z (para onde se olha com yaw 0) e leste e +x.

const MEIA_VISTA = 90;                 // graus visiveis para cada lado do centro
const PONTOS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

const norm360 = (g) => ((g % 360) + 360) % 360;
const norm180 = (g) => { const x = norm360(g); return x > 180 ? x - 360 : x; };

export class Bussola {
  constructor() {
    this.el = {
      janela: document.querySelector('#bussola .bus-janela'),
      trilho: document.getElementById('busTrilho'),
      amigos: document.getElementById('busAmigos'),
    };
    this.marcadores = new Map();       // id do aliado -> elemento
    this.largura = 0;
    addEventListener('resize', () => { this.largura = 0; this._montarTrilho(); });
    this._montarTrilho();
  }

  get pxPorGrau() { return (this.el.janela.clientWidth || 360) / (MEIA_VISTA * 2); }

  // letras de 45 em 45 graus, de -180 a 540 (meia volta de sobra para cada lado)
  _montarTrilho() {
    const px = this.pxPorGrau;
    const partes = [];
    for (let g = -180; g <= 540; g += 45) {
      const nome = PONTOS[norm360(g) / 45];
      partes.push(`<b class="${nome.length === 1 ? 'cardeal' : ''}" style="left:${((g + 180) * px).toFixed(1)}px">${nome}</b>`);
    }
    this.el.trilho.innerHTML = partes.join('');
  }

  update(player, remote) {
    if (!this.largura) this.largura = this.el.janela.clientWidth || 360;
    const px = this.largura / (MEIA_VISTA * 2);
    const meio = this.largura / 2;

    // yaw 0 olha para -z (norte); girar para a direita diminui o yaw
    const rumo = norm360(-player.yaw * 180 / Math.PI);
    this.el.trilho.style.transform = `translateX(${(meio - (rumo + 180) * px).toFixed(1)}px)`;

    const vistos = new Set();
    for (const p of remote.list) {
      if (!p.aliado || !p.alive) continue;
      vistos.add(p.id);
      let el = this.marcadores.get(p.id);
      if (!el) {
        el = document.createElement('i');
        el.className = 'bus-amigo';
        this.el.amigos.appendChild(el);
        this.marcadores.set(p.id, el);
      }
      const dx = p.mesh.position.x - player.position.x;
      const dz = p.mesh.position.z - player.position.z;
      const rel = norm180(Math.atan2(dx, -dz) * 180 / Math.PI - rumo);
      el.style.left = (meio + Math.max(-MEIA_VISTA, Math.min(MEIA_VISTA, rel)) * px).toFixed(1) + 'px';
      el.classList.toggle('fora', Math.abs(rel) > MEIA_VISTA);
      el.title = p.name;
    }
    for (const [id, el] of this.marcadores) {
      if (!vistos.has(id)) { el.remove(); this.marcadores.delete(id); }
    }
  }
}
