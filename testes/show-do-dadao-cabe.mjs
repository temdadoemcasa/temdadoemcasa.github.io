// Toda pergunta do banco, com qualquer painel aberto (ajudas, cartas, parar, resultado),
// cabe na tela do celular sem rolar, inclusive nos baixinhos (iPhone SE).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch();
for (const [w, h] of [[360, 740], [375, 667], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await p.goto(BASE + '/show-do-dadao.html'); await p.evaluate(() => localStorage.clear());
  await p.click('button[type=submit]'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const barra = document.querySelector('.abas-mobile');
    const lim = innerHeight - (barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight : 0);
    const todas = Object.values(Q.banco).flat(), passam = [];
    for (const pg of todas) {
      Q.pergunta = pg; Q.opcoes = [{ texto: pg.a, certa: true }, ...pg.e.map((t) => ({ texto: t, certa: false }))];
      Q.eliminadas = new Set(); Q.escolhida = null; Q.marcas = { votos: null, boys: [[], [], [], []], enciclopedia: null };
      document.getElementById('enunciado').textContent = pg.q; desenharAlternativas();
      let pior = 0;
      for (const id of ['acao-padrao', 'parar-caixa', 'cartas-caixa', 'retorno']) {
        mostrarAcao(id); pior = Math.max(pior, document.querySelector('#palco-acao').getBoundingClientRect().bottom);
      }
      if (pior > lim) passam.push(`${Math.round(pior - lim)}px: ${pg.q.slice(0, 60)}`);
    }
    return { total: todas.length, passam };
  });
  console.log(r.passam.length ? 'FALHA' : 'OK  ', `${w}x${h}: ${r.total - r.passam.length}/${r.total} perguntas cabem sem rolar`);
  r.passam.slice(0, 5).forEach((l) => console.log('     ', l));
  await p.close();
}
await b.close();
