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
/** Avança o diálogo uma tecla por vez, sem reabrir a conversa ao terminar. */
const finishDialogue = async () => { for (let i = 0; i < 60; i++) { if ((await state()) !== 'dialogue') return; await page.keyboard.press('e'); await sleep(250); } };
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
await page.keyboard.press('f');
ok(await until("g.rig.mode === 'first'", 10000), 'F → primeira pessoa');
await page.screenshot({ path: OUT + '03-primeira-pessoa.png' });
const posB = await G('[g.body.x, g.body.z]');
ok(Math.hypot(posA[0] - posB[0], posA[1] - posB[1]) < 0.05, 'trocar de câmera não move o personagem');
await page.keyboard.press('f');
ok(await until("g.rig.mode === 'orbital'", 10000), 'F → orbital');
await page.screenshot({ path: OUT + '04-orbital.png' });
await page.keyboard.press('f');
ok(await until("g.rig.mode === 'third'", 10000), 'F → terceira pessoa');

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
await finishDialogue();
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

console.log('7. Fase 2 — O Rio');
ok(await page.isVisible('#complete-next'), 'tela de conclusão oferece a próxima fase');
await page.click('#complete-next');
ok(await waitState('playing'), 'Próxima fase inicia a Fase 2');
ok((await G('g.level.info.id')) === 2, 'Fase 2 carregada');
ok((await G('g.hearts')) === 3, 'começa com 3 corações');
await prep();
await G('(g.bird.nextAt = 1e9, true)'); // determinismo: sem pássaro nos testes do rio
const talk = async (x, z) => {
  await tp(x, 0, z);
  await until("!document.getElementById('prompt').classList.contains('hidden')");
  await page.keyboard.press('e');
  ok(await waitState('dialogue'), `diálogo inicia em (${x}, ${z})`);
  await finishDialogue();
  await waitState('playing');
};
await talk(10, -13);
ok((await G("g.quests.currentObjective('rio').id")) === 'folhas', 'Lino pede folhas especiais');
await page.screenshot({ path: OUT + '11-fase2-lino.png' });
const leaves = await G("g.level.pickups.filter(p => p.def.kind === 'leaf').slice(0, 3).map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < leaves.length; i++) { const [x, y, z] = leaves[i]; await tp(x, y, z); await until(`g.inventory.count('leaf') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('leaf')")) === 3, 'coletou 3 folhas especiais');
ok((await G("g.quests.currentObjective('rio').id")) === 'ponte', 'objetivo: construir a ponte');
// Sem ponte: a água arrasta (correnteza) — travessia pela água
await tp(0, 0, -11); await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.keyboard.press('e');
ok(await until('g.level.bridgeBuilt'), 'ponte construída com as folhas');
ok((await G("g.inventory.count('leaf')")) === 0, 'folhas consumidas');
await sleep(2500);
await page.screenshot({ path: OUT + '12-fase2-ponte.png' });
// Travessia a pé pela ponte, com entrada real do teclado
await tp(0, 0, -14);
await page.keyboard.down('Shift'); await page.keyboard.down('w');
ok(await until('g.body.z > 31', 60000), 'atravessa a ponte a pé (colisor da ponte sustenta Marieta)');
await page.keyboard.up('w'); await page.keyboard.up('Shift');
ok((await G('g.body.y')) < 1.5 && (await G('g.hearts')) === 3, 'chegou à outra margem sem se machucar');
await until("g.quests.currentObjective('rio')?.id === 'luna'", 8000);
ok((await G("g.quests.currentObjective('rio').id")) === 'luna', 'objetivo: falar com Luna');
await talk(-8, 38);
ok((await G("g.quests.currentObjective('rio').id")) === 'beto', 'objetivo: encontrar Beto');
await page.screenshot({ path: OUT + '13-fase2-luna.png' });
await talk(12, 43);
ok(await waitState('complete'), 'encontrar Beto conclui a Fase 2');
await page.screenshot({ path: OUT + '14-fase2-vitoria.png' });
ok(await page.isVisible('#complete-next'), 'Fase 2 concluída oferece a Fase 3');

console.log('7b. Fase 3 — A Floresta');
await page.click('#complete-next');
ok(await waitState('playing'), 'Próxima fase inicia a Fase 3');
ok((await G('g.level.info.id')) === 3, 'Fase 3 carregada');
ok(await G("g.flags.has('glide')"), 'habilidade de planar (aprendida na Fase 1) continua disponível');
await prep();
await G('(g.bird.nextAt = 1e9, true)'); // determinismo: sem pássaro durante os testes da floresta
await talk(8, -77);
ok(await until("g.quests.currentObjective('floresta')?.id === 'cristais'", 10000), 'Tico pede os cristais de luz');
await page.screenshot({ path: OUT + '16-fase3-tico.png' });
// Cogumelo-trampolim: pousar na copa lança Marieta para o alto (física real)
await G("(window.__maxY = 0, window.__tr && clearInterval(window.__tr), window.__tr = setInterval(() => { window.__maxY = Math.max(window.__maxY, g.body.y); }, 16), true)");
await tp(-25, 7, -57);
await sleep(7000);
const apex = await G('window.__maxY');
ok(apex > 8.5, `cogumelo cor-de-rosa funciona como trampolim (ápice ${apex.toFixed(1)})`);
await page.screenshot({ path: OUT + '17-fase3-trampolim.png' });
// Teia pegajosa
ok(!!(await G("g.level.world.zoneAt(12, -44, 'web')")), 'zona de teia registrada');
// Aranha-caçadora: exposta é vista; sob o tronco (cobertura) não é
await G("(g.level.patrol.wait = 1e9, true)");
await tp(40, 0, 70); await sleep(300);
await G("(g.level.patrol.x = -12, g.level.patrol.z = -50, g.level.patrol.yaw = 0, g.level.patrol.wait = 1e9, true)");
await tp(-12, 0, -36); // sob o tronco suspenso
await sleep(4000);
ok((await G('g.hearts')) === 3, 'sob o tronco, a aranha-caçadora não vê Marieta');
await tp(-12, 0, -61); await G("(g.level.patrol.x = -12, g.level.patrol.z = -72, g.level.patrol.yaw = 0, g.level.patrol.wait = 1e9, true)");
ok(await until('g.hearts === 2', 30000), 'a céu aberto, a aranha-caçadora vê Marieta e custa um coração');
await until("document.getElementById('fade').classList.contains('on') === false", 5000);
await G("(g.level.patrol.wait = 1e9, true)");
const crystals = await G("g.level.pickups.filter(p => p.def.kind === 'crystal').map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < crystals.length; i++) { const [x, y, z] = crystals[i]; await tp(x, y, z); await until(`g.inventory.count('crystal') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('crystal')")) === 3, 'coletou 3 cristais de luz');
ok((await G("g.quests.currentObjective('floresta').id")) === 'altar', 'objetivo: acender o altar');
await tp(0, 0, 45.5); await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.keyboard.press('e');
ok(await until('g.level.gateOpen'), 'altar aceso: a muralha de teia se abre');
await sleep(2500);
await page.screenshot({ path: OUT + '18-fase3-altar.png' });
await tp(0, 0, 78);
ok(await until("g.quests.currentObjective('floresta')?.id === 'olivia'", 15000), 'chegou à clareira');
await talk(0, 82);
ok(await waitState('complete'), 'falar com Dona Olívia conclui a Fase 3');
await page.screenshot({ path: OUT + '19-fase3-vitoria.png' });
ok(await page.isVisible('#complete-next'), 'Fase 3 concluída oferece a Fase 4');

console.log('7c. Fase 4 — A Colônia');
await page.click('#complete-next');
ok(await waitState('playing'), 'Próxima fase inicia a Fase 4');
ok((await G('g.level.info.id')) === 4, 'Fase 4 carregada');
await prep();
await G('(g.bird.nextAt = 1e9, true)');
const freezeMantis = (x, z, yaw) => G(`(g.level.patrol.x = ${x}, g.level.patrol.z = ${z}, g.level.patrol.yaw = ${yaw}, g.level.patrol.wait = 1e9, true)`);
await freezeMantis(-50, 90, 0);
await talk(8, -79);
ok(await until("g.quests.currentObjective('colonia')?.id === 'sementes'", 10000), 'Lino pede sementes para o celeiro');
await page.screenshot({ path: OUT + '20-fase4-lino.png' });
// Louva-a-deus: coberto sob o túnel não é visto; exposto à frente dele, é
await freezeMantis(-6, -44, 0);
await tp(-6, 0, -26);
await sleep(4000);
ok((await G('g.hearts')) === 3, 'sob o túnel de terra, o louva-a-deus não vê Marieta');
await freezeMantis(40, -70, 0);
await tp(40, 0, -52);
ok(await until('g.hearts === 2', 30000), 'exposta, o louva-a-deus vê Marieta e custa um coração');
await until("document.getElementById('fade').classList.contains('on') === false", 5000);
await freezeMantis(-50, 90, 0);
const seeds = await G("g.level.pickups.filter(p => p.def.kind === 'seed').map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < seeds.length; i++) { const [x, y, z] = seeds[i]; await tp(x, y, z); await until(`g.inventory.count('seed') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('seed')")) === 4, 'recolheu 4 sementes (inclusive no topo do formigueiro)');
await tp(0, 0, 44.5); await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.keyboard.press('e');
ok(await until('g.level.gate.open'), 'celeiro abastecido: a barricada se abre');
await sleep(2500);
await page.screenshot({ path: OUT + '21-fase4-celeiro.png' });
await tp(0, 0, 78);
ok(await until("g.quests.currentObjective('colonia')?.id === 'rainha'", 15000), 'chegou à câmara da Rainha');
await talk(0, 84);
ok(await waitState('complete'), 'falar com a Rainha conclui a Fase 4');
await page.screenshot({ path: OUT + '22-fase4-vitoria.png' });
ok(await page.isVisible('#complete-next'), 'Fase 4 concluída oferece a Fase 5');

console.log('7d. Fase 5 — A Tempestade');
await page.click('#complete-next');
ok(await waitState('playing'), 'Próxima fase inicia a Fase 5');
ok((await G('g.level.info.id')) === 5, 'Fase 5 carregada');
await prep();
await G('(g.level.nextStrike = 1e9, g.level.nextGust = 1e9, true)'); // determinismo: o clima só age quando o teste manda
ok(await G('!!g.env.rain && g.env.rain.isStarted()'), 'chuva ativa (partículas)');
await talk(6, -80);
ok(await until("g.quests.currentObjective('tempestade')?.id === 'folhas'", 10000), 'Beto pede folhas para a jangada');
ok(await G("g.flags.has('betoJoined') && g.level.joined"), 'Beto passa a acompanhar Marieta');
await page.screenshot({ path: OUT + '23-fase5-beto.png' });
await tp(0, 0, -40);
ok(await until("Math.hypot(g.level.npcs.find(n => n.id === 'beto').x - g.body.x, g.level.npcs.find(n => n.id === 'beto').z - g.body.z) < 8", 30000), 'Beto segue Marieta até perto dela');
// Raio: círculo de aviso, depois dano a quem fica dentro; fora do círculo, nada
await G("(g.level.strike(g.body.x + 20, g.body.z), true)");
await sleep(4500);
ok((await G('g.hearts')) === 3, 'raio que cai longe não machuca');
await G("(g.level.strike(g.body.x, g.body.z), true)");
ok(await until('g.hearts === 2', 30000), 'raio que cai sobre Marieta tira um coração');
await until("document.getElementById('fade').classList.contains('on') === false", 5000);
// Vento: empurra no aberto, não debaixo de uma folha
await tp(0, 0, -40); await sleep(500);
const x0 = await G('g.body.x');
await G('(g.level.gust(1, 0), true)'); await sleep(3200);
const dxOpen = (await G('g.body.x')) - x0;
ok(dxOpen > 2.5, `rajada empurra Marieta no aberto (${dxOpen.toFixed(1)} u)`);
await tp(-16, 0, -60); await sleep(500);
const y0 = await G('g.body.x');
await G('(g.level.gust(1, 0), true)'); await sleep(3200);
const dxCover = (await G('g.body.x')) - y0;
ok(dxCover < 0.5, `sob a folha, a rajada não a empurra (${dxCover.toFixed(1)} u)`);
const lv = await G("g.level.pickups.filter(p => p.def.kind === 'leaf').map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < lv.length; i++) { const [x, y, z] = lv[i]; await tp(x, y, z); await until(`g.inventory.count('leaf') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('leaf')")) === 3, 'juntou 3 folhas firmes');
await tp(0, 0, 4.5); await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.keyboard.press('e');
ok(await until('g.level.raftBuilt'), 'jangada construída com Beto');
await sleep(2500);
await page.screenshot({ path: OUT + '24-fase5-jangada.png' });
await tp(0, 0, 1);
await page.keyboard.down('Shift'); await page.keyboard.down('w');
ok(await until("g.quests.currentObjective('tempestade')?.id === 'zuzu'", 60000), 'atravessa a enchente a pé pela jangada');
await page.keyboard.up('w'); await page.keyboard.up('Shift');
ok((await G('g.hearts')) === 2, 'chegou à colina sem se machucar na travessia');
await talk(7, 52);
ok(await waitState('complete'), 'falar com Zuzu conclui a Fase 5');
await page.screenshot({ path: OUT + '25-fase5-vitoria.png' });
ok(await page.isVisible('#complete-next'), 'Fase 5 concluída oferece a Fase 6');

console.log('7e. Fase 6 — O Vale das Flores');
await page.click('#complete-next');
ok(await waitState('playing'), 'Próxima fase inicia a Fase 6');
ok((await G('g.level.info.id')) === 6, 'Fase 6 carregada');
await prep();
await G('(g.bird.nextAt = 1e9, true)');
await talk(8, -79);
ok(await until("g.quests.currentObjective('vale')?.id === 'flores'", 10000), 'Rita pede as flores raras');
await page.screenshot({ path: OUT + '26-fase6-rita.png' });
// Corrente de ar: entra no ar na coluna de pólen e é levada para cima; com A, pousa sobre a flor gigante
await tp(-16.5, 3, -58);
ok(await until('g.body.y > 11', 30000), 'a corrente de ar levanta Marieta acima da altura da flor');
await page.keyboard.down('a');
ok(await until('g.body.grounded && g.body.y > 8 && g.body.x < -19', 60000), 'depois, Marieta pousa no topo da flor gigante');
await page.keyboard.up('a');
await page.screenshot({ path: OUT + '27-fase6-flor-gigante.png' });
const flowers = await G("g.level.pickups.filter(p => p.def.kind === 'flower').map(p => [p.def.x, p.def.y, p.def.z])");
for (let i = 0; i < flowers.length; i++) { const [x, y, z] = flowers[i]; await tp(x, y, z); await until(`g.inventory.count('flower') >= ${i + 1}`, 8000); }
ok((await G("g.inventory.count('flower')")) === 4, 'coletou as 4 flores raras');
ok((await G("g.quests.currentObjective('vale').id")) === 'jardim', 'objetivo: replantar o jardim');
await tp(0, 0, 43.5); await until("!document.getElementById('prompt').classList.contains('hidden')");
await page.keyboard.press('e');
ok(await until('g.level.gate.open'), 'jardim replantado: o vale floresce e o caminho se abre');
await sleep(3000);
await page.screenshot({ path: OUT + '28-fase6-jardim.png' });
await tp(0, 0, 80);
ok(await until("g.quests.currentObjective('vale')?.id === 'freddy'", 15000), 'chegou ao mirante');
await talk(0, 86);
ok(await waitState('complete'), 'falar com Freddy conclui a Fase 6');
await page.screenshot({ path: OUT + '29-fase6-vitoria.png' });
ok(await page.isVisible('#complete-next'), 'Fase 6 concluída oferece a Fase 7 (as Fases 7 e 8 têm teste próprio: e2e/phase.mjs)');

console.log('8. Rio: correnteza, resgate e coração');
await page.click('#complete-menu');
ok(await waitState('menu'), 'volta ao menu');
ok((await page.locator('.phase:not(.locked)').count()) === 7, 'seleção de fases mostra 7 fases liberadas (a 7ª liberada ao concluir a 6ª)');
page.once('dialog', (d) => d.accept());
await page.locator('.phase').nth(1).click();
ok(await waitState('playing'), 'iniciar a Fase 2 pela seleção');
await prep();
await G('(g.bird.nextAt = 1e9, true)');
await tp(0, 0, 10);
ok(await waitState('dialogue', 30000), 'primeira queda no rio: Beto resgata Marieta (diálogo)');
ok(Math.hypot((await G('g.body.x')) - 9, (await G('g.body.z')) - 42) < 3, 'resgatada na outra margem, perto do Beto');
ok((await G('g.hearts')) === 3, 'o resgate não custa coração');
await finishDialogue();
await waitState('playing');
await page.screenshot({ path: OUT + '15-fase2-resgate.png' });
await tp(0, 0, 10);
ok(await until('g.hearts === 2', 30000), 'segunda vez na água: a correnteza leva e custa um coração');

ok(errors.filter((e) => !/GPU stall|ReadPixels|WebGL: INVALID|swiftshader/i.test(e)).length === 0, `sem erros de console (${errors.length ? errors.slice(0, 3).join(' | ') : 'ok'})`);
await browser.close();
console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failed ? 1 : 0);
