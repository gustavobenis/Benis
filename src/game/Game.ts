import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import { Input, type InputFrame } from '../engine/Input';
import { CameraRig, CAMERA_LABEL } from '../engine/CameraRig';
import { GameAudio } from '../engine/Audio';
import { AutoQuality, PROFILES, resolveLevel, type QualityLevel } from '../engine/Quality';
import { CollisionWorld, createBody, type Body } from '../physics/CollisionWorld';
import { Environment } from '../levels/Environment';
import { LevelBase, type LevelHost } from '../levels/LevelBase';
import { Level1 } from '../levels/Level1';
import { Materials } from '../levels/Materials';
import { Level2 } from '../levels/Level2';
import { Level3 } from '../levels/Level3';
import { Level4 } from '../levels/Level4';
import { Level5 } from '../levels/Level5';
import { Level6 } from '../levels/Level6';
import { Level7 } from '../levels/Level7';
import { Level8 } from '../levels/Level8';
import { MarietaModel } from '../player/Marieta';
import { BirdShadow } from './BirdShadow';
import { QuestLog, type QuestNotice } from '../systems/Quests';
import { Inventory, ITEM_INFO, type ItemId } from '../systems/Inventory';
import { DialogueRunner } from '../systems/Dialogue';
import { SaveManager, type SaveData } from '../systems/Save';
import { DEFAULT_SETTINGS, type Settings } from '../systems/Settings';
import { UI, READY_PHASES } from '../ui/UI';
import { drawMap } from '../ui/MiniMap';

type State = 'loading' | 'menu' | 'playing' | 'dialogue' | 'paused' | 'complete';

const WALK = 4.8, RUN = 8.6, JUMP = 10.5, CLIMB = 3.6;
const MAX_HEARTS = 3;
/** Segundos na água até a correnteza arrastar Marieta. */
const WATER_LIMIT = 2.2;

const LEVELS: Record<number, (scene: Scene, grass: number) => LevelBase> = {
  1: (s, g) => new Level1(s, g),
  2: (s, g) => new Level2(s, g),
  3: (s, g) => new Level3(s, g),
  4: (s, g) => new Level4(s, g),
  5: (s, g) => new Level5(s, g),
  6: (s, g) => new Level6(s, g),
  7: (s, g) => new Level7(s, g),
  8: (s, g) => new Level8(s, g),
};

/** Habilidades aprendidas na Fase 1 (Tito) valem para as fases seguintes. */
const learned = (n: number): string[] => (n >= 2 ? ['glide'] : []);

/** Orquestra o jogo: cena, fases, sistemas, estados e laço principal. */
export class Game {
  state: State = 'loading';
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly engine: Engine; readonly scene: Scene;
  private env!: Environment; level!: LevelBase; private rig!: CameraRig; private input!: Input;
  private audio = new GameAudio(); private ui!: UI; private save = new SaveManager();
  quests = new QuestLog([]); readonly inventory = new Inventory(); private dialogue = new DialogueRunner();
  model!: MarietaModel; private blob!: Mesh; private bird!: BirdShadow;
  /** Corpo físico de Marieta (exposto para depuração/testes). */
  body: Body = createBody(0, 0, 0);
  private heading = 0; private flags = new Set<string>(); private collected = new Set<string>();
  private checkpoint = { id: 'cp0', x: 0, y: 0, z: 0 };
  hearts = MAX_HEARTS;
  private observing = false; private playTime = 0; private glideEnergy = 1; private stepDist = 0; private waterTime = 0;
  private jumpBuffer = 0; private coyote = 0; private hudAcc = 0; private saveTimer = 0; private saveDirty = false;
  private hintShown = new Set<string>();
  private quality!: QualityLevel; private auto: AutoQuality | null = null;
  private hasSave = false; private menuYaw = 0; private unlocked = 1;
  private gliding = false; private lastSpeed = 0;
  /** Modo "Voo livre": Marieta voa pelo cenário como num simulador. */
  flight = false;
  fly = { speed: 9, pitch: 0, bank: 0, camOff: 0, camYaw: 0, climb: 0 };

  /** Visão que as fases têm do jogo. */
  private host: LevelHost;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { powerPreference: 'high-performance', stencil: true, preserveDrawingBuffer: false }, true);
    this.scene = new Scene(this.engine);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const g = this;
    this.host = {
      get inventory() { return g.inventory; }, get quests() { return g.quests; }, get flags() { return g.flags; }, get audio() { return g.audio; },
      toast: (t, ms) => this.ui.toast(t, ms), changed: () => { this.queueSave(); this.refreshHud(); },
    };
  }

  /** Inicializa tudo; reporta progresso à tela de carregamento. */
  async init(): Promise<void> {
    const step = (p: number) => this.ui?.setLoading(p);
    this.ui = new UI({
      newGame: (n) => void this.startNew(n), continueGame: () => void this.continueGame(), resume: () => (this.state === 'playing' ? this.pause() : this.resume()),
      toMenu: () => this.toMenu(), freeRoam: () => { this.ui.showScreen(null); this.state = 'playing'; this.input.enabled = true; this.afterStart(); },
      nextLevel: () => void this.startNew(this.level.info.id + 1, true),
      settingsChanged: (s) => this.applySettings(s, true), drawMap: (c) => this.paintMap(c), advanceDialogue: () => this.advanceDialogue(),
      closeSettings: () => this.ui.showScreen(this.state === 'paused' ? 'pause' : 'menu'),
      closeControls: () => this.ui.showScreen(this.state === 'paused' ? 'pause' : 'menu'),
      startFlight: () => this.startFlight(), nextScenery: () => this.nextScenery(),
    }, () => this.settings);
    this.ui.inventoryRef = this.inventory; this.ui.onBlip = () => this.audio.blip();
    step(0.05);
    this.settings = await this.save.loadSettings();
    this.unlocked = (await this.save.loadMeta().catch(() => ({ unlocked: 1 }))).unlocked;
    this.ui.applyScale();
    const saved = await this.save.loadGame().catch(() => null);
    this.hasSave = !!saved; this.ui.enableContinue(this.hasSave);
    step(0.15);

    this.quality = resolveLevel(this.settings.quality);
    this.rig = new CameraRig(this.scene, new CollisionWorld());
    this.env = new Environment(this.scene, this.rig.camera);
    step(0.3);
    // Modelos persistentes (criados antes de qualquer fase para não serem descartados com ela)
    this.model = new MarietaModel(this.scene, new Materials(this.scene));
    this.blob = this.makeBlob();
    this.bird = new BirdShadow(this.scene);
    step(0.5);

    this.input = new Input(this.canvas, {
      sensitivity: () => this.settings.sensitivity, invertY: () => this.settings.invertY,
      onFirstTouch: () => { this.ui.setTouch(this.state === 'playing' || this.state === 'dialogue'); },
      onUnlock: () => { if (this.state === 'playing' && !this.input.usingTouch) this.pause(); },
    });
    this.input.bindTouch(this.ui.touchElements());
    this.ui.bindFullscreen();
    if (matchMedia('(pointer: coarse)').matches) { this.input.usingTouch = true; }

    this.loadLevel(saved && saved.level in LEVELS ? saved.level : 1);
    step(0.9);
    this.applySettings(this.settings, false);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.audio.suspend(); if (this.state === 'playing') this.pause(); } else if (this.state === 'playing') this.audio.resume();
    });
    window.addEventListener('resize', () => this.engine.resize());
    window.addEventListener('beforeunload', () => { if (this.state === 'playing') void this.flushSave(); });

    this.scene.onBeforeRenderObservable.add(() => this.frame());
    this.engine.runRenderLoop(() => this.scene.render());
    step(1);
    this.toMenu(true);
  }

  /* ---------- fases ---------- */
  /** Descarta a fase atual (se houver) e constrói a fase `n`. */
  loadLevel(n: number): void {
    this.level?.dispose();
    this.audio.clearSprings();
    const level = LEVELS[n](this.scene, PROFILES.high.grass);
    this.level = level;
    this.rig.world = level.world;
    this.quests = new QuestLog(level.info.quests);
    this.quests.onNotice((q) => this.onQuestNotice(q));
    this.ui.questsRef = this.quests;
    this.env.setAtmosphere(level.info.fog.color, level.info.fog.density);
    this.env.setLighting(level.info.light);
    this.env.setShafts(level.info.shafts);
    level.grass.setFog(this.scene.fogColor, this.scene.fogDensity);
    level.difficulty = this.settings.difficulty;
    this.env.setRain(level.info.weather?.rain ?? 0);
    level.grass.setWind(level.info.weather?.wind ?? 1);
    this.audio.setRain(level.info.weather?.rain ?? 0);
    this.model.root.position.set(level.info.start.x, 0, level.info.start.z);
    this.flags.clear(); this.collected.clear(); this.inventory.load(undefined);
    learned(n).forEach((f) => this.flags.add(f));
    this.checkpoint = { id: 'cp0', x: level.info.start.x, y: 0, z: level.info.start.z };
    this.bird.reset(); this.observing = false; this.env.setObserve(false);
    this.applyQuality(this.quality);
    this.addSprings();
    this.placePlayer(level.info.start.x, 0, level.info.start.z, true);
    this.ui.buildLevels(this.unlocked, n);
  }

  private addSprings(): void { for (const [x, y, z] of this.level.info.springs) this.audio.addSpring(x, y, z); }

  /* ---------- fluxo de jogo ---------- */
  private afterStart(): void {
    this.audio.init(); this.audio.apply(this.settings); this.audio.start();
    if (!this.audio.hasSprings) this.addSprings();
    this.audio.setRain(this.level.info.weather?.rain ?? 0);
    this.ui.setHud(true); this.ui.setTouch(this.input.usingTouch); this.input.enabled = true;
    this.ui.fade(false);
    if (!this.hintShown.has('controls')) {
      this.hintShown.add('controls');
      this.ui.hint(this.input.usingTouch ? 'Joystick à esquerda para andar · arraste à direita para olhar · 👁 observar' : 'WASD mover · Shift correr · Espaço pular · E interagir · F câmera · Q observar · clique para girar a câmera', 9000);
    }
    if (!this.input.usingTouch) this.canvas.focus();
  }

  /** Começa uma partida nova na fase `n` (apaga o jogo salvo). */
  private async startNew(n: number, fromComplete = false): Promise<void> {
    if (!LEVELS[n]) return;
    if (!fromComplete && this.hasSave && !window.confirm('Começar uma nova partida apaga o progresso salvo. Continuar?')) return;
    this.audio.init();
    await this.save.deleteGame().catch(() => {});
    if (this.level.info.id !== n || this.state !== 'menu') this.loadLevel(n);
    else this.resetLevel();
    this.playTime = 0; this.hintShown.clear(); this.hearts = MAX_HEARTS;
    this.rig.yaw = 0; this.rig.pitch = 0.4; this.rig.setMode('third');
    this.quests.announceActive();
    this.begin();
  }

  private async continueGame(): Promise<void> {
    this.audio.init();
    const s = await this.save.loadGame();
    if (!s || !LEVELS[s.level]) { this.ui.toast('Nenhum jogo salvo encontrado.'); return; }
    if (this.level.info.id !== s.level) this.loadLevel(s.level); else this.resetLevel();
    this.applySave(s); this.begin();
  }

  private applySave(s: SaveData): void {
    this.quests.load(s.quests); this.inventory.load(s.inventory);
    this.flags = new Set(s.flags); this.collected = new Set(s.collected); this.playTime = s.playTime;
    this.checkpoint = { ...s.checkpoint };
    this.level.setCollected(s.collected);
    this.level.applyFlags(this.flags);
    this.hearts = MAX_HEARTS;
    this.placePlayer(s.checkpoint.x, s.checkpoint.y, s.checkpoint.z, true);
    this.rig.yaw = 0; this.rig.pitch = 0.4;
  }

  /** Volta o estado da fase atual ao início. */
  private resetLevel(): void {
    this.quests.reset(); this.inventory.load(undefined); this.flags.clear(); this.collected.clear();
    learned(this.level.info.id).forEach((f) => this.flags.add(f));
    this.level.resetState();
    const st = this.level.info.start;
    this.checkpoint = { id: 'cp0', x: st.x, y: 0, z: st.z };
    this.placePlayer(st.x, 0, st.z, true);
    this.bird.reset(); this.observing = false; this.env.setObserve(false); this.glideEnergy = 1; this.waterTime = 0;
  }

  /* ---------- voo livre ---------- */
  private startFlight(): void {
    this.audio.init();
    this.flight = true; this.ui.setFlightUi(true);
    const st = this.level.info.start;
    this.placePlayer(st.x, 7, st.z, true);
    this.heading = 0; this.fly = { speed: 9, pitch: 0, bank: 0, camOff: 0, camYaw: 0, climb: 0 };
    this.rig.setMode('third'); this.rig.yaw = 0; this.rig.pitch = 0.3;
    this.hintShown.add('controls');
    this.begin();
    this.ui.hint(this.input.usingTouch ? 'Joystick: virar · ⤒ subir · ⤓ descer · ⚡ turbo' : 'A/D virar · W acelerar · S frear · Espaço subir · C descer · Shift turbo · 🗺 troca o cenário', 9000);
  }

  private nextScenery(): void {
    if (!this.flight) return;
    const n = (this.level.info.id % READY_PHASES) + 1;
    this.ui.fade(true);
    setTimeout(() => {
      this.loadLevel(n); this.flight = true; this.ui.setFlightUi(true);
      const st = this.level.info.start; this.placePlayer(st.x, 7, st.z, true);
      this.audio.setRain(this.level.info.weather?.rain ?? 0);
      this.ui.fade(false); this.ui.toast(`Cenário: ${this.level.info.title}`, 1800);
    }, 450);
  }

  private updateFlight(dt: number, f: InputFrame): void {
    const b = this.body, w = this.level.world, F = this.fly;
    if (f.camera) { const m = this.rig.cycle(); this.ui.cameraLabel(CAMERA_LABEL[m]); this.audio.cameraSwitch(); }
    const target = f.boostHeld ? 17 : f.moveY > 0.3 ? 13 : f.moveY < -0.3 ? 4.5 : 9;
    F.speed += (target - F.speed) * (1 - Math.exp(-1.6 * dt));
    // Curva: o leme gira o rumo; a inclinação (bank) acompanha com atraso
    F.bank += (f.moveX * f.magnitude - F.bank) * (1 - Math.exp(-5 * dt));
    this.heading += F.bank * (1.6 - 0.4 * F.speed / 17) * dt;
    const wantPitch = (f.jumpHeld ? 0.55 : 0) - (f.descendHeld ? 0.6 : 0);
    F.pitch += (wantPitch - F.pitch) * (1 - Math.exp(-4 * dt));
    F.climb = wantPitch;
    const hs = Math.cos(F.pitch) * F.speed;
    const sink = F.speed < 6 ? (6 - F.speed) * 0.5 : 0; // devagar demais: perde sustentação
    const res = w.flyStep(b, dt, Math.sin(this.heading) * hs, Math.sin(F.pitch) * F.speed - sink, Math.cos(this.heading) * hs);
    if (res.hit) F.speed = Math.max(4.5, F.speed * (1 - dt * 1.5));
    this.lastSpeed = F.speed;
    // Câmera de perseguição: acompanha o rumo; o jogador pode olhar em volta e ela volta sozinha
    const look = Math.abs(f.lookX) + Math.abs(f.lookY) > 1e-4;
    F.camOff = look ? F.camOff + f.lookX : F.camOff * Math.exp(-1.4 * dt);
    const want = this.heading + F.camOff;
    let d = want - F.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); F.camYaw += d * (1 - Math.exp(-5 * dt));
    this.rig.yaw = F.camYaw;
    if (look) this.rig.look(0, f.lookY, 0); else this.rig.pitch += (0.3 - F.pitch * 0.4 - this.rig.pitch) * (1 - Math.exp(-1.5 * dt));
    this.rig.look(0, 0, f.zoom);
    // Som: zumbido das asas
    this.audio.setBuzz(0.5 + 0.5 * Math.min(1, F.speed / 17), 8 + 5 * Math.min(1, 0.45 + F.speed / 68 + Math.max(0, F.climb) * 0.4));
    this.ui.flightInfo(b.y, F.speed, this.level.info.title);
    if (f.pause) { this.pause(); return; }
    this.updateWorld(dt, Math.min(1, F.speed / 17));
  }

  private begin(): void {
    this.ui.showScreen(null);
    this.state = 'playing';
    this.afterStart();
    this.refreshHud();
    this.queueSave();
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'dialogue') return;
    this.state = 'paused'; this.input.enabled = false; this.input.exitPointerLock();
    this.ui.openPause(); this.ui.setTouch(false); this.audio.setTension(0); this.audio.setBuzz(0); void this.flushSave();
  }
  resume(): void {
    if (this.state !== 'paused') return;
    this.ui.showScreen(null); this.state = this.dialogue.active ? 'dialogue' : 'playing';
    this.input.enabled = this.state === 'playing'; this.ui.setTouch(this.input.usingTouch); this.audio.resume();
  }

  toMenu(first = false): void {
    if (!first) void this.flushSave();
    if (this.flight) { this.flight = false; this.ui.setFlightUi(false); this.audio.setBuzz(0); this.rig.setMode('orbital'); }
    this.state = 'menu'; this.input.enabled = false; this.input?.exitPointerLock();
    this.dialogue.advance(); this.ui.hideDialogue(); this.ui.setHud(false); this.ui.setTouch(false); this.ui.prompt(null); this.ui.danger(0);
    this.audio.setTension(0); this.audio.stop(); this.audio.setRain(0);
    this.observing = false; this.env.setObserve(false);
    void this.save.loadGame().then((s) => { this.hasSave = !!s; this.ui.enableContinue(this.hasSave); });
    this.ui.buildLevels(this.unlocked, this.level.info.id);
    const st = this.level.info.start;
    this.placePlayer(st.x, 0, st.z, true);
    this.rig.setMode('orbital');
    this.ui.showScreen('menu');
  }

  private complete(): void {
    const id = this.level.info.id;
    this.state = 'complete'; this.input.enabled = false; this.input.exitPointerLock();
    this.flags.add(`done${id}`); this.audio.complete(); this.audio.setTension(0);
    const hasNext = id < READY_PHASES;
    if (this.unlocked < id + 1) { this.unlocked = Math.min(id + 1, READY_PHASES); void this.save.saveMeta({ unlocked: this.unlocked }); }
    const t = Math.floor(this.playTime), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const tot = this.level.info.totals;
    const stats = [`⏱ Tempo: ${mm}:${ss}`, ...(Object.keys(tot) as ItemId[]).map((k) => `${ITEM_INFO[k].plural}: ${this.countCollected(k)}/${tot[k]}`)].join('<br>');
    const OUT: Record<number, { title: string; text: string; note: string }> = {
      1: { title: 'Jardim concluído!', text: 'Marieta atravessou o Jardim das Gotas e encontrou um abrigo seguro. A grande aventura continua rio adiante…', note: 'Fase 2 liberada: O Rio' },
      2: { title: 'Fase concluída!', text: 'Marieta e Beto se encontraram à beira do rio. Adiante, a floresta escura espera por eles.', note: 'Fase 3 liberada: A Floresta' },
      3: { title: 'Fase concluída!', text: 'Dona Olívia abençoou a travessia. Adiante, o formigueiro está em perigo.', note: 'Fase 4 liberada: A Colônia' },
      4: { title: 'Fase concluída!', text: 'A Rainha agradeceu à joaninha. O céu escurece: a grande tempestade chegou.', note: 'Fase 5 liberada: A Tempestade' },
      5: { title: 'Fase concluída!', text: 'Marieta e Beto atravessaram a enchente juntos e Zuzu os recebeu na colina. A tempestade passou: adiante, um vale à espera de flores.', note: 'Fase 6 liberada: O Vale das Flores' },
      6: { title: 'Fase concluída!', text: 'O vale floresceu e Freddy tocou a canção da esperança ao pôr do sol. Adiante, o Ninho Verde espera por um novo lar.', note: 'Fase 7 liberada: O Ninho Verde' },
      7: { title: 'Fase concluída!', text: 'O Ninho Verde está de pé e a comunidade tem um novo lar. Amanhã, no Vale do Novo Amanhecer, a aventura chega ao seu momento mais bonito.', note: 'Fase 8 liberada: Juntos Sempre' },
      8: { title: 'Obrigado por jogar!', text: 'Marieta e Beto viram o sol nascer cercados pelos amigos. A grande aventura na mata foi só o começo da história deles. Juntos, sempre.', note: 'Fim da jornada. Você pode explorar o vale livremente ou rever qualquer fase.' },
    };
    const o = OUT[id] ?? OUT[8];
    this.ui.complete({ title: o.title, text: o.text, stats: `${stats}<br><small>${o.note}</small>`, next: hasNext, final: !hasNext });
    this.ui.setTouch(false); this.ui.prompt(null); void this.flushSave();
  }
  private countCollected(kind: ItemId): number { return this.level.pickups.filter((p) => p.taken && p.def.kind === kind).length; }

  /* ---------- salvamento ---------- */
  private snapshot(): SaveData {
    return { version: 1, savedAt: Date.now(), level: this.level.info.id, checkpoint: { ...this.checkpoint }, quests: this.quests.serialize(), inventory: this.inventory.serialize(), collected: [...this.collected], flags: [...this.flags], playTime: this.playTime };
  }
  private queueSave(): void { this.saveDirty = true; this.saveTimer = 0.6; }
  private async flushSave(): Promise<void> {
    this.saveDirty = false;
    if (this.flight) return; // voo livre nunca mexe no progresso salvo
    try { await this.save.saveGame(this.snapshot()); this.hasSave = true; } catch (e) { console.error('[save] falha ao salvar', e); }
  }

  /* ---------- configuração e qualidade ---------- */
  applySettings(s: Settings, persist: boolean): void {
    this.settings = s;
    if (this.level) this.level.difficulty = s.difficulty;
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
    const map = this.env.shadows.getShadowMap()!;
    const rl = map.renderList!; rl.length = 0;
    if (q.shadows) rl.push(...this.level.casters, ...this.model.meshes);
    this.auto = this.settings.quality === 'auto' ? new AutoQuality(level, (l) => { console.info('[quality] ajustando para', l); this.applyQuality(l); if (this.auto) this.auto.level = l; }) : null;
  }

  /* ---------- eventos de missão ---------- */
  private onQuestNotice(n: QuestNotice): void {
    if (n.kind === 'started') this.ui.toast(`${n.quest.optional ? 'Missão opcional' : 'Nova missão'}: ${n.quest.title}`);
    else if (n.kind === 'objective') { this.ui.toast(n.objective.text); this.audio.interact(); }
    else if (n.kind === 'completed') { this.ui.toast(`Missão concluída: ${n.quest.title} ✔`); this.audio.checkpoint(); }
    this.queueSave(); this.refreshHud();
  }

  /* ---------- jogador ---------- */
  private placePlayer(x: number, y: number, z: number, snap: boolean): void {
    const b = this.body; b.x = x; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; b.grounded = false; b.climbing = false; b.inWater = false; b.support = null;
    this.model.root.position.set(x, y, z);
    this.waterTime = 0;
    if (snap) this.rig.update(0.016, new Vector3(x, y, z), 0, true);
  }

  /** Marieta se machuca: perde um coração e volta ao último checkpoint. Sem game over: ao zerar, recomeça com vida cheia. */
  private hurt(reason: string): void {
    this.hearts--;
    let msg = reason;
    if (this.hearts <= 0) { this.hearts = MAX_HEARTS; msg = `${reason} Marieta descansou e recuperou as forças.`; }
    this.respawn(msg);
  }

  private respawn(reason: string): void {
    this.ui.fade(true); this.ui.toast(reason, 2800);
    setTimeout(() => { this.placePlayer(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z, true); this.ui.fade(false); }, 450);
  }

  /** A correnteza levou Marieta. Na primeira vez, Beto a resgata (cena narrativa); depois, perde um coração. */
  private swept(): void {
    const r = this.level.info.rescue;
    if (r && !this.flags.has('rescued')) {
      this.flags.add('rescued'); this.ui.fade(true);
      setTimeout(() => { this.placePlayer(r.x, 0, r.z, true); this.ui.fade(false); this.startDialogue(r.npc); }, 450);
      this.ui.toast('A correnteza levou Marieta… 🌊');
      this.queueSave();
    } else this.hurt('A correnteza levou Marieta!');
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
    // Cena de cinema: a câmera enquadra o casal (ponto médio entre Marieta e o parceiro)
    const partner = this.cinematic ? this.level.npcs.find((n) => n.id === this.talkingTo) : undefined;
    const focus = partner ? new Vector3((b.x + partner.x) / 2, b.y, (b.z + partner.z) / 2) : feet;
    this.rig.update(dt, focus, speed01);
    this.env.update(dt, feet);
    this.level.active = this.state === 'playing' && !this.flight;
    this.level.update(dt, feet, this.observing, this.env.hasPipeline);
    this.env.setFlash(this.level.flash);
    for (const e of this.level.events.splice(0)) { if (e === 'thunder') this.audio.thunder(); else if (e === 'gust') { this.audio.gust(); if (this.state === 'playing') this.ui.toast('💨 Rajada de vento! Abrigue-se sob uma folha.', 1800); } }
    this.model.root.position.set(b.x, b.y, b.z); this.model.root.rotation.y = this.heading;
    this.model.setVisible(this.rig.mode !== 'first' || this.state === 'menu');
    const fl = this.flight && (this.state === 'playing' || this.state === 'paused');
    this.model.animateFlight(dt, fl, this.fly.speed / 17, this.fly.bank, this.fly.pitch, this.fly.climb);
    if (!fl) this.model.animate(dt, this.lastSpeed, b.grounded, this.gliding, b.climbing);
    const g = this.level.world.groundAt(b.x, b.z, b.y + 0.2, 0.3);
    this.blob.position.set(b.x, g.y + 0.04, b.z); this.blob.rotation.y = this.heading;
    const s = Math.max(0.35, 1 - (b.y - g.y) * 0.1); this.blob.scaling.set(s, 1, s);
    this.audio.setListener(this.rig.position.x, this.rig.position.y, this.rig.position.z, Math.sin(this.rig.yaw), Math.cos(this.rig.yaw));
    this.audio.update(b);
  }

  private updatePlaying(dt: number, f: InputFrame): void {
    if (f.pause) { this.pause(); return; }
    if (this.flight) { this.updateFlight(dt, f); return; }
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
    if (b.inWater) speed *= 0.5; // nadar contra a correnteza é lento
    if (b.grounded && w.zoneAt(b.x, b.z, 'web')) speed *= 0.35; // teia: pegajosa
    const len = Math.hypot(wx, wz) || 1; wx = (wx / len) * speed * (mag > 0 ? 1 : 0); wz = (wz / len) * speed * (mag > 0 ? 1 : 0);

    // Vento forte empurra quem está sem cobertura (mais no ar do que no chão)
    const lw = this.level.wind;
    if ((lw.x || lw.z) && !w.isCovered(b.x, b.z, b.y)) { const f = b.grounded ? 0.45 : 1; wx += lw.x * f; wz += lw.z * f; }

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
    if (ev.bounced) this.audio.bounce();
    if (b.y < w.killY) this.hurt('Marieta caiu!');

    // Água: depois de um tempo, a correnteza leva Marieta
    if (b.inWater) { this.waterTime += dt; if (this.waterTime > WATER_LIMIT) { this.waterTime = 0; this.swept(); return; } }
    else this.waterTime = Math.max(0, this.waterTime - dt * 1.5);

    // Orientação do corpo
    const hv = Math.hypot(b.vx, b.vz); this.lastSpeed = b.grounded || b.climbing ? hv : this.lastSpeed * 0.9;
    if (this.rig.mode === 'first') this.heading = this.rig.yaw;
    else if (hv > 0.4) { const want = Math.atan2(b.vx, b.vz); let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * Math.min(1, dt * 12); }

    // Passos
    if (b.grounded && hv > 0.5) { this.stepDist += hv * dt; const stride = f.run ? 1.5 : 1.1; if (this.stepDist > stride) { this.stepDist = 0; this.audio.footstep(b.inWater ? 'moss' : b.surface, hv > 6.5); } }

    this.interactions(f);
    this.hazards(dt);
    if (this.state === 'playing' && !this.flags.has(`done${this.level.info.id}`) && this.quests.isDone(this.level.info.mainQuest)) this.complete();
    this.updateWorld(dt, Math.min(1, hv / RUN));
    this.hudAcc += dt; if (this.hudAcc > 0.12) { this.hudAcc = 0; this.refreshHud(); }
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
      let msg = `${ITEM_INFO[item].name}`;
      if (item === 'dew' && this.hearts < MAX_HEARTS) { this.hearts++; msg += ' · +1 coração 💗'; }
      this.audio.collect(); this.ui.toast(msg, 1600); this.queueSave(); this.refreshHud();
    }
    // Checkpoints
    const cp = w.zoneAt(b.x, b.z, 'checkpoint');
    if (cp && cp.id !== this.checkpoint.id) { this.checkpoint = { id: cp.id, x: cp.x, y: 0, z: cp.z }; this.audio.checkpoint(); this.ui.toast('Abrigo seguro: progresso salvo 🍃'); this.queueSave(); }
    // Zonas de objetivo (chegar a um lugar)
    const goal = w.zoneAt(b.x, b.z, 'goal');
    if (goal) this.quests.handle(this.level.zoneEvent(goal.id));
    // Prompt de interação
    const npc = this.level.nearestNpc(b.x, b.z, 5);
    const special = this.level.interaction(b.x, b.z, this.host);
    const key = this.input.usingTouch ? 'Toque em ✋' : 'E';
    this.ui.prompt(npc ? `${key} — Conversar com ${npc.name}` : special ? `${key} — ${special.prompt}` : null);
    if (f.interact) {
      if (npc) this.startDialogue(npc.id);
      else if (special) special.run();
    }
  }

  private hazards(dt: number): void {
    const b = this.body;
    const allowed = this.level.info.birdActive(b, this.quests, this.flags);
    const ev = this.bird.update(dt, b, this.level.world, this.settings.difficulty, allowed);
    if (ev === 'warn') { this.audio.warn(); this.ui.toast('🦅 Sombra de pássaro! Esconda-se sob uma folha ou cogumelo!', 3200); }
    if (ev === 'caught') this.hurt('O pássaro quase te pegou!');
    const seen = this.level.takeHazard();
    if (seen) { this.hurt(seen); this.waterTime = 0; return; }
    const water = this.waterTime > 0.2 ? Math.min(1, this.waterTime / WATER_LIMIT) : 0;
    this.ui.danger(Math.max(this.bird.danger * 0.9, water * 0.8, this.level.alert * 0.95));
    this.audio.setTension(this.bird.danger > 0.1 ? this.bird.danger : 0);
  }

  private contextHints(): void {
    const b = this.body;
    if (this.flags.has('glide') && !this.hintShown.has('glide') && !b.grounded) { this.hintShown.add('glide'); this.ui.hint(this.input.usingTouch ? 'Segure o botão de pular no ar para planar' : 'Segure ESPAÇO no ar para abrir as asas e planar', 5000); }
    if (b.climbing && !this.hintShown.has('climb')) { this.hintShown.add('climb'); this.ui.hint('Segure para frente para subir pelo caule', 3500); }
    if (b.inWater && !this.hintShown.has('water')) { this.hintShown.add('water'); this.ui.hint('Na água a correnteza arrasta! Saia depressa para a margem ou uma pedra.', 4500); }
  }

  /* ---------- diálogo ---------- */
  private talkingTo = ''; private cinematic = false; private prevMode: 'third' | 'first' | 'orbital' = 'third';
  private startDialogue(npcId: string): void {
    this.talkingTo = npcId;
    const cin = this.level.info.cinematic;
    this.cinematic = !!cin && cin.npc === npcId && this.quests.currentObjective(this.level.info.mainQuest)?.id === cin.objective;
    if (this.cinematic) { this.prevMode = this.rig.mode; this.rig.setMode('orbital'); this.rig.look(0, 0, -6); this.rig.pitch = 0.2; }
    const d = this.level.info.pickDialogue(npcId, this.quests, this.flags, this.inventory);
    this.dialogue.start(d); this.state = 'dialogue'; this.input.enabled = false;
    this.ui.prompt(null); this.ui.showDialogue(d.speaker, this.dialogue.line); this.audio.interact();
  }
  private advanceDialogue(): void {
    if (this.state !== 'dialogue') return;
    if (!this.ui.typingDone) { this.ui.finishTyping(); return; }
    const actions = this.dialogue.advance();
    if (actions === null) { this.ui.showDialogue(this.dialogue.speaker, this.dialogue.line); return; }
    this.ui.hideDialogue(); this.state = 'playing'; this.input.enabled = true;
    if (this.cinematic) { this.cinematic = false; this.rig.setMode(this.prevMode); }
    for (const a of actions) this.runAction(a);
    this.level.talked(this.talkingTo, this.flags);
    this.queueSave();
  }
  private runAction(a: string): void {
    if (a === 'unlockGlide') { this.flags.add('glide'); this.ui.toast('Você aprendeu a planar! ✨', 3000); }
    else if (a.startsWith('flag:')) this.flags.add(a.slice(5));
    else if (a.startsWith('give:')) { const [, item, n] = a.split(':'); this.inventory.remove(item as ItemId, Number(n)); this.audio.collect(); this.refreshHud(); }
    else if (a.startsWith('talk:')) this.quests.handle({ type: 'talk', target: a.slice(5) });
  }
  private updateDialogue(dt: number, f: InputFrame): void {
    this.ui.tickDialogue(dt);
    if (this.cinematic) this.rig.yaw += dt * 0.2;
    if (f.advance) this.advanceDialogue();
    if (f.pause) this.pause();
    this.updateWorld(dt, 0);
  }

  /* ---------- HUD ---------- */
  /** Alvo do objetivo atual, para o indicador do mapa. */
  private objectiveTarget(): { x: number; z: number } | undefined {
    const main = this.quests.mainObjective();
    if (!main || this.settings.difficulty === 'explorer') return undefined;
    const o = main.objective, b = this.body;
    if (o.type === 'talk') { const n = this.level.npcs.find((x) => x.id === o.target); return n ? { x: n.x, z: n.z } : undefined; }
    if (o.type === 'collect') {
      let best: { x: number; z: number } | undefined, bd = Infinity;
      for (const p of this.level.pickups) if (!p.taken && p.def.kind === o.target) { const d = Math.hypot(p.def.x - b.x, p.def.z - b.z); if (d < bd) { bd = d; best = { x: p.def.x, z: p.def.z }; } }
      return best;
    }
    if (o.type === 'reach') { const z = this.level.world.zones.find((q) => q.id === o.target); return z ? { x: z.x, z: z.z } : undefined; }
    return this.level.info.interactPoints[o.target];
  }

  private refreshHud(): void {
    const main = this.quests.mainObjective();
    if (main) {
      const c = main.objective.count ?? 1;
      this.ui.setObjective(main.quest.title, main.objective.text, c > 1 ? { n: Math.min(main.progress, c), of: c } : undefined);
    } else this.ui.setObjective(this.level.info.title, 'Explore livremente — a jornada continua!');
    this.ui.setItems(this.inventory); this.ui.setHearts(this.hearts, MAX_HEARTS);
    const b = this.body;
    drawMap(this.ui.minimap(), { level: this.level, x: b.x, z: b.z, yaw: this.rig.yaw, showItems: this.settings.visualAssist || this.settings.difficulty === 'calm' || this.observing, target: this.objectiveTarget() }, 42);
  }
  private paintMap(c: HTMLCanvasElement): void {
    const b = this.body;
    drawMap(c, { level: this.level, x: b.x, z: b.z, yaw: this.rig.yaw, showItems: this.settings.visualAssist || this.settings.difficulty === 'calm', target: this.objectiveTarget() });
  }
}
