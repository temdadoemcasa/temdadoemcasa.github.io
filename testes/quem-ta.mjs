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
  await p.emulateMedia({ reducedMotion: 'reduce' }); // a contagem animada dos numeros comeca em 0
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
    svg: c.querySelector('.carta-figura svg').innerHTML,
    bandeira: !!c.querySelector('.carta-bandeira'),
  };
});

// 1. progressao das dicas
{
  const ctx = await b.newContext();
  const p = await abrir(ctx);
  await p.click('#livre');
  // alvo de linha com 6 atributos calculados, pra contagem ser exata
  await p.evaluate(() => {
    const c = candidatos(null).find((x) => x.j.posicao !== 'G' && paisDe(x.j.player_id) && Object.values(x.j.eixos).filter((v) => typeof v === 'number').length === 6);
    J.alvo = c; J.chutes = []; J.fim = null; J.abertasAntes = null; desenhar();
  });
  let e = await cartaEstado(p);
  ok(e.ocultos === 6 && e.overall === '?' && e.nome === '? ? ?', `antes do 1º chute: 6 atributos, overall e nome escondidos (${e.ocultos}, ${e.overall}, ${e.nome})`);
  ok(/(Brasileirão 20\d\d|Premier \d\d\/\d\d|LaLiga \d\d\/\d\d|Ligue 1 \d\d\/\d\d|Champions \d\d\/\d\d)/.test(e.info), `dica 1 (liga e ano) aparece desde o início (${e.info})`);
  const alvoNome = await p.evaluate(() => J.alvo.j.nome);
  const usados = [];
  const passo = async () => { const id = await errado(p, usados); usados.push(id); await chutarId(p, id); return cartaEstado(p); };
  // o que cada tipo de dica mostra na carta; os ainda fechados seguem escondidos
  const conferir = (e, tipo, aberto) => ({
    atributos: aberto ? e.ocultos === 4 : e.ocultos === 6, // abre so os 2 maiores
    overall: aberto ? /^\d+$/.test(e.overall) : e.overall === '?',
    camisa: aberto ? !/\? J/.test(e.info) : /\? J/.test(e.info),
    cores: aberto ? !e.svg.includes('#2b313a') : e.svg.includes('#2b313a'),
    selecao: aberto ? e.bandeira : !e.bandeira,
    ranking: true,
  })[tipo];
  const ordem = await p.evaluate(() => J.ordem);
  ok(ordem[0] === 'liga' && new Set(ordem).size === 7, `ordem: liga fixa + 6 sorteadas (${ordem.join(', ')})`);
  for (let n = 1; n <= 5; n++) {
    e = await passo();
    const abertos = await p.evaluate(() => document.querySelectorAll('#dicas li.aberta').length);
    const tipo = ordem[n];
    ok(abertos === n + 1 && (await p.evaluate((n) => document.querySelector(`#dicas li:nth-child(${n + 1})`).dataset.tipo, n)) === tipo, `${n} erro(s): abriu a dica ${n + 1} (${tipo})`);
    const certos = ordem.slice(1).every((t, i) => conferir(e, t, i < n));
    ok(certos, `${n} erro(s): a carta mostra só o que já saiu`);
    if (tipo === 'selecao') ok((await p.textContent('#dicas li[data-tipo="selecao"] .dica-valor')).includes(await p.evaluate(() => nomeDoPais(paisDe(J.alvo.j.player_id)))), 'seleção: nome do país no cartão');
    if (tipo === 'ranking') ok(/^\d+º .+ \(de \d+\)$/.test(await p.textContent('#dicas li[data-tipo="ranking"] .dica-valor')), 'ranking na posição no cartão');
  }
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
    const esperado = await p.evaluate(() => { const t = J.ordem[J.chutes.length]; return [TIPOS_DE_DICA[t].titulo.toLowerCase(), textoDaDica(t).replace(/^[^:]*: /, '')]; });
    ok(aviso.includes(esperado[0]) && aviso.includes(esperado[1]), `aviso mostra a dica sorteada com o valor (${aviso})`);
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
  // encostar (comeco de rolagem) nao chuta; so o toque completo (click) chuta
  const antesToque = await p.evaluate(() => J.chutes.length);
  await p.dispatchEvent('#sugestoes .sugestao >> nth=0', 'pointerdown', { pointerType: 'touch' });
  await p.dispatchEvent('#sugestoes .sugestao >> nth=0', 'touchstart');
  ok((await p.evaluate(() => J.chutes.length)) === antesToque, 'encostar numa sugestão (rolando a lista) não chuta');
  await p.evaluate(() => chutar(J.alvo.j.player_id));
  const grade = await p.textContent('#fim-grade');
  const n = await p.evaluate(() => J.chutes.length);
  ok(await p.isVisible('#tela-fim') && [...grade][n - 1] === '🟩' && [...grade].length === 6, `acerto no ${n}º chute: ${grade}`);
  ok(/Acertou|De primeira/.test(await p.textContent('#fim-titulo')), 'título de acerto');
  await ctx.close();
}

// 2b. partida livre: a ordem das dicas muda de partida pra partida
{
  const ctx = await b.newContext();
  const p = await abrir(ctx);
  const ordens = new Set();
  for (let i = 0; i < 6; i++) { await p.evaluate(() => comecar()); ordens.add(await p.evaluate(() => J.ordem.join(','))); }
  ok(ordens.size > 1, `partida livre sorteia as dicas (${ordens.size} ordens diferentes em 6 partidas)`);
  await ctx.close();
}

// 3. desafio do dia: igual em dois navegadores, uma vez so, compartilhar em quadradinhos
{
  const nomes = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await b.newContext();
    const p = await abrir(ctx);
    await p.click('#diario');
    // mesmo jogador E mesma sequencia de dicas sorteadas pra todo mundo
    nomes.push(await p.evaluate(() => `${J.alvo.ano}-${J.alvo.j.player_id}-${J.ordem.join(',')}`));
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
  const fechadas = ['2024', '2025', 'premier-league-2025', 'laliga-2025', 'ligue1-2025', 'champions-2025'];
  const fases = await p.evaluate(() => FASES_DO_DESAFIO.map((f) => [...new Set(candidatos(f.retratos).map((c) => c.chave))].sort()));
  ok(fases.every((f) => f.length && f.every((k) => fechadas.includes(k))), `desafio só sorteia temporada fechada (${JSON.stringify(fases)})`);
  // liga nova entra a partir de uma data: o desafio de um dia que ja passou nao muda
  const dia1 = await p.evaluate(() => faseDoDia('2026-09-30').retratos.includes('laliga-2025'));
  const dia2 = await p.evaluate(() => faseDoDia('2026-10-02').retratos.includes('laliga-2025'));
  ok(!dia1 && dia2, 'LaLiga entra no desafio só a partir de 01/10');
  // Ligue 1 so na partida livre por enquanto: o desafio de 02/10 em diante ja foi anunciado
  const ligueNoDesafio = await p.evaluate(() => FASES_DO_DESAFIO.some((f) => f.retratos.includes('ligue1-2025')));
  const ligueNaLivre = await p.evaluate(() => candidatos(null).some((c) => c.chave === 'ligue1-2025'));
  ok(!ligueNoDesafio && ligueNaLivre, 'Ligue 1 na partida livre e fora do desafio do dia');
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
