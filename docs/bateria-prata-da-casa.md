# Prata da Casa: auditoria com 5.000 carreiras automáticas (bateria)

Data: 26/09/2026 · repo auditado: `temdadoemcasa.github.io` (branch/estado de hoje, sem nenhuma alteração) · harness em `scripts/bateria/prata/` · tabelas geradas pela bateria em `$TMPDIR/bateria-prata-da-casa/tabelas.md`.

## 0. Resumo em 10 linhas

1. **0 exceções, 0 travamentos, 0 NaN/`undefined` na tela, 0 situação repetida** em 5.000 carreiras (+1.400 do experimento extra). O motor é robusto.
2. **Todas as 96 situações do catálogo apareceram** pelo menos uma vez (61 de `EVENTOS`, 34 cenas dos 12 arcos e o foco). Nenhuma rota é inalcançável; a mais rara é "Seu nome numa investigação" (1,9% das carreiras).
3. **Bug grave:** `projecao()` (carreira.js:2419) chama `Historia.aplicarReputacao` sobre o objeto real e **decai a reputação 20% a cada recálculo** (a cada decisão, a cada lesão). Com 3 decisões, a reputação encolhe ~67% por ano em vez de 20%. Quando corrigido (mesmas sementes), a soma de |reputação| no fim da carreira dobra (1,31 → 3,09 na gulosa) e a Europa sobe de 8,3% para 11,0%.
4. **A estratégia dominante é não sair da Série B/C/D.** Quem fica (cautelosa, modo completo) ganha 14,8 prêmios por carreira contra 5,0 da gulosa, tem auge maior (84,6 contra 83,2) e ainda vai pra seleção (78,9%). Das 937 carreiras só em B/C/D, saíram **14 Bolas de Ouro**.
5. **As escolhas quase não mexem no OVR.** O potencial sorteado explica quase tudo: o auge varia no máximo 1,3 ponto entre as políticas dentro da mesma faixa de potencial. No modo rápido as 5 políticas terminam praticamente iguais (auge de 82,3 a 83,0, de 2,9 a 3,4 prêmios).
6. **A política gulosa (a melhor escolha imediata) não ganha da aleatória** no pareado (11,1% contra 10,1% de "melhor carreira"). **45 situações têm uma opção dominante**, escolhida pela gulosa em pelo menos 95% das vezes.
7. **O automático ("Simular o resto") resolve as consequências pela 1ª opção, que é a mais arriscada** ("Responde nas redes" 36% de acerto, "Critica o técnico ao vivo" 33%, "Aceita o palco" 50%). O comentário no código diz o contrário ("a mais comum").
8. "Topa voltar" (clube formador): **só 16% dos jogadores voltaram de fato**, porque a promessa não garante a transferência.
9. O texto de "Data FIFA com o **Brasileirão** rolando" aparece em 48% das vezes com o jogador no exterior ou na Série B/C.
10. O limite de arcos funciona: 68% das carreiras chegam ao teto de 8 arcos (3 de abertura + 5). Nenhuma consequência se perde pelo limite de 2 por ano.

---

## 1. Como o jogo funciona (mecânica)

**Criação.** Posição (12 vagas, 8 funções), nacionalidade, 30 pontos de 5 em 5 (no máximo 15 por atributo, teto de 77) e modo *Rápido* ou *Completo*. Um **potencial escondido** é sorteado por faixa (`FAIXAS_POTENCIAL`, carreira.js:3034): 52% entre 76 e 82, 30% entre 83 e 88, 10% entre 89 e 92, 6% entre 93 e 95, 1% entre 97 e 99. A idade de pico sai entre 28 e 31 (goleiro, entre 33 e 35).

**Peneira.** Três propostas: D, C e C ou B. A chance de B cresce com o OVR. Resultado da bateria: 68% BCD, 32% CCD.

**Temporada.** Sequência de `avancarCompleto` → `sortearEventos` → decisões → `jogarTemporada`:
- **Decisões na tela.** Rápido: 1 situação (35% das vezes vira só o foco). Completo: foco + 2 situações. Os arcos de `historia.js` entram primeiro (consequências vencidas, no máximo 2; o arco que abre a fase; às vezes um arco novo). Medido: 1,07 decisão por ano no rápido e 2,97 no completo.
- **Cada opção** é `sempre` (efeito certo) ou `chance` (roleta com a porcentagem real). O efeito cai em `J.efeito` (minutos, nota, vitrine, lesão, evolução, queda, gol, assistência, suspensão) e/ou na **reputação** (técnico, cabeça/disciplina, torcida, vestiário, imprensa, de -5 a +5).
- **Reputação → temporada** (`Historia.aplicarReputacao`, historia.js:68). O técnico pesa nos minutos (±0,12 a 0,15). A cabeça pesa na nota, na evolução e na lesão. A torcida pesa na nota e na vitrine. O vestiário, nos minutos e na evolução. A imprensa, na vitrine. Depois de aplicar, **decai 20%**.
- **Simulação.** Na Série A roda o motor completo (Brasileirão, copas, Libertadores). Nas divisões de baixo e no exterior, uma liga abstrata. Minutos = chance de titular (OVR contra o titular real da posição) + efeitos. Gols e assistências saem dos atributos. A nota sai do OVR contra o nível da liga.
- **Fim do ano.** Prêmios (limiares por nota e gols; Bola de Ouro por OVR + nota + títulos − penalidade de prestígio), acesso ou queda, **evolução** (puxada pela trajetória até o potencial e pelos minutos), mercado (`propostasDoAno`: interesse por OVR contra nível, vitrine e sorte do olheiro; sobe no máximo 1 degrau por vez, 2 com olheiro). No rápido a transferência é automática (`decidirTransferencia`). No completo o jogador escolhe: fica, renova (2 de 3 contratos), assina ou pede garantia de titular.
- **Fim da carreira.** Não há "game over". A carreira acaba na aposentadoria: chance anual a partir de pico + 4 anos (goleiro, + 3), mais chance se o OVR cair, obrigatória aos 40 (goleiro, 42). Medido: mediana de 36 anos, p5 de 33 a 34, p95 de 38 a 40, ~20 temporadas. Aposentadoria forçada em só 0,7% a 1,5% das carreiras.

**Os "finais"** são a tela de aposentadoria (números, títulos, prêmios, trilha "Sua história"). Para medir, classifiquei cada carreira pela faixa mais alta alcançada (tabela 3.1).

---

## 2. Bateria: políticas, sementes e como reproduzir

**Harness:** `scripts/bateria/prata/` (veja o README de lá).
- `ambiente.js`: DOM falso escrito à mão (Proxy, sem jsdom) que registra todo texto mostrado. `fetch` lê `dados/*.json` do disco. `Math.random` é trocado por mulberry32 com estado salvável. Carrega os scripts reais do site num `vm`.
- `dentro.js`: reproduz o fluxo dos botões sem animação (`avancarCompleto` → `iniciarRolagem` → `mostrarDecisao` → `fecharTemporadaCompleta` → `mostrarMercado`) e chama `mostrarLinha`/`mostrarAposentadoria` pra capturar os textos.
- `rodar.js`, `agregar.js`, `comparar.js`, `sonda.js`.

**Jogador.** Gerado pela semente: posição uniforme, 80% brasileiro, pontos distribuídos ao acaso. **As sementes são pareadas:** a mesma semente dá o mesmo jogador em todas as políticas.

**Políticas (1.000 carreiras cada: 700 no modo completo, sementes 1 a 700, e 300 no rápido, sementes 10001 a 10300):**

| política | decisões | peneira | mercado (completo) |
|---|---|---|---|
| **aleatória** | opção uniforme | aleatória | botão uniforme |
| **gulosa** ("nota/fama") | testa cada opção num clone do estado (ok e falha pesados pela chance) e maximiza 4·nota + 1,2·OVR + 0,5·vitrine + 4·minutos + 0,2·Σreputação, pela `projecao()` do próprio jogo | clube mais forte | assina a melhor proposta se valer mais que ficar; pede garantia se a chance de titular for menor que 60%; senão renova (aumento) |
| **cautelosa/oposta** | menor risco: `sempre` antes de `chance`, penalidade pra opção marcada "↻ consequência"; no empate, a última opção (a passiva) | maior chance de titular | fica e renova (contrato de ídolo); só sai se o time cair |
| **primeira** | sempre a opção 0 | 1ª proposta | 1º botão da tela (renovação, ou "Ficar") |
| **impaciente** (extra) | aleatória por 2 a 7 temporadas, depois "Simular o resto da carreira" | aleatória | aleatória, depois automática |

**Reproduzir** (da raiz do repo, Node 18+, sem `npm install`):

```bash
scripts/bateria/prata/bateria.sh          # 10 jobs, xargs -P 4; ~6 min; saída em $TMPDIR/bateria-prata-da-casa
node scripts/bateria/prata/comparar.js <pasta-antes> <pasta-depois>
node scripts/bateria/prata/rodar.js gulosa completo 42 1 /tmp/uma.jsonl
```

Os números das seções 0 a 5 são do código **antes** das correções (commit de 26/09). O experimento "sem o bug da projeção" usou uma opção de `rodar.js` (`--sem-bug-projecao`) que pula as chamadas extras a `projecao`. A seção 6 traz o depois.

**Limites do método.** A gulosa é míope (só olha o ano corrente pela `projecao`). Ela não vê consequência futura: por isso nunca aceita o aliciador, mas também não "planeja". A classificação dos desfechos é minha. O jogo não tem finais nomeados.

---

## 3. Resultados

### 3.1 Desfechos por política (5.000 carreiras)

| política | modo | temporadas | idade fim p5-p50-p95 | OVR auge | auge≥90 | títulos clube | prêmios | Bola de Ouro | seleção | jogou Europa | só Série B-D |
|---|---|---|---|---|---|---|---|---|---|---|---|
| aleatória | completo | 20,0 | 34-36-40 | 83,0 | 14,1% | 2,8 | 6,6 | 3,7% | 64,7% | 10,7% | 0,9% |
| gulosa | completo | 20,0 | 33-36-39 | 83,2 | 14,7% | **4,2** | 5,0 | **6,0%** | 67,0% | 8,3% | 0% |
| cautelosa | completo | 20,1 | 34-36-39 | **84,6** | **17,0%** | 0,7 | **14,8** | 1,7% | **78,9%** | 0% | **82,7%** |
| primeira | completo | 20,1 | 33-36-40 | 83,4 | 14,9% | 1,2 | 12,3 | 1,6% | 70,0% | 0% | 50,3% |
| impaciente | completo | 20,0 | 34-36-39 | 83,0 | 14,7% | 3,9 | 4,0 | 4,9% | 63,7% | 9,4% | 0% |
| (todas) | rápido | 19,8-19,9 | ~34-36-39 | 82,3-83,0 | 10,7-13,0% | 3,4-3,8 | 2,9-3,4 | 4,0-5,7% | 58,7-63,7% | 8,3-10,7% | 0% |

Faixa mais alta alcançada (todas as 1.000 de cada política):

| política | Bola de Ouro | Elite europeia | Europa | Série A / exterior | Só Série B-D |
|---|---|---|---|---|---|
| aleatória | 4,1% | 5,5% | 2,9% | 86,9% | 0,6% |
| gulosa | 5,9% | 4,4% | 0,7% | 89,0% | 0,0% |
| cautelosa | 2,6% | 2,3% | 0,1% | 38,0% | 57,0% |
| primeira | 2,5% | 1,5% | 0,0% | 61,3% | 34,7% |
| impaciente | 4,6% | 5,4% | 0,8% | 89,2% | 0,0% |

**Pareado (mesmo jogador).** A política com a "melhor carreira" do grupo (score = prêmios + 0,5·títulos + 0,5·(auge−70) + 3 se jogou na Europa + 10·Bolas de Ouro) foi: cautelosa 55%, primeira 23%, gulosa 11%, aleatória 10%, impaciente 9%.

**O dado pesa mais que as escolhas.** Auge médio por faixa de potencial: 76-82 → 78,6 a 79,9; 83-88 → 85,0 a 86,4; 89-92 → 90,0 a 91,2; 93-99 → 94,3 a 95,2. Dentro de cada faixa, a diferença entre políticas é de ~1 ponto, sempre a favor da cautelosa, porque ficar no clube rende +0,3 de evolução ao ano de entrosamento e mais minutos.

### 3.2 Estratégias dominantes

- **Ficar na divisão de baixo é o melhor negócio.** As 937 carreiras só em B/C/D fizeram 14,8 prêmios e 84,2 de auge, contra 6,3 e 83,2 do resto no modo completo. Ainda somaram 77% de convocação e 55 jogos de seleção em média (contra 41 do resto) e 14 Bolas de Ouro. Causas no código:
  - Prêmios de liga ("Melhor X da Série C", "Craque da Série D", artilharia) têm o mesmo limiar de nota em qualquer divisão (carreira.js:1156-1158). A nota é maior contra liga fraca (`tanh((OVR − nivelLiga)/12)`).
  - A convocação (carreira.js:1015-1016) só olha OVR e minutos, e não o nível da liga.
  - A Bola de Ouro (carreira.js:1165-1175) penaliza o prestígio em só 1,3·(5 − prestígio), ~6,2 pontos na Série D, o que um OVR 95 com nota 9 supera.
- **O modo rápido quase apaga as escolhas.** Com a transferência automática, as 5 políticas terminam com números praticamente iguais. A única decisão que realmente mexe na carreira é o mercado.
- **"Primeira opção" no completo nunca transfere.** O 1º botão da janela é sempre renovar ou ficar (carreira.js:2820 e seguintes). Não é bug, mas reforça o viés de ficar.
- **45 situações com opção dominante** (a gulosa escolhe a mesma em pelo menos 95% das vezes; lista completa no `tabelas.md` da bateria). As mais gritantes:
  - **"Primeira semana no alojamento" → "Chega uma hora antes"** (100%): Cabeça +1, Técnico +1, +0,5 de evolução, a chance extra da oportunidade, e nenhum custo.
  - **"Primeiro salário" → "Tira a família do aluguel"** (100%): Cabeça +1, Torcida +1, +0,05 de nota, sem custo. "Guarda quase tudo" é estritamente pior.
  - **"O aliciador" → "Mostra pro clube"** (100%), **"O grupo da infância" → "Sai do grupo"** (100%): o jogo não oferece nenhuma tentação real.
  - **"Psicóloga" → "Faz as sessões"**, **"Filho" → "Pede folga"**, **"Idioma" → "Faz as aulas"**, **"Saudade" → "Traz a família"**, **"Viral" → "Posta mais"**, **"Invasão" → "Dá a camisa"**, **"Escola" → "Vai"**, **"Padrinho" → "Vira padrinho"**, **"Garoto da base" → "Ensina tudo"**, **"Conversa sobre o futuro" → "Curso de treinador"**: a opção "boa" tem efeito positivo sem contrapartida. A alternativa passiva dá só +0,03 de nota.
  - **"Pênalti contra no último lance"**: "Escolhe um canto" (30% fixo) perde sempre para "Espera" (de 20% a 50% com o reflexo). Mesma recompensa em ordem de grandeza e mais risco.
- **Escolhas com dilema real** (a gulosa divide entre 35% e 65%): provocação do rival, reencontro, férias, massa muscular, ídolo auxiliar, goleiro-saída, "A final e o joelho", "Fica com o técnico". Esse é o padrão a copiar.

### 3.3 Cobertura

- **Nunca alcançadas: nenhuma.** As 61 situações de `EVENTOS`, as 34 cenas dos 12 arcos e o foco apareceram.
- **Raras (menos de 5% das carreiras):** "Seu nome numa investigação" 1,9%, "Ele voltou" 2,3%, estreia 2,6%, "A torcida cobra" 2,9%, "A braçadeira" (arco) 3,1%, convocação sub-20 (`base`) 4,3%, "A diretoria chamou" 5,0%. Causas:
  - `estreia` exige nenhum jogo antes dos 17 (carreira.js:1649), mas quase todo mundo joga aos 16. A estreia chega depois da estreia.
  - `base` exige OVR 66 até os 19 (carreira.js:1604).
  - O arco **A renovação** aparece em só 7,8% das carreiras: peso 1 contra 3 a 5 dos outros, e disputa com o teto de 5 arcos, que já está cheio.
- **Super-representadas:** "Primeira semana no alojamento" 100% e "Primeiro salário" 93% (aberturas, por desenho), "O corpo" 80% e "Conversa sobre o futuro" 76%. Em seguida, os arcos de aposta: grupo 66%, dinheiro curto 66%, aliciador 52%. **Três arcos de apostas aparecem em mais da metade das carreiras**, o que deixa a história repetitiva de uma partida pra outra.
- **Pares temáticos redundantes** (a mesma pessoa vive os dois na mesma carreira):
  - "O preparador físico tem um plano" (`veterano`) + "O corpo começou a cobrar": 100% de quem viu o 1º. Os dois oferecem gestão de carga.
  - `classico` (provocação do camisa 10 rival) + "Gol no clássico": 84%. `classico` + arco do rival: 49%.
  - `dor`/`aquecimento` (jogar machucado) + "A final e o joelho": 56%. O `tema: "machucado"` não vale entre carreira.js e historia.js.
  - `padrinho` + "O garoto da base": 25%.

### 3.4 Loops e repetição

- **0 carreiras com a mesma situação duas vezes.** A promessa "nenhuma situação se repete" é cumprida.
- O **foco da pré-temporada** aparece em média 12,7 vezes por carreira (máximo 26). É a única repetição. A 1ª opção do foco é sempre o atributo que mais pesa: Defesa (15.356 escolhas) e Ritmo (13.024) dominam.
- Nenhum loop infinito: o `guarda` de `evoluir` e os `while` nunca estouraram. O tempo máximo foi de 590 ms por carreira.

### 3.5 Textos, erros e travas

- **Textos quebrados: 0.** Varri todo texto mostrado (tela de temporada, painel, aposentadoria, títulos, opções, resultados; ~1.100 textos por carreira) procurando `undefined`, `NaN`, `null`, `[object`, `Infinity`, `${`, vazio e espaço antes de pontuação.
- **Incoerência de texto:** "Data FIFA com o Brasileirão rolando" (carreira.js:2070) apareceu com o jogador no exterior (57 de 155) ou na Série B/C (18 de 155), na sonda de 400 carreiras.
- **Exceções: 0.** Chances fora de [0, 1]: 0. Eventos sem opção: 0. Temporadas acima de 40: 0.

### 3.6 Consequências e arcos

- **Consequências vencidas e mostradas:** 100% para as 13 incondicionais. As que somem, somem por regra (trocou de clube): `cobranca` 35%, `racha` 12,5%, `reencontro` 3,6%, `bracadeira` 1,3%. **Nenhuma se perdeu pelo teto de 2 por ano** nesta bateria.
- **Arcos por carreira:** média 6,8; **68% batem o teto de 8** (3 de abertura + `ARCOS_POR_CARREIRA = 5`, historia.js:588).
- **Marcas que nunca são lidas** (setadas e nunca consultadas): `aproveitou`, `aliciado`, `denunciou`, `respondeu`, `fiel`, `joelho`, `bairro`, `ostentacao`, `noite`, `escolheu`, `futuro_tecnico`. Só servem de enfeite. `futuro_tecnico` fica em 47% das carreiras e não muda nada, nem no relatório final.
- **"Simular o resto"** (política impaciente) resolve pela 1ª opção. As mais frequentes: "Rompe a multa" ×69, **"Aceita o palco" ×56**, **"Responde nas redes" ×54**, **"Critica o técnico ao vivo" ×37**, **"Encara no mano a mano" ×27**. Quatro das cinco primeiras são as opções provocativas ou de risco.
- **"Topa voltar":** de 202 carreiras que toparam, só 33 (16%) voltaram ao clube formador. A proposta chega, mas ainda precisa ser aceita na janela, e o automático (`decidirTransferencia`) costuma recusar um clube menor. Se o jogador está sob contrato, `propostasDoAno` sai antes de consumir `voltarPara` (carreira.js:1195 contra 1236).

### 3.7 Mercado

- Garantia de titular: aceita 55% a 64% das vezes, recusada ~20%, clube desiste ~16%.
- Empréstimo acontece em 5,2% das carreiras. A gulosa aceita 98% das vezes.
- A cautelosa renovou "contrato de ídolo" 3.361 vezes. Com renovação em sequência, o jogador **nunca recebe proposta** (`sobContrato` fecha a janela) e fica preso na Série C, o que acaba sendo a melhor carreira (item 3.2).

### 3.8 Experimento extra: bug da projeção corrigido (mesmas sementes, fora das 5.000)

| política | variante | Σ\|reputação\| no fim | auge | prêmios | títulos | jogou Europa |
|---|---|---|---|---|---|---|
| aleatória | jogo atual | 1,03 | 83,00 | 6,65 | 2,76 | 10,7% |
| aleatória | sem o bug | 1,86 | 83,01 | 6,91 | 2,74 | 11,1% |
| gulosa | jogo atual | 1,31 | 83,17 | 4,98 | 4,22 | 8,3% |
| gulosa | sem o bug | **3,09** | 83,49 | 5,28 | 4,38 | **11,0%** |

---

## 4. O que o doc promete × o que o código faz

| doc (`docs/prata-da-casa-escolhas.md`) | código / medido | veredito |
|---|---|---|
| "Nenhuma situação se repete na mesma carreira", exceto o foco | 0 repetições em 5.000 | ✅ |
| Medidores de -5 a +5 que pesam na temporada | Pesam, mas **decaem de 60% a 70% ao ano no modo interativo** (bug da `projecao`) | ❌ prometido "decai 20% ao ano" |
| "Técnico zera quando você troca de clube" | Zera na transferência. **Não zera no empréstimo nem na volta** (carreira.js:2046, 1372) | ⚠️ |
| "Vestiário cai pela metade ao trocar de clube" | `assinar` multiplica por 0,3 (carreira.js:736) **e** `Historia.novoClube` divide por 2 (historia.js:62): sobram ~15% | ❌ |
| "A projeção do ano já conta esses medidores" | Conta, mas recalcular a projeção **altera** o estado real | ❌ |
| Fase 1: rotina aos 16 → oportunidade / bairro → diretoria | Tudo alcançável (100% / 87% / 13% / 5%) | ✅ |
| "M -.->|marca: divulgou bet| AL" (aposta atrai o aliciador) | Peso +1,5/+2/+1 (historia.js:125). O aliciador aparece em 52% das carreiras | ✅ (talvez forte demais) |
| Fase 2 inteira (grupo, STJD, aliciador, polêmico, microfone, personagem) | Todas as cenas alcançadas. "Seu nome numa investigação" é rara (1,9%) | ✅ |
| Fase 3: "O vestiário contra o técnico", "renovar", rival, joelho | Tudo alcançável. A renovação é rara (7,8%) | ✅ |
| Fase 4: "Curso de treinador → marca futuro técnico" | A marca é gravada e **nunca usada** | ⚠️ promessa vazia |
| "Foi mentorado aos 17 → o garoto da base te pede ajuda" (Fase 4, 31+) | Dispara aos **30** (historia.js:601), ainda no "Auge". E passa do limite de 2 eventos (vira 3 no modo rápido) | ⚠️ |
| "Entram as consequências que venceram (no máximo duas)" | Correto. As excedentes seriam descartadas sem aviso (historia.js:598), mas não aconteceu na bateria | ✅ (risco latente) |
| "Se a fase acabou de começar, entra o arco que abre a fase: rotina aos 16, contrato aos 19–21, corpo aos 31" | Correto (100% / 93% / 80%; os que faltam se aposentaram antes ou simularam) | ✅ |
| "No automático, a consequência resolve pela primeira opção" | Correto, mas a 1ª opção é a mais arriscada, não "a mais comum" | ⚠️ desenho |
| "Arco novo não começa no automático" | Correto | ✅ |
| Modo Rápido: "1 decisão por temporada" | 93% com 1 e 6,7% com 2 (arcos e `aprendiz` somam) | ⚠️ pequeno |
| Modo Completo: "Foco + 2 decisões" | 98% com 3 | ✅ |
| Doc não lista `EVENTOS` soltos da fase 2+ (dor, pênalti, festa...) | 61 situações soltas; o doc cita só as da base | ⚠️ doc incompleto |

---

## 5. Propostas, em ordem de prioridade

### P0: bugs

1. **[bug] A projeção decai a reputação real.** carreira.js:2419. Passar uma cópia: `Historia.aplicarReputacao({ efeito: J.efeito, historia: { ...Jreal.historia, rep: { ...Jreal.historia.rep } } })`. Outra saída: separar em `aplicarReputacao(J, { decair: false })` e fazer o decaimento só em `jogarTemporada` (carreira.js:1273). Impacto medido na tabela 3.8.
2. **[bug] Vestiário cortado duas vezes na transferência.** carreira.js:736 (×0,3) + historia.js:62 (÷2) = 15%. Manter só um. O doc diz "metade", então apagar a linha 736.
3. **[bug] Empréstimo e volta não trocam o técnico.** carreira.js:2046 e 1372 mudam `J.clube` sem `Historia.novoClube(J)` e sem custo de adaptação. Chamar o mesmo caminho de `assinar`, ou ao menos zerar `rep.tecnico`.
4. **[bug] "Topa voltar" não garante a volta.** carreira.js:2114 e 1236. Opções:
   - forçar a transferência no rápido (`decidirTransferencia` devolve a casa quando `J.voltarPara`) e destacar o cartão no completo;
   - mover o `if (J.voltarPara)` para antes do `return []` de `sobContrato` (carreira.js:1195).
   Hoje só 16% voltam.
5. **[bug] Reputação nunca chega a zero.** historia.js:83: `Math.round(v·0,8·10)/10` trava em ±0,2 (0,2·0,8 = 0,16 → 0,2). Usar `Math.trunc` ou zerar abaixo de 0,25.
6. **[bug] Estado da carreira anterior vaza.** "Nova carreira" (carreira.js:3023) não zera `C.tabelaAnterior`, e as vagas de Libertadores do 2º ano saem da carreira anterior. Zerar em `criarJogador`.
7. **[bug/texto] Data FIFA.** carreira.js:2070: trocar "com o Brasileirão rolando" por "com o campeonato rolando", ou usar `J.clube.liga` (48% das vezes o texto está errado).
8. **[bug menor] `estreia` quase nunca aparece antes da estreia.** carreira.js:1649: `!J.historico.some(h => h.jogos > 0)` só é verdade aos 16, com zero jogos. Trocar por "primeiro ano" (`J.historico.length === 0`) ou `jogos < 3`.

### P1: balanceamento (com números)

9. **[balance] Prêmios por divisão.** Somar ao limiar de nota dos prêmios de liga um degrau por divisão: `+0,35` na B, `+0,6` na C, `+0,8` na D, em "Melhor X", "Craque" e artilharia (carreira.js:1149-1158). Meta: carreira só em B-D com menos prêmios que a média (hoje 14,8 contra 6,3).
10. **[balance] Seleção exige vitrine.** Em `temporadaNaSelecao` (carreira.js:1015), multiplicar `chanceConvocar` por `{A: 1, ext: 1, B: 0,5, C: 0,2, D: 0,05}`. Hoje 77% de quem nunca saiu da B-D é convocado.
11. **[balance] Bola de Ouro fora da elite.** Trocar `(5 − prestígio)·1,3` por `·2,5`, ou exigir liga de prestígio ≥ 3. Hoje saem Bolas de Ouro da Série B/C/D (14 em 937).
12. **[balance] Tirar as opções dominantes.** Toda "opção certa" precisa de custo. Números sugeridos:
    - "Chega uma hora antes": `lesao +0,04` (sobrecarga) ou `nota −0,03`;
    - "Tira a família do aluguel": `evolucao −0,2` (menos dinheiro pra estrutura) ou `vitrine −0,5`; "Guarda quase tudo": `disciplina +2`;
    - "Faz as sessões / Traz a família / Faz as aulas / Pede folga": `minutos −0,02` a `−0,03` (tempo fora do campo);
    - "Mostra pro clube": `vestiario −1` (dedo-duro) com 30% de chance;
    - "Escolhe um canto" (goleiro): subir de 0,3 para 0,4 e recompensa de vitrine +4; ou atrelar a chance a SAI/REF.
    Critério: a gulosa deve escolher cada opção entre 25% e 75% das vezes.
13. **[balance] Automático pela opção prudente.** Em `resolverAutomatico` (historia.js:637), escolher a opção `sempre` de menor risco (ou marcar `auto: true` na opção desejada), em vez de `opcoes[0]`. Hoje o simulado "responde nas redes" e "critica o técnico ao vivo".
14. **[balance] Arcos de aposta.** Reduzir o peso de `grupo` (2 → 1) e o bônus do `aliciador`, ou tratar os três como um tema "apostas" com no máximo 2 por carreira. Hoje 3 dos 12 arcos são de aposta e 52% a 66% das carreiras passam por cada um.
15. **[balance] Arco "A renovação" raro (7,8%).** Peso 1 → 3 e liberar mesmo quando `anosNoClube = 0`, na fase Auge.
16. **[balance] Evolução e escolhas.** As decisões mexem ~1 ponto no auge. Para as escolhas de treino (foco, treino extra, férias, massa, ídolo) pesarem, subir o teto do efeito em `evoluir`: o `+ Math.round(efeito.evolucao)` acima do potencial só vale com evolução ≥ 0,5 (carreira.js:1081). Uma saída é deixar ≥ 1,5 de evolução acumulada no ano subir +1 no potencial até os 23 anos.
17. **[balance] Modo rápido sem peso.** No rápido, as 5 políticas terminam iguais. Sugestão: o rápido também ter 1 decisão de mercado quando a proposta vier de degrau acima ("Aceita / Fica"), já que o mercado é a decisão que mais muda a carreira.

### P2: conteúdo novo (a partir das lacunas medidas)

18. **[new content] Arco "Ficar ou crescer"** (Afirmação, 21-25, clube na B/C/D com OVR acima do nível da liga + 5): "O ídolo da Série C". Opções: "renova de novo" (torcida +2, prêmios fáceis, mas `vitrine −2` e teto de evolução −1 em 2 anos) ou "força a saída" (próxima janela garante uma proposta de degrau acima). Dá forma de escolha ao dilema que hoje é só um exploit.
19. **[new content] Consequência para `futuro_tecnico`.** Na aposentadoria, bloco "Depois das chuteiras: técnico do sub-20 do [clube]". Ou, aos 36+, um evento "O treinador foi demitido, o presidente te oferece interinamente" (encerra a carreira como técnico).
20. **[new content] Usar as marcas mortas.**
    - `ostentacao` → "Assalto/sequestro-relâmpago" (Cabeça −1, torcida solidária);
    - `denunciou` → "Ameaça" ou "Convite pra campanha da CBF contra manipulação" (imprensa +2);
    - `aliciado` sem operação → "Chantagem" anos depois;
    - `fiel` → "Jogo de despedida no clube" na aposentadoria;
    - `joelho` → risco de lesão +0,03 permanente;
    - `respondeu`/`zoou` → o rival vira companheiro de clube (evento de vestiário).
21. **[new content] Arcos para o exterior.** O idioma e a saudade são soltos. Criar o arco "Choque cultural" (Europa, 1º ano): técnico que não te entende → "vai ao clube de brasileiros / se isola / aprende a cultura", com consequência "Proposta de naturalização" (troca de seleção) ou "Volta pro Brasil antes da hora".
22. **[new content] Arco de seleção.** Hoje só existem data-fifa e a sub-20. Adicionar "Convocação pra Copa × lesão escondida" e "Braçadeira da seleção", com gatilho em Copa (`ano % 4 === 2`).
23. **[new content] Fase veterana mais rica.** Hoje: corpo, legado, último ano, padrinho, aprendiz. Adicionar "Proposta milionária da Arábia aos 32" (dinheiro e vitrine contra legado), "Jogo de despedida" e "Volta ao clube do coração como reserva".
24. **[new content] Deduplicar os pares temáticos.** Dar `tema` comum a `veterano` e `corpo`, a `classico` e `polemica`/`rival`, e a `dor`/`aquecimento` e o arco `dor` (joelho). Hoje o `tema` só vale dentro de `EVENTOS`; estender a checagem para `Historia.eventosDoAno`.

### P3: UX e feedback

25. **[UX] Mostrar o efeito da reputação.** O painel mostra barras de -5 a +5, mas o jogador não sabe que o vestiário vale minutos. Tooltip com o efeito do ano ("Técnico +2: +5% de minutos").
26. **[UX] Renovação aparece na temporada errada.** A renovação assinada na janela entra em `J.efeito.textos` depois do reset e aparece como "decisão" da temporada seguinte. Criar um bloco "Janela de transferências" separado.
27. **[UX] "↻ isso vai ter consequência" sem desfecho no resumo.** Quando a consequência some (trocou de clube: `cobranca` 35%, `racha` 12%), avisar na trilha: "Você saiu antes da cobrança".
28. **[UX] Sinalizar o dilema.** Nas opções `sempre`, mostrar os lados (como já é feito na renovação: "+ … / − …"). Ajuda a mostrar que a opção "boa" tem custo, depois do item 12.
29. **[UX] Ritmo do foco.** O foco aparece ~13 vezes por carreira, sempre com o mesmo texto. Variar o texto por idade e fase, ou oferecer "manter o foco do ano passado" com 1 clique.
30. **[UX] Final nomeado.** A aposentadoria poderia ter um rótulo de desfecho (ex.: "Lenda", "Ídolo da Série C", "Operário da Série A", "Rodou o mundo", "Carreira manchada", este quando houve suspensão), com base nos números já calculados. Dá identidade e rejogabilidade.

---

---

## 6. Depois das correções (27/09/2026, branch `correcoes-bateria-5k`)

O dono aprovou só os **bugs** e 3 ajustes de UX. **Nenhum ajuste de balanceamento foi feito:** os itens 9 a 17 e 18 a 30 da seção 5 seguem em aberto.

### 6.1 O que mudou

| # | correção | onde |
|---|---|---|
| 1 | `projecao()` aplica a reputação numa **cópia** (`rep: { ...rep }`). O decaimento de 20% acontece uma vez por temporada, em `jogarTemporada` | carreira.js:2432-2434 |
| 2 | Vestiário cortado uma vez só: caiu o `×0,3` de `assinar`, fica a metade de `Historia.novoClube` (o que o doc promete) | carreira.js:737-738 |
| 3 | Empréstimo e volta do empréstimo chamam `Historia.novoClube` (técnico zera, vestiário pela metade), a mesma regra da transferência ("Técnico zera quando você troca de clube") | carreira.js:2053 (ida) e 1378 (volta) |
| 4 | `criarJogador` zera o estado por carreira (`C.tabelaAnterior`, `C.ofertasAbertas`, `C.eventos`, `C.rolagem`) | carreira.js:3070-3072 |
| 5 | "Data FIFA com o Brasileirão rolando" só aparece pra quem está num clube brasileiro da Série A | carreira.js:2077-2078 |
| 6 | "Simular o resto": a consequência vencida resolve pela **opção mais prudente** (opção certa antes da roleta; na roleta, a de maior chance; empate: a que não abre outra consequência). O motivo está explicado no comentário | historia.js:629-651 |
| 7 | Piso de ±0,2 da reputação: **era bug, não desenho** (o comentário promete que "o que você fez há cinco temporadas pesa pouco hoje", mas o `Math.round` travava em 0,2 pra sempre). Agora arredonda pra zero | historia.js:82-85 |
| 8 | "Topa voltar": o texto diz "Deu a palavra". No automático (modo rápido e "Simular o resto"), a proposta do clube formador é aceita. No completo a escolha segue com o jogador | carreira.js:1240, 1262-1265 |
| 9 | UX: "Simular o resto da carreira" em dois toques. O 1º vira "Toque de novo pra simular a carreira toda" por 3 s; o 2º confirma. Sem diálogo nativo | carreira.js:3123-3138 |
| 10 | UX: cada barra de confiança/reputação mostra o valor ao lado do nome ("neutro" no começo, depois "+1,2"/"−0,8"); o `title` da barra diz "(de −5 a +5)" | carreira.js:2239-2244 |
| 11 | UX: peneira. "~9 de 38 jogos" era correto: `fracaoDeMinutos` tem piso de 8% de entradas do banco. O texto agora diz "(titular ou do banco)" | carreira.js:666-668 |

**Pendente (não aplicado): o CSS dos itens 9 e 10.** A edição de `carreira.css` foi bloqueada pela permissão do ambiente. O JS funciona sem ela, mas faltam a separação visual do botão de simular e as cores do valor. Snippet sugerido, para quem cuida do CSS:

```css
#tela-carreira .controles-jogo { margin-top: 1.6rem; padding-top: 0.9rem; border-top: 1px solid var(--borda); }
#tela-carreira #tudo { background: transparent; border-color: transparent; color: var(--texto-fraco); font-size: 0.85rem; text-decoration: underline; text-underline-offset: 3px; }
#tela-carreira #tudo.tudo-armado { border-color: #ff7d95; color: #ff7d95; text-decoration: none; }
.rep-valor { margin-left: 0.2rem; font-size: 0.7rem; font-variant-numeric: tabular-nums; color: var(--texto-fraco); }
.rep-valor.sobe { color: var(--canal); }
.rep-valor.desce { color: #ff7d95; }
.rep-barra::after { width: 2px; opacity: 0.9; } /* marca do centro mais visivel */
.proposta-jogos { white-space: normal; } /* o texto dos jogos ficou mais longo */
```

**O doc de desenho também precisa de uma linha nova:** `docs/prata-da-casa-escolhas.md` ainda diz que o automático resolve "pela primeira opção". Agora resolve pela mais prudente.

### 6.2 Antes × depois (5.000 carreiras, mesmas sementes)

| métrica | antes | depois |
|---|---|---|
| exceções | 0 | 0 |
| textos suspeitos na tela | 0 | 0 |
| situações distintas vistas (de 96) | 96 | 96 |
| Σ\|reputação\| no fim (todas) | 1,04 | **1,79** |
| Σ\|reputação\| no fim (modo completo) | 1,11 | **2,18** |
| Σ\|reputação\| no fim (gulosa, completo) | 1,31 | **2,50** |
| jogou Europa (todas) | 6,8% | 7,3% |
| jogou Europa (gulosa, completo) | 8,3% | **11,7%** |
| OVR auge (todas) | 83,16 | 83,23 |
| prêmios por carreira (todas) | 6,90 | 7,23 |
| Bola de Ouro (todas) | 3,9% | 4,0% |
| carreiras só na Série B-D | 18,7% | 18,5% |
| prêmios: só B-D × resto | 14,83 × 5,08 | **15,88 × 5,26** |
| cautelosa (fica na B-D), prêmios | 14,83 | 16,02 |
| "Topa voltar" → voltou de fato | 33/202 (16%) | 51/198 (26%; no automático, 17 de 26) |
| "Data FIFA" (carreiras) | 1.347 | 511 (só Série A) |
| automático: opções mais comuns | Rompe a multa, **Aceita o palco**, **Responde nas redes**, **Critica o técnico** | Rompe a multa, Vende o carro, Diz que respeita, Assume e colabora, Joga pro time |

**Leitura:**
- A reputação agora dura (a soma no fim da carreira quase dobra) e zera de verdade quando some: com o `trunc`, o jogador que só simulou termina em 0.
- O efeito nos desfechos é pequeno, mas vai na direção prometida: mais Europa pra quem joga a reputação.
- **A dominância de ficar na Série B/C/D continua e até aumentou um pouco** (15,9 contra 5,3 prêmios). É o problema de balanceamento nº 1 (itens 9-11 da seção 5), que ficou de fora de propósito.
- Com a Data FIFA restrita à Série A, a situação caiu de 27% para 10% das carreiras e continua alcançável. A cena mais rara segue sendo "Seu nome numa investigação" (1,6%).

Tabelas completas depois das correções: rode `scripts/bateria/prata/bateria.sh` (a saída vai para `$TMPDIR/bateria-prata-da-casa/tabelas.md`).

---

## 7. Fase 2: um jogo que prende do começo ao fim (27/09/2026)

Nesta fase o dono aprovou tudo o que estava em aberto: balanceamento (itens 9 a 17), conteúdo novo (18 a 24) e UX (25 a 30). Cada mudança foi calibrada com a bateria até as metas A a G passarem. A conferência final usa **dois conjuntos de sementes**, pra não calibrar em cima de um sorteio só:

- **conjunto A:** as mesmas sementes da auditoria (completo 1 a 700, rápido 10001 a 10300);
- **conjunto B:** sementes novas (completo 20001 a 20700, rápido 30001 a 30300).

Em cada conjunto rodam:

- as 5.000 carreiras (5 políticas × 1.000);
- a política "estratégica" (1.000, mesmas sementes);
- a política "pior" (700, só no completo).

A rodada final já usa o `motor.js` atual, com os ajustes de regulamento do Tem Time em Casa (desempate da Conmebol, mando da volta, datas).

"Antes" é o jogo depois das correções da seção 6 (conjunto A).

### 7.1 Metas: antes × depois

| meta | o que | antes | depois (A) | depois (B) | resultado |
|---|---|---|---|---|---|
| A | prêmios por carreira: só Série B-D × média | 15,88 × 7,23 | 3,23 × 4,81 | 3,26 × 4,97 | PASSA |
| A | Bola de Ouro em carreira só B-D | 24 (2,6%) | 0 | 0 | PASSA |
| A | convocado, carreira só B-D | 78,3% | 7,4% | 6,8% | PASSA |
| B | situações em que a gulosa escolhe a mesma opção em ≥80% das vezes (n≥30) | 62 (44 com ≥95%) | 2 | 2 | PASSA |
| B | score da melhor política × aleatória | cautelosa 21,1 × 15,1 (+39%, graças ao atalho da B-D) | estratégica 27,4 × 16,7 (+65%) | 28,5 × 16,8 (+69%) | PASSA |
| B | OVR auge, melhor − pior jogada na mesma faixa de potencial | 0,9 a 1,4 | 2,8 a 3,1 | 2,9 a 3,1 | PASSA |
| C | espalhamento do score entre políticas: rápido × completo | 1,25 × 10,28 | 10,92 × 15,18 | 13,87 × 15,20 | PASSA |
| D | carreiras com algum arco de aposta | 91,1% | 28,6% | 30,9% | PASSA |
| D | arco "A renovação" | 7,7% | 22,8% | 21,8% | PASSA |
| D | estreia no 1º ano (modo completo) | 3,6% | 100% | 100% | PASSA |
| D | pares temáticos duplicados (machucado, rival/clássico, microfone, crise, mentor, empresário, garoto, adaptação) | 25% a 100% das carreiras | 0 | 0 | PASSA |
| E | nome do final | não existia | 14 rótulos | 14 rótulos | PASSA |
| E | virou técnico / jogo de despedida | não existia | 13,8% / 22,1% | 14,1% / 21,3% | PASSA |
| F | exceções / textos suspeitos / situação repetida / estado mexido pela dica de lados | 0 / 0 / 0 / - | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | PASSA |
| F | situações alcançadas | 96 de 96 | 111 de 111 | 111 de 111 | PASSA |
| F | idade de aposentadoria p5-p50-p95 | 34-36-39 | 33-36-38 | 33-36-38 | PASSA |
| G | dica da reputação, bloco da janela, aviso de consequência pulada, dois lados da opção certa, texto do foco por fase | não existia | implementado | implementado | PASSA |

**As 2 opções dominantes que sobraram são éticas, e ficaram de propósito:**

- "Uma mensagem no direct" → Mostra pro clube (86% a 92%);
- "Seu nome numa investigação" → Mostra as mensagens (100%).

Aceitar suborno ou esconder prova não pode "valer a pena" no jogo: o custo aparece depois, no processo, na chantagem ou na carreira manchada. A gulosa não enxerga isso porque é míope.

**Meta B, com transparência:** com só as 5 políticas originais, a melhor (gulosa, 17,3) fica 4% acima da aleatória (16,7). O ganho de 65% vem da política estratégica. Ela joga as mesmas decisões olhando o longo prazo (evolução até os 24, fôlego depois do pico, marcas) e sobe de degrau só com chance real de jogar. Ou seja, jogar bem é jogar pensando na carreira, não no ano.

**Prêmios médios caíram de 7,2 para 4,8 por carreira.** É o efeito de a Série B-D não render mais pilha de troféu. Entre quem joga Série A ou exterior, a média ficou parecida.

### 7.2 O que mudou (arquivo:linha)

**Balanceamento**
- `carreira.js:1172-1182`: prêmios da liga com limiar um degrau mais alto por divisão (Série B +1, C +2, D +3). Isso vale pra artilharia, assistências, Luva de Ouro (+0,3 ou +0,2 por degrau), Melhor da posição e Craque (+0,4 de nota por degrau).
- `carreira.js:1196`: Bola de Ouro e Craque da América só pra quem joga a Série A ou o exterior.
- `carreira.js:1019-1022`: convocação pesa a vitrine da liga. Série B vale 0,05 (0,5 pra seleção de corte baixo), C e D valem 0 (ou 0,15). O corte da Copa (`foraDaSelecao`) tira a convocação do ano.
- `carreira.js:1080-1088`: potencial pelo trabalho acumulado até os 24 anos. Cada ponto de evolução acima de 0,35 no ano vale +1, até +4 ou −4 sobre o sorteado. A adaptação do clube novo fica de fora. O teto de atributo acompanha o potencial.
- `carreira.js:2195-2199`: o foco no atributo que mais pesa na posição dá +0,4 de evolução até os 24 (+0,2 depois).
- `carreira.js:1320`: no automático, o preparador escolhe o foco. Sem isso, quem simulava perdia potencial.
- `carreira.js:1459`: a marca "joelho" dá +4% de risco de lesão pra sempre.
- Opções de `EVENTOS` e dos arcos: toda opção "boa" ganhou um custo, e a escolha certa passou a depender do contexto. Exemplos:
  - a psicóloga vale mais depois de um ano ruim;
  - forçar a saída depois do rebaixamento rende mais pra quem é bom demais pra divisão;
  - o torneio de videogame une mais o novato;
  - a camisa pro menino vale mais pro ídolo antigo;
  - a chance de várias roletas vem do atributo certo (DEF, REF, PES, FIN, DRI, FIS).
- `historia.js:897-898`: apostas. Só 36% das carreiras cruzam com esse mundo, sorteado uma vez, e só entra um arco de apostas por carreira (o aliciador ainda procura quem já mexeu com bet).
- Pesos dos arcos em `historia.js`: renovação 4, ídolo local 5, polêmico 2, crise 2,5, rival 1,5, mentor 1,5, aperto 1, grupo 0,8, aliciador 0,8. Na base, a chance de arco novo é 0,6×.
- `carreira.js:2246` e `2266`: rápido = foco + 1 situação por ano. Antes, 35% dos anos eram só o foco.
- `carreira.js:2860-2901`: no rápido, uma proposta de degrau acima vira decisão (fica, vai ou pede vaga de titular), via `propostaDeSalto` e `janelaAutomatica`. O resto da janela continua automático.
- `carreira.js:1263-1277` e `1303`: "Pede pra ser vendido" e "Volta pro Brasil" garantem uma proposta na janela. O automático aceita, assim como a palavra dada ao clube formador.

**Conteúdo novo** (`historia.js`)
- `:348` **O ídolo da divisão** (+ "A cidade é sua", `:724`): ficar embaixo virou escolha consciente, com custo em vitrine e potencial.
- `:366` **Choque cultural** ("O primeiro inverno"), + "Um clube brasileiro quer te repatriar" (`:736`) e "O passaporte" (naturalização, `:748`).
- `:384` **A seleção** ("A lista da Copa e a coxa"), + "A braçadeira da seleção" (`:764`).
- `:400` **Os petrodólares** (Arábia aos 31 a 33: transferência na hora).
- `:423` **A despedida** (35+: anuncia o último ano).
- `:780` **De volta pra casa** (depois do "Topa voltar" do clube formador).
- Marcas que agora pagam:
  - ostentação → "A saída do CT" (`:687`);
  - denunciou → "O rosto da campanha" (`:699`);
  - aliciado que escapou → "O passado cobra" (`:711`);
  - zoou/respondeu → "O rival no seu vestiário" (`:805`);
  - futuro_tecnico → "O banco te chama" (`:805`), que encerra a carreira como técnico (`carreira.js:1412-1418`);
  - joelho → risco de lesão maior;
  - fiel/capitão → pesam na despedida.
- Marca "manchado" nas punições longas (`historia.js:533`, `536`, `612`, `615`, e a chantagem).
- Temas em `EVENTOS` e nos arcos, com checagem cruzada (`carreira.js:2239-2270`, `historia.js:895-905`). Os arcos entram antes das situações soltas, pra que o tema deles já conte no mesmo ano.
- A estreia entra no 1º ano do profissional (`carreira.js:1710`, com `prioridade`). "O preparador físico tem um plano" passou pros 28-30. "Padrinho" não aparece pra quem foi mentorado.

**UX** (`carreira.js`)
- `:2360-2372`: embaixo das barras, "Neste ano: +5% de minutos, nota +0,06, vitrine +1,2…" (`Historia.efeitoDaReputacao`, `historia.js:69`).
- `:2477-2483` e `:1382`: bloco "Janela de transferências" no resumo do ano seguinte. A renovação saiu da lista de decisões.
- `historia.js:840-860`: a consequência que sumiu porque você trocou de clube aparece como "ficou pra trás".
- `:2275-2305` e `:2773-2777`: `ladosDaOpcao` roda a opção certa num rascunho e mostra "+ nota, evolução" / "− vestiário". A bateria confere que o estado não muda (0 casos em 12.000 carreiras).
- `:2217-2227`: o texto do foco varia com a fase e o ano. A escolha do atributo-chave avisa que o OVR cresce mais.
- `:3110-3158`: `nomeDoFinal`, o rótulo da carreira na aposentadoria e no "Copiar resumo", com o "depois das chuteiras". Rótulos:
  - Lenda;
  - Ídolo da Série X;
  - Rodou o mundo (4+ países);
  - Estrela na Europa;
  - Camisa da seleção;
  - Ídolo do clube;
  - Andarilho;
  - Carreira manchada;
  - A promessa que não vingou;
  - Operário/Craque da Série A;
  - Guerreiro do acesso;
  - Carreira de respeito.

**Distribuição dos finais (conjunto A, 6.000 carreiras):** Andarilho 15%, Camisa da seleção 14%, Ídolo da Série D 13%, Rodou o mundo 13%, Lenda 13%, Ídolo do clube 8%, Ídolo da Série C 7%, Ídolo da Série B 6%, Carreira manchada 4%, Estrela na Europa 4%, outros 2%.

**Situações novas: em quantas carreiras aparecem (conjunto A)**

| situação | carreiras |
|---|---|
| O primeiro inverno | 39,6% |
| A lista da Copa e a coxa | 34,0% |
| O rival no seu vestiário | 31,6% |
| O jogo de despedida | 31,1% |
| O banco te chama | 26,5% |
| A saída do CT | 24,9% |
| Proposta da Arábia | 13,3% |
| A braçadeira da seleção | 7,9% |
| O melhor da divisão | 7,3% |
| O rosto da campanha | 6,8% |
| Um clube brasileiro quer te repatriar | 6,3% |
| A cidade é sua | 3,4% |
| O passado cobra | 3,0% |
| A arquibancada da infância | 1,8% |
| O passaporte | 1,3% |

### 7.3 Pendências fora do meu escopo

**1. CSS** (`carreira.css`, que não posso editar). As classes novas funcionam sem estilo, mas ficam cruas. Snippet sugerido:

```css
.bl-final { margin: 0.4rem 0 0; font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--canal); }
.bl-final-texto { margin: 0.1rem 0 0; font-size: 0.9rem; color: var(--texto-fraco); }
.bl-final-depois { margin: 0.3rem 0 0; font-size: 0.85rem; font-style: italic; }
.rep-efeito { display: block; margin-top: 0.3rem; font-size: 0.72rem; color: var(--texto-fraco); }
.temporada-janela { margin: 0.6rem 0; padding: 0.5rem 0.7rem; border-left: 3px solid var(--canal); background: var(--fundo-cartao); border-radius: 6px; font-size: 0.85rem; }
.temporada-janela p { margin: 0.15rem 0; }
.temporada-janela-cab { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--texto-fraco); }
```

**2. Texto dos modos** (`prata-da-casa.html`, que não posso editar).
- O botão "Rápido" diz "1 decisão por temporada. As transferências acontecem sozinhas." Sugestão: "Foco de treino e 1 decisão por temporada. Proposta de clube maior é com você."
- O botão "Completo" pode ficar como está.

**3. Balanceamento que fica pro dono decidir.**
- O potencial sobe até +4 com o trabalho. Na política estratégica, o potencial final médio fica +3,9 acima do sorteado. O sorteio ainda é o que mais pesa (as faixas distam 6 a 9 pontos), mas quem quiser o dado mais forte pode baixar o teto pra +3.
- "Lenda" aparece em 13% das carreiras (puxado pela estratégica). Pra ficar mais raro, dá pra exigir auge 92+.

### 7.4 Reproduzir a fase 2

```bash
scripts/bateria/prata/bateria.sh                                   # conjunto A (+ estratégica e pior)
SEMENTE_C=20001 SEMENTE_R=30001 BATERIA_OUT=/tmp/b scripts/bateria/prata/bateria.sh   # conjunto B
node scripts/bateria/prata/metas.js "$TMPDIR/bateria-prata-da-casa" "$TMPDIR/bateria-prata-da-casa"
```

---

## 8. Fase 3: contratos (27/09/2026)

**O problema.** No jogo real, com um bot que sempre clica "Assinar", o jogador passou por 19 clubes em 20 temporadas, um por ano: Botafogo → Lokomotiv → Lille → Stuttgart → PSV → Manchester United → Arsenal → Milan → Real Madrid… Nenhuma meta anterior pegava isso.

**O que mudou.** Agora toda assinatura tem prazo, e com contrato em vigor quem decide a saída é o clube. As regras de prazo, liberação, último ano e fim de contrato estão em `docs/prata-da-casa-escolhas.md`, seção "Contratos".

**Nova política na bateria: "assina".** Ela decide as situações ao acaso, mas no mercado clica "Assinar" sempre que aparece proposta. São 1.000 carreiras por conjunto de sementes, fora das 5.000 (700 no completo, 300 no rápido).

### 8.1 Antes × depois

"Antes" é o HEAD `37b3e83` (fase 2), rodado com o `motor.js` atual, as mesmas sementes e o mesmo harness (a política "assina" foi acrescentada só na cópia de medição).

| meta | antes A | antes B | depois A | depois B | resultado |
|---|---|---|---|---|---|
| H: clubes por carreira, 5 políticas (p50 / p95) | 6 / 12 | 6 / 12 | 5 / 8 | 4 / 8 | PASSA |
| H: política "assina" (p50 / p95 / máx) | 15 / 19 / 22 | 15 / 19 / 22 | 7 / 10 / 12 | 7 / 10 / 12 | PASSA (p95 ≤ 10) |
| H: "assina", dois clubes da elite europeia em anos seguidos, sem motivo | 528 | 580 | 0 | 0 | PASSA |
| H: "assina", o mesmo com motivo (fim de contrato, último ano, pediu) | – | – | 59 | 48 | – |
| H: final "Andarilho" (todas as políticas) | 15,4% | 15,3% | 7,9% | 7,7% | PASSA |
| H: final "Andarilho" (política "assina") | 43,0% | 43,3% | 28,9% | 29,2% | – |
| A: prêmios, só B-D × média | 3,23 × 4,86 | 3,26 × 4,97 | 3,38 × 5,72 | 3,39 × 5,86 | PASSA |
| A: convocado, só B-D / Bola de Ouro só B-D | 7,4% / 0 | 6,8% / 0 | 7,5% / 0 | 5,7% / 0 | PASSA |
| B: situações com a gulosa ≥80% na mesma opção | 3 | 2 | 3 | 3 | PASSA |
| B: estratégica × aleatória | +61% | +69% | +64% | +62% | PASSA |
| B: OVR auge, melhor − pior jogada por faixa | 2,8–3,1 | 2,9–3,1 | 3,0–3,2 | 2,7–3,4 | PASSA |
| C: espalhamento do score, rápido × completo | 10,9 × 15,2 | 13,9 × 15,2 | 11,9 × 12,7 | 15,8 × 13,0 | PASSA |
| D: apostas / renovação / estreia no 1º ano | 28,6% / 22,2% / 100% | 30,9% / 21,8% / 100% | 27,3% / 30,0% / 100% | 30,0% / 28,8% / 100% | PASSA |
| E: virou técnico / despedida | 13,6% / 21,7% | 14,1% / 21,3% | 13,4% / 22,6% | 14,3% / 23,8% | PASSA |
| F: exceções / texto suspeito / situação repetida / estado mexido pela dica | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 (e 0 nas 1.700 extras) | igual | PASSA |
| F: situações alcançadas | 111/111 | 111/111 | 111/111 | 111/111 | PASSA |
| F: aposentadoria p5-p50-p95 | 33-36-38 | 33-36-38 | 33-36-38 | 33-36-38 | PASSA |

**Motivo das transferências**, depois (conjunto A, todas as políticas, que sabem pedir pra sair):

| motivo | transferências |
|---|---|
| último ano de contrato | 9.953 |
| fim de contrato (livre) | 7.840 |
| pediu pra ser vendido | 5.570 |
| liberado pelo clube | 5.341 |

**Clubes por política, depois (conjunto A, p50 / p95 / máx):**

| política | p50 | p95 | máx |
|---|---|---|---|
| aleatória | 6 | 10 | 13 |
| gulosa | 6 | 9 | 11 |
| impaciente | 5 | 8 | 11 |
| cautelosa | 2 | 5 | 7 |
| primeira | 2 | 4 | 7 |
| assina | 7 | 10 | 12 |

Antes, a aleatória tinha 9 / 14 / 18 e a gulosa 9 / 12 / 17.

**Dominantes restantes (3, contando a margem):**
- as duas opções éticas da fase 2;
- "O clube que te revelou chama" → Topa voltar (84%). Com o contrato, a volta pra casa ficou pro fim do contrato, e o fôlego que ela dá pesa mais pro veterano.

A calibragem das escolhas mudou pouco. Com contratos, o contexto muda: renovação e ídolo local ficaram mais frequentes. Os ajustes:
- "O melhor da divisão": renovar vale mais a partir dos 25; pedir pra ser vendido, até os 23.
- "A braçadeira": a torcida só dá o bônus depois de 6 anos no clube.
- "O passaporte": a vitrine é alta só com OVR 82+.
- "O banco te chama", "Termina a escola", "Estuda até de madrugada", empréstimo e o ídolo auxiliar tiveram ajustes pequenos.

### 8.2 O que mudou (arquivo:linha)

**`carreira.js`**
- `:746-793`: o bloco novo de contratos:
  - `CONTRATO_DA_BASE`;
  - `anosDeContrato`: idade, degrau, mínimo de 3 anos na elite;
  - `anosRestantes`;
  - `valorDaVenda`: metade no último ano, 0 livre;
  - `garantirContrato`: contrato padrão pra quem fica livre;
  - `clubeLibera` e `liberaNoUltimoAno`: a decisão do clube;
  - `pedirSaida`: custo e chance;
  - `renovarCom`: a mesma conta pra tela e pra bateria.
- `:795-813`: `assinar`. Toda assinatura grava o prazo, e a transferência guarda o motivo (livre, último ano, pediu, liberado).
- `:1285-1293` e `:1360-1373`: `propostasDoAno`. O mercado olha mais pra quem está livre ou no último ano (menos pro veterano livre). Com contrato em vigor, as propostas passam pelo clube, e as recusadas ficam em `C.ofertasBarradas` e `linha.ofertasBarradas`. Saiu o antigo "sob contrato, a janela nem abre".
- `:1526`: simulação e automático. O valor da venda segue o contrato, e a janela termina com `garantirContrato`. No rápido, o mesmo em `janelaAutomatica` (`:2985`).
- `:2605-2606`: resumo do ano. "de graça, em fim de contrato" e "O X recusou a proposta do Y: você tem contrato".
- `:3005-3065`: `mostrarMercado`:
  - bloco "Pede pra ser vendido" com o custo, reabrindo a janela com as liberadas;
  - a assinatura diz "por N anos" e mostra valor ou "de graça";
  - quem fica livre sem renovar recebe o contrato padrão, que vai pra "Janela de transferências".
- `:3083`, `:3101`, `:3112`: `sobContrato` virou "2+ anos". As renovações têm prazo novo (2, 2 e 4 anos) e só aparecem no último ano ou em fim de contrato.
- `:3122-3129`: cartão do clube: "Seu contrato: mais 2 anos (até 2031)", "último ano… sai de graça" ou "Fim de contrato: você está livre".
- `:708-715`: cartão da proposta (peneira e mercado): "Contrato de 4 anos", com "você chega de graça" ou "último ano do seu contrato: sai barato".
- `:2260`: "O clube que te revelou chama" só no último ano de contrato.

**`historia.js`**
- `:344`: `restantes(J)`.
- `:172`: o arco "A renovação" aparece com até 2 anos de contrato e sem renovação ativa.
- `:351`: "O ídolo da divisão" aparece com até 2 anos de contrato.
- `:402`: a Arábia vale com contrato em vigor, porque o clube saudita paga a multa.
- `:178`, `:357`, `:732`: as assinaturas dos arcos estendem o contrato (`Math.max`) em vez de encurtar.

**Harness** (`scripts/bateria/prata/`)
- `dentro.js`:
  - política "assina";
  - botão "pede" no mercado: a gulosa pede quando o clube barrou um salto com vaga real; cautelosa e primeira nunca pedem;
  - renovação via `renovarCom` e fim da janela com `garantirContrato`;
  - campos novos: `eliteSeguidos`, `eliteSeguidosSemMotivo`, `motivos`.
- `metas.js`: seção H.
- `bateria.sh`: roda também a "assina".
- `agregar.js`: deixa "assina" e "pior" fora das tabelas das 5.000.

### 8.3 CSS sugerido (o `carreira.css` não é meu)

```css
.proposta-contrato { margin: 0.2rem 0 0; font-size: 0.76rem; font-weight: 600; color: var(--texto-fraco); }
.proposta-ficar .proposta-contrato { color: var(--texto); }
.mercado-barradas { display: grid; gap: 0.4rem; margin: 0.4rem 0 0.8rem; padding: 0.6rem 0.75rem; border: 1px dashed var(--borda); border-radius: 10px; }
.mercado-barradas .botao { justify-self: start; display: grid; gap: 0.1rem; text-align: left; }
```

Não precisa mexer no HTML.

### 8.4 Reproduzir

```bash
scripts/bateria/prata/bateria.sh                                                     # conjunto A (+ estratégica, pior, assina)
SEMENTE_C=20001 SEMENTE_R=30001 BATERIA_OUT=/tmp/b scripts/bateria/prata/bateria.sh  # conjunto B
```

`metas.md` na pasta de saída traz todas as metas, A a H.
