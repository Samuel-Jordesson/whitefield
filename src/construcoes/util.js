import * as THREE from 'three';

// Monta o que a funcao fizer dentro de um grupo separado. Serve para o recheio
// de cada andar: com tudo em um grupo so, o jogo apaga o andar inteiro de uma
// vez quando nao tem ninguem por perto — e um `visible = false` no lugar de
// centenas de moveis indo para a placa de video a cada quadro.
export function interior(k, fn) {
  const g = new THREE.Group();
  const raiz = k.grupo;
  raiz.add(g);
  k.grupo = g;
  try { fn(); } finally { k.grupo = raiz; }
  // movel de dentro de casa nao precisa jogar sombra no sol
  g.traverse((o) => { o.castShadow = false; });
  return g;
}
