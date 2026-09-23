// Site do Tem dado em casa. Sem framework e sem build: tres JSON em dados/.
// Todo texto vindo dos dados entra por textContent, nunca por innerHTML.
"use strict";

const POSICAO = { G: "Goleiro", D: "Defesa", M: "Meio", F: "Ataque" };
const SIGLA = { G: "GOL", D: "DEF", M: "MEI", F: "ATA" };
const cacheDeRetratos = new Map();

function el(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined && texto !== null) no.textContent = texto;
  return no;
}

async function json(caminho) {
  const resposta = await fetch(caminho, { cache: "no-cache" });
  if (!resposta.ok) throw new Error(`${caminho}: HTTP ${resposta.status}`);
  return resposta.json();
}

function dataCurta(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// --- videos ---------------------------------------------------------------

function mostrarVideos(videos) {
  const lista = document.getElementById("lista-videos");
  lista.replaceChildren();
  if (!videos.length) {
    // canal sem video e estado valido: dizer, nao sumir com a secao
    const vazio = el("div", "vazio");
    vazio.append(el("strong", null, "Primeiro vídeo em breve."));
    vazio.append(el("span", null, "Inscreva-se no canal para ver quando sair."));
    lista.append(vazio);
    return;
  }
  for (const video of videos) {
    const cartao = el("a", "video");
    cartao.href = video.url;
    cartao.target = "_blank";
    cartao.rel = "noopener";
    const img = el("img");
    img.src = video.thumb;
    img.alt = "";
    img.loading = "lazy";
    const texto = el("div", "video-texto");
    texto.append(el("div", "video-titulo", video.titulo));
    if (video.publicado) texto.append(el("div", "video-data", dataCurta(video.publicado)));
    cartao.append(img, texto);
    lista.append(cartao);
  }
}

// --- overalls -------------------------------------------------------------

async function retrato(ano) {
  if (!cacheDeRetratos.has(ano)) cacheDeRetratos.set(ano, json(`dados/overalls-${ano}.json`));
  return cacheDeRetratos.get(ano);
}

function notaDoRetrato(r) {
  const parcial = r.jogos_com_placar < r.jogos_esperados;
  const jogos = parcial
    ? `${r.jogos_com_placar} de ${r.jogos_esperados} jogos na base (temporada em andamento)`
    : `${r.jogos_esperados} jogos, temporada completa`;
  return `${r.populacao} ${r.temporada} · ${jogos} · retrato de ${dataCurta(r.gerado_em)} · piso de ${r.piso_minutos} minutos`;
}

const SVG = "http://www.w3.org/2000/svg";
const HEX = /^#[0-9a-f]{6}$/i;

function svg(tag, atributos = {}, filhos = []) {
  const no = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(atributos)) no.setAttribute(k, v);
  for (const filho of filhos) no.append(filho);
  return no;
}

// cor que veio do dado so entra se for "#rrggbb": cor ausente vira a
// neutra, NUNCA preto (preto e a cor real de quatro times)
function corOu(cor, reserva) {
  return typeof cor === "string" && HEX.test(cor) ? cor : reserva;
}

// A camisa (e, no card, o boneco generico por cima dela). viewBox fixo
// 0 0 100 120; o numero e texto, nao imagem, entao escala sem perder.
function figura(uniforme, camisa, { cabeca = true } = {}) {
  const primaria = corOu(uniforme && uniforme.primaria, "#30363d");
  const numero = corOu(uniforme && uniforme.numero, "#e6edf3");
  const raiz = svg("svg", { viewBox: cabeca ? "0 0 100 120" : "0 30 100 90", "aria-hidden": "true" });
  if (cabeca) {
    raiz.append(
      svg("rect", { x: 42, y: 30, width: 16, height: 14, rx: 4, fill: "#8b949e" }),
      svg("circle", { cx: 50, cy: 22, r: 16, fill: "#8b949e" }),
    );
  }
  raiz.append(svg("path", {
    d: "M30 42 L43 36 Q50 43 57 36 L70 42 L90 58 L80 72 L72 66 V116 H28 V66 L20 72 L10 58 Z",
    fill: primaria, stroke: "rgba(255,255,255,0.35)", "stroke-width": 1.5, "stroke-linejoin": "round",
  }));
  if (camisa !== null && camisa !== undefined) {
    const texto = svg("text", {
      x: 50, y: 96, "text-anchor": "middle", "font-size": String(camisa).length > 2 ? 22 : 30,
      "font-weight": 800, fill: numero, "font-family": "Inter, sans-serif",
    });
    texto.textContent = String(camisa);
    raiz.append(texto);
  }
  return raiz;
}

function cardDoJogador(jogador, time, rotulos) {
  const card = el("article", "card");
  card.style.setProperty("--cor-time", time.cor);
  card.style.setProperty("--cor-uniforme", corOu(time.uniforme && time.uniforme.primaria, "#30363d"));

  const topo = el("div", "card-topo");
  const nota = el("div", "card-nota");
  nota.append(el("strong", null, String(jogador.overall)), el("span", null, SIGLA[jogador.posicao] || ""));
  topo.append(nota);
  const boneco = el("div", "card-figura");
  boneco.append(figura(time.uniforme, jogador.camisa));
  topo.append(boneco);
  card.append(topo);

  card.append(el("h4", "card-nome", jogador.nome));
  card.append(el("div", "card-info",
    `${POSICAO[jogador.posicao] || ""} · ${jogador.jogos} jogos · ${jogador.minutos} min`));

  const eixos = el("dl", "card-eixos");
  for (const [chave, valor] of Object.entries(jogador.eixos)) {
    const item = el("div");
    item.title = rotulos[chave] || chave;
    item.append(el("dt", null, chave), el("dd", null, String(valor)));
    eixos.append(item);
  }
  card.append(eixos);
  return card;
}

function linhaSemNota(jogador) {
  const li = el("li", "sem-nota");
  li.append(el("span", "sem-nota-nome", jogador.nome));
  li.append(el("span", "sem-nota-info",
    [POSICAO[jogador.posicao] || jogador.posicao, `${jogador.jogos} jogos`, `${jogador.minutos} min`]
      .filter(Boolean).join(" · ")));
  return li;
}

function sobrenome(nome) {
  const partes = nome.split(" ").filter((p) => p.length > 2 || !p.endsWith("."));
  return partes.length ? partes[partes.length - 1] : nome;
}

// Campo vertical, ataque para cima. x e y vem do futdata (0-1), a mesma
// geometria do campinho do app.
function campinho(time) {
  const base = time.escalacao_base;
  const quadro = el("figure", "campinho");
  if (!base) {
    quadro.append(el("figcaption", null, "Sem formação registrada nesta temporada."));
    return quadro;
  }
  const porId = new Map(time.jogadores.map((j) => [j.player_id, j]));
  const L = 100, A = 140, M = 6;
  const campo = svg("svg", { viewBox: `0 0 ${L} ${A}`, role: "img",
    "aria-label": `Escalação base do ${time.nome} no ${base.formacao}` });
  const linha = { fill: "none", stroke: "rgba(255,255,255,0.28)", "stroke-width": 0.5 };
  campo.append(
    svg("rect", { x: 0, y: 0, width: L, height: A, fill: "#143d2b", rx: 3 }),
    svg("rect", { x: M, y: M, width: L - 2 * M, height: A - 2 * M, ...linha }),
    svg("line", { x1: M, y1: A / 2, x2: L - M, y2: A / 2, ...linha }),
    svg("circle", { cx: L / 2, cy: A / 2, r: 10, ...linha }),
    svg("rect", { x: 28, y: M, width: 44, height: 16, ...linha }),
    svg("rect", { x: 28, y: A - M - 16, width: 44, height: 16, ...linha }),
  );
  for (const pos of base.posicoes) {
    const cx = M + pos.x * (L - 2 * M);
    const cy = A - M - 8 - pos.y * (A - 2 * M - 16);
    const jogador = pos.player_id ? porId.get(pos.player_id) : null;
    const g = svg("g", { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})` });
    if (!jogador) {
      // posicao que ninguem ocupou de forma recorrente: tracejado, nao um nome inventado
      g.append(svg("circle", { r: 5, fill: "none", stroke: "rgba(255,255,255,0.5)", "stroke-dasharray": "1.5 1.5", "stroke-width": 0.6 }));
    } else {
      const camisa = figura(time.uniforme, jogador.camisa, { cabeca: false });
      camisa.setAttribute("x", -6); camisa.setAttribute("y", -7);
      camisa.setAttribute("width", 12); camisa.setAttribute("height", 11);
      g.append(camisa);
      // no campo vai o sobrenome: "G. de Arrascaeta" -> "Arrascaeta". Dois
      // nomes inteiros lado a lado numa linha de tres se atropelavam
      const nome = svg("text", { y: 8.5, "text-anchor": "middle", "font-size": 3.1, fill: "#e6edf3", "font-weight": 600 });
      nome.textContent = sobrenome(jogador.nome);
      const nota = svg("text", { y: 12.5, "text-anchor": "middle", "font-size": 3.2, fill: time.cor, "font-weight": 800 });
      nota.textContent = jogador.overall === null ? "sem nota" : String(jogador.overall);
      g.append(nome, nota);
    }
    campo.append(g);
  }
  quadro.append(campo);
  quadro.append(el("figcaption", null,
    `${base.formacao}, a formação de ${base.jogos} jogos. Em cada posição, quem mais jogou nela.`));
  return quadro;
}

function mostrarElenco(r, teamId, busca) {
  const alvo = document.getElementById("elenco");
  alvo.replaceChildren();
  const termo = busca.trim().toLocaleLowerCase("pt-BR");

  // com busca, procura na liga inteira; sem busca, so o time escolhido
  const times = termo ? r.times : r.times.filter((t) => t.team_id === teamId);
  let achados = 0;
  for (const time of times) {
    const jogadores = termo
      ? time.jogadores.filter((j) => j.nome.toLocaleLowerCase("pt-BR").includes(termo))
      : time.jogadores;
    if (!jogadores.length) continue;
    achados += jogadores.length;

    const bloco = el("div", "time");
    bloco.style.setProperty("--cor-time", time.cor);
    const titulo = el("h3", "elenco-titulo");
    titulo.append(el("span", "faixa"), el("span", null, time.nome));
    bloco.append(titulo);

    const corpo = el("div", termo ? "time-corpo so-cards" : "time-corpo");
    if (!termo) corpo.append(campinho(time));
    const grade = el("div", "cards");
    const comNota = jogadores.filter((j) => j.overall !== null);
    for (const jogador of comNota) grade.append(cardDoJogador(jogador, time, r.eixos));
    corpo.append(grade);
    bloco.append(corpo);

    const semNota = jogadores.filter((j) => j.overall === null);
    if (semNota.length) {
      // quem nao tem nota continua na pagina, so recolhido: ausencia e
      // informacao, mas nao pode empurrar os cards para baixo
      const recolhido = el("details", "sem-nota-grupo");
      if (termo) recolhido.open = true;
      recolhido.append(el("summary", null,
        `${semNota.length} sem nota — abaixo do piso de ${r.piso_minutos} minutos`));
      const lista = el("ul", "sem-nota-lista");
      for (const jogador of semNota) lista.append(linhaSemNota(jogador));
      recolhido.append(lista);
      bloco.append(recolhido);
    }
    alvo.append(bloco);
  }
  if (!achados) alvo.append(el("div", "vazio", termo ? "Nenhum jogador com esse nome nesta temporada." : "Sem jogadores."));
}

function mostrarNumeros(r) {
  const alvo = document.getElementById("numeros");
  alvo.replaceChildren();
  const jogadores = r.times.flatMap((t) => t.jogadores);
  const pares = [
    ["times", r.times.length],
    ["jogadores com carta", jogadores.filter((j) => j.overall !== null).length],
    ["jogos na base", r.jogos_com_placar],
  ];
  for (const [rotulo, valor] of pares) {
    const item = el("div");
    item.append(el("dd", null, valor.toLocaleString("pt-BR")), el("dt", null, `${rotulo} em ${r.temporada}`));
    alvo.append(item);
  }
}

async function iniciarOveralls() {
  const selTemporada = document.getElementById("temporada");
  const selTime = document.getElementById("time");
  const busca = document.getElementById("busca");
  const nota = document.getElementById("nota-retrato");

  const anos = await json("dados/temporadas.json");
  for (const ano of anos) selTemporada.append(new Option(String(ano), String(ano)));

  async function trocarTemporada() {
    const r = await retrato(selTemporada.value);
    const anterior = Number(selTime.value);
    selTime.replaceChildren(...r.times.map((t) => new Option(t.nome, String(t.team_id))));
    if (r.times.some((t) => t.team_id === anterior)) selTime.value = String(anterior);
    nota.textContent = notaDoRetrato(r);
    mostrarElenco(r, Number(selTime.value), busca.value);
    return r;
  }

  const primeiro = await trocarTemporada();
  mostrarNumeros(primeiro);
  selTemporada.addEventListener("change", trocarTemporada);
  selTime.addEventListener("change", async () => {
    mostrarElenco(await retrato(selTemporada.value), Number(selTime.value), busca.value);
  });
  busca.addEventListener("input", async () => {
    mostrarElenco(await retrato(selTemporada.value), Number(selTime.value), busca.value);
  });
}

function falha(idAlvo, mensagem) {
  const alvo = document.getElementById(idAlvo);
  alvo.replaceChildren(el("div", "vazio", mensagem));
}

json("dados/videos.json")
  .then(mostrarVideos)
  .catch(() => falha("lista-videos", "Não foi possível carregar os vídeos agora."));

iniciarOveralls().catch(() => falha("elenco", "Não foi possível carregar os overalls agora."));
