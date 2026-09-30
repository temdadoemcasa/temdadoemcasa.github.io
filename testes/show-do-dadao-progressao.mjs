import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const seguir = async (pg) => { await pg.waitForTimeout(60); if (await pg.locator('.festa-quiz-pop').count()) { await pg.click('.festa-quiz-pop'); await pg.waitForTimeout(320); } else { await pg.click('#proxima'); await pg.waitForTimeout(60); } };
const b = await chromium.launch(); const p = await b.newPage({ reducedMotion: 'reduce' });
await p.goto(BASE + '/show-do-dadao.html'); await p.click('button[type=submit]');
const notas = [];
for (let n = 1; n <= 16; n++) {
  notas.push(await p.evaluate(() => Q.pergunta.s));
  const c = await p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
  await p.locator('.alternativa').nth(c).click(); await p.click('#confirmar'); await p.waitForTimeout(60);
  if (n < 16) await seguir(p);
}
const sobe = notas.every((v, i) => i === 0 || v >= notas[i - 1]);
console.log(sobe ? 'OK  ' : 'FALHA', 'dificuldade sempre sobe ou mantém:', notas.join(' '));
console.log(notas[15] === 10 ? 'OK  ' : 'FALHA', 'a pergunta final é nota 10');
await b.close();
