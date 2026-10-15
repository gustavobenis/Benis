import { describe, expect, it } from 'vitest';
import { QuestLog, type QuestNotice } from '../src/systems/Quests';
import { LEVEL1_QUESTS } from '../src/data/quests';
import { pickDialogue } from '../src/data/dialogues';
import { Inventory } from '../src/systems/Inventory';
import { DialogueRunner } from '../src/systems/Dialogue';
import { MemoryKV, SaveManager, type SaveData } from '../src/systems/Save';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/systems/Settings';

describe('QuestLog', () => {
  it('conduz a missão principal do início ao fim', () => {
    const q = new QuestLog(LEVEL1_QUESTS);
    const notes: QuestNotice[] = [];
    q.onNotice((n) => notes.push(n));
    expect(q.mainObjective()?.objective.id).toBe('tito');
    q.handle({ type: 'collect', item: 'dew' }); // fora de ordem: ignorado
    expect(q.state('jardim').objective).toBe(0);
    q.handle({ type: 'talk', target: 'tito' });
    for (let i = 0; i < 5; i++) q.handle({ type: 'collect', item: 'dew' });
    expect(q.currentObjective('jardim')?.id).toBe('portao');
    q.handle({ type: 'interact', target: 'leafgate' });
    q.handle({ type: 'reach', target: 'shelter' });
    expect(q.isDone('jardim')).toBe(true);
    expect(notes.at(-1)?.kind).toBe('completed');
    expect(q.mainObjective()).toBeUndefined();
  });

  it('missão opcional acumula e serializa', () => {
    const q = new QuestLog(LEVEL1_QUESTS);
    for (let i = 0; i < 3; i++) q.handle({ type: 'collect', item: 'seed' });
    expect(q.currentObjective('sementes')?.id).toBe('entregar');
    const q2 = new QuestLog(LEVEL1_QUESTS);
    q2.load(JSON.parse(JSON.stringify(q.serialize())));
    expect(q2.currentObjective('sementes')?.id).toBe('entregar');
  });

  it('missões com dependência começam bloqueadas', () => {
    const q = new QuestLog([
      { id: 'a', title: 'A', objectives: [{ id: 'x', text: 'x', type: 'talk', target: 'n' }] },
      { id: 'b', title: 'B', after: 'a', objectives: [{ id: 'y', text: 'y', type: 'talk', target: 'm' }] },
    ]);
    expect(q.status('b')).toBe('locked');
    q.handle({ type: 'talk', target: 'n' });
    expect(q.status('b')).toBe('active');
  });

  it('diálogo do Tito muda conforme a missão', () => {
    const q = new QuestLog(LEVEL1_QUESTS);
    expect(pickDialogue('tito', q).id).toBe('tito_intro');
    q.handle({ type: 'talk', target: 'tito' });
    expect(pickDialogue('tito', q).id).toBe('tito_again');
  });
});

describe('Inventory / Dialogue', () => {
  it('não consome mais do que possui', () => {
    const inv = new Inventory();
    inv.add('dew', 3);
    expect(inv.remove('dew', 5)).toBe(false);
    expect(inv.count('dew')).toBe(3);
    expect(inv.remove('dew', 3)).toBe(true);
    expect(inv.entries()).toEqual([]);
  });
  it('executa diálogos e devolve ações no fim', () => {
    const d = new DialogueRunner();
    d.start({ id: 'x', speaker: 'T', lines: ['a', 'b'], onEnd: ['go'] });
    expect(d.advance()).toBeNull();
    expect(d.line).toBe('b');
    expect(d.advance()).toEqual(['go']);
    expect(d.active).toBe(false);
  });
});

describe('Save / Settings', () => {
  const data: SaveData = { version: 1, savedAt: 1, level: 1, checkpoint: { x: 1, y: 0, z: 2, id: 'cp1' }, quests: {}, inventory: { dew: 2 }, collected: ['dew1'], flags: ['glide'], playTime: 10 };
  it('salva e carrega; descarta dados corrompidos', async () => {
    const kv = new MemoryKV();
    const s = new SaveManager(kv);
    expect(await s.loadGame()).toBeNull();
    await s.saveGame(data);
    expect(await s.loadGame()).toEqual(data);
    await kv.set('save', { version: 1, level: 'x' });
    expect(await s.loadGame()).toBeNull();
    await s.deleteGame();
    expect(await s.loadGame()).toBeNull();
  });
  it('sanitiza configurações inválidas', () => {
    const s = sanitizeSettings({ master: 7, quality: 'ultra', difficulty: 'calm', uiScale: 'x' });
    expect(s.master).toBe(1);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(s.difficulty).toBe('calm');
    expect(s.uiScale).toBe(1);
  });
});
