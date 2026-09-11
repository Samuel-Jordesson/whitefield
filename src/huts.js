import * as THREE from 'three';
import * as TEX from './textures.js';

// Cabanas 3D de verdade (nao sao sprites): da para entrar, se esconder atras
// da parede e sacar as caixas la dentro. Tres modelos, um de tijolo e dois de
// madeira, todos com textura rabiscada em preto e branco.

const ESPESSURA = 0.22;      // espessura da parede
const ALTURA_BLOQUEIO = 1.5; // pedaco de parede mais baixo que isso nao trava

export const HUT_TYPES = {
  // cabana de madeira: uma porta e uma janela
  madeira: {
    material: 'madeira',
    w: 6.4, d: 5.6, h: 2.7,
    telhado: 'duas-aguas',
    beiral: 0.45,
    aberturas: {
      sul: [{ tipo: 'porta', em: 0, largura: 1.4 }],
      leste: [{ tipo: 'janela', em: 0, largura: 1.3 }],
      norte: [{ tipo: 'janela', em: -1.2, largura: 1.1 }],
    },
  },

  // casa de tijolo: mais alta, duas janelas na frente
  tijolo: {
    material: 'tijolo',
    w: 7.6, d: 6.4, h: 3.0,
    telhado: 'uma-agua',
    beiral: 0.5,
    aberturas: {
      sul: [
        { tipo: 'porta', em: -1.8, largura: 1.4 },
        { tipo: 'janela', em: 1.6, largura: 1.4 },
      ],
      oeste: [{ tipo: 'janela', em: 0, largura: 1.4 }],
      norte: [{ tipo: 'porta', em: 2.0, largura: 1.4 }],
    },
  },

  // barracao comprido de madeira: passagem de ponta a ponta
  barracao: {
    material: 'madeira',
    w: 10.5, d: 5.2, h: 3.2,
    telhado: 'duas-aguas',
    beiral: 0.55,
    aberturas: {
      sul: [
        { tipo: 'porta', em: -3.2, largura: 1.6 },
        { tipo: 'janela', em: 1.0, largura: 1.6 },
        { tipo: 'janela', em: 3.6, largura: 1.6 },
      ],
      norte: [{ tipo: 'porta', em: 3.2, largura: 1.6 }],
      leste: [{ tipo: 'porta', em: 0, largura: 1.6 }],
    },
  },
};

const VAO = {
  porta: { base: 0, topo: 2.15 },
  janela: { base: 1.0, topo: 2.05 },
};

// texturas compartilhadas, criadas uma vez so
let TEXTURAS = null;
function texturas() {
  if (!TEXTURAS) {
    TEXTURAS = {
      madeira: TEX.plankTexture(),
      tijolo: TEX.brickTexture(),
      telhado: TEX.roofTexture(),
      piso: TEX.floorTexture(),
    };
    for (const t of Object.values(TEXTURAS)) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
  }
  return TEXTURAS;
}

// um material por combinacao de textura + repeticao, para a parede nao esticar
const materiais = new Map();
function material(nome, repX, repY) {
  const chave = `${nome}|${repX.toFixed(2)}|${repY.toFixed(2)}`;
  if (!materiais.has(chave)) {
    const mapa = texturas()[nome].clone();
    mapa.needsUpdate = true;
    mapa.wrapS = mapa.wrapT = THREE.RepeatWrapping;
    mapa.repeat.set(repX, repY);
    materiais.set(chave, new THREE.MeshLambertMaterial({
      map: mapa, color: 0xffffff, emissive: new THREE.Color(0x3d3d3d),
    }));
  }
  return materiais.get(chave);
}

// quantos metros cabem em um tile de cada textura
const METRO = { madeira: 2.8, tijolo: 1.8, telhado: 2.2, piso: 2.4 };

function bloco(largura, altura, profundidade, nome) {
  const m = METRO[nome];
  const geo = new THREE.BoxGeometry(largura, altura, profundidade);
  const mesh = new THREE.Mesh(geo, material(nome, largura / m, altura / m));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Monta uma parede reta (ao longo de X, centrada na origem) com aberturas,
// devolvendo os pedacos e os retangulos que devem barrar o jogador.
function parede(comprimento, altura, aberturas, nome) {
  const pedacos = [];
  const barreiras = [];

  const vaos = aberturas
    .map((a) => ({ ...VAO[a.tipo], ini: a.em - a.largura / 2, fim: a.em + a.largura / 2 }))
    .sort((a, b) => a.ini - b.ini);

  // faixas cheias entre as aberturas
  let x = -comprimento / 2;
  for (const v of vaos) {
    const largura = Math.max(0, v.ini - x);
    if (largura > 0.02) {
      const m = bloco(largura, altura, ESPESSURA, nome);
      m.position.set(x + largura / 2, altura / 2, 0);
      pedacos.push(m);
      barreiras.push({ cx: m.position.x, cz: 0, hw: largura / 2, hd: ESPESSURA / 2 });
    }
    x = Math.max(x, v.fim);
  }
  const resto = comprimento / 2 - x;
  if (resto > 0.02) {
    const m = bloco(resto, altura, ESPESSURA, nome);
    m.position.set(x + resto / 2, altura / 2, 0);
    pedacos.push(m);
    barreiras.push({ cx: m.position.x, cz: 0, hw: resto / 2, hd: ESPESSURA / 2 });
  }

  // peitoril e verga de cada abertura
  for (const v of vaos) {
    const largura = v.fim - v.ini;
    const cx = (v.ini + v.fim) / 2;

    if (v.base > 0.02) {
      const m = bloco(largura, v.base, ESPESSURA, nome);
      m.position.set(cx, v.base / 2, 0);
      pedacos.push(m);
      if (v.base >= ALTURA_BLOQUEIO * 0.5) {
        barreiras.push({ cx, cz: 0, hw: largura / 2, hd: ESPESSURA / 2 });
      }
    }
    const sobra = altura - v.topo;
    if (sobra > 0.02) {
      const m = bloco(largura, sobra, ESPESSURA, nome);
      m.position.set(cx, v.topo + sobra / 2, 0);
      pedacos.push(m);   // verga: fica acima da cabeca, nao barra
    }
  }

  return { pedacos, barreiras };
}

// Uma agua do telhado: um bloco fino inclinado. Girando +x em torno do eixo X,
// a ponta que aponta para +z desce — e isso que da o caimento.
function agua(largura, corrida, altura, sentido) {
  const face = Math.hypot(corrida, altura);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(largura, 0.12, face),
    material('telhado', largura / METRO.telhado, face / METRO.telhado)
  );
  m.rotation.x = sentido * Math.atan2(altura, corrida);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function telhado(tipo, w, d, h, beiral) {
  const g = new THREE.Group();
  const largura = w + beiral * 2;
  const meia = d / 2 + beiral;

  if (tipo === 'duas-aguas') {
    const alt = 1.15;
    for (const lado of [-1, 1]) {
      const m = agua(largura, meia, alt, lado);
      m.position.set(0, h + alt / 2, lado * meia / 2);
      g.add(m);
    }

    // oitao: o triangulo que fecha a ponta, um em cada lado
    const forma = new THREE.Shape();
    forma.moveTo(-w / 2, 0);
    forma.lineTo(w / 2, 0);
    forma.lineTo(0, alt);
    forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma, { depth: ESPESSURA, bevelEnabled: false });
    for (const lado of [-1, 1]) {
      const m = new THREE.Mesh(geo, material('telhado', 0.5, 0.5));
      m.position.set(0, h, lado * d / 2 - ESPESSURA / 2);
      m.castShadow = true;
      g.add(m);
    }
  } else {
    // uma agua so: alta no fundo (-z), caindo para a frente (+z)
    const alt = 1.0;
    const corrida = d + beiral;
    const m = agua(largura, corrida, alt, 1);
    m.position.set(0, h + alt / 2, beiral / 2);
    g.add(m);

    // triangulos que fecham a lateral do desnivel.
    // com rotation.y = PI/2 o eixo X da forma vira -Z no mundo, entao o ponto
    // alto (fundo, z = -d/2) precisa estar em x = +d/2 na forma.
    const forma = new THREE.Shape();
    forma.moveTo(d / 2, alt);
    forma.lineTo(-d / 2, 0);
    forma.lineTo(-d / 2, -0.12);
    forma.lineTo(d / 2, -0.12);
    forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma, { depth: ESPESSURA, bevelEnabled: false });
    for (const lado of [-1, 1]) {
      const t = new THREE.Mesh(geo, material('telhado', 0.4, 0.4));
      t.rotation.y = Math.PI / 2;
      t.position.set(lado * w / 2 - (lado > 0 ? 0 : ESPESSURA), h, 0);
      t.castShadow = true;
      g.add(t);
    }
  }
  return g;
}

// Constroi uma cabana e devolve o grupo + as barreiras ja em coordenadas do mundo.
export function buildHut({ x, z, rot = 0, kind = 'madeira' }) {
  const spec = HUT_TYPES[kind] || HUT_TYPES.madeira;
  const { w, d, h, material: nome } = spec;

  const grupo = new THREE.Group();
  grupo.position.set(x, 0, z);
  grupo.rotation.y = rot;

  // piso um dedo acima do chao, para nao brigar com o terreno
  const piso = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, d),
    material('piso', w / METRO.piso, d / METRO.piso)
  );
  piso.position.y = 0.04;
  piso.receiveShadow = true;
  grupo.add(piso);

  const lados = [
    { nome: 'sul', comp: w, px: 0, pz: d / 2, ry: 0 },
    { nome: 'norte', comp: w, px: 0, pz: -d / 2, ry: Math.PI },
    { nome: 'leste', comp: d, px: w / 2, pz: 0, ry: -Math.PI / 2 },
    { nome: 'oeste', comp: d, px: -w / 2, pz: 0, ry: Math.PI / 2 },
  ];

  const barreiras = [];
  for (const lado of lados) {
    const { pedacos, barreiras: bs } = parede(lado.comp, h, spec.aberturas[lado.nome] || [], nome);
    const g = new THREE.Group();
    g.position.set(lado.px, 0, lado.pz);
    g.rotation.y = lado.ry;
    for (const p of pedacos) g.add(p);
    grupo.add(g);

    // leva a barreira para o mundo: local da parede -> cabana -> mundo
    for (const b of bs) {
      const ang = lado.ry + rot;
      const lx = lado.px + b.cx * Math.cos(lado.ry) + b.cz * Math.sin(lado.ry);
      const lz = lado.pz - b.cx * Math.sin(lado.ry) + b.cz * Math.cos(lado.ry);
      barreiras.push({
        x: x + lx * Math.cos(rot) + lz * Math.sin(rot),
        z: z - lx * Math.sin(rot) + lz * Math.cos(rot),
        hw: b.hw,
        hd: b.hd,
        rot: ang,
      });
    }
  }

  grupo.add(telhado(spec.telhado, w, d, h, spec.beiral));

  return { grupo, barreiras, spec };
}

// Pontos onde faz sentido nascer uma caixa dentro da cabana.
export function hutInsideSpots(hut) {
  const spec = HUT_TYPES[hut.kind] || HUT_TYPES.madeira;
  const mx = spec.w / 2 - 1.1, mz = spec.d / 2 - 1.1;
  const cantos = [[-mx, -mz], [mx, -mz], [-mx, mz], [mx, mz], [0, 0]];
  return cantos.map(([lx, lz]) => ({
    x: hut.x + lx * Math.cos(hut.rot) + lz * Math.sin(hut.rot),
    z: hut.z - lx * Math.sin(hut.rot) + lz * Math.cos(hut.rot),
  }));
}

// Raio aproximado que a cabana ocupa (para nao nascer arvore em cima).
export function hutRadius(kind) {
  const spec = HUT_TYPES[kind] || HUT_TYPES.madeira;
  return Math.hypot(spec.w, spec.d) / 2 + 1.2;
}
