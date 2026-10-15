// Teste de ponta a ponta (Playwright + Chromium com WebGL por software).
// Uso: BASE_URL=http://localhost:5173 node e2e/smoke.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  // CHROMIUM_PATH permite usar um Chromium já instalado (ex.: /opt/pw-browsers/chromium-1194/chrome-linux/chrome)
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const G = (expr) => page.evaluate(`(() => { const g = window.__marieta; return ${expr}; })()`);
const state = () => G('g.state');
const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(expr)) return true; await sleep(100); } return false; };
const waitState = async (s, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await state()) === s) return true; await sleep(100); } return false; };
const tp = (x, y, z) => G(`(g.body.x=${x}, g.body.y=${y}, g.body.z=${z}, g.body.vx=0, g.body.vy=0, g.body.vz=0, true)`);

console.log('1. Carregamento e menu');
await page.goto(`${BASE}/?debug=1`);
ok(await waitState('menu', 120000), 'menu inicial exibido');
// WebGL por software é lento: qualidade econômica e simulação em tempo real mesmo com poucos quadros/s
const prep = () => G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
await prep();
await sleep(1500);
await page.screenshot({ path: OUT + '01-menu.png' });
ok(await page.isVisible('#btn-new'), 'botão Novo jogo visível');

console.log('2. Novo jogo, movimento e câmeras');
await page.click('#btn-new');
ok(await waitState('playing'), 'estado playing');
await sleep(800);
const z0 = await G('g.body.z');
await page.keyboard.down('w'); await sleep(1500); await page.keyboard.up('w');
const z1 = await G('g.body.z');
ok(z1 > z0 + 2, `W move Marieta para a frente (z ${z0.toFixed(1)} → ${z1.toFixed(1)})`);
await page.screenshot({ path: OUT + '02-terceira-pessoa.png' });

let maxY = 0;
await page.keyboard.down(' ');
for (let i = 0; i < 12; i++) { maxY = Math.max(maxY, await G('g.body.y')); await sleep(40); }
await page.keyboard.up(' ');
ok(maxY > 0.8, `Espaço salta (altura máx ${maxY.toFixed(2)})`);
await sleep(900);

const posA = await G('[g.body.x, g.body.z]');
await page.keyboard.press('f'); await sleep(400);
ok((await G('g.rig.mode')) === 'first', 'F → primeira pessoa');
await page.screenshot({ path: OUT + '03-primeira-pessoa.png' });
const posB = await G('[g.body.x, g.body.z]');
ok(Math.hypot(posA[0] - posB[0], posA[1] - posB[1]) < 0.05, 'trocar de câmera não move o personagem');
await page.keyboard.press('f'); await sleep(400);
ok((await G('g.rig.mode')) === 'orbital', 'F → orbital');
await page.screenshot({ path: OUT + '04-orbital.png' });
await page.keyboard.press('f'); await sleep(300);
ok((await G('g.rig.mode')) === 'third', 'F → terceira pessoa');

console.log('3. Pausa e observação');
await page.keyboard.press('Escape');
ok(await waitState('paused'), 'Esc pausa');
ok(await page.isVisible('#pause'), 'menu de pausa visível');
await page.screenshot({ path: OUT + '05-pausa.png' });
await page.keyboard.press('Escape');
ok(await waitState('playing'), 'Esc retoma');
await page.keyboard.press('q');
ok(await until('g.observing'), 'Q ativa o modo de observação');
await page.screenshot({ path: OUT + '06-observacao.png' });
await page.keyboard.press('q');

console.log('4. Missão: Tito, gotas, portão, abrigo');
await tp(4, 0, -80);
ok(await until("!document.getElementById('prompt').classList.contains('hidden')"), 'prompt de interação aparece perto de Tito');
await page.keyboard.press('e');
ok(await waitState('dialogue'), 'E inicia o diálogo');
await page.screenshot({ path: OUT + '07-dialogo.png' });
for (let i = 0; i < 14 && (await state()) === 'dialogue'; i++) { await page.keyboard.press('e'); await sleep(120); await page.keyboard.press('e'); await sleep(120); }
ok((await state()) === 'playing', 'diálogo termina');
ok(await G("g.flags.has('glide')"), 'Tito ensina a planar');
ok((await G("g.quests.currentObjective('jardim').id")) === 'gotas', 'objetivo avança para coletar gotas');

const dews = await G("g.level.pickups.filter(p => p.def.kind === 'dew').slice(0, 5).map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < dews.length; i++) { const [x, y, z] = dews[i]; await tp(x, y, z); await until(`g.inventory.count('dew') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('dew')")) === 5, 'coletou 5 gotas de orvalho');
ok((await G("g.quests.currentObjective('jardim').id")) === 'portao', 'objetivo avança para a folha-portão');

await tp(0, 0, 73.5);
await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.screenshot({ path: OUT + '08-portao.png' });
await page.keyboard.press('e');
ok(await until('g.level.gateOpen'), 'portão aberto');
await sleep(2500);
ok((await G("g.inventory.count('dew')")) === 0, 'gotas consumidas');
await page.screenshot({ path: OUT + '09-portao-aberto.png' });

console.log('4b. Perigo: sombra do pássaro');
// Em baixo de uma folha (cobertura): a sombra passa e Marieta NÃO é pega
await tp(-4, 0, 40); await sleep(600);
const cp = await G('[g.checkpoint.x, g.checkpoint.z]');
await G("(g.bird.spawnThrough(g.body.x, g.body.z, 0.7, 'balanced'), true)");
await until('!g.bird.active', 40000);
ok(!(await G('g.bird.active')), 'sombra do pássaro terminou a passagem');
ok(Math.hypot((await G('g.body.x')) + 4, (await G('g.body.z')) - 40) < 1.5, 'sob a folha: Marieta continua no lugar (abrigada)');
// A céu aberto: é pega e volta ao checkpoint
await tp(30, 0, 24); await sleep(400);
await G("(g.bird.spawnThrough(g.body.x, g.body.z, 0.7, 'balanced'), true)");
ok(await until('Math.hypot(g.body.x - 30, g.body.z - 24) > 10', 40000), 'a céu aberto: pego pelo pássaro e devolvido ao checkpoint');
await page.screenshot({ path: OUT + '08b-passaro.png' });
await until("document.getElementById('fade').classList.contains('on') === false", 5000);
ok(Math.hypot((await G('g.body.x')) - cp[0], (await G('g.body.z')) - cp[1]) < 3, 'respawn no último checkpoint');

console.log('5. Salvamento e continuar');
await sleep(1200);
await page.reload();
ok(await waitState('menu', 120000), 'recarregou até o menu');
await prep();
ok(!(await page.isDisabled('#btn-continue')), 'Continuar habilitado');
await page.click('#btn-continue');
ok(await waitState('playing'), 'Continuar retoma o jogo');
ok(await G('g.level.gateOpen'), 'portão continua aberto após carregar');
ok((await G("g.quests.currentObjective('jardim').id")) === 'abrigo', 'missão restaurada');

console.log('6. Conclusão da fase');
await tp(0, 0, 90);
ok(await waitState('complete'), 'chegar ao abrigo conclui a fase');
await page.screenshot({ path: OUT + '10-conclusao.png' });

ok(errors.filter((e) => !/GPU stall|ReadPixels|WebGL: INVALID|swiftshader/i.test(e)).length === 0, `sem erros de console (${errors.length ? errors.slice(0, 3).join(' | ') : 'ok'})`);
await browser.close();
console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failed ? 1 : 0);
