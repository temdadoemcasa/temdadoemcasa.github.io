// Bateria de UX do Top 10 em Casa: milhares de casos independentes, cada um com
// semente propria (viewport, toque ou mouse, ranking do dia ou livre, politica de
// chutes), jogando de verdade na pagina. Em 1 de cada 4 casos o jogo e por cliques
// reais (digita 3 letras do nome e clica na sugestao); nos demais, por chutar().
//
//   python3 -m http.server 8766 &                       (na raiz do repo)
//   node testes/bateria-ux-top10.mjs                    (CI: 300 casos, ~2 min; rodar.mjs corta em 8 min)
//   CASOS=4000 node testes/bateria-ux-top10.mjs         (bateria cheia)
//   SO=1234 node testes/bateria-ux-top10.mjs            (repete so o caso 1234; SO=57,58 repete os dois)
//   SEMENTE=7 muda o conjunto de sementes.
//
// Saida: "OK  <invariante> (N casos)" ou "FALHA <invariante> semente=<s> passo=<i> ...".
// O resumo vai pra testes/resultados/bateria-ux-top10.json.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";

const BASE = process.env.BASE || "http://localhost:8766";
const CASOS = Number(process.env.CASOS || 300); // rodar.mjs mata teste com 8 min: o padrao cabe folgado
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.SO ? process.env.SO.split(",").map(Number) : null;
const PAGINA = BASE + "/top10-em-casa.html";

const prng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sementeDo = (i) => (SEMENTE * 1000003 + i * 7919) >>> 0;

// --- registro das invariantes --------------------------------------------------------
const INV = new Map(); // nome -> { n, falhas: [] }
const conta = (nome) => { if (!INV.has(nome)) INV.set(nome, { n: 0, falhas: [] }); return INV.get(nome); };
const CLIQUES = { casos: 0, efetivos: 0 }; // casos de clique x chutes que de fato foram por clique
const atual = new AsyncLocalStorage(); // o caso em andamento de cada trabalhador
const checar = (nome, cond, detalhe = "") => {
  const caso = atual.getStore();
  const r = conta(nome);
  r.n++;
  if (!cond) r.falhas.push(`semente=${caso.semente} passo=${caso.passo} (caso #${caso.i}, ${caso.desc}): ${String(detalhe).slice(0, 300)}`);
  return cond;
};

// --- auditoria de tela, rodada dentro da pagina (mesma da bateria do Prata) -----------
const CHECAR_TELA = () => {
  const P = [];
  const vw = document.documentElement.clientWidth;
  const visivel = (e) => { if (!e.getClientRects().length) return false; const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01; };
  const areas = [document.querySelector("main"), ...document.querySelectorAll(".festa")].filter(Boolean);
  for (const a of areas) {
    const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.textContent;
      if (!t.trim() || !n.parentElement || !visivel(n.parentElement)) continue;
      if (n.parentElement.closest("input")) continue;
      if (/\bundefined\b|\bnull\b|\bNaN\b|\[object|Infinity/.test(t)) P.push(["texto quebrado", t.trim().slice(0, 80)]);
    }
  }
  if (document.documentElement.scrollWidth > vw + 1) {
    const fora = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1);
    const culpado = fora.find((e) => !fora.includes(e.parentElement) && getComputedStyle(e).position !== "fixed") || fora[0];
    P.push(["sem rolagem lateral", `scrollWidth ${document.documentElement.scrollWidth} > ${vw}: ${culpado ? `${culpado.tagName.toLowerCase()}.${[...culpado.classList].join(".")} "${culpado.textContent.trim().slice(0, 40)}"` : "?"}`]);
  }
  const rolaX = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return true; } return false; };
  for (const e of document.querySelectorAll("main button, main h1, main h2, main p, main b, main small, main .sugestao, main .barra-corpo")) {
    if (!visivel(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1) continue;
    if ((r.right > vw + 1 || r.left < -1) && !rolaX(e)) P.push(["nada cortado na lateral", `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} ${Math.round(r.left)}..${Math.round(r.right)} (vw ${vw}) "${e.textContent.trim().slice(0, 40)}"`]);
  }
  for (const b of document.querySelectorAll("main button, main .sugestao")) {
    if (!visivel(b)) continue;
    const nome = (b.getAttribute("aria-label") || b.textContent || b.title || "").trim();
    if (!nome) P.push(["botão com nome acessível", b.outerHTML.slice(0, 80)]);
    const r = b.getBoundingClientRect();
    if (r.height < 24 || r.width < 24) P.push(["alvo de toque ≥24px", `${nome.slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`]);
  }
  for (const i of document.querySelectorAll("main input:not([type=range])")) {
    if (!visivel(i)) continue;
    const fs = parseFloat(getComputedStyle(i).fontSize);
    if (fs < 16) P.push(["input ≥16px", `#${i.id} ${fs}px`]);
  }
  return P;
};
const NOMES_TELA = ["texto quebrado", "sem rolagem lateral", "nada cortado na lateral", "botão com nome acessível", "alvo de toque ≥24px", "input ≥16px"];
const auditar = async (p) => {
  const achados = await p.evaluate(CHECAR_TELA);
  for (const nome of NOMES_TELA) checar(nome, !achados.some(([n]) => n === nome), achados.filter(([n]) => n === nome).map(([, d]) => d).slice(0, 2).join(" | "));
};

// --- o mundo ------------------------------------------------------------------------------
const VIEWPORTS = [[360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 900], [1440, 900]];
const POLITICAS = ["otima", "pessima", "mista", "quase", "repetidos", "recarrega", "corrompido"];
const CORROMPIDOS = [
  "{quebrado", "[]", "null", "42", '"texto"',
  '{"serie":{"atual":"x","melhor":-3,"ultimo":7},"diario":{"data":1}}',
  '{"serie":null,"diario":{"data":"HOJE","id":"x","acertos":"a","erros":null,"fim":"sim"}}',
  '{"diario":{"data":"HOJE","id":"INEXISTENTE","acertos":[1,2,3],"erros":[4],"fim":true}}',
];
const LIXOS = { n: 0 };
const DATAS = ["2026-10-05", "2026-10-06", "2026-12-31", "2027-02-28", "2028-02-29", "2026-10-01", "2026-09-01", "2030-07-15", "2027-01-01"];

const b = await chromium.launch();
const mkCtx = async (toque) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: toque, isMobile: toque, reducedMotion: toque ? "no-preference" : "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  // fontes e contador externos: respondem vazio (sem rede de fora, sem console.error de recurso)
  await ctx.route((u) => u.origin !== new URL(BASE).origin, (r) => r.fulfill({ status: 200, contentType: r.request().resourceType() === "stylesheet" ? "text/css" : "application/javascript", body: "" }));
  return ctx;
};

const montarCaso = (i) => {
  const rnd = prng(sementeDo(i));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const cliques = i % 4 === 0;
  const toque = Math.floor(i / 4) % 2 === 1;
  const vps = toque ? VIEWPORTS.slice(0, 5) : VIEWPORTS.filter(([w]) => w >= 768 || rnd() < 0.3);
  const [w, h] = pick(vps);
  const diario = rnd() < 0.5;
  const politica = pick(POLITICAS);
  const data = pick(DATAS);
  return { i, semente: sementeDo(i), rnd, cliques, toque, w, h, diario, politica, data, desc: `${w}x${h} ${toque ? "toque" : "mouse"} ${diario ? "diario " + data : "livre"} ${politica}${cliques ? " cliques" : ""}`, passo: 0 };
};

// --- um caso --------------------------------------------------------------------------------
async function jogarCaso(ctx, c) {
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") erros.push("console.error: " + m.text()); });
  await ctx.clock.setFixedTime(new Date(`${c.data}T12:00:00`));
  await p.setViewportSize({ width: c.w, height: c.h });
  const abrir = async () => { await p.goto(PAGINA); await p.waitForSelector("#form-inicio:not([hidden])"); };
  const entrar = async () => {
    await p.click(c.diario ? "#jogar-dia" : "#jogar-livre");
    await p.waitForSelector("#tela-jogo:not([hidden])");
  };
  try {
    await abrir();
    await p.evaluate(() => localStorage.clear());
    if (c.politica === "corrompido") {
      const hoje = await p.evaluate(() => hojeLocal());
      const lixo = CORROMPIDOS[LIXOS.n++ % CORROMPIDOS.length]; // em rodizio: toda forma de lixo aparece em qualquer rodada
      await p.evaluate(([l, h]) => { localStorage.setItem("top10:v1", l.replaceAll("HOJE", h)); localStorage.setItem("top10:vistos", "{lixo"); }, [lixo, hoje]);
      c.desc += ` lixo=${lixo.slice(0, 30)}`;
      await p.reload(); await p.waitForSelector("#form-inicio:not([hidden])");
    }
    await auditar(p); // tela inicial
    checar("inicio mostra o ranking e a sequência", (await p.textContent("#card-dia")).trim().length > 10 && (await p.textContent("#serie")).trim().length > 0, "card ou sequencia vazios");
    await entrar();
    if (c.cliques) CLIQUES.casos++;

    // o que o teste sabe do ranking, independente do estado do jogo (refeito se a livre trocar de ranking)
    let R, top, quase, sequencia;
    const embaralha = (a) => { a = [...a]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(c.rnd() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
    const lerRanking = async () => {
      R = await p.evaluate(() => ({
        top: T.ranking.top.map((t) => t.player_id), quase: T.ranking.quase.map((q) => q.player_id),
        fora: (() => { const no = new Set([...T.ranking.top, ...T.ranking.quase].map((x) => x.player_id)); return T.opcoes.filter((o) => !no.has(o.id)).map((o) => o.id); })(),
        id: T.ranking.id, nomes: Object.fromEntries(T.opcoes.map((o) => [o.id, o.nome])),
      }));
      top = new Set(R.top); quase = new Set(R.quase);
      let fila;
      switch (c.politica) {
        case "otima": fila = embaralha(R.top); break;
        case "pessima": fila = embaralha(R.fora); break;
        // o quase pode ter menos de 3 (ou nenhum: zeros e empate cortado no 20o ficam fora); completa com fora
        case "quase": fila = [...embaralha(R.quase), ...embaralha(R.fora)]; break;
        default: { // mista, repetidos, recarrega, corrompido: mistura sorteada
          const t = embaralha(R.top), q = embaralha(R.quase), f = embaralha(R.fora);
          const pa = c.rnd() * 0.8 + 0.1;
          fila = [];
          for (let k = 0; k < 40; k++) { const x = c.rnd(); fila.push(x < pa ? (t.shift() ?? f.shift()) : x < pa + (1 - pa) / 2 ? (q.shift() ?? f.shift()) : (f.shift() ?? q.shift())); }
          fila = fila.filter((x) => x != null);
        }
      }
      // rajada de repetidos: cada chute pode vir 1-4 vezes seguidas
      sequencia = [];
      for (const id of fila) { sequencia.push(id); if (c.politica === "repetidos") for (let r = c.rnd() * 4 | 0; r > 0; r--) sequencia.push(id); }
    };
    await lerRanking();
    const recarregarEm = c.politica === "recarrega" ? 1 + (c.rnd() * 5 | 0) : -1;

    // estado independente do teste
    const jaChutados = new Set();
    let acertos = 0, erros_validos = 0, validos = 0;
    const conferirPlacar = async (rotulo) => {
      const e = await p.evaluate(() => ({ abertas: document.querySelectorAll(".barra.aberta").length, cheias: document.querySelectorAll(".vida.cheia").length, acertos: T.acertos.size, vidas: T.vidas, fim: T.fim, tela: !document.getElementById("tela-fim").hidden, placar: document.getElementById("placar").textContent }));
      checar("barras abertas = acertos", e.abertas === acertos && e.acertos === acertos, `${rotulo}: abertas ${e.abertas}, T.acertos ${e.acertos}, esperado ${acertos}`);
      checar("vidas = 3 − erros válidos", e.cheias === 3 - erros_validos && e.vidas === 3 - erros_validos, `${rotulo}: cheias ${e.cheias}, T.vidas ${e.vidas}, esperado ${3 - erros_validos}`);
      return e;
    };
    // jogada: devolve true se a partida acabou
    const jogar = async (id, porClique) => {
      const repetido = jaChutados.has(id);
      const esperado = repetido ? "repetido" : top.has(id) ? "acerto" : quase.has(id) ? "quase" : "fora";
      let obtido = null;
      if (porClique && !repetido) {
        const nome = R.nomes[id];
        // 3 letras do nome; se a lista (max 8) nao trouxe o jogador, mais letras ate caber
        let k = 3, ind = -1;
        while (k <= nome.length) {
          await p.fill("#busca", "");
          await p.locator("#busca").pressSequentially(nome.slice(0, k));
          ind = await p.evaluate((alvo) => sugestoes.findIndex((o) => o.id === alvo), id);
          if (ind >= 0) break;
          k++;
        }
        if (ind >= 0) {
          await p.waitForSelector(".sugestao");
          if (!sugestoesAuditadas) { sugestoesAuditadas = true; await auditar(p); } // lista de sugestoes aberta
          const li = p.locator(".sugestao").nth(ind);
          if (c.toque) await li.tap(); else await li.click();
          obtido = "clique"; CLIQUES.efetivos++;
        }
      }
      if (obtido == null) obtido = await p.evaluate((x) => chutar(x), id);
      if (obtido !== "clique") checar("chutar() devolve o resultado certo", obtido === esperado, `id ${id}: esperado ${esperado}, veio ${obtido}`);
      if (!repetido) {
        jaChutados.add(id); validos++;
        if (esperado === "acerto") acertos++; else erros_validos++;
      }
      const fim = acertos >= 10 || erros_validos >= 3;
      if (obtido === "clique") {
        // nao ha retorno no clique: o efeito na tela e que diz o que aconteceu
        const e = await p.evaluate(() => ({ a: T.acertos.size, e: T.erros.length }));
        checar("clique na sugestão chuta o jogador certo", e.a === acertos && e.e === erros_validos, `esperado ${acertos}/${erros_validos} (${esperado} id ${id}), tela ${e.a}/${e.e}`);
      }
      return fim;
    };

    let modeloFim = false, n = 0, sugestoesAuditadas = false, recarregou = false;
    // quem manda e a pagina: joga ate T.fim (ou a fila acabar); o modelo do teste so serve de comparacao
    const paginaFim = () => p.evaluate(() => T.fim && !document.getElementById("tela-fim").hidden);
    for (let idx = 0; idx < sequencia.length;) {
      modeloFim = await jogar(sequencia[idx++], c.cliques);
      n++; c.passo = n;
      await conferirPlacar(`após ${n} chutes`);
      const fimPagina = await paginaFim();
      checar("fim da página = fim do modelo", fimPagina === modeloFim, `página ${fimPagina}, modelo ${modeloFim} (${acertos} acertos, ${erros_validos} erros)`);
      if (fimPagina) break;
      if (n === recarregarEm && !recarregou) {
        recarregou = true;
        await p.reload(); await p.waitForSelector("#form-inicio:not([hidden])");
        if (c.diario) {
          await entrar();
          const e = await conferirPlacar("após recarregar (diário guarda)");
          checar("recarregar no diário mantém o progresso", e.acertos === acertos, `acertos ${e.acertos} x ${acertos}`);
        } else {
          // partida livre nao e guardada: recomeca do zero e joga ate o fim com a fila do ranking novo
          await entrar();
          const z = await p.evaluate(() => ({ a: T.acertos.size, v: T.vidas, f: T.fim }));
          checar("livre recarregada recomeça limpa", z.a === 0 && z.v === 3 && !z.f, `acertos ${z.a}, vidas ${z.v}, fim ${z.f}`);
          jaChutados.clear(); acertos = 0; erros_validos = 0; validos = 0; idx = 0;
          await lerRanking();
        }
      }
    }
    // o fim: a pagina tem que ter terminado a partida, em <= 13 chutes validos
    const e = await conferirPlacar("no fim");
    const terminou = await paginaFim();
    checar("a fila de chutes terminou a partida", terminou, `fila esgotada sem fim da página (${acertos} acertos, ${erros_validos} erros, ${n} passos)`);
    checar("o fim chega em ≤ 13 chutes válidos", terminou && validos <= 13, `válidos ${validos}, fim da página ${terminou}`);
    if (terminou) {
      checar("placar = acertos", new RegExp(`^${acertos}\\s*/\\s*10$`).test(e.placar.trim()), `placar "${e.placar}", acertos ${acertos}`);
      checar("fim revela as 10 barras", await p.locator(".barra.aberta, .barra.revelada").count() === 10, "barras abertas+reveladas != 10");
      const txt = await p.evaluate(() => textoCompartilhar());
      const quad = [...txt.matchAll(/🟩|⬛/gu)].map((m) => m[0]);
      checar("compartilhar com 10 quadradinhos e o link", quad.length === 10 && quad.filter((q) => q === "🟩").length === acertos && txt.includes("temdadoemcasa.github.io/top10-em-casa.html") && !/undefined|null|NaN|\[object/.test(txt), txt.slice(0, 200));
      if (c.cliques) {
        // o botao de verdade: copia o mesmo texto (sem Web Share no desktop)
        const temShare = await p.evaluate(() => !!navigator.share);
        if (!temShare) {
          if (c.toque) await p.tap("#compartilhar"); else await p.click("#compartilhar");
          const copiado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
          checar("botão compartilhar copia o texto", copiado === txt, `copiado ${JSON.stringify(String(copiado).slice(0, 80))}`);
        }
      }
      await auditar(p); // tela do fim
    }
    checar("sem pageerror/console.error", erros.length === 0, erros.join(" | "));
    checar("o caso rodou até o fim", true);
  } catch (err) {
    checar("o caso rodou até o fim", false, `${err.message.split("\n")[0]}${erros.length ? " | página: " + erros.join(" | ") : ""}`);
  } finally {
    await p.close();
  }
}

// --- execucao: 2 contextos (mouse e toque) andam juntos, cada um com a sua fila de casos -----------
const lista = SO || Array.from({ length: CASOS }, (_, i) => i);
const casos = lista.map(montarCaso);
const ctxMouse = await mkCtx(false), ctxToque = await mkCtx(true);
const inicio = Date.now();
let feitos = 0;
const trabalhador = async (ctx, fila) => {
  for (const c of fila) {
    await atual.run(c, () => jogarCaso(ctx, c)); // checar() acha o caso certo mesmo com 2 trabalhadores
    if (++feitos % 100 === 0) console.error(`... ${feitos}/${casos.length} (${Math.round((Date.now() - inicio) / 1000)}s)`);
  }
};
await Promise.all([trabalhador(ctxMouse, casos.filter((c) => !c.toque)), trabalhador(ctxToque, casos.filter((c) => c.toque))]);
await b.close();

// --- resumo -----------------------------------------------------------------------------------------
let falhou = false;
const resumo = { cliques: CLIQUES, casos: lista.length, semente: SEMENTE, segundos: Math.round((Date.now() - inicio) / 1000), invariantes: {} };
for (const [nome, r] of [...INV].sort(([a], [z]) => a.localeCompare(z, "pt-BR"))) {
  resumo.invariantes[nome] = { n: r.n, falhas: r.falhas.length, exemplos: r.falhas.slice(0, 5) };
  if (r.falhas.length) { falhou = true; console.log(`FALHA ${nome} (${r.falhas.length} de ${r.n}): ${r.falhas.slice(0, 5).join("\n      ")}`); }
  else console.log(`OK  ${nome} (${r.n} casos)`);
}
mkdirSync(new URL("./resultados/", import.meta.url), { recursive: true });
writeFileSync(new URL("./resultados/bateria-ux-top10.json", import.meta.url), JSON.stringify(resumo, null, 2) + "\n");
console.log(`cliques efetivos: ${CLIQUES.efetivos} chutes em ${CLIQUES.casos} casos de clique`);
console.log(`${falhou ? "FALHOU" : "LIMPO"}: ${lista.length} casos em ${resumo.segundos}s`);
process.exit(falhou ? 1 : 0);
