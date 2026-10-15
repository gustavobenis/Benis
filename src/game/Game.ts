import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import { Input, type InputFrame } from '../engine/Input';
import { CameraRig, CAMERA_LABEL } from '../engine/CameraRig';
import { GameAudio } from '../engine/Audio';
import { AutoQuality, PROFILES, resolveLevel, type QualityLevel } from '../engine/Quality';
import { createBody, type Body } from '../physics/CollisionWorld';
import { Environment } from '../levels/Environment';
import { Level1 } from '../levels/Level1';
import * as D from '../levels/level1Data';
import { MarietaModel } from '../player/Marieta';
import { BirdShadow } from './BirdShadow';
import { QuestLog, type QuestNotice } from '../systems/Quests';
import { Inventory, ITEM_INFO, type ItemId } from '../systems/Inventory';
import { DialogueRunner } from '../systems/Dialogue';
import { SaveManager, type SaveData } from '../systems/Save';
import { DEFAULT_SETTINGS, type Settings } from '../systems/Settings';
import { LEVEL1_QUESTS } from '../data/quests';
import { pickDialogue } from '../data/dialogues';
import { UI } from '../ui/UI';
import { drawMap } from '../ui/MiniMap';

type State = 'loading' | 'menu' | 'playing' | 'dialogue' | 'paused' | 'complete';

const WALK = 4.8, RUN = 8.6, JUMP = 10.5, CLIMB = 3.6;
const DEW_TOTAL = D.PICKUPS.filter((p) => p.kind === 'dew').length;
const SEED_TOTAL = D.PICKUPS.filter((p) => p.kind === 'seed').length;

/** Orquestra o jogo: cena, sistemas, estados e laço principal. */
export class Game {
  state: State = 'loading';
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly engine: Engine; readonly scene: Scene;
  private env!: Environment; private level!: Level1; private rig!: CameraRig; private input!: Input;
  private audio = new GameAudio(); private ui!: UI; private save = new SaveManager();
  readonly quests = new QuestLog(LEVEL1_QUESTS); readonly inventory = new Inventory(); private dialogue = new DialogueRunner();
  private model!: MarietaModel; private blob!: Mesh; private bird!: BirdShadow;
  /** Corpo físico de Marieta (exposto para depuração/testes). */
  body: Body = createBody(D.START.x, D.START.y, D.START.z);
  private heading = 0; private flags = new Set<string>(); private collected = new Set<string>();
  private checkpoint = { id: 'cp0', x: D.START.x, y: 0, z: D.START.z };
  private observing = false; private playTime = 0; private glideEnergy = 1; private stepDist = 0;
  private jumpBuffer = 0; private coyote = 0; private hudAcc = 0; private saveTimer = 0; private saveDirty = false;
  private hintShown = new Set<string>();
  private quality!: QualityLevel; private auto: AutoQuality | null = null;
  private hasSave = false; private menuYaw = 0; private tick = 0;
  private gliding = false; private lastSpeed = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { powerPreference: 'high-performance', stencil: true, preserveDrawingBuffer: false }, true);
    this.scene = new Scene(this.engine);
  }

  /** Inicializa tudo; reporta progresso à tela de carregamento. */
  async init(): Promise<void> {
    const step = (p: number) => this.ui?.setLoading(p);
    this.ui = new UI({
      newGame: () => void this.startNew(), continueGame: () => void this.continueGame(), resume: () => (this.state === 'playing' ? this.pause() : this.resume()),
      toMenu: () => this.toMenu(), freeRoam: () => { this.ui.showScreen(null); this.state = 'playing'; this.input.enabled = true; this.afterStart(); },
      settingsChanged: (s) => this.applySettings(s, true), drawMap: (c) => this.paintMap(c), advanceDialogue: () => this.advanceDialogue(),
      closeSettings: () => this.ui.showScreen(this.state === 'paused' ? 'pause' : 'menu'),
      closeControls: () => this.ui.showScreen(this.state === 'paused' ? 'pause' : 'menu'),
    }, () => this.settings);
    this.ui.inventoryRef = this.inventory; this.ui.questsRef = this.quests; this.ui.onBlip = () => this.audio.blip();
    step(0.05);
    this.settings = await this.save.loadSettings();
    this.ui.applyScale();
    const saved = await this.save.loadGame().catch(() => null);
    this.hasSave = !!saved; this.ui.enableContinue(this.hasSave);
    step(0.15);

    this.quality = resolveLevel(this.settings.quality);
    const prof = PROFILES[this.quality];
    this.level = new Level1(this.scene, PROFILES.high.grass);
    step(0.55);
    this.rig = new CameraRig(this.scene, this.level.world);
    this.env = new Environment(this.scene, this.rig.camera);
    this.level.grass.setFog(this.scene.fogColor, this.scene.fogDensity);
    for (const m of this.level.casters) this.env.shadows.addShadowCaster(m);
    for (const m of this.level.receivers) m.receiveShadows = true;
    this.model = new MarietaModel(this.scene, this.level.mats);
    for (const m of this.model.meshes) this.env.shadows.addShadowCaster(m);
    this.blob = this.makeBlob();
    this.bird = new BirdShadow(this.scene);
    this.env.buildProbe([...this.level.reflectionList]);
    step(0.8);

    this.input = new Input(this.canvas, {
      sensitivity: () => this.settings.sensitivity, invertY: () => this.settings.invertY,
      onFirstTouch: () => { this.ui.setTouch(this.state === 'playing' || this.state === 'dialogue'); },
      onUnlock: () => { if (this.state === 'playing' && !this.input.usingTouch) this.pause(); },
    });
    this.input.bindTouch(this.ui.touchElements());
    if (matchMedia('(pointer: coarse)').matches) { this.input.usingTouch = true; }

    this.quests.onNotice((n) => this.onQuestNotice(n));
    this.applyQuality(this.quality);
    this.applySettings(this.settings, false);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.audio.suspend(); if (this.state === 'playing') this.pause(); } else if (this.state === 'playing') this.audio.resume();
    });
    window.addEventListener('resize', () => this.engine.resize());
    window.addEventListener('beforeunload', () => { if (this.state === 'playing') void this.flushSave(); });

    this.placePlayer(D.START.x, 0, D.START.z, true);
    this.scene.onBeforeRenderObservable.add(() => this.frame());
    this.engine.runRenderLoop(() => this.scene.render());
    void prof;
    step(1);
    this.toMenu(true);
  }

  /* ---------- fluxo de jogo ---------- */
  private afterStart(): void {
    this.audio.init(); this.audio.apply(this.settings); this.audio.start();
    this.audio.addSpring(D.SHELTER.x + 12, 0.5, D.SHELTER.z + 2);
    this.ui.setHud(true); this.ui.setTouch(this.input.usingTouch); this.input.enabled = true;
    this.ui.fade(false);
    if (!this.hintShown.has('controls')) {
      this.hintShown.add('controls');
      this.ui.hint(this.input.usingTouch ? 'Joystick à esquerda para andar · arraste à direita para olhar · 👁 observar' : 'WASD mover · Shift correr · Espaço pular · E interagir · F câmera · Q observar · clique para girar a câmera', 9000);
    }
    if (!this.input.usingTouch) this.canvas.focus();
  }

  private async startNew(): Promise<void> {
    if (this.hasSave && !window.confirm('Começar um novo jogo apaga o progresso salvo. Continuar?')) return;
    this.audio.init();
    await this.save.deleteGame().catch(() => {});
    this.quests.reset(); this.inventory.load(undefined); this.flags.clear(); this.collected.clear();
    this.checkpoint = { id: 'cp0', x: D.START.x, y: 0, z: D.START.z };
    this.playTime = 0; this.hintShown.clear(); this.resetLevel();
    this.placePlayer(D.START.x, 0, D.START.z, true);
    this.rig.yaw = 0; this.rig.pitch = 0.4; this.rig.setMode('third');
    this.quests.announceActive();
    this.begin();
  }

  private async continueGame(): Promise<void> {
    this.audio.init();
    const s = await this.save.loadGame();
    if (!s) { this.ui.toast('Nenhum jogo salvo encontrado.'); return; }
    this.applySave(s); this.begin();
  }

  private applySave(s: SaveData): void {
    this.resetLevel();
    this.quests.load(s.quests); this.inventory.load(s.inventory);
    this.flags = new Set(s.flags); this.collected = new Set(s.collected); this.playTime = s.playTime;
    this.checkpoint = { ...s.checkpoint };
    this.level.setCollected(s.collected);
    if (this.flags.has('gate')) this.level.openGate(true);
    this.placePlayer(s.checkpoint.x, s.checkpoint.y, s.checkpoint.z, true);
    this.rig.yaw = 0; this.rig.pitch = 0.4;
  }

  private resetLevel(): void {
    // Recria somente o estado dinâmico: recoloca coletáveis e fecha o portão.
    for (const p of this.level.pickups) { p.taken = false; p.node.setEnabled(true); }
    if (this.level.gateOpen) this.level.reopenGate();
    this.bird.reset(); this.observing = false; this.env.setObserve(false); this.glideEnergy = 1;
  }

  private begin(): void {
    this.ui.showScreen(null);
    this.state = 'playing';
    this.afterStart();
    this.refreshHud(true);
    this.queueSave();
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'dialogue') return;
    this.state = 'paused'; this.input.enabled = false; this.input.exitPointerLock();
    this.ui.openPause(); this.ui.setTouch(false); this.audio.setTension(0); void this.flushSave();
  }
  resume(): void {
    if (this.state !== 'paused') return;
    this.ui.showScreen(null); this.state = this.dialogue.active ? 'dialogue' : 'playing';
    this.input.enabled = this.state === 'playing'; this.ui.setTouch(this.input.usingTouch); this.audio.resume();
  }

  toMenu(first = false): void {
    if (!first) void this.flushSave();
    this.state = 'menu'; this.input.enabled = false; this.input?.exitPointerLock();
    this.dialogue.advance(); this.ui.hideDialogue(); this.ui.setHud(false); this.ui.setTouch(false); this.ui.prompt(null); this.ui.danger(0);
    this.audio.setTension(0); this.audio.stop();
    this.observing = false; this.env.setObserve(false);
    void this.save.loadGame().then((s) => { this.hasSave = !!s; this.ui.enableContinue(this.hasSave); });
    // Mostra Marieta na cena do menu: reposiciona no início
    this.placePlayer(D.START.x, 0, D.START.z, true);
    this.rig.setMode('orbital');
    this.ui.showScreen('menu');
  }

  private complete(): void {
    this.state = 'complete'; this.input.enabled = false; this.input.exitPointerLock();
    this.flags.add('level1_done'); this.audio.complete(); this.audio.setTension(0);
    const t = Math.floor(this.playTime), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    this.ui.complete({ time: `${mm}:${ss}`, dew: this.inventory.count('dew'), dewTotal: DEW_TOTAL, seeds: this.inventory.count('seed'), seedsTotal: SEED_TOTAL });
    this.ui.setTouch(false); this.ui.prompt(null); void this.flushSave();
  }

  /* ---------- salvamento ---------- */
  private snapshot(): SaveData {
    return { version: 1, savedAt: Date.now(), level: 1, checkpoint: { ...this.checkpoint }, quests: this.quests.serialize(), inventory: this.inventory.serialize(), collected: [...this.collected], flags: [...this.flags], playTime: this.playTime };
  }
  private queueSave(): void { this.saveDirty = true; this.saveTimer = 0.6; }
  private async flushSave(): Promise<void> {
    this.saveDirty = false;
    try { await this.save.saveGame(this.snapshot()); this.hasSave = true; } catch (e) { console.error('[save] falha ao salvar', e); }
  }

  /* ---------- configuração e qualidade ---------- */
  applySettings(s: Settings, persist: boolean): void {
    this.settings = s;
    this.audio.apply(s);
    this.rig.distanceScale = s.cameraDistance; this.rig.reduceMotion = s.reduceMotion;
    // No modo automático, preserva o nível já ajustado pelo medidor de FPS
    const lvl = s.quality === 'auto' ? (this.auto ? this.quality : resolveLevel('auto')) : s.quality;
    if (lvl !== this.quality || (s.quality === 'auto') !== (this.auto !== null)) this.applyQuality(lvl);
    if (persist) void this.save.saveSettings(s);
  }

  private applyQuality(level: QualityLevel): void {
    this.quality = level;
    const q = PROFILES[level];
    const dpr = window.devicePixelRatio || 1;
    this.env.applyQuality(q, (n) => this.engine.setHardwareScalingLevel(n * (dpr > 2 ? dpr / 2 : 1)));
    this.level.grass.setCount(q.grass);
    if (!q.shadows) this.env.shadows.getShadowMap()!.renderList = [];
    else { const rl = this.env.shadows.getShadowMap()!.renderList!; rl.length = 0; rl.push(...this.level.casters, ...this.model.meshes); }
    this.auto = this.settings.quality === 'auto' ? new AutoQuality(level, (l) => { console.info('[quality] ajustando para', l); this.applyQuality(l); if (this.auto) this.auto.level = l; }) : null;
  }

  /* ---------- eventos de missão ---------- */
  private onQuestNotice(n: QuestNotice): void {
    if (n.kind === 'started') this.ui.toast(`${n.quest.optional ? 'Missão opcional' : 'Nova missão'}: ${n.quest.title}`);
    else if (n.kind === 'objective') { this.ui.toast(n.objective.text); this.audio.interact(); }
    else if (n.kind === 'completed') { this.ui.toast(`Missão concluída: ${n.quest.title} ✔`); this.audio.checkpoint(); }
    this.queueSave(); this.refreshHud(true);
  }

  /* ---------- jogador ---------- */
  private placePlayer(x: number, y: number, z: number, snap: boolean): void {
    const b = this.body; b.x = x; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; b.grounded = false; b.climbing = false;
    this.model.root.position.set(x, y, z);
    if (snap) this.rig.update(0.016, new Vector3(x, y, z), 0, true);
  }

  private respawn(reason: string): void {
    this.ui.fade(true); this.ui.toast(reason, 2800);
    setTimeout(() => { this.placePlayer(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z, true); this.ui.fade(false); }, 450);
  }

  private makeBlob(): Mesh {
    const t = new DynamicTexture('blobT', { width: 64, height: 64 }, this.scene, false);
    const c = t.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.update(); t.hasAlpha = true;
    const m = new StandardMaterial('blobM', this.scene); m.diffuseTexture = t; m.useAlphaFromDiffuseTexture = true; m.disableLighting = true; m.emissiveColor.set(0, 0, 0); m.specularColor.set(0, 0, 0);
    const d = MeshBuilder.CreateGround('blob', { width: 1.6, height: 1.9 }, this.scene); d.material = m; d.isPickable = false;
    return d;
  }

  /* ---------- laço principal ---------- */
  /** Duração máxima de tempo real simulado por quadro (abaixo disso o jogo roda em câmera lenta). */
  maxFrame = 0.1;

  private frame(): void {
    const real = this.engine.getDeltaTime() / 1000;
    this.tick++;
    const f = this.input.read(Math.min(real, 0.05));
    this.auto?.tick(real);
    // Passos fixos de até 1/30 s: física estável mesmo em quadros lentos
    let rem = Math.min(real, this.maxFrame), first = true;
    do {
      const dt = Math.min(1 / 30, rem); rem -= dt;
      this.step(dt, first ? f : { ...f, jumpPressed: false, interact: false, observe: false, camera: false, pause: false, advance: false, lookX: 0, lookY: 0, zoom: 0 });
      first = false;
    } while (rem > 1e-4);
  }

  private step(dt: number, f: InputFrame): void {
    if (this.saveDirty && (this.saveTimer -= dt) <= 0 && this.state === 'playing') void this.flushSave();
    switch (this.state) {
      case 'menu': this.updateMenu(dt); break;
      case 'playing': this.updatePlaying(dt, f); break;
      case 'dialogue': this.updateDialogue(dt, f); break;
      case 'paused': if (f.pause && !this.ui.isOpen('settings') && !this.ui.isOpen('controls')) this.resume(); break;
      case 'complete': this.updateWorld(dt, 0); break;
      default: break;
    }
  }

  private updateMenu(dt: number): void {
    this.menuYaw += dt * 0.12;
    this.rig.yaw = this.menuYaw + 2.4; this.rig.pitch = 0.22;
    this.updateWorld(dt, 0);
  }

  private updateWorld(dt: number, speed01: number): void {
    const b = this.body, feet = new Vector3(b.x, b.y, b.z);
    this.rig.update(dt, feet, speed01);
    this.env.update(dt, feet);
    this.level.update(dt, feet, this.observing, this.env.hasPipeline);
    this.model.root.position.set(b.x, b.y, b.z); this.model.root.rotation.y = this.heading;
    this.model.setVisible(this.rig.mode !== 'first' || this.state === 'menu');
    this.model.animate(dt, this.lastSpeed, b.grounded, this.gliding, b.climbing);
    const g = this.level.world.groundAt(b.x, b.z, b.y + 0.2, 0.3);
    this.blob.position.set(b.x, g.y + 0.04, b.z); this.blob.rotation.y = this.heading;
    const s = Math.max(0.35, 1 - (b.y - g.y) * 0.1); this.blob.scaling.set(s, 1, s);
    this.audio.setListener(this.rig.position.x, this.rig.position.y, this.rig.position.z, Math.sin(this.rig.yaw), Math.cos(this.rig.yaw));
    this.audio.update(b);
  }

  private updatePlaying(dt: number, f: InputFrame): void {
    if (f.pause) { this.pause(); return; }
    const b = this.body, w = this.level.world;
    this.playTime += dt;

    if (f.camera) { const m = this.rig.cycle(); this.ui.cameraLabel(CAMERA_LABEL[m]); this.audio.cameraSwitch(); if (m === 'first') this.heading = this.rig.yaw; }
    if (f.observe) { this.observing = !this.observing; this.env.setObserve(this.observing); this.audio.observe(this.observing); }
    this.rig.look(f.lookX, f.lookY, f.zoom);

    // Intenção de movimento relativa à câmera
    const [fx, fz] = this.rig.forward(); const rx = fz, rz = -fx;
    let wx = fx * f.moveY + rx * f.moveX, wz = fz * f.moveY + rz * f.moveX;
    const mag = Math.hypot(f.moveX, f.moveY) > 0.01 ? f.magnitude : 0;
    let speed = f.run ? RUN : WALK;
    if (mag > 0 && mag < 0.9) speed *= Math.max(0.4, mag / 0.9);
    const puddle = w.zoneAt(b.x, b.z, 'puddle'); if (puddle && b.grounded) speed *= 0.55;
    const len = Math.hypot(wx, wz) || 1; wx = (wx / len) * speed * (mag > 0 ? 1 : 0); wz = (wz / len) * speed * (mag > 0 ? 1 : 0);

    // Salto com buffer e coyote time
    this.jumpBuffer = f.jumpPressed ? 0.14 : Math.max(0, this.jumpBuffer - dt);
    this.coyote = b.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (!b.grounded && this.coyote > 0 && this.jumpBuffer > 0) b.grounded = true;

    // Planar (após aprender com o Tito)
    this.gliding = this.flags.has('glide') && f.jumpHeld && !b.grounded && !b.climbing && b.vy < 0 && this.glideEnergy > 0;
    if (this.gliding) this.glideEnergy = Math.max(0, this.glideEnergy - dt / 3.2); else if (b.grounded) this.glideEnergy = Math.min(1, this.glideEnergy + dt / 1.2);
    if (this.gliding) { wx *= 1.15; wz *= 1.15; }

    const wantsClimb = f.moveY > 0.3 || f.jumpHeld;
    const ev = w.step(b, dt, wx, wz, { accel: b.grounded ? 14 : 5, jump: this.jumpBuffer > 0, jumpSpeed: JUMP, glide: this.gliding, climb: wantsClimb, climbSpeed: CLIMB });
    if (ev.jumped) { this.jumpBuffer = 0; this.audio.jump(); }
    if (ev.landed) this.audio.land();
    if (b.y < w.killY) this.respawn('Marieta caiu! Voltando ao último abrigo.');

    // Orientação do corpo
    const hv = Math.hypot(b.vx, b.vz); this.lastSpeed = b.grounded || b.climbing ? hv : this.lastSpeed * 0.9;
    if (this.rig.mode === 'first') this.heading = this.rig.yaw;
    else if (hv > 0.4) { const want = Math.atan2(b.vx, b.vz); let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * Math.min(1, dt * 12); }

    // Passos
    if (b.grounded && hv > 0.5) { this.stepDist += hv * dt; const stride = f.run ? 1.5 : 1.1; if (this.stepDist > stride) { this.stepDist = 0; this.audio.footstep(b.surface, hv > 6.5); } }

    this.interactions(f);
    this.hazards(dt);
    this.updateWorld(dt, Math.min(1, hv / RUN));
    this.hudAcc += dt; if (this.hudAcc > 0.12) { this.hudAcc = 0; this.refreshHud(false); }
    this.contextHints();
  }

  private interactions(f: InputFrame): void {
    const b = this.body, w = this.level.world;
    // Coleta automática
    const p = this.level.nearestPickup(b.x, b.y, b.z, 1.5);
    if (p) {
      this.level.collect(p); this.collected.add(p.def.id);
      const item: ItemId = p.def.kind; this.inventory.add(item);
      this.quests.handle({ type: 'collect', item });
      this.audio.collect(); this.ui.toast(`${ITEM_INFO[item].icon} ${ITEM_INFO[item].name}`, 1400); this.queueSave(); this.refreshHud(true);
    }
    // Checkpoints
    const cp = w.zoneAt(b.x, b.z, 'checkpoint');
    if (cp && cp.id !== this.checkpoint.id) { this.checkpoint = { id: cp.id, x: cp.x, y: 0, z: cp.z }; this.audio.checkpoint(); this.ui.toast('Abrigo seguro: progresso salvo 🍃'); this.queueSave(); }
    // Objetivo de chegada
    if (this.level.gateOpen && w.zoneAt(b.x, b.z, 'goal') && this.quests.currentObjective('jardim')?.id === 'abrigo') {
      this.quests.handle({ type: 'reach', target: 'shelter' });
      if (this.quests.isDone('jardim')) { this.complete(); return; }
    }
    // Prompt de interação
    const npc = this.level.nearestNpc(b.x, b.z, 5);
    const nearGate = this.level.nearGate(b.x, b.z);
    const key = this.input.usingTouch ? 'Toque em ✋' : 'E';
    let prompt: string | null = null;
    if (npc) prompt = `${key} — Conversar com Tito`;
    else if (nearGate) { const n = this.inventory.count('dew'); prompt = `${key} — Molhar a folha-portão (${Math.min(n, 5)}/5 gotas)`; }
    this.ui.prompt(prompt);
    if (f.interact) {
      if (npc) this.startDialogue(npc.id);
      else if (nearGate) this.useGate();
    }
  }

  private useGate(): void {
    if (this.inventory.count('dew') < 5) { this.ui.toast(`A folha está seca e enrolada. Faltam ${5 - this.inventory.count('dew')} gotas de orvalho.`, 3200); this.audio.warn(); return; }
    if (this.quests.currentObjective('jardim')?.id !== 'portao') { this.ui.toast('Converse com Tito primeiro.'); return; }
    this.inventory.remove('dew', 5); this.level.openGate(); this.flags.add('gate');
    this.quests.handle({ type: 'interact', target: 'leafgate' }); this.audio.collect(); this.audio.interact();
    this.ui.toast('A folha-portão se desenrola e abre o caminho! 🍃', 3200); this.queueSave(); this.refreshHud(true);
  }

  private hazards(dt: number): void {
    const b = this.body;
    const allowed = !this.flags.has('gate') && b.z > -45 && b.y < 6 && !this.level.world.zoneAt(b.x, b.z, 'goal') && this.quests.currentObjective('jardim')?.id !== 'tito';
    const ev = this.bird.update(dt, b, this.level.world, this.settings.difficulty, allowed);
    if (ev === 'warn') { this.audio.warn(); this.ui.toast('🦅 Sombra de pássaro! Esconda-se sob uma folha ou cogumelo!', 3200); }
    if (ev === 'caught') this.respawn('O pássaro quase te pegou! Voltando ao último abrigo.');
    this.ui.danger(this.bird.danger * 0.9);
    this.audio.setTension(this.bird.danger > 0.1 ? this.bird.danger : 0);
  }

  private contextHints(): void {
    const b = this.body;
    if (this.flags.has('glide') && !this.hintShown.has('glide') && !b.grounded) { this.hintShown.add('glide'); this.ui.hint(this.input.usingTouch ? 'Segure o botão de pular no ar para planar' : 'Segure ESPAÇO no ar para abrir as asas e planar', 5000); }
    if (b.climbing && !this.hintShown.has('climb')) { this.hintShown.add('climb'); this.ui.hint('Segure para frente para subir pelo caule', 3500); }
  }

  /* ---------- diálogo ---------- */
  private startDialogue(npcId: string): void {
    const d = pickDialogue(npcId, this.quests);
    this.dialogue.start(d); this.state = 'dialogue'; this.input.enabled = false;
    this.ui.prompt(null); this.ui.showDialogue(d.speaker, this.dialogue.line); this.audio.interact();
  }
  private advanceDialogue(): void {
    if (this.state !== 'dialogue') return;
    if (!this.ui.typingDone) { this.ui.finishTyping(); return; }
    const actions = this.dialogue.advance();
    if (actions === null) { this.ui.showDialogue(this.dialogue.speaker, this.dialogue.line); return; }
    this.ui.hideDialogue(); this.state = 'playing'; this.input.enabled = true;
    for (const a of actions) this.runAction(a);
    this.queueSave();
  }
  private runAction(a: string): void {
    if (a === 'unlockGlide') { this.flags.add('glide'); this.ui.toast('Você aprendeu a planar! ✨', 3000); }
    else if (a.startsWith('talk:')) this.quests.handle({ type: 'talk', target: a.slice(5) });
  }
  private updateDialogue(dt: number, f: InputFrame): void {
    this.ui.tickDialogue(dt);
    if (f.advance) this.advanceDialogue();
    if (f.pause) this.pause();
    this.updateWorld(dt, 0);
  }

  /* ---------- HUD ---------- */
  private refreshHud(force: boolean): void {
    void force;
    const main = this.quests.mainObjective();
    if (main) {
      const c = main.objective.count ?? 1;
      this.ui.setObjective(main.quest.title, main.objective.text, c > 1 ? { n: Math.min(main.progress, c), of: c } : undefined);
    } else this.ui.setObjective('Jardim das Gotas', 'Explore livremente — a jornada continua!');
    this.ui.setItems(this.inventory);
    const b = this.body;
    drawMap(this.ui.minimap(), { level: this.level, x: b.x, z: b.z, yaw: this.rig.yaw, showItems: this.settings.visualAssist || this.settings.difficulty === 'calm' || this.observing, gateOpen: this.level.gateOpen });
  }
  private paintMap(c: HTMLCanvasElement): void {
    const b = this.body;
    drawMap(c, { level: this.level, x: b.x, z: b.z, yaw: this.rig.yaw, showItems: this.settings.visualAssist || this.settings.difficulty === 'calm', gateOpen: this.level.gateOpen });
  }
}
