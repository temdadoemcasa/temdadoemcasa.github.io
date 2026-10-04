// Top 10 em Casa: acerte os 10 de um ranking do canal, com 3 vidas.
// Os rankings vem prontos de dados/top10.json (futdata export-top10): so numero
// calculado, nada inventado. Aqui: carregamento, desafio do dia, partida livre,
// tela inicial, barras escondidas e a busca por nome. O chute em si e a tela
// final entram na proxima tarefa (chutar, terminar).
"use strict";

const CHAVE = "top10:v1"; // { serie: { atual, melhor }, diario: {...} }
const CHAVE_VISTOS = "top10:vistos";
const INICIO = "2026-10-05"; // desafio #1
const VIDAS = 3;
const SEM_REPETIR = 30; // a partida livre evita os ultimos 30 vistos

const T = {
  rankings: [],
  ranking: null,
  acertos: new Set(), // player_id
  erros: [], // [{ player_id, tipo, pos?, valor? }]
  vidas: VIDAS,
  fim: false,
  diario: null, // { data, numero } quando e o desafio do dia
  opcoes: [], // busca: [{ id, nome, nome_completo, clube }]
};
const opcoesPorBusca = new Map(); // busca -> opcoes (cache em memoria)

const $ = (id) => document.getElementById(id);

// --- sorteio e desafio do dia (mesmo esquema do Quem Ta em Casa) -------------

function hashTexto(texto) {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(texto)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h;
}
// mulberry32: pequeno, rapido e igual em todo navegador
function sementeRng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function hojeLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function numeroDoDia(data) {
  const dia = (s) => Date.UTC(...s.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.round((dia(data) - dia(INICIO)) / 86400000) + 1;
}

// a fila do desafio: os ids embaralhados uma vez, sempre na mesma ordem
function filaDoDesafio() {
  const ids = T.rankings.map((r) => r.id).sort();
  const rng = sementeRng(hashTexto("top10-v1"));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
function rankingDoDia(data) {
  const fila = filaDoDesafio();
  // antes do desafio #1 o modulo continua valendo (indice nunca negativo)
  const i = (((numeroDoDia(data) - 1) % fila.length) + fila.length) % fila.length;
  return T.rankings.find((r) => r.id === fila[i]);
}

function lerVistos() { try { return JSON.parse(localStorage.getItem(CHAVE_VISTOS)) || []; } catch { return []; } }
function guardarVisto(id) {
  try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...lerVistos().filter((v) => v !== id), id].slice(-SEM_REPETIR))); } catch { /* ok */ }
}
function rankingLivre() {
  const vistos = new Set(lerVistos());
  const livres = T.rankings.filter((r) => !vistos.has(r.id));
  const lista = livres.length ? livres : T.rankings;
  return lista[Math.floor(Math.random() * lista.length)];
}

function lerSerie() {
  try { return JSON.parse(localStorage.getItem(CHAVE))?.serie || { atual: 0, melhor: 0 }; } catch { return { atual: 0, melhor: 0 }; }
}

// --- dados -------------------------------------------------------------------

// a lista da busca: todo jogador das cartas do retrato (em campo + os que sairam)
async function opcoesDe(busca) {
  if (opcoesPorBusca.has(busca)) return opcoesPorBusca.get(busca);
  const retrato = await json(`dados/${busca}.json`);
  const porId = new Map();
  for (const time of retrato.times) {
    for (const j of [...time.jogadores, ...(time.sairam || [])]) {
      if (!porId.has(j.player_id)) porId.set(j.player_id, { id: j.player_id, nome: j.nome, nome_completo: j.nome_completo, clube: time.nome });
    }
  }
  const lista = [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  opcoesPorBusca.set(busca, lista);
  return lista;
}

// --- telas -------------------------------------------------------------------

function mostrarTela(id) {
  for (const t of document.querySelectorAll(".top10 .tela")) t.hidden = t.id !== id;
}

function descricaoDoRanking(r) {
  const caixa = el("div", "ranking-info");
  caixa.append(el("b", "ranking-titulo", r.titulo), el("span", "ranking-sub", r.sub), el("small", "ranking-recorte", r.recorte));
  return caixa;
}

function atualizarInicio() {
  const r = rankingDoDia(hojeLocal());
  const card = $("card-dia");
  card.replaceChildren(el("small", "card-dia-rotulo", `Desafio do dia · nº ${Math.max(numeroDoDia(hojeLocal()), 1)}`), descricaoDoRanking(r));
  const serie = lerSerie();
  $("serie").textContent = serie.atual
    ? `Sequência: ${serie.atual} ${serie.atual === 1 ? "dia" : "dias"} seguidos (melhor: ${serie.melhor}).`
    : "Acerte o desafio do dia pra começar uma sequência.";
}

function desenharVidas() {
  [...$("vidas").children].forEach((v, i) => v.classList.toggle("cheia", i < T.vidas));
  $("vidas").setAttribute("aria-label", `${T.vidas} ${T.vidas === 1 ? "vida" : "vidas"}`);
}

function linhaDaBarra(item, pos) {
  const li = el("li", "barra");
  li.append(el("span", "barra-pos", String(pos)));
  const corpo = el("div", "barra-corpo");
  if (item && T.acertos.has(item.player_id)) {
    li.classList.add("aberta");
    corpo.style.borderLeftColor = item.cor || "";
    const nomes = el("div", "barra-nomes");
    nomes.append(el("b", "barra-nome", item.nome), el("small", "barra-clube", item.clube));
    corpo.append(nomes, el("span", "barra-valor", item.valor == null ? "sem dado" : String(item.valor)));
  }
  li.append(corpo);
  return li;
}
function desenharBarras() {
  $("barras").replaceChildren(...T.ranking.top.map((item) => linhaDaBarra(item, item.pos)));
}

async function comecar({ diario = false } = {}) {
  const ranking = diario ? rankingDoDia(hojeLocal()) : rankingLivre();
  T.opcoes = await opcoesDe(ranking.busca);
  T.ranking = ranking;
  T.acertos = new Set();
  T.erros = [];
  T.vidas = VIDAS;
  T.fim = false;
  T.diario = diario ? { data: hojeLocal(), numero: numeroDoDia(hojeLocal()) } : null;
  if (!diario) guardarVisto(ranking.id);
  $("cabeca-titulo").textContent = ranking.titulo;
  $("cabeca-sub").textContent = ranking.sub;
  $("cabeca-recorte").textContent = ranking.recorte;
  $("busca").value = "";
  $("aviso").textContent = "";
  fecharSugestoes();
  desenharVidas();
  desenharBarras();
  mostrarTela("tela-jogo");
  $("busca").focus({ preventScroll: true });
}

// o chute e a regra de vidas entram na proxima tarefa
function chutar(player_id) { // eslint-disable-line no-unused-vars
  throw new Error("chutar: ainda nao implementado");
}

// --- busca com autocompletar (do Quem Ta em Casa) ----------------------------

let sugestoes = [];
let destaque = -1;

function buscar(termo) {
  if (normalizarBusca(termo).trim().length < 2) return [];
  const ja = new Set([...T.acertos, ...T.erros.map((e) => e.player_id)]);
  const n = normalizarBusca(termo).trim();
  return T.opcoes
    .filter((o) => !ja.has(o.id) && casaComBusca(o, termo))
    // quem comeca com o termo vem antes
    .sort((a, b) => Number(!normalizarBusca(a.nome).startsWith(n)) - Number(!normalizarBusca(b.nome).startsWith(n)))
    .slice(0, 8);
}

function mostrarSugestoes() {
  sugestoes = buscar($("busca").value);
  destaque = sugestoes.length ? 0 : -1;
  const ul = $("sugestoes");
  ul.replaceChildren();
  sugestoes.forEach((o, i) => {
    const li = el("li", "sugestao");
    li.id = `sug-${i}`;
    li.setAttribute("role", "option");
    const nome = el("b", null, o.nome);
    if (o.nome_completo && normalizarBusca(o.nome_completo) !== normalizarBusca(o.nome)) nome.append(el("span", "completo", ` · ${o.nome_completo}`));
    li.append(nome, el("small", null, o.clube));
    // escolhe no "click", que so dispara num toque parado: rolar a lista com o dedo em cima
    // de um nome nao chuta mais. O mousedown sem padrao segura o foco no campo (no computador)
    li.addEventListener("mousedown", (e) => e.preventDefault());
    li.addEventListener("click", () => chutar(o.id));
    ul.append(li);
  });
  const vazio = $("busca").value.trim().length >= 2 && !sugestoes.length;
  $("sem-sugestao").hidden = !vazio;
  ul.hidden = !sugestoes.length;
  $("busca").setAttribute("aria-expanded", String(!!sugestoes.length));
  marcarDestaque();
}
function marcarDestaque() {
  [...$("sugestoes").children].forEach((li, i) => li.setAttribute("aria-selected", String(i === destaque)));
  $("busca").setAttribute("aria-activedescendant", destaque >= 0 ? `sug-${destaque}` : "");
}
function fecharSugestoes() {
  sugestoes = [];
  destaque = -1;
  $("sugestoes").hidden = true;
  $("sugestoes").replaceChildren();
  $("sem-sugestao").hidden = true;
  $("busca").setAttribute("aria-expanded", "false");
}

// --- inicio ------------------------------------------------------------------

async function iniciarTop10() {
  const dados = await json("dados/top10.json");
  T.rankings = dados.rankings;
  $("carregando").hidden = true;
  $("form-inicio").hidden = false;
  atualizarInicio();

  const falhou = (erro) => { $("carregando").hidden = false; $("carregando").textContent = "Não deu pra carregar o ranking agora. Tenta de novo."; console.error(erro); };
  $("jogar-dia").addEventListener("click", () => comecar({ diario: true }).catch(falhou));
  $("jogar-livre").addEventListener("click", () => comecar().catch(falhou));
  $("outro").addEventListener("click", () => comecar().catch(falhou));
  $("voltar").addEventListener("click", () => { atualizarInicio(); mostrarTela("tela-inicio"); });

  const busca = $("busca");
  busca.addEventListener("input", mostrarSugestoes);
  // no celular o teclado cobre metade da tela: sobe o campo pra lista caber embaixo
  busca.addEventListener("click", () => {
    if (matchMedia("(max-width: 760px)").matches) setTimeout(() => busca.parentElement.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 250);
  });
  busca.addEventListener("blur", () => setTimeout(fecharSugestoes, 250));
  busca.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && sugestoes.length) { e.preventDefault(); destaque = (destaque + 1) % sugestoes.length; marcarDestaque(); }
    else if (e.key === "ArrowUp" && sugestoes.length) { e.preventDefault(); destaque = (destaque - 1 + sugestoes.length) % sugestoes.length; marcarDestaque(); }
    else if (e.key === "Enter") { e.preventDefault(); if (destaque >= 0) chutar(sugestoes[destaque].id); }
    else if (e.key === "Escape") fecharSugestoes();
  });
}

iniciarTop10().catch((erro) => {
  $("carregando").textContent = "Não deu pra carregar os rankings agora. Tenta recarregar a página.";
  console.error(erro);
});
