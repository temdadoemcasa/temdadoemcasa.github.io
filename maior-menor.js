// Maior ou Menor: duas cartas, um numero, quem tem mais? Acerte em sequencia.
// As cartas vem prontas de dados/maior-menor.json (futdata export-maior-menor):
// so numero medido, ausente nunca vira zero. Aqui: carregamento, sorteio dos
// pares (mesmo recorte, stat presente nas duas, valores diferentes, dificuldade
// crescente) e o desafio do dia deterministico, a mesa de jogo, o fim, o
// recorde/diario guardados no aparelho e o texto de compartilhar.
"use strict";

const INICIO = "2026-10-16"; // desafio #1 (publicado em 16/10)

const M = {
  dado: null,
  deck: "brasileirao",
  rng: Math.random,
  esquerda: null,
  direita: null,
  stat: null,
  seq: 0,
  usados: new Set(), // ids de carta ja vistos na partida
  jogadores: new Set(), // player_id ja vistos na partida (Hulk 2024 e Hulk 2025 contam como um)
  fim: false,
  diario: null, // { data, numero } quando e o desafio do dia
  revelando: false,
};

const $ = (id) => document.getElementById(id);

// --- sorteio e desafio do dia (mesmo esquema dos outros jogos) ---------------

function hashTexto(texto) {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(texto)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h;
}
function hojeLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function numeroDoDia(data) {
  const dia = (s) => Date.UTC(...s.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.round((dia(data) - dia(INICIO)) / 86400000) + 1;
}
const prng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// --- pares -------------------------------------------------------------------

// quanto mais longa a sequencia, mais parecidos os dois valores podem ser
function faixaMinima(seq) { return seq < 5 ? 0.4 : seq < 15 ? 0.15 : 0; }
function difRel(a, b) {
  const m = Math.max(a, b);
  return m > 0 ? Math.abs(a - b) / m : 0;
}

// quem pode ser a carta da direita: mesmo recorte, stat presente nas duas,
// valor diferente e jogador ainda nao visto na sequencia (Hulk 2024 x Hulk 2025)
function candidatos(esquerda, stat, usados) {
  const base = esquerda.valores[stat];
  return M.dado.decks[M.deck].cartas.filter((c) =>
    c.recorte === esquerda.recorte &&
    stat in c.valores &&
    c.valores[stat] !== base &&
    c.player_id !== esquerda.player_id &&
    !M.jogadores.has(c.player_id) &&
    !usados.has(c.id));
}

function sortear(lista) { return lista[Math.floor(M.rng() * lista.length)]; }
function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(M.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortearEsquerda() {
  const cartas = M.dado.decks[M.deck].cartas;
  let livres = cartas.filter((c) => !M.usados.has(c.id) && !M.jogadores.has(c.player_id));
  if (!livres.length) { M.usados.clear(); M.jogadores.clear(); livres = cartas; }
  const e = sortear(livres);
  M.esquerda = e;
  M.usados.add(e.id);
  M.jogadores.add(e.player_id);
}

function sortearPar() {
  // a mesa reinicia (nova esquerda, mesma sequencia) quando nao sobra ninguem
  for (let tentativa = 0; tentativa < 2000; tentativa++) {
    const stats = embaralhar(Object.keys(M.esquerda.valores));
    const porStat = stats.map((s) => [s, candidatos(M.esquerda, s, M.usados)]).filter(([, cs]) => cs.length);
    const faixa = faixaMinima(M.seq);
    let escolha = null;
    for (const [s, cs] of porStat) {
      const bons = cs.filter((c) => difRel(c.valores[s], M.esquerda.valores[s]) >= faixa);
      if (bons.length) { escolha = [s, sortear(bons)]; break; }
    }
    if (!escolha && porStat.length) escolha = [porStat[0][0], sortear(porStat[0][1])];
    if (escolha) {
      M.stat = escolha[0];
      M.direita = escolha[1];
      M.usados.add(M.direita.id);
      M.usados.add(M.esquerda.id);
      M.jogadores.add(M.direita.player_id);
      M.jogadores.add(M.esquerda.player_id);
      return;
    }
    sortearEsquerda();
  }
  throw new Error("Maior ou Menor: sem par possivel neste deck");
}

function novaPartida({ deck, diario, data } = {}) {
  M.deck = deck || M.deck;
  M.diario = null;
  let semente;
  if (diario) {
    const dia = data || hojeLocal();
    M.diario = { data: dia, numero: numeroDoDia(dia) };
    semente = hashTexto(`${dia}|${M.deck}`);
  } else {
    semente = crypto.getRandomValues(new Uint32Array(1))[0];
  }
  M.rng = prng(semente);
  M.seq = 0;
  M.fim = false;
  M.revelando = false;
  M.usados = new Set();
  M.jogadores = new Set();
  sortearEsquerda();
  sortearPar();
}

// --- armazem (sempre em try/catch: bloqueado ou corrompido = vazio) ----------

const CHAVE = "maior-menor:v1";
const LINK = "https://temdadoemcasa.github.io/maior-ou-menor.html";
const POSICAO = { G: "Goleiro", D: "Defensor", M: "Meio-campista", F: "Atacante" };

function lerArmazem() {
  const vazio = { recorde: {}, diario: {} };
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE));
    if (!x || typeof x !== "object" || Array.isArray(x)) return vazio;
    return {
      recorde: x.recorde && typeof x.recorde === "object" ? x.recorde : {},
      diario: x.diario && typeof x.diario === "object" ? x.diario : {},
    };
  } catch (e) { return vazio; }
}
function gravarArmazem(armazem) {
  try { localStorage.setItem(CHAVE, JSON.stringify(armazem)); } catch (e) { /* sem armazenamento: joga sem guardar */ }
}
function salvarDiario(fim) {
  if (!M.diario) return;
  const a = lerArmazem();
  a.diario[M.deck] = { data: M.diario.data, seq: M.seq, fim };
  gravarArmazem(a);
}
function recordeDe(deck) {
  const r = lerArmazem().recorde[deck];
  return Number.isInteger(r) ? r : 0;
}
function salvarRecorde() {
  const a = lerArmazem();
  if (!(M.seq > (Number.isInteger(a.recorde[M.deck]) ? a.recorde[M.deck] : 0))) return;
  a.recorde[M.deck] = M.seq;
  gravarArmazem(a);
}

// --- telas -------------------------------------------------------------------

function mostrar(id) {
  for (const t of ["tela-inicio", "tela-jogo", "tela-fim"]) $(t).hidden = t !== id;
  window.scrollTo(0, 0);
}
const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function preencherCarta(sel, c, valor) {
  const el = document.querySelector(sel);
  el.querySelector(".nome").textContent = c.nome;
  el.querySelector(".clube-nome").textContent = c.clube;
  el.querySelector(".bolinha").style.background = c.cor;
  el.querySelector(".posicao").textContent = POSICAO[c.posicao] || "";
  // na pergunta "Jogos" a linha de jogos da carta escondida entregaria a resposta
  const escondida = valor === "?" && M.stat === "jogos";
  el.querySelector(".jogos").textContent = escondida ? "? jogos" : `${c.jogos} jogos`;
  el.querySelector(".recorte").textContent = c.recorte;
  el.querySelector(".valor").textContent = valor;
  el.querySelector(".unidade").textContent = M.dado.stats[M.stat].unidade;
  el.classList.remove("acerto", "erro");
}

function renderJogo() {
  $("pergunta").textContent = `${M.dado.stats[M.stat].pergunta} · ${M.esquerda.recorte}`;
  $("seq").textContent = String(M.seq);
  preencherCarta(".carta.esq", M.esquerda, M.esquerda.valores[M.stat]);
  preencherCarta(".carta.dir", M.direita, "?");
  for (const id of ["mais", "menos"]) {
    $(id).disabled = false;
    $(id).classList.remove("escolhido");
    $(id).removeAttribute("aria-pressed");
  }
}

// conta de 0 ate o valor (900 ms); sem animacao mostra direto
function contar(el, alvo) {
  if (semMovimento()) { el.textContent = String(alvo); return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const passo = (t) => {
      const f = Math.min(1, (t - t0) / 900);
      el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - f, 3))));
      if (f < 1) requestAnimationFrame(passo);
      else { el.textContent = String(alvo); resolve(); }
    };
    requestAnimationFrame(passo);
  });
}

async function responder(escolha) {
  if (M.revelando || M.fim || !M.direita) return "ignorado";
  M.revelando = true;
  $("mais").disabled = true;
  $("menos").disabled = true;
  const e = M.esquerda.valores[M.stat];
  const d = M.direita.valores[M.stat];
  const acertou = escolha === "mais" ? d > e : d < e;
  // grava ANTES de animar: recarregar durante a revelacao nao pode dar segunda chance
  if (acertou) {
    M.seq++;
    salvarRecorde();
    salvarDiario(false);
  } else {
    M.fim = true;
    salvarRecorde();
    salvarDiario(true);
  }
  $(escolha).classList.add("escolhido");
  $(escolha).setAttribute("aria-pressed", "true");
  await contar(document.querySelector(".carta.dir .valor"), d);
  if (acertou) $("seq").textContent = String(M.seq); // so depois da contagem: nao entrega o resultado
  document.querySelector(".carta.dir .jogos").textContent = `${M.direita.jogos} jogos`;
  document.querySelector(".carta.dir").classList.add(acertou ? "acerto" : "erro");
  if (acertou) {
    await espera(semMovimento() ? 0 : 700);
    try {
      M.esquerda = M.direita;
      sortearPar();
      renderJogo();
    } finally { M.revelando = false; }
    return "acerto";
  }
  await espera(semMovimento() ? 0 : 900);
  renderFim(escolha, d);
  M.revelando = false;
  return "erro";
}

function textoCompartilhar() {
  const titulo = M.dado.decks[M.deck].titulo;
  const cabeca = M.diario ? `Maior ou Menor #${M.diario.numero} · ${titulo}` : `Maior ou Menor · ${titulo}`;
  return `${cabeca}\n${M.seq} seguidos 🎲\n${LINK}`;
}

function renderFim(escolha, valorReal) {
  $("placar").textContent = `${M.seq} seguidos`;
  const r = recordeDe(M.deck);
  $("fim-recorde").textContent = r ? `Seu recorde no ${M.dado.decks[M.deck].titulo}: ${r}` : "";
  if (M.direita && escolha) {
    const s = M.dado.stats[M.stat];
    $("fim-detalhe").textContent = `${M.direita.nome} (${M.direita.clube}) tinha ${valorReal} ${s.unidade}; ${M.esquerda.nome}, ${M.esquerda.valores[M.stat]}.`;
  } else {
    $("fim-detalhe").textContent = M.diario ? "Você já jogou o desafio de hoje. Volta amanhã pro próximo." : "";
  }
  $("fim-rotulo").textContent = M.diario ? `Desafio #${M.diario.numero}` : "Partida livre";
  $("compartilhar").textContent = "Compartilhar";
  mostrar("tela-fim");
}

async function compartilhar() {
  const texto = textoCompartilhar();
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return; }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    $("compartilhar").textContent = "Copiado!";
  } catch (e) {
    window.prompt("Copie o texto:", texto);
  }
}

// --- inicio ------------------------------------------------------------------

function mostrarRecorde() {
  const r = recordeDe(M.deck);
  $("recorde").textContent = r ? `Seu recorde no ${M.dado.decks[M.deck].titulo}: ${r}` : "";
}

function escolherDeck(deck) {
  M.deck = deck;
  for (const d of ["brasileirao", "europa"]) $(`deck-${d}`).setAttribute("aria-pressed", String(d === deck));
  mostrarRecorde();
}

function jogarDia() {
  novaPartida({ deck: M.deck, diario: true });
  const salvo = lerArmazem().diario[M.deck];
  if (salvo && salvo.data === M.diario.data && Number.isInteger(salvo.seq) && salvo.seq >= 0) {
    // mesma semente: avanca seq pares como se fossem acertos e cai no par em que parou
    for (let i = 0; i < salvo.seq; i++) { M.esquerda = M.direita; M.seq++; sortearPar(); }
    if (salvo.fim) { M.fim = true; renderFim(null, null); return; }
  }
  renderJogo();
  mostrar("tela-jogo");
}
function jogarLivre() {
  novaPartida({ deck: M.deck, diario: false });
  renderJogo();
  mostrar("tela-jogo");
}

async function iniciarMaiorMenor() {
  const r = await fetch("dados/maior-menor.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`dados/maior-menor.json: ${r.status}`);
  M.dado = await r.json();
  $("carregando").hidden = true;
  $("deck-brasileirao").addEventListener("click", () => escolherDeck("brasileirao"));
  $("deck-europa").addEventListener("click", () => escolherDeck("europa"));
  $("jogar-dia").addEventListener("click", jogarDia);
  $("jogar-livre").addEventListener("click", jogarLivre);
  $("mais").addEventListener("click", () => responder("mais"));
  $("menos").addEventListener("click", () => responder("menos"));
  $("compartilhar").addEventListener("click", compartilhar);
  $("de-novo").addEventListener("click", jogarLivre);
  $("voltar").addEventListener("click", () => { mostrarRecorde(); mostrar("tela-inicio"); });
  mostrarRecorde();
  $("jogar-dia").disabled = false;
  $("jogar-livre").disabled = false;
}

iniciarMaiorMenor().catch((erro) => {
  $("carregando").hidden = false;
  $("carregando").textContent = "Não deu pra carregar as cartas";
  console.error(erro);
});
