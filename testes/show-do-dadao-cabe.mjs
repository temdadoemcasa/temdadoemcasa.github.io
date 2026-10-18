// Toda pergunta do banco, com qualquer painel aberto (ajudas, cartas, parar, resultado),
// cabe na tela do celular sem rolar, inclusive nos baixinhos (iPhone SE e 360x640).
// Cada pergunta passa duas vezes: no meio do jogo e como pergunta final (que ganha o
// selo "Vale a Prateleira Rei Pelé" no cabecalho e a fala da final: e mais alta).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch();
// com a fonte do Google e sem ela (offline, rede lenta, bloqueada): a de reserva e mais
// larga e o "Pergunta final" com o selo do premio deixa de caber numa linha
for (const semFonte of [false, true]) for (const [w, h] of [[360, 640], [360, 740], [375, 667], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  if (semFonte) await p.route('**/*', (rota) => (rota.request().url().startsWith(BASE) ? rota.continue() : rota.abort()));
  await p.goto(BASE + '/show-do-dadao.html'); await p.evaluate(() => localStorage.clear());
  await p.click('button[type=submit]'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const barra = document.querySelector('.abas-mobile');
    const lim = innerHeight - (barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight : 0);
    const todas = Object.values(Q.banco).flat(), passam = [];
    // como a novaPergunta desenha o cabecalho, a fala e as ajudas (no meio do jogo e na final)
    const cabecalho = (n) => {
      Q.numero = n; Q.degrau = n - 1; Q.travado = false;
      document.getElementById('pergunta-numero').textContent = n === 16 ? 'Pergunta final' : `Pergunta ${n} de 16`;
      const nivel = document.getElementById('pergunta-nivel');
      nivel.textContent = n === 16 ? 'Vale a Prateleira Rei Pelé' : ''; nivel.hidden = n !== 16;
      falar(n === 16 ? 'Pergunta final: sem ajuda. Se parar, leva a carta de 15 acertos. Errar zera.' : '');
      desenharTrilha(); desenharValores(); desenharAjudas();
    };
    for (const n of [1, 16]) for (const pg of todas) {
      cabecalho(n);
      Q.pergunta = pg; Q.opcoes = [{ texto: pg.a, certa: true }, ...pg.e.map((t) => ({ texto: t, certa: false }))];
      Q.eliminadas = new Set(); Q.escolhida = null; Q.marcas = { votos: null, boys: [[], [], [], []], enciclopedia: null };
      document.getElementById('enunciado').textContent = pg.q; desenharAlternativas();
      let pior = 0;
      for (const id of n === 16 ? ['acao-padrao', 'parar-caixa', 'retorno'] : ['acao-padrao', 'parar-caixa', 'cartas-caixa', 'retorno']) {
        mostrarAcao(id);
        // no meio do jogo, o palco inteiro (com a altura reservada); na final, o que aparece de
        // verdade (as ajudas, o "Próxima" ou o painel), como a bateria de UX confere
        const painel = document.getElementById(id);
        const alvo = n !== 16 ? document.querySelector('#palco-acao') : id === 'acao-padrao' ? painel.querySelector('.ajudas') : id === 'retorno' ? document.getElementById('proxima') : painel;
        pior = Math.max(pior, alvo.getBoundingClientRect().bottom);
      }
      if (pior > lim) passam.push(`${Math.round(pior - lim)}px${n === 16 ? ' (final)' : ''}: ${pg.q.slice(0, 60)}`);
    }
    return { total: 2 * todas.length, passam };
  });
  console.log(r.passam.length ? 'FALHA' : 'OK  ', `${w}x${h}${semFonte ? ' sem a fonte do Google' : ''}: ${r.total - r.passam.length}/${r.total} perguntas cabem sem rolar (meio do jogo e final)`);
  r.passam.slice(0, 5).forEach((l) => console.log('     ', l));
  await p.close();
}
await b.close();
