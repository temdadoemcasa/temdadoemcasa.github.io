// O topo (marca + menu com 5 jogos + botao de tema) cabe em todas as larguras: sem rolagem lateral,
// nada fora da tela. Ate 640px o menu desce pra segunda linha e rola por dentro (design existente).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const JOGOS = ['show-do-dadao.html', 'quem-ta-em-casa.html', 'tem-time-em-casa.html', 'prata-da-casa.html', 'top10-em-casa.html'];
const b = await chromium.launch();
for (const w of [360, 390, 768, 820, 900, 1024, 1280, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  for (const pagina of ['index.html', ...JOGOS]) {
    await p.goto(`${BASE}/${pagina}`); await p.waitForTimeout(250);
    const r = await p.evaluate((jogos) => {
      const vw = document.documentElement.clientWidth; const erros = [];
      if (document.documentElement.scrollWidth > vw) erros.push(`vaza ${document.documentElement.scrollWidth} > ${vw}`);
      const menu = document.querySelector('nav.menu');
      const rolaPorDentro = menu.scrollWidth > menu.clientWidth + 1;
      const visivel = (e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && e.getClientRects().length; };
      const dentro = (e) => { const x = e.getBoundingClientRect(); return x.left >= -0.5 && x.right <= vw + 0.5; };
      for (const e of document.querySelectorAll('.topo .marca, .topo .marca-nome, .topo .tema-botao, .topo nav.menu')) {
        if (visivel(e) && !dentro(e)) erros.push(`fora da tela: ${e.className}`);
      }
      const links = [...menu.querySelectorAll('a')];
      for (const j of jogos) {
        const a = links.find((l) => l.getAttribute('href') === j);
        if (!a || !visivel(a)) { erros.push(`link sumiu: ${j}`); continue; }
        if (!rolaPorDentro && !dentro(a)) erros.push(`link fora: ${j}`);
      }
      if (rolaPorDentro && vw > 640) erros.push('menu rola por dentro acima de 640px');
      return erros;
    }, JOGOS);
    ok(!r.length, `${w}px ${pagina}${r.length ? ' | ' + r.join(' | ') : ''}`);
  }
  await p.close();
}
await b.close();
