#!/usr/bin/env bash
# Afina uma dificuldade: 400 ao acaso + 400 maior nota + 200 inteligente. Uso: dificuldade.sh <facil|normal|dificil>
set -e
cd "$(dirname "$0")"
[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null
SAIDA=${SAIDA:-${TMPDIR:-/tmp}/bateria-draft}/dificuldade-$1
mkdir -p "$SAIDA"
node -e 'const E=["4-3-3","4-2-3-1","4-4-2","4-1-4-1","3-5-2","3-4-3","5-3-2","3-4-2-1"]; const d=process.argv[1]; const p=[];
for (const [b,pol,n] of [["A_aleatorio","aleatorio",400],["B_melhor","melhor",400],["S_inteligente","inteligente",200]]) for(let k=0;k<n;k++) p.push({bloco:b,politica:pol,esquema:E[k%8],continental:k%2?"sul":"lib",dificuldade:d,decisao:"padrao"});
require("fs").writeFileSync(process.argv[2],JSON.stringify(p));' $1 "$SAIDA/plano.json"
for s in 0 1 2 3; do node sim.js "$SAIDA/plano.json" $((s*250)) $(((s+1)*250)) "$SAIDA/p$s.jsonl" & done; wait
cat "$SAIDA"/p*.jsonl > "$SAIDA/tudo.jsonl"; rm -f "$SAIDA"/p*.jsonl
node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse); const q=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(p*s.length)]}; const m=(g,f)=>(g.reduce((s,x)=>s+f(x),0)/g.length);
for (const b of ["A_aleatorio","B_melhor","S_inteligente"]) {const g=L.filter(x=>x.bloco===b); console.log(process.argv[2], b.padEnd(14),"pos med",q(g.map(x=>x.pos),.5),"pts",m(g,x=>x.pts).toFixed(1),"campeão BR",(100*m(g,x=>x.tituloBra?1:0)).toFixed(1)+"%","Z4",(100*m(g,x=>x.pos>=17?1:0)).toFixed(1)+"%");}' "$SAIDA/tudo.jsonl" "$1"
