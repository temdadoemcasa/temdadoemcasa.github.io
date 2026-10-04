// Bateria de UX do Show do Dadão: milhares de partidas independentes, cada uma com a sua
// semente, jogadas com cliques/toques/teclas de verdade no DOM.
//
//   python3 -m http.server 8766 &                       (na raiz do repo)
//   node testes/bateria-ux-dadao.mjs                   (CI: 120 casos + o banco inteiro, ~3-4 min)
//   CASOS=4000 node testes/bateria-ux-dadao.mjs        (bateria cheia, ~2-3 h na máquina dividida)
//   CASO=1234 node testes/bateria-ux-dadao.mjs         (repete so o caso 1234, mesma semente)
//   SEMENTE=7 muda a semente-base (default 1). DETALHE=1 imprime os passos dos casos que falharem.
//
// Cada caso sorteia (pela semente): viewport (360x640 a 1440x900), toque ou mouse, movimento
// reduzido ou nao, tema claro/escuro, nome e posicao, desafio do dia ou partida livre (e o dia do
// desafio), politica do jogador (otima, pessima, aleatoria, realista, desiste cedo, apressada com
// toque duplo/triplo), como confirma (toque duplo, aviso, Enter, letra 2x), ajudas, parar, recarregar
// no meio (na pergunta, na comemoracao, no erro), localStorage corrompido/antigo e modo de compartilhar
// (share do celular, area de transferencia, permissao negada, cancelado).
// Invariantes checadas em todo passo: sem erro de JS; sem undefined/null/NaN na tela; nada vaza pro
// lado; botoes com nome e tamanho tocavel; alternativas sem sobreposicao; palco de acao cabe na tela
// do celular; toda acao muda a tela; regras da escada (acertar sobe, parar leva, errar cai pra metade,
// final zera); tela final coerente; texto de compartilhar; persistencia ao recarregar; desafio igual
// pra todo mundo e uma vez por dia. Alem dos casos, valida cada pergunta do banco (texto, 4
// alternativas unicas, uma certa, explicacao, cabe na tela com a explicacao inteira).
// Imprime "OK  <invariante> (n checagens)" ou "FALHA <invariante>: semente S passo P: ...".
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:8766";
const CASOS = Number(process.env.CASOS || 120); // o rodar.mjs mata teste com mais de 8 min
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.CASO ? process.env.CASO.split(",").map(Number) : null; // um ou mais casos (na ordem dada)
const DETALHE = !!process.env.DETALHE;
const URL_JOGO = `${BASE}/show-do-dadao.html`;
const pasta = path.dirname(fileURLToPath(import.meta.url));

// --- sorteio reprodutivel ---------------------------------------------------------
function rngDe(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const sementeDoCaso = (i) => (Math.imul(SEMENTE, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
const escolha = (r, lista) => lista[Math.floor(r() * lista.length)];

const TELAS_TOQUE = [[360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [414, 896], [768, 1024]];
const TELAS_MOUSE = [[1024, 768], [1280, 800], [1366, 768], [1440, 900], [900, 700]];
const NOMES = ["", "Breno", "Zé", "Dadão", "Maria Clara", "JOÃOZINHO", "Ñandú", "  ", "Kaká10", "Xx_Craque_xX", "O'Neil", "<b>oi</b>", "Pé de Anjo", "Vinícius Jr"];
const CORROMPIDOS = [
  ["tem-resposta-recorde", "abc"], ["tem-resposta-recorde", "99"], ["tem-resposta-recorde", "-3"], ["tem-resposta-recorde", "7.5"],
  ["tem-resposta-recorde", "1e9"], ["tem-resposta-vistas", "{"], ["tem-resposta-vistas", "{}"], ["tem-resposta-vistas", "\"x\""],
  ["tem-resposta-vistas", "[1,null,{}]"], ["tem-resposta-boys", "{}"], ["tem-resposta-boys", "\"Pelé\""], ["tem-resposta-boys", "[]"],
  ["tem-resposta-pos", "DM"], ["tem-resposta-pos", "Z"], ["tem-resposta-nome", "NomeMuitoMuitoComprido"],
  ["dadao-diario", "{"], ["dadao-diario", "[]"], ["dadao-diario", "5"], ["dadao-diario", "HOJE:{\"degrau\":99}"],
  ["dadao-diario", "HOJE:{}"], ["dadao-diario", "HOJE:{\"degrau\":3,\"como\":\"errou\",\"historico\":\"x\"}"],
  ["dadao-diario", "{\"data\":\"2020-01-01\",\"degrau\":4,\"como\":\"parou\",\"historico\":[]}"],
  ["dadao-partida-livre", "{"], ["dadao-partida-livre", "{\"numero\":40,\"degrau\":-2}"], ["dadao-partida-livre", "[]"],
  ["dadao-partida-diario", "HOJE:{\"numero\":3}"], ["dadao-partida-diario", "{\"modo\":\"diario\",\"data\":\"2020-01-01\",\"numero\":5}"],
];

function sortearCaso(i) {
  const semente = sementeDoCaso(i);
  const r = rngDe(semente);
  const toque = r() < 0.6;
  const movimento = r() < 0.025; // animacoes ligadas (mais lento: a partida para cedo)
  const [w, h] = escolha(r, toque ? TELAS_TOQUE : TELAS_MOUSE);
  // partidas longas (otima) custam ~6 s; a maioria e realista/apressada (~4-6 perguntas)
  const politica = r() < 0.07 ? "otima" : escolha(r, ["pessima", "aleatoria", "realista", "realista", "realista", "desiste", "apressada", "apressada", "apressada"]);
  const c = {
    i, semente, toque, movimento, w, h, politica,
    claro: r() < 0.35,
    nome: escolha(r, NOMES),
    pos: escolha(r, ["G", "D", "M", "F", null]),
    diario: r() < 0.3,
    diaDesloc: Math.floor(r() * 90) - 5, // dia do desafio
    comecaPorTeclado: !toque && r() < 0.25,
    pararEm: politica === "desiste" ? 1 + Math.floor(r() * 15) : movimento ? 1 + Math.floor(r() * 4) : r() < 0.06 ? 1 + Math.floor(r() * 16) : 0,
    pensarMais: r() < 0.15,
    usaAjuda: r() < 0.55,
    abaCarta: toque && r() < 0.15,
    recarregaAntes: r() < 0.08,
    corrompido: r() < 0.08 ? escolha(r, CORROMPIDOS) : null,
    recordeInicial: r() < 0.25 ? 1 + Math.floor(r() * 15) : 0,
    recarrega: r() < 0.12 ? escolha(r, ["pergunta", "pergunta", "festa", "erro"]) : null,
    recarregaEm: 1 + Math.floor(r() * 10),
    compartilhar: escolha(r, ["share", "clipboard", "negado", "cancelou", null]),
    depois: escolha(r, ["de-novo", "trocar", "trocar", "nada"]),
    story: r() < 0.02,
    foco: !toque && r() < 0.1,
    autoProxima: r() < 0.01, // espera a comemoracao sair sozinha
    r,
  };
  if (c.corrompido) c.recarregaAntes = true;
  return c;
}

// --- o que roda dentro da pagina -----------------------------------------------------
// Math.random com semente, data deslocada (desafio de outros dias), share/clipboard simulados
// e a checagem generica de tela.
const INIT = () => {
  let s = 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  try { const v = sessionStorage.getItem("__semente"); if (v) s = Number(v) >>> 0; } catch { /* ok */ }
  Math.random = rnd;
  window.__semear = (n) => { s = n >>> 0; try { sessionStorage.setItem("__semente", String(n >>> 0)); } catch { /* ok */ } };
  const D = Date;
  let desloc = 0;
  try { desloc = Number(sessionStorage.getItem("__desloc")) || 0; } catch { /* ok */ }
  window.__deslocar = (ms) => { desloc = ms; try { sessionStorage.setItem("__desloc", String(ms)); } catch { /* ok */ } };
  class DataFalsa extends D {
    constructor(...a) { if (a.length) super(...a); else super(D.now() + desloc); }
    static now() { return D.now() + desloc; }
  }
  window.Date = DataFalsa;
  window.__compartilhado = [];
  try { window.__shareModo = sessionStorage.getItem("__share") || null; } catch { window.__shareModo = null; }
  Object.defineProperty(navigator, "share", {
    configurable: true,
    get() {
      const m = window.__shareModo;
      if (m !== "share" && m !== "cancelou") return undefined;
      return async (d) => { if (m === "cancelou") throw new DOMException("cancelou", "AbortError"); window.__compartilhado.push(d.text ?? "[arquivo]"); };
    },
  });
  Object.defineProperty(navigator, "canShare", { configurable: true, get() { return undefined; } });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    get() {
      return { writeText: async (t) => { if (window.__shareModo === "negado") throw new DOMException("negado", "NotAllowedError"); window.__compartilhado.push(t); } };
    },
  });

  const visivel = (e) => {
    if (!e || !e.isConnected) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.02 || n.hidden) return false;
    }
    return true;
  };
  window.__visivel = visivel;
  // por que um elemento nao esta visivel (pra mensagem de falha dizer a causa)
  window.__porque = (e) => {
    if (!e) return "não existe";
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return `tamanho ${Math.round(r.width)}x${Math.round(r.height)}`;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.02 || n.hidden) return `${n.id || n.className || n.tagName} display=${st.display} visibility=${st.visibility} opacity=${st.opacity} hidden=${n.hidden}`;
    }
    return "ok";
  };
  // problemas genericos da tela: [{ inv, msg }]
  window.__checar = () => {
    const P = [];
    const add = (inv, msg) => P.push({ inv, msg });
    const txt = document.body.innerText;
    const lixo = txt.match(/\bundefined\b|\bnull\b|\bNaN\b|\[object|Infinity/);
    if (lixo) add("texto-limpo", `texto com "${lixo[0]}": …${txt.slice(Math.max(0, lixo.index - 40), lixo.index + 20).replace(/\s+/g, " ")}…`);
    const doc = document.documentElement;
    if (doc.scrollWidth > innerWidth + 1) add("layout", `vaza pro lado (${doc.scrollWidth} > ${innerWidth})`);
    const barra = document.querySelector(".abas-mobile");
    const barraVis = barra && visivel(barra);
    const limite = innerHeight - (barraVis ? barra.getBoundingClientRect().height : 0);
    const festa = document.querySelector(".festa-quiz-pop");
    for (const b of document.querySelectorAll("button")) {
      if (!visivel(b) || b.closest(".acao:not(.ativa)") || b.closest("[inert]")) continue;
      const nome = (b.getAttribute("aria-label") || b.innerText || b.title || "").trim();
      if (!nome) add("a11y", `botão sem nome acessível (${b.id || b.className})`);
      const r = b.getBoundingClientRect();
      if (r.height < 24 || r.width < 24) add("layout", `botão menor que 24px: ${b.id || b.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.right > innerWidth + 1 || r.left < -1) add("layout", `botão sai da tela: ${b.id || b.className}`);
    }
    const nome = document.getElementById("nome");
    if (visivel(nome) && parseFloat(getComputedStyle(nome).fontSize) < 16) add("a11y", "campo de nome com fonte < 16px (zoom no iPhone)");
    const tela = ["tela-inicio", "tela-jogo", "tela-fim"].find((id) => !document.getElementById(id).hidden);
    if (!tela) add("saida", "nenhuma tela visível");
    if (tela === "tela-jogo" && !document.getElementById("painel-pergunta").classList.contains("aba-oculta")) {
      const enun = document.getElementById("enunciado").textContent.trim();
      if (enun.length < 8) add("texto-limpo", `enunciado vazio/curto: "${enun}"`);
      const alts = [...document.querySelectorAll("#alternativas .alternativa")];
      if (alts.length !== 4) add("regras", `${alts.length} alternativas`);
      const rs = alts.map((a) => a.getBoundingClientRect());
      alts.forEach((a, i) => {
        const t = a.querySelector(".alternativa-texto")?.textContent.trim();
        if (!t) add("texto-limpo", `alternativa ${i} vazia`);
        if (rs[i].height < 24) add("layout", `alternativa ${i} com ${Math.round(rs[i].height)}px de altura`);
        for (let j = 0; j < i; j++) {
          const A = rs[i], B = rs[j];
          if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) add("layout", `alternativas ${j} e ${i} sobrepostas`);
        }
      });
      const num = document.getElementById("pergunta-numero").textContent;
      if (!/^Pergunta (\d|1[0-5]) de 16$|^Pergunta final$/.test(num)) add("texto-limpo", `número da pergunta estranho: "${num}"`);
      for (const id of ["valor-errar", "valor-parar", "valor-acertar"]) {
        const v = document.getElementById(id).textContent;
        if (!/\S · \d{2}$/.test(v)) add("texto-limpo", `${id} estranho: "${v}"`);
      }
      // o painel de acao aberto cabe acima da barra de abas (celular)
      const ativa = document.querySelector("#palco-acao .acao.ativa");
      if (barraVis && ativa && !festa) {
        // o que importa e o conteudo (o painel estica ate a altura do maior painel empilhado)
        const alvo = ativa.id === "retorno" ? document.getElementById("proxima") : ativa.id === "acao-padrao" ? ativa.querySelector(".ajudas") : ativa;
        const fundo = (visivel(alvo) ? alvo : ativa).getBoundingClientRect().bottom;
        if (fundo > limite + 1) add("layout", `painel ${ativa.id} passa da tela em ${Math.round(fundo - limite)}px`);
      }
    }
    if (tela === "tela-fim") {
      if (!document.getElementById("fim-titulo").textContent.trim()) add("texto-limpo", "fim sem título");
      if (!document.getElementById("fim-texto").textContent.trim()) add("texto-limpo", "fim sem texto");
      const g = document.getElementById("fim-grade").textContent;
      if ((g.match(/🟩|🟥|🟨|⬜/gu) || []).length !== 16) add("fim-coerente", `grade sem 16 quadradinhos: ${JSON.stringify(g)}`);
      const dn = document.getElementById("de-novo").getBoundingClientRect();
      if (dn.height < 40) add("layout", `Jogar de novo com ${Math.round(dn.height)}px`);
    }
    if (festa) {
      const cx = festa.querySelector(".festa-quiz-caixa").getBoundingClientRect();
      if (cx.top < -1 || cx.bottom > innerHeight + 1) add("layout", `comemoração cortada (${Math.round(cx.top)}..${Math.round(cx.bottom)} de ${innerHeight})`);
    }
    return P;
  };
  window.__estado = () => {
    const tela = ["tela-inicio", "tela-jogo", "tela-fim"].find((id) => !document.getElementById(id).hidden);
    const ativa = document.querySelector("#palco-acao .acao.ativa");
    return {
      tela, festa: !!document.querySelector(".festa-quiz-pop"),
      acao: ativa ? ativa.id : null, errou: document.getElementById("retorno").classList.contains("errou"),
      numero: Q.numero, degrau: Q.degrau, travado: Q.travado, escolhida: Q.escolhida, hist: Q.historico.length,
      pulos: Q.ajudas ? Q.ajudas.pulos : null, ajudas: Q.ajudas ? { ...Q.ajudas } : null,
      id: Q.pergunta ? Q.pergunta.id : null, opcoes: Q.opcoes.map((o) => o.texto), certa: Q.opcoes.findIndex((o) => o.certa),
      eliminadas: [...(Q.eliminadas || [])].sort(), diario: !!Q.diario, data: Q.diario ? Q.diario.data : null,
      x: Q.pergunta ? Q.pergunta.x || "" : "", rr: Q.pergunta ? Q.pergunta.r || "" : "", a: Q.pergunta ? Q.pergunta.a : "",
      enunciado: document.getElementById("enunciado").textContent,
      linha: document.getElementById("ajuda-linha").textContent,
      alts: document.getElementById("alternativas").innerHTML.length,
      aba: document.getElementById("painel-pergunta").classList.contains("aba-oculta") ? "carta" : "pergunta",
    };
  };
};

// --- resultado -------------------------------------------------------------------
const INVARIANTES = {
  "sem-erro-js": "nenhum erro de JS, promessa rejeitada ou console.error",
  "texto-limpo": "sem undefined/null/NaN/vazio na tela; números e nomes preenchidos",
  layout: "nada vaza pro lado, botões ≥24px e dentro da tela, alternativas sem sobreposição, palco cabe acima da barra",
  a11y: "botões com nome acessível, campo ≥16px, foco visível no teclado",
  feedback: "toda ação muda a tela na hora",
  saida: "todo caso termina (fim ou recomeço) sem travar",
  regras: "acertar sobe, parar leva, errar cai pra metade, final zera; pular troca a pergunta",
  ajudas: "cartas nunca tiram a certa, arquibancada soma 100, 3 Golden Boys, Enciclopédia marca a certa",
  "toque-duplo": "toque duplo/triplo e letra+Enter confirmam uma vez só",
  "fim-coerente": "tela final bate com a partida (título, carta, grade, recorde, lista, explicação)",
  compartilhar: "texto de compartilhar coerente e botão sempre dá retorno",
  persistencia: "recarregar no meio não perde nem duplica progresso; storage corrompido não quebra",
  diario: "desafio igual pra todo mundo no mesmo dia e uma tentativa só",
  perguntas: "cada pergunta: texto, 4 alternativas únicas, uma certa, explicação, cabe na tela",
};
const contagem = Object.fromEntries(Object.keys(INVARIANTES).map((k) => [k, { n: 0, falhas: [] }]));
let casoAtual = null;
function checa(inv, cond, msg) {
  contagem[inv].n += 1;
  if (cond) return true;
  const passo = casoAtual ? casoAtual.passos.length : 0;
  const onde = casoAtual ? `caso ${casoAtual.i} (semente ${casoAtual.semente}) passo ${passo} [${casoAtual.passos.at(-1) || "início"}]` : "banco";
  contagem[inv].falhas.push(`${onde}: ${msg}`);
  if (casoAtual) casoAtual.falhou = true;
  return false;
}
const T0 = Date.now();
const passo = (t) => casoAtual && casoAtual.passos.push(DETALHE ? `${t} @${Date.now() - T0}` : t);

// --- o jogador -------------------------------------------------------------------------
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
let pg; // pagina atual
let errosJS = [];
const est = () => pg.evaluate(() => window.__estado());
async function checarTela() {
  const ps = await pg.evaluate(() => window.__checar());
  const porInv = {};
  for (const p of ps) (porInv[p.inv] ||= []).push(p.msg);
  for (const inv of ["texto-limpo", "layout", "a11y", "saida", "regras", "fim-coerente"]) checa(inv, !porInv[inv], (porInv[inv] || []).slice(0, 3).join(" | "));
  if (ps.length && (DETALHE || SO !== null) && !casoAtual.foto) {
    casoAtual.foto = true;
    await pg.screenshot({ path: path.join(pasta, "resultados", `falha-dadao-${casoAtual.i}.png`) }).catch(() => {});
  }
  if (errosJS.length) { checa("sem-erro-js", false, errosJS.join(" | ").slice(0, 300)); errosJS = []; } else checa("sem-erro-js", true);
}
async function ate(cond, ms = 4000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const s = await est();
    if (cond(s)) return s;
    await espera(25);
  }
  return null;
}
async function tocar(sel, i = null) {
  const loc = i === null ? pg.locator(sel) : pg.locator(sel).nth(i);
  const agir = () => (casoAtual.toque ? loc.tap({ timeout: 3000 }) : loc.click({ timeout: 3000 }));
  try { await agir(); } catch (e) {
    // o Playwright as vezes emperra em "scrolling into view" com a pagina saudavel (nada foi disparado ainda): tenta uma vez de novo
    if (!/scrolling into view/.test(String(e.message)) || !(await loc.isVisible().catch(() => false))) throw e;
    // segue emperrado (pagina saudavel, so o scroll do Playwright pendura): dispara o clique direto no elemento visivel
    try { await agir(); } catch (e2) { if (!/scrolling into view/.test(String(e2.message))) throw e2; await loc.dispatchEvent("click", {}, { timeout: 3000 }); }
  }
}

let ESC = null;
const seErrar = (numero, degrau) => {
  if (numero === 16) return 0;
  let d = 0;
  ESC.forEach((g, i) => { if (g.valor <= ESC[degrau].valor / 2) d = i; });
  return d;
};
function gradeEsperada(hist, como) {
  const q = hist.map((a) => (a ? "🟩" : "🟥"));
  if (como === "parou") q.push("🟨");
  while (q.length < 16) q.push("⬜");
  return [0, 4, 8, 12].map((i) => q.slice(i, i + 4).join("")).join("\n");
}
const MAPA_DIARIO = new Map(); // data|numero|pulos -> id e ordem das alternativas
function conferirDiario(s, pulosAqui) {
  if (!s.diario) return;
  const k = `${s.data}|${s.numero}|${pulosAqui}`;
  const v = `${s.id}|${s.opcoes.join("~")}`;
  if (!MAPA_DIARIO.has(k)) MAPA_DIARIO.set(k, v);
  checa("diario", MAPA_DIARIO.get(k) === v, `desafio ${k} mudou de pergunta/ordem: ${MAPA_DIARIO.get(k)} vs ${v}`);
}

const hojeDe = (desloc) => { const d = new Date(Date.now() + desloc); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function sairPraInicio() {
  for (let k = 0; k < 60; k++) {
    const s = await est().catch(() => null);
    if (!s) { await espera(50); continue; }
    if (s.festa) { await pg.evaluate(() => document.querySelector(".festa-quiz-pop")?.click()); await espera(30); continue; }
    if (s.tela === "tela-jogo") {
      if (s.acao === "cartas-caixa") await pg.evaluate(() => document.querySelector(".carta-baralho:not(:disabled)")?.click());
      else if (s.acao === "retorno" && s.errou) await pg.evaluate(() => document.getElementById("proxima").click());
      else if (s.travado) await espera(60);
      else if (s.acao === "parar-caixa") await pg.evaluate(() => document.getElementById("parar-sim").click());
      else await pg.evaluate(() => document.getElementById("parar").click());
      await espera(20);
      continue;
    }
    return;
  }
  throw new Error(`não consegui sair pro início: ${JSON.stringify(await est().catch(() => null))?.slice(0, 200)}`);
}

async function prepararCaso(c, reabrir) {
  if (reabrir) await sairPraInicio();
  await pg.setViewportSize({ width: c.w, height: c.h });
  const hoje = hojeDe(c.diaDesloc * 86400000);
  const storage = {};
  if (c.claro) storage.tema = "claro";
  if (c.recordeInicial) storage["tem-resposta-recorde"] = String(c.recordeInicial);
  if (c.corrompido) {
    const [k, v] = c.corrompido;
    storage[k] = v.startsWith("HOJE:") ? JSON.stringify({ data: hoje, ...JSON.parse(v.slice(5)) }) : v;
  }
  await pg.evaluate(({ storage, semente, desloc, share }) => {
    localStorage.clear(); sessionStorage.clear();
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    window.__semear(semente); window.__deslocar(desloc);
    window.__shareModo = share; window.__compartilhado = [];
    try { sessionStorage.setItem("__share", share || ""); } catch { /* ok */ }
  }, { storage, semente: c.semente, desloc: c.diaDesloc * 86400000, share: c.compartilhar });
  if (c.recarregaAntes || !reabrir) { await pg.reload(); await pg.waitForSelector("#tela-inicio:not([hidden])"); }
  else {
    await pg.evaluate(() => {
      document.documentElement.toggleAttribute("data-tema", false);
      if (localStorage.getItem("tema") === "claro") document.documentElement.setAttribute("data-tema", "claro");
      document.getElementById("trocar").click();
    });
  }
  return hoje;
}

// recorde valido que o jogo deve enxergar no comeco do caso
const recordeValido = (c) => {
  if (c.corrompido && c.corrompido[0] === "tem-resposta-recorde") return 0;
  return c.recordeInicial;
};

async function jogarCaso(c, reabrir) {
  const hoje = await prepararCaso(c, reabrir);
  const r = c.r;
  passo("início");
  await checarTela();
  // inicio: textos e botoes
  const ini = await pg.evaluate(() => ({ rec: document.getElementById("inicio-recorde").textContent, dia: document.getElementById("diario").innerText }));
  let rec = recordeValido(c);
  checa("persistencia", rec ? ini.rec.includes(ESC[rec].nome) : !/recorde/i.test(ini.rec) || c.corrompido, `recorde no início: "${ini.rec}" (esperava ${rec})`);
  checa("texto-limpo", /#[1-9]\d*/.test(ini.dia), `botão do desafio sem número: "${ini.dia}"`);
  if (c.foco) {
    await pg.keyboard.press("Tab"); await pg.keyboard.press("Tab");
    const f = await pg.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return "nada"; const s = getComputedStyle(a); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 ? "ok" : `${a.tagName}.${a.className} sem contorno`; });
    checa("a11y", f === "ok", `foco não visível: ${f}`);
  }
  // nome e posicao
  await pg.fill("#nome", c.nome);
  if (c.pos) await tocar(`[data-pos="${c.pos}"]`);
  passo(`nome "${c.nome}" pos ${c.pos || "padrão"}`);
  // diario ja feito hoje (storage valido)? entao so revisa
  let diarioFeito = false, diarioEmAndamento = false;
  if (c.corrompido && c.corrompido[0] === "dadao-diario" && c.corrompido[1].startsWith("HOJE:")) diarioFeito = null; // pode ser lixo: so nao pode quebrar
  if (c.corrompido && c.corrompido[0] === "dadao-partida-diario") diarioEmAndamento = null;
  // comeca
  if (c.diario) { passo("toca Desafio do dia"); await tocar("#diario"); }
  else if (c.comecaPorTeclado) { passo("Enter no nome"); await pg.focus("#nome"); await pg.keyboard.press("Enter"); }
  else { passo("toca Começar"); await tocar("button[type=submit]"); }
  let s = await ate((x) => x.tela !== "tela-inicio", 3000);
  if (!checa("saida", !!s, "Começar não saiu do início")) return;
  await checarTela();
  if (s.tela === "tela-fim") {
    // diario corrompido que parece valido: aceita revisao, desde que coerente e sem erro
    checa("diario", c.diario && diarioFeito !== false, `foi direto pro fim sem ter jogado (${JSON.stringify(c.corrompido)})`);
    return;
  }
  if (diarioEmAndamento === null && s.tela === "tela-jogo" && s.numero > 1) {
    // retomou um andamento corrompido: tem que estar num estado jogavel
    checa("persistencia", s.numero >= 1 && s.numero <= 16 && s.degrau < s.numero, `retomou estado impossível: pergunta ${s.numero}, degrau ${s.degrau}`);
  }
  // modelo
  const m = { numero: s.numero, degrau: s.degrau, hist: [], pulos: 3, pulosAqui: 0, ajudas: { cartas: true, boys: true, enciclopedia: true, arquibancada: true }, como: null };
  checa("regras", s.numero === 1 && s.degrau === 0 && s.pulos === 3, `partida nova não começa zerada: ${JSON.stringify({ n: s.numero, d: s.degrau, p: s.pulos })}`);
  const nomeEsperado = (c.nome.trim().slice(0, 12) || "Você");
  const cartaNome = await pg.evaluate(() => document.querySelector("#quiz-carta .carta")?.innerText || "");
  checa("texto-limpo", cartaNome.toUpperCase().includes(nomeEsperado.toUpperCase().slice(0, 6)) || nomeEsperado === "Você", `carta sem o nome "${nomeEsperado}": ${cartaNome.replace(/\s+/g, " ").slice(0, 60)}`);
  conferirDiario(s, 0);
  let recarregou = false;
  const ajudasNaPartida = ["cartas", "boys", "arquibancada", "enciclopedia"].filter(() => c.usaAjuda && r() < 0.45);
  const ajudaEm = Object.fromEntries(ajudasNaPartida.map((a) => [a, 1 + Math.floor(r() * 12)]));
  const pulaEm = c.usaAjuda ? [1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14)] : [];

  for (let volta = 0; volta < 60; volta++) {
    s = await est();
    if (s.tela !== "tela-jogo") break;
    checa("regras", s.numero === m.numero && s.degrau === m.degrau && s.hist === m.hist.length, `estado ${JSON.stringify({ n: s.numero, d: s.degrau, h: s.hist })} vs modelo ${JSON.stringify({ n: m.numero, d: m.degrau, h: m.hist.length })}`);
    checa("regras", s.pulos === m.pulos, `pulos ${s.pulos} vs ${m.pulos}`);
    // valores: errar/parar/acertar batem com a escada
    const vals = await pg.evaluate(() => ["valor-errar", "valor-parar", "valor-acertar"].map((id) => document.getElementById(id).textContent));
    const dd = (d) => `${ESC[d].nome} · ${ESC[d].ovr}`;
    checa("regras", vals[0] === dd(seErrar(m.numero, m.degrau)) && vals[1] === dd(m.degrau) && vals[2] === dd(m.numero), `valores ${vals.join(" / ")} na pergunta ${m.numero} degrau ${m.degrau}`);

    // aba "Sua carta" no celular
    if (c.abaCarta && r() < 0.3 && await pg.locator(".abas-mobile").isVisible()) {
      passo("aba Sua carta");
      await tocar(".aba-mobile", 1);
      // a carta entra com um fade de 0,45s: espera as animacoes acabarem antes de medir
      await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
      const por = await pg.evaluate(() => `carta: ${window.__porque(document.querySelector("#quiz-carta .carta"))}; escada: ${window.__porque(document.getElementById("escada"))}`);
      checa("feedback", por === "carta: ok; escada: ok", `aba Sua carta não mostrou carta e escada (${por})`);
      await checarTela();
      await tocar(".aba-mobile", 0);
    }

    // recarregar no meio da pergunta
    if (c.recarrega === "pergunta" && !recarregou && m.numero >= c.recarregaEm) {
      recarregou = true;
      // as vezes depois de usar uma ajuda
      if (m.numero < 16 && m.ajudas.enciclopedia && r() < 0.5) { passo("Enciclopédia antes de recarregar"); await tocar("#ajuda-enciclopedia"); m.ajudas.enciclopedia = false; }
      const antes = await est();
      passo(`recarrega na pergunta ${m.numero}`);
      await pg.reload(); await pg.waitForSelector("#tela-inicio:not([hidden])");
      await checarTela();
      const retomar = await retomarDepoisDeRecarregar(c);
      if (!checa("persistencia", retomar, `recarregou na pergunta ${m.numero} e o início não ofereceu continuar`)) return;
      const depois = await ate((x) => x.tela === "tela-jogo", 2000);
      if (!checa("persistencia", depois && depois.numero === antes.numero && depois.degrau === antes.degrau && depois.pulos === antes.pulos
        && depois.id === antes.id && depois.opcoes.join() === antes.opcoes.join() && depois.eliminadas.join() === antes.eliminadas.join()
        && JSON.stringify(depois.ajudas) === JSON.stringify(antes.ajudas),
      `retomou diferente: antes ${JSON.stringify({ n: antes.numero, d: antes.degrau, p: antes.pulos, id: antes.id, aj: antes.ajudas })} depois ${JSON.stringify(depois && { n: depois.numero, d: depois.degrau, p: depois.pulos, id: depois.id, aj: depois.ajudas })}`)) return;
      await checarTela();
      continue;
    }

    // ajudas (nao na final)
    if (m.numero < 16) {
      for (const a of ajudasNaPartida) {
        if (ajudaEm[a] !== m.numero || !m.ajudas[a]) continue;
        await usarAjuda(a, m);
      }
      if (pulaEm.includes(m.numero) && m.pulos > 0 && r() < 0.7) {
        const antes = await est();
        passo(`pular (restam ${m.pulos})`);
        await tocar("#ajuda-pular");
        m.pulos -= 1; m.pulosAqui += 1;
        const depois = await est();
        checa("regras", depois.id !== antes.id && depois.numero === antes.numero, `pular não trocou a pergunta (${antes.id} -> ${depois.id})`);
        checa("feedback", depois.enunciado !== antes.enunciado, "pular não mudou o enunciado");
        conferirDiario(depois, m.pulosAqui);
        await checarTela();
        continue;
      }
    } else {
      const des = await pg.evaluate(() => ["ajuda-cartas", "ajuda-boys", "ajuda-arquibancada", "ajuda-enciclopedia", "ajuda-pular"].every((id) => document.getElementById(id).disabled));
      checa("regras", des, "ajuda ativa na pergunta final");
    }

    // parar
    if (c.pararEm === m.numero) {
      passo(`parar na ${m.numero}`);
      await tocar("#parar");
      const st = await est();
      checa("feedback", st.acao === "parar-caixa", "Parar não abriu a confirmação");
      const txt = await pg.textContent("#parar-texto");
      checa("texto-limpo", m.degrau === 0 ? /pelada/i.test(txt) : txt.includes(ESC[m.degrau].nome), `texto do parar: "${txt}"`);
      await checarTela();
      if (r() < 0.25) { passo("continuar jogando"); await tocar("#parar-nao"); checa("feedback", (await est()).acao === "acao-padrao", "Continuar não voltou"); c.pararEm = 0; continue; }
      passo("parar e levar");
      await tocar("#parar-sim");
      m.como = "parou";
      break;
    }

    // escolher a resposta
    s = await est();
    const vivas = [0, 1, 2, 3].filter((i) => !s.eliminadas.includes(i));
    const erradas = vivas.filter((i) => i !== s.certa);
    let alvo;
    const pol = c.politica;
    if (pol === "otima") alvo = s.certa;
    else if (pol === "pessima") alvo = erradas.length ? escolha(r, erradas) : s.certa;
    else if (pol === "aleatoria") alvo = escolha(r, vivas);
    else alvo = r() < Math.max(0.3, 0.95 - 0.05 * m.numero) || !erradas.length ? s.certa : escolha(r, erradas);

    if (c.pensarMais && r() < 0.4 && erradas.length) {
      const outra = escolha(r, erradas.filter((i) => i !== alvo).concat(vivas.filter((i) => i !== alvo)).slice(0, 3));
      if (outra !== undefined && outra !== alvo) {
        passo(`escolhe ${outra} e pensa mais`);
        await tocar("#alternativas .alternativa", outra);
        const e1 = await est();
        checa("feedback", e1.escolhida === outra && await pg.locator(".toque-de-novo").count() === 1, "escolher não marcou a alternativa nem mostrou o aviso");
        if (!c.toque) { await pg.keyboard.press("Escape"); const e2 = await est(); checa("feedback", e2.escolhida === null, "Esc não desfez a escolha"); }
      }
    }
    const histAntes = m.hist.length;
    const modo = c.politica === "apressada" ? escolha(r, ["triplo", "duplo-rapido", "duplo"]) : escolha(r, c.toque ? ["duplo", "duplo", "aviso"] : ["duplo", "aviso", "teclado", "letra2"]);
    passo(`responde ${"ABCD"[alvo]} (${alvo === s.certa ? "certa" : "errada"}) por ${modo} na ${m.numero}`);
    const alt = "#alternativas .alternativa";
    if (modo === "duplo") { await tocar(alt, alvo); await espera(65 + Math.floor(r() * 120)); await tocar(alt, alvo); }
    else if (modo === "aviso") { await tocar(alt, alvo); await tocar("#confirmar"); }
    else if (modo === "teclado") { await pg.keyboard.press("abcd"[alvo]); await pg.keyboard.press("Enter"); }
    else if (modo === "letra2") { await pg.keyboard.press("abcd"[alvo]); await espera(80); await pg.keyboard.press("ABCD"[alvo]); }
    else {
      // apressada: toques colados (o 2o pode ser engolido como duplicado do navegador) e um 3o
      // toques extras no mesmo ponto, mesmo que algo ja tenha aparecido por cima (como um dedo de verdade)
      const bx = await pg.locator(alt).nth(alvo).boundingBox();
      const px = bx.x + bx.width / 2, py = bx.y + bx.height / 2;
      const extra = () => (c.toque ? pg.touchscreen.tap(px, py) : pg.mouse.click(px, py));
      await tocar(alt, alvo);
      await espera(Math.floor(r() * 40));
      await extra();
      if (modo === "triplo") { await espera(70 + Math.floor(r() * 60)); await extra(); }
      const e = await est();
      if (!e.travado && e.escolhida === alvo && e.hist === histAntes) { await espera(70); await tocar(alt, alvo); }
    }
    const resp = await ate((x) => x.hist > histAntes && (x.festa || (x.acao === "retorno" && x.errou) || x.tela === "tela-fim" || x.numero > m.numero), c.movimento ? 5000 : 3000);
    if (!checa("toque-duplo", !!resp, `confirmação não aconteceu (${modo})`)) return;
    // um confirmar so (o 3o toque nao confirma de novo nem pula a comemoracao)
    await espera(c.politica === "apressada" ? 120 : 0);
    const r2 = await est();
    if (alvo === s.certa && c.toque) checa("toque-duplo", r2.festa, `o toque extra (${modo}) pulou a comemoração antes de dar pra ver`);
    checa("toque-duplo", r2.hist === histAntes + 1, `histórico foi de ${histAntes} pra ${r2.hist} (${modo})`);
    const acertou = alvo === s.certa;
    m.hist.push(acertou);
    if (acertou) {
      m.degrau = m.numero;
      checa("regras", resp.festa || r2.numero > m.numero || r2.tela === "tela-fim", "acertou e não comemorou");
      const fs = await pg.evaluate(() => { const p = document.querySelector(".festa-quiz-pop"); return p ? p.innerText : ""; });
      if (r2.festa) checa("fim-coerente", /acertou/i.test(fs) && fs.includes(String(ESC[m.degrau].ovr)), `comemoração sem acerto/overall: ${fs.slice(0, 80)}`);
      await checarTela();
      if (c.recarrega === "festa" && !recarregou && m.numero >= c.recarregaEm && m.numero < 16) {
        recarregou = true;
        passo(`recarrega na comemoração da ${m.numero}`);
        await pg.reload(); await pg.waitForSelector("#tela-inicio:not([hidden])");
        const ok = await retomarDepoisDeRecarregar(c);
        if (!checa("persistencia", ok, `recarregou na comemoração da ${m.numero} e perdeu a partida`)) return;
        const d = await ate((x) => x.tela === "tela-jogo", 2000);
        m.numero += 1; m.pulosAqui = 0;
        if (!checa("persistencia", d && d.numero === m.numero && d.degrau === m.degrau && d.pulos === m.pulos && d.hist === m.hist.length,
          `depois da comemoração voltou em ${JSON.stringify(d && { n: d.numero, d: d.degrau, p: d.pulos, h: d.hist })}, esperava n ${m.numero} d ${m.degrau}`)) return;
        conferirDiario(d, 0);
        continue;
      }
      if (m.numero === 16) { m.como = "campeao"; }
      // fecha a comemoracao: toque, Enter ou espera sair sozinha
      if (!(await est()).festa) { /* o toque extra ja fechou */ }
      else if (c.autoProxima) { passo("espera a comemoração"); await ate((x) => !x.festa, 8000); }
      else if (!c.toque && r() < 0.3) { passo("Enter na comemoração"); await pg.keyboard.press("Enter"); }
      else {
        // toque pra pular; se foi cedo demais (a festa ignora o toque colado no que confirmou), toca de novo
        passo("toca a comemoração");
        const pop = pg.locator(".festa-quiz-pop");
        for (let k = 0; k < 5; k++) {
          await pop.click({ timeout: 1000, position: { x: 5, y: 5 } }).catch(() => {});
          if (await ate((x) => !x.festa, 100)) break;
          await espera(120);
        }
      }
      const prox = await ate((x) => !x.festa && (x.tela === "tela-fim" || x.numero === m.numero + 1), c.movimento ? 4000 : 2500);
      if (!checa("saida", !!prox, "comemoração não saiu")) return;
      if (m.numero === 16) break;
      m.numero += 1; m.pulosAqui = 0;
      const n2 = await est();
      checa("regras", n2.acao === "acao-padrao" && n2.escolhida === null && !n2.travado, `pergunta nova não veio limpa: ${JSON.stringify({ a: n2.acao, e: n2.escolhida, t: n2.travado })}`);
      conferirDiario(n2, 0);
      await checarTela();
    } else {
      const novo = seErrar(m.numero, m.degrau);
      m.degrau = novo;
      m.como = "errou";
      checa("regras", resp.acao === "retorno" && resp.errou && resp.degrau === novo, `errou na ${m.numero}: degrau ${resp.degrau}, esperava ${novo}`);
      const rt = await pg.evaluate(() => document.getElementById("retorno").innerText);
      checa("fim-coerente", rt.includes(s.a) && rt.includes(`${"ABCD"[s.certa]}`), `retorno do erro sem a certa: ${rt.slice(0, 120)}`);
      if (s.x) checa("fim-coerente", rt.replace(/\s+/g, " ").includes(s.x.replace(/\s+/g, " ")), `explicação cortada no erro: ${s.x.slice(0, 60)}`);
      const certaMarcada = await pg.locator("#alternativas .alternativa.certa").count();
      checa("feedback", certaMarcada === 1 && await pg.locator("#alternativas .alternativa.errada").count() === 1, "erro não pintou a certa e a errada");
      await checarTela();
      if (c.recarrega === "erro" && !recarregou) {
        recarregou = true;
        passo(`recarrega no erro da ${m.numero}`);
        await pg.reload(); await pg.waitForSelector("#tela-inicio:not([hidden])");
        await checarTela();
        const ini2 = await pg.evaluate(() => ({ cont: window.__visivel(document.getElementById("continuar")) ? document.getElementById("continuar").innerText : "", dia: document.getElementById("diario").innerText, rec: document.getElementById("inicio-recorde").textContent }));
        if (s.diario) {
          checa("persistencia", /Já jogou hoje/.test(ini2.dia), `errou no desafio, recarregou e pode jogar de novo: "${ini2.dia}"`);
        } else {
          checa("persistencia", !ini2.cont, `errou, recarregou e o início oferece continuar: "${ini2.cont}"`);
        }
        const recEsperado = Math.max(rec, m.degrau);
        checa("persistencia", recEsperado ? ini2.rec.includes(ESC[recEsperado].nome) : !ini2.rec, `recorde depois de recarregar no erro: "${ini2.rec}" (esperava ${recEsperado ? ESC[recEsperado].nome : "vazio"})`);
        return;
      }
      // "Ver o resultado" (as vezes com toque duplo rapido: o 2o toque nao pode cair num botao do fim)
      const duplo = c.politica === "apressada" && r() < 0.6;
      passo(`Ver o resultado${duplo ? " (toque duplo)" : ""}`);
      if (duplo) {
        const b = await pg.locator("#proxima").boundingBox();
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        if (c.toque) { await pg.touchscreen.tap(x, y); await espera(90); await pg.touchscreen.tap(x, y); }
        else { await pg.mouse.click(x, y); await espera(90); await pg.mouse.click(x, y); }
      } else await tocar("#proxima");
      break;
    }
  }

  // --- fim -----------------------------------------------------------------
  s = await ate((x) => x.tela === "tela-fim" && !x.festa, 3000);
  if (!checa("saida", !!s, `não chegou na tela final (${m.como})`)) return;
  await espera(30);
  s = await est();
  checa("fim-coerente", s.tela === "tela-fim", `toque duplo no "Ver o resultado" pulou a tela final (${s.tela})`);
  if (s.tela !== "tela-fim") return;
  await checarTela();
  const fim = await pg.evaluate(() => ({
    titulo: document.getElementById("fim-titulo").textContent, texto: document.getElementById("fim-texto").textContent,
    frase: document.getElementById("fim-frase").textContent, recorde: document.getElementById("fim-recorde").textContent,
    grade: document.getElementById("fim-grade").textContent, nota: document.querySelector("#fim-carta .carta-nota strong")?.textContent,
    lista: document.querySelectorAll("#fim-lista li").length, share: Q.textoCompartilhar, deNovo: document.getElementById("de-novo").textContent,
    destaque: document.getElementById("fim-destaque")?.textContent || "",
  }));
  const d = m.degrau;
  if (m.como === "campeao") checa("fim-coerente", fim.titulo === "Prateleira Rei Pelé!", `título do campeão: ${fim.titulo}`);
  else checa("fim-coerente", fim.titulo.includes(`pergunta ${m.numero}`), `título "${fim.titulo}" não fala da pergunta ${m.numero}`);
  checa("fim-coerente", fim.nota === String(ESC[d].ovr), `carta final ${fim.nota}, esperava ${ESC[d].ovr} (${m.como} na ${m.numero})`);
  checa("fim-coerente", fim.grade === gradeEsperada(m.hist, m.como), `grade ${JSON.stringify(fim.grade)} vs ${JSON.stringify(gradeEsperada(m.hist, m.como))}`);
  checa("fim-coerente", fim.lista === m.hist.length, `lista com ${fim.lista} perguntas, jogou ${m.hist.length}`);
  if (m.como === "errou" && s.rr) checa("fim-coerente", fim.frase === s.rr, "frase da resposta não apareceu no fim");
  checa("fim-coerente", fim.destaque.trim().length > 10, `fim sem frase de incentivo/destaque (${m.como}, ${m.hist.filter(Boolean).length} acertos)`);
  // recorde
  const recTxt = d > rec && rec > 0 ? "Novo recorde" : rec > d ? ESC[rec].nome : "";
  checa("fim-coerente", recTxt ? fim.recorde.includes(recTxt) : fim.recorde === "", `recorde "${fim.recorde}", esperava "${recTxt}" (antes ${rec}, agora ${d})`);
  rec = Math.max(rec, d);
  // compartilhar
  const linhas = (fim.share || "").split("\n");
  const link = s.diario ? `${URL_JOGO}#desafio` : URL_JOGO;
  checa("compartilhar", /^Show do Dadão( · Desafio #\d+)?$/.test(linhas[0]) && fim.share.includes(gradeEsperada(m.hist, m.como))
    && fim.share.includes(`Carta: ${ESC[d].nome} (${ESC[d].ovr})`) && linhas.at(-1) === link && fim.share.length <= 280
    && !/undefined|null|NaN/.test(fim.share), `texto de compartilhar: ${JSON.stringify(fim.share)}`);
  if (c.compartilhar) {
    passo(`compartilhar (${c.compartilhar})`);
    const antes = await pg.evaluate(() => document.querySelector(".fim").innerText);
    await tocar("#compartilhar");
    await espera(150);
    const dep = await pg.evaluate(() => ({ t: document.querySelector(".fim").innerText, foi: window.__compartilhado.slice() }));
    if (c.compartilhar === "share" || c.compartilhar === "clipboard") checa("compartilhar", dep.foi.at(-1) === fim.share, `não compartilhou o texto (${c.compartilhar})`);
    if (c.compartilhar === "clipboard" || c.compartilhar === "negado") checa("compartilhar", dep.t !== antes, `compartilhar (${c.compartilhar}) não deu retorno na tela`);
    await checarTela();
  }
  if (c.story) {
    passo("imagem pros stories");
    await tocar("#story");
    const fimS = Date.now() + 10000;
    let t = "";
    while (Date.now() < fimS) { t = await pg.textContent("#story"); if (!/Gerando/.test(t)) break; await espera(100); }
    checa("compartilhar", /baixada|Imagem pros stories/.test(t), `stories: "${t}"`);
  }
  // diario: uma vez por dia
  if (s.diario) {
    checa("compartilhar", fim.deNovo === "Jogar partida livre", `botão do fim no desafio: ${fim.deNovo}`);
  }
  // depois do fim
  if (c.depois === "de-novo") {
    passo("Jogar de novo");
    await tocar("#de-novo");
    const n = await ate((x) => x.tela === "tela-jogo", 2000);
    checa("regras", n && n.numero === 1 && n.degrau === 0 && n.pulos === 3 && !n.diario && Object.values(n.ajudas).every((v) => v === true || v === 3), `jogar de novo não zerou: ${JSON.stringify(n && { n: n.numero, d: n.degrau, aj: n.ajudas })}`);
    await checarTela();
  } else if (c.depois === "trocar") {
    passo("Trocar nome ou posição");
    await tocar("#trocar");
    await ate((x) => x.tela === "tela-inicio", 2000);
    await checarTela();
    const i2 = await pg.evaluate(() => ({ rec: document.getElementById("inicio-recorde").textContent, dia: document.getElementById("diario").innerText }));
    checa("persistencia", rec ? i2.rec.includes(ESC[rec].nome) : i2.rec === "", `recorde no início depois do jogo: "${i2.rec}" (esperava ${rec ? ESC[rec].nome : "vazio"})`);
    if (s.diario) {
      checa("diario", /Já jogou hoje/.test(i2.dia), `depois do desafio o botão não diz que já jogou: "${i2.dia}"`);
      passo("Desafio do dia de novo");
      await tocar("#diario");
      const v = await ate((x) => x.tela !== "tela-inicio", 2000);
      const rev = await pg.evaluate(() => ({ g: document.getElementById("fim-grade").textContent, sh: Q.textoCompartilhar, rec: document.getElementById("fim-recorde").textContent }));
      checa("diario", v && v.tela === "tela-fim" && rev.g === fim.grade && rev.sh === fim.share, `segunda vez no desafio não mostrou o mesmo resultado (${v && v.tela})`);
      await checarTela();
    }
  }
}

// reabre a partida depois de recarregar: Continuar (livre) ou o botao do desafio
async function retomarDepoisDeRecarregar(c) {
  const vis = await pg.evaluate(() => {
    const b = document.getElementById("continuar");
    return { cont: !!b && window.__visivel(b), dia: document.getElementById("diario").innerText };
  });
  if (c.diario) {
    if (!/Continuar/i.test(vis.dia)) return false;
    passo("Continuar o desafio"); await tocar("#diario");
  } else {
    if (!vis.cont) return false;
    passo("Continuar partida"); await tocar("#continuar");
  }
  return true;
}

async function usarAjuda(a, m) {
  const antes = await est();
  if (a === "cartas") {
    passo("ajuda Cartas");
    await tocar("#ajuda-cartas");
    const e = await est();
    checa("feedback", e.acao === "cartas-caixa", "Cartas não abriu o baralho");
    await checarTela();
    const k = Math.floor(casoAtual.r() * 4);
    await tocar(".carta-baralho", k);
    const d = await ate((x) => x.acao === "acao-padrao", casoAtual.movimento ? 2500 : 1500);
    if (!checa("saida", !!d, "baralho não fechou")) return;
    checa("ajudas", d.eliminadas.length <= 3 && !d.eliminadas.includes(d.certa), `cartas eliminaram ${d.eliminadas} (certa ${d.certa})`);
    checa("feedback", /Cartas: saiu/.test(d.linha), `cartas sem fala: "${d.linha}"`);
  } else if (a === "boys") {
    passo("ajuda Golden Boys");
    await tocar("#ajuda-boys");
    const n = await pg.locator(".avatar-boy").count();
    checa("ajudas", n === 3, `${n} Golden Boys`);
    const d = await est();
    checa("feedback", /^Golden Boys:/.test(d.linha), `Golden Boys sem fala: "${d.linha}"`);
    checa("ajudas", !/undefined|: \s*·/.test(d.linha), `fala dos Golden Boys: ${d.linha}`);
  } else if (a === "arquibancada") {
    passo("ajuda Arquibancada");
    await tocar("#ajuda-arquibancada");
    const votos = await pg.$$eval("#alternativas .alternativa", (xs) => xs.map((x) => { const v = x.querySelector(".voto"); return v ? parseInt(v.textContent, 10) : null; }));
    const d = await est();
    const soma = votos.reduce((s, v) => s + (v || 0), 0);
    checa("ajudas", soma === 100 && votos.every((v, i) => (d.eliminadas.includes(i) ? v === null : v !== null && v >= 0)), `arquibancada ${JSON.stringify(votos)} (eliminadas ${d.eliminadas})`);
  } else if (a === "enciclopedia") {
    passo("ajuda Enciclopédia");
    await tocar("#ajuda-enciclopedia");
    const d = await est();
    const marcada = await pg.locator("#alternativas .alternativa").nth(d.certa).locator(".selo-enciclopedia").count();
    checa("ajudas", marcada === 1, "Enciclopédia não marcou a certa");
  }
  m.ajudas[a] = false;
  const d = await est();
  checa("feedback", d.linha !== antes.linha || d.alts !== antes.alts, `ajuda ${a} não mudou nada na tela`);
  checa("ajudas", d.ajudas[a] === false, `ajuda ${a} continua disponível`);
  await checarTela();
}

// --- banco de perguntas ---------------------------------------------------------------
async function validarBanco(browser) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await ctx.route("**/*", (rota) => (rota.request().url().startsWith(BASE) ? rota.continue() : rota.abort()));
  const p = await ctx.newPage();
  await p.goto(URL_JOGO);
  const banco = await p.evaluate(() => Object.values(Q.banco).flat());
  const norm = (x) => String(x).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const ids = new Set(), qs = new Set();
  for (const q of banco) {
    const alts = [q.a, ...(q.e || [])];
    const onde = `${q.id} "${String(q.q).slice(0, 50)}"`;
    checa("perguntas", typeof q.q === "string" && q.q.trim().length >= 12 && /[?:.]$/.test(q.q.trim()), `${onde}: enunciado vazio/sem pontuação`);
    checa("perguntas", Array.isArray(q.e) && q.e.length === 3 && alts.every((t) => typeof t === "string" && t.trim()), `${onde}: precisa de 1 certa + 3 erradas preenchidas`);
    checa("perguntas", new Set(alts.map(norm)).size === 4, `${onde}: alternativas repetidas ${alts.join(" | ")}`);
    checa("perguntas", !!(q.r || q.x), `${onde}: sem explicação (r nem x)`);
    checa("perguntas", !q.r || q.r.length <= 180, `${onde}: frase r passa de 180`);
    checa("perguntas", q.s >= 1 && q.s <= 10 && "fmdp".includes(q.n) && q.n, `${onde}: nota/nível inválido (${q.s}/${q.n})`);
    checa("perguntas", !ids.has(q.id) && !qs.has(norm(q.q)), `${onde}: pergunta repetida`);
    checa("perguntas", !/undefined|null|NaN|\[object/.test(JSON.stringify(q)), `${onde}: lixo no texto`);
    ids.add(q.id); qs.add(norm(q.q));
  }
  // cabe na tela: pergunta + alternativas + o erro com a explicacao inteira, e a comemoracao com a frase
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [1280, 800]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(() => { localStorage.clear(); });
    await p.click("button[type=submit]");
    const ruins = await p.evaluate(async () => {
      const barra = document.querySelector(".abas-mobile");
      const lim = innerHeight - (barra && getComputedStyle(barra).display !== "none" ? barra.offsetHeight : 0);
      const fora = [];
      for (const pg of Object.values(Q.banco).flat()) {
        Q.pergunta = pg; Q.opcoes = [{ texto: pg.a, certa: true }, ...pg.e.map((t) => ({ texto: t, certa: false }))];
        Q.eliminadas = new Set(); Q.escolhida = null; Q.marcas = { votos: null, boys: [[], [], [], []], enciclopedia: null };
        document.getElementById("enunciado").textContent = pg.q; desenharAlternativas();
        // erro com a explicacao, como o confirmar desenha
        document.getElementById("retorno").classList.add("errou");
        document.getElementById("retorno-texto").textContent = typeof textoDoErro === "function" ? textoDoErro(pg, "A") : `Errou! A certa era A, ${pg.a}.${pg.x ? ` ${pg.x}` : ""}`;
        document.getElementById("retorno-subiu").textContent = "A carta volta pra Prateleira Messi e CR7 (92). Bola pra frente!";
        document.getElementById("proxima").hidden = false;
        mostrarAcao("retorno");
        const b = document.getElementById("proxima").getBoundingClientRect().bottom + scrollY;
        // o botao tem que estar visivel sem rolar a pagina inteira (topo da pergunta na tela)
        const topo = document.getElementById("pergunta-cabeca").getBoundingClientRect().top + scrollY;
        if (b - topo > lim - 8) fora.push(`erro passa ${Math.round(b - topo - lim)}px: ${pg.q.slice(0, 50)}`);
        const alts = document.getElementById("alternativas").getBoundingClientRect();
        if (alts.right > innerWidth + 1) fora.push(`alternativas vazam: ${pg.q.slice(0, 50)}`);
      }
      document.getElementById("retorno").classList.remove("errou");
      mostrarAcao("acao-padrao");
      // comemoracao com frase e curiosidade
      for (const pg of Object.values(Q.banco).flat()) {
        if (!pg.r && !pg.x) continue;
        comemorar(15, { frase: pg.r || "", curiosidade: pg.x || "", duracao: 60000 });
        const cx = document.querySelector(".festa-quiz-caixa").getBoundingClientRect();
        if (cx.top < -1 || cx.bottom > innerHeight + 1) fora.push(`comemoração corta ${Math.round(Math.max(-cx.top, cx.bottom - innerHeight))}px: ${pg.q.slice(0, 50)}`);
        document.querySelector(".festa-quiz-pop").remove();
      }
      return fora;
    });
    checa("perguntas", ruins.length === 0, `${w}x${h}: ${ruins.length} não cabem; ex.: ${ruins.slice(0, 3).join(" | ")}`);
    await p.reload();
  }
  await ctx.close();
  return banco.length;
}

// --- execucao -----------------------------------------------------------------------
const inicio = Date.now();
let browser = await chromium.launch();
const nPerguntas = SO === null && !process.env.SEM_BANCO ? await validarBanco(browser) : 0;
console.error(`   banco validado em ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
const casos = (SO !== null ? SO : [...Array(CASOS).keys()]).map(sortearCaso);
// agrupa por tipo de contexto (toque/mouse x movimento): um contexto e uma pagina por vez
const grupos = new Map();
for (const c of casos) { const k = `${c.toque}|${c.movimento}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); }
let feitos = 0, comFalha = 0, quedas = 0;
const porPolitica = {};
for (const [k, lista] of grupos) {
  const [toque, mov] = k.split("|").map((x) => x === "true");
  let ctx = null;
  let reabrir = false;
  // abre contexto e pagina; se o chromium caiu (falta de memoria na maquina), sobe outro
  const abrir = async (tentativa = 0) => {
    try { await abrir1(); } catch (e) {
      if (tentativa >= 3) throw e;
      quedas += 1;
      await browser.close().catch(() => {});
      browser = await chromium.launch(); ctx = null;
      await abrir(tentativa + 1);
    }
  };
  const abrir1 = async () => {
    if (!browser.isConnected()) { quedas += 1; browser = await chromium.launch(); ctx = null; }
    if (!ctx) {
      ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: toque, hasTouch: toque, reducedMotion: mov ? "no-preference" : "reduce", acceptDownloads: true });
      await ctx.addInitScript(INIT);
      await ctx.route("**/*", (rota) => (rota.request().url().startsWith(BASE) ? rota.continue() : rota.abort()));
    }
    pg = await ctx.newPage();
    pg.on("pageerror", (e) => errosJS.push(e.message));
    pg.on("console", (msg) => { if (msg.type() === "error" && !/Failed to load resource|net::ERR/.test(msg.text())) errosJS.push(msg.text()); });
    pg.on("dialog", (d) => d.dismiss());
    await pg.goto(URL_JOGO);
    await ESCADA(pg);
    reabrir = false;
  };
  await abrir();
  for (const c of lista) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const salvo = JSON.stringify(Object.fromEntries(Object.entries(contagem).map(([n, v]) => [n, { n: v.n, f: v.falhas.length }])));
      casoAtual = { ...sortearCaso(c.i), passos: [], falhou: false }; // sorteio novo: repetir o caso e igual
      const tCaso = Date.now();
      errosJS = [];
      try {
        await Promise.race([
          jogarCaso(casoAtual, reabrir),
          espera(c.movimento ? 200000 : 150000).then(() => { throw new Error("tempo esgotado (travou?)"); }),
        ]);
        if (errosJS.length) checa("sem-erro-js", false, errosJS.join(" | ").slice(0, 300));
        checa("saida", true);
        reabrir = true;
      } catch (e) {
        if (!browser.isConnected() || /has been closed|Target closed|crashed/i.test(String(e.message))) {
          // o navegador morreu (nao foi o jogo): desfaz as checagens do caso e repete do zero
          for (const [n, v] of Object.entries(JSON.parse(salvo))) { contagem[n].n = v.n; contagem[n].falhas.length = v.f; }
          await abrir();
          if (tentativa === 0) continue;
        }
        checa("saida", false, `exceção: ${String(e.message || e).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8).join(" | ").slice(0, 600)}`);
        await pg.close().catch(() => {});
        await abrir();
      }
      const dur = Date.now() - tCaso;
      if (DETALHE) console.error(`   dur caso ${c.i} ${c.politica} ${c.movimento} ${dur}ms passos ${casoAtual.passos.length}`);
      break;
    }
    feitos += 1;
    porPolitica[c.politica] = (porPolitica[c.politica] || 0) + 1;
    if (casoAtual.falhou) {
      comFalha += 1;
      if (DETALHE || SO !== null) console.log(`   caso ${c.i} (semente ${c.semente}) ${c.w}x${c.h} ${c.toque ? "toque" : "mouse"}: ${casoAtual.passos.join(" → ")}`);
    }
    if (feitos % 250 === 0) console.error(`   ... ${feitos}/${casos.length} casos, ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
  }
  await pg.close().catch(() => {});
  await ctx.close().catch(() => {});
}
await browser.close();
async function ESCADA(p) { if (!ESC) ESC = await p.evaluate(() => ESCADA_QUIZ.map((g) => ({ nome: g.nome, ovr: g.ovr, valor: g.valor }))); }

// --- resumo -----------------------------------------------------------------------
const linhas = [];
let quebrou = false;
for (const [inv, { n, falhas }] of Object.entries(contagem)) {
  if (falhas.length) {
    quebrou = true;
    linhas.push(`FALHA ${inv} (${INVARIANTES[inv]}): ${falhas.length} de ${n} checagens`);
    for (const f of falhas.slice(0, 4)) linhas.push(`      ${f}`);
  } else linhas.push(`OK   ${inv}: ${n} checagens (${INVARIANTES[inv]})`);
}
const seg = ((Date.now() - inicio) / 1000).toFixed(0);
linhas.push(`${comFalha ? "FALHA" : "OK  "} ${feitos} casos independentes (${comFalha} com falha), ${nPerguntas} perguntas validadas, ${seg}s${quedas ? `, navegador caiu ${quedas}x (caso repetido)` : ""}; políticas ${JSON.stringify(porPolitica)}`);
console.log(linhas.join("\n"));
if (SO === null) {
  mkdirSync(path.join(pasta, "resultados"), { recursive: true });
  writeFileSync(path.join(pasta, "resultados", `bateria-ux-dadao-${feitos}.txt`), linhas.join("\n") + "\n");
}
process.exit(quebrou ? 1 : 0);
