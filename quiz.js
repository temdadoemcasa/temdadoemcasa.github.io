// Show do Dadão: quiz de futebol no formato do programa de TV.
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
  const p = sortearPergunta(nv);
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
  $("pergunta-nivel").textContent = Q.numero === 16 ? "Vale a carta Nível Pelé" : "";
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
  mostrarAcao("confirmar-caixa");
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
  $("confirmar-texto").textContent = "Valendo...";
  for (const b of document.querySelectorAll("#confirmar-caixa button")) b.disabled = true;
  desenharAjudas();
  const botoes = [...document.querySelectorAll("#alternativas .alternativa")];
  for (const b of botoes) b.disabled = true;
  const marcada = botoes[Q.escolhida];
  marcada.classList.add("suspense");
  await espera(movimentoReduzido ? 0 : 1100);
  for (const b of document.querySelectorAll("#confirmar-caixa button")) b.disabled = false;
  marcada.classList.remove("suspense");
  const certa = Q.opcoes.findIndex((o) => o.certa);
  const acertou = Q.escolhida === certa;
  botoes[certa].classList.add("certa");
  if (!acertou) marcada.classList.add("errada");
  Q.historico.push({ numero: Q.numero, q: Q.pergunta.q, certa: Q.pergunta.a, marcada: Q.opcoes[Q.escolhida].texto, acertou });

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
    await espera(movimentoReduzido ? 0 : 900);
    return terminar("campeao");
  }
  retorno.classList.remove("errou");
  delete $("proxima").dataset.fim;
  desenharCarta($("retorno-carta"), Q.degrau);
  $("retorno-texto").textContent = Q.pergunta.x ? `Certa! ${Q.pergunta.x}` : "Certa!";
  $("retorno-subiu").textContent = `Sua carta subiu pra ${ESCADA_QUIZ[Q.degrau].nome} (${ESCADA_QUIZ[Q.degrau].ovr}).`;
  $("proxima").textContent = Q.numero === 15 ? "Ir pra pergunta final" : "Próxima pergunta";
  mostrarAcao("retorno");
  $("proxima").focus({ preventScroll: true });
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
  const g = ESCADA_QUIZ[Q.degrau];
  $("parar-texto").textContent = Q.degrau === 0
    ? "Parar agora? Você ainda não acertou nenhuma e sai com a carta da pelada de rua."
    : `Parar agora e levar a carta ${g.nome} (${g.ovr})?`;
  mostrarAcao("parar-caixa");
  $("parar-sim").focus({ preventScroll: true });
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
    texto.textContent = `A certa era ${ultima.certa}. ${caiu}`;
  }
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
    if ($("tela-jogo").hidden || e.target instanceof HTMLInputElement) return;
    if (e.key === "Escape" && $("confirmar-caixa").classList.contains("ativa") && !Q.travado) return desistirDaEscolha();
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = LETRAS.indexOf(e.key.toUpperCase());
    if (i >= 0) escolher(i);
  });
  const total = Q.banco.f.length + Q.banco.m.length + Q.banco.d.length + Q.banco.p.length;
  $("total-perguntas").textContent = String(total);
  atualizarPreviaInicio();
  const rec = lerRecorde();
  if (rec > 0) $("inicio-recorde").textContent = `Seu recorde: ${ESCADA_QUIZ[rec].nome} (${ESCADA_QUIZ[rec].ovr}).`;
}

iniciarQuiz();
