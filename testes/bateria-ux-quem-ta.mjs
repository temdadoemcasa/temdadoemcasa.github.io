// Bateria de UX do Quem Tá em Casa?: milhares de partidas jogadas de verdade no navegador,
// cada uma com semente propria, conferindo invariantes de tela a cada passo.
//
//   node testes/bateria-ux-quem-ta.mjs                 (150 casos: o default do CI, ~4-5 min)
//   CASOS=4000 node testes/bateria-ux-quem-ta.mjs      (bateria cheia, ~1h a 1h30)
//   CASO=1234 node testes/bateria-ux-quem-ta.mjs       (reproduz so o caso 1234, com o mesmo contexto)
//   DE=40 CASOS=60 ...                                 (so os casos 40..59, na mesma sequencia)
//   SEMENTE=7 ...                                      (outra familia de sorteios; default 1)
//
// Cada caso sorteia: estado inicial do localStorage (vazio, sequencia em andamento, desafio de hoje
// feito, desafio pela metade, lixo/versao antiga), a data do desafio, o modo (desafio do dia ou livre
// com filtro de liga), como entra (clique, toque ou teclado), a politica do jogador (aleatoria, otima =
// acerta de primeira, ultimo = acerta no 6o, pessima = erra os 6, desiste cedo, apressada com toques
// duplos, recarrega no meio, repete chute, rola a lista sem chutar, so teclado) e como digita (acento,
// maiuscula, espacos, nome completo, pedaco do nome). O contexto (viewport 360x640 a 1440x900, toque ou
// mouse, prefers-reduced-motion, tema claro/escuro) troca a cada 40 casos; ~15% dos casos recarregam a pagina.
//
// Invariantes (uma linha OK/FALHA por invariante, com a contagem de checagens e ate 3 exemplos com
// caso + passo pra reproduzir): sem erro de JS; nenhum texto visivel com undefined/null/NaN/[object/
// Infinity; nada vaza pro lado; botao principal visivel e tocavel; campo com 16px+; contador, dicas e
// chutes batem com o que foi jogado; feedback a cada chute; fim coerente (titulo, grade, revelacao);
// sequencia/recorde; compartilhar (texto, link, sem o nome, botao com resposta); desafio do dia (mesmo
// jogador e mesma ordem pra todo mundo, uma vez por dia, recarregar no meio nao perde o progresso);
// autocompletar (acento/maiuscula, alvo sempre alcancavel pelo nome, chutado sai da lista); rolar a lista
// nao chuta; teclado (setas/Enter, foco visivel); ausencia nunca vira zero (atributo sem dado = "—",
// chute sem nota = "— OVR").
// O resumo vai pra testes/resultados/bateria-ux-quem-ta.txt.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8766';
const CASOS = Number(process.env.CASOS || 150);
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.CASO !== undefined ? Number(process.env.CASO) : null;
const POR_CONTEXTO = 40;
const LIMITE_CASO_MS = 30000;

// --- sorteio reproduzivel ----------------------------------------------------
function rngDe(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const sorteador = (semente) => {
  const r = rngDe(semente);
  const s = {
    r,
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    um: (lista) => lista[Math.floor(r() * lista.length)],
    chance: (p) => r() < p,
    peso: (pares) => { const t = pares.reduce((x, [, p]) => x + p, 0); let v = r() * t; for (const [k, p] of pares) { if ((v -= p) < 0) return k; } return pares[pares.length - 1][0]; },
  };
  return s;
};

// --- placar das invariantes --------------------------------------------------
const placar = new Map(); // nome -> { ok, falha, exemplos: [] }
let casoAtual = -1;
let passo = '';
let tMarca = Date.now();
const marca = (x) => { if (process.env.TRILHA) console.log(`   [${casoAtual}] +${Date.now() - tMarca}ms ${passo}`); tMarca = Date.now(); passo = x; };
let ultimoFoiDuplo = false; // 2o toque de um toque duplo cai fora do titulo e leva o foco (normal)
function checar(nome, cond, detalhe = '') {
  if (!placar.has(nome)) placar.set(nome, { ok: 0, falha: 0, exemplos: [] });
  const p = placar.get(nome);
  if (cond) p.ok++;
  else {
    p.falha++;
    if (p.exemplos.length < 3) p.exemplos.push(`caso=${casoAtual} passo="${passo}"${detalhe ? ` (${String(detalhe).slice(0, 220)})` : ''}`);
  }
  return cond;
}

// --- contextos ---------------------------------------------------------------
const VIEWPORTS = [[360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800], [1440, 900]];
function configDoContexto(indice) {
  const s = sorteador(SEMENTE * 7919 + indice * 104729);
  const [w, h] = s.um(VIEWPORTS);
  return { w, h, toque: w <= 768 ? s.chance(0.85) : s.chance(0.1), movimento: s.chance(0.3), claro: s.chance(0.4) };
}

// a auditoria roda dentro da pagina (uma ida e volta so)
function auditoriaNaPagina() {
  window.__auditar = (onde) => {
    const prob = [];
    const vw = document.documentElement.clientWidth;
    const visivel = (e) => { if (!e) return false; const s = getComputedStyle(e); const q = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && q.width > 0 && q.height > 0 && !e.closest('[hidden]'); };
    const telas = [...document.querySelectorAll('.quem .tela')].filter((t) => !t.hidden);
    if (telas.length !== 1) prob.push(`telas visiveis: ${telas.length}`);
    // texto visivel podre
    const texto = document.querySelector('main').innerText;
    const podre = /\b(undefined|null|NaN|Infinity)\b|\[object/.exec(texto);
    if (podre) prob.push(`texto podre: "${texto.slice(Math.max(0, podre.index - 30), podre.index + 30).replace(/\s+/g, ' ')}"`);
    if (/(^|\s)-\d{2,}/.test(texto)) prob.push('numero negativo na tela');
    // vazamento lateral
    if (document.scrollingElement.scrollWidth > vw + 1) prob.push(`rola de lado (${document.scrollingElement.scrollWidth} > ${vw})`);
    // botoes: nome acessivel e tamanho
    const essenciais = { 'tela-inicio': ['diario', 'livre'], 'tela-jogo': ['busca', 'desistir'], 'tela-fim': ['compartilhar', 'de-novo', 'voltar'] }[telas[0] && telas[0].id] || [];
    for (const id of essenciais) {
      const e = document.getElementById(id);
      if (!visivel(e)) { prob.push(`#${id} invisivel`); continue; }
      const q = e.getBoundingClientRect();
      if (Math.min(q.width, q.height) < 24) prob.push(`#${id} pequeno (${Math.round(q.width)}x${Math.round(q.height)})`);
      if (q.left < -1 || q.right > vw + 1) prob.push(`#${id} cortado na lateral`);
    }
    for (const bt of document.querySelectorAll('main button')) {
      if (!visivel(bt)) continue;
      const nome = (bt.getAttribute('aria-label') || bt.textContent || '').trim();
      if (!nome) prob.push(`botao sem nome (${bt.id || bt.className})`);
    }
    const busca = document.getElementById('busca');
    if (visivel(busca) && parseFloat(getComputedStyle(busca).fontSize) < 16) prob.push('campo < 16px');
    return { onde, prob, tela: telas[0] && telas[0].id };
  };
  // o que a pagina chama de "compartilhar" fica registrado
  window.__compartilhados = [];
}

// --- bateria -----------------------------------------------------------------
mkdirSync('testes/resultados', { recursive: true });
const b = await chromium.launch();
const inicioGeral = Date.now();
let rodados = 0;
let ctx = null, p = null, cfgAtual = null, opcoes = null;
const errosJs = [];

async function abrirContexto(indice) {
  if (ctx) await ctx.close();
  cfgAtual = configDoContexto(indice);
  ctx = await b.newContext({
    viewport: { width: cfgAtual.w, height: cfgAtual.h },
    isMobile: cfgAtual.toque && cfgAtual.w <= 768, hasTouch: cfgAtual.toque,
    reducedMotion: cfgAtual.movimento ? 'no-preference' : 'reduce',
    timezoneId: 'America/Sao_Paulo', locale: 'pt-BR',
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(auditoriaNaPagina);
  if (cfgAtual.claro) await ctx.addInitScript(() => { try { if (!localStorage.getItem('tema')) localStorage.setItem('tema', 'claro'); } catch { /* ok */ } });
  p = await ctx.newPage();
  p.on('pageerror', (e) => errosJs.push({ caso: casoAtual, passo, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error' && !/goatcounter|gc\.zgo|fonts\.g|net::ERR/.test(m.text())) errosJs.push({ caso: casoAtual, passo, msg: 'console.error: ' + m.text() }); });
  // bloqueia o contador externo e as fontes: a bateria nao depende de rede
  await p.route(/gc\.zgo\.at|goatcounter|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await carregar();
  opcoes = await p.evaluate(() => J.opcoes.map((o) => [o.id, o.nome, o.nome_completo || '']));
}
async function carregar() {
  await p.goto(BASE + '/quem-ta-em-casa.html');
  await p.waitForSelector('#form-inicio:not([hidden])', { timeout: 15000 });
  await semearPagina();
}
// o sorteio da partida livre (Math.random da pagina) tambem segue a semente do caso: CASO=n reproduz
let sementeDaPagina = 1;
async function semearPagina() {
  await p.evaluate((sem) => {
    let a = sem >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }, sementeDaPagina);
}
async function auditar(onde) {
  const r = await p.evaluate((o) => window.__auditar(o), onde);
  checar(`tela sem defeito visual (${r.tela || '?'})`, !r.prob.length, `${onde}: ${r.prob.join('; ')}`);
  return r;
}
const tocar = async (sel) => { const o = { timeout: Number(process.env.T_ACAO || 8000) }; if (cfgAtual.toque) await p.tap(sel, o); else await p.click(sel, o); };
// toque de gente: o navegador junta dois toques no mesmo ponto em menos de ~500 ms num "duplo" (detail 2, 3...), e o jogo
// ignora de proposito (protecao de toque fantasma; o campo de busca fica perto de Inicio/Compartilhar). Quem aperta
// Compartilhar/Inicio/Jogar de novo depois de ler o fim nao toca colado no ultimo toque (nem sempre feito por `tocar`: campo
// de busca, sugestao). A espera so existe aqui; os testes de toque duplo seguem com `duplo`.
const tocarHumano = async (sel) => { await p.waitForTimeout(650); await tocar(sel); };
// toque duplo de verdade: o 2o toque cai no mesmo ponto, no que estiver la depois do 1o
const duplo = async (sel) => {
  // a pagina pode estar rolando (o campo sobe no celular 250 ms depois do toque): espera a posicao parar
  await p.waitForTimeout(300);
  await p.locator(sel).scrollIntoViewIfNeeded({ timeout: 3000 });
  let q = await p.locator(sel).boundingBox({ timeout: 3000 });
  for (let t = 0; t < 20; t++) {
    await p.waitForTimeout(40);
    const q2 = await p.locator(sel).boundingBox({ timeout: 3000 });
    if (q2 && q && q2.x === q.x && q2.y === q.y) break;
    q = q2;
  }
  const x = q.x + q.width / 2, y = q.y + q.height / 2;
  if (cfgAtual.toque) { await p.touchscreen.tap(x, y); await p.touchscreen.tap(x, y); } else await p.mouse.dblclick(x, y);
};
const tela = () => p.evaluate(() => [...document.querySelectorAll('.quem .tela')].find((t) => !t.hidden).id);

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function variarTermo(s, nome, completo) {
  const forma = s.peso([['igual', 3], ['maiuscula', 2], ['minuscula-sem-acento', 3], ['espacos', 1], ['bagunca', 1], ['completo', 1], ['pedaco', 2]]);
  switch (forma) {
    case 'maiuscula': return [nome.toUpperCase(), forma];
    case 'minuscula-sem-acento': return [semAcento(nome).toLowerCase(), forma];
    case 'espacos': return [`  ${nome.replace(/ /g, '  ')} `, forma];
    case 'bagunca': return [[...nome].map((c) => (s.chance(0.5) ? c.toUpperCase() : c.toLowerCase())).join(''), forma];
    case 'completo': return [completo || nome, forma];
    case 'pedaco': return [nome.slice(0, Math.max(3, Math.ceil(nome.length * 0.6))), forma];
    default: return [nome, forma];
  }
}

// estado inicial do localStorage antes de abrir a pagina (ou antes de comecar, sem recarregar)
function estadoInicial(s, data) {
  const tipo = s.peso([['vazio', 5], ['serie', 3], ['diario-feito', 1], ['diario-ontem', 1], ['lixo', 1.5], ['liga', 1]]);
  const ls = {};
  if (tipo === 'serie') ls['quem-ta-serie'] = JSON.stringify({ atual: s.int(0, 6), melhor: s.int(6, 12) });
  if (tipo === 'liga') ls['quem-ta-liga'] = s.um(['brasil', 'europa', 'tudo', 'xablau']);
  if (tipo === 'diario-ontem') ls['quem-ta-diario'] = JSON.stringify({ data: '2026-09-29', numero: 0, como: 'acertou', chave: '2025', id: 1, chutes: [1] });
  if (tipo === 'lixo') {
    const lixo = s.um(['{', '5', '"texto"', '[]', '{}', 'null', '{"atual":"3","melhor":-2}', '{"atual":null}', '[1,2,{"x":1}]', '{"data":"HOJE"}', '{"data":"HOJE","como":"acertou"}', '{"data":"HOJE","numero":3,"como":"acertou","chave":"2025","id":"abc","chutes":"x"}']).replace('HOJE', data);
    ls[s.um(['quem-ta-serie', 'quem-ta-vistos', 'quem-ta-diario', 'quem-ta-liga', 'quem-ta-diario-andamento'])] = lixo;
  }
  return { tipo, ls };
}

async function aplicarEstado(estado, recarregar) {
  await p.evaluate((ls) => { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, estado.ls);
  if (recarregar) { marca('recarrega com o estado inicial'); await carregar(); }
  else await p.evaluate(() => { if (typeof mostrarInicio === 'function') mostrarInicio(); else mostrarTela('tela-inicio'); J.liga = 'tudo'; J.fim = null; J.chutes = []; atualizarBotaoDiario(); window.scrollTo(0, 0); });
}

// desafio de hoje ja feito? (pra o modelo do teste)
const feitoHoje = () => p.evaluate(() => { try { const d = JSON.parse(localStorage.getItem('quem-ta-diario')); return d && d.data === hojeLocal() && Array.isArray(d.chutes) ? d : null; } catch { return null; } });

async function lerJogo() {
  return p.evaluate(() => ({
    alvo: J.alvo && { id: J.alvo.j.player_id, nome: J.alvo.j.nome, chave: J.alvo.chave, time: J.alvo.time.nome, pos: J.alvo.j.posicao, eur: !!(J.alvo.r.torneio && J.alvo.r.torneio !== 325) },
    chutes: J.chutes.map((c) => c.id), fim: J.fim, diario: J.diario, ordem: J.ordem,
  }));
}

// confere a tela do jogo contra o que foi jogado
async function conferirJogo(n, ultimoAviso, retomou = false) {
  const r = await p.evaluate(() => {
    const abertas = document.querySelectorAll('#dicas li.aberta').length;
    const linhas = [...document.querySelectorAll('#chutes li')];
    const vidas = [...document.querySelectorAll('#contador .vida')];
    const ordem = J.ordem;
    const tiposAbertos = [...document.querySelectorAll('#dicas li.aberta')].map((li) => li.dataset.tipo);
    // ausencia nunca vira zero: atributo sem dado = "—", nunca 0
    const nulos = eixosDaCarta(J.alvo.j, J.alvo.r.eixos).filter(([, , v]) => v === null).length;
    const semDado = [...document.querySelectorAll('#carta-misterio .sem-dado dd')];
    const semNota = J.chutes.map((c, i) => [c.carta.j.overall === null, linhas[J.chutes.length - 1 - i] && linhas[J.chutes.length - 1 - i].textContent]);
    return {
      abertas, linhas: linhas.length, nomes: linhas.map((l) => l.querySelector('.chute-nome').textContent),
      erradas: vidas.filter((v) => v.classList.contains('errada')).length, vidas: vidas.length,
      atual: vidas.findIndex((v) => v.classList.contains('atual')),
      tiposOk: tiposAbertos.every((t, i) => t === ordem[i]),
      // atributo sem dado: "—" quando aberto, "?" enquanto escondido; nunca um numero
      nulos, semDado: semDado.length, semDadoTexto: semDado.every((d) => d.textContent === '—' || d.textContent === '?'),
      semNotaOk: semNota.every(([sem, t]) => !sem || (t.includes('— OVR') && !/[⬆⬇]/.test(t))),
      aviso: document.getElementById('aviso').textContent,
      modo: document.getElementById('modo').textContent,
      chutesJ: J.chutes.length,
    };
  });
  checar('jogo: dicas abertas = erros + 1, na ordem sorteada', r.abertas === Math.min(6, n + 1) && r.tiposOk, `abertas=${r.abertas} erros=${n}`);
  checar('jogo: lista de chutes e bolinhas batem com o jogado', r.linhas === n && r.chutesJ === n && r.erradas === n && r.vidas === 6 && r.atual === n, JSON.stringify({ l: r.linhas, e: r.erradas, a: r.atual, n }));
  checar('ausência nunca vira zero (atributo "—", chute sem nota "— OVR")', r.nulos === r.semDado && r.semDadoTexto && r.semNotaOk, JSON.stringify({ nulos: r.nulos, semDado: r.semDado }));
  checar('jogo: modo no topo (Desafio #N ou Partida livre)', /^(Desafio #\d+|Partida livre)$/.test(r.modo), r.modo);
  if (retomou) checar('desafio retomado: aviso diz quantos chutes já foram', new RegExp(`${n} chutes? já fo`).test(r.aviso), r.aviso);
  else if (n > 0) checar('feedback a cada erro: aviso com a dica nova', r.aviso.length > 10 && r.aviso !== ultimoAviso && r.aviso.includes(r.nomes[0]), r.aviso);
  return r;
}

// um chute pela tela: digita, acha na lista e escolhe (clique/toque/teclado/duplo)
async function chutarPelaTela(s, id, politica, rapido) {
  ultimoFoiDuplo = false;
  const [, nome, completo] = opcoes.find((o) => o[0] === id);
  let [termo, forma] = variarTermo(s, nome, completo);
  marca(`digita "${termo}" (${forma}) pra chutar ${id}`);
  const modo = s.peso([['fill', 6], ['tecla', 2]]);
  if (!rapido && cfgAtual.toque) await p.tap('#busca').catch(() => {});
  if (modo === 'fill') await p.fill('#busca', termo);
  else { await p.fill('#busca', ''); await p.locator('#busca').pressSequentially(termo); }
  let lista = await p.evaluate(() => ({ ids: sugestoes.map((o) => o.id), aberta: !document.getElementById('sugestoes').hidden }));
  if (!lista.ids.includes(id)) {
    // pedaco do nome pode nao trazer o alvo entre os 8: com o nome inteiro tem que trazer
    if (forma === 'pedaco' || forma === 'completo') {
      termo = nome; marca(`digita o nome inteiro "${nome}" pra chutar ${id}`);
      await p.fill('#busca', termo);
      lista = await p.evaluate(() => ({ ids: sugestoes.map((o) => o.id), aberta: !document.getElementById('sugestoes').hidden }));
    }
  }
  const alcancavel = checar('autocompletar: digitar o nome (acento/maiúscula/espaço) traz o jogador', lista.ids.includes(id), `"${termo}" -> ${lista.ids.length} sugestões`);
  if (!alcancavel) { await p.evaluate((i) => chutar(i), id); return 'direto'; }
  checar('autocompletar: lista aberta enquanto digita', lista.aberta, `"${termo}"`);
  const aria = await p.evaluate(() => ({ exp: document.getElementById('busca').getAttribute('aria-expanded'), ad: document.getElementById('busca').getAttribute('aria-activedescendant') }));
  checar('acessibilidade: combobox com aria-expanded e activedescendant', aria.exp === 'true' && /^sug-\d$/.test(aria.ad), JSON.stringify(aria));
  if (s.chance(0.06)) await auditar('autocompletar aberto');

  // rolar a lista com o dedo/roda em cima de um nome nao chuta
  if (politica === 'rolagem' || s.chance(0.05)) {
    marca('rola a lista de sugestões sem escolher');
    const antes = await p.evaluate(() => J.chutes.length);
    await p.dispatchEvent('#sugestoes .sugestao >> nth=0', 'pointerdown', { pointerType: 'touch' });
    await p.dispatchEvent('#sugestoes .sugestao >> nth=0', 'touchstart');
    await p.evaluate(() => { const ul = document.getElementById('sugestoes'); ul.scrollTop = 40; ul.dispatchEvent(new Event('scroll')); });
    await p.mouse.wheel(0, 120);
    await p.dispatchEvent('#sugestoes .sugestao >> nth=0', 'touchend').catch(() => {});
    checar('rolar a lista de sugestões não chuta', (await p.evaluate(() => J.chutes.length)) === antes);
    await p.waitForTimeout(250); // a lista para de deslizar antes do toque (gente espera parar pra escolher)
  }

  const idx = (await p.evaluate(() => sugestoes.map((o) => o.id))).indexOf(id);
  if (idx < 0) { checar('autocompletar: lista aberta enquanto digita', false, `lista sumiu antes de escolher (${termo})`); await p.evaluate((i) => chutar(i), id); return 'direto'; }
  const como = politica === 'teclado' ? 'teclado' : politica === 'apressada' ? s.um(['duplo', 'duplo', 'clique']) : s.peso([['clique', 5], ['teclado', 3], ['duplo', 0.5]]);
  marca(`escolhe ${id} (${como}, posição ${idx})`);
  if (como === 'teclado') {
    const subir = s.chance(0.3) && idx > 0;
    const vezes = subir ? (await p.evaluate(() => sugestoes.length)) - idx : idx;
    for (let i = 0; i < vezes; i++) await p.keyboard.press(subir ? 'ArrowUp' : 'ArrowDown');
    const marcado = await p.evaluate(() => document.querySelector('#sugestoes [aria-selected="true"]')?.id);
    checar('teclado: setas marcam a sugestão certa', marcado === `sug-${idx}`, `${marcado} != sug-${idx}`);
    await p.keyboard.press('Enter');
    if (politica === 'apressada') await p.keyboard.press('Enter');
  } else if (como === 'duplo') {
    await duplo(`#sug-${idx}`); ultimoFoiDuplo = true;
  } else await tocar(`#sug-${idx}`);
  const ultimo = await p.evaluate(() => J.chutes.length && J.chutes[J.chutes.length - 1].id);
  checar('o chute registrado é o jogador escolhido na lista', ultimo === id, `queria ${id}, registrou ${ultimo}`);
  return como;
}

async function compartilhar(s, esperado) {
  // como o navegador compartilha: share nativo (celular), area de transferencia, ou nenhum dos dois
  const via = s.peso([['share', 2], ['clipboard', 3], ['clipboard-falha', 1], ['share-cancela', 1]]);
  marca(`compartilha (${via})`);
  await p.evaluate((via) => {
    window.__compartilhados = [];
    if (via === 'share') navigator.share = async (d) => { window.__compartilhados.push(d.text); };
    else if (via === 'share-cancela') navigator.share = async () => { throw new DOMException('cancelou', 'AbortError'); };
    else { try { delete navigator.share; } catch { /* ok */ } navigator.share = undefined; }
    if (via === 'clipboard-falha') navigator.clipboard.writeText = async () => { throw new DOMException('negado', 'NotAllowedError'); };
    else if (via === 'clipboard') navigator.clipboard.writeText = async (t) => { window.__compartilhados.push(t); };
  }, via);
  const antes = await p.evaluate(() => document.getElementById('tela-fim').innerText);
  await tocarHumano('#compartilhar');
  await p.waitForTimeout(30);
  const r = await p.evaluate(() => ({ feitos: window.__compartilhados, texto: document.getElementById('tela-fim').innerText, botao: document.getElementById('compartilhar').textContent }));
  if (via === 'share' || via === 'clipboard') checar('compartilhar: entrega o texto do resultado', r.feitos.length === 1 && r.feitos[0] === esperado, JSON.stringify(r.feitos));
  if (via !== 'share-cancela') checar('compartilhar: o botão sempre dá resposta (copiado, aberto ou como copiar)', via === 'share' || r.texto !== antes, `${via}: nada mudou na tela (botão "${r.botao}")`);
}

async function conferirFim(s, ctxCaso) {
  const { como, n, alvo, diario, serieAntes, revisao } = ctxCaso;
  // gente nao clica nos botoes do fim no mesmo instante em que ele aparece (protecao do toque fantasma,
  // conferida logo depois do toque duplo): aqui o relogio da protecao e adiantado pra bateria nao esperar
  await p.evaluate(() => { J.fimDesde = -1e9; });
  const r = await p.evaluate(() => ({
    destaque: document.getElementById('fim-destaque').textContent,
    titulo: document.getElementById('fim-titulo').textContent,
    texto: document.getElementById('fim-texto').textContent,
    grade: document.getElementById('fim-grade').textContent,
    serie: document.getElementById('fim-serie').textContent,
    diario: document.getElementById('fim-diario').textContent,
    linhas: document.querySelectorAll('#fim-chutes li').length,
    compart: J.textoCompartilhar,
    deNovo: document.getElementById('de-novo').textContent,
    focoTitulo: document.activeElement === document.getElementById('fim-titulo'), foco: (document.activeElement && (document.activeElement.id || document.activeElement.tagName)),
    cartaNome: document.querySelector('#fim-carta .carta-nome')?.textContent,
    nulos: eixosDaCarta(J.alvo.j, J.alvo.r.eixos).filter(([, , v]) => v === null).length,
    semDado: [...document.querySelectorAll('#fim-carta .sem-dado dd')].filter((d) => d.textContent === '—').length,
    serieLs: (() => { try { return JSON.parse(localStorage.getItem('quem-ta-serie')); } catch { return 'lixo'; } })(),
  }));
  const q = [...r.grade];
  const acertou = como === 'acertou';
  checar('fim: grade com 6 quadrados, 🟩 só no acerto e no último chute', q.length === 6 && q.filter((c) => c !== '⬜').length === n && (acertou ? q[n - 1] === '🟩' && q.filter((c) => c === '🟩').length === 1 : !q.includes('🟩')), `${r.grade} como=${como} n=${n}`);
  checar('fim: título coerente com o resultado', acertou ? /Acertou|De primeira/.test(r.titulo) && (n === 1 ? /primeira/i.test(r.titulo) : r.titulo.includes(`${n}º`)) : !/Acertou|primeira/i.test(r.titulo) && r.titulo.length > 5, `${como}/${n}: ${r.titulo}`);
  checar('fim: revela quem era (nome na carta e no texto)', r.cartaNome === alvo.nome && r.texto.length > 10, `${r.cartaNome} x ${alvo.nome}`);
  checar('fim: chutes listados = chutes feitos', r.linhas === n, `${r.linhas} x ${n}`);
  checar('fim: sempre destaca algo positivo (o que fez de bom ou o convite pra próxima)', r.destaque.length > 20, r.destaque);
  checar('ausência nunca vira zero na carta revelada', r.nulos === r.semDado, `${r.nulos} x ${r.semDado}`);
  if (!ultimoFoiDuplo && !revisao) checar('fim: foco no título (leitor de tela anuncia o resultado)', r.focoTitulo, `foco em ${r.foco}`);
  const placarTxt = acertou ? `${n}/6` : 'X/6';
  const re = diario
    ? new RegExp(`^Quem Tá em Casa\\? · Desafio #${diario.numero} · ${placarTxt.replace('/', '\\/')}\\n[🟩🟨🟥⬜]{6}\\ntemdadoemcasa\\.github\\.io/quem-ta-em-casa\\.html#desafio$`, 'u')
    : new RegExp(`^Quem Tá em Casa\\? · ${placarTxt.replace('/', '\\/')}\\n[🟩🟨🟥⬜]{6}\\ntemdadoemcasa\\.github\\.io/quem-ta-em-casa\\.html$`, 'u');
  checar('compartilhar: texto no formato, com placar e link certos', re.test(r.compart) && r.compart.length < 200, JSON.stringify(r.compart));
  checar('compartilhar: não entrega o nome do jogador', !r.compart.toLowerCase().includes(alvo.nome.toLowerCase()), alvo.nome);
  // sequencia: acertou soma 1, o resto zera; rever o desafio nao conta
  if (!revisao) {
    const esperado = { atual: acertou ? serieAntes.atual + 1 : 0 };
    esperado.melhor = Math.max(serieAntes.melhor, esperado.atual);
    checar('sequência: acerto soma, erro/desistência zera, recorde guarda o maior', r.serieLs && r.serieLs.atual === esperado.atual && r.serieLs.melhor === esperado.melhor, `antes ${JSON.stringify(serieAntes)} ${como} -> ${JSON.stringify(r.serieLs)}`);
    const nums = (r.serie.match(/\d+/g) || []).map(Number);
    checar('sequência: texto da tela bate com o guardado', nums.every((x) => x === esperado.atual || x === esperado.melhor) && (esperado.atual > 1 ? nums.includes(esperado.atual) : true), `"${r.serie}" ${JSON.stringify(esperado)}`);
  }
  await auditar(`fim ${como}`);
  // compartilhar
  if (s.chance(0.35)) await compartilhar(s, r.compart);
  return r;
}

async function serieAgora() {
  return p.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('quem-ta-serie')); return { atual: Number.isInteger(s?.atual) && s.atual >= 0 ? s.atual : 0, melhor: Number.isInteger(s?.melhor) && s.melhor >= 0 ? Math.max(s.melhor, Number.isInteger(s?.atual) && s.atual >= 0 ? s.atual : 0) : 0 }; } catch { return { atual: 0, melhor: 0 }; } });
}

// --- um caso -----------------------------------------------------------------
async function caso(i) {
  const s = sorteador(SEMENTE * 1000003 + i * 9973);
  sementeDaPagina = SEMENTE * 31337 + i;
  await semearPagina();
  // data do desafio: de 30/09/2026 a ~5 meses depois (meio-dia, sem risco de virar o dia)
  const dia = s.int(0, 150);
  const d = new Date(Date.UTC(2026, 8, 30 + dia, 15));
  const data = d.toISOString().slice(0, 10);
  await p.evaluate(() => { window.__compartilhados = []; });
  marca(`fixa a data ${data}`);
  ultimoFoiDuplo = false;
  await p.clock.setFixedTime(new Date(`${data}T12:00:00-03:00`));
  const estado = estadoInicial(s, data);
  const recarregar = estado.tipo === 'lixo' || s.chance(0.12);
  marca(`estado inicial ${estado.tipo}`);
  await aplicarEstado(estado, recarregar);
  const politica = s.peso([['aleatoria', 5], ['otima', 2], ['ultimo', 2], ['pessima', 2], ['desiste', 2], ['apressada', 2], ['recarrega', 2], ['repetido', 1.5], ['rolagem', 1], ['teclado', 2], ['vazio', 1]]);
  const rapido = politica === 'apressada' || s.chance(0.5);
  marca(`início (${politica})`);
  if ((await tela()) !== 'tela-inicio') { checar('carrega na tela de início', false, await tela()); return; }
  await auditar('início');
  // desafio feito hoje: o botao diz
  const feito = await feitoHoje();
  const small = await p.textContent('#diario small');
  checar('início: botão do desafio diz se já foi feito hoje', feito ? small.includes('feito') : !small.includes('feito') && /#\d+/.test(small), `${small} feito=${!!feito}`);
  const ser = await serieAgora();
  const txtSerie = await p.textContent('#inicio-serie');
  const numsSerie = (txtSerie.match(/\d+/g) || []).map(Number);
  checar('início: sequência/recorde visível e coerente com o guardado', ser.melhor > 1 ? numsSerie.includes(ser.melhor) && numsSerie.every((x) => x === ser.atual || x === ser.melhor) : txtSerie.length > 10 && !numsSerie.length, `"${txtSerie}" ${JSON.stringify(ser)}`);

  const modo = s.chance(0.4) ? 'diario' : 'livre';
  const liga = s.um(['tudo', 'brasil', 'europa', null]);
  if (modo === 'livre' && liga) { marca(`escolhe a liga ${liga}`); await tocar(`#ligas [data-liga="${liga}"]`); checar('chips de liga: só o escolhido marcado', (await p.evaluate(() => [...document.querySelectorAll('#ligas .chip')].filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.liga).join())) === liga); }
  const ligaFinal = await p.evaluate(() => J.liga);
  marca(`entra no ${modo}`);
  const botao = modo === 'diario' ? '#diario' : '#livre';
  if (politica === 'teclado') {
    // so teclado: Tab ate o botao, foco visivel, Enter
    if (modo === 'diario') { await p.focus('#livre'); await p.keyboard.press('Shift+Tab'); } else { await p.focus('#diario'); await p.keyboard.press('Tab'); }
    const foco = await p.evaluate((sel) => { const e = document.activeElement; const st = getComputedStyle(e); return { ok: e === document.querySelector(sel), contorno: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0 }; }, botao);
    checar('teclado: foco chega no botão e é visível', foco.ok && foco.contorno, JSON.stringify(foco));
    await p.keyboard.press('Enter');
  } else if (politica === 'apressada') await duplo(botao);
  else await tocar(botao);

  let jogo = await lerJogo();
  const serieAntes = await serieAgora();
  if (modo === 'diario' && feito) {
    // ja jogou hoje: so revisa
    checar('desafio do dia: só uma vez por dia (segunda vez mostra o resultado)', (await tela()) === 'tela-fim' && jogo.chutes.join() === feito.chutes.filter((x) => opcoes.some((o) => o[0] === x)).join(), `${await tela()} ${jogo.chutes} x ${feito.chutes}`);
    if ((await tela()) === 'tela-fim') await conferirFim(s, { como: feito.como, n: jogo.chutes.length, alvo: jogo.alvo, diario: jogo.diario, serieAntes, revisao: true });
    return;
  }
  if (!checar('entrar leva pra partida', (await tela()) === 'tela-jogo', await tela())) return;
  if (modo === 'diario') {
    const esperado = await p.evaluate((dt) => { const a = alvoDoDia(dt); return { id: a.j.player_id, chave: a.chave, ordem: ordemDoDia(dt).join(), numero: numeroDoDesafio(dt) }; }, data);
    checar('desafio do dia: jogador, ordem das dicas e número da data (igual pra todo mundo)', jogo.alvo.id === esperado.id && jogo.alvo.chave === esperado.chave && jogo.ordem.join() === esperado.ordem && jogo.diario.numero === esperado.numero, JSON.stringify([jogo.alvo, esperado]));
  } else {
    checar('partida livre: carta respeita o filtro de liga', ligaFinal === 'brasil' ? !jogo.alvo.eur : ligaFinal === 'europa' ? jogo.alvo.eur : true, `${ligaFinal} ${jogo.alvo.chave}`);
  }
  await auditar('jogo no início');
  await conferirJogo(0);

  // o que a politica vai fazer: k erros e depois acerta/desiste/erra tudo
  const plano = {
    aleatoria: () => ({ erros: s.int(0, 6), fim: s.um(['acerta', 'acerta', 'desiste']) }),
    otima: () => ({ erros: 0, fim: 'acerta' }),
    ultimo: () => ({ erros: 5, fim: 'acerta' }),
    pessima: () => ({ erros: 6, fim: 'erra' }),
    desiste: () => ({ erros: s.int(0, 2), fim: 'desiste' }),
    apressada: () => ({ erros: s.int(0, 5), fim: s.um(['acerta', 'desiste']) }),
    recarrega: () => (s.chance(0.3) ? { erros: 6, fim: 'erra' } : { erros: s.int(1, 4), fim: 'acerta' }),
    repetido: () => ({ erros: s.int(1, 4), fim: 'acerta' }),
    rolagem: () => ({ erros: s.int(0, 3), fim: 'acerta' }),
    teclado: () => ({ erros: s.int(0, 5), fim: s.um(['acerta', 'desiste']) }),
    vazio: () => ({ erros: s.int(0, 2), fim: 'desiste' }),
  }[politica]();
  if (plano.erros >= 6) plano.fim = 'erra';
  const recarregaEm = politica === 'recarrega' ? s.int(1, Math.min(5, plano.erros)) : -1;

  let ultimoAviso = '';
  const usados = new Set([jogo.alvo.id]);
  for (let k = 0; k < plano.erros; k++) {
    // errado: as vezes um companheiro de clube/posicao (pra cair no 🟨), as vezes qualquer um
    let id;
    if (s.chance(0.35)) id = await p.evaluate((u) => { const a = J.alvo; const par = a.time.jogadores.filter((j) => !u.includes(j.player_id) && J.cartasDe.has(j.player_id)); return par.length ? par[Math.floor(Math.random() * par.length)].player_id : null; }, [...usados]);
    if (!id) do { id = s.um(opcoes)[0]; } while (usados.has(id));
    usados.add(id);
    // campo vazio ou nome que nao existe: Enter nao chuta e a tela avisa
    if (politica === 'vazio' && k === 0) {
      marca('Enter com nome que não existe');
      await p.fill('#busca', s.um(['zzqx', 'Pelé Pelé Pelé', '12345']));
      checar('busca sem resultado mostra o aviso de "nenhum jogador"', await p.isVisible('#sem-sugestao'));
      await p.keyboard.press('Enter');
      checar('Enter sem sugestão não chuta', (await p.evaluate(() => J.chutes.length)) === k);
      await p.fill('#busca', s.um(['', 'a']));
      await p.keyboard.press('Enter');
      checar('Enter com campo vazio responde (diz o que fazer)', (await p.isVisible('#sem-sugestao')) && (await p.evaluate(() => J.chutes.length)) === k);
      await p.fill('#busca', '');
    }
    await chutarPelaTela(s, id, politica, rapido);
    marca(`confere depois do erro ${k + 1}`);
    if (k + 1 >= 6) break;
    if (ultimoFoiDuplo && !checar('toque duplo numa sugestão errada não desiste nem termina sozinho', (await tela()) === 'tela-jogo', await tela())) return;
    const r = await conferirJogo(k + 1, ultimoAviso);
    ultimoAviso = r.aviso;
    if (s.chance(0.25)) await auditar(`jogo depois de ${k + 1} erro(s)`);
    if (politica === 'repetido') {
      marca('tenta chutar de novo quem já chutou');
      const [, nome] = opcoes.find((o) => o[0] === id);
      await p.fill('#busca', nome);
      checar('chute repetido: quem já foi chutado sai da lista', !(await p.evaluate((i) => sugestoes.some((o) => o.id === i), id)), JSON.stringify(await p.evaluate(() => [J.chutes.map((c) => c.id), sugestoes.map((o) => o.id), J.fim])) + ' id=' + id);
      await p.evaluate((i) => chutar(i), id);
      checar('chute repetido não gasta chute', (await p.evaluate(() => J.chutes.length)) === k + 1);
      await p.fill('#busca', '');
    }
    if (k + 1 === recarregaEm) {
      marca(`recarrega no meio (${k + 1} chute(s), ${modo})`);
      await carregar();
      await tocar(botao);
      const depois = await lerJogo();
      if (modo === 'diario') {
        checar('desafio do dia: recarregar no meio não perde nem duplica os chutes', (await tela()) === 'tela-jogo' && depois.chutes.join() === jogo.chutes.concat([...usados].filter((u) => u !== jogo.alvo.id)).slice(0, k + 1).join() && depois.alvo.id === jogo.alvo.id, `antes ${k + 1} chutes, depois ${depois.chutes.length} (${await tela()})`);
        if (depois.chutes.length !== k + 1) return; // estado perdido: o resto do caso nao faz sentido
        ultimoAviso = (await conferirJogo(k + 1, '', true)).aviso;
      } else {
        // partida livre recomeca do zero, sem quebrar
        checar('partida livre: recarregar volta pro início e recomeça limpo', (await tela()) === 'tela-jogo' && depois.chutes.length === 0);
        return;
      }
    }
  }

  jogo = await lerJogo();
  const n0 = jogo.chutes.length;
  let como;
  if (plano.fim === 'acerta' && n0 < 6) {
    await chutarPelaTela(s, jogo.alvo.id, politica, rapido);
    como = 'acertou';
  } else if (plano.fim === 'desiste' && n0 < 6) {
    marca(`desiste depois de ${n0} chute(s)`);
    // desistir de proposito vem depois de um respiro (o "Desistir" ignora toque colado no chute: toque fantasma)
    await p.evaluate(() => { J.acaoDesde = -1e9; });
    ultimoFoiDuplo = false;
    if (politica === 'teclado') { await p.focus('#desistir'); await p.keyboard.press('Enter'); }
    else if (politica === 'apressada') { await duplo('#desistir'); ultimoFoiDuplo = true; }
    else await tocar('#desistir');
    como = 'desistiu';
  } else como = 'errou';
  marca(`fim (${como})`);
  if (!checar('todo estado chega ao fim', (await tela()) === 'tela-fim', await tela())) return;
  if (ultimoFoiDuplo) {
    // o 2o toque do toque duplo cai na tela do fim: nao pode compartilhar, jogar de novo nem voltar sozinho
    await p.waitForTimeout(50);
    const fantasma = await p.evaluate(() => ({ botao: document.getElementById('compartilhar').textContent, compart: window.__compartilhados.length }));
    checar('toque duplo que termina a partida não aciona botão da tela do fim', fantasma.botao === 'Compartilhar resultado' && !fantasma.compart, JSON.stringify(fantasma));
  }
  jogo = await lerJogo();
  checar('fim: J.fim bate com o que foi feito', jogo.fim === como, `${jogo.fim} x ${como}`);
  const n = jogo.chutes.length;
  checar('chutes: toque duplo/Enter repetido não gasta chute a mais', n === (como === 'acertou' ? n0 + 1 : n0), `${n} x ${n0}`);
  await conferirFim(s, { como, n, alvo: jogo.alvo, diario: jogo.diario, serieAntes, revisao: false });
  if (modo === 'diario') {
    const salvo = await feitoHoje();
    checar('desafio do dia: resultado salvo com os chutes', salvo && salvo.como === como && salvo.chutes.join() === jogo.chutes.join(), JSON.stringify(salvo));
  }

  // saida: jogar de novo, inicio, ou recarregar
  const saida = s.um(['de-novo', 'voltar', 'recarrega', 'nada']);
  marca(`sai do fim por ${saida}`);
  if (saida === 'de-novo') {
    await tocarHumano('#de-novo');
    checar('fim: "jogar de novo" abre uma partida livre nova', (await tela()) === 'tela-jogo' && (await p.evaluate(() => J.chutes.length === 0 && !J.diario && !J.fim)));
  } else if (saida === 'voltar') {
    await tocarHumano('#voltar');
    checar('fim: "Início" volta pro início', (await tela()) === 'tela-inicio');
    if (modo === 'diario') checar('início: botão do desafio diz se já foi feito hoje', (await p.textContent('#diario small')).includes('feito'));
  } else if (saida === 'recarrega') {
    await carregar();
    if (modo === 'diario') checar('desafio do dia: depois de recarregar o botão diz que já foi feito', (await p.textContent('#diario small')).includes('feito'));
    checar('sequência: recarregar não duplica nem perde', JSON.stringify(await serieAgora()) === JSON.stringify(await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('quem-ta-serie')); } catch { return null; } })));
  }
}

// --- roda --------------------------------------------------------------------
const DE = Number(process.env.DE || 0); // DE=40 CASOS=60: so os casos 40..59 (na mesma sequencia de contexto)
const lista = SO !== null ? [SO] : Array.from({ length: CASOS - DE }, (_, i) => DE + i);
let ctxIndice = -1;
for (const i of lista) {
  const ci = Math.floor(i / POR_CONTEXTO);
  casoAtual = i; marca('abre o contexto');
  try {
    if (ci !== ctxIndice) { await abrirContexto(ci); ctxIndice = ci; }
    let estourou = false;
    await Promise.race([
      caso(i),
      new Promise((_, nao) => setTimeout(() => { estourou = true; nao(new Error(`travou (${LIMITE_CASO_MS} ms)`)); }, LIMITE_CASO_MS)),
    ]);
    checar('nenhum travamento ou exceção do teste', !estourou);
  } catch (e) {
    checar('nenhum travamento ou exceção do teste', false, e.message.split('\n')[0]);
    ctxIndice = -1; // contexto pode estar sujo: abre outro
  }
  rodados++;
  if (rodados % 200 === 0) console.log(`... ${rodados} casos (${((Date.now() - inicioGeral) / 1000).toFixed(0)} s)`);
}
await b.close();

// --- resumo ------------------------------------------------------------------
const linhas = [];
const errosPorMsg = new Map();
for (const e of errosJs) { const k = e.msg.slice(0, 160); if (!errosPorMsg.has(k)) errosPorMsg.set(k, []); errosPorMsg.get(k).push(e); }
linhas.push(`${errosJs.length ? 'FALHA' : 'OK  '} sem erro de JS / console.error (${rodados} casos)${errosJs.length ? ': ' + [...errosPorMsg].slice(0, 4).map(([m, l]) => `${l.length}x "${m}" ex caso=${l[0].caso} passo="${l[0].passo}"`).join(' | ') : ''}`);
for (const [nome, v] of [...placar].sort()) {
  linhas.push(v.falha ? `FALHA ${nome}: ${v.falha} de ${v.ok + v.falha} checagens; ex: ${v.exemplos.join(' | ')}` : `OK   ${nome} (${v.ok} checagens)`);
}
const totalCheck = [...placar.values()].reduce((x, v) => x + v.ok + v.falha, 0);
const falhas = [...placar.values()].reduce((x, v) => x + v.falha, 0) + errosJs.length;
linhas.push(`${rodados >= Math.min(CASOS, lista.length) ? 'OK  ' : 'FALHA'} casos rodados: ${rodados} (semente ${SEMENTE}), ${totalCheck} checagens, ${falhas} falha(s), ${((Date.now() - inicioGeral) / 1000).toFixed(0)} s`);
if (falhas) linhas.push(`reproduzir um caso: CASO=<n> SEMENTE=${SEMENTE} BASE=${BASE} node testes/bateria-ux-quem-ta.mjs`);
const saida = linhas.join('\n');
console.log(saida);
writeFileSync(`testes/resultados/bateria-ux-quem-ta${SO !== null ? `-caso${SO}` : ''}.txt`, saida + '\n');
process.exit(falhas ? 1 : 0);
