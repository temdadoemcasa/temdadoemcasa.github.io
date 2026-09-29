// sonda: data-fifa (texto fala de Brasileirao) mostrada com o jogador no exterior / Serie B-D
const fs=require("fs"),path=require("path"),vm=require("vm");
const { carregarJogo, criarPrng } = require("./ambiente");
(async()=>{
 const { ctx, prng } = await carregarJogo(1);
 vm.runInContext(fs.readFileSync(path.join(__dirname,"dentro.js"),"utf8"),ctx,{filename:"dentro.js"});
 vm.runInContext(`globalThis.SONDA={};for(const id of ["data-fifa","salario-atrasado","sondagem"]){const e=EVENTOS.find(x=>x.id===id);const t=e.texto;e.texto=(J)=>{const k=id+":"+(J.clube.tipo==="ext"?"exterior":"Serie "+J.clube.divisao);SONDA[k]=(SONDA[k]||0)+1;return t(J);};}`,ctx);
 for(let i=1;i<=400;i++) ctx.rodarCarreira({semente:i,pol:"aleatoria",modo:"completo",rngPol:criarPrng(i*7919+17),rngJog:prng,capturar:()=>{}});
 console.log(vm.runInContext("SONDA",ctx));
})();
