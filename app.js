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
    vazio.append(el("strong", null, "O primeiro vídeo tá no forno."));
    vazio.append(el("span", null, "Se inscreve no canal que a gente avisa quando sair."));
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

// --- cor: luminancia e mistura, para o card escolher texto claro ou escuro

function canal(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
function misturar(hex, alvo, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(alvo.slice(1), 16);
  const c = [16, 8, 0].map((d) => Math.round(((a >> d) & 255) * (1 - t) + ((b >> d) & 255) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// texto do card: o que tiver MAIS contraste com o meio do degrade
function textoSobre(hex) {
  const l = luminancia(hex);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "#ffffff" : "#10131a";
}

// Os 6 atributos do card, na convencao que todo jogador de FIFA conhece.
// Os 7 eixos da carta viram 6: Precisao e Criacao se juntam em PAS (media
// dos que existirem). Eixo ausente (ex.: velocidade sem tracking) sai como
// travessao, NUNCA como zero. Goleiro mantem os 5 eixos proprios.
const ATRIBUTOS_DE_LINHA = [
  ["RIT", "Ritmo (velocidade)", ["VEL"]],
  ["FIN", "Finalização", ["CHU"]],
  ["PAS", "Passe (precisão e criação)", ["PAS", "CRI"]],
  ["DRI", "Drible", ["DRI"]],
  ["DEF", "Defesa", ["DEF"]],
  ["FÍS", "Físico (duelo)", ["FOR"]],
];

function atributosDoCard(jogador, rotulos) {
  if (jogador.posicao === "G") {
    return Object.entries(jogador.eixos).map(([chave, valor]) => [chave, rotulos[chave] || chave, valor]);
  }
  return ATRIBUTOS_DE_LINHA.map(([sigla, titulo, chaves]) => {
    const valores = chaves.map((c) => jogador.eixos[c]).filter((v) => typeof v === "number");
    const valor = valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
    return [sigla, titulo, valor];
  });
}

// O card: escudo com as cores do time, nota e posicao no canto, o boneco
// vestindo a camisa do jogador, nome e os eixos numa linha.
function cardDoJogador(jogador, time, rotulos) {
  const card = el("article", "card");
  const base = corOu(time.uniforme && time.uniforme.primaria, "#30363d");
  const meio = misturar(base, "#000000", 0.18);
  card.style.setProperty("--card-claro", misturar(base, "#ffffff", 0.28));
  card.style.setProperty("--card-meio", meio);
  card.style.setProperty("--card-escuro", misturar(base, "#000000", 0.55));
  card.style.setProperty("--card-texto", textoSobre(meio));

  const topo = el("div", "card-topo");
  const nota = el("div", "card-nota");
  nota.append(el("strong", null, String(jogador.overall)), el("span", null, SIGLA[jogador.posicao] || ""));
  topo.append(nota);
  const boneco = el("div", "card-figura");
  boneco.append(figura(time.uniforme, jogador.camisa));
  topo.append(boneco);
  card.append(topo);

  card.append(el("h4", "card-nome", jogador.nome));

  const eixos = el("dl", "card-eixos");
  for (const [sigla, titulo, valor] of atributosDoCard(jogador, rotulos)) {
    const item = el("div");
    item.title = titulo;
    item.append(el("dt", null, sigla), el("dd", null, valor === null ? "—" : String(valor)));
    eixos.append(item);
  }
  card.append(eixos);
  // o time ja esta no titulo do bloco: repetir aqui quebrava a linha na ponta do escudo
  card.append(el("div", "card-info", `${jogador.jogos} jogos · ${jogador.minutos} min`));
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
// Campo vertical, ataque para cima, com listras. x e y vem do futdata
// (0-1); a altura e esticada pela linha mais avancada da formacao, para
// os onze ocuparem o campo inteiro em vez de se espremerem embaixo.
function campinho(time) {
  const base = time.escalacao_base;
  const quadro = el("figure", "campinho");
  if (!base) {
    quadro.append(el("figcaption", null, "Sem formação registrada nesta temporada."));
    return quadro;
  }
  const porId = new Map(time.jogadores.map((j) => [j.player_id, j]));
  const L = 100, A = 150, M = 5;
  const campo = svg("svg", { viewBox: `0 0 ${L} ${A}`, role: "img",
    "aria-label": `Escalação base do ${time.nome} no ${base.formacao}` });
  for (let i = 0; i < 10; i++) {
    campo.append(svg("rect", { x: 0, y: (i * A) / 10, width: L, height: A / 10 + 0.2,
      fill: i % 2 ? "#1b6e35" : "#1f7a3b" }));
  }
  const linha = { fill: "none", stroke: "rgba(255,255,255,0.55)", "stroke-width": 0.5 };
  campo.append(
    svg("rect", { x: M, y: M, width: L - 2 * M, height: A - 2 * M, ...linha }),
    svg("line", { x1: M, y1: A / 2, x2: L - M, y2: A / 2, ...linha }),
    svg("circle", { cx: L / 2, cy: A / 2, r: 11, ...linha }),
    svg("circle", { cx: L / 2, cy: A / 2, r: 0.8, fill: "rgba(255,255,255,0.55)" }),
    svg("rect", { x: 24, y: M, width: 52, height: 18, ...linha }),
    svg("rect", { x: 37, y: M, width: 26, height: 7, ...linha }),
    svg("rect", { x: 24, y: A - M - 18, width: 52, height: 18, ...linha }),
    svg("rect", { x: 37, y: A - M - 7, width: 26, height: 7, ...linha }),
    svg("path", { d: `M 40 ${M + 18} A 10 10 0 0 0 60 ${M + 18}`, ...linha }),
    svg("path", { d: `M 40 ${A - M - 18} A 10 10 0 0 1 60 ${A - M - 18}`, ...linha }),
  );
  const yMax = Math.max(...base.posicoes.map((p) => p.y), 0.01);
  const topo = 20, fundo = 132;
  const corNota = corOu(time.cor, "#e6edf3");
  const textoNota = textoSobre(corNota);
  for (const pos of base.posicoes) {
    const cx = 13 + pos.x * 74;
    const cy = fundo - (pos.y / yMax) * (fundo - topo);
    const jogador = pos.player_id ? porId.get(pos.player_id) : null;
    const g = svg("g", { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})` });
    if (!jogador) {
      // posicao que ninguem ocupou de forma recorrente: tracejado, nao um nome inventado
      g.append(svg("circle", { r: 5.5, fill: "rgba(13,17,23,0.35)", stroke: "rgba(255,255,255,0.7)",
        "stroke-dasharray": "1.5 1.5", "stroke-width": 0.6 }));
      const t = svg("text", { y: 1.2, "text-anchor": "middle", "font-size": 3.6, fill: "#ffffff", "font-weight": 700 });
      t.textContent = "?";
      g.append(t);
    } else {
      g.append(svg("circle", { r: 6.2, fill: "rgba(13,17,23,0.78)" }));
      const camisa = figura(time.uniforme, jogador.camisa, { cabeca: false });
      camisa.setAttribute("x", -5); camisa.setAttribute("y", -5.6);
      camisa.setAttribute("width", 10); camisa.setAttribute("height", 9.4);
      g.append(camisa);
      // a nota num hexagono na cor do time, embaixo do jogador
      g.append(svg("path", { d: "M-5 8.2 L-3 6.4 L3 6.4 L5 8.2 L3 10 L-3 10 Z",
        fill: jogador.overall === null ? "#30363d" : corNota }));
      const nota = svg("text", { y: 9.35, "text-anchor": "middle", "font-size": 2.9, "font-weight": 800,
        fill: jogador.overall === null ? "#e6edf3" : textoNota });
      nota.textContent = jogador.overall === null ? "s/n" : String(jogador.overall);
      // no campo vai o sobrenome: "G. de Arrascaeta" -> "Arrascaeta"
      const nome = svg("text", { y: 13.6, "text-anchor": "middle", "font-size": 2.9, fill: "#ffffff",
        "font-weight": 700, stroke: "rgba(0,0,0,0.55)", "stroke-width": 0.5, "paint-order": "stroke" });
      nome.textContent = sobrenome(jogador.nome);
      g.append(nota, nome);
    }
    campo.append(g);
  }
  quadro.append(campo);
  quadro.append(el("figcaption", null,
    `${base.formacao}, o esquema de ${base.jogos} jogos. Em cada posição, quem mais bateu ponto ali.`));
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
        `${semNota.length} sem nota: menos de ${r.piso_minutos} minutos em campo. Sem minuto, sem carta.`));
      const lista = el("ul", "sem-nota-lista");
      for (const jogador of semNota) lista.append(linhaSemNota(jogador));
      recolhido.append(lista);
      bloco.append(recolhido);
    }
    alvo.append(bloco);
  }
  if (!achados) alvo.append(el("div", "vazio", termo ? "Ninguém com esse nome nesta temporada. Confere a grafia?" : "Sem jogadores."));
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
  .catch(() => falha("lista-videos", "Os vídeos não carregaram agora. Tenta de novo daqui a pouco."));

iniciarOveralls().catch(() => falha("elenco", "As cartas não carregaram agora. Tenta de novo daqui a pouco."));
