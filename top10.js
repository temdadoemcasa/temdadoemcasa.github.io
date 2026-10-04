// Top 10 em Casa: acerte os 10 de um ranking do canal, com 3 vidas.
// Os rankings vem prontos de dados/top10.json (futdata export-top10): so numero
// calculado, nada inventado. Aqui: carregamento, desafio do dia, partida livre,
// tela inicial, barras escondidas, a busca por nome, o chute com 3 vidas, o fim,
// o compartilhar e a persistencia (desafio do dia + sequencia) no localStorage.
"use strict";

const CHAVE = "top10:v1"; // { serie: { atual, melhor, ultimo }, diario: { data, id, acertos, erros, fim } }
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
function hojeLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function numeroDoDia(data) {
  const dia = (s) => Date.UTC(...s.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.round((dia(data) - dia(INICIO)) / 86400000) + 1;
}

// rendezvous: o desafio do dia D e o id de menor hashTexto("D|id") (empate: o
// menor id). Entrar ou sair um ranking so muda os dias que ele venceria
function rankingDoDia(data) {
  let melhor = null, menor = Infinity;
  for (const r of T.rankings) {
    const h = hashTexto(`${data}|${r.id}`);
    if (h < menor || (h === menor && r.id < melhor.id)) { melhor = r; menor = h; }
  }
  return melhor;
}
// o diario ja acabou (guardado com fim, sem vidas ou com os 10)
const diarioAcabou = (salvo) => salvo.fim || salvo.erros.length >= VIDAS || salvo.acertos.length >= 10;

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

// o armazenamento pode estar vazio, corrompido ou de uma versao velha: nunca quebra a pagina
function lerArmazem() {
  try {
    const dado = JSON.parse(localStorage.getItem(CHAVE));
    return dado && typeof dado === "object" && !Array.isArray(dado) ? dado : {};
  } catch { return {}; }
}
function gravarArmazem(parcial) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ ...lerArmazem(), ...parcial })); } catch { /* ok */ }
}
function lerSerie() {
  const s = lerArmazem().serie;
  const n = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
  return s && typeof s === "object" ? { atual: n(s.atual), melhor: n(s.melhor), ultimo: typeof s.ultimo === "string" ? s.ultimo : "" } : { atual: 0, melhor: 0, ultimo: "" };
}
function ontemDe(data) {
  const [a, m, d] = data.split("-").map(Number);
  return hojeLocal(new Date(a, m - 1, d - 1));
}
// o diario guardado so vale se for de hoje, do mesmo ranking e com a forma certa
function lerDiario(ranking) {
  const d = lerArmazem().diario;
  if (!d || d.data !== hojeLocal() || d.id !== ranking.id || !Array.isArray(d.acertos) || !Array.isArray(d.erros)) return null;
  const no = new Set(ranking.top.map((t) => t.player_id));
  const acertos = [...new Set(d.acertos.filter((id) => no.has(id)))];
  const erros = [...new Set(d.erros.filter((id) => Number.isFinite(id) && !no.has(id)))];
  return { acertos, erros, fim: d.fim === true };
}
function guardarDiario() {
  if (!T.diario) return;
  gravarArmazem({ diario: { data: T.diario.data, id: T.ranking.id, acertos: [...T.acertos], erros: T.erros.map((e) => e.player_id), fim: T.fim } });
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
  // antes do #1 nao existe numero (nada de "nº 1" forcado)
  const numero = numeroDoDia(hojeLocal());
  card.replaceChildren(el("small", "card-dia-rotulo", numero >= 1 ? `Desafio do dia · nº ${numero}` : "Desafio do dia"), descricaoDoRanking(r));
  const salvo = lerDiario(r);
  const jogado = salvo && diarioAcabou(salvo);
  if (jogado) card.append(el("b", "card-dia-feito", `${salvo.acertos.length}/10 hoje`));
  $("jogar-dia").textContent = jogado ? "Ver de novo" : "Jogar o desafio do dia";
  const serie = lerSerie();
  const viva = serie.ultimo === hojeLocal() || serie.ultimo === ontemDe(hojeLocal());
  if (!viva) serie.atual = 0;
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
  else if (item && T.fim) {
    // o que ficou de fora: aparece em cinza, sem o verde do acerto
    li.classList.add("revelada");
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
  guardarVisto(ranking.id); // o diario tambem: a livre nao serve o de hoje logo depois
  $("cabeca-titulo").textContent = ranking.titulo;
  $("cabeca-sub").textContent = ranking.sub;
  $("cabeca-recorte").textContent = ranking.recorte;
  $("busca").value = "";
  $("aviso").textContent = "";
  $("busca-caixa").hidden = false;
  $("compartilhar").textContent = "Compartilhar resultado";
  $("festa")?.remove();
  fecharSugestoes();
  const salvo = diario ? lerDiario(ranking) : null;
  if (salvo) {
    T.acertos = new Set(salvo.acertos);
    T.erros = salvo.erros.map((id) => ({ player_id: id, tipo: ranking.quase.some((q) => q.player_id === id) ? "quase" : "fora" }));
    T.vidas = Math.max(0, VIDAS - T.erros.length);
    T.fim = diarioAcabou(salvo);
  }
  desenharVidas();
  desenharBarras();
  mostrarTela("tela-jogo");
  if (T.fim) mostrarFim({ contarSerie: false });
  else $("busca").focus({ preventScroll: true });
}

const reduzMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const avisar = (texto) => { $("aviso").textContent = texto; };

// devolve "acerto" | "quase" | "fora" | "repetido" (ou undefined com a partida acabada)
function chutar(player_id) {
  if (T.fim) return undefined;
  let resultado;
  if (T.acertos.has(player_id) || T.erros.some((e) => e.player_id === player_id)) {
    avisar("Esse já foi 😉");
    resultado = "repetido";
  } else {
    const i = T.ranking.top.findIndex((t) => t.player_id === player_id);
    const quase = T.ranking.quase.find((q) => q.player_id === player_id);
    if (i >= 0) {
      T.acertos.add(player_id);
      const item = T.ranking.top[i];
      const nova = linhaDaBarra(item, item.pos);
      if (!reduzMovimento()) nova.classList.add("nova");
      $("barras").children[i].replaceWith(nova);
      avisar(T.acertos.size === 5 ? "Metade do top, tá voando!" : T.acertos.size === 9 ? "Falta um! Respira…" : `Boa! ${item.nome} é o ${item.pos}º.`);
      resultado = "acerto";
    } else {
      T.vidas--;
      if (quase) {
        T.erros.push({ player_id, tipo: "quase", pos: quase.pos, valor: quase.valor });
        avisar(`Quase! Ficou em ${quase.pos}º${quase.valor == null ? "" : ` (${quase.valor} ${T.ranking.unidade})`}`);
        resultado = "quase";
      } else {
        T.erros.push({ player_id, tipo: "fora" });
        avisar("Fora do top 20 nesse recorte");
        resultado = "fora";
      }
      desenharVidas();
    }
  }
  const acabou = T.acertos.size >= 10 || T.vidas <= 0;
  if (acabou) T.fim = true;
  guardarDiario();
  $("busca").value = "";
  fecharSugestoes();
  if (acabou) terminar();
  else $("busca").focus({ preventScroll: true });
  return resultado;
}

const FRASES = [
  [10, "Gabaritou! Dado tem em casa e na sua cabeça."],
  [7, "Jogou muito! Quase o top inteiro."],
  [4, "Bom jogo! Metade do top é de quem acompanha."],
  [1, "Valeu o chute! Amanhã tem outro top pra você."],
  [0, "Esse top era casca grossa. Bora no próximo?"],
];

function terminar() {
  T.fim = true;
  guardarDiario();
  mostrarFim({ contarSerie: true });
}

function atualizarSerie() {
  const s = lerSerie();
  const hoje = T.diario.data; // o dia em que a partida comecou, mesmo se virou a meia-noite
  if (s.ultimo === hoje) return; // o diario so conta uma vez por dia
  if (T.acertos.size >= 1) {
    const atual = s.ultimo === ontemDe(hoje) ? s.atual + 1 : 1;
    gravarArmazem({ serie: { atual, melhor: Math.max(s.melhor, atual), ultimo: hoje } });
  } else {
    gravarArmazem({ serie: { atual: 0, melhor: s.melhor, ultimo: s.ultimo } }); // zerou: sem acerto nao tem sequencia
  }
}

function confete() {
  const festa = el("div", "festa");
  festa.id = "festa";
  festa.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) {
    const c = el("i");
    c.style.setProperty("--x", `${(i - 5.5) * 24}px`);
    c.style.setProperty("--d", `${(i % 4) * 0.05}s`);
    festa.append(c);
  }
  $("tela-fim").prepend(festa);
}

// o fim fica na mesma tela, embaixo das barras
function mostrarFim({ contarSerie }) {
  const n = T.acertos.size;
  desenharBarras();
  $("busca-caixa").hidden = true;
  $("placar").textContent = `${n}/10`;
  $("frase").textContent = FRASES.find(([min]) => n >= min)[1];
  $("tela-fim").hidden = false;
  if (T.diario && contarSerie) atualizarSerie();
  if (contarSerie && n === 10 && !reduzMovimento() && !$("festa")) confete();
  $("tela-fim").scrollIntoView({ block: "start", behavior: reduzMovimento() ? "auto" : "smooth" });
}

function textoCompartilhar() {
  const n = T.acertos.size;
  const quadrados = T.ranking.top.map((t) => (T.acertos.has(t.player_id) ? "🟩" : "⬛")).join("");
  const numero = T.diario && T.diario.numero >= 1 ? ` #${T.diario.numero}` : "";
  const restantes = `${T.vidas} ${T.vidas === 1 ? "vida restante" : "vidas restantes"}`;
  return `Top 10 em Casa${numero} · ${T.ranking.titulo} (${T.ranking.recorte})\n${quadrados}\n${n}/10 · ❤️ ${restantes}\nhttps://temdadoemcasa.github.io/top10-em-casa.html`;
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
  $("compartilhar").addEventListener("click", async () => {
    const texto = textoCompartilhar();
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      $("compartilhar").textContent = "Copiado!";
    } catch { /* cancelou */ }
  });
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
