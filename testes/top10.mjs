// Top 10 em Casa: fluxo. Rode com o site servido em BASE.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch(); const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/top10-em-casa.html'); await p.waitForSelector('#form-inicio:not([hidden])');
const titulo = await p.textContent('#card-dia');
ok(titulo && !/undefined|null|NaN/.test(titulo), `card do dia mostra o ranking: ${titulo?.trim().slice(0, 60)}`);
const a = await p.evaluate(() => rankingDoDia('2026-10-05').id), a2 = await p.evaluate(() => rankingDoDia('2026-10-05').id), c = await p.evaluate(() => rankingDoDia('2026-10-06').id);
ok(a === a2, 'mesmo dia, mesmo ranking'); ok(a !== c, 'dia seguinte, outro ranking');
await p.click('#jogar-dia'); await p.waitForSelector('#tela-jogo:not([hidden])');
const nomes = await p.evaluate(() => T.ranking.top.map((i) => i.nome)), barras = await p.textContent('#barras');
ok(await p.locator('.barra.aberta').count() === 0, 'barras comecam fechadas'); ok(nomes.length === 10 && nomes.every((n) => !barras.includes(n)), 'nenhum nome do ranking aparece antes do chute');
const tj = await p.textContent('#tela-jogo'); ok(!/undefined|null|NaN/.test(tj), 'tela do jogo sem undefined/null/NaN');
ok(await p.locator('.barra').count() === 10, '10 barras'); ok(await p.locator('.vida.cheia').count() === 3, '3 vidas');
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));

// --- Task 6: a partida ---
const r = await p.evaluate(() => ({ top: T.ranking.top, quase: T.ranking.quase }));
// acerto abre a barra DA POSICAO do jogador
const alvo = r.top[3];
ok(await p.evaluate((id) => chutar(id), alvo.player_id) === 'acerto', 'acerto');
const barra = await p.locator('.barra').nth(3).textContent();
ok(barra.includes(alvo.nome) && barra.includes(String(alvo.valor)), 'barra certa com nome e valor');
ok(await p.evaluate((id) => chutar(id), alvo.player_id) === 'repetido', 'repetido nao custa vida');
ok(await p.locator('.vida.cheia').count() === 3, 'ainda 3 vidas');
// quase: mostra a posicao e o numero
ok(await p.evaluate((id) => chutar(id), r.quase[2].player_id) === 'quase', 'quase');
const aviso = await p.textContent('#aviso');
ok(aviso.includes(`${r.quase[2].pos}º`) && aviso.includes(String(r.quase[2].valor)), `aviso do quase: ${aviso}`);
// recarregar no meio do diario mantem acertos e vidas
await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])'); await p.click('#jogar-dia'); await p.waitForSelector('#tela-jogo:not([hidden])');
ok(await p.locator('.vida.cheia').count() === 2 && (await p.locator('.barra.aberta').count()) === 1, 'recarregar mantem o progresso');
// fora: sem numero inventado
const fora = await p.evaluate(() => { const no = new Set([...T.ranking.top, ...T.ranking.quase].map((x) => x.player_id)); return T.opcoes.find((o) => !no.has(o.id)).id; });
ok(await p.evaluate((id) => chutar(id), fora) === 'fora', 'fora');
ok(/fora do top 20/i.test(await p.textContent('#aviso')), 'aviso do fora sem numero');
// terceira vida acaba e revela tudo
await p.evaluate((id) => chutar(id), await p.evaluate(() => { const no = new Set([...T.ranking.top, ...T.ranking.quase].map((x) => x.player_id)); return T.opcoes.filter((o) => !no.has(o.id))[1].id; }));
await p.waitForSelector('#tela-fim:not([hidden])');
ok(await p.locator('.barra.aberta, .barra.revelada').count() === 10, 'fim revela as 10');
const placar = await p.textContent('#placar'); ok(/1\s*\/\s*10/.test(placar), `placar ${placar}`);
const txt = await p.evaluate(() => textoCompartilhar());
ok(/🟩/.test(txt) && /top10-em-casa\.html/.test(txt) && !/undefined|null|NaN/.test(txt), 'compartilhar coerente');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('top10:v1')).serie.ultimo) === await p.evaluate(() => hojeLocal()), 'serie registra o dia');
// o diario terminado nao reabre pra jogar de novo
await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])'); await p.click('#jogar-dia'); await p.waitForSelector('#tela-jogo:not([hidden])');
ok(await p.locator('#tela-fim:not([hidden])').count() === 1 && await p.locator('.vida.cheia').count() === 0, 'diario terminado volta no fim');
// localStorage corrompido
await p.evaluate(() => localStorage.setItem('top10:v1', '{quebrado'));
await p.reload();
const abriu = await p.waitForSelector('#form-inicio:not([hidden])', { timeout: 3000 }).then(() => true, () => false);
ok(abriu && (await p.textContent('#serie')).trim().length > 0 && await p.locator('#jogar-dia').isEnabled(), 'abre com storage corrompido');
await p.click('#jogar-dia').catch(() => {}); await p.waitForSelector('#tela-jogo:not([hidden])', { timeout: 3000 }).catch(() => {});
ok(await p.locator('#tela-jogo:not([hidden])').count() === 1 && await p.locator('.vida.cheia').count() === 3, 'joga com storage corrompido');
// homonimos: o chute e por id
const homonimo = await p.evaluate(() => { const vistos = new Map(); for (const o of T.opcoes) { const k = o.nome; if (vistos.has(k)) return [vistos.get(k), o.id]; vistos.set(k, o.id); } return null; });
ok(homonimo === null || homonimo[0] !== homonimo[1], 'homonimos tem ids distintos nas opcoes');
ok(!erros.length, 'sem erro de JS na partida ' + erros.join(' | '));

// 10/10 no livre: frase, placar e confete (so sem reduced-motion)
for (const [rm, esperaFesta] of [['no-preference', 1], ['reduce', 0]]) {
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm });
  const q = await c2.newPage(); await q.goto(BASE + '/top10-em-casa.html'); await q.waitForSelector('#form-inicio:not([hidden])');
  await q.click('#jogar-livre'); await q.waitForSelector('#tela-jogo:not([hidden])');
  await q.evaluate(() => { for (const t of T.ranking.top) chutar(t.player_id); });
  await q.waitForSelector('#tela-fim:not([hidden])');
  ok(/10\s*\/\s*10/.test(await q.textContent('#placar')) && (await q.textContent('#frase')).trim().length > 0, `10/10 com frase (${rm})`);
  ok(await q.locator('.festa i').count() === (esperaFesta ? 12 : 0), `confete ${esperaFesta ? 'aparece' : 'ausente'} com ${rm}`);
  ok(!/#\d/.test(await q.evaluate(() => textoCompartilhar())), 'livre: compartilhar sem numero do dia');
  await c2.close();
}
await b.close();
