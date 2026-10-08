// Pacote de craque (home, ao lado do campinho): tres cliques abrem UMA carta de craque,
// 78+ do Brasileirão (o 83 de antes da régua da liga, 04/10) ou 83+ da Europa; com
// minutos de régua, um por jogador.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
const erros = [];
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/index.html');
await p.waitForSelector('#palco-craque .envelope', { timeout: 60000 });
const pool = await p.evaluate(async () => (await poolDeCraques()).map(({ j, r }) => ({ id: j.player_id, ovr: j.overall, min: j.minutos, piso: r.piso_minutos, liga: r.populacao })));
ok(pool.length > 50 && pool.every((c) => c.ovr >= (c.liga === 'Brasileirão' ? 78 : 83)), `pool só com craque: 78+ no Brasileirão, 83+ na Europa (${pool.length} cartas)`);
ok(pool.every((c) => c.min >= c.piso), 'pool só com quem passou do piso de minutos da liga');
ok(new Set(pool.map((c) => c.id)).size === pool.length, 'um craque aparece uma vez só');
ok(pool.some((c) => c.liga === 'Brasileirão') && pool.some((c) => c.liga !== 'Brasileirão'), 'pool tem Brasileirão e Europa');
for (let i = 0; i < 2; i++) await p.click('#palco-craque .envelope');
ok(!(await p.$('#palco-craque .carta')), 'dois cliques ainda não abrem');
await p.click('#palco-craque .envelope');
await p.waitForSelector('#palco-craque .carta', { timeout: 15000 });
const ovr = Number(await p.textContent('#palco-craque .carta-nota strong'));
ok(ovr >= 78, `terceiro clique abre um craque (${ovr})`);
ok(/só craque: \d+ do Brasileirão \(78\+\) e \d+ da Europa \(83\+\)/i.test(await p.textContent('#craque-chances')), 'as chances aparecem escritas');
await p.waitForSelector('#craque-outro:not([hidden])', { timeout: 5000 });
await p.click('#craque-outro');
ok(await p.$('#palco-craque .envelope') !== null, '"Abrir outro pacote" traz um pacote novo');
const p2 = await b.newPage({ viewport: { width: 375, height: 667 } });
await p2.goto(BASE + '/index.html'); await p2.waitForSelector('#palco-craque .envelope', { timeout: 60000 });
const larg = await p2.evaluate(() => document.documentElement.scrollWidth);
ok(larg <= 375, `celular sem rolagem lateral (${larg})`);
ok(erros.length === 0, `sem erro de JS (${erros.join(' | ')})`);
await b.close();
