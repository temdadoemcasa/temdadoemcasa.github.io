// Prata da Casa: os 4 bugs do playtest de 17/10, cada um com o cenario que o
// reproduzia. Cada checagem falha com o codigo de antes da correcao.
//  1. banco de tecnico + "Ainda tem lenha... mais um ano" no mesmo ano
//  2. ano da despedida com 0 jogos: "Esquentou banco" e "estádio cheio"
//  3. painel e tabela cortando/sobrepondo texto (4 tamanhos de tela)
//  4. "O clube recusou as propostas do..." duas vezes (resumo e janela)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();

async function abrirCarreira(viewport) {
  const p = await b.newPage({ viewport, reducedMotion: 'reduce' });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(BASE + '/prata-da-casa.html');
  await p.waitForFunction(() => typeof C !== 'undefined' && C.r && C.inferiores, null, { timeout: 30000 });
  await p.fill('#nome-camisa', 'Teste'); await p.click('[data-modo="completo"]'); await p.click('.pos-botao:text-is("CA")');
  await p.click('#confirmar-jogador');
  for (let i = 0; i < 40; i++) { const m = p.locator('.atributo-mais:not([disabled])').first(); if (!(await m.count())) break; await m.click(); }
  await p.click('#confirmar-carta');
  await p.locator('.proposta .botao-primario').first().click();
  await p.waitForFunction(() => C.J && C.J.clube && !document.getElementById('tela-carreira').hidden, null, { timeout: 30000 });
  return { p, erros };
}

// ---- 1. o banco de tecnico nao divide o ano com a despedida --------------------------
{
  const { p, erros } = await abrirCarreira({ width: 1280, height: 900 });
  const r = await p.evaluate(() => {
    const titulos = [];
    const novo = () => ({ ...JSON.parse(JSON.stringify(C.J)), idade: 36, ano: 2046, ovr: 80, anosNoClube: 5, temasVistos: [], efeito: efeitoZerado(),
      clube: { ...C.J.clube, nome: 'Vasco', continente: 'america', nivel: 75 } });
    for (let i = 0; i < 40; i++) {
      // veterano de 36 no clube ha 5 anos, com o curso de treinador: o banco chama
      // (cena de marca) e a despedida esta liberada (arco de situacao)
      const J = novo();
      Historia.iniciar(J);
      J.historia.marcas.futuro_tecnico = true;
      J.historia.abriu = { veterano: true };
      let s = i + 1; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 0.5; // sempre < 0,8: a situacao entra
      titulos.push(Historia.eventosDoAno(J, rng, { completo: true, limite: 2 }).map((e) => e.titulo));
    }
    // sem o banco (sem o curso), a despedida segue chegando
    const J = novo();
    Historia.iniciar(J); J.historia.abriu = { veterano: true };
    const sem = Historia.eventosDoAno(J, () => 0.1, { completo: true, limite: 2 }).map((e) => e.titulo);
    return { titulos, sem };
  });
  const juntos = r.titulos.filter((t) => t.includes('O banco te chama') && t.includes('O jogo de despedida')).length;
  const banco = r.titulos.filter((t) => t.includes('O banco te chama')).length;
  ok(banco === r.titulos.length, `1: o banco de técnico chama em todos os ${r.titulos.length} anos montados (${banco})`);
  ok(juntos === 0, `1: banco de técnico e despedida nunca no mesmo ano (${juntos} de ${r.titulos.length} juntos)`);
  ok(r.sem.includes('O jogo de despedida'), `1: sem o banco, a despedida segue chegando (${r.sem.join(' / ')})`);
  ok(!erros.length, `1: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}

// ---- 2. despedida sem jogo: nem banco, nem estadio cheio ------------------------------
{
  const { p, erros } = await abrirCarreira({ width: 1280, height: 900 });
  const r = await p.evaluate(() => {
    const J = C.J;
    J.idade = 39; J.ultimaTemporada = true;
    J.historia.marcas.despedida = J.clube.nome;
    J.efeito.suspenso = true;                      // o ano inteiro fora (temporada perdida)
    const linha = jogarTemporada({ decidir: false });
    mostrarLinha(linha);
    const papel = document.querySelector('#temporada-atual .temporada-papel').textContent;
    const avisos = [...document.querySelectorAll('#temporada-atual .temporada-aviso')].map((x) => x.textContent).join(' / ');
    const depois0 = nomeDoFinal(J).depois;
    // controle: com jogo no ano da despedida, o estadio cheio volta
    const ult = J.historico[J.historico.length - 1];
    const copia = { ...ult, jogos: 20 };
    J.historico[J.historico.length - 1] = copia;
    const depois20 = nomeDoFinal(J).depois;
    mostrarLinha(copia);
    const papel20 = document.querySelector('#temporada-atual .temporada-papel').textContent;
    return { jogos: linha.jogos, apos: J.aposentado, papel, avisos, depois0, depois20, papel20 };
  });
  ok(r.jogos === 0 && r.apos, `2: cenário: ano da despedida com ${r.jogos} jogos e aposentou (${r.apos})`);
  ok(r.papel !== 'Esquentou banco' && /não entrou em campo/i.test(r.papel), `2: 0 jogos não é "Esquentou banco" (${r.papel})`);
  ok(!/estádio cheio/.test(r.depois0 || ''), `2: despedida com 0 jogos não tem estádio cheio (${r.depois0})`);
  ok(!/no jogo de despedida/.test(r.avisos), `2: 0 jogos não "pendurou no jogo de despedida" (${r.avisos})`);
  ok(/estádio cheio/.test(r.depois20 || '') && r.papel20 !== 'Não entrou em campo', `2: com jogos, a despedida segue com estádio cheio (${r.depois20}; ${r.papel20})`);
  ok(!erros.length, `2: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}

// ---- 4. a recusa do clube aparece uma vez so ------------------------------------------
{
  const { p, erros } = await abrirCarreira({ width: 1280, height: 900 });
  const r = await p.evaluate(() => {
    const J = C.J;
    const conta = () => [...document.querySelectorAll('#temporada-atual, #mercado')]
      .reduce((n, el) => n + (el.textContent.match(/recusou (a proposta|as propostas) do/g) || []).length, 0);
    const caso = ({ automatica, pediuSaida }) => {
      const linha = jogarTemporada({ decidir: false });
      if (J.aposentado) return null;
      const outros = clubesDoMundo(J).filter((c) => c.nome !== J.clube.nome).slice(0, 3);
      C.ofertasBarradas = outros; C.ofertasAbertas = [];
      linha.ofertasBarradas = outros.map((c) => c.nome);
      linha.automatica = automatica;
      J.contratoAte = J.ano + 3; J.pediuSaida = pediuSaida;
      mostrarLinha(linha);
      if (!automatica) mostrarMercado(linha);
      else document.getElementById('mercado').replaceChildren();
      const n = conta();
      document.getElementById('mercado').replaceChildren();
      return n;
    };
    return { janela: caso({ automatica: false, pediuSaida: false }), simulado: caso({ automatica: true, pediuSaida: false }),
      jaPediu: caso({ automatica: false, pediuSaida: true }) };
  });
  ok(r.janela === 1, `4: com a janela aberta, "recusou as propostas" aparece uma vez (${r.janela})`);
  ok(r.simulado === 1, `4: ano simulado (sem janela), o aviso fica no resumo (${r.simulado})`);
  ok(r.jaPediu === 1, `4: quem já pediu pra sair (janela sem o pedido) ainda lê a recusa no resumo (${r.jaPediu})`);
  ok(!erros.length, `4: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}

// ---- 3. painel e tabela sem texto cortado ou por cima do OVR ---------------------------
for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844], [360, 640]]) {
  const { p, erros } = await abrirCarreira({ width: w, height: h });
  const tam = `${w}x${h}`;
  const abas = w <= 960;
  await p.evaluate(() => {
    const J = C.J;
    const linha = jogarTemporada({ decidir: false });
    const longos = ['Eintracht Frankfurt', 'Borussia Mönchengladbach', 'Internacional'];
    for (const nome of longos) J.historico.push({ ...linha, clube: nome, ovr: 84, titulos: ['Copa do Brasil', 'Brasileirão'], premios: [] });
    J.clube = { ...J.clube, nome: 'Borussia Mönchengladbach' };
    J.valor = 143.2;
    desenharPainelJogador();
    desenharTabelaCarreira();
  });
  if (abas) await p.locator('button:has-text("Carta")').last().click();
  const painel = await p.evaluate(() => [...document.querySelectorAll('#painel-jogador .painel-fatos dd')].map((dd) => {
    const caixa = dd.parentElement.getBoundingClientRect(), r = dd.getBoundingClientRect();
    return { fato: dd.dataset.fato, txt: dd.textContent, corta: dd.scrollWidth > dd.clientWidth + 1 || getComputedStyle(dd).textOverflow === 'ellipsis' && dd.scrollWidth > dd.clientWidth,
      vaza: r.right > caixa.right + 0.5 };
  }));
  const ruins = painel.filter((x) => x.corta || x.vaza);
  ok(painel.length === 6 && !ruins.length, `3 ${tam}: painel sem texto cortado (${ruins.map((x) => `${x.fato}="${x.txt}"`).join(', ') || 'ok'})`);
  if (abas) await p.locator('button:has-text("Carreira")').last().click();
  const tab = await p.evaluate(() => [...document.querySelectorAll('#tabela-carreira tr')].map((tr) => {
    const nome = tr.querySelector('.tc-clube > span:not(.escudo)'), ovr = tr.querySelector('.tc-ovr b'), td = tr.querySelector('.tc-clube');
    if (!nome || !ovr) return td && td.scrollWidth > td.clientWidth + 1 ? { clube: td.textContent, corta: true } : null;
    const n = nome.getBoundingClientRect(), o = ovr.getBoundingClientRect(), c = td.getBoundingClientRect();
    return { clube: nome.firstChild.textContent, encosta: n.right > o.left - 1, corta: n.right > c.right + 0.5 || nome.scrollWidth > nome.clientWidth + 1 };
  }).filter(Boolean));
  const tRuins = tab.filter((x) => x.encosta || x.corta);
  ok(tab.length >= 4 && !tRuins.length, `3 ${tam}: tabela com o nome do clube inteiro e longe do OVR (${tRuins.map((x) => x.clube).join(', ') || 'ok'})`);
  const rolaX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!rolaX, `3 ${tam}: sem rolagem horizontal`);
  await p.screenshot({ path: `testes/resultados/playtest-${tam}.png`, fullPage: false });
  ok(!erros.length, `3 ${tam}: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}
await b.close();
