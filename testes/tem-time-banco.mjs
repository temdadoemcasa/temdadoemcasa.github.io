// Tem Time em Casa: reserva troca com titular (no meio do draft e no resumo), so onde
// os dois cabem; o resumo nao mostra mais as chances simuladas. Rode com o site em BASE.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/tem-time-em-casa.html'); await p.waitForTimeout(1500);
await p.click('#comecar-draft'); await p.waitForTimeout(400);

// monta o onze e ate a 2a reserva pela tela (toca na 1a carta de cada leque)
const feitas = () => p.evaluate(() => todasVagas().filter((s) => s.jogador).length);
for (let i = 0; i < 40 && (await feitas()) < 13; i++) { await p.locator('.opcao').first().click(); await p.waitForTimeout(380); }
ok(await feitas() === 13 && await p.evaluate(() => D.vaga >= D.onze.length), 'draft no banco: onze completo e 2 reservas');

// a reserva com jogador agora e clicavel e marca so titulares onde ela cabe (e que cabem na vaga dela)
const doBanco = await p.evaluate(() => D.banco.findIndex((s) => s.jogador));
const idxBanco = await p.evaluate((k) => D.onze.length + k, doBanco);
const esperado = await p.evaluate((idx) => {
  const r = todasVagas()[idx];
  return D.onze.map((s, i) => i).filter((i) => cabeNoSlot(r.jogador, D.onze[i].pos) && cabeNoSlot(D.onze[i].jogador, r.pos));
}, idxBanco);
await p.locator('#tela-draft .banco-vaga.vaga-cheia').nth(0).click();
const marcados = await p.evaluate(() => [...document.querySelectorAll('#gramado .vaga')].map((v, i) => (v.classList.contains('vaga-destino') ? i : -1)).filter((i) => i >= 0));
ok(await p.evaluate(() => D.movendo) === idxBanco, 'tocar na reserva escolhe ela pra trocar');
ok(esperado.length > 0 && JSON.stringify(marcados) === JSON.stringify(esperado), `gramado marca os titulares possiveis (${marcados.join(',')})`);
ok(await p.locator('#tela-draft .banco-vaga.vaga-destino').count() === 0, 'reserva nao troca com reserva (na tela)');
ok(await p.evaluate(() => D.banco.every((s, k) => !s.jogador || destinosDe(D.onze.length + k).every((i) => i < D.onze.length))), 'reserva nao troca com reserva (nenhuma reserva tem destino no banco)');
ok(/entra no lugar de quem/i.test(await p.textContent('#draft-aviso')), 'aviso explica a troca');

// troca: titular vai pro banco, reserva entra; o draft continua na mesma reserva vazia
const antes = await p.evaluate(({ idx, alvo }) => ({ res: todasVagas()[idx].jogador.player_id, tit: D.onze[alvo].jogador.player_id, vaga: D.vaga }), { idx: idxBanco, alvo: esperado[0] });
await p.locator('#gramado .vaga').nth(esperado[0]).click(); await p.waitForTimeout(200);
const depois = await p.evaluate(({ idx, alvo }) => ({ res: todasVagas()[idx].jogador.player_id, tit: D.onze[alvo].jogador.player_id, vaga: D.vaga, mov: D.movendo }), { idx: idxBanco, alvo: esperado[0] });
ok(depois.tit === antes.res && depois.res === antes.tit, 'reserva entra no onze e o titular vai pro banco');
ok(depois.vaga === antes.vaga && depois.mov == null, 'o draft segue na mesma reserva vazia');
const todos = await p.evaluate(() => todasVagas().filter((s) => s.jogador).map((s) => s.jogador.player_id));
ok(new Set(todos).size === todos.length && todos.length === 13, 'ninguem duplicado nem perdido');

// cancelar: toca na reserva e de novo nela
await p.locator('#tela-draft .banco-vaga.vaga-cheia').nth(0).click();
await p.locator('#tela-draft .banco-vaga.vaga-cheia').nth(0).click();
ok(await p.evaluate(() => D.movendo == null), 'tocar de novo cancela');

// termina o draft e troca no resumo (sem rolar pro topo)
for (let i = 0; i < 20 && !(await p.locator('#comecar-temporada').isVisible()); i++) { await p.locator('.opcao').first().click(); await p.waitForTimeout(380); }
ok(await p.locator('#tela-resumo').isVisible(), 'resumo aberto');
const resumoTxt = await p.textContent('#tela-resumo');
ok(!/temporadas simuladas|G6 \d+%|campeão brasileiro \d+%/.test(resumoTxt), 'resumo sem as chances simuladas');
ok(/reserva pra colocar ele no lugar de um titular/.test(await p.textContent('.resumo-aviso')), 'resumo explica a troca com o banco');
const par = await p.evaluate(() => {
  for (let k = 0; k < D.banco.length; k++) {
    const idx = D.onze.length + k; const d = destinosDe(idx).filter((i) => i < D.onze.length);
    if (d.length) return { k, idx, alvo: d[0] };
  }
  return null;
});
ok(!!par, 'alguma reserva cabe em algum titular no resumo');
if (par) {
  // rolagem instantanea: com a suave, o scrollY lido na hora ainda e 0 e o teste acusava falso
  await p.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' })); await p.waitForTimeout(100);
  const y0 = await p.evaluate(() => scrollY);
  const a0 = await p.evaluate(({ idx, alvo }) => [todasVagas()[idx].jogador.player_id, D.onze[alvo].jogador.player_id], par);
  // clique pelo DOM: o click do Playwright rola a pagina ate o alvo e mascararia a rolagem do jogo
  await p.locator('#tela-resumo .banco-vaga').nth(par.k).evaluate((e) => e.click()); await p.waitForTimeout(150);
  ok(await p.locator('#tela-resumo .gramado-resumo .vaga.vaga-destino').count() >= 1, 'resumo marca os titulares possiveis');
  await p.locator('#tela-resumo .gramado-resumo .vaga').nth(par.alvo).evaluate((e) => e.click()); await p.waitForTimeout(250);
  const a1 = await p.evaluate(({ idx, alvo }) => [todasVagas()[idx].jogador.player_id, D.onze[alvo].jogador.player_id], par);
  ok(a1[0] === a0[1] && a1[1] === a0[0], 'troca no resumo: reserva e titular trocam');
  ok(Math.abs(await p.evaluate(() => scrollY) - y0) < 5, 'trocar no resumo nao joga a pagina pro topo');
  ok(await p.locator('#tela-resumo').isVisible() && await p.locator('#comecar-temporada').isVisible(), 'continua no resumo, pronto pra comecar');
}
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
await b.close();
