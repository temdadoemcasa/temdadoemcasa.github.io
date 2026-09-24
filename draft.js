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
};
// vaga -> [funcao do jogador, sigla no campo, nome por extenso]
const VAGAS = {
  GOL: ["GOL", "GOL", "goleiro"], LD: ["LAT", "LD", "lateral-direito"], LE: ["LAT", "LE", "lateral-esquerdo"],
  ALD: ["LAT", "ALD", "ala direito"], ALE: ["LAT", "ALE", "ala esquerdo"], ZAG: ["ZAG", "ZAG", "zagueiro"],
  VOL: ["VOL", "VOL", "volante"], MC: ["MC", "MC", "meio-campista"], MEI: ["MEI", "MEI", "meia"],
  PD: ["PON", "PD", "ponta-direita"], PE: ["PON", "PE", "ponta-esquerda"],
  MD: ["PON", "MD", "meia pela direita"], ME: ["PON", "ME", "meia pela esquerda"], CA: ["CA", "CA", "centroavante"],
};
function descreverTatica(esquema) {
  const t = Motor.TATICA[esquema];
  if (!t) return "";
  const sinal = (v) => (v > 0 ? `+${String(v).replace(".", ",")}` : v < 0 ? `−${String(-v).replace(".", ",")}` : "0");
  return `Ataque ${sinal(t.atq)} · Defesa ${sinal(t.def)} · ${t.resumo}`;
}

const PADROES = [["vertical", "Listras"], ["horizontal", "Faixas"], ["lisa", "Lisa"], ["diagonal", "Diagonal"], ["faixa-peito", "Faixa no peito"]];
const COMP = { bra: "Brasileirão", cdb: "Copa do Brasil", lib: "Libertadores", sul: "Sul-Americana" };
const COMP_CURTA = { bra: "BR", cdb: "CdB", lib: "LIB", sul: "SUL" };
const CHAVE_REGRA = { lib: "libertadores", sul: "sulamericana" };

const D = {
  r: null, regras: null, regrasTemp: null,
  nome: "Tem Dado FC", padrao: "vertical", cor1: "#c8ff00", cor2: "#111111", esquema: "4-3-3",
  sai: null, continental: "lib", grupo: null,
  onze: [], vaga: 0, trocas: 1, temp: null, times: null, animando: false, pularAnimacao: false, aba: "bra",
};

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

function montarClubes() {
  const forcas = Motor.timesDaSerieA(D.r);
  const alvo = $("clubes");
  alvo.replaceChildren();
  const lista = [...D.r.times].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  for (const time of lista) {
    const b = el("button", "clube");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(D.sai === time.nome));
    const f = forcas[time.nome];
    const camisa = el("span", "clube-camisa");
    camisa.append(figura(time, null, { cabeca: false }));
    b.append(camisa, el("span", "clube-nome", time.nome), el("span", "clube-extra", `força ${Math.round((f.atq + f.def) / 2)}`));
    b.addEventListener("click", () => {
      for (const o of alvo.children) o.setAttribute("aria-checked", String(o === b));
      D.sai = time.nome;
      $("comecar-draft").disabled = false;
      $("comecar-draft").textContent = `Tirar o ${time.nome} e montar seu time`;
    });
    alvo.append(b);
  }
}

// --- draft -------------------------------------------------------------------------

const LADO_DA_VAGA = { LD: "D", ALD: "D", LE: "E", ALE: "E" };

// chances do leque: mais generosas que as do envelope (CHANCES, app.js). Com as
// do envelope, escolher ao acaso caia em 42% das temporadas; com estas (~350
// temporadas simuladas em 25/09), ao acaso fica no meio (mediana 10o-11o, Z4 13-18%) e
// pegar sempre a maior nota vai ao G4 em 64%.
const CHANCES_DO_LEQUE = { palha: 0.2, madeira: 0.45, tijolo: 0.28, grafeno: 0.07 };

function sortearLeque(vaga) {
  const funcao = VAGAS[vaga][0];
  const usados = new Set(D.onze.map((s) => s.jogador).filter(Boolean));
  // quem tem a vaga como posicao principal, e quem tem como secundaria com
  // metade da chance de entrar no sorteio (o Piquerez lateral e ala)
  let pool = D.r.indice.comNota.filter((j) => !usados.has(j)
    && (FUNCAO.get(j) === funcao || (FUNCOES_EXTRAS.get(j)?.has(funcao) && Math.random() < 0.5)));
  // funcao com pouca gente: completa com a familia da posicao
  if (pool.length < 12) pool = D.r.indice.comNota.filter((j) => FAMILIA[funcao].includes(j.posicao) && !usados.has(j));
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
  for (let tentativa = 0; opcoes.length < 5 && tentativa < 200; tentativa++) {
    const niveis = Object.keys(CHANCES_DO_LEQUE).filter((id) => porNivel[id] && porNivel[id].some((j) => !opcoes.includes(j)));
    if (!niveis.length) break;
    let x = Math.random() * niveis.reduce((s, id) => s + CHANCES_DO_LEQUE[id], 0);
    let escolhido = niveis[niveis.length - 1];
    for (const id of niveis) { x -= CHANCES_DO_LEQUE[id]; if (x <= 0) { escolhido = id; break; } }
    const livres = porNivel[escolhido].filter((j) => !opcoes.includes(j));
    opcoes.push(livres[Math.floor(Math.random() * livres.length)]);
  }
  return opcoes;
}

function desenharGramado(alvo, { ativa = -1, mover = false } = {}) {
  alvo.replaceChildren();
  D.onze.forEach((slot, k) => {
    const v = el("div", `vaga${k === ativa ? " vaga-ativa" : ""}${slot.jogador ? " vaga-cheia" : ""}`);
    v.style.left = `${slot.x}%`;
    v.style.top = `${slot.y}%`;
    if (slot.jogador) {
      const j = slot.jogador;
      const camisa = el("span", "vaga-camisa");
      camisa.append(figuraUsuario(j.camisa));
      v.append(camisa, el("span", `vaga-nota nivel-${nivel(j.overall).id}`, String(j.overall)), el("span", "vaga-nome", sobrenome(j.nome)));
      v.title = `${j.nome} · veio do ${TIME_DE.get(j).nome}`;
      const destinos = mover ? destinosDe(k) : [];
      if (destinos.length) {
        const b = el("button", "vaga-mover", "⇄");
        b.type = "button";
        const para = VAGAS[D.onze[destinos.find((d) => d > k) ?? destinos[0]].pos][1];
        b.title = `Mudar ${sobrenome(j.nome)} para ${para} e sortear a vaga dele`;
        b.setAttribute("aria-label", b.title);
        b.addEventListener("click", () => moverDeVaga(k));
        v.append(b);
      }
    } else {
      v.append(el("span", "vaga-vazia", VAGAS[slot.pos][1]));
    }
    alvo.append(v);
  });
}

function abrirLeque() {
  const slot = D.onze[D.vaga];
  $("vaga-nome").textContent = VAGAS[slot.pos][2];
  $("vaga-progresso").textContent = `Escolha ${D.onze.filter((s) => s.jogador).length + 1} de 11 · ${D.esquema}`;
  $("trocar-leque").disabled = D.trocas <= 0;
  $("trocar-leque").textContent = D.trocas > 0 ? "Trocar o leque (1 vez)" : "Já trocou o leque";
  desenharGramado($("gramado"), { ativa: D.vaga, mover: true });
  const leque = $("leque");
  leque.replaceChildren();
  // o leque de cada vaga fica guardado ate ela ser preenchida: mover alguem
  // de vaga (⇄) nao pode virar sorteio infinito -- so "Trocar o leque" refaz
  const na = D.onze.map((s) => s.jogador).filter(Boolean);
  if (!D.leques[D.vaga]) D.leques[D.vaga] = sortearLeque(slot.pos);
  D.leques[D.vaga] = D.leques[D.vaga].filter((j) => !na.includes(j));
  if (!D.leques[D.vaga].length) D.leques[D.vaga] = sortearLeque(slot.pos);
  D.leques[D.vaga].forEach((j, i) => {
    const b = el("button", "opcao");
    b.type = "button";
    b.setAttribute("aria-label", `${j.nome}, ${TIME_DE.get(j).nome}, overall ${j.overall}`);
    const carta = cartaDoJogador(j, TIME_DE.get(j), D.r, { estatica: true });
    carta.classList.add("revelando");
    carta.style.animationDelay = movimentoReduzido ? "0s" : `${i * 90}ms`;
    b.append(carta, el("span", "opcao-clube", `${funcoesDe(j).map((f) => NOME_FUNCAO[f]).join(" / ")} · ${TIME_DE.get(j).nome}`));
    b.addEventListener("click", () => escolher(j));
    leque.append(b);
  });
}

// a proxima vaga vazia (mover alguem de vaga pode esvaziar uma de tras)
const proximaVaga = () => D.onze.findIndex((s) => !s.jogador);

function escolher(jogador) {
  D.onze[D.vaga].jogador = jogador;
  delete D.leques[D.vaga];
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

// vagas vazias pra onde o jogador da vaga k pode ir
const destinosDe = (k) => D.onze.map((s, i) => i).filter((i) => i !== k && !D.onze[i].jogador && cabeNaVaga(D.onze[k].jogador, D.onze[i].pos));

// muda o jogador de vaga: a de origem volta pro sorteio (Ronaldo de CA pra PE
// pra puxar outro centroavante)
function moverDeVaga(k) {
  const destinos = destinosDe(k);
  if (!destinos.length) return;
  const i = destinos.find((d) => d > k) ?? destinos[0];
  D.onze[i].jogador = D.onze[k].jogador;
  D.onze[k].jogador = null;
  delete D.leques[i];
  D.vaga = proximaVaga();
  abrirLeque();
}

// --- resumo ------------------------------------------------------------------------

function idUsuario() {
  // nome igual a um clube que existe? ganha um sufixo pra nao misturar
  const existe = (n) => D.r.times.some((t) => t.nome === n) || (D.regras.estrangeiros[n]);
  let id = D.nome;
  while (existe(id)) id += " FC";
  return id;
}

function timeDoUsuario() {
  const onze = D.onze.map((s) => s.jogador);
  return {
    id: idUsuario(), nome: D.nome, usuario: true, serieA: true, onze, kit: kitUsuario(),
    formacao: D.esquema, ...Motor.aplicarTatica(Motor.naRegua(Motor.forcaDoOnze(onze)), D.esquema),
  };
}

function serieAComUsuario() {
  const serieA = Motor.timesDaSerieA(D.r);
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

  const alvo = $("resumo");
  alvo.replaceChildren();
  const campo = el("div", "gramado gramado-resumo");
  desenharGramado(campo);
  const info = el("div", "resumo-info");
  info.append(el("p", "resumo-nome", D.nome));
  const numeros = el("dl", "resumo-numeros");
  for (const [rot, val] of [["Média do onze", media], ["Ataque", Math.round(eu.atq)], ["Defesa", Math.round(eu.def)]]) {
    const d = el("div");
    d.append(el("dd", null, String(val)), el("dt", null, rot));
    numeros.append(d);
  }
  info.append(numeros);
  info.append(el("p", "resumo-frase", `No papel, seria o ${pos}º time mais forte da Série A 2026.`));
  info.append(el("p", "nota", `${D.esquema}: ${descreverTatica(D.esquema)}.`));
  const ul = el("ul", "resumo-comps");
  for (const c of [`Brasileirão, no lugar do ${D.sai}`, "Copa do Brasil, a partir da 5ª fase", `${COMP[D.continental]}: grupo sorteado quando a temporada começar`]) {
    ul.append(el("li", null, c));
  }
  info.append(el("p", "nota", "Temporada:"), ul);
  alvo.append(campo, info);
}

// --- temporada -----------------------------------------------------------------------

// sorteia um grupo e tira dele o estrangeiro mais fraco pra entrar o usuario
function regrasComUsuario(id) {
  const regras = structuredClone(D.regras);
  const grupos = regras[CHAVE_REGRA[D.continental]].grupos;
  const letras = Object.keys(grupos);
  const letra = letras[Math.floor(Math.random() * letras.length)];
  const forca = (n) => (regras.estrangeiros[n] ? regras.estrangeiros[n].forca : 99);
  const sai = [...grupos[letra]].sort((a, b) => forca(a) - forca(b))[0];
  grupos[letra] = grupos[letra].map((n) => (n === sai ? id : n));
  D.grupo = { letra, sai };
  return regras;
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

function comecarTemporada() {
  const serieA = serieAComUsuario();
  const eu = Object.values(serieA).find((t) => t.usuario);
  D.regrasTemp = regrasComUsuario(eu.id);
  // quem saiu da Serie A continua existindo: segue na Libertadores/Sul-Americana
  // (sem isso, o grupo dele ficava sem time e a copa travava)
  const saiu = Motor.timesDaSerieA(D.r)[D.sai];
  D.times = { ...(saiu ? { [D.sai]: saiu } : {}), ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
  D.temp = Motor.criarTemporada({
    regras: D.regrasTemp, times: D.times, serieA: Object.keys(serieA), usuario: eu.id,
    semente: Math.floor(Math.random() * 1e9),
  });
  D.aba = "bra";
  $("feed").replaceChildren();
  $("rodada-lista").replaceChildren();
  $("rodada-titulo").textContent = "Resultados da rodada";
  for (const b of ["proximo", "ate-decisivo", "simular-tudo", "sim-ir"]) $(b).disabled = false;
  D.mes = D.temp.etapas[0].data.slice(0, 7);
  D.diaSel = null;
  $("proximo").textContent = "Próximo jogo";
  const alvos = [["bra", COMP.bra], ["cdb", COMP.cdb], [D.continental, COMP[D.continental]]];
  $("sim-alvo").replaceChildren(...alvos.map(([v, t]) => new Option(t, v)));
  mostrar("temporada");
  mudarVisao("jogo");
  const jogo = $("jogo");
  jogo.replaceChildren(
    el("p", "jogo-etapa", "Temporada 2026"),
    el("p", "jogo-dica", `Sorteio: ${D.nome} cai no grupo ${D.grupo.letra} da ${COMP[D.continental]}, no lugar do ${D.grupo.sai}. O ${D.sai} foi pra Série B.`),
  );
  delete jogo.dataset.resultado;
  atualizarPaineis();
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
  const decisivo = Motor.decisiva(x.etapa);
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
  const duracao = movimentoReduzido ? 0 : Motor.decisiva(x.etapa) ? 5200 : 3600;
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
  if (j.classificado) extras.push(j.classificado === D.temp.usuario ? (x.etapa.final ? "CAMPEÃO!" : "Classificado!") : "Eliminado.");
  return extras.join(" · ");
}

// --- penaltis cobranca a cobranca ------------------------------------------------

// quem bate: os 5 melhores finalizadores do onze (goleiro so no fim da fila)
function cobradores(id) {
  const t = D.times ? D.times[id] : null;
  const fin = (j) => (j.eixos && (j.eixos.FIN ?? j.eixos.CHU)) ?? 0;
  const lista = t && t.onze ? t.onze.filter(Boolean).sort((a, b) => (a.posicao === "G") - (b.posicao === "G") || fin(b) - fin(a)).map((j) => j.nome) : [];
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
    linhas[lado] = { bolas, placar, gols: 0, id, cobs: cobradores(id), n: 0 };
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

// joga ate o proximo jogo do usuario e anima
async function proximoJogo() {
  if (D.simulando) return;
  if (D.animando) { D.pularAnimacao = true; return; }
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
async function simular(parar, { respeitarDecisivo = true, botao = null } = {}) {
  if (D.animando || D.simulando) return;
  let ultimo = null, motivo = null, andou = 0;
  carregando(true, botao);
  if (botao) botao.textContent = "Simulando…";
  await respirar();
  try {
  while (!Motor.terminou(D.temp)) {
    const prox = Motor.agenda(D.temp, 1)[0];
    const e = D.temp.etapas[D.temp.i];
    if (parar(e)) { motivo = "fim"; break; }
    if (respeitarDecisivo && prox && prox.indice === D.temp.i && Motor.decisiva(e)) {
      // se o decisivo e logo o proximo, assiste ele em vez de pular
      if (!andou) { carregando(false, botao); proximoJogo(); return; }
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
  if (motivo && motivo !== "fim") {
    $("jogo").append(cartaoDecisivo(motivo));
  }
  if (Motor.terminou(D.temp)) encerrar();
}

// Cartao grande do proximo jogo decisivo: competicao, fase, data, o rival
// (quando ja se sabe) e o botao pra assistir.
function cartaoDecisivo(etapa) {
  const prox = Motor.agenda(D.temp, 1)[0];
  const card = el("div", `proximo-decisivo comp-${etapa.comp}`);
  const esq = el("div", "pd-textos");
  esq.append(el("span", "pd-tag", "Próximo jogo é decisivo"), el("strong", "pd-titulo", etapa.rotulo), el("span", "pd-data", dataJogo(etapa.data)));
  const vs = el("div", "pd-vs");
  const eu = el("span", "pd-camisa"); eu.append(camisaDe(D.temp.usuario));
  vs.append(eu, el("b", null, "×"));
  const rival = prox && prox.jogo ? (prox.jogo.casa === D.temp.usuario ? prox.jogo.fora : prox.jogo.casa) : null;
  const ele = el("span", "pd-camisa");
  if (rival) { ele.append(camisaDe(rival)); ele.title = nomeDe(rival); } else ele.append(el("span", "pd-rival-ind", "?"));
  vs.append(ele);
  const b = el("button", "botao botao-primario", "Assistir agora");
  b.type = "button";
  b.addEventListener("click", () => { card.remove(); proximoJogo(); });
  card.append(esq, vs, b);
  return card;
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
    const tab = Motor.ordenar(t.bra.tabela);
    const pos = tab.findIndex((l) => l.id === eu) + 1;
    return `${pos}º · ${tab[pos - 1].pts} pts · ${t.bra.rodada}/38`;
  }
  if (t.campeoes[comp] === eu) return "Campeão!";
  if (t.eliminado[comp]) return `Caiu: ${t.eliminado[comp].replace(" (foi pra Sul-Americana)", "")}`;
  if (t.campeoes[comp]) return "Encerrada";
  const g = comp === "cdb" ? null : grupoDoUsuario(comp);
  if (g && !g.final) {
    const pos = Motor.ordenar(g.tabela).findIndex((l) => l.id === eu) + 1;
    return `Grupo ${Object.keys(t[comp].grupos).find((k) => t[comp].grupos[k] === g)}: ${pos}º`;
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
      if (Motor.decisiva(etapa)) cel.classList.add("decisivo");
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
      alvo.append(el("span", "cal-resumo", `Próximo: ${contra} (${COMP_CURTA[prox.etapa.comp]}, ${dataJogo(prox.etapa.data)})`));
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
    ver.addEventListener("click", () => { mudarVisao("jogo"); mostrarPlacarPronto(x); mostrarRodada(x); mostrarJogoSeEscondido(); });
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
  await simular((e) => e.data >= iso, { respeitarDecisivo: false, botao: document.querySelector("#cal-acao .botao-primario") });
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

function atualizarPaineis() {
  const status = $("status");
  status.replaceChildren();
  for (const c of compsDoUsuario()) {
    const card = el("div", `status-item comp-${c}`);
    card.append(el("span", "status-comp", COMP[c]), el("strong", null, situacao(c)));
    status.append(card);
  }
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
    painel.append(tabela(Motor.ordenar(g.tabela), D.aba === "lib"
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
    : pos >= 17 ? "Rebaixado. O lobo soprou."
    : zona && zona.nome === "Libertadores" ? "Vaga na Libertadores. Prepara o passaporte."
    : zona && zona.nome === "Sul-Americana" ? "Vaga na Sul-Americana. Dá pra sonhar."
    : pos >= 14 ? `Escapou do Z4 no sufoco: ${pos}º no Brasileirão.`
    : `${pos}º no Brasileirão. Nem fede, nem cheira.`;
  textos.append(
    el("p", "bl-sobre", `${D.esquema} · no lugar do ${D.sai} · temporada 2026`),
    el("h3", "bl-nome", D.nome),
    el("p", `bl-manchete${titulos.length ? " ouro" : pos >= 17 ? " queda" : ""}`, manchete),
  );
  if (titulos.length) {
    const trofeus = el("div", "bl-trofeus");
    for (const c of titulos) trofeus.append(el("span", `bl-trofeu comp-${c}`, COMP[c]));
    textos.append(trofeus);
  }
  topo.append(camisa, textos);

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
    `${D.nome} (${D.esquema}) no Tem Time em Casa`,
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
  rodape.append(copiar, novo);
  alvo.append(topo, corpo, rodape);
  mostrar("fim");
}

// --- liga tudo -----------------------------------------------------------------------

async function iniciarDraft() {
  UNIFORMES = await json("dados/uniformes.json").catch(() => ({}));
  const [r, regras, elencos] = await Promise.all([retrato("2026"), json("dados/competicoes-2026.json"),
    json("dados/elencos-fora.json").catch(() => ({}))]);
  Motor.ELENCOS = elencos.times || {};
  D.r = r;
  D.regras = regras;
  estado.r = r;
  usarCortes(r);
  const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  $("draft-chances").textContent = `Chances por carta: ${NIVEIS.map((t) => `${t.nome} ${pct(CHANCES_DO_LEQUE[t.id])}`).join(" · ")}`;
  inferirFuncoes(r);
  montarCriacao();
  montarClubes();
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
    D.vaga = 0;
    D.trocas = 1;
    D.leques = {};
    mostrar("draft");
    abrirLeque();
  });
  $("trocar-leque").addEventListener("click", () => { if (D.trocas > 0) { D.trocas -= 1; delete D.leques[D.vaga]; abrirLeque(); } });
  $("comecar-temporada").addEventListener("click", comecarTemporada);
  $("proximo").addEventListener("click", () => {
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
    D.sai = null;
    $("comecar-draft").disabled = true;
    $("comecar-draft").textContent = "Escolha quem sai da Série A";
    montarClubes();
    mostrar("clube");
  });
}

iniciarDraft().catch((erro) => {
  console.error(erro);
  $("clubes").replaceChildren(el("div", "vazio", "O jogo não carregou agora. Tenta de novo daqui a pouco."));
});
