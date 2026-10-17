// Bateria de UX do Top 10 em Casa (versao facil, 16/10): partidas independentes, cada uma com a
// sua semente, jogadas digitando na busca e tocando/clicando nas sugestoes de verdade.
//
//   python3 -m http.server 8766 &                       (na raiz do repo)
//   node testes/bateria-ux-top10.mjs                   (padrao: 60 casos + os 52 rankings, ~5 min; o PR roda 20)
//   CASOS=4000 node testes/bateria-ux-top10.mjs        (bateria cheia)
//   CASO=1234 node testes/bateria-ux-top10.mjs         (repete so o caso 1234, mesma semente)
//   SEMENTE=7 muda a semente-base (default 1). DETALHE=1 imprime os passos dos casos que falharem.
//
// Cada caso sorteia: viewport (360x640 a 1440x900), toque ou mouse, movimento reduzido, tema,
// desafio do dia ou partida livre (ou um ranking fixo, pra passar por todos), localStorage
// corrompido ou de outro dia, e a politica do jogador (craque, bagre, aleatorio, so dica, desiste).
// Cada passo e um chute pela busca (nome do top, de fora, repetido, homonimo), uma dica, recarregar
// no meio ou desistir. Invariantes checadas em todo passo: sem erro de JS; sem undefined/null/NaN na
// tela; nada vaza pro lado; vidas = 3 - erros; barras abertas = acertos, na posicao certa; barra
// fechada nunca mostra nome nem valor; toda barra tem a bandeira do jogador; dica (iniciais, clube e frase,
// sem nome de outra resposta) vai pra barra fechada
// mais alta, no maximo 3; botao de dica desliga quando acaba; recarregar o diario mantem tudo; o fim
// revela todas, placar e compartilhar coerentes; diario uma vez por dia.
// Imprime "OK  <invariante> (n checagens)" ou "FALHA <invariante>: caso C semente S passo P: ...".
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:8766";
const CASOS = Number(process.env.CASOS || 60); // ~6 s por caso: o rodar.mjs mata teste com mais de 8 min
const SEMENTE = Number(process.env.SEMENTE || 1);
const SO = process.env.CASO ? process.env.CASO.split(",").map(Number) : null;
const DETALHE = !!process.env.DETALHE;
const PAGINA = `${BASE}/top10-em-casa.html`;
const pasta = path.dirname(fileURLToPath(import.meta.url));
const DADOS = JSON.parse(readFileSync(path.join(pasta, "..", "dados", "top10.json"), "utf8"));

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
const pesado = (r, pesos) => { const t = Object.values(pesos).reduce((a, b) => a + b, 0); let x = r() * t; for (const [k, v] of Object.entries(pesos)) { x -= v; if (x < 0) return k; } return Object.keys(pesos)[0]; };

const TELAS_TOQUE = [[360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [768, 1024]];
const TELAS_MOUSE = [[1024, 768], [1280, 800], [1366, 768], [1440, 900], [900, 700]];
const CORROMPIDOS = ["{", "[]", "5", "null", '{"serie":"x","diario":7}', '{"diario":{"data":"HOJE","id":"nao-existe","acertos":[1],"erros":[],"dicas":[]}}',
  '{"diario":{"data":"HOJE","id":"RID","acertos":"x","erros":[],"dicas":[]}}', '{"diario":{"data":"HOJE","id":"RID","acertos":[],"erros":[1,2,3,4,5],"dicas":[9,9,9,9]}}',
  '{"diario":{"data":"2020-01-01","id":"RID","acertos":[],"erros":[1,2,3],"dicas":[],"fim":true}}', '{"serie":{"atual":-4,"melhor":"x","ultimo":5}}'];
const POLITICAS = { craque: 3, bagre: 2, aleatorio: 4, dica: 2, desiste: 1 };

const contagem = new Map(); // invariante -> checagens
const falhas = []; // { caso, semente, passo, inv, msg, passos }

async function rodarCaso(b, i) {
  const semente = sementeDoCaso(i);
  const r = rngDe(semente);
  const toque = r() < 0.5;
  const [w, h] = escolha(r, toque ? TELAS_TOQUE : TELAS_MOUSE);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque && w < 700, reducedMotion: r() < 0.5 ? "reduce" : "no-preference", colorScheme: r() < 0.5 ? "dark" : "light" });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  const passos = [];
  let passo = 0;
  const checar = (inv, cond, msg = "") => {
    contagem.set(inv, (contagem.get(inv) || 0) + 1);
    if (!cond && !falhas.some((f) => f.caso === i && f.inv === inv)) falhas.push({ caso: i, semente, passo, inv, msg: String(msg).slice(0, 300), passos: [...passos] });
  };
  try {
    // estado inicial: limpo, corrompido ou com o diario de hoje parcial
    const modo = escolha(r, ["livre", "livre", "dia", "dia", "fixo"]);
    // a partida livre sorteia com Math.random na pagina: aqui o ranking sai da semente, pro caso repetir igual
    const fixo = modo === "fixo" ? DADOS.rankings[i % DADOS.rankings.length].id : modo === "livre" ? escolha(r, DADOS.rankings).id : null;
    const lixo = r() < 0.2 ? escolha(r, CORROMPIDOS) : null;
    await p.goto(PAGINA);
    await p.waitForSelector("#form-inicio:not([hidden])", { timeout: 15000 });
    if (lixo) {
      const rid = await p.evaluate(() => rankingDoDia(hojeLocal()).id);
      await p.evaluate(([l, rid]) => { localStorage.setItem("top10:v2", l.replaceAll("HOJE", hojeLocal()).replaceAll("RID", rid)); if (Math.random() < 0.5) localStorage.setItem("top10:vistos2", "{lixo"); }, [lixo, rid]);
      passos.push(`storage: ${lixo}`);
      await p.reload();
      checar("abre com storage corrompido", await p.waitForSelector("#form-inicio:not([hidden])", { timeout: 5000 }).then(() => true, () => false));
    }
    if (fixo) await p.evaluate((id) => { T.rankings = T.rankings.filter((x) => x.id === id); }, fixo);
    passos.push(`${w}x${h} ${toque ? "toque" : "mouse"} modo=${modo}${fixo ? ` ${fixo}` : ""}`);
    const tocar = (alvo) => (toque ? p.locator(alvo).first().tap() : p.locator(alvo).first().click());
    await tocar(modo === "dia" ? "#jogar-dia" : "#jogar-livre");
    await p.waitForSelector("#tela-jogo:not([hidden])");
    const R = await p.evaluate(() => T.ranking);
    const politica = pesado(r, POLITICAS);
    passos.push(`ranking=${R.id} politica=${politica}`);

    // o que a tela tem que mostrar, olhando so o DOM, comparado com o estado do jogo
    const conferir = async () => {
      const s = await p.evaluate(() => {
        const barras = [...document.querySelectorAll("#barras .barra")].map((li) => ({
          cls: li.className, txt: li.textContent, img: li.querySelector("img.bandeira")?.getAttribute("src") || null }));
        return { barras, acertos: [...T.acertos], erros: [...T.erros], dicas: [...T.dicas], vidas: T.vidas, fim: T.fim,
          cheias: document.querySelectorAll("#vidas .vida.cheia").length, dicaOn: !document.getElementById("dica").disabled,
          dicaTxt: document.getElementById("dica").textContent, fimVisivel: !document.getElementById("tela-fim").hidden,
          texto: document.querySelector("main").innerText, larg: document.documentElement.scrollWidth, janela: innerWidth,
          placar: document.getElementById("placar").textContent };
      });
      checar("vidas = 3 - erros (no estado e na tela)", s.vidas === 3 - s.erros.length && s.cheias === Math.max(0, s.vidas), JSON.stringify({ v: s.vidas, e: s.erros.length, c: s.cheias }));
      checar("uma barra por nome do top, cada uma com a bandeira dele", s.barras.length === R.top.length && s.barras.every((x, k) => x.img === `img/bandeiras/${R.top[k].pais}.svg`));
      checar("barra aberta = acerto, na posicao certa", R.top.every((x, k) => s.barras[k].cls.includes("aberta") === s.acertos.includes(x.id)));
      const fechadaVaza = R.top.find((x, k) => !s.fim && !s.acertos.includes(x.id) && (s.barras[k].txt.includes(x.nome) || s.barras[k].txt.includes(x.valor)));
      checar("barra fechada nunca mostra nome nem valor", !fechadaVaza, fechadaVaza?.nome);
      checar("barra com dica = dica pedida, no maximo 3", s.dicas.length <= 3 && R.top.every((x, k) => s.barras[k].cls.includes("com-dica") === (!s.fim && !s.acertos.includes(x.id) && s.dicas.includes(x.id))));
      const fechadas = R.top.filter((x) => !s.acertos.includes(x.id) && !s.dicas.includes(x.id));
      checar("botao de dica liga so com dica e barra sobrando", s.dicaOn === (!s.fim && s.dicas.length < 3 && fechadas.length > 0) && s.dicaTxt.includes(s.dicas.length < 3 ? `(${3 - s.dicas.length})` : "Sem dicas"), `${s.dicaTxt} on=${s.dicaOn}`);
      checar("sem undefined/null/NaN na tela", !/\bundefined\b|\bnull\b|\bNaN\b/.test(s.texto));
      checar("nada vaza pro lado", s.larg <= s.janela + 1, `${s.larg} > ${s.janela}`);
      if (s.fim) {
        checar("fim revela todas e mostra o placar", s.fimVisivel && s.barras.every((x) => /aberta|revelada/.test(x.cls)) && s.placar.trim() === `${s.acertos.length}/${R.top.length}`, s.placar);
      }
      return s;
    };

    let s = await conferir();
    const fora = await p.evaluate(() => { const no = new Set(T.ranking.top.map((x) => x.id)); return T.jogadores.filter((j) => !no.has(j.id)).map((j) => j.id); });
    for (passo = 1; passo <= 25 && !s.fim; passo++) {
      const acao = pesado(r, {
        craque: { certo: 8, fora: 1, dica: 1, repetido: 0.5, recarregar: 0.5 },
        bagre: { certo: 1, fora: 6, dica: 1, repetido: 1, recarregar: 0.5 },
        aleatorio: { certo: 3, fora: 3, dica: 2, repetido: 1, recarregar: 1, desistir: 0.3 },
        dica: { certo: 2, fora: 1, dica: 6, repetido: 0.5, recarregar: 1 },
        desiste: { certo: 1, fora: 1, dica: 1, desistir: 3 },
      }[politica]);
      const antes = s;
      if (acao === "dica") {
        const alvo = R.top.find((x) => !antes.acertos.includes(x.id) && !antes.dicas.includes(x.id));
        passos.push(`${passo}: dica`);
        if (antes.dicaOn) await tocar("#dica");
        s = await conferir();
        if (antes.dicaOn) {
          checar("dica vai pra barra fechada mais alta", s.dicas.length === antes.dicas.length + 1 && s.dicas.at(-1) === alvo.id, `${s.dicas.at(-1)} != ${alvo?.id}`);
          const k = R.top.indexOf(alvo);
          const txt = s.barras[k].txt;
          const ini = alvo.nome.trim().split(/\s+/).filter((w, _, ps) => !(w === w.toLowerCase() && w !== w.toUpperCase()) || ps.every((q) => q === q.toLowerCase()))
            .map((w) => [...w.replace(/^[^\p{L}]+/u, "")][0].toUpperCase() + ".").join(" ");
          checar("barra com dica mostra iniciais, clube e a frase", txt.includes(ini) && (!alvo.clube || txt.includes(alvo.clube)) && (!alvo.frase || txt.includes(alvo.frase)), `${ini} | ${txt}`);
          const outro = R.top.find((y) => y.id !== alvo.id && !s.acertos.includes(y.id) && txt.includes(y.nome));
          checar("dica nao entrega outra resposta do ranking", !outro, outro?.nome);
          checar("dica nao custa vida", s.vidas === antes.vidas);
        }
        continue;
      }
      if (acao === "recarregar") {
        passos.push(`${passo}: recarregar`);
        await p.reload();
        await p.waitForSelector("#form-inicio:not([hidden])");
        if (fixo) await p.evaluate((id) => { T.rankings = T.rankings.filter((x) => x.id === id); }, fixo);
        if (modo === "dia") {
          await tocar("#jogar-dia");
          await p.waitForSelector("#tela-jogo:not([hidden])");
          s = await conferir();
          checar("recarregar o diario mantem acertos, erros e dicas", JSON.stringify([s.acertos, s.erros, s.dicas]) === JSON.stringify([antes.acertos, antes.erros, antes.dicas]), JSON.stringify({ antes: [antes.acertos.length, antes.erros.length, antes.dicas.length], depois: [s.acertos.length, s.erros.length, s.dicas.length] }));
          continue;
        }
        break; // partida livre nao volta: o caso acaba aqui
      }
      if (acao === "desistir") {
        passos.push(`${passo}: desistir`);
        await tocar("#desistir");
        await p.waitForSelector("#tela-fim:not([hidden])");
        s = await conferir();
        checar("desistir acaba sem mexer em vida", s.fim && s.vidas === antes.vidas);
        break;
      }
      // chute pela busca: digita parte do nome e escolhe a sugestao certa (bandeira + extra pros homonimos)
      const faltam = R.top.filter((x) => !antes.acertos.includes(x.id));
      const ja = [...antes.acertos, ...antes.erros];
      let id;
      if (acao === "certo" && faltam.length) id = escolha(r, faltam).id;
      else if (acao === "repetido" && ja.length) id = escolha(r, ja);
      else id = escolha(r, fora.filter((x) => !antes.erros.includes(x)));
      const jog = await p.evaluate((x) => T.jogadores.find((j) => j.id === x), id);
      const termo = r() < 0.6 ? jog.nome : jog.nome.split(" ").at(-1);
      passos.push(`${passo}: ${acao} "${termo}" (${jog.nome})`);
      await p.fill("#busca", "");
      await p.locator("#busca").pressSequentially(termo, { delay: 0 });
      await p.waitForTimeout(30);
      const repetido = ja.includes(id);
      // repetido some da lista: so da pra conferir que nao aparece
      const k = await p.evaluate((x) => sugestoes.findIndex((o) => o.id === x), id);
      if (repetido) {
        checar("quem ja foi chutado some da busca", k < 0);
        continue;
      }
      if (k < 0) {
        // a lista mostra 8: com sobrenome comum o nome inteiro tem que achar
        await p.fill("#busca", jog.nome);
        await p.waitForTimeout(30);
      }
      const k2 = await p.evaluate((x) => sugestoes.findIndex((o) => o.id === x), id);
      checar("o nome inteiro sempre acha o jogador na busca", k2 >= 0, jog.nome);
      if (k2 < 0) continue;
      // bandeira conta: "Nico González" argentino e espanhol sao duas sugestoes diferentes
      const iguais = await p.$$eval("#sugestoes .sugestao", (ls) => ls.map((l) => `${l.querySelector(".bandeira")?.getAttribute("src") || "-"} ${l.textContent}`));
      checar("sugestoes visiveis sao todas distintas (nome + bandeira + extra)", new Set(iguais).size === iguais.length, iguais.join(" | "));
      if (r() < 0.3 && !toque) {
        for (let n = 0; n < k2; n++) await p.keyboard.press("ArrowDown");
        await p.keyboard.press("Enter");
      } else {
        await (toque ? p.locator(`#sug-${k2}`).tap() : p.locator(`#sug-${k2}`).click());
      }
      await p.waitForTimeout(20);
      s = await conferir();
      const noTop = R.top.some((x) => x.id === id);
      checar("chute certo abre a barra; errado custa vida", noTop ? s.acertos.includes(id) && s.vidas === antes.vidas : s.erros.includes(id) && s.vidas === antes.vidas - 1, `${acao} acertos=${s.acertos.length} vidas ${antes.vidas}->${s.vidas}`);
      const aviso = await p.textContent("#aviso");
      checar("aviso coerente com o chute", s.fim || (noTop ? /Boa!|Metade|Falta um/.test(aviso) : /Não tá nesse top 10/.test(aviso)), aviso);
    }
    if (s.fim) {
      const txt = await p.evaluate(() => textoCompartilhar());
      const verdes = [...txt.matchAll(/🟩/gu)].length;
      checar("compartilhar coerente", verdes === s.acertos.length && new RegExp(`^Top 10 em Casa( #\\d+)? · .+\\n[🟩⬛]{${R.top.length}}\\n${s.acertos.length}/${R.top.length} · 💡 ${s.dicas.length} dicas? · ❤️ ${s.vidas} vidas? restantes?\\nhttps://temdadoemcasa\\.github\\.io/top10-em-casa\\.html$`, "u").test(txt), JSON.stringify(txt));
      if (modo === "dia") {
        await p.reload();
        await p.waitForSelector("#form-inicio:not([hidden])");
        checar("diario terminado nao reabre pra jogar", (await p.textContent("#jogar-dia")).includes("Ver de novo") && (await p.textContent("#card-dia")).includes(`${s.acertos.length}/${R.top.length} hoje`));
      }
    }
    checar("sem erro de JS", !erros.length, erros.join(" | "));
  } catch (e) {
    checar("caso roda ate o fim sem travar", false, e.message.split("\n").filter((l) => l.trim()).slice(0, DETALHE ? 12 : 1).join(" / "));
  } finally {
    await ctx.close();
  }
}

// --- cada ranking abre e fecha limpo (passa por todos, nao so pelos sorteados) ---------------------
async function rodarTodosOsRankings(b) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  await p.goto(PAGINA);
  await p.waitForSelector("#form-inicio:not([hidden])");
  const ruins = [];
  for (const rk of DADOS.rankings) {
    const s = await p.evaluate(async (id) => {
      T.rankings = [JSON.parse(JSON.stringify(window.__todos ||= T.rankings)).find((x) => x.id === id)];
      await comecar();
      const vaza = document.documentElement.scrollWidth > innerWidth + 1;
      T.ranking.top.forEach((x) => chutar(x.id));
      const imgs = [...document.querySelectorAll("#barras img.bandeira")];
      return { vaza, fim: T.fim, placar: document.getElementById("placar").textContent, n: T.ranking.top.length, imgs: imgs.length };
    }, rk.id);
    if (s.vaza || !s.fim || s.placar !== `${s.n}/${s.n}` || s.imgs !== s.n) ruins.push(`${rk.id}: ${JSON.stringify(s)}`);
  }
  contagem.set("todo ranking joga ate o fim no celular, sem vazar (52)", DADOS.rankings.length);
  if (ruins.length || erros.length) falhas.push({ caso: "todos", semente: "-", passo: "-", inv: "todo ranking joga ate o fim no celular, sem vazar (52)", msg: [...ruins, ...erros].join(" | ").slice(0, 400), passos: [] });
  // bandeira: todo svg usado carrega de verdade
  const quebradas = await p.evaluate(async (paises) => (await Promise.all(paises.map((c) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0 ? null : c); i.onerror = () => ok(c); i.src = `img/bandeiras/${c}.svg`; })))).filter(Boolean),
    [...new Set(DADOS.jogadores.map((j) => j.pais).filter(Boolean))]);
  contagem.set("toda bandeira da busca carrega", 1);
  if (quebradas.length) falhas.push({ caso: "todos", semente: "-", passo: "-", inv: "toda bandeira da busca carrega", msg: quebradas.join(","), passos: [] });
  await ctx.close();
}

const b = await chromium.launch();
const casos = SO || Array.from({ length: CASOS }, (_, i) => i);
const t0 = Date.now();
if (!SO) await rodarTodosOsRankings(b);
for (const i of casos) await rodarCaso(b, i);
await b.close();

const linhas = [];
for (const [inv, n] of [...contagem].sort()) {
  const f = falhas.find((x) => x.inv === inv);
  linhas.push(f ? `FALHA ${inv}: caso ${f.caso} semente ${f.semente} passo ${f.passo}: ${f.msg}` : `OK   ${inv} (${n} checagens)`);
  if (f && DETALHE) linhas.push(...f.passos.map((x) => `      ${x}`));
}
linhas.push(`${casos.length} casos em ${((Date.now() - t0) / 1000).toFixed(0)}s, semente-base ${SEMENTE}`);
if (falhas.length) linhas.push(`reproduzir um caso: CASO=<n> SEMENTE=${SEMENTE} DETALHE=1 node testes/bateria-ux-top10.mjs`);
console.log(linhas.join("\n"));
mkdirSync(path.join(pasta, "resultados"), { recursive: true });
writeFileSync(path.join(pasta, "resultados", `bateria-ux-top10${SO ? "-caso" + SO.join("-") : ""}.txt`), linhas.join("\n") + "\n");
