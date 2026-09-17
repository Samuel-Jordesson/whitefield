import * as THREE from 'three';
import * as TEX from '../textures.js';
import * as HT from '../historia/texturas.js';

// Texturas da casa e do predio do mapa. Sao as mesmas do modo historia (mesmo
// traco de caneta), montadas uma vez so e guardadas: as duas construcoes ficam
// de pe a partida inteira e nascem iguais em toda partida.

let cache = null;

const rep = (t, x, y) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  return t;
};

export function texturasConstrucoes() {
  if (cache) return cache;

  const placas = new Map();
  const portas = new Map();

  cache = {
    // materiais de bloco do Construtor: { textura, metro }
    blocos: {
      reboco: { textura: HT.rebocoTexture(3), metro: 3.0 },
      concreto: { textura: HT.concretoTexture(7), metro: 3 },
      piso: { textura: rep(TEX.floorTexture(), 1, 1), metro: 2.4 },
      madeira: { textura: rep(TEX.plankTexture(), 1, 1), metro: 2.8 },
      tijolo: { textura: rep(TEX.brickTexture(), 1, 1), metro: 2.2 },
      telha: { textura: rep(TEX.roofTexture(), 1, 1), metro: 2.2 },
      azulejo: { textura: rep(HT.azulejoTexture(), 1, 1), metro: 1.2 },
      cobertor: { textura: HT.cobertorTexture(), metro: 1.5 },
    },

    // decalques e objetos
    mapa: {
      carpete: rep(HT.carpeteTexture(), 10, 1),
      tapete: HT.tapeteTexture(),
      poster: HT.posterTexture(),
      quadro: HT.quadroTexture(),
      telaPc: HT.telaPcTexture(),
      entulho: HT.entulhoTexture(2),
      heliponto: HT.helipontoTexture(),
      placa: (texto, op = {}) => {
        const chave = texto + JSON.stringify(op);
        if (!placas.has(chave)) placas.set(chave, HT.placaTexture(texto, op));
        return placas.get(chave);
      },
      pichacao: (t) => {
        if (!placas.has('pich' + t)) placas.set('pich' + t, HT.pichacaoTexture(t));
        return placas.get('pich' + t);
      },
      porta: (numero = '', arrombada = false) => {
        const chave = numero + (arrombada ? '!' : '');
        if (!portas.has(chave)) portas.set(chave, HT.portaTexture({ numero, arrombada }));
        return portas.get(chave);
      },
    },
  };
  return cache;
}
