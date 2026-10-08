// Tela final do Show do Dadão no celular: os 4 botões não se espremem nem alargam a página
// (a regra "lado a lado" do painel de parar pegava também a tela final).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
for (const [w, h] of [[360, 740], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await p.goto(BASE + '/show-do-dadao.html'); await p.evaluate(() => localStorage.clear());
  await p.tap('button[type=submit]'); await p.waitForTimeout(300);
  await p.evaluate(() => { Q.degrau = 4; Q.numero = 5; Q.historico = [1, 2, 3, 4].map((n) => ({ numero: n, q: 'x', certa: 'a', marcada: 'a', acertou: true })).concat([{ numero: 5, q: 'y', certa: 'b', marcada: 'c', acertou: false, frase: 'Frase longa de resenha pra ver se a caixa respeita a largura da tela do celular.' }]); terminar('errou'); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ larg: document.scrollingElement.scrollWidth, vw: innerWidth, alturas: [...document.querySelectorAll('.fim .confirmar-botoes .botao')].map((x) => x.getBoundingClientRect().height), larguras: [...document.querySelectorAll('.fim .confirmar-botoes .botao')].map((x) => x.getBoundingClientRect().width) }));
  ok(r.larg <= r.vw, `${w}x${h}: tela final não rola de lado (${r.larg} de ${r.vw})`);
  ok(Math.max(...r.alturas) <= 70 && Math.min(...r.larguras) >= 140, `${w}x${h}: botões com tamanho de botão (alturas ${r.alturas.map(Math.round)}, larguras ${r.larguras.map(Math.round)})`);
  await p.close();
}
await b.close();
