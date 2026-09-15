import * as THREE from 'three';

// Cinematicas do modo historia: a camera anda por trilhos suaves (curvas
// Catmull-Rom), com tarjas pretas de cinema, legendas, cartela de titulo,
// fade e tremida. Cada cena e uma lista de tomadas:
//
//   { dur, cam: [pontos], olhar: [pontos], fov: [de, ate], suave: true,
//     legenda: { quem, texto, de, ate }, titulo: { texto, sub, de, ate },
//     fadeEntra, fadeSai, tremor: [{ em, forca, dura }],
//     aoComecar(), aoLongo(t, dt), aoTerminar() }

const _alvo = new THREE.Vector3();
const _pos = new THREE.Vector3();

const suave = (t) => t * t * (3 - 2 * t);
const suaveMais = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function trilho(pontos) {
  const vs = pontos.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  if (vs.length === 1) return { getPoint: (t, alvo) => alvo.copy(vs[0]) };
  if (vs.length === 2) return { getPoint: (t, alvo) => alvo.lerpVectors(vs[0], vs[1], t) };
  return new THREE.CatmullRomCurve3(vs, false, 'centripetal');
}

export class Cinematica {
  constructor(camera) {
    this.camera = camera;
    this.tomadas = [];
    this.i = -1;
    this.t = 0;
    this.tempoTotal = 0;
    this.tremor = 0;

    const $ = (id) => document.getElementById(id);
    this.el = {
      raiz: $('cine'),
      legenda: $('cineLegenda'),
      quem: $('cineQuem'),
      fala: $('cineFala'),
      titulo: $('cineTitulo'),
      tituloTexto: $('cineTituloTexto'),
      tituloSub: $('cineTituloSub'),
      fade: $('cineFade'),
      pular: $('cinePular'),
    };

    // ESPACO/ENTER uma vez mostra o aviso; de novo, pula a cena
    this.avisoPular = 0;
    addEventListener('keydown', (e) => {
      if (!this.ativa || !['Space', 'Enter'].includes(e.code)) return;
      e.preventDefault();
      if (this.avisoPular > 0) this.pular();
      else this.avisoPular = 2.5;
    });
  }

  get ativa() { return this.i >= 0; }

  tocar(tomadas, { aoTerminar } = {}) {
    this.tomadas = tomadas;
    this.aoTerminarCena = aoTerminar;
    this.i = -1;
    this.el.raiz.classList.remove('hidden');
    document.body.classList.add('cinema');
    requestAnimationFrame(() => this.el.raiz.classList.add('on'));
    this._proxima();
  }

  // pula tudo, mas roda os eventos de cada tomada que faltava (quem pegou a
  // faca precisa sair da cena com a faca)
  pular() {
    if (!this.ativa) return;
    const atual = this.tomadas[this.i];
    atual?.aoTerminar?.();
    for (let k = this.i + 1; k < this.tomadas.length; k++) {
      this.tomadas[k].aoComecar?.();
      this.tomadas[k].aoTerminar?.();
    }
    this.i = this.tomadas.length;
    this._fim();
  }

  _proxima() {
    const anterior = this.tomadas[this.i];
    anterior?.aoTerminar?.();
    this.i++;
    if (this.i >= this.tomadas.length) { this._fim(); return; }

    const tm = this.tomadas[this.i];
    tm._cam = trilho(tm.cam);
    tm._olhar = trilho(tm.olhar || tm.cam.map(() => [0, 0, 0]));
    this.t = 0;
    tm.aoComecar?.();
  }

  _fim() {
    this.i = -1;
    this.el.raiz.classList.remove('on');
    this.el.legenda.classList.remove('on');
    this.el.titulo.classList.remove('on');
    this.el.pular.classList.remove('on');
    this.el.fade.style.opacity = 0;
    document.body.classList.remove('cinema');
    setTimeout(() => { if (!this.ativa) this.el.raiz.classList.add('hidden'); }, 700);
    const fn = this.aoTerminarCena;
    this.aoTerminarCena = null;
    fn?.();
  }

  update(dt) {
    if (!this.ativa) return false;
    const tm = this.tomadas[this.i];
    this.t += dt;
    const bruto = Math.min(1, this.t / tm.dur);
    const t = tm.linear ? bruto : tm.suaveMais ? suaveMais(bruto) : suave(bruto);

    tm._cam.getPoint(t, _pos);
    tm._olhar.getPoint(t, _alvo);

    // tremida (porta arrombada, tiro, rotor do helicoptero)
    for (const tr of tm.tremor || []) {
      if (this.t >= tr.em && this.t < tr.em + dt + 0.0001) this.tremor = Math.max(this.tremor, tr.forca);
    }
    if (tm.tremorContinuo) this.tremor = Math.max(this.tremor, tm.tremorContinuo);
    if (this.tremor > 0) {
      const f = this.tremor * this.tremor;
      _pos.x += (Math.random() - 0.5) * f * 0.22;
      _pos.y += (Math.random() - 0.5) * f * 0.16;
      _alvo.x += (Math.random() - 0.5) * f * 0.3;
      this.tremor = Math.max(0, this.tremor - dt * 2.2);
    }

    // camera na mao: um balanco leve de respiracao
    if (tm.mao !== false) {
      _pos.y += Math.sin(this.tempoTotal * 1.3) * 0.012;
      _alvo.x += Math.sin(this.tempoTotal * 0.7) * 0.02;
    }
    this.tempoTotal += dt;

    this.camera.position.copy(_pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(_alvo);
    if (tm.inclina) this.camera.rotateZ(tm.inclina * (1 - bruto));

    const fov = tm.fov ? tm.fov[0] + (tm.fov[1] - tm.fov[0]) * t : 55;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // fade para/do preto
    let fade = 0;
    if (tm.fadeEntra) fade = Math.max(fade, 1 - Math.min(1, this.t / tm.fadeEntra));
    if (tm.fadeSai) fade = Math.max(fade, 1 - Math.min(1, (tm.dur - this.t) / tm.fadeSai));
    this.el.fade.style.opacity = fade;

    // legenda e titulo aparecem so no trecho marcado
    const dentro = (x) => x && this.t >= (x.de ?? 0) && this.t <= (x.ate ?? tm.dur);
    if (dentro(tm.legenda)) {
      if (this.el.fala.textContent !== tm.legenda.texto) {
        this.el.quem.textContent = tm.legenda.quem || '';
        this.el.fala.textContent = tm.legenda.texto;
      }
      this.el.legenda.classList.add('on');
    } else {
      this.el.legenda.classList.remove('on');
    }
    if (dentro(tm.titulo)) {
      this.el.tituloTexto.textContent = tm.titulo.texto;
      this.el.tituloSub.textContent = tm.titulo.sub || '';
      this.el.titulo.classList.add('on');
    } else {
      this.el.titulo.classList.remove('on');
    }

    if (this.avisoPular > 0) this.avisoPular -= dt;
    this.el.pular.classList.toggle('on', this.avisoPular > 0);

    tm.aoLongo?.(bruto, dt);
    if (this.t >= tm.dur) this._proxima();
    return true;
  }
}
