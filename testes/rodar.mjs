// Roda todos os testes de navegador (Playwright) contra o site servido em BASE.
//   python3 -m http.server 8766 &   (na raiz do repo)
//   node testes/rodar.mjs            (ou: node testes/rodar.mjs home prata-da-casa)
// Cada teste imprime "OK" ou "FALHA" por checagem; qualquer FALHA ou erro sai com codigo 1.
import { spawn } from "node:child_process";
import { readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pasta = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(pasta, "resultados"), { recursive: true });
const pedidos = process.argv.slice(2);
const testes = readdirSync(pasta)
  .filter((f) => f.endsWith(".mjs") && f !== "rodar.mjs")
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((n) => !pedidos.length || pedidos.includes(n))
  .sort();

const rodar = (nome) => new Promise((ok) => {
  const inicio = Date.now();
  const p = spawn(process.execPath, [path.join(pasta, `${nome}.mjs`)], { stdio: ["ignore", "pipe", "pipe"] });
  let saida = "";
  p.stdout.on("data", (d) => (saida += d));
  p.stderr.on("data", (d) => (saida += d));
  const limite = setTimeout(() => p.kill("SIGKILL"), 8 * 60 * 1000);
  p.on("close", (codigo) => {
    clearTimeout(limite);
    const falhas = saida.split("\n").filter((l) => l.startsWith("FALHA"));
    const oks = saida.split("\n").filter((l) => l.startsWith("OK")).length;
    ok({ nome, codigo, saida, falhas, oks, s: ((Date.now() - inicio) / 1000).toFixed(0) });
  });
});

let quebrou = false;
for (const nome of testes) {
  const r = await rodar(nome);
  const passou = r.codigo === 0 && !r.falhas.length && r.oks > 0;
  console.log(`${passou ? "✔" : "✘"} ${nome}: ${r.oks} ok, ${r.falhas.length} falha(s), ${r.s}s`);
  if (!passou) {
    quebrou = true;
    console.log(r.saida.trim().split("\n").map((l) => "    " + l).join("\n"));
    // no GitHub Actions a falha vira anotacao (aparece no PR, sem abrir o log)
    if (process.env.GITHUB_ACTIONS) {
      const linhas = r.falhas.length ? r.falhas : r.saida.trim().split("\n").slice(-6);
      const msg = linhas.join(" / ").replace(/%/g, "%25").replace(/\r?\n/g, " ").slice(0, 900);
      console.log(`::error file=testes/${nome}.mjs,title=${nome}::${msg}`);
    }
  }
}
process.exit(quebrou ? 1 : 0);
