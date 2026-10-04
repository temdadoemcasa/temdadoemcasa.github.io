// Bateria de UX do Prata da Casa: milhares de casos independentes, cada um com
// semente propria, clicando de verdade na pagina (criacao, carta, peneira,
// temporadas com decisoes, janela de transferencias, pendurar, simular, tela
// final, copiar o resumo, nova carreira, recarregar no meio).
//
//   python3 -m http.server 8766 &                       (na raiz do repo)
//   node testes/bateria-ux-prata.mjs                    (CI: 300 casos, ~5 min)
//   CASOS=4000 node testes/bateria-ux-prata.mjs         (bateria cheia, ~1 h)
//   SO=1234 node testes/bateria-ux-prata.mjs            (repete so o caso 1234; SO=57,58 repete os dois em sequencia)
//   SEMENTE=7 muda o conjunto de sementes; ACELERA=5 divide os setTimeout da
//   pagina (as esperas de animacao) por 5 -- so no teste, a regra do jogo nao muda.
//
// Equilibrio (curvas, chances, notas) NAO e assunto daqui: isso e a bateria de
// scripts/bateria/prata. Aqui a pergunta e: a tela sempre faz sentido?
// Saida: "OK  <invariante> (n casos)" ou "FALHA <invariante>: exemplos com
// caso/semente/passo pra reproduzir". O resumo vai pra testes/resultados/.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8766";
const CASOS = Number(process.env.CASOS || 300);
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.SO ? process.env.SO.split(",").map(Number) : null; // SO=57,58 repete esses casos em sequencia
const ACELERA = Number(process.env.ACELERA || 5);
const PAGINA = BASE + "/prata-da-casa.html";

// --- sorteio do lado do teste (politica do jogador) ------------------------------------
const prng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sementeDo = (i) => (SEMENTE * 1000003 + i * 7919) >>> 0;

// --- registro das invariantes ----------------------------------------------------------
const INV = new Map(); // nome -> { n, falhas: [] }
const conta = (nome) => { if (!INV.has(nome)) INV.set(nome, { n: 0, falhas: [] }); return INV.get(nome); };
let casoAtual = null;
const checar = (nome, cond, detalhe = "") => {
  const r = conta(nome);
  r.n++;
  if (!cond) r.falhas.push(`caso #${casoAtual.i} (${casoAtual.tipo}, semente ${casoAtual.semente}, passo ${casoAtual.passo}${casoAtual.vp ? `, ${casoAtual.vp}` : ""}): ${String(detalhe).slice(0, 300)}`);
  return cond;
};

// --- pagina ------------------------------------------------------------------------------
// Math.random com semente (mulberry32) e setTimeout acelerado, antes do jogo carregar
const INIT = `(() => {
  let s = 1;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__semear = (x) => { s = x >>> 0; };
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, ms > 60 ? ms / ${ACELERA} : ms, ...a);
  window.__erros = [];
  window.addEventListener('unhandledrejection', (e) => window.__erros.push('promessa: ' + (e.reason && e.reason.message || e.reason)));
})();`;

// checagem de tela, rodada dentro da pagina: devolve a lista de problemas
const CHECAR_TELA = () => {
  const P = [];
  const vw = document.documentElement.clientWidth;
  const visivel = (e) => { if (!e.getClientRects().length) return false; const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01; };
  const areas = [document.querySelector("main"), ...document.querySelectorAll(".festa")].filter(Boolean);
  // 1. texto quebrado
  for (const a of areas) {
    const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.textContent;
      if (!t.trim() || !n.parentElement || !visivel(n.parentElement)) continue;
      if (n.parentElement.closest("input, #previa-costas")) continue;
      if (/\bundefined\b|\bnull\b|\bNaN\b|\[object|Infinity|\bfalse\b|\btrue\b/.test(t)) P.push(["texto quebrado", t.trim().slice(0, 80)]);
      // ausencia nunca vira zero: dinheiro zerado e OVR zero sao dado que faltou
      if (/€\s?0(,0)? mi\b/.test(t)) P.push(["ausência virou zero", t.trim().slice(0, 80)]);
      if (/\bOVR 0\b|\b0 de OVR\b|^0 temporadas/.test(t)) P.push(["ausência virou zero", t.trim().slice(0, 80)]);
    }
  }
  // 2. nada vaza pro lado
  if (document.documentElement.scrollWidth > vw + 1) {
    const fora = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1);
    // o mais externo que vaza e nao esta dentro de outro que tambem vaza
    const culpado = fora.find((e) => !fora.includes(e.parentElement) && getComputedStyle(e).position !== "fixed") || fora[0];
    P.push(["sem rolagem lateral", `scrollWidth ${document.documentElement.scrollWidth} > ${vw}: ${culpado ? `${culpado.tagName.toLowerCase()}.${[...culpado.classList].join(".")} "${culpado.textContent.trim().slice(0, 40)}"` : "?"}`]);
  }
  const rolaX = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return true; } return false; };
  for (const e of document.querySelectorAll("main button, main h2, main h3, main p, main dd, main .proposta, main .evento-caixa, .festa-nome")) {
    if (!visivel(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1) continue;
    if ((r.right > vw + 1 || r.left < -1) && !rolaX(e)) P.push(["nada cortado na lateral", `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} ${Math.round(r.left)}..${Math.round(r.right)} (vw ${vw}) "${e.textContent.trim().slice(0, 40)}"`]);
  }
  // 2b. tabela da carreira: nada passa da propria celula (tacas empilhadas vazavam)
  for (const td of document.querySelectorAll("#tabela-carreira td:not(.tc-clube)")) {
    if (!visivel(td)) continue;
    const r = td.getBoundingClientRect();
    for (const f of td.children) { const q = f.getBoundingClientRect(); if (q.width && q.right > r.right + 1) { P.push(["tabela sem coluna vazando", `${td.className} "${td.textContent.trim()}" ${Math.round(q.right - r.right)}px`]); break; } }
  }
  // 3. botoes: nome acessivel e tamanho de toque
  for (const b of document.querySelectorAll("main button, .festa button")) {
    if (!visivel(b)) continue;
    const nome = (b.getAttribute("aria-label") || b.textContent || b.title || "").trim();
    if (!nome) P.push(["botão com nome acessível", b.outerHTML.slice(0, 80)]);
    const r = b.getBoundingClientRect();
    if (r.height < 24 || r.width < 24) P.push(["botão tocável (≥24px)", `${nome.slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`]);
    if (b.matches("#proxima, #confirmar-jogador, #confirmar-carta, .evento-opcao, .proposta .botao-primario, .bl-rodape .botao") && r.height < 40) P.push(["botão principal ≥40px", `${nome.slice(0, 30)} ${Math.round(r.height)}px`]);
  }
  // 4. input >= 16px (senao o iPhone da zoom)
  for (const i of document.querySelectorAll("main input:not([type=range])")) {
    if (!visivel(i)) continue;
    const fs = parseFloat(getComputedStyle(i).fontSize);
    if (fs < 16) P.push(["input ≥16px", `#${i.id} ${fs}px`]);
  }
  return P;
};

// estado resumido da pagina (pra decidir o proximo passo e checar coerencia)
const ESTADO = () => {
  const tela = ["criar", "carta", "base", "carreira", "fim"].find((t) => !document.getElementById(`tela-${t}`).hidden) || "nenhuma";
  const vis = (e) => e && !e.hidden && e.getClientRects().length > 0;
  const prox = document.getElementById("proxima");
  const J = C.J;
  return {
    tela,
    proxima: !prox.hidden && !prox.disabled ? prox.textContent.trim() : null,
    opcoes: [...document.querySelectorAll(".evento-opcao:not([disabled])")].filter(vis).length,
    mercado: !document.getElementById("mercado").hidden ? [...document.querySelectorAll("#mercado button:not([disabled])")].filter(vis).map((b) => b.textContent.trim().slice(0, 50)) : [],
    rolando: !!C.rolagem,
    festa: !!document.querySelector(".festa"),
    aposentado: !!(J && J.aposentado),
    idade: J ? J.idade : null,
    anos: J ? J.historico.length : null,
    linhas: document.querySelectorAll("#tabela-carreira tr").length,
    proximaLinha: document.querySelectorAll("#tabela-carreira .proxima-linha").length,
    pendurar: !document.getElementById("pendurar").hidden,
    idadePendurar: J ? idadeDePendurar() : null,
  };
};

const b = await chromium.launch();
const ctxDesk = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const ctxToque = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true, isMobile: true });
for (const c of [ctxDesk, ctxToque]) {
  await c.addInitScript(INIT);
  await c.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  // fora do servidor local (fontes, contador de visitas): nao depende da rede
  await c.route((u) => !u.href.startsWith(BASE), (r) => r.abort());
}
const erros = new Map(); // page -> []
const ouvir = (p) => {
  const lista = [];
  erros.set(p, lista);
  p.on("pageerror", (e) => lista.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR_FAILED/.test(m.text())) lista.push("console.error: " + m.text()); });
};
const carregar = async (p) => {
  await p.goto(PAGINA);
  await p.waitForFunction(() => { const x = document.getElementById("confirmar-jogador"); return x && !x.disabled; }, null, { timeout: 30000 });
};
const pDesk = await ctxDesk.newPage(); ouvir(pDesk); await carregar(pDesk);
const pToque = await ctxToque.newPage(); ouvir(pToque); await carregar(pToque);
const usos = new Map([[pDesk, 0], [pToque, 0]]);

// clique ou toque, conforme a pagina; rolagem suave as vezes "mexe" o alvo
const tocar = async (p, loc) => {
  const toque = p === pToque;
  try { await (toque ? loc.tap({ timeout: 4000 }) : loc.click({ timeout: 4000 })); }
  catch (_) {
    // forcado: antes centraliza o alvo (um toque forcado na posicao velha caia no menu do topo e saia da pagina)
    await loc.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
    await (toque ? loc.tap({ force: true, timeout: 4000 }) : loc.click({ force: true, timeout: 4000 }));
  }
};

const VIEWPORTS = [[360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800], [1366, 768], [1440, 900]];

async function verificarTela(p, onde) {
  casoAtual.passo = onde;
  const P = await p.evaluate(CHECAR_TELA);
  const porNome = {};
  for (const [nome, det] of P) (porNome[nome] ||= []).push(det);
  for (const nome of ["texto quebrado", "ausência virou zero", "sem rolagem lateral", "nada cortado na lateral", "tabela sem coluna vazando", "botão com nome acessível", "botão tocável (≥24px)", "botão principal ≥40px", "input ≥16px"]) {
    checar(nome, !porNome[nome], (porNome[nome] || []).slice(0, 3).join(" | "));
  }
  const e = await p.evaluate(ESTADO);
  // todo estado tem saida
  const saida = e.tela === "criar" || e.tela === "carta" || e.tela === "base" || e.tela === "fim" || e.proxima || e.opcoes || e.mercado.length || e.rolando || e.festa;
  checar("todo estado tem saída", saida, JSON.stringify(e));
  if (e.tela === "carreira") {
    checar("tabela = temporadas jogadas", e.linhas === e.anos + (e.aposentado ? 0 : 1) && e.proximaLinha === (e.aposentado ? 0 : 1), `linhas ${e.linhas}, anos ${e.anos}, aposentado ${e.aposentado}`);
    if (e.proxima) checar("rótulo do botão bate com o estado", /aposentadoria/i.test(e.proxima) === e.aposentado, `"${e.proxima}" com aposentado=${e.aposentado}`);
    checar("pendurar só a partir da idade", e.pendurar === (!e.aposentado && e.idade >= e.idadePendurar), `pendurar=${e.pendurar} idade ${e.idade}`);
  }
  return e;
}

const fimDeCaso = async (p) => {
  const lista = erros.get(p);
  const js = await p.evaluate(() => window.__erros.splice(0));
  checar("sem erro de JS / promessa / console.error", !lista.length && !js.length, [...lista, ...js].slice(0, 3).join(" | "));
  lista.length = 0;
};

// reseta a pagina pro comeco sem recarregar (o mesmo que "Nova carreira" mais o que sobra de animacao)
async function resetar(p, semente) {
  if (usos.get(p) >= 120) { usos.set(p, 0); await carregar(p); }
  usos.set(p, usos.get(p) + 1);
  await p.evaluate((s) => {
    window.__semear(s);
    C.rolagem = null; C.eventos = null; C.ofertasAbertas = null; C.J = null;
    if (C.menu) C.menu.abrir("temporada", { rolar: false });
    for (const f of document.querySelectorAll(".festa")) f.remove();
    document.getElementById("mercado").hidden = true;
    mostrarTela("criar");
    // o campo mostra o que vale (criarPelasFuncoes mexe no C.nome por fora da tela)
    document.getElementById("nome-camisa").value = C.nome;
    window.scrollTo(0, 0);
  }, semente);
}

// --- montagem rapida de um jogador pelas funcoes (pra cair direto no meio da carreira) ---
async function criarPelasFuncoes(p, r) {
  const pos = ["GOL", "ZAG", "LE", "LD", "VOL", "MC", "ME", "MD", "MEI", "PE", "PD", "CA"][Math.floor(r() * 12)];
  const modo = r() < 0.5 ? "rapido" : "completo";
  const pais = ["BRA", "ARG", "URU", "POR", "ESP", "FRA", "JPN", "NGA"][Math.floor(r() * 8)];
  await p.evaluate(({ pos, modo, pais, est }) => {
    C.pos = pos; C.modo = modo; if (PAISES.some((x) => x.id === pais)) C.pais = pais; C.nome = "Teste"; C.numero = 10;
    iniciarCarta();
    const f = funcaoDe(pos); const ks = Object.keys(ESTILOS[f]);
    montarEstilo(ks[est % ks.length]);
    criarJogador();
    mostrarPropostasDaBase();
  }, { pos, modo, pais, est: Math.floor(r() * 10) });
  const props = p.locator("#propostas-base .proposta .botao-primario");
  checar("peneira com 3 propostas", (await props.count()) === 3, `${await props.count()} propostas`);
  await tocar(p, props.nth(Math.floor(r() * 3)));
  return { pos, modo };
}

// avanca N temporadas pelas funcoes (decisao automatica), deixando a tela pronta
async function avancar(p, n) {
  await p.evaluate((n) => {
    let linha = null;
    for (let i = 0; i < n && !C.J.aposentado; i++) linha = jogarTemporada();
    if (!linha) return;
    C.eventos = null; C.ofertasAbertas = null; C.rolagem = null;
    document.getElementById("mercado").hidden = true;
    mostrarLinha(linha); desenharPainelJogador(); desenharTabelaCarreira();
    const prox = document.getElementById("proxima");
    prox.hidden = false; prox.disabled = false;
    prox.textContent = C.J.aposentado ? "Ver a aposentadoria" : "Próxima temporada";
    document.getElementById("tudo").disabled = C.J.aposentado;
  }, n);
}

// uma temporada por clique (decisoes + janela). politica: aleatoria | primeira | ultima | maiorChance | apressado
async function jogarTemporadaClicando(p, r, pol) {
  const antes = await p.evaluate(() => ({ anos: C.J.historico.length, apos: C.J.aposentado }));
  if (antes.apos) return "aposentado";
  await tocar(p, p.locator("#proxima"));
  let decisoes = 0;
  const t0 = Date.now();
  for (;;) {
    try {
      await p.waitForFunction(() => { const x = document.getElementById("proxima"); return (!x.hidden && !C.rolagem) || document.querySelector(".evento-opcao:not([disabled])"); }, null, { timeout: 20000 });
    } catch (_) { checar("temporada nunca trava", false, `parado depois de ${decisoes} decisões: ${JSON.stringify(await p.evaluate(ESTADO))}`); return "travou"; }
    const prox = await p.evaluate(() => !document.getElementById("proxima").hidden && !C.rolagem);
    if (prox) break;
    // foco do ano: as vezes troca antes da 1a decisao
    if (decisoes === 0 && r() < 0.3) {
      const chips = p.locator(".foco-chip");
      const n = await chips.count();
      if (n) {
        await tocar(p, chips.nth(Math.floor(r() * n)));
        checar("foco do ano marca o escolhido", (await p.locator(".foco-chip[aria-pressed=true]").count()) === 1, "nenhum/mais de um foco marcado");
      }
    }
    if (decisoes === 0 || r() < 0.15) await verificarTela(p, `decisão ${decisoes + 1}`);
    const ops = p.locator(".evento-opcao:not([disabled])");
    const n = await ops.count();
    let k = 0;
    if (pol === "aleatoria" || pol === "apressado") k = Math.floor(r() * n);
    else if (pol === "ultima") k = n - 1;
    else if (pol === "maiorChance") {
      const pcts = await ops.evaluateAll((bs) => bs.map((b) => { const m = b.textContent.match(/(\d+)% de dar certo/); return m ? Number(m[1]) : 101; }));
      k = pcts.indexOf(Math.max(...pcts));
    }
    // qualquer mudanca na caixa da decisao (ou no palco) conta como resposta
    await p.evaluate(() => {
      window.__mudou = false;
      if (window.__obs) window.__obs.disconnect();
      window.__obs = new MutationObserver(() => { window.__mudou = true; });
      window.__obs.observe(document.getElementById("temporada-atual"), { childList: true, subtree: true, characterData: true });
    });
    if (pol === "apressado") {
      // toque duplo rapido, e um segundo toque em outra opcao: so a primeira vale
      const alvo = ops.nth(k);
      await alvo.dblclick({ timeout: 4000 }).catch(() => alvo.click({ force: true }));
      await p.locator(".evento-opcao").nth((k + 1) % n).click({ force: true, timeout: 500 }).catch(() => {});
    } else await tocar(p, ops.nth(k));
    // feedback imediato: a escolha aparece (ou a roleta gira)
    const fb = await p.waitForFunction(() => window.__mudou, null, { timeout: 1500 }).then(() => true, () => false);
    checar("decisão tem resposta na hora", fb, "nada mudou 1,5 s depois do toque");
    if (pol === "apressado") {
      const esc = await p.locator(".evento-caixa .evento-escolha").count().catch(() => 0);
      checar("toque duplo não escolhe duas vezes", esc <= 1, `${esc} escolhas na mesma caixa`);
    }
    decisoes++;
    if (decisoes > 12) { checar("temporada nunca trava", false, "mais de 12 decisões num ano"); return "travou"; }
    if (Date.now() - t0 > 60000) { checar("temporada nunca trava", false, "ano levou mais de 60 s"); return "travou"; }
  }
  const depois = await p.evaluate(() => ({ anos: C.J.historico.length, linha: C.J.historico[C.J.historico.length - 1], apos: C.J.aposentado }));
  checar("temporada jogada entra no histórico uma vez", depois.anos === antes.anos + 1, `${antes.anos} -> ${depois.anos}`);
  checar("modo rápido tem 1 decisão, completo até 3+arco", decisoes >= 1, `${decisoes} decisões`);
  // resumo do ano coerente com a linha da tabela
  const resumo = await p.evaluate(() => { const dl = document.querySelector("#temporada-atual .temporada-numeros"); return dl ? [...dl.querySelectorAll("div")].map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent]) : null; });
  checar("resumo do ano aparece", !!resumo, "sem .temporada-numeros");
  if (resumo) {
    const jogos = Number((resumo.find(([k]) => /^Jogos/.test(k)) || [])[1]);
    checar("resumo do ano bate com o histórico", jogos === depois.linha.jogos, `tela ${jogos} x histórico ${depois.linha.jogos}`);
  }
  await verificarTela(p, "fim do ano");
  if (depois.apos) return "aposentado";
  // janela de transferencias
  for (let passo = 0; passo < 8; passo++) {
    const e = await p.evaluate(ESTADO);
    if (e.proxima && !e.mercado.length) break;
    if (e.proxima && e.mercado.length === 0) break;
    const botoes = p.locator("#mercado button:not([disabled])");
    const n = await botoes.count();
    if (!n) { const ok = !!(await p.evaluate(ESTADO)).proxima; checar("janela sempre tem saída", ok, "janela sem botão e sem 'Próxima temporada'"); break; }
    const rotulos = await botoes.allTextContents();
    let k = Math.floor(r() * n);
    if (pol === "primeira") k = 0;
    else if (pol === "maiorChance") { const i = rotulos.findIndex((t) => /^Aceita/.test(t)); k = i >= 0 ? i : 0; }
    const fechouAntes = await p.locator("#mercado .temporada-aviso").count();
    await tocar(p, botoes.nth(k));
    await p.waitForTimeout(30);
    const depoisClique = await p.evaluate(ESTADO);
    const mudou = depoisClique.proxima || (await p.locator("#mercado .temporada-aviso, #mercado .proposta-resposta, #mercado .proposta-retirada").count()) > fechouAntes || JSON.stringify(depoisClique.mercado) !== JSON.stringify(e.mercado);
    checar("botão da janela tem efeito", mudou, `"${rotulos[k].slice(0, 40)}" não mudou nada`);
    if (passo === 7) checar("janela sempre tem saída", !!depoisClique.proxima, `8 toques e a janela não fechou: ${rotulos.join(" / ")}`);
  }
  const e2 = await verificarTela(p, "janela fechada");
  checar("janela fecha com 'Próxima temporada'", !!e2.proxima, JSON.stringify(e2));
  return "ok";
}

// tela final: numeros coerentes, compartilhar e "Nova carreira"
async function conferirFim(p, r, sempreNova = false) {
  await p.waitForSelector("#tela-fim:not([hidden])", { timeout: 10000 }).catch(() => {});
  const e = await verificarTela(p, "tela final");
  if (!checar("aposentadoria chega na tela final", e.tela === "fim", `tela ${e.tela}`)) return;
  const d = await p.evaluate(() => {
    const H = C.J.historico;
    const tot = H.reduce((a, h) => ({ j: a.j + h.jogos, g: a.g + h.gols, a: a.a + h.assist }), { j: 0, g: 0, a: 0 });
    const tiles = Object.fromEntries([...document.querySelectorAll("#relatorio .bl-tiles")][0] ? [...document.querySelector("#relatorio .bl-bloco .bl-tiles").querySelectorAll("div")].map((x) => [x.querySelector("dt").textContent, x.querySelector("dd").textContent]) : []);
    return { tot, tiles, anos: H.length, manchete: document.querySelector(".bl-manchete")?.textContent || "", nome: C.J.nome, final: document.querySelector(".bl-final")?.textContent || "", auge: Math.max(...H.map((h) => h.ovr)) };
  });
  checar("tela final: números batem com a carreira", Number(d.tiles.Jogos) === d.tot.j && Number(d.tiles.Gols) === d.tot.g && d.manchete.startsWith(`${d.anos} temporadas`), JSON.stringify({ tiles: d.tiles, tot: d.tot, manchete: d.manchete }));
  checar("tela final tem um rótulo de carreira", d.final.trim().length > 2, `"${d.final}"`);
  // copiar o resumo
  const copiar = p.locator("#relatorio .bl-rodape button").first();
  if (await copiar.count()) {
    await p.evaluate(() => navigator.clipboard.writeText("")).catch(() => {});
    await tocar(p, copiar);
    await p.waitForTimeout(80);
    const txt = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    const rot = (await copiar.textContent()).trim();
    checar("copiar dá resposta na tela", /Copiad|Não deu|copiad/i.test(rot), `rótulo "${rot}"`);
    const ok = txt.includes(d.nome) && txt.includes("temdadoemcasa.github.io/prata-da-casa.html") && !/undefined|null|NaN|\[object/.test(txt) && txt.length <= 700 && txt.includes(`${d.anos} temporadas`) && txt.includes(`${d.tot.j} jogos`) && txt.includes(`${d.auge} de OVR`);
    checar("texto de compartilhar coerente", ok, JSON.stringify(txt).slice(0, 300));
  } else checar("texto de compartilhar coerente", false, "sem botão de copiar");
  // nova carreira volta pro comeco
  if (sempreNova || r() < 0.6) {
    const nova = p.locator("#relatorio button", { hasText: /Nova carreira|Jogar de novo|Outra carreira/ }).first();
    checar("tela final tem 'jogar de novo'", (await nova.count()) === 1, "sem botão de nova carreira");
    if (await nova.count()) {
      await tocar(p, nova);
      const t = await p.evaluate(ESTADO);
      checar("'Nova carreira' volta pra criação", t.tela === "criar", t.tela);
      // e a carreira seguinte comeca limpa
      if (sempreNova || r() < 0.5) {
        await criarPelasFuncoes(p, r);
        const e3 = await verificarTela(p, "carreira depois de 'Nova carreira'");
        checar("carreira nova começa do zero", e3.anos === 0 && e3.linhas === 1, JSON.stringify(e3));
      }
    }
  }
}

// --- tipos de caso -------------------------------------------------------------------------
const NOMES = ["", "   ", "Zé", "SOUZA", "Ñandú", "Müller-Lüdenscheid", "D'Ávila", "<b>x</b>", "12345", "Pelé Pelé Pelé Pelé", "José da Silva", "😀Gol", "a"];
const NUMEROS = ["", "0", "-5", "150", "7.5", "99", "1", "10", "23"];

async function casoCriacao(p, r) {
  casoAtual.passo = "criação";
  const teclado = r() < 0.15 && p === pDesk;
  const nome = NOMES[Math.floor(r() * NOMES.length)];
  if (teclado) {
    await p.locator("#nome-camisa").focus();
    await p.keyboard.press("Control+A"); await p.keyboard.type(nome);
    await p.keyboard.press("Tab");
    const foco = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { id: a.id, visivel: a.matches(":focus-visible") && (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none") }; });
    checar("foco visível no teclado", foco.visivel, `#${foco.id} sem contorno de foco`);
  } else await p.fill("#nome-camisa", nome);
  const num = NUMEROS[Math.floor(r() * NUMEROS.length)];
  await p.fill("#numero-camisa", num);
  await p.locator("#numero-camisa").dispatchEvent("change");
  const n = await p.evaluate(() => ({ c: C.numero, v: document.getElementById("numero-camisa").value, prev: document.getElementById("previa-costas").textContent }));
  checar("número da camisa sempre 1–99", n.c >= 1 && n.c <= 99 && String(n.c) === n.v && n.prev.includes(String(n.c)), JSON.stringify({ digitado: num, ...n }));
  if (r() < 0.5) {
    const termo = ["bra", "zzz", "Ç", "port", "", "united", "es"][Math.floor(r() * 7)];
    await p.fill("#busca-pais", termo);
    const k = await p.locator("#paises .pais").count();
    const vazio = await p.locator("#paises .nota").count();
    checar("busca de país nunca deixa a lista muda", k > 0 || vazio === 1, `termo "${termo}": ${k} países, ${vazio} aviso`);
    if (k) await tocar(p, p.locator("#paises .pais").nth(Math.floor(r() * k)));
    checar("país escolhido marcado", (await p.locator('#paises .pais[aria-checked="true"]').count()) <= 1, "mais de um país marcado");
  }
  const pos = p.locator("#campo-posicoes .pos-botao");
  await tocar(p, pos.nth(Math.floor(r() * (await pos.count()))));
  await tocar(p, p.locator("[data-pe]").nth(Math.floor(r() * 3)));
  await tocar(p, p.locator("[data-modo]").nth(Math.floor(r() * 2)));
  checar("um modo marcado", (await p.locator('[data-modo][aria-pressed="true"]').count()) === 1, "modo");
  await verificarTela(p, "criação");
  if (teclado) { await p.locator("#confirmar-jogador").focus(); await p.keyboard.press("Enter"); }
  else await tocar(p, p.locator("#confirmar-jogador"));
  const tela = (await p.evaluate(ESTADO)).tela;
  const vazio = !nome.replace(/[^\p{L} .'-]/gu, "").trim();
  if (vazio) {
    checar("nome vazio avisa e não avança", tela === "criar" && (await p.locator("#aviso-nome").isVisible()), `tela ${tela}`);
    return;
  }
  checar("nome válido vai pra carta", tela === "carta", `tela ${tela} com nome "${nome}"`);
  if (tela !== "carta") return;
  // montagem da carta: toques aleatorios
  const ops = Math.floor(r() * 18);
  for (let i = 0; i < ops; i++) {
    casoAtual.passo = `carta op ${i}`;
    const x = r();
    if (x < 0.35) { const m = p.locator(".atributo-mais:not([disabled])"); const c = await m.count(); if (c) await tocar(p, m.nth(Math.floor(r() * c))); }
    else if (x < 0.55) { const m = p.locator(".atributo-menos:not([disabled])"); const c = await m.count(); if (c) await tocar(p, m.nth(Math.floor(r() * c))); }
    else if (x < 0.7) { const f = p.locator(".atributo-faixa"); const c = await f.count(); const v = Math.floor(r() * 101); await f.nth(Math.floor(r() * c)).evaluate((e, v) => { e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); }, v); }
    else if (x < 0.82) { const ch = p.locator("#estilos-prontos .chip"); const c = await ch.count(); if (c) await tocar(p, ch.nth(Math.floor(r() * c))); }
    else if (x < 0.9) await tocar(p, p.locator("#auto-pontos"));
    else if (x < 0.96) await tocar(p, p.locator("#zerar-pontos"));
    else { await tocar(p, p.locator("#voltar-criacao")); await tocar(p, p.locator("#confirmar-jogador")); }
    const m = await p.evaluate(() => {
      const f = funcaoDe(C.pos);
      const vals = Object.values(C.attrs);
      return { pontos: document.getElementById("pontos-restantes").textContent, ovr: document.getElementById("ovr-montagem").textContent, real: ovrDe(C.attrs, f), min: Math.min(...vals), max: Math.max(...vals), conf: document.getElementById("confirmar-carta").disabled, txt: document.getElementById("confirmar-carta").textContent, sobra: Object.keys(C.attrs).some((k) => maximoPagavel(f, k) > C.attrs[k]) };
    });
    const pts = Number(m.pontos);
    checar("carta: pontos nunca negativos (máx. 30 + 10 da troca)", Number.isInteger(pts) && pts >= 0 && pts <= 40, JSON.stringify(m));
    checar("carta: OVR na tela é o da carta", Number(m.ovr) === m.real, JSON.stringify(m));
    checar("carta: atributos entre 20 e 72", m.min >= 20 && m.max <= 72, JSON.stringify(m));
    checar("carta: 'Fechar' só quando não sobra ponto útil", m.conf === (pts > 0 && m.sobra), JSON.stringify(m));
  }
  await verificarTela(p, "carta");
  if (r() < 0.5) {
    if (await p.locator("#confirmar-carta").isDisabled()) await tocar(p, p.locator("#auto-pontos"));
    await tocar(p, p.locator("#confirmar-carta"));
    const e = await verificarTela(p, "peneira");
    checar("carta fechada vai pra peneira", e.tela === "base", e.tela);
    const ligas = await p.locator("#propostas-base .proposta-liga").allTextContents();
    checar("peneira: 3 clubes da B/C/D", ligas.length === 3 && ligas.every((l) => /Série [BCD]/.test(l)), ligas.join(" | "));
  }
}

async function casoTemporada(p, r) {
  const { modo } = await criarPelasFuncoes(p, r);
  await verificarTela(p, "início da carreira");
  const k = Math.floor(Math.pow(r(), 1.3) * 22);
  if (k) await avancar(p, k);
  await verificarTela(p, `depois de ${k} anos`);
  const pol = ["aleatoria", "primeira", "ultima", "maiorChance", "apressado"][Math.floor(r() * 5)];
  const anos = 1 + (r() < 0.3 ? 1 : 0) + (modo === "rapido" && r() < 0.3 ? 1 : 0);
  for (let a = 0; a < anos; a++) {
    casoAtual.passo = `ano ${a} (${pol}, ${modo})`;
    const res = await jogarTemporadaClicando(p, r, pol);
    if (res !== "ok") break;
  }
  // abas do celular: tocar Carta / Carreira e voltar
  if (p === pToque && r() < 0.3) {
    const abas = p.locator(".abas-mobile button:visible");
    const n = await abas.count();
    if (n) { await tocar(p, abas.nth(Math.floor(r() * n))); await verificarTela(p, "aba do celular"); await tocar(p, abas.first()); }
  }
  if ((await p.evaluate(ESTADO)).aposentado) { if ((await p.evaluate(ESTADO)).tela !== "fim") await tocar(p, p.locator("#proxima")); await conferirFim(p, r); }
}

async function casoFim(p, r) {
  await criarPelasFuncoes(p, r);
  const goleiro = await p.evaluate(() => funcaoDe(C.pos) === "GOL");
  // perto da idade de pendurar; um quarto vai direto pro ultimo ano (40, goleiro 42),
  // que acaba sozinho com "Ver a aposentadoria"
  const ultimo = r() < 0.25;
  const alvo = ultimo ? (goleiro ? 42 : 40) - 17 : (goleiro ? 36 : 34) - 16 + Math.floor(r() * 5) - 1;
  await avancar(p, alvo);
  const e = await verificarTela(p, `veterano (${alvo} anos de carreira)`);
  const x = r();
  if (e.aposentado) { await tocar(p, p.locator("#proxima")); return conferirFim(p, r); }
  if (ultimo) {
    casoAtual.passo = "último ano";
    const res = await jogarTemporadaClicando(p, r, ["aleatoria", "primeira", "maiorChance"][Math.floor(r() * 3)]);
    if (res === "aposentado") {
      const rot = (await p.evaluate(ESTADO)).proxima;
      checar("último ano termina em 'Ver a aposentadoria'", /aposentadoria/i.test(rot || ""), `botão "${rot}"`);
      await tocar(p, p.locator("#proxima"));
      return conferirFim(p, r, true);
    }
    return;
  }
  if (x < 0.4 && e.pendurar) {
    casoAtual.passo = "pendurar";
    await tocar(p, p.locator("#pendurar"));
    const armado = await p.evaluate(() => ({ t: document.getElementById("pendurar").textContent, apos: C.J.aposentado }));
    checar("pendurar pede confirmação (1º toque não encerra)", !armado.apos && /de novo/i.test(armado.t), JSON.stringify(armado));
    await tocar(p, p.locator("#pendurar"));
    return conferirFim(p, r);
  }
  if (x < 0.75) {
    casoAtual.passo = "simular o resto";
    await tocar(p, p.locator("#tudo"));
    const armado = await p.evaluate(() => ({ t: document.getElementById("tudo").textContent, apos: C.J.aposentado }));
    checar("simular pede confirmação (1º toque não encerra)", !armado.apos && /de novo/i.test(armado.t), JSON.stringify(armado));
    if (r() < 0.2) {
      // toque errado: espera desarmar
      await p.waitForFunction(() => !document.getElementById("tudo").classList.contains("tudo-armado"), null, { timeout: 5000 }).catch(() => {});
      checar("simular desarma sozinho", !(await p.evaluate(() => document.getElementById("tudo").classList.contains("tudo-armado"))), "segue armado");
      return;
    }
    await tocar(p, p.locator("#tudo"));
    return conferirFim(p, r);
  }
  // joga clicando ate o fim (no maximo 8 anos)
  for (let a = 0; a < 8; a++) {
    casoAtual.passo = `veterano ano ${a}`;
    const res = await jogarTemporadaClicando(p, r, ["aleatoria", "primeira", "maiorChance"][Math.floor(r() * 3)]);
    if (res === "aposentado") { await tocar(p, p.locator("#proxima")); return conferirFim(p, r); }
    if (res !== "ok") return;
    if ((await p.evaluate(ESTADO)).pendurar && r() < 0.4) { await tocar(p, p.locator("#pendurar")); await tocar(p, p.locator("#pendurar")); return conferirFim(p, r); }
  }
}

async function casoCarreiraInteira(p, r) {
  // criacao clicando, carreira inteira no modo rapido clicando
  await p.fill("#nome-camisa", "Inteiro");
  const pos = p.locator("#campo-posicoes .pos-botao");
  await tocar(p, pos.nth(Math.floor(r() * (await pos.count()))));
  await tocar(p, p.locator('[data-modo="rapido"]'));
  await tocar(p, p.locator("#confirmar-jogador"));
  await tocar(p, p.locator("#auto-pontos"));
  await tocar(p, p.locator("#confirmar-carta"));
  await tocar(p, p.locator("#propostas-base .proposta .botao-primario").nth(Math.floor(r() * 3)));
  const pol = ["aleatoria", "primeira", "maiorChance"][Math.floor(r() * 3)];
  for (let a = 0; a < 30; a++) {
    casoAtual.passo = `carreira inteira ano ${a}`;
    const res = await jogarTemporadaClicando(p, r, pol);
    if (res === "aposentado") break;
    if (res !== "ok") return;
    const e = await p.evaluate(ESTADO);
    if (e.pendurar && r() < 0.25) { await tocar(p, p.locator("#pendurar")); await tocar(p, p.locator("#pendurar")); break; }
  }
  const e = await p.evaluate(ESTADO);
  if (e.tela !== "fim") await tocar(p, p.locator("#proxima"));
  await conferirFim(p, r);
}

// pagina nova: viewport, toque, tema e movimento sorteados; recarrega no meio
async function casoPaginaNova(r, semente) {
  const [w, h] = VIEWPORTS[Math.floor(r() * VIEWPORTS.length)];
  const toque = w < 800 ? r() < 0.8 : r() < 0.2;
  const mov = r() < 0.7 ? "reduce" : "no-preference";
  const esquema = r() < 0.5 ? "dark" : "light";
  casoAtual.vp = `${w}x${h}${toque ? " toque" : ""} ${mov} ${esquema}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque, reducedMotion: mov, colorScheme: esquema });
  await ctx.addInitScript(INIT);
  await ctx.route((u) => !u.href.startsWith(BASE), (rt) => rt.abort());
  // localStorage antigo/corrompido
  const lixo = [["tema", "claro"], ["tema", "{lixo"], ["tema", ""], ["prata-da-casa", "{nao e json"], ["prata-da-casa", JSON.stringify({ v: 999, recorde: "x" })], ["prata-da-casa", JSON.stringify({ recorde: { auge: "NaN", titulos: -3 } })]];
  const [kk, vv] = lixo[Math.floor(r() * lixo.length)];
  await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem("__ja")) { localStorage.setItem(k, v); sessionStorage.setItem("__ja", "1"); } } catch (_) {} }, [kk, vv]);
  const p = await ctx.newPage();
  ouvir(p);
  try {
    await carregar(p);
    await p.evaluate((s) => window.__semear(s), semente);
    casoAtual.passo = `carregou com ${kk}=${vv.slice(0, 20)}`;
    await verificarTela(p, casoAtual.passo);
    const tap = async (loc) => { try { await (toque ? loc.tap({ timeout: 4000 }) : loc.click({ timeout: 4000 })); } catch (_) { await loc.click({ force: true, timeout: 4000 }); } };
    if (r() < 0.3) { await tap(p.locator(".tema-botao")); await verificarTela(p, "trocou o tema"); }
    await p.fill("#nome-camisa", "Recarga");
    await tap(p.locator('[data-modo="completo"]'));
    await tap(p.locator("#confirmar-jogador"));
    await tap(p.locator("#auto-pontos"));
    await verificarTela(p, "carta");
    await tap(p.locator("#confirmar-carta"));
    await verificarTela(p, "peneira");
    await tap(p.locator("#propostas-base .proposta .botao-primario").nth(Math.floor(r() * 3)));
    await verificarTela(p, "carreira");
    // um ano clicando (com animacao, se o movimento nao estiver reduzido)
    if (r() < 0.6) {
      await tap(p.locator("#proxima"));
      for (let d = 0; d < 10; d++) {
        const ok = await p.waitForFunction(() => { const x = document.getElementById("proxima"); return (!x.hidden && !C.rolagem) || document.querySelector(".evento-opcao:not([disabled])"); }, null, { timeout: 25000 }).then(() => true, () => false);
        if (!checar("temporada nunca trava", ok, "página nova: parado")) break;
        if (await p.evaluate(() => !document.getElementById("proxima").hidden && !C.rolagem)) break;
        if (d === 0) await verificarTela(p, "decisão (página nova)");
        await tap(p.locator(".evento-opcao:not([disabled])").first());
      }
      await verificarTela(p, "fim do ano (página nova)");
    }
    // recarrega no meio da carreira: volta inteiro pro comeco, sem erro
    casoAtual.passo = "recarregou no meio";
    const recorde0 = await p.evaluate(() => { try { return localStorage.getItem("prata-da-casa"); } catch (_) { return null; } });
    await p.reload();
    await p.waitForFunction(() => { const x = document.getElementById("confirmar-jogador"); return x && !x.disabled; }, null, { timeout: 30000 }).catch(() => {});
    const e = await verificarTela(p, "depois de recarregar");
    checar("recarregar não quebra a página", e.tela === "criar" || e.tela === "carreira", e.tela);
    const recorde1 = await p.evaluate(() => { try { return localStorage.getItem("prata-da-casa"); } catch (_) { return null; } });
    checar("recarregar não perde nem duplica o que foi salvo", recorde0 === recorde1, `${recorde0} -> ${recorde1}`);
    await fimDeCaso(p);
  } finally { await ctx.close(); }
}

// --- roda --------------------------------------------------------------------------------
const inicio = Date.now();
const tipos = {};
const lista = SO !== null ? SO : Array.from({ length: CASOS }, (_, i) => i);
for (const i of lista) {
  const semente = sementeDo(i);
  const r = prng(semente);
  const x = r();
  const tipo = x < 0.3 ? "criacao" : x < 0.75 ? "temporada" : x < 0.89 ? "fim" : x < 0.91 ? "inteira" : "pagina-nova";
  casoAtual = { i, tipo, semente, passo: "início", vp: null };
  tipos[tipo] = (tipos[tipo] || 0) + 1;
  try {
    if (tipo === "pagina-nova") await casoPaginaNova(r, semente);
    else {
      const p = r() < 0.5 ? pDesk : pToque;
      const [w, h] = p === pDesk ? VIEWPORTS.slice(4)[Math.floor(r() * 5)] : VIEWPORTS.slice(0, 5)[Math.floor(r() * 5)];
      await p.setViewportSize({ width: w, height: h });
      casoAtual.vp = `${w}x${h}${p === pToque ? " toque" : ""}`;
      await resetar(p, semente);
      if (tipo === "criacao") await casoCriacao(p, r);
      else if (tipo === "temporada") await casoTemporada(p, r);
      else if (tipo === "fim") await casoFim(p, r);
      else await casoCarreiraInteira(p, r);
      await fimDeCaso(p);
    }
    checar("caso termina sem exceção do teste", true);
  } catch (e) {
    checar("caso termina sem exceção do teste", false, e.message.split("\n")[0]);
    // pagina pode ter ficado num estado ruim: recarrega as duas
    for (const p of [pDesk, pToque]) { erros.get(p).length = 0; await carregar(p).catch(() => {}); usos.set(p, 0); }
  }
  if ((i + 1) % 100 === 0 && SO === null) console.error(`# ${i + 1}/${CASOS} casos, ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}
await b.close();

const linhas = [];
let falhou = false;
for (const [nome, r] of [...INV.entries()].sort()) {
  if (!r.falhas.length) linhas.push(`OK   ${nome} (${r.n} checagens)`);
  else { falhou = true; linhas.push(`FALHA ${nome}: ${r.falhas.length} de ${r.n}. Exemplos:\n      ${r.falhas.slice(0, 4).join("\n      ")}`); }
}
const cab = `Bateria de UX do Prata da Casa: ${lista.length} casos (${Object.entries(tipos).map(([k, v]) => `${k} ${v}`).join(", ")}), semente ${SEMENTE}, ${((Date.now() - inicio) / 1000).toFixed(0)} s`;
console.log(cab);
console.log(linhas.join("\n"));
console.log(falhou ? "FALHA bateria com invariante quebrada" : `OK   bateria inteira: ${lista.length} casos`);
try {
  mkdirSync(new URL("./resultados/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./resultados/bateria-ux-prata-${lista.length}.txt`, import.meta.url), cab + "\n" + linhas.join("\n") + "\n");
} catch (_) {}
process.exit(falhou ? 1 : 0);
