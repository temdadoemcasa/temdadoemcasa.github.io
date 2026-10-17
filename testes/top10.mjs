// Top 10 em Casa (versao facil, 16/10): dados, fluxo, dicas e persistencia. Rode com o site servido em BASE.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);

// --- dados: todo ranking jogavel ------------------------------------------------
const dados = JSON.parse(readFileSync('dados/top10.json', 'utf8'));
const pool = new Map(dados.jogadores.map((j) => [j.id, j]));
ok(dados.rankings.length >= 50, `pelo menos 50 rankings (${dados.rankings.length})`);
ok(new Set(dados.rankings.map((r) => r.id)).size === dados.rankings.length, 'id de ranking sem repetir');
ok(pool.size === dados.jogadores.length, 'busca sem jogador repetido');
const ruins = [];
for (const r of dados.rankings) {
  const n = r.top.length, pos = r.top.map((x) => x.pos);
  if (n < 10 || n > 12) ruins.push(`${r.id}: ${n} barras`);
  if (pos[0] !== 1 || pos.some((x, i) => i && x < pos[i - 1]) || pos.some((x) => x > 10)) ruins.push(`${r.id}: posicoes ${pos}`);
  if (new Set(r.top.map((x) => x.id)).size !== n) ruins.push(`${r.id}: jogador repetido`);
  for (const x of r.top) {
    // quem esta no top precisa ser achavel na busca, com o mesmo nome; senao o ranking e impossivel
    if (!pool.has(x.id) || pool.get(x.id).nome !== x.nome) ruins.push(`${r.id}: ${x.nome} fora da busca`);
    if (!x.pais || !existsSync(`img/bandeiras/${x.pais}.svg`)) ruins.push(`${r.id}: ${x.nome} sem bandeira (${x.pais})`);
    if (!x.valor) ruins.push(`${r.id}: ${x.nome} sem valor`);
  }
  for (const k of ['titulo', 'sub', 'recorte', 'nivel', 'fonte']) if (!r[k]) ruins.push(`${r.id}: sem ${k}`);
}
ok(!ruins.length, 'todo ranking: 10 a 12 barras, posicao em ordem, bandeira, valor e todo nome achavel na busca ' + ruins.slice(0, 5).join(' | '));
ok(dados.jogadores.filter((j) => j.pais).every((j) => existsSync(`img/bandeiras/${j.pais}.svg`)), 'toda bandeira da busca existe em img/bandeiras');
// homonimo com a mesma bandeira precisa de algo que separe na sugestao (Ederson goleiro x Ederson volante)
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const vistos = new Map(); const iguais = [];
for (const j of dados.jogadores) { const k = `${norm(j.nome)}|${j.pais}|${j.extra || ''}`; if (vistos.has(k)) iguais.push(j.nome); vistos.set(k, j.id); }
ok(!iguais.length, 'nenhuma sugestao identica (nome + bandeira + extra) pra jogadores diferentes ' + iguais.slice(0, 5).join(', '));

// --- frase da dica (17/10): fato da base, pre-calculado, sem entregar outra resposta ---
const TIPOS = new Set(['clubes', 'copa', 'companheiro']);
const PADRAO = { clubes: /^Já passou por [^,]+( e [^,]+)?$/u, copa: /^Jogou a Copa de (2022|2026) com .+$/u, companheiro: /^Foi companheiro de .+ (no|na) .+$/u };
const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const contemNome = (frase, nome) => new RegExp(`(^|[^\\p{L}])${semAcento(nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(semAcento(frase));
const frases = [], vazamentos = [], tortas = [], copaOutroPais = [];
// conferido a mao: Transfermarkt diz Franca, mas ele jogou a Copa de 2026 por Marrocos (SofaScore)
const DUPLA = new Set(['Ayyoub Bouaddi']);
const poolPorNome = new Map(dados.jogadores.map((j) => [j.nome, j]));
for (const r of dados.rankings) for (const x of r.top) {
  if (!('frase' in x) && !('frase_tipo' in x)) continue;
  frases.push(x);
  if (typeof x.frase !== 'string' || !x.frase.trim() || /undefined|null|NaN|\[object/.test(x.frase) || !TIPOS.has(x.frase_tipo) || !PADRAO[x.frase_tipo].test(x.frase)) tortas.push(`${r.id}/${x.nome}: ${x.frase_tipo} ${JSON.stringify(x.frase)}`);
  const outro = r.top.find((y) => typeof x.frase === 'string' && contemNome(x.frase, y.nome));
  if (outro) vazamentos.push(`${r.id}/${x.nome}: "${x.frase}" cita ${outro.nome}`);
  const m = /^Jogou a Copa de \d+ com (.+)$/u.exec(x.frase || '');
  const comp = m && poolPorNome.get(m[1]);
  if (m && (!comp || (comp.pais !== x.pais && !DUPLA.has(x.nome)))) copaOutroPais.push(`${r.id}/${x.nome} [${x.pais}]: ${x.frase} [${comp?.pais}]`);
}
const total = dados.rankings.reduce((n, r) => n + r.top.length, 0);
const doTM = dados.rankings.reduce((n, r) => n + r.top.filter((x) => typeof x.id === 'number').length, 0);
const porTipo = Object.fromEntries([...TIPOS].map((t) => [t, frases.filter((x) => x.frase_tipo === t).length]));
ok(!tortas.length, `toda frase e texto de um dos 3 tipos, sem undefined/null (${frases.length}) ` + tortas.slice(0, 3).join(' | '));
ok(!vazamentos.length, 'nenhuma frase cita nome que e resposta do mesmo ranking (nem o proprio) ' + vazamentos.slice(0, 3).join(' | '));
ok(!copaOutroPais.length, 'companheiro de Copa e da mesma selecao (bandeira igual) e esta na busca ' + copaOutroPais.slice(0, 3).join(' | '));
ok(frases.length >= 0.9 * doTM, `frase em pelo menos 90% das barras do Transfermarkt (${frases.length}/${doTM}, ${total} barras)`);
ok(Object.values(porTipo).every((n) => n >= 0.1 * total), `os 3 tipos aparecem, cada um em 10%+ das barras ${JSON.stringify(porTipo)}`);
ok(dados.rankings.every((r) => r.top.every((x) => typeof x.id === 'number' || !x.frase)), 'jogador so da Wikipedia nao ganha frase (nada inventado)');

// --- fluxo no navegador ---------------------------------------------------------
const b = await chromium.launch(); const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/top10-em-casa.html'); await p.waitForSelector('#form-inicio:not([hidden])');
const card = await p.textContent('#card-dia');
ok(card && !/undefined|null|NaN/.test(card), `card do dia mostra o ranking: ${card?.trim().slice(0, 60)}`);
const a = await p.evaluate(() => rankingDoDia('2026-10-20').id), a2 = await p.evaluate(() => rankingDoDia('2026-10-20').id);
const semana = await p.evaluate(() => new Set(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map((d) => rankingDoDia(d).id)).size);
ok(a === a2 && semana >= 4, `mesmo dia, mesmo ranking; dias diferentes variam (${semana}/5)`);

await p.click('#jogar-dia'); await p.waitForSelector('#tela-jogo:not([hidden])');
const R = await p.evaluate(() => T.ranking);
const barrasTxt = await p.textContent('#barras');
ok(await p.locator('.barra').count() === R.top.length && await p.locator('.barra.aberta').count() === 0, 'barras comecam fechadas, uma por nome');
ok(R.top.every((x) => !barrasTxt.includes(x.nome)) && !R.top.some((x) => x.clube && barrasTxt.includes(x.clube)), 'nenhum nome nem clube aparece antes do chute/dica');
const srcs = await p.$$eval('#barras .barra img.bandeira', (is) => is.map((i) => i.getAttribute('src')));
ok(srcs.length === R.top.length && srcs.every((s, i) => s === `img/bandeiras/${R.top[i].pais}.svg`), 'toda barra fechada ja mostra a bandeira certa');
await p.waitForTimeout(500);
const carregou = await p.$$eval('#barras img.bandeira', (is) => is.every((i) => i.complete && i.naturalWidth > 0));
ok(carregou, 'bandeiras carregam (svg existe)');
ok(await p.locator('.vida.cheia').count() === 3, '3 vidas');
// no celular o chute e a primeira coisa: campo de busca e botao de dica na primeira tela, antes das barras
const lay = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { busca: r('busca').bottom, dica: r('dica').bottom, barras: r('barras').top, tela: innerHeight }; });
ok(lay.busca < lay.barras && lay.dica <= lay.barras && lay.dica < lay.tela * 0.6, `celular: busca e dica em cima das barras, na primeira tela (${JSON.stringify(lay)})`);
await p.evaluate(() => window.scrollTo(0, 400)); await p.click('#busca'); await p.waitForTimeout(900);
const sob = await p.evaluate(() => ({ topo: document.querySelector('header').getBoundingClientRect().bottom, campo: document.getElementById('busca').getBoundingClientRect().top }));
ok(sob.campo >= sob.topo, `tocar na busca nao deixa ela embaixo do topo fixo (${JSON.stringify(sob)})`);
ok((await p.textContent('#dica')).includes('(3)') && await p.locator('#dica').isEnabled(), 'botao de dica com 3');

// iniciais: uma por palavra, pulando a particula minuscula
const INI = { 'Luka Modrić': 'L. M.', 'Cristiano Ronaldo': 'C. R.', 'Gavi': 'G.', 'Virgil van Dijk': 'V. D.', 'Rafael da Silva': 'R. S.',
  'Kevin De Bruyne': 'K. D. B.', 'Son Heung-min': 'S. H.', "N'Golo Kanté": 'N. K.', 'Marc-André ter Stegen': 'M. S.', ' Vinicius  Junior ': 'V. J.', 'Éder Militão': 'É. M.' };
const ini = await p.evaluate((nomes) => (typeof iniciais === 'function' ? nomes.map((n) => iniciais(n)) : []), Object.keys(INI));
ok(ini.length === Object.keys(INI).length && ini.every((v, i) => v === Object.values(INI)[i]), `iniciais por palavra, sem particula: ${ini.join(' / ')}`);
// iniciais esperadas, escritas aqui de novo (independente do top10.js)
const iniDe = (nome) => { const ps = nome.trim().split(/\s+/); const f = ps.filter((w) => !(w === w.toLowerCase() && w !== w.toUpperCase())); return (f.length ? f : ps).map((w) => [...w.replace(/^[^\p{L}]+/u, '')][0].toUpperCase() + '.').join(' '); };

// dica: vai pra barra fechada mais alta, mostra iniciais + clube + frase, nada mais
ok(await p.evaluate((id) => chutar(id), R.top[0].id) === 'acerto', 'acerto do 1o');
const d1 = await p.evaluate(() => pedirDica());
ok(d1 === R.top[1].id, 'dica 1 vai pro 2o (o 1o ja abriu)');
const b2 = await p.locator('.barra').nth(1).textContent();
const nomeDica = await p.locator('.barra').nth(1).locator('.barra-nome').textContent();
ok(nomeDica === iniDe(R.top[1].nome) && (!R.top[1].clube || b2.includes(R.top[1].clube)) && !b2.includes(R.top[1].nome) && !b2.includes(R.top[1].valor), `barra com dica: iniciais e clube, sem nome nem valor (${b2.trim()})`);
const fraseNaBarra = await p.locator('.barra').nth(1).locator('.barra-frase').textContent().catch(() => null);
ok(R.top[1].frase ? fraseNaBarra === R.top[1].frase : fraseNaBarra === null, `barra com dica mostra a frase do gerador: ${fraseNaBarra}`);
ok((await p.textContent('#aviso')).includes(iniDe(R.top[1].nome)) && (!R.top[1].frase || (await p.textContent('#aviso')).includes(R.top[1].frase)), `aviso da dica com iniciais e frase: ${await p.textContent('#aviso')}`);
ok(await p.locator('.barra:not(.com-dica) .barra-frase').count() === 0, 'frase so aparece em barra com dica');
const d2 = await p.evaluate(() => pedirDica()), d3 = await p.evaluate(() => pedirDica()), d4 = await p.evaluate(() => pedirDica());
ok(d2 === R.top[2].id && d3 === R.top[3].id && d4 === undefined, 'dicas 2 e 3 descem a fila; a 4a nao existe');
ok(await p.locator('#dica').isDisabled() && await p.locator('.barra.com-dica').count() === 3, 'sem dica sobrando: botao desliga, 3 barras com dica');
ok(await p.locator('.vida.cheia').count() === 3, 'dica nao custa vida');

// acerto abre a barra DA POSICAO do jogador, com nome, clube e valor
const alvo = R.top[5];
ok(await p.evaluate((id) => chutar(id), alvo.id) === 'acerto', 'acerto do 6o');
const b6 = await p.locator('.barra').nth(5).textContent();
ok(b6.includes(alvo.nome) && b6.includes(alvo.valor), 'barra certa com nome e valor');
ok(await p.evaluate((id) => chutar(id), alvo.id) === 'repetido' && await p.locator('.vida.cheia').count() === 3, 'repetido nao custa vida');
const foras = await p.evaluate(() => { const no = new Set(T.ranking.top.map((x) => x.id)); return T.jogadores.filter((j) => !no.has(j.id)).slice(0, 3).map((j) => j.id); });
ok(await p.evaluate((id) => chutar(id), foras[0]) === 'fora' && await p.locator('.vida.cheia').count() === 2, 'fora custa uma vida');
ok(/não tá nesse top/i.test(await p.textContent('#aviso')), 'aviso do fora');

// recarregar no meio do diario mantem acertos, vidas e dicas
await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])'); await p.click('#jogar-dia'); await p.waitForSelector('#tela-jogo:not([hidden])');
ok(await p.locator('.vida.cheia').count() === 2 && await p.locator('.barra.aberta').count() === 2 && await p.locator('.barra.com-dica').count() === 3 && await p.locator('#dica').isDisabled(),
  'recarregar mantem acertos, vidas e dicas');

// letra que nao e acento (ø, ı, ł, æ) busca pela letra comum: "sorloth" acha Sørloth
const especiais = await p.evaluate(() => ['sorloth', 'odegaard', 'hojlund', 'yildiz'].map((x) => [x, buscar(x).map((o) => o.nome)]));
ok(especiais.every(([x, ns]) => ns.length > 0) && especiais[0][1].some((n) => n.includes('Sørloth')), `busca sem a letra especial: ${JSON.stringify(especiais)}`);
// a busca acha o jogador, com bandeira, e chutar pela lista funciona
const nomeBusca = R.top[4].nome;
await p.fill('#busca', nomeBusca); await p.waitForTimeout(100);
const sug = await p.$$eval('#sugestoes .sugestao', (ls) => ls.map((l) => ({ t: l.textContent, img: !!l.querySelector('img.bandeira, .bandeira-vazia') })));
ok(sug.some((s) => s.t.includes(nomeBusca)) && sug.every((s) => s.img), `busca acha "${nomeBusca}" e mostra bandeira`);
await p.locator('#sugestoes .sugestao', { hasText: nomeBusca }).first().click();
const homo = await p.evaluate(() => { const c = new Map(); for (const j of T.jogadores) { const k = j.nome + j.pais; c.set(k, (c.get(k) || 0) + 1); } return T.jogadores.find((j) => c.get(j.nome + j.pais) > 1 && !T.acertos.has(j.id) && !T.erros.includes(j.id)); });
await p.fill('#busca', homo.nome); await p.waitForTimeout(100);
const extras = await p.$$eval('#sugestoes .sugestao', (ls, n) => ls.filter((l) => l.querySelector('b').textContent === n).map((l) => l.querySelector('.sugestao-extra')?.textContent || ''), homo.nome);
ok(extras.length >= 2 && extras.every(Boolean) && new Set(extras).size === extras.length, `homonimo "${homo.nome}" aparece separado na busca: ${extras.join(' / ')}`);
await p.fill('#busca', '');
ok(await p.locator('.barra').nth(4).evaluate((li) => li.classList.contains('aberta')), 'chute pela lista abre a barra');

// fim: duas vidas a mais acabam e revelam tudo
await p.evaluate((ids) => ids.forEach((id) => chutar(id)), foras.slice(1));
await p.waitForSelector('#tela-fim:not([hidden])');
ok(await p.locator('.barra.aberta, .barra.revelada').count() === R.top.length, 'fim revela todas');
ok((await p.textContent('#placar')).trim() === `3/${R.top.length}`, `placar ${(await p.textContent('#placar')).trim()}`);
ok(await p.locator('#acoes-jogo').isHidden() && await p.locator('#busca-caixa').isHidden(), 'no fim some busca e dica');
const txt = await p.evaluate(() => textoCompartilhar());
ok(/^Top 10 em Casa( #\d+)? · .+\n[🟩⬛]+\n3\/\d+ · 💡 3 dicas · ❤️ 0 vidas restantes\nhttps:\/\/temdadoemcasa\.github\.io\/top10-em-casa\.html$/u.test(txt), `compartilhar coerente: ${JSON.stringify(txt)}`);
ok([...txt.matchAll(/🟩/gu)].length === 3, 'compartilhar com 3 verdes');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('top10:v2')).serie.ultimo === hojeLocal()), 'serie registra o dia');
await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])');
ok(/\/\d+ hoje/.test(await p.textContent('#card-dia')) && (await p.textContent('#jogar-dia')).includes('Ver de novo'), 'diario terminado aparece no card');

// desistir revela sem custar vida a mais
await p.click('#jogar-livre'); await p.waitForSelector('#tela-jogo:not([hidden])');
await p.click('#desistir'); await p.waitForSelector('#tela-fim:not([hidden])');
ok(await p.locator('.barra.revelada').count() === await p.evaluate(() => T.ranking.top.length) && (await p.textContent('#placar')).startsWith('0/'), 'desistir revela o top com 0 acertos');

// localStorage corrompido nao quebra
await p.evaluate(() => { localStorage.setItem('top10:v2', '{quebrado'); localStorage.setItem('top10:vistos2', '"x"'); });
await p.reload();
const abriu = await p.waitForSelector('#form-inicio:not([hidden])', { timeout: 3000 }).then(() => true, () => false);
await p.click('#jogar-dia').catch(() => {}); await p.waitForSelector('#tela-jogo:not([hidden])', { timeout: 3000 }).catch(() => {});
ok(abriu && await p.locator('.vida.cheia').count() === 3, 'abre e joga com storage corrompido');
// diario de outro dia nao vale hoje
await p.evaluate((id) => localStorage.setItem('top10:v2', JSON.stringify({ diario: { data: '2020-01-01', id, acertos: [], erros: [1, 2, 3], dicas: [], fim: true } })), R.id);
await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])');
ok((await p.textContent('#jogar-dia')).includes('Jogar o desafio'), 'diario de outro dia nao conta');

// ranking com empate no 10o: mais de 10 barras, posicao repetida, fim so com todas
const empate = await p.evaluate(() => T.rankings.find((r) => r.top.length > 10)?.id);
ok(!!empate, 'existe ranking com empate no 10o pra testar');
await p.evaluate((id) => { T.rankings = T.rankings.filter((r) => r.id === id); }, empate);
await p.evaluate(() => comecar());
const n = await p.evaluate(() => T.ranking.top.length);
ok(await p.locator('.barra').count() === n && n > 10, `empate: ${n} barras`);
await p.evaluate(() => T.ranking.top.slice(0, 10).forEach((x) => chutar(x.id)));
ok(await p.locator('#tela-fim').isHidden(), 'empate: 10 acertos ainda nao acabam');
await p.evaluate(() => T.ranking.top.slice(10).forEach((x) => chutar(x.id)));
ok((await p.textContent('#placar')).trim() === `${n}/${n}`, 'empate: acaba com todas');
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
await b.close();
