// Top 10 em Casa: acerte os 10 de um ranking conhecido (Bola de Ouro, artilharia,
// mais valiosos, contratacoes mais caras), com 3 vidas e ate 3 dicas.
// Os rankings vem prontos de dados/top10.json (scripts/top10/gerar.py, Wikipedia e
// Transfermarkt): cada barra ja mostra a bandeira do jogador; a dica revela o clube
// e a inicial de uma barra fechada. Aqui: carregamento, desafio do dia, partida
// livre, barras, busca, chute, dica, fim, compartilhar e o localStorage.
"use strict";

const CHAVE = "top10:v2"; // { serie: { atual, melhor, ultimo }, diario: { data, id, acertos, erros, dicas, fim } }
const CHAVE_VISTOS = "top10:vistos2";
const INICIO = "2026-10-16"; // desafio #1
const VIDAS = 3;
const DICAS = 3;
const SEM_REPETIR = 30; // a partida livre evita os ultimos 30 vistos

const T = {
  rankings: [],
  jogadores: [], // a busca: [{ id, nome, pais, extra? }]
  ranking: null,
  acertos: new Set(), // id
  erros: [], // id
  dicas: [], // id das barras com dica aberta
  vidas: VIDAS,
  fim: false,
  diario: null, // { data, numero } quando e o desafio do dia
};

const $ = (id) => document.getElementById(id);

// --- sorteio e desafio do dia ------------------------------------------------

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
// o diario ja acabou (guardado com fim, sem vidas ou com todos)
const diarioAcabou = (salvo, ranking) => salvo.fim || salvo.erros.length >= VIDAS || salvo.acertos.length >= ranking.top.length;

function lerVistos() { try { const v = JSON.parse(localStorage.getItem(CHAVE_VISTOS)); return Array.isArray(v) ? v : []; } catch { return []; } }
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
  const no = new Set(ranking.top.map((t) => t.id));
  const conhecido = new Set(T.jogadores.map((j) => j.id));
  return {
    acertos: [...new Set(d.acertos.filter((id) => no.has(id)))],
    erros: [...new Set(d.erros.filter((id) => conhecido.has(id) && !no.has(id)))].slice(0, VIDAS),
    dicas: [...new Set((Array.isArray(d.dicas) ? d.dicas : []).filter((id) => no.has(id)))].slice(0, DICAS),
    fim: d.fim === true,
  };
}
function guardarDiario() {
  if (!T.diario) return;
  gravarArmazem({ diario: { data: T.diario.data, id: T.ranking.id, acertos: [...T.acertos], erros: T.erros, dicas: T.dicas, fim: T.fim } });
}

// --- bandeira ----------------------------------------------------------------

// SVG guardado no proprio site (img/bandeiras, do pacote flag-icons): emoji de bandeira
// nao aparece no Windows. Sem pais no dado: nada (ausencia nao vira bandeira errada)
function bandeira(pais) {
  if (!pais) return el("span", "bandeira bandeira-vazia");
  const img = el("img", "bandeira");
  img.src = `img/bandeiras/${pais}.svg`;
  img.alt = "";
  img.width = 24;
  img.height = 18;
  return img;
}

// --- telas -------------------------------------------------------------------

function mostrarTela(id) {
  for (const t of document.querySelectorAll(".top10 .tela")) t.hidden = t.id !== id;
}

function descricaoDoRanking(r) {
  const caixa = el("div", "ranking-info");
  caixa.append(el("b", "ranking-titulo", r.titulo), el("span", "ranking-sub", r.sub), el("small", "ranking-recorte", `${r.recorte} · ${r.nivel}`));
  return caixa;
}

function atualizarInicio() {
  const r = rankingDoDia(hojeLocal());
  const card = $("card-dia");
  // antes do #1 nao existe numero (nada de "no 1" forcado)
  const numero = numeroDoDia(hojeLocal());
  card.replaceChildren(el("small", "card-dia-rotulo", numero >= 1 ? `Desafio do dia · nº ${numero}` : "Desafio do dia"), descricaoDoRanking(r));
  const salvo = lerDiario(r);
  const jogado = salvo && diarioAcabou(salvo, r);
  if (jogado) card.append(el("b", "card-dia-feito", `${salvo.acertos.length}/${r.top.length} hoje`));
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

// a dica vai pra barra fechada mais alta que ainda nao tem dica
const barraParaDica = () => T.ranking.top.find((t) => !T.acertos.has(t.id) && !T.dicas.includes(t.id));

function desenharDica() {
  const resta = DICAS - T.dicas.length;
  const botao = $("dica");
  botao.textContent = resta ? `💡 Pedir dica (${resta})` : "💡 Sem dicas";
  botao.disabled = !resta || T.fim || !barraParaDica();
}

const inicial = (nome) => [...nome.trim()][0].toUpperCase();

function linhaDaBarra(item) {
  const li = el("li", "barra");
  li.append(el("span", "barra-pos", String(item.pos)));
  const corpo = el("div", "barra-corpo");
  corpo.append(bandeira(item.pais));
  const nomes = el("div", "barra-nomes");
  if (T.acertos.has(item.id) || T.fim) {
    // o que ficou de fora aparece em cinza, sem o verde do acerto
    li.classList.add(T.acertos.has(item.id) ? "aberta" : "revelada");
    nomes.append(el("b", "barra-nome", item.nome), el("small", "barra-clube", item.clube || ""));
    corpo.append(nomes, el("span", "barra-valor", item.valor ?? "sem dado"));
  } else if (T.dicas.includes(item.id)) {
    li.classList.add("com-dica");
    nomes.append(el("b", "barra-nome", `${inicial(item.nome)}…`), el("small", "barra-clube", item.clube || "clube: sem dado"));
    corpo.append(nomes);
  } else {
    nomes.append(el("span", "barra-segredo", "? ? ?"));
    corpo.append(nomes);
  }
  li.append(corpo);
  return li;
}
function desenharBarras() {
  $("barras").replaceChildren(...T.ranking.top.map(linhaDaBarra));
}

async function comecar({ diario = false } = {}) {
  const ranking = diario ? rankingDoDia(hojeLocal()) : rankingLivre();
  T.ranking = ranking;
  T.acertos = new Set();
  T.erros = [];
  T.dicas = [];
  T.vidas = VIDAS;
  T.fim = false;
  T.diario = diario ? { data: hojeLocal(), numero: numeroDoDia(hojeLocal()) } : null;
  guardarVisto(ranking.id); // o diario tambem: a livre nao serve o de hoje logo depois
  $("cabeca-titulo").textContent = ranking.titulo;
  $("cabeca-sub").textContent = ranking.sub;
  $("cabeca-recorte").textContent = `${ranking.recorte} · fonte: ${ranking.fonte}`;
  $("busca").value = "";
  $("aviso").textContent = "";
  $("busca-caixa").hidden = false;
  $("acoes-jogo").hidden = false;
  $("tela-fim").hidden = true;
  $("compartilhar").textContent = "Compartilhar resultado";
  $("festa")?.remove();
  fecharSugestoes();
  const salvo = diario ? lerDiario(ranking) : null;
  if (salvo) {
    T.acertos = new Set(salvo.acertos);
    T.erros = salvo.erros;
    T.dicas = salvo.dicas;
    T.vidas = Math.max(0, VIDAS - T.erros.length);
    T.fim = diarioAcabou(salvo, ranking);
  }
  desenharVidas();
  desenharBarras();
  desenharDica();
  mostrarTela("tela-jogo");
  if (T.fim) mostrarFim({ contarSerie: false });
  else $("busca").focus({ preventScroll: true });
}

const reduzMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const avisar = (texto) => { $("aviso").textContent = texto; };

function pedirDica() {
  if (T.fim || T.dicas.length >= DICAS) return undefined;
  const item = barraParaDica();
  if (!item) return undefined;
  T.dicas.push(item.id);
  const i = T.ranking.top.indexOf(item);
  $("barras").children[i].replaceWith(linhaDaBarra(item));
  avisar(item.clube ? `Dica: o ${item.pos}º começa com ${inicial(item.nome)} e jogava no ${item.clube}.` : `Dica: o ${item.pos}º começa com ${inicial(item.nome)}.`);
  guardarDiario();
  desenharDica();
  $("busca").focus({ preventScroll: true });
  return item.id;
}

// devolve "acerto" | "fora" | "repetido" (ou undefined com a partida acabada)
function chutar(id) {
  if (T.fim) return undefined;
  let resultado;
  if (T.acertos.has(id) || T.erros.includes(id)) {
    avisar("Esse já foi 😉");
    resultado = "repetido";
  } else {
    const i = T.ranking.top.findIndex((t) => t.id === id);
    if (i >= 0) {
      T.acertos.add(id);
      const item = T.ranking.top[i];
      const nova = linhaDaBarra(item);
      if (!reduzMovimento()) nova.classList.add("nova");
      $("barras").children[i].replaceWith(nova);
      const faltam = T.ranking.top.length - T.acertos.size;
      avisar(T.acertos.size === 5 ? "Metade do top, tá voando!" : faltam === 1 ? "Falta um! Respira…" : `Boa! ${item.nome} é o ${item.pos}º.`);
      resultado = "acerto";
    } else {
      T.vidas--;
      T.erros.push(id);
      avisar("Não tá nesse top 10");
      desenharVidas();
      resultado = "fora";
    }
  }
  const acabou = T.acertos.size >= T.ranking.top.length || T.vidas <= 0;
  if (acabou) T.fim = true;
  guardarDiario();
  desenharDica();
  $("busca").value = "";
  fecharSugestoes();
  if (acabou) terminar();
  else $("busca").focus({ preventScroll: true });
  return resultado;
}

const FRASES = [
  [1, "Gabaritou! Dado tem em casa e na sua cabeça."],
  [0.7, "Jogou muito! Quase o top inteiro."],
  [0.4, "Bom jogo! Metade do top é de quem acompanha."],
  [0.1, "Valeu o chute! Amanhã tem outro top pra você."],
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
  const n = T.acertos.size, total = T.ranking.top.length;
  desenharBarras();
  desenharDica();
  $("busca-caixa").hidden = true;
  $("acoes-jogo").hidden = true;
  $("placar").textContent = `${n}/${total}`;
  $("frase").textContent = FRASES.find(([min]) => n / total >= min)[1];
  $("tela-fim").hidden = false;
  if (T.diario && contarSerie) atualizarSerie();
  if (contarSerie && n === total && !reduzMovimento() && !$("festa")) confete();
  $("tela-fim").scrollIntoView({ block: "start", behavior: reduzMovimento() ? "auto" : "smooth" });
}

function textoCompartilhar() {
  const n = T.acertos.size, total = T.ranking.top.length;
  const quadrados = T.ranking.top.map((t) => (T.acertos.has(t.id) ? "🟩" : "⬛")).join("");
  const numero = T.diario && T.diario.numero >= 1 ? ` #${T.diario.numero}` : "";
  const restantes = `${T.vidas} ${T.vidas === 1 ? "vida restante" : "vidas restantes"}`;
  const dicas = `💡 ${T.dicas.length} ${T.dicas.length === 1 ? "dica" : "dicas"}`;
  return `Top 10 em Casa${numero} · ${T.ranking.titulo}\n${quadrados}\n${n}/${total} · ${dicas} · ❤️ ${restantes}\nhttps://temdadoemcasa.github.io/top10-em-casa.html`;
}

// --- busca com autocompletar --------------------------------------------------

let sugestoes = [];
let destaque = -1;

function buscar(termo) {
  if (normalizarBusca(termo).trim().length < 2) return [];
  const ja = new Set([...T.acertos, ...T.erros]);
  const n = normalizarBusca(termo).trim();
  return T.jogadores
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
    li.append(bandeira(o.pais), el("b", null, o.nome));
    if (o.extra) li.append(el("small", "sugestao-extra", o.extra)); // homonimo com a mesma bandeira
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
  T.jogadores = dados.jogadores;
  $("carregando").hidden = true;
  $("form-inicio").hidden = false;
  atualizarInicio();

  const falhou = (erro) => { $("carregando").hidden = false; $("carregando").textContent = "Não deu pra carregar o ranking agora. Tenta de novo."; console.error(erro); };
  $("jogar-dia").addEventListener("click", () => comecar({ diario: true }).catch(falhou));
  $("jogar-livre").addEventListener("click", () => comecar().catch(falhou));
  $("outro").addEventListener("click", () => comecar().catch(falhou));
  $("dica").addEventListener("click", pedirDica);
  $("desistir").addEventListener("click", () => { if (!T.fim) terminar(); });
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
    if (matchMedia("(max-width: 760px)").matches) setTimeout(() => busca.parentElement.scrollIntoView({ block: "start", behavior: reduzMovimento() ? "auto" : "smooth" }), 250);
  });
  // fecha a lista um pouco depois de sair do campo (da tempo do toque na sugestao), mas so se o
  // foco nao voltou: a dica devolve o foco pro campo, e quem digita logo depois perdia a lista
  busca.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== busca) fecharSugestoes(); }, 250));
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
