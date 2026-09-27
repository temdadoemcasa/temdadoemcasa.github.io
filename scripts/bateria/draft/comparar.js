// compara tentativa a tentativa (mesma semente): posicao, pontos, tabela e campeoes
const fs = require("fs");
const ler = (f) => new Map(fs.readFileSync(f, "utf8").trim().split("\n").map(JSON.parse).map((x) => [x.i, x]));
const [a, b] = process.argv.slice(2).map(ler);
let iguais = 0, tabIgual = 0, campIgual = 0, draftIgual = 0;
const norm = (x, c) => (x.campeoes[c] === x.usuarioId ? "EU" : x.campeoes[c]);
for (const [i, x] of a) {
  const y = b.get(i);
  if (JSON.stringify(x.draft) === JSON.stringify(y.draft)) draftIgual++;
  if (x.pos === y.pos && x.pts === y.pts) iguais++;
  if (JSON.stringify(x.tabela) === JSON.stringify(y.tabela)) tabIgual++;
  if (["bra", "cdb", "lib", "sul"].every((c) => norm(x, c) === norm(y, c))) campIgual++;
}
console.log(`n=${a.size} draft identico ${draftIgual} | pos+pts do usuario identicos ${iguais} | tabela BR identica ${tabIgual} | 4 campeoes identicos ${campIgual}`);
