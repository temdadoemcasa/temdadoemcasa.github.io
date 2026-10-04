// Minigame Draft. Reaproveita do app.js: carta, camisa, niveis e
// retrato; e do motor.js a simulacao. Todo texto de dado via textContent.
"use strict";

// Vagas por funcao. [vaga, x%, y%] no gramado (ataque pra cima; x alto = direita).
const ESQUEMAS = {
  "4-3-3": [["GOL", 50, 88], ["LE", 13, 67], ["ZAG", 37, 72], ["ZAG", 63, 72], ["LD", 87, 67],
    ["MC", 27, 47], ["VOL", 50, 55], ["MC", 73, 47], ["PE", 17, 22], ["CA", 50, 16], ["PD", 83, 22]],
  "4-4-2": [["GOL", 50, 88], ["LE", 13, 67], ["ZAG", 37, 72], ["ZAG", 63, 72], ["LD", 87, 67],
    ["ME", 13, 43], ["VOL", 38, 52], ["MC", 62, 49], ["MD", 87, 43], ["CA", 35, 19], ["CA", 65, 19]],
  "4-2-3-1": [["GOL", 50, 88], ["LE", 13, 67], ["ZAG", 37, 72], ["ZAG", 63, 72], ["LD", 87, 67],
    ["VOL", 35, 55], ["VOL", 65, 55], ["PE", 15, 33], ["MEI", 50, 35], ["PD", 85, 33], ["CA", 50, 14]],
  "4-1-4-1": [["GOL", 50, 88], ["LE", 13, 67], ["ZAG", 37, 72], ["ZAG", 63, 72], ["LD", 87, 67],
    ["VOL", 50, 57], ["PE", 14, 37], ["MC", 37, 43], ["MC", 63, 43], ["PD", 86, 37], ["CA", 50, 15]],
  "3-5-2": [["GOL", 50, 88], ["ZAG", 25, 71], ["ZAG", 50, 74], ["ZAG", 75, 71],
    ["ALE", 9, 46], ["MC", 31, 48], ["VOL", 50, 57], ["MEI", 69, 43], ["ALD", 91, 46], ["CA", 35, 19], ["CA", 65, 19]],
  "5-3-2": [["GOL", 50, 88], ["ALE", 9, 61], ["ZAG", 29, 72], ["ZAG", 50, 75], ["ZAG", 71, 72], ["ALD", 91, 61],
    ["MC", 27, 46], ["VOL", 50, 53], ["MC", 73, 46], ["CA", 35, 20], ["CA", 65, 20]],
  "3-4-3": [["GOL", 50, 88], ["ZAG", 25, 72], ["ZAG", 50, 75], ["ZAG", 75, 72],
    ["ALE", 10, 48], ["VOL", 38, 53], ["MC", 62, 53], ["ALD", 90, 48], ["PE", 17, 22], ["CA", 50, 16], ["PD", 83, 22]],
  "3-4-2-1": [["GOL", 50, 88], ["ZAG", 25, 72], ["ZAG", 50, 75], ["ZAG", 75, 72],
    ["ALE", 10, 50], ["VOL", 38, 56], ["MC", 62, 56], ["ALD", 90, 50], ["MEI", 33, 32], ["MEI", 67, 32], ["CA", 50, 15]],
};
// vaga -> [funcao do jogador, sigla no campo, nome por extenso]
const VAGAS = {
  GOL: ["GOL", "GOL", "goleiro"], LD: ["LAT", "LD", "lateral-direito"], LE: ["LAT", "LE", "lateral-esquerdo"],
  ALD: ["LAT", "ALD", "ala direito"], ALE: ["LAT", "ALE", "ala esquerdo"], ZAG: ["ZAG", "ZAG", "zagueiro"],
  VOL: ["VOL", "VOL", "volante"], MC: ["MC", "MC", "meio-campista"], MEI: ["MEI", "MEI", "meia"],
  PD: ["PON", "PD", "ponta-direita"], PE: ["PON", "PE", "ponta-esquerda"],
  MD: ["PON", "MD", "meia pela direita"], ME: ["PON", "ME", "meia pela esquerda"], CA: ["CA", "CA", "centroavante"],
  // banco: a 4a posicao e a lista de funcoes que servem na vaga
  RGOL: ["GOL", "GOL", "goleiro reserva", ["GOL"]],
  RDEF: ["ZAG", "DEF", "defensor reserva", ["ZAG", "LAT"]],
  RMEI: ["MC", "MEI", "meio-campista reserva", ["VOL", "MC", "MEI"]],
  RATA: ["CA", "ATA", "atacante reserva", ["PON", "CA"]],
  RCOR: ["MC", "RES", "reserva de linha (qualquer posição)", ["LAT", "ZAG", "VOL", "MC", "MEI", "PON", "CA"]],
  RES: ["MC", "RES", "reserva", ["GOL", "LAT", "ZAG", "VOL", "MC", "MEI", "PON", "CA"]],
};
const funcoesDaVaga = (pos) => VAGAS[pos][3] || [VAGAS[pos][0]];
// o banco do draft: 5 reservas depois do onze (cobrem lesao e suspensao e
// pesam 0,4 na forca, a mesma regra dos clubes da CPU)
const BANCO_VAGAS = ["RGOL", "RDEF", "RMEI", "RATA", "RCOR"];

// Esquemas no Tem Time em Casa: [ataque, defesa] em pontos da regua de forca.
// base vale sempre; casa/fora, mata (mata-mata), forte (rival mais forte) e
// fraco (rival mais fraco) somam no jogo; chave: o esquema rende mais com
// quem tem os eixos certos nas vagas certas (k por ponto acima de 72, ate +-2,5).
const ESQUEMAS_TTC = {
  "4-3-3": { base: [0.7, -0.4], casa: [0.4, 0], fora: [-0.3, -0.4], mata: [0, -0.3], forte: [-0.4, -0.8], fraco: [0.4, 0],
    chave: { vagas: ["PE", "PD"], eixos: ["RIT", "DRI"], lado: 0, k: 0.2 },
    resumo: "pontas abertos: rende com ponta rápido e driblador; sofre contra os grandes" },
  "4-2-3-1": { base: [0.2, 0.4], casa: [0, 0], fora: [0, 0.3], mata: [0, 0.4], forte: [0, 0.4], fraco: [0, 0],
    chave: { vagas: ["MEI", "VOL"], eixos: ["PAS", "DEF"], lado: 2, k: 0.2 },
    resumo: "equilibrado: dois volantes que marcam seguram o mata-mata; o meia precisa de passe" },
  "4-4-2": { base: [0.2, 0.3], casa: [0.3, 0], fora: [0, 0], mata: [0, 0], forte: [0, 0.3], fraco: [0.2, 0],
    chave: { vagas: ["CA"], eixos: ["FIN", "FIS"], lado: 0, k: 0.2 },
    resumo: "clássico: rende com dupla de área que finaliza e ganha no corpo" },
  "4-1-4-1": { base: [0, 1.1], casa: [0, 0], fora: [0, 0.5], mata: [0, 0.4], forte: [0, 0.8], fraco: [-0.2, 0],
    chave: { vagas: ["VOL", "MC"], eixos: ["DEF", "PAS"], lado: 2, k: 0.2 },
    resumo: "cauteloso: bom fora e contra os grandes; precisa de volante que marca e meio que passa" },
  "3-5-2": { base: [0.3, 0], casa: [0.3, 0], fora: [0, -0.2], mata: [0.3, -0.3], forte: [-0.3, 0], fraco: [0.2, 0],
    chave: { vagas: ["ALE", "ALD", "MC"], eixos: ["RIT", "PAS"], lado: 0, k: 0.2 },
    resumo: "meio povoado: vive dos alas com fôlego e do passe no meio" },
  "3-4-3": { base: [1.2, -1.3], casa: [0.6, 0], fora: [-0.5, -0.8], mata: [0.3, -0.6], forte: [-1, -1.4], fraco: [0.6, 0],
    chave: { vagas: ["PE", "PD", "ALE", "ALD"], eixos: ["RIT", "DRI"], lado: 0, k: 0.2 },
    resumo: "muito ofensivo: com pontas e alas velozes atropela em casa; aberto contra os grandes" },
  "5-3-2": { base: [-0.8, 1.6], casa: [-0.4, 0], fora: [0, 0.8], mata: [0, 0.8], forte: [0, 1.3], fraco: [-0.4, 0],
    chave: { vagas: ["ZAG"], eixos: ["DEF", "FIS"], lado: 1, k: 0.2 },
    resumo: "retranca: com zagueiros fortes segura fora, no mata-mata e contra os grandes" },
  "3-4-2-1": { base: [0.7, -0.5], casa: [0.4, 0], fora: [-0.2, -0.2], mata: [0, 0], forte: [-0.4, -0.4], fraco: [0.3, 0],
    chave: { vagas: ["MEI"], eixos: ["DRI", "PAS"], lado: 0, k: 0.2 },
    resumo: "dois meias atrás do 9: precisa de drible e passe entre as linhas" },
};
// postura: pra cima faz mais gol e toma mais; fechadinho, o contrario. Fora
// de contexto a soma e negativa; no contexto certo compensa: pra cima em casa
// contra quem e mais fraco (ele nao tem como punir o espaco), fechadinho fora
// contra quem e mais forte. Decisivo pergunta; nos outros jogos vale a postura
// escolhida no painel (Equilibrado, se ninguem mexer).
const POSTURAS = {
  ataque: { nome: "Pra cima", atq: 2.5, def: -3, noContexto: { atq: 2.5, def: -1.6 }, contexto: (c) => c.casa && c.dif < -2,
    dica: "mais gol pros dois lados: pra virar, quando só a vitória serve, ou em casa contra time menor" },
  equilibrado: { nome: "Equilibrado", atq: 0, def: 0, dica: "o time de sempre" },
  retranca: { nome: "Fechadinho", atq: -3, def: 2.5, noContexto: { atq: -1.6, def: 2.5 }, contexto: (c) => !c.casa && !c.neutro && c.dif > 2,
    dica: "menos gol pros dois lados: pra segurar vantagem, o empate, ou fora contra time maior" },
};
// funcao vizinha que joga bem na vaga: so 6 cartas sao "meio-campo" puro, e
// volante ou meia fazem a funcao (camisa 8 que marca, meia que recua)
const PARENTES = { MC: ["VOL", "MEI"] };
// encaixe na vaga (multiplica a contribuicao do jogador)
const ENCAIXE = { principal: 1, secundaria: 0.96, familia: 0.88, fora: 0.75, ladoTrocado: 0.95 };
// entrosamento: time montado do zero comeca devendo; cada companheiro de clube
// que ja estava no onze soma (pontos da regua, no ataque e na defesa)
const ENTROSAMENTO = { base: -1, porLigacao: 0.8, teto: 4 };
// acima do teto (o elenco mais forte da Serie A, ataque + defesa, mais 1), a forca rende isso
const TETO_ESTRELAS = 0.1;
// joelho do elenco (pontos em relacao ao elenco mais forte da CPU, antes de
// entrosamento e esquema) e quanto cada ponto rende acima dele
const JOELHO_ELENCO = -8.5;
const RENDE_ACIMA_DO_JOELHO = 0.25;
const TETO_FOLGA = 3; // o time pronto pode passar o clube mais forte por ate 3 pontos cheios
// lesao por jogador por jogo (so no seu clube; a CPU ja entra com a media do elenco)
const TAXA_LESAO = 0.006;
// Chances do leque: abrir figurinha de craque e a graca. Com estas, ~78% dos
// leques trazem tijolo ou concreto e ~94% dos drafts mostram 2+ concretos (a
// bateria mede). Pra estrela nao decidir tudo sozinha, o elenco acima do joelho
// (JOELHO_ELENCO) rende RENDE_ACIMA_DO_JOELHO por ponto: encaixe, entrosamento
// e eixos continuam pesando. Um concreto no lugar de um madeira ainda mexe:
// +1,2 de forca, ~+7 pp de G6 e ~+4 pp de titulo num elenco tipico (estrela.js).
const CHANCES_NORMAIS = { palha: 0.1, madeira: 0.62, tijolo: 0.2, grafeno: 0.08 };
// na janela de transferencias o mercado e outro: vem reforco de verdade
const CHANCES_JANELA = { palha: 0, madeira: 0.55, tijolo: 0.38, grafeno: 0.07 };
// dificuldade: entrosamento inicial do time montado do zero e trocas de leque
const DIFICULDADES = {
  // entrosamento inicial afinado pela bateria (fase 6): ver o comentario de chancesDoLeque
  facil: { nome: "Fácil", chances: CHANCES_NORMAIS, trocas: 2, cartas: 5, entrosamento: 0.2,
    resumo: "seu time já chega meio entrosado e você troca o leque 2 vezes" },
  normal: { nome: "Normal", chances: CHANCES_NORMAIS, trocas: 1, cartas: 5, entrosamento: -1.4,
    resumo: "time montado do zero, 1 troca de leque" },
  dificil: { nome: "Difícil", chances: CHANCES_NORMAIS, trocas: 0, cartas: 5, entrosamento: -3.1,
    resumo: "time montado na última hora, sem troca de leque" },
};
function descreverTatica(esquema) {
  const t = ESQUEMAS_TTC[esquema];
  if (!t) return "";
  const sinal = (v) => (v > 0 ? `+${String(v).replace(".", ",")}` : v < 0 ? `−${String(-v).replace(".", ",")}` : "0");
  return `Ataque ${sinal(t.base[0])} · Defesa ${sinal(t.base[1])} · ${t.resumo}`;
}

const PADROES = [["vertical", "Listras"], ["horizontal", "Faixas"], ["lisa", "Lisa"], ["diagonal", "Diagonal"], ["faixa-peito", "Faixa no peito"]];
const COMP = { bra: "Brasileirão", cdb: "Copa do Brasil", lib: "Libertadores", sul: "Sul-Americana" };
const COMP_CURTA = { bra: "BR", cdb: "CdB", lib: "LIB", sul: "SUL" };
const CHAVE_REGRA = { lib: "libertadores", sul: "sulamericana" };

const D = {
  r: null, regras: null, regrasTemp: null,
  nome: "Tem Dado FC", padrao: "vertical", cor1: "#c8ff00", cor2: "#111111", esquema: "4-3-3",
  sai: null, continental: "lib", grupo: null, dificuldade: "normal", desafio: null, rng: null,
  onze: [], banco: [], vaga: 0, trocas: 1, temp: null, times: null, animando: false, pularAnimacao: false, aba: "bra",
};
// todo sorteio do draft passa por aqui: no desafio do dia, D.rng tem semente
const sorte = () => (D.rng || Math.random)();

const $ = (id) => document.getElementById(id);
const dataJogo = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const mesDe = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });

function mostrar(tela) {
  for (const t of ["clube", "draft", "resumo", "temporada", "fim"]) $(`tela-${t}`).hidden = t !== tela;
  const passo = tela === "resumo" ? "draft" : tela === "fim" ? "temporada" : tela;
  for (const li of $("passos").children) {
    if (li.dataset.passo === passo) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  }
  // depois da criacao do clube a apresentacao encolhe: o jogo vem pra cima
  document.querySelector(".draft-cabecalho").classList.toggle("compacto", tela !== "clube");
  window.scrollTo({ top: 0, behavior: movimentoReduzido ? "auto" : "smooth" });
}

// --- o seu clube ------------------------------------------------------------------

function kitUsuario() {
  const [a, b] = [D.cor1, D.cor2];
  if (D.padrao === "lisa") return { padrao: "lisa", base: a, gola: b };
  if (D.padrao === "vertical" || D.padrao === "horizontal") return { padrao: D.padrao, faixas: [[a, 7], [b, 7]] };
  if (D.padrao === "diagonal") return { padrao: "diagonal", base: a, faixa: b, largura: 14 };
  return { padrao: "faixa-peito", base: a, faixas: [[b, 11]], inicio: 58 };
}
const figuraUsuario = (numero = null) => figura({ nome: D.nome, kit: kitUsuario() }, numero, { cabeca: false });

function atualizarPreview() {
  $("preview-camisa").replaceChildren(figuraUsuario(10));
}

function montarCriacao() {
  const padroes = $("padroes");
  padroes.replaceChildren();
  for (const [id, rot] of PADROES) {
    const b = el("button", "chip", rot);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-pressed", String(D.padrao === id));
    b.setAttribute("aria-checked", String(D.padrao === id));
    b.addEventListener("click", () => { D.padrao = id; montarCriacao(); });
    padroes.append(b);
  }
  atualizarPreview();
}

// quem sai da Serie A pra voce entrar: fixo na Chapecoense (se um dia ela
// nao estiver na base, sai o time mais fraco)
const SAI_PADRAO = "Chapecoense";
function definirQuemSai() {
  const forcas = Motor.timesDaSerieA(D.r);
  if (forcas[SAI_PADRAO]) { D.sai = SAI_PADRAO; return; }
  D.sai = Object.entries(forcas).sort((x, y) => (x[1].atq + x[1].def) - (y[1].atq + y[1].def))[0][0];
}
const FEMININOS = new Set(["Chapecoense", "Ponte Preta", "Portuguesa"]);
const doTime = (nome) => `${FEMININOS.has(nome) ? "da" : "do"} ${nome}`;
const oTime = (nome) => `${FEMININOS.has(nome) ? "A" : "O"} ${nome}`;

// --- draft -------------------------------------------------------------------------

const LADO_DA_VAGA = { LD: "D", ALD: "D", LE: "E", ALE: "E" };

// chances do leque: CHANCES_NORMAIS (la em cima), iguais nas tres dificuldades.
// Bateria de 5.000 temporadas em 27/09 (fase 6, depois do teste do dono,
// scripts/bateria/draft), no Normal: escolher ao acaso fica na metade de cima
// (mediana 9o, Z4 ~10%), pegar sempre a maior nota da ~22% de titulo
// brasileiro e o "inteligente" (encaixe, entrosamento e eixos) ~31% (G6 ~92%),
// com ~3 pontos a mais que a maior nota; sempre a pior cai em ~71%. Facil:
// inteligente campeao ~43%; Dificil: ~18%.
const chancesDoLeque = () => (DIFICULDADES[D.dificuldade] || DIFICULDADES.normal).chances;

// todas as vagas: o onze e depois o banco (D.vaga indexa essa lista)
const todasVagas = () => [...D.onze, ...D.banco];

function sortearLeque(vaga, chances = chancesDoLeque()) {
  const funcoes = funcoesDaVaga(vaga);
  const funcao = funcoes[0];
  const usados = new Set(todasVagas().map((s) => s.jogador).filter(Boolean));
  // quem tem a vaga como posicao principal, e quem tem como secundaria com
  // metade da chance de entrar no sorteio (o Piquerez lateral e ala)
  let pool = D.r.indice.comNota.filter((j) => !usados.has(j)
    && (funcoes.includes(FUNCAO.get(j)) || ([...(FUNCOES_EXTRAS.get(j) || [])].some((f) => funcoes.includes(f)) && sorte() < 0.5)));
  // funcao com pouca gente: completa com a familia da posicao
  if (pool.length < 12) pool = D.r.indice.comNota.filter((j) => funcoes.some((f) => FAMILIA[f].includes(j.posicao)) && !usados.has(j));
  // lateral e ala: so quem joga daquele lado (x medio; x alto = direita)
  const lado = LADO_DA_VAGA[vaga];
  if (lado) {
    const xDe = ladoDoDefensor(D.r);
    const doLado = pool.filter((j) => {
      const x = xNaFuncao(j, funcao, xDe);
      return typeof x === "number" && (lado === "D" ? x >= 0.5 : x < 0.5);
    });
    if (doLado.length >= 5) pool = doLado;
  }
  const porNivel = {};
  for (const j of pool) (porNivel[nivel(j.overall).id] ||= []).push(j);
  const opcoes = [];
  const cartas = (DIFICULDADES[D.dificuldade] || DIFICULDADES.normal).cartas || 5;
  for (let tentativa = 0; opcoes.length < cartas && tentativa < 200; tentativa++) {
    const niveis = Object.keys(chances).filter((id) => porNivel[id] && porNivel[id].some((j) => !opcoes.includes(j)));
    if (!niveis.length) break;
    let x = sorte() * niveis.reduce((s, id) => s + chances[id], 0);
    let escolhido = niveis[niveis.length - 1];
    for (const id of niveis) { x -= chances[id]; if (x <= 0) { escolhido = id; break; } }
    const livres = porNivel[escolhido].filter((j) => !opcoes.includes(j));
    opcoes.push(livres[Math.floor(sorte() * livres.length)]);
  }
  return opcoes;
}

// No draft o gramado e interativo: toque na vaga vazia abre o leque dela; toque
// num jogador escolhe quem mover e o toque seguinte, a vaga pra onde ele vai
// (vazia, ou de outro jogador que tambem cabe na dele: os dois trocam)
function desenharGramado(alvo, { ativa = -1, interativo = false } = {}) {
  alvo.replaceChildren();
  const movendo = interativo ? D.movendo ?? -1 : -1;
  const destinos = movendo >= 0 ? destinosDe(movendo) : [];
  D.onze.forEach((slot, k) => {
    const classes = ["vaga", k === ativa && movendo < 0 ? "vaga-ativa" : "", slot.jogador ? "vaga-cheia" : "",
      k === movendo ? "vaga-movendo" : "", destinos.includes(k) ? "vaga-destino" : ""].filter(Boolean).join(" ");
    const v = el(interativo ? "button" : "div", classes);
    if (interativo) v.type = "button";
    v.style.left = `${slot.x}%`;
    v.style.top = `${slot.y}%`;
    if (slot.jogador) {
      const j = slot.jogador;
      const camisa = el("span", "vaga-camisa");
      camisa.append(figuraUsuario(j.camisa));
      v.append(camisa, el("span", `vaga-nota nivel-${nivel(j.overall).id}`, String(j.overall)), el("span", "vaga-nome", sobrenome(j.nome)));
      v.title = `${j.nome} · veio do ${TIME_DE.get(j).nome}`;
    } else {
      v.append(el("span", "vaga-vazia", VAGAS[slot.pos][1]));
      if (interativo) v.title = `Escolher o ${VAGAS[slot.pos][2].toLowerCase()}`;
    }
    if (interativo) {
      if (movendo >= 0) v.title = k === movendo ? "Cancelar" : destinos.includes(k) ? `Levar ${sobrenome(D.onze[movendo].jogador.nome)} para ${VAGAS[slot.pos][1]}` : v.title;
      else if (slot.jogador) v.title = `${v.title} · toque pra mudar de posição`;
      v.setAttribute("aria-label", v.title);
      v.addEventListener("click", () => tocarVaga(k));
    }
    alvo.append(v);
  });
}

// toque numa vaga do gramado durante o draft
function tocarVaga(k) {
  const slot = D.onze[k];
  if (D.movendo != null && D.movendo >= 0) {
    const de = D.movendo;
    D.movendo = null;
    if (k !== de && destinosDe(de).includes(k)) moverDeVaga(de, k);
    else abrirLeque();
    return;
  }
  if (slot.jogador) {
    if (!destinosDe(k).length) { avisoDoDraft(`${sobrenome(slot.jogador.nome)} não joga em nenhuma outra vaga do esquema.`); return; }
    D.movendo = k;
    abrirLeque();
    avisoDoDraft(`Pra onde vai ${sobrenome(slot.jogador.nome)}? Toque numa vaga marcada (ou nele de novo pra cancelar).`);
    return;
  }
  D.vaga = k;
  abrirLeque();
}
function avisoDoDraft(texto) {
  const a = $("draft-aviso");
  if (!a) return;
  a.textContent = texto;
  a.hidden = !texto;
}

// No desafio do dia, o leque de cada vaga sai de uma semente propria (data +
// vaga + quantas vagas iguais vieram antes + troca), entao todo mundo que monta
// o mesmo esquema ve os mesmos leques (menos quem ja estiver no seu time).
function hashTexto(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function lequeDaVaga(k) {
  const slot = todasVagas()[k];
  if (!D.desafio) return sortearLeque(slot.pos);
  const antes = todasVagas().slice(0, k).filter((s) => s.pos === slot.pos).length;
  D.rng = Motor.rngDe(hashTexto(`${D.desafio.semente}|${slot.pos}|${antes}|${D.trocasUsadas || 0}`));
  const leque = sortearLeque(slot.pos);
  D.rng = null;
  return leque;
}

// o leque da vaga atual: cada vaga sorteia UMA vez no draft. Escolher, mover
// ou esvaziar a vaga nao apaga o leque dela (voltar pra vaga mostra as cartas
// que sobraram) -- so "Trocar o leque" refaz. Mudar jogador de vaga nao pode
// virar sorteio infinito.
function lequeAtual() {
  const na = todasVagas().map((s) => s.jogador).filter(Boolean);
  if (!D.leques[D.vaga]) D.leques[D.vaga] = lequeDaVaga(D.vaga);
  D.leques[D.vaga] = D.leques[D.vaga].filter((j) => !na.includes(j));
  if (!D.leques[D.vaga].length) D.leques[D.vaga] = lequeDaVaga(D.vaga);
  return D.leques[D.vaga];
}

// O que a carta faz no SEU time: encaixe na vaga e entrosamento com quem ja
// esta no onze (companheiros do mesmo clube). Texto curto pra tela.
function avaliacaoNaVaga(j, pos) {
  const enc = encaixeNaVaga(j, pos);
  const clube = TIME_DE.get(j).nome;
  const companheiros = VAGAS[pos][3] ? 0 : D.onze.filter((s) => s.jogador && TIME_DE.get(s.jogador).nome === clube).length;
  const encaixe = enc >= ENCAIXE.principal ? ["ok", "Na função"]
    : enc >= ENCAIXE.secundaria * ENCAIXE.ladoTrocado ? ["meio", "Joga aí às vezes"]
    : enc >= ENCAIXE.familia * ENCAIXE.ladoTrocado ? ["ruim", "Improvisado"] : ["pessimo", "Fora de posição"];
  return { encaixe: enc, rotuloEncaixe: encaixe, companheiros, clube };
}

function abrirLeque() {
  const slot = todasVagas()[D.vaga];
  const noBanco = D.vaga >= D.onze.length;
  $("vaga-nome").textContent = VAGAS[slot.pos][2];
  const feitas = todasVagas().filter((s) => s.jogador).length;
  $("vaga-progresso").textContent = noBanco
    ? `Banco: reserva ${feitas - D.onze.length + 1} de ${D.banco.length} · cobre lesão e suspensão e pesa na força do elenco`
    : `Escolha ${feitas + 1} de 11 · ${D.esquema}`;
  $("trocar-leque").disabled = D.trocas <= 0;
  $("trocar-leque").textContent = D.trocas > 0 ? `Trocar o leque (${D.trocas} ${D.trocas > 1 ? "vezes" : "vez"})` : "Sem trocas de leque";
  desenharGramado($("gramado"), { ativa: noBanco ? -1 : D.vaga, interativo: true });
  desenharBanco($("vaga-progresso"), noBanco ? D.vaga - D.onze.length : -1, { interativo: true });
  avisoDoDraft(D.onze.every((s) => s.jogador) || D.movendo != null ? "" : "Toque numa vaga vazia pra escolher outra posição, ou num jogador pra mudar ele de posição.");
  const leque = $("leque");
  leque.replaceChildren();
  lequeAtual().forEach((j, i) => {
    const b = el("button", "opcao");
    b.type = "button";
    const av = avaliacaoNaVaga(j, slot.pos);
    b.setAttribute("aria-label", `${j.nome}, ${TIME_DE.get(j).nome}, overall ${j.overall}, ${av.rotuloEncaixe[1]}${av.companheiros ? `, entrosa com ${av.companheiros}` : ""}`);
    const carta = cartaDoJogador(j, TIME_DE.get(j), D.r, { estatica: true });
    carta.classList.add("revelando");
    carta.style.animationDelay = movimentoReduzido ? "0s" : `${i * 90}ms`;
    const selos = el("span", "opcao-selos");
    selos.append(el("span", `selo-encaixe encaixe-${av.rotuloEncaixe[0]}`, av.rotuloEncaixe[1]));
    if (av.companheiros) selos.append(el("span", "selo-entrosa", `+Entrosa ×${av.companheiros}`));
    b.append(carta, selos, el("span", "opcao-clube", `${funcoesDe(j).map((f) => NOME_FUNCAO[f]).join(" / ")} · ${TIME_DE.get(j).nome}`));
    b.addEventListener("click", () => escolher(j));
    leque.append(b);
  });
  const ent = entrosamento(D.onze.map((s) => s.jogador));
  $("draft-chances").textContent = `Entrosamento do onze: ${textoEntrosamento(ent)} · ${textoChances()}`;
}

// "−0,3 na força (time novo −1,3, +0,5 × 2 ligações)": o sinal sozinho parecia
// contradizer as ligacoes (2 ligacoes e numero negativo)
function textoEntrosamento(ent) {
  const base = (DIFICULDADES[D.dificuldade] || {}).entrosamento ?? ENTROSAMENTO.base;
  const lig = `${ent.ligacoes} ${ent.ligacoes === 1 ? "ligação" : "ligações"}`;
  return `${sinalDecimal(ent.bonus)} na força (time novo ${sinalDecimal(base)}, ${sinalDecimal(ENTROSAMENTO.porLigacao)} × ${lig}${ent.bonus >= ENTROSAMENTO.teto ? ", no teto" : ""})`;
}
const sinalDecimal = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}`;
const textoChances = () => {
  const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `Chances por carta (${DIFICULDADES[D.dificuldade].nome}): ${NIVEIS.map((t) => `${t.nome} ${pct(chancesDoLeque()[t.id])}`).join(" · ")}`;
};

// banco: lista curta logo depois de "depois" (no draft, embaixo do progresso;
// no resumo, embaixo do gramado)
function desenharBanco(depois, ativa = -1, { interativo = false } = {}) {
  const pai = depois.parentElement;
  if (!pai) return;
  let lista = pai.querySelector(".banco-lista");
  if (!lista) { lista = el("ol", "banco-lista"); lista.setAttribute("aria-label", "Banco de reservas"); depois.after(lista); }
  lista.replaceChildren();
  D.banco.forEach((slot, k) => {
    const li = el("li", `banco-vaga${k === ativa ? " vaga-ativa" : ""}${slot.jogador ? " vaga-cheia" : ""}`);
    if (slot.jogador) {
      const j = slot.jogador;
      li.append(el("span", `vaga-nota nivel-${nivel(j.overall).id}`, String(j.overall)), el("span", "vaga-nome", sobrenome(j.nome)));
      li.title = `${j.nome} · ${NOME_FUNCAO[FUNCAO.get(j)] || ""} · veio do ${TIME_DE.get(j).nome}`;
    } else {
      li.append(el("span", "vaga-vazia", VAGAS[slot.pos][1]));
      // no draft, reserva vazia tambem e clicavel (o banco depois do onze)
      if (interativo) {
        li.classList.add("banco-clicavel");
        li.tabIndex = 0; li.setAttribute("role", "button");
        li.setAttribute("aria-label", `Escolher reserva: ${VAGAS[slot.pos][2]}`);
        const abrir = () => { D.movendo = null; D.vaga = D.onze.length + k; abrirLeque(); };
        li.addEventListener("click", abrir);
        li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
      }
    }
    lista.append(li);
  });
}

// a proxima vaga vazia: o onze primeiro, depois o banco (mover alguem de vaga
// pode esvaziar uma de tras)
const proximaVaga = () => todasVagas().findIndex((s) => !s.jogador);

// trava curta depois de cada escolha: no celular, o toque duplo pegava a carta
// do leque seguinte (que aparece no mesmo lugar) sem querer
const TRAVA_ESCOLHA_MS = 350;
let travaEscolhaAte = 0;

function escolher(jogador) {
  // draft completo, clique durante a trava ou carta que nao e do leque aberto: ignora
  if (D.vaga < 0 || performance.now() < travaEscolhaAte) return;
  if (!(D.leques[D.vaga] || []).includes(jogador)) return;
  travaEscolhaAte = performance.now() + TRAVA_ESCOLHA_MS;
  todasVagas()[D.vaga].jogador = jogador;
  D.movendo = null;
  D.vaga = proximaVaga();
  if (D.vaga >= 0) abrirLeque();
  else mostrarResumo();
}

// cabe na vaga: uma das funcoes dele e a da vaga, e lateral/ala do lado certo
// (sem lado medido nao barra: ausencia nao e "joga do outro lado")
function cabeNaVaga(j, pos) {
  if (!funcoesDe(j).includes(VAGAS[pos][0])) return false;
  const lado = LADO_DA_VAGA[pos];
  const x = lado ? xNaFuncao(j, VAGAS[pos][0], ladoDoDefensor(D.r)) : undefined;
  return typeof x !== "number" || (lado === "D" ? x >= 0.5 : x < 0.5);
}

// vagas pra onde o jogador da vaga k pode ir: vazia em que ele cabe, ou de
// outro jogador quando os dois cabem na vaga um do outro (trocam)
const destinosDe = (k) => {
  const j = D.onze[k] && D.onze[k].jogador;
  if (!j) return [];
  return D.onze.map((s, i) => i).filter((i) => i !== k && cabeNaVaga(j, D.onze[i].pos)
    && (!D.onze[i].jogador || cabeNaVaga(D.onze[i].jogador, D.onze[k].pos)));
};

// muda o jogador de vaga (Bruno Henrique de CA pra PE pra escolher outro
// centroavante). A vaga que esvazia volta com o leque DELA (o que sobrou), nunca
// um sorteio novo; se o destino tinha alguem, os dois trocam.
function moverDeVaga(k, i) {
  if (!destinosDe(k).includes(i)) return;
  const [a, b] = [D.onze[k].jogador, D.onze[i].jogador];
  D.onze[i].jogador = a;
  D.onze[k].jogador = b;
  D.movendo = null;
  // a vaga que esvaziou abre na hora (mudou o BH pra PE: agora escolhe o CA);
  // numa troca entre duas cheias, segue a vaga que estava aberta (ou a proxima)
  if (!b) D.vaga = k;
  else if (D.vaga < 0 || todasVagas()[D.vaga].jogador) D.vaga = proximaVaga();
  if (D.vaga >= 0) abrirLeque();
  else mostrarResumo();
}

// --- resumo ------------------------------------------------------------------------

// id interno do clube do usuario, fixo e independente do nome na tela: com o
// nome como id, "Fortaleza" (ou qualquer convidado da Copa do Brasil) virava o
// Fortaleza da CPU e ainda podia pegar ele mesmo no sorteio. Nome de clube nao
// comeca com "_" (as chaves "_..." do JSON sao comentario e ninguem vira time).
const ID_USUARIO = "_seu_clube";
const idUsuario = () => ID_USUARIO;

// --- forca: eixos, encaixe, entrosamento, banco e esquema ------------------------------

const calib = () => (D.regras && D.regras.motor_ttc) || null;
const REGUA_MEDIA = 55.5;
const FUNCAO_PADRAO = { G: "GOL", D: "ZAG", M: "MC", F: "CA" };
const funcaoDe = (j) => FUNCAO.get(j) || FUNCAO_PADRAO[j.posicao] || "MC";
let cacheLado = null;
const ladoDe = () => { if (!cacheLado || cacheLado.r !== D.r) cacheLado = { r: D.r, x: ladoDoDefensor(D.r) }; return cacheLado.x; };

// quanto o jogador rende na vaga: 1 na funcao principal, menos na secundaria,
// improvisado na mesma linha (familia) ou fora de posicao; lateral do lado
// trocado perde um pouco
function encaixeNaVaga(j, pos) {
  if (!j) return 0;
  const funcoes = funcoesDaVaga(pos);
  let e = funcoes.includes(FUNCAO.get(j)) ? ENCAIXE.principal
    : funcoesDe(j).some((f) => funcoes.includes(f)) || funcoes.some((f) => (PARENTES[f] || []).includes(FUNCAO.get(j))) ? ENCAIXE.secundaria
    : funcoes.some((f) => FAMILIA[f].includes(j.posicao)) ? ENCAIXE.familia : ENCAIXE.fora;
  const lado = LADO_DA_VAGA[pos];
  if (lado) {
    const x = xNaFuncao(j, "LAT", ladoDe());
    if (typeof x === "number" && (lado === "D" ? x < 0.5 : x >= 0.5)) e *= ENCAIXE.ladoTrocado;
  }
  return e;
}
// valor do jogador na vaga (mesma conta do motor, so pra comparar opcoes)
function valorNaVaga(j, pos) {
  const f = VAGAS[pos][3] ? funcaoDe(j) : VAGAS[pos][0];
  const wa = Motor.PESO_FUNCAO.atq[f] ?? 0.5, wd = Motor.PESO_FUNCAO.def[f] ?? 0.5;
  return ((wa * Motor.valorAtaque(j) + wd * Motor.valorDefesa(j)) / (wa + wd)) * encaixeNaVaga(j, pos);
}
// ligacoes: em cada clube, quantos companheiros alem do primeiro
function entrosamento(jogadores) {
  const porClube = new Map();
  for (const j of jogadores) {
    if (!j || !j.player_id) continue;
    const c = TIME_DE.get(j) ? TIME_DE.get(j).nome : null;
    if (c) porClube.set(c, (porClube.get(c) || 0) + 1);
  }
  let ligacoes = 0;
  for (const n of porClube.values()) ligacoes += n - 1;
  const base = (DIFICULDADES[D.dificuldade] || {}).entrosamento ?? ENTROSAMENTO.base;
  return { ligacoes, porClube, bonus: Math.min(ENTROSAMENTO.teto, base + ENTROSAMENTO.porLigacao * ligacoes) };
}
// bonus do esquema pelos eixos de quem esta nas vagas-chave
function bonusDoEsquema(onze, esquema) {
  const e = ESQUEMAS_TTC[esquema];
  if (!e) return { atq: 0, def: 0, chave: 0 };
  let chave = 0;
  const c = e.chave;
  if (c) {
    const vals = onze.filter((s) => s.jogador && c.vagas.includes(s.pos)).flatMap((s) => c.eixos.map((k) => {
      const v = s.jogador.eixos && s.jogador.eixos[k];
      return typeof v === "number" ? v : 60;
    }));
    if (vals.length) chave = Math.max(-2.5, Math.min(2.5, c.k * (vals.reduce((a, b) => a + b, 0) / vals.length - 72)));
  }
  const atq = e.base[0] + (c && c.lado !== 1 ? (c.lado === 2 ? chave / 2 : chave) : 0);
  const def = e.base[1] + (c && c.lado !== 0 ? (c.lado === 2 ? chave / 2 : chave) : 0);
  return { atq, def, chave };
}
// regua: a Serie A (sem voce) define media e desvio de ataque e de defesa
function naReguaTtc(bruto) {
  const e = D.escala2, dp = (calib() && calib().regua_dp) || 3.2;
  return { atq: REGUA_MEDIA + ((bruto.atq - e.atq.m) / e.atq.dp) * dp, def: REGUA_MEDIA + ((bruto.def - e.def.m) / e.def.dp) * dp };
}
// clubes da Serie A pela mesma conta (onze base + 5 melhores de fora dele)
function timesCpu() {
  if (D.cpu && D.cpu.r === D.r && D.cpu.regras === D.regras) {
    return Object.fromEntries(Object.entries(D.cpu.times).map(([k, t]) => [k, { ...t }]));
  }
  const times = Motor.timesDaSerieA(D.r);
  const brutos = {};
  for (const t of Object.values(times)) {
    const resto = t.time.jogadores.filter((j) => !t.onze.includes(j) && j.overall !== null).sort((a, b) => b.overall - a.overall).slice(0, 5);
    brutos[t.id] = Motor.forcaPorEixos(t.onze.map((j) => ({ jogador: j, funcao: funcaoDe(j), encaixe: 1 })),
      [...t.onze, ...resto].map((j) => ({ jogador: j, funcao: funcaoDe(j) })));
  }
  const escala = (lado) => {
    const v = Object.values(brutos).map((b) => b[lado]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return { m, dp: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1 };
  };
  D.escala2 = { atq: escala("atq"), def: escala("def") };
  let teto = -Infinity;
  for (const t of Object.values(times)) {
    const r = naReguaTtc(brutos[t.id]);
    teto = Math.max(teto, r.atq + r.def);
    const b = ESQUEMAS_TTC[t.formacao] ? ESQUEMAS_TTC[t.formacao].base : [0, 0];
    t.atq = r.atq + b[0];
    t.def = r.def + b[1];
  }
  // teto do time de estrelas: o elenco mais forte da liga (antes do esquema) e,
  // pro time pronto, o clube mais forte com esquema, com uma folga
  D.teto = teto + JOELHO_ELENCO;
  D.tetoTime = Math.max(...Object.values(times).map((t) => t.atq + t.def)) + TETO_FOLGA;
  D.cpu = { r: D.r, regras: D.regras, times };
  return timesCpu();
}
// estrangeiros e convidados da Copa do Brasil, com o ajuste da calibragem
function timesDeForaTtc(regras) {
  const times = Motor.timesDeFora(regras);
  const c = calib() || {};
  for (const t of Object.values(times)) {
    if (t.pais === "BRA") continue;
    let f = t.atq + (c.estrangeiros || 0) + ((c.estrangeiros_pais || {})[t.pais] || 0);
    if (typeof c.estrangeiros_teto === "number" && f > c.estrangeiros_teto) f = c.estrangeiros_teto + (f - c.estrangeiros_teto) * 0.5;
    t.atq = f; t.def = f;
  }
  return times;
}

// forca do seu time com um onze e um banco (o do draft, ou o do dia do jogo)
function forcaDoElenco(onze = D.onze, banco = D.banco, esquema = D.esquema) {
  if (!D.escala2) timesCpu();
  const titulares = onze.filter((s) => s.jogador).map((s) => ({ jogador: s.jogador, funcao: VAGAS[s.pos][0], encaixe: encaixeNaVaga(s.jogador, s.pos) }));
  const elenco = [...onze, ...banco].filter((s) => s.jogador).map((s) => ({ jogador: s.jogador, funcao: funcaoDe(s.jogador) }));
  const r = naReguaTtc(Motor.forcaPorEixos(titulares, elenco));
  const ent = entrosamento(onze.map((s) => s.jogador));
  const esq = bonusDoEsquema(onze, esquema);
  // time de estrelas: o elenco (antes de entrosamento e esquema) acima do mais
  // forte da liga rende pouco por ponto (a bola e uma so; onze craques de onze
  // clubes nao rendem a soma). Entrosamento e esquema somam por cima.
  let { atq, def } = r;
  const sobra = atq + def - D.teto;
  if (sobra > 0) { atq -= (sobra * (1 - RENDE_ACIMA_DO_JOELHO)) / 2; def -= (sobra * (1 - RENDE_ACIMA_DO_JOELHO)) / 2; }
  atq += ent.bonus + esq.atq; def += ent.bonus + esq.def;
  const sobraTime = atq + def - D.tetoTime;
  if (sobraTime > 0) { atq -= (sobraTime * (1 - TETO_ESTRELAS)) / 2; def -= (sobraTime * (1 - TETO_ESTRELAS)) / 2; }
  return { atq, def, entrosamento: ent, esquema: esq };
}

// o jogo pede: casa/fora, mata-mata, rival mais forte ou mais fraco, postura
function ajusteDeContexto(f, { casa = true, neutro = false, mata = false, rival = null, postura = "equilibrado", esquema = D.esquema } = {}) {
  const e = ESQUEMAS_TTC[esquema] || {};
  let atq = f.atq, def = f.def;
  const soma = (v) => { if (v) { atq += v[0]; def += v[1]; } };
  if (!neutro) soma(casa ? e.casa : e.fora);
  if (mata) soma(e.mata);
  const dif = rival ? (rival.atq + rival.def) - (f.atq + f.def) : 0;
  if (dif > 3) soma(e.forte);
  else if (dif < -3) soma(e.fraco);
  const p = POSTURAS[postura];
  if (p) {
    const efeito = p.contexto && p.contexto({ casa, neutro, dif }) ? p.noContexto : p;
    atq += efeito.atq; def += efeito.def;
  }
  return { atq, def };
}

function timeDoUsuario() {
  const onze = D.onze.map((s) => s.jogador);
  const f = forcaDoElenco();
  return {
    id: idUsuario(), nome: D.nome, usuario: true, serieA: true, onze, kit: kitUsuario(), formacao: D.esquema,
    atq: f.atq, def: f.def, entrosamento: f.entrosamento, bonusEsquema: f.esquema, artilheiros: Motor.forcaDoOnze(onze).artilheiros,
  };
}

function serieAComUsuario() {
  const serieA = timesCpu();
  delete serieA[D.sai];
  const eu = timeDoUsuario();
  serieA[eu.id] = eu;
  return serieA;
}

function mostrarResumo() {
  mostrar("resumo");
  const serieA = serieAComUsuario();
  const ranking = Object.values(serieA).sort((a, b) => (b.atq + b.def) - (a.atq + a.def));
  const eu = ranking.find((t) => t.usuario);
  const pos = ranking.indexOf(eu) + 1;
  const media = Math.round(D.onze.reduce((s, x) => s + x.jogador.overall, 0) / 11);
  // ataque e defesa estao na regua de forca dos clubes (Motor.naRegua), nao na
  // escala das cartas: a referencia e a propria Serie A
  const outros = ranking.filter((t) => !t.usuario);
  const mediaLiga = Math.round(outros.reduce((s, t) => s + (t.atq + t.def) / 2, 0) / outros.length);
  const maisForte = Math.round(Math.max(...outros.map((t) => (t.atq + t.def) / 2)));

  const alvo = $("resumo");
  alvo.replaceChildren();
  const coluna = el("div", "resumo-campo");
  const campo = el("div", "gramado gramado-resumo");
  desenharGramado(campo);
  coluna.append(campo);
  const info = el("div", "resumo-info");
  info.append(el("p", "resumo-nome", D.nome));
  const numeros = el("dl", "resumo-numeros");
  for (const [rot, val] of [["Média do onze (cartas)", media], ["Força de ataque", Math.round(eu.atq)], ["Força de defesa", Math.round(eu.def)]]) {
    const d = el("div");
    d.append(el("dd", null, String(val)), el("dt", null, rot));
    numeros.append(d);
  }
  info.append(numeros);
  info.append(el("p", "nota", `A média é a nota das cartas. Força de ataque e de defesa é outra escala, a dos clubes: média da Série A ${mediaLiga}, o mais forte ${maisForte}, já com o efeito do ${D.esquema}.`));
  info.append(el("p", "resumo-frase", `No papel, seria o ${pos}º time mais forte da Série A 2026. ${vereditoDoPapel(pos)}`));
  const ent = eu.entrosamento;
  const clubes = [...ent.porClube].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} do ${c}`);
  info.append(el("p", "nota", `Entrosamento: ${textoEntrosamento(ent)}${clubes.length ? ` · ${clubes.join(", ")}` : " · ninguém do mesmo clube"}. Improvisados: ${D.onze.filter((s) => encaixeNaVaga(s.jogador, s.pos) < ENCAIXE.principal).length}.`));
  info.append(seletorDeEsquema(() => mostrarResumo()));
  info.append(el("p", "nota", `${D.esquema}: ${descreverTatica(D.esquema)}.`));
  const chances = el("p", "resumo-chances", "Calculando as chances…");
  chances.setAttribute("aria-live", "polite");
  info.append(chances);
  const ul = el("ul", "resumo-comps");
  for (const c of [`Brasileirão, no lugar ${doTime(D.sai)}`, "Copa do Brasil, a partir da 5ª fase", `${COMP[D.continental]}: grupo sorteado quando a temporada começar`]) {
    ul.append(el("li", null, c));
  }
  info.append(el("p", "nota", "Temporada:"), ul);
  alvo.append(coluna, info);
  desenharBanco(campo);
  // 50 temporadas rapidas (~0,5 s, em pedacos pra tela nao travar)
  const pedido = (D.pedidoChances = (D.pedidoChances || 0) + 1);
  estimarChances(50).then((c) => {
    if (pedido !== D.pedidoChances) return;
    const p = (v) => `${Math.round((100 * v) / c.n)}%`;
    chances.textContent = `Em ${c.n} temporadas simuladas: G6 ${p(c.g6)} · Z4 ${p(c.z4)} · campeão brasileiro ${p(c.bra)} · algum título ${p(c.titulo)}`;
  });
}

// uma frase de resenha pro lugar no papel (papel nao entra em campo)
function vereditoDoPapel(pos) {
  if (pos <= 2) return "Candidato ao título: já pode ensaiar a volta olímpica.";
  if (pos <= 6) return "Cara de G6 e de Libertadores.";
  if (pos <= 12) return "Time pra brigar na metade de cima.";
  if (pos <= 16) return "Vai ter que suar, mas é bola na rede que conta.";
  return "No papel é Z4, mas papel não entra em campo.";
}

// select de esquema (resumo e temporada): reescala o elenco no esquema novo
function seletorDeEsquema(depois) {
  const rot = el("label", "seletor-esquema", "Esquema ");
  const sel = el("select");
  for (const e of Object.keys(ESQUEMAS)) sel.append(new Option(e, e, false, e === D.esquema));
  sel.addEventListener("change", () => { trocarEsquema(sel.value); depois(); });
  rot.append(sel);
  return rot;
}

// postura dos jogos que nao sao decisivos (o decisivo pergunta na hora)
function seletorDePostura() {
  const rot = el("label", "seletor-esquema", "Postura nos outros jogos ");
  const sel = el("select");
  for (const [id, p] of Object.entries(POSTURAS)) sel.append(new Option(p.nome, id, false, id === (D.temp ? D.temp.ttc.posturaPadrao : "equilibrado")));
  sel.title = "Pra cima rende em casa contra time menor; Fechadinho, fora contra time maior. Fora disso, custa.";
  sel.addEventListener("change", () => {
    if (!D.temp) return;
    D.temp.ttc.posturaPadrao = sel.value;
    if (D.log) D.log.push({ i: D.temp.i, t: "pp", v: sel.value });
    mostrarDicaDoProximo();
    salvarTemporada();
  });
  rot.append(sel);
  return rot;
}

// o elenco (16) no esquema novo: cada vaga pega o melhor que sobrou, na ordem
// goleiro, zaga, laterais, volantes, 9, meias, meio, pontas; o resto e o banco
const ORDEM_ESCALAR = ["GOL", "ZAG", "LAT", "VOL", "CA", "MEI", "MC", "PON"];
function escalarNoEsquema(jogadores, esquema) {
  const onze = ESQUEMAS[esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: null }));
  const livres = jogadores.filter(Boolean);
  const ordem = onze.map((_, i) => i).sort((a, b) => ORDEM_ESCALAR.indexOf(VAGAS[onze[a].pos][0]) - ORDEM_ESCALAR.indexOf(VAGAS[onze[b].pos][0]));
  for (const i of ordem) {
    let melhor = -1, mv = -Infinity;
    livres.forEach((j, k) => { const v = valorNaVaga(j, onze[i].pos); if (v > mv) { mv = v; melhor = k; } });
    if (melhor >= 0) onze[i].jogador = livres.splice(melhor, 1)[0];
  }
  return { onze, banco: livres.map((j) => ({ pos: "RES", jogador: j })) };
}
function trocarEsquema(esquema) {
  if (!ESQUEMAS[esquema] || esquema === D.esquema) return;
  const r = escalarNoEsquema(todasVagas().map((s) => s.jogador), esquema);
  D.esquema = esquema;
  D.onze = r.onze;
  D.banco = r.banco;
  atualizarTimeDoUsuario();
}
// depois de mexer no elenco durante a temporada, a forca base acompanha (e o
// diario da temporada salva lembra quando mexeu, pra retomar igual)
function atualizarTimeDoUsuario() {
  if (!D.temp) return;
  if (D.log && !D.repetindo) D.log.push({ i: D.temp.i, t: "elenco", ...fotoDoElenco() });
  const t = timeDoUsuario();
  Object.assign(D.temp.times[D.temp.usuario], { atq: t.atq, def: t.def, onze: t.onze, formacao: t.formacao, artilheiros: t.artilheiros, entrosamento: t.entrosamento });
}

// --- temporada -----------------------------------------------------------------------

// sorteia um grupo e tira dele o estrangeiro mais fraco pra entrar o usuario
function regrasComUsuario(id, rng = sorte) {
  const regras = structuredClone(D.regras);
  const grupos = regras[CHAVE_REGRA[D.continental]].grupos;
  const letras = Object.keys(grupos);
  const letra = letras[Math.floor(rng() * letras.length)];
  const forca = (n) => (regras.estrangeiros[n] ? regras.estrangeiros[n].forca : 99);
  const sai = [...grupos[letra]].sort((a, b) => forca(a) - forca(b))[0];
  grupos[letra] = grupos[letra].map((n) => (n === sai ? id : n));
  return { regras, grupo: { letra, sai } };
}

// A temporada sem tela: o jogo, as chances do resumo e a bateria usam a mesma.
// O seu clube muda de jogo pra jogo (temp.preJogo): quem esta lesionado ou
// suspenso sai, o banco cobre (ou um garoto da base), e entram o esquema no
// contexto (casa, mata-mata, rival) e a postura escolhida pro jogo.
function montarTemporada({ semente, rngGrupo = sorte } = {}) {
  const serieA = serieAComUsuario();
  const eu = serieA[ID_USUARIO];
  const { regras, grupo } = regrasComUsuario(eu.id, rngGrupo);
  // quem saiu da Serie A continua existindo: segue na Libertadores/Sul-Americana
  // (sem isso, o grupo dele ficava sem time e a copa travava)
  const saiu = timesCpu()[D.sai];
  const times = { ...(saiu ? { [D.sai]: saiu } : {}), ...serieA, ...timesDeForaTtc(regras) };
  const temp = Motor.criarTemporada({ regras, times, serieA: Object.keys(serieA), usuario: eu.id, semente, calib: calib() });
  temp.ttc = { regras, grupo, lesoes: new Map(), suspensos: new Map(), posturas: new Map(), ocorrencias: [], janelaUsada: false, janelaVista: false, escalacao: null, posturaPadrao: "equilibrado" };
  temp.preJogo = (etapa, par) => timeNoJogo(temp, etapa, par);
  temp.posJogo = (etapa, jogo) => depoisDoJogo(temp, etapa, jogo);
  return temp;
}

const GAROTO_EIXOS = { RIT: 58, FIN: 52, PAS: 55, DRI: 54, DEF: 52, FIS: 56, REF: 58, EVI: 56, MAO: 56, PES: 52, SAI: 52 };
const garotoDaBase = (pos) => ({ nome: "Garoto da base", posicao: FAMILIA[VAGAS[pos][0]][0], overall: 60, eixos: GAROTO_EIXOS, camisa: 30 });
const disponivel = (st, j) => Boolean(j) && !st.lesoes.has(j) && !st.suspensos.has(j);

// o onze do dia: desfalque sai e entra o reserva que mais rende na vaga
function escalacaoDoDia(st) {
  const reservas = D.banco.map((s) => s.jogador).filter((j) => disponivel(st, j));
  const usados = new Set();
  const onze = D.onze.map((slot) => {
    if (disponivel(st, slot.jogador)) return { pos: slot.pos, jogador: slot.jogador };
    let melhor = null, mv = -Infinity;
    for (const r of reservas) if (!usados.has(r)) { const v = valorNaVaga(r, slot.pos); if (v > mv) { mv = v; melhor = r; } }
    if (melhor) { usados.add(melhor); return { pos: slot.pos, jogador: melhor, no_lugar_de: slot.jogador }; }
    return { pos: slot.pos, jogador: garotoDaBase(slot.pos), no_lugar_de: slot.jogador };
  });
  return { onze, banco: reservas.filter((r) => !usados.has(r)).map((j) => ({ pos: "RES", jogador: j })) };
}

function timeNoJogo(temp, etapa, par) {
  const st = temp.ttc, eu = temp.usuario, casa = par.casa === eu;
  const rival = temp.times[casa ? par.fora : par.casa];
  const esc = escalacaoDoDia(st);
  const f = forcaDoElenco(esc.onze, esc.banco, D.esquema);
  const aj = ajusteDeContexto(f, { casa, neutro: Boolean(par.neutro), mata: Boolean(etapa.mata), rival, postura: st.posturas.get(etapa) || st.posturaPadrao || "equilibrado" });
  st.escalacao = esc;
  const onze = esc.onze.map((s) => s.jogador);
  return { ...temp.times[eu], atq: aj.atq, def: aj.def, onze, artilheiros: Motor.forcaDoOnze(onze).artilheiros };
}

// depois do jogo: cumpre lesao e suspensao (conta jogos seus), vermelho
// suspende o proximo, e cada titular pode se machucar (1 a 8 jogos, quase
// sempre poucos)
function depoisDoJogo(temp, etapa, jogo) {
  const st = temp.ttc, rng = temp.rng;
  for (const m of [st.lesoes, st.suspensos]) for (const [j, n] of [...m]) { if (n <= 1) m.delete(j); else m.set(j, n - 1); }
  const esc = st.escalacao;
  st.escalacao = null;
  if (!esc) return;
  const meu = jogo.casa === temp.usuario ? "casa" : "fora";
  const titulares = esc.onze.map((s) => s.jogador).filter((j) => j.player_id);
  for (const ev of jogo.eventos) {
    if (ev.tipo !== "vermelho" || ev.lado !== meu) continue;
    const j = titulares.find((x) => x.nome === ev.autor);
    if (j) { st.suspensos.set(j, 1); st.ocorrencias.push({ data: etapa.data, tipo: "suspensão", jogador: j, jogos: 1 }); }
  }
  for (const j of titulares) {
    if (rng() >= TAXA_LESAO) continue;
    const n = 1 + Math.floor(rng() * rng() * 8);
    st.lesoes.set(j, Math.max(n, st.lesoes.get(j) || 0));
    st.ocorrencias.push({ data: etapa.data, tipo: "lesão", jogador: j, jogos: n });
  }
}

// Decisivo pro usuario (pergunta a postura): a volta do mata-mata, com o
// agregado na mesa, e a final em jogo unico; no Brasileirao, so quando alguma
// linha da tabela esta em jogo pra ele (emJogoNoBrasileirao). A ida do
// mata-mata e jogo comum: vale a postura do painel.
const ehIda = (etapa) => Boolean(etapa.mata && !etapa.final && /\(ida\)/.test(etapa.rotulo));
function decisivaParaUsuario(temp, etapa) {
  if (!etapa) return false;
  if (etapa.mata) return !ehIda(etapa);
  if (etapa.comp !== "bra") return false;
  const par = etapa.montar().find((j) => j.casa === temp.usuario || j.fora === temp.usuario);
  return Boolean(par && emJogoNoBrasileirao(temp));
}

// O que o Brasileirao ainda decide pro usuario, pela tabela e pelos pontos que
// faltam: titulo, vaga na Libertadores (G6), na Sul-Americana (7o-12o) e fugir
// do Z4. So nas ultimas RETA_FINAL rodadas; a linha esta em jogo quando o
// usuario esta a ate MARGEM_EM_JOGO pontos dela (2, ou 4 nas 2 ultimas) e a
// conta ainda pode virar com os jogos que restam. Assim uma temporada tipica
// para ~11 vezes (mata-mata ~8,6 + Brasileirao ~3), em vez de ~13 com a 36a-38a
// sempre decisivas.
const RETA_FINAL = 6;
const MARGEM_EM_JOGO = (restam) => (restam <= 2 ? 4 : 2);
function emJogoNoBrasileirao(temp) {
  const restam = 38 - temp.bra.rodada;
  if (restam > RETA_FINAL || restam <= 0) return null;
  const tab = Motor.ordenar(temp.bra.tabela);
  const pos = tab.findIndex((l) => l.id === temp.usuario) + 1;
  const eu = tab[pos - 1];
  const falta = (l) => 3 * (38 - l.j);
  const margem = MARGEM_EM_JOGO(restam);
  const zonas = (temp.ttc && temp.ttc.regras.brasileirao.zonas) || [];
  const zona = (nome) => zonas.find((z) => z.nome === nome);
  const linhas = [
    { k: 1, nome: "o título" },
    zona("Rebaixamento") && { k: zona("Rebaixamento").de - 1, nome: "fugir do Z4" },
    zona("Libertadores") && { k: zona("Libertadores").ate, nome: "a vaga na Libertadores" },
    zona("Sul-Americana") && { k: zona("Sul-Americana").ate, nome: "a vaga na Sul-Americana" },
  ].filter(Boolean);
  for (const { k, nome } of linhas) {
    if (pos <= k) {
      // dentro da linha: quem vem logo abaixo ainda alcanca?
      const abaixo = tab[k];
      if (!abaixo) continue;
      const folga = eu.pts - abaixo.pts;
      if (folga <= margem && abaixo.pts + falta(abaixo) >= eu.pts) return { linha: k, nome, texto: `Em jogo: ${nome} · ${folga ? `você tem ${folga} ${folga === 1 ? "ponto" : "pontos"} de folga` : "empatado com quem está logo abaixo"}` };
    } else {
      // fora da linha: da pra alcancar quem esta nela?
      const alvo = tab[k - 1];
      const atras = alvo.pts - eu.pts;
      if (atras <= margem && eu.pts + falta(eu) >= alvo.pts) return { linha: k, nome, texto: `Em jogo: ${nome} · ${atras ? (atras === 1 ? "falta 1 ponto" : `faltam ${atras} pontos`) : "empatado com o time da linha"}` };
    }
  }
  return null;
}
const decisiva = (e) => decisivaParaUsuario(D.temp, e);

// o que esta em jogo (texto curto pro cartao da postura)
function contextoDecisivo(temp, etapa) {
  const eu = temp.usuario;
  if (etapa.mata && /\(volta\)/.test(etapa.rotulo)) {
    const ida = [...temp.historico].reverse().find((h) => h.etapa.comp === etapa.comp && h.etapa.fase === etapa.fase && h.doUsuario);
    if (ida) {
      const j = ida.doUsuario, meus = j.casa === eu ? j.gc : j.gf, deles = j.casa === eu ? j.gf : j.gc;
      const rival = j.casa === eu ? j.fora : j.casa;
      const sit = meus > deles ? "você leva vantagem" : meus < deles ? `você precisa tirar ${deles - meus} de diferença` : "tudo igual";
      const decideEmCasa = j.casa !== eu;
      return { rival, texto: `Ida: ${meus}×${deles} contra ${nomeDe(rival)} · ${sit} · volta ${decideEmCasa ? "em casa" : "fora"} · ${comparacaoDeForca(temp, rival)}`, saldoIda: meus - deles };
    }
  }
  if (etapa.comp === "bra") {
    const par = etapa.montar().find((j) => j.casa === eu || j.fora === eu);
    if (par) {
      const tab = Motor.ordenar(temp.bra.tabela);
      const rival = par.casa === eu ? par.fora : par.casa;
      const p = (id) => tab.findIndex((l) => l.id === id) + 1;
      const l = (id) => tab[p(id) - 1];
      const jogo = emJogoNoBrasileirao(temp);
      return { rival, par, emJogo: jogo, texto: `${jogo ? `${jogo.texto} · ` : ""}Você: ${p(eu)}º com ${l(eu).pts} pts · ${nomeDe(rival)}: ${p(rival)}º com ${l(rival).pts} pts · ${par.casa === eu ? "em casa" : "fora"} · ${comparacaoDeForca(temp, rival)}` };
    }
  }
  // mata-mata: se a etapa e a proxima, o sorteio ja pode ser revelado (o jogo
  // usa o mesmo par, ver confrontosDuplos no motor)
  const par = parDoUsuario(temp, etapa);
  if (par) {
    const rival = par.casa === eu ? par.fora : par.casa;
    const onde = par.neutro ? "campo neutro" : par.casa === eu ? "em casa" : "fora de casa";
    return { rival, par, texto: `${etapa.final ? "Final" : "Ida"} ${onde} contra ${nomeDe(rival)} · ${comparacaoDeForca(temp, rival)}` };
  }
  return { rival: null, texto: etapa.final ? "Final em jogo único, campo neutro" : "Mata-mata: o adversário sai no sorteio" };
}

// o jogo do usuario numa etapa, sem sortear fora de hora: mata-mata so quando
// a etapa e a proxima do calendario (o sorteio acontece uma vez so)
function parDoUsuario(temp, etapa) {
  if (etapa.mata && temp.etapas[temp.i] !== etapa) return null;
  return etapa.montar().find((j) => j.casa === temp.usuario || j.fora === temp.usuario) || null;
}
// "rival mais forte", pela mesma regua (e o mesmo corte) do esquema e da postura
function comparacaoDeForca(temp, rival) {
  const eu = temp.times[temp.usuario], ele = temp.times[rival];
  if (!eu || !ele) return "";
  const dif = (ele.atq + ele.def) - (eu.atq + eu.def);
  return dif > 3 ? "rival mais forte" : dif < -3 ? "rival mais fraco" : "jogo parelho";
}

// joga as etapas sem o usuario ate a de indice k (a do proximo jogo dele)
function avancarAte(k) {
  let andou = 0;
  while (D.temp.i < k && !Motor.terminou(D.temp)) { Motor.avancar(D.temp); andou++; }
  return andou;
}

// janela de transferencias: na pausa da Copa do Mundo, 1 troca
function janelaAberta(temp = D.temp) {
  if (!temp || temp.ttc.janelaUsada) return false;
  const [ini] = temp.ttc.regras.brasileirao.pausa_copa || [];
  const prox = temp.etapas[temp.i], ult = temp.etapas[temp.i - 1];
  return Boolean(ini && prox && ult && ult.data < ini && prox.data >= ini);
}
function lequeDaJanela(k) {
  const slot = todasVagas()[k];
  const pos = slot.pos === "RES" ? "RCOR" : slot.pos;
  const antes = D.rng;
  if (D.desafio) D.rng = Motor.rngDe(hashTexto(`${D.desafio.semente}|janela|${pos}`));
  const leque = sortearLeque(pos, CHANCES_JANELA);
  D.rng = antes;
  return leque;
}
function aplicarJanela(k, jogador) {
  if (!janelaAberta()) return false;
  todasVagas()[k].jogador = jogador;
  D.temp.ttc.janelaUsada = true;
  atualizarTimeDoUsuario();
  return true;
}

// chances: temporadas rapidas com o elenco de agora (postura equilibrada,
// sem janela), sem tocar no sorteio do jogo
function simularTemporadaRapida(semente, rngGrupo) {
  const temp = montarTemporada({ semente, rngGrupo });
  while (!Motor.terminou(temp)) Motor.avancar(temp);
  const pos = Motor.ordenar(temp.bra.tabela).findIndex((l) => l.id === temp.usuario) + 1;
  return { pos, bra: temp.campeoes.bra === temp.usuario, titulo: Object.values(temp.campeoes).includes(temp.usuario) };
}
async function estimarChances(n = 50) {
  const rng = Motor.rngDe(D.desafio ? hashTexto(`${D.desafio.semente}|chances`) : Math.floor(Math.random() * 1e9));
  const c = { n, g6: 0, z4: 0, bra: 0, titulo: 0 };
  for (let k = 0; k < n; k++) {
    const r = simularTemporadaRapida(Math.floor(rng() * 1e9), rng);
    if (r.pos <= 6) c.g6++;
    if (r.pos >= 17) c.z4++;
    if (r.bra) c.bra++;
    if (r.titulo) c.titulo++;
    if (k % 10 === 9 && typeof requestAnimationFrame === "function") await respirar();
  }
  return c;
}

// cor principal da camisa (pro fundo do placar)
function corDe(id) {
  const t = D.times ? D.times[id] : null;
  if (!t) return "#30363d";
  if (t.usuario) return corDoKit(kitUsuario());
  return corDoKit(t.serieA ? kitDoTime(t.time) : kitDoTime({ nome: t.nome, kit: t.kit }));
}

function camisaDe(id, numero = null) {
  const t = D.times ? D.times[id] : null;
  if (!t) return figura({ nome: id }, numero, { cabeca: false });
  if (t.usuario) return figuraUsuario(numero);
  if (t.serieA) return figura(t.time, numero, { cabeca: false });
  return figura({ nome: t.nome, kit: t.kit }, numero, { cabeca: false });
}
const nomeDe = (id) => (D.times && D.times[id] ? D.times[id].nome : id);

// semente e sementeGrupo vem dados quando a temporada e retomada (a mesma
// semente refaz a mesma temporada); senao, sorteia
function comecarTemporada({ semente: sementeDada = null, sementeGrupo: grupoDado = null } = {}) {
  if (!D.repetindo) evento("tem-time/temporada");
  D.pedidoChances = (D.pedidoChances || 0) + 1; // chances pendentes nao escrevem mais
  const semente = sementeDada ?? (D.desafio ? hashTexto(`${D.desafio.semente}|temporada`) : Math.floor(Math.random() * 1e9));
  const sementeGrupo = grupoDado ?? Math.floor(Math.random() * 1e9);
  const rngGrupo = Motor.rngDe(D.desafio ? hashTexto(`${D.desafio.semente}|grupo`) : sementeGrupo);
  D.temp = montarTemporada({ semente, rngGrupo });
  D.semente = semente;
  D.sementeGrupo = sementeGrupo;
  D.elenco0 = fotoDoElenco();
  D.log = [];
  D.times = D.temp.times;
  D.regrasTemp = D.temp.ttc.regras;
  D.grupo = D.temp.ttc.grupo;
  D.aba = "bra";
  $("feed").replaceChildren();
  $("rodada-lista").replaceChildren();
  $("rodada-titulo").textContent = "Resultados da rodada";
  for (const b of ["proximo", "ate-decisivo", "simular-tudo", "sim-ir"]) $(b).disabled = false;
  const tatica = $("tatica-temporada");
  if (tatica) tatica.replaceChildren(seletorDeEsquema(() => atualizarPaineis()), seletorDePostura());
  D.mes = D.temp.etapas[0].data.slice(0, 7);
  D.diaSel = null;
  $("proximo").textContent = "Próximo jogo";
  const alvos = [["bra", COMP.bra], ["cdb", COMP.cdb], [D.continental, COMP[D.continental]]];
  $("sim-alvo").replaceChildren(...alvos.map(([v, t]) => new Option(t, v)));
  mostrar("temporada");
  if (!D.menu) {
    const tela = $("tela-temporada");
    const colJogo = tela.querySelector(".coluna-jogo"), colTab = tela.querySelector(".coluna-tabelas");
    D.menu = montarAbasMobile(tela, [
      { id: "jogo", rotulo: "Jogo", icone: "jogo", paineis: [colJogo], aoAbrir: () => { if (D.visao !== "jogo") mudarVisao("jogo"); } },
      { id: "tabelas", rotulo: "Tabelas", icone: "tabela", paineis: [colTab], aoAbrir: () => { if (D.visao !== "jogo") mudarVisao("jogo"); } },
      { id: "calendario", rotulo: "Calendário", icone: "calendario", paineis: [], aoAbrir: () => { if (D.visao !== "cal") mudarVisao("cal"); } },
    ], "jogo");
  }
  mudarVisao("jogo");
  D.menu.abrir("jogo", { rolar: false });
  const jogo = $("jogo");
  jogo.replaceChildren(
    el("p", "jogo-etapa", "Temporada 2026"),
    el("p", "jogo-dica", `Sorteio: ${D.nome} cai no grupo ${D.grupo.letra} da ${COMP[D.continental]}, no lugar do ${D.grupo.sai}. ${oTime(D.sai)} foi pra Série B.`),
    el("p", "jogo-dica", "Antes de cada jogo decisivo você escolhe a postura. Na pausa da Copa abre a janela: 1 troca no elenco."),
    el("p", "jogo-dica", "A temporada fica salva neste aparelho: fechou a aba, volta de onde parou."),
  );
  delete jogo.dataset.resultado;
  atualizarPaineis();
}

// --- temporada salva (localStorage): recarregou a pagina, volta de onde parou ---------
// Nao guarda a temporada inteira: guarda as sementes, o elenco do inicio e o que a
// pessoa mudou (elenco, postura do painel, posturas dos decisivos). O motor e
// determinista com a semente, entao refazer da o mesmo resultado; o numero de
// jogos e um resumo dos gols conferem.
const CHAVE_TEMPORADA = "tem-time-temporada";
const fotoDoElenco = () => ({
  esquema: D.esquema,
  onze: D.onze.map((s) => [s.pos, s.x, s.y, s.jogador ? s.jogador.player_id : null]),
  banco: D.banco.map((s) => [s.pos, s.jogador ? s.jogador.player_id : null]),
});
const somaDosGols = (meus) => meus.reduce((s, h) => s + h.doUsuario.gc * 31 + h.doUsuario.gf, 0);
function salvarTemporada() {
  if (!D.temp || !D.log || D.repetindo) return;
  const t = D.temp;
  const meus = t.historico.filter((h) => h.doUsuario);
  const dados = {
    v: 1, salvoEm: Date.now(), nome: D.nome, padrao: D.padrao, cor1: D.cor1, cor2: D.cor2, continental: D.continental,
    dificuldade: D.dificuldade, desafio: D.desafio, sai: D.sai, semente: D.semente, sementeGrupo: D.sementeGrupo,
    elenco0: D.elenco0, log: D.log, posturas: [...t.ttc.posturas].map(([e, v]) => [t.etapas.indexOf(e), v]),
    i: t.i, janelaUsada: t.ttc.janelaUsada, meus: meus.length, gols: somaDosGols(meus),
  };
  try { localStorage.setItem(CHAVE_TEMPORADA, JSON.stringify(dados)); } catch { /* sem espaco ou modo privado: segue sem salvar */ }
}
function apagarTemporadaSalva() {
  try { localStorage.removeItem(CHAVE_TEMPORADA); } catch { /* sem storage */ }
}
// le e confere o formato; salvo velho ou corrompido vira "nao tem" (e sai do aparelho)
function lerTemporadaSalva() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE_TEMPORADA) || "null"); } catch { s = undefined; }
  const foto = (f) => f && typeof f.esquema === "string" && Array.isArray(f.onze) && Array.isArray(f.banco);
  const valido = s && s.v === 1 && Number.isInteger(s.semente) && Number.isInteger(s.sementeGrupo) && Number.isInteger(s.i) && s.i > 0
    && Number.isInteger(s.meus) && Number.isInteger(s.gols) && typeof s.nome === "string" && foto(s.elenco0)
    && Array.isArray(s.log) && s.log.every((e) => e && Number.isInteger(e.i) && (e.t !== "elenco" || foto(e)))
    && Array.isArray(s.posturas) && COMP[s.continental] && DIFICULDADES[s.dificuldade];
  if (valido) return s;
  if (s !== null) apagarTemporadaSalva();
  return null;
}

// refaz a temporada salva: mesmo elenco, mesmas sementes, as mudancas no mesmo ponto
function retomarTemporada(s) {
  const porId = new Map(D.r.indice.comNota.map((j) => [j.player_id, j]));
  const aplicar = (f) => {
    if (!ESQUEMAS[f.esquema]) return false;
    D.esquema = f.esquema;
    D.onze = f.onze.map(([pos, x, y, id]) => ({ pos, x, y, jogador: porId.get(id) || null }));
    D.banco = f.banco.map(([pos, id]) => ({ pos, jogador: porId.get(id) || null }));
    return D.onze.length === 11 && [...D.onze, ...D.banco].every((x) => x.jogador && VAGAS[x.pos]);
  };
  Object.assign(D, { nome: s.nome || "Tem Dado FC", padrao: s.padrao || D.padrao, cor1: s.cor1 || D.cor1, cor2: s.cor2 || D.cor2,
    continental: s.continental, dificuldade: s.dificuldade, desafio: s.desafio || null, sai: s.sai || D.sai, vaga: -1, movendo: null, leques: {} });
  if (!aplicar(s.elenco0)) throw new Error("elenco salvo nao bate com a base");
  D.repetindo = true;
  try {
    comecarTemporada({ semente: s.semente, sementeGrupo: s.sementeGrupo });
    const t = D.temp;
    for (const [k, v] of s.posturas) if (t.etapas[k] && POSTURAS[v]) t.ttc.posturas.set(t.etapas[k], v);
    for (const e of s.log) {
      while (t.i < e.i && !Motor.terminou(t)) Motor.avancar(t);
      if (e.t === "elenco") { if (!aplicar(e)) throw new Error("elenco salvo nao bate com a base"); atualizarTimeDoUsuario(); }
      else if (e.t === "pp" && POSTURAS[e.v]) t.ttc.posturaPadrao = e.v;
    }
    while (t.i < s.i && !Motor.terminou(t)) Motor.avancar(t);
    t.ttc.janelaUsada = Boolean(s.janelaUsada);
    t.ttc.janelaVista = t.ttc.janelaUsada;
    const meus = t.historico.filter((h) => h.doUsuario);
    if (t.i !== s.i || meus.length !== s.meus || somaDosGols(meus) !== s.gols) throw new Error("a temporada refeita nao bateu com a salva");
    D.log = s.log;
  } finally {
    D.repetindo = false;
  }
  // a tela: formulario do clube, feed, ultimo jogo, paineis
  $("nome-time").value = D.nome;
  $("cor1").value = D.cor1; $("cor2").value = D.cor2;
  for (const o of $("continental").children) { o.setAttribute("aria-pressed", String(o.dataset.valor === D.continental)); o.setAttribute("aria-checked", String(o.dataset.valor === D.continental)); }
  const meus = D.temp.historico.filter((h) => h.doUsuario);
  for (const h of meus) adicionarFeed(h);
  const tatica = $("tatica-temporada");
  if (tatica) tatica.replaceChildren(seletorDeEsquema(() => atualizarPaineis()), seletorDePostura());
  const ultimo = meus[meus.length - 1];
  if (ultimo) { mostrarPlacarPronto(ultimo); mostrarRodada(ultimo); }
  $("jogo").append(el("p", "jogo-dica", `Temporada retomada: ${meus.length} ${meus.length === 1 ? "jogo" : "jogos"} já disputados. Bora!`));
  seguirCalendario();
  atualizarPaineis();
  if (Motor.terminou(D.temp)) encerrar();
}

// aviso na tela do clube: tem temporada salva? continua com um toque
function mostrarRetomar() {
  for (const v of document.querySelectorAll(".retomar")) v.remove();
  const s = lerTemporadaSalva();
  if (!s) return;
  const caixa = el("div", "retomar");
  caixa.setAttribute("role", "region");
  caixa.setAttribute("aria-label", "Temporada em andamento");
  const textos = el("div", "retomar-textos");
  const quando = s.desafio && typeof s.desafio.data === "string" ? ` · desafio de ${s.desafio.data.split("-").reverse().slice(0, 2).join("/")}` : "";
  textos.append(el("strong", null, "Tem temporada rolando"),
    el("span", "nota", `${s.nome} · ${s.meus} ${s.meus === 1 ? "jogo disputado" : "jogos disputados"}${quando}`));
  const ir = el("button", "botao botao-primario", "Continuar a temporada");
  ir.type = "button";
  ir.id = "retomar-temporada";
  ir.addEventListener("click", () => {
    try { retomarTemporada(s); }
    catch (erro) {
      apagarTemporadaSalva();
      D.repetindo = false;
      mostrar("clube");
      mostrarRetomar();
      $("tela-clube").prepend(el("p", "nota retomar-erro", "Essa temporada salva não deu pra retomar (o jogo mudou desde então). Bora montar um time novo?"));
    }
  });
  caixa.append(textos, ir);
  $("tela-clube").prepend(caixa);
}

// placar do ponto de vista do usuario
function lado(j) {
  const casa = j.casa === D.temp.usuario;
  return { casa, meus: casa ? j.gc : j.gf, deles: casa ? j.gf : j.gc, rival: casa ? j.fora : j.casa };
}
function resultado(j) {
  const { meus, deles } = lado(j);
  if (j.classificado) return j.classificado === D.temp.usuario ? "v" : "d";
  return meus > deles ? "v" : meus < deles ? "d" : "e";
}

function montarPlacar(x) {
  const j = x.doUsuario;
  const alvo = $("jogo");
  alvo.replaceChildren();
  alvo.dataset.comp = x.etapa.comp;
  delete alvo.dataset.resultado;
  const decisivo = decisiva(x.etapa);
  const topo = el("p", "jogo-etapa", `${x.etapa.rotulo} · ${dataJogo(x.etapa.data)}${j.neutro ? " · campo neutro" : ""}`);
  if (decisivo) topo.prepend(el("b", "tag-decisivo", "Decisivo"));
  const placar = el("div", "placar");
  const time = (id) => {
    const t = el("div", `placar-time${id === D.temp.usuario ? " eu" : ""}`);
    const c = el("span", "placar-camisa"); c.append(camisaDe(id));
    t.append(c, el("span", "placar-nome", nomeDe(id)));
    return t;
  };
  const meio = el("div", "placar-meio");
  const numeros = el("div", "placar-numeros");
  const gc = el("span", null, "0"), gf = el("span", null, "0");
  numeros.append(gc, el("i", null, "×"), gf);
  const relogio = el("span", "relogio", "0'");
  meio.append(numeros, relogio);
  placar.append(time(j.casa), meio, time(j.fora));
  placar.style.setProperty("--cor-casa", corDe(j.casa));
  placar.style.setProperty("--cor-fora", corDe(j.fora));
  const lances = el("ol", "gols");
  const penaltis = el("div", "penaltis-area");
  const rodape = el("p", "jogo-rodape");
  alvo.append(topo, placar, lances, penaltis, rodape);
  return { gc, gf, relogio, lances, penaltis, rodape };
}

function linhaDeLance(ev, j) {
  const meu = (ev.lado === "casa") === (j.casa === D.temp.usuario);
  const quem = ev.autor || `jogador do ${nomeDe(ev.lado === "casa" ? j.casa : j.fora)}`;
  const li = el("li", `lance lance-${ev.tipo} lado-${ev.lado}${meu ? " lance-meu" : ""}`);
  const min = `${ev.min > 90 ? `90+${ev.min - 90}` : ev.min}'`;
  const texto = ev.tipo === "gol" ? `${quem}${ev.penalti ? " (pênalti)" : ""}`
    : ev.tipo === "vermelho" ? `${quem} expulso`
    : `${quem} perde pênalti`;
  const lance = el("span", "lance-texto");
  lance.append(el("i", "icone"), el("span", null, texto));
  const vazio = el("span", "lance-vazio");
  li.append(ev.lado === "casa" ? lance : vazio, el("b", "lance-min", min), ev.lado === "casa" ? vazio : lance);
  return li;
}

function animarJogo(x) {
  const j = x.doUsuario;
  const ui = montarPlacar(x);
  const fim = Math.max(90, ...j.eventos.map((e) => e.min));
  const duracao = movimentoReduzido ? 0 : decisiva(x.etapa) ? 5200 : 3600;
  mostrarJogoSeEscondido();
  const placar = [0, 0];
  let mostrados = 0;
  const mostrarLance = (ev) => {
    if (ev.tipo === "gol") {
      placar[ev.lado === "casa" ? 0 : 1] += 1;
      ui.gc.textContent = String(placar[0]);
      ui.gf.textContent = String(placar[1]);
      const alvo = ev.lado === "casa" ? ui.gc : ui.gf;
      alvo.classList.remove("pulo"); void alvo.offsetWidth; alvo.classList.add("pulo");
    }
    ui.lances.append(linhaDeLance(ev, j));
  };
  return new Promise((pronto) => {
    D.animando = true;
    const t0 = performance.now();
    const passo = (agora) => {
      const p = D.pularAnimacao || !duracao ? 1 : Math.min(1, (agora - t0) / duracao);
      const minuto = Math.round(p * fim);
      ui.relogio.textContent = p < 1 ? `${Math.min(minuto, 90)}'${minuto > 90 ? "+" : ""}` : "Fim";
      while (mostrados < j.eventos.length && j.eventos[mostrados].min <= minuto) mostrarLance(j.eventos[mostrados++]);
      if (p < 1) { requestAnimationFrame(passo); return; }
      (async () => {
        if (j.penaltis) { ui.relogio.textContent = "Pênaltis"; await mostrarPenaltis(ui.penaltis, j, true); ui.relogio.textContent = "Fim"; }
        preencherRodape(ui.rodape, x);
        $("jogo").dataset.resultado = resultado(j);
        D.animando = false;
        D.pularAnimacao = false;
        pronto();
      })();
    };
    requestAnimationFrame(passo);
  });
}

function rodapeDoJogo(x) {
  const j = x.doUsuario, extras = [];
  // agregado vem do ponto de vista de quem decide em casa (mandante da volta)
  if (j.agregado) extras.push(`Agregado ${nomeDe(j.casa)} ${j.agregado[0]} × ${j.agregado[1]} ${nomeDe(j.fora)}`);
  if (j.penaltis) extras.push(`Pênaltis ${j.penaltis[0]} × ${j.penaltis[1]}`);
  if (j.classificado) extras.push(j.classificado === D.temp.usuario ? (x.etapa.final ? "CAMPEÃO!" : "Classificado!") : "Eliminado. Faz parte: bola pra frente.");
  return extras.join(" · ");
}

// --- penaltis cobranca a cobranca ------------------------------------------------

// quem bate: os melhores finalizadores do onze (goleiro so no fim da fila).
// Time sem onze (estrangeiro, convidado da Copa do Brasil) usa o elenco de
// dados/elencos-fora.json pelo peso de gol; sem elenco, "cobrador N".
// Quem foi expulso no jogo nao bate.
function cobradores(id, expulsos = new Set()) {
  const t = D.times ? D.times[id] : null;
  const fin = (j) => (j.eixos && (j.eixos.FIN ?? j.eixos.CHU)) ?? 0;
  let lista = [];
  if (t && t.onze) lista = t.onze.filter(Boolean).sort((a, b) => (a.posicao === "G") - (b.posicao === "G") || fin(b) - fin(a)).map((j) => j.nome);
  else if (t && t.artilheiros && t.artilheiros.length) {
    const goleiroPorUltimo = [...t.artilheiros].sort((a, b) => (a.pos === "G") - (b.pos === "G") || b.peso - a.peso);
    lista = goleiroPorUltimo.slice(0, 11).map((a) => a.nome);
  }
  lista = lista.filter((nome) => !expulsos.has(nome));
  return lista.length ? lista : Array.from({ length: 11 }, (_, i) => `cobrador ${i + 1}`);
}

function blocoPenaltis(j) {
  const bloco = el("div", "penaltis");
  bloco.append(el("p", "penaltis-titulo", "Disputa de pênaltis"));
  const linhas = {};
  for (const [lado, id] of [["a", j.casa], ["b", j.fora]]) {
    const linha = el("div", `pen-linha${id === D.temp.usuario ? " eu" : ""}`);
    const bolas = el("span", "pen-bolas");
    const placar = el("b", "pen-placar", "0");
    linha.append(el("span", "pen-time", nomeDe(id)), bolas, placar);
    const ladoNoJogo = lado === "a" ? "casa" : "fora";
    const expulsos = new Set(j.eventos.filter((e) => e.tipo === "vermelho" && e.lado === ladoNoJogo && e.autor).map((e) => e.autor));
    linhas[lado] = { bolas, placar, gols: 0, id, cobs: cobradores(id, expulsos), n: 0 };
    bloco.append(linha);
  }
  const narracao = el("p", "pen-narracao", "");
  bloco.append(narracao);
  return { bloco, linhas, narracao };
}

function baterPenalti(ui, c) {
  const l = ui.linhas[c.lado];
  const quem = l.cobs[l.n % l.cobs.length];
  l.n += 1;
  const bola = el("i", `pen-bola ${c.gol ? "gol" : "erro"}`);
  bola.title = `${quem}: ${c.gol ? "gol" : "perdeu"}`;
  l.bolas.append(bola);
  if (c.gol) { l.gols += 1; l.placar.textContent = String(l.gols); }
  const meu = l.id === D.temp.usuario;
  ui.narracao.className = `pen-narracao ${c.gol === meu ? "boa" : "ruim"}`;
  ui.narracao.textContent = c.gol ? `${quem} bate e converte.` : `${quem} bate... e perde!`;
}

// anima a disputa (ou mostra pronta); devolve quando acabar
async function mostrarPenaltis(alvo, j, animar) {
  const cobs = j.penaltis && j.penaltis.cobrancas;
  if (!cobs) return;
  const ui = blocoPenaltis(j);
  alvo.append(ui.bloco);
  if (animar) ui.bloco.scrollIntoView({ block: "nearest", behavior: movimentoReduzido ? "auto" : "smooth" });
  for (const c of cobs) {
    if (animar && !D.pularAnimacao && !movimentoReduzido) {
      ui.narracao.className = "pen-narracao";
      const l = ui.linhas[c.lado];
      ui.narracao.textContent = `${l.cobs[l.n % l.cobs.length]} ajeita a bola...`;
      await new Promise((ok) => setTimeout(ok, 650));
    }
    baterPenalti(ui, c);
    if (animar && !D.pularAnimacao && !movimentoReduzido) await new Promise((ok) => setTimeout(ok, 700));
  }
  const venc = j.penaltis[0] > j.penaltis[1] ? j.casa : j.fora;
  ui.narracao.className = `pen-narracao final ${venc === D.temp.usuario ? "boa" : "ruim"}`;
  ui.narracao.textContent = `${nomeDe(venc)} vence nos pênaltis, ${Math.max(...j.penaltis)} a ${Math.min(...j.penaltis)}.`;
}

// placar estatico (usado quando a simulacao corre sem animar)
function mostrarPlacarPronto(x) {
  const ui = montarPlacar(x);
  const j = x.doUsuario;
  ui.gc.textContent = String(j.gc);
  ui.gf.textContent = String(j.gf);
  ui.relogio.textContent = "Fim";
  for (const ev of j.eventos) ui.lances.append(linhaDeLance(ev, j));
  mostrarPenaltis(ui.penaltis, j, false);
  preencherRodape(ui.rodape, x);
  $("jogo").dataset.resultado = resultado(j);
}

// faixa do resultado: Vitoria / Empate / Derrota (+ agregado, penaltis, classificacao)
function preencherRodape(alvo, x) {
  const r = resultado(x.doUsuario);
  const extra = rodapeDoJogo(x);
  alvo.replaceChildren(el("span", `resultado-selo r-${r}`, { v: "Vitória", e: "Empate", d: "Derrota" }[r]));
  if (extra) alvo.append(el("span", "resultado-extra", extra));
}

function adicionarFeed(x) {
  const j = x.doUsuario;
  const { meus, deles, rival, casa } = lado(j);
  const li = el("li", `feed-item r-${resultado(j)} comp-${x.etapa.comp}`);
  const vermelhos = j.eventos.filter((e) => e.tipo === "vermelho" && e.lado === (casa ? "casa" : "fora")).length;
  li.append(
    el("span", "feed-data", dataJogo(x.etapa.data)),
    el("span", "feed-comp", COMP_CURTA[x.etapa.comp]),
    el("span", "feed-placar", `${meus} × ${deles}`),
    el("span", "feed-rival", `${casa ? "vs" : "em"} ${nomeDe(rival)}${j.penaltis ? " (pên.)" : ""}${vermelhos ? " · expulsão" : ""}`),
  );
  const postura = D.temp.ttc.posturas.get(x.etapa);
  const baixas = D.temp.ttc.ocorrencias.filter((o) => o.data === x.etapa.data && o.tipo === "lesão").map((o) => `${sobrenome(o.jogador.nome)} lesionado (${o.jogos})`);
  const extra = [postura && postura !== "equilibrado" ? POSTURAS[postura].nome : "", ...baixas].filter(Boolean);
  if (extra.length) li.append(el("span", "feed-extra", extra.join(" · ")));
  $("feed").prepend(li);
}

// todos os jogos da etapa em que o usuario jogou por ultimo
function mostrarRodada(x) {
  $("rodada-titulo").textContent = `${x.etapa.rotulo} · todos os jogos`;
  const lista = $("rodada-lista");
  lista.replaceChildren();
  const jogos = [...x.jogos].sort((a, b) => (b === x.doUsuario) - (a === x.doUsuario));
  for (const j of jogos) {
    const li = el("li", `rodada-jogo${j === x.doUsuario ? " eu" : ""}`);
    const casa = el("span", "rodada-casa"); casa.append(el("span", null, nomeDe(j.casa)), el("span", "rodada-camisa"));
    casa.lastChild.append(camisaDe(j.casa));
    const fora = el("span", "rodada-fora"); fora.append(el("span", "rodada-camisa"), el("span", null, nomeDe(j.fora)));
    fora.firstChild.append(camisaDe(j.fora));
    const extra = [];
    if (j.agregado) extra.push(`agr. ${j.agregado[0]}×${j.agregado[1]}`);
    if (j.penaltis) extra.push(`pên. ${j.penaltis[0]}×${j.penaltis[1]}`);
    if (j.eventos.some((e) => e.tipo === "vermelho")) extra.push("expulsão");
    li.append(casa, el("b", "rodada-placar", `${j.gc} × ${j.gf}`), fora, el("small", "rodada-extra", extra.join(" · ")));
    lista.append(li);
  }
}

// --- controles de simulacao ------------------------------------------------------

function travar(sim) {
  for (const b of ["ate-decisivo", "simular-tudo", "sim-ir"]) $(b).disabled = sim;
  document.getElementById("calendario").classList.toggle("travado", sim);
  $("proximo").textContent = sim ? "Pular animação" : "Próximo jogo";
}

// trava curta depois que um jogo acaba: o segundo toque de um toque duplo (ou o
// "Pular animação" que chega quando o jogo ja acabou) jogava o jogo seguinte sem
// a pessoa ver o resultado do anterior
const TRAVA_PROXIMO_MS = 250;
let travaProximoAte = 0;

// joga ate o proximo jogo do usuario e anima
async function proximoJogo() {
  if (D.simulando) return;
  if (D.animando) { D.pularAnimacao = true; return; }
  // cartao na tela e o jogador segue: janela fica pra tras, decisivo vai no
  // Equilibrado (ou na postura ja escolhida)
  seguirCartao();
  // janela aberta (uma vez) e jogo decisivo sem postura: pergunta antes
  if (janelaAberta() && !D.temp.ttc.janelaVista) { mostrarCartao(cartaoJanela()); return; }
  const prox = Motor.agenda(D.temp, 1)[0];
  if (prox && decisiva(prox.etapa) && !D.temp.ttc.posturas.has(prox.etapa)) {
    // joga antes o que nao e seu, pra o sorteio do mata-mata ja sair no cartao
    if (avancarAte(prox.indice)) { seguirCalendario(); atualizarPaineis(); }
    mostrarCartao(cartaoDecisivo(prox.etapa));
    return;
  }
  let x;
  while ((x = Motor.avancar(D.temp))) if (x.doUsuario) break;
  if (!x) { atualizarPaineis(); encerrar(); return; }
  travar(true);
  await animarJogo(x);
  adicionarFeed(x);
  mostrarRodada(x);
  seguirCalendario();
  atualizarPaineis();
  travar(false);
  travaProximoAte = performance.now() + TRAVA_PROXIMO_MS;
  if (Motor.terminou(D.temp)) $("proximo").textContent = "Ver o balanço";
}

// Enquanto simula: todos os botoes travados, o botao clicado vira "Simulando..."
// com a rodada que esta passando, e a conta roda em pedacos pra tela nao congelar.
const BOTOES_SIM = ["proximo", "ate-decisivo", "simular-tudo", "sim-ir"];
function carregando(ligado, botao) {
  D.simulando = ligado;
  for (const b of BOTOES_SIM) $(b).disabled = ligado;
  document.getElementById("calendario").classList.toggle("travado", ligado);
  document.body.classList.toggle("simulando", ligado);
  if (botao) {
    if (ligado) { botao.dataset.texto = botao.textContent; botao.classList.add("carregando"); botao.setAttribute("aria-busy", "true"); }
    else { botao.textContent = botao.dataset.texto || botao.textContent; botao.classList.remove("carregando"); botao.removeAttribute("aria-busy"); }
  }
}
const respirar = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));

// corre sem animar ate "parar" dizer que chegou; para ANTES de jogo decisivo
// do usuario, pra ele assistir esse com calma
async function simular(parar, { respeitarDecisivo = true, pararNaJanela = respeitarDecisivo, botao = null } = {}) {
  if (D.animando || D.simulando) return;
  let ultimo = null, motivo = null, andou = 0;
  seguirCartao();
  carregando(true, botao);
  if (botao) botao.textContent = "Simulando…";
  await respirar();
  try {
  while (!Motor.terminou(D.temp)) {
    const prox = Motor.agenda(D.temp, 1)[0];
    const e = D.temp.etapas[D.temp.i];
    if (parar(e)) { motivo = "fim"; break; }
    if (pararNaJanela && janelaAberta() && !D.temp.ttc.janelaVista) { motivo = "janela"; break; }
    if (respeitarDecisivo && prox && prox.indice === D.temp.i && decisiva(e) && !D.temp.ttc.posturas.has(e)) {
      motivo = e;
      break;
    }
    const x = Motor.avancar(D.temp);
    andou += 1;
    if (x.doUsuario) { adicionarFeed(x); ultimo = x; }
    // a cada 6 etapas devolve a tela pro navegador (e mostra onde esta)
    if (andou % 6 === 0) {
      if (botao) botao.textContent = `Simulando… ${dataJogo(x.etapa.data)}`;
      await respirar();
    }
  }
  } finally {
    carregando(false, botao);
  }
  if (ultimo) { mostrarPlacarPronto(ultimo); mostrarRodada(ultimo); }
  seguirCalendario();
  atualizarPaineis();
  if (motivo === "janela") mostrarCartao(cartaoJanela());
  else if (motivo && motivo !== "fim") mostrarCartao(cartaoDecisivo(motivo));
  if (Motor.terminou(D.temp)) encerrar();
}

// um cartao por vez embaixo do placar; D.cartao lembra qual esta aberto
function mostrarCartao(card, cartao = card.cartao) {
  fecharCartao();
  D.cartao = cartao || null;
  $("jogo").append(card);
  mostrarJogoSeEscondido();
}
function fecharCartao() {
  for (const c of $("jogo").querySelectorAll(".proximo-decisivo, .janela")) c.remove();
  D.cartao = null;
}
// o jogador apertou Proximo jogo / Ate o decisivo / Simular com um cartao
// aberto: decide pelo padrao em vez de travar (decisivo no Equilibrado,
// janela sem troca)
function seguirCartao() {
  const c = D.cartao;
  if (!c || !D.temp) { fecharCartao(); return; }
  if (c.tipo === "decisivo" && !D.temp.ttc.posturas.has(c.etapa)) D.temp.ttc.posturas.set(c.etapa, "equilibrado");
  if (c.tipo === "janela") D.temp.ttc.janelaUsada = true;
  fecharCartao();
}

// Cartao grande do proximo jogo decisivo: competicao, fase, data, o rival
// (quando ja se sabe), o que esta em jogo e a postura (cada botao ja joga).
function cartaoDecisivo(etapa) {
  const ctx = contextoDecisivo(D.temp, etapa);
  const card = el("div", `proximo-decisivo comp-${etapa.comp}`);
  const esq = el("div", "pd-textos");
  esq.append(el("span", "pd-tag", "Próximo jogo é decisivo"), el("strong", "pd-titulo", etapa.rotulo), el("span", "pd-data", dataJogo(etapa.data)),
    el("span", "pd-contexto", ctx.texto));
  const fora = [...D.temp.ttc.lesoes.keys(), ...D.temp.ttc.suspensos.keys()].filter((j) => todasVagas().some((s) => s.jogador === j));
  if (fora.length) esq.append(el("span", "pd-contexto", `Desfalques: ${fora.map((j) => sobrenome(j.nome)).join(", ")}`));
  const vs = el("div", "pd-vs");
  const eu = el("span", "pd-camisa"); eu.append(camisaDe(D.temp.usuario));
  vs.append(eu, el("b", null, "×"));
  const ele = el("span", "pd-camisa");
  if (ctx.rival) { ele.append(camisaDe(ctx.rival)); ele.title = nomeDe(ctx.rival); } else ele.append(el("span", "pd-rival-ind", "?"));
  vs.append(ele);
  const posturas = el("div", "pd-posturas");
  posturas.setAttribute("role", "group");
  posturas.setAttribute("aria-label", "Postura pro jogo");
  for (const [id, p] of Object.entries(POSTURAS)) {
    const b = el("button", `botao${id === "equilibrado" ? " botao-primario" : ""}`, p.nome);
    b.type = "button";
    b.title = p.dica;
    b.addEventListener("click", () => { D.temp.ttc.posturas.set(etapa, id); fecharCartao(); proximoJogo(); });
    posturas.append(b);
  }
  card.append(esq, vs, posturas, el("p", "pd-dica", "Pra cima: mais gol pros dois lados (rende em casa contra time menor). Fechadinho: menos (rende fora contra time maior). Os outros botões jogam no Equilibrado."));
  card.cartao = { tipo: "decisivo", etapa };
  return card;
}

// Janela de transferencias: escolhe quem sai, ve 5 cartas pra vaga dele e
// troca (ou segue sem mexer). Uma vez por temporada.
function cartaoJanela() {
  D.temp.ttc.janelaVista = true;
  const card = el("div", "janela");
  card.append(el("strong", "pd-titulo", "Janela de transferências aberta"),
    el("p", "pd-dica", "Pausa da Copa do Mundo: você pode trocar 1 jogador do elenco. Quem sai? Aparecem 5 cartas pra vaga dele."));
  const lista = el("div", "janela-lista");
  todasVagas().forEach((slot, k) => {
    if (!slot.jogador) return;
    const j = slot.jogador;
    const lesao = D.temp.ttc.lesoes.get(j);
    const b = el("button", "chip", `${VAGAS[slot.pos][1]} ${sobrenome(j.nome)} ${j.overall}${lesao ? ` · lesionado (${lesao})` : ""}`);
    b.type = "button";
    b.addEventListener("click", () => mostrarLequeDaJanela(card, k));
    lista.append(b);
  });
  const seguir = el("button", "botao", "Seguir sem trocar");
  seguir.type = "button";
  seguir.addEventListener("click", () => { D.temp.ttc.janelaUsada = true; fecharCartao(); atualizarPaineis(); });
  card.append(lista, seguir);
  card.cartao = { tipo: "janela" };
  return card;
}
function mostrarLequeDaJanela(card, k) {
  const slot = todasVagas()[k];
  const leque = el("div", "leque leque-janela");
  for (const j of lequeDaJanela(k)) {
    const b = el("button", "opcao");
    b.type = "button";
    const av = avaliacaoNaVaga(j, slot.pos === "RES" ? "RCOR" : slot.pos);
    b.append(cartaDoJogador(j, TIME_DE.get(j), D.r, { estatica: true }), el("span", "opcao-selos", av.rotuloEncaixe[1]),
      el("span", "opcao-clube", `${NOME_FUNCAO[FUNCAO.get(j)] || ""} · ${TIME_DE.get(j).nome}`));
    b.addEventListener("click", () => {
      const saiu = slot.jogador;
      if (aplicarJanela(k, j)) {
        card.replaceChildren(el("strong", "pd-titulo", "Negócio fechado!"), el("p", "pd-dica", `Sai ${saiu.nome}, chega ${j.nome} (${TIME_DE.get(j).nome}). Chegou chegando: já joga o próximo.`));
        atualizarPaineis();
      }
    });
    leque.append(b);
  }
  for (const v of card.querySelectorAll(".leque-janela")) v.remove();
  card.append(el("p", "pd-dica", `Pra vaga de ${sobrenome(slot.jogador.nome)} (${VAGAS[slot.pos][2]}):`), leque);
}

const simularAteDecisivo = () => simular(() => false, { botao: $("ate-decisivo") });

function simularAlvo() {
  const alvo = $("sim-alvo").value;
  // termina quando a competicao nao tem mais etapa pela frente
  simular(() => !D.temp.etapas.slice(D.temp.i).some((e) => e.comp === alvo), { botao: $("sim-ir") });
}

// --- paineis ---------------------------------------------------------------------

function grupoDoUsuario(comp) {
  return Object.values(D.temp[comp].grupos).find((g) => g.ids.includes(D.temp.usuario));
}

function situacao(comp) {
  const t = D.temp, eu = t.usuario;
  if (comp === "bra") {
    // antes da 1a rodada a tabela e so ordem alfabetica: sem posicao
    if (!t.bra.rodada) return "—";
    const tab = Motor.ordenar(t.bra.tabela);
    const pos = tab.findIndex((l) => l.id === eu) + 1;
    return `${pos}º · ${tab[pos - 1].pts} pts · ${t.bra.rodada}/38`;
  }
  if (t.campeoes[comp] === eu) return "Campeão!";
  if (t.eliminado[comp]) return `Caiu: ${t.eliminado[comp].replace(" (foi pra Sul-Americana)", "")}`;
  if (t.campeoes[comp]) return "Encerrada";
  const g = comp === "cdb" ? null : grupoDoUsuario(comp);
  if (g && !g.final) {
    const letra = Object.keys(t[comp].grupos).find((k) => t[comp].grupos[k] === g);
    // antes da 1a rodada a ordem e so alfabetica: sem posicao
    if (![...g.tabela.values()].some((l) => l.j)) return `Grupo ${letra}`;
    const pos = Motor.ordenarConmebol(g.tabela).findIndex((l) => l.id === eu) + 1;
    return `Grupo ${letra}: ${pos}º`;
  }
  const prox = Motor.agenda(t, 12).find((a) => a.etapa.comp === comp);
  if (prox) return prox.etapa.fase || "Na disputa";
  const ultimo = [...t.historico].reverse().find((h) => h.etapa.comp === comp && h.doUsuario);
  return ultimo ? "Na disputa" : "Ainda não estreou";
}

function compsDoUsuario() {
  const lista = ["bra", "cdb", D.continental];
  // 3o da Libertadores cai pra Sul-Americana
  if (D.continental === "lib" && D.temp.eliminado.lib && D.temp.eliminado.lib.includes("Sul-Americana")) lista.push("sul");
  return lista;
}

// --- calendario (estilo modo carreira) -------------------------------------------

const MESES_TEMPORADA = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

function seguirCalendario() {
  const e = D.temp.etapas[D.temp.i];
  if (e) D.mes = e.data.slice(0, 7);
  D.diaSel = null;
}

function mudarMes(delta) {
  const k = MESES_TEMPORADA.indexOf(D.mes) + delta;
  if (k < 0 || k >= MESES_TEMPORADA.length) return;
  D.mes = MESES_TEMPORADA[k];
  D.diaSel = null;
  desenharCalendario();
}

// tudo que acontece em cada data: jogos seus (feitos ou por vir) e dias das
// outras competicoes, pra pintar o calendario
function mapaDoCalendario() {
  const t = D.temp;
  const meus = new Map();
  for (const h of t.historico) if (h.doUsuario) meus.set(h.etapa.data, { feito: h });
  for (const a of Motor.agenda(t, 400)) if (!meus.has(a.etapa.data)) meus.set(a.etapa.data, { futuro: a });
  const outros = new Map();
  for (const e of t.etapas) {
    if (!outros.has(e.data)) outros.set(e.data, new Set());
    outros.get(e.data).add(e.comp);
  }
  return { meus, outros };
}

function desenharCalendario() {
  const [ano, mes] = D.mes.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const nDias = new Date(ano, mes, 0).getDate();
  $("cal-mes").textContent = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  $("cal-antes").disabled = D.mes === MESES_TEMPORADA[0];
  $("cal-depois").disabled = D.mes === MESES_TEMPORADA[MESES_TEMPORADA.length - 1];
  const { meus, outros } = mapaDoCalendario();
  const hoje = D.temp.etapas[D.temp.i] ? D.temp.etapas[D.temp.i].data : "9999";
  const grade = $("cal-grade");
  grade.replaceChildren();
  for (const d of ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]) grade.append(el("span", "cal-semana", d));
  for (let k = 0; k < primeiro.getDay(); k++) grade.append(el("span", "cal-vazio"));
  for (let dia = 1; dia <= nDias; dia++) {
    const iso = `${D.mes}-${String(dia).padStart(2, "0")}`;
    const info = meus.get(iso);
    const passou = iso < hoje;
    const cel = el("button", `cal-dia${passou ? " passou" : ""}${iso === hoje ? " hoje" : ""}${iso === D.diaSel ? " sel" : ""}`);
    cel.type = "button";
    cel.setAttribute("role", "gridcell");
    cel.append(el("span", "cal-num", String(dia)));
    if (info) {
      const etapa = info.feito ? info.feito.etapa : info.futuro.etapa;
      cel.classList.add("tem-jogo", `comp-${etapa.comp}`);
      if (decisiva(etapa)) cel.classList.add("decisivo");
      const jogo = info.feito ? info.feito.doUsuario : info.futuro.jogo;
      const mini = el("span", "cal-camisa");
      if (jogo) {
        const rival = jogo.casa === D.temp.usuario ? jogo.fora : jogo.casa;
        mini.append(camisaDe(rival));
        cel.append(mini, el("span", "cal-rival", `${jogo.casa === D.temp.usuario ? "" : "@"}${nomeDe(rival)}`));
      } else {
        mini.append(el("span", "cal-interroga", "?"));
        cel.append(mini, el("span", "cal-rival", "a definir"));
      }
      if (info.feito) {
        const { meus: m, deles } = lado(info.feito.doUsuario);
        cel.append(el("span", `cal-placar r-${resultado(info.feito.doUsuario)}`, `${m}×${deles}`));
      }
      cel.setAttribute("aria-label", `${dataJogo(iso)}: ${etapa.rotulo}`);
    } else if (outros.has(iso)) {
      const pontos = el("span", "cal-pontos");
      for (const c of outros.get(iso)) pontos.append(el("i", `comp-${c}`));
      cel.append(pontos);
    }
    cel.addEventListener("click", () => { D.diaSel = iso; desenharCalendario(); });
    grade.append(cel);
  }
  desenharAcao(meus, hoje);
}

function desenharAcao(meus, hoje) {
  const alvo = $("cal-acao");
  alvo.replaceChildren();
  if (!D.diaSel) {
    const ultimo = [...D.temp.historico].reverse().find((h) => h.doUsuario);
    const prox = Motor.agenda(D.temp, 1)[0];
    if (ultimo) {
      const l = lado(ultimo.doUsuario);
      alvo.append(el("span", `cal-resumo r-${resultado(ultimo.doUsuario)}`, `Último: ${l.meus}×${l.deles} ${l.casa ? "vs" : "em"} ${nomeDe(l.rival)} (${COMP_CURTA[ultimo.etapa.comp]}, ${dataJogo(ultimo.etapa.data)})`));
    }
    if (prox) {
      const contra = prox.jogo ? `${prox.jogo.casa === D.temp.usuario ? "vs" : "em"} ${nomeDe(prox.jogo.casa === D.temp.usuario ? prox.jogo.fora : prox.jogo.casa)}` : "adversário a definir";
      const ida = ehIda(prox.etapa) ? ` · ida: vale a postura do painel (${POSTURAS[D.temp.ttc.posturaPadrao || "equilibrado"].nome})` : "";
      alvo.append(el("span", "cal-resumo", `Próximo: ${contra} (${COMP_CURTA[prox.etapa.comp]}, ${dataJogo(prox.etapa.data)})${ida}`));
    }
    alvo.append(el("p", "nota", "Clica num dia pra ver o jogo ou simular até ele."));
    return;
  }
  const info = meus.get(D.diaSel);
  const titulo = el("strong", null, new Date(`${D.diaSel}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  alvo.append(titulo);
  if (info && info.feito) {
    const x = info.feito;
    const { meus: m, deles, rival, casa } = lado(x.doUsuario);
    alvo.append(el("span", null, `${x.etapa.rotulo}: ${D.nome} ${m} × ${deles} ${nomeDe(rival)}${casa ? "" : " (fora)"}`));
    const ver = el("button", "botao", "Ver o jogo");
    ver.type = "button";
    ver.addEventListener("click", () => {
      // rever um jogo antigo nao pode engolir o cartao aberto (postura do decisivo / janela): ele volta embaixo
      const pendente = D.cartao ? document.querySelector("#jogo .proximo-decisivo, #jogo .janela") : null;
      mudarVisao("jogo"); mostrarPlacarPronto(x); mostrarRodada(x);
      if (pendente) $("jogo").append(pendente);
      mostrarJogoSeEscondido();
    });
    alvo.append(ver);
    return;
  }
  if (D.diaSel < hoje) { alvo.append(el("span", "nota", "Esse dia já passou.")); return; }
  if (info) {
    const a = info.futuro;
    const contra = a.jogo ? `${a.jogo.casa === D.temp.usuario ? "vs" : "em"} ${nomeDe(a.jogo.casa === D.temp.usuario ? a.jogo.fora : a.jogo.casa)}` : "adversário a definir";
    alvo.append(el("span", null, `${a.etapa.rotulo} · ${contra}`));
  }
  const ir = el("button", "botao botao-primario", info ? "Simular até aqui e jogar" : "Simular até aqui");
  ir.type = "button";
  ir.addEventListener("click", () => simularAteDia(D.diaSel));
  alvo.append(ir);
}

// corre tudo antes do dia escolhido; se voce joga nesse dia, assiste o jogo
async function simularAteDia(iso) {
  if (D.animando || D.simulando) return;
  const tinhaJogo = Motor.agenda(D.temp, 400).find((a) => a.etapa.data === iso);
  // pelo calendario nao para em decisivo (o dia escolhido manda), mas a janela
  // de transferencias aparece se ficar no caminho
  await simular((e) => e.data >= iso, { respeitarDecisivo: false, pararNaJanela: true, botao: document.querySelector("#cal-acao .botao-primario") });
  if (D.cartao && D.cartao.tipo === "janela") { mudarVisao("jogo"); mostrarJogoSeEscondido(); return; }
  const e = D.temp.etapas[D.temp.i];
  if (e && e.data === iso && Motor.agenda(D.temp, 1).some((a) => a.indice === D.temp.i)) { mudarVisao("jogo"); proximoJogo(); return; }
  // o jogo do dia sumiu: o time caiu antes naquela copa
  if (tinhaJogo && !Motor.terminou(D.temp)) {
    const comp = tinhaJogo.etapa.comp;
    const quando = D.temp.eliminado[comp] ? `você caiu antes (${D.temp.eliminado[comp]})` : "a vaga não veio";
    $("jogo").append(el("p", "aviso-decisivo", `O jogo de ${dataJogo(iso)} pela ${COMP[comp]} não acontece: ${quando}.`));
  }
  mostrarJogoSeEscondido();
}

// Duas abas, uma temporada so: o que simula numa aparece na outra.
function mudarVisao(v) {
  D.visao = v;
  // celular: o menu de baixo acompanha (o calendario manda pro jogo a jogo)
  if (D.menu) {
    const atual = D.menu.atual();
    if (v === "cal" && atual !== "calendario") D.menu.abrir("calendario", { rolar: false });
    else if (v === "jogo" && atual === "calendario") D.menu.abrir("jogo", { rolar: false });
  }
  $("visao-jogo").hidden = v !== "jogo";
  $("visao-cal").hidden = v !== "cal";
  for (const b of document.querySelectorAll(".abas-temporada .chip")) {
    const ativo = b.dataset.visao === v;
    b.setAttribute("aria-selected", String(ativo));
    b.setAttribute("aria-pressed", String(ativo));
  }
  if (v === "cal") desenharCalendario();
}

// o placar fica sempre a vista: se a tela estiver rolada, sobe ate ele
function mostrarJogoSeEscondido() {
  const r = $("jogo").getBoundingClientRect();
  if (r.top < 64 || r.top > innerHeight * 0.6) $("jogo").scrollIntoView({ behavior: movimentoReduzido ? "auto" : "smooth", block: "start" });
}

// linha curta embaixo do placar: o proximo jogo e, se for ida de mata-mata,
// que vale a postura do painel (ela nao pergunta)
function dicaDoProximo() {
  const prox = Motor.agenda(D.temp, 1)[0];
  if (!prox || !ehIda(prox.etapa)) return null;
  const par = parDoUsuario(D.temp, prox.etapa);
  const rival = par ? (par.casa === D.temp.usuario ? par.fora : par.casa) : null;
  const postura = POSTURAS[D.temp.ttc.posturaPadrao || "equilibrado"].nome;
  return `Próximo: ${prox.etapa.rotulo}${rival ? ` contra ${nomeDe(rival)}` : ""} (${dataJogo(prox.etapa.data)}). Ida: vale a postura do painel (${postura}); a volta pergunta.`;
}
function mostrarDicaDoProximo() {
  const jogo = $("jogo");
  for (const d of jogo.querySelectorAll(".proximo-dica")) d.remove();
  const texto = D.temp && !Motor.terminou(D.temp) ? dicaDoProximo() : null;
  if (texto) jogo.append(el("p", "jogo-dica proximo-dica", texto));
}

function atualizarPaineis() {
  salvarTemporada();
  mostrarDicaDoProximo();
  const status = $("status");
  status.replaceChildren();
  for (const c of compsDoUsuario()) {
    const card = el("div", `status-item comp-${c}`);
    card.append(el("span", "status-comp", COMP[c]), el("strong", null, situacao(c)));
    status.append(card);
  }
  // departamento medico: quem esta fora e por quantos jogos
  const st = D.temp.ttc;
  const fora = [...[...st.lesoes].map(([j, n]) => `${sobrenome(j.nome)} (lesão, ${n})`), ...[...st.suspensos].map(([j]) => `${sobrenome(j.nome)} (suspenso)`)];
  const dm = el("div", "status-item status-dm");
  dm.append(el("span", "status-comp", "Desfalques"), el("strong", null, fora.length ? fora.join(" · ") : "Ninguém"));
  status.append(dm);
  desenharCalendario();
  const abas = $("abas");
  abas.replaceChildren();
  const grupos = compsDoUsuario().filter((c) => c === "lib" || c === "sul").filter((c) => grupoDoUsuario(c));
  const opcoes = [["bra", "Brasileirão"], ...grupos.map((c) => [c, `Grupo ${COMP_CURTA[c]}`]), ["gols", "Artilharia"]];
  for (const [id, rot] of opcoes) {
    const b = el("button", "chip", rot);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(D.aba === id));
    b.setAttribute("aria-pressed", String(D.aba === id));
    b.addEventListener("click", () => { D.aba = id; atualizarPaineis(); });
    abas.append(b);
  }
  const painel = $("painel-tabela");
  painel.replaceChildren();
  if (D.aba === "bra") painel.append(tabela(Motor.ordenar(D.temp.bra.tabela), D.regras.brasileirao.zonas));
  else if (D.aba === "gols") painel.append(artilharia());
  else {
    const g = grupoDoUsuario(D.aba);
    painel.append(tabela(Motor.ordenarConmebol(g.tabela), D.aba === "lib"
      ? [{ de: 1, ate: 2, cor: "#c8ff00", nome: "Oitavas" }, { de: 3, ate: 3, cor: "#5cc8ff", nome: "Sul-Americana" }]
      : [{ de: 1, ate: 1, cor: "#c8ff00", nome: "Oitavas" }, { de: 2, ate: 2, cor: "#5cc8ff", nome: "Playoffs" }]));
  }
}

function tabela(linhas, zonas) {
  const envolto = el("div", "tabela-rolagem");
  const t = el("table", "tabela");
  const cab = el("tr");
  for (const h of ["#", "Time", "P", "J", "V", "SG"]) cab.append(el("th", null, h));
  const thead = el("thead"); thead.append(cab);
  const tbody = el("tbody");
  linhas.forEach((l, k) => {
    const tr = el("tr", l.id === D.temp.usuario ? "eu" : "");
    const zona = (zonas || []).find((z) => k + 1 >= z.de && k + 1 <= z.ate);
    if (zona) { tr.style.setProperty("--zona", zona.cor); tr.title = zona.nome; }
    const nome = el("td", "tabela-time");
    const mini = el("span", "tabela-camisa"); mini.append(camisaDe(l.id));
    nome.append(mini, el("span", null, nomeDe(l.id)));
    tr.append(el("td", "tabela-pos", String(k + 1)), nome, el("td", "tabela-pts", String(l.pts)),
      el("td", null, String(l.j)), el("td", null, String(l.v)), el("td", null, String(l.gp - l.gc)));
    tbody.append(tr);
  });
  t.append(thead, tbody);
  envolto.append(t);
  return envolto;
}

function artilharia() {
  const lista = Motor.artilharia(D.temp, (a) => a.time === D.temp.usuario).slice(0, 10);
  if (!lista.length) return el("p", "nota", "Ninguém marcou ainda.");
  const ol = el("ol", "artilharia");
  for (const a of lista) {
    const li = el("li");
    li.append(el("span", null, a.nome), el("b", null, `${a.gols}`));
    ol.append(li);
  }
  return ol;
}

// --- fim: o balanco da temporada ---------------------------------------------------

function nomeDaFase(fase) {
  return { Final: "Vice", Semifinal: "Semifinal", Quartas: "Quartas de final", Oitavas: "Oitavas de final", Playoffs: "Playoffs", "5ª fase": "5ª fase" }[fase] || fase;
}

function encerrar() {
  evento("tem-time/fim");
  const t = D.temp, eu = t.usuario;
  for (const b of ["proximo", "ate-decisivo", "simular-tudo", "sim-ir"]) $(b).disabled = true;
  const tab = Motor.ordenar(t.bra.tabela);
  const pos = tab.findIndex((l) => l.id === eu) + 1;
  const linhaBra = tab[pos - 1];
  const zona = D.regras.brasileirao.zonas.find((z) => pos >= z.de && pos <= z.ate);
  const jogosDe = (c) => t.historico.filter((h) => h.doUsuario && (!c || h.etapa.comp === c));
  const conta = (lista) => {
    const js = lista.map((h) => h.doUsuario);
    const v = js.filter((j) => resultado(j) === "v").length, d = js.filter((j) => resultado(j) === "d").length;
    return { j: js.length, v, e: js.length - v - d, d, gp: js.reduce((s, j) => s + lado(j).meus, 0), gc: js.reduce((s, j) => s + lado(j).deles, 0) };
  };
  const titulos = compsDoUsuario().filter((c) => t.campeoes[c] === eu);
  const campanha = (c) => {
    if (c === "bra") return `${pos}º · ${linhaBra.pts} pts`;
    if (t.campeoes[c] === eu) return "Campeão";
    const el = t.eliminado[c];
    if (!el) return "—";
    if (el.includes("Sul-Americana")) return "Grupos (3º, foi pra Sul)";
    return nomeDaFase(el);
  };

  const alvo = $("balanco");
  alvo.replaceChildren();

  // topo: camisa, nome, manchete e trofeus
  const topo = el("header", "bl-topo");
  const camisa = el("span", "bl-camisa"); camisa.append(figuraUsuario());
  const textos = el("div", "bl-textos");
  const manchete = titulos.length ? `Campeão ${titulos.map((c) => (c === "bra" ? "brasileiro" : `da ${COMP[c]}`)).join(" e ")}!`
    : pos >= 17 ? "Rebaixado. Todo gigante já caiu um dia."
    : zona && zona.nome === "Libertadores" ? "Vaga na Libertadores. Prepara o passaporte."
    : zona && zona.nome === "Sul-Americana" ? "Vaga na Sul-Americana. Dá pra sonhar."
    : pos >= 14 ? `Escapou do Z4 no sufoco: ${pos}º no Brasileirão.`
    : `${pos}º no Brasileirão. Nem fede, nem cheira.`;
  apagarTemporadaSalva();
  D.log = null;
  // conta uma vez por temporada (o balanco pode ser redesenhado)
  const recorde = t.ttc.recorde || (t.ttc.recorde = registrarTemporada(titulos.length ? `Campeão ${titulos.map((c) => (c === "bra" ? "brasileiro" : `da ${COMP[c]}`)).join(" e ")}` : `${pos}º no Brasileirão`, titulos.length * 100 + (21 - pos)));
  textos.append(
    el("p", "bl-sobre", `${D.esquema} · no lugar ${doTime(D.sai)} · temporada 2026`),
    el("h3", "bl-nome", D.nome),
    el("p", `bl-manchete${titulos.length ? " ouro" : pos >= 17 ? " queda" : ""}`, manchete),
  );
  if (titulos.length) {
    const trofeus = el("div", "bl-trofeus");
    for (const c of titulos) trofeus.append(el("span", `bl-trofeu comp-${c}`, COMP[c]));
    textos.append(trofeus);
  }
  // o ponto alto da temporada (tem sempre um, ate no rebaixamento) e o recorde
  textos.append(el("p", "bl-resenha", pontoAlto(t, { titulos, pos, campanha }) + (pos >= 14 && !titulos.length ? " Bora de novo? Com outro leque o papo é outro." : "")));
  textos.append(el("p", `bl-recorde${recorde.novo && recorde.antes ? " novo" : ""}`, textoDoRecorde(recorde)));
  topo.append(camisa, textos);
  if (titulos.length && !movimentoReduzido) topo.append(confete());

  // campanha por competicao
  const secCampanha = el("section", "bl-bloco bl-campanha");
  secCampanha.append(el("h4", null, "Campanha"));
  const tabela = el("table", "tabela");
  const cab = el("tr");
  for (const h of ["", "Resultado", "J", "V", "E", "D", "Gols"]) cab.append(el("th", null, h));
  const thead = el("thead"); thead.append(cab);
  const tbody = el("tbody");
  for (const c of compsDoUsuario()) {
    const n = conta(jogosDe(c));
    const tr = el("tr", `comp-${c}`);
    const nome = el("td", "bl-comp"); nome.append(el("i"), el("span", null, COMP[c]));
    const res = el("td", `bl-res${t.campeoes[c] === eu ? " ouro" : ""}`, campanha(c));
    if (c === "bra" && zona) res.append(el("small", null, zona.nome));
    tr.append(nome, res, el("td", null, String(n.j)), el("td", null, String(n.v)), el("td", null, String(n.e)), el("td", null, String(n.d)), el("td", null, `${n.gp}–${n.gc}`));
    tbody.append(tr);
  }
  tabela.append(thead, tbody);
  const rolagem = el("div", "tabela-rolagem"); rolagem.append(tabela);
  secCampanha.append(rolagem);

  // numeros gerais
  const tudo = conta(jogosDe());
  const aproveitamento = tudo.j ? Math.round((100 * (3 * tudo.v + tudo.e)) / (3 * tudo.j)) : 0;
  const expulsoes = jogosDe().reduce((s, h) => s + h.doUsuario.eventos.filter((ev) => ev.tipo === "vermelho" && ev.lado === (h.doUsuario.casa === eu ? "casa" : "fora")).length, 0);
  const secNumeros = el("section", "bl-bloco");
  secNumeros.append(el("h4", null, "Números"));
  const tiles = el("dl", "bl-tiles");
  for (const [rot, val] of [["Jogos", tudo.j], ["Aproveitamento", `${aproveitamento}%`], ["V-E-D", `${tudo.v}-${tudo.e}-${tudo.d}`], ["Gols", `${tudo.gp}–${tudo.gc}`], ["Saldo", `${tudo.gp - tudo.gc > 0 ? "+" : ""}${tudo.gp - tudo.gc}`], ["Expulsões", expulsoes]]) {
    const d = el("div"); d.append(el("dd", null, String(val)), el("dt", null, rot)); tiles.append(d);
  }
  secNumeros.append(tiles);

  // destaques: artilheiro, maior vitoria, pior derrota, maior invencibilidade
  const secDest = el("section", "bl-bloco");
  secDest.append(el("h4", null, "Destaques"));
  const lista = el("dl", "bl-destaques");
  const add = (rot, val) => { if (!val) return; const d = el("div"); d.append(el("dt", null, rot), el("dd", null, val)); lista.append(d); };
  const art = Motor.artilharia(t, (a) => a.time === eu)[0];
  add("Artilheiro", art ? `${art.nome} · ${art.gols} gols` : null);
  const saldo = (h) => lado(h.doUsuario).meus - lado(h.doUsuario).deles;
  const ordenados = [...jogosDe()].sort((a, b) => saldo(b) - saldo(a) || lado(b.doUsuario).meus - lado(a.doUsuario).meus);
  const descr = (h) => { const l = lado(h.doUsuario); return `${l.meus}×${l.deles} ${l.casa ? "vs" : "em"} ${nomeDe(l.rival)} · ${COMP_CURTA[h.etapa.comp]}`; };
  if (ordenados.length && saldo(ordenados[0]) > 0) add("Maior vitória", descr(ordenados[0]));
  const pior = ordenados[ordenados.length - 1];
  if (pior && saldo(pior) < 0) add("Pior derrota", descr(pior));
  let seq = 0, melhor = 0;
  for (const h of jogosDe()) { seq = resultado(h.doUsuario) === "d" ? 0 : seq + 1; melhor = Math.max(melhor, seq); }
  add("Maior invencibilidade", `${melhor} jogos`);
  secDest.append(lista);

  // seu onze e os campeoes
  const secOnze = el("section", "bl-bloco bl-onze");
  secOnze.append(el("h4", null, "Seu onze"));
  const campo = el("div", "gramado gramado-mini");
  desenharGramado(campo);
  secOnze.append(campo);
  const secCamp = el("section", "bl-bloco");
  secCamp.append(el("h4", null, "Campeões de 2026"));
  const ul = el("ul", "bl-campeoes");
  for (const c of ["bra", "cdb", "lib", "sul"]) {
    const id = t.campeoes[c];
    if (!id) continue;
    const li = el("li", `comp-${c}${id === eu ? " eu" : ""}`);
    const mini = el("span", "tabela-camisa"); mini.append(camisaDe(id));
    li.append(el("span", "bl-comp-nome", COMP[c]), mini, el("strong", null, nomeDe(id)));
    ul.append(li);
  }
  secCamp.append(ul);

  const esquerda = el("div", "bl-col"); esquerda.append(secCampanha, secNumeros, secDest);
  const direita = el("div", "bl-col"); direita.append(secOnze, secCamp);
  const corpo = el("div", "bl-corpo"); corpo.append(esquerda, direita);

  // rodape: copiar texto pronto
  const texto = [
    D.desafio ? linhaDoDesafio(pos, titulos) : "",
    `${D.nome} (${D.esquema}) no Tem Time em Casa`,
    D.desafio ? `Desafio do dia ${D.desafio.data.split("-").reverse().join("/")} · semente ${D.desafio.semente}` : `Dificuldade: ${DIFICULDADES[D.dificuldade].nome}`,
    manchete,
    ...compsDoUsuario().map((c) => `${COMP[c]}: ${campanha(c)}`),
    `${tudo.v}V ${tudo.e}E ${tudo.d}D · ${tudo.gp} gols · ${aproveitamento}%`,
    art ? `Artilheiro: ${art.nome} (${art.gols})` : "",
    "temdadoemcasa.github.io/tem-time-em-casa.html",
  ].filter(Boolean).join("\n");
  const rodape = el("footer", "bl-rodape");
  const copiar = el("button", "botao", "Copiar resultado");
  copiar.type = "button";
  copiar.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); copiar.textContent = "Copiado"; }
    catch (_) { copiar.textContent = "Não deu pra copiar"; }
  });
  const novo = el("button", "botao botao-primario", "Jogar de novo");
  novo.type = "button";
  novo.addEventListener("click", () => $("de-novo").click());
  rodape.append(copiar);
  // mesma escalacao do draft, temporada nova (no desafio a temporada e a mesma pra todo mundo)
  if (!D.desafio && D.elenco0) {
    const rejogar = el("button", "botao", "Mesmo time, nova temporada");
    rejogar.type = "button";
    rejogar.id = "rejogar";
    rejogar.addEventListener("click", () => {
      const f = D.elenco0, porId = new Map(D.r.indice.comNota.map((j) => [j.player_id, j]));
      D.esquema = f.esquema;
      D.onze = f.onze.map(([pos, x, y, id]) => ({ pos, x, y, jogador: porId.get(id) || null }));
      D.banco = f.banco.map(([pos, id]) => ({ pos, jogador: porId.get(id) || null }));
      comecarTemporada();
    });
    rodape.append(rejogar);
  }
  rodape.append(novo);
  alvo.append(topo, corpo, rodape);
  mostrar("fim");
}

// o ponto alto da temporada: titulo, campanha funda numa copa, artilheiro que
// bateu ponto, sequencia invicta, goleada; e sempre tem algo bom pra contar
function pontoAlto(t, { titulos, campanha }) {
  const eu = t.usuario;
  if (titulos.length) return "Volta olímpica! Pode printar e mandar no grupo.";
  const fundo = compsDoUsuario().filter((c) => c !== "bra").map((c) => [c, t.eliminado[c] || ""])
    .find(([, fase]) => /^(Final|Semifinal)$/.test(fase));
  if (fundo) return `${fundo[1] === "Final" ? "Vice" : "Semifinal"} da ${COMP[fundo[0]]}: campanha de respeito.`;
  const art = Motor.artilharia(t, (a) => a.time === eu)[0];
  if (art && art.gols >= 15) return `${art.nome} fez ${art.gols} gols: esse bateu ponto.`;
  const jogos = t.historico.filter((h) => h.doUsuario);
  let seq = 0, melhor = 0;
  for (const h of jogos) { seq = resultado(h.doUsuario) === "d" ? 0 : seq + 1; melhor = Math.max(melhor, seq); }
  if (melhor >= 6) return `${melhor} jogos sem perder no melhor momento.`;
  const goleada = jogos.map((h) => lado(h.doUsuario)).filter((l) => l.meus - l.deles >= 3).sort((a, b) => (b.meus - b.deles) - (a.meus - a.deles))[0];
  if (goleada) return `Teve até ${goleada.meus}×${goleada.deles} no ${nomeDe(goleada.rival)} pra contar no grupo.`;
  if (art) return `${art.nome} foi o artilheiro, com ${art.gols} ${art.gols === 1 ? "gol" : "gols"}.`;
  void campanha;
  return "Temporada jogada até o último apito.";
}

// recorde pessoal neste aparelho: temporadas jogadas e a melhor campanha
// (titulos valem mais que posicao). Sem nada salvo, nao mostra numero nenhum.
const CHAVE_RECORDES = "tem-time-recordes";
function lerRecordes() {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RECORDES) || "null");
    if (r && r.v === 1 && Number.isInteger(r.temporadas) && r.temporadas > 0 && r.melhor
      && typeof r.melhor.texto === "string" && r.melhor.texto && Number.isFinite(r.melhor.pontos) && typeof r.melhor.nome === "string") return r;
  } catch { /* corrompido: como se nao tivesse */ }
  return null;
}
function registrarTemporada(texto, pontos) {
  const antes = lerRecordes();
  const novo = !antes || pontos > antes.melhor.pontos;
  const r = { v: 1, temporadas: (antes ? antes.temporadas : 0) + 1, melhor: novo ? { texto, pontos, nome: D.nome } : antes.melhor };
  try { localStorage.setItem(CHAVE_RECORDES, JSON.stringify(r)); } catch { /* sem storage: so nao lembra */ }
  return { antes, novo, r };
}
function textoDoRecorde({ antes, novo, r }) {
  if (!antes) return "Primeira temporada por aqui: já virou seu recorde.";
  if (novo) return `Novo recorde pessoal! O melhor antes era: ${antes.melhor.texto}.`;
  return `Seu recorde segue: ${r.melhor.texto}, com o ${r.melhor.nome}. Temporada nº ${r.temporadas} por aqui.`;
}
function mostrarRecordeNoClube() {
  const r = lerRecordes();
  let p = $("recorde-nota");
  if (!r) { if (p) p.remove(); return; }
  if (!p) { p = el("p", "nota recorde-nota"); p.id = "recorde-nota"; $("comecar-draft").before(p); }
  p.textContent = `Seu melhor até aqui: ${r.melhor.texto}, com o ${r.melhor.nome} (${r.temporadas} ${r.temporadas === 1 ? "temporada jogada" : "temporadas jogadas"}).`;
}

// chuva curta de papel picado no titulo (uma vez; sem movimento reduzido nem aparece)
function confete() {
  const caixa = el("div", "bl-confete");
  caixa.setAttribute("aria-hidden", "true");
  const cores = ["var(--canal)", "#ffffff", "#5cc8ff", "#f2cc60", "#ff7d95"];
  for (let k = 0; k < 28; k++) {
    const p = el("i");
    p.style.left = `${(k * 37) % 100}%`;
    p.style.background = cores[k % cores.length];
    p.style.animationDelay = `${(k % 7) * 70}ms`;
    p.style.setProperty("--giro", `${(k % 2 ? 1 : -1) * (180 + (k * 53) % 360)}deg`);
    caixa.append(p);
  }
  setTimeout(() => caixa.remove(), 2600);
  return caixa;
}

// uma linha pra comparar o desafio: "Desafio 27/09: 6º no BR, campeão da Copa do Brasil — e você?"
function linhaDoDesafio(pos, titulos) {
  const dia = D.desafio.data.split("-").slice(1).reverse().join("/");
  const conquistas = titulos.filter((c) => c !== "bra").map((c) => `campeão da ${COMP[c]}`);
  const br = titulos.includes("bra") ? "campeão brasileiro" : `${pos}º no BR`;
  return `Desafio ${dia}: ${[br, ...conquistas].join(", ")} — e você?`;
}

// --- liga tudo -----------------------------------------------------------------------

// dificuldade (chips) e desafio do dia (mesmos leques pra todo mundo no dia)
// redesenha os chips a partir do D (a temporada retomada pode ter trazido um desafio)
let redesenharDificuldade = () => {};
function ligarDificuldadeEDesafio() {
  const caixa = $("dificuldade");
  const nota = $("dificuldade-nota");
  const desenhar = () => {
    if (!caixa) return;
    caixa.replaceChildren();
    for (const [id, d] of Object.entries(DIFICULDADES)) {
      const b = el("button", "chip", d.nome);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(D.dificuldade === id));
      b.setAttribute("aria-pressed", String(D.dificuldade === id));
      b.disabled = Boolean(D.desafio) && id !== "normal";
      b.addEventListener("click", () => { D.dificuldade = id; desenhar(); });
      caixa.append(b);
    }
    const d = DIFICULDADES[D.dificuldade];
    if (nota) nota.textContent = `${d.nome}: ${d.resumo}.`;
    const des = $("desafio-dia");
    if (des) {
      des.setAttribute("aria-pressed", String(Boolean(D.desafio)));
      des.textContent = D.desafio ? `Desafio do dia ${D.desafio.data.split("-").reverse().join("/")}: ligado` : "Desafio do dia";
    }
    const dn = $("desafio-nota");
    if (dn) dn.textContent = D.desafio ? "Mesmos leques, mesmo sorteio e mesma temporada pra todo mundo hoje (dificuldade Normal). O resultado sai com a data pra comparar." : "";
    $("draft-chances").textContent = textoChances();
  };
  const des = $("desafio-dia");
  if (des) {
    des.addEventListener("click", () => {
      if (D.desafio) D.desafio = null;
      else {
        const hoje = new Date();
        const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
        D.desafio = { data, semente: `ttc-${data}` };
        D.dificuldade = "normal";
      }
      desenhar();
    });
  }
  redesenharDificuldade = desenhar;
  desenhar();
}

async function iniciarDraft() {
  // recarregar no meio da temporada nao volta rolado pro meio da tela do clube:
  // o "Continuar a temporada" fica no topo, a vista
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch { /* navegador antigo */ }
  const [uniformes, r, regras, elencos] = await Promise.all([json("dados/uniformes.json").catch(() => ({})),
    retrato("2026"), json("dados/competicoes-2026.json"), json("dados/elencos-fora.json").catch(() => ({}))]);
  UNIFORMES = uniformes;
  Motor.ELENCOS = elencos.times || {};
  D.r = r;
  D.regras = regras;
  estado.r = r;
  usarCortes(r);
  $("draft-chances").textContent = textoChances();
  inferirFuncoes(r);
  ligarDificuldadeEDesafio();
  montarCriacao();
  definirQuemSai();
  const efeito = () => { $("esquema-efeito").textContent = descreverTatica($("esquema").value); };
  $("esquema").addEventListener("change", efeito);
  efeito();

  $("nome-time").addEventListener("input", () => { D.nome = $("nome-time").value.trim() || "Tem Dado FC"; });
  $("cor1").addEventListener("input", () => { D.cor1 = $("cor1").value; atualizarPreview(); });
  $("cor2").addEventListener("input", () => { D.cor2 = $("cor2").value; atualizarPreview(); });
  for (const b of $("continental").children) {
    b.addEventListener("click", () => {
      D.continental = b.dataset.valor;
      for (const o of $("continental").children) {
        o.setAttribute("aria-pressed", String(o === b));
        o.setAttribute("aria-checked", String(o === b));
      }
    });
  }
  $("comecar-draft").addEventListener("click", () => {
    D.nome = $("nome-time").value.trim() || "Tem Dado FC";
    D.esquema = $("esquema").value;
    D.onze = ESQUEMAS[D.esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: null }));
    D.banco = BANCO_VAGAS.map((pos) => ({ pos, jogador: null }));
    D.vaga = 0;
    D.trocas = DIFICULDADES[D.dificuldade].trocas;
    D.trocasUsadas = 0;
    D.leques = {};
    D.movendo = null;
    D.log = null; // a temporada salva (se tiver) so e trocada quando a nova comecar
    mostrar("draft");
    abrirLeque();
  });
  $("trocar-leque").addEventListener("click", () => {
    if (D.trocas > 0) { D.trocas -= 1; D.trocasUsadas = (D.trocasUsadas || 0) + 1; delete D.leques[D.vaga]; abrirLeque(); }
  });
  $("comecar-temporada").addEventListener("click", comecarTemporada);
  $("proximo").addEventListener("click", () => {
    // toque que chega logo depois do fim do jogo e o segundo de um toque duplo: ignora
    if (!D.animando && performance.now() < travaProximoAte) return;
    if (Motor.terminou(D.temp) && !D.animando) encerrar();
    else proximoJogo();
  });
  $("ate-decisivo").addEventListener("click", simularAteDecisivo);
  $("simular-tudo").addEventListener("click", () => simular(() => false, { respeitarDecisivo: false, botao: $("simular-tudo") }));
  for (const b of document.querySelectorAll(".abas-temporada .chip")) b.addEventListener("click", () => mudarVisao(b.dataset.visao));
  $("cal-antes").addEventListener("click", () => mudarMes(-1));
  $("cal-depois").addEventListener("click", () => mudarMes(1));
  $("sim-ir").addEventListener("click", simularAlvo);
  $("de-novo").addEventListener("click", () => {
    definirQuemSai();
    redesenharDificuldade();
    mostrar("clube");
    mostrarRecordeNoClube();
    mostrarRetomar();
  });
  mostrarRecordeNoClube();
  mostrarRetomar();
}

iniciarDraft().catch((erro) => {
  console.error(erro);
  $("tela-clube").append(el("div", "vazio", "O jogo não carregou agora. Tenta de novo daqui a pouco."));
});
