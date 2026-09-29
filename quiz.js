// Tem Resposta em Casa: quiz de futebol no formato do programa de TV.
// 16 perguntas (5 faceis, 5 medias, 5 dificeis e a final). Cada acerto sobe a
// carta um degrau na ESCADA_QUIZ (app.js). Parar leva a carta atual; errar leva
// a metade do caminho; na final, errar zera. Ajudas: cartas, Golden Boys, O Enciclopedia,
// arquibancada (uma vez cada) e 3 pulos. Na final nao tem ajuda.

const NIVEL_DA_PERGUNTA = (n) => (n <= 5 ? "f" : n <= 10 ? "m" : n <= 15 ? "d" : "p");
const NOME_NIVEL = { f: "Fácil", m: "Médio", d: "Difícil", p: "Pergunta final" };
const LETRAS = ["A", "B", "C", "D"];
const CHAVE_VISTAS = "tem-resposta-vistas";

const Q = {
  banco: null,
  nome: "",
  pos: "F",
  degrau: 0, // o que ja esta garantido se parar
  numero: 1, // pergunta da vez (1 a 16)
  pergunta: null,
  opcoes: [], // [{ texto, certa }]
  eliminadas: new Set(),
  escolhida: null,
  ajudas: null,
  usadas: new Set(), // ids desta partida
  historico: [], // [{ numero, q, certa, marcada, acertou }]
  travado: false,
};

const $ = (id) => document.getElementById(id);

// --- banco -------------------------------------------------------------------

function carregarBanco() {
  const chave = new TextEncoder().encode("temdadoemcasa");
  const bin = Uint8Array.from(atob(PERGUNTAS_CODIFICADAS), (c) => c.charCodeAt(0));
  for (let i = 0; i < bin.length; i++) bin[i] ^= chave[i % chave.length];
  const todas = JSON.parse(new TextDecoder().decode(bin));
  const banco = { f: [], m: [], d: [], p: [] };
  for (const p of todas) banco[p.n].push(p);
  return banco;
}

function lerVistas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_VISTAS)) || []; } catch { return []; }
}
function guardarVista(id) {
  try {
    const v = lerVistas().filter((x) => x !== id);
    v.push(id);
    localStorage.setItem(CHAVE_VISTAS, JSON.stringify(v.slice(-180)));
  } catch { /* sem storage, repete mais cedo */ }
}

const embaralhar = (lista) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// pergunta do nivel que nao saiu nesta partida; prefere as que a pessoa ainda nao viu
function sortearPergunta(nivel) {
  const pool = Q.banco[nivel].filter((p) => !Q.usadas.has(p.id));
  const vistas = lerVistas();
  const novas = pool.filter((p) => !vistas.includes(p.id));
  const fonte = novas.length ? novas : pool.length ? pool : Q.banco[nivel];
  // entre as ja vistas, a mais antiga primeiro
  if (!novas.length && pool.length) return [...pool].sort((a, b) => vistas.indexOf(a.id) - vistas.indexOf(b.id))[0];
  return fonte[Math.floor(Math.random() * fonte.length)];
}

// --- regras --------------------------------------------------------------------

// errar: a metade do valor garantido, arredondada pro degrau de baixo; na final, zero
function degrauSeErrar() {
  if (Q.numero === 16) return 0;
  const metade = ESCADA_QUIZ[Q.degrau].valor / 2;
  let d = 0;
  ESCADA_QUIZ.forEach((g, i) => { if (g.valor <= metade) d = i; });
  return d;
}

// --- tela ----------------------------------------------------------------------

function mostrarTela(id) {
  for (const t of document.querySelectorAll(".quiz .tela")) t.hidden = t.id !== id;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function desenharCarta(alvo, d, opcoes) {
  alvo.replaceChildren(cartaDoQuiz(Q.nome, Q.pos, d, opcoes));
}

function desenharEscada() {
  const lista = $("escada");
  lista.replaceChildren();
  for (let d = 16; d >= 1; d--) {
    const g = ESCADA_QUIZ[d];
    const li = el("li", `degrau nivel-${nivel(g.ovr).id}`);
    if (d <= Q.degrau) li.classList.add("feito");
    if (d === Q.numero) li.classList.add("agora");
    if (d === 16) li.classList.add("final");
    li.append(el("b", null, String(d)), el("span", "degrau-nome", g.nome), el("span", "degrau-ovr", String(g.ovr)));
    lista.append(li);
  }
}

function desenharValores() {
  const errar = degrauSeErrar();
  const dd = (d) => `${ESCADA_QUIZ[d].nome} · ${ESCADA_QUIZ[d].ovr}`;
  $("valor-errar").textContent = dd(errar);
  $("valor-parar").textContent = dd(Q.degrau);
  $("valor-acertar").textContent = dd(Q.numero);
  $("quiz-mini").textContent = `Sua carta: ${ESCADA_QUIZ[Q.degrau].ovr} · ${ESCADA_QUIZ[Q.degrau].nome}`;
}

function desenharAjudas() {
  const final = Q.numero === 16;
  const a = Q.ajudas;
  const trava = Q.travado || Q.escolhida !== null;
  $("ajuda-cartas").disabled = final || !a.cartas || trava;
  $("ajuda-boys").disabled = final || !a.boys || trava;
  $("ajuda-enciclopedia").disabled = final || !a.enciclopedia || trava;
  $("ajuda-arquibancada").disabled = final || !a.arquibancada || trava;
  $("ajuda-pular").disabled = final || a.pulos <= 0 || trava;
  $("pulos-restantes").textContent = String(a.pulos);
  $("parar").disabled = trava;
  $("aviso-final").hidden = !final;
}

function novaPergunta() {
  const nv = NIVEL_DA_PERGUNTA(Q.numero);
  const p = sortearPergunta(nv);
  Q.pergunta = p;
  Q.usadas.add(p.id);
  guardarVista(p.id);
  Q.opcoes = embaralhar([{ texto: p.a, certa: true }, ...p.e.map((t) => ({ texto: t, certa: false }))]);
  Q.eliminadas = new Set();
  Q.escolhida = null;
  Q.travado = false;
  $("ajuda-resultado").replaceChildren();
  $("ajuda-resultado").hidden = true;
  $("confirmar-caixa").hidden = true;
  $("retorno").hidden = true;

  const cab = $("pergunta-cabeca");
  cab.dataset.nivel = nv;
  $("pergunta-numero").textContent = Q.numero === 16 ? "Pergunta final" : `Pergunta ${Q.numero} de 16`;
  $("pergunta-nivel").textContent = Q.numero === 16 ? "Vale a carta Nível Pelé" : NOME_NIVEL[nv];
  $("enunciado").textContent = p.q;
  desenharAlternativas();
  desenharValores();
  desenharAjudas();
  desenharEscada();
  desenharCarta($("quiz-carta"), Q.degrau);
}

function desenharAlternativas() {
  const lista = $("alternativas");
  lista.replaceChildren(...Q.opcoes.map((o, i) => {
    const li = el("li");
    const b = el("button", "alternativa");
    b.type = "button";
    b.dataset.i = String(i);
    b.append(el("b", "alternativa-letra", LETRAS[i]), el("span", null, o.texto));
    if (Q.eliminadas.has(i)) { b.classList.add("eliminada"); b.disabled = true; }
    if (Q.escolhida === i) b.classList.add("escolhida");
    b.addEventListener("click", () => escolher(i));
    li.append(b);
    return li;
  }));
}

function escolher(i) {
  if (Q.travado || Q.eliminadas.has(i)) return;
  Q.escolhida = i;
  desenharAlternativas();
  desenharAjudas();
  $("confirmar-texto").textContent = `Vai de ${LETRAS[i]}? Tá certo disso?`;
  $("confirmar-caixa").hidden = false;
  $("confirmar").focus({ preventScroll: true });
}

function desistirDaEscolha() {
  Q.escolhida = null;
  $("confirmar-caixa").hidden = true;
  desenharAlternativas();
  desenharAjudas();
}

async function confirmar() {
  if (Q.escolhida === null || Q.travado) return;
  Q.travado = true;
  $("confirmar-caixa").hidden = true;
  desenharAjudas();
  const botoes = [...document.querySelectorAll("#alternativas .alternativa")];
  for (const b of botoes) b.disabled = true;
  const marcada = botoes[Q.escolhida];
  marcada.classList.add("suspense");
  await espera(movimentoReduzido ? 0 : 1100);
  marcada.classList.remove("suspense");
  const certa = Q.opcoes.findIndex((o) => o.certa);
  const acertou = Q.escolhida === certa;
  botoes[certa].classList.add("certa");
  if (!acertou) marcada.classList.add("errada");
  Q.historico.push({ numero: Q.numero, q: Q.pergunta.q, certa: Q.pergunta.a, marcada: Q.opcoes[Q.escolhida].texto, acertou });

  if (!acertou) {
    const caiu = degrauSeErrar();
    Q.degrau = caiu;
    await espera(movimentoReduzido ? 0 : 1300);
    return terminar("errou");
  }
  Q.degrau = Q.numero;
  subirCarta();
  if (Q.numero === 16) {
    await espera(movimentoReduzido ? 0 : 900);
    return terminar("campeao");
  }
  const retorno = $("retorno");
  $("retorno-texto").textContent = Q.pergunta.x ? `Certa! ${Q.pergunta.x}` : "Certa!";
  $("retorno-subiu").textContent = `Sua carta subiu pra ${ESCADA_QUIZ[Q.degrau].nome} (${ESCADA_QUIZ[Q.degrau].ovr}).`;
  retorno.hidden = false;
  $("proxima").textContent = Q.numero === 15 ? "Ir pra pergunta final" : "Próxima pergunta";
  $("proxima").focus({ preventScroll: true });
  if (QUIZ_ABAS) QUIZ_ABAS.marcar("escada");
}

function subirCarta() {
  const alvo = $("quiz-carta");
  desenharCarta(alvo, Q.degrau);
  const nova = alvo.querySelector(".carta");
  if (nova) nova.classList.add("subiu");
  desenharEscada();
  $("quiz-mini").textContent = `Sua carta: ${ESCADA_QUIZ[Q.degrau].ovr} · ${ESCADA_QUIZ[Q.degrau].nome}`;
}

function proxima() {
  Q.numero += 1;
  novaPergunta();
  window.scrollTo({ top: 0, behavior: "auto" });
}

// --- ajudas ----------------------------------------------------------------------

const vivas = () => Q.opcoes.map((o, i) => i).filter((i) => !Q.eliminadas.has(i));
const indiceCerto = () => Q.opcoes.findIndex((o) => o.certa);

function caixaDeAjuda(titulo) {
  const caixa = $("ajuda-resultado");
  caixa.hidden = false;
  caixa.replaceChildren(el("p", "ajuda-titulo", titulo));
  return caixa;
}

// Cartas: quatro viradas pra baixo. Rei tira nenhuma, As tira uma, 2 tira duas, 3 tira tres.
function ajudaCartas() {
  if (!Q.ajudas.cartas) return;
  Q.ajudas.cartas = false;
  Q.travado = true;
  desenharAjudas();
  const caixa = caixaDeAjuda("Escolhe uma carta. Rei não tira nenhuma, Ás tira uma, 2 tira duas, 3 tira três.");
  const baralho = embaralhar([["K", 0], ["A", 1], ["2", 2], ["3", 3]]);
  const mesa = el("div", "baralho");
  const botoes = baralho.map(([face, n], i) => {
    const b = el("button", "carta-baralho");
    b.type = "button";
    b.setAttribute("aria-label", `Carta ${i + 1}`);
    const verso = el("img");
    verso.src = "img/simbolo.svg";
    verso.alt = "";
    b.append(el("span", "carta-verso", ""), el("span", "carta-face", face));
    b.querySelector(".carta-verso").append(verso);
    b.addEventListener("click", async () => {
      for (const x of botoes) { x.disabled = true; x.classList.add("virada"); }
      b.classList.add("escolhida");
      const erradas = embaralhar(vivas().filter((j) => !Q.opcoes[j].certa)).slice(0, n);
      for (const j of erradas) Q.eliminadas.add(j);
      await espera(movimentoReduzido ? 0 : 500);
      caixa.append(el("p", "ajuda-fala", n === 0 ? "Rei. Não saiu nenhuma." : `${face === "A" ? "Ás" : face}: ${n === 1 ? "saiu uma errada" : `saíram ${n} erradas`}.`));
      Q.travado = false;
      desenharAlternativas();
      desenharAjudas();
    });
    return b;
  });
  mesa.append(...botoes);
  caixa.append(mesa);
}

// Golden Boys (os universitarios do programa): tres joias sorteadas por partida,
// de uma base de 30. Acertam mais nas faceis.
const GOLDEN_BOYS = [
  "Lamine Yamal", "Estêvão", "Endrick", "Pau Cubarsí", "Désiré Doué", "Zaïre-Emery", "Arda Güler", "Kobbie Mainoo",
  "Garnacho", "Mastantuono", "Echeverri", "Kenan Yıldız", "Nico Paz", "João Neves", "Dean Huijsen", "Leny Yoro",
  "Ethan Nwaneri", "Lewis-Skelly", "Mathys Tel", "Vitor Roque", "Savinho", "Gavi", "Musiala", "Wirtz",
  "Bellingham", "Xavi Simons", "Rodrigo Mora", "Geovany Quenda", "Kendry Páez", "Rayan",
];
const CERTEZA = ["Tenho quase certeza.", "Acho que é essa.", "Vou no chute, hein.", "Essa eu sei!", "Não me cobra depois.", "Meu pai sabe essa, confia.", "Vi num vídeo, é essa."];
function sortearGoldenBoys() {
  let anteriores = [];
  try { anteriores = JSON.parse(localStorage.getItem("tem-resposta-boys")) || []; } catch { /* ok */ }
  const livres = GOLDEN_BOYS.filter((n) => !anteriores.includes(n));
  const trio = embaralhar(livres.length >= 3 ? livres : GOLDEN_BOYS).slice(0, 3);
  try { localStorage.setItem("tem-resposta-boys", JSON.stringify(trio)); } catch { /* ok */ }
  return trio;
}
function ajudaGoldenBoys() {
  if (!Q.ajudas.boys) return;
  Q.ajudas.boys = false;
  desenharAjudas();
  const acerto = { f: 0.88, m: 0.7, d: 0.5 }[NIVEL_DA_PERGUNTA(Q.numero)];
  const caixa = caixaDeAjuda("Os Golden Boys");
  const lista = el("ul", "palpites");
  const frases = embaralhar(CERTEZA);
  Q.boys.forEach((quem, k) => {
    const certo = indiceCerto();
    const erradas = vivas().filter((j) => j !== certo);
    const voto = Math.random() < acerto || !erradas.length ? certo : erradas[Math.floor(Math.random() * erradas.length)];
    const li = el("li");
    li.append(el("b", null, quem), el("span", null, `Vou de ${LETRAS[voto]}. ${frases[k]}`));
    lista.append(li);
  });
  caixa.append(lista);
}

// O Enciclopedia: aquele que sabe tudo de bola. Nao erra, mas so da pra chamar uma vez.
function ajudaEnciclopedia() {
  if (!Q.ajudas.enciclopedia) return;
  Q.ajudas.enciclopedia = false;
  desenharAjudas();
  const certo = indiceCerto();
  const caixa = caixaDeAjuda("Ajuda certeira");
  const fala = `Pode marcar ${LETRAS[certo]}, ${Q.opcoes[certo].texto}. Tá no meu caderno desde sempre.`;
  const lista = el("ul", "palpites");
  const li = el("li", "certeira");
  li.append(el("b", null, "O Enciclopédia"), el("span", null, fala));
  lista.append(li);
  caixa.append(lista);
}

// Arquibancada: a torcida vota. A certa leva mais voto quanto mais facil.
function ajudaArquibancada() {
  if (!Q.ajudas.arquibancada) return;
  Q.ajudas.arquibancada = false;
  desenharAjudas();
  const nv = NIVEL_DA_PERGUNTA(Q.numero);
  const certo = indiceCerto();
  const abertas = vivas();
  const pesos = Q.opcoes.map((o, i) => {
    if (!abertas.includes(i)) return 0;
    if (i === certo) return { f: 3.2, m: 1.8, d: 1.15 }[nv] + Math.random() * 1.2;
    return 0.4 + Math.random();
  });
  const soma = pesos.reduce((a, b) => a + b, 0);
  const pct = pesos.map((p) => Math.round((p / soma) * 100));
  // fecha em 100
  const maior = pct.indexOf(Math.max(...pct));
  pct[maior] += 100 - pct.reduce((a, b) => a + b, 0);
  const caixa = caixaDeAjuda("A arquibancada votou");
  const barras = el("ul", "arquibancada");
  pct.forEach((v, i) => {
    const li = el("li");
    li.style.setProperty("--v", `${v}%`);
    if (Q.eliminadas.has(i)) li.classList.add("eliminada");
    li.append(el("b", null, LETRAS[i]), el("span", "barra-voto"), el("span", "pct", `${v}%`));
    barras.append(li);
  });
  caixa.append(barras);
}

function ajudaPular() {
  if (Q.ajudas.pulos <= 0 || Q.numero === 16) return;
  Q.ajudas.pulos -= 1;
  novaPergunta();
}

function parar() {
  if (Q.travado) return;
  const caixa = caixaDeAjuda(`Parar agora e levar a carta ${ESCADA_QUIZ[Q.degrau].nome} (${ESCADA_QUIZ[Q.degrau].ovr})?`);
  const botoes = el("div", "confirmar-botoes");
  const sim = el("button", "botao botao-primario", "Parar e levar");
  sim.type = "button";
  sim.addEventListener("click", () => terminar("parou"));
  const nao = el("button", "botao", "Continuar jogando");
  nao.type = "button";
  nao.addEventListener("click", () => { $("ajuda-resultado").hidden = true; });
  botoes.append(sim, nao);
  caixa.append(botoes);
  sim.focus({ preventScroll: true });
}

// --- fim ----------------------------------------------------------------------

function terminar(como) {
  const d = Q.degrau;
  const g = ESCADA_QUIZ[d];
  const titulo = $("fim-titulo");
  const texto = $("fim-texto");
  const ultima = Q.historico[Q.historico.length - 1];
  $("tela-fim").dataset.como = como;
  if (como === "campeao") {
    titulo.textContent = "Nível Pelé!";
    texto.textContent = "Acertou as 16. A carta chegou no topo da escada.";
  } else if (como === "parou") {
    titulo.textContent = `Parou na pergunta ${Q.numero}`;
    texto.textContent = d === 0 ? "Parou antes de acertar a primeira. Voltou pra pelada de rua." : `Levou a carta ${g.nome}, com ${g.ovr} de overall.`;
  } else {
    titulo.textContent = `Errou a pergunta ${Q.numero}`;
    const caiu = Q.numero === 16 ? "Na final, errar zera: a carta voltou pra pelada de rua." : `A carta caiu pra ${g.nome} (${g.ovr}).`;
    texto.textContent = `A certa era "${ultima.certa}". ${caiu}`;
  }
  desenharCarta($("fim-carta"), d, { acertos: Q.historico.filter((h) => h.acertou).length });
  const lista = $("fim-lista");
  lista.replaceChildren(...Q.historico.map((h) => {
    const li = el("li", h.acertou ? "acertou" : "errou");
    li.append(el("b", null, String(h.numero)), el("span", null, h.q),
      el("em", null, h.acertou ? h.certa : `${h.marcada} · certa: ${h.certa}`));
    return li;
  }));
  $("fim-resumo").hidden = !Q.historico.length;
  mostrarTela("tela-fim");
  if (como === "campeao" && !movimentoReduzido) $("fim-carta").classList.add("festa-quiz");
}

// --- inicio ----------------------------------------------------------------------

let QUIZ_ABAS = null;

function comecar() {
  Q.nome = ($("nome").value || "").trim().slice(0, 16) || "Você";
  try { localStorage.setItem("tem-resposta-nome", Q.nome); localStorage.setItem("tem-resposta-pos", Q.pos); } catch { /* ok */ }
  Q.degrau = 0;
  Q.numero = 1;
  Q.usadas = new Set();
  Q.historico = [];
  Q.ajudas = { cartas: true, boys: true, enciclopedia: true, arquibancada: true, pulos: 3 };
  Q.boys = sortearGoldenBoys();
  $("ajuda-boys").title = Q.boys.join(", ");
  $("fim-carta").classList.remove("festa-quiz");
  mostrarTela("tela-jogo");
  if (!QUIZ_ABAS) {
    QUIZ_ABAS = montarAbasMobile($("tela-jogo"), [
      { id: "pergunta", rotulo: "Pergunta", icone: "jogo", paineis: [$("painel-pergunta")] },
      { id: "escada", rotulo: "Sua carta", icone: "carta", paineis: [$("painel-escada")], aoAbrir: desenharEscada },
    ], "pergunta");
  } else {
    QUIZ_ABAS.abrir("pergunta", { rolar: false });
  }
  novaPergunta();
}

function atualizarPreviaInicio() {
  desenharCarta($("inicio-carta"), 0, { acertos: 0 });
}

function iniciarQuiz() {
  Q.banco = carregarBanco();
  try {
    const n = localStorage.getItem("tem-resposta-nome");
    const p = localStorage.getItem("tem-resposta-pos");
    if (n) $("nome").value = n;
    if (p && "GDMF".includes(p)) Q.pos = p;
  } catch { /* ok */ }
  Q.nome = $("nome").value.trim() || "Você";
  for (const b of document.querySelectorAll("#posicoes .chip")) {
    b.setAttribute("aria-pressed", String(b.dataset.pos === Q.pos));
    b.addEventListener("click", () => {
      Q.pos = b.dataset.pos;
      for (const x of document.querySelectorAll("#posicoes .chip")) x.setAttribute("aria-pressed", String(x === b));
      atualizarPreviaInicio();
    });
  }
  $("nome").addEventListener("input", () => { Q.nome = $("nome").value.trim() || "Você"; atualizarPreviaInicio(); });
  $("form-inicio").addEventListener("submit", (e) => { e.preventDefault(); comecar(); });
  $("confirmar").addEventListener("click", confirmar);
  $("voltar-escolha").addEventListener("click", desistirDaEscolha);
  $("proxima").addEventListener("click", proxima);
  $("ajuda-cartas").addEventListener("click", ajudaCartas);
  $("ajuda-boys").addEventListener("click", ajudaGoldenBoys);
  $("ajuda-enciclopedia").addEventListener("click", ajudaEnciclopedia);
  $("ajuda-arquibancada").addEventListener("click", ajudaArquibancada);
  $("ajuda-pular").addEventListener("click", ajudaPular);
  $("parar").addEventListener("click", parar);
  $("de-novo").addEventListener("click", comecar);
  $("trocar").addEventListener("click", () => { mostrarTela("tela-inicio"); atualizarPreviaInicio(); });
  // teclado: A-D escolhe, Enter confirma
  document.addEventListener("keydown", (e) => {
    if ($("tela-jogo").hidden || e.target instanceof HTMLInputElement) return;
    const i = LETRAS.indexOf(e.key.toUpperCase());
    if (i >= 0 && !e.ctrlKey && !e.metaKey) escolher(i);
  });
  const total = Q.banco.f.length + Q.banco.m.length + Q.banco.d.length + Q.banco.p.length;
  $("total-perguntas").textContent = String(total);
  atualizarPreviaInicio();
}

iniciarQuiz();
