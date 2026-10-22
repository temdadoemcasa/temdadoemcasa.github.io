// Tema claro: todo texto com fundo solido medivel tem contraste >= 3 (WCAG pra texto grande/negrito).
// Pegou o pacote de craque escuro com texto quase preto e os rotulos amarelo/rosa/ciano no branco.
import { chromium } from 'playwright';
const BASE = process.env.BASE || '${BASE}';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
await ctx.addInitScript(() => { try { localStorage.setItem('tema', 'claro'); } catch {} });
const p = await ctx.newPage();
const auditar = (onde) => p.evaluate((onde) => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // fundo medido so quando e cor solida; gradiente ou imagem no caminho: nao da pra medir (null)
  const fundo = (e) => { for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage !== 'none') return null; const c = rgb(s.backgroundColor); if (c && (c.length < 4 || c[3] > 0.5)) return c.slice(0, 3); } return [245, 246, 243]; };
  const ruins = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity < 0.3) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const c = rgb(s.color); if (!c) continue;
    const f = fundo(e); if (!f) continue;
    const k = ratio(c.slice(0, 3), f);
    if (k < 3) ruins.push(`${k.toFixed(1)} "${e.textContent.trim().slice(0, 30)}" <${e.tagName.toLowerCase()}.${(e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : '')}>`);
  }
  return [...new Set(ruins)].slice(0, 25).map((x) => `${onde}: ${x}`);
}, onde);
const tudo = [];
for (const pg of ['index', 'show-do-dadao', 'tem-time-em-casa', 'prata-da-casa', 'top10-em-casa', 'maior-ou-menor']) {
  await p.goto(`${BASE}/${pg}.html`); await p.waitForTimeout(1500);
  tudo.push(...await auditar(pg));
}
// envelope aberto num dialogo
await p.goto(`${BASE}/index.html`); await p.waitForTimeout(1200);
await p.locator('text=Abrir um envelope').first().click().catch(() => {}); await p.waitForTimeout(800);
tudo.push(...await auditar('envelope-dialogo'));
await p.goto(`${BASE}/show-do-dadao.html`); await p.waitForTimeout(800); await p.click('button[type=submit]'); await p.waitForTimeout(500); tudo.push(...await auditar('dadao-jogo'));
await p.goto(`${BASE}/tem-time-em-casa.html`); await p.waitForTimeout(1200); await p.click('#comecar-draft').catch(() => {}); await p.waitForTimeout(600); tudo.push(...await auditar('draft'));
for (const x of tudo) console.log('FALHA', x);
console.log(tudo.length ? 'FALHA' : 'OK  ', `tema claro: nenhum texto com contraste < 3 (${tudo.length} problemas)`);
await b.close();
