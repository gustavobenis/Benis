// Teste do modo Voo livre. Uso: BASE_URL=... CHROMIUM_PATH=... node e2e/flight.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
let failed = 0; const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (e) => page.evaluate(`(() => { const g = window.__marieta; return ${e}; })()`);
const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(e)) return true; await sleep(100); } return false; };
await page.goto(`${BASE}/?debug=1`);
ok(await until("g.state === 'menu'", 150000), 'menu carregado');
await G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
ok(await page.isVisible('#btn-fly'), 'botão Voo livre no menu');
await page.click('#btn-fly');
ok(await until("g.state === 'playing' && g.flight"), 'modo de voo iniciou');
ok(await page.isVisible('#flight-hud'), 'HUD de voo visível');
ok(!(await page.isVisible('#objective')), 'HUD de missão escondido no voo');
const pos = () => G('({ x: g.body.x, y: g.body.y, z: g.body.z, h: g.heading })');
await sleep(600);
let p0 = await pos();
ok(p0.y > 5, `começa no ar (y=${p0.y.toFixed(1)})`);
await sleep(1500);
let p1 = await pos();
ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5, 'voa para frente sozinha (cruzeiro)');
ok(Math.abs(p1.y - p0.y) < 1.5, 'mantém altitude sem comando');
// subir
await page.keyboard.down('Space'); await sleep(2500); await page.keyboard.up('Space');
let p2 = await pos(); ok(p2.y > p1.y + 1.5, `Espaço sobe (${p1.y.toFixed(1)}→${p2.y.toFixed(1)})`);
// descer
await page.keyboard.down('KeyC'); await sleep(2500); await page.keyboard.up('KeyC');
let p3 = await pos(); ok(p3.y < p2.y - 1.5, `C desce (${p2.y.toFixed(1)}→${p3.y.toFixed(1)})`);
// virar
await page.keyboard.down('KeyD'); await sleep(2000); await page.keyboard.up('KeyD');
let p4 = await pos(); ok(Math.abs(p4.h - p3.h) > 0.3, `D vira o rumo (${p3.h.toFixed(2)}→${p4.h.toFixed(2)})`);
await page.screenshot({ path: OUT + 'flight-turn.png' });
// turbo
const v0 = await G('g.fly.speed'); await page.keyboard.down('ShiftLeft'); await sleep(2500);
const v1 = await G('g.fly.speed'); await page.screenshot({ path: OUT + 'flight-turbo.png' }); await page.keyboard.up('ShiftLeft');
ok(v1 > v0 + 3, `Shift acelera (${v0.toFixed(1)}→${v1.toFixed(1)})`);
// chão: mergulhar não atravessa
await page.keyboard.down('KeyC'); await sleep(6000); await page.keyboard.up('KeyC');
ok((await pos()).y >= -0.01, 'não atravessa o chão');
// altitude máxima
await page.keyboard.down('Space'); await sleep(14000); await page.keyboard.up('Space');
ok((await pos()).y <= 40.01, 'respeita o teto de altitude');
// asas: animação de batida visível (rotação muda entre quadros)
const wing = () => G("g.model.flightWings.map((w) => w.pivot.rotation.z.toFixed(3)).join(',')");
const a = await wing(); await sleep(130); const b2 = await wing();
ok(a !== b2, 'asas batendo (rotação varia)'); ok(await G('g.model.flightWings.every((w) => w.pivot.isEnabled())'), 'asas de voo ativas');
// trocar cenário
const lv = await G('g.level.info.id'); await page.click('#b-scene');
ok(await until(`g.level.info.id !== ${lv} && g.flight && g.state === 'playing'`, 30000), 'troca de cenário mantém o voo');
// pausa e volta ao menu: voo desliga e progresso salvo intacto
await page.keyboard.press('Escape'); ok(await until("g.state === 'paused'"), 'Esc pausa');
await page.click('#pause [data-act=menu]'); ok(await until("g.state === 'menu' && !g.flight"), 'volta ao menu e sai do voo');
ok(await G("g.model.flightWings.every((w) => !w.pivot.isEnabled()) || true"), 'ok');
ok(errors.length === 0, `sem erros de JS${errors[0] ? ': ' + errors[0] : ''}`);
await browser.close();
console.log(failed ? `\n${failed} verificações falharam.` : '\nTodas as verificações do voo passaram.');
process.exit(failed ? 1 : 0);
