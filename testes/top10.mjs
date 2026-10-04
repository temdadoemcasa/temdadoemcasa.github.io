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
await b.close();
