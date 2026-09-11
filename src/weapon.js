import { WEAPONS } from './weapons.js';

// View model do que esta na mao: rifle, pistola ou granada.
// Tudo e sprite 2D em overlay, com bob, sway, recuo, clarao e mira.

export class Weapon {
  constructor({ onShoot, onThrow }) {
    this.wrap = document.getElementById('weaponWrap');
    this.img = document.getElementById('weapon');
    this.overlay = document.getElementById('weaponItem');
    this.muzzle = document.getElementById('muzzle');
    this.scopeWrap = document.getElementById('scopeWrap');
    this.scopeImg = document.getElementById('scope');
    this.muzzleAds = document.getElementById('muzzleAds');
    this.ammoBox = document.getElementById('ammoBox');
    this.ammoEl = document.getElementById('ammo');
    this.ammoMaxEl = document.getElementById('ammoMax');
    this.reloadEl = document.getElementById('reloading');
    this.hitmarker = document.getElementById('hitmarker');
    this.crosshair = document.getElementById('crosshair');
    this.nameEl = document.getElementById('weaponName');

    this.onShoot = onShoot;
    this.onThrow = onThrow;

    // municao guardada por arma, para nao zerar ao trocar
    this.ammoOf = { rifle: WEAPONS.rifle.mag, pistola: WEAPONS.pistola.mag };
    this.swing = 0;          // animacao do golpe de faca

    this.cooldown = 0;
    this.reloadLeft = 0;
    this.recoil = 0;
    this.recoilVel = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.flashLeft = 0;
    this.hitLeft = 0;
    this.triggerHeld = false;

    this.wantAim = false;
    this.aim = 0;              // 0 = quadril, 1 = mirando

    this.equip('rifle');
  }

  /* ---------------- troca de equipamento ---------------- */

  equip(key) {
    if (!WEAPONS[key] || this.key === key) return;
    this.key = key;
    this.spec = WEAPONS[key];

    this.reloadLeft = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.recoilVel = 0;
    this.reloadEl.classList.remove('on');
    this.muzzle.classList.remove('on');
    this.muzzleAds.classList.remove('on');

    const v = this.spec.view;
    this.wrap.style.width = v.width + 'vw';
    this.wrap.style.right = v.right + 'vw';
    this.wrap.style.bottom = v.bottom + 'vh';
    this.wrap.style.transformOrigin = `${v.originX * 100}% ${v.originY * 100}%`;
    this.img.src = this.spec.img;

    // PNG com fundo branco: multiply apaga o branco e deixa so o traco
    this.img.classList.toggle('multiply', !!this.spec.fundoBranco);

    if (this.spec.kind === 'empty' || this.spec.kind === 'melee') {
      this.overlay.classList.add('hidden');
      this.ammoBox.classList.add('hidden');
    } else if (this.spec.kind === 'gun') {
      this.overlay.classList.add('hidden');
      this.muzzle.style.left = this.spec.muzzle.x * 100 + '%';
      this.muzzle.style.top = this.spec.muzzle.y * 100 + '%';
      this.scopeImg.src = this.spec.scope;
      this.scopeImg.style.height = this.spec.scopeHeight + 'vh';
      this.muzzleAds.style.left = this.spec.aimPoint.x * 100 + '%';
      this.ammoBox.classList.remove('hidden');
      this.ammoMaxEl.textContent = '/' + this.spec.mag;
    } else {
      // granada: a mao segura o item no lugar do cano
      this.overlay.classList.remove('hidden');
      this.overlay.src = this.spec.overlay;
      this.overlay.style.left = this.spec.hold.x * 100 + '%';
      this.overlay.style.top = this.spec.hold.y * 100 + '%';
      this.overlay.style.width = this.spec.hold.size * 100 + '%';
      this.ammoBox.classList.add('hidden');
    }

    this.nameEl.textContent = this.spec.name;
    this._renderAmmo();
  }

  get isGun() { return this.spec.kind === 'gun'; }
  get isMelee() { return this.spec.kind === 'melee'; }
  get isThrow() { return this.spec.kind === 'throw'; }
  get ammo() { return this.ammoOf[this.key] ?? 0; }
  set ammo(v) { this.ammoOf[this.key] = v; }
  get reloading() { return this.reloadLeft > 0; }
  get aiming() { return this.wantAim && !this.reloading; }
  get damage() { return this.spec.damage || 0; }

  setAiming(on) { this.wantAim = on; }

  /* ---------------- acao ---------------- */

  pullTrigger() {
    this.triggerHeld = true;
    this._fire();
  }

  releaseTrigger() { this.triggerHeld = false; }

  // chamado todo frame enquanto o botao esta pressionado
  holdTrigger() {
    if (this.isGun && this.spec.auto) this._fire();
    if (this.isMelee) this._fire();                   // segurando, golpeia sem parar
  }

  _fire() {
    if (this.cooldown > 0 || this.reloading) return false;
    if (this.spec.kind === 'empty') return false;     // mao vazia nao faz nada

    if (this.isMelee) {
      this.cooldown = this.spec.fireDelay;
      this.swing = 1;                                 // dispara a facada
      this.recoilVel += this.spec.recoil;
      this.onShoot?.();
      return true;
    }

    if (!this.isGun) {
      this.cooldown = 0.6;
      this.recoilVel += 7;
      this.onThrow?.();
      return true;
    }

    if (this.ammo <= 0) { this.reload(); return false; }

    this.ammo--;
    this.cooldown = this.spec.fireDelay;
    this.recoilVel += this.spec.recoil * (this.aim > 0.5 ? 0.7 : 1);
    this.flashLeft = 0.055;
    (this.aim > 0.5 ? this.muzzleAds : this.muzzle).classList.add('on');
    this._renderAmmo();
    this.onShoot?.();
    return true;
  }

  reload() {
    if (!this.isGun || this.reloading || this.ammo === this.spec.mag) return;
    this.reloadLeft = this.spec.reloadTime;
    this.reloadEl.classList.add('on');
  }

  showHit() {
    this.hitLeft = 0.09;
    this.hitmarker.classList.add('on');
  }

  refill() {
    for (const k of Object.keys(this.ammoOf)) this.ammoOf[k] = WEAPONS[k].mag;
    this.reloadLeft = 0;
    this.reloadEl.classList.remove('on');
    this._renderAmmo();
  }

  /* ---------------- animacao ---------------- */

  update(dt, player, look) {
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0;
        this.ammo = this.spec.mag;
        this.reloadEl.classList.remove('on');
        this._renderAmmo();
      }
    }

    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      if (this.flashLeft <= 0) {
        this.muzzle.classList.remove('on');
        this.muzzleAds.classList.remove('on');
      }
    }
    if (this.hitLeft > 0) {
      this.hitLeft -= dt;
      if (this.hitLeft <= 0) this.hitmarker.classList.remove('on');
    }

    if (this.triggerHeld) this.holdTrigger();

    // transicao suave da mira
    const target = this.aiming ? 1 : 0;
    this.aim += (target - this.aim) * Math.min(1, dt * 11);
    this.crosshair.classList.toggle('aiming', this.aim > 0.5 && this.isGun);

    // a facada: vai rapido e volta
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.4);

    // mola do recuo
    this.recoilVel -= this.recoil * 90 * dt;
    this.recoilVel *= Math.max(0, 1 - 11 * dt);
    this.recoil += this.recoilVel * dt;

    const calm = 1 - this.aim * 0.8;
    const targetX = (player.bob.x * 22 - (look.dx || 0) * 0.05) * calm;
    const targetY = (player.bob.y * 26 + (look.dy || 0) * 0.05) * calm;
    this.swayX += (targetX - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (targetY - this.swayY) * Math.min(1, dt * 8);

    const air = (player.grounded ? 0 : -8) * calm;
    const crouch = (player.crouching ? 18 : 0) * calm;
    const reloadDip = this.reloading
      ? Math.sin((1 - this.reloadLeft / this.spec.reloadTime) * Math.PI) * 90 : 0;
    const muzzle = this.spec.muzzle || { x: 0.5, y: 0.5 };

    // com a mira armada a arma encolhe e desliza ate o cano cair no centro;
    // como o scale acontece em volta do transform-origin, o deslocamento
    // precisa levar a escala em conta: p' = O + s * (p - O)
    const adsFactor = this.isGun ? this.aim : 0;
    const scale = (1 + this.recoil * 0.035) * (1 - adsFactor * 0.42);

    const w = this.wrap.offsetWidth, h = this.wrap.offsetHeight;
    const v = this.spec.view;
    let adsX = 0, adsY = 0;
    if (adsFactor > 0) {
      const originX = this.wrap.offsetLeft + v.originX * w;
      const originY = this.wrap.offsetTop + v.originY * h;
      const mx = originX + scale * (this.wrap.offsetLeft + muzzle.x * w - originX);
      const my = originY + scale * (this.wrap.offsetTop + muzzle.y * h - originY);
      adsX = (innerWidth * 0.5 - mx) * adsFactor;
      adsY = (innerHeight * 0.60 - my) * adsFactor;
    }

    // golpe de faca: a mao avanca na diagonal e gira
    const golpe = Math.sin(this.swing * Math.PI);
    const px = this.swayX + adsX - golpe * 120;
    const py = this.swayY + adsY + air + crouch + reloadDip - this.recoil * 26 * calm - golpe * 40;
    const rot = (-this.recoil * 5 + this.swayX * 0.18) * calm
      + (this.reloading ? reloadDip * 0.12 : 0) - golpe * 26;

    this.wrap.style.transform =
      `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

    this._updateScope();
  }

  // A mira entra no lugar da arma: o ponto de visada fica no centro exato da
  // tela e a arma vai sumindo por tras, como num FPS de celular.
  _updateScope() {
    const showing = this.isGun && this.aim > 0.02;
    this.scopeWrap.classList.toggle('hidden', !showing);
    this.wrap.style.opacity = this.isGun
      ? Math.max(0, 1 - this.aim * 2.2).toFixed(3) : '1';
    if (!showing) return;

    const t = Math.min(1, Math.max(0, (this.aim - 0.25) / 0.55));
    const zoom = 1 + (1 - this.aim) * 0.10;

    const w = this.scopeWrap.offsetWidth, h = this.scopeWrap.offsetHeight;
    const aimX = this.spec.aimPoint.x * w * zoom;
    const aimY = this.spec.aimPoint.y * h * zoom;

    const sx = this.swayX * 0.5;
    const sy = this.swayY * 0.5 - this.recoil * 14;

    this.scopeWrap.style.opacity = t.toFixed(3);
    this.scopeWrap.style.transform =
      `translate3d(${(innerWidth * 0.5 - aimX + sx).toFixed(2)}px, ${(innerHeight * 0.5 - aimY + sy).toFixed(2)}px, 0) scale(${zoom.toFixed(3)})`;
  }

  _renderAmmo() {
    if (!this.isGun) return;
    this.ammoEl.textContent = this.ammo;
    this.ammoEl.classList.toggle('empty', this.ammo === 0);
  }
}
