#!/usr/bin/env bash
# Meta 4 por componente, pareado (mesma semente, mesmo draft "humano"): padrao (sempre
# Equilibrado, sem janela), so postura, so janela, so esquema, postura+janela e tudo.
# Uso: decisoes.sh [n por variante=400]   (REPO_DIR e SAIDA como no rodar.sh; 4 processos)
set -e
cd "$(dirname "$0")"
[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null
SAIDA=${SAIDA:-${TMPDIR:-/tmp}/bateria-draft}/decisoes
N=${1:-400}
mkdir -p "$SAIDA"
node -e 'const E=["4-3-3","4-2-3-1","4-4-2","4-1-4-1","3-5-2","3-4-3","5-3-2","3-4-2-1"]; const n=+process.argv[1]; const p=[];
for (const d of ["padrao","postura","janela","esquema","semEsquema","bom"]) for(let k=0;k<n;k++) p.push({bloco:"T_"+d,politica:"humano",esquema:E[k%8],continental:k%2?"sul":"lib",dificuldade:"normal",decisao:d,par:900000+k});
require("fs").writeFileSync(process.argv[2],JSON.stringify(p));' $N "$SAIDA/plano.json"
T=$((N*6)); Q=$(( (T+3)/4 ))
for s in 0 1 2 3; do node sim.js "$SAIDA/plano.json" $((s*Q)) $(( (s+1)*Q<T?(s+1)*Q:T )) "$SAIDA/p$s.jsonl" & done; wait
cat "$SAIDA"/p*.jsonl > "$SAIDA/tudo.jsonl"; rm -f "$SAIDA"/p*.jsonl
node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse); const m=(g,f)=>g.reduce((s,x)=>s+f(x),0)/g.length;
const base=L.filter(x=>x.bloco==="T_padrao"); const tit=x=>x.tituloBra||x.tituloCdb||x.tituloLib||x.tituloSul?1:0;
for (const b of [...new Set(L.map(x=>x.bloco))]) { const g=L.filter(x=>x.bloco===b); console.log(b.padEnd(14),"pts",m(g,x=>x.pts).toFixed(1),"(Δ",(m(g,x=>x.pts)-m(base,x=>x.pts)).toFixed(1)+")","algum título",(100*m(g,tit)).toFixed(1)+"% (Δ",(100*(m(g,tit)-m(base,tit))).toFixed(1)+"pp)","BR",(100*m(g,x=>x.tituloBra?1:0)).toFixed(1)+"%"); }' "$SAIDA/tudo.jsonl"
