// Teste isolado de UMA fase: abre o jogo, inicia a fase direto (sem passar pelas anteriores) e roda os passos dela.
// Uso: PHASE=7 CHROMIUM_PATH=... BASE_URL=... node e2e/phase.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PHASE = Number(process.env.PHASE ?? 7);
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failed = 0;
const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (e) => page.evaluate(`(() => { const g = window.__marieta; return ${e}; })()`);
const state = () => G('g.state');
const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(expr)) return true; await sleep(100); } return false; };
const waitState = async (s, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await state()) === s) return true; await sleep(100); } return false; };
const tp = (x, y, z) => G(`(g.body.x=${x}, g.body.y=${y}, g.body.z=${z}, g.body.vx=0, g.body.vy=0, g.body.vz=0, true)`);
const finishDialogue = async () => { for (let i = 0; i < 60; i++) { if ((await state()) !== 'dialogue') return; await page.keyboard.press('e'); await sleep(250); } };
const talk = async (x, z) => {
  await tp(x, 0, z);
  await until("!document.getElementById('prompt').classList.contains('hidden')");
  await page.keyboard.press('e');
  ok(await waitState('dialogue'), `diálogo inicia em (${x}, ${z})`);
  await finishDialogue(); await waitState('playing');
};
const collect = async (kind, count) => {
  const pts = await G(`g.level.pickups.filter(p => p.def.kind === '${kind}').slice(0, ${count}).map(p => [p.def.x, p.def.y, p.def.z])`);
  for (let i = 0; i < pts.length; i++) { const [x, y, z] = pts[i]; await tp(x, y, z); await until(`g.inventory.count('${kind}') >= ${i + 1}`, 8000); }
};

await page.goto(`${BASE}/?debug=1`);
ok(await waitState('menu', 120000), 'menu carregado');
await G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
await G(`g.startNew(${PHASE})`);
ok(await waitState('playing'), `Fase ${PHASE} iniciada`);
ok((await G('g.level.info.id')) === PHASE, `Fase ${PHASE} carregada`);
await G('(g.bird.nextAt = 1e9, true)');

const steps = {
  7: async () => {
    await talk(8, -79);
    ok(await until("g.quests.currentObjective('ninho')?.id === 'folhas'", 10000), 'Sr. Caramujo pede as folhas do ninho');
    await page.screenshot({ path: OUT + 'p7-caramujo.png' });
    // Opcional: confiar em Dário (2 sementes)
    await collect('seed', 2);
    ok((await G("g.quests.currentObjective('dario')?.id")) === 'entregar', 'missão opcional: entregar sementes a Dário');
    await talk(-31, -36);
    ok(await G("g.flags.has('dario')"), 'Dário aceita as sementes e faz as pazes');
    ok((await G("g.inventory.count('seed')")) === 0, 'as 2 sementes foram entregues');
    await collect('leaf', 6);
    ok((await G("g.inventory.count('leaf')")) === 6, 'juntou 6 folhas macias');
    await tp(0, 0, 38); await until("!document.getElementById('prompt').classList.contains('hidden')");
    await page.keyboard.press('e');
    ok(await until('g.level.wallsBuilt'), 'paredes do ninho erguidas');
    await tp(0, 0, 50); await until("!document.getElementById('prompt').classList.contains('hidden')");
    await page.keyboard.press('e');
    ok(await until('g.level.roofBuilt'), 'telhado do ninho construído');
    await sleep(3000);
    await tp(0, 0, 64);
    await page.screenshot({ path: OUT + 'p7-ninho.png' });
    ok(await until("g.quests.currentObjective('ninho')?.id === 'beto'", 15000), 'entrou no Ninho Verde');
    await talk(2, 72);
    ok(await waitState('complete'), 'falar com Beto conclui a Fase 7');
    await page.screenshot({ path: OUT + 'p7-vitoria.png' });
  },
};
if (!steps[PHASE]) { console.log(`Sem roteiro para a fase ${PHASE}`); failed++; } else await steps[PHASE]();

ok(errors.length === 0, `sem erros de console ${errors.slice(0, 2).join(' | ')}`);
await browser.close();
console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failed ? 1 : 0);
