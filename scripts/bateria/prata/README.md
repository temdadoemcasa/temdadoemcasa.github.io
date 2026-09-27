# Bateria do Prata da Casa

Joga carreiras inteiras do Prata da Casa em Node, sem navegador, e mede o resultado: desfechos, cobertura das situações, escolhas, textos quebrados e exceções. O relatório da auditoria está em `docs/bateria-prata-da-casa.md`.

- Precisa só de Node 18 ou mais novo. Não tem `npm install` e não usa jsdom: o DOM é um stub escrito à mão, em `ambiente.js`.
- Carrega os arquivos do site direto da raiz do repo: `app.js`, `motor.js`, `historia.js`, `escudos.js`, `carreira.js` e `dados/*.json`. Uma mudança no jogo entra na próxima rodada sem precisar de build.
- Troca o `Math.random` do jogo por um gerador com semente (mulberry32). A mesma semente dá sempre o mesmo jogador e a mesma carreira.

## Rodar

Os comandos saem da raiz do repo:

```bash
scripts/bateria/prata/bateria.sh                 # 5.000 carreiras + extras, até 4 processos, ~10 min
SEMENTE_C=20001 SEMENTE_R=30001 BATERIA_OUT=/tmp/novo scripts/bateria/prata/bateria.sh   # conjunto de sementes novo
node scripts/bateria/prata/metas.js /tmp/depois /tmp/depois   # metas da fase 2 (PASSA/FALHA)
BATERIA_OUT=/tmp/depois scripts/bateria/prata/bateria.sh   # escolhe a pasta de saída
node scripts/bateria/prata/comparar.js /tmp/antes /tmp/depois   # antes x depois (mesmas sementes)
node scripts/bateria/prata/rodar.js gulosa completo 42 1 /tmp/uma.jsonl   # uma carreira só
node scripts/bateria/prata/sonda.js              # exemplo de sonda: onde a "Data FIFA" aparece
```

A saída vai para fora do repo. A pasta é `$BATERIA_OUT`, e por padrão `$TMPDIR/bateria-prata-da-casa`. Nela ficam:

- um `.jsonl` por política e modo, com uma carreira por linha;
- `tabelas.md`, com todas as tabelas;
- `resumo.json`.

Não commite os `.jsonl`: somam uns 18 MB.

## O que cada arquivo faz

- `ambiente.js`: DOM falso, `fetch` que lê do disco e `Math.random` com semente. Guarda todo texto que o jogo mostraria na tela.
- `dentro.js`: roda dentro do escopo do jogo e repete o caminho dos botões, sem animação: `avancarCompleto` → `iniciarRolagem` → `mostrarDecisao` → `fecharTemporadaCompleta` → `mostrarMercado`. No modo rápido, também repete a decisão de salto de degrau. Chama `ladosDaOpcao` em toda opção certa e confere que ela não mexe no estado. Define as políticas de escolha. As 5 da bateria:
  - aleatória;
  - gulosa: melhor nota e fama no ano, pela `projecao()`;
  - cautelosa: menor risco;
  - primeira opção;
  - impaciente: joga de 2 a 7 anos e depois clica "Simular o resto".

  Mais duas, fora das 5.000:
  - estratégica: a gulosa olhando também o longo prazo (evolução, fôlego, marcas), com mercado ambicioso e com critério;
  - pior: a opção de menor valor em toda decisão, só pra medir quanto as escolhas pesam;
  - assina: decide ao acaso, mas no mercado clica "Assinar" sempre que pode (mede os contratos).
- `rodar.js`: roda N carreiras e grava um `.jsonl`.
- `agregar.js`: gera `tabelas.md` e `resumo.json`.
- `comparar.js`: compara duas baterias rodadas com as mesmas sementes.
- `metas.js`: confere as metas A a H com números e imprime PASSA ou FALHA.
- `e2e.js`: desenha a janela de transferências de verdade em cada estado e lista os botões (`node scripts/bateria/prata/e2e.js`).

## Ao mexer no jogo

- **Situação nova em `EVENTOS`:** o `agregar.js` lê os ids do próprio `carreira.js` e já inclui a situação no catálogo de cobertura.
- **Cena nova de arco (`historia.js`):** acrescente o título em `ARCOS` (`agregar.js`). Se ela for uma consequência agendada, acrescente também em `TITULO_CONSEQ` (`dentro.js`).
- **Novo passo na tela** (outro botão ou outra janela): replique o passo em `dentro.js`. Sem isso, a bateria deixa de representar o jogo.
