import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const seguir = async (pg) => { await pg.waitForTimeout(60); if (await pg.locator('.festa-quiz-pop').count()) { await pg.click('.festa-quiz-pop'); await pg.waitForTimeout(320); } else { await pg.click('#proxima'); await pg.waitForTimeout(60); } };
const b = await chromium.launch();
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const erros = [];
async function pagina(vp, extra = {}) {
  const p = await b.newPage({ viewport: vp, reducedMotion: 'reduce', ...extra });
  p.on('pageerror', e => erros.push(e.message)); p.on('console', m => m.type()==='error' && !/fonts|ERR_TUNNEL/.test(m.text()) && erros.push(m.text()));
  await p.goto(BASE + '/show-do-dadao.html'); await p.waitForTimeout(500);
  return p;
}
const certa = (p) => p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
async function responder(p, i) {
  await p.locator('#alternativas .alternativa').nth(i).click();
  await p.click('#confirmar'); await p.waitForTimeout(150);
}
// 1. campeao
let p = await pagina({ width: 1280, height: 900 });
ok(await p.locator('#inicio-carta .carta').count() === 1, 'carta de previa no inicio');
await p.screenshot({ path: `testes/resultados/quiz-inicio.png` });
await p.fill('#nome', 'Breno'); await p.click('[data-pos="M"]'); await p.click('button[type=submit]');
ok(await p.locator('#alternativas .alternativa').count() === 4, '4 alternativas');
ok(await p.locator('#pergunta-nivel').isHidden(), 'sem rotulo de nivel');
for (let n = 1; n <= 16; n++) {
  if (n === 7) await p.screenshot({ path: `testes/resultados/quiz-jogo.png` });
  if (n === 16) { await p.screenshot({ path: `testes/resultados/quiz-final.png` }); ok(await p.locator('#ajuda-cartas').isDisabled(), 'final sem ajuda'); }
  const nv = await p.evaluate(() => Q.pergunta.n);
  const esperado = n <= 3 ? 'f' : n <= 8 ? 'm' : n <= 15 ? 'd' : 'p';
  if (nv !== esperado) ok(false, `nivel da pergunta ${n}: ${nv}`);
  await responder(p, await certa(p));
  if (n < 16) { await seguir(p); }
}
await p.waitForTimeout(6800);
ok(!(await p.locator('#tela-fim').isHidden()) && (await p.textContent('#fim-titulo')) === 'Prateleira Rei Pelé!', 'campeao chega no Nivel Pele');
ok((await p.textContent('#fim-carta .carta-nota strong')) === '99', 'carta 99');
await p.screenshot({ path: `testes/resultados/quiz-campeao.png` });
// 2. ajudas + errar na 8 (degrau 7 -> valor 20 -> metade 10 -> degrau 6)
await p.click('#de-novo');
const trio1 = await p.evaluate(() => Q.boys.join());
for (let n = 1; n <= 7; n++) {
  if (n === 2) {
    await p.click('#ajuda-cartas'); await p.locator('.carta-baralho').first().click(); await p.waitForTimeout(100);
    const elim = await p.evaluate(() => [...Q.eliminadas].every(i => !Q.opcoes[i].certa));
    ok(elim, 'cartas nunca eliminam a certa');
    await p.screenshot({ path: `testes/resultados/quiz-cartas.png` });
  }
  if (n === 3) { await p.click('#ajuda-boys'); ok(await p.locator('.avatar-boy').count() === 3, '3 golden boys nas alternativas'); await p.screenshot({ path: `testes/resultados/quiz-boys.png` }); }
  if (n === 6) { await p.click('#ajuda-enciclopedia'); const c = await certa(p); ok(await p.locator('.alternativa').nth(c).locator('.selo-enciclopedia').count() === 1, 'enciclopedia marca a certa'); await p.screenshot({ path: `testes/resultados/quiz-enc.png` }); }
  if (n === 4) { await p.click('#ajuda-arquibancada'); const s = await p.$$eval('.alternativa .voto', xs => xs.reduce((a, x) => a + parseInt(x.textContent), 0)); ok(s === 100, 'arquibancada soma 100'); await p.screenshot({ path: `testes/resultados/quiz-arquibancada.png` }); }
  if (n === 5) { const antes = await p.evaluate(() => Q.pergunta.id); await p.click('#ajuda-pular'); const depois = await p.evaluate(() => Q.pergunta.id); ok(antes !== depois && (await p.textContent('#pulos-restantes')) === '2', 'pular troca a pergunta'); }
  await responder(p, await certa(p)); await seguir(p);
}
ok((await p.textContent('#valor-errar')).startsWith('Série D'), 'errar na 8 cai pra Serie D: ' + await p.textContent('#valor-errar'));
const c = await certa(p); await responder(p, (c + 1) % 4); await seguir(p); await p.waitForTimeout(300);
ok((await p.textContent('#fim-titulo')).includes('Errou a pergunta 8'), 'errou na 8');
ok((await p.textContent('#fim-carta .carta-nota strong')) === '65', 'carta caiu pra 65');
await p.screenshot({ path: `testes/resultados/quiz-errou.png` });
// 3. parar
await p.click('#de-novo');
const trio2 = await p.evaluate(() => Q.boys.join()); ok(trio1 !== trio2, 'golden boys mudam: ' + trio2);
await responder(p, await certa(p)); await seguir(p);
await p.click('#parar'); await p.click('text=Parar e levar'); await p.waitForTimeout(200);
ok((await p.textContent('#fim-texto')).includes('Várzea'), 'parar leva a carta atual');
// 4. mobile
const m = await pagina({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
await m.screenshot({ path: `testes/resultados/quiz-m-inicio.png`, fullPage: true });
await m.click('button[type=submit]');
await m.screenshot({ path: `testes/resultados/quiz-m-jogo.png`, fullPage: true });
ok(await m.evaluate(() => document.documentElement.scrollWidth <= 390), 'sem scroll lateral no celular');
await m.click('.aba-mobile:nth-child(2)'); await m.waitForTimeout(100);
await m.screenshot({ path: `testes/resultados/quiz-m-escada.png`, fullPage: true });
// 5. home
const h = await b.newPage({ viewport: { width: 1280, height: 900 } });
h.on('pageerror', e => erros.push(e.message));
await h.goto(BASE + '/'); await h.waitForTimeout(1500);
ok(await h.locator('#visual-quiz .dadao').count() === 1, 'home: card do quiz com o Dadão');
await h.screenshot({ path: `testes/resultados/quiz-home.png` });
await h.setViewportSize({ width: 390, height: 844 }); await h.waitForTimeout(300);
await h.screenshot({ path: `testes/resultados/quiz-home-m.png` });
ok(erros.length === 0, 'sem erro de JS ' + JSON.stringify(erros));
await b.close();
