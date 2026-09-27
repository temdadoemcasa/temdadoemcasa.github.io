const fs=require("fs");
for (const nome of process.argv.slice(2)) {
  const dir=(process.env.SAIDA||(process.env.TMPDIR||"/tmp")+"/bateria-draft")+"/exp"; const L=fs.readFileSync(`${dir}/${nome}/tudo.jsonl`,"utf8").trim().split("\n").map(JSON.parse);
  const S=(k)=>L.reduce((s,x)=>s+x.liga[k],0), J=S("jogos"); const m=(xs)=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const q=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(p*s.length)];};
  console.log(`[${nome}] gols/j ${(S("gols")/J).toFixed(2)} casa ${(100*S("casa")/J).toFixed(1)}% emp ${(100*S("emp")/J).toFixed(1)}% fora ${(100*S("fora")/J).toFixed(1)}% 0x0 ${(100*S("zz")/J).toFixed(1)}% | campeao ${m(L.map(x=>x.tabela[0][1])).toFixed(1)} 4o ${m(L.map(x=>x.tabela[3][1])).toFixed(1)} 17o ${m(L.map(x=>x.tabela[16][1])).toFixed(1)} lanterna ${m(L.map(x=>x.tabela[19][1])).toFixed(1)}`);
  for (const b of ["aleatorio","melhor","pior"]) { const g=L.filter(x=>x.bloco===b); const n=g.length;
    console.log(`   ${b.padEnd(9)} ovr ${m(g.map(x=>x.mediaOnze)).toFixed(1)} pos med ${q(g.map(x=>x.pos),.5)} BR ${(100*g.filter(x=>x.tituloBra).length/n).toFixed(1)}% G6 ${(100*g.filter(x=>x.pos<=6).length/n).toFixed(1)}% Z4 ${(100*g.filter(x=>x.pos>=17).length/n).toFixed(1)}% algum titulo ${(100*g.filter(x=>x.tituloBra||x.tituloCdb||x.tituloLib||x.tituloSul).length/n).toFixed(1)}%`); }
}
