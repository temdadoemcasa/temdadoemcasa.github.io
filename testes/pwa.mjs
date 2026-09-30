// PWA: manifest valido, service worker instala e o site abre offline (Show do Dadao jogavel).
// No localhost o app.js nao registra o SW (pra nao atrapalhar o dev); aqui registra na mao.
import { chromium } from 'playwright';
import { rmSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const perfil = 'testes/resultados/perfil-pwa';
rmSync(perfil, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(perfil, { viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.goto(BASE + '/index.html'); await p.waitForTimeout(400);
const man = await p.evaluate(async () => {
  const r = await fetch(document.querySelector('link[rel=manifest]').href); const m = await r.json();
  const icones = await Promise.all(m.icons.map(async (i) => (await fetch(i.src)).ok));
  return { nome: m.name, display: m.display, icones: icones.every(Boolean), maskable: m.icons.some((i) => i.purpose === 'maskable') };
});
ok(man.nome && man.display === 'standalone' && man.icones && man.maskable, 'manifest com ícones (inclusive maskable)');
await p.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
await p.waitForTimeout(1500);
const n = await p.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).length; });
ok(n >= 10, `service worker guardou ${n} arquivos`);
await ctx.setOffline(true);
await p.goto(BASE + '/show-do-dadao.html'); await p.waitForTimeout(600);
await p.click('button[type=submit]'); await p.waitForTimeout(300);
ok(await p.locator('#tela-jogo').isVisible() && (await p.locator('#enunciado').innerText()).length > 5, 'offline: Show do Dadão abre e joga');
await p.goto(BASE + '/'); await p.waitForTimeout(400);
ok((await p.title()).includes('Tem dado em casa'), 'offline: home abre');
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
await ctx.close();
