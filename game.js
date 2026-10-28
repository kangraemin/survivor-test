// 화질·타격감 테스트용 한 화면. 에셋: assets/hero_r0~2, mob_r0~2, tiles.png
const W = 270, H = 480, WORLD = 1600;

class Play extends Phaser.Scene {
  preload() {
    for (const k of ['hero_r0', 'hero_r1', 'hero_r2', 'mob_r0', 'mob_r1', 'mob_r2']) this.load.image(k, `assets/${k}.png`);
    this.load.image('tiles', 'assets/tiles.png');
    this.load.image('deco', 'assets/deco.png');
  }

  sheet(key, frames = 4) {
    const img = this.textures.get(key).getSourceImage();
    this.textures.addSpriteSheet(key + 's', img, { frameWidth: img.width / frames, frameHeight: img.height });
    return key + 's';
  }

  create() {
    const A = (key, sheet, rate, repeat = -1) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheet), frameRate: rate, repeat });
    A('walkDown', this.sheet('hero_r0'), 8);
    A('walkSide', this.sheet('hero_r1'), 8);
    A('slash', this.sheet('hero_r2'), 18, 0);
    A('slime', this.sheet('mob_r0'), 6);
    A('skel', this.sheet('mob_r1'), 7);
    A('bat', this.sheet('mob_r2'), 10);

    // 바닥: 타일 0~3 풀, 4~7 돌바닥, 8~9 금 간 돌, 10~11 이끼. 가운데 광장과 갈림길은 돌, 나머지는 풀
    const ts = this.textures.get('tiles').getSourceImage();
    const T = ts.width / 4;
    this.textures.addSpriteSheet('tile', ts, { frameWidth: T, frameHeight: T });
    const ds = this.textures.get('deco').getSourceImage();
    this.textures.addSpriteSheet('decos', ds, { frameWidth: ds.width / 4, frameHeight: ds.height });
    const rt = this.add.renderTexture(0, 0, WORLD, WORLD).setOrigin(0).setDepth(-10);
    // 같은 타일도 90도씩 돌려 깔아 반복 무늬가 덜 보이게 한다
    const stamp = this.make.image({ key: 'tile', add: false });
    const R = Phaser.Math.Between, c = WORLD / 2;
    const zone = (x, y) => (Math.hypot(x - c, y - c) < 190 || Math.abs(x - c) < 50 || Math.abs(y - c) < 50) ? 1 : 0;
    for (let y = 0; y < WORLD; y += T) for (let x = 0; x < WORLD; x += T) {
      const z = zone(x, y), edge = z !== zone(x + T, y) || z !== zone(x - T, y) || z !== zone(x, y + T) || z !== zone(x, y - T);
      const n = Math.random();
      stamp.setFrame(edge ? R(10, 11) : z ? (n < 0.85 ? R(4, 5) : R(8, 9)) : (n < 0.85 ? Phaser.Math.RND.pick([0, 2]) : 3));
      stamp.setAngle(R(0, 3) * 90);
      rt.draw(stamp, x + T / 2, y + T / 2);
    }
    // 장식: 덤불·바위·부서진 기둥은 풀밭에, 횃불은 광장 둘레에
    this.torches = [];
    for (let i = 0; i < 90; i++) {
      const x = R(0, WORLD), y = R(0, WORLD);
      if (Math.hypot(x - c, y - c) < 220) continue;
      this.add.image(x, y, 'decos', R(0, 2)).setOrigin(0.5, 1).setDepth(y > c ? 6 : 2);
    }
    for (let a = 0; a < 8; a++) {
      const x = c + Math.cos(a * Math.PI / 4) * 200, y = c + Math.sin(a * Math.PI / 4) * 200;
      this.add.image(x, y, 'decos', 3).setOrigin(0.5, 1).setDepth(2);
      this.torches.push({ x, y: y - 40 });
    }

    this.hero = this.physics.add.sprite(WORLD / 2, WORLD / 2, 'hero_r0s').play('walkDown').setDepth(5);
    this.hero.body.setSize(this.hero.width * 0.5, this.hero.height * 0.4).setOffset(this.hero.width * 0.25, this.hero.height * 0.55);
    this.heroShadow = this.add.ellipse(0, 0, this.hero.width * 0.7, 6, 0x000000, 0.35).setDepth(4);
    this.face = 1; this.hp = 100; this.kills = 0; this.t0 = this.time.now; this.hitstop = 0;

    this.mobs = this.physics.add.group();
    this.gems = this.physics.add.group();
    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15).setBounds(0, 0, WORLD, WORLD).setRoundPixels(true);
    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.hero.setCollideWorldBounds(true);

    // 픽셀 파티클 텍스처
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('px', 2, 2);
    g.clear().fillStyle(0x7df9ff).fillRect(1, 0, 2, 4).fillRect(0, 1, 4, 2).generateTexture('gem', 4, 4);
    g.destroy();
    this.spark = this.add.particles(0, 0, 'px', {
      speed: { min: 40, max: 140 }, lifespan: { min: 150, max: 380 }, scale: { start: 1.5, end: 0 },
      tint: [0xffffff, 0xffe066, 0xff7b3a], emitting: false, depth: 8,
    });
    this.goo = this.add.particles(0, 0, 'px', {
      speed: { min: 30, max: 110 }, lifespan: 450, scale: { start: 2, end: 0.5 }, gravityY: 200,
      emitting: false, depth: 3,
    });

    // 어두운 화면 + 주인공 주변 횃불빛
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(20);
    const lg = this.make.graphics({ add: false });
    for (let r = 150; r > 0; r -= 6) { lg.fillStyle(0xffffff, 0.06); lg.fillCircle(150, 150, r); }
    lg.generateTexture('light', 300, 300); lg.destroy();
    this.glow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a3c).setAlpha(0.18).setDepth(19);

    this.hurtFx = this.add.rectangle(0, 0, W, H, 0xff2020, 0).setOrigin(0).setScrollFactor(0).setDepth(21);
    this.makeHud();
    this.makeJoystick();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.attack() });
    this.time.addEvent({ delay: 260, loop: true, callback: () => this.spawn() });
    for (let i = 0; i < 40; i++) this.spawn(true);
    this.physics.add.collider(this.mobs, this.mobs);
    this.physics.add.overlap(this.hero, this.mobs, (h, m) => this.hurt(m));
    this.physics.add.overlap(this.hero, this.gems, (h, gm) => { gm.destroy(); this.xp = Math.min(1, (this.xp || 0) + 0.02); });
  }

  makeHud() {
    const f = (s, c = '#fff') => ({ fontFamily: 'G11', fontSize: s, color: c, stroke: '#000', strokeThickness: 3 });
    const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(30);
    const box = (x, y, w, h) => this.add.rectangle(x, y, w, h, 0x101018, 0.85).setOrigin(0).setStrokeStyle(1, 0x5b5b78);
    this.hpBar = this.add.rectangle(30, 11, 70, 6, 0xe8343a).setOrigin(0);
    this.xpBar = this.add.rectangle(0, 0, 0, 3, 0x7df9ff).setOrigin(0);
    this.timeTxt = this.add.text(W / 2, 13, '03:00', f('14px')).setOrigin(0.5);
    this.killTxt = this.add.text(W - 8, 13, '처치 0', f('11px', '#ffd75e')).setOrigin(1, 0.5);
    hud.add([this.add.rectangle(0, 0, W, 3, 0x000000, 0.6).setOrigin(0), this.xpBar,
      box(4, 5, 100, 16), this.add.text(8, 7, 'HP', f('10px', '#ff6b6b')), this.add.rectangle(30, 11, 70, 6, 0x3a1014).setOrigin(0), this.hpBar,
      this.timeTxt, this.killTxt]);
    const slot = box(W - 44, H - 48, 38, 40);
    const sword = this.add.text(W - 25, H - 34, '⚔', { fontSize: '16px' }).setOrigin(0.5);
    this.plus = this.add.text(W - 25, H - 16, '+12', f('11px', '#ffd75e')).setOrigin(0.5);
    hud.add([slot, sword, this.plus]);
  }

  makeJoystick() {
    this.joy = { base: this.add.circle(0, 0, 26, 0xffffff, 0.08).setStrokeStyle(1, 0xffffff, 0.35).setScrollFactor(0).setDepth(31).setVisible(false),
      knob: this.add.circle(0, 0, 10, 0xffffff, 0.35).setScrollFactor(0).setDepth(32).setVisible(false), v: new Phaser.Math.Vector2() };
    this.input.on('pointerdown', p => { this.joy.o = { x: p.x, y: p.y }; this.joy.base.setPosition(p.x, p.y).setVisible(true); this.joy.knob.setPosition(p.x, p.y).setVisible(true); });
    this.input.on('pointermove', p => {
      if (!this.joy.o || !p.isDown) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.o.x, p.y - this.joy.o.y).limit(26);
      this.joy.knob.setPosition(this.joy.o.x + v.x, this.joy.o.y + v.y);
      this.joy.v.copy(v).scale(1 / 26);
    });
    this.input.on('pointerup', () => { this.joy.o = null; this.joy.v.reset(); this.joy.base.setVisible(false); this.joy.knob.setVisible(false); });
  }

  spawn(anywhere) {
    if (this.mobs.countActive() > 90) return;
    const a = Math.random() * Math.PI * 2, d = anywhere ? Phaser.Math.Between(60, 240) : 300;
    const kind = Phaser.Math.RND.pick(['slime', 'slime', 'skel', 'bat']);
    const m = this.mobs.create(this.hero.x + Math.cos(a) * d, this.hero.y + Math.sin(a) * d, { slime: 'mob_r0s', skel: 'mob_r1s', bat: 'mob_r2s' }[kind]);
    m.play({ key: kind, startFrame: Phaser.Math.Between(0, 3) }).setDepth(4);
    m.hp = { slime: 20, skel: 40, bat: 12 }[kind];
    m.spd = { slime: 28, skel: 22, bat: 48 }[kind];
    m.color = { slime: 0x6fe36a, skel: 0xe8e2c8, bat: 0xa45cff }[kind];
    m.body.setSize(m.width * 0.6, m.height * 0.5);
  }

  attack() {
    const dir = this.face;
    this.hero.play('slash', true).once('animationcomplete', () => this.hero.play('walkSide'));
    this.hero.setFlipX(dir < 0);
    // 베기 궤적: 흰 초승달 2겹
    const arc = this.add.graphics().setDepth(7).setPosition(this.hero.x + dir * 6, this.hero.y);
    const pts = [];
    for (let d = -70; d <= 70; d += 10) pts.push({ x: Math.cos(Phaser.Math.DegToRad(d)) * 46, y: Math.sin(Phaser.Math.DegToRad(d)) * 46 });
    for (let d = 60; d >= -60; d -= 10) pts.push({ x: Math.cos(Phaser.Math.DegToRad(d)) * 36 + 4, y: Math.sin(Phaser.Math.DegToRad(d)) * 38 });
    arc.fillStyle(0xffffff, 1).fillPoints(pts, true);
    arc.setScale(dir, 1);
    this.tweens.add({ targets: arc, alpha: 0, scaleX: dir * 1.15, scaleY: 1.15, duration: 160, onComplete: () => arc.destroy() });
    let hit = 0;
    this.mobs.getChildren().forEach(m => {
      const dx = m.x - this.hero.x, dy = m.y - this.hero.y;
      if (Math.hypot(dx, dy) < 52 && dx * dir > -8) { this.damage(m, Phaser.Math.Between(18, 34), Math.random() < 0.2); hit++; }
    });
    if (hit) { this.hitstop = 45; this.cameras.main.shake(70, 0.004); }
  }

  damage(m, dmg, crit) {
    if (crit) dmg *= 2;
    m.hp -= dmg;
    m.setTintFill(0xffffff);
    this.time.delayedCall(60, () => m.active && m.clearTint());
    const ang = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, m.x, m.y);
    m.x += Math.cos(ang) * 8; m.y += Math.sin(ang) * 8;
    this.spark.explode(crit ? 14 : 6, m.x, m.y);
    const t = this.add.text(m.x, m.y - 10, dmg, { fontFamily: 'G11', fontSize: crit ? '16px' : '11px', color: crit ? '#ffd23f' : '#ffffff', stroke: '#2a0a0a', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(25).setScale(1.6);
    this.tweens.add({ targets: t, scale: 1, duration: 90, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, delay: 250, duration: 350, onComplete: () => t.destroy() });
    if (m.hp <= 0) {
      this.goo.setParticleTint(m.color); this.goo.explode(12, m.x, m.y);
      const ring = this.add.circle(m.x, m.y, 4).setStrokeStyle(2, 0xffffff).setDepth(8);
      this.tweens.add({ targets: ring, radius: 18, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
      this.gems.create(m.x, m.y, 'gem').setDepth(3);
      m.destroy(); this.kills++;
    }
  }

  hurt(m) {
    if (this.time.now - (this.lastHurt || 0) < 500) return;
    this.lastHurt = this.time.now;
    this.hp = Math.max(5, this.hp - 6);
    this.hurtFx.setAlpha(0.28);
    this.tweens.add({ targets: this.hurtFx, alpha: 0, duration: 220 });
    this.hero.setTintFill(0xff4444); this.time.delayedCall(80, () => this.hero.clearTint());
  }

  update(time, delta) {
    if (this.hitstop > 0) { this.hitstop -= delta; this.physics.world.isPaused || this.physics.pause(); this.anims.pauseAll(); return; }
    if (this.physics.world.isPaused) { this.physics.resume(); this.anims.resumeAll(); }
    const k = this.keys, v = this.joy.v.clone();
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (this.autoMove) v.copy(this.autoMove(time));
    if (v.length() > 1) v.normalize();
    this.hero.setVelocity(v.x * 70, v.y * 70);
    const slashing = this.hero.anims.currentAnim?.key === 'slash' && this.hero.anims.isPlaying;
    if (Math.abs(v.x) > 0.2) this.face = Math.sign(v.x);
    if (!slashing) {
      if (v.length() < 0.1) this.hero.anims.pause();
      else {
        const key = Math.abs(v.x) >= Math.abs(v.y) ? 'walkSide' : 'walkDown';
        if (this.hero.anims.currentAnim?.key !== key || !this.hero.anims.isPlaying) this.hero.play(key, true);
        this.hero.setFlipX(key === 'walkSide' && this.face < 0);
      }
    }
    this.heroShadow.setPosition(this.hero.x, this.hero.y + this.hero.height / 2 - 2);
    this.mobs.getChildren().forEach(m => {
      this.physics.moveToObject(m, this.hero, m.spd);
      m.setFlipX(m.x > this.hero.x);
      m.setDepth(m.y > this.hero.y ? 6 : 4);
    });
    this.gems.getChildren().forEach(gm => { if (Phaser.Math.Distance.Between(gm.x, gm.y, this.hero.x, this.hero.y) < 50) this.physics.moveToObject(gm, this.hero, 160); });

    const cam = this.cameras.main;
    this.glow.setPosition(this.hero.x, this.hero.y).setScale(1 + Math.sin(time / 120) * 0.03);
    this.dark.clear().fill(0x06040c, 0.55).erase('light', this.hero.x - cam.scrollX - 150, this.hero.y - cam.scrollY - 150);
    for (const t of this.torches) this.dark.erase('light', t.x - cam.scrollX - 150, t.y - cam.scrollY - 150);
    const left = Math.max(0, 180 - Math.floor((time - this.t0) / 1000));
    this.timeTxt.setText(`0${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.killTxt.setText(`처치 ${this.kills}`);
    this.hpBar.width = 70 * this.hp / 100;
    this.xpBar.width = W * (this.xp || 0);
  }
}

window.game = new Phaser.Game({
  type: Phaser.WEBGL, parent: 'game', width: W, height: H, pixelArt: true, backgroundColor: '#1a1a22',
  physics: { default: 'arcade' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: Play,
});
