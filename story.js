// Imagem 1080x1920 do resultado do Show do Dadão, pra postar nos stories.
// Desenhada no canvas na hora (nada sai do navegador): a carta no nivel dela, a grade
// de quadradinhos e o Dadao. Usa ESCADA_QUIZ, nivel(), kitDoDegrau() e eixosDoQuiz() do app.js.

const STORY_W = 1080, STORY_H = 1920;
const CORES_NIVEL = {
  palha: { tom: "#948a66", papel: ["#1c1b18", "#141310"], tinta: "#bab29a", destaque: "#aba17f", aura: null },
  madeira: { tom: "#b87a46", papel: ["#2a2019", "#17120e"], tinta: "#eadccb", destaque: "#dc9d64", aura: null },
  tijolo: { tom: "#ff4d6d", papel: ["#3a1119", "#16080b"], tinta: "#ffeef1", destaque: "#ff7d95", aura: "rgba(255,77,109,0.45)" },
  grafeno: { tom: "#c8ff00", papel: ["#161a12", "#030405"], tinta: "#f2ffd6", destaque: "#c8ff00", aura: "rgba(200,255,0,0.5)" },
};
const SIGLA_POS = { G: "GOL", D: "DEF", M: "MEI", F: "ATA" };
const FONTE_NUM = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
const FONTE_TXT = 'Inter, "Helvetica Neue", Arial, sans-serif';

function carregarImagem(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function retanguloRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// texto que encolhe ate caber na largura
function textoCabendo(ctx, texto, x, y, larguraMax, tamanho, peso, familia) {
  let t = tamanho;
  do { ctx.font = `${peso} ${t}px ${familia}`; t -= 2; } while (ctx.measureText(texto).width > larguraMax && t > 16);
  ctx.fillText(texto, x, y);
}

function camisa(ctx, cx, cy, s, kit, numero) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-30, -48); ctx.lineTo(-62, -30); ctx.lineTo(-78, 2); ctx.lineTo(-54, 14); ctx.lineTo(-46, -2);
  ctx.lineTo(-46, 56); ctx.lineTo(46, 56); ctx.lineTo(46, -2); ctx.lineTo(54, 14); ctx.lineTo(78, 2);
  ctx.lineTo(62, -30); ctx.lineTo(30, -48); ctx.quadraticCurveTo(0, -30, -30, -48);
  ctx.closePath();
  ctx.fillStyle = kit.base;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30, -48); ctx.quadraticCurveTo(0, -30, 30, -48);
  ctx.lineWidth = 6;
  ctx.strokeStyle = kit.gola || "rgba(0,0,0,0.25)";
  ctx.stroke();
  ctx.fillStyle = kit.numero;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 64px ${FONTE_NUM}`;
  ctx.fillText(String(numero), 0, 14);
  ctx.restore();
}

async function desenharStory({ nome, pos, degrau, historico, como, desafio }) {
  try {
    await Promise.all([document.fonts.load(`800 100px ${FONTE_NUM}`), document.fonts.load(`700 40px ${FONTE_NUM}`), document.fonts.load(`700 40px ${FONTE_TXT}`)]);
  } catch { /* segue com a fonte que tiver */ }
  const c = document.createElement("canvas");
  c.width = STORY_W; c.height = STORY_H;
  const ctx = c.getContext("2d");
  const g = ESCADA_QUIZ[degrau];
  const nv = nivel(g.ovr);
  const cor = CORES_NIVEL[nv.id] || CORES_NIVEL.palha;

  // fundo
  const fundo = ctx.createLinearGradient(0, 0, 0, STORY_H);
  fundo.addColorStop(0, "#0b0e12"); fundo.addColorStop(1, "#12160c");
  ctx.fillStyle = fundo; ctx.fillRect(0, 0, STORY_W, STORY_H);
  const brilho = ctx.createRadialGradient(STORY_W / 2, 720, 60, STORY_W / 2, 720, 760);
  brilho.addColorStop(0, cor.aura || "rgba(242,194,48,0.18)"); brilho.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = brilho; ctx.fillRect(0, 0, STORY_W, STORY_H);

  // cabecalho
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c8ff00"; ctx.font = `700 38px ${FONTE_NUM}`;
  ctx.fillText("TEM DADO EM CASA", STORY_W / 2, 150);
  ctx.fillStyle = "#ffffff";
  textoCabendo(ctx, "SHOW DO DADÃO", STORY_W / 2, 270, 960, 128, 800, FONTE_NUM);
  ctx.fillStyle = "#f2c230"; ctx.font = `700 46px ${FONTE_NUM}`;
  ctx.fillText(desafio ? `DESAFIO DO DIA #${desafio}` : "MINHA CARTA", STORY_W / 2, 336);

  // carta com telhado (a "casa" do nivel)
  const cw = 600, ch = 820, cx = (STORY_W - cw) / 2, cy = 470;
  ctx.save();
  if (cor.aura) { ctx.shadowColor = cor.aura; ctx.shadowBlur = 60; }
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 30); ctx.lineTo(STORY_W / 2, cy - 90); ctx.lineTo(cx + cw + 40, cy + 30);
  ctx.lineWidth = 22; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = cor.tom; ctx.stroke();
  retanguloRedondo(ctx, cx, cy, cw, ch, 36);
  const papel = ctx.createLinearGradient(cx, cy, cx + cw * 0.3, cy + ch);
  papel.addColorStop(0, cor.papel[0]); papel.addColorStop(1, cor.papel[1]);
  ctx.fillStyle = papel; ctx.fill();
  ctx.restore();
  retanguloRedondo(ctx, cx, cy, cw, ch, 36);
  ctx.lineWidth = 10; ctx.strokeStyle = cor.tom; ctx.stroke();
  ctx.fillStyle = cor.destaque; ctx.font = `700 30px ${FONTE_NUM}`;
  ctx.fillText(`CASA DE ${nv.nome.toUpperCase()}`, STORY_W / 2, cy - 22);

  // nota, posicao e camisa
  ctx.textAlign = "left";
  ctx.fillStyle = cor.destaque; ctx.font = `800 190px ${FONTE_NUM}`;
  ctx.fillText(String(g.ovr), cx + 44, cy + 210);
  ctx.fillStyle = cor.tinta; ctx.font = `700 58px ${FONTE_NUM}`;
  ctx.fillText(SIGLA_POS[pos] || "ATA", cx + 52, cy + 280);
  camisa(ctx, cx + cw - 170, cy + 180, 1.7, kitDoDegrau(degrau), { G: 1, D: 4, M: 10, F: 9 }[pos] || 9);

  // nome
  ctx.textAlign = "center"; ctx.fillStyle = cor.tinta;
  textoCabendo(ctx, (nome || "Você").toUpperCase(), STORY_W / 2, cy + 440, cw - 80, 92, 800, FONTE_NUM);

  // eixos
  const eixos = Object.entries(eixosDoQuiz(g.ovr, pos));
  const passo = (cw - 80) / eixos.length;
  eixos.forEach(([k, v], i) => {
    const x = cx + 40 + passo * i + passo / 2;
    ctx.fillStyle = cor.tinta; ctx.globalAlpha = 0.7; ctx.font = `700 30px ${FONTE_NUM}`;
    ctx.fillText(k, x, cy + 530);
    ctx.globalAlpha = 1; ctx.font = `800 56px ${FONTE_NUM}`;
    ctx.fillText(String(v), x, cy + 594);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x - 34, cy + 612, 68, 8);
    ctx.fillStyle = cor.destaque; ctx.fillRect(x - 34, cy + 612, 68 * Math.min(1, v / 99), 8);
  });
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(cx + 40, cy + 672, cw - 80, 2);
  ctx.textAlign = "left"; ctx.fillStyle = cor.tinta; ctx.font = `700 34px ${FONTE_NUM}`;
  textoCabendo(ctx, g.nome.toUpperCase(), cx + 44, cy + 740, cw - 260, 34, 700, FONTE_NUM);
  ctx.textAlign = "right"; ctx.font = `700 34px ${FONTE_NUM}`;
  ctx.fillText(`${historico.filter((h) => h.acertou).length} DE 16`, cx + cw - 44, cy + 740);

  // como terminou
  const numero = como === "parou" ? historico.length + 1 : historico.length;
  const frase = como === "campeao" ? "ACERTOU AS 16!" : como === "parou" ? `PAROU NA PERGUNTA ${numero}` : `CAIU NA PERGUNTA ${numero}`;
  ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.font = `800 64px ${FONTE_NUM}`;
  textoCabendo(ctx, frase, STORY_W / 2, 1400, 960, 64, 800, FONTE_NUM);

  // grade 4x4
  const q = historico.map((h) => (h.acertou ? "#3fbf5a" : "#e5484d"));
  if (como === "parou") q.push("#f2c230");
  while (q.length < 16) q.push("rgba(255,255,255,0.14)");
  const lado = 76, gap = 14, gx = 150, gy = 1450;
  q.forEach((cq, i) => {
    retanguloRedondo(ctx, gx + (i % 4) * (lado + gap), gy + Math.floor(i / 4) * (lado + gap), lado, lado, 14);
    ctx.fillStyle = cq; ctx.fill();
  });

  // o Dadao do lado da grade
  const dadao = await carregarImagem("img/dadao.svg");
  if (dadao) ctx.drawImage(dadao, 600, 1440, 320, 386);

  ctx.fillStyle = "#c8ff00"; ctx.font = `700 40px ${FONTE_TXT}`;
  ctx.fillText("temdadoemcasa.github.io", STORY_W / 2, 1880);

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

// compartilha a imagem (celular) ou baixa o arquivo (computador)
async function compartilharStory(dados) {
  const blob = await desenharStory(dados);
  if (!blob) return "erro";
  const arquivo = new File([blob], "show-do-dadao.png", { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo] });
      return "compartilhou";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelou";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "show-do-dadao.png";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "baixou";
}
