// Quem Tá em Casa?: dicas liberam uma por erro (nem antes, nem depois), o chute certo
// termina com 🟩, o desafio do dia e o mesmo em dois navegadores e so vale uma vez,
// chute sem nota nunca vira seta de overall (ausencia nao e zero) e nada vaza a tela no celular.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
const erros = [];

async function abrir(ctx, viewport) {
  const p = await ctx.newPage(viewport ? { viewport } : undefined);
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(BASE + '/quem-ta-em-casa.html');
  await p.waitForSelector('#form-inicio:not([hidden])');
  return p;
}
// um chute errado qualquer: o primeiro da lista que nao e o alvo
const errado = (p, exceto = []) => p.evaluate((ex) => J.opcoes.find((o) => o.id !== J.alvo.j.player_id && !ex.includes(o.id)).id, exceto);
const chutarId = (p, id) => p.evaluate((i) => chutar(i), id);
const cartaEstado = (p) => p.evaluate(() => {
  const c = document.querySelector('#carta-misterio .carta');
  const celulas = [...c.querySelectorAll('.carta-eixos div')];
  return {
    ocultos: celulas.filter((d) => d.classList.contains('oculto')).length,
    total: celulas.length,
    overall: c.querySelector('.carta-nota strong').textContent,
    nome: c.querySelector('.carta-nome').textContent,
    info: c.querySelector('.carta-info').textContent,
    kitReal: !c.querySelector('.carta-figura text') || c.querySelector('.carta-figura text').textContent !== '?',
  };
});

// 1. progressao das dicas
{
  const ctx = await b.newContext();
  const p = await abrir(ctx);
  await p.click('#livre');
  // alvo de linha com 6 atributos calculados, pra contagem ser exata
  await p.evaluate(() => {
    const c = candidatos(null).find((x) => x.j.posicao !== 'G' && Object.values(x.j.eixos).filter((v) => typeof v === 'number').length === 6);
    J.alvo = c; J.chutes = []; J.fim = null; desenhar();
  });
  let e = await cartaEstado(p);
  ok(e.ocultos === 6 && e.overall === '?' && e.nome === '? ? ?', `antes do 1º chute: 6 atributos, overall e nome escondidos (${e.ocultos}, ${e.overall}, ${e.nome})`);
  ok(/(Brasileirão 20\d\d|Premier \d\d\/\d\d|Champions \d\d\/\d\d)/.test(e.info), `dica 1 (liga e ano) aparece desde o início (${e.info})`);
  const alvoNome = await p.evaluate(() => J.alvo.j.nome);
  const usados = [];
  const passo = async () => { const id = await errado(p, usados); usados.push(id); await chutarId(p, id); return cartaEstado(p); };
  e = await passo();
  ok(e.ocultos === 4, `1 erro: só os 2 maiores atributos abertos (${6 - e.ocultos} abertos)`);
  const top2 = await p.evaluate(() => {
    const abertos = [...document.querySelectorAll('#carta-misterio .carta-eixos div:not(.oculto) dd')].map((d) => Number(d.textContent));
    const todos = Object.values(J.alvo.j.eixos).filter((v) => typeof v === 'number').sort((a, b) => b - a);
    return Math.min(...abertos) >= todos[1];
  });
  ok(top2, '1 erro: os abertos são mesmo os 2 maiores');
  ok(!(await p.textContent('#dicas')).includes('Seleção:'), '1 erro: seleção ainda escondida');
  e = await passo();
  ok(e.ocultos === 0 && e.overall === '?', `2 erros: todos os atributos, overall ainda escondido (${e.overall})`);
  const selecao = await p.evaluate(() => ({ dica: document.querySelector('#dicas li:nth-child(3) .dica-valor').textContent, pais: paisDe(J.alvo.j.player_id), nome: J.alvo.j.pais }));
  ok(selecao.pais && selecao.dica.includes('Seleção: ') && !selecao.dica.includes('sem dado'), `2 erros: seleção aparece (${selecao.dica})`);
  e = await passo();
  ok(/^\d+$/.test(e.overall), `3 erros: overall aparece (${e.overall})`);
  ok(/\? J/.test(e.info), '3 erros: jogos ainda escondidos');
  e = await passo();
  ok(!/\? J/.test(e.info), '4 erros: jogos aparecem');
  ok(await p.evaluate(() => document.querySelector('#carta-misterio .carta-figura svg').innerHTML.includes('#2b313a')), '4 erros: camisa ainda neutra (sem cor do clube)');
  e = await passo();
  ok(await p.evaluate(() => !document.querySelector('#carta-misterio .carta-figura svg').innerHTML.includes('#2b313a')), '5 erros: camisa com a cor do clube');
  ok(e.nome === '? ? ?', `5 erros: nome continua escondido (${e.nome})`);
  ok(!(await p.textContent('#dicas')).includes(alvoNome), 'nome do alvo não aparece nas dicas');
  await passo();
  ok(await p.isVisible('#tela-fim') && (await p.textContent('#fim-grade')) .length > 0 && !(await p.textContent('#fim-grade')).includes('🟩'), '6 erros: fim sem 🟩');
  ok((await p.textContent('#fim-texto')).length > 0, 'fim revela quem era');
  await ctx.close();
}

// 2. chute certo, comparacao e ausencia
{
  const ctx = await b.newContext();
  const p = await abrir(ctx);
  await p.click('#livre');
  // chute do mesmo clube e mesma posicao
  const mesmo = await p.evaluate(() => {
    const a = J.alvo;
    const par = a.time.jogadores.find((j) => j.player_id !== a.j.player_id && j.posicao === a.j.posicao);
    return par ? par.player_id : null;
  });
  if (mesmo) {
    await chutarId(p, mesmo);
    const selos = await p.textContent('#chutes li:first-child');
    ok(selos.includes('✅ Clube') && selos.includes('✅ Posição'), `companheiro de clube e posição: ✅ ✅ (${selos.trim()})`);
  }
  // o aviso traz o valor da dica nova (no celular a lista de dicas fica fora da tela)
  if (mesmo) {
    const aviso = await p.textContent('#aviso');
    const esperado = await p.evaluate(() => textosDasDicas()[J.chutes.length]);
    ok(aviso.includes(`Dica ${await p.evaluate(() => J.chutes.length + 1)}: ${esperado}`), `aviso mostra a dica nova com o valor (${aviso})`);
  }
  // chute sem nota na temporada do alvo: nunca seta de overall
  const semNota = await p.evaluate(() => {
    for (const [id, cartas] of J.cartasDe) {
      if (id === J.alvo.j.player_id || J.chutes.some((c) => c.id === id)) continue;
      const c = cartas.find((x) => x.ano === J.alvo.ano) || cartas[0];
      if (c.j.overall === null) return id;
    }
    return null;
  });
  ok(semNota !== null, 'existe chute sem nota pra testar');
  await chutarId(p, semNota);
  const linha = await p.textContent('#chutes li:first-child');
  ok(linha.includes('— OVR') && !/[⬆⬇]/.test(linha), `chute sem nota mostra "— OVR", sem seta (${linha.trim()})`);
  // sem pais no mapa: "sem dado", nunca um pais inventado
  const semPais = await p.evaluate(() => { const antes = J.paises; J.paises = {}; const t = textoDaSelecao(J.alvo.j.player_id); J.paises = antes; return t; });
  ok(semPais === 'sem dado', `seleção sem dado diz "sem dado" (${semPais})`);
  const reino = await p.evaluate(() => [nomeDoPais('EN'), nomeDoPais('SX'), nomeDoPais('BR')]);
  ok(reino.join('|') === 'Inglaterra|Escócia|Brasil', `nomes dos países em português (${reino})`);
  // busca: acha pelo nome e o alvo aparece na lista
  const nome = await p.evaluate(() => J.alvo.j.nome);
  await p.fill('#busca', nome);
  const achou = await p.evaluate(() => sugestoes.some((o) => o.id === J.alvo.j.player_id));
  ok(achou, `autocompletar acha o alvo digitando "${nome}"`);
  await p.evaluate(() => chutar(J.alvo.j.player_id));
  const grade = await p.textContent('#fim-grade');
  const n = await p.evaluate(() => J.chutes.length);
  ok(await p.isVisible('#tela-fim') && [...grade][n - 1] === '🟩' && [...grade].length === 6, `acerto no ${n}º chute: ${grade}`);
  ok(/Acertou|De primeira/.test(await p.textContent('#fim-titulo')), 'título de acerto');
  await ctx.close();
}

// 3. desafio do dia: igual em dois navegadores, uma vez so, compartilhar em quadradinhos
{
  const nomes = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await b.newContext();
    const p = await abrir(ctx);
    await p.click('#diario');
    nomes.push(await p.evaluate(() => `${J.alvo.ano}-${J.alvo.j.player_id}`));
    if (i === 0) {
      const id = await errado(p);
      await chutarId(p, id);
      await chutarId(p, id); // repetido nao gasta chute
      ok((await p.evaluate(() => J.chutes.length)) === 1, 'chute repetido não gasta chute');
      await p.click('#desistir');
      const texto = await p.evaluate(() => J.textoCompartilhar);
      ok(/^Quem Tá em Casa\? · Desafio #\d+ · X\/6\n🟥⬜⬜⬜⬜⬜|^Quem Tá em Casa\? · Desafio #\d+ · X\/6\n🟨⬜⬜⬜⬜⬜/.test(texto), `compartilhar: ${JSON.stringify(texto)}`);
      ok(!texto.includes(await p.evaluate(() => J.alvo.j.nome)), 'compartilhar não entrega o nome');
      await p.reload(); await p.waitForSelector('#form-inicio:not([hidden])');
      ok((await p.textContent('#diario small')).includes('feito'), `botão do desafio mostra que já foi feito (${await p.textContent('#diario small')})`);
      await p.click('#diario');
      ok(await p.isVisible('#tela-fim') && !(await p.isVisible('#tela-jogo')), 'segunda tentativa no dia só mostra o resultado');
      ok((await p.evaluate(() => J.chutes.length)) === 1, 'resultado revisto guarda o chute feito');
    }
    await ctx.close();
  }
  ok(nomes[0] === nomes[1], `mesmo jogador do dia nos dois navegadores (${nomes.join(' x ')})`);
  // desafio so de temporada fechada, e muda de um dia pro outro
  const ctx = await b.newContext();
  const p = await abrir(ctx);
  const dias = await p.evaluate(() => ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => { const a = alvoDoDia(d); return `${a.chave}-${a.j.player_id}`; }));
  ok(new Set(dias).size === 3, `três dias, três jogadores (${dias.join(', ')})`);
  const fechadas = ['2024', '2025', 'premier-league-2025', 'laliga-2025', 'champions-2025'];
  const fases = await p.evaluate(() => FASES_DO_DESAFIO.map((f) => [...new Set(candidatos(f.retratos).map((c) => c.chave))].sort()));
  ok(fases.every((f) => f.length && f.every((k) => fechadas.includes(k))), `desafio só sorteia temporada fechada (${JSON.stringify(fases)})`);
  // liga nova entra a partir de uma data: o desafio de um dia que ja passou nao muda
  const dia1 = await p.evaluate(() => faseDoDia('2026-09-30').retratos.includes('laliga-2025'));
  const dia2 = await p.evaluate(() => faseDoDia('2026-10-02').retratos.includes('laliga-2025'));
  ok(!dia1 && dia2, 'LaLiga entra no desafio só a partir de 01/10');
  ok(!dias.some((d) => d.startsWith('2026-')), 'desafio nunca sorteia 2026 (em andamento)');
  const pisoOk = await p.evaluate(() => candidatos(null).every((c) => c.j.minutos >= (c.r.torneio === 7 ? 900 : 1500) && c.j.overall !== null));
  ok(pisoOk, 'sorteio só com nota calculada e 1.500+ minutos (900 na Champions)');
  const ligas = await p.evaluate(() => [...new Set(candidatos(null).map((c) => c.r.populacao))].sort());
  ok(ligas.includes('Brasileirão') && ligas.length >= 3, `partida livre tem o Brasileirão e as ligas da Europa (${ligas})`);
  const soEuropa = await p.evaluate(() => candidatos(LIGAS.europa).every((c) => c.r.populacao !== 'Brasileirão'));
  const soBrasil = await p.evaluate(() => candidatos(LIGAS.brasil).every((c) => c.r.populacao === 'Brasileirão'));
  ok(soEuropa && soBrasil, 'filtro de liga separa Brasileirão e Europa');
  await ctx.close();
}

// 4. celular: nada vaza a largura, campo com 16px+ (sem zoom do iPhone)
for (const vp of [{ width: 375, height: 667 }, { width: 360, height: 740 }]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true });
  const p = await abrir(ctx);
  await p.click('#livre');
  for (let i = 0; i < 3; i++) await chutarId(p, await errado(p, await p.evaluate(() => J.chutes.map((c) => c.id))));
  const larg = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(larg <= vp.width, `${vp.width}px: sem rolagem lateral no jogo (${larg})`);
  const fonte = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('busca')).fontSize));
  ok(fonte >= 16, `${vp.width}px: campo de busca com ${fonte}px`);
  await p.click('#desistir');
  const larg2 = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(larg2 <= vp.width, `${vp.width}px: sem rolagem lateral no fim (${larg2})`);
  await ctx.close();
}

ok(erros.length === 0, `sem erro de JS (${erros.join(' | ')})`);
await b.close();
