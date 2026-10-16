// Bateria de UX do Maior ou Menor: centenas de casos independentes, cada um com
// semente propria (viewport, deck, diario ou livre, politica de resposta), jogando
// de verdade na pagina. Em 1 de cada 4 casos a resposta e por clique real em
// #mais/#menos; nos demais, por responder(). Em 1 de cada 8 casos a animacao esta
// ligada (revelacao de verdade); nos outros, reducedMotion para caber no tempo.
//
//   python3 -m http.server 8777 &                               (na raiz do repo)
//   BASE=http://localhost:8777 node testes/bateria-ux-maior-menor.mjs    (300 casos)
//   CASOS=2000 node testes/bateria-ux-maior-menor.mjs                    (bateria cheia)
//   SO=12 node testes/bateria-ux-maior-menor.mjs                         (repete so o caso 12; SO=12,13)
//   SEMENTE=7 muda o conjunto de sementes.
//
// Saida: "OK  <invariante> (N casos)" ou "FALHA <invariante> semente=<s> passo=<i> ...".
// O resumo vai pra testes/resultados/bateria-ux-maior-menor.json.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8777";
const CASOS = Number(process.env.CASOS || 300);
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.SO ? process.env.SO.split(",").map(Number) : null;
const PAGINA = BASE + "/maior-ou-menor.html";

const prng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sementeDo = (i) => (SEMENTE * 1000003 + i * 7919) >>> 0;

const INV = new Map();
let caso = null;
const checar = (nome, cond, detalhe = "") => {
  if (!INV.has(nome)) INV.set(nome, { n: 0, falhas: [] });
  const r = INV.get(nome);
  r.n++;
  if (!cond) r.falhas.push(`semente=${caso.semente} passo=${caso.passo} (caso #${caso.i}, ${caso.desc}): ${String(detalhe).slice(0, 300)}`);
  return cond;
};

// roda dentro da pagina, com a mesa parada (esperando a resposta)
const LER = () => {
  const vw = document.documentElement.clientWidth;
  const txt = (s) => document.querySelector(s).textContent;
  const dir = document.querySelector(".carta.dir");
  // texto da carta escondida sem o recorte (que traz "25/26" e anos) e, fora da pergunta
  // "jogos", sem a linha de jogos (que e um dado proprio da carta)
  const partes = [".nome", ".clube-nome", ".posicao", ".valor", ".unidade"];
  if (M.stat === "jogos") partes.push(".jogos");
  const escondido = partes.map((s) => dir.querySelector(s).textContent).join(" | ");
  const btn = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { h: r.height, w: r.width, bottom: r.bottom, top: r.top, ih: innerHeight, vis: cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.01 && e.getClientRects().length > 0, dis: e.disabled }; };
  const quebrado = [];
  const w = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.textContent, pe = n.parentElement;
    if (!t.trim() || !pe || !pe.getClientRects().length) continue;
    if (/\bundefined\b|\bnull\b|\bNaN\b|\[object|Infinity/.test(t)) quebrado.push(t.trim().slice(0, 60));
  }
  const E = M.esquerda, D = M.direita, s = M.stat;
  return {
    stat: s, seq: M.seq, fim: M.fim, deck: M.deck, total: new Set(M.dado.decks[M.deck].cartas.map((c) => c.player_id)).size,
    e: { id: E.id, pid: E.player_id, rec: E.recorte, v: E.valores[s] },
    d: { id: D.id, pid: D.player_id, rec: D.recorte, v: D.valores[s] },
    domSeq: txt("#seq"), valorDir: dir.querySelector(".valor").textContent, escondido,
    pergunta: txt("#pergunta"), quebrado,
    scrollW: document.documentElement.scrollWidth, vw,
    mais: btn("mais"), menos: btn("menos"),
    telaJogo: !document.getElementById("tela-jogo").hidden, telaFim: !document.getElementById("tela-fim").hidden,
  };
};

const VIEWPORTS = [[360, 640], [390, 844], [768, 1024], [1280, 720], [1366, 768], [1920, 1080]];
const DATAS = ["2026-10-09", "2026-10-10", "2026-12-31", "2027-02-28", "2028-02-29", "2030-07-15"];

const montarCaso = (i) => {
  const rnd = prng(sementeDo(i));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const [w, h] = pick(VIEWPORTS);
  const deck = pick(["brasileirao", "europa"]);
  const diario = rnd() < 0.5;
  const movimento = i % 8 === 4;
  const cliques = i % 4 === 0;
  const aleatoria = rnd() < 0.4;
  let alvo = Math.floor(rnd() * 41);
  if (movimento) alvo = Math.min(alvo, 2); // com animacao cada acerto custa 1,6 s
  const data = pick(DATAS);
  return { i, semente: sementeDo(i), rnd, w, h, deck, diario, movimento, cliques, aleatoria, alvo, data, passo: 0,
    desc: `${w}x${h} ${deck} ${diario ? "diario " + data : "livre"} ${aleatoria ? "aleatoria" : "alvo " + alvo}${cliques ? " cliques" : ""}${movimento ? " movimento" : ""}` };
};

async function jogarCaso(ctx, c) {
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") erros.push("console.error: " + m.text()); });
  try {
    await ctx.clock.setFixedTime(new Date(`${c.data}T12:00:00`));
    await p.setViewportSize({ width: c.w, height: c.h });
    await p.goto(PAGINA);
    await p.waitForSelector("#tela-inicio:not([hidden]) #jogar-dia:not([disabled])", { timeout: 10000 });
    await p.evaluate(() => localStorage.clear());
    await p.click(c.deck === "europa" ? "#deck-europa" : "#deck-brasileirao");
    await p.click(c.diario ? "#jogar-dia" : "#jogar-livre");
    await p.waitForSelector("#tela-jogo:not([hidden])");

    const vistas = new Set();
    let ultimoDir = null, terminou = false, acertos = 0;
    for (let passo = 1; passo <= 80; passo++) {
      c.passo = passo;
      const s = await p.evaluate(LER);
      // --- mesa parada: par e tela ---
      checar("par valido", s.e.rec === s.d.rec && s.e.pid !== s.d.pid && s.e.id !== s.d.id && s.e.v !== s.d.v && Number.isFinite(s.e.v) && Number.isFinite(s.d.v),
        `${s.stat}: ${JSON.stringify(s.e)} x ${JSON.stringify(s.d)}`);
      checar("texto sem undefined|null|NaN", s.quebrado.length === 0 && !/undefined|NaN|null/.test(s.pergunta), s.quebrado.join(" | ") || s.pergunta);
      checar("#seq igual a M.seq", s.domSeq === String(s.seq) && s.seq === acertos, `#seq "${s.domSeq}", M.seq ${s.seq}, acertos ${acertos}`);
      checar("carta da direita escondida nao mostra o proprio valor", s.valorDir === "?" && !new RegExp(`(?<![\\d.,])${String(s.d.v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d.,])`).test(s.escondido), `${s.stat}=${s.d.v}: "${s.escondido}"`);
      checar("sem transbordo horizontal", s.scrollW <= s.vw + 1, `scrollWidth ${s.scrollW} > ${s.vw}`);
      checar("MAIS e MENOS visiveis e com >= 44px de altura", s.mais.vis && s.menos.vis && s.mais.h >= 44 && s.menos.h >= 44 && s.mais.w > 0 && s.menos.w > 0 && !s.mais.dis && !s.menos.dis, `mais ${Math.round(s.mais.w)}x${Math.round(s.mais.h)} dis=${s.mais.dis}, menos ${Math.round(s.menos.w)}x${Math.round(s.menos.h)} dis=${s.menos.dis}`);
      checar("MAIS e MENOS inteiros dentro da tela", s.mais.bottom <= s.mais.ih && s.menos.bottom <= s.menos.ih && s.mais.top >= 0 && s.menos.top >= 0, `mais ${Math.round(s.mais.top)}-${Math.round(s.mais.bottom)}, menos ${Math.round(s.menos.top)}-${Math.round(s.menos.bottom)}, altura ${s.mais.ih}`);
      // nenhuma carta nova repetida (a esquerda de agora e a direita de antes; o resto tem que ser inedito)
      // (por jogador: Hulk 2024 e Hulk 2025 contam como um; total = jogadores distintos do deck)
      const novas = [[s.e.id, s.e.pid], [s.d.id, s.d.pid]].filter(([id]) => id !== ultimoDir).map(([, pid]) => pid);
      const deckEsgotado = vistas.size + 2 > s.total;
      if (vistas.size === 0) { vistas.add(s.e.pid); vistas.add(s.d.pid); }
      else {
        checar("nenhum jogador repetido na partida", deckEsgotado || novas.every((pid) => !vistas.has(pid)), `jogadores ${novas.join(",")} ja vistos (${vistas.size} de ${s.total})`);
        for (const pid of novas) vistas.add(pid);
      }
      ultimoDir = s.d.id;

      // --- a resposta ---
      const certo = s.d.v > s.e.v ? "mais" : "menos";
      const errado = certo === "mais" ? "menos" : "mais";
      const escolha = c.aleatoria ? (c.rnd() < 0.5 ? "mais" : "menos") : (s.seq < c.alvo ? certo : errado);
      const esperado = escolha === certo ? "acerto" : "erro";
      let obtido;
      if (c.cliques) {
        await p.click(escolha === "mais" ? "#mais" : "#menos");
        await p.waitForFunction(() => !M.revelando, null, { timeout: 8000 });
        obtido = esperado; // o efeito na mesa e conferido abaixo
      } else {
        obtido = await p.evaluate((x) => responder(x), escolha);
        checar("responder() devolve o resultado certo", obtido === esperado, `${escolha} com ${s.e.v} x ${s.d.v}: esperado ${esperado}, veio ${obtido}`);
      }
      const a = await p.evaluate(() => ({ seq: M.seq, fim: M.fim, telaFim: !document.getElementById("tela-fim").hidden, placar: document.getElementById("placar").textContent, domSeq: document.getElementById("seq").textContent }));
      if (esperado === "acerto") {
        acertos++;
        checar("acerto soma 1 e a partida continua", a.seq === s.seq + 1 && !a.fim && !a.telaFim, `seq ${s.seq} -> ${a.seq}, fim ${a.fim}, tela-fim ${a.telaFim}`);
      } else {
        checar("erro encerra a partida", a.fim && a.telaFim && a.seq === s.seq, `fim ${a.fim}, tela-fim ${a.telaFim}, seq ${s.seq} -> ${a.seq}`);
        checar("placar = M.seq", a.placar.trim() === `${a.seq} seguidos` && a.seq === acertos, `placar "${a.placar}", M.seq ${a.seq}, acertos ${acertos}`);
        const t = await p.evaluate(() => textoCompartilhar());
        checar("compartilhar sem undefined", !/undefined|null|NaN|\[object/.test(t) && t.includes(`${acertos} seguidos`) && t.includes("maior-ou-menor.html"), t.slice(0, 200));
        const fimTxt = await p.evaluate(() => document.getElementById("tela-fim").innerText);
        checar("texto sem undefined|null|NaN", !/\bundefined\b|\bnull\b|\bNaN\b/.test(fimTxt), fimTxt.slice(0, 200));
        terminou = true;
        break;
      }
    }
    checar("a partida terminou por erro", terminou, `80 passos sem erro (acertos ${acertos})`);
    checar("sem pageerror/console.error", erros.length === 0, erros.join(" | "));
    checar("o caso rodou ate o fim", true);
  } catch (err) {
    checar("o caso rodou ate o fim", false, `${err.message.split("\n")[0]}${erros.length ? " | pagina: " + erros.join(" | ") : ""}`);
  } finally {
    await p.close();
  }
}

const lista = SO || Array.from({ length: CASOS }, (_, i) => i);
const casos = lista.map(montarCaso);
const b = await chromium.launch();
const mkCtx = async (movimento) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: movimento ? "no-preference" : "reduce" });
  await ctx.route((u) => u.origin !== new URL(BASE).origin, (r) => r.fulfill({ status: 200, contentType: r.request().resourceType() === "stylesheet" ? "text/css" : "application/javascript", body: "" }));
  return ctx;
};
const ctxQuieto = await mkCtx(false), ctxMov = await mkCtx(true);
const inicio = Date.now();
let feitos = 0;
for (const c of casos) {
  caso = c;
  await jogarCaso(c.movimento ? ctxMov : ctxQuieto, c);
  if (++feitos % 100 === 0) console.error(`... ${feitos}/${casos.length} (${Math.round((Date.now() - inicio) / 1000)}s)`);
}
await b.close();

let falhou = false;
const resumo = { casos: lista.length, semente: SEMENTE, segundos: Math.round((Date.now() - inicio) / 1000), invariantes: {} };
for (const [nome, r] of [...INV].sort(([a], [z]) => a.localeCompare(z, "pt-BR"))) {
  resumo.invariantes[nome] = { n: r.n, falhas: r.falhas.length, exemplos: r.falhas.slice(0, 5) };
  if (r.falhas.length) { falhou = true; console.log(`FALHA ${nome} (${r.falhas.length} de ${r.n}): ${r.falhas.slice(0, 5).join("\n      ")}`); }
  else console.log(`OK  ${nome} (${r.n} casos)`);
}
mkdirSync(new URL("./resultados/", import.meta.url), { recursive: true });
writeFileSync(new URL("./resultados/bateria-ux-maior-menor.json", import.meta.url), JSON.stringify(resumo, null, 2) + "\n");
console.log(`${falhou ? "FALHOU" : "LIMPO"}: ${lista.length} casos em ${resumo.segundos}s`);
process.exit(falhou ? 1 : 0);
