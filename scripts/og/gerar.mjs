// Gera as imagens de previa de link (1200x630) de cada minigame a partir da
// propria home: clona o visual do card e monta a arte com o nome do jogo.
//   python3 -m http.server 8766   (na raiz do site)
//   node scripts/og/gerar.mjs
import { chromium } from 'playwright';

const JOGOS = [
  { id: 'visual-quiz', saida: 'img/og-show-do-dadao.png', cor: '#f2c230', nome: 'Show do Dadão', sub: '16 perguntas de futebol. Da pelada de rua à Prateleira Rei Pelé.', papel: 'Quiz de futebol' },
  { id: 'visual-draft', saida: 'img/og-tem-time-em-casa.png', cor: '#c8ff00', nome: 'Tem Time em Casa', sub: 'Monte seu time com as cartas do Brasileirão e jogue a temporada 2026.', papel: 'Minigame · você é o técnico' },
  { id: 'visual-carreira', saida: 'img/og-prata-da-casa.png', cor: '#ff7d95', nome: 'Prata da Casa', sub: 'Da peneira aos 16 até pendurar a chuteira. Sua carreira, carta a carta.', papel: 'Minigame · você é o jogador' },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await p.goto('http://localhost:8766/');
await p.waitForTimeout(1800);
for (const j of JOGOS) {
  await p.evaluate(({ id, cor, nome, sub, papel }) => {
    document.getElementById('og-arte')?.remove();
    const arte = document.createElement('div');
    arte.id = 'og-arte';
    arte.style.cssText = `position:fixed;inset:0;z-index:9999;width:1200px;height:630px;display:grid;grid-template-columns:560px 640px;overflow:hidden;
      background:radial-gradient(70% 90% at 78% 100%, ${cor}40, transparent 70%), #0d1117;color:#e6edf3;font-family:Inter,Helvetica,Arial,sans-serif`;
    const textos = document.createElement('div');
    textos.style.cssText = 'padding:64px 0 56px 64px;display:flex;flex-direction:column;justify-content:center;gap:18px';
    textos.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;font-weight:700;font-size:26px"><img src="img/simbolo.svg" style="width:52px">Tem dado em casa</div>
      <div style="color:${cor};font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:20px;margin-top:18px">${papel}</div>
      <div style="font-weight:800;font-size:74px;line-height:1;text-transform:uppercase;letter-spacing:-.01em">${nome}</div>
      <div style="font-size:26px;line-height:1.35;color:#aeb7c2;max-width:470px">${sub}</div>
      <div style="margin-top:auto;font-size:22px;color:${cor};font-weight:700">temdadoemcasa.github.io</div>`;
    const palco = document.createElement('div');
    palco.style.cssText = 'position:relative;display:grid;place-items:center;overflow:hidden';
    const origem = document.getElementById(id);
    const clone = origem.cloneNode(true);
    clone.removeAttribute('id');
    // a escadinha do quiz mede em vw: no clone, largura fixa pra nao cortar os nomes
    const col = clone.querySelector('.quiz-escada-coluna');
    if (col) { col.style.width = '205px'; clone.querySelectorAll('.quiz-escadinha li').forEach((li) => { li.style.fontSize = '13px'; }); clone.querySelector('.quiz-vitrine-carta').style.width = '130px'; }
    const q = origem.getBoundingClientRect();
    clone.style.cssText = `width:${q.width}px;height:${q.height}px;transform:scale(${Math.min(600 / q.width, 560 / q.height)});background:none;border:0;transform-origin:center`;
    palco.append(clone);
    arte.append(textos, palco);
    document.body.append(arte);
    window.scrollTo(0, 0);
  }, j);
  await p.waitForTimeout(500);
  await p.screenshot({ path: j.saida, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log('ok', j.saida);
}
await b.close();
