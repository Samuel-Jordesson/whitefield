import * as THREE from 'three';
import * as TEX from '../textures.js';
import * as HT from './texturas.js';
import { Construtor } from './construtor.js';
import { construirMapa, H, Y_TERRACO } from './mapa1.js';
import { Billboard } from '../billboard.js';

// Fase 1 — "A Subida". Tudo o que e roteiro fica aqui: quem esta onde, o que
// cada area dispara, os checkpoints, as caixas e as duas cinematicas.

const T_ = Y_TERRACO;

function texturasDoNivel() {
  const rep = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
  const placas = new Map();
  return {
    blocos: {
      reboco: { textura: HT.rebocoTexture(3), metro: H },
      concreto: { textura: HT.concretoTexture(7), metro: 3 },
      piso: { textura: rep(TEX.floorTexture(), 1, 1), metro: 2.4 },
      madeira: { textura: rep(TEX.plankTexture(), 1, 1), metro: 2.8 },
      caixote: { textura: rep(TEX.plankTexture(), 1, 1), metro: 1.2 },
      cobertor: { textura: HT.cobertorTexture(), metro: 1.5 },
      fachada: { textura: rep(TEX.brickTexture(), 1, 1), metro: 2.2 },
    },
    mapa: {
      rua: TEX.groundTexture(),
      skyline: rep(HT.skylineTexture(5), 6, 1),
      carpete: rep(HT.carpeteTexture(), 12, 1),
      tapete: HT.tapeteTexture(),
      poster: HT.posterTexture(),
      quadro: HT.quadroTexture(),
      telaPc: HT.telaPcTexture(),
      azulejoParede: rep(HT.azulejoTexture(), 4, 2),
      entulho: HT.entulhoTexture(2),
      heliponto: HT.helipontoTexture(),
      janelinha: HT.placaTexture('+', { w: 256, h: 192 }),
      fita: HT.placaTexture('NAO ENTRE', { w: 768, h: 96, fundo: '#e6e6e6' }),
      placa: (texto, op = {}) => {
        const chave = texto + JSON.stringify(op);
        if (!placas.has(chave)) placas.set(chave, HT.placaTexture(texto, op));
        return placas.get(chave);
      },
      pichacao: (t) => HT.pichacaoTexture(t),
      porta31: HT.portaTexture({ numero: '31' }),
      porta32: HT.portaTexture({ numero: '32' }),
      porta33arrombada: HT.portaTexture({ numero: '33', arrombada: true }),
      porta34: HT.portaTexture({ numero: '34' }),
      porta35: HT.portaTexture({ numero: '35' }),
      porta36arrombada: HT.portaTexture({ numero: '36', arrombada: true }),
      portaLavanderia: HT.portaTexture({ numero: 'LAV' }),
      portaBanheiro: HT.portaTexture({}),
      portaSaida: HT.portaTexture({ numero: 'SAIDA' }),
      porta41: HT.portaTexture({ numero: '41' }),
      porta42: HT.portaTexture({ numero: '42' }),
      porta43: HT.portaTexture({ numero: '43' }),
      porta44: HT.portaTexture({ numero: '44' }),
      porta45: HT.portaTexture({ numero: '45', arrombada: true }),
      porta46arrombada: HT.portaTexture({ numero: '46', arrombada: true }),
      porta47: HT.portaTexture({ numero: '47' }),
      portaBarricada: HT.portaTexture({ numero: 'X' }),
      portaTerraco: HT.portaTexture({ numero: 'TERRACO' }),
    },
  };
}

// olhar para +x = yaw -PI/2, -x = PI/2, +z = PI, -z = 0
const YAW = { '+x': -Math.PI / 2, '-x': Math.PI / 2, '+z': Math.PI, '-z': 0 };

export function criarFase1() {
  const tex = texturasDoNivel();
  const k = new Construtor(tex.blocos);
  const ref = construirMapa(k, tex.mapa);

  return {
    id: 'fase1',
    nome: 'A SUBIDA',
    nivel: { grupo: k.grupo, barreiras: k.barreiras, pisos: k.pisos, solidos: k.solidos, fog: { near: 26, far: 170 } },
    ref,

    inicio: { x: 1.4, y: 0, z: 5.4, yaw: -Math.PI / 4 },
    armasInicio: [null, null, null],

    checkpoints: [
      { x: 1.4, y: 0, z: 5.4, yaw: -Math.PI / 4 },          // 0 quarto
      { x: 35.3, y: H, z: -1.2, yaw: YAW['-x'] },           // 1 patamar do 1o andar
      { x: -3.3, y: H, z: 0, yaw: YAW['-x'] },              // 2 escada oeste
      { x: -3.4, y: T_, z: 0, yaw: YAW['+x'] },             // 3 terraco
    ],

    objetivoInicial: 'Pegue a faca',

    // cp = a partir de qual checkpoint o inimigo volta quando voce morre
    inimigos: [
      // ---- andar 0 ----
      { nome: 'Brito', char: 2, arma: 'pistola', cp: 0, grupo: 'corredor0', x: 12, y: 0, z: 0.3,
        patrulha: [[12, 0.3], [21, -0.4]], area: [4, 24, -1.2, 1.2], olhar: '+x', itens: ['pistola'] },
      { nome: 'Caco', char: 1, arma: 'pistola', cp: 0, grupo: 'lavanderia', x: 2, y: 0, z: -5,
        patrulha: [[2, -5], [4.5, -7.8], [0.5, -7.5]], area: [-1.5, 7.5, -9, -2.2], olhar: '-z', itens: ['vida'] },
      { nome: 'Rato', char: 3, arma: 'rifle', cp: 0, grupo: 'ap33', x: 21, y: 0, z: 6.2,
        area: [16.6, 24.5, 2.2, 9.4], olhar: '-z', itens: ['rifle'] },
      { nome: 'Dente', char: 2, arma: 'escopeta', cp: 0, grupo: 'ap34', x: 31.5, y: 0, z: 6.6,
        area: [29, 33.8, 2.2, 9.4], olhar: '-z', itens: ['escopeta', 'granada'] },
      { nome: 'Pardal', char: 1, arma: 'pistola', cp: 0, grupo: 'ap36', x: 26.8, y: 0, z: -6.2,
        area: [23.6, 33.4, -9.2, -2.2], olhar: '+z', itens: ['vida'] },
      { nome: 'Nego', char: 3, arma: 'rifle', cp: 0, grupo: 'ap36', x: 30.5, y: 0, z: -7.6,
        area: [23.6, 33.4, -9.2, -2.2], olhar: '+z', itens: ['granada'] },
      { nome: 'Tiziu', char: 2, arma: 'pistola', cp: 0, grupo: 'escadaL', x: 44.3, y: H / 2, z: -2.4,
        area: [43.3, 45.4, -3.9, 3.9], olhar: '-x', itens: ['vida'] },

      // ---- andar 1 ----
      { nome: 'Bigode', char: 1, arma: 'rifle', cp: 1, grupo: 'corredor1', x: 25.4, y: H, z: 1.0,
        area: [23, 29.5, -1.3, 1.3], olhar: '+x', itens: ['granada'] },
      { nome: 'Sujo', char: 3, arma: 'pistola', cp: 1, grupo: 'corredor1', x: 22.8, y: H, z: -1.0,
        area: [19.2, 24, -1.3, 1.3], olhar: '+x', itens: ['vida'] },
      { nome: 'Cobra', char: 2, arma: 'escopeta', cp: 1, grupo: 'ap46', x: 17.2, y: H, z: -7.6,
        area: [9, 21.5, -9.2, -2.2], olhar: '+z', itens: ['escopeta', 'vida'] },
      { nome: 'Magro', char: 1, arma: 'pistola', cp: 1, grupo: 'ap46', x: 10.4, y: H, z: -3.6,
        patrulha: [[10.4, -3.6], [10.4, -8.4]], area: [9, 21.5, -9.2, -2.2], olhar: '+x', itens: ['granada'] },
      { nome: 'Grilo', char: 3, arma: 'rifle', cp: 1, grupo: 'ap45', x: 1.5, y: H, z: -6.8,
        area: [-1.5, 7.5, -9.2, -2.2], olhar: '+x', itens: ['vida'] },
      { nome: 'Toco', char: 2, arma: 'pistola', cp: 1, grupo: 'corredor1oeste', x: 0.5, y: H, z: 0.4,
        patrulha: [[0.5, 0.4], [10.5, -0.3]], area: [-1.5, 11.5, -1.3, 1.3], olhar: '+x', itens: ['vida', 'granada'] },

      // ---- escada oeste ----
      { nome: 'Nino', char: 1, arma: 'pistola', cp: 2, grupo: 'escadaO1', x: -12.3, y: H * 1.5, z: -2.2,
        area: [-13.4, -11.2, -3.9, 3.9], olhar: '+x', itens: ['vida'] },
      { nome: 'Faisca', char: 3, arma: 'rifle', cp: 2, grupo: 'escadaO2', x: -3.3, y: 2 * H, z: -2.6,
        area: [-4.4, -2.3, -3.9, 3.9], olhar: '-x', itens: ['granada'] },
      { nome: 'Pato', char: 2, arma: 'escopeta', cp: 2, grupo: 'escadaO2', x: -12.3, y: H * 2.5, z: 2.5,
        area: [-13.4, -11.2, -3.9, 3.9], olhar: '+x', itens: ['vida', 'vida'] },

      // ---- terraco ----
      { nome: 'Lobo', chefe: true, char: 3, arma: 'rifle', vida: 240, cp: 3, grupo: 'terraco', x: 20, y: T_, z: -3.2,
        area: [13, 27, -8, 8], olhar: '-x', itens: ['snipe', 'vida'] },
      { nome: 'Corvo', char: 1, arma: 'rifle', cp: 3, grupo: 'terraco', x: 5.2, y: T_, z: -8.6,
        area: [1, 9.5, -9.4, -5.6], olhar: '-x', itens: ['granada'] },
      { nome: 'Sapo', char: 2, arma: 'pistola', cp: 3, grupo: 'terraco', x: 8.8, y: T_, z: 7.6,
        area: [5, 14, 3.8, 9.4], olhar: '-x', itens: ['vida'] },
      { nome: 'Bode', char: 3, arma: 'escopeta', cp: 3, grupo: 'terraco', x: 25.6, y: T_, z: 5.6,
        area: [20, 28, 1.8, 9.4], olhar: '-x', itens: ['vida'] },
      { nome: 'Gato', char: 1, arma: 'rifle', cp: 3, grupo: 'terraco', x: 28.6, y: T_, z: -8.4,
        area: [24, 33.4, -9.4, -4.2], olhar: '-x', itens: ['granada'] },
      { nome: 'Pombo', char: 2, arma: 'pistola', cp: 3, grupo: 'terraco', x: 12.8, y: T_, z: -5.2,
        area: [9.5, 16, -9, -3.6], olhar: '-x', itens: ['vida'] },
    ],

    caixas: [
      { id: 0, x: 23.8, y: 0, z: 8.8, items: ['vida', 'granada'], cp: 0 },
      { id: 1, x: 32.6, y: H, z: 5.4, items: ['colete', 'vida', 'granada', 'cigarro'], cp: 1 },
      { id: 2, x: 20.8, y: H, z: -8.8, items: ['rifle', 'vida'], cp: 1 },
      { id: 3, x: -2.9, y: 2 * H, z: 3.4, items: ['colete', 'vida', 'granada'], cp: 2 },
      { id: 4, x: -3.1, y: T_, z: 3.5, items: ['vida'], cp: 3 },
    ],

    // areas que disparam coisas quando o jogador entra
    gatilhos: [
      { id: 'corredor', area: [-2, 34, -1.6, 1.6, -1, 2.5],
        objetivo: 'Chegue a escada de emergencia no fim do corredor' },
      { id: 'meioCorredor', area: [21, 34, -1.6, 1.6, -1, 2.5], alerta: ['ap34', 'ap36'] },
      { id: 'escadaLeste', area: [34, 45.7, -4.3, 4.3, -1, 2.6], alerta: ['escadaL'],
        objetivo: 'Suba para o 1o andar' },
      { id: 'andar1', area: [34, 36.6, -4.3, 4.3, H - 0.3, H + 2], checkpoint: 1,
        objetivo: 'O teto da escada caiu. Atravesse o 1o andar ate a escada oeste',
        legenda: 'A escada acabou aqui. Vou ter que cruzar o andar inteiro.' },
      { id: 'desabamento', area: [17.5, 20, -1.6, 1.6, H - 0.3, H + 2],
        objetivo: 'Corredor bloqueado: passe pelo apartamento 46',
        legenda: 'Desabou tudo... o 46 esta arrombado, da pra passar por dentro.' },
      { id: 'ap45', area: [-2, 8, -10, -1.6, H - 0.3, H + 2], alerta: ['ap45', 'corredor1oeste'] },
      { id: 'escadaOeste', area: [-4.6, -2, -4.3, 4.3, H - 0.3, H + 1.2], checkpoint: 2,
        alerta: ['escadaO1'], objetivo: 'Suba ate o terraco' },
      { id: 'escadaO2', area: [-13.7, -2, -4.3, 4.3, H * 1.6, H * 2.4], alerta: ['escadaO2'] },
      { id: 'terraco', area: [-2, 7, -10, 10, T_ - 0.3, T_ + 2], checkpoint: 3, alerta: ['terraco'],
        objetivo: 'Elimine os invasores do terraco',
        legenda: 'O helicoptero do predio! Se eu chegar nele, eu saio daqui.' },
    ],

    helicoptero: { x: 17, y: T_, z: 0, raio: 5.2, grupoLimpo: 'terraco' },

    cenaInicial: (ctx) => cenaInicial(ctx, ref),
    cenaFinal: (ctx) => cenaFinal(ctx, ref),
  };
}

/* ---------------- cinematicas ---------------- */

// personagem de papelao para as cenas (encara a camera sozinho)
function ator(ctx, char, x, y, z, pose = 'idle') {
  const info = ctx.characters[String(char)] || ctx.characters['1'];
  const p = info[pose];
  const b = new Billboard(p.texture, p.w, p.h, { doubleSide: true });
  b.material.emissive = new THREE.Color(0x6a6a6a);
  b.position.set(x, y, z);
  ctx.scene.add(b);
  ctx.atores.push(b);
  return b;
}

function tirar(ctx, b) {
  ctx.scene.remove(b);
  b.material.dispose();
  ctx.atores.splice(ctx.atores.indexOf(b), 1);
}

function cenaInicial(ctx, ref) {
  let eu = null;
  let invasores = [];
  const fovJogo = ctx.fovBase;

  return [
    {
      dur: 7, fadeEntra: 2.2, fov: [48, 42], mao: false,
      // da rua, subindo ate a janela do quarto (a unica acesa no andar)
      cam: [[-30, 9, 36], [-19, 5, 22], [-8.5, 1.8, 9.2]],
      olhar: [[4, 4, -2], [-2, 2.2, 5], [-2, 1.55, 5.95]],
      titulo: { texto: 'CAPITULO 1', sub: 'A SUBIDA', de: 1.2, ate: 5.6 },
    },
    {
      // atravessa a janela: cama desfeita, tapete, e o computador ligado no escuro
      dur: 6.2, fov: [42, 50],
      cam: [[-7, 1.62, 5.95], [-2.6, 1.62, 5.95], [-0.9, 1.7, 5.7], [2.6, 1.75, 4.9]],
      olhar: [[-1, 1.5, 5.95], [1, 1.3, 5.9], [2.6, 1.0, 5.0], [6.6, 1.1, 4.2]],
      legenda: { texto: '3 da manha. Mais uma noite sem conseguir dormir.', de: 2.4, ate: 6.0 },
    },
    {
      dur: 5, fov: [44, 30],
      cam: [[4.4, 1.4, 5.4], [5.75, 1.22, 4.45]],
      olhar: [[6.6, 1.15, 4.2], [6.6, 1.15, 4.2]],
      legenda: { quem: 'TELA', texto: 'ALERTA: invasao no bloco C. Portaria sem resposta.', de: 0.9, ate: 4.8 },
    },
    {
      dur: 3.8, fov: [50, 46],
      cam: [[2.3, 1.55, 6.8], [2.7, 1.5, 6.2]],
      olhar: [[5.2, 1.2, 1.6], [5.2, 1.05, 1.6]],
      tremor: [{ em: 0.35, forca: 1.6 }, { em: 1.5, forca: 1.1 }, { em: 2.3, forca: 0.7 }],
      legenda: { texto: '*BAM*  ...  *BAM*', de: 0.35, ate: 3.0 },
      aoComecar: () => ctx.apagao(true),
      aoTerminar: () => ctx.apagao(false),
    },
    {
      dur: 5.6, fov: [46, 40],
      // espia pela porta ate sair no corredor e ver os invasores chegando
      cam: [[5.2, 1.58, 3.0], [5.25, 1.55, 1.1], [5.1, 1.5, 0.55]],
      olhar: [[5.2, 1.4, 0], [9, 1.35, 0.2], [15, 1.3, 0]],
      aoComecar: () => {
        invasores = [
          ator(ctx, 2, 23.5, 0, 0.5, 'aim'),
          ator(ctx, 3, 25.2, 0, -0.6, 'aim'),
          ator(ctx, 1, 27, 0, 0.3),
        ];
      },
      aoLongo: (t, dt) => { for (const b of invasores) b.position.x -= dt * 1.6; },
      aoTerminar: () => { for (const b of invasores) tirar(ctx, b); invasores = []; },
      legenda: { quem: 'INVASOR', texto: 'Andar por andar. Ninguem sai deste predio.', de: 1.4, ate: 5.3 },
    },
    {
      dur: 4.6, fov: [44, 28],
      cam: [[1.5, 1.4, 6.1], [0.5, 0.98, 6.75]],
      olhar: [[0, 0.6, 7.0], [-0.02, 0.57, 6.98]],
      aoComecar: () => { if (eu) { tirar(ctx, eu); eu = null; } },
      legenda: { texto: 'Sem arma. Vai ter que ser na faca.', de: 0.7, ate: 4.4 },
    },
    {
      dur: 2.3, fov: [34, fovJogo], mao: false, linear: false,
      cam: [[0.55, 1.15, 6.45], [1.4, 1.72, 5.4]],
      olhar: [[-0.02, 0.57, 6.98], [5.2, 1.52, 1.6]],
      aoComecar: () => { ref.faca.visible = false; },
      aoTerminar: () => { ref.faca.visible = false; },
    },
  ];
}

function cenaFinal(ctx, ref) {
  const y = T_;
  const heli = ref.helicoptero;
  const p = ctx.jogador.clone();
  let eu = null;
  const inicio = heli.grupo.position.clone();

  return [
    {
      dur: 3.4, fov: [52, 48],
      cam: [[p.x - 2.5, p.y + 2.3, p.z + 3.4], [11.5, y + 2.4, 6.2]],
      olhar: [[p.x, p.y + 1.1, p.z], [17, y + 1.4, 0.9]],
      aoComecar: () => { eu = ator(ctx, ctx.operador, p.x, p.y, p.z); ctx.rotor(10); },
      aoLongo: (t) => {
        eu.position.lerpVectors(p, new THREE.Vector3(17.4, y, 1.7), Math.min(1, t * 1.15));
      },
      legenda: { texto: 'Vamos, vamos, liga isso!', de: 0.8, ate: 3.2 },
      tremorContinuo: 0.12,
    },
    {
      dur: 5.2, fov: [50, 56],
      cam: [[9, y + 2.2, 9], [16, y + 3.4, 12.5], [25, y + 5, 8], [28, y + 7.5, -2]],
      olhar: [[17, y + 1.5, 0], [17, y + 3, 0], [17, y + 5, 0], [15, y + 7.5, 0]],
      aoComecar: () => { if (eu) { tirar(ctx, eu); eu = null; } ctx.rotor(26); },
      aoLongo: (t) => {
        heli.grupo.position.set(inicio.x - t * 1.5, inicio.y + t * t * 7.5, inicio.z);
        heli.grupo.rotation.z = Math.sin(t * Math.PI) * 0.12;
        heli.grupo.rotation.x = t * 0.08;
      },
      tremorContinuo: 0.3,
      legenda: { texto: 'Segura firme. Nao olha pra baixo.', quem: 'PILOTO', de: 2.2, ate: 5 },
    },
    {
      dur: 7, fov: [45, 40], fadeSai: 2.4,
      cam: [[58, y + 12, 40], [64, y + 20, 46]],
      olhar: [[16, y + 8, 0], [-26, y + 26, -40]],
      aoLongo: (t) => {
        const de = new THREE.Vector3(inicio.x - 1.5, inicio.y + 7.5, inicio.z);
        const ate = new THREE.Vector3(-70, y + 36, -80);
        heli.grupo.position.lerpVectors(de, ate, t * t);
        heli.grupo.rotation.set(0.12, Math.atan2(ate.z - de.z, -(ate.x - de.x)) * Math.min(1, t * 2), -0.1);
      },
      titulo: { texto: 'FASE 1 CONCLUIDA', sub: 'o predio caiu. voce nao.', de: 2.2 },
    },
  ];
}
