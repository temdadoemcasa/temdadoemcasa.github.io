// O menu de todas as paginas de jogo (e da home) tem os 5 jogos, cada um apontando pra pagina certa.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const JOGOS = ['show-do-dadao.html', 'quem-ta-em-casa.html', 'tem-time-em-casa.html', 'prata-da-casa.html', 'top10-em-casa.html'];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
for (const pagina of ['index.html', ...JOGOS]) {
  await p.goto(`${BASE}/${pagina}`); await p.waitForTimeout(300);
  const hrefs = await p.locator('nav.menu a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(JOGOS.every((j) => hrefs.includes(j)), `${pagina}: menu com os 5 jogos`);
}
await b.close();
