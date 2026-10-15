// Teste em emulação de celular (toque real via CDP). Uso: BASE_URL=... CHROMIUM_PATH=... node e2e/mobile.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let failed = 0;
const ok = (c, m) => { console.log(`${c ? '  ✔' : '  ✘'} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function run(label, viewport) {
  console.log(label);
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const G = (e) => page.evaluate(`(() => { const g = window.__marieta; return ${e}; })()`);
  const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(e)) return true; await sleep(100); } return false; };
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

  await page.goto(`${BASE}/?debug=1`);
  ok(await until("g.state === 'menu'", 120000), 'menu carregado');
  await G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
  const { width, height } = viewport;
  ok(await page.evaluate(() => { const r = document.querySelector('.menu-card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }), 'menu cabe na tela sem cortar');
  await page.screenshot({ path: OUT + `m-${label}-menu.png` });
  await page.tap('#btn-new');
  ok(await until("g.state === 'playing'"), 'toque em Novo jogo inicia');
  ok(await page.isVisible('#touch'), 'controles de toque visíveis');
  await sleep(500);

  // Joystick: arrasta para cima na metade esquerda
  const z0 = await G('g.body.z');
  const jx = width * 0.2, jy = height * 0.7;
  await touch('touchStart', [{ x: jx, y: jy, id: 1 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: jx, y: jy - i * 10, id: 1 }]); await sleep(80); }
  await sleep(1500);
  await page.screenshot({ path: OUT + `m-${label}-jogo.png` });
  await touch('touchEnd', []);
  const z1 = await G('g.body.z');
  ok(z1 > z0 + 1.5, `joystick virtual move Marieta (z ${z0.toFixed(1)} → ${z1.toFixed(1)})`);

  // Arrastar na metade direita gira a câmera
  const yaw0 = await G('g.rig.yaw');
  const lx = width * 0.7, ly = height * 0.4;
  await touch('touchStart', [{ x: lx, y: ly, id: 2 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: lx + i * 25, y: ly, id: 2 }]); await sleep(60); }
  await touch('touchEnd', []);
  await sleep(600);
  ok(Math.abs((await G('g.rig.yaw')) - yaw0) > 0.3, 'arrastar à direita gira a câmera');

  // Botão pular
  let maxY = 0;
  const bb = await page.locator('#t-jump').boundingBox();
  await touch('touchStart', [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 3 }]);
  for (let i = 0; i < 15; i++) { maxY = Math.max(maxY, await G('g.body.y')); await sleep(40); }
  await touch('touchEnd', []);
  ok(maxY > 0.8, `botão Pular salta (${maxY.toFixed(2)})`);

  // Botão câmera e pausa
  await page.tap('#b-camera');
  ok(await until("g.rig.mode === 'first'"), 'botão de câmera alterna o modo');
  await page.tap('#b-pause');
  ok(await until("g.state === 'paused'"), 'botão de pausa funciona');
  await page.screenshot({ path: OUT + `m-${label}-pausa.png` });
  ok(await page.evaluate(() => { const r = document.querySelector('#pause .sheet'); return r.scrollHeight > 0; }), 'pausa renderizada');
  ok(errors.length === 0, `sem erros de página ${errors.slice(0, 2).join('|')}`);
  await ctx.close();
}

await run('retrato', { width: 390, height: 844 });
await run('paisagem', { width: 844, height: 390 });
await browser.close();
console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failed ? 1 : 0);
