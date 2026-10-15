// Auditoria de responsividade: 320…3840 px, retrato/paisagem, toque e mouse.
// Uso: BASE_URL=... CHROMIUM_PATH=... node e2e/responsive.mjs
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

const CASES = [
  [320, 568, 1], [360, 740, 1], [375, 667, 1], [390, 844, 1], [414, 896, 1], [768, 1024, 1], [820, 1180, 1],
  [667, 375, 1], [844, 390, 1], [1024, 768, 1], [1280, 720, 0], [1366, 768, 0], [1440, 900, 0], [1920, 1080, 0], [2560, 1440, 0], [3840, 2160, 0],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

// roda dentro da página: devolve problemas de layout
const audit = () => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > vw + 1) out.push(`rolagem horizontal (${document.documentElement.scrollWidth}>${vw})`);
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.hidden'); };
  const name = (el) => el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName;
  const roots = [...document.querySelectorAll('#app > *')].filter((e) => !e.classList.contains('hidden') && e.id !== 'view' && e.id !== 'fade');
  for (const root of roots) {
    const els = [root, ...root.querySelectorAll('button, .panel, .btn, h1, h2, p, b, .tbtn, canvas, input, select, label')];
    for (const el of els) {
      if (!vis(el) || el.id === 'danger' || el.id === 'joy-zone' || el.id === 'look-zone' || el.id === 'touch' || el.id === 'hud') continue;
      const r = el.getBoundingClientRect();
      if (!el.closest('.screen') || el.closest('#menu')) {
        if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) {
          if (!el.closest('#levels-row') && !el.closest('.sheet') ) out.push(`${name(el)} fora da tela (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
        }
      }
      if ((el.matches('button, .btn, .tbtn')) && (r.width < 43.5 || r.height < 43.5) && !el.closest('#levels-row')) out.push(`alvo de toque pequeno ${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (el.matches('.panel, .btn, button, h1, h2, b') && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto') out.push(`texto cortado em ${name(el)}`);
    }
  }
  return out;
};
// sobreposição entre blocos do HUD
const overlaps = () => {
  const ids = ['hearts', 'objective', 'items', 'minimap', 'top-btns', 't-jump', 't-interact', 't-observe', 'prompt', 'toast', 'flight-hud'];
  const rs = ids.map((i) => document.getElementById(i)).filter((e) => e && e.getClientRects().length && !e.closest('.hidden')).map((e) => [e.id, e.getBoundingClientRect()]);
  const res = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, A] = rs[i], [b, B] = rs[j];
    if (['prompt', 'toast'].includes(a) || ['prompt', 'toast'].includes(b)) continue;
    if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) res.push(`${a} sobrepõe ${b}`);
  }
  return res;
};

for (const [w, h, touch] of CASES) {
  const label = `${w}x${h}${touch ? '-toque' : ''}`;
  if (only && !only.includes(String(w))) continue;
  console.log(label);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: !!touch, hasTouch: !!touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const G = (e) => page.evaluate(`(() => { const g = window.__marieta; return ${e}; })()`);
  const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(e)) return true; await sleep(100); } return false; };
  await page.goto(`${BASE}/?debug=1`);
  if (!(await until("g.state === 'menu'", 150000))) { ok(false, 'menu não carregou'); await ctx.close(); continue; }
  await G("(g.maxFrame = 1, g.applySettings({ ...g.settings, quality: 'eco' }, false), true)");
  let pr = await page.evaluate(audit);
  ok(pr.length === 0, `menu sem problemas${pr.length ? ': ' + pr.join('; ') : ''}`);
  await page.screenshot({ path: OUT + `r-${label}-menu.png` });
  // telas de folha
  for (const [btn, id] of [['#btn-settings', 'settings'], ['#btn-controls', 'controls'], ['#btn-credits', 'credits']]) {
    await page.click(btn); await sleep(150);
    const sheetOk = await page.evaluate((id) => {
      const el = document.querySelector(`#${id} .sheet`); const r = el.getBoundingClientRect();
      return { fit: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, hscroll: el.scrollWidth > el.clientWidth + 2 };
    }, id);
    ok(sheetOk.fit && !sheetOk.hscroll, `${id} cabe na tela`);
    pr = await page.evaluate(audit); ok(pr.length === 0, `${id} sem problemas${pr.length ? ': ' + pr.join('; ') : ''}`);
    if (id === 'settings') await page.screenshot({ path: OUT + `r-${label}-settings.png` });
    await page.click(`#${id}-close`); await sleep(100);
  }
  await page.click('#btn-new');
  ok(await until("g.state === 'playing'"), 'jogo iniciou');
  await G("(g.maxFrame = 1, true)"); await sleep(600);
  pr = await page.evaluate(audit); ok(pr.length === 0, `HUD sem problemas${pr.length ? ': ' + pr.join('; ') : ''}`);
  const ov = await page.evaluate(overlaps); ok(ov.length === 0, `HUD sem sobreposição${ov.length ? ': ' + ov.join('; ') : ''}`);
  await page.screenshot({ path: OUT + `r-${label}-hud.png` });
  // pausa
  await page.keyboard.press('Escape').catch(() => {});
  await G("(g.pause && g.state === 'playing' && g.pause(), true)"); await sleep(200);
  pr = await page.evaluate(() => { const el = document.querySelector('#pause .sheet'); const r = el.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && el.scrollWidth <= el.clientWidth + 2; });
  ok(pr, 'pausa cabe na tela');
  await page.screenshot({ path: OUT + `r-${label}-pause.png` });
  // modo de voo
  await G("(g.toMenu(), true)"); await sleep(300);
  await page.click('#btn-fly'); ok(await until("g.state === 'playing' && g.flight"), 'voo iniciou'); await sleep(500);
  pr = await page.evaluate(audit); ok(pr.length === 0, `HUD de voo sem problemas${pr.length ? ': ' + pr.join('; ') : ''}`);
  const ov2 = await page.evaluate(overlaps); ok(ov2.length === 0, `HUD de voo sem sobreposição${ov2.length ? ': ' + ov2.join('; ') : ''}`);
  await page.screenshot({ path: OUT + `r-${label}-voo.png` });
  ok(errors.length === 0, `sem erros de JS${errors.length ? ': ' + errors[0] : ''}`);
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} verificações falharam.` : '\nTodas as verificações de responsividade passaram.');
process.exit(failed ? 1 : 0);
