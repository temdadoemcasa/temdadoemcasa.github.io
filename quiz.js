// Show do Dadão: quiz de futebol no formato do programa de TV.
// 16 perguntas (3 faceis, 6 medias, 6 dificeis e a final). Cada acerto sobe a
// carta um degrau na ESCADA_QUIZ (app.js). Parar leva a carta atual; errar leva
// a metade do caminho; na final, errar zera. Ajudas: cartas, Golden Boys, O Enciclopedia,
// arquibancada (uma vez cada) e 3 pulos. Na final nao tem ajuda.

// curva: 3 faceis, 6 medias, 6 dificeis e a final
const NIVEL_DA_PERGUNTA = (n) => (n <= 3 ? "f" : n <= 9 ? "m" : n <= 15 ? "d" : "p");
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

const CHAVE_RECORDE = "tem-resposta-recorde";
function lerRecorde() { try { return Number(localStorage.getItem(CHAVE_RECORDE)) || 0; } catch { return 0; } }
function guardarRecorde(d) { try { if (d > lerRecorde()) localStorage.setItem(CHAVE_RECORDE, String(d)); } catch { /* ok */ } }

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
// Cada pergunta tem uma nota de dificuldade (s, de 1 a 10) e cada numero da
// escada puxa a sua nota: a dificuldade sobe um degrau de cada vez, sem pergunta
// facil depois de uma dificil.
// as 6 ultimas puxam do topo do banco: 8, 8, 9, 9, 9 e a final 10
const NOTA_DA_PERGUNTA = [null, 1, 2, 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 9, 9, 9, 10];

function sortearPergunta(numero) {
  const alvo = NOTA_DA_PERGUNTA[numero];
  const todas = [...Q.banco.f, ...Q.banco.m, ...Q.banco.d, ...Q.banco.p];
  const vistas = lerVistas();
  // a nota certa primeiro; se acabar, a vizinha de baixo (nunca uma mais dificil antes da hora)
  for (const nota of [alvo, alvo - 1, alvo + 1]) {
    const pool = todas.filter((p) => (p.s ?? 0) === nota && !Q.usadas.has(p.id));
    if (!pool.length) continue;
    const novas = pool.filter((p) => !vistas.includes(p.id));
    if (novas.length) return novas[Math.floor(Math.random() * novas.length)];
    // entre as ja vistas, a mais antiga primeiro
    return [...pool].sort((x, y) => vistas.indexOf(x.id) - vistas.indexOf(y.id))[0];
  }
  const nivel = NIVEL_DA_PERGUNTA(numero);
  return Q.banco[nivel][Math.floor(Math.random() * Q.banco[nivel].length)];
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
  const trava = Q.travado;
  $("ajuda-cartas").disabled = final || !a.cartas || trava;
  $("ajuda-boys").disabled = final || !a.boys || trava;
  $("ajuda-enciclopedia").disabled = final || !a.enciclopedia || trava;
  $("ajuda-arquibancada").disabled = final || !a.arquibancada || trava;
  $("ajuda-pular").disabled = final || a.pulos <= 0 || trava;
  $("pulos-restantes").textContent = String(a.pulos);
  $("parar").disabled = trava;
}

// Palco de acao: um painel por vez, sempre no mesmo lugar (nada pula, nada rola)
function mostrarAcao(id) {
  for (const p of document.querySelectorAll("#palco-acao .acao")) {
    const ativa = p.id === id;
    p.classList.toggle("ativa", ativa);
    p.inert = !ativa;
  }
}

function falar(texto) { $("ajuda-linha").textContent = texto; }

function novaPergunta() {
  const nv = NIVEL_DA_PERGUNTA(Q.numero);
  const p = sortearPergunta(Q.numero);
  Q.pergunta = p;
  Q.usadas.add(p.id);
  guardarVista(p.id);
  Q.opcoes = embaralhar([{ texto: p.a, certa: true }, ...p.e.map((t) => ({ texto: t, certa: false }))]);
  Q.eliminadas = new Set();
  Q.escolhida = null;
  Q.travado = false;
  Q.marcas = { votos: null, boys: [[], [], [], []], enciclopedia: null };
  mostrarAcao("acao-padrao");
  falar(Q.numero === 16 ? "Pergunta final: sem ajuda. Se parar, leva a carta de 15 acertos. Errar zera." : "");

  $("pergunta-numero").textContent = Q.numero === 16 ? "Pergunta final" : `Pergunta ${Q.numero} de 16`;
  // sem rotulo de dificuldade: so a final ganha o selo do premio
  $("pergunta-nivel").textContent = Q.numero === 16 ? "Vale a Prateleira Rei Pelé" : "";
  $("pergunta-nivel").hidden = Q.numero !== 16;
  $("enunciado").textContent = p.q;
  desenharTrilha();
  desenharAlternativas();
  desenharValores();
  desenharAjudas();
  desenharEscada();
  desenharCarta($("quiz-carta"), Q.degrau);
}

function desenharTrilha() {
  const trilha = $("trilha");
  trilha.replaceChildren();
  for (let n = 1; n <= 16; n++) {
    const i = el("i", n < Q.numero ? "feita" : n === Q.numero ? "agora" : "");
    if (n === 16) i.classList.add("final");
    trilha.append(i);
  }
}

const iniciais = (nome) => {
  const partes = nome.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : nome.slice(0, 2)).toUpperCase();
};

// As ajudas aparecem DENTRO das alternativas (porcentagem, quem votou, o selo
// do Enciclopedia): a pessoa olha pro mesmo lugar e nada se mexe.
function desenharAlternativas() {
  const lista = $("alternativas");
  const m = Q.marcas;
  // alternativa comprida (top 3 da Bola de Ouro...) quebra linha: letra menor pra caber sem rolar
  lista.classList.toggle("longas", Q.opcoes.some((o) => o.texto.length > 26));
  lista.replaceChildren(...Q.opcoes.map((o, i) => {
    const li = el("li");
    const b = el("button", "alternativa");
    b.type = "button";
    b.dataset.i = String(i);
    b.append(el("b", "alternativa-letra", LETRAS[i]), el("span", "alternativa-texto", o.texto));
    const extras = el("span", "alternativa-extras");
    if (m.enciclopedia === i) {
      b.classList.add("indicada");
      const selo = el("span", "selo-enciclopedia", "✓");
      selo.title = "O Enciclopédia";
      extras.append(selo);
    }
    for (const quem of m.boys[i]) {
      const av = el("span", "avatar-boy", iniciais(quem));
      av.title = quem;
      extras.append(av);
    }
    if (m.votos && !Q.eliminadas.has(i)) {
      b.classList.add("com-voto");
      b.style.setProperty("--voto", `${m.votos[i]}%`);
      extras.append(el("span", "voto", `${m.votos[i]}%`));
    }
    if (extras.childNodes.length) b.append(extras);
    if (Q.eliminadas.has(i)) { b.classList.add("eliminada"); b.disabled = true; }
    b.addEventListener("click", () => escolher(i));
    li.append(b);
    // escolheu: tocar de novo na mesma alternativa confirma; o aviso fica na borda dela
    if (Q.escolhida === i) {
      b.classList.add("escolhida");
      b.setAttribute("aria-label", `${LETRAS[i]}, ${o.texto}. Toque de novo pra confirmar.`);
      const aviso = el("span", "toque-de-novo", matchMedia("(pointer: fine)").matches ? "Clique de novo (ou Enter) pra confirmar ✓" : "Toque de novo pra confirmar ✓");
      aviso.id = "confirmar";
      aviso.addEventListener("click", (e) => { e.stopPropagation(); confirmar(); });
      li.append(aviso);
    }
    return li;
  }));
}

function escolher(i) {
  if (Q.travado || Q.eliminadas.has(i)) return;
  // segundo toque na mesma alternativa confirma (com uma folguinha contra toque duplo sem querer)
  if (Q.escolhida === i) {
    if (Date.now() - (Q.escolhidaEm || 0) > 280) confirmar();
    return;
  }
  Q.escolhida = i;
  Q.escolhidaEm = Date.now();
  desenharAlternativas();
  desenharAjudas();
  mostrarAcao("acao-padrao");
  $("confirmar").focus({ preventScroll: true });
}

function desistirDaEscolha() {
  Q.escolhida = null;
  mostrarAcao("acao-padrao");
  desenharAlternativas();
  desenharAjudas();
}

async function confirmar() {
  if (Q.escolhida === null || Q.travado) return;
  Q.travado = true;
  $("confirmar")?.classList.add("valendo");
  desenharAjudas();
  const botoes = [...document.querySelectorAll("#alternativas .alternativa")];
  for (const b of botoes) b.disabled = true;
  const marcada = botoes[Q.escolhida];
  marcada.classList.add("suspense");
  await espera(movimentoReduzido ? 0 : 1100);
  $("confirmar")?.remove();
  marcada.classList.remove("suspense");
  const certa = Q.opcoes.findIndex((o) => o.certa);
  const acertou = Q.escolhida === certa;
  botoes[certa].classList.add("certa");
  if (!acertou) marcada.classList.add("errada");
  Q.historico.push({ numero: Q.numero, q: Q.pergunta.q, certa: Q.pergunta.a, marcada: Q.opcoes[Q.escolhida].texto, acertou,
    frase: Q.pergunta.r || "" });

  const retorno = $("retorno");
  if (!acertou) {
    Q.degrau = degrauSeErrar();
    const g = ESCADA_QUIZ[Q.degrau];
    retorno.classList.add("errou");
    $("retorno-texto").textContent = `Errou! A certa era ${LETRAS[certa]}, ${Q.pergunta.a}.${Q.pergunta.x ? ` ${Q.pergunta.x}` : ""}`;
    $("retorno-subiu").textContent = Q.numero === 16 ? "Na final, errar zera." : `Sua carta caiu pra ${g.nome} (${g.ovr}).`;
    $("retorno-carta").replaceChildren();
    $("proxima").textContent = "Ver o resultado";
    $("proxima").dataset.fim = "errou";
    mostrarAcao("retorno");
    $("proxima").focus({ preventScroll: true });
    return;
  }
  Q.degrau = Q.numero;
  subirCarta();
  if (Q.numero === 16) {
    await comemorar(16, { curiosidade: Q.pergunta.x || "", frase: Q.pergunta.r || "" });
    return terminar("campeao");
  }
  // sem botao: a comemoracao segura ~3 s e a proxima pergunta entra sozinha
  retorno.classList.remove("errou");
  delete $("proxima").dataset.fim;
  desenharCarta($("retorno-carta"), Q.degrau);
  $("retorno-texto").textContent = "Certa!";
  $("retorno-subiu").textContent = `Sua carta subiu pra ${ESCADA_QUIZ[Q.degrau].nome} (${ESCADA_QUIZ[Q.degrau].ovr}).`;
  $("proxima").hidden = true;
  mostrarAcao("retorno");
  await comemorar(Q.degrau, { curiosidade: Q.pergunta.x || "", frase: Q.pergunta.r || "" });
  $("proxima").hidden = false;
  proxima();
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
  document.querySelector(".festa-quiz-pop")?.remove();
  if ($("proxima").dataset.fim) { delete $("proxima").dataset.fim; return terminar("errou"); }
  Q.numero += 1;
  novaPergunta();
  // so volta se o topo da pergunta tiver saido da tela
  const topo = $("pergunta-cabeca").getBoundingClientRect().top;
  if (topo < 0) $("pergunta-cabeca").scrollIntoView({ block: "start" });
}

// --- ajudas ----------------------------------------------------------------------

const vivas = () => Q.opcoes.map((o, i) => i).filter((i) => !Q.eliminadas.has(i));
const indiceCerto = () => Q.opcoes.findIndex((o) => o.certa);

// Cartas: quatro viradas pra baixo. Rei tira nenhuma, As tira uma, 2 tira duas, 3 tira tres.
function ajudaCartas() {
  if (!Q.ajudas.cartas) return;
  Q.escolhida = null;
  Q.ajudas.cartas = false;
  Q.travado = true;
  desenharAjudas();
  const baralho = embaralhar([["K", 0], ["A", 1], ["2", 2], ["3", 3]]);
  const mesa = $("baralho");
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
      await espera(movimentoReduzido ? 0 : 700);
      const nome = { K: "Rei", A: "Ás" }[face] || face;
      falar(n === 0 ? "Cartas: saiu o Rei. Nenhuma alternativa caiu." : `Cartas: saiu ${nome}. ${n === 1 ? "Caiu uma errada." : `Caíram ${n} erradas.`}`);
      Q.travado = false;
      mostrarAcao("acao-padrao");
      desenharAlternativas();
      desenharAjudas();
    });
    return b;
  });
  mesa.replaceChildren(...botoes);
  mostrarAcao("cartas-caixa");
}

// Golden Boys (os universitarios do programa): tres joias sorteadas por partida,
// de uma base de 30. Acertam mais nas faceis.
const GOLDEN_BOYS = [
  "Lamine Yamal", "Estêvão", "Endrick", "Pau Cubarsí", "Désiré Doué", "Zaïre-Emery", "Arda Güler", "Kobbie Mainoo",
  "Garnacho", "Mastantuono", "Echeverri", "Kenan Yıldız", "Nico Paz", "João Neves", "Dean Huijsen", "Leny Yoro",
  "Ethan Nwaneri", "Lewis-Skelly", "Mathys Tel", "Vitor Roque", "Savinho", "Gavi", "Musiala", "Wirtz",
  "Bellingham", "Xavi Simons", "Rodrigo Mora", "Geovany Quenda", "Kendry Páez", "Rayan",
];
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
  Q.escolhida = null;
  Q.ajudas.boys = false;
  const acerto = { f: 0.88, m: 0.7, d: 0.5 }[NIVEL_DA_PERGUNTA(Q.numero)];
  const certo = indiceCerto();
  const erradas = vivas().filter((j) => j !== certo);
  const falas = Q.boys.map((quem) => {
    const voto = Math.random() < acerto || !erradas.length ? certo : erradas[Math.floor(Math.random() * erradas.length)];
    Q.marcas.boys[voto].push(quem);
    return `${quem}: ${LETRAS[voto]}`;
  });
  falar(`Golden Boys: ${falas.join(" · ")}`);
  desenharAlternativas();
  desenharAjudas();
}

// O Enciclopedia: aquele que sabe tudo de bola. Nao erra, mas so da pra chamar uma vez.
function ajudaEnciclopedia() {
  if (!Q.ajudas.enciclopedia) return;
  Q.escolhida = null;
  Q.ajudas.enciclopedia = false;
  const certo = indiceCerto();
  Q.marcas.enciclopedia = certo;
  falar(`O Enciclopédia: pode marcar ${LETRAS[certo]}. Tá no meu caderno desde sempre.`);
  desenharAlternativas();
  desenharAjudas();
}

// Arquibancada: a torcida vota. A certa leva mais voto quanto mais facil.
function ajudaArquibancada() {
  if (!Q.ajudas.arquibancada) return;
  Q.escolhida = null;
  Q.ajudas.arquibancada = false;
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
  Q.marcas.votos = pct;
  falar(`Arquibancada: a maioria foi de ${LETRAS[maior]}.`);
  desenharAlternativas();
  desenharAjudas();
}

function ajudaPular() {
  if (Q.ajudas.pulos <= 0 || Q.numero === 16) return;
  Q.ajudas.pulos -= 1;
  novaPergunta();
  falar(`Pulou. ${Q.ajudas.pulos === 0 ? "Acabaram os pulos." : `Ainda tem ${Q.ajudas.pulos}.`}`);
}

function parar() {
  if (Q.travado) return;
  if (Q.escolhida !== null) { Q.escolhida = null; desenharAlternativas(); }
  const g = ESCADA_QUIZ[Q.degrau];
  $("parar-texto").textContent = Q.degrau === 0
    ? "Parar agora? Você ainda não acertou nenhuma e sai com a carta da pelada de rua."
    : `Parar agora e levar a carta ${g.nome} (${g.ovr})?`;
  mostrarAcao("parar-caixa");
  $("parar-sim").focus({ preventScroll: true });
}


// --- comemoracao a cada prateleira ---------------------------------------------------
// Popup rapido por cima de tudo (nao mexe no layout): a sua camisa de costas,
// com nome e numero, no cenario da prateleira, e o Dadao comemorando junto.
// Some sozinho e nao bloqueia: da pra tocar em Proxima por baixo.
const LIMITE_NOME = 12;

const FESTA_DO_DEGRAU = [
  null,
  ["Várzea", "Primeiro gol na várzea. A resenha começou."],
  ["Escolinha", "Entrou pra escolinha. O professor gostou do seu chute."],
  ["Sub-15", "Chamado pro sub-15. Já tem empresário de olho."],
  ["Sub-17", "Sub-17! A família já emoldurou a primeira camisa."],
  ["Sub-20", "Sub-20. Tá batendo na porta do profissional."],
  ["Série D", "Estreou no profissional. Campo ruim, coração grande."],
  ["Série C", "Série C! A torcida já tem musiquinha pra você."],
  ["Série B", "Série B. Agora o jogo passa na TV."],
  ["Série A", "Chegou na Série A. Figurinha no álbum!"],
  ["Libertadores", "Campeão da Libertadores! Papel picado, catimba e taça na mão."],
  ["Europa", "Vendido pra Europa! Casaco novo e saudade do arroz com feijão."],
  ["Champions", "Ouviu o hino da Champions de dentro do campo."],
  ["Seleção", "Convocado! Camisa amarela no peito."],
  ["Copa do Mundo", "Campeão do mundo! A taça é sua."],
  ["Prateleira Messi e CR7", "Bola de Ouro na estante! Você sentou na mesa de Messi e Cristiano Ronaldo."],
  ["Prateleira Rei Pelé", "Você chegou aos pés do nosso Rei Pelé. Só Pelé, só Pelé… e agora você. Parabéns, craque!"],
];

// Cada prateleira tem o seu cenario (props desenhados a mao, sem marca nem pessoa real).
const PROPS_DA_FESTA = {
  1: (g) => { // varzea: chao de terra, trave de madeira e bola
    g.append(svg("rect", { x: 0, y: 176, width: 240, height: 24, fill: "#7a5230" }),
      svg("path", { d: "M176 176 V120 H228 V176", fill: "none", stroke: "#a7794a", "stroke-width": 5, "stroke-linejoin": "round" }));
    g.append(bola(196, 168, 8));
  },
  2: (g) => { for (const x of [176, 200, 224]) g.append(cone(x, 176)); g.append(bola(186, 150, 8)); },
  3: (g) => g.append(medalha(200, 110, "#cd7f32", "15")),
  4: (g) => g.append(medalha(200, 110, "#c0c7cf", "17")),
  5: (g) => g.append(medalha(200, 110, "#f2c230", "20")),
  6: (g) => { g.append(gramado()); g.append(refletor(28, 24), refletor(212, 24)); },
  7: (g) => { g.append(gramado(), torcida()); g.append(refletor(28, 24), refletor(212, 24)); },
  8: (g) => { g.append(gramado()); g.append(refletor(28, 24), camera(200, 120)); },
  9: (g) => { g.append(gramado(), torcida()); g.append(figurinha(200, 104)); },
  10: (g, u) => { g.append(gramado(), torcida("#ffffff")); for (let i = 0; i < 18; i++) g.append(svg("rect", { x: 8 + (i * 37) % 224, y: 20 + (i * 53) % 130, width: 6, height: 4, fill: "#ffffff", opacity: 0.85, transform: `rotate(${(i * 31) % 90} ${8 + (i * 37) % 224} ${20 + (i * 53) % 130})` })); g.append(tacaPrata(204, 100, u), sinalizador(30, 176)); },
  11: (g) => g.append(aviao(196, 56), svg("path", { d: "M14 60 Q60 40 110 52", fill: "none", stroke: "rgba(255,255,255,.45)", "stroke-width": 2, "stroke-dasharray": "5 5" })),
  12: (g) => { g.append(gramado()); for (const [x, y, t] of [[196, 70, 12], [220, 110, 8], [182, 128, 7], [210, 150, 9], [36, 60, 9]]) g.append(svg("path", { d: estrela(x, y, t, t * 0.45), fill: "#ffffff" })); },
  13: (g) => g.append(bandeira(178, 58)),
  14: (g, u) => { for (let i = 0; i < 10; i++) g.append(svg("rect", { x: 170 + (i * 13) % 60, y: 20 + (i * 29) % 70, width: 4, height: 8, fill: "#f2c230" })); g.append(taca(196, 104, u)); },
  15: (g, u) => { g.append(bolaDeOuro(200, 110, u)); for (const [x, y, t] of [[176, 70, 7], [226, 84, 6], [40, 64, 8]]) g.append(svg("path", { d: estrela(x, y, t, t * 0.45), fill: "#f2c230" })); },
  16: (g, u) => trono(g, u),
};

function bola(cx, cy, r) {
  const g = svg("g");
  g.append(svg("circle", { cx, cy, r, fill: "#ffffff", stroke: "#111", "stroke-width": 1 }),
    svg("path", { d: `M${cx} ${cy - r * 0.45} l${r * 0.43} ${r * 0.31} l-${r * 0.16} ${r * 0.5} h-${r * 0.54} l-${r * 0.16} -${r * 0.5} Z`, fill: "#111" }));
  return g;
}
function cone(x, y) { return svg("path", { d: `M${x - 7} ${y} L${x} ${y - 20} L${x + 7} ${y} Z`, fill: "#ff8a1f", stroke: "#b85d00", "stroke-width": 1 }); }
function medalha(x, y, cor, txt) {
  const g = svg("g");
  g.append(svg("path", { d: `M${x - 12} ${y - 44} L${x - 4} ${y - 14} M${x + 12} ${y - 44} L${x + 4} ${y - 14}`, stroke: "#5cc8ff", "stroke-width": 7 }),
    svg("circle", { cx: x, cy: y, r: 20, fill: cor, stroke: "rgba(0,0,0,.3)", "stroke-width": 2 }),
    svg("circle", { cx: x, cy: y, r: 14, fill: "none", stroke: "rgba(255,255,255,.5)", "stroke-width": 1.5 }));
  const t = svg("text", { x, y: y + 5, "text-anchor": "middle", "font-family": "Barlow Condensed, Arial Narrow, sans-serif", "font-weight": 800, "font-size": 14, fill: "#111" });
  t.textContent = txt;
  g.append(t);
  return g;
}
function gramado() { return svg("path", { d: "M0 176 H240 V200 H0 Z", fill: "#1f7a3b" }); }
function torcida(cor) {
  const g = svg("g", { opacity: 0.55 });
  for (let i = 0; i < 26; i++) g.append(svg("circle", { cx: 6 + i * 9.2, cy: 160 + (i % 2) * 6, r: 4.2, fill: cor || ["#ff7d95", "#5cc8ff", "#f2c230", "#e6edf3"][i % 4] }));
  return g;
}
function refletor(x, y) {
  const g = svg("g");
  g.append(svg("path", { d: `M${x} ${y + 10} L${x - 30} ${y + 110} L${x + 30} ${y + 110} Z`, fill: "rgba(255,255,255,.08)" }),
    svg("rect", { x: x - 14, y, width: 28, height: 12, rx: 2, fill: "#e6edf3" }),
    svg("path", { d: `M${x - 8} ${y + 4} h4 m4 0 h4 m4 0 h4`, stroke: "#9aa4b1", "stroke-width": 3 }));
  return g;
}
function camera(x, y) {
  const g = svg("g");
  g.append(svg("path", { d: `M${x} ${y + 12} L${x - 14} ${y + 56} M${x} ${y + 12} L${x + 14} ${y + 56} M${x} ${y + 12} V${y + 56}`, stroke: "#9aa4b1", "stroke-width": 3 }),
    svg("rect", { x: x - 20, y: y - 10, width: 34, height: 22, rx: 4, fill: "#2b3442", stroke: "#9aa4b1", "stroke-width": 1.5 }),
    svg("rect", { x: x + 14, y: y - 5, width: 12, height: 12, rx: 2, fill: "#111" }),
    svg("circle", { cx: x - 12, cy: y - 3, r: 3, fill: "#ff4d6d" }));
  return g;
}
function figurinha(x, y) {
  const g = svg("g", { transform: `rotate(10 ${x} ${y})` });
  g.append(svg("rect", { x: x - 18, y: y - 24, width: 36, height: 48, rx: 4, fill: "#f2c230", stroke: "#b88a00", "stroke-width": 1.5 }),
    svg("rect", { x: x - 13, y: y - 19, width: 26, height: 26, rx: 2, fill: "#1b3a8c" }),
    svg("rect", { x: x - 13, y: y + 11, width: 26, height: 4, rx: 1, fill: "#111", opacity: 0.6 }));
  return g;
}
function sinalizador(x, y, cor = "#ff4d6d") {
  const g = svg("g");
  g.append(svg("circle", { cx: x, cy: y - 36, r: 16, fill: cor, opacity: 0.35 }), svg("circle", { cx: x - 6, cy: y - 54, r: 11, fill: cor, opacity: 0.22 }),
    svg("rect", { x: x - 2, y: y - 22, width: 4, height: 22, fill: "#e6edf3" }), svg("circle", { cx: x, cy: y - 24, r: 5, fill: "#fff3b0" }));
  return g;
}
function aviao(x, y) {
  return svg("path", { d: `M${x - 30} ${y} L${x + 26} ${y - 6} Q${x + 34} ${y - 6} ${x + 30} ${y + 2} L${x - 26} ${y + 8} Z M${x - 4} ${y - 2} L${x + 6} ${y - 22} L${x + 12} ${y - 22} L${x + 8} ${y - 3} Z M${x - 6} ${y + 5} L${x + 2} ${y + 22} L${x + 8} ${y + 22} L${x + 6} ${y + 3} Z M${x - 28} ${y + 1} L${x - 34} ${y - 12} L${x - 28} ${y - 12} L${x - 20} ${y} Z`, fill: "#e6edf3", stroke: "#9aa4b1", "stroke-width": 1 });
}
function bandeira(x, y) {
  const g = svg("g", { transform: `rotate(-6 ${x} ${y})` });
  g.append(svg("rect", { x: x - 2, y: y - 6, width: 3, height: 110, fill: "#c9cfd8" }),
    svg("rect", { x, y, width: 58, height: 40, fill: "#009c3b" }),
    svg("path", { d: `M${x + 29} ${y + 4} L${x + 54} ${y + 20} L${x + 29} ${y + 36} L${x + 4} ${y + 20} Z`, fill: "#ffdf00" }),
    svg("circle", { cx: x + 29, cy: y + 20, r: 9, fill: "#002776" }));
  return g;
}
function taca(x, y, u) {
  // taca generica de ouro: bojo largo com alcas, haste torneada e base em degraus
  const ouro = `url(#${u}ouro)`;
  const g = svg("g", { class: "festa-brilho" });
  g.append(
    svg("path", { d: `M${x - 20} ${y - 30} C${x - 40} ${y - 32} ${x - 38} ${y - 6} ${x - 14} ${y - 6}`, fill: "none", stroke: ouro, "stroke-width": 5, "stroke-linecap": "round" }),
    svg("path", { d: `M${x + 20} ${y - 30} C${x + 40} ${y - 32} ${x + 38} ${y - 6} ${x + 14} ${y - 6}`, fill: "none", stroke: ouro, "stroke-width": 5, "stroke-linecap": "round" }),
    svg("path", { d: `M${x - 25} ${y - 42} H${x + 25} C${x + 25} ${y - 8} ${x + 12} ${y + 6} ${x} ${y + 8} C${x - 12} ${y + 6} ${x - 25} ${y - 8} ${x - 25} ${y - 42} Z`, fill: ouro, stroke: "#8a6400", "stroke-width": 1 }),
    svg("ellipse", { cx: x, cy: y - 42, rx: 25, ry: 4, fill: "#fff1a8", stroke: "#8a6400", "stroke-width": 1 }),
    svg("path", { d: `M${x - 13} ${y - 36} C${x - 14} ${y - 16} ${x - 8} ${y - 4} ${x - 3} ${y}`, fill: "none", stroke: "#fffbe6", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.8 }),
    svg("path", { d: `M${x - 4} ${y + 8} C${x - 4} ${y + 16} ${x - 8} ${y + 18} ${x - 8} ${y + 24} H${x + 8} C${x + 8} ${y + 18} ${x + 4} ${y + 16} ${x + 4} ${y + 8} Z`, fill: ouro }),
    svg("rect", { x: x - 15, y: y + 24, width: 30, height: 7, rx: 2, fill: ouro, stroke: "#8a6400", "stroke-width": 1 }),
    svg("rect", { x: x - 19, y: y + 31, width: 38, height: 11, rx: 2, fill: "#1b2330", stroke: "#b88a00", "stroke-width": 1.2 }),
    svg("rect", { x: x - 19, y: y + 35, width: 38, height: 2.5, fill: "#f2c230", opacity: 0.8 }),
  );
  return g;
}
function tacaPrata(x, y, u) {
  // taca generica de prata, alta e fina, com base escura e faixas douradas
  const prata = `url(#${u}prata)`;
  const g = svg("g", { class: "festa-brilho" });
  g.append(
    svg("path", { d: `M${x - 17} ${y - 34} C${x - 17} ${y - 10} ${x - 8} ${y - 2} ${x} ${y} C${x + 8} ${y - 2} ${x + 17} ${y - 10} ${x + 17} ${y - 34} Z`, fill: prata, stroke: "#5f6874", "stroke-width": 1 }),
    svg("ellipse", { cx: x, cy: y - 34, rx: 17, ry: 3.5, fill: "#ffffff", stroke: "#5f6874", "stroke-width": 1 }),
    svg("circle", { cx: x - 20, cy: y - 24, r: 4, fill: "none", stroke: prata, "stroke-width": 3 }),
    svg("circle", { cx: x + 20, cy: y - 24, r: 4, fill: "none", stroke: prata, "stroke-width": 3 }),
    svg("path", { d: `M${x - 3} ${y} H${x + 3} L${x + 4} ${y + 18} H${x - 4} Z`, fill: prata }),
    svg("path", { d: `M${x - 13} ${y + 18} H${x + 13} L${x + 15} ${y + 52} H${x - 15} Z`, fill: "#1b2330", stroke: "#5f6874", "stroke-width": 1 }),
    svg("path", { d: `M${x - 14} ${y + 26} H${x + 14} M${x - 14} ${y + 36} H${x + 14} M${x - 15} ${y + 46} H${x + 15}`, stroke: "#f2c230", "stroke-width": 1.5, opacity: 0.8 }),
  );
  return g;
}
function bolaDeOuro(x, y, u) {
  // bola dourada com gomos, num pedestal escuro em degraus
  const g = svg("g", { class: "festa-brilho" });
  const gomos = [];
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    gomos.push(`M${(x + 10 * Math.cos(a)).toFixed(1)} ${(y + 10 * Math.sin(a)).toFixed(1)} L${(x + 22 * Math.cos(a)).toFixed(1)} ${(y + 22 * Math.sin(a)).toFixed(1)}`);
  }
  const penta = [...Array(5)].map((_, i) => { const a = (Math.PI * 2 * i) / 5 - Math.PI / 2; return `${(x + 10 * Math.cos(a)).toFixed(1)} ${(y + 10 * Math.sin(a)).toFixed(1)}`; });
  g.append(
    svg("path", { d: `M${x - 16} ${y + 26} H${x + 16} L${x + 20} ${y + 36} H${x - 20} Z`, fill: "#2b3442", stroke: "#b88a00", "stroke-width": 1 }),
    svg("rect", { x: x - 24, y: y + 36, width: 48, height: 8, rx: 2, fill: "#1b2330", stroke: "#b88a00", "stroke-width": 1 }),
    svg("circle", { cx: x, cy: y, r: 28, fill: `url(#${u}bola)`, stroke: "#6b4700", "stroke-width": 1.5 }),
    svg("path", { d: `M${penta.join(" L")} Z`, fill: "none", stroke: "#7a5200", "stroke-width": 1.4 }),
    svg("path", { d: gomos.join(" "), stroke: "#7a5200", "stroke-width": 1.4 }),
    svg("path", { d: `M${x - 26} ${y + 6} Q${x} ${y + 30} ${x + 26} ${y + 6}`, fill: "none", stroke: "#7a5200", "stroke-width": 1.2, opacity: 0.7 }),
    svg("ellipse", { cx: x - 11, cy: y - 13, rx: 9, ry: 5, fill: "#fffbe6", opacity: 0.75, transform: `rotate(-35 ${x - 11} ${y - 13})` }),
  );
  return g;
}
function trono(g, u) {
  // sala do trono: colunas, tapete vermelho, trono dourado atras da camisa e bolas antigas no chao
  const ouro = `url(#${u}ouro)`;
  for (const x of [18, 222]) g.append(svg("rect", { x: x - 10, y: 0, width: 20, height: 176, fill: "#f4efe4", opacity: 0.9 }),
    svg("rect", { x: x - 13, y: 0, width: 26, height: 8, fill: "#e6d9b8" }), svg("rect", { x: x - 13, y: 168, width: 26, height: 8, fill: "#e6d9b8" }));
  g.append(svg("path", { d: "M0 176 H240 V200 H0 Z", fill: "#2a1a10" }), svg("path", { d: "M90 176 H150 L170 200 H70 Z", fill: "#a3162b" }));
  g.append(
    svg("path", { d: "M78 170 V52 Q120 -2 162 52 V170 Z", fill: ouro, stroke: "#8a6400", "stroke-width": 1.5 }),
    svg("path", { d: "M88 160 V58 Q120 14 152 58 V160 Z", fill: "#5a1020" }),
    svg("rect", { x: 70, y: 40, width: 10, height: 132, rx: 3, fill: ouro }), svg("rect", { x: 160, y: 40, width: 10, height: 132, rx: 3, fill: ouro }),
    svg("circle", { cx: 75, cy: 36, r: 7, fill: ouro }), svg("circle", { cx: 165, cy: 36, r: 7, fill: ouro }),
  );
  for (const [x, y, r] of [[40, 184, 9], [200, 186, 10], [222, 190, 7], [58, 192, 7]]) {
    g.append(svg("circle", { cx: x, cy: y, r, fill: "#8a5a2b", stroke: "#4a2e14", "stroke-width": 1 }),
      svg("path", { d: `M${x - r} ${y} H${x + r} M${x} ${y - r} V${y + r}`, stroke: "#4a2e14", "stroke-width": 0.8, opacity: 0.7 }));
  }
}

function cenaDaFesta(d) {
  const kit = kitDoDegrau(d);
  const numero = { G: 1, D: 4, M: 10, F: 9 }[Q.pos] || 9;
  const nome = (Q.nome || "Você").toUpperCase().slice(0, LIMITE_NOME);
  const uid = `festa${++cenaDaFesta.n}`;
  const raiz = svg("svg", { viewBox: "0 0 240 200", class: "festa-cena-svg", "aria-hidden": "true" });
  const ceu = { 16: ["#6b4a1a", "#1a1008"], 15: ["#3a2d6b", "#0d1117"], 14: ["#4a3a0c", "#0d1117"], 13: ["#0d6b33", "#0d1117"], 11: ["#5b7fb8", "#1b2a5c"] }[d]
    || (d === 12 ? ["#1d3170", "#070b1f"] : d >= 6 ? ["#17482c", "#0d1117"] : d === 1 ? ["#6f8fb0", "#2b3a48"] : ["#24401c", "#0d1117"]);
  const claro = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  raiz.append(svg("defs", {}, [
    svg("radialGradient", { id: `${uid}c`, cx: "50%", cy: "38%", r: "75%" }, [
      svg("stop", { offset: "0", "stop-color": ceu[0] }), svg("stop", { offset: "1", "stop-color": ceu[1] })]),
    svg("linearGradient", { id: `${uid}t`, x1: "0", y1: "0", x2: "1", y2: "1" }, [
      svg("stop", { offset: "0", "stop-color": claro(kit.base, 0.18) }), svg("stop", { offset: "1", "stop-color": kit.base })]),
    svg("path", { id: `${uid}a`, d: "M72 96 Q120 84 168 96" }),
    svg("linearGradient", { id: `${uid}ouro`, x1: "0", y1: "0", x2: "1", y2: "0" }, [
      svg("stop", { offset: "0", "stop-color": "#b88a00" }), svg("stop", { offset: ".3", "stop-color": "#fff1a8" }),
      svg("stop", { offset: ".55", "stop-color": "#f2c230" }), svg("stop", { offset: "1", "stop-color": "#8a6400" })]),
    svg("radialGradient", { id: `${uid}bola`, cx: "35%", cy: "30%", r: "75%" }, [
      svg("stop", { offset: "0", "stop-color": "#fff6cc" }), svg("stop", { offset: ".35", "stop-color": "#f2c230" }),
      svg("stop", { offset: ".8", "stop-color": "#b07a00" }), svg("stop", { offset: "1", "stop-color": "#6b4700" })]),
    svg("linearGradient", { id: `${uid}prata`, x1: "0", y1: "0", x2: "1", y2: "0" }, [
      svg("stop", { offset: "0", "stop-color": "#7d8794" }), svg("stop", { offset: ".35", "stop-color": "#ffffff" }),
      svg("stop", { offset: ".6", "stop-color": "#c9cfd8" }), svg("stop", { offset: "1", "stop-color": "#5f6874" })]),
  ]));
  raiz.append(svg("rect", { width: 240, height: 200, fill: `url(#${uid}c)` }));
  const raios = svg("g", { class: "festa-raios-svg", opacity: d === 16 ? 0.22 : 0.13 });
  for (let i = 0; i < 12; i++) raios.append(svg("path", { d: "M120 108 L110 -50 L130 -50 Z", fill: "#f2c230", transform: `rotate(${i * 30} 120 108)` }));
  raiz.append(raios);
  const cenario = svg("g", { class: "festa-props" });
  (PROPS_DA_FESTA[d] || (() => {}))(cenario, uid);
  raiz.append(cenario);
  for (let i = 0; i < 14; i++) {
    const x = 12 + ((i * 53) % 216), y = 8 + ((i * 37) % 70);
    raiz.append(svg("rect", { x, y, width: 5, height: 9, rx: 1, fill: ["#f2c230", "#c8ff00", "#ff7d95", "#5cc8ff", "#ffffff"][i % 5], class: "confete", style: `animation-delay:${(i % 6) * 0.13}s`, transform: `rotate(${(i * 47) % 180} ${x} ${y})` }));
  }
  // a camisa de costas
  const camisa = svg("g", { class: "festa-camisa" });
  camisa.append(
    svg("ellipse", { cx: 120, cy: 186, rx: 46, ry: 6, fill: "rgba(0,0,0,.28)" }),
    svg("path", { d: "M82 62 L102 52 Q120 60 138 52 L158 62 L186 86 L170 110 L156 100 L156 172 Q120 180 84 172 L84 100 L70 110 L54 86 Z", fill: `url(#${uid}t)`, stroke: "rgba(0,0,0,.35)", "stroke-width": 1.5, "stroke-linejoin": "round" }),
    svg("path", { d: "M102 52 Q120 62 138 52", fill: "none", stroke: kit.gola || kit.numero, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.9 }),
    svg("path", { d: "M60 94 L74 104 M180 94 L166 104", stroke: kit.numero, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.85 }),
  );
  // nome: cabe sempre na largura das costas (o texto encolhe, nunca passa da camisa)
  const tam = nome.length <= 6 ? 15 : nome.length <= 9 ? 13 : 11;
  const nomeTxt = svg("text", { "text-anchor": "middle", fill: kit.numero, "font-family": "Barlow Condensed, Arial Narrow, sans-serif", "font-weight": 800, "font-size": tam, "letter-spacing": nome.length > 9 ? "0.5" : "1.5" });
  const caminho = svg("textPath", { href: `#${uid}a`, startOffset: "50%" });
  // nome comprido encolhe pra caber entre os ombros (no maximo 68 de largura)
  const largura = nome.length * tam * 0.62 + (nome.length > 9 ? 0 : nome.length * 1.5);
  if (largura > 68) { caminho.setAttribute("textLength", "68"); caminho.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
  caminho.textContent = nome;
  nomeTxt.append(caminho);
  const num = svg("text", { x: 120, y: 136, "text-anchor": "middle", "dominant-baseline": "central", fill: kit.numero, stroke: "rgba(0,0,0,.22)", "stroke-width": 1.2, "paint-order": "stroke", "font-family": "Barlow Condensed, Arial Narrow, sans-serif", "font-weight": 800, "font-size": 44 });
  num.textContent = String(numero);
  camisa.append(nomeTxt, num);
  if (d === 16) camisa.append(svg("path", { d: "M98 44 L106 24 L115 38 L120 18 L125 38 L134 24 L142 44 Z", fill: "#f2c230", stroke: "#b88a00", "stroke-width": 2, "stroke-linejoin": "round" }));
  raiz.append(camisa);
  raiz.append(svg("image", { href: "img/dadao.svg", x: 2, y: 118, width: 56, height: 68, class: "festa-dadao" }));
  return raiz;
}

cenaDaFesta.n = 0;

function estrela(cx, cy, R, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, raio = i % 2 ? r : R;
    p.push(`${(cx + raio * Math.cos(a)).toFixed(1)} ${(cy + raio * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join(" L")} Z`;
}

// Acertou: a comemoracao vira a tela de carregamento. Mostra onde a carta chegou,
// a frase da resposta (a resenha, campo r), a curiosidade e uma barra de ~3 s; com frase,
// a espera cresce com o tamanho dela (ate 6 s) pra dar tempo de ler. Um toque pula a espera.
const ESPERA_ENTRE_PERGUNTAS = 3000;
const esperaDaFrase = (frase) => (frase ? Math.min(6000, Math.max(ESPERA_ENTRE_PERGUNTAS, 1800 + 40 * frase.length)) : ESPERA_ENTRE_PERGUNTAS);
function comemorar(d, { curiosidade = "", frase = "", duracao = esperaDaFrase(frase) } = {}) {
  const info = FESTA_DO_DEGRAU[d];
  if (!info) return Promise.resolve();
  document.querySelector(".festa-quiz-pop")?.remove();
  const pop = el("div", `festa-quiz-pop degrau-${d}${d >= 13 ? " grande" : ""}`);
  pop.setAttribute("role", "status");
  const caixa = el("div", "festa-quiz-caixa");
  const g = ESCADA_QUIZ[d];
  caixa.append(
    cenaDaFesta(d),
    el("p", "festa-quiz-acertou", "Você acertou!"),
    el("p", "festa-quiz-nivel", `${info[0]} · ${g.ovr}`),
    el("p", "festa-quiz-texto", info[1]),
  );
  if (frase) caixa.append(el("p", "festa-quiz-frase", frase));
  if (curiosidade) caixa.append(el("p", "festa-quiz-curiosidade", curiosidade));
  const barra = el("div", "festa-quiz-barra");
  barra.style.setProperty("--duracao", `${duracao}ms`);
  barra.append(el("i"));
  caixa.append(barra, el("p", "festa-quiz-dica", d === 16 ? "" : "Próxima pergunta chegando… (toque pra pular)"));
  pop.append(caixa);
  document.body.append(pop);
  return new Promise((ok) => {
    let feito = false;
    const fechar = () => {
      if (feito) return;
      feito = true;
      pop.classList.add("saindo");
      setTimeout(() => { pop.remove(); ok(); }, movimentoReduzido ? 0 : 200);
    };
    pop.addEventListener("click", fechar);
    setTimeout(fechar, duracao);
  });
}

// --- fim ----------------------------------------------------------------------

function terminar(como) {
  evento(`dadao/${como}-${Q.degrau}`);
  const d = Q.degrau;
  const g = ESCADA_QUIZ[d];
  const titulo = $("fim-titulo");
  const texto = $("fim-texto");
  const ultima = Q.historico[Q.historico.length - 1];
  $("tela-fim").dataset.como = como;
  if (como === "campeao") {
    titulo.textContent = "Prateleira Rei Pelé!";
    texto.textContent = "Acertou as 16. A carta chegou no topo da escada.";
  } else if (como === "parou") {
    titulo.textContent = `Parou na pergunta ${Q.numero}`;
    texto.textContent = d === 0 ? "Parou antes de acertar a primeira. Voltou pra pelada de rua." : `Levou a carta ${g.nome}, com ${g.ovr} de overall.`;
  } else {
    titulo.textContent = `Errou a pergunta ${Q.numero}`;
    const caiu = Q.numero === 16 ? "Na final, errar zera: a carta voltou pra pelada de rua." : `A carta caiu pra ${g.nome} (${g.ovr}).`;
    texto.textContent = `A certa era ${ultima.certa}. ${caiu}`;
  }
  // errou: a frase da resposta aparece aqui, na volta pra tela principal do jogo
  $("fim-frase").textContent = como === "errou" && ultima?.frase ? ultima.frase : "";
  const acertos = Q.historico.filter((h) => h.acertou).length;
  const recordeAntes = lerRecorde();
  guardarRecorde(d);
  $("fim-recorde").textContent = d > recordeAntes && recordeAntes > 0
    ? `Novo recorde! O anterior era ${ESCADA_QUIZ[recordeAntes].nome}.`
    : recordeAntes > d ? `Seu recorde: ${ESCADA_QUIZ[recordeAntes].nome} (${ESCADA_QUIZ[recordeAntes].ovr}).` : "";
  Q.textoCompartilhar = `Show do Dadão: minha carta chegou em ${g.nome} (${g.ovr}), com ${acertos} de 16 acertos. Tenta aí: ${location.origin}${location.pathname}`;
  $("compartilhar").textContent = "Compartilhar resultado";
  desenharCarta($("fim-carta"), d, { acertos });
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
  evento("dadao/inicio");
  Q.nome = ($("nome").value || "").trim().slice(0, LIMITE_NOME) || "Você";
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
  $("proxima").addEventListener("click", proxima);
  $("ajuda-cartas").addEventListener("click", ajudaCartas);
  $("ajuda-boys").addEventListener("click", ajudaGoldenBoys);
  $("ajuda-enciclopedia").addEventListener("click", ajudaEnciclopedia);
  $("ajuda-arquibancada").addEventListener("click", ajudaArquibancada);
  $("ajuda-pular").addEventListener("click", ajudaPular);
  $("parar").addEventListener("click", parar);
  $("parar-sim").addEventListener("click", () => terminar("parou"));
  $("parar-nao").addEventListener("click", () => mostrarAcao("acao-padrao"));
  $("compartilhar").addEventListener("click", async () => {
    const texto = Q.textoCompartilhar;
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      $("compartilhar").textContent = "Copiado!";
    } catch { /* cancelou */ }
  });
  $("de-novo").addEventListener("click", comecar);
  $("trocar").addEventListener("click", () => {
    mostrarTela("tela-inicio");
    atualizarPreviaInicio();
    const rec = lerRecorde();
    $("inicio-recorde").textContent = rec > 0 ? `Seu recorde: ${ESCADA_QUIZ[rec].nome} (${ESCADA_QUIZ[rec].ovr}).` : "";
  });
  // teclado: A-D escolhe, Enter confirma
  document.addEventListener("keydown", (e) => {
    const festa = document.querySelector(".festa-quiz-pop");
    if (festa && (e.key === "Enter" || e.key === " " || e.key === "Escape")) { e.preventDefault(); festa.click(); return; }
    if ($("tela-jogo").hidden || e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape" && Q.escolhida !== null && !Q.travado) return desistirDaEscolha();
    if (e.key === "Enter" && Q.escolhida !== null && !Q.travado && document.activeElement?.id !== "confirmar") { e.preventDefault(); return confirmar(); }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = LETRAS.indexOf(e.key.toUpperCase());
    if (i >= 0) escolher(i);
  });
  atualizarPreviaInicio();
  const rec = lerRecorde();
  if (rec > 0) $("inicio-recorde").textContent = `Seu recorde: ${ESCADA_QUIZ[rec].nome} (${ESCADA_QUIZ[rec].ovr}).`;
}

iniciarQuiz();
