// Modo Carreira: cria um jogador, monta a carta e joga a carreira inteira,
// dos 16 anos (estreia na Serie B, C ou D) ate a aposentadoria. Reaproveita do app.js a carta, a camisa,
// os niveis e a funcao de cada jogador real; do motor.js, a simulacao.
// Os titulares que voce disputa sao os jogadores reais do retrato 2026.
"use strict";

// --- tabelas do jogo ------------------------------------------------------------

// Vagas do campinho de criacao: funcao (pra disputar vaga com os reais),
// familia G/D/M/F (a carta e o ranking) e onde fica no desenho.
const POSICOES = {
  GOL: { funcao: "GOL", fam: "G", nome: "Goleiro", x: 50, y: 90 },
  ZAG: { funcao: "ZAG", fam: "D", nome: "Zagueiro", x: 50, y: 73 },
  LE: { funcao: "LAT", fam: "D", nome: "Lateral-esquerdo", x: 14, y: 65 },
  LD: { funcao: "LAT", fam: "D", nome: "Lateral-direito", x: 86, y: 65 },
  VOL: { funcao: "VOL", fam: "M", nome: "Volante", x: 50, y: 58 },
  MC: { funcao: "MC", fam: "M", nome: "Meio-campista", x: 50, y: 45 },
  ME: { funcao: "PON", fam: "M", nome: "Meia pela esquerda", x: 14, y: 42 },
  MD: { funcao: "PON", fam: "M", nome: "Meia pela direita", x: 86, y: 42 },
  MEI: { funcao: "MEI", fam: "M", nome: "Meia", x: 50, y: 31 },
  PE: { funcao: "PON", fam: "F", nome: "Ponta-esquerda", x: 16, y: 18 },
  PD: { funcao: "PON", fam: "F", nome: "Ponta-direita", x: 84, y: 18 },
  CA: { funcao: "CA", fam: "F", nome: "Centroavante", x: 50, y: 11 },
};

// Carta base de um garoto de 16 anos em cada funcao (escala do v2), e o peso
// de cada atributo no OVR. Chute calibrado a mao; depois vira metrica do futdata.
const BASE = {
  CA: { RIT: 58, FIN: 62, PAS: 45, DRI: 52, DEF: 25, FIS: 60 },
  PON: { RIT: 64, FIN: 54, PAS: 50, DRI: 62, DEF: 28, FIS: 48 },
  MEI: { RIT: 54, FIN: 54, PAS: 62, DRI: 60, DEF: 35, FIS: 46 },
  MC: { RIT: 52, FIN: 48, PAS: 60, DRI: 54, DEF: 50, FIS: 55 },
  VOL: { RIT: 50, FIN: 40, PAS: 56, DRI: 46, DEF: 60, FIS: 62 },
  LAT: { RIT: 62, FIN: 38, PAS: 54, DRI: 52, DEF: 56, FIS: 54 },
  ZAG: { RIT: 48, FIN: 30, PAS: 46, DRI: 36, DEF: 62, FIS: 64 },
  GOL: { REF: 60, EVI: 55, MAO: 58, PES: 45, SAI: 52 },
};
const PESOS = {
  CA: { FIN: 0.35, FIS: 0.15, RIT: 0.15, DRI: 0.15, PAS: 0.15, DEF: 0.05 },
  PON: { RIT: 0.25, DRI: 0.25, FIN: 0.2, PAS: 0.2, FIS: 0.05, DEF: 0.05 },
  MEI: { PAS: 0.3, DRI: 0.25, FIN: 0.15, RIT: 0.1, FIS: 0.1, DEF: 0.1 },
  MC: { PAS: 0.3, DEF: 0.2, FIS: 0.15, DRI: 0.15, RIT: 0.1, FIN: 0.1 },
  VOL: { DEF: 0.35, PAS: 0.25, FIS: 0.2, RIT: 0.1, DRI: 0.05, FIN: 0.05 },
  LAT: { RIT: 0.25, DEF: 0.25, PAS: 0.2, FIS: 0.15, DRI: 0.1, FIN: 0.05 },
  ZAG: { DEF: 0.4, FIS: 0.3, PAS: 0.15, RIT: 0.1, DRI: 0.05, FIN: 0 },
  GOL: { REF: 0.3, EVI: 0.25, MAO: 0.2, SAI: 0.15, PES: 0.1 },
};
const PONTOS_INICIAIS = 30, PASSO = 5, MAX_POR_ATRIBUTO = 15;

// gol e assistencia por jogo de um titular medio em cada funcao
const TAXA_GOL = { CA: 0.42, PON: 0.26, MEI: 0.2, MC: 0.09, VOL: 0.05, LAT: 0.04, ZAG: 0.05, GOL: 0 };
const TAXA_ASSIST = { MEI: 0.24, PON: 0.2, MC: 0.14, CA: 0.11, LAT: 0.12, VOL: 0.07, ZAG: 0.03, GOL: 0.005 };

// Selecao: corte de OVR pra ser convocado e chance de titulo numa Copa.
// Cores so pra bandeirinha e camisa (sem escudo).
const PAISES = [
  ["BRA", "Brasil", ["#009c3b", "#ffdf00", "#002776"], { padrao: "lisa", base: "#ffdf00", numero: "#00843d", gola: "#00843d" }, 80, 0.17],
  ["ARG", "Argentina", ["#75aadb", "#ffffff", "#75aadb"], { padrao: "vertical", faixas: [["#75aadb", 7], ["#ffffff", 7]], numero: "#111111" }, 80, 0.17],
  ["URU", "Uruguai", ["#7ab8e8", "#ffffff", "#7ab8e8"], { padrao: "lisa", base: "#7ab8e8", numero: "#111111" }, 75, 0.04],
  ["COL", "Colômbia", ["#fcd116", "#003893", "#ce1126"], { padrao: "lisa", base: "#fcd116", numero: "#003893" }, 75, 0.03],
  ["CHI", "Chile", ["#d52b1e", "#ffffff", "#0039a6"], { padrao: "lisa", base: "#d52b1e", numero: "#ffffff" }, 72, 0.01],
  ["PAR", "Paraguai", ["#d52b1e", "#ffffff", "#0038a8"], { padrao: "vertical", faixas: [["#d52b1e", 7], ["#ffffff", 7]], numero: "#0038a8" }, 72, 0.01],
  ["EQU", "Equador", ["#ffdd00", "#034ea2", "#ed1c24"], { padrao: "lisa", base: "#ffdd00", numero: "#034ea2" }, 72, 0.01],
  ["PER", "Peru", ["#ffffff", "#d91023", "#ffffff"], { padrao: "diagonal", base: "#ffffff", faixa: "#d91023", largura: 14, numero: "#111111" }, 70, 0.01],
  ["VEN", "Venezuela", ["#ffcc00", "#00247d", "#cf142b"], { padrao: "lisa", base: "#7a1f36", numero: "#ffffff" }, 70, 0.005],
  ["BOL", "Bolívia", ["#d52b1e", "#f9e300", "#007934"], { padrao: "lisa", base: "#007934", numero: "#ffffff" }, 68, 0.003],
  ["MEX", "México", ["#006847", "#ffffff", "#ce1126"], { padrao: "lisa", base: "#006847", numero: "#ffffff" }, 74, 0.02],
  ["EUA", "Estados Unidos", ["#b22234", "#ffffff", "#3c3b6e"], { padrao: "lisa", base: "#ffffff", numero: "#3c3b6e" }, 73, 0.02],
  ["POR", "Portugal", ["#006600", "#ff0000", "#ff0000"], { padrao: "lisa", base: "#c8102e", numero: "#ffffff" }, 78, 0.08],
  ["ESP", "Espanha", ["#aa151b", "#f1bf00", "#aa151b"], { padrao: "lisa", base: "#c60b1e", numero: "#f1bf00" }, 80, 0.14],
  ["FRA", "França", ["#002395", "#ffffff", "#ed2939"], { padrao: "lisa", base: "#1b2a5c", numero: "#ffffff" }, 81, 0.16],
  ["ING", "Inglaterra", ["#ffffff", "#ce1124", "#ffffff"], { padrao: "lisa", base: "#ffffff", numero: "#1b2a5c" }, 80, 0.12],
  ["ALE", "Alemanha", ["#000000", "#dd0000", "#ffce00"], { padrao: "lisa", base: "#ffffff", numero: "#111111" }, 79, 0.1],
  ["ITA", "Itália", ["#009246", "#ffffff", "#ce2b37"], { padrao: "lisa", base: "#0066b3", numero: "#ffffff" }, 78, 0.06],
  ["HOL", "Holanda", ["#ae1c28", "#ffffff", "#21468b"], { padrao: "lisa", base: "#f36c21", numero: "#111111" }, 78, 0.06],
  ["BEL", "Bélgica", ["#000000", "#fdda24", "#ef3340"], { padrao: "lisa", base: "#c8102e", numero: "#fdda24" }, 76, 0.04],
  ["CRO", "Croácia", ["#ff0000", "#ffffff", "#171796"], { padrao: "lisa", base: "#ffffff", numero: "#d0102a" }, 76, 0.03],
  ["MAR", "Marrocos", ["#c1272d", "#006233", "#c1272d"], { padrao: "lisa", base: "#c1272d", numero: "#ffffff" }, 75, 0.03],
  ["JAP", "Japão", ["#ffffff", "#bc002d", "#ffffff"], { padrao: "lisa", base: "#1b3a8f", numero: "#ffffff" }, 74, 0.02],
  ["COR", "Coreia do Sul", ["#ffffff", "#cd2e3a", "#0047a0"], { padrao: "lisa", base: "#d0102a", numero: "#ffffff" }, 73, 0.01],
].map(([id, nome, cores, kit, corte, copa]) => ({ id, nome, cores, kit, corte, copa }));
const SUL_AMERICANOS = ["BRA", "ARG", "URU", "COL", "CHI", "PAR", "EQU", "PER", "VEN", "BOL"];

const COPA_NACIONAL = { eng: "FA Cup", esp: "Copa do Rei", ita: "Coppa Italia", ale: "DFB-Pokal", fra: "Copa da França", por: "Taça de Portugal", hol: "Copa da Holanda", arg: "Copa Argentina", ara: "Copa do Rei Saudita", rus: "Copa da Rússia" };
const ANO_INICIAL = 2026, IDADE_INICIAL = 16;
const DIVISOES = ["A", "B", "C", "D"];
const PRESTIGIO_DIV = { A: 3, B: 1.5, C: 0.7, D: 0.2 };
const MIN_POR_TEMPORADA = { A: 38, B: 38, C: 22, D: 18 };

// --- estado ------------------------------------------------------------------------

const C = {
  r: null, regras: null, exterior: null,
  // criacao
  nome: "", numero: 10, pais: "BRA", pe: "Direito", pos: "CA", modo: "rapido",
  // carta
  attrs: null, gastos: {}, pontos: PONTOS_INICIAIS,
  // carreira
  J: null, rng: Math.random, nivelDeForca: null, tabelaAnterior: null, nivelMedioA: 0, forcaReal: {},
  // divisoes de baixo: nomes por divisao, dados de cada clube, quem da B/C/D
  // esta na Serie A agora (naA) e quem da Serie A real caiu (fora)
  inferiores: null, div: null, inf: null, naA: null, fora: null,
};

const $ = (id) => document.getElementById(id);
const paisDe = (id) => PAISES.find((p) => p.id === id) || PAISES[0];
const dinheiro = (m) => (m >= 1 ? `€${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : `€${Math.round(m * 1000)} mil`);
const normal = (rng, dp = 1) => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return dp * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const logistica = (x) => 1 / (1 + Math.exp(-x));

function mostrarTela(tela) {
  for (const t of ["criar", "carta", "base", "carreira", "fim"]) $(`tela-${t}`).hidden = t !== tela;
  for (const li of $("passos").children) {
    const alvo = { criar: "criar", carta: "carta", base: "carta", carreira: "carreira", fim: "carreira" }[tela];
    if (li.dataset.passo === alvo) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  }
  document.querySelector(".draft-cabecalho").classList.toggle("compacto", tela !== "criar");
  window.scrollTo({ top: 0, behavior: movimentoReduzido ? "auto" : "smooth" });
}

// --- OVR e a carta do jogador criado --------------------------------------------

const funcaoDe = (pos) => POSICOES[pos].funcao;
function ovrDe(attrs, funcao) {
  const pesos = PESOS[funcao];
  return Math.round(Object.entries(pesos).reduce((s, [k, w]) => s + w * (attrs[k] ?? 0), 0));
}

// camisa do clube atual; sem clube, a da selecao
function timeParaCamisa(clube) {
  if (!clube) { const p = paisDe(C.pais); return { nome: p.nome, kit: p.kit }; }
  if (clube.time) return clube.time;
  return { nome: clube.nome, kit: clube.kit };
}
const daLiga = (liga) => (liga === "Brasileirão" ? "do Brasileirão" : `da ${liga}`);

// A carta e a mesma do site. O ranking do rodape mostra onde o seu OVR
// entraria entre os reais da mesma familia de posicao no Brasileirao 2026.
function cartaDoCriado(attrs, ovr, clube, { jogos = 0, minutos = 0 } = {}) {
  const fam = POSICOES[C.pos].fam;
  const jogador = {
    nome: C.nome || "Seu nome", overall: ovr, posicao: fam, eixos: attrs, camisa: C.numero,
    jogos, minutos, player_id: -1,
  };
  const reais = C.r.indice.porPosicao[fam] || [];
  const grupo = [...reais, jogador].sort((a, b) => b.overall - a.overall);
  const rFalso = { eixos: C.r.eixos, indice: { porPosicao: { [fam]: grupo } } };
  return cartaDoJogador(jogador, timeParaCamisa(clube), rFalso, { estatica: true });
}

// camisa vista de costas: nome em cima do numero
function camisaDeCostas(kit, nome, numero) {
  const s = figura({ nome: "costas", kit }, numero, { cabeca: false });
  const cor = corDoNumero(kit);
  const t = svg("text", {
    x: 50, y: 60, "text-anchor": "middle", "font-size": nome.length > 10 ? 6.5 : 8, "font-weight": 800,
    "letter-spacing": 0.6, fill: cor, "font-family": "'Barlow Condensed', Inter, sans-serif",
    stroke: luminancia(cor) > 0.4 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)", "stroke-width": 1, "paint-order": "stroke",
  });
  t.textContent = (nome || "SOBRENOME").toUpperCase();
  s.append(t);
  return s;
}

// --- 1. criacao ------------------------------------------------------------------------

function bandeira(p) {
  const b = el("span", "bandeira");
  b.style.background = `linear-gradient(180deg, ${p.cores[0]} 0 33%, ${p.cores[1]} 33% 67%, ${p.cores[2]} 67%)`;
  return b;
}

function atualizarPreviaCamisa() {
  const p = paisDe(C.pais);
  $("previa-costas").replaceChildren(camisaDeCostas(p.kit, C.nome, C.numero));
  $("previa-frente").replaceChildren(figura({ nome: p.nome, kit: p.kit }, C.numero, { cabeca: false }));
}

function montarPaises() {
  const alvo = $("paises");
  const termo = semAcento($("busca-pais").value.trim());
  alvo.replaceChildren();
  for (const p of PAISES) {
    if (termo && !semAcento(p.nome).includes(termo)) continue;
    const b = el("button", `pais${p.id === C.pais ? " ativo" : ""}`);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(p.id === C.pais));
    b.append(bandeira(p), el("span", null, p.nome));
    b.addEventListener("click", () => { C.pais = p.id; montarPaises(); atualizarPreviaCamisa(); });
    alvo.append(b);
  }
  if (!alvo.children.length) alvo.append(el("p", "nota", "Nenhum país com esse nome."));
}

function montarCampoPosicoes() {
  const alvo = $("campo-posicoes");
  alvo.replaceChildren();
  for (const [id, p] of Object.entries(POSICOES)) {
    const b = el("button", `pos-botao${id === C.pos ? " ativo" : ""}`, id);
    b.type = "button";
    b.style.left = `${p.x}%`;
    b.style.top = `${p.y}%`;
    b.title = p.nome;
    b.setAttribute("aria-pressed", String(id === C.pos));
    b.addEventListener("click", () => { C.pos = id; montarCampoPosicoes(); });
    alvo.append(b);
  }
  $("pos-nome").textContent = POSICOES[C.pos].nome;
}

// --- 2. montagem da carta ------------------------------------------------------------

function iniciarCarta() {
  const f = funcaoDe(C.pos);
  C.attrs = { ...BASE[f] };
  C.gastos = {};
  C.pontos = PONTOS_INICIAIS;
  desenharMontagem();
}

function desenharMontagem() {
  const f = funcaoDe(C.pos);
  const ovr = ovrDe(C.attrs, f);
  $("carta-montagem").replaceChildren(cartaDoCriado(C.attrs, ovr, null));
  $("pontos-restantes").textContent = String(C.pontos);
  $("ovr-montagem").textContent = String(ovr);
  const lista = $("atributos");
  lista.replaceChildren();
  const rotulos = f === "GOL" ? Object.fromEntries(EIXOS_GOLEIRO.map(([c, s]) => [c, C.r.eixos[c] || s])) : ROTULOS_LINHA;
  const ordem = Object.entries(PESOS[f]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  for (const k of ordem) {
    const gasto = C.gastos[k] || 0;
    const li = el("li", "atributo");
    const peso = el("span", "atributo-peso", PESOS[f][k] >= 0.2 ? "chave" : PESOS[f][k] >= 0.1 ? "" : "pouco pesa");
    const nome = el("span", "atributo-nome", rotulos[k] || k);
    const barra = el("div", "atributo-trilho");
    const base = el("i", "atributo-base"); base.style.width = `${BASE[f][k]}%`;
    const extra = el("i", "atributo-extra"); extra.style.left = `${BASE[f][k]}%`; extra.style.width = `${gasto}%`;
    barra.append(base, extra);
    const menos = el("button", "botao atributo-menos", "−"); menos.type = "button";
    menos.disabled = gasto <= 0;
    menos.setAttribute("aria-label", `Tirar ${PASSO} de ${rotulos[k] || k}`);
    const mais = el("button", "botao atributo-mais", `+${PASSO}`); mais.type = "button";
    mais.disabled = C.pontos < PASSO || gasto >= MAX_POR_ATRIBUTO;
    mais.setAttribute("aria-label", `Somar ${PASSO} em ${rotulos[k] || k}`);
    menos.addEventListener("click", () => { C.gastos[k] = gasto - PASSO; C.attrs[k] -= PASSO; C.pontos += PASSO; desenharMontagem(); });
    mais.addEventListener("click", () => { C.gastos[k] = gasto + PASSO; C.attrs[k] += PASSO; C.pontos -= PASSO; desenharMontagem(); });
    li.append(nome, peso, barra, el("b", "atributo-valor", String(C.attrs[k])), menos, mais);
    lista.append(li);
  }
  $("confirmar-carta").disabled = C.pontos > 0;
  $("confirmar-carta").textContent = C.pontos > 0 ? `Distribua ${C.pontos} pontos` : "Fechar a carta";
}

// --- regua: forca do clube -> nivel do titular -------------------------------------

// Pros clubes de fora nao temos elenco: o nivel do titular sai da forca do
// clube pela mesma relacao que a Serie A 2026 tem entre forca e o OVR do onze.
function calibrarNivel() {
  const times = Motor.timesDaSerieA(C.r);
  const pts = Object.values(times).map((t) => {
    const onze = t.onze.filter((j) => j.overall !== null).map((j) => j.overall);
    return [(t.atq + t.def) / 2, onze.reduce((a, b) => a + b, 0) / onze.length];
  });
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // A reta da Serie A sozinha estica demais nas pontas (Serie D viraria 30,
  // Real Madrid 95). Entao: ancora no meio da Serie A e curva mais deitada
  // pra baixo (divisoes de acesso) e pra cima (elite europeia).
  const ancoras = [[30, my - 24], [40, my - 14], [48, my - 7], [mx, my], [62, my + 7], [68, my + 15]];
  C.nivelDeForca = (forca) => {
    if (forca <= ancoras[0][0]) return ancoras[0][1] - (ancoras[0][0] - forca);
    for (let i = 1; i < ancoras.length; i++) {
      const [x0, y0] = ancoras[i - 1], [x1, y1] = ancoras[i];
      if (forca <= x1) return y0 + (y1 - y0) * (forca - x0) / (x1 - x0);
    }
    const [xn, yn] = ancoras[ancoras.length - 1];
    return yn + (forca - xn);
  };
  C.nivelMedioA = my;
  for (const t of Object.values(times)) C.forcaReal[t.id] = (t.atq + t.def) / 2;
}

// --- divisoes: quem esta onde --------------------------------------------------------

function reiniciarMundo() {
  C.div = {}; C.inf = new Map(); C.naA = new Set(); C.fora = new Set();
  for (const d of C.inferiores.divisoes) {
    C.div[d.id] = d.clubes.map((c) => c.nome);
    for (const c of d.clubes) C.inf.set(c.nome, { nome: c.nome, uf: c.uf, forca: c.forca, uniforme: c.uniforme, time: null });
  }
}

// clube real da Serie A que caiu vira clube de divisao de baixo (com o elenco real)
function garantirInferior(nome) {
  if (C.inf.has(nome)) return;
  const t = C.r.times.find((x) => x.nome === nome);
  C.inf.set(nome, { nome, uf: "", forca: (C.forcaReal[nome] ?? 50) - 1, uniforme: null, time: t || null });
}

function divisaoDe(nome) {
  if (C.naA.has(nome)) return "A";
  for (const d of ["B", "C", "D"]) if (C.div[d].includes(nome)) return d;
  return C.forcaReal[nome] !== undefined && !C.fora.has(nome) ? "A" : null;
}

const forcaNoMundo = (nome) => (C.inf.has(nome) && (C.naA.has(nome) || C.fora.has(nome) || !(nome in C.forcaReal)) ? C.inf.get(nome).forca : C.forcaReal[nome]);
const tirar = (lista, nome) => { const i = lista.indexOf(nome); if (i >= 0) lista.splice(i, 1); };

// Serie A de agora: os 20 reais menos quem caiu, mais quem subiu
function idsDaSerieA() {
  return [...Object.keys(C.forcaReal).filter((id) => !C.fora.has(id)), ...C.naA];
}

function sairDaSerieA(nome) {
  if (C.naA.has(nome)) C.naA.delete(nome);
  else { C.fora.add(nome); garantirInferior(nome); }
  C.div.B.push(nome);
}
function entrarNaSerieA(nome) {
  tirar(C.div.B, nome);
  if (C.fora.has(nome)) C.fora.delete(nome); else C.naA.add(nome);
}

// Sobe ou desce um clube e manda outro no caminho inverso: as divisoes
// ficam sempre do mesmo tamanho. So o clube do jogador e acompanhado.
function trocarDivisao(nome, de, para) {
  const rng = C.rng;
  if (para === "A") {
    entrarNaSerieA(nome);
    const outros = idsDaSerieA().filter((id) => id !== nome);
    const fraco = outros.sort((a, b) => forcaNoMundo(a) - forcaNoMundo(b))[0];
    sairDaSerieA(fraco);
  } else if (de === "A") {
    sairDaSerieA(nome);
    const sobe = Motor.sortearPeso(rng, C.div.B.filter((n) => n !== nome), (n) => Math.exp(forcaNoMundo(n) / 2));
    entrarNaSerieA(sobe);
  } else {
    tirar(C.div[de], nome);
    const acima = DIVISOES.indexOf(para) < DIVISOES.indexOf(de);
    const outro = Motor.sortearPeso(rng, C.div[para], (n) => Math.exp((acima ? -1 : 1) * forcaNoMundo(n) / 2));
    tirar(C.div[para], outro);
    C.div[para].push(nome);
    C.div[de].push(outro);
  }
}

function clubeInferior(nome) {
  const d = C.inf.get(nome);
  const divisao = divisaoDe(nome) || "D";
  const pos = POSICOES[C.pos];
  const tit = d.time ? titularReal(d.time, pos.funcao, pos.fam) : null;
  return {
    tipo: "inf", id: nome, nome, uf: d.uf, divisao, liga: divisao === "A" ? "Brasileirão" : `Série ${divisao}`, ligaId: divisao,
    continente: "america", prestigio: PRESTIGIO_DIV[divisao], forca: d.forca, kit: d.uniforme, time: d.time,
    titular: tit, nivel: tit ? tit.overall : C.nivelDeForca(d.forca),
  };
}

// quem e o titular real da sua funcao nesse clube da Serie A
function titularReal(time, funcao, fam) {
  const candidatos = time.jogadores.filter((j) => j.overall !== null && (FUNCAO.get(j) === funcao));
  const mesmaFamilia = time.jogadores.filter((j) => j.overall !== null && j.posicao === fam);
  const lista = candidatos.length ? candidatos : mesmaFamilia;
  return lista.sort((a, b) => b.overall - a.overall)[0] || null;
}

// chance de ser titular: passar o titular por 3 pontos ja resolve quase tudo
const chanceDeTitular = (ovr, nivel, idade) => limitar(logistica((ovr - nivel + 1) / 2.6) * (idade <= 18 ? 0.85 : 1), 0.03, 0.97);
const fracaoDeMinutos = (s) => 0.08 + 0.85 * s;

// todos os clubes do mundo do jogo, com a forca e o nivel do titular
function clubesDoMundo(J) {
  const lista = [];
  const serieA = Motor.timesDaSerieA(C.r);
  const pos = POSICOES[C.pos];
  for (const t of Object.values(serieA)) {
    if (C.fora.has(t.id)) continue;
    const tit = titularReal(t.time, pos.funcao, pos.fam);
    lista.push({
      tipo: "br", id: t.id, nome: t.nome, divisao: "A", liga: "Brasileirão", ligaId: "bra", continente: "america", prestigio: 3,
      forca: (t.atq + t.def) / 2, time: t.time, titular: tit, nivel: tit ? tit.overall : C.nivelDeForca((t.atq + t.def) / 2),
    });
  }
  for (const nome of [...C.naA, ...C.div.B, ...C.div.C, ...C.div.D]) lista.push(clubeInferior(nome));
  for (const l of C.exterior.ligas) {
    for (const c of l.clubes) {
      lista.push({
        tipo: "ext", id: c.nome, nome: c.nome, liga: l.nome, ligaId: l.id, pais: l.pais, continente: l.continente,
        prestigio: l.prestigio, forca: c.forca, kit: c.uniforme, titular: null, nivel: C.nivelDeForca(c.forca),
      });
    }
  }
  return lista;
}

function estrelas(forca) {
  // 1 a 5 estrelas pela forca na regua (50 fraco, 68 gigante)
  return limitar(Math.round((forca - 49) / 3.8), 1, 5);
}

// --- 3. propostas da base ----------------------------------------------------------

// Aos 16 ninguem estreia no Flamengo: as propostas vem da Serie D, da C e,
// se a carta for boa (ou der sorte), da B.
function propostasIniciais() {
  const pega = (div, n = 1) => Motor.embaralhar(C.rng, [...C.div[div]]).slice(0, n).map(clubeInferior);
  const chanceB = logistica((C.J.ovr - 59) / 2);
  const [d] = pega("D");
  const cs = pega("C", 2);
  const terceira = C.rng() < chanceB ? pega("B")[0] : cs[1];
  return [terceira, cs[0], d];
}

function linhaDeTitular(c, ovr, idade) {
  const s = chanceDeTitular(ovr, c.nivel, idade);
  const jogos = MIN_POR_TEMPORADA[c.divisao] || 38;
  const min = Math.round(fracaoDeMinutos(s) * jogos * 90 / 50) * 50;
  const quem = c.titular ? `${c.titular.nome} (${c.titular.overall})` : `nível ${Math.round(c.nivel)}`;
  return { s, texto: `Titular hoje: ${quem}`, minutos: `~${min.toLocaleString("pt-BR")} min ${daLiga(c.liga).replace(/^d/, "n")}` };
}

function mostrarPropostasDaBase() {
  mostrarTela("base");
  desenharPainelJogador();
  const alvo = $("propostas-base");
  alvo.replaceChildren();
  for (const c of propostasIniciais()) alvo.append(cartaoDeProposta(c, () => assinar(c, "base")));
}

function cartaoDeProposta(c, aoAssinar, { rotulo = "Assinar" } = {}) {
  const J = C.J;
  const card = el("article", "proposta");
  const camisa = el("span", "proposta-camisa");
  camisa.append(figura(timeParaCamisa(c), J.numero, { cabeca: false }));
  const est = el("span", "estrelas");
  const n = estrelas(c.forca);
  for (let i = 0; i < 5; i++) est.append(el("i", i < n ? "cheia" : ""));
  est.setAttribute("aria-label", `${n} de 5 estrelas`);
  const t = linhaDeTitular(c, J.ovr, J.idade);
  const chance = el("div", "proposta-chance");
  const barra = el("i"); barra.style.width = `${Math.round(t.s * 100)}%`;
  chance.append(barra);
  const botao = el("button", "botao botao-primario", rotulo);
  botao.type = "button";
  botao.addEventListener("click", aoAssinar);
  card.append(
    el("p", "proposta-liga", `${c.liga}${c.tipo === "ext" && c.pais ? ` · ${c.pais}` : c.uf ? ` · ${c.uf}` : ""}`),
    camisa, el("h3", "proposta-nome", c.nome), est,
    el("p", "proposta-titular", t.texto),
    chance, el("p", "proposta-minutos", `Chance de ser titular: ${Math.round(t.s * 100)}% · ${c.tipo !== "ext" ? t.minutos : `nível do titular ~${Math.round(c.nivel)}`}`),
    botao,
  );
  return card;
}

function assinar(c, contexto) {
  const J = C.J;
  if (J.clube && J.clube.id !== c.id) J.transferencias.push({ ano: J.ano, de: J.clube.nome, para: c.nome });
  J.clube = c;
  J.anosNoClube = 0;
  if (contexto === "base") iniciarTelaCarreira();
}

// --- 4. a temporada ------------------------------------------------------------------

// tabela de pontos corridos local (ligas de fora e divisoes de baixo)
function tabelaLocal(ids) { return new Map(ids.map((id) => [id, { id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }])); }
function registrarLocal(tab, casa, fora, gc, gf) {
  const c = tab.get(casa), f = tab.get(fora);
  c.j++; f.j++; c.gp += gc; c.gc += gf; f.gp += gf; f.gc += gc;
  if (gc > gf) { c.v++; f.d++; c.pts += 3; } else if (gc < gf) { f.v++; c.d++; f.pts += 3; } else { c.e++; f.e++; c.pts++; f.pts++; }
}

// o jogador entra no ataque/defesa do time proporcional aos minutos
function reforcoDoJogador(time, J, p, nivel) {
  const d = (J.ovr - nivel) * 0.09 * p;
  const fam = POSICOES[C.pos].fam;
  if (fam === "F") time.atq += d;
  else if (fam === "M") { time.atq += d * 0.6; time.def += d * 0.6; }
  else time.def += d;
}

const pesoDeGol = (J) => {
  const f = funcaoDe(C.pos);
  if (f === "GOL") return 0.01;
  return (TAXA_GOL[f] / 0.42) * 3 * ((J.attrs.FIN ?? 30) / 100 + 0.2);
};

// o que o jogador fez nos jogos do time dele
function novoPlacar() { return { jogos: 0, gols: 0, golsDoTime: 0, semSofrer: 0, jogosLiga: 0, golsLiga: 0, semSofrerLiga: 0 }; }
function contarJogo(st, j, lado, J, liga) {
  const pro = lado === "casa" ? j.gc : j.gf, contra = lado === "casa" ? j.gf : j.gc;
  const g = j.eventos.filter((e) => e.tipo === "gol" && e.lado === lado && e.autor === J.nome).length;
  st.jogos++; st.golsDoTime += pro; st.gols += g;
  if (!contra) st.semSofrer++;
  if (liga) { st.jogosLiga++; st.golsLiga += g; if (!contra) st.semSofrerLiga++; }
}

function timeAbstrato(nome, forca, rng, ano) {
  const d = ano > ANO_INICIAL ? normal(rng, 0.9) : 0;
  return { id: nome, nome, atq: forca + d, def: forca + d, artilheiros: [] };
}

// o clube do jogador: reforco dele e ele na lista de quem faz gol
function prepararClube(clube, J, rng) {
  const s = chanceDeTitular(J.ovr, J.clube.nivel, J.idade);
  const p = fracaoDeMinutos(s);
  reforcoDoJogador(clube, J, p, J.clube.nivel);
  clube.artilheiros = [{ nome: J.nome, peso: pesoDeGol(J) * p }, { nome: "__outro", peso: 5 }];
  return { s, p };
}

function pontosCorridos(rng, times, ids, turnos, alvo, J, st) {
  const tab = tabelaLocal(ids);
  for (let turno = 0; turno < turnos; turno++) {
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const [casa, fora] = turno % 2 ? [ids[b], ids[a]] : [ids[a], ids[b]];
      const j = Motor.jogar(rng, times[casa], times[fora]);
      registrarLocal(tab, casa, fora, j.gc, j.gf);
      if (casa === alvo || fora === alvo) contarJogo(st, j, casa === alvo ? "casa" : "fora", J, true);
    }
  }
  return Motor.ordenar(tab);
}

// ida e volta; empate no agregado vai pros penaltis (moeda puxada pela forca)
function mataMata(rng, times, a, b, alvo, J, st) {
  let ga = 0, gb = 0;
  for (const [casa, fora] of [[b, a], [a, b]]) {
    const j = Motor.jogar(rng, times[casa], times[fora]);
    if (casa === a) { ga += j.gc; gb += j.gf; } else { ga += j.gf; gb += j.gc; }
    if (casa === alvo || fora === alvo) contarJogo(st, j, casa === alvo ? "casa" : "fora", J, true);
  }
  if (ga !== gb) return ga > gb ? a : b;
  return rng() < logistica((times[a].atq - times[b].atq) / 6) ? a : b;
}

// continental do ano que vem pela tabela deste ano (seis primeiros na
// Libertadores, do 7o ao 13o na Sul-Americana), trocando os brasileiros nos grupos
function regrasDoAno(ano) {
  const regras = structuredClone(C.regras);
  if (ano === ANO_INICIAL || !C.tabelaAnterior) return regras;
  const serieA = new Set(C.r.times.map((t) => t.nome));
  const lib = C.tabelaAnterior.slice(0, 6), sul = C.tabelaAnterior.slice(6, 13);
  for (const [chave, novos] of [["libertadores", lib], ["sulamericana", sul]]) {
    let k = 0;
    for (const g of Object.values(regras[chave].grupos)) {
      for (let i = 0; i < g.length; i++) if (serieA.has(g[i]) && k < novos.length) g[i] = novos[k++];
    }
  }
  return regras;
}

function faseAlcancada(temp, comp, id) {
  if (temp.campeoes[comp] === id) return "Campeão";
  if (temp.eliminado[comp]) return { Final: "Vice", "5ª fase": "5ª fase" }[temp.eliminado[comp]] || temp.eliminado[comp].replace(" (foi pra Sul-Americana)", "");
  return null;
}

// Serie A: o motor do site inteiro (Brasileirao, Copa do Brasil e continental)
function temporadaNoBrasil(J, ano, rng) {
  const regras = regrasDoAno(ano);
  const reais = Motor.timesDaSerieA(C.r);
  // cada ano o mundo mexe um pouco: elencos mudam
  if (ano > ANO_INICIAL) for (const t of Object.values(reais)) { const d = normal(rng, 1.1); t.atq += d; t.def += d; }
  const subiram = {};
  for (const nome of C.naA) subiram[nome] = { ...timeAbstrato(nome, C.inf.get(nome).forca, rng, ano), kit: C.inf.get(nome).uniforme };
  const ids = idsDaSerieA();
  // Copa do Brasil: quem subiu sai dos convidados e quem caiu entra no lugar
  const noA = new Set(ids), caidos = [...C.fora];
  const nomesCopa = new Set(regras.copa_do_brasil.convidados.map((c) => c.nome));
  const reserva = [...caidos, ...C.div.B.filter((n) => !noA.has(n) && !nomesCopa.has(n))];
  regras.copa_do_brasil.convidados = regras.copa_do_brasil.convidados.map((c) => {
    if (!noA.has(c.nome)) return c;
    const n = reserva.shift();
    return { nome: n, forca: forcaNoMundo(n), uniforme: C.inf.get(n)?.uniforme };
  });
  const times = { ...Motor.timesDeFora(regras), ...reais, ...subiram };
  const clube = times[J.clube.id];
  const s = chanceDeTitular(J.ovr, J.clube.nivel, J.idade);
  const p = fracaoDeMinutos(s);
  reforcoDoJogador(clube, J, p, J.clube.nivel);
  clube.artilheiros = [...(clube.artilheiros || []), { nome: J.nome, pos: POSICOES[C.pos].fam, peso: pesoDeGol(J) * p }];
  if (clube.artilheiros.length === 1) clube.artilheiros.push({ nome: "__outro", peso: 5 });
  const temp = Motor.criarTemporada({ regras, times, serieA: ids, usuario: clube.id, semente: Math.floor(rng() * 1e9) });
  while (Motor.avancar(temp)) { /* roda tudo */ }

  const st = novoPlacar();
  const golsNaLiga = new Map();
  for (const h of temp.historico) {
    const liga = h.etapa.comp === "bra";
    if (liga) for (const j of h.jogos) for (const e of j.eventos) {
      if (e.tipo !== "gol" || !e.autor || e.autor === "__outro") continue;
      const k = `${e.autor}|${e.lado === "casa" ? j.casa : j.fora}`;
      golsNaLiga.set(k, (golsNaLiga.get(k) || 0) + 1);
    }
    if (h.doUsuario) contarJogo(st, h.doUsuario, h.doUsuario.casa === clube.id ? "casa" : "fora", J, liga);
  }
  const meu = `${J.nome}|${clube.id}`;
  let maxOutros = 0;
  for (const [k, v] of golsNaLiga) if (k !== meu) maxOutros = Math.max(maxOutros, v);

  const tabela = Motor.ordenar(temp.bra.tabela);
  C.tabelaAnterior = tabela.map((l) => l.id);
  const pos = tabela.findIndex((l) => l.id === clube.id) + 1;
  const campanha = [{ comp: "Brasileirão", res: `${pos}º`, campeao: pos === 1 }];
  for (const [c, nome] of [["cdb", "Copa do Brasil"], ["lib", "Libertadores"], ["sul", "Sul-Americana"]]) {
    const f = faseAlcancada(temp, c, clube.id);
    if (f) campanha.push({ comp: nome, res: f, campeao: f === "Campeão" });
  }
  return {
    p, s, st, campanha, ligaNome: "Brasileirão", nivelLiga: C.nivelMedioA, maxOutrosLiga: maxOutros,
    desce: pos >= 17, rebaixado: pos >= 17, campeaoLiga: pos === 1,
    tituloNomes: campanha.filter((c) => c.campeao).map((c) => c.comp),
  };
}

// Serie B, C e D. Formatos simplificados dos de verdade:
// B em pontos corridos (4 sobem, 4 caem); C em turno unico + quadrangular
// (2 de cada grupo sobem, 2 caem); D em grupo de 8 + mata-mata (semifinalista sobe).
function temporadaInferior(J, ano, rng) {
  const div = J.clube.divisao;
  const nomes = C.div[div];
  const times = {};
  for (const n of nomes) times[n] = timeAbstrato(n, C.inf.get(n).forca, rng, ano);
  const clube = times[J.clube.id];
  const { s, p } = prepararClube(clube, J, rng);
  const st = novoPlacar();
  const forcaDe = (n) => times[n].atq;
  let res, sobe = false, desce = false, campeao = false;
  if (div === "B") {
    const tab = pontosCorridos(rng, times, nomes, 2, clube.id, J, st);
    const pos = tab.findIndex((l) => l.id === clube.id) + 1;
    campeao = pos === 1; sobe = pos <= 4; desce = pos >= 17;
    res = campeao ? "Campeão" : `${pos}º${sobe ? " · acesso" : ""}`;
  } else if (div === "C") {
    const tab = pontosCorridos(rng, times, nomes, 1, clube.id, J, st);
    const pos = tab.findIndex((l) => l.id === clube.id) + 1;
    desce = pos >= 19;
    res = `${pos}º`;
    if (pos <= 8) {
      const top = tab.slice(0, 8).map((l) => l.id);
      const gA = [top[0], top[3], top[4], top[7]], gB = [top[1], top[2], top[5], top[6]];
      const meu = gA.includes(clube.id) ? gA : gB, outro = meu === gA ? gB : gA;
      const tg = pontosCorridos(rng, times, meu, 2, clube.id, J, st);
      const pg = tg.findIndex((l) => l.id === clube.id) + 1;
      sobe = pg <= 2;
      res = sobe ? "Acesso" : "Quadrangular";
      if (pg === 1) {
        const rival = Motor.sortearPeso(rng, outro, (n) => Math.exp(forcaDe(n) / 2));
        campeao = mataMata(rng, times, clube.id, rival, clube.id, J, st) === clube.id;
        res = campeao ? "Campeão" : "Vice";
      }
    }
  } else {
    const grupo = [clube.id, ...Motor.embaralhar(rng, nomes.filter((n) => n !== clube.id)).slice(0, 7)];
    const tg = pontosCorridos(rng, times, grupo, 2, clube.id, J, st);
    const pg = tg.findIndex((l) => l.id === clube.id) + 1;
    res = "Fase de grupos";
    if (pg <= 4) {
      const fases = ["2ª fase", "Oitavas", "Quartas", "Semifinal", "Final"];
      const resto = Motor.embaralhar(rng, nomes.filter((n) => !grupo.includes(n)));
      let k = 0;
      for (; k < fases.length; k++) if (mataMata(rng, times, clube.id, resto[k], clube.id, J, st) !== clube.id) break;
      sobe = k >= 3; campeao = k === fases.length;
      res = campeao ? "Campeão" : k === 4 ? "Vice · acesso" : sobe ? "Semifinal · acesso" : fases[k];
    }
  }
  const liga = `Série ${div}`;
  const media = nomes.reduce((a, n) => a + C.inf.get(n).forca, 0) / nomes.length;
  return {
    p, s, st, campanha: [{ comp: liga, res, campeao }], ligaNome: liga, nivelLiga: C.nivelDeForca(media),
    sobe, desce, rebaixado: desce, campeaoLiga: campeao, tituloNomes: campeao ? [liga] : [],
  };
}

function temporadaNoExterior(J, ano, rng) {
  const liga = C.exterior.ligas.find((l) => l.id === J.clube.ligaId);
  const times = {};
  for (const c of liga.clubes) times[c.nome] = timeAbstrato(c.nome, c.forca, rng, ano);
  const clube = times[J.clube.id];
  const { s, p } = prepararClube(clube, J, rng);
  const st = novoPlacar();
  // liga em 4 turnos entre os 10 clubes da lista = 36 rodadas
  const ids = Object.keys(times);
  const tabela = pontosCorridos(rng, times, ids, 4, clube.id, J, st);
  const pos = tabela.findIndex((l) => l.id === clube.id) + 1;
  const campanha = [{ comp: liga.nome, res: `${pos}º`, campeao: pos === 1 }];
  // copa nacional: chance pela forca relativa na liga
  const somaCopa = liga.clubes.reduce((s2, c) => s2 + Math.exp(times[c.nome].atq / 2.2), 0);
  if (rng() < Math.exp(clube.atq / 2.2) / somaCopa) campanha.push({ comp: COPA_NACIONAL[liga.id], res: "Campeão", campeao: true });
  // continental: top 4 (Europa) ou top 3 (resto) disputa; mata-mata abstrato
  const vagas = liga.continente === "europa" ? 4 : 3;
  const forcaCopa = { europa: 65, america: 60, asia: 56 }[liga.continente];
  if (liga.copa && pos <= vagas) {
    const fases = ["Fase de liga", "Oitavas", "Quartas", "Semifinal", "Final"];
    let k = 0;
    const pPassar = logistica((clube.atq - forcaCopa) / 2.4);
    while (k < fases.length - 1 && rng() < (k === 0 ? Math.min(0.9, pPassar + 0.25) : pPassar)) k++;
    let res = fases[k];
    if (k === fases.length - 1) res = rng() < pPassar ? "Campeão" : "Vice";
    campanha.push({ comp: liga.copa, res, campeao: res === "Campeão" });
    const jogosCopa = 8 + k * 2;
    st.jogos += jogosCopa;
    for (let i = 0; i < jogosCopa; i++) if (rng() < TAXA_GOL[funcaoDe(C.pos)] * p * ((J.attrs.FIN ?? 30) / 70)) st.gols++;
    st.golsDoTime += Math.round(jogosCopa * 1.4);
  }
  const media = liga.clubes.reduce((a, c) => a + c.forca, 0) / liga.clubes.length;
  return {
    p, s, st, campanha, ligaNome: liga.nome, nivelLiga: C.nivelDeForca(media),
    rebaixado: pos >= 9 && !["asia", "leste"].includes(liga.continente), campeaoLiga: pos === 1,
    tituloNomes: campanha.filter((c) => c.campeao).map((c) => c.comp),
  };
}

// Selecao: convocado se o OVR passa o corte do pais e esta jogando
function temporadaNaSelecao(J, ano, rng, p) {
  const pais = paisDe(C.pais);
  if (J.ovr < pais.corte || p < 0.45) return null;
  const f = funcaoDe(C.pos);
  const jogos = 4 + Math.floor(rng() * 6);
  let gols = 0;
  for (let i = 0; i < jogos; i++) if (rng() < TAXA_GOL[f] * 0.8 * ((J.attrs.FIN ?? 30) / 70)) gols++;
  const r = { jogos, gols, titulos: [] };
  // Copa do Mundo (2030, 2034...) e Copa America (2028, 2032...)
  const torneio = ano % 4 === 2 && ano > ANO_INICIAL ? `Copa do Mundo ${ano}`
    : ano % 4 === 0 && SUL_AMERICANOS.includes(pais.id) ? `Copa América ${ano}` : null;
  if (torneio) {
    const base = torneio.startsWith("Copa do Mundo") ? pais.copa : Math.min(0.45, pais.copa * 2.2);
    const chance = base * (1 + (J.ovr - pais.corte) / 25);
    r.torneio = torneio;
    r.jogos += 5;
    if (rng() < chance) { r.titulos.push(torneio); r.torneioRes = "Campeão"; }
    else r.torneioRes = ["Fase de grupos", "Oitavas", "Quartas", "Semifinal", "Vice"][Math.floor(rng() * 5)];
  }
  return r;
}

// --- evolucao ----------------------------------------------------------------------

// Curva de carreira: cresce ate o pico (29/30; goleiro 32 a 34) puxado pelo
// potencial escondido, mais rapido jogando; depois do pico cai aos poucos,
// acelerando a partir dos 33 (goleiro, quatro anos depois).
function trajetoria(J, idade) {
  if (idade >= J.idadePico) return J.potencial;
  const f = (J.idadePico - idade) / (J.idadePico - IDADE_INICIAL);
  return J.ovrInicial + (J.potencial - J.ovrInicial) * (1 - Math.pow(f, 1.5));
}

function evoluir(J, p, rng) {
  const f = funcaoDe(C.pos);
  const antes = J.ovr;
  // o potencial mexe um pouco com a carreira: temporada muito boa cedo sobe,
  // banco na idade de crescer desce (no maximo +2 / -3 do sorteado)
  if (J.idade <= 22) {
    const ultima = J.historico[J.historico.length - 1];
    if (ultima && ultima.nota >= 7.4 && rng() < 0.4) J.potencial = Math.min(J.potencialSorteado + 1, 97, J.potencial + 1);
    if (p < 0.3 && rng() < 0.5) J.potencial = Math.max(J.potencialSorteado - 3, J.potencial - 1);
  }
  const proxima = J.idade + 1;
  let delta;
  if (proxima <= J.idadePico) {
    const m = limitar(0.5 + 0.6 * p, 0.5, 1); // quem nao joga cresce menos (e recupera depois, em parte)
    delta = (trajetoria(J, proxima) - J.ovr) * 0.8 * m + normal(rng, 0.8);
  } else {
    const k = proxima - J.idadePico; // anos depois do pico
    const queda = [0, -0.4, -0.9, -1.5, -2.1, -2.8][k] ?? -3.4;
    delta = queda + normal(rng, 0.7);
  }
  let alvo = limitar(Math.round(antes + limitar(delta, -6, 8)), 40, 97);
  if (proxima <= J.idadePico) alvo = Math.min(alvo, Math.max(antes, J.potencial)); // nao passa do teto
  const pesos = Object.entries(PESOS[f]).filter(([, w]) => w > 0);
  const mudou = {};
  // sobe (ou desce) atributo a atributo, puxado pelo peso da funcao, ate o OVR bater
  for (let guarda = 0; J.ovr !== alvo && guarda < 400; guarda++) {
    const sobe = J.ovr < alvo;
    let k;
    if (sobe) k = Motor.sortearPeso(rng, pesos, ([, w]) => w)[0];
    else {
      // o corpo cai primeiro: ritmo e fisico perdem mais
      const queda = pesos.map(([c, w]) => [c, w * (["RIT", "FIS", "REF"].includes(c) ? 2.5 : 1)]);
      k = Motor.sortearPeso(rng, queda, ([, w]) => w)[0];
    }
    const novo = limitar(J.attrs[k] + (sobe ? 1 : -1), 20, 99);
    if (novo === J.attrs[k]) continue;
    J.attrs[k] = novo;
    mudou[k] = (mudou[k] || 0) + (sobe ? 1 : -1);
    J.ovr = ovrDe(J.attrs, f);
  }
  return { antes, depois: J.ovr, mudou };
}

function valorDeMercado(J) {
  const idade = J.idade <= 21 ? 1.6 : J.idade <= 24 ? 1.4 : J.idade <= 27 ? 1.1 : J.idade <= 30 ? 0.8 : J.idade <= 32 ? 0.5 : 0.25;
  return Math.round(0.35 * Math.pow(1.19, J.ovr - 60) * idade * 10) / 10;
}

// --- premios individuais -------------------------------------------------------------

const NOME_DA_POSICAO = (pos) => {
  const p = POSICOES[pos];
  if (p.fam === "G") return "goleiro";
  if (p.fam === "D") return p.funcao === "LAT" ? "lateral" : "zagueiro";
  if (p.fam === "M") return "meio-campista";
  return "atacante";
};
const CONTINENTAIS = ["Champions League", "Libertadores", "Champions da Ásia"];

// Premios da liga saem dos numeros da temporada contra um limiar sorteado
// (a artilharia do Brasileirao e a de verdade, contada no motor). Bola de
// Ouro e Craque da America somam OVR, nota, titulos e o peso da liga.
function premiosDoAno(J, t, linha, rng) {
  const premios = [];
  const liga = t.ligaNome, da = daLiga(liga);
  const f = funcaoDe(C.pos);
  const jl = t.st.jogosLiga || 1;
  const regular = t.p >= 0.55 && linha.jogos >= jl * 0.5;
  const assistLiga = Math.round(linha.assist * (t.st.jogosLiga / Math.max(1, t.st.jogos)));
  const limiarGol = t.maxOutrosLiga ?? Math.round(jl * 0.5 + normal(rng, 2));
  if (f !== "GOL" && t.st.golsLiga >= Math.max(5, limiarGol)) premios.push(`Artilheiro ${da}`);
  if (f !== "GOL" && assistLiga >= Math.max(4, Math.round(jl * 0.26 + normal(rng, 1.5)))) premios.push(`Líder de assistências ${da}`);
  if (f === "GOL" && regular && linha.semSofrer >= Math.max(4, Math.round(jl * 0.37 + normal(rng, 1.5)))) premios.push(`Luva de Ouro ${da}`);
  if (regular && linha.nota >= 7.45 + normal(rng, 0.2)) premios.push(`Melhor ${NOME_DA_POSICAO(C.pos)} ${da}`);
  if (regular && linha.nota >= 7.95 + normal(rng, 0.25)) premios.push(`Craque ${da}`);
  if (J.idade <= 20 && t.p >= 0.45 && (J.clube.divisao === "A" || J.clube.tipo === "ext") && linha.nota >= 7.15 + normal(rng, 0.2)
    && !J.premios.some((x) => x.nome.startsWith("Revelação"))) premios.push(`Revelação ${da}`);

  // craque da partida: jogo a jogo, puxado pela nota da temporada
  const pm = limitar(0.03 + (linha.nota - 6.4) * 0.14 + (linha.jogos ? (linha.gols + linha.assist * 0.5) / linha.jogos : 0) * 0.18, 0.01, 0.55);
  let motm = 0;
  for (let i = 0; i < linha.jogos; i++) if (rng() < pm) motm++;
  linha.craqueDoJogo = motm;

  // Bola de Ouro (o mundo) e Craque da America
  const tem = (nome) => linha.titulos.some((x) => x.startsWith(nome));
  const base = J.ovr + (linha.nota - 7) * 2.5 + (premios.some((x) => x.startsWith("Artilheiro")) ? 1 : 0) + (t.campeaoLiga ? 0.4 * J.clube.prestigio : 0);
  if (t.p >= 0.5) {
    const mundo = base + (tem("Champions League") ? 3 : tem("Libertadores") ? 1.5 : 0) + (tem("Copa do Mundo") ? 4 : tem("Copa América") ? 1.2 : 0)
      - (5 - J.clube.prestigio) * 1.3;
    const lugar = Math.max(1, Math.round((97 - mundo) * 2 + normal(rng, 1.5)));
    if (lugar <= 30) linha.bolaDeOuro = lugar;
    if (lugar === 1) premios.push("Bola de Ouro");
    if (J.clube.continente === "america" && (J.clube.divisao === "A" || J.clube.tipo === "ext")) {
      const america = base + (tem("Libertadores") ? 3 : 0) + (tem("Copa América") ? 1 : 0);
      if (america >= 83.5 + normal(rng, 1.2)) premios.push("Craque da América");
    }
  }
  return premios;
}

// --- transferencias --------------------------------------------------------------

// Interesse de cada clube: OVR contra o nivel do titular deles, a vitrine da
// temporada (nota e premios) e um tanto de sorte. Clube grande olha pouco
// pra Serie D; da Europa, so com carta alta ou muito novo.
// degrau de cada clube na escada: D, C, B, Serie A (e America do Sul/Arabia), Europa media, elite
const degrau = (c) => (c.tipo === "ext" ? (c.continente === "europa" ? (c.prestigio >= 4 ? 5 : 4) : c.continente === "leste" ? 4 : 3) : 3 - DIVISOES.indexOf(c.divisao));

function propostasDoAno(J, t, linha) {
  const atual = J.clube;
  const vitrine = (linha.nota - 6.9) * 2.2 + linha.premios.length * 1.2 + (J.idade <= 21 ? 1 : 0);
  const sorte = C.rng() < 0.08 ? 5 : 0; // o olheiro estava no jogo certo
  linha.olheiro = sorte > 0;
  const interessados = [];
  for (const c of clubesDoMundo(J)) {
    if (c.id === atual.id) continue;
    // Europa: a porta abre entre 20 e 24 anos, com carta boa (18-19 so fenomeno).
    // Passou da janela, so quem ja esta la continua circulando por la.
    const vitrineGrande = atual.tipo === "ext" || atual.divisao === "A";
    if (c.continente === "europa") {
      const janela = vitrineGrande && ((J.idade >= 20 && J.idade <= 24 && J.ovr >= 76) || (J.idade >= 18 && J.idade <= 19 && J.ovr >= 80));
      const jaEsta = atual.continente === "europa" && J.idade <= 32;
      if (!janela && !jaEsta) continue;
    }
    // Arabia e Russia: o destino de quem e bom e nao foi pra Europa (ou esta voltando)
    if (c.continente === "asia" && !(J.idade >= 24 && J.ovr >= 74)) continue;
    if (c.continente === "leste" && !(J.idade >= 21 && J.idade <= 31 && J.ovr >= 72)) continue;
    if (c.tipo === "ext" && c.continente === "america" && J.ovr < 64) continue;
    const mesmoOuAcima = c.forca >= atual.forca - 3 || t.rebaixado || linha.titular < 0.3;
    if (!mesmoOuAcima) continue;
    // sobe no maximo um degrau por vez; dois so com o olheiro certo
    const pulo = degrau(c) - degrau(atual);
    if (pulo > (sorte ? 2 : 1)) continue;
    // menor de idade vindo de baixo: clube de cima prefere esperar
    const novinho = J.idade <= 17 && pulo > 0 ? 2.5 : 0;
    const salto = Math.max(0, c.prestigio - atual.prestigio - 0.8) * 3;
    const interesse = logistica((J.ovr - c.nivel + 2 + vitrine + sorte - salto - novinho) / 2.2);
    if (C.rng() < interesse) interessados.push(c);
  }
  const escolhidas = [];
  while (escolhidas.length < 3 && interessados.length) {
    const c = Motor.sortearPeso(C.rng, interessados, (x) => Math.exp((x.forca + x.prestigio) / 3));
    escolhidas.push(c);
    interessados.splice(interessados.indexOf(c), 1);
  }
  return escolhidas;
}

// modo rapido: vai se o clube novo for melhor contando a chance de jogar
function decidirTransferencia(J, ofertas, rebaixado) {
  const pesoJogar = J.idade <= 23 ? 10 : 7;
  const nota = (c) => {
    const s = chanceDeTitular(J.ovr, c.nivel, J.idade);
    // Arabia e Russia pagam o que o Brasil nao paga: pesa pra quem ja passou dos 26
    const salario = J.idade >= 26 && J.clube.continente !== "europa" ? ({ asia: 2.5, leste: 1.5 }[c.continente] || 0) : 0;
    return c.forca + c.prestigio * 0.8 + s * pesoJogar - (s < 0.2 ? 5 : 0) + salario;
  };
  const atual = nota(J.clube) - (rebaixado ? 3 : 0);
  const melhor = [...ofertas].sort((a, b) => nota(b) - nota(a))[0];
  return melhor && nota(melhor) > atual + 1.2 ? melhor : null;
}

// --- avancar um ano --------------------------------------------------------------

function jogarTemporada() {
  const J = C.J;
  const rng = C.rng;
  const t = J.clube.tipo === "ext" ? temporadaNoExterior(J, J.ano, rng)
    : J.clube.divisao === "A" ? temporadaNoBrasil(J, J.ano, rng) : temporadaInferior(J, J.ano, rng);
  const f = funcaoDe(C.pos);
  const st = t.st;
  const jogos = limitar(Math.round(st.jogos * t.p + normal(rng, 1.5)), 0, st.jogos);
  let assist = 0;
  const outrosGols = Math.max(0, st.golsDoTime - st.gols);
  for (let i = 0; i < outrosGols; i++) if (rng() < TAXA_ASSIST[f] * t.p * 0.9 * ((J.attrs.PAS ?? 30) / 70)) assist++;
  const gols = Math.min(st.gols, jogos * 3);
  // quem defende pontua pelo jogo sem sofrer gol; quem ataca, por gol e assistencia
  const fam = POSICOES[C.pos].fam;
  const muralha = fam === "G" || fam === "D" ? (st.semSofrerLiga / Math.max(1, st.jogosLiga) - 0.3) * (fam === "G" ? 1.6 : 1.1) : 0;
  const contrib = (jogos ? (gols + assist * 0.6) / jogos : 0) + muralha;
  const nota = limitar(6.55 + Math.tanh((J.ovr - t.nivelLiga) / 12) * 1.3 + contrib * 0.9 + normal(rng, 0.18), 5.4, 9.3);
  const selecao = temporadaNaSelecao(J, J.ano, rng, t.p);
  const titulos = jogos >= 5 ? [...t.tituloNomes] : [];
  if (selecao) titulos.push(...selecao.titulos);
  const linha = {
    ano: J.ano, idade: J.idade, clube: J.clube.nome, liga: J.clube.liga, kit: J.clube.kit || null,
    time: J.clube.time || null, ovr: J.ovr, attrs: { ...J.attrs }, jogos, gols, assist, nota,
    semSofrer: f === "GOL" ? Math.round(st.semSofrerLiga * t.p) : null,
    campanha: t.campanha, titulos, selecao, minutos: Math.round(jogos * 90 * (0.7 + 0.3 * t.s)), titular: t.s,
  };
  linha.premios = premiosDoAno(J, t, linha, rng);
  J.historico.push(linha);
  J.titulos.push(...titulos.map((nome) => ({ nome, ano: J.ano, clube: nome.startsWith("Copa do Mundo") || nome.startsWith("Copa América") ? paisDe(C.pais).nome : J.clube.nome })));
  J.premios.push(...linha.premios.map((nome) => ({ nome, ano: J.ano, clube: J.clube.nome })));
  // acesso e queda do clube (so quando ele e brasileiro)
  if (J.clube.tipo !== "ext") {
    const div = J.clube.divisao;
    const para = t.sobe ? DIVISOES[DIVISOES.indexOf(div) - 1] : t.desce && div !== "D" ? DIVISOES[DIVISOES.indexOf(div) + 1] : null;
    if (para) {
      trocarDivisao(J.clube.id, div, para);
      linha.divisao = t.sobe ? `Acesso pra ${para === "A" ? "Série A" : `Série ${para}`}` : `Caiu pra Série ${para}`;
    }
  }
  // fim do ano: evolui, envelhece, mercado
  linha.evolucao = evoluir(J, t.p, rng);
  J.idade += 1;
  J.ano += 1;
  J.anosNoClube += 1;
  J.valor = valorDeMercado(J);
  // aposentadoria
  const folga = J.idade - (J.idadePico + 4); // uns quatro anos depois do pico ja da pra pensar em parar
  const chanceParar = J.idade >= (f === "GOL" ? 42 : 40) ? 1
    : (folga >= 0 ? 0.12 + folga * 0.15 : 0) + (J.idade >= 30 && J.ovr < 64 ? 0.3 : 0) + (J.idade >= 33 && J.ovr < 70 ? 0.15 : 0);
  if (rng() < chanceParar) { J.aposentado = true; linha.fim = "Pendurou as chuteiras"; return linha; }
  // clube atual com a divisao e o titular de agora
  J.clube = clubesDoMundo(J).find((c) => c.id === J.clube.id) || J.clube;
  const ofertas = propostasDoAno(J, t, linha);
  linha.ofertas = ofertas.map((c) => c.nome);
  const destino = decidirTransferencia(J, ofertas, t.rebaixado);
  if (t.rebaixado) linha.rebaixado = true;
  if (destino) {
    linha.transferencia = { para: destino.nome, liga: destino.liga, valor: J.valor };
    assinar(destino, "mercado");
  }
  return linha;
}

// --- tela da carreira ---------------------------------------------------------------

function iniciarTelaCarreira() {
  mostrarTela("carreira");
  $("temporada-atual").replaceChildren(
    el("p", "jogo-etapa", `Temporada ${C.J.ano}`),
    el("h3", "temporada-titulo", `Primeiro contrato: ${C.J.clube.nome}, ${C.J.clube.liga}`),
    el("p", "nota", "Cada temporada roda a liga inteira com o motor do site. Seus minutos dependem de passar o titular da sua posição; jogando bem, as propostas de clube maior aparecem. Um olheiro no jogo certo também ajuda."),
  );
  $("proxima").disabled = false;
  $("tudo").disabled = false;
  desenharPainelJogador();
  desenharTabelaCarreira();
}

function desenharPainelJogador() {
  const J = C.J;
  const ultimo = J.historico[J.historico.length - 1];
  const alvo = $("painel-jogador");
  alvo.replaceChildren();
  alvo.append(cartaDoCriado(J.attrs, J.ovr, J.clube, { jogos: J.historico.reduce((s, h) => s + h.jogos, 0), minutos: ultimo ? ultimo.minutos : 0 }));
  const fatos = el("dl", "painel-fatos");
  const tot = J.historico.reduce((a, h) => ({ j: a.j + h.jogos, g: a.g + h.gols, a: a.a + h.assist }), { j: 0, g: 0, a: 0 });
  for (const [k, v] of [
    ["Idade", J.idade], ["Clube", J.clube ? J.clube.nome : "Sem clube"], ["Valor", dinheiro(J.valor)],
    ["Jogos", tot.j], ["Gols", tot.g], ["Assist.", tot.a],
  ]) { const d = el("div"); d.append(el("dt", null, k), el("dd", null, String(v))); fatos.append(d); }
  const pais = paisDe(C.pais);
  const cab = el("p", "painel-cab");
  cab.append(bandeira(pais), el("span", null, `${pais.nome} · #${J.numero} · ${POSICOES[C.pos].nome} · pé ${C.pe.toLowerCase()}`));
  alvo.append(cab, fatos);
  for (const [rotulo, itens, classe] of [["Títulos", J.titulos, "galeria"], ["Prêmios", J.premios, "galeria galeria-premios"]]) {
    if (!itens.length) continue;
    const gal = el("div", classe);
    gal.append(el("span", "galeria-rotulo", `${rotulo} · ${itens.length}`));
    const lista = el("ul");
    for (const t of itens.slice(-6).reverse()) lista.append(el("li", null, `${t.nome} · ${t.ano}`));
    gal.append(lista);
    alvo.append(gal);
  }
}

function desenharTabelaCarreira() {
  const J = C.J;
  const tbody = $("tabela-carreira");
  tbody.replaceChildren();
  for (const h of J.historico) {
    const tr = el("tr", h.titulos.length ? "com-titulo" : "");
    const clube = el("td", "tc-clube");
    const mini = el("span", "tabela-camisa");
    mini.append(figura(h.time || { nome: h.clube, kit: h.kit }, null, { cabeca: false }));
    const nomeClube = el("span", null, h.clube);
    nomeClube.append(el("small", null, h.liga));
    clube.append(mini, nomeClube);
    const ovr = el("td", `tc-ovr nivel-${nivel(h.ovr).id}`);
    ovr.append(el("b", null, String(h.ovr)));
    tr.append(el("td", "tc-idade", String(h.idade)), clube, ovr, el("td", null, String(h.jogos)), el("td", null, String(h.gols)), el("td", null, String(h.assist)),
      el("td", "tc-titulos", h.titulos.length ? `${h.titulos.length}` : ""), el("td", "tc-premios", h.premios.length ? `${h.premios.length}` : ""));
    if (h.titulos.length) tr.querySelector(".tc-titulos").title = h.titulos.join(", ");
    if (h.premios.length) tr.querySelector(".tc-premios").title = h.premios.join(", ");
    tbody.append(tr);
  }
  if (!J.aposentado) {
    const tr = el("tr", "proxima-linha");
    tr.append(el("td", "tc-idade", String(J.idade)), el("td", "tc-clube", J.clube.nome), el("td", "tc-ovr", "?"), el("td", null, "—"), el("td", null, "—"), el("td", null, "—"), el("td"), el("td"));
    tbody.append(tr);
  }
}

function mostrarLinha(linha) {
  const alvo = $("temporada-atual");
  alvo.replaceChildren();
  alvo.append(el("p", "jogo-etapa", `Temporada ${linha.ano} · ${linha.idade} anos · ${linha.clube} (${linha.liga})`));
  const numeros = el("dl", "temporada-numeros");
  const itens = [["Jogos", linha.jogos], ["Gols", linha.gols], ["Assist.", linha.assist], ["Nota", linha.nota.toFixed(1).replace(".", ",")], ["Craque do jogo", linha.craqueDoJogo]];
  if (linha.semSofrer !== null) itens.splice(1, 1, ["Sem sofrer gol", linha.semSofrer]);
  for (const [k, v] of itens) { const d = el("div"); d.append(el("dd", null, String(v)), el("dt", null, k)); numeros.append(d); }
  alvo.append(numeros);
  const papel = linha.titular >= 0.7 ? "Titular absoluto" : linha.titular >= 0.45 ? "Briga pela vaga" : linha.titular >= 0.2 ? "Opção no banco" : "Pouco utilizado";
  alvo.append(el("p", "temporada-papel", papel));
  const camp = el("ul", "temporada-campanha");
  for (const c of linha.campanha) {
    const li = el("li", c.campeao ? "campeao" : "");
    li.append(el("span", null, c.comp), el("b", null, c.res));
    camp.append(li);
  }
  if (linha.selecao) {
    const li = el("li", linha.selecao.titulos.length ? "campeao" : "");
    li.append(el("span", null, `Seleção${linha.selecao.torneio ? ` · ${linha.selecao.torneio}` : ""}`),
      el("b", null, `${linha.selecao.jogos} J · ${linha.selecao.gols} G${linha.selecao.torneioRes ? ` · ${linha.selecao.torneioRes}` : ""}`));
    camp.append(li);
  }
  alvo.append(camp);
  if (linha.premios.length || linha.bolaDeOuro) {
    const pr = el("ul", "temporada-premios");
    for (const nome of linha.premios) pr.append(el("li", nome === "Bola de Ouro" ? "ouro" : "", nome));
    if (linha.bolaDeOuro && linha.bolaDeOuro > 1) pr.append(el("li", "indicacao", `Bola de Ouro: ${linha.bolaDeOuro}º lugar`));
    alvo.append(pr);
  }
  const ev = linha.evolucao;
  const dif = ev.depois - ev.antes;
  const evo = el("div", `temporada-evolucao ${dif > 0 ? "sobe" : dif < 0 ? "desce" : ""}`);
  evo.append(el("span", null, `OVR ${ev.antes} → ${ev.depois}`));
  const rot = { ...ROTULOS_LINHA, ...Object.fromEntries(EIXOS_GOLEIRO.map(([c, s]) => [c, s])) };
  for (const [k, v] of Object.entries(ev.mudou).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4)) {
    evo.append(el("span", `chip-attr ${v > 0 ? "sobe" : "desce"}`, `${rot[k] || k} ${v > 0 ? "+" : ""}${v}`));
  }
  alvo.append(evo);
  const avisos = [];
  if (linha.titulos.length) avisos.push(`Título: ${linha.titulos.join(", ")}.`);
  if (linha.divisao) avisos.push(`${linha.divisao}.`);
  else if (linha.rebaixado) avisos.push("O time terminou na zona de rebaixamento.");
  if (linha.olheiro && linha.ofertas && linha.ofertas.length) avisos.push("Tinha olheiro na arquibancada.");
  if (linha.ofertas && linha.ofertas.length && !linha.transferencia) avisos.push(`Sondado por ${linha.ofertas.join(", ")}; ficou.`);
  if (linha.transferencia) avisos.push(`Transferido pro ${linha.transferencia.para} (${linha.transferencia.liga}) por ${dinheiro(linha.transferencia.valor)}.`);
  if (linha.fim) avisos.push(`${linha.fim} aos ${linha.idade + 1} anos.`);
  for (const a of avisos) alvo.append(el("p", "temporada-aviso", a));
}

function proximaTemporada() {
  const linha = jogarTemporada();
  mostrarLinha(linha);
  desenharPainelJogador();
  desenharTabelaCarreira();
  if (C.J.aposentado) { $("proxima").textContent = "Ver a aposentadoria"; $("tudo").disabled = true; }
}

function simularCarreira() {
  let linha;
  while (!C.J.aposentado) linha = jogarTemporada();
  mostrarLinha(linha);
  desenharPainelJogador();
  desenharTabelaCarreira();
  mostrarAposentadoria();
}

// --- 5. aposentadoria --------------------------------------------------------------

function mostrarAposentadoria() {
  const J = C.J;
  const alvo = $("relatorio");
  alvo.replaceChildren();
  const tot = J.historico.reduce((a, h) => ({ j: a.j + h.jogos, g: a.g + h.gols, a: a.a + h.assist, s: a.s + (h.selecao ? h.selecao.jogos : 0), sg: a.sg + (h.selecao ? h.selecao.gols : 0) }), { j: 0, g: 0, a: 0, s: 0, sg: 0 });
  const auge = [...J.historico].sort((a, b) => b.ovr - a.ovr)[0];
  const melhor = [...J.historico].sort((a, b) => (b.gols + b.assist) - (a.gols + a.assist) || b.nota - a.nota)[0];
  const clubes = [...new Set(J.historico.map((h) => h.clube))];

  const topo = el("header", "bl-topo");
  const cartaAuge = el("div", "rel-carta");
  const attrsAuge = { ...J.attrs };
  cartaAuge.append(cartaDoCriado(auge.attrs || attrsAuge, auge.ovr, { time: auge.time, nome: auge.clube, kit: auge.kit }, { jogos: tot.j, minutos: 0 }));
  const textos = el("div", "bl-textos");
  const pais = paisDe(C.pais);
  textos.append(
    el("p", "bl-sobre", `${POSICOES[C.pos].nome} · ${pais.nome} · ${ANO_INICIAL}–${J.ano - 1}`),
    el("h3", "bl-nome", J.nome),
    el("p", "bl-manchete", `${J.historico.length} temporadas, ${clubes.length} ${clubes.length === 1 ? "clube" : "clubes"}, ${J.titulos.length} ${J.titulos.length === 1 ? "título" : "títulos"}, ${J.premios.length} ${J.premios.length === 1 ? "prêmio" : "prêmios"}`),
  );
  topo.append(cartaAuge, textos);

  const corpo = el("div", "bl-corpo");
  const esquerda = el("div", "bl-col"), direita = el("div", "bl-col");
  const sNum = el("section", "bl-bloco");
  sNum.append(el("h4", null, "Números da carreira"));
  const tiles = el("dl", "bl-tiles");
  const motm = J.historico.reduce((a, h) => a + (h.craqueDoJogo || 0), 0);
  for (const [k, v] of [["Jogos", tot.j], ["Gols", tot.g], ["Assist.", tot.a], ["OVR no auge", `${auge.ovr} (${auge.idade})`], ["Seleção", `${tot.s} J · ${tot.sg} G`], ["Craque do jogo", motm]]) {
    const d = el("div"); d.append(el("dd", null, String(v)), el("dt", null, k)); tiles.append(d);
  }
  sNum.append(tiles);
  const sDest = el("section", "bl-bloco");
  sDest.append(el("h4", null, "Destaques"));
  const dl = el("dl", "bl-destaques");
  const add = (k, v) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); dl.append(d); };
  add("Melhor temporada", `${melhor.ano} · ${melhor.clube} · ${melhor.gols} G, ${melhor.assist} A`);
  add("Auge", `${auge.ovr} de OVR aos ${auge.idade} (${auge.clube})`);
  add("Trajetória", clubes.join(" → "));
  if (J.transferencias.length) add("Maior venda", dinheiro(Math.max(...J.historico.filter((h) => h.transferencia).map((h) => h.transferencia.valor), 0)));
  sDest.append(dl);
  esquerda.append(sNum, sDest);
  const sGal = el("section", "bl-bloco");
  sGal.append(el("h4", null, `Galeria · ${J.titulos.length}`));
  if (!J.titulos.length) sGal.append(el("p", "nota", "Nenhum título. O lobo soprou forte."));
  else {
    const cont = {};
    for (const t of J.titulos) cont[t.nome.replace(/ \d{4}$/, "")] = (cont[t.nome.replace(/ \d{4}$/, "")] || 0) + 1;
    const ul = el("ul", "bl-campeoes");
    for (const [nome, n] of Object.entries(cont).sort((a, b) => b[1] - a[1])) {
      const li = el("li", "comp-bra");
      li.append(el("span", "bl-comp-nome", `${n}×`), el("strong", null, nome));
      ul.append(li);
    }
    sGal.append(ul);
  }
  const sPre = el("section", "bl-bloco");
  sPre.append(el("h4", null, `Prêmios individuais · ${J.premios.length}`));
  if (!J.premios.length) sPre.append(el("p", "nota", "Nenhum prêmio individual. Carreira de operário, que também faz falta."));
  else {
    const cont = {};
    for (const t of J.premios) (cont[t.nome] ||= []).push(t.ano);
    const ul = el("ul", "bl-campeoes bl-premios");
    for (const [nome, anos] of Object.entries(cont).sort((a, b) => b[1].length - a[1].length)) {
      const li = el("li", nome === "Bola de Ouro" ? "premio-ouro" : "");
      li.append(el("span", "bl-comp-nome", `${anos.length}×`), el("strong", null, nome));
      li.title = anos.join(", ");
      ul.append(li);
    }
    sPre.append(ul);
  }
  const melhorBola = Math.min(...J.historico.map((h) => h.bolaDeOuro || 99));
  if (melhorBola < 99) sPre.append(el("p", "nota", `Melhor colocação na Bola de Ouro: ${melhorBola}º.`));
  direita.append(sGal, sPre);
  corpo.append(esquerda, direita);

  const texto = [
    `${J.nome} (${POSICOES[C.pos].nome}, ${pais.nome}) no modo Carreira do Tem dado em casa`,
    `${J.historico.length} temporadas · ${tot.j} jogos · ${tot.g} gols · ${tot.a} assistências`,
    `Auge: ${auge.ovr} de OVR aos ${auge.idade} · Títulos: ${J.titulos.length} · Prêmios: ${J.premios.length}`,
    `Clubes: ${clubes.join(" → ")}`,
    "temdadoemcasa.github.io/carreira.html",
  ].join("\n");
  const rod = el("footer", "bl-rodape");
  const copiar = el("button", "botao", "Copiar resumo");
  copiar.type = "button";
  copiar.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); copiar.textContent = "Copiado"; }
    catch (_) { copiar.textContent = "Não deu pra copiar"; }
  });
  const denovo = el("button", "botao botao-primario", "Nova carreira");
  denovo.type = "button";
  denovo.addEventListener("click", () => { C.J = null; mostrarTela("criar"); });
  rod.append(copiar, denovo);
  alvo.append(topo, corpo, rod);
  mostrarTela("fim");
}

// --- liga tudo ------------------------------------------------------------------------

// Potencial escondido, por faixa: a maioria para entre 76 e 87; 10% chegam
// a 88-91, 7% a 92-94 e 5% viram o proximo Pele (95+). A carta montada so
// empurra um pouco.
const FAIXAS_POTENCIAL = [[0.05, 95, 97], [0.12, 92, 94], [0.22, 88, 91], [0.52, 83, 87], [0.82, 76, 82], [1, 68, 75]];
function sortearPotencial(ovr, f) {
  const rng = C.rng;
  const u = rng();
  const [, a, b] = FAIXAS_POTENCIAL.find(([ate]) => u < ate);
  const potencial = limitar(a + Math.floor(rng() * (b - a + 1)) + Math.round((ovr - 60) * 0.1), 64, 97);
  const pico = f === "GOL" ? 33 + Math.floor(rng() * 3) : Motor.sortearPeso(rng, [[28, 0.05], [29, 0.35], [30, 0.4], [31, 0.2]], ([, w]) => w)[0];
  return { potencial, potencialSorteado: potencial, idadePico: pico, ovrInicial: ovr };
}

function criarJogador() {
  const f = funcaoDe(C.pos);
  const ovr = ovrDe(C.attrs, f);
  C.J = {
    nome: C.nome || "Sem Nome", numero: C.numero, attrs: { ...C.attrs }, ovr, idade: IDADE_INICIAL, ano: ANO_INICIAL,
    ...sortearPotencial(ovr, f),
    clube: null, historico: [], titulos: [], premios: [], transferencias: [], valor: 0, anosNoClube: 0, aposentado: false,
  };
  reiniciarMundo();
  C.J.valor = valorDeMercado(C.J);
}

async function iniciarCarreiraPagina() {
  UNIFORMES = await json("dados/uniformes.json").catch(() => ({}));
  const [r, regras, exterior, inferiores] = await Promise.all([
    retrato("2026"), json("dados/competicoes-2026.json"), json("dados/clubes-exterior.json"), json("dados/clubes-brasil-inferiores.json"),
  ]);
  C.r = r; C.regras = regras; C.exterior = exterior; C.inferiores = inferiores;
  estado.r = r;
  usarCortes(r);
  inferirFuncoes(r);
  calibrarNivel();

  const nome = $("nome-camisa"), numero = $("numero-camisa");
  nome.addEventListener("input", () => { C.nome = nome.value.replace(/[^\p{L} .'-]/gu, "").slice(0, 14); nome.value = C.nome; atualizarPreviaCamisa(); });
  numero.addEventListener("input", () => { C.numero = limitar(Math.round(Number(numero.value) || 1), 1, 99); atualizarPreviaCamisa(); });
  numero.addEventListener("change", () => { numero.value = String(C.numero); });
  $("busca-pais").addEventListener("input", montarPaises);
  for (const b of document.querySelectorAll("[data-pe]")) {
    b.addEventListener("click", () => {
      C.pe = b.dataset.pe;
      for (const o of document.querySelectorAll("[data-pe]")) o.setAttribute("aria-pressed", String(o === b));
    });
  }
  for (const b of document.querySelectorAll("[data-modo]")) {
    b.addEventListener("click", () => {
      if (b.disabled) return;
      C.modo = b.dataset.modo;
      for (const o of document.querySelectorAll("[data-modo]")) o.setAttribute("aria-pressed", String(o === b));
    });
  }
  $("confirmar-jogador").addEventListener("click", () => {
    if (!C.nome.trim()) { nome.focus(); $("aviso-nome").hidden = false; return; }
    $("aviso-nome").hidden = true;
    iniciarCarta();
    mostrarTela("carta");
  });
  $("voltar-criacao").addEventListener("click", () => mostrarTela("criar"));
  $("zerar-pontos").addEventListener("click", iniciarCarta);
  $("confirmar-carta").addEventListener("click", () => { criarJogador(); mostrarPropostasDaBase(); });
  $("proxima").addEventListener("click", () => { if (C.J.aposentado) mostrarAposentadoria(); else proximaTemporada(); });
  $("tudo").addEventListener("click", simularCarreira);

  montarPaises();
  montarCampoPosicoes();
  atualizarPreviaCamisa();
}

iniciarCarreiraPagina().catch((erro) => {
  console.error(erro);
  $("paises").replaceChildren(el("div", "vazio", "O modo carreira não carregou agora. Tenta de novo daqui a pouco."));
});
