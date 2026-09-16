import * as THREE from 'three';
import { WORLD_SIZE } from './world.js';

const EYE_STAND = 1.72;
const EYE_CROUCH = 1.05;
const RADIUS = 0.36;         // folga para passar em porta de apartamento
const GRAVITY = 22;
const JUMP = 7.4;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;

    this.position = new THREE.Vector3(0, 0, 8);   // pes no chao
    this.velocity = new THREE.Vector3();          // horizontal + vertical
    this.yaw = 0;
    this.pitch = 0;

    this.grounded = true;
    this.crouching = false;
    this.eye = EYE_STAND;
    this.bobTime = 0;
    this.bob = new THREE.Vector2();   // usado pela arma
    this.speed2D = 0;

    this.health = 100;
    this.keys = Object.create(null);
    this.sensitivity = 0.0022;
    this.lookScale = 1;      // reduzido enquanto o jogador esta mirando
    this.speedBoost = 1;     // cigarro deixa correr mais

    this._bindKeys();
  }

  _bindKeys() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ControlLeft', 'ShiftLeft'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = Object.create(null); });
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity * this.lookScale;
    this.pitch -= dy * this.sensitivity * this.lookScale;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt) {
    const k = this.keys;

    // --- entrada ---
    let fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);

    // joystick do celular: analogico (empurrar pouco = andar devagar)
    const t = this.toque;
    let intensidade = 1;
    if (t && (t.x || t.y)) {
      fwd = t.y;
      str = t.x;
      intensidade = Math.min(1, Math.hypot(t.x, t.y));
    }

    this.crouching = !!(k.ControlLeft || k.ControlRight);   // C agora e do cigarro
    const sprinting = (!!(k.ShiftLeft || k.ShiftRight) || !!t?.correr) && fwd > 0 && !this.crouching;

    let maxSpeed = (this.crouching ? 2.4 : sprinting ? 9.2 : 5.4) * this.speedBoost * intensidade;
    if (!this.grounded) maxSpeed *= 1.05;

    // direcao no plano XZ a partir do yaw
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wishX = -sin * fwd + cos * str;
    let wishZ = -cos * fwd - sin * str;
    const len = Math.hypot(wishX, wishZ);
    if (len > 0) { wishX /= len; wishZ /= len; }

    // aceleracao / atrito
    const accel = this.grounded ? 60 : 14;
    const friction = this.grounded ? 12 : 0.6;

    this.velocity.x += wishX * maxSpeed * accel * dt;
    this.velocity.z += wishZ * maxSpeed * accel * dt;

    const damp = Math.max(0, 1 - friction * dt);
    this.velocity.x *= damp;
    this.velocity.z *= damp;

    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (hSpeed > maxSpeed) {
      this.velocity.x *= maxSpeed / hSpeed;
      this.velocity.z *= maxSpeed / hSpeed;
    }
    this.speed2D = Math.hypot(this.velocity.x, this.velocity.z);

    // --- pulo / gravidade ---
    if (k.Space && this.grounded) {
      this.velocity.y = JUMP;
      this.grounded = false;
    }
    this.velocity.y -= GRAVITY * dt;

    // --- integra ---
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    this._collide();

    // chao: no campo e sempre 0; no modo historia vem dos pisos e escadas
    const chao = this.world.alturaChao(this.position.x, this.position.z, this.position.y);
    if (this.position.y <= chao) {
      this.position.y = chao;
      this.velocity.y = 0;
      this.grounded = true;
    } else if (this.grounded && this.velocity.y <= 0 && this.position.y - chao < 0.45) {
      // descendo rampa/degrau: gruda no piso em vez de sair quicando
      this.position.y = chao;
      this.velocity.y = 0;
    } else {
      this.grounded = false;
    }

    this._clampToField();
    this._updateCamera(dt);
  }

  _collide() {
    this._collideBoxes();
    for (const c of this.world.colliders) {
      let dx = this.position.x - c.x;
      let dz = this.position.z - c.z;
      const min = c.r + RADIUS;
      let d = Math.hypot(dx, dz);
      if (d >= min) continue;

      if (d < 0.0001) { this.position.x += min; continue; } // exatamente no centro
      const push = (min - d) / d;
      this.position.x += dx * push;
      this.position.z += dz * push;
    }
  }

  // Paredes das cabanas: retangulos que podem estar girados. Leva o jogador
  // para o espaco da parede, empurra pelo lado de menor invasao e volta.
  _collideBoxes() {
    for (const b of this.world.boxColliders) {
      // parede de outro andar nao trava (y0/y1 so existem no modo historia)
      if (b.y1 !== undefined && (this.position.y >= b.y1 - 0.05 || this.position.y + 1.8 <= b.y0)) continue;
      const sin = Math.sin(b.rot), cos = Math.cos(b.rot);
      const dx = this.position.x - b.x;
      const dz = this.position.z - b.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const limX = b.hw + RADIUS;
      const limZ = b.hd + RADIUS;
      const invX = limX - Math.abs(lx);
      const invZ = limZ - Math.abs(lz);
      if (invX <= 0 || invZ <= 0) continue;

      let px = 0, pz = 0;
      if (invX < invZ) px = Math.sign(lx || 1) * invX;
      else pz = Math.sign(lz || 1) * invZ;

      this.position.x += px * cos + pz * sin;
      this.position.z += -px * sin + pz * cos;
    }
  }

  _clampToField() {
    const lim = WORLD_SIZE - 6;
    const d = Math.hypot(this.position.x, this.position.z);
    if (d > lim) {
      this.position.x *= lim / d;
      this.position.z *= lim / d;
    }
  }

  _updateCamera(dt) {
    // altura do olho (agachar suave)
    const target = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eye += (target - this.eye) * Math.min(1, dt * 12);

    // head bob
    if (this.grounded && this.speed2D > 0.4) {
      this.bobTime += dt * this.speed2D * 1.25;
    } else {
      this.bobTime += dt * 0.8;
    }
    const amp = Math.min(this.speed2D / 9.2, 1);
    this.bob.set(
      Math.cos(this.bobTime * 1.0) * 0.035 * amp,
      Math.sin(this.bobTime * 2.0) * 0.045 * amp
    );

    this.camera.position.set(
      this.position.x + this.bob.x * 0.5,
      this.position.y + this.eye + this.bob.y * 0.5,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }
}
