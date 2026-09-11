import * as THREE from 'three';
import * as TEX from './textures.js';

// Grama em tufos, no espirito do Zelda: balanca com rajadas de vento e se
// abre quando alguem passa por perto.
//
// Truque do tapete infinito: os tufos ficam em um quadrado de lado AREA e o
// vertex shader joga cada um para a copia mais proxima do jogador (um `mod`).
// Assim a grama acompanha quem anda sem a CPU reposicionar nada.

const AREA = 96;          // lado do tapete, em metros
const COUNT = 17000;      // tufos
const ALTURA = [0.34, 0.66];
const LARGURA = [0.46, 0.80];
const RAIO_PISADA = 1.35; // distancia em que a grama abre para o jogador
const MAX_CABANAS = 10;   // quantas cabanas o shader consegue "furar"

export class Grass {
  constructor(scene, area = AREA, count = COUNT) {
    this.scene = scene;
    this.time = 0;
    this.area = area;
    this.count = count;

    const geo = this._tuftGeometry();
    this._popular(geo, area, count);

    this.uniforms = {
      uTime: { value: 0 },
      uPlayer: { value: new THREE.Vector3() },
      uArea: { value: area },
      uRaio: { value: RAIO_PISADA },
      uHuts: { value: Array.from({ length: MAX_CABANAS }, () => new THREE.Vector4()) },
      uHutRot: { value: Array.from({ length: MAX_CABANAS }, () => new THREE.Vector2(1, 0)) },
    };

    const mat = new THREE.MeshLambertMaterial({
      map: TEX.grassTexture(),
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x777777),   // desenho de contorno: sem isso vira vulto
    });
    mat.onBeforeCompile = (shader) => this._patch(shader);
    mat.customProgramCacheKey = () => 'grama';

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;    // a posicao final so existe no shader
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  // sorteia a posicao e o tamanho de cada tufo dentro do tapete
  _popular(geo, area, count) {
    const offset = new Float32Array(count * 2);
    const dados = new Float32Array(count * 4);   // largura, altura, rotacao, fase
    for (let i = 0; i < count; i++) {
      offset[i * 2] = Math.random() * area;
      offset[i * 2 + 1] = Math.random() * area;
      dados[i * 4] = LARGURA[0] + Math.random() * (LARGURA[1] - LARGURA[0]);
      dados[i * 4 + 1] = ALTURA[0] + Math.random() * (ALTURA[1] - ALTURA[0]);
      dados[i * 4 + 2] = Math.random() * Math.PI;
      dados[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 2));
    geo.setAttribute('aDados', new THREE.InstancedBufferAttribute(dados, 4));
    geo.instanceCount = count;
  }

  // troca a distancia/densidade da grama (vem das configuracoes)
  setQuality(area, count) {
    if (area === this.area && count === this.count) return;
    this.area = area;
    this.count = count;
    this.uniforms.uArea.value = area;

    const geo = this._tuftGeometry();
    this._popular(geo, area, count);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
  }

  // Duas laminas cruzadas: de qualquer angulo o tufo tem volume.
  _tuftGeometry() {
    const a = new THREE.PlaneGeometry(1, 1, 1, 2);
    a.translate(0, 0.5, 0);
    const b = a.clone();
    b.rotateY(Math.PI / 2);

    const merge = new THREE.BufferGeometry();
    const pa = a.getAttribute('position').array, pb = b.getAttribute('position').array;
    const ua = a.getAttribute('uv').array, ub = b.getAttribute('uv').array;
    const na = a.getAttribute('normal').array, nb = b.getAttribute('normal').array;
    const ia = a.getIndex().array, ib = b.getIndex().array;

    const pos = new Float32Array(pa.length + pb.length);
    pos.set(pa); pos.set(pb, pa.length);
    const uv = new Float32Array(ua.length + ub.length);
    uv.set(ua); uv.set(ub, ua.length);
    const nor = new Float32Array(na.length + nb.length);
    nor.set(na); nor.set(nb, na.length);
    const idx = new Uint16Array(ia.length + ib.length);
    idx.set(ia);
    for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + pa.length / 3;

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    a.dispose(); b.dispose();
    return geo;
  }

  _patch(shader) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.defines = { ...(shader.defines || {}), MAX_CABANAS };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        attribute vec2 aOffset;
        attribute vec4 aDados;          // largura, altura, rotacao, fase
        uniform float uTime;
        uniform vec3 uPlayer;
        uniform float uArea;
        uniform float uRaio;
        uniform vec4 uHuts[MAX_CABANAS];      // x, z, meia largura, meia profundidade
        uniform vec2 uHutRot[MAX_CABANAS];    // cos, sen
      `)
      .replace('#include <begin_vertex>', `
        float larg = aDados.x, alt = aDados.y, rot = aDados.z, fase = aDados.w;

        // tapete infinito: pega a copia deste tufo mais perto do jogador
        vec2 rel = mod(aOffset - uPlayer.xz + uArea * 0.5, uArea) - uArea * 0.5;
        vec2 base = uPlayer.xz + rel;

        // dentro de cabana nao nasce grama
        float dentro = 0.0;
        for (int i = 0; i < MAX_CABANAS; i++) {
          vec4 h = uHuts[i];
          if (h.z <= 0.0) continue;
          vec2 d = base - h.xy;
          vec2 loc = vec2(d.x * uHutRot[i].x + d.y * uHutRot[i].y,
                          -d.x * uHutRot[i].y + d.y * uHutRot[i].x);
          if (abs(loc.x) < h.z && abs(loc.y) < h.w) dentro = 1.0;
        }

        // some devagar na borda do tapete, para nao nascer do nada na cara
        float borda = 1.0 - smoothstep(uArea * 0.26, uArea * 0.46, max(abs(rel.x), abs(rel.y)));
        alt *= borda * (1.0 - dentro);
        larg *= borda * (1.0 - dentro);

        float h01 = position.y;                 // 0 na raiz, 1 na ponta
        vec3 local = vec3(position.x * larg, h01 * alt, position.z * larg);

        // gira o tufo no proprio eixo
        float cr = cos(rot), sr = sin(rot);
        local.xz = vec2(local.x * cr - local.z * sr, local.x * sr + local.z * cr);

        // vento: uma onda lenta atravessando o campo + tremida curta de cada tufo
        float rajada = sin(uTime * 0.9 + base.x * 0.12 + base.y * 0.09);
        float tremida = sin(uTime * 3.4 + fase);
        vec2 vento = vec2(0.26 * rajada + 0.07 * tremida, 0.16 * rajada);
        local.xz += vento * h01 * h01 * alt;

        // alguem passando: a grama abre para o lado oposto e abaixa
        vec2 fuga = base - uPlayer.xz;
        float dist = length(fuga);
        float pisada = 1.0 - smoothstep(0.0, uRaio, dist);
        if (pisada > 0.001) {
          vec2 dir = dist > 0.001 ? fuga / dist : vec2(1.0, 0.0);
          local.xz += dir * pisada * h01 * alt * 1.15;
          local.y -= pisada * h01 * alt * 0.55;
        }

        vec3 transformed = vec3(base.x + local.x, local.y, base.y + local.z);
      `);
  }

  // as cabanas vem do servidor; o shader usa para nao nascer grama dentro delas
  setHuts(huts, spec) {
    for (let i = 0; i < MAX_CABANAS; i++) {
      const h = huts[i];
      if (!h) { this.uniforms.uHuts.value[i].set(0, 0, 0, 0); continue; }
      const s = spec(h.kind);
      this.uniforms.uHuts.value[i].set(h.x, h.z, s.w / 2 + 0.3, s.d / 2 + 0.3);
      this.uniforms.uHutRot.value[i].set(Math.cos(h.rot), Math.sin(h.rot));
    }
  }

  update(dt, position) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uPlayer.value.copy(position);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
