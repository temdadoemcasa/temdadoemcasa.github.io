// Quem Tá em Casa?: adivinhe o jogador pela carta. 6 chutes; cada erro libera
// uma dica, da mais vaga pra mais entregue, e mostra como o chute se compara
// com o jogador certo. Usa as cartas do site (app.js): so numero calculado,
// nada inventado. Cartas do Brasileirao, da Premier League e da Champions,
// na mesma regua. Vale acertar o jogador, em qualquer temporada ou liga.
"use strict";

const CHUTES = 6;
// minutos pra entrar no sorteio: menos que isso sorteia reserva que ninguem lembra.
// A Champions tem no maximo 17 jogos (1.560 min o que mais jogou em 25/26): la o piso e menor.
const PISO_SORTEIO = 1500;
const PISO_SORTEIO_POR_TORNEIO = { 7: 900 };
// o desafio do dia so sorteia temporada fechada: o retrato de uma temporada em
// andamento muda toda semana, e o jogador do dia mudaria junto. Chave = nome
// do arquivo (dados/overalls-<chave>.json).
// Liga nova entra no desafio a partir de uma DATA (nunca no meio do dia: o
// jogador de hoje nao pode mudar pra quem ainda nao jogou). Cada fase tem a
// propria semente.
// overall minimo da carta sorteada (desafio a partir de 05/10 e partida livre): 83+ e jogador conhecido.
// No Brasileirao o piso e 78 desde 04/10: a regua da liga tira 5 do topo (86 -> 81), entao o 83 de antes
// la e 78 hoje (o mesmo corte do pacote de craque, app.js PISO_DO_CRAQUE_BRASIL).
const OVERALL_MINIMO = 83;
const OVERALL_MINIMO_BRASIL = 78;
const minimoDaCarta = (c, minimo = OVERALL_MINIMO) => (LIGAS.brasil(c.r) ? minimo - (OVERALL_MINIMO - OVERALL_MINIMO_BRASIL) : minimo);
const FASES_DO_DESAFIO = [
  { desde: "2026-09-30", retratos: ["2024", "2025", "premier-league-2025", "champions-2025"] },
  { desde: "2026-10-01", retratos: ["2024", "2025", "premier-league-2025", "laliga-2025", "champions-2025"] },
  // uma carta por jogador: o mesmo jogador (2024 e 2025) caia duas vezes no mes
  // uma carta por jogador; Europa so de clube grande ou craque (84+); 3 de 5 dias do Brasileirao
  { desde: "2026-10-02", retratos: ["2024", "2025", "premier-league-2025", "laliga-2025", "champions-2025"], umPorJogador: true, conhecidos: true },
  // so carta 83+ (jogador conhecido): com 79 caia meia que ninguem lembra
  { desde: "2026-10-05", retratos: ["2024", "2025", "premier-league-2025", "laliga-2025", "champions-2025"], umPorJogador: true, conhecidos: true, minimo: OVERALL_MINIMO },
];
// clubes da Europa que o torcedor brasileiro acompanha (fora deles, so carta 84+ entra no desafio)
const GRANDES_DA_EUROPA = new Set([
  "Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Tottenham", "Newcastle", "Aston Villa",
  "Real Madrid", "Barcelona", "Atlético Madrid", "Athletic Club", "Real Betis", "Sevilla", "Villarreal", "Real Sociedad",
  "PSG", "Bayern", "Dortmund", "Leverkusen", "Inter", "Juventus", "Napoli", "Atalanta", "Benfica", "Sporting",
  "Ajax", "PSV", "Marseille", "Galatasaray", "AS Monaco",
]);
const PADRAO_DO_DESAFIO = ["brasil", "europa", "brasil", "europa", "brasil"]; // 60% Brasileirao
const faseDoDia = (data) => FASES_DO_DESAFIO.filter((f) => f.desde <= data).pop() || FASES_DO_DESAFIO[0];
// os retratos do desafio de hoje (o teste confere que so tem temporada fechada)
const RETRATOS_DO_DESAFIO = faseDoDia(hojeLocal()).retratos;
// as ligas da partida livre: chave -> o que entra
const LIGAS = {
  tudo: () => true,
  brasil: (r) => !r.torneio || r.torneio === 325,
  europa: (r) => r.torneio && r.torneio !== 325,
};
const CHAVE_LIGA = "quem-ta-liga";
const INICIO_DIARIO = "2026-09-30"; // desafio #1
const CHAVE_DIARIO = "quem-ta-diario";
const CHAVE_SERIE = "quem-ta-serie";

// Dicas: "liga, ano e posicao" ja vem aberta; cada erro SORTEIA uma das outras 6 (no
// desafio do dia o sorteio e o mesmo pra todo mundo). 5 erros abrem 5 das 6.
const TIPOS_DE_DICA = {
  liga: { icone: "🏟️", titulo: "Liga e posição", curto: "Liga" },
  selecao: { icone: "🌎", titulo: "Seleção", curto: "Seleção" },
  ranking: { icone: "🏆", titulo: "Ranking na posição", curto: "Ranking" },
  atributos: { icone: "📊", titulo: "Os 2 maiores atributos", curto: "Top 2 atributos" },
  overall: { icone: "⭐", titulo: "Overall", curto: "Overall" },
  camisa: { icone: "🔢", titulo: "Número e jogos", curto: "Nº e jogos" },
  cores: { icone: "🎨", titulo: "Cores do clube", curto: "Cores" },
};
const SORTEAVEIS = ["selecao", "ranking", "atributos", "overall", "camisa", "cores"];

const J = {
  retratos: [], // [r] (r.chave = arquivo, r.curto = "Premier 25/26")
  cartasDe: new Map(), // player_id -> [{ ano, chave, r, j, time }] (mais nova primeiro)
  liga: "tudo",
  opcoes: [], // uma por jogador, pra busca
  alvo: null, // { ano, chave, r, j, time }
  chutes: [], // [{ id, carta, clube, pos, overall }]
  fim: null, // "acertou" | "errou" | "desistiu"
  diario: null, // { data, numero }
  ordem: [], // ["liga", ...as 6 sorteadas]: a dica n abre no erro n
};

const $ = (id) => document.getElementById(id);

// --- selecao: dados/paises.json (futdata export-paises, do bruto de escalacoes) ---
// o SofaScore usa codigos proprios pras nacoes do Reino Unido
const PAISES_DO_REINO_UNIDO = {
  EN: ["Inglaterra", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}"],
  SX: ["Escócia", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"],
  WA: ["País de Gales", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}"],
  NX: ["Irlanda do Norte", ""],
};
let nomesDePais = null;
function nomeDoPais(codigo) {
  if (PAISES_DO_REINO_UNIDO[codigo]) return PAISES_DO_REINO_UNIDO[codigo][0];
  try {
    nomesDePais = nomesDePais || new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return nomesDePais.of(codigo) || codigo;
  } catch { return codigo; }
}
function bandeira(codigo) {
  if (PAISES_DO_REINO_UNIDO[codigo]) return PAISES_DO_REINO_UNIDO[codigo][1];
  if (!/^[A-Z]{2}$/.test(codigo)) return "";
  return String.fromCodePoint(...[...codigo].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
// ausencia nunca e zero: sem pais no bruto, a dica diz "sem dado"
const paisDe = (id) => (J.paises && J.paises[String(id)]) || null;
function textoDaSelecao(id) {
  const c = paisDe(id);
  return c ? `${bandeira(c)} ${nomeDoPais(c)}`.trim() : "sem dado";
}

// --- sorteio e desafio do dia ------------------------------------------------

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
function numeroDoDesafio(data) {
  const dia = (s) => Date.UTC(...s.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.round((dia(data) - dia(INICIO_DIARIO)) / 86400000) + 1;
}

const pisoDoSorteio = (r) => PISO_SORTEIO_POR_TORNEIO[r.torneio] ?? PISO_SORTEIO;
const sorteavel = (j, r) => j.overall !== null && typeof j.minutos === "number" && j.minutos >= pisoDoSorteio(r);

// filtro: lista de chaves de retrato, ou funcao (r) => bool, ou null (todos)
function candidatos(filtro) {
  const entra = Array.isArray(filtro) ? (r) => filtro.includes(r.chave) : filtro || (() => true);
  const lista = [];
  for (const r of J.retratos) {
    if (!entra(r)) continue;
    for (const time of r.times) {
      for (const j of time.jogadores) if (sorteavel(j, r)) lista.push({ ano: r.temporada, chave: r.chave, j, time, r });
    }
  }
  // ordem estavel, independente da ordem do JSON e da ordem de carga
  return lista.sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0) || a.j.player_id - b.j.player_id);
}

// Uma volta inteira sem repetir: embaralha o pool uma vez (semente fixa) e o
// desafio N pega a posicao N. So repete depois de passar por todos.
function alvoDoDia(data) {
  const fase = faseDoDia(data);
  let pool = candidatos(fase.retratos);
  if (fase.umPorJogador) {
    // fica a carta com mais minutos de cada jogador (a temporada em que ele mais apareceu)
    const melhor = new Map();
    for (const c of pool) { const m = melhor.get(c.j.player_id); if (!m || c.j.minutos > m.j.minutos) melhor.set(c.j.player_id, c); }
    pool = pool.filter((c) => melhor.get(c.j.player_id) === c);
  }
  const rng = sementeRng(hashTexto(`quem-ta-v2-${fase.desde}`));
  const embaralhar = (lista) => {
    for (let i = lista.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [lista[i], lista[k]] = [lista[k], lista[i]];
    }
    return lista;
  };
  const n = numeroDoDesafio(data);
  if (fase.conhecidos) {
    // conta a partir do 1o dia da fase: a fase nova comeca do inicio das duas filas
    const dia = n - numeroDoDesafio(fase.desde);
    const conhecido = fase.minimo
      ? (c) => c.j.overall >= minimoDaCarta(c, fase.minimo)
      : (c) => LIGAS.brasil(c.r) || GRANDES_DA_EUROPA.has(c.time.nome) || c.j.overall >= 84;
    const filas = {
      brasil: embaralhar(pool.filter((c) => LIGAS.brasil(c.r) && conhecido(c))),
      europa: embaralhar(pool.filter((c) => LIGAS.europa(c.r) && conhecido(c))),
    };
    const qual = PADRAO_DO_DESAFIO[((dia % PADRAO_DO_DESAFIO.length) + PADRAO_DO_DESAFIO.length) % PADRAO_DO_DESAFIO.length];
    // quantos dias dessa fila ja passaram antes de hoje
    const volta = Math.floor(dia / PADRAO_DO_DESAFIO.length);
    const antes = PADRAO_DO_DESAFIO.slice(0, ((dia % 5) + 5) % 5).filter((q) => q === qual).length;
    const naFila = volta * PADRAO_DO_DESAFIO.filter((q) => q === qual).length + antes;
    const fila = filas[qual];
    return fila[((naFila % fila.length) + fila.length) % fila.length];
  }
  embaralhar(pool);
  return pool[(((n - 1) % pool.length) + pool.length) % pool.length];
}

function alvoLivre() {
  const todos = candidatos(LIGAS[J.liga] || LIGAS.tudo);
  const fortes = todos.filter((c) => c.j.overall >= minimoDaCarta(c));
  const pool = fortes.length ? fortes : todos;
  const recentes = new Set(lerVistos());
  const frescos = pool.filter((c) => !recentes.has(`${c.chave}-${c.j.player_id}`));
  const escolha = (frescos.length ? frescos : pool)[Math.floor(Math.random() * (frescos.length || pool.length))];
  guardarVisto(`${escolha.chave}-${escolha.j.player_id}`);
  return escolha;
}

function lerVistos() { try { return JSON.parse(localStorage.getItem("quem-ta-vistos")) || []; } catch { return []; } }
function guardarVisto(chave) {
  try { localStorage.setItem("quem-ta-vistos", JSON.stringify([...lerVistos(), chave].slice(-120))); } catch { /* ok */ }
}
function lerDiario() { try { return JSON.parse(localStorage.getItem(CHAVE_DIARIO)) || null; } catch { return null; } }
const diarioDeHoje = () => { const d = lerDiario(); return d && d.data === hojeLocal() ? d : null; };
function lerSerie() { try { return JSON.parse(localStorage.getItem(CHAVE_SERIE)) || { atual: 0, melhor: 0 }; } catch { return { atual: 0, melhor: 0 }; } }

// --- indice de jogadores -----------------------------------------------------

function indexarJogadores() {
  const porId = new Map();
  for (const r of J.retratos) {
    for (const time of r.times) {
      for (const j of [...time.jogadores, ...(time.sairam || [])]) {
        if (!porId.has(j.player_id)) porId.set(j.player_id, []);
        porId.get(j.player_id).push({ ano: r.temporada, chave: r.chave, r, j, time });
      }
    }
  }
  for (const [id, cartas] of porId) {
    // mais nova primeiro; no mesmo ano, o Brasileirao antes da Europa
    cartas.sort((a, b) => b.ano - a.ano || Number(LIGAS.europa(a.r)) - Number(LIGAS.europa(b.r)));
    J.cartasDe.set(id, cartas);
    const clubes = [...new Set(cartas.map((c) => c.time.nome))];
    const base = cartas[0].j;
    J.opcoes.push({
      id, nome: base.nome, nome_completo: base.nome_completo,
      detalhe: `${POSICAO[base.posicao] || ""} · ${clubes.slice(0, 3).join(", ")}`,
    });
  }
  J.opcoes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// a carta do chute que conversa com o alvo: a do mesmo retrato (liga e ano) se
// existir, senao a do mesmo ano, senao a mais nova
function cartaDoChute(id) {
  const cartas = J.cartasDe.get(id) || [];
  return cartas.find((c) => c.chave === J.alvo.chave) || cartas.find((c) => c.ano === J.alvo.ano) || cartas[0];
}

// --- a carta misteriosa ------------------------------------------------------

const dicasAbertas = () => (J.fim ? J.ordem.length : Math.min(CHUTES, J.chutes.length + 1));
const aberta = (tipo) => { const i = J.ordem.indexOf(tipo); return i >= 0 && i < dicasAbertas(); };

// a ordem das dicas: no desafio, semente do dia (todo mundo ve a mesma sequencia)
function sortearOrdem(rng = Math.random) {
  const s = [...SORTEAVEIS];
  for (let i = s.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [s[i], s[k]] = [s[k], s[i]]; }
  return ["liga", ...s];
}
const ordemDoDia = (data) => sortearOrdem(sementeRng(hashTexto(`quem-ta-dicas-${data}`)));

function atributosOrdenados(j) {
  return eixosDaCarta(j, J.alvo.r.eixos)
    .map(([sigla, titulo, valor], i) => ({ sigla, titulo, valor, i }))
    .filter((a) => a.valor !== null)
    .sort((a, b) => b.valor - a.valor || a.i - b.i);
}

// novas: tipos de dica que abriram AGORA -> o que entra animado na carta
function cartaMisteriosa(novas = new Set()) {
  const { j, time, ano } = J.alvo;
  const temOverall = aberta("overall");
  const t = nivel(j.overall);
  const carta = el("article", `carta carta-misterio ${temOverall ? `nivel-${t.id}` : "nivel-misterio"}${novas.has("overall") ? " trocou-nivel" : ""}`);
  carta.setAttribute("aria-label", "Carta misteriosa");

  const telhado = svg("svg", { class: "carta-telhado", viewBox: "0 0 100 30", "aria-hidden": "true" });
  telhado.append(svg("path", { d: "M4 26.5 L50 3.5 L96 26.5", class: "carta-telhado-traco" }));
  const rotulo = svg("text", { x: 50, y: 21.5, "text-anchor": "middle", class: "carta-telhado-nivel" });
  rotulo.textContent = temOverall ? `Casa de ${t.nome}` : "Quem tá em casa?";
  telhado.append(rotulo);
  carta.append(telhado);

  const corpo = el("div", "carta-corpo");
  const topo = el("div", "carta-topo");
  const nota = el("div", "carta-nota");
  nota.append(el("strong", temOverall ? (novas.has("overall") ? "nova conta" : "") : "oculto", temOverall ? String(j.overall) : "?"), el("span", "carta-pos", SIGLA[j.posicao] || ""));
  if (aberta("selecao") && paisDe(j.player_id)) {
    const b = el("span", `carta-bandeira${novas.has("selecao") ? " nova" : ""}`, bandeira(paisDe(j.player_id)) || paisDe(j.player_id));
    b.title = nomeDoPais(paisDe(j.player_id));
    nota.append(b);
  }
  const boneco = el("div", `carta-figura${novas.has("camisa") || novas.has("cores") ? " nova" : ""}`);
  const numero = aberta("camisa") ? j.camisa : "?";
  if (aberta("cores")) boneco.append(figura(time, numero, { cabeca: false }));
  else boneco.append(figura({ kit: { padrao: "lisa", base: "#2b313a", numero: "#8b949e" } }, numero, { cabeca: false }));
  topo.append(nota, boneco);

  const nome = el("h4", "carta-nome oculto", J.fim ? j.nome : "? ? ?");
  if (J.fim && j.nome.length > 12) nome.classList.add("nome-longo");
  if (J.fim) nome.classList.remove("oculto");

  const top2 = new Set(atributosOrdenados(j).slice(0, 2).map((a) => a.sigla));
  const eixos = el("dl", "carta-eixos");
  const lista = eixosDaCarta(j, J.alvo.r.eixos);
  eixos.style.setProperty("--n", lista.length);
  for (const [sigla, titulo, valor] of lista) {
    // a dica de atributos abre os 2 maiores (o cartao mostra os mesmos); o resto, so no fim
    const aberto = J.fim ? true : aberta("atributos") && top2.has(sigla);
    const abriuAgora = aberto && valor !== null && novas.has("atributos");
    const celula = el("div", valor === null ? "sem-dado" : aberto ? (abriuAgora ? "nova conta" : "") : "oculto");
    celula.title = !aberto ? `${titulo}: ainda escondido` : valor === null ? `${titulo}: sem dado` : `${titulo}: ${valor}`;
    if (aberto && valor !== null) {
      celula.style.setProperty("--cor", calor(valor));
      celula.style.setProperty("--v", valor);
    }
    celula.append(el("dt", null, sigla), el("dd", null, !aberto ? "?" : valor === null ? "—" : String(valor)));
    eixos.append(celula);
  }

  const info = el("div", "carta-info");
  info.append(
    el("span", null, J.alvo.r.curto),
    el("span", null, aberta("camisa") ? `${j.jogos} J` : "? J"),
  );
  corpo.append(topo, nome, eixos, info);
  carta.append(corpo);
  return carta;
}

// ranking do alvo entre os da mesma posicao no mesmo retrato (liga e ano), pelo overall
function rankingNaPosicao() {
  const { j, r } = J.alvo;
  const notas = r.times.flatMap((tm) => tm.jogadores).filter((x) => x.posicao === j.posicao && typeof x.overall === "number").map((x) => x.overall);
  return { pos: notas.filter((v) => v > j.overall).length + 1, total: notas.length };
}

// texto longo (aviso) e curto (cartao) de cada tipo de dica
function textoDaDica(tipo, curto = false) {
  const { j, time } = J.alvo;
  const ordem = atributosOrdenados(j);
  switch (tipo) {
    case "liga": return curto ? `${J.alvo.r.curto} · ${POSICAO[j.posicao]}` : `${J.alvo.r.rotulo} · ${POSICAO[j.posicao]}`;
    case "selecao": return curto ? textoDaSelecao(j.player_id) : `Seleção: ${textoDaSelecao(j.player_id)}`;
    case "ranking": {
      const { pos, total } = rankingNaPosicao();
      const quem = { G: "goleiro", D: "defensor", M: "meio-campista", F: "atacante" }[j.posicao] || "jogador";
      return curto ? `${pos}º ${quem} (de ${total})` : `${pos === 1 ? "O melhor" : `${pos}º melhor`} ${quem} pelo overall em ${J.alvo.r.rotulo}, entre ${total}`;
    }
    case "atributos": {
      const top = ordem.slice(0, 2);
      return curto ? (top.map((a) => `${a.sigla} ${a.valor}`).join(" · ") || "sem dado")
        : `Os 2 maiores atributos: ${top.map((a) => `${a.titulo} ${a.valor}`).join(" e ") || "sem dado"}`;
    }
    case "overall": return curto ? `${j.overall} · ${nivel(j.overall).nome}` : `Overall ${j.overall} (${nivel(j.overall).nome})`;
    case "camisa": return curto ? `Nº ${j.camisa ?? "—"} · ${j.jogos} J` : `Camisa ${j.camisa ?? "—"} · ${j.jogos} jogos na temporada`;
    case "cores": return curto ? nomeDoKit(time) : `Camisa do clube: ${nomeDoKit(time)}`;
    default: return "";
  }
}
// compatibilidade: o texto longo da dica n (na ordem sorteada desta partida)
const textosDasDicas = () => J.ordem.map((tipo) => textoDaDica(tipo));

function amostrasDoKit(time) {
  const kit = kitDoTime(time);
  const cores = kit.faixas && kit.faixas.length ? kit.faixas.map((f) => f[0]) : [kit.base];
  const caixa = el("span", "kit-cores");
  for (const c of [...new Set(cores)]) { const s = el("i"); s.style.background = c; caixa.append(s); }
  return caixa;
}

// 6 cartoes: o 1o fixo (liga e posicao) e 5 de "dica surpresa", que viram no erro
function listaDeDicas(novas = new Set()) {
  const abertas = dicasAbertas();
  const ol = $("dicas");
  ol.replaceChildren();
  for (let i = 0; i < CHUTES; i++) {
    const tipo = J.ordem[i];
    const ok = i < abertas;
    const li = el("li", `${ok ? "aberta" : "fechada"}${novas.has(tipo) ? " revelando" : ""}`);
    li.dataset.tipo = ok ? tipo : "";
    if (ok) {
      li.title = textoDaDica(tipo);
      li.append(el("span", "dica-icone", TIPOS_DE_DICA[tipo].icone), el("span", "dica-titulo", TIPOS_DE_DICA[tipo].curto));
      const valor = el("span", "dica-valor", textoDaDica(tipo, true));
      if (tipo === "cores") valor.prepend(amostrasDoKit(J.alvo.time));
      li.append(valor);
      if (novas.has(tipo)) rolarDado(li);
    } else {
      li.title = `Dica surpresa: sai no ${i}º erro`;
      li.append(el("span", "dica-icone", "🎲"), el("span", "dica-valor", `${i}º erro`));
    }
    ol.append(li);
  }
}

// o cartao "rola o dado": passa por varios icones antes de parar no sorteado
function rolarDado(li) {
  if (movimentoReduzido) return;
  const icone = li.querySelector(".dica-icone"), titulo = li.querySelector(".dica-titulo");
  const final = [icone.textContent, titulo.textContent];
  const tipos = Object.values(TIPOS_DE_DICA);
  li.classList.add("rolando");
  let n = 0;
  const giro = setInterval(() => {
    const t = tipos[n++ % tipos.length];
    icone.textContent = t.icone;
    titulo.textContent = t.curto;
    if (n >= 9) {
      clearInterval(giro);
      [icone.textContent, titulo.textContent] = final;
      li.classList.remove("rolando");
      li.classList.add("parou");
    }
  }, 70);
}

// a dica da camisa fala as cores, nunca o clube
function nomeDoKit(time) {
  const kit = kitDoTime(time);
  const cores = kit.faixas && kit.faixas.length ? kit.faixas.map((f) => f[0]) : [kit.base];
  const unicas = [...new Set(cores.map(nomeDaCor))];
  const padrao = { vertical: "listrada", horizontal: "listrada na horizontal", "faixa-peito": "com faixa no peito", diagonal: "com faixa diagonal" }[kit.padrao];
  const numero = nomeDaCor(kit.numero || (time.uniforme && time.uniforme.numero));
  // a cor do numero separa os iguais (branca de numero preto x branca de numero azul)
  const comNumero = numero !== "sem cor" && !unicas.includes(numero) ? `, número ${masculino(numero)}` : "";
  return `${unicas.join(" e ")}${padrao ? `, ${padrao}` : ""}${comNumero}`;
}
// "camisa branca" mas "numero branco" (rosa, laranja, cinza e vinho nao mudam)
const masculino = (cor) => (/(rosa|laranja|cinza|vinho)$/.test(cor) ? cor : cor.replace(/a$/, "o"));
function nomeDaCor(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return "sem cor";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.12) return l > 0.8 ? "branca" : l < 0.22 ? "preta" : "cinza";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 340) return l < 0.3 ? "vinho" : "vermelha";
  if (h < 45) return l < 0.35 ? "marrom" : "laranja";
  if (h < 70) return l < 0.4 ? "dourada" : "amarela";
  if (h < 170) return "verde";
  if (h < 200) return "azul-clara";
  if (h < 260) return l < 0.3 ? "azul-marinho" : "azul";
  if (h < 300) return "roxa";
  return "rosa";
}

// --- chutes ------------------------------------------------------------------

function comparar(id) {
  const c = cartaDoChute(id);
  const alvo = J.alvo;
  const overall = c.j.overall;
  return {
    id,
    nome: c.j.nome,
    carta: c,
    clube: c.time.nome === alvo.time.nome,
    pos: c.j.posicao === alvo.j.posicao,
    // sem pais no dado: nao compara (ausencia nunca e "outra selecao")
    selecao: paisDe(id) && paisDe(alvo.j.player_id) ? paisDe(id) === paisDe(alvo.j.player_id) : null,
    bandeira: paisDe(id) ? bandeira(paisDe(id)) : "",
    // ausencia nunca e zero: chute sem nota nao compara overall
    overall: overall === null ? null : overall === alvo.j.overall ? "=" : alvo.j.overall > overall ? "sobe" : "desce",
    certo: id === alvo.j.player_id,
  };
}

function linhaDoChute(ch) {
  const li = el("li", `chute ${ch.certo ? "chute-certo" : ""}`);
  li.append(el("span", "chute-nome", ch.nome));
  const sub = el("span", "chute-sub", `${ch.carta.time.nome} · ${ch.carta.r.curto}`);
  li.append(sub);
  if (!ch.certo) {
    const selos = el("span", "chute-selos");
    const selo = (ok, texto, titulo) => {
      const s = el("span", `selo ${ok === null ? "selo-nulo" : ok ? "selo-sim" : "selo-nao"}`, texto);
      s.title = titulo;
      return s;
    };
    selos.append(
      selo(ch.clube, `${ch.clube ? "✅" : "❌"} Clube`, ch.clube ? "Mesmo clube" : "Outro clube"),
      selo(ch.pos, `${ch.pos ? "✅" : "❌"} Posição`, ch.pos ? "Mesma posição" : "Outra posição"),
      ch.selecao === null
        ? selo(null, `${ch.bandeira || "—"} Seleção`, "Sem dado de seleção")
        : selo(ch.selecao, `${ch.selecao ? "✅" : "❌"} ${ch.bandeira} Seleção`.replace(/\s+/g, " "), ch.selecao ? "Mesma seleção" : "Outra seleção"),
      ch.overall === null
        ? selo(null, "— OVR", "Esse chute não tem nota nessa temporada")
        : selo(ch.overall === "=", `${ch.overall === "sobe" ? "⬆️" : ch.overall === "desce" ? "⬇️" : "✅"} OVR`,
          ch.overall === "sobe" ? "O certo tem overall maior" : ch.overall === "desce" ? "O certo tem overall menor" : "Mesmo overall"),
    );
    li.append(selos);
  }
  return li;
}

function chutar(id) {
  if (J.fim || J.chutes.some((c) => c.id === id)) return;
  const ch = comparar(id);
  J.chutes.push(ch);
  evento(`quem/${J.diario ? "diario-" : ""}chute-${J.chutes.length}`);
  $("busca").value = "";
  fecharSugestoes();
  if (ch.certo) return terminar("acertou");
  if (J.chutes.length >= CHUTES) return terminar("errou");
  // o valor junto: no celular a lista de dicas fica embaixo dos chutes, fora da tela
  const nova = J.ordem[J.chutes.length];
  $("aviso").textContent = `Não é ${ch.nome}. 🎲 Saiu a dica ${TIPOS_DE_DICA[nova].titulo.toLowerCase()}: ${textoDaDica(nova).replace(/^[^:]*: /, "")}.`;
  $("aviso").classList.remove("aviso-novo"); void $("aviso").offsetWidth; $("aviso").classList.add("aviso-novo");
  tremer($("busca-caixa"));
  desenhar();
  // celular: fecha o teclado e volta pro topo pra ver a dica abrindo na carta;
  // no computador o cursor fica no campo pro proximo chute
  if (matchMedia("(max-width: 760px)").matches) {
    $("busca").blur();
    window.scrollTo({ top: 0, behavior: movimentoReduzido ? "auto" : "smooth" });
  } else $("busca").focus();
}

// --- busca com autocompletar -------------------------------------------------

let sugestoes = [];
let destaque = -1;

function buscar(termo) {
  if (normalizarBusca(termo).trim().length < 2) return [];
  const ja = new Set(J.chutes.map((c) => c.id));
  const n = normalizarBusca(termo).trim();
  return J.opcoes
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
    // nome curto abreviado demais ("J. P. B. d. O. Lo"): o completo ajuda a reconhecer
    if (o.nome_completo && normalizarBusca(o.nome_completo) !== normalizarBusca(o.nome)) nome.append(el("span", "completo", ` · ${o.nome_completo}`));
    const pais = paisDe(o.id);
    li.append(nome, el("small", null, `${pais ? `${bandeira(pais)} ` : ""}${o.detalhe}`));
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

// --- telas -------------------------------------------------------------------

function mostrarTela(id) {
  for (const t of document.querySelectorAll(".quem .tela")) t.hidden = t.id !== id;
}


function desenhar() {
  // o que abriu desde o ultimo desenho entra animado (na 1a vez, nada anima)
  const abertas = dicasAbertas();
  const antes = J.abertasAntes ?? abertas;
  J.abertasAntes = abertas;
  const novas = new Set();
  for (let i = antes; i < abertas; i++) novas.add(J.ordem[i]);

  const carta = cartaMisteriosa(novas);
  if (novas.size) carta.classList.add("pulso");
  $("carta-misterio").replaceChildren(carta);
  listaDeDicas(novas);
  contarNumeros(carta);
  const lista = $("chutes");
  // o mais novo em cima, colado no campo de busca e no aviso; so ele entra animado
  lista.replaceChildren(...[...J.chutes].reverse().map((ch, i) => {
    const li = linhaDoChute(ch);
    if (i === 0 && novas.size) li.classList.add("novo");
    return li;
  }));
  const faltam = CHUTES - J.chutes.length;
  const vidas = $("contador");
  vidas.replaceChildren(...Array.from({ length: CHUTES }, (_, i) => {
    const ch = J.chutes[i];
    const b = el("i", ch ? (ch.certo ? "vida certa" : "vida errada") : i === J.chutes.length ? "vida atual" : "vida");
    if (ch && i === J.chutes.length - 1 && novas.size) b.classList.add("acabou");
    return b;
  }), el("span", "vidas-texto", J.fim ? "" : `Chute ${J.chutes.length + 1} de ${CHUTES}`));
  vidas.setAttribute("aria-label", `Chute ${J.chutes.length + 1} de ${CHUTES}`);
  vidas.dataset.ultimo = String(faltam === 1);
  $("modo").textContent = J.diario ? `Desafio #${J.diario.numero}` : "Partida livre";
}

// numero que acabou de aparecer conta de 0 ate o valor (overall e atributos)
function contarNumeros(raiz) {
  if (movimentoReduzido) return;
  for (const n of raiz.querySelectorAll(".conta dd, strong.conta")) {
    const alvo = Number(n.textContent);
    if (!Number.isFinite(alvo)) continue;
    const inicio = performance.now() + 800, dur = 650;
    n.textContent = "0";
    const passo = (agora) => {
      const f = Math.min(1, Math.max(0, (agora - inicio) / dur));
      n.textContent = String(Math.round(alvo * (1 - Math.pow(1 - f, 3))));
      if (f < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }
}

// tremidinha no campo quando erra
function tremer(elem) {
  if (movimentoReduzido) return;
  elem.classList.remove("tremendo");
  void elem.offsetWidth;
  elem.classList.add("tremendo");
  clearTimeout(elem.tremidaFim);
  elem.tremidaFim = setTimeout(() => elem.classList.remove("tremendo"), 450);
}

function comecar({ diario = false } = {}) {
  J.chutes = [];
  J.fim = null;
  J.abertasAntes = null;
  if (diario) {
    const feito = diarioDeHoje();
    if (feito) return reverDiario(feito);
    J.diario = { data: hojeLocal(), numero: numeroDoDesafio(hojeLocal()) };
    J.alvo = alvoDoDia(J.diario.data);
    J.ordem = ordemDoDia(J.diario.data);
  } else {
    J.diario = null;
    J.alvo = alvoLivre();
    J.ordem = sortearOrdem();
  }
  evento(diario ? "quem/diario" : "quem/inicio");
  $("aviso").textContent = "";
  mostrarTela("tela-jogo");
  desenhar();
  $("busca").value = "";
  window.scrollTo({ top: 0 });
  $("busca").focus({ preventScroll: true });
}

function grade() {
  const q = J.chutes.map((c) => (c.certo ? "🟩" : c.clube && c.pos ? "🟨" : "🟥"));
  while (q.length < CHUTES) q.push("⬜");
  return q.join("");
}

function terminar(como, { revisao = false } = {}) {
  J.fim = como;
  const n = J.chutes.length;
  const { j, time, ano } = J.alvo;
  if (!revisao) evento(`quem/${J.diario ? "diario-" : ""}${como}-${n}`);
  fecharSugestoes();
  $("aviso").textContent = "";

  const carta = cartaDoJogador(j, time, J.alvo.r, { estatica: true });
  carta.classList.add("revelando");
  $("fim-carta").replaceChildren(carta);
  $("fim-titulo").textContent = como === "acertou"
    ? (n === 1 ? "De primeira! Tá em casa." : `Acertou no ${n}º chute.`)
    : "Não foi dessa vez.";
  $("fim-texto").textContent = `${j.nome_completo || j.nome}, ${time.nome}, ${J.alvo.r.rotulo}. Overall ${j.overall}.`;
  $("fim-grade").textContent = grade();
  $("fim-chutes").replaceChildren(...J.chutes.map(linhaDoChute));

  const serie = lerSerie();
  if (!revisao) {
    if (como === "acertou") serie.atual += 1; else serie.atual = 0;
    serie.melhor = Math.max(serie.melhor, serie.atual);
    try { localStorage.setItem(CHAVE_SERIE, JSON.stringify(serie)); } catch { /* ok */ }
  }
  $("fim-serie").textContent = serie.atual > 1 ? `${serie.atual} acertos seguidos (seu melhor: ${serie.melhor}).` : serie.melhor > 1 ? `Seu melhor: ${serie.melhor} seguidos.` : "";

  const link = "temdadoemcasa.github.io/quem-ta-em-casa.html";
  const placar = como === "acertou" ? `${n}/${CHUTES}` : `X/${CHUTES}`;
  if (J.diario) {
    if (!revisao) try {
      localStorage.setItem(CHAVE_DIARIO, JSON.stringify({
        data: J.diario.data, numero: J.diario.numero, como, chave: J.alvo.chave, id: j.player_id, chutes: J.chutes.map((c) => c.id),
      }));
    } catch { /* ok */ }
    J.textoCompartilhar = `Quem Tá em Casa? · Desafio #${J.diario.numero} · ${placar}\n${grade()}\n${link}#desafio`;
    $("fim-diario").textContent = `Desafio #${J.diario.numero}. O próximo sai amanhã.`;
  } else {
    J.textoCompartilhar = `Quem Tá em Casa? · ${placar}\n${grade()}\n${link}`;
    $("fim-diario").textContent = "";
  }
  $("compartilhar").textContent = "Compartilhar resultado";
  $("de-novo").textContent = J.diario ? "Jogar partida livre" : "Jogar de novo";
  mostrarTela("tela-fim");
  if (como === "acertou" && !revisao) confete($("fim-carta"));
  $("fim-titulo").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function confete(alvo) {
  if (movimentoReduzido) return;
  const cores = ["#4cc9f0", "#3ddc84", "#f2c230", "#ff4d6d", "#c8ff00", "#ffffff"];
  const caixa = el("div", "confete-caixa");
  caixa.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 36; i++) {
    const c = el("i", "confete");
    c.style.setProperty("--x", `${(Math.random() * 2 - 1) * 160}px`);
    c.style.setProperty("--y", `${-80 - Math.random() * 160}px`);
    c.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    c.style.setProperty("--d", `${Math.random() * 0.15}s`);
    c.style.background = cores[i % cores.length];
    caixa.append(c);
  }
  alvo.append(caixa);
  setTimeout(() => caixa.remove(), 1800);
}

// desafio de hoje ja jogado: so mostra o resultado, sem jogar de novo
function reverDiario(feito) {
  const cartas = J.cartasDe.get(feito.id) || [];
  const c = cartas.find((x) => x.chave === feito.chave);
  const r = c && c.r;
  if (!c || !r) { try { localStorage.removeItem(CHAVE_DIARIO); } catch { /* ok */ } return comecar({ diario: true }); }
  J.diario = { data: feito.data, numero: feito.numero };
  J.alvo = { ano: c.ano, chave: c.chave, j: c.j, time: c.time, r };
  J.ordem = ordemDoDia(feito.data);
  J.chutes = feito.chutes.filter((id) => J.cartasDe.has(id)).map(comparar);
  // rever nao conta de novo na serie nem no contador
  terminar(feito.como, { revisao: true });
  $("fim-serie").textContent = "";
}

function atualizarBotaoDiario() {
  const feito = diarioDeHoje();
  const numero = numeroDoDesafio(hojeLocal());
  $("diario").querySelector("small").textContent = feito
    ? `#${feito.numero} feito: ${feito.como === "acertou" ? `${feito.chutes.length}/${CHUTES}` : `X/${CHUTES}`}. Ver resultado.`
    : `#${numero} · o mesmo jogador pra todo mundo hoje`;
}

async function iniciarQuem() {
  const [uniformes, anos, europa, paises] = await Promise.all([
    json("dados/uniformes.json").catch(() => ({})),
    json("dados/temporadas.json"),
    // Premier League e Champions: so este jogo carrega (o resto do site e Brasileirao)
    json("dados/retratos-europa.json").catch(() => []),
    // a selecao e so uma dica: sem o arquivo, o jogo segue com "sem dado"
    json("dados/paises.json").catch(() => ({})),
  ]);
  J.paises = paises;
  UNIFORMES = uniformes;
  const chaves = [...anos.map(String), ...europa];
  J.retratos = await Promise.all(chaves.map(async (chave) => {
    const r = await retrato(chave);
    r.chave = chave;
    r.rotulo = `${r.populacao} ${r.temporada_rotulo || r.temporada}`;
    r.curto = `${r.populacao.replace(/ League$/, "")} ${r.temporada_rotulo || r.temporada}`;
    return r;
  }));
  try { if (LIGAS[localStorage.getItem(CHAVE_LIGA)]) J.liga = localStorage.getItem(CHAVE_LIGA); } catch { /* ok */ }
  const marcarLiga = () => document.querySelectorAll("#ligas .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.liga === J.liga)));
  marcarLiga();
  document.querySelectorAll("#ligas .chip").forEach((b) => b.addEventListener("click", () => {
    J.liga = b.dataset.liga;
    try { localStorage.setItem(CHAVE_LIGA, J.liga); } catch { /* ok */ }
    marcarLiga();
  }));
  indexarJogadores();
  $("carregando").hidden = true;
  $("form-inicio").hidden = false;
  atualizarBotaoDiario();

  $("diario").addEventListener("click", () => comecar({ diario: true }));
  $("livre").addEventListener("click", () => comecar());
  $("de-novo").addEventListener("click", () => { atualizarBotaoDiario(); comecar(); });
  $("voltar").addEventListener("click", () => { atualizarBotaoDiario(); mostrarTela("tela-inicio"); });
  $("desistir").addEventListener("click", () => { if (!J.fim) terminar("desistiu"); });
  $("compartilhar").addEventListener("click", async () => {
    const texto = J.textoCompartilhar;
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      $("compartilhar").textContent = "Copiado!";
    } catch { /* cancelou */ }
  });

  const busca = $("busca");
  busca.addEventListener("input", mostrarSugestoes);
  // no celular o teclado cobre metade da tela: sobe o campo pra lista caber embaixo
  busca.addEventListener("click", () => {
    if (matchMedia("(max-width: 760px)").matches) setTimeout(() => busca.parentElement.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
  });
  busca.addEventListener("blur", () => setTimeout(fecharSugestoes, 250));
  busca.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && sugestoes.length) { e.preventDefault(); destaque = (destaque + 1) % sugestoes.length; marcarDestaque(); }
    else if (e.key === "ArrowUp" && sugestoes.length) { e.preventDefault(); destaque = (destaque - 1 + sugestoes.length) % sugestoes.length; marcarDestaque(); }
    else if (e.key === "Enter") { e.preventDefault(); if (destaque >= 0) chutar(sugestoes[destaque].id); }
    else if (e.key === "Escape") fecharSugestoes();
  });

  if (location.hash === "#desafio") $("diario").focus({ preventScroll: true });
}

iniciarQuem().catch((erro) => {
  $("carregando").textContent = "Não deu pra carregar as cartas agora. Tenta recarregar a página.";
  console.error(erro);
});
