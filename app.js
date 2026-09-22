// Site do Tem dado em casa. Sem framework e sem build: tres JSON em dados/.
// Todo texto vindo dos dados entra por textContent, nunca por innerHTML.
"use strict";

const POSICAO = { G: "Goleiro", D: "Defesa", M: "Meio", F: "Ataque" };
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

function linhaDoJogador(jogador, rotulos) {
  const semNota = jogador.overall === null;
  const li = el("li", semNota ? "jogador sem-nota" : "jogador");
  li.append(el("div", "overall", semNota ? "sem nota" : String(jogador.overall)));

  const quem = el("div");
  quem.append(el("div", "jogador-nome", jogador.nome));
  const info = [POSICAO[jogador.posicao] || jogador.posicao, `${jogador.jogos} jogos`, `${jogador.minutos} min`];
  quem.append(el("div", "jogador-info", info.filter(Boolean).join(" · ")));
  li.append(quem);

  const eixos = el("div", "eixos");
  for (const [chave, valor] of Object.entries(jogador.eixos)) {
    const pilula = el("span", "eixo", `${rotulos[chave] || chave} `);
    pilula.append(el("b", null, String(valor)));
    eixos.append(pilula);
  }
  li.append(eixos);
  return li;
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
    const lista = el("ol", "jogadores");
    const comNota = jogadores.filter((j) => j.overall !== null);
    const semNota = jogadores.filter((j) => j.overall === null);
    for (const jogador of comNota) lista.append(linhaDoJogador(jogador, r.eixos));
    bloco.append(titulo, lista);
    if (semNota.length) {
      // quem nao tem nota continua na pagina, so recolhido: ausencia e
      // informacao, mas nao pode empurrar o elenco com nota para baixo
      const recolhido = el("details", "sem-nota-grupo");
      if (termo) recolhido.open = true;
      recolhido.append(el("summary", null,
        `${semNota.length} sem nota — abaixo do piso de ${r.piso_minutos} minutos`));
      const listaSem = el("ol", "jogadores");
      for (const jogador of semNota) listaSem.append(linhaDoJogador(jogador, r.eixos));
      recolhido.append(listaSem);
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
