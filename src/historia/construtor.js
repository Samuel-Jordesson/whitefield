import * as THREE from 'three';

// Ferramentas para montar um nivel do modo historia com blocos: paredes com
// vaos de porta/janela, lajes, lances de escada, moveis. Tudo o que e montado
// vai para tres listas que o jogo usa:
//   barreiras  retangulos que barram quem anda (com faixa de altura y0..y1)
//   pisos      superficies onde da para pisar (planas ou rampas)
//   solidos    meshes que bloqueiam a visao dos inimigos e o tiro

const TRACO = new THREE.LineBasicMaterial({ color: 0x141414 });
const semRaio = () => {};

// UV em metros do mundo: a textura nao estica em parede comprida e as juntas
// batem de um bloco para o outro (o reboco tem 1 tile por andar)
function uvMundo(geo, cx, cy, cz, metro) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, y = pos.getY(i) + cy, z = pos.getZ(i) + cz;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / metro, z / metro);
    else if (nx > 0.5) uv.setXY(i, z / metro, y / metro);
    else uv.setXY(i, x / metro, y / metro);
  }
  uv.needsUpdate = true;
}

export class Construtor {
  constructor(texturas) {
    this.tex = texturas;            // { nome: { textura, metro } }
    this.grupo = new THREE.Group();
    this.barreiras = [];
    this.pisos = [];
    this.solidos = [];
    this.mats = new Map();
  }

  // material de uma textura (ou de uma cor lisa: '#rrggbb')
  mat(nome, { emissivo = 0x3a3a3a, cor = 0xffffff, duplo = false } = {}) {
    const chave = `${nome}|${emissivo}|${cor}|${duplo}`;
    if (!this.mats.has(chave)) {
      const t = this.tex[nome];
      const m = new THREE.MeshLambertMaterial({
        color: nome.startsWith('#') ? new THREE.Color(nome) : cor,
        map: t?.textura || null,
        emissive: new THREE.Color(emissivo),
        side: duplo ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.mats.set(chave, m);
    }
    return this.mats.get(chave);
  }

  metroDe(nome) { return this.tex[nome]?.metro || 2.4; }

  contorno(mesh) {
    const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), TRACO);
    linhas.raycast = semRaio;       // senao o tiro acertaria o contorno a 1 m de distancia
    mesh.add(linhas);
    return mesh;
  }

  // Bloco com a BASE em y (nao o centro). `rot` gira em Y.
  caixa({ x, y = 0, z, w, h, d, mat = 'reboco', rot = 0, colide = true, solido = true,
          contorno = false, sombra = true, emissivo, cor, pai = this.grupo, altoColisao }) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (!rot) uvMundo(geo, x, y + h / 2, z, this.metroDe(mat));
    const mesh = new THREE.Mesh(geo, this.mat(mat, { emissivo, cor }));
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rot;
    mesh.castShadow = sombra;
    mesh.receiveShadow = true;
    if (contorno) this.contorno(mesh);
    pai.add(mesh);
    if (colide) {
      this.barreiras.push({ x, z, hw: w / 2, hd: d / 2, rot, y0: y, y1: altoColisao ?? y + h });
    }
    if (solido) this.solidos.push(mesh);
    return mesh;
  }

  // barreira invisivel (janela de fora, beirada do terraco)
  barreira(x, z, w, d, y0, y1, rot = 0) {
    this.barreiras.push({ x, z, hw: w / 2, hd: d / 2, rot, y0, y1 });
  }

  piso(x0, x1, z0, z1, y) {
    this.pisos.push({ x0, x1, z0, z1, y });
  }

  // laje: o topo fica em y; embaixo, o teto do andar de baixo
  laje(x0, x1, z0, z1, y, { mat = 'concreto', esp = 0.25, pisavel = true, teto } = {}) {
    const m = this.caixa({
      x: (x0 + x1) / 2, y: y - esp, z: (z0 + z1) / 2, w: x1 - x0, h: esp, d: z1 - z0,
      mat, colide: false,
    });
    if (teto) {
      // face de baixo com outra textura (forro)
      const forro = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.mat(teto));
      forro.rotation.x = Math.PI / 2;
      forro.position.set((x0 + x1) / 2, y - esp - 0.005, (z0 + z1) / 2);
      this.grupo.add(forro);
    }
    if (pisavel) this.piso(x0, x1, z0, z1, y);
    return m;
  }

  // Parede ao longo de X (fixa em z) ou de Z (fixa em x), de `de` ate `ate`,
  // com vaos: [{ de, ate, base, topo, porta: {tex, aberta}, janela: true, vidro }]
  parede(eixo, fixo, de, ate, y, h, vaos = [], { mat = 'reboco', esp = 0.2, externa = false } = {}) {
    const ordenados = [...vaos].sort((a, b) => a.de - b.de);
    const bloco = (a, b, y0, y1, colide = true) => {
      const len = b - a;
      if (len < 0.02 || y1 - y0 < 0.02) return;
      const meio = (a + b) / 2;
      if (eixo === 'x') this.caixa({ x: meio, y: y0, z: fixo, w: len, h: y1 - y0, d: esp, mat, colide });
      else this.caixa({ x: fixo, y: y0, z: meio, w: esp, h: y1 - y0, d: len, mat, colide });
    };

    let cursor = de;
    for (const v of ordenados) {
      bloco(cursor, v.de, y, y + h);
      const base = v.base ?? 0, topo = v.topo ?? 2.15;
      // peitoril (janela) e verga (acima da porta)
      if (base > 0.02) bloco(v.de, v.ate, y, y + base, base > 0.8);
      bloco(v.de, v.ate, y + topo, y + h, false);
      // janela de fora nao deixa pular para a rua
      if ((v.janela && externa) || v.vidro) {
        const meio = (v.de + v.ate) / 2, len = v.ate - v.de;
        if (eixo === 'x') this.barreira(meio, fixo, len, esp, y, y + h);
        else this.barreira(fixo, meio, esp, len, y, y + h);
      }
      if (v.janela) this._moldura(eixo, fixo, v.de, v.ate, y + base, y + topo, esp);
      if (v.porta) this._porta(eixo, fixo, v, y, topo, esp);
      cursor = v.ate;
    }
    bloco(cursor, ate, y, y + h);
  }

  _moldura(eixo, fixo, de, ate, y0, y1, esp) {
    const meio = (de + ate) / 2, len = ate - de;
    const barra = (w, h, d, x, yy, z) => this.caixa({ x, y: yy, z, w, h, d, mat: '#f4f4f4', colide: false, contorno: true, solido: false });
    if (eixo === 'x') {
      barra(len, 0.06, esp + 0.1, meio, y0 - 0.03, fixo);
      barra(len, 0.06, esp + 0.1, meio, y1 - 0.03, fixo);
      barra(0.05, y1 - y0, 0.05, meio, y0, fixo);
    } else {
      barra(esp + 0.1, 0.06, len, fixo, y0 - 0.03, meio);
      barra(esp + 0.1, 0.06, len, fixo, y1 - 0.03, meio);
      barra(0.05, y1 - y0, 0.05, fixo, y0, meio);
    }
  }

  // folha da porta: fechada (barra a passagem) ou aberta girada na dobradica
  _porta(eixo, fixo, v, y, topo, esp) {
    const len = v.ate - v.de;
    const { tex, aberta = false, lado = 1, angulo = 1.35 } = v.porta;
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color(0x3a3a3a) });
    const geo = new THREE.BoxGeometry(len - 0.04, topo - 0.02, 0.06);
    const folha = new THREE.Mesh(geo, [this.mat('#eeeeee'), this.mat('#eeeeee'), this.mat('#eeeeee'), this.mat('#eeeeee'), mat, mat]);
    folha.castShadow = true;
    this.contorno(folha);

    const dobradica = new THREE.Group();
    // a folha gira em volta da ponta `de` do vao
    folha.position.set(len / 2, topo / 2, 0);
    dobradica.add(folha);
    if (eixo === 'x') {
      dobradica.position.set(v.de, y, fixo);
    } else {
      dobradica.position.set(fixo, y, v.ate);
      dobradica.rotation.y = Math.PI / 2;
    }
    if (aberta) dobradica.rotation.y += angulo * lado;
    this.grupo.add(dobradica);
    this.solidos.push(folha);

    if (!aberta) {
      const meio = (v.de + v.ate) / 2;
      if (eixo === 'x') this.barreira(meio, fixo, len, esp + 0.1, y, y + topo);
      else this.barreira(fixo, meio, esp + 0.1, len, y, y + topo);
    }
    return dobradica;
  }

  // Lance de escada: degraus de verdade no desenho, rampa lisa para andar.
  // `de` = 'min' sobe a partir do lado menor do eixo.
  lance(x0, x1, z0, z1, y0, y1, eixo, de, { mat = 'concreto' } = {}) {
    const comp = eixo === 'x' ? x1 - x0 : z1 - z0;
    const n = Math.max(4, Math.round((y1 - y0) / 0.19));
    const piso = comp / n, espelho = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const topo = y0 + espelho * (i + 1);
      const ini = de === 'min' ? i * piso : comp - (i + 1) * piso;
      const alt = Math.min(topo - y0 + 0.02, espelho + 0.32);
      if (eixo === 'x') {
        this.caixa({ x: x0 + ini + piso / 2, y: topo - alt, z: (z0 + z1) / 2, w: piso, h: alt, d: z1 - z0, mat, colide: false, contorno: true });
      } else {
        this.caixa({ x: (x0 + x1) / 2, y: topo - alt, z: z0 + ini + piso / 2, w: x1 - x0, h: alt, d: piso, mat, colide: false, contorno: true });
      }
    }
    this.pisos.push({ x0, x1, z0, z1, rampa: { y0, y1, eixo, de } });
  }

  // plano decorativo (poster, placa, pichacao, heliponto)
  plano(textura, w, h, { x, y, z, ry = 0, rx = 0, transparente = true, duplo = false, emissivo = 0x555555 }) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({
        map: textura, transparent: transparente, alphaTest: transparente ? 0.3 : 0,
        emissive: new THREE.Color(emissivo), side: duplo ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !transparente,
        polygonOffset: true, polygonOffsetFactor: -2,
      })
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0, 'YXZ');
    m.receiveShadow = true;
    this.grupo.add(m);
    return m;
  }

  cilindro({ x, y = 0, z, r, h, mat = '#f2f2f2', colide = true, contorno = true, lados = 16, rTopo }) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTopo ?? r, r, h, lados), this.mat(mat));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (contorno) this.contorno(mesh);
    this.grupo.add(mesh);
    this.solidos.push(mesh);
    if (colide) this.barreiras.push({ x, z, hw: r, hd: r, rot: 0, y0: y, y1: y + h });
    return mesh;
  }

  // luz de teto: painel que brilha + uma luz de verdade (sem sombra, e barato)
  luminaria(x, y, z, { intensidade = 6, alcance = 9, w = 1.1, d = 0.35 } = {}) {
    const painel = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.06, d),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    painel.position.set(x, y - 0.03, z);
    this.contorno(painel);
    this.grupo.add(painel);
    const luz = new THREE.PointLight(0xffffff, intensidade, alcance, 1.6);
    luz.position.set(x, y - 0.35, z);
    this.grupo.add(luz);
    return { painel, luz, base: intensidade };
  }
}
