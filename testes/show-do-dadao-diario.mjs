// Desafio do dia: duas pessoas (navegadores separados) recebem as mesmas perguntas,
// na mesma ordem de alternativas, inclusive depois de pular; uma tentativa por dia;
// o compartilhar sai em quadradinhos.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
const erros = [];
async function jogo(ctx, errarEm) {
  const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.goto(BASE + '/show-do-dadao.html'); await p.waitForTimeout(300);
  await p.click('#diario'); await p.waitForTimeout(200);
  const qs = [];
  for (let n = 1; n <= 16; n++) {
    qs.push(await p.evaluate(() => Q.pergunta.id + ':' + Q.opcoes.map(o => o.texto).join('|')));
    if (n === 3) { await p.click('#ajuda-pular'); qs.push('pulo:' + await p.evaluate(() => Q.pergunta.id)); }
    const c = await p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
    const i = n === errarEm ? (c + 1) % 4 : c;
    await p.locator('.alternativa').nth(i).click(); await p.waitForTimeout(320); await p.locator('.alternativa').nth(i).click();
    await p.waitForTimeout(1300);
    if (n === errarEm) { await p.click('#proxima'); break; }
    await p.waitForTimeout(n < 16 ? 100 : 600);
    if (await p.locator('.festa-quiz-pop').count()) await p.click('.festa-quiz-pop');
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(400);
  return { p, qs };
}
const ctx = () => b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const a = await jogo(await ctx(), 9), c = await jogo(await ctx(), 99);
ok(JSON.stringify(a.qs.slice(0, 10)) === JSON.stringify(c.qs.slice(0, 10)), 'mesmas perguntas e alternativas pros dois (com pulo)');
const ta = await a.p.evaluate(() => Q.textoCompartilhar), tc = await c.p.evaluate(() => Q.textoCompartilhar);
ok(/Desafio #\d+/.test(ta) && (ta.match(/🟩/g) || []).length === 8 && (ta.match(/🟥/g) || []).length === 1 && (ta.match(/⬜/g) || []).length === 7, 'grade de quem errou a 9ª');
ok((tc.match(/🟩/g) || []).length === 16 && tc.includes('Rei Pelé'), 'grade de quem zerou');
await a.p.click('#trocar'); await a.p.waitForTimeout(200);
ok((await a.p.locator('#diario').innerText()).includes('Já jogou hoje'), 'botão avisa que já jogou');
await a.p.click('#diario'); await a.p.waitForTimeout(300);
ok(await a.p.locator('#tela-fim').isVisible() && (await a.p.locator('#fim-grade').innerText()).includes('🟥'), 'segunda vez só mostra o resultado');
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
await b.close();
