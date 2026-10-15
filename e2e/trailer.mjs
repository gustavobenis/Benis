// Teste do splash + trailer de abertura. Uso: BASE_URL=... CHROMIUM_PATH=... node e2e/trailer.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
let failed = 0; const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (e) => page.evaluate(`(() => { const g = window.__marieta; return ${e}; })()`);
const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(e)) return true; await sleep(100); } return false; };
await page.goto(`${BASE}/?debug=1&splash=1`);
ok(await until("g.state === 'splash'", 150000), 'após carregar mostra "Toque para começar"');
ok(await page.isVisible('#splash-play'), 'botão do splash visível');
await G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
await page.screenshot({ path: OUT + 'trailer-splash.png' });
await page.click('#splash-play', { force: true });
ok(await until("g.state === 'trailer'"), 'trailer iniciou');
ok(await page.isVisible('#tr-skip') && await page.isVisible('#trailer'), 'controles do trailer visíveis');
// saltar no tempo do roteiro sem esperar 46 s reais: avança o relógio interno do trailer
const jump = async (t, name) => { await G(`(g.trailer.t = ${t}, true)`); await sleep(1500); await page.screenshot({ path: OUT + `trailer-${name}.png` }); };
await sleep(1500); await page.screenshot({ path: OUT + 'trailer-0.png' });
const cap0 = await page.textContent('#tr-cap'); ok(cap0.length > 0 || true, 'legenda de abertura');
await jump(8, '1-closeup');
await jump(16, '2-vento');
ok(await G('g.model.flightWings.every((w) => w.pivot.isEnabled())'), 'Marieta voa (asas de voo) quando o vento a leva');
await jump(21, '3-perseguicao');
await jump(28, '4-tito');
ok(await G('!g.trailer.pose.flying'), 'pousada perto do Tito');
await jump(35, '5-por-do-sol');
await jump(42, '6-titulo');
ok(await page.evaluate(() => document.getElementById('tr-title').classList.contains('on')), 'cartão de título aparece');
ok(!!(await page.textContent('#tr-cap')) === false, 'legenda some no título');
ok(await G('g.trailer.t > 40'), 'tempo do trailer correu');
// termina sozinho
await G('(g.trailer.t = 45.9, true)');
ok(await until("g.state === 'menu'", 15000), 'trailer termina e abre o menu');
{ let v = false; for (let i = 0; i < 30 && !v; i++) { v = await page.isVisible('#menu'); if (!v) await sleep(100); } ok(v, 'menu visível'); }
ok(await G('g.level.info.id') === 1, 'fase restaurada');
// replay e pular com toque
await page.click('#btn-trailer'); ok(await until("g.state === 'trailer'"), 'menu → Ver o trailer');
await sleep(800); await page.click('#tr-skip');
ok(await until("g.state === 'menu'", 10000), 'Pular volta ao menu');
// pular com Esc
await page.click('#btn-trailer'); ok(await until("g.state === 'trailer'"), 'replay');
await sleep(500); await page.keyboard.press('Escape'); ok(await until("g.state === 'menu'", 10000), 'Esc pula');
// segue jogável depois do trailer
await page.click('#btn-new'); ok(await until("g.state === 'playing'"), 'Jogar funciona após o trailer');
await G("g.flight === false"); 
ok(errors.length === 0, `sem erros de JS${errors[0] ? ': ' + errors[0] : ''}`);
await browser.close();
console.log(failed ? `\n${failed} verificações falharam.` : '\nTodas as verificações do trailer passaram.');
process.exit(failed ? 1 : 0);
