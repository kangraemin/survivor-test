// 화질·타격감 테스트용 한 화면. 에셋: assets/hero_r0~2, mob_r0~2, tiles.png
const W = 270, H = 480, WORLD = 1600;

class Play extends Phaser.Scene {
  preload() {
    for (const k of ['hero_r0', 'hero_r1', 'hero_r2', 'hero2_r0', 'hero2_r1', 'hero2_r2', 'fx1_r0', 'fx1_r1', 'fx1_r2', 'fx2_r0', 'mob2_r0', 'mob2_r1', 'mob2_r2', 'mob_r0', 'mob_r1', 'mob_r2']) this.load.image(k, `assets/${k}.png`);
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
    A('slash', this.sheet('hero_r2'), 26, 0);
    A('walkUp', this.sheet('hero2_r1'), 8);
    A('walkFront', this.sheet('hero2_r0'), 8);
    const pose = this.sheet('hero2_r2');
    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers(pose, { frames: [2, 3] }), frameRate: 2.5, repeat: -1 });
    this.anims.create({ key: 'hurtPose', frames: this.anims.generateFrameNumbers(pose, { frames: [0] }), frameRate: 1 });
    // 이펙트 시트(검은 배경, ADD 블렌드로 검정이 투명): 베기 궤적, 타격 섬광, 죽음 연기
    A('fxSlash', this.sheet('fx1_r0'), 32, 0);
    A('fxHit', this.sheet('fx1_r1'), 30, 0);
    A('fxSmoke', this.sheet('fx1_r2'), 16, 0);
    A('fxCrit', this.sheet('fx2_r0'), 22, 0);
    // 몬스터 피격(0번)·죽음(1~3번) 프레임
    for (const [i, kind] of ['slime', 'skel', 'bat'].entries()) {
      const sh = this.sheet('mob2_r' + i);
      this.anims.create({ key: kind + 'Hurt', frames: this.anims.generateFrameNumbers(sh, { frames: [0] }), frameRate: 1 });
      this.anims.create({ key: kind + 'Die', frames: this.anims.generateFrameNumbers(sh, { frames: [0, 1, 2, 3] }), frameRate: 14 });
    }
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
    this.dust = this.add.particles(0, 0, 'px', {
      speedX: { min: -14, max: 14 }, speedY: { min: -18, max: -4 }, lifespan: 380, scale: { start: 2, end: 0 },
      alpha: { start: 0.5, end: 0 }, tint: 0xc8bfa8, emitting: false, depth: 3,
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
    this.fxs = this.add.group({ runChildUpdate: true });
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.attack() });
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
    m.kind = kind;
    m.hp = { slime: 20, skel: 40, bat: 12 }[kind];
    m.spd = { slime: 28, skel: 22, bat: 48 }[kind];
    m.color = { slime: 0x6fe36a, skel: 0xe8e2c8, bat: 0xa45cff }[kind];
    m.body.setSize(m.width * 0.6, m.height * 0.5);
  }

  attack() {
    // 가장 가까운 적 쪽으로 몸을 돌리고 반 박자 내딛으며 벤다
    let target = null, best = 80;
    this.mobs.getChildren().forEach(m => { const d = Phaser.Math.Distance.Between(m.x, m.y, this.hero.x, this.hero.y); if (d < best) { best = d; target = m; } });
    const ang = target ? Phaser.Math.Angle.Between(this.hero.x, this.hero.y, target.x, target.y) : (this.face > 0 ? 0 : Math.PI);
    const dir = Math.cos(ang) >= 0 ? 1 : -1;
    this.face = dir;
    this.hero.setFlipX(dir < 0).play('slash', true);
    this.hero.once('animationcomplete-slash', () => this.hero.play('idle'));
    this.lunge = { x: Math.cos(ang) * 120, y: Math.sin(ang) * 120, t: 90 };

    // 칼 궤적: 그린 4프레임 궤적을 공격 방향으로 돌려 몸 앞에 띄운다. 2번째 프레임(가장 꽉 찬 궤적)에 판정
    const fx = this.add.sprite(this.hero.x + Math.cos(ang) * 22, this.hero.y - 4 + Math.sin(ang) * 18, 'fx1_r0s')
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setAlpha(0.8).setScale(0.85).setRotation(ang).setFlipY(dir < 0).play('fxSlash');
    fx.update = () => fx.setPosition(this.hero.x + Math.cos(ang) * 22, this.hero.y - 4 + Math.sin(ang) * 18);
    this.fxs.add(fx);
    fx.once('animationcomplete', () => fx.destroy());
    this.time.delayedCall(45, () => this.strike(ang));
  }

  strike(ang) {
    let hit = 0, crit = false;
    this.mobs.getChildren().slice().forEach(m => {
      const dx = m.x - this.hero.x, dy = m.y - this.hero.y, d = Math.hypot(dx, dy);
      const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang));
      if (d < 56 && (off < 1.9 || d < 18)) { const c = Math.random() < 0.2; crit ||= c; this.damage(m, Phaser.Math.Between(18, 34), c); hit++; }
    });
    if (hit) { this.hitstop = crit ? 85 : 55; this.cameras.main.shake(crit ? 110 : 60, crit ? 0.007 : 0.003); }
  }

  damage(m, dmg, crit) {
    if (crit) dmg *= 2;
    m.hp -= dmg;
    m.setTintFill(0xffffff);
    this.time.delayedCall(70, () => m.active && m.clearTint());
    if (m.hp > 0) { m.play(m.kind + 'Hurt'); this.time.delayedCall(160, () => m.active && !m.dead && m.play(m.kind)); }
    // 밀려남: 순간이동 대신 속도로 튕겨 나갔다가 줄어든다
    const ang = Phaser.Math.Angle.Between(this.hero.x, this.hero.y, m.x, m.y), kb = crit ? 260 : 170;
    m.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb); m.kb = 140;
    this.tweens.killTweensOf(m);
    m.setScale(1);
    this.tweens.add({ targets: m, scaleX: 1.35, scaleY: 0.7, duration: 50, yoyo: true, ease: 'Quad.Out' });
    // 타격점 섬광: 노란 별 터짐 프레임, 치명타는 크게
    const sx = m.x - Math.cos(ang) * 6, sy = m.y - Math.sin(ang) * 6;
    this.add.sprite(sx, sy, 'fx1_r1s').setBlendMode(Phaser.BlendModes.ADD).setDepth(9)
      .setScale(crit ? 1.15 : 0.75).setRotation(Phaser.Math.FloatBetween(0, 6.28)).play('fxHit')
      .once('animationcomplete', function () { this.destroy(); });
    if (crit) this.add.sprite(sx, sy, 'fx2_r0s').setBlendMode(Phaser.BlendModes.ADD).setDepth(9).play('fxCrit')
      .once('animationcomplete', function () { this.destroy(); });
    this.spark.explode(crit ? 14 : 6, sx, sy);
    const t = this.add.text(m.x + Phaser.Math.Between(-6, 6), m.y - 14, dmg, { fontFamily: 'G11', fontSize: crit ? '16px' : '11px', color: crit ? '#ffd23f' : '#ffffff', stroke: '#2a0a0a', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(25).setScale(1.5);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 280, duration: 320, onComplete: () => t.destroy() });
    if (m.hp <= 0) {
      // 죽음: 몸은 바로 빼고, 그 자리에 쓰러지는 그림을 남긴다(흰 번쩍 → 무너짐 → 서서히 사라짐)
      m.dead = true; this.kills++;
      const c = this.add.sprite(m.x, m.y, m.texture.key).setFlipX(m.flipX).setDepth(3).setTintFill(0xffffff).play(m.kind + 'Die');
      this.time.delayedCall(60, () => c.clearTint());
      c.once('animationcomplete', () => this.tweens.add({ targets: c, alpha: 0, delay: 250, duration: 400, onComplete: () => c.destroy() }));
      this.goo.setParticleTint(m.color); this.goo.explode(10, m.x, m.y);
      this.add.sprite(m.x, m.y - 2, 'fx1_r2s').setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setAlpha(0.35).setScale(0.5).setTint(m.color)
        .play('fxSmoke').once('animationcomplete', function () { this.destroy(); });
      this.gems.create(m.x, m.y, 'gem').setDepth(3);
      m.destroy();
    }
  }

  hurt(m) {
    if (this.time.now - (this.lastHurt || 0) < 500) return;
    this.lastHurt = this.time.now;
    this.hp = Math.max(5, this.hp - 6);
    this.hurtFx.setAlpha(0.28);
    this.tweens.add({ targets: this.hurtFx, alpha: 0, duration: 220 });
    this.hero.setTint(0xff7070); this.time.delayedCall(90, () => this.hero.clearTint());
    this.hurtUntil = this.time.now + 160; this.hero.play('hurtPose');
  }

  update(time, delta) {
    if (this.hitstop > 0) { this.hitstop -= delta; this.physics.world.isPaused || this.physics.pause(); this.anims.pauseAll(); return; }
    if (this.physics.world.isPaused) { this.physics.resume(); this.anims.resumeAll(); }
    const k = this.keys, v = this.joy.v.clone();
    if (k.A.isDown || k.LEFT.isDown) v.x = -1; if (k.D.isDown || k.RIGHT.isDown) v.x = 1;
    if (k.W.isDown || k.UP.isDown) v.y = -1; if (k.S.isDown || k.DOWN.isDown) v.y = 1;
    if (this.autoMove) v.copy(this.autoMove(time));
    if (v.length() > 1) v.normalize();
    let vx = v.x * 70, vy = v.y * 70;
    if (this.lunge && this.lunge.t > 0) { vx += this.lunge.x; vy += this.lunge.y; this.lunge.t -= delta; }
    this.hero.setVelocity(vx, vy);
    const moving = v.length() > 0.1;
    const slashing = (this.hero.anims.currentAnim?.key === 'slash' && this.hero.anims.isPlaying) || time < (this.hurtUntil || 0);
    if (Math.abs(v.x) > 0.2 && !slashing) this.face = Math.sign(v.x);
    if (!slashing) {
      // 위·아래로 갈 땐 앞·뒷모습, 그 밖엔 옆모습(좌우 뒤집기). 서 있으면 숨쉬는 자세
      const want = !moving ? 'idle' : Math.abs(v.y) > Math.abs(v.x) * 1.3 ? (v.y < 0 ? 'walkUp' : 'walkFront') : 'walkSide';
      if (this.hero.anims.currentAnim?.key !== want) this.hero.play(want);
      this.hero.anims.timeScale = moving ? 0.6 + v.length() * 0.9 : 1;
      this.hero.setFlipX(want === 'walkSide' || want === 'idle' ? this.face < 0 : false);
    }
    // 걸을 때 위아래로 튀고 진행 방향으로 살짝 기울기, 서 있으면 숨쉬기
    this.walkT = (this.walkT || 0) + delta * (moving ? 0.018 : 0.004);
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * 0.08 : 0;
    this.hero.setOrigin(0.5, 0.5 + bob);
    // 앞·뒷모습은 그림의 다리 움직임이 작아서, 걸음마다 좌우로 몸을 흔들어 발걸음을 보이게 한다
    const rock = moving && !slashing && this.hero.anims.currentAnim?.key !== 'walkSide' ? Math.sin(this.walkT) * 8 : 0;
    this.hero.setAngle(slashing ? 0 : rock + v.x * 4);
    this.hero.setScale(1, moving ? 1 : 1 + Math.sin(this.walkT) * 0.025);
    if (moving && time - (this.lastDust || 0) > 170) {
      this.lastDust = time;
      this.dust.explode(3, this.hero.x - v.x * 6, this.hero.y + this.hero.height / 2 - 3);
    }
    this.heroShadow.setPosition(this.hero.x, this.hero.y + this.hero.height / 2 - 2).setScale(1 - bob * 2, 1);
    this.mobs.getChildren().forEach(m => {
      if (m.dead) return;
      if (m.kb > 0) { m.kb -= delta; m.body.velocity.scale(0.86); }
      else this.physics.moveToObject(m, this.hero, m.spd);
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
