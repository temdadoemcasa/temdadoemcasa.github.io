// Site do Tem dado em casa. Sem framework e sem build: tres JSON em dados/.
// Todo texto vindo dos dados entra por textContent, nunca por innerHTML.
"use strict";

const POSICAO = { G: "Goleiro", D: "Defesa", M: "Meio", F: "Ataque" };
const SIGLA = { G: "GOL", D: "DEF", M: "MEI", F: "ATA" };
const PLURAL = { G: "goleiros", D: "defensores", M: "meio-campistas", F: "atacantes" };
const cacheDeRetratos = new Map();
const movimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const temHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

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

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

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

// --- retrato e indices ----------------------------------------------------

// O indice e calculado uma vez por temporada: quem e de qual time, ranking
// por posicao e a mediana de cada eixo por posicao (a linha tracejada do radar).
const TIME_DE = new WeakMap();

function indexar(r) {
  // rotulos dos atributos de linha sao os do v2, venha o retrato de onde vier
  const eixosDeGoleiro = Object.fromEntries(
    Object.entries(r.eixos || {}).filter(([c]) => EIXOS_GOLEIRO.some(([g]) => g === c)));
  r.eixos = { ...eixosDeGoleiro, ...ROTULOS_LINHA };
  const todos = [];
  for (const time of r.times) {
    for (const j of time.jogadores) {
      normalizarEixos(j);
      TIME_DE.set(j, time);
      todos.push(j);
    }
  }
  // quem saiu da Serie A no meio do ano: fora do elenco, mas a busca acha
  for (const time of r.times) {
    for (const j of time.sairam || []) {
      normalizarEixos(j);
      TIME_DE.set(j, time);
    }
  }
  const comNota = todos.filter((j) => j.overall !== null).sort((a, b) => b.overall - a.overall);
  const porPosicao = {};
  const mediana = {};
  // ranking, seleção e destaques: só quem passou do piso de minutos. Quem
  // tem nota pelo piso de reputação (recém-chegado, pouco minuto) continua
  // com carta no elenco e no Tem Time em Casa, mas não entra na régua da liga.
  const ranqueavel = (j) => typeof j.minutos === "number" && j.minutos >= r.piso_minutos;
  for (const pos of Object.keys(POSICAO)) {
    const grupo = comNota.filter((j) => j.posicao === pos && ranqueavel(j));
    porPosicao[pos] = grupo;
    mediana[pos] = {};
    const chaves = new Set(grupo.flatMap((j) => Object.keys(j.eixos)));
    for (const chave of chaves) {
      const v = grupo.map((j) => j.eixos[chave]).filter((x) => typeof x === "number").sort((a, b) => a - b);
      if (v.length) mediana[pos][chave] = v[Math.floor(v.length / 2)];
    }
  }
  r.indice = { todos, comNota, porPosicao, mediana, ranqueavel };
  r.cortes = cortesDoRetrato(r);
  return r;
}

async function retrato(ano) {
  if (!cacheDeRetratos.has(ano)) cacheDeRetratos.set(ano, json(`dados/overalls-${ano}.json`).then(indexar));
  return cacheDeRetratos.get(ano);
}

function notaDoRetrato(r) {
  const parcial = r.jogos_com_placar < r.jogos_esperados;
  const jogos = parcial
    ? `${r.jogos_com_placar} de ${r.jogos_esperados} jogos na base (temporada em andamento)`
    : `${r.jogos_esperados} jogos, temporada completa`;
  return `${r.populacao} ${r.temporada} · ${jogos} · retrato de ${dataCurta(r.gerado_em)} · piso de ${r.piso_minutos} minutos`;
}

// --- desenho --------------------------------------------------------------

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

// --- uniformes ----------------------------------------------------------------

// Padrao da camisa de cada clube vem de dados/uniformes.json (chave = nome do
// time no retrato). Sem entrada, cai na camisa lisa com a cor do retrato.
// So listras e cores: escudo de clube e marca registrada, nao entra.
//   lisa:        { base }
//   vertical /
//   horizontal:  { faixas: [[cor, largura], ...] }  repete ate cobrir
//   faixa-peito: { base, faixas: [[cor, altura], ...], inicio }
//   diagonal:    { base, faixa, largura }
let UNIFORMES = {};
let contadorSvg = 0;
const CAMISA = "M30 42 L43 36 Q50 43 57 36 L70 42 L90 58 L80 72 L72 66 V116 H28 V66 L20 72 L10 58 Z";

function kitDoTime(time) {
  // kit explicito (estrangeiros do Tem Time em Casa, time do usuario) vem primeiro
  if (time.kit && (time.kit.base || (time.kit.faixas && time.kit.faixas.length))) return time.kit;
  const k = UNIFORMES[time.nome];
  if (k && (k.base || (k.faixas && k.faixas.length))) return k;
  return {
    padrao: "lisa",
    base: corOu(time.uniforme && time.uniforme.primaria, "#30363d"),
    numero: corOu(time.uniforme && time.uniforme.numero, "#e6edf3"),
  };
}

// cor dominante do kit: fundo liso ou a primeira listra
function corDoKit(kit) {
  return corOu(kit.base, corOu(kit.faixas && kit.faixas[0] && kit.faixas[0][0], "#30363d"));
}

function listras(g, faixas, eixo) {
  const validas = faixas.filter(([cor, l]) => HEX.test(cor) && l > 0);
  const ciclo = validas.reduce((s, [, l]) => s + l, 0);
  if (!ciclo) return;
  // vertical centra a primeira listra no meio do peito; horizontal comeca na gola
  let pos = eixo === "vertical" ? 50 - validas[0][1] / 2 : 34;
  const [ini, fim] = eixo === "vertical" ? [8, 92] : [30, 118];
  while (pos > ini) pos -= ciclo;
  for (let i = 0; pos < fim; i = (i + 1) % validas.length) {
    const [cor, l] = validas[i];
    g.append(eixo === "vertical"
      ? svg("rect", { x: pos, y: 30, width: l + 0.05, height: 90, fill: cor })
      : svg("rect", { x: 0, y: pos, width: 100, height: l + 0.05, fill: cor }));
    pos += l;
  }
}

function pintarTecido(g, kit) {
  const base = corDoKit(kit);
  g.append(svg("rect", { x: 0, y: 30, width: 100, height: 90, fill: base }));
  if (kit.padrao === "vertical" || kit.padrao === "horizontal") {
    listras(g, kit.faixas || [], kit.padrao);
  } else if (kit.padrao === "faixa-peito") {
    let y = typeof kit.inicio === "number" ? kit.inicio : 58;
    for (const [cor, altura] of kit.faixas || []) {
      if (!HEX.test(cor)) continue;
      g.append(svg("rect", { x: 0, y, width: 100, height: altura, fill: cor }));
      y += altura;
    }
  } else if (kit.padrao === "diagonal" && HEX.test(kit.faixa || "")) {
    const l = kit.largura || 12;
    // do ombro direito do jogador (esquerda de quem olha) ate o quadril oposto;
    // "sentido": "inverso" espelha (River Plate)
    const [x0, x1] = kit.sentido === "inverso" ? [60, 30] : [40, 70];
    g.append(svg("path", { d: `M${x0 - l / 2} 34 L${x0 + l / 2} 34 L${x1 + l / 2} 120 L${x1 - l / 2} 120 Z`, fill: kit.faixa }));
  }
}

// Cores que ficam atras do numero (faixa y 64-92 do peito). O numero tem
// que contrastar com TODAS: verde em cima de faixa verde (Coritiba) ou
// branco na listra branca nao passa.
function coresAtrasDoNumero(kit) {
  const base = corDoKit(kit);
  const faixas = (kit.faixas || []).filter(([cor]) => HEX.test(cor));
  if (kit.padrao === "vertical" || kit.padrao === "horizontal") return faixas.map(([cor]) => cor);
  if (kit.padrao === "diagonal") return [base, corOu(kit.faixa, base)];
  if (kit.padrao === "faixa-peito") {
    const cores = [base];
    let y = typeof kit.inicio === "number" ? kit.inicio : 58;
    for (const [cor, altura] of faixas) {
      if (y < 92 && y + altura > 64) cores.push(cor);
      y += altura;
    }
    return cores;
  }
  return [base];
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
// Fica a cor do clube se ela ler bem (contraste >= 3 com tudo atras);
// senao, branco ou preto, o que tiver o melhor pior caso.
function corDoNumero(kit) {
  const atras = coresAtrasDoNumero(kit);
  const pior = (cor) => Math.min(...atras.map((c) => contraste(cor, c)));
  const doClube = HEX.test(kit.numero || "") ? kit.numero : null;
  if (doClube && pior(doClube) >= 3) return doClube;
  return ["#ffffff", "#111111"].reduce((a, b) => (pior(b) > pior(a) ? b : a));
}

// A camisa (e, no card, o boneco generico por cima dela). viewBox fixo
// 0 0 100 120; o numero e texto, nao imagem, entao escala sem perder.
// ids do clipPath e do degrade sao unicos: varias camisas na mesma pagina.
function figura(time, camisa, { cabeca = true } = {}) {
  const kit = kitDoTime(time);
  const numero = corDoNumero(kit);
  const id = `camisa-${++contadorSvg}`;
  const raiz = svg("svg", { viewBox: cabeca ? "0 0 100 120" : "0 30 100 90", "aria-hidden": "true" });
  if (cabeca) {
    raiz.append(
      svg("rect", { x: 42, y: 30, width: 16, height: 14, rx: 4, fill: "rgba(20,24,30,0.55)" }),
      svg("circle", { cx: 50, cy: 22, r: 16, fill: "rgba(20,24,30,0.55)" }),
    );
  }
  raiz.append(svg("defs", {}, [
    svg("clipPath", { id: `${id}-corte` }, [svg("path", { d: CAMISA })]),
    svg("linearGradient", { id: `${id}-sombra`, x1: 0, x2: 1, y1: 0, y2: 0 }, [
      svg("stop", { offset: "0", "stop-color": "#000", "stop-opacity": "0.28" }),
      svg("stop", { offset: "0.3", "stop-color": "#000", "stop-opacity": "0" }),
      svg("stop", { offset: "0.62", "stop-color": "#fff", "stop-opacity": "0.1" }),
      svg("stop", { offset: "1", "stop-color": "#000", "stop-opacity": "0.3" }),
    ]),
  ]));
  const tecido = svg("g", { "clip-path": `url(#${id}-corte)` });
  pintarTecido(tecido, kit);
  // punhos e barra levemente mais escuros, e o volume do tecido por cima
  tecido.append(
    svg("path", { d: "M10 58 L20 72 L16 66 Z M90 58 L80 72 L84 66 Z", fill: "rgba(0,0,0,0.2)" }),
    svg("rect", { x: 0, y: 30, width: 100, height: 90, fill: `url(#${id}-sombra)` }),
  );
  raiz.append(tecido);
  raiz.append(svg("path", { d: CAMISA, fill: "none", stroke: "rgba(0,0,0,0.45)", "stroke-width": 1.5, "stroke-linejoin": "round" }));
  // gola
  raiz.append(svg("path", { d: "M43 36 Q50 43 57 36", fill: "none", stroke: corOu(kit.gola, numero), "stroke-width": 2.6, "stroke-linecap": "round" }));
  if (camisa !== null && camisa !== undefined) {
    const texto = svg("text", {
      // centro do peito: o tronco vai de y 36 a 116
      x: 50, y: String(camisa).length > 2 ? 86 : 89, "text-anchor": "middle", "font-size": String(camisa).length > 2 ? 22 : 30,
      "font-weight": 800, fill: numero, "font-family": "'Barlow Condensed', Inter, sans-serif",
      // contorno do lado oposto garante leitura em cima de listra
      stroke: luminancia(numero) > 0.4 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.75)",
      "stroke-width": 2.6, "paint-order": "stroke", "stroke-linejoin": "round",
    });
    texto.textContent = String(camisa);
    raiz.append(texto);
  }
  return raiz;
}

// --- cor: luminancia e mistura, para escolher texto claro ou escuro

function canal(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
function textoSobre(hex) {
  const l = luminancia(hex);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.05) ? "#ffffff" : "#10131a";
}

// --- niveis -----------------------------------------------------------------

// O nivel e o material da casa, como nos tres porquinhos: opiniao e o
// lobo. Concreto (id interno "grafeno") e o outlier e leva a cor do canal.
//
// Os cortes NAO sao numeros fixos: a escala do overall muda entre versoes
// do modelo do futdata. Ordem de preferencia:
//   1. o retrato traz "niveis": {"madeira": n, "tijolo": n, "grafeno": n}
//      (o futdata decide a regua);
//   2. senao, sai da posicao na liga: palha = 35% de baixo, madeira ate 85%,
//      tijolo ate 98%, grafeno = os 2% do topo.
// Os valores abaixo sao so o ponto de partida; usarCortes(r) troca.
const NIVEIS = [
  { id: "grafeno", nome: "Concreto", min: 82, faixa: "" }, // id interno segue "grafeno" (classes e JSON)
  { id: "tijolo", nome: "Tijolo", min: 75, faixa: "" },
  { id: "madeira", nome: "Madeira", min: 65, faixa: "" },
  { id: "palha", nome: "Palha", min: -Infinity, faixa: "" },
];
const QUANTIL_DO_NIVEL = { madeira: 0.35, tijolo: 0.85, grafeno: 0.98 };
const nivel = (overall) => NIVEIS.find((t) => overall >= t.min);

function cortesDoRetrato(r) {
  // o topo pode vir como "concreto" (nome novo) ou "grafeno" (nome antigo)
  const dado = r.niveis && { ...r.niveis, grafeno: r.niveis.concreto ?? r.niveis.grafeno };
  if (dado && ["madeira", "tijolo", "grafeno"].every((k) => typeof dado[k] === "number")) {
    return { madeira: dado.madeira, tijolo: dado.tijolo, grafeno: dado.grafeno, origem: "futdata" };
  }
  const v = r.indice.comNota.map((j) => j.overall).sort((a, b) => a - b);
  const q = (p) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : Infinity);
  return { madeira: q(QUANTIL_DO_NIVEL.madeira), tijolo: q(QUANTIL_DO_NIVEL.tijolo), grafeno: q(QUANTIL_DO_NIVEL.grafeno), origem: "liga" };
}

// Passa a valer a regua do retrato que esta na tela (uma temporada por vez).
function usarCortes(r) {
  const c = r.cortes;
  const [nm, nt, ng] = [c.madeira, c.tijolo, c.grafeno];
  const faixa = { grafeno: `${ng}+`, tijolo: `${nt}–${ng - 1}`, madeira: `${nm}–${nt - 1}`, palha: `até ${nm - 1}` };
  for (const t of NIVEIS) {
    t.min = t.id === "palha" ? -Infinity : c[t.id];
    t.faixa = faixa[t.id];
  }
}

// Formatacao condicional de planilha: 0 vermelho, 50 amarelo, 100 verde.
const ESCALA = [[0, [248, 105, 107]], [50, [255, 235, 132]], [100, [99, 190, 123]]];
function calor(v) {
  const i = v <= 50 ? 0 : 1;
  const [a, ca] = ESCALA[i], [b, cb] = ESCALA[i + 1];
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(",")})`;
}

// Siglas de placar; time fora da lista pega as tres primeiras letras.
const SIGLA_CLUBE = {
  "Athletico": "CAP", "Atlético-MG": "CAM", "Atlético-GO": "ACG", "Coritiba": "CFC", "Corinthians": "COR",
  "RB Bragantino": "RBB", "São Paulo": "SAO", "Sport Recife": "SPT", "Ceará": "CEA", "Criciúma": "CRI",
  "Cuiabá": "CUI", "Chapecoense": "CHA", "Cruzeiro": "CRU", "Grêmio": "GRE", "Vitória": "VIT",
};
function siglaClube(nome) {
  if (SIGLA_CLUBE[nome]) return SIGLA_CLUBE[nome];
  return nome.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function corDoClube(time) {
  return corDoKit(kitDoTime(time));
}

// --- eixos ------------------------------------------------------------------

// Os 6 atributos de linha do modelo de notas v2 (RIT FIN PAS DRI DEF FIS),
// na convencao do FIFA. Eixo ausente (ex.: ritmo sem tracking) sai como
// travessao, NUNCA como zero. Goleiro mantem os 5 eixos proprios.
const EIXOS_LINHA = [["RIT", "RIT"], ["FIN", "FIN"], ["PAS", "PAS"], ["DRI", "DRI"], ["DEF", "DEF"], ["FIS", "FÍS"]];
const ROTULOS_LINHA = { RIT: "Ritmo", FIN: "Finalização", PAS: "Passe", DRI: "Drible", DEF: "Defesa", FIS: "Físico" };

// Retrato exportado antes do v2 tem os 7 eixos antigos: cada atributo e a
// media dos eixos antigos que existirem (Precisao e Criacao viram PAS).
// Retrato do v2 ja traz as seis chaves e passa direto.
const EIXOS_ANTIGOS = { RIT: ["VEL"], FIN: ["CHU"], PAS: ["PAS", "CRI"], DRI: ["DRI"], DEF: ["DEF"], FIS: ["FOR"] };
const SO_NO_ANTIGO = ["VEL", "CHU", "CRI", "FOR"];

function normalizarEixos(jogador) {
  if (jogador.posicao === "G" || !SO_NO_ANTIGO.some((c) => c in jogador.eixos)) return;
  const novos = {};
  for (const [chave, antigas] of Object.entries(EIXOS_ANTIGOS)) {
    const v = antigas.map((c) => jogador.eixos[c]).filter((x) => typeof x === "number");
    if (v.length) novos[chave] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  }
  jogador.eixos = novos;
}
const EIXOS_GOLEIRO = [["REF", "REF"], ["EVI", "EVI"], ["MAO", "MÃO"], ["PES", "PÉS"], ["SAI", "SAÍ"]];
const RADAR_LINHA = EIXOS_LINHA.map(([c]) => c);
const ORDEM_GOLEIRO = EIXOS_GOLEIRO.map(([c]) => c);

function eixosDaCarta(jogador, rotulos) {
  const lista = jogador.posicao === "G" ? EIXOS_GOLEIRO : EIXOS_LINHA;
  return lista.map(([chave, sigla]) => {
    const v = jogador.eixos[chave];
    return [sigla, rotulos[chave] || chave, typeof v === "number" ? v : null];
  });
}

function valorParaOrdem(jogador, ordem) {
  if (ordem === "overall") return jogador.overall;
  const v = jogador.eixos[ordem];
  return typeof v === "number" ? v : -1;
}

function posicaoNoRanking(r, jogador) {
  const grupo = r.indice.porPosicao[jogador.posicao] || [];
  return [grupo.indexOf(jogador) + 1, grupo.length];
}

// --- a carta ----------------------------------------------------------------

// A carta e a casa do logo: o telhado em chevron com o nivel escrito
// embaixo, e o corpo e uma folha de planilha. Cada eixo e uma celula com
// formatacao condicional; no rodape, a posicao no ranking da liga.
// Numeros da temporada (opcionais no JSON, campo "numeros" do jogador).
// Cada familia mostra o que diz mais sobre ela; campo ausente nao aparece.
const NUMEROS = {
  gols: ["G", "gols"], assistencias: ["A", "assistências"], desarmes: ["DES", "desarmes"],
  interceptacoes: ["INT", "interceptações"], duelos_ganhos: ["DUE", "duelos ganhos"], dribles_certos: ["DRB", "dribles certos"],
  grandes_chances_criadas: ["GCC", "grandes chances criadas"], defesas: ["DEF", "defesas"], jogos_sem_sofrer: ["SG", "jogos sem sofrer gol"],
  passes_certos_pct: ["% PAS", "% de passes certos"],
};
// o que vai no rodape da carta: pela funcao (quando da pra saber), senao pela familia
const NUMEROS_DA_CARTA = { G: ["jogos_sem_sofrer", "defesas"], D: ["desarmes", "interceptacoes"], M: ["gols", "assistencias"], F: ["gols", "assistencias"] };
const NUMEROS_DA_FUNCAO = {
  GOL: ["jogos_sem_sofrer", "defesas"], ZAG: ["desarmes", "interceptacoes"], LAT: ["desarmes", "assistencias"],
  VOL: ["desarmes", "passes_certos_pct"], MC: ["gols", "assistencias"], MEI: ["gols", "assistencias"], PON: ["gols", "assistencias"], CA: ["gols", "assistencias"],
};
function numerosDoJogador(jogador, chaves = Object.keys(NUMEROS)) {
  const n = jogador.numeros || {};
  return chaves.filter((k) => typeof n[k] === "number").map((k) => [k, n[k]]);
}

function cartaDoJogador(jogador, time, r, { estatica = false } = {}) {
  const t = nivel(jogador.overall);
  const carta = el("article", `carta nivel-${t.id}`);
  const clube = corDoClube(time);
  carta.style.setProperty("--cor-clube", clube);
  const [pos, total] = posicaoNoRanking(r, jogador);
  if (!estatica) {
    carta.tabIndex = 0;
    carta.setAttribute("role", "button");
    carta.dataset.id = String(jogador.player_id);
    carta.dataset.time = String(time.team_id);
    carta.setAttribute("aria-label",
      `${jogador.nome}, ${time.nome}, ${POSICAO[jogador.posicao] || ""}, overall ${jogador.overall}, ${t.nome}. Abrir ficha.`);
  }

  const telhado = svg("svg", { class: "carta-telhado", viewBox: "0 0 100 30", "aria-hidden": "true" });
  telhado.append(svg("path", { d: "M4 26.5 L50 3.5 L96 26.5", class: "carta-telhado-traco" }));
  const rotulo = svg("text", { x: 50, y: 21.5, "text-anchor": "middle", class: "carta-telhado-nivel" });
  rotulo.textContent = `Casa de ${t.nome}`;
  telhado.append(rotulo);
  carta.append(telhado);

  const corpo = el("div", "carta-corpo");
  carta.append(corpo);

  const topo = el("div", "carta-topo");
  const nota = el("div", "carta-nota");
  const selo = el("span", "carta-clube", siglaClube(time.nome));
  selo.style.background = clube;
  selo.style.color = textoSobre(clube);
  selo.title = time.nome;
  nota.append(el("strong", null, String(jogador.overall)), el("span", "carta-pos", SIGLA[jogador.posicao] || ""), selo);
  const boneco = el("div", "carta-figura");
  boneco.append(figura(time, jogador.camisa, { cabeca: false }));
  topo.append(nota, boneco);

  const nome = el("h4", "carta-nome", jogador.nome);
  if (jogador.nome.length > 12) nome.classList.add("nome-longo");

  const atributos = eixosDaCarta(jogador, r.eixos);
  const eixos = el("dl", "carta-eixos");
  eixos.style.setProperty("--n", atributos.length);
  for (const [sigla, titulo, valor] of atributos) {
    const celula = el("div", valor === null ? "sem-dado" : "");
    celula.title = valor === null ? `${titulo}: sem dado` : `${titulo}: ${valor}`;
    if (valor !== null) {
      celula.style.setProperty("--cor", calor(valor));
      celula.style.setProperty("--v", valor);
    }
    celula.append(el("dt", null, sigla), el("dd", null, valor === null ? "—" : String(valor)));
    eixos.append(celula);
  }

  const info = el("div", "carta-info");
  info.append(
    el("span", null, pos > 0 ? `${pos}º de ${total} ${SIGLA[jogador.posicao] || ""}` : `menos de ${r.piso_minutos} min`),
    el("span", null, (() => {
      const f = typeof FUNCAO !== "undefined" ? FUNCAO.get(jogador) : null;
      const nums = numerosDoJogador(jogador, (f && NUMEROS_DA_FUNCAO[f]) || NUMEROS_DA_CARTA[jogador.posicao] || []);
      const txt = ([k, v]) => (k === "passes_certos_pct" ? `${v}% PAS` : `${v} ${NUMEROS[k][0]}`);
      return nums.length ? `${jogador.jogos} J · ${nums.map(txt).join(" · ")}` : `${jogador.jogos} J · ${jogador.minutos}'`;
    })()),
  );
  corpo.append(topo, nome, eixos, info);
  return carta;
}

// Inclinacao 3D e reflexo seguindo o mouse. Um listener so, delegado.
function ligarInclinacao() {
  if (!temHover || movimentoReduzido) return;
  let atual = null;
  const soltar = (carta) => {
    carta.classList.remove("inclinada");
    for (const v of ["--rx", "--ry", "--mx", "--my"]) carta.style.removeProperty(v);
  };
  document.addEventListener("pointermove", (e) => {
    const carta = e.target instanceof Element ? e.target.closest(".carta") : null;
    if (atual && atual !== carta) soltar(atual);
    atual = carta;
    if (!carta) return;
    const q = carta.getBoundingClientRect();
    const x = (e.clientX - q.left) / q.width;
    const y = (e.clientY - q.top) / q.height;
    carta.classList.add("inclinada");
    carta.style.setProperty("--ry", `${((x - 0.5) * 20).toFixed(2)}deg`);
    carta.style.setProperty("--rx", `${((0.5 - y) * 20).toFixed(2)}deg`);
    carta.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    carta.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  }, { passive: true });
}

// --- funcao de cada jogador (Tem Time em Casa e Prata da Casa usam) ------------------------

const NOME_FUNCAO = { GOL: "Goleiro", LAT: "Lateral", ZAG: "Zagueiro", VOL: "Volante", MC: "Meio-campo", MEI: "Meia", PON: "Ponta", CA: "Centroavante" };
const FAMILIA = { GOL: ["G"], LAT: ["D"], ZAG: ["D"], VOL: ["M"], MC: ["M"], MEI: ["M"], PON: ["F", "M"], CA: ["F"] };

// Funcao de cada jogador. Quem e titular sai de onde joga na escalacao base
// (linha e lado); quem nao e, sai do perfil dos eixos. Chute honesto: os
// dados nao tem posicao fina, so G/D/M/F.
const FUNCAO = new Map();
function inferirFuncoes(r) {
  FUNCAO.clear();
  for (const t of r.times) {
    if (!t.escalacao_base) continue;
    const porId = new Map(t.jogadores.map((j) => [j.player_id, j]));
    const linhas = new Map();
    for (const p of t.escalacao_base.posicoes) {
      const k = Math.round(p.y * 100);
      if (!linhas.has(k)) linhas.set(k, []);
      linhas.get(k).push(p);
    }
    const ordem = [...linhas.keys()].sort((a, b) => a - b);
    const nDefesa = ordem[1] !== undefined ? linhas.get(ordem[1]).length : 4;
    ordem.forEach((k, idx) => {
      const fila = linhas.get(k).sort((a, b) => a.x - b.x);
      const n = fila.length;
      fila.forEach((p, i) => {
        const j = porId.get(p.player_id);
        if (!j || FUNCAO.has(j)) return;
        const extremo = n >= 3 && (i === 0 || i === n - 1);
        let f;
        if (j.posicao === "G") f = "GOL";
        else if (j.posicao === "D") f = extremo && n >= 4 ? "LAT" : "ZAG";
        else if (j.posicao === "M") {
          // meia aberto na linha de 4 de um esquema de 3 zagueiros (3-4-2-1)
          // e ALA, mas nao lateral: na selecao e no draft lateral e defensor
          // ("D"). Era assim que o Mendoza, meia do Athletico, virava lateral
          // esquerdo da selecao (2026-09-24).
          if (extremo && n >= 4) f = idx === 2 && nDefesa === 3 ? "MEI" : "PON";
          else if (p.y >= 0.6) f = extremo ? "PON" : "MEI";
          else if (idx === 2 && n >= 3) f = i === Math.floor(n / 2) ? "VOL" : "MC";
          else if (n <= 2 && p.y <= 0.4) f = "VOL";
          else f = "MC";
        } else f = extremo ? "PON" : "CA";
        FUNCAO.set(j, f);
      });
    });
  }
  const e = (j, k) => (typeof j.eixos[k] === "number" ? j.eixos[k] : 50);
  for (const j of r.indice.comNota) {
    if (FUNCAO.has(j)) continue;
    let f;
    if (j.posicao === "G") f = "GOL";
    // eixos do modelo v2: RIT (ritmo), FIN, PAS, DRI, DEF, FIS
    else if (j.posicao === "D") f = e(j, "RIT") + e(j, "PAS") >= e(j, "DEF") + e(j, "FIS") ? "LAT" : "ZAG";
    else if (j.posicao === "M") f = e(j, "DEF") >= Math.max(e(j, "PAS"), e(j, "FIN")) ? "VOL" : (e(j, "PAS") + e(j, "FIN")) / 2 >= 60 ? "MEI" : "MC";
    else f = e(j, "DRI") + e(j, "RIT") >= e(j, "FIN") + e(j, "FIS") + 10 ? "PON" : "CA";
    FUNCAO.set(j, f);
  }
}

// Busca por nome: sem acento e sem caixa, palavra por palavra, no nome curto
// da carta ("B. Bidon") e no completo ("Breno Bidon"). "breno bidon",
// "bidon" e "gomez" (Gómez) acham; antes so o trecho exato do nome curto.
const normalizarBusca = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function casaComBusca(jogador, termo) {
  const alvo = normalizarBusca(`${jogador.nome} ${jogador.nome_completo || ""}`);
  return normalizarBusca(termo).split(/\s+/).filter(Boolean).every((p) => alvo.includes(p));
}

// --- lista sem nota e campinho -------------------------------------------

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

// Campo vertical, ataque para cima, com listras. x e y vem do futdata
// (0-1); a altura e esticada pela linha mais avancada da formacao, para
// os onze ocuparem o campo inteiro em vez de se espremerem embaixo.
// Jogador com nota e clicavel: abre a ficha.
// O gramado listrado com as linhas, viewBox 0 0 100 150 (ataque para cima).
// Serve ao campinho de cada time e ao campo da selecao.
function gramado(rotulo) {
  const L = 100, A = 150, M = 5;
  const campo = svg("svg", { viewBox: `0 0 ${L} ${A}`, role: "img", "aria-label": rotulo });
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
  return campo;
}

// Um jogador no campo: camisa do clube, nota no hexagono do nivel e o
// sobrenome. Com nota, vira botao que abre a ficha. `clube` escreve a sigla
// do time embaixo (a selecao mistura clubes; o campinho de um time nao).
function desenharNo(g, jogador, time, { clube = false } = {}) {
  const comNota = jogador.overall !== null;
  if (comNota) {
    g.setAttribute("class", "no-campo");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `${jogador.nome}, ${time.nome}, overall ${jogador.overall}. Abrir ficha.`);
    g.dataset.id = String(jogador.player_id);
    g.dataset.time = String(time.team_id);
  }
  const dentro = svg("g", { class: "no-campo-corpo" });
  dentro.append(svg("circle", { r: 6.2, fill: "rgba(13,17,23,0.78)", class: "no-campo-aro" }));
  const camisa = figura(time, jogador.camisa, { cabeca: false });
  camisa.setAttribute("x", -5); camisa.setAttribute("y", -5.6);
  camisa.setAttribute("width", 10); camisa.setAttribute("height", 9.4);
  dentro.append(camisa);
  // a nota num hexagono na cor do nivel, embaixo do jogador
  const hexagono = svg("path", { d: "M-5 8.2 L-3 6.4 L3 6.4 L5 8.2 L3 10 L-3 10 Z", fill: "#30363d" });
  if (comNota) hexagono.setAttribute("class", `hex-nivel nivel-${nivel(jogador.overall).id}`);
  dentro.append(hexagono);
  const nota = svg("text", { y: 9.35, "text-anchor": "middle", "font-size": 2.9, "font-weight": 800,
    fill: comNota ? "#10131a" : "#e6edf3" });
  nota.textContent = comNota ? String(jogador.overall) : "s/n";
  // no campo vai o sobrenome: "G. de Arrascaeta" -> "Arrascaeta"
  const nome = svg("text", { y: 13.6, "text-anchor": "middle", "font-size": 2.9, fill: "#ffffff",
    "font-weight": 700, stroke: "rgba(0,0,0,0.55)", "stroke-width": 0.5, "paint-order": "stroke" });
  nome.textContent = sobrenome(jogador.nome);
  dentro.append(nota, nome);
  if (clube) {
    const sigla = svg("text", { y: 16.9, "text-anchor": "middle", "font-size": 2.3, fill: "rgba(255,255,255,0.8)",
      "font-weight": 700, "letter-spacing": 0.2, stroke: "rgba(0,0,0,0.5)", "stroke-width": 0.4, "paint-order": "stroke" });
    sigla.textContent = siglaClube(time.nome);
    dentro.append(sigla);
  }
  g.append(dentro);
}

function campinho(time) {
  const base = time.escalacao_base;
  const quadro = el("figure", "campinho");
  if (!base) {
    quadro.append(el("figcaption", null, "Sem formação registrada nesta temporada."));
    return quadro;
  }
  const porId = new Map(time.jogadores.map((j) => [j.player_id, j]));
  const campo = gramado(`Escalação base do ${time.nome} no ${base.formacao}`);
  // Cada linha da formacao (mesmo y) vira uma fileira com espaco igual
  // entre os jogadores, e as fileiras ficam equidistantes do gol ao ataque.
  // Assim o meio-campo de 4 ou 5 nao se espreme no centro.
  const chaveY = (p) => Math.round(p.y * 100);
  const fileiras = [...new Set(base.posicoes.map(chaveY))].sort((a, b) => a - b);
  const topo = 20, fundo = 132;
  const cyDe = (p) => {
    const i = fileiras.indexOf(chaveY(p));
    return fileiras.length > 1 ? fundo - (i * (fundo - topo)) / (fileiras.length - 1) : fundo;
  };
  const cxDe = new Map();
  for (const nivelY of fileiras) {
    const linha = base.posicoes.filter((p) => chaveY(p) === nivelY).sort((a, b) => a.x - b.x);
    const passo = linha.length > 1 ? Math.min(24, 78 / (linha.length - 1)) : 0;
    linha.forEach((p, i) => cxDe.set(p, 50 + (i - (linha.length - 1) / 2) * passo));
  }
  for (const pos of base.posicoes) {
    const cx = cxDe.get(pos);
    const cy = cyDe(pos);
    const jogador = pos.player_id ? porId.get(pos.player_id) : null;
    const g = svg("g", { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(1.18)` });
    if (!jogador) {
      // posicao que ninguem ocupou de forma recorrente: tracejado, nao um nome inventado
      g.append(svg("circle", { r: 5.5, fill: "rgba(13,17,23,0.35)", stroke: "rgba(255,255,255,0.7)",
        "stroke-dasharray": "1.5 1.5", "stroke-width": 0.6 }));
      const t = svg("text", { y: 1.2, "text-anchor": "middle", "font-size": 3.6, fill: "#ffffff", "font-weight": 700 });
      t.textContent = "?";
      g.append(t);
    } else {
      desenharNo(g, jogador, time);
    }
    campo.append(g);
  }
  quadro.append(campo);
  quadro.append(el("figcaption", null,
    `${base.formacao}, o esquema de ${base.jogos} jogos. Em cada posição, quem mais bateu ponto ali. Clica num jogador pra abrir a ficha.`));
  return quadro;
}

// --- estado da secao de cartas -------------------------------------------

const estado = {
  r: null,          // retrato da temporada escolhida
  visao: "time",    // "time" ou "liga"
  posicao: "todas",
  ordem: "overall",
  limiteLiga: 60,
};

function filtrarOrdenar(jogadores) {
  const lista = estado.posicao === "todas" ? jogadores : jogadores.filter((j) => j.posicao === estado.posicao);
  return [...lista].sort((a, b) =>
    valorParaOrdem(b, estado.ordem) - valorParaOrdem(a, estado.ordem) || b.overall - a.overall);
}

function gradeDeCartas(jogadores, r) {
  const grade = el("div", "cards");
  jogadores.forEach((j, i) => {
    const carta = cartaDoJogador(j, TIME_DE.get(j), r);
    carta.style.setProperty("--i", Math.min(i, 24));
    grade.append(carta);
  });
  return grade;
}

function blocoSemNota(semNota, r, aberto) {
  // quem nao tem nota continua na pagina, so recolhido: ausencia e
  // informacao, mas nao pode empurrar os cards para baixo
  const recolhido = el("details", "sem-nota-grupo");
  recolhido.open = aberto;
  recolhido.append(el("summary", null,
    `${semNota.length} sem nota: menos de ${r.piso_minutos} minutos em campo. Sem minuto, sem carta.`));
  const lista = el("ul", "sem-nota-lista");
  for (const jogador of semNota) lista.append(linhaSemNota(jogador));
  recolhido.append(lista);
  return recolhido;
}

function mostrarElenco() {
  const r = estado.r;
  const alvo = document.getElementById("elenco");
  alvo.replaceChildren();
  const termo = document.getElementById("busca").value.trim().toLocaleLowerCase("pt-BR");
  const teamId = Number(document.getElementById("time").value);

  // liga toda: um ranking so, sem campinho
  if (estado.visao === "liga" && !termo) {
    const todos = filtrarOrdenar(r.indice.comNota);
    const mostrados = todos.slice(0, estado.limiteLiga);
    const titulo = el("h3", "elenco-titulo");
    const rotuloOrdem = estado.ordem === "overall" ? "overall" : (r.eixos[estado.ordem] || estado.ordem).toLocaleLowerCase("pt-BR");
    const quem = estado.posicao === "todas" ? "jogadores" : PLURAL[estado.posicao];
    titulo.append(el("span", null, `Os ${mostrados.length} melhores ${quem} da liga por ${rotuloOrdem}`));
    alvo.append(titulo);
    if (!mostrados.length) { alvo.append(el("div", "vazio", "Ninguém com nota nesse filtro.")); return; }
    alvo.append(gradeDeCartas(mostrados, r));
    if (todos.length > mostrados.length) {
      const mais = el("button", "botao botao-mais", `Mostrar mais ${Math.min(60, todos.length - mostrados.length)}`);
      mais.type = "button";
      mais.addEventListener("click", () => { estado.limiteLiga += 60; mostrarElenco(); });
      alvo.append(mais);
    }
    return;
  }

  // com busca, procura na liga inteira; sem busca, so o time escolhido
  const times = termo ? r.times : r.times.filter((t) => t.team_id === teamId);
  let achados = 0;
  for (const time of times) {
    let jogadores = termo
      ? time.jogadores.filter((j) => casaComBusca(j, termo))
      : time.jogadores;
    if (estado.posicao !== "todas") jogadores = jogadores.filter((j) => j.posicao === estado.posicao);
    if (!jogadores.length) continue;
    achados += jogadores.length;

    const bloco = el("div", "time");
    bloco.style.setProperty("--cor-time", corOu(time.cor, "#30363d"));
    const titulo = el("h3", "elenco-titulo");
    titulo.append(el("span", "faixa"), el("span", null, time.nome));
    // momento na tabela: G4 ganha +2 e seta pra cima, Z4 perde 2 e seta pra baixo
    if (time.momento > 0) titulo.append(el("span", "elenco-momento momento-alta", "▲ G4"));
    else if (time.momento < 0) titulo.append(el("span", "elenco-momento momento-baixa", "▼ Z4"));
    const comNota = filtrarOrdenar(jogadores.filter((j) => j.overall !== null));
    if (comNota.length) {
      const media = Math.round(comNota.reduce((s, j) => s + j.overall, 0) / comNota.length);
      titulo.append(el("span", "elenco-media", `média ${media}`));
    }
    bloco.append(titulo);

    const corpo = el("div", termo ? "time-corpo so-cards" : "time-corpo");
    if (!termo) corpo.append(campinho(time));
    corpo.append(gradeDeCartas(comNota, r));
    bloco.append(corpo);

    const semNota = jogadores.filter((j) => j.overall === null);
    if (semNota.length) bloco.append(blocoSemNota(semNota, r, Boolean(termo)));
    alvo.append(bloco);
  }
  // na busca, quem saiu da Serie A no meio do ano aparece a parte, com o
  // clube por onde jogou
  for (const time of termo ? r.times : []) {
    const sairam = (time.sairam || []).filter((j) => j.overall !== null && casaComBusca(j, termo));
    if (!sairam.length) continue;
    achados += sairam.length;
    const bloco = el("div", "time");
    bloco.style.setProperty("--cor-time", corOu(time.cor, "#30363d"));
    const titulo = el("h3", "elenco-titulo");
    titulo.append(el("span", "faixa"), el("span", null, `${time.nome} · saiu do clube`));
    bloco.append(titulo);
    const corpo = el("div", "time-corpo so-cards");
    corpo.append(gradeDeCartas(sairam, r));
    bloco.append(corpo);
    alvo.append(bloco);
  }
  if (!achados) alvo.append(el("div", "vazio", termo ? "Ninguém com esse nome nesta temporada. Confere a grafia?" : "Ninguém nesse filtro."));
}

function mostrarNiveis(r) {
  const alvo = document.getElementById("niveis");
  alvo.replaceChildren();
  for (const t of NIVEIS) {
    const n = r.indice.comNota.filter((j) => nivel(j.overall) === t).length;
    const item = el("span", "nivel-chip");
    const amostra = el("i", `nivel-amostra nivel-${t.id}`);
    item.append(amostra, el("b", null, t.nome), el("span", null, `${t.faixa} · ${n}`));
    alvo.append(item);
  }
}

// --- a selecao da temporada (topo da pagina) -------------------------------

// Lateral ou zagueiro? O modelo so sabe "D". O x do jogador na escalacao
// base do proprio time decide: perto da linha lateral e lateral, no meio e
// zagueiro. Quem nao tem posicao registrada pode ocupar qualquer vaga.
function ladoDoDefensor(r) {
  // lado medido de todo jogador (x medio de titular, x alto = direita); a
  // escalacao base, quando tem o jogador, vale por cima
  const x = new Map();
  for (const time of r.times) {
    for (const j of time.jogadores) if (typeof j.x_medio === "number") x.set(j.player_id, j.x_medio);
  }
  for (const time of r.times) {
    for (const p of (time.escalacao_base && time.escalacao_base.posicoes) || []) {
      if (p.player_id) x.set(p.player_id, p.x);
    }
  }
  return x;
}

// 4-3-3 pelo maior overall de cada FUNCAO (desempate: mais minutos): um
// volante, dois meias, dois pontas (cada um no seu lado), um centroavante.
// A funcao sai de onde o jogador atua na escalacao base (ou do perfil dos
// eixos). So entra quem tem nota, entao o piso de minutos ja vale aqui.
// Devolve [{ jogador, time, x, y }] com x e y de 0 a 1 (ataque em y = 1).
function selecaoDaTemporada(r) {
  inferirFuncoes(r); // refaz a cada temporada escolhida
  const ordem = (a, b) => b.overall - a.overall || b.minutos - a.minutos;
  const usados = new Set();
  const pegar = (funcoes, n, filtro = () => true) => {
    const lista = r.indice.comNota.filter((j) => !usados.has(j) && r.indice.ranqueavel(j) && funcoes.includes(FUNCAO.get(j)) && filtro(j)).sort(ordem).slice(0, n);
    lista.forEach((j) => usados.add(j));
    return lista;
  };
  const vaga = (jogador, x, y) => ({ jogador, time: TIME_DE.get(jogador), x, y });
  const xDe = ladoDoDefensor(r);
  const lado = (j) => xDe.get(j.player_id);
  const escalados = [];

  const [goleiro] = pegar(["GOL"], 1);
  if (goleiro) escalados.push(vaga(goleiro, 0.5, 0));

  // laterais: o melhor de cada lado (sem lado registrado, completa onde faltar)
  const lats = r.indice.comNota.filter((j) => FUNCAO.get(j) === "LAT" && r.indice.ranqueavel(j)).sort(ordem);
  let le = lats.find((j) => (lado(j) ?? 0.5) < 0.5), ld = lats.find((j) => j !== le && (lado(j) ?? 0.5) >= 0.5);
  if (!le) le = lats.find((j) => j !== ld);
  if (!ld) ld = lats.find((j) => j !== le);
  for (const [j, x] of [[le, 0.04], [ld, 0.96]]) if (j) { usados.add(j); escalados.push(vaga(j, x, 0.3)); }
  const zags = pegar(["ZAG"], 2);
  if (zags.length < 2) zags.push(...pegar(["LAT"], 2 - zags.length));
  zags.forEach((j, i) => escalados.push(vaga(j, i === 0 ? 0.33 : 0.67, 0.2)));

  // meio: volante na frente da zaga, dois meias abertos um pouco a frente
  const [vol] = pegar(["VOL"], 1).concat(pegar(["MC"], 1));
  if (vol) escalados.push(vaga(vol, 0.5, 0.44));
  const meias = pegar(["MC", "MEI"], 2);
  if (meias.length < 2) meias.push(...pegar(["VOL"], 2 - meias.length));
  meias.forEach((j, i) => escalados.push(vaga(j, i === 0 ? 0.24 : 0.76, 0.6)));

  // ataque: centroavante no meio, pontas pelos lados de onde jogam
  const [ca] = pegar(["CA"], 1);
  if (ca) escalados.push(vaga(ca, 0.5, 0.97));
  const pontas = pegar(["PON"], 2);
  if (pontas.length < 2) pontas.push(...pegar(["CA"], 2 - pontas.length));
  pontas.sort((a, b) => (lado(a) ?? 0.5) - (lado(b) ?? 0.5));
  pontas.forEach((j, i) => escalados.push(vaga(j, i === 0 ? 0.12 : 0.88, 0.86)));
  return escalados;
}

function mostrarSelecao(r) {
  const alvo = document.getElementById("selecao");
  alvo.replaceChildren();
  document.getElementById("selecao-titulo").textContent = `A seleção do Brasileirão ${r.temporada}`;
  const parcial = r.jogos_com_placar < r.jogos_esperados;
  const jogos = parcial
    ? `${r.jogos_com_placar} de ${r.jogos_esperados} jogos na base.`
    : `Temporada completa, ${r.jogos_esperados} jogos.`;
  document.getElementById("selecao-regra").textContent =
    `Sem opinião, só planilha: o maior overall de cada posição, entre quem jogou ${r.piso_minutos}+ minutos. ${jogos}`;

  const escalados = selecaoDaTemporada(r);
  if (!escalados.length) {
    alvo.append(el("figcaption", null, "Ainda não tem jogador com nota nesta temporada."));
    return;
  }
  const campo = gramado(`Seleção do Brasileirão ${r.temporada} no 4-3-3`);
  const topo = 20, fundo = 132;
  for (const { jogador, time, x, y } of escalados) {
    const cx = 13 + x * 74;
    const cy = fundo - y * (fundo - topo);
    const g = svg("g", { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})` });
    desenharNo(g, jogador, time, { clube: true });
    campo.append(g);
  }
  alvo.append(campo);
  alvo.append(el("figcaption", null, "4-3-3. Clica num jogador pra abrir a carta."));
}

// A busca do topo usa a busca da secao de cartas: preenche e rola ate la.
function ligarBuscaDoTopo() {
  const form = document.getElementById("hero-busca");
  const campo = document.getElementById("hero-busca-campo");
  const busca = document.getElementById("busca");
  if (!form || !campo || !busca) return; // a busca do topo saiu; a das cartas segue
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    busca.value = campo.value.trim();
    busca.dispatchEvent(new Event("input"));
    document.getElementById("overalls").scrollIntoView({ behavior: movimentoReduzido ? "auto" : "smooth" });
  });
}

// --- ficha do jogador (radar, barras, comparacao) -------------------------

function chavesDoRadar(jogador) {
  return jogador.posicao === "G" ? ORDEM_GOLEIRO : RADAR_LINHA;
}

// Radar em percentil: aneis em 25/50/75/100. Eixo sem dado fica no centro e
// o rotulo diz "sem dado", para ninguem ler o buraco como nota zero.
function radar(chaves, rotulos, series) {
  const W = 400, H = 310, cx = 200, cy = 158, R = 104;
  const n = chaves.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const ponto = (i, v) => [cx + Math.cos(ang(i)) * R * v / 100, cy + Math.sin(ang(i)) * R * v / 100];
  const raiz = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "radar", role: "img",
    "aria-label": `Radar: ${series.map((s) => s.nome).join(" contra ")}` });
  for (const nivel of [25, 50, 75, 100]) {
    raiz.append(svg("polygon", { class: "radar-anel",
      points: chaves.map((_, i) => ponto(i, nivel).join(",")).join(" ") }));
  }
  chaves.forEach((_, i) => {
    const [x, y] = ponto(i, 100);
    raiz.append(svg("line", { class: "radar-eixo", x1: cx, y1: cy, x2: x, y2: y }));
  });
  for (const serie of series) {
    const pts = chaves.map((c, i) => ponto(i, typeof serie.valores[c] === "number" ? serie.valores[c] : 0));
    raiz.append(svg("polygon", { class: `radar-serie ${serie.classe}`, points: pts.map((p) => p.join(",")).join(" ") }));
    if (serie.pontos) pts.forEach(([x, y]) => raiz.append(svg("circle", { class: `radar-ponto ${serie.classe}`, cx: x, cy: y, r: 3 })));
  }
  const principal = series[series.length - 1];
  chaves.forEach((c, i) => {
    const [x, y] = ponto(i, 122);
    const cos = Math.cos(ang(i));
    const ancora = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
    const t = svg("text", { class: "radar-rotulo", x, y: y + 4, "text-anchor": ancora });
    t.textContent = rotulos[c] || c;
    const v = principal.valores[c];
    const valor = svg("tspan", { class: "radar-valor", x, dy: 14 });
    valor.textContent = typeof v === "number" ? String(v) : "sem dado";
    t.append(valor);
    raiz.append(t);
  });
  return raiz;
}

function barras(chaves, rotulos, jogador, mediana, rival) {
  const lista = el("ul", "barras");
  for (const c of chaves) {
    const v = jogador.eixos[c];
    const li = el("li", typeof v === "number" ? "" : "sem-dado");
    li.append(el("span", "barra-rotulo", rotulos[c] || c));
    const trilho = el("div", "trilho");
    const barra = el("div", "barra");
    barra.style.width = `${typeof v === "number" ? v : 0}%`;
    trilho.append(barra);
    if (rival) {
      const rv = rival.eixos[c];
      const outra = el("div", "barra barra-rival");
      outra.style.width = `${typeof rv === "number" ? rv : 0}%`;
      trilho.append(outra);
    }
    if (typeof mediana[c] === "number") {
      const marca = el("div", "marca-mediana");
      marca.style.left = `${mediana[c]}%`;
      marca.title = `Mediana da posição: ${mediana[c]}`;
      trilho.append(marca);
    }
    li.append(trilho);
    const valor = el("span", "barra-valor", typeof v === "number" ? String(v) : "—");
    if (rival && typeof v === "number" && typeof rival.eixos[c] === "number") {
      const d = v - rival.eixos[c];
      valor.append(el("small", d > 0 ? "mais" : d < 0 ? "menos" : "", d > 0 ? `+${d}` : String(d)));
    }
    li.append(valor);
    lista.append(li);
  }
  return lista;
}

function abrirFicha(jogador, time) {
  const r = estado.r;
  const dialogo = document.getElementById("ficha");
  const alvo = document.getElementById("ficha-conteudo");
  alvo.replaceChildren();

  const ranking = r.indice.porPosicao[jogador.posicao] || [];
  const pos = ranking.indexOf(jogador) + 1;
  const topo = Math.max(1, Math.ceil((pos / ranking.length) * 100));
  const chaves = chavesDoRadar(jogador);
  const mediana = r.indice.mediana[jogador.posicao] || {};

  const lado = el("div", "ficha-carta");
  lado.append(cartaDoJogador(jogador, time, r, { estatica: true }));

  const info = el("div", "ficha-info");
  const cab = el("header", "ficha-cabecalho");
  cab.append(el("p", "ficha-sobre", `${time.nome} · ${POSICAO[jogador.posicao]} · camisa ${jogador.camisa ?? "—"}`));
  const h = el("h2", null, jogador.nome);
  h.id = "ficha-titulo";
  cab.append(h);
  const fatos = el("div", "ficha-fatos");
  fatos.append(
    pos > 0
      ? el("span", "fato fato-destaque", `${pos}º de ${ranking.length} ${PLURAL[jogador.posicao]}`)
      : el("span", "fato fato-destaque", `fora do ranking: menos de ${r.piso_minutos} min`),
    // "top 94%" de quem e 69 de 74 engana: so mostra quando e elogio de verdade
    ...(pos > 0 && topo <= 50 ? [el("span", "fato", `top ${topo}% da posição`)] : []),
    el("span", "fato", `${jogador.jogos} jogos · ${jogador.minutos} min`),
    ...numerosDoJogador(jogador).map(([k, v]) => el("span", "fato", k === "passes_certos_pct" ? `${v}% de passes certos` : `${v} ${NUMEROS[k][1]}`)),
  );
  cab.append(fatos);
  info.append(cab);

  const areaRadar = el("div", "ficha-radar");
  const legenda = el("div", "radar-legenda");
  const areaBarras = el("div", "ficha-barras");

  // comparar so dentro da mesma familia: goleiro com goleiro
  const comparar = el("label", "comparar");
  comparar.append(el("span", null, "Comparar com"));
  const entrada = el("input");
  entrada.type = "search";
  entrada.id = "comparar-busca";
  entrada.placeholder = "nome de outro jogador";
  entrada.autocomplete = "off";
  entrada.setAttribute("list", "comparar-opcoes");
  const opcoes = el("datalist");
  opcoes.id = "comparar-opcoes";
  const porRotulo = new Map();
  for (const j of r.indice.comNota) {
    if (j === jogador || (j.posicao === "G") !== (jogador.posicao === "G")) continue;
    const rotulo = `${j.nome} · ${TIME_DE.get(j).nome} (${j.overall})`;
    porRotulo.set(rotulo, j);
    opcoes.append(new Option(rotulo));
  }
  comparar.append(entrada, opcoes);

  function desenhar(rival) {
    const series = [{ nome: `mediana dos ${PLURAL[jogador.posicao]}`, valores: mediana, classe: "serie-mediana" }];
    if (rival) series.push({ nome: rival.nome, valores: rival.eixos, classe: "serie-rival", pontos: true });
    series.push({ nome: jogador.nome, valores: jogador.eixos, classe: "serie-jogador", pontos: true });
    areaRadar.replaceChildren(radar(chaves, r.eixos, series));
    legenda.replaceChildren();
    for (const s of [...series].reverse()) {
      const item = el("span", `legenda-item ${s.classe}`);
      item.append(el("i"), el("span", null, s.nome));
      legenda.append(item);
    }
    areaBarras.replaceChildren(barras(chaves, r.eixos, jogador, mediana, rival));
  }
  entrada.addEventListener("input", () => {
    const rival = porRotulo.get(entrada.value);
    if (rival) desenhar(rival);
    else if (!entrada.value) desenhar(null);
  });
  desenhar(null);

  const nota = el("p", "ficha-nota",
    "Cada eixo é percentil: 80 quer dizer que ele passa 80% dos jogadores da mesma família. O risco tracejado é a mediana da posição.");
  info.append(areaRadar, legenda, comparar, areaBarras, nota);
  alvo.append(lado, info);

  if (!dialogo.open) dialogo.showModal();
  dialogo.scrollTop = 0;
  try { history.replaceState(null, "", `#jogador-${jogador.player_id}`); } catch (_) { /* moldura sem history */ }
}

function ligarFicha() {
  const dialogo = document.getElementById("ficha");
  document.getElementById("ficha-fechar").addEventListener("click", () => dialogo.close());
  // clique no fundo escuro fecha
  dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });
  dialogo.addEventListener("close", () => {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (_) { /* idem */ }
  });

  const achar = (alvo) => {
    const no = alvo instanceof Element ? alvo.closest("[data-id][data-time]") : null;
    if (!no || !estado.r) return null;
    const time = estado.r.times.find((t) => t.team_id === Number(no.dataset.time));
    const jogador = time && time.jogadores.find((j) => j.player_id === Number(no.dataset.id));
    return jogador ? [jogador, time] : null;
  };
  document.addEventListener("click", (e) => {
    const par = achar(e.target);
    if (par) abrirFicha(...par);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const par = achar(e.target);
    if (!par) return;
    e.preventDefault();
    abrirFicha(...par);
  });
}

// --- vitrine: o envelope de figurinha ---------------------------------------

// Chance fixa por nivel, como envelope de verdade: a maioria sai palha ou
// madeira, grafeno e quase impossivel. Dentro do nivel, qualquer um.
// As chances aparecem na pagina: nada de caixa-preta. O Tem Time em Casa usa as mesmas.
const CHANCES = { palha: 0.5, madeira: 0.4, tijolo: 0.09, grafeno: 0.01 };

function sortear(r) {
  const porNivel = {};
  for (const j of r.indice.comNota) (porNivel[nivel(j.overall).id] ||= []).push(j);
  // nivel sem ninguem na temporada sai do sorteio e as chances se ajustam
  const niveis = Object.keys(CHANCES).filter((id) => porNivel[id]);
  let x = Math.random() * niveis.reduce((s, id) => s + CHANCES[id], 0);
  let escolhido = niveis[niveis.length - 1];
  for (const id of niveis) {
    x -= CHANCES[id];
    if (x <= 0) { escolhido = id; break; }
  }
  const grupo = porNivel[escolhido];
  return grupo[Math.floor(Math.random() * grupo.length)];
}

function textoDasChances() {
  const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return NIVEIS.map((t) => `${t.nome} ${pct(CHANCES[t.id])}`).join(" · ");
}

function montarEnvelope(temporada) {
  const envelope = el("button", "envelope");
  envelope.type = "button";
  envelope.setAttribute("aria-label", "Rasgar o envelope");
  const aba = el("div", "envelope-aba");
  aba.append(el("span", null, "rasgue aqui"));
  const logo = el("img");
  logo.src = "img/simbolo.svg";
  logo.alt = "";
  const marcas = el("div", "envelope-cliques");
  for (let i = 0; i < 3; i++) marcas.append(el("i"));
  envelope.append(aba, logo,
    el("span", "envelope-titulo", "Figurinha"),
    el("span", "envelope-marca", `Tem dado em casa · ${temporada}`),
    marcas);
  return envelope;
}

const FALAS = {
  grafeno: "CASA DE CONCRETO! Essa quase ninguém tira.",
  tijolo: "Casa de tijolo! O lobo não derruba essa.",
  madeira: "Casa de madeira. Aguenta um sopro.",
  palha: "Casa de palha. O lobo sopra e leva.",
};

// O envelope mora num dialogo aberto pelo link do topo e sorteia da
// temporada escolhida na secao de cartas. Tres cliques pra abrir:
// 1) treme, 2) a aba solta e o brilho entrega a cor do nivel (a pista),
// 3) rasga e revela.
function iniciarVitrine() {
  const dialogo = document.getElementById("vitrine-dialogo");
  const palco = document.getElementById("palco");
  const legenda = document.getElementById("vitrine-legenda");
  const chances = document.getElementById("chances");
  const botao = document.getElementById("abrir-envelope");
  const link = document.getElementById("abrir-vitrine");

  const novoEnvelope = () => {
    const r = estado.r;
    const jogador = sortear(r);
    const time = TIME_DE.get(jogador);
    const t = nivel(jogador.overall);
    const envelope = montarEnvelope(r.temporada);
    palco.className = "palco";
    palco.replaceChildren(envelope);
    legenda.textContent = "Clica no envelope pra rasgar.";
    chances.textContent = `Chances: ${textoDasChances()}`;
    botao.hidden = true;
    let cliques = 0;
    envelope.addEventListener("click", async () => {
      if (cliques >= 3) return;
      cliques += 1;
      envelope.dataset.cliques = String(cliques);
      envelope.classList.remove("tremendo");
      void envelope.offsetWidth; // reinicia a animacao a cada clique
      envelope.classList.add("tremendo");
      if (cliques === 1) legenda.textContent = "Mais forte…";
      if (cliques === 2) {
        palco.className = `palco nivel-${t.id} pista`;
        legenda.textContent = t.id === "grafeno" || t.id === "tijolo" ? "Opa… esse brilho…" : "Último puxão.";
      }
      if (cliques < 3) return;
      envelope.classList.add("rasgando");
      palco.classList.add("clarao");
      await espera(movimentoReduzido ? 0 : 450);
      const carta = cartaDoJogador(jogador, time, r);
      carta.classList.add("revelando");
      palco.replaceChildren(carta);
      legenda.textContent = `${jogador.nome} (${time.nome}), ${jogador.overall} ${SIGLA[jogador.posicao]}. ${FALAS[t.id]}`;
      await espera(movimentoReduzido ? 0 : 1400);
      palco.classList.remove("clarao", "pista");
      botao.hidden = false;
      botao.textContent = "Abrir outro envelope";
    });
    envelope.focus({ preventScroll: true });
  };

  link.hidden = false;
  link.addEventListener("click", () => {
    if (!estado.r || !estado.r.indice.comNota.length) return;
    dialogo.showModal();
    novoEnvelope();
  });
  document.getElementById("vitrine-fechar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });
  botao.addEventListener("click", novoEnvelope);
}

// --- controles ------------------------------------------------------------

// "Sao Paulo" acha "são paulo", "gremio" acha "Grêmio"
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

// Escolha de time pesquisavel. O <select id="time"> escondido continua sendo
// a fonte do valor (o resto da pagina le dele); este combobox so escreve nele
// e dispara "change". Teclado: setas andam, Enter escolhe, Esc desiste.
function ligarComboDeTimes() {
  const select = document.getElementById("time");
  const entrada = document.getElementById("time-busca");
  const lista = document.getElementById("time-lista");
  let visiveis = [];
  let ativo = -1;

  const nomeAtual = () => (select.selectedOptions[0] ? select.selectedOptions[0].text : "");
  const corDe = (teamId) => {
    const time = estado.r && estado.r.times.find((t) => t.team_id === teamId);
    return time ? corDoClube(time) : "#30363d";
  };

  function marcar(i) {
    ativo = i;
    visiveis.forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
    if (i >= 0) {
      entrada.setAttribute("aria-activedescendant", visiveis[i].id);
      visiveis[i].scrollIntoView({ block: "nearest" });
    } else {
      entrada.removeAttribute("aria-activedescendant");
    }
  }

  function filtrar(termo) {
    const t = semAcento(termo.trim());
    lista.replaceChildren();
    visiveis = [];
    for (const opcao of select.options) {
      if (t && !semAcento(opcao.text).includes(t)) continue;
      const li = el("li", "combo-opcao");
      li.id = `time-opcao-${opcao.value}`;
      li.setAttribute("role", "option");
      li.dataset.valor = opcao.value;
      const bolinha = el("i", "combo-cor");
      bolinha.style.background = corDe(Number(opcao.value));
      li.append(bolinha, el("span", null, opcao.text));
      if (opcao.value === select.value) li.classList.add("atual");
      lista.append(li);
      visiveis.push(li);
    }
    if (!visiveis.length) lista.append(el("li", "combo-vazio", "Nenhum time com esse nome."));
    const atual = visiveis.findIndex((li) => li.dataset.valor === select.value);
    marcar(t ? (visiveis.length ? 0 : -1) : atual);
  }

  function abrir() {
    if (entrada.disabled) return;
    filtrar("");
    lista.hidden = false;
    entrada.setAttribute("aria-expanded", "true");
  }

  function fechar() {
    lista.hidden = true;
    entrada.setAttribute("aria-expanded", "false");
    entrada.removeAttribute("aria-activedescendant");
    entrada.value = nomeAtual();
  }

  function escolher(valor) {
    if (valor !== select.value) {
      select.value = valor;
      select.dispatchEvent(new Event("change"));
    }
    fechar();
  }

  entrada.addEventListener("focus", () => { abrir(); entrada.select(); });
  entrada.addEventListener("click", () => { if (lista.hidden) abrir(); });
  entrada.addEventListener("input", () => {
    if (lista.hidden) { lista.hidden = false; entrada.setAttribute("aria-expanded", "true"); }
    filtrar(entrada.value);
  });
  entrada.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (lista.hidden) { abrir(); return; }
      if (!visiveis.length) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      marcar((ativo + passo + visiveis.length) % visiveis.length);
    } else if (e.key === "Enter") {
      if (lista.hidden) return;
      e.preventDefault();
      if (ativo >= 0) escolher(visiveis[ativo].dataset.valor);
    } else if (e.key === "Escape") {
      if (!lista.hidden) { e.preventDefault(); fechar(); entrada.select(); }
    }
  });
  // mousedown, nao click: o click viria depois do blur, com a lista ja fechada
  lista.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const li = e.target instanceof Element ? e.target.closest(".combo-opcao") : null;
    if (li) escolher(li.dataset.valor);
  });
  entrada.addEventListener("blur", fechar);

  // o select muda por fora (troca de temporada): o texto acompanha
  return { sincronizar: () => { if (lista.hidden) entrada.value = nomeAtual(); } };
}

function ligarChips(seletor, chave, aoMudar) {
  const botoes = document.querySelectorAll(seletor);
  for (const b of botoes) {
    b.addEventListener("click", () => {
      for (const o of botoes) o.setAttribute("aria-pressed", String(o === b));
      estado[chave] = b.dataset.valor;
      aoMudar();
    });
  }
}

// --- abertura: os dois minigames ---------------------------------------------

// Tem Time em Casa: um leque com tres cartas reais (as melhores de posicoes diferentes).
// Carreira: a sua carta crescendo, de casa de palha aos 16 a casa de concreto aos 29.
function mostrarAbertura(r) {
  const vd = document.getElementById("visual-draft"), vc = document.getElementById("visual-carreira");
  if (!vd || !vc) return;
  // leque do tecnico: sempre os melhores da liga, girando a cada poucos segundos
  // (um meia, um atacante e um defensor por vez, sem repetir ate dar a volta)
  const topo = (p, n) => (r.indice.porPosicao[p] || []).slice(0, n);
  const pools = { M: topo("M", 8), F: topo("F", 8), D: topo("D", 8) };
  let giro = Math.floor(Math.random() * 8);
  const trio = () => ["M", "F", "D"].map((p) => pools[p][(giro + (p === "F" ? 3 : p === "D" ? 5 : 0)) % Math.max(1, pools[p].length)]).filter(Boolean);
  const desenharLeque = () => {
    vd.replaceChildren(...trio().map((j, i) => {
      const w = el("div", `leque-carta leque-${i}`);
      w.append(cartaDoJogador(j, TIME_DE.get(j), r, { estatica: true }));
      return w;
    }));
  };
  desenharLeque();
  clearInterval(mostrarAbertura.timer);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mostrarAbertura.timer = setInterval(() => {
      if (document.hidden) return;
      vd.classList.add("trocando");
      setTimeout(() => { giro += 1; desenharLeque(); vd.classList.remove("trocando"); }, 350);
    }, 3800);
  }
  const c = r.cortes || {};
  const ovrs = [(c.madeira ?? 65) - 4, (c.tijolo ?? 75) + 2, Math.min(97, (c.grafeno ?? 82) + 4)];
  const etapas = [
    ["16 anos · Série D", { nome: "Série D", kit: { padrao: "lisa", base: "#1f8f4e", numero: "#ffffff" } }],
    ["22 anos · Série A", { nome: "Bahia" }],
    ["29 anos · Europa", { nome: "Europa", kit: { padrao: "lisa", base: "#f2f2f2", numero: "#1b2a5c", gola: "#1b2a5c" } }],
  ];
  const reais = r.indice.porPosicao.F || [];
  vc.replaceChildren(...etapas.map(([rotulo, time], i) => {
    const o = ovrs[i];
    const voce = { nome: "Você", overall: o, posicao: "F", camisa: 10, jogos: [18, 204, 412][i], minutos: 0, player_id: -1 - i,
      eixos: { RIT: o - 2, FIN: Math.min(99, o + 4), PAS: o - 9, DRI: o - 1, DEF: 32, FIS: o - 4 } };
    const rFalso = { eixos: r.eixos, indice: { porPosicao: { F: [...reais, voce].sort((a, b) => b.overall - a.overall) } } };
    const w = el("div", `evolucao-carta evolucao-${i}`);
    w.append(cartaDoJogador(voce, time, rFalso, { estatica: true }), el("span", "evolucao-rotulo", rotulo));
    return w;
  }));
}

async function iniciarOveralls() {
  const selTemporada = document.getElementById("temporada");
  const selTime = document.getElementById("time");
  const selOrdem = document.getElementById("ordem");
  const busca = document.getElementById("busca");
  const nota = document.getElementById("nota-retrato");

  // uniforme e enfeite: se o arquivo faltar, as camisas saem lisas
  UNIFORMES = await json("dados/uniformes.json").catch(() => ({}));
  const anos = await json("dados/temporadas.json");
  for (const ano of anos) selTemporada.append(new Option(String(ano), String(ano)));

  const combo = ligarComboDeTimes();
  const buscaTime = document.getElementById("time-busca");
  const sincronizarVisao = () => {
    buscaTime.disabled = estado.visao === "liga";
    document.getElementById("campo-time").classList.toggle("desligado", estado.visao === "liga");
  };

  async function trocarTemporada() {
    const r = await retrato(selTemporada.value);
    estado.r = r;
    usarCortes(r);
    const anterior = Number(selTime.value);
    selTime.replaceChildren(...r.times.map((t) => new Option(t.nome, String(t.team_id))));
    if (r.times.some((t) => t.team_id === anterior)) selTime.value = String(anterior);
    combo.sincronizar();
    nota.textContent = notaDoRetrato(r);
    mostrarNiveis(r);
    mostrarSelecao(r);
    mostrarElenco();
    return r;
  }

  const primeiro = await trocarTemporada();
  mostrarAbertura(primeiro);
  iniciarVitrine();
  ligarBuscaDoTopo();
  selTemporada.addEventListener("change", trocarTemporada);
  selTime.addEventListener("change", mostrarElenco);
  selOrdem.addEventListener("change", () => { estado.ordem = selOrdem.value; mostrarElenco(); });
  busca.addEventListener("input", mostrarElenco);
  ligarChips("[data-grupo='visao']", "visao", () => { estado.limiteLiga = 60; sincronizarVisao(); mostrarElenco(); });
  ligarChips("[data-grupo='posicao']", "posicao", () => { estado.limiteLiga = 60; mostrarElenco(); });
  sincronizarVisao();

  // link direto pra uma carta: .../#jogador-123 (vai na descricao do video)
  const alvo = /^#jogador-(\d+)$/.exec(location.hash);
  if (alvo) {
    const jogador = primeiro.indice.todos.find((j) => j.player_id === Number(alvo[1]) && j.overall !== null);
    if (jogador) abrirFicha(jogador, TIME_DE.get(jogador));
  }
}

function falha(idAlvo, mensagem) {
  const alvo = document.getElementById(idAlvo);
  alvo.replaceChildren(el("div", "vazio", mensagem));
}

// Este arquivo tambem e carregado pelo tem-time-em-casa.html (que reaproveita carta,
// camisa, niveis e CHANCES): cada parte so liga se a pagina tiver o pedaco dela.
ligarInclinacao();
if (document.getElementById("ficha")) ligarFicha();

if (document.getElementById("lista-videos")) {
  json("dados/videos.json")
    .then(mostrarVideos)
    .catch(() => falha("lista-videos", "Os vídeos não carregaram agora. Tenta de novo daqui a pouco."));
}

if (document.getElementById("elenco")) {
  iniciarOveralls().catch((erro) => {
    console.error(erro);
    falha("elenco", "As cartas não carregaram agora. Tenta de novo daqui a pouco.");
  });
}
