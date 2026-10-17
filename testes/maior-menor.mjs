// Maior ou Menor: carregamento e sorteio. Rode com o site servido em BASE.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8777';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch(); const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/maior-ou-menor.html'); await p.waitForSelector('#tela-inicio:not([hidden]) #jogar-dia:not([disabled])', { timeout: 8000 });

// --- sorteio: 2000 pares por deck, todos validos ---
for (const deck of ['brasileirao', 'europa']) {
  const r = await p.evaluate((deck) => {
    const ruins = [];
    novaPartida({ deck, diario: false });
    for (let i = 0; i < 2000; i++) {
      const e = M.esquerda, d = M.direita, s = M.stat;
      if (!(s in e.valores) || !(s in d.valores)) ruins.push(['stat ausente', e.id, d.id, s]);
      if (e.recorte !== d.recorte) ruins.push(['recorte', e.id, d.id]);
      if (e.player_id === d.player_id) ruins.push(['mesmo jogador', e.id, d.id]);
      if (e.valores[s] === d.valores[s]) ruins.push(['empate', e.id, d.id, s]);
      M.esquerda = M.direita; M.seq = i % 40; sortearPar();
    }
    return ruins.slice(0, 5);
  }, deck);
  ok(r.length === 0, `${deck}: 2000 pares validos ${JSON.stringify(r)}`);
}

// --- diario deterministico ---
const seqDia = (data, deck) => p.evaluate(([data, deck]) => {
  novaPartida({ deck, diario: true, data });
  const ids = [M.esquerda.id, M.direita.id];
  for (let i = 0; i < 10; i++) { M.esquerda = M.direita; M.seq++; sortearPar(); ids.push(M.direita.id); }
  return ids.join(',');
}, [data, deck]);
ok(await seqDia('2026-10-12', 'brasileirao') === await seqDia('2026-10-12', 'brasileirao'), 'mesmo dia, mesma sequencia');
ok(await seqDia('2026-10-12', 'brasileirao') !== await seqDia('2026-10-13', 'brasileirao'), 'outro dia, outra sequencia');
ok(await seqDia('2026-10-12', 'brasileirao') !== await seqDia('2026-10-12', 'europa'), 'outro deck, outra sequencia');

// a semente tem o deck: com cartas identicas nos dois decks, as sequencias ainda diferem
const mesmaBase = await p.evaluate(() => {
  const orig = M.dado.decks.europa;
  M.dado.decks.europa = M.dado.decks.brasileirao;
  const seq = (deck) => { novaPartida({ deck, diario: true, data: '2026-10-12' }); const ids = [M.esquerda.id, M.direita.id]; for (let i = 0; i < 10; i++) { M.esquerda = M.direita; M.seq++; sortearPar(); ids.push(M.direita.id); } return ids.join(','); };
  const r = [seq('brasileirao'), seq('europa')];
  M.dado.decks.europa = orig;
  return r[0] !== r[1];
});
ok(mesmaBase, 'semente do diario inclui o deck (mesma base, decks diferentes)');

// o mesmo jogador nunca e candidato a si mesmo, mesmo com outro id no mesmo recorte
const mesmoJog = await p.evaluate(() => {
  novaPartida({ deck: 'brasileirao', diario: false });
  const e = M.esquerda, cartas = M.dado.decks.brasileirao.cartas;
  const clone = { ...e, id: e.id + '-x', valores: { ...e.valores, overall: e.valores.overall + 7 } };
  cartas.push(clone);
  const achou = candidatos(e, 'overall', new Set()).some((c) => c.player_id === e.player_id);
  cartas.pop();
  return achou;
});
ok(!mesmoJog, 'candidatos exclui o mesmo player_id');

// --- dificuldade: no comeco, diferenca relativa >= 40% quando existe candidato assim ---
const fac = await p.evaluate(() => {
  let ruins = 0;
  for (let k = 0; k < 300; k++) {
    novaPartida({ deck: 'brasileirao', diario: false });
    const s = M.stat, a = M.esquerda.valores[s], d = M.direita.valores[s];
    const existe = candidatos(M.esquerda, s, new Set()).some((c) => difRel(c.valores[s], a) >= 0.4);
    if (existe && difRel(d, a) < 0.4) ruins++;
  }
  return ruins;
});
ok(fac === 0, `par inicial respeita a faixa facil (${fac} fora)`);

// --- mesa sem saida reinicia sem travar (Review Focus 1) ---
const mesa = await p.evaluate(() => {
  novaPartida({ deck: 'brasileirao', diario: false });
  const g = M.dado.decks.brasileirao.cartas.find((c) => c.posicao === 'G');
  M.esquerda = g; M.seq = 3;
  M.usados = new Set(M.dado.decks.brasileirao.cartas.filter((c) => c.recorte === g.recorte).map((c) => c.id));
  sortearPar();
  return { seq: M.seq, valido: M.stat in M.esquerda.valores && M.stat in M.direita.valores && M.esquerda.recorte === M.direita.recorte };
});
ok(mesa.seq === 3 && mesa.valido, `mesa sem saida reinicia sem custo ${JSON.stringify(mesa)}`);

// --- nenhum jogador (player_id) repete na sequencia enquanto ha jogador novo ---
for (const deck of ['brasileirao', 'europa']) {
  const r = await p.evaluate((deck) => {
    const total = new Set(M.dado.decks[deck].cartas.map((c) => c.player_id)).size;
    novaPartida({ deck, diario: false });
    const vistos = new Set([M.esquerda.player_id, M.direita.player_id]);
    const rep = [];
    // ate esgotar os jogadores distintos do deck (209 no Brasileirao e 400 na Europa com o pool de 10/10), nenhum repete
    // no fim do deck sobra pouca carta que combine com a stat e o sorteio aceita repetir: folga de 20%, como os 250 de 307 de antes
    const n = Math.min(250, Math.floor(total * 0.8));
    for (let i = 0; i < n; i++) {
      M.esquerda = M.direita; M.seq = i % 40; sortearPar();
      if (M.esquerda.player_id !== M.direita.player_id && vistos.has(M.direita.player_id)) rep.push([i, M.direita.player_id, M.direita.id]);
      vistos.add(M.direita.player_id);
    }
    // alem de esgotar os jogadores o jogo nao trava: limpa o conjunto e segue
    for (let i = 0; i < 400; i++) { M.esquerda = M.direita; M.seq = i % 40; sortearPar(); }
    return { total, n, rep: rep.slice(0, 5) };
  }, deck);
  ok(r.rep.length === 0 && r.n >= 150, `${deck}: ${r.n} pares sem jogador repetido (${r.total} jogadores) ${JSON.stringify(r.rep)}`);
}

// --- Task 5: a partida ---
await p.evaluate(() => localStorage.clear()); await p.reload();
await p.waitForSelector('#jogar-dia:not([disabled])'); await p.click('#jogar-dia');
await p.waitForSelector('#tela-jogo:not([hidden])');
const tela = await p.textContent('#tela-jogo');
ok(!/undefined|null|NaN/.test(tela), 'tela do jogo sem undefined/null/NaN');
ok((await p.textContent('.carta.dir .valor')).trim() === '?', 'direita escondida antes de responder');
// a stat do par tem que estar evidente: faixa, frase com os dois nomes e o botao dizendo o que compara
const statMesa = await p.evaluate(() => ({ stat: M.dado.stats[M.stat].pergunta, faixa: document.getElementById('pergunta').textContent, frase: document.getElementById('frase').textContent, e: M.esquerda.nome, d: M.direita.nome, mais: document.getElementById('mais').textContent.trim(), menos: document.getElementById('menos').textContent.trim() }));
ok(statMesa.faixa === statMesa.stat, `faixa mostra a stat (${statMesa.faixa})`);
ok(statMesa.frase.includes(statMesa.e) && statMesa.frase.includes(statMesa.d), `frase com os dois nomes (${statMesa.frase})`);
ok(/^▲ \S/.test(statMesa.mais) && statMesa.mais !== '▲ Mais' && /^▼ \S/.test(statMesa.menos) && statMesa.menos !== '▼ Menos', `botoes dizem a stat (${statMesa.mais} / ${statMesa.menos})`);
const certo = () => p.evaluate(() => (M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'));
ok(await p.evaluate((e) => responder(e), await certo()) === 'acerto', 'acerto');
ok(await p.evaluate(() => M.seq) === 1 && (await p.textContent('#seq')).includes('1'), 'sequencia 1');
// duplo clique: dois cliques seguidos contam uma resposta so (Review Focus 3)
const antes = await p.evaluate(() => M.seq);
const resp = await certo();
// (com reducedMotion a revelacao e instantanea, entao os dois cliques saem no mesmo tick)
await p.evaluate((id) => { const el = document.getElementById(id); el.click(); el.click(); }, resp);
await p.waitForFunction(() => !M.revelando);
ok(await p.evaluate(() => M.seq) === antes + 1, 'duplo clique conta uma vez');
// chamada dupla direta de responder (nao passa pelo botao desabilitado)
const dupla = await p.evaluate(async (e) => { const r = await Promise.all([responder(e), responder(e)]); return [r.join(','), M.seq]; }, await certo());
ok(dupla[0] === 'acerto,ignorado' && dupla[1] === antes + 2, `responder em revelacao e ignorado ${dupla}`);
// recarregar no meio do diario retoma o mesmo par (Review Focus 2)
const par = await p.evaluate(() => [M.esquerda.id, M.direita.id, M.stat, M.seq].join('|'));
await p.reload(); await p.waitForSelector('#jogar-dia:not([disabled])'); await p.click('#jogar-dia');
await p.waitForSelector('#tela-jogo:not([hidden])');
ok(await p.evaluate(() => [M.esquerda.id, M.direita.id, M.stat, M.seq].join('|')) === par, 'recarregar retoma o mesmo par');
// erro encerra, mostra o valor e o fim
const errado = (await certo()) === 'mais' ? 'menos' : 'mais';
const valorCerto = await p.evaluate(() => M.direita.valores[M.stat]);
ok(await p.evaluate((e) => responder(e), errado) === 'erro', 'erro');
await p.waitForSelector('#tela-fim:not([hidden])');
ok((await p.textContent('.carta.dir .valor')).includes(String(valorCerto)) || (await p.textContent('#tela-fim')).includes(String(valorCerto)), 'erro mostra o valor certo');
ok((await p.textContent('#placar')).includes('3 seguidos'), 'placar 3 seguidos ' + await p.textContent('#placar'));
const txt = await p.evaluate(() => textoCompartilhar());
ok(/#\d+/.test(txt) && /3 seguidos/.test(txt) && /maior-ou-menor\.html/.test(txt) && !/undefined|null|NaN/.test(txt), `compartilhar: ${txt}`);
ok(await p.evaluate(() => responder('mais')) === 'ignorado', 'depois do fim nao responde');
// diario terminado nao reabre
await p.reload(); await p.waitForSelector('#jogar-dia:not([disabled])'); await p.click('#jogar-dia');
ok(await p.locator('#tela-fim:not([hidden])').count() === 1, 'diario terminado volta no fim');
ok((await p.textContent('#placar')).includes('3 seguidos'), 'diario terminado mostra o mesmo placar');
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('maior-menor:v1')).recorde.brasileirao) === 3, 'recorde do deck');
// livre: joga de novo e nao mexe no diario
await p.click('#de-novo'); await p.waitForSelector('#tela-jogo:not([hidden])');
ok(await p.evaluate(() => M.diario === null && M.seq === 0), 'livre comeca do zero');
const dBefore = await p.evaluate(() => localStorage.getItem('maior-menor:v1'));
await p.evaluate(async () => { await responder(M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'); });
ok(await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('maior-menor:v1')).diario)) === JSON.stringify(JSON.parse(dBefore).diario), 'livre nao mexe no diario');
await p.click('#voltar').catch(() => {});
// storage corrompido / bloqueado (Review Focus 5)
await p.evaluate(() => localStorage.setItem('maior-menor:v1', '{quebrado')); await p.reload();
await p.waitForSelector('#jogar-dia:not([disabled])', { timeout: 3000 }); await p.click('#jogar-dia');
ok(await p.locator('#tela-jogo:not([hidden])').count() === 1, 'joga com storage corrompido');
const ctx2 = await b.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
await ctx2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } }); });
const p2 = await ctx2.newPage(); const erros2 = []; p2.on('pageerror', (e) => erros2.push(e.message));
await p2.goto(BASE + '/maior-ou-menor.html'); await p2.waitForSelector('#jogar-livre:not([disabled])', { timeout: 5000 });
await p2.click('#jogar-livre'); await p2.waitForSelector('#tela-jogo:not([hidden])');
ok(await p2.evaluate(async () => { const r = await responder(M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'); return r; }) === 'acerto', 'responde com storage bloqueado');
ok(!erros2.length, 'joga com storage bloqueado ' + erros2.join(' | '));
// layout 360x640: nada transborda na horizontal e os botoes aparecem
const transborda = await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const visiveis = await p2.evaluate(() => ['mais', 'menos'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height >= 44 && r.bottom <= innerHeight; }));
ok(!transborda && visiveis, '360x640 sem transbordar, botoes >= 44px');
// o diario e o recorde tentam gravar: com storage bloqueado nao pode estourar
ok(await p2.evaluate(async () => { jogarDia(); const c = () => (M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'); await responder(c()); return await responder(c() === 'mais' ? 'menos' : 'mais'); }) === 'erro', 'diario e fim com storage bloqueado');
ok(!erros2.length, 'sem erro de JS apos o diario bloqueado ' + erros2.join(' | '));
await ctx2.close();

// --- Task 5, rodada de correcao ---
// 1. stat "jogos": a carta escondida nao entrega o valor pela linha de jogos
const vaza = await p.evaluate(() => {
  novaPartida({ deck: 'brasileirao', diario: false });
  const cs = M.dado.decks.brasileirao.cartas;
  const a = cs.find((c) => c.recorte === 'Brasileirão 2025');
  const d = cs.find((c) => c.recorte === a.recorte && c.player_id !== a.player_id && c.valores.jogos !== a.valores.jogos);
  M.esquerda = a; M.direita = d; M.stat = 'jogos'; renderJogo();
  const antes = document.querySelector('.carta.dir').textContent;
  return { valor: String(d.valores.jogos), antes };
});
ok(!new RegExp('\\b' + vaza.valor + '\\b').test(vaza.antes), `carta escondida nao vaza o valor de jogos (${vaza.valor}) em "${vaza.antes.replace(/\s+/g, ' ')}"`);
// 2. recarregar durante a revelacao (com animacao) nao da segunda chance
const ctx3 = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p3 = await ctx3.newPage();
await p3.goto(BASE + '/maior-ou-menor.html'); await p3.waitForSelector('#jogar-dia:not([disabled])'); await p3.click('#jogar-dia');
await p3.waitForSelector('#tela-jogo:not([hidden])');
const erradoBtn = await p3.evaluate(() => (M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'menos' : 'mais'));
await p3.click('#' + erradoBtn);
await p3.reload(); // bem antes dos 900 ms da animacao
await p3.waitForSelector('#jogar-dia:not([disabled])'); await p3.click('#jogar-dia');
ok(await p3.locator('#tela-fim:not([hidden])').count() === 1, 'recarregar durante a revelacao do erro volta no fim (sem segunda chance)');
// 5. recorde salvo a cada acerto (antes do erro)
await p3.evaluate(() => localStorage.clear());
await p3.click('#voltar'); await p3.click('#jogar-livre'); await p3.waitForSelector('#tela-jogo:not([hidden])');
await p3.evaluate(() => { const c = M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'; document.getElementById(c).click(); });
await p3.reload();
ok(await p3.evaluate(() => JSON.parse(localStorage.getItem('maior-menor:v1')).recorde.brasileirao) === 1, 'recorde salvo no acerto');
// 3. MAIS e MENOS tem o mesmo peso visual antes da revelacao
const pesos = await p3.evaluate(() => { document.getElementById('jogar-livre').click(); const f = (id) => { const c = getComputedStyle(document.getElementById(id)); return [c.backgroundColor, c.borderColor, c.color].join('|'); }; return [f('mais'), f('menos')]; });
ok(pesos[0] === pesos[1], `MAIS e MENOS com o mesmo estilo ${pesos}`);
// 6. a sequencia nao entrega o resultado antes da contagem (animacao ligada)
const spoil = await p3.evaluate(() => {
  const antes = document.getElementById('seq').textContent;
  const c = M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos';
  document.getElementById(c).click();
  return { antes, logo: document.getElementById('seq').textContent, salvo: M.seq,
    marcado: document.getElementById(c).classList.contains('escolhido') && document.getElementById(c).getAttribute('aria-pressed') === 'true',
    outro: document.getElementById(c === 'mais' ? 'menos' : 'mais').classList.contains('escolhido'), c };
});
ok(spoil.logo === spoil.antes && spoil.salvo === Number(spoil.antes) + 1, `#seq so muda depois da contagem (antes ${spoil.antes}, logo apos o clique ${spoil.logo}, M.seq ${spoil.salvo})`);
ok(spoil.marcado && !spoil.outro, `botao clicado fica marcado na revelacao (${spoil.c})`);
await p3.waitForFunction(() => !M.revelando, null, { timeout: 8000 });
const depois = await p3.evaluate(() => ({ seq: document.getElementById('seq').textContent, m: M.seq, marcas: ['mais', 'menos'].filter((i) => document.getElementById(i).classList.contains('escolhido') || document.getElementById(i).hasAttribute('aria-pressed')) }));
ok(depois.seq === String(depois.m) && depois.marcas.length === 0, `apos a revelacao #seq atualiza e a marca some ${JSON.stringify(depois)}`);
// 7. sortearPar que estoura nao deixa a mesa travada em revelacao
const trava = await p3.evaluate(async () => {
  const orig = window.sortearPar; let travou;
  window.sortearPar = () => { throw new Error('boom'); };
  try { await responder(M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos'); } catch (e) { travou = 'lancou'; }
  window.sortearPar = orig;
  return { travou, revelando: M.revelando };
});
ok(trava.revelando === false, `erro no sortearPar nao deixa M.revelando preso ${JSON.stringify(trava)}`);
// 4. 1920x1080: texto secundario legivel
await p3.setViewportSize({ width: 1920, height: 1080 });
const tipo = await p3.evaluate(() => ['.clube', '.posicao', '.jogos', '.recorte'].map((s) => parseFloat(getComputedStyle(document.querySelector('.carta.esq ' + s)).fontSize)));
ok(tipo.every((x) => x >= 18), `texto secundario >= 18px em 1920 ${tipo}`);
await ctx3.close();

// 8. botoes dentro da tela nos 5 formatos de gravacao/celular (pior caso: 25 mesas seguidas)
for (const [w, h] of [[360, 640], [390, 844], [1280, 720], [1366, 768], [1920, 1080]]) {
  const cx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  // sem fontes externas (fallback mais largo): o pior caso de quebra de linha
  await cx.route((u) => u.origin !== new URL(BASE).origin, (r) => r.fulfill({ status: 200, contentType: r.request().resourceType() === 'stylesheet' ? 'text/css' : 'application/javascript', body: '' }));
  const pv = await cx.newPage();
  await pv.goto(BASE + '/maior-ou-menor.html'); await pv.waitForSelector('#jogar-livre:not([disabled])');
  await pv.click('#jogar-livre'); await pv.waitForSelector('#tela-jogo:not([hidden])');
  const fundo = await pv.evaluate(async () => {
    let max = 0;
    for (let k = 0; k < 25; k++) {
      for (const id of ['mais', 'menos']) max = Math.max(max, document.getElementById(id).getBoundingClientRect().bottom);
      await responder(M.direita.valores[M.stat] > M.esquerda.valores[M.stat] ? 'mais' : 'menos');
    }
    return max;
  });
  ok(fundo <= h, `${w}x${h}: MAIS/MENOS inteiros na tela (fundo ${Math.round(fundo)} <= ${h})`);
  if (process.env.FOTO) await pv.screenshot({ path: new URL(`./resultados/mm-${w === 1920 ? 1080 : w === 1280 ? 720 : w === 360 ? 360 : w}.png`, import.meta.url).pathname });
  await cx.close();
}

// --- na home e no menu, ao lado do Top 10 (que voltou em 16/10) ---
{
  const p6 = await b.newPage();
  await p6.goto(BASE + '/index.html');
  ok(await p6.locator('a[href="top10-em-casa.html"]').count() >= 2 && await p6.locator('a[href="maior-ou-menor.html"]').count() >= 2, 'home com o Maior ou Menor e o Top 10 (menu + card)');
  await p6.close();
}
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
await b.close();
