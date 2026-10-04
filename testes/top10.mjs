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

// --- fix round: homonimos, empate no top, sequencia ---
const abrir = async (modo, semente) => {
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const q = await cx.newPage(); q.on('pageerror', (e) => erros.push(e.message));
  await q.goto(BASE + '/top10-em-casa.html'); await q.waitForSelector('#form-inicio:not([hidden])');
  if (semente) { await q.evaluate(semente); await q.reload(); await q.waitForSelector('#form-inicio:not([hidden])'); }
  await q.click(modo); await q.waitForSelector('#tela-jogo:not([hidden])');
  return [cx, q];
};
// homonimos: dois jogadores com o mesmo nome, so um no top; o chute e por id
{
  const [cx, q] = await abrir('#jogar-livre');
  await q.evaluate(() => {
    T.ranking.top[5].player_id = 9000001; T.ranking.top[5].nome = 'Fulano Homonimo';
    T.opcoes.push({ id: 9000001, nome: 'Fulano Homonimo', nome_completo: 'Fulano A', clube: 'X' }, { id: 9000002, nome: 'Fulano Homonimo', nome_completo: 'Fulano B', clube: 'Y' });
  });
  const f = await q.evaluate(() => chutar(9000002));
  ok(f !== 'acerto' && await q.locator('.barra.aberta').count() === 0, `homonimo fora do top nao abre barra (${f})`);
  ok(await q.evaluate(() => chutar(9000001)) === 'acerto' && await q.locator('.barra.aberta').count() === 1 && (await q.locator('.barra').nth(5).textContent()).includes('Fulano Homonimo'), 'homonimo do top abre so a barra dele');
  await cx.close();
}
// empate no top: a barra aberta e a do indice do jogador, nao a primeira da mesma posicao
{
  const [cx, q] = await abrir('#jogar-livre');
  const nome3 = await q.evaluate(() => { const t = T.ranking.top; t[2].pos = t[3].pos; t[2].valor = t[3].valor; chutar(t[3].player_id); return t[3].nome; });
  ok((await q.locator('.barra').nth(3).textContent()).includes(nome3) && !(await q.locator('.barra').nth(2).getAttribute('class')).includes('aberta'), 'empate: abre a barra do indice 3, nao a 2');
  await cx.close();
}
// sequencia do diario
const acabarDiario = (acertos) => `(() => { const no = new Set([...T.ranking.top, ...T.ranking.quase].map((x) => x.player_id)); const fora = T.opcoes.filter((o) => !no.has(o.id)); for (let i = 0; i < ${acertos}; i++) chutar(T.ranking.top[i].player_id); for (let i = 0; i < 3; i++) chutar(fora[i].id); })()`;
const semear = (dias, atual, melhor) => `(() => { const d = new Date(); d.setDate(d.getDate() - ${dias}); localStorage.setItem('top10:v1', JSON.stringify({ serie: { atual: ${atual}, melhor: ${melhor}, ultimo: hojeLocal(d) } })); })()`;
const serieDepois = (q) => q.evaluate(() => ({ ...JSON.parse(localStorage.getItem('top10:v1')).serie, hoje: hojeLocal(), ontem: ontemDe(hojeLocal()) }));
{
  let [cx, q] = await abrir('#jogar-dia', semear(1, 2, 5));
  await q.evaluate(acabarDiario(1)); let s = await serieDepois(q);
  ok(s.atual === 3 && s.melhor === 5 && s.ultimo === s.hoje, `ontem + acerto: atual 3, melhor 5 mantido (${JSON.stringify(s)})`);
  await cx.close();
  [cx, q] = await abrir('#jogar-dia', semear(1, 4, 4));
  await q.evaluate(acabarDiario(1)); s = await serieDepois(q);
  ok(s.atual === 5 && s.melhor === 5, 'melhor sobe junto com a sequencia');
  await cx.close();
  [cx, q] = await abrir('#jogar-dia', semear(2, 2, 2));
  await q.evaluate(acabarDiario(1)); s = await serieDepois(q);
  ok(s.atual === 1 && s.ultimo === s.hoje, `anteontem + acerto: recomeca em 1 (${JSON.stringify(s)})`);
  await cx.close();
  [cx, q] = await abrir('#jogar-dia', semear(1, 2, 7));
  const antes = await serieDepois(q);
  await q.evaluate(acabarDiario(0)); s = await serieDepois(q);
  ok(s.atual === 0 && s.melhor === 7 && s.ultimo === antes.ultimo, `0 acertos: atual 0, melhor mantido, ultimo igual (${JSON.stringify(s)})`);
  await cx.close();
  [cx, q] = await abrir('#jogar-dia');
  const m = await q.evaluate(() => [ontemDe('2026-11-01'), ontemDe('2028-03-01'), ontemDe('2027-01-01')]);
  ok(m.join() === '2026-10-31,2028-02-29,2026-12-31', `ontemDe na virada de mes/ano: ${m}`);
  await cx.close();
}
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

// --- revisao final: sorteio por rendezvous, diario jogado, recorte no compartilhar, antes do #1, vistos ---
const comRelogio = async (quando) => {
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await cx.clock.setFixedTime(new Date(quando));
  const q = await cx.newPage(); q.on('pageerror', (e) => erros.push(e.message));
  await q.goto(BASE + '/top10-em-casa.html'); await q.waitForSelector('#form-inicio:not([hidden])');
  return [cx, q];
};
{
  // tirar um ranking que nao e o vencedor nao muda o dia de ninguem (30 dias)
  const [cx, q] = await comRelogio('2026-10-07T12:00:00');
  const r = await q.evaluate(() => {
    const dias = Array.from({ length: 30 }, (_, i) => hojeLocal(new Date(2026, 9, 5 + i)));
    const antes = dias.map((d) => rankingDoDia(d).id);
    const vencedores = new Set(antes);
    const tirado = T.rankings.map((x) => x.id).find((id) => !vencedores.has(id));
    T.rankings = T.rankings.filter((x) => x.id !== tirado);
    const depois = dias.map((d) => rankingDoDia(d).id);
    return { antes, depois, tirado, distintos: vencedores.size };
  });
  ok(r.tirado && r.antes.join() === r.depois.join(), `tirar ${r.tirado} nao muda nenhum dos 30 dias`);
  ok(r.distintos > 20, `30 dias com rankings variados (${r.distintos} distintos)`);
  // o vencedor e o menor hash de data|id
  const certo = await q.evaluate(() => {
    const d = '2026-10-09';
    const min = T.rankings.map((x) => x.id).sort().reduce((m, id) => (hashTexto(`${d}|${id}`) < hashTexto(`${d}|${m}`) ? id : m));
    return rankingDoDia(d).id === min;
  });
  ok(certo, 'desafio do dia = menor hashTexto(data|id)');
  // S4/S3: depois do #1 tem numero, e o compartilhar leva o recorte
  ok(/nº 3(?!\d)/.test(await q.textContent('#card-dia')), 'card do dia em 07/10 mostra nº 3');
  await q.click('#jogar-dia'); await q.waitForSelector('#tela-jogo:not([hidden])');
  const linha1 = await q.evaluate(() => textoCompartilhar().split('\n')[0]);
  const esperado = await q.evaluate(() => `Top 10 em Casa #3 · ${T.ranking.titulo} (${T.ranking.recorte})`);
  ok(linha1 === esperado, `compartilhar com numero e recorte: ${linha1}`);
  // S5: jogar o diario marca como visto para a partida livre
  const hoje = await q.evaluate(() => T.ranking.id);
  ok(await q.evaluate((id) => (JSON.parse(localStorage.getItem('top10:vistos')) || []).includes(id), hoje), 'diario jogado entra nos vistos');
  // S2: diario terminado -> o inicio mostra o resultado e "Ver de novo"
  ok((await q.textContent('#jogar-dia')).trim() === 'Jogar o desafio do dia', 'antes de terminar: botao de jogar');
  await q.evaluate(acabarDiario(7)); await q.waitForSelector('#tela-fim:not([hidden])');
  await q.click('#voltar'); await q.waitForSelector('#tela-inicio:not([hidden])');
  ok(/7\/10 hoje/.test(await q.textContent('#card-dia')) && (await q.textContent('#jogar-dia')).trim() === 'Ver de novo', `inicio com o diario jogado: ${(await q.textContent('#card-dia')).trim().slice(0, 80)}`);
  await q.reload(); await q.waitForSelector('#form-inicio:not([hidden])');
  ok(/7\/10 hoje/.test(await q.textContent('#card-dia')) && (await q.textContent('#jogar-dia')).trim() === 'Ver de novo', 'continua depois de recarregar');
  await cx.close();
}
{
  // S4: antes do INICIO nao existe numero (nem nº 1 forcado)
  const [cx, q] = await comRelogio('2026-10-03T12:00:00');
  const card = await q.textContent('#card-dia');
  ok(!/nº|#\d/.test(card) && /Desafio do dia/.test(card), `antes do #1 o card nao tem numero: ${card.trim().slice(0, 50)}`);
  await q.click('#jogar-dia'); await q.waitForSelector('#tela-jogo:not([hidden])');
  const linha1 = await q.evaluate(() => textoCompartilhar().split('\n')[0]);
  ok(!/#/.test(linha1) && linha1.includes(`(${await q.evaluate(() => T.ranking.recorte)})`), `antes do #1 o compartilhar nao tem numero: ${linha1}`);
  await cx.close();
}
ok(!erros.length, 'sem erro de JS na revisao final ' + erros.join(' | '));
await b.close();
