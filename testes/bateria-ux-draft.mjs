// Bateria de UX do Tem Time em Casa (draft + temporada), com cliques de verdade.
//
//   python3 -m http.server 8766 &            (na raiz do repo)
//   node testes/bateria-ux-draft.mjs         (100 casos: o padrao do CI, cabe nos 8 min do rodar.mjs)
//   CASOS=4000 node testes/bateria-ux-draft.mjs   (a bateria cheia, ~1 h)
//   CASOS=50 SEMENTE=1234 node testes/bateria-ux-draft.mjs   (reproduz a partir da semente 1234)
//   SO=1234 node testes/bateria-ux-draft.mjs  (roda so o caso da semente 1234, com o mesmo contexto)
//
// Cada caso tem semente propria (Math.random da pagina vira um gerador com essa
// semente no inicio do caso) e sorteia: politica de draft (aleatoria, otima,
// pessima, mexe de vaga, troca o leque, toque duplo, teclado, desiste no meio),
// time (nome vazio/longo/com HTML, esquema, camisa, copa, dificuldade, desafio do
// dia) e politica de temporada (simular tudo, jogo a jogo, calendario, decisivo,
// janela, esquema e postura no meio, recarregar no meio). Um caso em ~16 abre
// contexto novo com viewport de 360x640 a 1440x900, toque ou mouse, movimento
// reduzido ou nao, tema claro/escuro e localStorage velho ou corrompido. Ate 2
// paginas ao mesmo tempo (WORKERS=1 pra uma so), um chromium so.
//
// Imprime "OK  <invariante> (n checagens)" por invariante agregada e "FALHA" com
// ate 3 exemplos reproduziveis (semente + passo). O resumo vai pra
// testes/resultados/bateria-ux-draft.txt.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8766';
const CASOS = Number(process.env.CASOS || 100);
const SEMENTE0 = Number(process.env.SEMENTE || 1);
const SO = process.env.SO ? Number(process.env.SO) : null;
const WORKERS = Math.max(1, Math.min(2, Number(process.env.WORKERS || 2)));
const POR_CONTEXTO = Number(process.env.POR_CONTEXTO || 16);
const LIMITE_CASO_MS = 90000;

// --- sorteio do lado do teste (mesma semente -> mesmo caso) -----------------------------
function rngDe(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const escolha = (rng, lista) => lista[Math.floor(rng() * lista.length)];
const pesado = (rng, pesos) => { const tot = Object.values(pesos).reduce((a, b) => a + b, 0); let x = rng() * tot; for (const [k, v] of Object.entries(pesos)) { x -= v; if (x <= 0) return k; } return Object.keys(pesos)[0]; };

const VIEWPORTS = [[360, 640], [360, 740], [375, 667], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800], [1366, 768], [1440, 900]];
const ESQUEMAS = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-4-1', '3-5-2', '3-4-3', '5-3-2', '3-4-2-1'];
const NOMES = ['Tem Dado FC', '', '   ', 'Bagre Futebol Clube XYZW', '<b>Resenha</b>', 'Fortaleza', 'Vasco da Gama', 'Ñandu ⚽ União', 'A', 'Esporte Clube Bateu Ponto'];
const LS_ESTRANHO = [null, 'claro', 'escuro', '{"quebrado":', 'undefined', '0', '\u0000lixo'];

// --- placar das invariantes ------------------------------------------------------------
const placar = new Map();
let casosFeitos = 0, casosComFalha = 0;
const conta = (inv) => { if (!placar.has(inv)) placar.set(inv, { ok: 0, falha: 0, ex: [] }); return placar.get(inv); };

// --- o que roda dentro da pagina -------------------------------------------------------
const INIT = () => {
  window.__erros = [];
  addEventListener('error', (e) => window.__erros.push(`error: ${e.message}`));
  addEventListener('unhandledrejection', (e) => window.__erros.push(`promessa rejeitada: ${(e.reason && e.reason.message) || e.reason}`));
  const ce = console.error.bind(console);
  console.error = (...a) => { window.__erros.push(`console.error: ${a.map(String).join(' ')}`); ce(...a); };
  window.__copiado = null;
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copiado = t; } } }); } catch { /* sem clipboard */ }
  window.__semear = (s) => {
    let a = s >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  // auditoria da tela visivel: texto podre, vazamento, alvos de toque, campos, nomes acessiveis
  window.__auditar = () => {
    const vw = document.documentElement.clientWidth;
    const visivel = (e) => { const s = getComputedStyle(e); const q = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && q.width > 0 && q.height > 0 && !e.closest('[hidden]'); };
    const nome = (e) => (e.id ? `#${e.id}` : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/)[0]}` : '')) + (e.textContent ? ` "${e.textContent.trim().slice(0, 30)}"` : '');
    const main = document.querySelector('main');
    const texto = main.innerText;
    const podre = (texto.match(/\b(undefined|null|NaN)\b|\[object|Infinity|−?-Infinity/g) || []);
    // numero negativo absurdo (pontos, jogos, gols): "-12 pts", "−3 jogos"
    const negativo = (texto.match(/[-−]\d+\s*(pts|jogos|gols)\b/g) || []);
    // nome que devia estar la e veio vazio
    const vazios = [...main.querySelectorAll('.vaga-cheia .vaga-nome, .opcao-clube, .placar-nome, .tabela-time > span:last-child, .bl-nome, .feed-rival, .pd-titulo, .resumo-nome, .jogo-etapa, .status-item strong')]
      .filter(visivel).filter((e) => !e.textContent.trim()).map(nome);
    // ausencia nunca vira zero: nota de carta 0 ou vazia
    const notaZero = [...main.querySelectorAll('.vaga-nota')].filter(visivel).filter((e) => !/^[1-9]\d$/.test(e.textContent.trim())).map((e) => e.textContent);
    const dentroDeRolagem = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
    const vaza = [...document.querySelectorAll('main *, .abas-mobile')].filter((e) => visivel(e) && !dentroDeRolagem(e) && e.getBoundingClientRect().right > vw + 1).map(nome).slice(0, 3);
    const rolaDeLado = document.scrollingElement.scrollWidth > vw + 1;
    const campos = [...document.querySelectorAll('main input:not([type=color]), main select, main textarea')].filter(visivel).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map(nome);
    const alvos = [...document.querySelectorAll('main button, main [role=button], main select, main input, .abas-mobile button')].filter(visivel).filter((e) => !e.disabled);
    const medir = (e) => { const q = e.getBoundingClientRect(); return Math.min(q.width, q.height); };
    const minusculos = alvos.filter((e) => medir(e) < 24).map((e) => `${nome(e)} ${Math.round(medir(e))}px`).slice(0, 3);
    const semNome = alvos.filter((e) => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button')
      .filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.title)).map(nome).slice(0, 3);
    const tela = [...document.querySelectorAll('section.tela')].find((s) => !s.hidden);
    const primario = tela ? [...tela.querySelectorAll('.botao-primario')].filter(visivel) : [];
    const primarioPequeno = primario.filter((e) => medir(e) < 40).map((e) => `${nome(e)} ${Math.round(medir(e))}px`);
    return { tela: tela && tela.id, podre: [...new Set(podre)], negativo, vazios, notaZero, vaza, rolaDeLado, campos, minusculos, semNome, primarioPequeno, nPrimario: primario.length };
  };
  // estado do jogo de forma compacta (pra conferir a tela com o que aconteceu)
  window.__estado = () => {
    const t = D.temp;
    const base = { vaga: D.vaga, movendo: D.movendo ?? null, animando: D.animando, simulando: Boolean(D.simulando), trocas: D.trocas };
    if (!t) return base;
    const meus = t.historico.filter((h) => h.doUsuario);
    return { ...base, i: t.i, n: t.etapas.length, terminou: Motor.terminou(t), meus: meus.length, cartao: D.cartao ? D.cartao.tipo : null };
  };
};

// --- um caso -------------------------------------------------------------------------
class Falha extends Error {}

async function caso(p, semente, cfg, registro) {
  const rng = rngDe(semente * 7919 + 13);
  let passo = 0, ondeEstou = 'inicio';
  const confere = (inv, cond, detalhe = '') => {
    const c = conta(inv);
    if (cond) { c.ok++; return true; }
    c.falha++;
    if (c.ex.length < 3) c.ex.push(`semente ${semente} passo ${passo} (${ondeEstou})${detalhe ? `: ${String(detalhe).slice(0, 300)}` : ''} [${cfg.rotulo}]`);
    registro.falhou = true;
    return false;
  };
  const tMarca = Date.now();
  const marcar = (o) => { passo++; ondeEstou = o; if (process.env.TEMPOS) console.error(`  [${semente}] ${Date.now() - tMarca} ms ${o}`); };
  const auditar = async (onde) => {
    const t0 = Date.now();
    const a = await p.evaluate(() => window.__auditar());
    if (process.env.TEMPOS) console.error(`  [${semente}] auditar ${onde}: ${Date.now() - t0} ms`);
    confere('texto sem undefined/null/NaN/[object/Infinity', !a.podre.length, `${onde}: ${a.podre.join(', ')}`);
    confere('sem numero negativo absurdo', !a.negativo.length, `${onde}: ${a.negativo.join(', ')}`);
    confere('nome/numero que devia estar la nao vem vazio', !a.vazios.length, `${onde}: ${a.vazios.join(', ')}`);
    confere('nota de carta nunca 0 nem vazia (ausencia nao vira zero)', !a.notaZero.length, `${onde}: ${a.notaZero.join(', ')}`);
    confere('nada vaza pro lado', !a.rolaDeLado && !a.vaza.length, `${onde} ${cfg.vp}: ${a.vaza.join(', ') || 'pagina rola na horizontal'}`);
    if (cfg.toque) confere('campo de texto com letra >= 16px (toque: senao o iPhone/iPad da zoom)', !a.campos.length, `${onde} ${cfg.vp}: ${a.campos.join(', ')}`);
    confere('alvo de toque >= 24px', !a.minusculos.length, `${onde} ${cfg.vp}: ${a.minusculos.join(', ')}`);
    confere('botao com nome acessivel', !a.semNome.length, `${onde}: ${a.semNome.join(', ')}`);
    confere('botao principal da tela >= 40px', !a.primarioPequeno.length, `${onde} ${cfg.vp}: ${a.primarioPequeno.join(', ')}`);
    return a;
  };
  const erros = async (onde) => {
    const e = await p.evaluate(() => window.__erros.splice(0));
    confere('nenhum erro de JS / promessa rejeitada / console.error', !e.length, `${onde}: ${e.join(' | ')}`);
  };
  const ocioso = async (ms = 30000) => {
    const ok = await p.waitForFunction(() => !D.animando && !D.simulando, null, { timeout: ms }).then(() => true, () => false);
    confere('nenhum travamento (animacao/simulacao termina)', ok, `ficou animando/simulando ${ms} ms`);
    if (!ok) throw new Falha('travou');
  };
  const impressao = () => p.evaluate(() => { const m = document.querySelector('main'); return m.innerText.length + '|' + m.innerText.slice(0, 4000) + '|' + [...m.querySelectorAll('[aria-pressed=true],[aria-selected=true],.vaga-ativa,.vaga-movendo,.vaga-destino')].length + '|' + window.scrollY; });
  const st = () => p.evaluate(() => window.__estado());
  // toque de gente: rola ate o botao (sem animacao: o site rola suave e o Playwright
  // clicaria no meio da rolagem, onde o botao ja nao esta), espera parar e toca
  const clicar = async (alvo, opcoes = {}) => {
    const loc = typeof alvo === 'string' ? p.locator(alvo) : alvo;
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await parado();
    await loc.click(opcoes);
  };
  // (parado) espera a rolagem suave parar (gente nao acerta botao que esta passando embaixo do dedo)
  const parado = () => p.evaluate(() => new Promise((ok) => { let y = scrollY, n = 0, t = 0; const f = () => { if (scrollY === y) { if (++n > 1) return ok(); } else { n = 0; y = scrollY; } if (++t > 90) return ok(); requestAnimationFrame(f); }; requestAnimationFrame(f); }));

  await p.evaluate((s) => window.__semear(s), semente);
  await p.evaluate(() => window.__erros.splice(0));

  // ---- 1. seu clube
  marcar('clube');
  const a0 = await auditar('tela do clube');
  confere('jogo abre na tela do clube', a0.tela === 'tela-clube', a0.tela);
  const salvo = await p.evaluate(() => { try { return localStorage.getItem('tem-time-temporada'); } catch { return null; } });
  const temRetomar = await p.locator('#retomar-temporada').count();
  const salvoBom = (() => { try { const x = JSON.parse(salvo); return x.v === 1 && Number.isInteger(x.semente) && Number.isInteger(x.i) && x.i > 0 && x.elenco0.onze.length === 11; } catch { return false; } })();
  confere('temporada salva corrompida/velha nunca vira botao de retomar', !temRetomar || salvoBom, `salvo=${String(salvo).slice(0, 80)}`);
  const recordesAntes = await p.evaluate(() => { try { const r = JSON.parse(localStorage.getItem('tem-time-recordes')); return r && r.v === 1 && Number.isInteger(r.temporadas) && r.temporadas > 0 && r.melhor && r.melhor.texto ? r.temporadas : 0; } catch { return 0; } });
  const notaRecorde = await p.locator('#recorde-nota').count();
  confere('recorde no clube so aparece se tem recorde valido (ausencia nao vira "0 temporadas")', Boolean(notaRecorde) === recordesAntes > 0, `nota ${notaRecorde}, temporadas ${recordesAntes}`);
  const nome = escolha(rng, NOMES);
  await p.fill('#nome-time', nome);
  const esquema = escolha(rng, ESQUEMAS);
  await p.selectOption('#esquema', esquema);
  const efeito = (await p.textContent('#esquema-efeito')).trim();
  confere('esquema explica o efeito na hora', /^Ataque .* · Defesa .* · .{10,}/.test(efeito), efeito);
  await p.locator('#padroes .chip').nth(Math.floor(rng() * 5)).click();
  await p.locator('#cor1').fill(escolha(rng, ['#c8ff00', '#ff0000', '#003399', '#ffffff', '#000000']));
  await p.locator('#cor2').fill(escolha(rng, ['#111111', '#ffffff', '#ffcc00']));
  const continental = rng() < 0.5 ? 'lib' : 'sul';
  await clicar(`#continental .chip[data-valor=${continental}]`);
  const desafio = rng() < 0.2;
  const dif = escolha(rng, ['Fácil', 'Normal', 'Difícil']);
  const desafioLigado = async () => (await p.getAttribute('#desafio-dia', 'aria-pressed')) === 'true';
  if (await desafioLigado()) await clicar('#desafio-dia');
  await clicar(p.locator('#dificuldade .chip', { hasText: dif }));
  if (desafio) await clicar('#desafio-dia');
  if (desafio) {
    confere('desafio do dia trava a dificuldade no Normal', await p.evaluate(() => D.dificuldade === 'normal' && [...document.querySelectorAll('#dificuldade .chip')].filter((b) => b.disabled).length === 2));
    confere('desafio explica a regra', /mesma temporada pra todo mundo/.test(await p.textContent('#desafio-nota')));
  }
  await auditar('clube preenchido');
  marcar('montar meu time');
  await clicar('#comecar-draft');
  const nomeFinal = nome.slice(0, 24).trim() || 'Tem Dado FC'; // o campo corta em 24
  confere('nome do time vazio vira o padrao, nome preenchido e mantido', await p.evaluate((n) => D.nome === n, nomeFinal), nome);

  // ---- 2. draft
  const politica = cfg.politicaDraft;
  const desistirEm = politica === 'desiste' ? 1 + Math.floor(rng() * 14) : -1;
  let escolhas = 0, toques = 0, ultimaTela = null;
  const lequesVistos = new Map();
  if (desafio && registro.primeiroLeque && registro.primeiroLeque[esquema]) {
    const l = await p.evaluate(() => D.leques[D.vaga].map((j) => j.player_id).join(','));
    confere('desafio do dia: mesmo 1o leque pra todo mundo no mesmo esquema', l === registro.primeiroLeque[esquema], `${l} != ${registro.primeiroLeque[esquema]}`);
  } else if (desafio) {
    registro.primeiroLeque = registro.primeiroLeque || {};
    registro.primeiroLeque[esquema] = await p.evaluate(() => D.leques[D.vaga].map((j) => j.player_id).join(','));
  }
  while (await p.locator('#tela-draft').isVisible()) {
    if (++toques > 80) { confere('draft sempre termina (16 escolhas)', false, `${escolhas} escolhas em 80 toques`); throw new Falha('draft nao termina'); }
    if (escolhas === desistirEm) {
      marcar('desistiu no meio do draft: recarrega');
      await p.reload(); await p.waitForFunction(() => D.r && document.querySelector('#padroes .chip'));
      const a = await auditar('recarregou no draft');
      confere('recarregar no meio do draft volta limpo pra tela do clube', a.tela === 'tela-clube' && await p.evaluate(() => !D.temp && D.onze.length === 0), a.tela);
      await erros('recarga no draft');
      return 'desistiu';
    }
    // uma ida a pagina so: estado, leque e a conferencia dele
    const { s0, leque, nCartas, semRepetir } = await p.evaluate(() => {
      const slot = [...D.onze, ...D.banco][D.vaga];
      const no = new Set([...D.onze, ...D.banco].map((x) => x.jogador).filter(Boolean));
      return {
        s0: window.__estado(), nCartas: document.querySelectorAll('#leque .opcao').length, semRepetir: D.leques[D.vaga].every((j) => !no.has(j)),
        leque: D.leques[D.vaga].map((j, i) => ({ i, id: j.player_id, ovr: j.overall, enc: encaixeNaVaga(j, slot.pos), val: valorNaVaga(j, slot.pos) })),
      };
    });
    confere('leque mostra as cartas da vaga (1 a 5, sem repetir quem ja esta no time)', nCartas === leque.length && nCartas >= 1 && nCartas <= 5 && semRepetir, `${nCartas} cartas`);
    if (!lequesVistos.has(s0.vaga)) lequesVistos.set(s0.vaga, new Set(leque.map((x) => x.id)));
    const r = rng();
    // acoes que nao sao escolher: mexer de vaga, tocar outra vaga vazia, trocar o leque
    if ((politica === 'mexe' && r < 0.45) || (politica !== 'mexe' && r < 0.06)) {
      ultimaTela = null;
      const cheias = await p.locator('#gramado .vaga.vaga-cheia').count();
      if (cheias && rng() < 0.7) {
        marcar('toca jogador pra mudar de posicao');
        const k = Math.floor(rng() * cheias);
        const antes = await impressao();
        const idxVaga = await p.locator('#gramado .vaga.vaga-cheia').nth(k).evaluate((b) => [...b.parentElement.children].indexOf(b));
        await clicar(p.locator('#gramado .vaga.vaga-cheia').nth(k));
        confere('toque no jogador da resposta na tela (aviso ou vagas marcadas)', (await impressao()) !== antes || await p.locator('#draft-aviso').isVisible());
        const destinos = await p.locator('#gramado .vaga.vaga-destino').count();
        const aviso = (await p.textContent('#draft-aviso')).trim();
        confere('mudar de posicao: ou marca destinos ou explica por que nao da', destinos > 0 ? /Pra onde vai/.test(aviso) : /não joga em nenhuma outra vaga/.test(aviso), aviso);
        if (destinos) {
          if (rng() < 0.2) {
            marcar('cancela o movimento tocando nele de novo');
            await clicar(p.locator('#gramado .vaga').nth(idxVaga));
            confere('cancelar movimento limpa as marcas', (await p.locator('#gramado .vaga-destino').count()) === 0 && (await st()).movendo == null);
          } else {
            marcar('leva o jogador pro destino');
            const alvoIdx = await p.locator('#gramado .vaga.vaga-destino').nth(Math.floor(rng() * destinos)).evaluate((b) => [...b.parentElement.children].indexOf(b));
            const quem = await p.evaluate((k) => D.onze[k].jogador.player_id, idxVaga);
            const lequeAntes = await p.evaluate((k) => (D.leques[k] || []).map((j) => j.player_id), idxVaga);
            await clicar(p.locator('#gramado .vaga').nth(alvoIdx));
            const depois = await p.evaluate(([de, para]) => ({ chegou: D.onze[para].jogador && D.onze[para].jogador.player_id, ficou: D.onze[de].jogador && D.onze[de].jogador.player_id, vaga: D.vaga, leque: (D.leques[de] || []).map((j) => j.player_id) }), [idxVaga, alvoIdx]);
            confere('mover jogador: ele aparece na vaga de destino', depois.chegou === quem, JSON.stringify(depois));
            if (!depois.ficou && lequeAntes.length) confere('vaga que esvazia volta com o leque dela (sem sorteio novo)', depois.leque.every((id) => lequeAntes.includes(id)), `${depois.leque} vs ${lequeAntes}`);
          }
        }
      } else if (rng() < 0.5) {
        const vazias = await p.locator('#gramado .vaga:not(.vaga-cheia), .banco-clicavel').count();
        if (vazias) {
          marcar('toca outra vaga vazia');
          await clicar(p.locator('#gramado .vaga:not(.vaga-cheia), .banco-clicavel').nth(Math.floor(rng() * vazias)));
          const s1 = await st();
          confere('tocar vaga vazia abre o leque dela', await p.evaluate(() => !([...D.onze, ...D.banco][D.vaga].jogador) && document.querySelectorAll('#leque .opcao').length > 0), JSON.stringify(s1));
        }
      } else if (await p.locator('#trocar-leque').isEnabled()) {
        marcar('troca o leque');
        const antes = leque.map((x) => x.id).join(',');
        const trocas = s0.trocas;
        await clicar('#trocar-leque');
        const s1 = await st();
        const depois = await p.evaluate(() => D.leques[D.vaga].map((j) => j.player_id).join(','));
        confere('trocar o leque gasta 1 troca e mostra cartas', s1.trocas === trocas - 1 && depois.length > 0, `${trocas}->${s1.trocas}`);
        confere('botao de trocar o leque diz quantas sobram', new RegExp(s1.trocas > 0 ? `\\(${s1.trocas} ` : 'Sem trocas').test(await p.textContent('#trocar-leque')));
        void antes;
      }
      continue;
    }
    // escolher uma carta
    let i;
    if (politica === 'otima') i = leque.reduce((m, x) => (x.val > leque[m].val ? x.i : m), 0);
    else if (politica === 'pessima') i = leque.reduce((m, x) => (x.val < leque[m].val ? x.i : m), 0);
    else if (politica === 'maiorNota') i = leque.reduce((m, x) => (x.ovr > leque[m].ovr ? x.i : m), 0);
    else i = Math.floor(rng() * leque.length);
    marcar(`escolhe carta ${i + 1} (${politica})`);
    const vagaAntes = s0.vaga;
    // a tela de antes: a do fim da escolha anterior (se nada mexeu desde entao)
    if (!ultimaTela) await parado();
    const antes = ultimaTela || await impressao();
    ultimaTela = null;
    if (politica === 'teclado') {
      // foco por teclado de verdade (Tab), senao o navegador nao mostra o :focus-visible
      await p.locator('#leque .opcao').nth(i).focus();
      await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
      const foco = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return e.classList.contains('opcao') && (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none'); });
      confere('foco visivel na carta (teclado)', foco);
      await p.keyboard.press(rng() < 0.5 ? 'Enter' : 'Space');
    } else if (politica === 'duplo') {
      await p.locator('#leque .opcao').nth(i).dblclick({ delay: 30 });
    } else if (cfg.toque && rng() < 0.5) {
      await p.locator('#leque .opcao').nth(i).tap();
    } else {
      // jogador apressado: toca a carta enquanto ela ainda esta revelando (o botao nao se mexe)
      await p.locator('#leque .opcao').nth(i).click({ force: !cfg.reduzido && rng() < 0.6 });
    }
    escolhas++;
    const id = leque[i].id;
    // depois do toque, numa ida so: entrou?, quantas vagas cheias, a tela mudou?; e
    // o "tempo de ver" a carta (a trava de toque duplo de 350 ms ja passou)
    const depois = await p.evaluate(([k, id]) => {
      const todas = [...D.onze, ...D.banco];
      const m = document.querySelector('main');
      const r = { entrou: todas[k].jogador?.player_id === id, quantas: todas.filter((x) => x.jogador).length,
        tela: m.innerText.length + '|' + m.innerText.slice(0, 4000) + '|' + [...m.querySelectorAll('[aria-pressed=true],[aria-selected=true],.vaga-ativa,.vaga-movendo,.vaga-destino')].length + '|' + window.scrollY };
      travaEscolhaAte = 0;
      return r;
    }, [vagaAntes, id]);
    confere('escolher carta: o jogador entra na vaga certa', depois.entrou, `vaga ${vagaAntes}`);
    if (politica === 'duplo') confere('toque duplo nao escolhe duas cartas', depois.quantas === escolhas, `${depois.quantas} vagas cheias com ${escolhas} escolhas`);
    confere('feedback imediato a cada escolha', depois.tela !== antes);
    ultimaTela = depois.tela;
    if (rng() < 0.12) { await auditar(`draft (escolha ${escolhas})`); }
  }

  // ---- 3. resumo
  marcar('resumo');
  const resumoOk = await p.locator('#tela-resumo').isVisible();
  confere('draft completo leva ao resumo do time', resumoOk);
  if (!resumoOk) throw new Falha('sem resumo');
  const elenco = await p.evaluate(() => ({ n: [...D.onze, ...D.banco].filter((s) => s.jogador).length, unicos: new Set([...D.onze, ...D.banco].map((s) => s.jogador && s.jogador.player_id)).size }));
  confere('elenco com 16 jogadores diferentes', elenco.n === 16 && elenco.unicos === 16, JSON.stringify(elenco));
  const res = await p.evaluate(() => {
    const dd = [...document.querySelectorAll('.resumo-numeros dd')].map((d) => d.textContent);
    return { dd, frase: document.querySelector('.resumo-frase').textContent, nome: document.querySelector('.resumo-nome').textContent };
  });
  const media = Number(res.dd[0]);
  confere('resumo: media das cartas plausivel (40-99)', media >= 40 && media <= 99, res.dd.join(','));
  confere('resumo: forcas numericas', res.dd.slice(1).every((x) => /^\d+$/.test(x)), res.dd.join(','));
  const posPapel = Number((res.frase.match(/o (\d+)º/) || [])[1]);
  confere('resumo: posicao no papel entre 1 e 20', posPapel >= 1 && posPapel <= 20, res.frase);
  confere('resumo: nome do time na tela e o digitado', res.nome === nomeFinal, `${res.nome} != ${nomeFinal}`);
  await auditar('resumo');
  if (rng() < 0.25) {
    marcar('troca o esquema no resumo');
    const novo = escolha(rng, ESQUEMAS);
    const antes = await p.evaluate(() => [...D.onze, ...D.banco].map((s) => s.jogador.player_id).sort().join());
    await p.selectOption('.resumo-info .seletor-esquema select', novo);
    const depois = await p.evaluate(() => [...D.onze, ...D.banco].map((s) => s.jogador && s.jogador.player_id).sort().join());
    confere('trocar esquema no resumo nao perde nem duplica jogador', antes === depois);
    confere('trocar esquema no resumo redesenha no esquema novo', await p.evaluate((n) => D.esquema === n && document.querySelector('.resumo-info').textContent.includes(n), novo));
  }
  if (cfg.esperarChances) {
    marcar('espera as chances');
    const ok = await p.waitForFunction(() => /Em \d+ temporadas simuladas: G6 \d+% · Z4 \d+% · campeão brasileiro \d+% · algum título \d+%/.test(document.querySelector('.resumo-chances').textContent), null, { timeout: 30000 }).then(() => true, () => false);
    confere('resumo: chances aparecem (G6/Z4/titulo em %)', ok, await p.textContent('.resumo-chances'));
  }
  // chances que ainda estao calculando nao podem continuar gastando o celular depois que a temporada comeca
  await p.evaluate(() => {
    window.__rapidas = 0;
    if (!window.__rapidaOrig) window.__rapidaOrig = simularTemporadaRapida;
    simularTemporadaRapida = (...a) => { window.__rapidas++; return window.__rapidaOrig(...a); };
  });
  marcar('comecar a temporada');
  await clicar('#comecar-temporada');
  const r0 = await p.evaluate(() => window.__rapidas);
  await p.waitForTimeout(250);
  const r1 = await p.evaluate(() => window.__rapidas);
  confere('chances do resumo param de calcular quando a temporada comeca', r1 - r0 <= 1, `${r1 - r0} temporadas rapidas depois do clique`);

  // ---- 4. temporada
  const t0 = await p.evaluate(() => ({ jogo: document.getElementById('jogo').innerText, status: document.getElementById('status').innerText, grupo: D.grupo }));
  confere('temporada abre com o sorteio do grupo explicado', /Sorteio: .* cai no grupo [A-H] da (Libertadores|Sul-Americana)/.test(t0.jogo), t0.jogo.slice(0, 200));
  await auditar('inicio da temporada');
  const politicaTemp = cfg.politicaTemp;
  const nAcoes = politicaTemp === 'tudo' ? 0 : politicaTemp === 'longa' ? 10 + Math.floor(rng() * 15) : Math.floor(rng() * 10);
  const mobile = await p.evaluate(() => matchMedia('(max-width: 760px)').matches);
  const irPraJogo = async () => {
    if (mobile) { const b = p.locator('.abas-mobile .aba-mobile', { hasText: 'Jogo' }); if (await b.isVisible()) await clicar(b); }
    if (await p.locator('#aba-jogo').isVisible() && (await p.getAttribute('#aba-jogo', 'aria-selected')) !== 'true') await clicar('#aba-jogo');
  };
  const conferirTemporada = async (onde) => {
    const e = await p.evaluate(() => {
      const t = D.temp;
      const meus = t.historico.filter((h) => h.doUsuario).length;
      const feed = document.getElementById('feed').children.length;
      const tab = [...document.querySelectorAll('#painel-tabela tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
      const placar = document.querySelector('#jogo .placar-numeros') ? [...document.querySelectorAll('#jogo .placar-numeros span')].map((s) => s.textContent) : null;
      const dias = document.querySelectorAll('#cal-grade .cal-dia').length;
      const [ano, mes] = D.mes.split('-').map(Number);
      return { meus, feed, tab, placar, dias, diasMes: new Date(ano, mes, 0).getDate(), resultado: document.getElementById('jogo').dataset.resultado || null, animando: D.animando };
    });
    confere('feed tem um item por jogo seu (sem perder nem duplicar)', e.feed === e.meus, `${onde}: feed ${e.feed}, jogos ${e.meus}`);
    confere('calendario desenha todos os dias do mes', e.dias === e.diasMes, `${onde}: ${e.dias} de ${e.diasMes}`);
    if (e.tab.length && e.tab[0].length === 6) {
      confere('tabela: pontos, jogos e vitorias nunca negativos e jogos <= 38', e.tab.every((l) => Number(l[2]) >= 0 && Number(l[3]) >= 0 && Number(l[3]) <= 38 && Number(l[4]) >= 0), onde);
      confere('tabela ordenada por pontos', e.tab.every((l, k) => k === 0 || Number(e.tab[k - 1][2]) >= Number(l[2])), onde);
    }
    if (e.placar && !e.animando && e.resultado) {
      const [a, b] = e.placar.map(Number);
      confere('placar e o selo de resultado concordam', Number.isFinite(a) && Number.isFinite(b), `${onde}: ${e.placar}`);
    }
  };
  if (politicaTemp === 'recarrega') {
    // roteiro antes das recargas: mexe em tudo que a temporada salva precisa lembrar
    // (esquema e postura do painel no meio da temporada, postura do decisivo, janela)
    marcar('roteiro: esquema e postura do painel');
    await irPraJogo();
    const sels = p.locator('#tatica-temporada select');
    await sels.nth(0).selectOption(escolha(rng, ESQUEMAS.filter((e) => e !== esquema)));
    await sels.nth(1).selectOption(rng() < 0.5 ? 'ataque' : 'retranca');
    for (let n = 0; n < 3; n++) {
      marcar('roteiro: ate o decisivo');
      await clicar('#ate-decisivo');
      await ocioso();
      const c = (await st()).cartao;
      if (c === 'decisivo') { marcar('roteiro: postura do decisivo'); await clicar(p.locator('#jogo .pd-posturas .botao', { hasText: rng() < 0.5 ? 'Pra cima' : 'Fechadinho' })); if ((await st()).animando) await clicar('#proximo'); await ocioso(); }
      else if (c === 'janela' && await p.locator('#jogo .janela-lista .janela-jogador').count()) {
        marcar('roteiro: janela');
        await clicar(p.locator('#jogo .janela-lista .janela-jogador').nth(Math.floor(rng() * 16)));
        await clicar(p.locator('#jogo .leque-janela .opcao').first());
      }
    }
    await conferirTemporada('roteiro');
  }
  for (let k = 0; k < nAcoes; k++) {
    const s = await st();
    if (s.terminou) break;
    const acao = pesado(rng, { proximo: 6, decisivo: 2, alvo: 1, calendario: 2, cartao: 3, esquema: 0.6, postura: 0.6, aba: 1, recarregar: politicaTemp === 'recarrega' ? 3 : 0 });
    marcar(`temporada: ${acao}`);
    const antes = await impressao();
    if (acao === 'proximo') {
      await irPraJogo();
      const meus0 = s.meus;
      // toque duplo no Proximo jogo (sem animacao pra pular) nao pode jogar 2 jogos
      await parado();
      // a pessoa rola ate ver o botao (no celular ele pode estar atras da barra de abas de baixo).
      // Se a animacao do jogo anterior (penaltis) puxa a rolagem de volta, ela rola de novo: ate 4 tentativas.
      const alcancavel = () => p.evaluate(() => { const b = document.getElementById('proximo'); const q = b.getBoundingClientRect(); return document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2) === b; });
      let alcancou = false;
      for (let t = 0; t < 4 && !alcancou; t++) {
        await p.evaluate(() => document.getElementById('proximo').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await parado();
        alcancou = await alcancavel();
        if (!alcancou) await p.waitForTimeout(700);
      }
      if (mobile) confere('Proximo jogo alcancavel no celular (nao fica preso atras da barra de abas)', alcancou);
      await p.waitForTimeout(260); // tempo de ler o placar anterior (toque colado no fim do jogo conta como toque duplo)
      const duplo = politica === 'duplo' || rng() < 0.15;
      if (duplo) await p.locator('#proximo').dblclick({ delay: 40 });
      else await clicar('#proximo');
      const pulou = rng() < 0.9;
      const agora = await p.evaluate(() => ({ animando: D.animando, texto: document.getElementById('proximo').textContent }));
      if (pulou && !cfg.reduzido && !duplo && agora.animando) {
        confere('durante a animacao o botao vira "Pular animação"', /Pular animação/.test(agora.texto), agora.texto);
        await clicar('#proximo');
      }
      await ocioso();
      const s1 = await st();
      const mudou = (await impressao()) !== antes;
      confere('feedback imediato: Proximo jogo sempre muda a tela', mudou);
      confere('Proximo jogo joga 1 jogo seu, ou abre um cartao (decisivo/janela)', s1.meus === meus0 + 1 || (s1.meus === meus0 && s1.cartao) || s1.terminou, `${meus0}->${s1.meus} cartao ${s1.cartao} ${JSON.stringify(s)} ${JSON.stringify(s1)} ${(await p.textContent('#jogo')).slice(0, 200)} botao=${await p.textContent('#proximo')}`);
      if (s1.meus === meus0 + 1) {
        const pl = await p.evaluate(() => { const h = [...D.temp.historico].reverse().find((x) => x.doUsuario); const n = [...document.querySelectorAll('#jogo .placar-numeros span')].map((x) => Number(x.textContent)); return { gc: h.doUsuario.gc, gf: h.doUsuario.gf, n, rel: document.querySelector('#jogo .relogio')?.textContent, sel: document.querySelector('#jogo .resultado-selo')?.textContent }; });
        confere('fim do jogo: placar na tela igual ao do jogo e relogio em "Fim"', pl.n[0] === pl.gc && pl.n[1] === pl.gf && pl.rel === 'Fim' && /Vitória|Empate|Derrota/.test(pl.sel || ''), JSON.stringify(pl));
      }
    } else if (acao === 'decisivo') {
      await irPraJogo();
      await clicar('#ate-decisivo');
      await ocioso();
      confere('feedback: "Até o decisivo" muda a tela', (await impressao()) !== antes || (await st()).terminou);
    } else if (acao === 'alvo') {
      await irPraJogo();
      const opcoes = await p.locator('#sim-alvo option').evaluateAll((os) => os.map((o) => o.value));
      await p.selectOption('#sim-alvo', escolha(rng, opcoes));
      await clicar('#sim-ir');
      await ocioso();
      confere('feedback: "Simular até o fim de" muda a tela', (await impressao()) !== antes || (await st()).terminou);
    } else if (acao === 'calendario') {
      if (mobile) await clicar(p.locator('.abas-mobile .aba-mobile', { hasText: 'Calendário' }));
      else await clicar('#aba-cal');
      confere('aba Calendario mostra o calendario', await p.locator('#cal-grade').isVisible());
      for (let n = Math.floor(rng() * 3); n > 0; n--) {
        const seta = rng() < 0.5 ? '#cal-antes' : '#cal-depois';
        if (await p.locator(seta).isEnabled()) await clicar(seta);
      }
      const dias = await p.locator('#cal-grade .cal-dia').count();
      await clicar(p.locator('#cal-grade .cal-dia').nth(Math.floor(rng() * dias)));
      const acaoTxt = (await p.textContent('#cal-acao')).trim();
      confere('tocar num dia sempre diz o que da pra fazer', acaoTxt.length > 8 && !/undefined/.test(acaoTxt), acaoTxt);
      const botaoDia = p.locator('#cal-acao .botao');
      if (await botaoDia.count() && rng() < 0.7) {
        marcar(`calendario: ${(await botaoDia.first().textContent()).trim()}`);
        await clicar(botaoDia.first());
        await ocioso();
        if (rng() < 0.85 && (await st()).animando) await clicar('#proximo');
        await ocioso();
      }
      await auditar('calendario');
    } else if (acao === 'cartao') {
      // decide o cartao aberto (postura do decisivo ou janela); sem cartao, Proximo jogo
      await irPraJogo();
      const c = (await st()).cartao;
      marcar(`temporada: cartao ${c || 'nenhum'}`);
      if (c === 'decisivo') {
        const n = await p.locator('#jogo .pd-posturas .botao').count();
        confere('cartao do decisivo oferece as 3 posturas', n === 3, `${n}`);
        const meus0 = (await st()).meus;
        await clicar(p.locator('#jogo .pd-posturas .botao').nth(Math.floor(rng() * n)));
        if (rng() < 0.85 && (await st()).animando) await clicar('#proximo');
        await ocioso();
        confere('escolher a postura joga o decisivo', (await st()).meus === meus0 + 1 || (await st()).cartao === 'janela', `${meus0} -> ${(await st()).meus}`);
      } else if (c === 'janela' && !(await p.locator('#jogo .janela-lista').count())) {
        // negocio ja fechado: o cartao so informa; segue o jogo
        confere('janela depois do negocio diz quem saiu e quem chegou', /Sai .+, chega .+/.test(await p.textContent('#jogo .janela')));
        await clicar('#proximo');
        await ocioso();
      } else if (c === 'janela') {
        if (rng() < 0.3) {
          await clicar(p.locator('#jogo .janela .botao', { hasText: 'Seguir sem trocar' }));
          confere('"Seguir sem trocar" fecha a janela', (await st()).cartao == null && await p.locator('#jogo .janela').count() === 0);
        } else {
          const chips = await p.locator('#jogo .janela-lista .janela-jogador').count();
          confere('janela lista os 16 do elenco', chips === 16, `${chips}`);
          marcar('janela: escolhe quem sai');
          await clicar(p.locator('#jogo .janela-lista .janela-jogador').nth(Math.floor(rng() * chips)));
          const cartas = await p.locator('#jogo .leque-janela .opcao').count();
          confere('janela mostra cartas pra vaga escolhida', cartas >= 1, `${cartas}`);
          if (cartas) {
            marcar('janela: escolhe quem chega');
            await clicar(p.locator('#jogo .leque-janela .opcao').nth(Math.floor(rng() * cartas)));
            confere('negocio fechado aparece e fica 16 no elenco', /Negócio fechado/.test(await p.textContent('#jogo .janela'))
              && await p.evaluate(() => new Set([...D.onze, ...D.banco].map((x) => x.jogador.player_id)).size === 16));
          }
        }
      } else {
        await clicar('#proximo');
        await ocioso();
      }
    } else if (acao === 'esquema') {
      await irPraJogo();
      const sel = p.locator('#tatica-temporada select').first();
      if (await sel.isVisible()) {
        await sel.selectOption(escolha(rng, ESQUEMAS));
        confere('trocar esquema na temporada mantem 16 jogadores', await p.evaluate(() => new Set([...D.onze, ...D.banco].map((x) => x.jogador && x.jogador.player_id)).size === 16 && D.onze.every((x) => x.jogador)));
      }
    } else if (acao === 'postura') {
      await irPraJogo();
      const sel = p.locator('#tatica-temporada select').nth(1);
      if (await sel.isVisible()) await sel.selectOption(escolha(rng, ['ataque', 'equilibrado', 'retranca']));
    } else if (acao === 'aba') {
      if (mobile) await clicar(p.locator('.abas-mobile .aba-mobile', { hasText: 'Tabelas' }));
      else await irPraJogo();
      const n = await p.locator('#abas .chip').count();
      if (n) {
        await clicar(p.locator('#abas .chip').nth(Math.floor(rng() * n)));
        confere('aba de tabela abre conteudo (tabela ou artilharia)', await p.evaluate(() => document.getElementById('painel-tabela').children.length > 0));
      }
    } else if (acao === 'recarregar') {
      const foto = () => p.evaluate(() => JSON.stringify({ tab: Motor.ordenar(D.temp.bra.tabela).map((l) => `${l.id}:${l.pts}:${l.gp}`), feed: document.getElementById('feed').textContent, esquema: D.esquema, onze: D.onze.map((x) => x.jogador && x.jogador.player_id), pp: D.temp.ttc.posturaPadrao }));
      const antesFoto = await foto();
      // as vezes recarrega no meio da animacao de um jogo (o jogo ainda nao estava salvo)
      const noMeio = rng() < 0.4 && !cfg.reduzido;
      if (noMeio) { await irPraJogo(); await clicar('#proximo'); await p.waitForTimeout(150); }
      await p.reload(); await p.waitForFunction(() => D.r && document.querySelector('#padroes .chip'));
      const a = await auditar('recarregou na temporada');
      const retomar = await p.locator('#retomar-temporada').count();
      confere('recarregar no meio da temporada volta pra tela do clube', a.tela === 'tela-clube', a.tela);
      confere('recarregar com jogo disputado nao perde a temporada (oferece "Continuar a temporada")', s.meus === 0 || retomar === 1, `${s.meus} jogos, botao ${retomar}`);
      await erros('recarga na temporada');
      if (!retomar) return 'recarregou';
      // retomada: o progresso volta igual (sem perder nem duplicar jogo)
      await parado();
      confere('depois de recarregar, "Continuar a temporada" aparece a vista (sem rolar)', await p.evaluate(() => { const b = document.getElementById('retomar-temporada'); const q = b.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight && document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2) === b; }));
      marcar('retoma a temporada salva');
      await clicar('#retomar-temporada');
      await ocioso();
      const s1 = await st();
      confere('retomar a temporada volta no mesmo jogo (sem perder nem duplicar)', s1.i === s.i && s1.meus === s.meus, `antes i=${s.i} jogos=${s.meus}; depois i=${s1.i} jogos=${s1.meus}${noMeio ? ' (recarregou no meio do jogo)' : ''}`);
      const depoisFoto = await foto();
      confere('retomar refaz igualzinho: tabela, feed, esquema, onze e postura', depoisFoto === antesFoto, (() => { const x = JSON.parse(antesFoto), y = JSON.parse(depoisFoto); return Object.keys(x).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map((k) => `${k}: ${JSON.stringify(x[k]).slice(0, 400)} -> ${JSON.stringify(y[k]).slice(0, 400)}`).join(' | '); })());
      confere('retomar mostra a tela da temporada com aviso', /Temporada retomada/.test(await p.textContent('#jogo')) || (await st()).terminou);
    }
    await conferirTemporada(acao);
    if (rng() < 0.3) await auditar(`temporada (${acao})`);
    await erros(`temporada (${acao})`);
  }
  // termina tudo
  marcar('simular tudo');
  await irPraJogo();
  if (!(await st()).terminou || !(await p.locator('#tela-fim').isVisible())) {
    if (await p.locator('#simular-tudo').isEnabled()) await clicar('#simular-tudo');
    else await clicar('#proximo');
  }
  const chegou = await p.waitForSelector('#tela-fim:not([hidden])', { timeout: 30000 }).then(() => true, () => false);
  confere('toda temporada chega no balanco', chegou);
  if (!chegou) throw new Falha('sem balanco');
  await ocioso();

  // ---- 5. fim: balanco coerente com o que aconteceu
  marcar('balanco');
  const f = await p.evaluate(() => {
    const t = D.temp, eu = t.usuario;
    const tab = Motor.ordenar(t.bra.tabela);
    const pos = tab.findIndex((l) => l.id === eu) + 1;
    const titulos = Object.entries(t.campeoes).filter(([, id]) => id === eu).map(([c]) => c);
    const meus = t.historico.filter((h) => h.doUsuario).map((h) => h.doUsuario);
    const v = meus.filter((j) => resultado(j) === 'v').length, d = meus.filter((j) => resultado(j) === 'd').length;
    const tiles = Object.fromEntries([...document.querySelectorAll('.bl-tiles div')].map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent]));
    return {
      pos, titulos, n: meus.length, v, e: meus.length - v - d, d, pts: tab[pos - 1].pts,
      manchete: document.querySelector('.bl-manchete').textContent,
      trofeus: [...document.querySelectorAll('.bl-trofeu')].map((x) => x.textContent),
      braRes: document.querySelector('.bl-campanha tbody tr .bl-res').textContent,
      tiles, nome: document.querySelector('.bl-nome').textContent,
      campeoes: document.querySelectorAll('.bl-campeoes li').length,
      deNovo: [...document.querySelectorAll('#tela-fim .botao-primario')].some((b) => b.offsetParent && /Jogar de novo/.test(b.textContent)),
    };
  });
  confere('balanco: manchete de campeao se e so se ganhou titulo', /^Campeão/.test(f.manchete) === f.titulos.length > 0, `${f.manchete} / titulos ${f.titulos}`);
  confere('balanco: um trofeu por titulo', f.trofeus.length === f.titulos.length, `${f.trofeus} / ${f.titulos}`);
  confere('balanco: posicao e pontos do Brasileirao batem com a tabela', f.braRes.startsWith(`${f.pos}º · ${f.pts} pts`), `${f.braRes} vs ${f.pos}º ${f.pts}`);
  confere('balanco: jogos e V-E-D batem com os jogos jogados', f.tiles.Jogos === String(f.n) && f.tiles['V-E-D'] === `${f.v}-${f.e}-${f.d}`, JSON.stringify(f.tiles));
  confere('balanco: rebaixado so se terminou no Z4', /Rebaixado/.test(f.manchete) === (f.pos >= 17 && !f.titulos.length), `${f.manchete} ${f.pos}º`);
  confere('balanco: nome do time certo', f.nome === nomeFinal, `${f.nome} != ${nomeFinal}`);
  confere('balanco: lista os campeoes das 4 copas', f.campeoes >= 3, `${f.campeoes}`);
  confere('balanco: "Jogar de novo" visivel', f.deNovo);
  const recordesDepois = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('tem-time-recordes')).temporadas; } catch { return null; } });
  confere('recorde conta exatamente +1 temporada por balanco', recordesDepois === recordesAntes + 1, `${recordesAntes} -> ${recordesDepois}`);
  const resenha = await p.evaluate(() => ({ r: document.querySelector('.bl-resenha')?.textContent || '', rec: document.querySelector('.bl-recorde')?.textContent || '' }));
  confere('balanco sempre destaca algo bom (ponto alto) e o recorde', resenha.r.length > 10 && resenha.rec.length > 10, JSON.stringify(resenha));
  confere('temporada salva some quando a temporada acaba', await p.evaluate(() => { try { return localStorage.getItem('tem-time-temporada') === null; } catch { return true; } }));
  await auditar('balanco');

  // mesmo time, nova temporada (so na partida livre)
  confere('"Mesmo time, nova temporada" so fora do desafio', (await p.locator('#rejogar').count()) === (desafio ? 0 : 1));
  if (!desafio && rng() < 0.12) {
    marcar('mesmo time, nova temporada');
    const elenco0 = await p.evaluate(() => JSON.stringify(D.elenco0));
    await clicar('#rejogar');
    const r = await p.evaluate(() => ({ tela: !document.getElementById('tela-temporada').hidden, feed: document.getElementById('feed').children.length, meus: D.temp.historico.filter((h) => h.doUsuario).length, elenco: JSON.stringify(D.elenco0), n: new Set([...D.onze, ...D.banco].map((x) => x.jogador && x.jogador.player_id)).size }));
    confere('"Mesmo time, nova temporada" comeca do zero com o elenco do draft', r.tela && r.feed === 0 && r.meus === 0 && r.elenco === elenco0 && r.n === 16, JSON.stringify(r).slice(0, 200));
    await clicar('#simular-tudo');
    const ok = await p.waitForSelector('#tela-fim:not([hidden])', { timeout: 30000 }).then(() => true, () => false);
    confere('a nova temporada tambem chega no balanco', ok);
    const rec = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('tem-time-recordes')).temporadas; } catch { return null; } });
    confere('recorde conta exatamente +1 temporada por balanco', rec === recordesAntes + 2, `${recordesAntes} -> ${rec}`);
    await auditar('balanco da nova temporada');
  }

  // compartilhar
  marcar('copiar resultado');
  await p.evaluate(() => { window.__copiado = null; });
  const copiar = await p.locator('.bl-rodape .botao', { hasText: /Copiar|Compartilhar/ }).first().elementHandle();
  await copiar.click();
  await p.waitForFunction(() => window.__copiado !== null, null, { timeout: 3000 }).catch(() => {});
  const texto = await p.evaluate(() => window.__copiado);
  confere('copiar resultado da feedback ("Copiado")', /Copiado|Compartilhado/.test(await copiar.textContent()), await copiar.textContent());
  confere('texto de compartilhar existe', typeof texto === 'string' && texto.length > 0);
  if (texto) {
    confere('texto de compartilhar sem undefined/null/NaN', !/\b(undefined|null|NaN)\b|\[object/.test(texto), texto);
    confere('texto de compartilhar tem o link certo', texto.includes('temdadoemcasa.github.io/tem-time-em-casa.html'), texto);
    confere('texto de compartilhar com tamanho de mensagem (<= 600 caracteres, <= 12 linhas)', texto.length <= 600 && texto.split('\n').length <= 12, `${texto.length} caracteres`);
    const posAgora = await p.evaluate(() => Motor.ordenar(D.temp.bra.tabela).findIndex((l) => l.id === D.temp.usuario) + 1);
    confere('texto de compartilhar tem o nome do time e a campanha do BR', texto.includes(nomeFinal) && texto.includes(`Brasileirão: ${posAgora}º`), texto);
    if (desafio) confere('desafio: texto com data, semente e "e você?"', /^Desafio \d\d\/\d\d: .*— e você\?$/m.test(texto) && /semente ttc-\d{4}-\d\d-\d\d/.test(texto), texto);
    else confere('partida livre: texto com a dificuldade e sem "Desafio"', /Dificuldade: (Fácil|Normal|Difícil)/.test(texto) && !/Desafio/.test(texto), texto);
  }
  await erros('balanco');

  // recomecar
  marcar('jogar de novo');
  await clicar(p.locator('#tela-fim .botao-primario', { hasText: 'Jogar de novo' }).first());
  const a = await auditar('depois do jogar de novo');
  confere('"Jogar de novo" volta pra tela do clube com o nome mantido', a.tela === 'tela-clube' && [nome.slice(0, 24), nomeFinal].includes(await p.inputValue('#nome-time')), a.tela);
  await erros('jogar de novo');
  return 'completo';
}

// --- execucao ------------------------------------------------------------------------
const b = await chromium.launch();
const sementes = SO != null ? [SO] : Array.from({ length: CASOS }, (_, k) => SEMENTE0 + k);
const inicio = Date.now();
const finais = { completo: 0, desistiu: 0, recarregou: 0, quebrou: 0 };
const POLITICAS_DRAFT = { aleatoria: 3, otima: 2, pessima: 1.5, maiorNota: 1, mexe: 2, duplo: 1, teclado: 1, desiste: 0.6 };
const POLITICAS_TEMP = { tudo: 4, curta: 3, longa: 1, recarrega: 1.5 };

function configDoContexto(s) {
  const r = rngDe(Math.floor((s - SEMENTE0) / POR_CONTEXTO) * 104729 + SEMENTE0);
  const [w, h] = escolha(r, VIEWPORTS);
  const toque = w <= 1024 && r() < 0.8;
  return { w, h, toque, reduzido: r() < 0.5, tema: escolha(r, LS_ESTRANHO), lixo: r() < 0.35 ? 1 + Math.floor(r() * 4) : 0 };
}

async function abrir(cc) {
  const ctx = await b.newContext({ viewport: { width: cc.w, height: cc.h }, isMobile: cc.toque, hasTouch: cc.toque, reducedMotion: cc.reduzido ? 'reduce' : 'no-preference' });
  await ctx.route(/goatcounter|gc\.zgo\.at|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(({ tema, lixo }) => {
    try {
      if (window.__lsFeito) return; window.__lsFeito = true;
      if (sessionStorage.getItem('__lsFeito')) return; sessionStorage.setItem('__lsFeito', '1');
      if (tema != null) localStorage.setItem('tema', tema);
      // localStorage velho/corrompido: JSON quebrado, versao velha, campos com tipo errado
      const VARIANTES = [
        { 'tem-time-temporada': '{"v":1,"semente":', 'tem-time-recordes': '{"v":1,"temporadas":' },
        { 'tem-time-temporada': '{"v":0,"i":12}', 'tem-time-recordes': '{"v":1,"temporadas":-3,"melhor":null}' },
        { 'tem-time-temporada': '{"v":1,"semente":"abc","sementeGrupo":2,"i":5,"meus":2,"gols":3,"nome":"X","elenco0":{"esquema":"9-9-9","onze":[],"banco":[]},"log":[],"posturas":[],"continental":"lib","dificuldade":"normal"}', 'tem-time-recordes': '{"v":1,"temporadas":2,"melhor":{"texto":"","pontos":"NaN","nome":3}}' },
        { 'tem-time-temporada': 'null', 'tem-time-recordes': '[]' },
      ];
      if (lixo) for (const [k, v] of Object.entries(VARIANTES[lixo - 1])) localStorage.setItem(k, v);
    } catch { /* sem storage */ }
  }, cc);
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(BASE + '/tem-time-em-casa.html');
  await p.waitForFunction(() => typeof D !== 'undefined' && D.r && document.querySelector('#padroes .chip'), null, { timeout: 30000 });
  return { ctx, p, erros };
}

let proximo = 0;
const registro = { primeiroLeque: null };
async function trabalhador() {
  let aberto = null, chaveCtx = null;
  while (proximo < sementes.length) {
    const s = sementes[proximo++];
    const cc = configDoContexto(s);
    const chave = Math.floor((s - SEMENTE0) / POR_CONTEXTO);
    const r = rngDe(s);
    const cfg = { ...cc, vp: `${cc.w}x${cc.h}${cc.toque ? ' toque' : ''}${cc.reduzido ? ' reduzido' : ''}`, politicaDraft: pesado(r, POLITICAS_DRAFT), politicaTemp: pesado(r, POLITICAS_TEMP), esperarChances: r() < 0.08 };
    cfg.rotulo = `${cfg.vp}, draft ${cfg.politicaDraft}, temporada ${cfg.politicaTemp}`;
    if (!aberto || chave !== chaveCtx) {
      if (aberto) await aberto.ctx.close();
      aberto = await abrir(cc); chaveCtx = chave;
    }
    const reg = { falhou: false, primeiroLeque: registro.primeiroLeque };
    let fim;
    try {
      fim = await Promise.race([caso(aberto.p, s, cfg, reg), new Promise((_, no) => setTimeout(() => no(new Falha('caso passou do limite de tempo')), LIMITE_CASO_MS))]);
    } catch (e) {
      fim = 'quebrou';
      const c = conta('todo estado tem saida (caso termina sem excecao nem timeout)');
      c.falha++; if (c.ex.length < 3) c.ex.push(`semente ${s}: ${String(e.message).split('\n')[0].slice(0, 300)} [${cfg.rotulo}]`);
      reg.falhou = true;
      await aberto.ctx.close().catch(() => {}); aberto = null;
    }
    if (fim !== 'quebrou') conta('todo estado tem saida (caso termina sem excecao nem timeout)').ok++;
    if (reg.primeiroLeque) registro.primeiroLeque = reg.primeiroLeque;
    finais[fim]++;
    casosFeitos++;
    if (reg.falhou) casosComFalha++;
    if (aberto && fim !== 'completo' && fim !== 'desistiu' && fim !== 'recarregou') { await aberto.ctx.close(); aberto = null; }
    // caso que nao chegou no fim: recarrega pra o proximo comecar limpo
    if (aberto && fim === 'recarregou') { /* ja recarregou dentro do caso */ }
    if (casosFeitos % 100 === 0) process.stderr.write(`  ${casosFeitos}/${sementes.length} casos, ${((Date.now() - inicio) / 1000).toFixed(0)} s\n`);
  }
  if (aberto) await aberto.ctx.close();
}
await Promise.all(Array.from({ length: SO != null ? 1 : WORKERS }, trabalhador));
await b.close();

const linhas = [];
for (const [inv, c] of [...placar].sort((x, y) => y[1].falha - x[1].falha || x[0].localeCompare(y[0]))) {
  if (c.falha) { linhas.push(`FALHA ${inv}: ${c.falha} de ${c.ok + c.falha}`); for (const e of c.ex) linhas.push(`      ex.: ${e}`); }
  else linhas.push(`OK  ${inv} (${c.ok} checagens)`);
}
const seg = ((Date.now() - inicio) / 1000).toFixed(0);
const total = [...placar.values()].reduce((s, c) => s + c.ok + c.falha, 0);
linhas.push(`${casosFeitos >= sementes.length ? 'OK ' : 'FALHA'} casos: ${casosFeitos} (sementes ${sementes[0]}..${sementes[sementes.length - 1]}) · completos ${finais.completo}, desistiram no draft ${finais.desistiu}, recarregaram na temporada ${finais.recarregou}, quebraram ${finais.quebrou} · casos com falha ${casosComFalha} · ${total} checagens · ${seg} s`);
console.log(linhas.join('\n'));
mkdirSync('testes/resultados', { recursive: true });
writeFileSync('testes/resultados/bateria-ux-draft.txt', `${new Date().toISOString()} BASE=${BASE} CASOS=${CASOS} SEMENTE=${SEMENTE0}\n${linhas.join('\n')}\n`);
process.exit(casosComFalha ? 1 : 0);
