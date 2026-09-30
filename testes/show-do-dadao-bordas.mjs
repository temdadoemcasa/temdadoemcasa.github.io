import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const seguir = async (pg) => { await pg.waitForTimeout(60); if (await pg.locator('.festa-quiz-pop').count()) { await pg.click('.festa-quiz-pop'); await pg.waitForTimeout(320); } else { await pg.click('#proxima'); await pg.waitForTimeout(60); } };
const b = await chromium.launch();
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.goto(BASE + '/show-do-dadao.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.click('button[type=submit]');
// pular 3x
const ids = [await p.evaluate(() => Q.pergunta.id)];
for (let i = 0; i < 3; i++) { await p.click('#ajuda-pular'); ids.push(await p.evaluate(() => Q.pergunta.id)); }
ok(new Set(ids).size === 4, 'pular 3x traz 3 perguntas novas');
ok(await p.locator('#ajuda-pular').isDisabled(), 'pular trava depois de 3');
ok((await p.textContent('#pergunta-numero')).includes('1 de 16'), 'pular não avança o número');
// ajuda aberta some ao pular? usar arquibancada e responder
await p.click('#ajuda-arquibancada');
ok(await p.locator('.alternativa .voto').count() > 0, 'arquibancada aparece nas alternativas');
// double confirm
let c = await p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
await p.locator('.alternativa').nth(c).click();
await p.evaluate(() => { confirmar(); confirmar(); });
await p.waitForTimeout(100);
ok((await p.evaluate(() => Q.historico.length)) === 1, 'duplo confirmar registra uma vez');
ok(await p.locator('#retorno').evaluate(n => n.classList.contains('ativa')), 'resultado no palco depois de responder');
await seguir(p);
ok(await p.locator('.alternativa .voto').count() === 0, 'pergunta nova sem ajuda antiga');
// pensar mais
c = await p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
await p.locator('.alternativa').nth((c + 1) % 4).click(); await p.keyboard.press('Escape');
ok(await p.evaluate(() => Q.escolhida === null) && !(await p.locator('#ajuda-cartas').isDisabled()), 'pensar mais libera as ajudas');
// ajuda com escolha pendente fica travada
await p.locator('.alternativa').nth(c).click();
ok(!(await p.locator('#ajuda-boys').isDisabled()) && await p.locator('.toque-de-novo').count() === 1, 'check aparece na alternativa e ajudas seguem livres');
await p.keyboard.press('Escape');
// cartas: nao pode clicar em alternativa enquanto escolhe carta
await p.click('#ajuda-cartas');
await p.locator('.alternativa').nth(c).click();
ok(await p.evaluate(() => Q.escolhida === null), 'não escolhe alternativa enquanto vira carta');
await p.locator('.carta-baralho').first().click(); await p.waitForTimeout(50);
// eliminada nao clica
const elim = await p.evaluate(() => [...Q.eliminadas]);
if (elim.length) { await p.locator('.alternativa').nth(elim[0]).click({ force: true }); ok(await p.evaluate(() => Q.escolhida === null), 'alternativa eliminada não escolhe'); }
// aba sua carta
await p.click('.aba-mobile:nth-child(2)'); await p.waitForTimeout(50);
ok(await p.locator('#quiz-carta .carta').isVisible() && !(await p.locator('#enunciado').isVisible()), 'aba Sua carta mostra a carta e esconde a pergunta');
await p.click('.aba-mobile:nth-child(1)');
// ir ate a final
for (let n = 2; n <= 15; n++) { c = await p.evaluate(() => Q.opcoes.findIndex(o => o.certa)); await p.locator('.alternativa').nth(c).click(); await p.click('#confirmar'); await seguir(p); }
ok((await p.textContent('#pergunta-numero')) === 'Pergunta final', 'chega na final');
ok((await p.textContent('#ajuda-linha')).includes('sem ajuda'), 'aviso da final');
for (const id of ['#ajuda-cartas', '#ajuda-boys', '#ajuda-arquibancada', '#ajuda-enciclopedia', '#ajuda-pular']) if (!(await p.locator(id).isDisabled())) ok(false, id + ' ativo na final');
ok((await p.textContent('#valor-parar')).includes('Messi'), 'parar na final leva Messi e CR7');
await p.screenshot({ path: `testes/resultados/ux-final-m.png` });
// para na final
await p.click('#parar'); await p.click('#parar-sim');
ok((await p.textContent('#fim-texto')).includes('Messi e CR7'), 'parou na final com 92');
// teclado desktop
const d = await b.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
d.on('pageerror', e => erros.push(e.message));
await d.goto(BASE + '/show-do-dadao.html'); await d.click('button[type=submit]');
c = await d.evaluate(() => Q.opcoes.findIndex(o => o.certa));
await d.keyboard.press(['a', 'b', 'c', 'd'][(c + 1) % 4]);
await d.keyboard.press('Escape');
ok(await d.evaluate(() => Q.escolhida === null), 'Esc desiste');
await d.keyboard.press(['a', 'b', 'c', 'd'][c]); await d.keyboard.press('Enter'); await d.waitForTimeout(80);
ok(await d.locator('#retorno').evaluate(n => n.classList.contains('ativa')), 'Enter confirma');
await d.waitForTimeout(6800);
ok((await d.textContent('#pergunta-numero')).includes('2 de 16'), 'próxima entra sozinha depois da espera');
// digitar no nome nao escolhe alternativa
ok(erros.length === 0, 'sem erro JS ' + erros.join('|'));
await b.close();
