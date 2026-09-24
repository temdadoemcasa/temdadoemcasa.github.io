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
// teto da montagem aos 16 (o de 18 e 80, ver tetoDaIdade): o zagueiro
// nascia com 79 de fisico (64 + 15)
const TETO_NA_CRIACAO = 77;

// Gols e assistencias por jogo (90 min) pelo OVR, com referencias reais pra
// centroavante: ~0,35 um CA mediano, ~0,5 Pedro/Gabigol, ~0,65 Aguero,
// ~0,8 Mbappe, ~1,0 Haaland. Assistencia pra meia: ~0,35-0,4 De Bruyne.
// Liga mais fraca rende um pouco mais; as outras posicoes, uma fracao.
const interpolar = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
const CURVA_GOL = [[60, 0.1], [70, 0.19], [76, 0.27], [80, 0.35], [84, 0.47], [88, 0.66], [92, 0.9], [95, 1.05], [97, 1.12]];
const CURVA_ASSIST = [[60, 0.06], [70, 0.13], [80, 0.22], [88, 0.31], [95, 0.4], [97, 0.43]];
const FRACAO_GOL = { CA: 1, PON: 0.68, MEI: 0.45, MC: 0.2, VOL: 0.1, LAT: 0.07, ZAG: 0.09, GOL: 0 };
const FRACAO_ASSIST = { MEI: 1, PON: 0.85, MC: 0.6, CA: 0.5, LAT: 0.5, VOL: 0.55, ZAG: 0.12, GOL: 0.02 };
// O ritmo sai do OVR, mas o jeito de jogar vem dos atributos, comparados com o
// perfil normal da posicao: finalizacao e ritmo acima do normal viram gol (e
// o velocista puro da menos passe); passe e drible viram assistencia. Quem
// passa mais do que finaliza joga de falso 9: troca gol por assistencia.
// Perfil "normal" da posicao num dado OVR: a base de 16 anos mais o quanto
// cada atributo cresce, em media, por ponto de OVR (medido simulando
// carreiras sem foco de treino). Quem foge desse perfil tem estilo proprio.
const CRESCIMENTO = {
  CA: { RIT: 0.75, FIN: 1.41, PAS: 0.81, DRI: 0.8, DEF: 0.26, FIS: 0.77 }, PON: { RIT: 1.14, FIN: 0.91, PAS: 0.98, DRI: 1.17, DEF: 0.23, FIS: 0.22 },
  MEI: { RIT: 0.48, FIN: 0.77, PAS: 1.35, DRI: 1.22, DEF: 0.52, FIS: 0.51 }, MC: { RIT: 0.48, FIN: 0.54, PAS: 1.41, DRI: 0.77, DEF: 1.06, FIS: 0.76 },
  VOL: { RIT: 0.4, FIN: 0.21, PAS: 1.1, DRI: 0.2, DEF: 1.45, FIS: 0.76 }, LAT: { RIT: 1.18, FIN: 0.25, PAS: 1.02, DRI: 0.52, DEF: 1.33, FIS: 0.72 },
  ZAG: { RIT: 0.41, FIN: 0, PAS: 0.66, DRI: 0.21, DEF: 1.37, FIS: 1.03 }, GOL: { REF: 1.34, EVI: 1.1, MAO: 0.88, PES: 0.42, SAI: 0.69 },
};
// teto duro por idade: 80 aos 18 e +3 por ano, ate o teto do potencial (95
// aos 23). Sem ele o centroavante saia de 92 de finalizacao aos 19.
function tetoDaIdade(J, idade) {
  return Math.min(J.tetoAtributo ?? 95, 80 + 3 * (idade - 18));
}
function perfilEsperado(f, ovr) {
  const base = BASE[f], ob = ovrDe(base, f);
  return Object.fromEntries(Object.keys(base).map((k) => [k, Math.min(99, base[k] + (ovr - ob) * CRESCIMENTO[f][k])]));
}

// Gols e assistencias saem direto dos atributos (sempre: atributo maior,
// numero maior). Gol: finalizacao manda, ritmo e drible ajudam; atacante
// que vira marcador perde um pouco. Assistencia: passe manda, drible ajuda;
// o velocista puro passa menos. Quem passa mais do que finaliza (em relacao
// ao normal da posicao) joga de falso 9: troca gol por assistencia.
function ritmoDoJogador(J, nivelLiga) {
  const f = funcaoDe(C.pos);
  const liga = (72 - nivelLiga) * 0.2; // Serie D facilita, Premier League aperta
  const a = J.attrs;
  if (f === "GOL") return { gol: 0, assist: interpolar(CURVA_ASSIST, J.ovr + liga) * FRACAO_ASSIST.GOL, estilo: 0 };
  const notaGol = 0.5 * a.FIN + 0.2 * a.RIT + 0.15 * a.DRI + 0.1 * a.FIS + 0.05 * a.PAS - Math.max(0, a.DEF - 60) * 0.05 + liga - 2.5;
  const notaAssist = 0.5 * a.PAS + 0.3 * a.DRI + 0.1 * a.RIT + 0.1 * a.FIN - Math.max(0, a.RIT - a.PAS) * 0.05 + liga - 2.5;
  // falso 9 so existe la na frente (centroavante e ponta)
  const estilo = f === "CA" || f === "PON" ? limitar(((a.PAS - a.FIN) - (BASE[f].PAS - BASE[f].FIN)) / 40, 0, 0.4) : 0;
  return {
    gol: interpolar(CURVA_GOL, notaGol) * FRACAO_GOL[f] * (1 - estilo * 0.6),
    assist: interpolar(CURVA_ASSIST, notaAssist) * FRACAO_ASSIST[f] * (1 + estilo * 1.5),
    estilo,
  };
}
function poissonC(rng, media) {
  if (media > 30) return Math.max(0, Math.round(media + normal(rng, Math.sqrt(media))));
  const L = Math.exp(-media); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// gol e assistencia por jogo de um titular medio em cada funcao (motor/selecao antiga)
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
const dinheiro = (m) => `€${m.toLocaleString("pt-BR", { minimumFractionDigits: m < 10 ? 1 : 0, maximumFractionDigits: 1 })} mi`;
const normal = (rng, dp = 1) => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return dp * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const logistica = (x) => 1 / (1 + Math.exp(-x));

function mostrarTela(tela) {
  for (const t of ["criar", "carta", "base", "carreira", "fim"]) $(`tela-${t}`).hidden = t !== tela;
  for (const li of $("passos").children) {
    const alvo = { criar: "criar", carta: "carta", base: "peneira", carreira: "carreira", fim: "carreira" }[tela];
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

// --- tacas e premios em SVG (24x24): formato do trofeu + metal + fita da competicao --------

const METAL = { ouro: "#f2c230", prata: "#d3dae2", bronze: "#c9844c" };
const FORMAS = {
  copa: (c, f) => `<path d="M7 3h10v4.2a5 5 0 0 1-10 0z" fill="${c}"/><path d="M7 4.6H4.8a2.4 2.4 0 0 0 2.9 4.3M17 4.6h2.2a2.4 2.4 0 0 1-2.9 4.3" fill="none" stroke="${c}" stroke-width="1.4"/><rect x="11" y="12" width="2" height="4" fill="${c}"/><rect x="8" y="15.8" width="8" height="2.4" rx="0.5" fill="${c}"/><rect x="7" y="18.4" width="10" height="2.8" rx="0.6" fill="${f}"/><path d="M9.2 4.4v3" stroke="#fff" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round"/>`,
  orelhas: (c, f) => `<path d="M8 3h8v4.5a4 4 0 0 1-8 0z" fill="${c}"/><path d="M8.2 4.2C2.2 2.6 2.4 12.4 9 11.2M15.8 4.2c6-1.6 5.8 8.2-.8 7" fill="none" stroke="${c}" stroke-width="1.7"/><rect x="11" y="11.4" width="2" height="4.6" fill="${c}"/><rect x="8" y="15.8" width="8" height="2.4" rx="0.5" fill="${c}"/><rect x="7" y="18.4" width="10" height="2.8" rx="0.6" fill="${f}"/>`,
  alta: (c, f) => `<path d="M8.6 2h6.8v5.2a3.4 3.4 0 0 1-6.8 0z" fill="${c}"/><path d="M8.6 3.6H7a1.8 1.8 0 0 0 2 3.2M15.4 3.6H17a1.8 1.8 0 0 1-2 3.2" fill="none" stroke="${c}" stroke-width="1.1"/><path d="M11.2 10.4h1.6l.8 5.6h-3.2z" fill="${c}"/><rect x="8.5" y="15.8" width="7" height="2.4" rx="0.5" fill="${c}"/><rect x="7.5" y="18.4" width="9" height="2.8" rx="0.6" fill="${f}"/>`,
  prato: (c, f) => `<circle cx="12" cy="11.5" r="9" fill="${c}"/><circle cx="12" cy="11.5" r="6.2" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="1.2"/><circle cx="12" cy="11.5" r="2.6" fill="${f}"/><path d="M6.5 7.5a7 7 0 0 1 4-3" stroke="#fff" stroke-opacity="0.55" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  globo: (c, f) => `<circle cx="12" cy="6.6" r="4.4" fill="${c}"/><path d="M7.8 6.6h8.4M12 2.4v8.4" stroke="#000" stroke-opacity="0.22" stroke-width="0.8"/><path d="M8.8 18c0-4 1.2-6.2 3.2-7.6 2 1.4 3.2 3.6 3.2 7.6z" fill="${c}"/><rect x="7.5" y="18.2" width="9" height="3" rx="0.6" fill="${f}"/>`,
  bola: (c) => `<circle cx="12" cy="12" r="8.6" fill="${c}"/><polygon points="12,8.4 15.4,10.9 14.1,14.9 9.9,14.9 8.6,10.9" fill="#000" fill-opacity="0.28"/><path d="M12 8.4V3.6M15.4 10.9l4.3-1.6M14.1 14.9l2.7 3.8M9.9 14.9l-2.7 3.8M8.6 10.9L4.3 9.3" stroke="#000" stroke-opacity="0.25" stroke-width="0.9"/>`,
  medalha: (c, f) => `<path d="M7.5 2h3.3l2.4 6.4H9.9zM16.5 2h-3.3l-2.4 6.4h3.3z" fill="${f}"/><circle cx="12" cy="14.6" r="6" fill="${c}"/><circle cx="12" cy="14.6" r="3.8" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>`,
  luva: (c, f) => `<path d="M6.5 11V6.2a1.3 1.3 0 0 1 2.6 0V10V4.4a1.3 1.3 0 0 1 2.6 0V10V3.8a1.3 1.3 0 0 1 2.6 0V10V5a1.3 1.3 0 0 1 2.6 0v7.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.4-2.7L3.9 11.6a1.3 1.3 0 0 1 2.2-1.3z" fill="${c}"/><rect x="7.6" y="18.4" width="8.8" height="2.8" rx="0.6" fill="${f}"/>`,
  chuteira: (c, f) => `<path d="M3 13.5c2.5 0 4.5-1 6-3.5l2.4 1.2c1.2.6 3 .8 4.6.8 2.4 0 5 1.3 5 3.5v1.5H3z" fill="${c}"/><path d="M3 17h18" stroke="${f}" stroke-width="2.2"/><path d="M6 19v1.5M10 19v1.5M14 19v1.5M18 19v1.5" stroke="${c}" stroke-width="1.2"/>`,
};

// competicao (inicio do nome) -> [forma, metal, fita]
const TACAS = [
  ["Brasileirão", "copa", "ouro", "#c8ff00"], ["Copa do Brasil", "copa", "ouro", "#1f8f4e"],
  ["Libertadores", "alta", "prata", "#ff7d95"], ["Sul-Americana", "alta", "prata", "#5cc8ff"],
  ["Série B", "copa", "prata", "#8b949e"], ["Série C", "copa", "bronze", "#8b949e"], ["Série D", "copa", "bronze", "#6e7681"],
  ["Champions League", "orelhas", "prata", "#1b3a8f"], ["Champions da Ásia", "orelhas", "prata", "#0a7d6e"],
  ["Mundial de Clubes", "globo", "ouro", "#c8102e"], ["Copa do Mundo", "globo", "ouro", "#1f8f4e"], ["Copa América", "alta", "prata", "#ffdf00"],
  ["Premier League Russa", "copa", "prata", "#d52b1e"], ["Premier League", "copa", "ouro", "#6a2c91"], ["LaLiga", "copa", "prata", "#ee3124"],
  ["Serie A (Itália)", "alta", "prata", "#0b5fbf"], ["Bundesliga", "prato", "prata", "#d20515"], ["Ligue 1", "alta", "prata", "#0b1e5b"],
  ["Liga Portugal", "copa", "prata", "#0a6e3c"], ["Eredivisie", "prato", "prata", "#f36c21"], ["Liga Argentina", "copa", "prata", "#74acdf"],
  ["Saudi Pro League", "copa", "ouro", "#0a7d3c"],
  ["FA Cup", "copa", "prata", "#c8102e"], ["Copa do Rei", "copa", "prata", "#aa151b"], ["Coppa Italia", "copa", "prata", "#009246"],
  ["DFB-Pokal", "alta", "prata", "#111111"], ["Copa da França", "alta", "prata", "#002395"], ["Taça de Portugal", "copa", "prata", "#006600"],
  ["Copa da Holanda", "copa", "prata", "#21468b"], ["Copa Argentina", "copa", "prata", "#74acdf"], ["Copa do Rei Saudita", "copa", "ouro", "#0a7d3c"],
  ["Copa da Rússia", "copa", "prata", "#0039a6"],
];
function formaDoPremio(nome) {
  if (nome.startsWith("Bola de Ouro")) return ["bola", "ouro", "#f2c230"];
  if (nome.startsWith("Luva de Ouro")) return ["luva", "ouro", "#f2c230"];
  if (nome.startsWith("Artilheiro")) return ["chuteira", "ouro", "#111111"];
  if (nome.startsWith("Craque")) return ["medalha", "ouro", "#c8ff00"];
  if (nome.startsWith("Revelação")) return ["medalha", "prata", "#5cc8ff"];
  return ["medalha", "prata", "#5cc8ff"];
}

// icone de uma taca (titulo) ou de um premio individual
function taca(nome, { premio = false, tamanho = "" } = {}) {
  const achado = premio ? formaDoPremio(nome) : (TACAS.find(([n]) => nome.startsWith(n)) || [null, "copa", "prata", "#8b949e"]).slice(1);
  const [forma, metal, fita] = achado;
  const s = el("span", `taca${tamanho ? ` taca-${tamanho}` : ""}`);
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${FORMAS[forma](METAL[metal], fita)}</svg>`;
  s.title = nome;
  return s;
}

// Escudo generico nas cores do clube, com a sigla (nao e o escudo oficial)
const SIGLAS_FORA = {
  "Real Madrid": "RMA", "Barcelona": "BAR", "Atlético de Madrid": "ATM", "Manchester City": "MCI", "Manchester United": "MUN",
  "Paris Saint-Germain": "PSG", "Bayern de Munique": "BAY", "Borussia Dortmund": "BVB", "Bayer Leverkusen": "B04", "Inter": "INT",
  "Juventus": "JUV", "Milan": "MIL", "River Plate": "RIV", "Boca Juniors": "BOC", "Al-Hilal": "HIL", "Al-Nassr": "NAS",
  "Olympique de Marseille": "OM", "Athletic Bilbao": "ATH", "América-MG": "AMG", "Atlético-GO": "ACG", "Botafogo-SP": "BFC",
};
function escudo(c, tamanho = "") {
  // desenho generico por clube (escudos.js + dados/escudos.json), nunca o original
  const time = timeParaCamisa(c);
  const s = el("span", `escudo${tamanho ? ` escudo-${tamanho}` : ""}`);
  s.innerHTML = Escudos.svg(c.nome, { kit: kitDoTime(time), sigla: SIGLAS_FORA[c.nome] || siglaClube(c.nome) });
  s.title = c.nome;
  return s;
}

// Estilo de jogo: o atributo que mais foge do normal da posicao (no mesmo
// OVR) da o nome. Cada posicao tem os seus; o efeito em campo sai dos
// atributos (gol, assistencia, jogos sem sofrer, lesao).
const ESTILOS = {
  CA: { FIN: ["Matador", "vive de gol"], RIT: ["Atacante de velocidade", "ataca o espaço: mais gol, menos passe"], PAS: ["Falso 9", "troca gol por assistência"],
    DRI: ["Segundo atacante", "cria e finaliza"], FIS: ["Pivô", "segura a bola e ganha no corpo"], DEF: ["Atacante operário", "ajuda sem a bola, marca menos"] },
  PON: { RIT: ["Ponta veloz", "ganha na corrida"], DRI: ["Driblador", "cria jogadas e assistências"], FIN: ["Ponta goleador", "entra em diagonal pra finalizar"],
    PAS: ["Ponta garçom", "vive de assistência"], FIS: ["Ponta de força", "aguenta o tranco"], DEF: ["Ponta operário", "volta pra marcar"] },
  MEI: { PAS: ["Armador clássico", "o camisa 10 que dá o passe"], DRI: ["Meia driblador", "quebra linhas no drible"], FIN: ["Meia chegador", "aparece na área pra fazer gol"],
    RIT: ["Meia de transição", "puxa o contra-ataque"], FIS: ["Meia de força", "ganha as divididas"], DEF: ["Meia marcador", "pressiona a saída"] },
  MC: { PAS: ["Construtor", "dita o ritmo do jogo"], DEF: ["Box-to-box", "defende e ataca"], FIN: ["Meia que chega", "chuta de fora e aparece na área"],
    DRI: ["Condutor", "carrega a bola"], FIS: ["Motorzinho", "corre o jogo inteiro"], RIT: ["Carrilero", "ocupa o corredor"] },
  VOL: { DEF: ["Cão de guarda", "protege a zaga"], PAS: ["Volante construtor", "sai jogando lá de trás"], FIS: ["Volante de contenção", "ganha no corpo"],
    RIT: ["Volante de transição", "recupera e acelera"], DRI: ["Volante que conduz", "escapa da pressão no drible"], FIN: ["Volante artilheiro", "chute de fora da área"] },
  LAT: { RIT: ["Lateral ala", "vive no ataque"], PAS: ["Lateral construtor", "cruza e dá assistência"], DEF: ["Lateral marcador", "fecha o lado"],
    DRI: ["Lateral driblador", "passa pelo marcador"], FIS: ["Lateral de força", "aguenta o jogo todo"], FIN: ["Lateral artilheiro", "aparece pra finalizar"] },
  ZAG: { DEF: ["Xerife", "ninguém passa"], PAS: ["Zagueiro construtor", "inicia a jogada"], RIT: ["Zagueiro veloz", "cobre as costas da defesa"],
    FIS: ["Zagueiro de força", "ganha tudo pelo alto"], DRI: ["Zagueiro que sai jogando", "conduz até o meio"], FIN: ["Zagueiro artilheiro", "perigo na bola parada"] },
  GOL: { REF: ["Paredão", "defesas difíceis"], EVI: ["Fechador de gol", "sofre menos do que devia"], MAO: ["Mão firme", "segura tudo"],
    PES: ["Goleiro líbero", "joga com os pés"], SAI: ["Dono da área", "sai bem do gol"] },
};
function estiloDeJogo(attrs, pos) {
  const f = POSICOES[pos].funcao;
  const esp = perfilEsperado(f, ovrDe(attrs, f));
  const [k, v] = Object.keys(esp).map((c) => [c, attrs[c] - esp[c]]).sort((a, b) => b[1] - a[1])[0];
  if (v < 4) return { nome: "Equilibrado", dica: "rende como a média da posição", k: null };
  const [nome, dica] = ESTILOS[f][k];
  return { nome, dica, k };
}

// O estilo pesa na carreira TODO ANO, com um lado bom e um ruim (pedido do
// dono, 25/09): quem vive de gol assiste menos, o velocista se machuca mais,
// o operario joga sempre e aparece pouco. Chave = o atributo que define o
// estilo; equilibrado nao ganha nem perde nada.
const EFEITO_DO_ESTILO = {
  FIN: { bom: "mais gols e mais holofote", ruim: "menos assistências; sem gol, o técnico tira",
    aplicar: (e) => { e.gol += 0.12; e.vitrine += 1; e.assist -= 0.2; e.minutos -= 0.02; } },
  RIT: { bom: "mais gols no contra-ataque e valor de mercado", ruim: "mais lesão muscular; cai rápido depois dos 30",
    aplicar: (e, J) => { e.gol += 0.06; e.vitrine += 1.5; e.lesao += 0.04; if (J.idade >= 30) e.queda -= 0.4; } },
  FIS: { bom: "se machuca menos e ganha a vaga no corpo", ruim: "menos assistências; a imprensa chama de limitado",
    aplicar: (e) => { e.lesao = Math.max(0, e.lesao - 0.04); e.minutos += 0.03; e.assist -= 0.1; e.vitrine -= 0.8; } },
  PAS: { bom: "mais assistências; o vestiário te ouve", ruim: "menos gols; a torcida cobra finalização",
    aplicar: (e) => { e.assist += 0.15; e.evolucao += 0.2; e.gol -= 0.12; e.vitrine -= 0.5; } },
  DRI: { bom: "mais assistências e vitrine pro mercado", ruim: "perde bola: nota oscila e o técnico barra às vezes",
    aplicar: (e) => { e.assist += 0.1; e.vitrine += 1.2; e.nota -= 0.05; e.minutos -= 0.02; } },
  DEF: { bom: "o técnico confia: titular estável e carreira longa", ruim: "menos gols e pouca vitrine",
    aplicar: (e) => { e.minutos += 0.04; e.queda += 0.3; e.gol -= 0.15; e.vitrine -= 1; } },
  REF: { bom: "defesas difíceis sobem a nota", ruim: "reflexo cai cedo com a idade",
    aplicar: (e, J) => { e.nota += 0.06; if (J.idade >= 31) e.queda -= 0.3; } },
  EVI: { bom: "sofre menos gol: técnico confia", ruim: "discreto, aparece pouco",
    aplicar: (e) => { e.minutos += 0.03; e.vitrine -= 0.5; } },
  MAO: { bom: "segura tudo e se machuca menos", ruim: "sem defesa de TV, pouca vitrine",
    aplicar: (e) => { e.nota += 0.03; e.lesao = Math.max(0, e.lesao - 0.02); e.vitrine -= 0.5; } },
  PES: { bom: "joga com os pés: evolui e chama atenção", ruim: "arrisca a saída e às vezes paga caro",
    aplicar: (e) => { e.evolucao += 0.2; e.vitrine += 0.5; e.nota -= 0.04; } },
  SAI: { bom: "domina a área e sobe a nota", ruim: "sai muito do gol e se machuca mais",
    aplicar: (e) => { e.nota += 0.04; e.lesao += 0.03; } },
};
const efeitoDoEstilo = (est) => (est && est.k ? EFEITO_DO_ESTILO[est.k] : null);

// --- 1. criacao ------------------------------------------------------------------------

// Bandeiras desenhadas em SVG (30x20), simplificadas mas fieis nas cores e no desenho
function estrela(cx, cy, r, cor, giro = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (giro + i * 36) * Math.PI / 180, rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${cor}"/>`;
}
const faixasH = (...cores) => cores.map((c, i) => `<rect y="${(20 / cores.length) * i}" width="30" height="${20 / cores.length + 0.05}" fill="${c}"/>`).join("");
const faixasV = (...cores) => cores.map((c, i) => `<rect x="${(30 / cores.length) * i}" width="${30 / cores.length + 0.05}" height="20" fill="${c}"/>`).join("");
const BANDEIRAS = {
  BRA: `<rect width="30" height="20" fill="#009c3b"/><polygon points="15,2.2 27.4,10 15,17.8 2.6,10" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.7 9.1 Q15 7.6 19.3 11" stroke="#fff" stroke-width="0.8" fill="none"/>`,
  ARG: faixasH("#74acdf", "#fff", "#74acdf") + `<circle cx="15" cy="10" r="1.9" fill="#f6b40e"/>`,
  URU: Array.from({ length: 9 }, (_, i) => `<rect y="${i * 20 / 9}" width="30" height="${20 / 9 + 0.05}" fill="${i % 2 ? "#0038a8" : "#fff"}"/>`).join("")
    + `<rect width="11" height="${20 / 9 * 5}" fill="#fff"/><circle cx="5.5" cy="5.5" r="2.8" fill="#fcd116"/><circle cx="5.5" cy="5.5" r="1.7" fill="#fcd116" stroke="#7b3f00" stroke-width="0.3"/>`,
  COL: `<rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/>`,
  CHI: `<rect width="30" height="20" fill="#fff"/><rect y="10" width="30" height="10" fill="#d52b1e"/><rect width="10" height="10" fill="#0039a6"/>${estrela(5, 5, 2.8, "#fff")}`,
  PAR: faixasH("#d52b1e", "#fff", "#0038a8") + `<circle cx="15" cy="10" r="2.2" fill="none" stroke="#1b5e20" stroke-width="0.5"/>${estrela(15, 10, 1, "#fcd116")}`,
  EQU: `<rect width="30" height="10" fill="#ffdd00"/><rect y="10" width="30" height="5" fill="#034ea2"/><rect y="15" width="30" height="5" fill="#ed1c24"/><ellipse cx="15" cy="10" rx="2.4" ry="3" fill="#5ba3d9" stroke="#7b5a2f" stroke-width="0.4"/>`,
  PER: faixasV("#d91023", "#fff", "#d91023"),
  VEN: faixasH("#ffcc00", "#00247d", "#cf142b") + Array.from({ length: 8 }, (_, i) => { const a = (200 + i * 20) * Math.PI / 180; return estrela(15 + 5.2 * Math.cos(a), 12.3 + 5.2 * Math.sin(a), 0.75, "#fff"); }).join(""),
  BOL: faixasH("#d52b1e", "#f9e300", "#007934"),
  MEX: faixasV("#006847", "#fff", "#ce1126") + `<ellipse cx="15" cy="10" rx="2" ry="2.3" fill="#8c5a2b"/><path d="M12.8 11.6 Q15 13.4 17.2 11.6" stroke="#1b5e20" stroke-width="0.6" fill="none"/>`,
  EUA: Array.from({ length: 13 }, (_, i) => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13 + 0.05}" fill="${i % 2 ? "#fff" : "#b22234"}"/>`).join("")
    + `<rect width="12" height="${20 / 13 * 7}" fill="#3c3b6e"/>` + Array.from({ length: 20 }, (_, i) => `<circle cx="${1.3 + (i % 5) * 2.35 + (Math.floor(i / 5) % 2) * 1.1}" cy="${1.3 + Math.floor(i / 5) * 2.6}" r="0.45" fill="#fff"/>`).join(""),
  POR: `<rect width="30" height="20" fill="#ff0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.6" fill="none" stroke="#ffe000" stroke-width="1"/><path d="M10.3 8.2h3.4v2.6a1.7 1.7 0 0 1-3.4 0z" fill="#fff" stroke="#ff0000" stroke-width="0.6"/>`,
  ESP: `<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.6" width="3.2" height="4.4" rx="0.6" fill="#aa151b"/><rect x="7.6" y="8.2" width="2" height="1.6" fill="#f1bf00"/>`,
  FRA: faixasV("#002395", "#fff", "#ed2939"),
  ING: `<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#ce1124"/><rect y="8" width="30" height="4" fill="#ce1124"/>`,
  ALE: faixasH("#000", "#dd0000", "#ffce00"),
  ITA: faixasV("#009246", "#fff", "#ce2b37"),
  HOL: faixasH("#ae1c28", "#fff", "#21468b"),
  BEL: faixasV("#000", "#fdda24", "#ef3340"),
  MAR: `<rect width="30" height="20" fill="#c1272d"/><polygon points="${Array.from({ length: 5 }, (_, i) => { const a = (-90 + i * 144) * Math.PI / 180; return `${(15 + 4.2 * Math.cos(a)).toFixed(2)},${(10.4 + 4.2 * Math.sin(a)).toFixed(2)}`; }).join(" ")}" fill="none" stroke="#006233" stroke-width="0.9" stroke-linejoin="round"/>`,
  JAP: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>`,
  COR: `<rect width="30" height="20" fill="#fff"/><g transform="rotate(33.7 15 10)"><path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0"/><circle cx="12.5" cy="10" r="2.5" fill="#cd2e3a"/><circle cx="17.5" cy="10" r="2.5" fill="#0047a0"/></g>`
    + [[4.5, 3.5, -33.7], [25.5, 16.5, -33.7], [25.5, 3.5, 33.7], [4.5, 16.5, 33.7]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})" fill="#000"><rect x="${x - 2.2}" y="${y - 1.9}" width="4.4" height="0.8"/><rect x="${x - 2.2}" y="${y - 0.4}" width="4.4" height="0.8"/><rect x="${x - 2.2}" y="${y + 1.1}" width="4.4" height="0.8"/></g>`).join(""),
};
// Croacia: o xadrez do escudo
BANDEIRAS.CRO = faixasH("#ff0000", "#fff", "#171796") + `<rect x="12.2" y="5.2" width="5.6" height="7.2" rx="0.4" fill="#fff" stroke="#171796" stroke-width="0.3"/>`
  + Array.from({ length: 20 }, (_, i) => { const c = i % 4, l = Math.floor(i / 4); return (c + l) % 2 ? "" : `<rect x="${12.2 + c * 1.4}" y="${5.2 + l * 1.44}" width="1.4" height="1.44" fill="#ff0000"/>`; }).join("");

function bandeira(p) {
  const b = el("span", "bandeira");
  b.innerHTML = `<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${BANDEIRAS[p.id] || faixasH(...p.cores)}</svg>`;
  b.title = p.nome;
  return b;
}

function atualizarPreviaCamisa() {
  const p = paisDe(C.pais);
  $("previa-costas").replaceChildren(camisaDeCostas(p.kit, C.nome, C.numero));
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
  const est = estiloDeJogo(C.attrs, C.pos);
  const efe = efeitoDoEstilo(est);
  $("estilo-montagem").replaceChildren(...(est ? [
    el("span", null, `Estilo: ${est.nome} · ${est.dica}`),
    ...(efe ? [el("small", "renova-bom", `+ ${efe.bom}`), el("small", "renova-ruim", `− ${efe.ruim}`)] : []),
  ] : []));
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
    mais.disabled = C.pontos < PASSO || gasto >= MAX_POR_ATRIBUTO || C.attrs[k] + PASSO > TETO_NA_CRIACAO;
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

// Meia a 5 estrelas numa escala so pro mundo todo: Serie D ~0,5-1,
// C ~1-1,5, B ~1,5-2,5, Serie A ~2,5-4, elite europeia 4,5-5
function estrelas(forca) {
  return limitar(Math.round((forca - 32) / 7 * 2) / 2, 0.5, 5);
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
  const esperados = Math.round(fracaoDeMinutos(s) * jogos);
  const quem = c.titular ? `${c.titular.nome} (${c.titular.overall})` : `nível ${Math.round(c.nivel)}`;
  return { s, texto: `Titular hoje: ${quem}`, minutos: `~${esperados} de ${jogos} jogos ${daLiga(c.liga).replace(/^d/, "n")}` };
}

function mostrarPropostasDaBase() {
  mostrarTela("base");
  desenharPainelJogador();
  const alvo = $("propostas-base");
  alvo.replaceChildren();
  for (const c of propostasIniciais()) alvo.append(cartaoDeProposta(c, () => assinar(c, "base")));
}

function cartaoDeProposta(c, aoAssinar, { rotulo = "Assinar", extra = null, contexto = null } = {}) {
  const J = C.J;
  const card = el("article", "proposta");
  const camisa = el("span", "proposta-camisa");
  camisa.append(figura(timeParaCamisa(c), J.numero, { cabeca: false }), escudo(c, "m"));
  const est = el("span", "estrelas");
  const n = estrelas(c.forca);
  for (let i = 0; i < 5; i++) est.append(el("i", i + 1 <= n ? "cheia" : i + 0.5 === n ? "meia" : ""));
  est.setAttribute("aria-label", `${String(n).replace(".", ",")} de 5 estrelas`);
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
    chance, (() => {
      const p = el("p", "proposta-minutos");
      const txt = el("span", "proposta-chance-txt");
      txt.append(el("span", "proposta-chance-rotulo", "Chance de ser titular: "), el("b", null, `${Math.round(t.s * 100)}%`));
      p.append(txt,
        el("span", "proposta-jogos", c.tipo !== "ext" ? t.minutos : `nível do titular ~${Math.round(c.nivel)}`));
      return p;
    })(),
  );
  const adapta = contexto === "mercado" ? custoDeAdaptacao(J.clube, c) : null;
  if (adapta) card.append(el("p", "proposta-adapta", adapta.texto));
  const acoes = el("div", "proposta-acoes");
  acoes.append(botao);
  if (extra) {
    const b2 = el("button", "botao", extra.rotulo);
    b2.type = "button";
    b2.addEventListener("click", () => extra.acao(card, b2));
    acoes.append(b2);
  }
  card.append(acoes);
  return card;
}

// adaptacao: o 1o ano no clube novo evolui menos (outro continente, bem menos);
// quem fica no clube ganha entrosamento (ver jogarTemporada)
// Russia ("leste") e Europa: mesmo continente. Clube sem pais e brasileiro.
const continenteDe = (c) => ({ leste: "europa" })[c.continente] || c.continente || "america";
const paisDoClube = (c) => (c.tipo === "ext" ? c.pais || c.liga : "Brasil");
function custoDeAdaptacao(de, para) {
  if (!de || de.id === para.id) return null;
  if (continenteDe(de) !== continenteDe(para)) return { evolucao: -1.2, nota: -0.15, texto: "adaptação difícil: outro continente, outro futebol" };
  if (paisDoClube(de) !== paisDoClube(para)) return { evolucao: -0.9, nota: -0.1, texto: "adaptação: outro país, outra língua" };
  return { evolucao: -0.6, nota: -0.08, texto: "1º ano de adaptação: evolui menos" };
}

function assinar(c, contexto) {
  const J = C.J;
  const adapta = contexto === "base" ? null : custoDeAdaptacao(J.clube, c);
  if (adapta) { J.efeito.evolucao += adapta.evolucao; J.efeito.nota += adapta.nota; }
  if (J.clube && J.clube.id !== c.id) { J.transferencias.push({ ano: J.ano, de: J.clube.nome, para: c.nome }); Historia.novoClube(J); }
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
  return { id: nome, nome, atq: forca + d, def: forca + d, artilheiros: Motor.artilheirosDoElenco(nome) };
}

// o clube do jogador: reforco dele e ele na lista de quem faz gol
function prepararClube(clube, J, rng) {
  const s = chanceDeTitular(J.ovr, J.clube.nivel, J.idade);
  const p = minutosDe(J, s);
  reforcoDoJogador(clube, J, p, J.clube.nivel);
  // os companheiros saem do elenco de verdade quando o futdata tem (peso
  // total 5, o mesmo do "__outro" de antes)
  const companheiros = Motor.artilheirosDoElenco(clube.nome, 5);
  clube.artilheiros = [{ nome: J.nome, peso: pesoDeGol(J) * p }, ...(companheiros.length ? companheiros : [{ nome: "__outro", peso: 5 }])];
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
    if (!n) return c;
    return { nome: n, forca: forcaNoMundo(n), uniforme: C.inf.get(n)?.uniforme };
  });
  const times = { ...Motor.timesDeFora(regras), ...reais, ...subiram };
  // clube que subiu ano passado e ja caiu ainda pode estar no grupo continental
  for (const [nome, d] of C.inf) if (!times[nome]) times[nome] = { ...timeAbstrato(nome, d.forca, rng, ano), kit: d.uniforme };
  const clube = times[J.clube.id];
  const s = chanceDeTitular(J.ovr, J.clube.nivel, J.idade);
  const p = minutosDe(J, s);
  reforcoDoJogador(clube, J, p, J.clube.nivel);
  clube.artilheiros = [...(clube.artilheiros || []), { nome: J.nome, pos: POSICOES[C.pos].fam, peso: pesoDeGol(J) * p }];
  if (clube.artilheiros.length === 1) {
    const companheiros = Motor.artilheirosDoElenco(clube.nome, 5);
    clube.artilheiros.push(...(companheiros.length ? companheiros : [{ nome: "__outro", peso: 5 }]));
  }
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
// Selecao: convocado se o OVR passa o corte do pais e esta jogando no clube.
// Ano de Copa do Mundo (2030, 2034...) ou Copa America (2028, 2032...) tem
// torneio fase a fase, com gols, assistencias e premios proprios.
const FASES_COPA = ["Fase de grupos", "Oitavas", "Quartas", "Semifinal", "Vice", "Campeão"];
function temporadaNaSelecao(J, ano, rng, p) {
  const pais = paisDe(C.pais);
  if (J.ovr < pais.corte || p < 0.45) return null;
  const f = funcaoDe(C.pos);
  const ritmo = ritmoDoJogador(J, 76); // selecao: nivel de jogo internacional
  const golPorJogo = Math.min(0.9, ritmo.gol * 0.85);
  const assistPorJogo = Math.min(0.6, ritmo.assist * 0.85);
  const r = { jogos: 4 + Math.floor(rng() * 6), gols: 0, assist: 0, titulos: [], premios: [] };
  for (let i = 0; i < r.jogos; i++) { if (rng() < golPorJogo) r.gols++; if (rng() < assistPorJogo) r.assist++; }
  if (!J.estreouSelecao) { r.estreia = true; J.estreouSelecao = ano; }
  const copa = ano % 4 === 2 && ano > ANO_INICIAL;
  const torneio = copa ? `Copa do Mundo ${ano}` : ano % 4 === 0 && SUL_AMERICANOS.includes(pais.id) ? `Copa América ${ano}` : null;
  if (!torneio) return r;
  // chance de titulo -> chance de passar cada fase (5 passagens ate a taca)
  const base = copa ? pais.copa * 0.8 : Math.min(0.25, pais.copa * 1.4);
  const titulo = limitar(base * (1 + (J.ovr - pais.corte) / 40), 0.002, 0.45);
  const passa = Math.pow(titulo, 1 / 5);
  let k = 0;
  while (k < 5 && rng() < (k === 0 ? Math.max(passa, 0.7) : passa)) k++;
  const tj = 3 + Math.min(k, 4);
  let tg = 0, ta = 0;
  for (let i = 0; i < tj; i++) { if (rng() < golPorJogo * 1.1) tg++; if (rng() < assistPorJogo) ta++; }
  Object.assign(r, { torneio, torneioRes: FASES_COPA[k], torneioJogos: tj, torneioGols: tg, torneioAssist: ta });
  r.jogos += tj; r.gols += tg; r.assist += ta;
  if (k === 5) r.titulos.push(torneio);
  const nome = torneio.replace(/ \d{4}$/, "");
  const craque = k >= 4 && rng() < logistica((J.ovr - 92 + (k === 5 ? 1.5 : 0) + (tg + ta * 0.5 - 3) * 0.5) / 1.2);
  if (craque) r.premios.push(`Craque da ${nome}`);
  if (f !== "GOL" && tg >= Math.max(4, Math.round(5 + normal(rng, 1.2)))) r.premios.push(`Artilheiro da ${nome}`);
  if (f === "GOL" && k >= 4 && J.ovr >= 82 && rng() < 0.5) r.premios.push(`Luva de Ouro da ${nome}`);
  if (!craque && k >= 2 && rng() < logistica((J.ovr - 89.5 + k * 0.4) / 1.6)) r.premios.push(`Seleção da ${nome}`);
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
    if (ultima && ultima.nota >= 7.4 && rng() < 0.4) J.potencial = Math.min(J.potencialSorteado + 1, J.tetoOvr ?? 95, J.potencial + 1);
    if (p < 0.3 && rng() < 0.5) J.potencial = Math.max(J.potencialSorteado - 3, 76, J.potencial - 1);
  }
  const proxima = J.idade + 1;
  let delta;
  if (proxima <= J.idadePico) {
    const m = limitar(0.5 + 0.6 * p, 0.5, 1); // quem nao joga cresce menos (e recupera depois, em parte)
    delta = (trajetoria(J, proxima) - J.ovr) * 0.8 * m + normal(rng, 0.8) + J.efeito.evolucao;
  } else {
    const k = proxima - J.idadePico; // anos depois do pico
    const queda = [0, -0.4, -0.9, -1.5, -2.1, -2.8][k] ?? -3.4;
    delta = Math.min(0.5, queda + J.efeito.queda + J.efeito.evolucao * 0.5) + normal(rng, 0.7);
  }
  const mudou = {};
  let alvo = limitar(Math.round(antes + limitar(delta, -6, 8)), 40, J.tetoOvr ?? 95);
  if (proxima <= J.idadePico) alvo = Math.min(alvo, Math.max(antes, J.potencial + Math.max(0, Math.round(J.efeito.evolucao)))); // nao passa do teto
  const pesos = Object.entries(PESOS[f]).filter(([, w]) => w > 0);
  // sobe (ou desce) atributo a atributo, puxado pelo peso da funcao, ate o OVR bater
  // foco de treino: os primeiros pontos do ano vao pro atributo escolhido
  // (mesmo que ele pese pouco no OVR); na queda, ele e o ultimo a cair
  let pontosDeFoco = J.foco && J.foco in J.attrs ? 3 : 0;
  const tetoIdade = tetoDaIdade(J, proxima);
  if (pontosDeFoco && alvo <= antes) {
    if (J.attrs[J.foco] < tetoIdade) { J.attrs[J.foco] += 1; mudou[J.foco] = 1; J.ovr = ovrDe(J.attrs, f); }
    pontosDeFoco = 0;
  }
  for (let guarda = 0; J.ovr !== alvo && guarda < 1500; guarda++) {
    const sobe = J.ovr < alvo;
    let k;
    if (sobe && pontosDeFoco > 0) { k = J.foco; pontosDeFoco--; }
    else if (sobe) {
      // cada um melhora mais no que ja e bom: o estilo da carta se mantem
      const esp = perfilEsperado(f, J.ovr);
      const forte = pesos.map(([c, w]) => [c, w * (1 + Math.max(0, J.attrs[c] - esp[c]) / 16)]);
      k = Motor.sortearPeso(rng, forte, ([, w]) => w)[0];
    }
    else {
      // o corpo cai primeiro: ritmo e fisico perdem mais
      const queda = pesos.map(([c, w]) => [c, w * (["RIT", "FIS", "REF"].includes(c) ? 2.5 : 1) * (c === J.foco ? 0.3 : 1)]);
      k = Motor.sortearPeso(rng, queda, ([, w]) => w)[0];
    }
    // teto suave: acima de 85 cada ponto fica mais dificil; 99 e raridade
    // teto suave: perto do teto cada ponto fica mais dificil (teto 95; lenda 99)
    const teto = J.tetoAtributo ?? 95;
    if (sobe && J.attrs[k] >= tetoIdade) continue; // garoto nao chega a 90 de nada
    if (sobe && J.attrs[k] >= teto - 12 && rng() > Math.pow((teto - J.attrs[k]) / 12, 1.4)) continue;
    const novo = limitar(J.attrs[k] + (sobe ? 1 : -1), 20, sobe ? teto : 99);
    if (novo === J.attrs[k]) continue;
    J.attrs[k] = novo;
    mudou[k] = (mudou[k] || 0) + (sobe ? 1 : -1);
    J.ovr = ovrDe(J.attrs, f);
  }
  const foco = J.foco;
  J.foco = null;
  return { antes, depois: J.ovr, mudou, foco };
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
  if (f === "GOL" && regular && linha.semSofrer >= Math.max(5, Math.round(jl * 0.42 + normal(rng, 1.5)))) premios.push(`Luva de Ouro ${da}`);
  const jaGanhou = (nome) => J.premios.filter((x) => x.nome === nome).length;
  const melhor = `Melhor ${NOME_DA_POSICAO(C.pos)} ${da}`;
  // premio repetido fica mais dificil a cada vez (a concorrencia tambem joga)
  if (regular && linha.nota >= 7.5 + jaGanhou(melhor) * 0.18 + normal(rng, 0.2)) premios.push(melhor);
  if (regular && linha.nota >= 7.95 + jaGanhou(`Craque ${da}`) * 0.25 + normal(rng, 0.25)) premios.push(`Craque ${da}`);
  if (J.idade <= 20 && t.p >= 0.45 && (J.clube.divisao === "A" || J.clube.tipo === "ext") && linha.nota >= 7.15 + normal(rng, 0.2)
    && !J.premios.some((x) => x.nome.startsWith("Revelação"))) premios.push(`Revelação ${da}`);

  // craque da partida: jogo a jogo, puxado pela nota da temporada
  const pm = linha.nota === null ? 0.01 : limitar(0.03 + (linha.nota - 6.4) * 0.14 + (linha.jogos ? (linha.gols + linha.assist * 0.5) / linha.jogos : 0) * 0.18, 0.01, 0.55);
  let motm = 0;
  for (let i = 0; i < linha.jogos; i++) if (rng() < pm) motm++;
  linha.craqueDoJogo = motm;

  // Bola de Ouro (o mundo) e Craque da America
  const tem = (nome) => [...linha.titulos, ...(linha.selecao ? linha.selecao.titulos : [])].some((x) => x.startsWith(nome));
  const base = linha.nota === null ? -Infinity : J.ovr + (linha.nota - 7) * 2.5 + (premios.some((x) => x.startsWith("Artilheiro")) ? 1 : 0) + (t.campeaoLiga ? 0.4 * J.clube.prestigio : 0);
  if (t.p >= 0.5) {
    const mundo = base + (tem("Champions League") ? 3 : tem("Libertadores") ? 1.5 : 0) + (tem("Copa do Mundo") ? 4 : tem("Copa América") ? 1.2 : 0)
      - (5 - J.clube.prestigio) * 1.3;
    const lugar = Math.max(1, Math.round((97 - mundo) * 2 + normal(rng, 1.5)));
    if (lugar <= 30) linha.bolaDeOuro = lugar;
    if (lugar === 1) premios.push("Bola de Ouro");
    if (J.clube.continente === "america" && (J.clube.divisao === "A" || J.clube.tipo === "ext")) {
      const america = base + (tem("Libertadores") ? 3 : 0) + (tem("Copa América") ? 1 : 0);
      if (america >= 87 + J.premios.filter((x) => x.nome === "Craque da América").length * 1.2 + normal(rng, 1.2)) premios.push("Craque da América");
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
  // renovou: contrato em vigor, a janela nem abre pra ele
  if (sobContrato(J)) { linha.olheiro = false; return []; }
  // sem nota (nao jogou) a vitrine e so o resto: premio, idade, extras
  const vitrine = (linha.nota === null ? -4 : (linha.nota - 6.9) * 2.2) + linha.premios.length * 1.2 + (J.idade <= 21 ? 1 : 0) + (linha.vitrineExtra || 0);
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
    // clube so olha quem chega perto do titular dele; elite quer carta de elite
    if (J.ovr < c.nivel - 3) continue;
    if (c.forca >= 65 && J.ovr < 86) continue;
    if (c.forca >= 62 && c.continente === "europa" && J.ovr < 82) continue;
    const mesmoOuAcima = c.forca >= atual.forca - 3 || t.rebaixado || linha.titular < 0.3;
    if (!mesmoOuAcima) continue;
    // sobe no maximo um degrau por vez; dois so com o olheiro certo
    const pulo = degrau(c) - degrau(atual);
    if (pulo > (sorte ? 2 : 1)) continue;
    // menor de idade vindo de baixo: clube de cima prefere esperar
    const novinho = J.idade <= 17 && pulo > 0 ? 2.5 : 0;
    const salto = Math.max(0, c.prestigio - atual.prestigio - 0.8) * 3;
    const interesse = logistica((J.ovr - c.nivel + 2 + vitrine + sorte - salto - novinho) / 2.2);
    // o jogo e sobre o futebol brasileiro: fora da Europa, o exterior e excecao
    // (a Argentina pesa normal so pra quem e argentino)
    const peso = c.tipo !== "ext" || c.continente === "europa" ? 1
      : c.ligaId === "arg" ? (C.pais === "ARG" ? 1 : 0.08) : c.continente === "asia" ? 0.5 : 0.35;
    if (C.rng() < interesse * peso) interessados.push(c);
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
    const salario = J.idade >= 26 && J.clube.continente !== "europa" ? ({ asia: 2, leste: 0.5 }[c.continente] || 0) : 0;
    const emCasa = c.tipo !== "ext" && C.pais === "BRA" ? 3 : 0; // brasileiro prefere subir aqui dentro
    const euro = c.continente === "europa" && J.idade <= 26 ? 1.5 : 0; // ...mas a Europa paga e mostra mais
    return c.forca + c.prestigio * 0.8 + s * pesoJogar - (s < 0.2 ? 5 : 0) + salario + emCasa + euro;
  };
  const atual = nota(J.clube) - (rebaixado ? 3 : 0);
  const melhor = [...ofertas].sort((a, b) => nota(b) - nota(a))[0];
  return melhor && nota(melhor) > atual + 1.2 ? melhor : null;
}

// --- avancar um ano --------------------------------------------------------------

function jogarTemporada({ decidir = true } = {}) {
  const J = C.J;
  const rng = C.rng;
  // a historia: consequencia que ninguem escolheu (simulacao) resolve sozinha,
  // e a reputacao com torcida, vestiario e imprensa pesa na temporada
  Historia.resolverAutomatico(J, rng, resolverOpcao);
  Historia.aplicarReputacao(J);
  // entrosamento: do 3o ano no mesmo clube em diante, um pouco mais de evolucao
  if (J.anosNoClube >= 2) J.efeito.evolucao += 0.3;
  // renovacao: o ano da assinatura ja recebeu o efeito na janela; os
  // seguintes do contrato recebem aqui (J.efeito foi zerado no fim do ano)
  if (J.renovacao && J.ano > J.renovacao.assinado && J.ano <= J.renovacao.ate) {
    const r = RENOVACOES.find((x) => x.id === J.renovacao.id);
    if (r) r.todoAno(J.efeito);
  } else if (J.renovacao && J.ano > J.renovacao.ate) J.renovacao = null;
  const efe = efeitoDoEstilo(estiloDeJogo(J.attrs, C.pos));
  if (efe) {
    const perdida = temporadaPerdida(J); // estilo nao desfaz temporada perdida
    efe.aplicar(J.efeito, J);
    if (perdida) J.efeito.lesao = Math.max(1, J.efeito.lesao);
  }
  let lesao;
  if (J.lesaoPre !== undefined) {
    const lp = J.lesaoPre;
    J.lesaoPre = undefined;
    if (lp && !lp.aplicada) aplicarLesao(J, lp.dados);
    lesao = lp ? { nome: lp.dados.nome, jogos: lp.dados.jogos } : null;
  } else lesao = sortearLesao(J, rng);
  const t = J.clube.tipo === "ext" ? temporadaNoExterior(J, J.ano, rng)
    : J.clube.divisao === "A" ? temporadaNoBrasil(J, J.ano, rng) : temporadaInferior(J, J.ano, rng);
  const f = funcaoDe(C.pos);
  const st = t.st;
  const jogos = temporadaPerdida(J) ? 0 : limitar(Math.round(st.jogos * t.p + normal(rng, 1.5)), 0, st.jogos);
  // gols e assistencias pelo ritmo do OVR (minutos por jogo contam)
  const ritmo = ritmoDoJogador(J, t.nivelLiga);
  const noventa = jogos * (0.7 + 0.3 * t.s);
  // gol/assist: fracao extra do contrato (bonus por gol da renovacao)
  const gols = poissonC(rng, ritmo.gol * noventa * (1 + J.efeito.gol));
  const assist = poissonC(rng, ritmo.assist * noventa * (1 + J.efeito.assist));
  // a parte da liga (pra artilharia e premios)
  st.golsLiga = Math.round(gols * st.jogosLiga / Math.max(1, st.jogos));
  // quem defende pontua pelo jogo sem sofrer gol; quem ataca, por gol e assistencia
  const fam = POSICOES[C.pos].fam;
  const muralha = fam === "G" || fam === "D" ? (st.semSofrerLiga / Math.max(1, st.jogosLiga) - 0.3) * (fam === "G" ? 0.9 : 0.8) : 0;
  // defensor e goleiro: o atributo de defesa acima do normal pesa na nota
  const espPos = perfilEsperado(f, J.ovr);
  const acima = (k) => (J.attrs[k] ?? 0) - (espPos[k] ?? 0);
  const defesaExtra = fam === "G" ? (acima("REF") + acima("EVI")) / 2 : fam === "D" ? acima("DEF") : 0;
  const contrib = (jogos ? (gols + assist * 0.6) / jogos : 0) + muralha + limitar(defesaExtra, -15, 15) * 0.012;
  // sem jogo nao ha nota (temporada perdida, banco o ano todo): ausencia, nunca um numero
  const nota = jogos ? limitar(6.55 + Math.tanh((J.ovr - t.nivelLiga) / 12) * 1.3 + contrib * 0.9 + J.efeito.nota + normal(rng, 0.18), 5.4, 9.3) : null;
  const selecao = temporadaNaSelecao(J, J.ano, rng, t.p);
  const titulos = jogos >= 5 ? [...t.tituloNomes] : [];
  // quem ganha o continental joga o Mundial de Clubes
  const continental = titulos.find((x) => CONTINENTAIS.includes(x));
  if (continental) {
    const chance = { "Champions League": 0.6, Libertadores: 0.3, "Champions da Ásia": 0.06 }[continental];
    const venceu = rng() < chance;
    t.campanha.push({ comp: "Mundial de Clubes", res: venceu ? "Campeão" : rng() < 0.6 ? "Vice" : "Semifinal", campeao: venceu });
    if (venceu) titulos.push("Mundial de Clubes");
  }
  const linha = {
    ano: J.ano, idade: J.idade, clube: J.clube.nome, liga: J.clube.liga, kit: J.clube.kit || null,
    time: J.clube.time || null, ovr: J.ovr, attrs: { ...J.attrs }, jogos, gols, assist, nota,
    semSofrer: f === "GOL" ? Math.round(st.semSofrerLiga * t.p) : null,
    campanha: t.campanha, titulos, selecao, minutos: Math.round(jogos * 90 * (0.7 + 0.3 * t.s)), titular: t.s,
    lesao, decisoes: J.efeito.textos, vitrineExtra: J.efeito.vitrine,
  };
  linha.premios = premiosDoAno(J, t, linha, rng);
  J.historico.push(linha);
  J.titulos.push(...titulos.map((nome) => ({ nome, ano: J.ano, clube: J.clube.nome })));
  if (selecao) {
    J.titulos.push(...selecao.titulos.map((nome) => ({ nome, ano: J.ano, clube: paisDe(C.pais).nome, selecao: true })));
    J.premios.push(...selecao.premios.map((nome) => ({ nome: `${nome} ${J.ano}`, ano: J.ano, clube: paisDe(C.pais).nome, selecao: true })));
  }
  J.premios.push(...linha.premios.map((nome) => ({ nome, ano: J.ano, clube: J.clube.nome })));
  // acesso e queda do clube (so quando ele e brasileiro)
  if (J.clube.tipo !== "ext") {
    const div = J.clube.divisao;
    const para = t.sobe ? DIVISOES[DIVISOES.indexOf(div) - 1] : t.desce && div !== "D" ? DIVISOES[DIVISOES.indexOf(div) + 1] : null;
    if (para) {
      trocarDivisao(J.clube.id, div, para);
      linha.divisao = t.sobe ? `Acesso pra ${para === "A" ? "Série A" : `Série ${para}`}` : `Caiu pra Série ${para}`;
      linha.mudouDivisao = { sobe: !!t.sobe, para };
    }
  }
  // fim do ano: evolui, envelhece, mercado
  linha.evolucao = evoluir(J, t.p, rng);
  J.idade += 1;
  J.ano += 1;
  J.anosNoClube += 1;
  J.valor = valorDeMercado(J);
  // aposentadoria
  const folga = J.idade - (J.idadePico + (f === "GOL" ? 3 : 4)); // uns quatro anos depois do pico ja da pra pensar em parar
  const chanceParar = J.idade >= (f === "GOL" ? 42 : 40) ? 1
    : (folga >= 0 ? 0.12 + folga * 0.15 : 0) + (J.idade >= 30 && J.ovr < 64 ? 0.3 : 0) + (J.idade >= 33 && J.ovr < 70 ? 0.15 : 0);
  J.efeito = efeitoZerado();
  if (rng() < chanceParar) { J.aposentado = true; linha.fim = "Pendurou as chuteiras"; return linha; }
  // clube atual com a divisao e o titular de agora
  J.clube = clubesDoMundo(J).find((c) => c.id === J.clube.id) || J.clube;
  const ofertas = propostasDoAno(J, t, linha);
  linha.ofertas = ofertas.map((c) => c.nome);
  if (t.rebaixado) linha.rebaixado = true;
  // modo completo: quem escolhe e voce (a tela de mercado resolve)
  if (!decidir) { C.ofertasAbertas = ofertas; return linha; }
  const destino = decidirTransferencia(J, ofertas, t.rebaixado);
  if (destino) {
    linha.transferencia = { para: destino.nome, liga: destino.liga, valor: J.valor };
    assinar(destino, "mercado");
  }
  return linha;
}

// --- modo completo: o que acontece durante a temporada -------------------------------

// Efeitos que valem por uma temporada: minutos (fracao a mais ou a menos),
// nota, vitrine pro mercado, lesao (fracao da temporada fora), evolucao
// (pontos de OVR a mais no fim do ano) e queda (freia o declinio do veterano).
const efeitoZerado = () => ({ minutos: 0, nota: 0, vitrine: 0, lesao: 0, evolucao: 0, queda: 0, gol: 0, assist: 0, textos: [] });
// lesao >= 1 e temporada perdida: zero minuto, nem o bonus de minutos salva
const temporadaPerdida = (J) => J.efeito.lesao >= 1;
const minutosDe = (J, s) => (temporadaPerdida(J) ? 0 : limitar(fracaoDeMinutos(s) * (1 - J.efeito.lesao) + J.efeito.minutos, 0.02, 0.95));

// lesao: todo ano tem risco (nos dois modos); corpo fraco e idade pesam
function sortearLesaoDados(J, rng) {
  const fis = J.attrs.FIS ?? J.attrs.REF ?? 60;
  const risco = 0.13 + (J.idade >= 30 ? 0.06 : 0) + (J.idade >= 34 ? 0.06 : 0) + (fis < 55 ? 0.05 : 0) - (fis >= 75 ? 0.03 : 0);
  if (rng() >= risco) return null;
  const u = rng();
  const [nome, fora] = u < 0.55 ? ["Lesão muscular leve", 0.08] : u < 0.88 ? ["Entorse no tornozelo", 0.2] : ["Ruptura de ligamento", 0.45];
  return { nome, fora, jogos: Math.round(fora * 38) };
}
function aplicarLesao(J, d) {
  // soma sem nunca reduzir o que ja estava acumulado (antes o teto de 0,7 cortava)
  if (!temporadaPerdida(J)) J.efeito.lesao = Math.max(J.efeito.lesao, Math.min(0.9, J.efeito.lesao + d.fora));
  if (d.fora >= 0.45) J.efeito.evolucao -= J.idade >= 28 ? 1.5 : 0.8;
}
function sortearLesao(J, rng) {
  const d = sortearLesaoDados(J, rng);
  if (d) aplicarLesao(J, d);
  return d && { nome: d.nome, jogos: d.jogos };
}

// atributo principal da posicao (o que mais pesa no OVR) e o da finalizacao/defesa
const atributoChave = () => Object.entries(PESOS[funcaoDe(C.pos)]).sort((a, b) => b[1] - a[1])[0][0];
const chanceAttr = (J, k, centro = 62, escala = 9) => limitar(logistica(((J.attrs[k] ?? 50) - centro) / escala), 0.12, 0.92);
const goleiro = () => funcaoDe(C.pos) === "GOL";
const rotuloAttr = (k) => ({ ...ROTULOS_LINHA, ...Object.fromEntries(EIXOS_GOLEIRO.map(([c, s]) => [c, C.r.eixos[c] || s])) })[k] || k;

// Cada evento: quando pode aparecer, o texto e as opcoes. Opcao com "chance"
// mostra a porcentagem no botao e resolve pelo dado; sem chance e certeza.
const EVENTOS = [
  // --- base: treino, rotina e cabeca fora de campo ---
  {
    id: "sub20-ou-profissional", fases: ["base"], quando: () => true,
    titulo: "Treinar com o profissional",
    texto: () => "O técnico do profissional chamou três garotos pra completar o treino da semana. No sub-20 você é titular; lá, só completa.",
    opcoes: [
      { rotulo: "Vai pro profissional", chance: (J) => chanceAttr(J, atributoChave(), 56, 9),
        ok: (J) => { Historia.mexerReputacao(J, { tecnico: 2 }); J.efeito.evolucao += 0.5; return "Não se escondeu. O técnico perguntou seu nome no fim do treino."; },
        falha: (J) => { J.efeito.nota -= 0.05; return "O ritmo assustou. Voltou pro sub-20 sabendo o tamanho da distância."; } },
      { rotulo: "Fica sendo titular no sub-20", sempre: (J) => { J.efeito.nota += 0.05; return "Jogou, fez o seu, e seguiu na fila."; } },
    ],
  },
  {
    id: "escola-noite", fases: ["base"], quando: (J) => J.idade <= 18,
    titulo: "O ensino médio à noite",
    texto: () => "Falta um ano pra terminar a escola. O clube paga, mas é depois do treino, de segunda a quinta.",
    opcoes: [
      { rotulo: "Termina a escola", sempre: (J) => { Historia.mexerReputacao(J, { disciplina: 1 }); J.efeito.evolucao -= 0.2; return "Cansativo, mas terminou. A sua mãe foi na formatura com a camisa do clube."; } },
      { rotulo: "Larga pra focar no futebol", sempre: (J) => { J.efeito.evolucao += 0.2; return "Mais descanso, mais treino. A escola ficou pra depois."; } },
    ],
  },
  {
    id: "celular", fases: ["base"], quando: () => true,
    titulo: "Celular até as duas da manhã",
    texto: () => "No alojamento, todo mundo fica no celular até tarde. O treino é às oito.",
    opcoes: [
      { rotulo: "Deixa o celular fora do quarto", sempre: (J) => { Historia.mexerReputacao(J, { disciplina: 1 }); J.efeito.nota += 0.03; return "Primeira semana difícil. Depois, o melhor sono da vida."; } },
      { rotulo: "Segue como está", chance: () => 0.5,
        ok: () => "O corpo de 17 anos aguenta. Por enquanto.",
        falha: (J) => { Historia.mexerReputacao(J, { disciplina: -1, tecnico: -1 }); return "Chegou atrasado duas vezes no mês. Levou advertência."; } },
    ],
  },
  {
    id: "empresario-base", fases: ["base"], quando: (J) => J.idade >= 17,
    titulo: "Um empresário na porta do CT",
    texto: () => "Ele oferece chuteira, mesada e promete te levar pra Europa. Quer que você assine com ele hoje.",
    opcoes: [
      { rotulo: "Assina na hora", chance: () => 0.4,
        ok: (J) => { J.efeito.vitrine += 1.5; return "Ele cumpriu: seu nome começou a circular nos clubes."; },
        falha: (J) => { J.efeito.vitrine -= 0.5; Historia.mexerReputacao(J, { disciplina: -1 }); return "A mesada parou no terceiro mês. E o contrato te prende por dois anos."; } },
      { rotulo: "Leva o contrato pra família ler", sempre: (J) => { Historia.mexerReputacao(J, { disciplina: 1 }); return "Um tio advogado achou três cláusulas ruins. Você não assinou."; } },
    ],
  },
  {
    id: "treino", quando: () => true,
    titulo: "Treino acabou, campo vazio",
    texto: (J) => `Sobrou gramado e bola. Dá pra ficar trabalhando ${rotuloAttr(atributoChave()).toLowerCase()} mais uma hora.`,
    opcoes: [
      { rotulo: "Fica treinando", chance: () => 0.75,
        ok: (J) => { J.efeito.evolucao += 1; return "O trabalho extra apareceu: +1 de evolução no fim do ano."; },
        falha: (J) => { J.efeito.lesao += 0.08; return "Sobrecarga. Sentiu a posterior e ficou umas semanas fora."; } },
      { rotulo: "Vai descansar", sempre: () => "Corpo inteiro pra próxima semana. Nada muda." },
    ],
  },
  {
    id: "dor", fases: ["afirmacao", "auge", "veterano"], quando: () => true,
    titulo: "Jogo grande e uma dor na coxa",
    texto: () => "O departamento médico libera se você quiser. O técnico deixa a decisão com você.",
    opcoes: [
      { rotulo: "Joga no sacrifício", chance: (J) => chanceAttr(J, goleiro() ? "REF" : "FIS", 50, 10),
        ok: (J) => { J.efeito.nota += 0.25; J.efeito.vitrine += 1.5; return "Aguentou os 90 e foi dos melhores em campo. A torcida não esquece."; },
        falha: (J) => { J.efeito.lesao += 0.22; return "A coxa não aguentou. Saiu no primeiro tempo e perdeu uns dois meses."; } },
      { rotulo: "Fica de fora", sempre: (J) => { J.efeito.minutos -= 0.02; return "Assistiu do banco. Perdeu um jogo, ganhou saúde."; } },
    ],
  },
  {
    id: "penalti", fases: ["afirmacao", "auge", "veterano"], quando: () => !goleiro(),
    titulo: "Pênalti aos 47 do segundo tempo",
    texto: () => "Empate no placar, estádio cheio. O batedor oficial olha pra você.",
    opcoes: [
      { rotulo: "Bato eu", chance: (J) => limitar(0.5 + ((J.attrs.FIN ?? 50) - 55) / 80, 0.35, 0.9),
        ok: (J) => { J.efeito.vitrine += 2; J.efeito.nota += 0.15; return "Bola num canto, goleiro no outro. Virou o nome do jogo."; },
        falha: (J) => { J.efeito.vitrine -= 1; J.efeito.nota -= 0.15; return "Isolou. A semana foi longa."; } },
      { rotulo: "Deixo pro batedor", sempre: () => "Ele bateu, fez, e você correu pra abraçar. Vida que segue." },
    ],
  },
  {
    id: "penalti-gol", fases: ["afirmacao", "auge", "veterano"], quando: () => goleiro(),
    titulo: "Pênalti contra no último lance",
    texto: () => "Um gol decide o jogo. O batedor deles ajeita a bola.",
    opcoes: [
      { rotulo: "Espera até o último instante", chance: (J) => limitar(0.2 + ((J.attrs.REF ?? 50) - 55) / 90, 0.15, 0.5),
        ok: (J) => { J.efeito.vitrine += 2.5; J.efeito.nota += 0.2; return "Defendeu. Saiu carregado pelos companheiros."; },
        falha: () => "Ele bateu no canto. Não tinha o que fazer." },
      { rotulo: "Escolhe um canto e vai", chance: () => 0.24,
        ok: (J) => { J.efeito.vitrine += 2.5; J.efeito.nota += 0.2; return "Chutou pro lado que você escolheu. Defesa e festa."; },
        falha: () => "Foi pro outro lado. Faz parte." },
    ],
  },
  // --- decisoes do estilo (o lado bom e o ruim de cada um aparecem aqui) ---
  {
    id: "protagonista", fases: ["afirmacao", "auge"], quando: (J) => !goleiro() && ["FIN", "DRI"].includes(estiloDeJogo(J.attrs, C.pos).k),
    titulo: "Pênalti no clássico",
    texto: () => "Aos 44 do segundo tempo, pênalti a favor. O batedor oficial é o capitão, mas a torcida grita o seu nome.",
    opcoes: [
      { rotulo: "Pega a bola e bate", chance: (J) => limitar(0.55 + ((J.attrs.FIN ?? 50) - 60) / 80, 0.35, 0.9),
        ok: (J) => { J.efeito.vitrine += 2; J.efeito.nota += 0.15; Historia.mexerReputacao(J, { torcida: 1, vestiario: -1 }); return "Gol, festa, capa do jornal. O capitão te cumprimentou, mas de cara fechada."; },
        falha: (J) => { J.efeito.nota -= 0.15; Historia.mexerReputacao(J, { torcida: -1, vestiario: -2 }); return "Perdeu. E pegou a bola do capitão pra isso. O vestiário não perdoou."; } },
      { rotulo: "Deixa pro capitão", sempre: (J) => { Historia.mexerReputacao(J, { vestiario: 1 }); J.efeito.vitrine -= 0.5; return "Ele converteu e correu pra te abraçar. O grupo viu."; } },
    ],
  },
  {
    id: "firula", fases: ["afirmacao", "auge"], quando: (J) => !goleiro() && ["DRI", "RIT"].includes(estiloDeJogo(J.attrs, C.pos).k),
    titulo: "Jogo ganho, 3 a 0",
    texto: () => "Faltam dez minutos. Dá pra partir pra cima do lateral e fazer a jogada do vídeo, ou só tocar a bola.",
    opcoes: [
      { rotulo: "Faz a firula", chance: (J) => chanceAttr(J, "DRI", 64, 8),
        ok: (J) => { J.efeito.vitrine += 2.5; Historia.mexerReputacao(J, { imprensa: 1 }); return "Chapéu, caneta e o vídeo rodou o país. O técnico riu no banco."; },
        falha: (J) => { J.efeito.minutos -= 0.04; Historia.mexerReputacao(J, { vestiario: -1 }); return "Perdeu a bola, saiu o contra-ataque e o gol deles. Banco no jogo seguinte."; } },
      { rotulo: "Toca e administra", sempre: (J) => { J.efeito.minutos += 0.02; return "Jogo morto, técnico feliz. Ninguém lembra, mas ninguém reclama."; } },
    ],
  },
  {
    id: "festa", fases: ["afirmacao", "auge"], quando: (J) => J.idade <= 30,
    titulo: "Aniversário de um companheiro, véspera de jogo",
    texto: () => "O elenco inteiro vai. Folga só depois de amanhã.",
    opcoes: [
      { rotulo: "Vai, mas sai cedo", chance: () => 0.75,
        ok: (J) => { J.efeito.minutos += 0.03; return "Entrosamento em dia e todo mundo bem no jogo."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "Saiu mais tarde do que queria. Jogou no automático."; } },
      { rotulo: "Vai até o fim", chance: () => 0.45,
        ok: (J) => { J.efeito.minutos += 0.05; return "Noite histórica, e no dia seguinte ninguém sentiu. O grupo fechou com você."; },
        falha: (J) => { J.efeito.minutos -= 0.06; J.efeito.vitrine -= 1; return "Foto da festa rodou nas redes antes do jogo. O técnico não gostou."; } },
      { rotulo: "Fica em casa", sempre: () => "Dormiu cedo. Ninguém lembra de festa que não foi." },
    ],
  },
  {
    id: "funcao", quando: () => !goleiro(),
    titulo: "Técnico novo, ideia nova",
    texto: () => "Ele quer te testar numa função diferente por algumas semanas.",
    opcoes: [
      { rotulo: "Topa o teste", chance: () => 0.5,
        ok: (J) => { J.efeito.minutos += 0.08; return "Encaixou. Virou peça fixa do esquema."; },
        falha: (J) => { J.efeito.nota -= 0.12; return "Não rendeu fora de posição. Voltou pro lugar, mas a nota caiu."; } },
      { rotulo: "Pede pra jogar na sua", sempre: (J) => { J.efeito.minutos -= 0.03; return "Ele respeitou, mas anotou."; } },
    ],
  },
  {
    id: "empresario", fases: ["afirmacao", "auge"], quando: (J) => J.idade >= 19 && J.idade <= 30,
    titulo: "O empresário ligou",
    texto: () => "Tem clube de olho em você. Ele pergunta se pode fazer barulho na imprensa.",
    opcoes: [
      { rotulo: "Pode fazer barulho", sempre: (J) => { J.efeito.vitrine += 3; J.efeito.minutos -= 0.05; return "Seu nome apareceu em tudo que é site. No clube, o clima esfriou."; } },
      { rotulo: "Foco no clube", sempre: (J) => { J.efeito.nota += 0.1; J.efeito.minutos += 0.02; return "Cabeça no lugar, e o técnico percebeu."; } },
    ],
  },
  {
    id: "entrevista", fases: ["afirmacao", "auge", "veterano"], quando: () => true,
    titulo: "Derrota feia e o microfone na sua frente",
    texto: () => "A torcida está na bronca. O repórter quer saber o que aconteceu.",
    opcoes: [
      { rotulo: "Cobra o elenco", chance: () => 0.5,
        ok: (J) => { J.efeito.vitrine += 1.5; return "A torcida adorou. Virou líder dentro e fora de campo."; },
        falha: (J) => { J.efeito.minutos -= 0.05; return "O vestiário não gostou de ler aquilo. Clima pesado."; } },
      { rotulo: "Assume a culpa", sempre: (J) => { J.efeito.minutos += 0.02; return "Resposta madura. O grupo agradeceu."; } },
    ],
  },
  {
    id: "base", fases: ["base"], quando: (J) => J.idade <= 19,
    titulo: "Convocação pra seleção sub-20",
    texto: () => "Vale vitrine e experiência, mas você perde umas rodadas no clube.",
    opcoes: [
      { rotulo: "Vai pra seleção", chance: () => 0.6,
        ok: (J) => { J.efeito.evolucao += 1; J.efeito.vitrine += 1.5; J.efeito.minutos -= 0.05; return "Treinou com os melhores da idade e voltou outro jogador."; },
        falha: (J) => { J.efeito.minutos -= 0.06; return "Ficou no banco da seleção e perdeu espaço no clube."; } },
      { rotulo: "Pede pra ficar", sempre: (J) => { J.efeito.minutos += 0.04; return "O clube agradeceu e te deu sequência."; } },
    ],
  },
  {
    id: "veterano", fases: ["veterano"], quando: (J) => J.idade >= 30,
    titulo: "O preparador físico tem um plano",
    texto: () => "Rotina de recuperação pesada: gelo, sono regrado, academia todo dia.",
    opcoes: [
      { rotulo: "Topa a rotina", sempre: (J) => { J.efeito.queda += 0.8; return "O corpo agradeceu. A idade pesou menos esse ano."; } },
      { rotulo: "Segue do seu jeito", chance: () => 0.6,
        ok: () => "Deu certo do seu jeito mesmo. Experiência conta.",
        falha: (J) => { J.efeito.lesao += 0.12; J.efeito.queda -= 0.5; return "A panturrilha reclamou. Umas semanas fora."; } },
    ],
  },
  {
    id: "classico", fases: ["afirmacao", "auge", "veterano"], quando: () => !goleiro(),
    titulo: "Clássico e provocação do rival",
    texto: () => "O camisa 10 deles falou de você na coletiva.",
    opcoes: [
      { rotulo: "Responde com a bola", chance: (J) => chanceAttr(J, "DRI", 60, 9),
        ok: (J) => { J.efeito.vitrine += 2; J.efeito.nota += 0.1; return "Caneta, gol e comemoração na frente da torcida deles."; },
        falha: () => "Jogo travado, nada saiu. Ficou pra próxima." },
      { rotulo: "Ignora", sempre: () => "Cabeça fria. Jogo normal." },
    ],
  },
  {
    id: "nutri", quando: () => true,
    titulo: "Nutricionista nova no clube",
    texto: () => "Ela propõe uma dieta bem mais rígida pro resto da temporada.",
    opcoes: [
      { rotulo: "Segue à risca", chance: () => 0.7,
        ok: (J) => { J.efeito.evolucao += 0.8; J.efeito.lesao = Math.max(0, J.efeito.lesao - 0.04); return "Mais fôlego no fim dos jogos. Deu pra sentir."; },
        falha: () => "Não se adaptou, voltou pro de sempre." },
      { rotulo: "Mantém o cardápio", sempre: () => "Churrasco de domingo mantido." },
    ],
  },
  // --- mais situacoes (cada uma aparece no maximo uma vez por carreira) ---
  {
    id: "estreia", fases: ["base"], quando: (J) => J.idade <= 17,
    titulo: "Estreia no profissional",
    texto: () => "Faltam 15 minutos e o técnico te chama pro aquecimento. Estádio cheio.",
    opcoes: [
      { rotulo: "Entra pra decidir", chance: (J) => chanceAttr(J, atributoChave(), 58, 9),
        ok: (J) => { J.efeito.vitrine += 1.5; J.efeito.minutos += 0.04; return "Primeira bola, primeira jogada boa. Seu nome virou assunto na cidade."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "Afobou, errou três passes seguidos. Normal, é a primeira."; } },
      { rotulo: "Faz o simples", sempre: (J) => { J.efeito.nota += 0.05; return "Tocou fácil, não inventou. O técnico gostou da tranquilidade."; } },
    ],
  },
  {
    id: "banco", fases: ["base", "afirmacao"], quando: () => true,
    titulo: "Três jogos seguidos no banco",
    texto: () => "Você não entende o motivo. O técnico não falou nada.",
    opcoes: [
      { rotulo: "Pede uma conversa", chance: () => 0.55,
        ok: (J) => { J.efeito.minutos += 0.06; return "Ele explicou o que queria e te devolveu a vaga na semana seguinte."; },
        falha: (J) => { J.efeito.minutos -= 0.03; Historia.mexerReputacao(J, { vestiario: -1 }); return "A conversa não foi boa. Continuou no banco e ainda ficou com fama de reclamão."; } },
      { rotulo: "Treina calado", sempre: (J) => { J.efeito.evolucao += 0.5; return "Respondeu no treino. Ainda não voltou, mas evoluiu."; } },
    ],
  },
  {
    id: "gol-contra", quando: () => POSICOES[C.pos].fam === "D",
    titulo: "Gol contra no primeiro tempo",
    texto: () => "Desvio infeliz, bola no ângulo. O técnico pergunta se você quer continuar.",
    opcoes: [
      { rotulo: "Fica em campo", chance: () => 0.6,
        ok: (J) => { J.efeito.nota += 0.1; J.efeito.vitrine += 1; return "Segundo tempo impecável e o time virou. A torcida aplaudiu na saída."; },
        falha: (J) => { J.efeito.nota -= 0.15; return "Cabeça ficou no lance. Mais um erro e derrota."; } },
      { rotulo: "Pede pra sair", sempre: (J) => { J.efeito.nota -= 0.05; return "Saiu no intervalo. Ninguém cobrou, mas ficou aquela sensação."; } },
    ],
  },
  {
    id: "viral", fases: ["base", "afirmacao"], quando: (J) => J.idade <= 27,
    titulo: "Um vídeo seu viralizou",
    texto: () => "Você fazendo embaixadinha no treino passou de um milhão de visualizações.",
    opcoes: [
      { rotulo: "Aproveita e posta mais", sempre: (J) => { J.efeito.vitrine += 1.5; Historia.mexerReputacao(J, { imprensa: 1 }); J.efeito.nota -= 0.05; return "Ganhou seguidor e patrocínio pequeno. No campo, um pouco mais disperso."; } },
      { rotulo: "Some das redes", sempre: (J) => { J.efeito.nota += 0.05; return "Deixou passar. Cabeça no treino."; } },
    ],
  },
  {
    id: "chuteira", fases: ["afirmacao", "auge"], quando: (J) => J.idade >= 18,
    titulo: "Marca de chuteira quer te patrocinar",
    texto: () => "O contrato é bom, mas a chuteira nova chega na semana de jogo.",
    opcoes: [
      { rotulo: "Estreia a chuteira nova", chance: () => 0.7,
        ok: (J) => { J.efeito.vitrine += 1; return "Encaixou no pé de primeira. Foto da chuteira em tudo que é lugar."; },
        falha: (J) => { J.efeito.lesao += 0.05; return "Bolha no pé e umas rodadas desconfortável."; } },
      { rotulo: "Amacia antes de usar", sempre: (J) => { J.efeito.vitrine += 0.3; return "Estreou duas semanas depois, sem susto."; } },
    ],
  },
  {
    id: "bracadeira", fases: ["auge", "veterano"], quando: (J) => J.idade >= 25,
    titulo: "O técnico oferece a braçadeira",
    texto: () => "O capitão foi vendido. Ele quer você no lugar.",
    opcoes: [
      { rotulo: "Aceita", chance: () => 0.65,
        ok: (J) => { J.efeito.nota += 0.1; J.efeito.minutos += 0.04; Historia.mexerReputacao(J, { vestiario: 1 }); return "Virou referência do grupo. Jogo difícil, é com você que falam."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "Pesou. Passou o ano mais preocupado com o grupo do que com o próprio jogo."; } },
      { rotulo: "Prefere não ser capitão", sempre: () => "Sugeriu um colega mais antigo. Seguiu só jogando." },
    ],
  },
  {
    id: "gol-feito", quando: () => POSICOES[C.pos].fam === "F",
    titulo: "Perdeu um gol feito",
    texto: () => "Sem goleiro, na pequena área. A torcida vaiou e o lance virou meme.",
    opcoes: [
      { rotulo: "Fica depois do treino finalizando", sempre: (J) => { J.efeito.gol += 0.05; J.efeito.evolucao += 0.3; return "Cem finalizações por dia por um mês. O próximo não passou."; } },
      { rotulo: "Responde a torcida na comemoração", chance: (J) => chanceAttr(J, "FIN", 60, 9),
        ok: (J) => { J.efeito.vitrine += 1; Historia.mexerReputacao(J, { torcida: -1, imprensa: 1 }); return "Fez o gol e mandou calar. Deu manchete, mas parte da torcida não esqueceu."; },
        falha: (J) => { Historia.mexerReputacao(J, { torcida: -2 }); return "Não fez o gol e a arquibancada pegou ainda mais pesado."; } },
    ],
  },
  {
    id: "aquecimento", quando: () => true,
    titulo: "Sentiu o tornozelo no aquecimento",
    texto: () => "Dá pra jogar, mas incomoda. O médico deixa com você.",
    opcoes: [
      { rotulo: "Joga assim mesmo", chance: (J) => chanceAttr(J, goleiro() ? "REF" : "FIS", 52, 10),
        ok: (J) => { J.efeito.minutos += 0.02; return "Aguentou os 90 e nem lembrou do tornozelo depois."; },
        falha: (J) => { J.efeito.lesao += 0.15; return "Torceu de vez no primeiro tempo. Umas semanas fora."; } },
      { rotulo: "Avisa o médico", sempre: (J) => { J.efeito.minutos -= 0.02; return "Ficou fora de um jogo. Voltou inteiro."; } },
    ],
  },
  {
    id: "coringa", fases: ["afirmacao", "auge", "veterano"], quando: () => !goleiro(),
    titulo: "Papel de coringa",
    texto: () => "O técnico quer você entrando no segundo tempo, pra mudar o jogo.",
    opcoes: [
      { rotulo: "Aceita o papel", sempre: (J) => { J.efeito.minutos -= 0.04; J.efeito.nota += 0.12; return "Menos minutos, mais impacto. Virou o cara que entra e resolve."; } },
      { rotulo: "Quer ser titular", chance: () => 0.4,
        ok: (J) => { J.efeito.minutos += 0.05; return "Ele cedeu e te deu a vaga. Agora é mostrar."; },
        falha: (J) => { J.efeito.minutos -= 0.05; Historia.mexerReputacao(J, { vestiario: -1 }); return "Ele não gostou da resposta. Nem coringa, nem titular."; } },
    ],
  },
  {
    id: "psicologo", quando: () => true,
    titulo: "Psicóloga esportiva no clube",
    texto: () => "Ela abriu horários para o elenco. Sessão semanal, opcional.",
    opcoes: [
      { rotulo: "Faz as sessões", sempre: (J) => { J.efeito.nota += 0.1; return "Menos ansiedade nos jogos grandes. A diferença apareceu nos detalhes."; } },
      { rotulo: "Não vê necessidade", sempre: () => "Seguiu como estava." },
    ],
  },
  {
    id: "idolo", fases: ["base", "afirmacao"], quando: () => true,
    titulo: "Um ídolo do clube virou auxiliar",
    texto: () => "Ele quer ficar depois do treino te passando uns macetes da posição.",
    opcoes: [
      { rotulo: "Fica com ele", chance: () => 0.8,
        ok: (J) => { J.efeito.evolucao += 0.8; return "Aprendeu em um mês o que levaria anos. Macete de quem jogou muito."; },
        falha: (J) => { J.efeito.lesao += 0.05; return "Carga extra demais. Sentiu a coxa."; } },
      { rotulo: "Agradece e vai pra casa", sempre: () => "Ele entendeu. A porta ficou aberta." },
    ],
  },
  {
    id: "invasao", fases: ["afirmacao", "auge", "veterano"], quando: () => true,
    titulo: "Torcedor mirim invade o campo",
    texto: () => "Depois do apito final, um menino passa pelos seguranças e corre pra te abraçar.",
    opcoes: [
      { rotulo: "Dá a camisa pra ele", sempre: (J) => { J.efeito.vitrine += 1; Historia.mexerReputacao(J, { torcida: 1 }); return "A foto rodou o país. O menino não tirou a camisa por uma semana."; } },
      { rotulo: "Abraça e segue", sempre: () => "Abraço rápido, os seguranças levaram ele de volta." },
    ],
  },
  {
    id: "pendurado", fases: ["afirmacao", "auge", "veterano"], quando: () => ["D", "M"].includes(POSICOES[C.pos].fam),
    titulo: "Pendurado antes do clássico",
    texto: () => "Dois amarelos. Mais um e você fica fora do clássico.",
    opcoes: [
      { rotulo: "Joga na manha", chance: () => 0.6,
        ok: () => "Passou limpo. Clássico garantido.",
        falha: (J) => { J.efeito.minutos -= 0.03; return "Amarelo aos 80 minutos. Assistiu o clássico da tribuna."; } },
      { rotulo: "Força o terceiro agora", sempre: (J) => { J.efeito.minutos -= 0.02; Historia.mexerReputacao(J, { imprensa: -1 }); return "Cumpriu num jogo menor e chegou zerado no clássico. A imprensa percebeu."; } },
    ],
  },
  {
    id: "sondagem", fases: ["afirmacao", "auge"], quando: (J) => J.idade >= 20 && J.idade <= 29 && J.clube.tipo !== "ext",
    titulo: "Sondagem do exterior",
    texto: () => "Um clube de fora quer saber se você toparia sair no fim do ano. Salário muito maior.",
    opcoes: [
      { rotulo: "Diz que ouve", sempre: (J) => { J.efeito.vitrine += 1.5; J.efeito.nota -= 0.05; return "A notícia vazou. Mais olheiro na arquibancada, cabeça um pouco longe."; } },
      { rotulo: "Diz que está feliz aqui", sempre: (J) => { J.efeito.nota += 0.05; Historia.mexerReputacao(J, { torcida: 1 }); return "A torcida gostou de ouvir. Foco total no ano."; } },
    ],
  },
  {
    id: "filho", fases: ["afirmacao", "auge", "veterano"], quando: (J) => J.idade >= 23,
    titulo: "Seu primeiro filho vai nascer",
    texto: () => "A previsão é justo no dia de um jogo importante.",
    opcoes: [
      { rotulo: "Pede folga", sempre: (J) => { J.efeito.minutos -= 0.02; J.efeito.nota += 0.1; return "Estava lá. Voltou leve e fez o melhor mês do ano."; } },
      { rotulo: "Joga e vai direto pro hospital", chance: () => 0.5,
        ok: (J) => { J.efeito.vitrine += 1.5; return "Jogou bem e chegou a tempo. A comemoração do ninar virou a foto da rodada."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "Cabeça longe o jogo todo. Pelo menos chegou a tempo."; } },
    ],
  },
  {
    id: "video", quando: () => true,
    titulo: "O analista de desempenho te chama",
    texto: () => "Ele separou seus lances da temporada e quer mostrar o que dá pra melhorar.",
    opcoes: [
      { rotulo: "Assiste tudo", sempre: (J) => { J.efeito.nota += 0.08; J.efeito.assist += 0.05; return "Viu onde se posicionava mal. Começou a aparecer mais livre."; } },
      { rotulo: "Prefere o campo", sempre: () => "Aprende jogando. Cada um tem seu jeito." },
    ],
  },
  {
    id: "calor", quando: () => !goleiro(),
    titulo: "Jogo às 11h da manhã, 38 graus",
    texto: () => "O gramado está fervendo. Dá pra escolher como gastar a energia.",
    opcoes: [
      { rotulo: "Vai com tudo desde o início", chance: (J) => chanceAttr(J, "FIS", 60, 9),
        ok: (J) => { J.efeito.vitrine += 1; J.efeito.nota += 0.08; return "Resolveu no primeiro tempo, antes do calor pesar."; },
        falha: (J) => { J.efeito.minutos -= 0.02; J.efeito.nota -= 0.05; return "Cãibra aos 60. Saiu carregado de gelo."; } },
      { rotulo: "Dosa o ritmo", sempre: (J) => { J.efeito.nota += 0.03; return "Jogo inteligente. Terminou inteiro."; } },
    ],
  },
  {
    id: "goleiro-saida", quando: () => goleiro(),
    titulo: "O treinador de goleiros quer mudar sua saída",
    texto: () => "Ele quer você jogando mais adiantado, participando da saída de bola.",
    opcoes: [
      { rotulo: "Topa mudar", chance: () => 0.65,
        ok: (J) => { J.efeito.evolucao += 0.7; J.efeito.nota += 0.05; return "Virou o primeiro armador do time. O técnico adorou."; },
        falha: (J) => { J.efeito.nota -= 0.12; return "Tomou um gol de cobertura tentando sair jogando. Voltou pro básico."; } },
      { rotulo: "Mantém seu estilo", sempre: () => "Goleiro de área, do jeito que sempre foi." },
    ],
  },
  {
    id: "goleiro-estudo", quando: () => goleiro(),
    titulo: "Decisão por pênaltis à vista",
    texto: () => "Jogo de volta de mata-mata. O analista tem os vídeos dos batedores deles.",
    opcoes: [
      { rotulo: "Estuda até de madrugada", chance: () => 0.6,
        ok: (J) => { J.efeito.vitrine += 2; J.efeito.nota += 0.15; return "Foi pros pênaltis e você pegou dois. Herói da classificação."; },
        falha: (J) => { J.efeito.nota -= 0.05; return "Não foi pros pênaltis, e ainda chegou cansado."; } },
      { rotulo: "Confia no instinto", sempre: () => "Dormiu bem. Jogo resolvido no tempo normal." },
    ],
  },
  {
    id: "goleiro-falha", quando: () => goleiro(),
    titulo: "Frango na rodada passada",
    texto: () => "Bola fácil passou por baixo do corpo. O reserva está bem nos treinos.",
    opcoes: [
      { rotulo: "Pede pra seguir jogando", chance: () => 0.55,
        ok: (J) => { J.efeito.nota += 0.1; return "Fechou o gol nos jogos seguintes. Ninguém fala mais do frango."; },
        falha: (J) => { J.efeito.minutos -= 0.06; return "Mais uma falha e o reserva assumiu por um tempo."; } },
      { rotulo: "Aceita uma rodada fora", sempre: (J) => { J.efeito.minutos -= 0.02; return "Respirou, voltou concentrado."; } },
    ],
  },
  {
    id: "reserva-voando", fases: ["auge", "veterano"], quando: () => true,
    titulo: "O reserva da sua posição está voando",
    texto: () => "Nos treinos ele tem sido melhor que você. O técnico já comentou.",
    opcoes: [
      { rotulo: "Aumenta a carga", chance: () => 0.65,
        ok: (J) => { J.efeito.minutos += 0.05; return "Segurou a vaga. Competição fez bem."; },
        falha: (J) => { J.efeito.lesao += 0.08; return "Exagerou e sentiu a posterior. Ele assumiu enquanto você se recuperava."; } },
      { rotulo: "Ajuda o garoto", sempre: (J) => { J.efeito.minutos -= 0.02; Historia.mexerReputacao(J, { vestiario: 1 }); return "Dividiu minutos, mas ganhou o grupo."; } },
    ],
  },
  {
    id: "reuniao", fases: ["auge", "veterano"], quando: () => true,
    titulo: "Reunião do elenco",
    texto: () => "Quatro derrotas seguidas. Os jogadores se reúnem sem a comissão.",
    opcoes: [
      { rotulo: "Toma a palavra", chance: () => 0.5,
        ok: (J) => { J.efeito.nota += 0.1; Historia.mexerReputacao(J, { vestiario: 1 }); return "O time reagiu na semana seguinte. Você virou voz no vestiário."; },
        falha: (J) => { Historia.mexerReputacao(J, { vestiario: -1 }); return "Falou demais. Os mais velhos não gostaram."; } },
      { rotulo: "Escuta os mais velhos", sempre: () => "Ouviu, concordou, seguiu." },
    ],
  },
  {
    id: "altitude", fases: ["afirmacao", "auge", "veterano"], quando: (J) => J.clube.tipo !== "ext" && J.clube.divisao === "A",
    titulo: "Jogo na altitude pela copa",
    texto: () => "3.600 metros. O clube oferece viajar dois dias antes pra adaptar.",
    opcoes: [
      { rotulo: "Vai antes", sempre: (J) => { J.efeito.nota += 0.05; J.efeito.minutos -= 0.01; return "Perdeu um jogo do Brasileirão, mas jogou bem lá em cima."; } },
      { rotulo: "Chega no dia", chance: (J) => chanceAttr(J, goleiro() ? "REF" : "FIS", 62, 9),
        ok: (J) => { J.efeito.vitrine += 1; return "Nem sentiu. Foi o melhor em campo."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "Faltou ar no primeiro pique. Jogo pra esquecer."; } },
    ],
  },
  {
    id: "escola", fases: ["afirmacao", "auge"], quando: () => true,
    titulo: "Convite da escola onde você estudou",
    texto: () => "Querem que você vá conversar com os alunos na sua folga.",
    opcoes: [
      { rotulo: "Vai", sempre: (J) => { J.efeito.vitrine += 0.5; Historia.mexerReputacao(J, { torcida: 1 }); return "Manhã inteira de foto e autógrafo. Saiu no jornal da cidade."; } },
      { rotulo: "Descansa", sempre: () => "Folga é folga." },
    ],
  },
  {
    id: "promessa", fases: ["afirmacao", "auge"], quando: () => POSICOES[C.pos].fam === "F",
    titulo: "Promessa de gol no clássico",
    texto: () => "Um torcedor pede nas redes: 'promete gol no domingo?'.",
    opcoes: [
      { rotulo: "Promete", chance: (J) => chanceAttr(J, "FIN", 64, 9),
        ok: (J) => { J.efeito.vitrine += 2.5; Historia.mexerReputacao(J, { torcida: 1 }); return "Prometeu e cumpriu. Printaram a promessa com o gol do lado."; },
        falha: (J) => { J.efeito.vitrine -= 1.5; Historia.mexerReputacao(J, { imprensa: -1 }); return "Não fez. A promessa voltou a semana inteira."; } },
      { rotulo: "Fica quieto", sempre: () => "Curtiu a mensagem e seguiu o dia." },
    ],
  },
  {
    id: "ferias", quando: () => true,
    titulo: "Férias de dez dias",
    texto: () => "O ano foi longo. Dá pra descansar de verdade ou treinar com um personal.",
    opcoes: [
      { rotulo: "Treina nas férias", chance: () => 0.8,
        ok: (J) => { J.efeito.evolucao += 0.6; return "Voltou na frente de todo mundo na pré-temporada."; },
        falha: (J) => { J.efeito.lesao += 0.05; return "O corpo pediu descanso e cobrou depois."; } },
      { rotulo: "Descansa com a família", sempre: (J) => { J.efeito.nota += 0.05; return "Voltou com a cabeça boa."; } },
    ],
  },
  {
    id: "massa", fases: ["base", "afirmacao"], quando: (J) => J.idade <= 26 && !goleiro(),
    titulo: "Ganhar massa muscular",
    texto: () => "O fisiologista sugere cinco quilos de massa pra aguentar o contato.",
    opcoes: [
      { rotulo: "Topa", chance: () => 0.6,
        ok: (J) => { J.efeito.evolucao += 0.5; J.efeito.lesao = Math.max(0, J.efeito.lesao - 0.03); return "Mais forte no corpo a corpo, sem perder velocidade."; },
        falha: (J) => { J.efeito.gol -= 0.05; J.efeito.nota -= 0.05; return "Ficou mais pesado e perdeu arranque. Vai levar um tempo pra ajustar."; } },
      { rotulo: "Mantém o corpo", sempre: () => "Seguiu leve, do jeito que joga." },
    ],
  },
  {
    id: "idioma", quando: (J) => J.clube.tipo === "ext",
    titulo: "Aulas do idioma local",
    texto: () => "O clube paga aulas três vezes por semana, depois do treino.",
    opcoes: [
      { rotulo: "Faz as aulas", sempre: (J) => { J.efeito.minutos += 0.04; J.efeito.nota += 0.05; return "Em três meses já entendia o técnico sem tradutor. Fez diferença."; } },
      { rotulo: "Se vira no gesto", chance: () => 0.5,
        ok: () => "Futebol é a mesma língua. Deu certo.",
        falha: (J) => { J.efeito.minutos -= 0.04; return "Entendeu errado uma instrução tática e saiu do time por um tempo."; } },
    ],
  },
  {
    id: "saudade", quando: (J) => J.clube.tipo === "ext",
    titulo: "A saudade apertou",
    texto: () => "Frio, comida diferente e a família longe.",
    opcoes: [
      { rotulo: "Traz a família", sempre: (J) => { J.efeito.nota += 0.1; return "Casa cheia de novo. O rendimento voltou."; } },
      { rotulo: "Aguenta sozinho", chance: () => 0.5,
        ok: (J) => { J.efeito.evolucao += 0.3; return "Amadureceu. Foi um ano duro, mas cresceu."; },
        falha: (J) => { J.efeito.nota -= 0.12; return "O ano pesou. Rendeu abaixo do que podia."; } },
    ],
  },
  {
    id: "arbitro", fases: ["afirmacao", "auge", "veterano"], quando: () => true,
    titulo: "Pênalti inexistente contra seu time",
    texto: () => "O juiz marcou e nem foi ao vídeo. O time inteiro partiu pra cima dele.",
    opcoes: [
      { rotulo: "Reclama forte", chance: () => 0.35,
        ok: (J) => { Historia.mexerReputacao(J, { torcida: 1 }); return "Ele foi ao monitor e voltou atrás. Você virou o nome do protesto."; },
        falha: (J) => { J.efeito.minutos -= 0.04; return "Vermelho direto. Dois jogos de suspensão."; } },
      { rotulo: "Segura os companheiros", sempre: (J) => { J.efeito.nota += 0.05; Historia.mexerReputacao(J, { imprensa: 1 }); return "Evitou expulsão de colega. Os comentaristas elogiaram."; } },
    ],
  },
  {
    id: "cara-a-cara", quando: () => ["F", "M"].includes(POSICOES[C.pos].fam),
    titulo: "Cara a cara, companheiro livre do lado",
    texto: () => "Última jogada do jogo, empate no placar.",
    opcoes: [
      { rotulo: "Chuta", chance: (J) => chanceAttr(J, "FIN", 60, 9),
        ok: (J) => { J.efeito.vitrine += 1.5; J.efeito.gol += 0.03; return "No canto. Vitória no último lance."; },
        falha: (J) => { Historia.mexerReputacao(J, { vestiario: -1 }); return "O goleiro pegou. O companheiro livre abriu os braços."; } },
      { rotulo: "Rola pro lado", chance: (J) => chanceAttr(J, "PAS", 55, 9),
        ok: (J) => { J.efeito.assist += 0.05; Historia.mexerReputacao(J, { vestiario: 1 }); return "Gol de empurrar. Ele correu pra te abraçar."; },
        falha: () => "O passe saiu forte e a chance se foi." },
    ],
  },
  {
    id: "escanteio", quando: () => POSICOES[C.pos].fam === "D",
    titulo: "Escanteio no último minuto",
    texto: () => "Perdendo por um. O técnico manda você subir pra área.",
    opcoes: [
      { rotulo: "Sobe", chance: () => 0.35,
        ok: (J) => { J.efeito.vitrine += 2; J.efeito.gol += 0.1; return "Cabeçada no ângulo. Empate aos 49."; },
        falha: (J) => { J.efeito.nota -= 0.05; return "Não pegou na bola, e o contra-ataque quase sai."; } },
      { rotulo: "Fica guardando a defesa", sempre: () => "Alguém tem que ficar. O empate não veio." },
    ],
  },
  {
    id: "padrinho", fases: ["veterano"], quando: (J) => J.idade >= 30,
    titulo: "Um garoto da base pede conselho",
    texto: () => "Ele joga na sua posição e quer ficar perto de você nos treinos.",
    opcoes: [
      { rotulo: "Vira padrinho dele", sempre: (J) => { J.efeito.queda += 0.3; Historia.mexerReputacao(J, { vestiario: 1 }); return "Ensinou o que sabia e ganhou fôlego novo."; } },
      { rotulo: "Sem tempo agora", sempre: () => "Deu umas dicas e seguiu sua rotina." },
    ],
  },
  {
    id: "ultimo-ano", fases: ["veterano"], quando: (J) => J.idade >= 33,
    titulo: "\"É o último ano?\"",
    texto: () => "A pergunta aparece em toda entrevista.",
    opcoes: [
      { rotulo: "Diz que tem lenha", chance: () => 0.6,
        ok: (J) => { J.efeito.queda += 0.5; return "Respondeu em campo, com o melhor início de ano em muito tempo."; },
        falha: (J) => { J.efeito.nota -= 0.1; return "O corpo não acompanhou a frase. Ano irregular."; } },
      { rotulo: "Deixa em aberto", sempre: () => "Um ano de cada vez." },
    ],
  },
  {
    id: "videogame", fases: ["base", "afirmacao"], quando: (J) => J.idade <= 24,
    titulo: "Concentração e videogame",
    texto: () => "O campeonato de videogame do elenco vai até tarde na véspera.",
    opcoes: [
      { rotulo: "Joga até a final", chance: () => 0.5,
        ok: (J) => { Historia.mexerReputacao(J, { vestiario: 1 }); return "Campeão do torneio e bem no jogo. Grupo unido."; },
        falha: (J) => { J.efeito.nota -= 0.08; return "Dormiu tarde e sentiu no segundo tempo."; } },
      { rotulo: "Vai dormir cedo", sempre: () => "Dormiu às 22h. Jogo normal." },
    ],
  },
  {
    id: "torcida-organizada", fases: ["afirmacao", "auge", "veterano"], quando: () => true,
    titulo: "A organizada quer uma conversa",
    texto: () => "Eles apareceram no CT depois de uma sequência ruim.",
    opcoes: [
      { rotulo: "Vai conversar", chance: () => 0.55,
        ok: (J) => { Historia.mexerReputacao(J, { torcida: 1 }); return "Conversa respeitosa. Saíram de lá apoiando."; },
        falha: (J) => { J.efeito.nota -= 0.08; return "Clima tenso. Cabeça pesada nos jogos seguintes."; } },
      { rotulo: "Deixa pra diretoria", sempre: () => "A diretoria resolveu. Você seguiu treinando." },
    ],
  },
];

// Foco da pre-temporada: tres atributos pra escolher (os dois que mais pesam
// na posicao e um terceiro pra mudar o estilo). O escolhido recebe os
// primeiros pontos de evolucao do ano e muda o jeito de jogar.
const DICA_FOCO = {
  FIN: "mais gols", RIT: "ataca o espaço: mais gol, menos passe", PAS: "mais assistências (falso 9, meia armador)",
  DRI: "mais assistências e jogadas individuais", DEF: "ajuda sem a bola, marca menos gols", FIS: "aguenta mais jogos e se machuca menos",
  REF: "defesas difíceis", EVI: "pega mais chutes", MAO: "segura mais bolas", PES: "sai jogando com os pés", SAI: "domina a área",
};
// o foco rende ja no ano (alem dos pontos de atributo no fim da temporada)
function aplicarFoco(J, k) {
  const e = J.efeito;
  if (k === "FIN") e.gol += 0.12;
  else if (k === "RIT") { e.gol += 0.07; e.assist += 0.03; }
  else if (k === "PAS") e.assist += 0.15;
  else if (k === "DRI") { e.assist += 0.1; e.gol += 0.03; }
  else if (k === "FIS") { e.lesao = Math.max(0, e.lesao - 0.03); e.minutos += 0.03; }
  else e.nota += 0.12; // DEF e os de goleiro: aparece na nota
}
function eventoDeTreino(J, rng) {
  const f = funcaoDe(C.pos);
  const ordem = Object.entries(PESOS[f]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  // o que mais pesa na posicao, o ponto forte do seu estilo e mais um pra variar
  const esp = perfilEsperado(f, J.ovr);
  const forte = Object.keys(esp).sort((a, b) => (J.attrs[b] - esp[b]) - (J.attrs[a] - esp[a]))[0];
  const opcoes = [ordem[0]];
  if (!opcoes.includes(forte)) opcoes.push(forte);
  for (const k of Motor.embaralhar(rng, ordem.slice(1))) if (opcoes.length < 3 && !opcoes.includes(k)) opcoes.push(k);
  return {
    id: "foco", titulo: "Foco da pré-temporada",
    texto: () => "O preparador quer saber onde você vai colocar a energia neste ano.",
    opcoes: opcoes.map((k) => ({
      rotulo: `${rotuloAttr(k)} (${J.attrs[k]})`, dica: DICA_FOCO[k],
      sempre: (JJ) => { JJ.foco = k; aplicarFoco(JJ, k); return `Pré-temporada focada em ${rotuloAttr(k).toLowerCase()}: ${DICA_FOCO[k]}.`; },
    })),
  };
}

// Rapido: 1 decisao por temporada (as vezes o foco de treino). Completo: o
// foco de treino e mais 2 situacoes.
function sortearEventos(J, rng, n = 2) {
  // cada situacao aparece no maximo uma vez por carreira
  const vistos = new Set(J.eventosVistos || []);
  const f = Historia.fase(J);
  const pool = EVENTOS.filter((e) => !vistos.has(e.id) && (!e.fases || e.fases.includes(f)) && e.quando(J));
  const completo = C.modo === "completo";
  const qtd = completo ? 2 : rng() < 0.35 ? 0 : 1;
  // a historia (historia.js) entra primeiro: consequencia vencida sempre
  // aparece, e os eventos soltos completam ate o limite do modo
  const arcos = Historia.eventosDoAno(J, rng, { completo });
  const escolhidos = Motor.embaralhar(rng, pool).slice(0, Math.max(0, qtd - arcos.length));
  J.eventosVistos = [...vistos, ...escolhidos.map((e) => e.id)];
  if (!completo && arcos.length) return [...arcos, ...escolhidos];
  return completo || !qtd ? [eventoDeTreino(J, rng), ...arcos, ...escolhidos] : escolhidos;
}

function resolverOpcao(J, op, rng) {
  // a opcao devolve o texto, ou { texto, emSeguida } nos arcos (historia.js)
  const pacote = (saida, ok) => (typeof saida === "object" && saida ? { ...saida, ok } : { texto: saida, ok });
  if (op.sempre) return pacote(op.sempre(J), null);
  const ok = rng() < op.chance(J);
  return pacote(ok ? op.ok(J) : op.falha(J), ok);
}

// Negociacao: pedir garantia de titular. O clube aceita mais facil se voce
// for melhor que o titular dele; se recusar, pode desistir.
function pedirGarantia(J, c, rng) {
  const aceita = limitar(logistica((J.ovr - c.nivel + 1) / 3), 0.1, 0.9);
  if (rng() < aceita) return { resultado: "aceitou", chance: aceita };
  return { resultado: rng() < 0.45 ? "desistiu" : "recusou", chance: aceita };
}

// --- tela da carreira ---------------------------------------------------------------

function iniciarTelaCarreira() {
  mostrarTela("carreira");
  $("temporada-atual").replaceChildren(
    el("p", "jogo-etapa", `Temporada ${C.J.ano}`),
    el("h3", "temporada-titulo", `Aprovado na peneira: ${C.J.clube.nome}, ${C.J.clube.liga}`),
    el("p", "nota", "Agora é com você. Os minutos dependem de passar o titular da posição; jogando bem, clube maior aparece com proposta. Um olheiro na arquibancada certa também ajuda."),
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
  // reputacao (historia.js): de -5 a 5, o centro e neutro
  const rep = el("div", "painel-rep");
  rep.append(el("span", "painel-rep-rotulo", `Fase: ${Historia.NOMES_FASE[Historia.fase(J)]} · confiança e reputação`));
  for (const [k, rotulo] of [["tecnico", "Técnico"], ["disciplina", "Cabeça"], ["torcida", "Torcida"], ["vestiario", "Vestiário"], ["imprensa", "Imprensa"]]) {
    const v = (J.historia && J.historia.rep[k]) || 0;
    const linha = el("div", "rep-linha");
    const barra = el("span", "rep-barra");
    const i = el("i", v >= 0 ? "sobe" : "desce");
    i.style.width = `${(Math.abs(v) / 5) * 50}%`;
    barra.append(i);
    barra.title = `${rotulo}: ${v > 0 ? "+" : ""}${v}`;
    linha.append(el("span", null, rotulo), barra);
    rep.append(linha);
  }
  const pais = paisDe(C.pais);
  const cab = el("p", "painel-cab");
  const est = estiloDeJogo(J.attrs, C.pos);
  cab.append(bandeira(pais), el("span", null, `${pais.nome} · #${J.numero} · ${POSICOES[C.pos].nome} · pé ${C.pe.toLowerCase()}${est ? ` · ${est.nome.toLowerCase()}` : ""}`));
  alvo.append(cab);
  const efe = efeitoDoEstilo(est);
  if (efe) {
    const box = el("div", "painel-estilo");
    box.append(el("span", "painel-rep-rotulo", `Estilo · ${est.nome}`), el("small", "renova-bom", `+ ${efe.bom}`), el("small", "renova-ruim", `− ${efe.ruim}`));
    alvo.append(box);
  }
  alvo.append(fatos, rep);
  for (const [rotulo, itens, classe] of [["Títulos", J.titulos, "galeria"], ["Prêmios", J.premios, "galeria galeria-premios"]]) {
    if (!itens.length) continue;
    const gal = el("div", classe);
    gal.append(el("span", "galeria-rotulo", `${rotulo} · ${itens.length}`));
    const lista = el("ul");
    for (const t of itens.slice(-6).reverse()) {
      const li = el("li");
      li.append(taca(t.nome, { premio: rotulo === "Prêmios" }));
      if (t.selecao) li.append(bandeira(paisDe(C.pais)));
      li.append(el("span", null, t.nome.endsWith(String(t.ano)) ? t.nome : `${t.nome} · ${t.ano}`));
      lista.append(li);
    }
    gal.append(lista);
    alvo.append(gal);
  }
}

function desenharTabelaCarreira() {
  const J = C.J;
  const tbody = $("tabela-carreira");
  tbody.replaceChildren();
  for (const h of J.historico) {
    const tr = el("tr", h.titulos.length || (h.selecao && h.selecao.titulos.length) ? "com-titulo" : "");
    const clube = el("td", "tc-clube");
    const mini = escudo({ nome: h.clube, time: h.time, kit: h.kit });
    const nomeClube = el("span", null, h.clube);
    const liga = el("small", null, h.liga);
    if (h.mudouDivisao) liga.append(el("b", `tc-divisao ${h.mudouDivisao.sobe ? "sobe" : "desce"}`, ` ${h.mudouDivisao.sobe ? "▲" : "▼"} Série ${h.mudouDivisao.para}`));
    nomeClube.append(liga);
    clube.append(mini, nomeClube);
    const ovr = el("td", `tc-ovr nivel-${nivel(h.ovr).id}`);
    ovr.append(el("b", null, String(h.ovr)));
    tr.append(el("td", "tc-idade", String(h.idade)), clube, ovr, el("td", null, String(h.jogos)), el("td", null, String(h.gols)), el("td", null, String(h.assist)),
      el("td", "tc-titulos"), el("td", "tc-premios", h.premios.length ? `${h.premios.length}` : ""));
    const tits = [...h.titulos, ...(h.selecao ? h.selecao.titulos : [])];
    const tdT = tr.querySelector(".tc-titulos");
    for (const nome of tits.slice(0, 3)) tdT.append(taca(nome, { tamanho: "p" }));
    if (tits.length > 3) tdT.append(el("small", null, `+${tits.length - 3}`));
    if (tits.length) tdT.title = tits.join(", ");
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
  const itens = [["Jogos", linha.jogos], ["Gols", linha.gols], ["Assist.", linha.assist], ["Nota", linha.nota === null ? "—" : linha.nota.toFixed(1).replace(".", ",")], ["Craque do jogo", linha.craqueDoJogo]];
  if (linha.semSofrer !== null) itens.splice(1, 1, ["Sem sofrer gol", linha.semSofrer]);
  for (const [k, v] of itens) { const d = el("div"); d.append(el("dd", null, String(v)), el("dt", null, k)); numeros.append(d); }
  alvo.append(numeros);
  const papel = linha.titular >= 0.7 ? "Dono da posição" : linha.titular >= 0.45 ? "Briga pela vaga" : linha.titular >= 0.2 ? "Primeiro do banco" : "Esquentou banco";
  alvo.append(el("p", "temporada-papel", papel));
  const camp = el("ul", "temporada-campanha");
  for (const c of linha.campanha) {
    const li = el("li", c.campeao ? "campeao" : "");
    const nomeComp = el("span", "comp-nome");
    if (c.campeao) nomeComp.append(taca(c.comp));
    nomeComp.append(document.createTextNode(c.comp));
    li.append(nomeComp, el("b", null, c.res));
    camp.append(li);
  }
  alvo.append(camp);
  if (linha.selecao) {
    const s = linha.selecao;
    const box = el("div", "temporada-selecao");
    const cab = el("p", "temporada-selecao-cab");
    cab.append(bandeira(paisDe(C.pais)), el("b", null, s.estreia ? "Primeira convocação!" : "Seleção"), el("span", null, `${s.jogos} J · ${s.gols} G · ${s.assist} A`));
    box.append(cab);
    if (s.torneio) {
      const li = el("ul", "temporada-campanha");
      const item = el("li", s.torneioRes === "Campeão" ? "campeao" : "");
      const nomeT = el("span", "comp-nome");
      if (s.torneioRes === "Campeão") nomeT.append(taca(s.torneio));
      nomeT.append(document.createTextNode(`${s.torneio} · ${s.torneioJogos} J, ${s.torneioGols} G, ${s.torneioAssist} A`));
      item.append(nomeT, el("b", null, s.torneioRes));
      li.append(item);
      box.append(li);
    }
    if (s.premios.length) {
      const pr = el("ul", "temporada-premios");
      for (const n of s.premios) { const li = el("li", n.startsWith("Craque") ? "ouro" : ""); li.append(taca(n, { premio: true }), document.createTextNode(n)); pr.append(li); }
      box.append(pr);
    }
    alvo.append(box);
  }
  if (linha.decisoes && linha.decisoes.length) {
    const dec = el("ul", "temporada-decisoes");
    for (const d of linha.decisoes) {
      const li = el("li", d.ok === true ? "sobe" : d.ok === false ? "desce" : "");
      li.append(el("b", null, `${d.titulo}: ${d.escolha.toLowerCase()}.`), el("span", null, ` ${d.texto}`));
      dec.append(li);
    }
    alvo.append(dec);
  }
  if (linha.premios.length || linha.bolaDeOuro) {
    const pr = el("ul", "temporada-premios");
    for (const nome of linha.premios) { const li = el("li", nome === "Bola de Ouro" ? "ouro" : ""); li.append(taca(nome, { premio: true }), document.createTextNode(nome)); pr.append(li); }
    if (linha.bolaDeOuro && linha.bolaDeOuro > 1) pr.append(el("li", "indicacao", `Bola de Ouro: ${linha.bolaDeOuro}º lugar`));
    alvo.append(pr);
  }
  const ev = linha.evolucao;
  if (ev.foco) alvo.append(el("p", "temporada-foco", `Foco do ano: ${rotuloAttr(ev.foco).toLowerCase()}`));
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
  if (linha.selecao && linha.selecao.titulos.length) avisos.push(`Campeão com a seleção: ${linha.selecao.titulos.join(", ")}.`);
  if (linha.lesao) avisos.push(`${linha.lesao.nome}: ficou fora de uns ${linha.lesao.jogos} jogos.`);
  if (linha.mudouDivisao) {
    const m = linha.mudouDivisao;
    const faixa = el("p", `aviso-divisao ${m.sobe ? "sobe" : "desce"}`, `${m.sobe ? "▲" : "▼"} ${linha.clube} ${m.sobe ? "subiu" : "caiu"} pra Série ${m.para}`);
    alvo.children[0].after(faixa);
  } else if (linha.rebaixado) avisos.push("O time terminou na zona de rebaixamento.");
  if (linha.olheiro && linha.ofertas && linha.ofertas.length) avisos.push("Tinha olheiro na arquibancada.");
  if (linha.ofertas && linha.ofertas.length && !linha.transferencia && C.modo !== "completo") avisos.push(`Sondado por ${linha.ofertas.join(", ")}; ficou.`);
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
  // no completo, o resto da carreira vai no automatico (propostas abertas: fica)
  C.eventos = null; C.ofertasAbertas = null; C.rolagem = null; $("mercado").hidden = true; $("proxima").hidden = false;
  let linha;
  while (!C.J.aposentado) linha = jogarTemporada();
  mostrarLinha(linha);
  desenharPainelJogador();
  desenharTabelaCarreira();
  mostrarAposentadoria();
}


// --- tela do modo completo -------------------------------------------------------------

// A temporada rola numa linha do tempo enquanto as decisoes aparecem. Os
// numeros de cima sao a projecao do ano (mesma conta da simulacao, sem o
// sorteio): cada decisao, lesao ou foco mexe neles na hora, com a diferenca
// na tela. No fim o ano e jogado de verdade e o resultado substitui a projecao.
const MESES_BR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_EU = ["Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai"];
const JOGOS_POR_DIVISAO = { A: 50, B: 40, C: 22, D: 16 };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, movimentoReduzido ? Math.min(ms, 150) : ms));

function jogosDoAno(J) {
  return J.clube.tipo === "ext" ? 44 : JOGOS_POR_DIVISAO[J.clube.divisao] || 38;
}

function projecao(Jreal) {
  const J = Object.create(Jreal);
  J.efeito = { ...Jreal.efeito };
  if (Jreal.historia) Historia.aplicarReputacao({ efeito: J.efeito, historia: Jreal.historia });
  const s = chanceDeTitular(J.ovr, J.clube.nivel, J.idade);
  const p = minutosDe(J, s);
  const G = jogosDoAno(J);
  const jogos = Math.round(G * p);
  const nivelLiga = (J.clube.nivel ?? 65) - 1;
  const r = ritmoDoJogador(J, nivelLiga);
  const noventa = jogos * (0.7 + 0.3 * s);
  const gols = r.gol * noventa * (1 + (J.efeito.gol || 0)), assist = r.assist * noventa * (1 + (J.efeito.assist || 0));
  const contrib = jogos ? (gols + assist * 0.6) / jogos : 0;
  const nota = limitar(6.55 + Math.tanh((J.ovr - nivelLiga) / 12) * 1.3 + contrib * 0.9 + J.efeito.nota, 5.4, 9.3);
  const prox = J.idade + 1;
  let d;
  if (prox <= J.idadePico) d = (trajetoria(J, prox) - J.ovr) * 0.8 * limitar(0.5 + 0.6 * p, 0.5, 1) + J.efeito.evolucao;
  else d = Math.min(0.5, ([0, -0.4, -0.9, -1.5, -2.1, -2.8][prox - J.idadePico] ?? -3.4) + J.efeito.queda + J.efeito.evolucao * 0.5);
  let ovr = limitar(Math.round(J.ovr + limitar(d, -6, 8)), 40, J.tetoOvr ?? 95);
  if (prox <= J.idadePico) ovr = Math.min(ovr, Math.max(J.ovr, J.potencial + Math.max(0, Math.round(J.efeito.evolucao))));
  return { jogos: G * p, gols, assist, nota, ovr, vitrine: J.efeito.vitrine, G };
}

const ITENS_PROJECAO = [
  ["jogos", "Jogos"], ["gols", "Gols"], ["assist", "Assist."], ["nota", "Nota"], ["ovr", "OVR fim"], ["vitrine", "Vitrine"],
];
const fmtProj = (k, v) => (k === "nota" ? v.toFixed(1).replace(".", ",") : k === "vitrine" ? (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)).replace(".", ",") : String(Math.round(v)));
// diferenca: inteira quando da, com uma casa quando e pequena (foco de treino num garoto de 16 anos mexe pouco)
const fmtDif = (k, d) => {
  const a = Math.abs(d);
  const txt = k === "nota" || k === "vitrine" || a < 0.95 ? a.toFixed(1).replace(".", ",") : String(Math.round(a));
  return `${d > 0 ? "+" : "−"}${txt}`;
};

function iniciarRolagem() {
  const J = C.J;
  const R = { id: Symbol("rolagem"), prog: 0, eventos: C.eventos, i: 0 };
  C.rolagem = R;
  $("proxima").hidden = true;
  const ext = J.clube.tipo === "ext";
  R.meses = ext ? MESES_EU : MESES_BR;
  // onde cada decisao cai no ano: o foco na pre-temporada, o resto espalhado
  const resto = R.eventos.filter((e) => e.id !== "foco").length;
  let j = 0;
  R.pontos = R.eventos.map((e) => (e.id === "foco" ? 0.02 : 0.22 + (j++ + 0.5) * (0.66 / resto) + (C.rng() - 0.5) * 0.08));
  // a lesao do ano (se vier) ja tem data marcada, mas so pesa quando chega
  const les = sortearLesaoDados(J, C.rng);
  J.lesaoPre = les ? { dados: les, pos: 0.1 + C.rng() * 0.8, aplicada: false } : null;

  const alvo = $("temporada-atual");
  alvo.replaceChildren();
  alvo.append(el("p", "jogo-etapa", `Temporada ${J.ano} · ${J.idade} anos · ${J.clube.nome} (${J.clube.liga})`));
  const DESC_FASE = {
    base: "Base: pouco minuto e pouco dinheiro. Treino e cabeça fora de campo decidem quem sobe.",
    afirmacao: "Afirmação: o primeiro dinheiro, as redes e as tentações. Polêmica pode render ou afundar.",
    auge: "Auge: liderança, vestiário e decisões grandes.",
    veterano: "Veterano: o corpo cobra. Hora de pensar no legado.",
  };
  const fAtual = Historia.fase(J);
  if (!J.historico.length || Historia.fase({ idade: J.idade - 1 }) !== fAtual) alvo.append(el("p", "fase-aviso", DESC_FASE[fAtual]));
  // se o clube mudou de divisao no ano passado (e voce ficou), avisa aqui tambem
  const anterior = J.historico[J.historico.length - 1];
  if (anterior && anterior.mudouDivisao && anterior.clube === J.clube.nome) {
    const m = anterior.mudouDivisao;
    alvo.append(el("p", `aviso-divisao ${m.sobe ? "sobe" : "desce"}`, `${m.sobe ? "▲" : "▼"} O ${J.clube.nome} ${m.sobe ? "subiu" : "caiu"} pra Série ${m.para} no ano passado`));
  }
  // linha do tempo
  const linha = el("div", "rolagem");
  const trilho = el("div", "rolagem-trilho");
  R.barra = el("div", "rolagem-barra");
  trilho.append(R.barra);
  R.marcos = R.pontos.map((p) => { const m = el("span", "rolagem-marco"); m.style.left = `${p * 100}%`; trilho.append(m); return m; });
  const meses = el("div", "rolagem-meses");
  for (const m of R.meses) meses.append(el("span", null, m));
  R.status = el("p", "rolagem-status", "Pré-temporada");
  linha.append(trilho, meses, R.status);
  // projecao
  const proj = el("dl", "projecao");
  R.celulas = {};
  const goleiroAgora = goleiro();
  for (const [k, rot] of ITENS_PROJECAO) {
    if (goleiroAgora && k === "gols") continue;
    const d = el("div", "projecao-item");
    const dd = el("dd"), delta = el("span", "projecao-delta");
    d.append(dd, el("dt", null, rot), delta);
    proj.append(d);
    R.celulas[k] = { dd, delta, box: d };
  }
  R.proj = projecao(J);
  for (const [k, c] of Object.entries(R.celulas)) c.dd.textContent = fmtProj(k, R.proj[k]);
  const legenda = el("p", "projecao-legenda", "Projeção do ano. Cada decisão mexe nesses números.");
  R.log = el("ol", "rolagem-log");
  R.caixa = el("div", "evento-caixa");
  // linha do tempo e projecao ficam presas no topo do palco enquanto a decisao rola
  R.topo = el("div", "rolagem-topo");
  R.topo.append(alvo.firstChild, linha, proj, legenda);
  alvo.append(R.topo, R.caixa, R.log);
  rolarProximo(R);
}

const mesDe = (R, p) => R.meses[Math.min(R.meses.length - 1, Math.floor(p * R.meses.length))];
const vivo = (R) => C.rolagem === R;

function anotar(R, p, texto, classe = "") {
  const li = el("li", classe);
  li.append(el("b", null, mesDe(R, p)), el("span", null, texto));
  R.log.prepend(li);
}

// recalcula a projecao e mostra o que mudou em cada numero
function atualizarProjecao(R) {
  const antes = R.proj;
  R.proj = projecao(C.J);
  for (const [k, c] of Object.entries(R.celulas)) {
    const dif = R.proj[k] - antes[k];
    c.dd.textContent = fmtProj(k, R.proj[k]);
    const limiar = k === "ovr" ? 0.5 : 0.05;
    c.box.classList.remove("mudou-sobe", "mudou-desce");
    if (Math.abs(dif) < limiar) { c.delta.textContent = ""; continue; }
    void c.box.offsetWidth; // reinicia a animacao
    c.box.classList.add(dif > 0 ? "mudou-sobe" : "mudou-desce");
    c.delta.textContent = fmtDif(k, dif);
  }
}

// anda a barra ate o proximo ponto (a lesao no meio do caminho para a barra)
function rolarAte(R, alvoProg) {
  return new Promise((pronto) => {
    const inicio = R.prog, dur = movimentoReduzido ? 120 : 400 + (alvoProg - inicio) * 2600;
    const t0 = performance.now();
    const passo = (agora) => {
      if (!vivo(R)) return;
      const x = Math.min(1, (agora - t0) / dur);
      let p = inicio + (alvoProg - inicio) * x;
      const lp = C.J.lesaoPre;
      if (lp && !lp.aplicada && p >= lp.pos) {
        p = lp.pos;
        R.prog = p; desenharProgresso(R);
        lp.aplicada = true;
        aplicarLesao(C.J, lp.dados);
        anotar(R, p, `${lp.dados.nome}: fora por uns ${lp.dados.jogos} jogos.`, "desce");
        const m = el("span", "rolagem-marco rolagem-lesao"); m.style.left = `${p * 100}%`; R.barra.parentNode.append(m);
        atualizarProjecao(R);
        esperar(1300).then(() => rolarAte(R, alvoProg).then(pronto));
        return;
      }
      R.prog = p; desenharProgresso(R);
      if (x < 1) requestAnimationFrame(passo); else pronto();
    };
    requestAnimationFrame(passo);
  });
}

function desenharProgresso(R) {
  R.barra.style.width = `${R.prog * 100}%`;
  const jogo = Math.max(1, Math.round(R.prog * R.proj.G));
  R.status.textContent = R.prog < 0.03 ? "Pré-temporada" : R.prog >= 1 ? "Fim da temporada" : `${mesDe(R, R.prog)} · jogo ${jogo} de ~${R.proj.G}`;
}

async function rolarProximo(R) {
  if (!vivo(R)) return;
  if (R.i >= R.eventos.length) {
    await rolarAte(R, 1);
    if (!vivo(R)) return;
    await esperar(600);
    if (!vivo(R)) return;
    C.rolagem = null;
    fecharTemporadaCompleta();
    return;
  }
  await rolarAte(R, R.pontos[R.i]);
  if (!vivo(R)) return;
  R.marcos[R.i].classList.add("ativo");
  mostrarDecisao(R);
}

function mostrarDecisao(R) {
  const J = C.J;
  const ev = R.eventos[R.i];
  const caixa = R.caixa;
  caixa.className = `evento-caixa${ev.arco ? " evento-arco" : ""}${ev.consequencia ? " evento-consequencia" : ""}`;
  const selos = el("div", "evento-selos");
  if (ev.arco) selos.append(el("span", "evento-selo", ev.arco));
  if (ev.consequencia) selos.append(el("span", "evento-selo selo-volta", `↻ consequência de: ${ev.consequencia}`));
  caixa.replaceChildren(
    el("p", "evento-cab", `Decisão ${R.i + 1} de ${R.eventos.length} · ${mesDe(R, R.prog)}`),
    ...(selos.childElementCount ? [selos] : []),
    el("h3", "temporada-titulo", ev.titulo),
    el("p", "evento-texto", ev.texto(J)),
  );
  // o palco tem altura fixa no desktop: traz a decisao pra vista
  const palco = caixa.closest(".carreira-palco");
  if (palco && palco.scrollHeight > palco.clientHeight) requestAnimationFrame(() => {
    const topo = palco.scrollTop + caixa.getBoundingClientRect().top - palco.getBoundingClientRect().top - R.topo.offsetHeight - 8;
    palco.scrollTo({ top: Math.max(0, topo), behavior: movimentoReduzido ? "auto" : "smooth" });
  });
  caixa.classList.remove("saindo");
  caixa.style.animation = "none"; void caixa.offsetWidth; caixa.style.animation = "";
  const ops = el("div", "evento-opcoes");
  for (const op of ev.opcoes) {
    const b = el("button", "botao evento-opcao");
    b.type = "button";
    b.append(el("span", null, op.rotulo));
    if (op.chance) {
      const pct = Math.round(op.chance(J) * 100);
      const barra = el("span", "evento-chance");
      barra.style.setProperty("--pct", `${pct}%`);
      b.append(el("small", null, `${pct}% de dar certo`), barra);
    }
    if (op.dica) b.append(el("small", null, op.dica));
    if (op.consequencia) b.append(el("small", "evento-aviso", "↻ isso vai ter consequência"));
    b.addEventListener("click", async () => {
      ops.querySelectorAll("button").forEach((x) => { x.disabled = true; });
      const chance = op.chance ? op.chance(J) : null;
      const r = resolverOpcao(J, op, C.rng);
      if (chance !== null) {
        ops.replaceWith(roleta(chance, r.ok));
        await esperar(movimentoReduzido ? 200 : 3400);
        if (!vivo(R)) return;
      } else ops.remove();
      J.efeito.textos.push({ titulo: ev.titulo, escolha: op.rotulo, texto: r.texto, ok: r.ok });
      Historia.registrar(J, ev, op, r);
      // a cena seguinte do arco entra logo depois, no mesmo mes
      if (r.emSeguida) {
        const prox = R.pontos[R.i + 1] ?? 1;
        const ponto = Math.min(R.prog + 0.05, (R.prog + prox) / 2);
        R.eventos.splice(R.i + 1, 0, r.emSeguida);
        R.pontos.splice(R.i + 1, 0, ponto);
        const m = el("span", "rolagem-marco"); m.style.left = `${ponto * 100}%`; R.barra.parentNode.append(m);
        R.marcos.splice(R.i + 1, 0, m);
      }
      caixa.append(el("p", "evento-escolha", `Você escolheu: ${op.rotulo}`));
      caixa.append(el("p", `evento-resultado ${r.ok === true ? "sobe" : r.ok === false ? "desce" : ""}`, r.texto));
      if (op.consequencia || r.emSeguida) caixa.append(el("p", "evento-lembra", r.emSeguida ? "A história continua…" : "Isso vai voltar."));
      anotar(R, R.prog, `${ev.titulo}: ${op.rotulo.toLowerCase()}.`, r.ok === true ? "sobe" : r.ok === false ? "desce" : "");
      R.marcos[R.i].classList.add(r.ok === false ? "falhou" : "feito");
      atualizarProjecao(R);
      await esperar(2200);
      if (!vivo(R)) return;
      caixa.classList.add("saindo");
      R.i += 1;
      rolarProximo(R);
    });
    ops.append(b);
  }
  caixa.append(ops);
}

// roleta: fatia verde do tamanho da chance, vermelha no resto. Gira e para
// no lado que o dado ja decidiu (a porcentagem mostrada e a de verdade).
function roleta(chance, ok) {
  const caixa = el("div", "roleta");
  const RAIO = 70, L = 2 * Math.PI * RAIO;
  const roda = svg("g", { class: "roleta-roda" });
  roda.append(
    svg("circle", { cx: 100, cy: 100, r: RAIO, fill: "none", stroke: "#ff4d6d", "stroke-width": 44 }),
    svg("circle", { cx: 100, cy: 100, r: RAIO, fill: "none", stroke: "#c8ff00", "stroke-width": 44,
      "stroke-dasharray": `${chance * L} ${L}`, transform: "rotate(-90 100 100)" }),
  );
  // riscos pra dar a sensacao de giro
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * 2 * Math.PI;
    roda.append(svg("line", { x1: 100 + Math.sin(a) * 48, y1: 100 - Math.cos(a) * 48, x2: 100 + Math.sin(a) * 52, y2: 100 - Math.cos(a) * 52, stroke: "rgba(0,0,0,0.35)", "stroke-width": 2 }));
  }
  const centro = svg("text", { x: 100, y: 106, "text-anchor": "middle", class: "roleta-centro" });
  centro.textContent = `${Math.round(chance * 100)}%`;
  const ponteiro = svg("path", { d: "M100 34 L90 12 L110 12 Z", class: "roleta-ponteiro" });
  const desenho = svg("svg", { viewBox: "0 0 200 200", class: "roleta-svg", role: "img", "aria-label": `Roleta: ${Math.round(chance * 100)}% de dar certo` }, [roda, centro, ponteiro]);
  const leg = el("p", "roleta-legenda");
  leg.append(el("span", "roleta-ok", `Dá certo ${Math.round(chance * 100)}%`), el("span", "roleta-falha", `Dá errado ${100 - Math.round(chance * 100)}%`));
  caixa.append(desenho, leg);
  // angulo final (sentido horario a partir do topo) dentro da fatia certa
  const verde = chance * 360;
  const [ini, tam] = ok ? [0, verde] : [verde, 360 - verde];
  const alvoAng = ini + tam * (0.12 + Math.random() * 0.76);
  const voltas = movimentoReduzido ? 0 : 5;
  const final = voltas * 360 + (360 - alvoAng);
  roda.style.transformOrigin = "100px 100px";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    roda.style.transition = movimentoReduzido ? "none" : "transform 3s cubic-bezier(0.12, 0.8, 0.18, 1)";
    roda.style.transform = `rotate(${final}deg)`;
  }));
  setTimeout(() => {
    caixa.classList.add(ok ? "deu-certo" : "deu-errado");
    centro.textContent = ok ? "Deu certo" : "Deu errado";
  }, movimentoReduzido ? 100 : 3100);
  return caixa;
}

function fecharTemporadaCompleta() {
  C.eventos = null;
  $("proxima").hidden = false;
  if (C.modo !== "completo") {
    const linha = jogarTemporada();
    mostrarLinha(linha);
    desenharPainelJogador();
    desenharTabelaCarreira();
    $("proxima").disabled = false;
    if (C.J.aposentado) { $("proxima").textContent = "Ver a aposentadoria"; $("tudo").disabled = true; }
    else $("proxima").textContent = "Próxima temporada";
    return;
  }
  const linha = jogarTemporada({ decidir: false });
  mostrarLinha(linha);
  desenharPainelJogador();
  desenharTabelaCarreira();
  if (C.J.aposentado) { $("proxima").textContent = "Ver a aposentadoria"; $("proxima").disabled = false; $("tudo").disabled = true; return; }
  mostrarMercado(linha);
}

// janela de transferencias: voce escolhe (ou fica). Da pra pedir vaga de titular.
function mostrarMercado(linha) {
  const J = C.J;
  const alvo = $("mercado");
  alvo.hidden = false;
  alvo.replaceChildren(el("h3", "mercado-titulo", `Janela de transferências · ${J.idade} anos · OVR ${J.ovr}`));
  // o palco tem altura fixa: rola ate a janela em vez de a pagina crescer
  requestAnimationFrame(() => {
    const palco = alvo.closest(".carreira-palco");
    if (palco) palco.scrollTo({ top: alvo.offsetTop - palco.offsetTop - 8, behavior: "smooth" });
  });
  const ofertas = C.ofertasAbertas || [];
  const fechar = (texto) => {
    alvo.replaceChildren(el("p", "temporada-aviso", texto));
    C.ofertasAbertas = null;
    $("proxima").disabled = false;
    $("proxima").textContent = "Próxima temporada";
    desenharPainelJogador();
    desenharTabelaCarreira();
  };
  if (!ofertas.length) {
    alvo.append(el("p", "nota", sobContrato(J) ? "Contrato em vigor: a janela passa sem propostas." : "Nenhuma proposta de fora chegou."));
    const so = el("div", "propostas");
    so.append(cartaoDoClube(J, linha, fechar, "Ficou"));
    alvo.append(so);
    return;
  }
  alvo.append(el("p", "nota", `Chance de titular no ${J.clube.nome} hoje: ${Math.round(chanceDeTitular(J.ovr, J.clube.nivel, J.idade) * 100)}%. Pedir vaga de titular pode render a garantia, ou fazer o clube desistir.`));
  const grade = el("div", "propostas");
  grade.append(cartaoDoClube(J, linha, fechar, "Recusou as propostas e ficou"));
  for (const c of ofertas) {
    const assinarAqui = (garantia) => {
      linha.transferencia = { para: c.nome, liga: c.liga, valor: J.valor };
      assinar(c, "mercado");
      if (garantia) J.efeito.minutos += 0.15;
      fechar(`Assinou com o ${c.nome}${garantia ? ", com vaga de titular prometida" : ""}. Valor da transferência: ${dinheiro(J.valor)}. O primeiro ano é de adaptação.`);
    };
    grade.append(cartaoDeProposta(c, () => assinarAqui(false), {
      contexto: "mercado",
      extra: {
        rotulo: "Pedir vaga de titular",
        acao: (card, botao) => {
          const r = pedirGarantia(J, c, C.rng);
          if (r.resultado === "aceitou") return assinarAqui(true);
          botao.remove();
          if (r.resultado === "desistiu") {
            card.classList.add("proposta-retirada");
            card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
            card.append(el("p", "proposta-resposta desce", "O clube não gostou e retirou a proposta."));
          } else card.append(el("p", "proposta-resposta", "Não prometeram nada, mas a proposta segue de pé."));
        },
      },
    }));
  }
  alvo.append(grade);
}

// --- renovacao: o seu clube tambem faz proposta ------------------------------------
// Quem jogou bem ou e titular recebe do proprio clube 2 das 3 ofertas abaixo.
// Toda oferta tem um lado bom e um ruim; nao renovar e sempre possivel.
const sobContrato = (J) => Boolean(J.contratoAte && J.ano <= J.contratoAte);
const RENOVACOES = [
  {
    id: "aumento", rotulo: "Aumento e mais minutos",
    anos: 1, bom: "mais minutos em cada ano do contrato", ruim: "o técnico cobra: nota pesa mais em jogo ruim",
    todoAno: (e) => { e.minutos += 0.12; e.nota -= 0.05; },
    texto: (J) => `Renovou com o ${J.clube.nome}: aumento e promessa de minutos. Agora é entregar.`,
  },
  {
    id: "gol", rotulo: "Bônus por gol", anos: 1,
    bom: "+15% de gols em cada ano do contrato", ruim: "vira fominha: vestiário torce o nariz e saem menos assistências",
    so: (J) => ["CA", "PON", "MEI"].includes(funcaoDe(C.pos)),
    todoAno: (e) => { e.gol += 0.15; e.assist -= 0.2; },
    naAssinatura: (J) => Historia.mexerReputacao(J, { vestiario: -1 }),
    texto: (J) => `Renovou com o ${J.clube.nome} com bônus por gol. Tem companheiro achando que você só pensa no seu.`,
  },
  {
    id: "idolo", rotulo: "Contrato longo de ídolo",
    anos: 2, bom: "torcida abraça e a cabeça tranquila ajuda a evoluir", ruim: "a imprensa fala em acomodação",
    so: (J) => J.anosNoClube >= 2,
    todoAno: (e) => { e.evolucao += 0.5; },
    naAssinatura: (J) => Historia.mexerReputacao(J, { torcida: 2, imprensa: -1 }),
    texto: (J) => `Contrato longo com o ${J.clube.nome}. A torcida fez festa; a imprensa perguntou se você não quer mais.`,
  },
];

function ofertasDeRenovacao(J, linha) {
  const bem = (linha.nota ?? 0) >= 6.8 || (linha.titular ?? 0) >= 0.5;
  if (!bem || J.idade < 17 || sobContrato(J)) return [];
  const possiveis = RENOVACOES.filter((r) => !r.so || r.so(J));
  return Motor.embaralhar ? Motor.embaralhar(C.rng, possiveis).slice(0, 2)
    : possiveis.sort(() => C.rng() - 0.5).slice(0, 2);
}

function cartaoDoClube(J, linha, fechar, textoFicar) {
  const card = el("article", "proposta proposta-ficar");
  const renovar = ofertasDeRenovacao(J, linha);
  card.append(el("p", "proposta-liga", `Seu clube · ${J.clube.tipo === "ext" ? J.clube.liga : `Série ${J.clube.divisao}`}`), el("h3", "proposta-nome", J.clube.nome));
  if (sobContrato(J)) card.append(el("p", "proposta-titular", `Contrato renovado até ${J.contratoAte}: fica no clube.`));
  else if (!renovar.length) card.append(el("p", "proposta-titular", "Fica, briga pela vaga e tenta de novo na próxima janela."));
  else {
    card.classList.add("proposta-renova");
    card.append(el("p", "proposta-titular", "Quer renovar com você:"));
    const lista = el("div", "renova-lista");
    card.append(lista);
    for (const r of renovar) {
      const b = el("button", "botao renova-opcao");
      b.type = "button";
      b.append(el("span", null, r.rotulo), el("small", "renova-bom", `+ ${r.bom}`), el("small", "renova-ruim", `− ${r.ruim}`),
        el("small", "renova-prazo", `contrato: fica mais ${r.anos === 1 ? "1 temporada" : `${r.anos} temporadas`}, sem propostas`));
      b.addEventListener("click", () => {
        // o efeito vale em TODA temporada do contrato (jogarTemporada), a
        // reputacao mexe uma vez so, na assinatura
        J.contratoAte = J.ano + r.anos;
        J.renovacao = { id: r.id, assinado: J.ano, ate: J.contratoAte };
        r.todoAno(J.efeito);
        if (r.naAssinatura) r.naAssinatura(J);
        const texto = r.texto(J);
        J.efeito.textos.push({ titulo: "Renovação", escolha: r.rotulo, texto, ok: null });
        Historia.registrar(J, { titulo: "Renovação", arco: null }, r, { texto, ok: null });
        fechar(texto);
      });
      lista.append(b);
    }
  }
  const b = el("button", "botao", sobContrato(J) ? "Seguir" : renovar.length ? "Ficar sem renovar" : "Ficar");
  b.type = "button";
  b.addEventListener("click", () => fechar(`${textoFicar} no ${J.clube.nome}.`));
  card.append(b);
  return card;
}

function avancarCompleto() {
  const J = C.J;
  $("mercado").hidden = true;
  $("proxima").disabled = true;
  C.eventos = sortearEventos(J, C.rng);
  iniciarRolagem();
}

// --- 5. aposentadoria --------------------------------------------------------------

// bloco da selecao no relatorio: numeros, Copas disputadas, titulos e premios
// "Sua historia": cada arco (historia.js) vira uma trilha de escolhas, na
// ordem em que aconteceram -- estilo fluxograma de Detroit/Until Dawn
function blocoHistoria(J) {
  const sec = el("section", "bl-bloco bl-historia");
  sec.append(el("h4", null, "Sua história"));
  const trilha = ((J.historia && J.historia.trilha) || []).filter((t) => t.arco);
  if (!trilha.length) { sec.append(el("p", "nota", "Carreira sem grandes decisões: nenhum arco foi aberto.")); return sec; }
  const arcos = [];
  for (const t of trilha) {
    let a = arcos.find((x) => x.nome === t.arco);
    if (!a) arcos.push((a = { nome: t.arco, passos: [] }));
    a.passos.push(t);
  }
  for (const a of arcos) {
    const bloco = el("div", "hist-arco");
    bloco.append(el("p", "hist-nome", a.nome));
    const lista = el("ol", "hist-passos");
    for (const p of a.passos) {
      const li = el("li", p.ok === true ? "sobe" : p.ok === false ? "desce" : "");
      li.append(el("span", "hist-quando", `${p.ano} · ${p.idade} anos`), el("b", null, `${p.titulo}: ${p.escolha.toLowerCase()}`), el("span", "hist-texto", p.texto));
      lista.append(li);
    }
    bloco.append(lista);
    sec.append(bloco);
  }
  return sec;
}

function blocoSelecao(J) {
  const pais = paisDe(C.pais);
  const sel = J.historico.filter((h) => h.selecao);
  const sec = el("section", "bl-bloco bl-selecao");
  const h4 = el("h4");
  h4.append(bandeira(pais), el("span", null, `Seleção · ${pais.nome}`));
  sec.append(h4);
  if (!sel.length) { sec.append(el("p", "nota", `Nunca foi convocado. A seleção ${pais.id === "BRA" ? "brasileira" : "de " + pais.nome} pede OVR ${pais.corte}+ e jogando no clube.`)); return sec; }
  const t = sel.reduce((a, h) => ({ j: a.j + h.selecao.jogos, g: a.g + h.selecao.gols, a: a.a + (h.selecao.assist || 0) }), { j: 0, g: 0, a: 0 });
  const tiles = el("dl", "bl-tiles");
  for (const [k, v] of [["Jogos", t.j], ["Gols", t.g], ["Assist.", t.a]]) { const d = el("div"); d.append(el("dd", null, String(v)), el("dt", null, k)); tiles.append(d); }
  sec.append(el("p", "nota", `Estreia em ${J.estreouSelecao}, aos ${sel[0].idade} anos · convocado em ${sel.length} ${sel.length === 1 ? "temporada" : "temporadas"}`), tiles);
  const copas = sel.filter((h) => h.selecao.torneio);
  if (copas.length) {
    const ul = el("ul", "sel-copas");
    for (const h of copas) {
      const s = h.selecao;
      const li = el("li", s.torneioRes === "Campeão" ? "campeao" : "");
      li.append(el("span", null, s.torneio), el("b", null, s.torneioRes), el("small", null, `${s.torneioJogos} J · ${s.torneioGols} G · ${s.torneioAssist} A`));
      ul.append(li);
    }
    sec.append(ul);
  }
  const extras = [...J.titulos.filter((x) => x.selecao).map((x) => ({ nome: x.nome, ouro: true })), ...J.premios.filter((x) => x.selecao).map((x) => ({ nome: x.nome }))];
  if (extras.length) {
    const pr = el("ul", "temporada-premios");
    for (const x of extras) { const li = el("li", x.ouro ? "ouro" : ""); li.append(taca(x.nome, { premio: !x.ouro }), document.createTextNode(x.ouro ? `Campeão · ${x.nome}` : x.nome)); pr.append(li); }
    sec.append(pr);
  }
  return sec;
}

function mostrarAposentadoria() {
  const J = C.J;
  const alvo = $("relatorio");
  alvo.replaceChildren();
  const tot = J.historico.reduce((a, h) => ({ j: a.j + h.jogos, g: a.g + h.gols, a: a.a + h.assist }), { j: 0, g: 0, a: 0 });
  const titulosClube = J.titulos.filter((t) => !t.selecao), premiosClube = J.premios.filter((t) => !t.selecao);
  const auge = [...J.historico].sort((a, b) => b.ovr - a.ovr)[0];
  const melhor = [...J.historico].sort((a, b) => (b.gols + b.assist) - (a.gols + a.assist) || (b.nota ?? 0) - (a.nota ?? 0))[0];
  const clubes = [...new Set(J.historico.map((h) => h.clube))];

  const topo = el("header", "bl-topo");
  const cartaAuge = el("div", "rel-carta");
  const attrsAuge = { ...J.attrs };
  cartaAuge.append(cartaDoCriado(auge.attrs || attrsAuge, auge.ovr, { time: auge.time, nome: auge.clube, kit: auge.kit }, { jogos: tot.j, minutos: J.historico.reduce((m, h) => m + (h.minutos || 0), 0) }));
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
  sNum.firstChild.textContent = "Números pelos clubes";
  for (const [k, v] of [["Jogos", tot.j], ["Gols", tot.g], ["Assist.", tot.a], ["OVR no auge", `${auge.ovr} (${auge.idade})`], ["Títulos", titulosClube.length], ["Craque do jogo", motm]]) {
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
  esquerda.append(sNum, blocoSelecao(J), sDest, blocoHistoria(J));
  const sGal = el("section", "bl-bloco");
  sGal.append(el("h4", null, `Títulos pelos clubes · ${titulosClube.length}`));
  if (!titulosClube.length) sGal.append(el("p", "nota", "Nenhum título. O lobo soprou forte."));
  else {
    const cont = {};
    for (const t of titulosClube) cont[t.nome.replace(/ \d{4}$/, "")] = (cont[t.nome.replace(/ \d{4}$/, "")] || 0) + 1;
    const ul = el("ul", "bl-campeoes");
    for (const [nome, n] of Object.entries(cont).sort((a, b) => b[1] - a[1])) {
      const li = el("li", "comp-bra com-taca");
      li.append(taca(nome, { tamanho: "g" }), el("span", "bl-comp-nome", `${n}×`), el("strong", null, nome));
      ul.append(li);
    }
    sGal.append(ul);
  }
  const sPre = el("section", "bl-bloco");
  sPre.append(el("h4", null, `Prêmios individuais · ${premiosClube.length}`));
  if (!premiosClube.length) sPre.append(el("p", "nota", "Nenhum prêmio individual. Carreira de operário, que também faz falta."));
  else {
    const cont = {};
    for (const t of premiosClube) (cont[t.nome] ||= []).push(t.ano);
    const ul = el("ul", "bl-campeoes bl-premios");
    for (const [nome, anos] of Object.entries(cont).sort((a, b) => b[1].length - a[1].length)) {
      const li = el("li", `com-taca${nome === "Bola de Ouro" ? " premio-ouro" : ""}`);
      li.append(taca(nome, { premio: true, tamanho: "g" }), el("span", "bl-comp-nome", `${anos.length}×`), el("strong", null, nome));
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
    `${J.nome} (${POSICOES[C.pos].nome}, ${pais.nome}) na Prata da Casa, do Tem dado em casa`,
    `${J.historico.length} temporadas · ${tot.j} jogos · ${tot.g} gols · ${tot.a} assistências`,
    `Auge: ${auge.ovr} de OVR aos ${auge.idade} · Títulos: ${J.titulos.length} · Prêmios: ${J.premios.length}`,
    `Clubes: ${clubes.join(" → ")}`,
    "temdadoemcasa.github.io/prata-da-casa.html",
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

// Potencial escondido, por faixa (piso 76): a maioria para entre 76 e 88;
// 10% chegam a 89-92, 6% a 93-95 e so 1% vira lenda (97-99). Atributo trava
// em 95; so a lenda passa disso, ate 99. A carta montada so empurra um pouco.
const FAIXAS_POTENCIAL = [[0.01, 97, 99, 99], [0.07, 93, 95, 95], [0.17, 89, 92, 95], [0.47, 83, 88, 95], [1, 76, 82, 95]];
function sortearPotencial(ovr, f) {
  const rng = C.rng;
  const u = rng();
  const [, a, b, teto] = FAIXAS_POTENCIAL.find(([ate]) => u < ate);
  const potencial = limitar(a + Math.floor(rng() * (b - a + 1)) + Math.round((ovr - 60) * 0.1), 76, b);
  const pico = f === "GOL" ? 33 + Math.floor(rng() * 3) : Motor.sortearPeso(rng, [[28, 0.05], [29, 0.35], [30, 0.4], [31, 0.2]], ([, w]) => w)[0];
  return { potencial, potencialSorteado: potencial, idadePico: pico, ovrInicial: ovr, tetoAtributo: teto, tetoOvr: b };
}

function criarJogador() {
  const f = funcaoDe(C.pos);
  const ovr = ovrDe(C.attrs, f);
  C.J = {
    nome: C.nome || "Sem Nome", numero: C.numero, attrs: { ...C.attrs }, ovr, idade: IDADE_INICIAL, ano: ANO_INICIAL,
    ...sortearPotencial(ovr, f),
    clube: null, historico: [], titulos: [], premios: [], transferencias: [], valor: 0, anosNoClube: 0, aposentado: false,
    efeito: efeitoZerado(), eventosVistos: [],
  };
  Historia.iniciar(C.J);
  reiniciarMundo();
  C.J.valor = valorDeMercado(C.J);
}

async function iniciarCarreiraPagina() {
  UNIFORMES = await json("dados/uniformes.json").catch(() => ({}));
  await Escudos.carregar();
  Motor.ELENCOS = (await json("dados/elencos-fora.json").catch(() => ({}))).times || {};
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
  // o botao nasce desabilitado: clique antes dos dados chegarem nao fazia nada
  $("confirmar-jogador").disabled = false;
  $("confirmar-jogador").textContent = "Montar a carta →";
  $("voltar-criacao").addEventListener("click", () => mostrarTela("criar"));
  $("zerar-pontos").addEventListener("click", iniciarCarta);
  $("confirmar-carta").addEventListener("click", () => { criarJogador(); mostrarPropostasDaBase(); });
  $("proxima").addEventListener("click", () => {
    if (C.J.aposentado) mostrarAposentadoria();
    else avancarCompleto();
  });
  $("tudo").addEventListener("click", simularCarreira);

  montarPaises();
  montarCampoPosicoes();
  atualizarPreviaCamisa();
}

iniciarCarreiraPagina().catch((erro) => {
  console.error(erro);
  $("paises").replaceChildren(el("div", "vazio", "O modo carreira não carregou agora. Tenta de novo daqui a pouco."));
});
