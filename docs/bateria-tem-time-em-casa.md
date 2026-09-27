# Bateria do Tem Time em Casa: 5.000 tentativas (draft + temporada completa)

Auditoria de 26/09/2026. Os scripts estão em `scripts/bateria/draft/` e o modo de rodar está no README de lá.

Os números abaixo vêm da rodada com semente sobre o código de `192edfe` (seção "antes"). A seção 7 compara com o código depois das correções. A **seção 8 (Fase 2)** descreve o jogo novo (eixos, entrosamento, banco, postura, janela, dificuldade, desafio do dia) e as metas PASS/FAIL. Os scripts de hoje são os da fase 2.

## 0. Como reproduzir

Os comandos abaixo são da fase 1: `analisar.js`, `extras.js`, `colisao.js`, `experimento.sh` e `resumo-exp.js` ficam no histórico do git. Os da fase 2 estão na seção 8.

```bash
source ~/.nvm/nvm.sh
scripts/bateria/draft/rodar.sh               # 5.000 tentativas, 4 processos, ~25 s
node scripts/bateria/draft/analisar.js       # métricas das seções 2 e 3
node scripts/bateria/draft/extras.js         # forças CPU, time dos sonhos/pesadelo, expulsos, descanso, datas
node scripts/bateria/draft/colisao.js        # nome do clube igual a convidado da Copa do Brasil
node scripts/bateria/draft/testes-ui.js      # testes das correções de UI
scripts/bateria/draft/experimento.sh         # cenários de balanceamento (patch só em memória)
```

A semente da tentativa i é `1000003*i+7`. Um único gerador alimenta o draft, as políticas de escolha, o sorteio do grupo e a semente do motor. Duas rodadas do mesmo código dão 5.000 de 5.000 tentativas idênticas.

## 1. Como funciona (resumo)

**Clube.** O jogador escolhe nome, camisa, esquema (7 no seletor) e Libertadores ou Sul-Americana. Quem sai da Série A é sempre a Chapecoense (`SAI_PADRAO`, draft.js:97). O README do repo ainda diz "escolhe quem sai".

**Draft (`sortearLeque`, draft.js:117).** São 11 vagas e cada uma abre um leque de 5 cartas. Para cada carta:
1. O pool reúne quem tem a função da vaga como principal. Quem tem como secundária entra com 50% de chance.
2. Se sobrarem menos de 12, o pool vira a família da posição (G/D/M/F).
3. Lateral e ala passam por um filtro de lado.
4. Sorteia-se um nível com `CHANCES_DO_LEQUE` = palha 20%, madeira 45%, tijolo 28%, concreto 7%, renormalizadas entre os níveis que existem no pool. Dentro do nível, o jogador sai ao acaso.

Essas **não** são as chances do envelope (55/38/6,5/1). O README (linha 78) diz que são as mesmas. Os cortes de 2026 são madeira 74, tijolo 82 e concreto 86, sobre 388 cartas da Série A. Há uma troca de leque por draft.

**Força.** Vem de `Motor.forcaDoOnze`: o ataque é a média dos M+F e a defesa é a média de G(×2)+D+M. Depois vem `naRegua` (média 55,5, dp 3,2, relativo à Série A) e, por último, `Motor.TATICA`. Os clubes CPU usam 0,6 do onze-base + 0,4 da média dos 11 melhores do elenco; o usuário usa só o onze.

**Motor.**
- Gols ~ Poisson com média base·exp((atq−def)/27): mandante 1,24, visitante 0,96, neutro 1,10.
- Altitude multiplica o mandante por 1,25 e o visitante por 0,85.
- Mata-mata ×0,86.
- Vermelho em 11% dos jogos por time: dali em diante, ×0,7 para quem ficou com um a menos e ×1,2 para o outro.
- 12% dos gols saem de pênalti. A disputa de pênaltis segue a regra real.

**Calendário.**
- Brasileirão: 38 rodadas em turno e returno, aos domingos (vai para sábado se houver jogo de copa no domingo), de 01/02 a 29/11.
- Copa do Brasil: 5ª fase com 20 + 12 convidados, sorteio a cada fase, final única.
- Libertadores e Sul-Americana: 8 grupos de 4, chave fixa nas oitavas. O 3º da Libertadores vai ao playoff da Sul-Americana. Final única.

## 2. Resultados (antes das correções)

Blocos:

| bloco | política | n |
|---|---|---|
| A | aleatório | 1.000 |
| B | maior nota, 250 por esquema | 1.750 |
| C | pior nota, 100 por esquema | 700 |
| D | maior nota + troca do leque | 300 |
| E | "humano" (70% a maior nota, 30% ao acaso) | 250 |
| F | cada clube como quem sai | 1.000 |

### 2.1 Por política

| política | média do onze | rank de força | posição mediana (p10-p90) | pts | campeão BR | G4 | G6 | Z4 | CdB | nenhum título |
|---|---|---|---|---|---|---|---|---|---|---|
| aleatório | 78,1 | 12,1 | 12 (4-18) | 50,0 | 1,8% | 12,6% | 21,6% | 23,2% | 2,9% | 93,2% |
| maior nota | 83,3 | 2,8 | 4 (1-12) | 60,9 | 15,0% | 54,1% | 69,8% | 2,1% | 9,7% | 70,1% |
| maior nota + troca | 83,6 | 2,7 | 4 (1-10) | 62,0 | 17,3% | — | 76,7% | 0,3% | 11,0% | 67,0% |
| humano | 81,8 | 4,1 | 6 (1-13) | 58,3 | 11,6% | — | 56,0% | 2,4% | 6,8% | 76,8% |
| pior nota | 71,6 | 19,5 | 19 (14-20) | 37,2 | 0,0% | 0,3% | 1,3% | 75,7% | 0,9% | 98,7% |

- **Libertadores** (quem escolheu): 4,2% ao todo, 6,6% com a maior nota.
- **Sul-Americana** (quem escolheu): 6,7% ao todo, 11,2% com a maior nota.

**Teto e piso.** O time dos sonhos (maior nota por função; 200 temporadas por esquema) é campeão brasileiro em 21-37% das temporadas, ganha algum título em 40-54% e a Libertadores em 7-17%. O time pesadelo cai em 97-98%. Na política "pior nota", 170 de 700 escaparam do Z4, 21 terminaram no top 10 e 9 ganharam algum título. Existe zebra, mas é rara: um time entre os 4 mais fracos ganha algum título em 1,6% das temporadas.

O comentário antigo em draft.js:111-114 dizia G4 de 64% para a maior nota e Z4 de 13-18% para o aleatório. O medido é **G4 54%** e **Z4 23%**.

### 2.2 Esquemas: nenhum domina, e a escolha pesa pouco

Maior nota, n=250 por esquema:

| esquema | atq/def | pts | G6 | Z4 | campeão BR |
|---|---|---|---|---|---|
| 4-2-3-1 | 60,9/60,6 | 62,3 | 72,4% | 0,0% | 19,2% |
| 3-4-3 | 62,8/58,1 | 62,0 | 75,6% | 1,6% | 18,0% |
| 3-5-2 | 60,9/59,5 | 61,2 | 71,2% | 2,8% | 19,2% |
| 4-3-3 | 61,6/58,9 | 60,9 | 71,6% | 1,6% | 12,4% |
| 4-4-2 | 60,4/60,5 | 60,7 | 71,2% | 2,4% | 13,2% |
| 4-1-4-1 | 59,7/61,0 | 59,9 | 63,2% | 1,6% | 12,0% |
| 5-3-2 | 58,8/62,0 | 59,4 | 63,6% | 4,8% | 11,2% |

A diferença entre o melhor e o pior esquema é de ~3 pontos. A soma atq+def varia só entre 120,4 e 121,5 de um esquema para outro. O 3-4-2-1 existe na `TATICA` (e 3 clubes CPU o usam), mas não está no seletor.

### 2.3 Quem sai da Série A e Libertadores × Sul-Americana

- Com n=50 por clube, trocar quem sai não mostra efeito claro: sem o Flamengo, o usuário é campeão em 14%; sem a Chapecoense, em 10%. Os 20 clubes funcionaram como "quem sai" sem erro.
- Libertadores e Sul-Americana dão o mesmo resultado no Brasileirão. Na Sul-Americana o título vem com mais frequência (6,7% contra 4,2%).

## 3. Realismo, regulamento, estados quebrados, desempenho

### 3.1 Brasileirão simulado × real (1,9 milhão de jogos)

| métrica | simulado | referência real |
|---|---|---|
| gols/jogo | 2,25 | 2,4-2,6 |
| mandante / empate / visitante | 43,0% / 27,8% / 29,2% | ~47-50% / ~26% / ~24-26% |
| 0×0 | 10,6% | ~7-8% |
| pontos do campeão (p10-p90) | 71,5 (66-78) | 75-85 |
| pontos do 4º / 16º / 17º / lanterna | 61,4 / 44,0 / 42,1 / 31,7 | ~65 / ~45 / ~43 / 20-30 |

A liga está achatada e a vantagem de jogar em casa é pequena.

**Campeões:**
- Brasileirão: Flamengo 29%, Palmeiras 24%, usuário 9%.
- Libertadores: só 39% têm campeão brasileiro; os times de altitude (IDV, LDU e outros) ficam com ~20%.
- Mata-mata: 1,95 gol por jogo e 20% dos confrontos nos pênaltis.

### 3.2 Checagens automáticas: tudo ok nas 5.000

- 380 jogos no BR e 38 por time; 61 na Copa do Brasil; 125 na Libertadores; 141 na Sul-Americana.
- Nenhuma exceção, NaN, loop, time contra si mesmo, time indefinido, time duas vezes numa etapa ou dois jogos no mesmo dia.
- Nenhum agregado empatado sem pênaltis.
- `Motor.agenda` bateu 100% com quem jogou.

### 3.3 Bugs encontrados (corrigidos na seção 7)

1. **Nome do clube igual a um convidado da Copa do Brasil** (Fortaleza, Ceará, Sport Recife, Juventude, Goiás, Criciúma, América-MG, Cuiabá, Novorizontino, Avaí, Paysandu, CRB): o id era o nome. O clube do usuário virava o time CPU (força 52, draft ignorado) em 400 de 400 temporadas, e 25 de 400 tiveram "Fortaleza × Fortaleza".
2. **Expulso seguia marcando e perdendo pênalti**: 19.134 gols e 1.422 pênaltis perdidos por jogador já expulso nas 5.000 temporadas (~3% das expulsões).
3. **Pênaltis de estrangeiros e convidados** apareciam como "cobrador 1…11", embora `Motor.ELENCOS` tenha os nomes.
4. **Toque duplo no celular** escolhia a carta da vaga seguinte, e um clique depois do fim do draft ainda chamava `escolher` (sem trava).
5. **Resumo da temporada** mostrava "18º · 0 pts · 0/38" antes do primeiro jogo, com a posição tirada da ordem alfabética.
6. **Resumo do draft** mostrava "Média do onze 83 · Ataque 61 · Defesa 58": escalas diferentes lado a lado, sem aviso.

### 3.4 Pendentes, não corrigidos

Estes não são claramente bugs contra o que o `dados/competicoes-2026.json` descreve: o JSON só fala em formato e datas "oficiais ou aproximadas".

- **Desempate nos grupos** da Conmebol usa vitórias como 2º critério (`ordenar`, motor.js:158-161). A Conmebol usa saldo e gols.
- **Da quarta de final em diante**, o mando da volta vai para o vencedor do lado de cima da chave, e não para a melhor campanha (motor.js, `chaveFixa`).
- **Jogos em dias seguidos**: 1,5-1,9 por temporada para quem avança nas copas. As datas da Copa do Brasil caem em sábado (01/08) e domingo (semifinais 01/11 e 08/11). As finais da Libertadores e da Sul-Americana caem em sábado, véspera de rodada. `datasSemanais` só olha o domingo.
- **Vaga de MC**: só 6 jogadores são MC, então o pool cai na família M e ~31% das escolhas de MC são de outra função (a carta aparece como "Volante" numa vaga MC).
- **Goleiro concreto**: não existe goleiro 86+, então os 7% de concreto nunca valem para o goleiro.
- Código morto: `Motor.proximaDoUsuario` (motor.js:444).

### 3.5 Desempenho

Uma temporada (~520 jogos) leva mediana de 11 ms e máximo de 33 ms no node. As 5.000 tentativas levam ~25 s com 4 processos.

## 4. Jogabilidade e UX

- **A escolha no draft é trivial: pegue o maior número.** A função da vaga e os eixos não pesam, e não há química. A maior nota bate o aleatório por ~5 pontos de média de overall, o que vale G6 70% contra 22%.
- **O esquema quase não importa** (seção 2.2).
- **As odds do leque não deixam o draft "igual".** 87% dos leques têm pelo menos um tijolo ou concreto e a amplitude média é de 11,8 pontos. Dois drafts pela maior nota, no mesmo esquema, têm 2,3 de 11 jogadores em comum.
  - Com as odds do envelope, testadas no experimento `envelope`: o aleatório cai em 55% das temporadas e a maior nota vai ao G6 em só 37%.
  - As odds atuais estão boas. Só a documentação está errada.
- **Faltam decisões durante a temporada.** Não há tática por jogo, reserva, lesão, suspensão ou mercado.

## 5. Experimentos de balanceamento (não aplicados)

São 2.100 tentativas por cenário, sobre o código já corrigido:

| cenário | gols/j | mandante | campeão | 17º | aleatório Z4 | maior nota G6 | pior nota Z4 |
|---|---|---|---|---|---|---|---|
| base | 2,25 | 43,0% | 71,5 | 42,2 | 24,3% | 70,1% | 76,7% |
| odds do envelope | 2,26 | 43,0% | 71,6 | 42,2 | 55,3% | 36,6% | 93,3% |
| motorB: K 21, mandante 1,36, visitante 0,93 | 2,38 | 47,2% | 74,1 | 41,4 | 19,6% | 75,9% | 86,4% |
| motorC: motorB + régua dp 4,0 | 2,41 | 47,3% | 77,1 | 40,3 | 20,3% | 82,9% | 94,7% |
| altitude 1,12/0,92 | 2,26 | 43,0% | 71,4 | 42,2 | 18,0% | 71,3% | 76,7% |

## 6. Propostas (balanceamento e conteúdo, fora das correções)

- **Motor:** usar o motorB (mais realista sem virar determinístico). O motorC fica mais realista ainda, mas sobra pouca zebra.
- **Altitude:** reduzir para 1,12/0,92 e tirar ~1,5 de força de IDV e LDU.
- **Esquemas:** dar trade-offs reais à `TATICA` (5-3-2 forte fora e no mata-mata, 3-4-3 forte em casa) e incluir o 3-4-2-1 no seletor.
- **Dificuldade:** expor "quem sai" como nível de dificuldade.
- **Resumo do draft:** mostrar as chances estimadas (G6/Z4/título) com 50 simulações (~0,5 s).
- **Conteúdo novo:**
  - química por clube e posição;
  - banco de 5 reservas alimentando o `reforco` que o motor já aceita (com lesões e suspensões);
  - eixos no motor;
  - desafio diário com semente;
  - modo carreira 2024 → 2026 com os retratos que já existem;
  - postura antes dos jogos decisivos.

## 7. Depois das correções

**Mudanças:**
- **motor.js**
  - `sortearAutor` (linha 64) aceita um conjunto `fora` com quem não pode ser sorteado. Se a lista esvaziar, gasta o sorteio mesmo assim, para o rng seguir igual.
  - `jogar` (`expulsosAte`, linha 88) tira do sorteio, a partir do minuto da expulsão, quem foi expulso. Vale para gol (linha 118) e para pênalti perdido (linha 96).
  - A ordem das chamadas ao rng não mudou.
- **draft.js**
  - O clube do usuário tem id interno fixo `_seu_clube` (linhas 260-261), independente do nome. A tela usa `nomeDe`.
  - `escolher` (linhas 214-221) ignora o clique com o draft completo, o clique dentro de uma trava de 350 ms depois de cada escolha e a carta que não é do leque aberto.
  - `cobradores` (linha 494) usa o elenco de `Motor.ELENCOS` (via `artilheiros`, goleiro por último) quando o time não tem onze. Tira da fila os expulsos do jogo (linhas 516-517). "cobrador N" ficou só como fallback.
  - `situacao("bra")` mostra "—" antes da 1ª rodada (linha 735).
  - O resumo do draft passa a mostrar "Média do onze (cartas)", "Força de ataque" e "Força de defesa", com uma nota explicando a escala: média da Série A e o mais forte, já com o esquema (linhas 286-305).
  - O comentário das chances do leque foi atualizado com os números medidos (linha 111).

**Bateria: mesmas 5.000 sementes, antes × depois**

| métrica | antes | depois |
|---|---|---|
| exceções / problemas de calendário e regulamento | 0 / 0 | 0 / 0 |
| jogos BR/CdB/LIB/SUL por temporada; 38 por time | 380/61/125/141; ok | 380/61/125/141; ok |
| `Motor.agenda` diferente de quem jogou | 0 | 0 |
| clube do usuário = o draftado (nome padrão) | 5.000/5.000 | 5.000/5.000 |
| nome "Fortaleza": virou o time da CPU / temporadas com time contra si | 400/400 / 25/400 | 0/400 / 0/400 |
| gols de jogador já expulso | 19.134 | **0** |
| pênaltis perdidos por jogador já expulso | 1.422 | **0** |
| só a correção do motor: tentativas idênticas (tabela e campeões) | — | 5.000/5.000 |
| todas as correções: tabela do BR idêntica | — | 4.913/5.000 (*) |
| aleatório: posição mediana / campeão BR / G6 / Z4 | 12 / 1,8% / 21,6% / 23,2% | 12 / 1,8% / 21,6% / 23,2% |
| maior nota: campeão BR / G6 / Z4 / CdB | 15,0% / 69,8% / 2,1% / 9,7% | 15,1% / 69,7% / 2,1% / 9,9% |
| pior nota: Z4 | 75,7% | 75,6% |
| gols/jogo, mandante, pontos do campeão | 2,25 / 43,0% / 71,5 | 2,25 / 43,0% / 71,5 |
| tempo por temporada (mediana) | 10,7 ms | 11,0 ms |
| testes de UI (`testes-ui.js`) | — (falham no código antigo) | 12/12 |

(*) As 87 tentativas que divergem têm uma única causa: o id interno `_seu_clube` muda o último critério de desempate (ordem alfabética do id) em empates totais nos grupos. A partir daí, o sorteio segue outro caminho. A distribuição fica igual.

## 8. Fase 2: realista, com decisão do começo ao fim

Feito em 27/09/2026 sobre o código da seção 7. Os arquivos mudados são `draft.js`, `motor.js`, `dados/competicoes-2026.json`, `tem-time-em-casa.html` e `draft.css`.

### 8.1 Como reproduzir

```bash
source ~/.nvm/nvm.sh
scripts/bateria/draft/rodar.sh && node scripts/bateria/draft/metas.js                 # 5.000 tentativas + metas
SEMENTE_BASE=777777 SAIDA=/tmp/b2 scripts/bateria/draft/rodar.sh && node scripts/bateria/draft/metas.js /tmp/b2/tudo.jsonl
node scripts/bateria/draft/esquemas.js 400      # meta 3
scripts/bateria/draft/decisoes.sh 400           # meta 4 por componente
node scripts/bateria/draft/extras.js            # time dos sonhos, tempo das chances, desafio do dia
node scripts/bateria/draft/testes-ui.js         # 24 checagens de tela (sem navegador)
```

### 8.2 O que mudou no jogo

**Força pelos eixos.**
- O ataque de cada jogador sai de FIN, DRI, PAS e RIT; a defesa, de DEF e FIS; o goleiro, de EVI, REF, MAO e SAI.
- Cada função pesa diferente no ataque e na defesa do time (`Motor.PESO_FUNCAO`, `Motor.forcaPorEixos`).
- Clubes da CPU e o seu seguem a mesma regra: 0,6 do onze e 0,4 do elenco (onze + 5).
- A régua é separada para ataque e para defesa.

**Encaixe na vaga.**

| situação | fator |
|---|---|
| na função | 1 |
| função secundária, ou volante/meia no MC | 0,96 |
| mesma linha (improvisado) | 0,88 |
| fora de posição | 0,75 |
| lateral do lado trocado | ×0,95 |

**Entrosamento.**
- Cada companheiro de clube no onze vale +0,5 no ataque e na defesa, até +2,5.
- O time montado do zero começa devendo, e isso muda com a dificuldade: Fácil +0,2, Normal −1,3, Difícil −2,5.
- As cartas mostram selos: "Na função", "Joga aí às vezes", "Improvisado", "Fora de posição" e "+Entrosa ×N".

**Banco de 5.**
- Vagas: goleiro, defensor, meio, ataque e um coringa.
- O banco entra nos 0,4 do elenco e cobre lesão (0,6% por titular por jogo, 1 a 8 jogos) e suspensão (vermelho tira do jogo seguinte).
- Sem reserva que sirva, entra um garoto da base.
- No painel aparece "Desfalques".

**Time de estrelas.** Acima do elenco mais forte da liga, e acima do clube mais forte com esquema + 2, cada ponto de força rende 0,1. Onze craques de onze clubes não rendem a soma deles.

**Esquemas com trade-off** (`ESQUEMAS_TTC`).
- Cada esquema tem base, casa/fora, mata-mata e rival mais forte ou mais fraco.
- Cada um tem uma vaga-chave pelos eixos: 4-3-3 quer ponta rápido e driblador, 4-4-2 quer dupla de área, 5-3-2 quer zagueiros fortes, e assim por diante.
- O 3-4-2-1 entrou no seletor e em `ESQUEMAS`.
- O esquema pode mudar no resumo e durante a temporada: o elenco é reescalado.

**Postura.**
- Antes de cada jogo decisivo (mata-mata, confronto direto da 30ª rodada em diante, e 36ª a 38ª), o cartão pede Pra cima, Equilibrado ou Fechadinho. Ele mostra o que está em jogo ("Ida: 0×1, você precisa tirar 1") e os desfalques.
- Pra cima vale +2,5/−3; Fechadinho, −3/+2,5.
- No contexto certo compensa: Pra cima em casa contra time menor vira +2,5/−1,6; Fechadinho fora contra time maior vira −1,6/+2,5.
- Os outros jogos usam a "Postura nos outros jogos" do painel. O padrão é Equilibrado.

**Janela.** Na pausa da Copa, 1 troca. O jogador escolhe quem sai e vê 5 cartas do mercado, que é mais forte (tijolo 38%, concreto 7%). "Até o próximo decisivo" para ali; "Simular tudo" segue sem trocar.

**Leque e dificuldade.**
- As chances do leque ficam iguais nas três dificuldades: palha 10%, madeira 79%, tijolo 10%, concreto 1% (o 1% é igual ao do envelope).
- A dificuldade muda o entrosamento inicial e as trocas de leque (Fácil 2, Normal 1, Difícil 0).
- Com leque parelho, quem decide é encaixe, entrosamento e eixos, e não "a maior nota".

**Chances no resumo.** São 50 temporadas rápidas com o elenco de agora: G6, Z4, campeão brasileiro e algum título. Levam 0,29 s no Chromium e ~0,85 s no node com a máquina carregada. Rodam em pedaços, sem travar a tela.

**Desafio do dia.**
- A semente vem da data (`ttc-AAAA-MM-DD`).
- O leque de cada vaga sai de data + vaga + ocorrência: quem monta o mesmo esquema vê os mesmos leques.
- O grupo, a temporada e as chances também saem da data. A dificuldade fica em Normal.
- O texto de "Copiar resultado" leva a data e a semente.

**Motor.**
- Calibragem opcional `motor_ttc`, em `dados/competicoes-2026.json`: K 21, mandante 1,40, visitante 0,90, altitude 1,06/0,95, régua dp 4,0, 20% dos 0×0 ganham um gol, teto dos estrangeiros 56.
- O Prata da Casa não passa `calib` e continua com os números antigos.
- Correções gerais, que valem para os dois jogos:
  - desempate Conmebol nos grupos (pontos, saldo, gols pró, gols fora);
  - volta em casa para a melhor campanha da competição, das quartas em diante;
  - rodada do Brasileirão sem jogo de copa na véspera nem no dia seguinte (0 jogos em dias seguidos).
  - Uma rodada de 60 carreiras do Prata da Casa com o motor novo deu 0 erros.
- Ganchos `temp.preJogo` e `temp.posJogo`, para o seu clube mudar de jogo para jogo.

### 8.3 Metas (5.000 tentativas; segunda coluna com outro conjunto de sementes)

| meta | antes (fase 1) | fase 2 (sementes 0) | fase 2 (sementes 777777) | status |
|---|---|---|---|---|
| **1** gols/jogo (2,35-2,55) | 2,25 | 2,35 | 2,35 | PASS |
| **1** mandante % (46-50) | 43,0 | 49,8 | 49,7 | PASS |
| **1** visitante % (24-27) | 29,2 | 25,9 | 25,9 | PASS |
| **1** 0×0 % (7-9) | 10,6 | 8,0 | 8,0 | PASS |
| **1** pontos do campeão (73-82; p10-p90 ~66-88) | 71,5 (66-78) | 74,1 (68-80) | 74,2 (68-80) | PASS |
| **1** lanterna (20-32) | 31,7 | 29,5 | 29,4 | PASS |
| **1** 17º (40-46) | 42,1 | 41,1 | 41,1 | PASS |
| **1** Libertadores com campeão brasileiro % (45-65) | 39,1 | 53,0 | 53,6 | PASS |
| **1** Libertadores com campeão de altitude % (≤ 12) | 19,8 | 11,0 | 11,5 | PASS |
| **1** ida e volta nos pênaltis % (15-25) | 19,9 | 17,9 | 18,0 | PASS |
| **2** inteligente − maior nota, pts (+3 a +6) | ~0 (só a nota contava) | +3,3 | +3,6 | PASS |
| **2** escolhas em que o melhor NÃO é a maior nota % (≥ 25) | 0 | 38,5 | 39,4 | PASS |
| **3** esquema ótimo pro mesmo elenco, máximo % (≤ 40) | — | 26,0 (4-3-3) | — | PASS |
| **3** melhor − pior esquema pro mesmo elenco, pts (≥ 3) | ~2,9 entre esquemas | 5,5 (p10 3,4) | — | PASS |
| **4** decisões boas − sempre Equilibrado, pts (≥ +3) | sem decisões | +5,1 | +5,3 | PASS |
| **4** idem, algum título, pp (+3 a +5) | sem decisões | +14,3 | +21,5 | FAIL (acima; ver 8.4) |
| **5** Fácil: mediana ao acaso / campeão com a maior nota (~9º / ~25%) | — | 9º / 26,7% | 10º / 26,2% | PASS |
| **5** Normal (~12º / ~15%) | 12º / 15,1% | 13º / 19,0% | 13º / 16,9% | PASS |
| **5** Difícil (~15º / ~7%) | — | 14º / 7,6% | 14º / 8,0% | PASS |
| **6** chances no resumo, 50 temporadas (≤ 1 s) | — | 0,29 s (Chromium) | — | PASS |
| **6** desafio do dia: mesmo leque pra dois jogadores | — | sim | — | PASS |
| **7** exceções / calendário / agenda / expulso que marca | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | PASS |
| **7** tempo da temporada, mediana (≤ 30 ms) | 10,5 ms | 16,9 ms | 23,6 ms (máquina carregada) | PASS |
| **7** pior escolha: Z4 % (75-92) / top 12 % (≥ 3) | 75,6 / 6,9 | 79,5 / 4,0 | 80,5 / 4,0 | PASS |
| **7** time dos sonhos: campeão brasileiro (≤ 40%) | 21-37% | 40 / 39 / 23,5% (4-3-3 / 3-4-2-1 / 5-3-2) | — | PASS (no limite) |

Leituras:
- A política "inteligente" ganha da "maior nota" sem precisar de cartas maiores: a média do onze é até menor (80,3 contra 81,4). Ela ganha no entrosamento (4,9 contra 3,1 ligações), no encaixe e nos eixos.
- Lesões e suspensões do seu clube: 3,4 e 5,8 por temporada.
- São 13-14 jogos decisivos por temporada. A política boa usa postura fora do Equilibrado em ~6 deles.
- Com as decisões boas, a janela é usada em ~91% das temporadas.

### 8.4 Meta 4 por componente e o conflito pontos × títulos

`decisoes.sh 400` roda com draft "humano" e a mesma semente em todas as variantes:

| decisões na temporada | Δ pts | Δ algum título |
|---|---|---|
| só postura | +1,1 | +3,8 pp |
| só janela | +1,7 | +7,7 pp |
| só esquema pro elenco | +2,6 | +7,5 pp |
| postura + janela | +2,8 | +9,5 pp |
| tudo | +4,6 | +19,7 pp |

Cada decisão sozinha fica perto da faixa de +3-5 pp. Juntas, +3 pontos já passam de 5 pp, e a meta pede as duas coisas ao mesmo tempo.

Com o time típico (G6 em ~48%, algum título em ~20%), 3 pontos a mais no Brasileirão e uma chance maior no mata-mata mudam muito a disputa de títulos. As duas metas não cabem juntas no mesmo motor. Para caber nos 5 pp, as decisões teriam de valer ~1 ponto, e aí falharia o "≥ +3".

A alternativa mais próxima é medir a meta em "títulos por temporada, contando só o Brasileirão". Nessa medida, "só postura" leva o campeão brasileiro de 8,8% para 12,0% (+3,2 pp, dentro da faixa) e "tudo", de 8,8% para 19,3%.

### 8.5 O que ainda pesa (e propostas)

- **Esquemas defensivos pouco escolhidos.** Com elenco da maior nota, 4-1-4-1 e 5-3-2 quase nunca são o esquema ótimo (2% e 0,8% dos elencos), porque o time forte enfrenta mais rivais fracos. Eles rendem com elenco fraco e no mata-mata. Para os times fortes, dá para dar a eles um bônus de "controle" nas finais.
- **O esquema escolhido na criação raramente é o melhor para o elenco.** Ele é o melhor em 9% dos elencos; o resumo mostra o seletor e as chances para a pessoa descobrir, e trocar vale +3,4 pts em média. Proposta: destacar no resumo "com o 3-4-2-1 esse elenco rende mais".
- **O time dos sonhos está no limite dos 40%.** A folga do teto (`TETO_FOLGA`) é o botão: com folga 1, fica em ~35%, mas a vantagem do "inteligente" cai para +2,6 a +3,0 (no limite da meta 2).
- **A CPU não tem lesão nem entrosamento variável.** A média do elenco já cobre isso. Se um dia a CPU tiver desfalques, o banco dela passa a importar também.

### 8.6 Correções depois do teste no celular (27/09)

1. **"Até o próximo jogo decisivo" parado com o cartão aberto.**
   - Com o cartão da postura na tela, o botão chamava o `proximoJogo()`, que desenhava o mesmo cartão de novo. A temporada não andava (80 apertos, 0 etapas).
   - Agora `D.cartao` guarda o cartão aberto. Apertar Próximo jogo, Até o decisivo, Simular ou o calendário com o cartão na tela decide pelo padrão (`seguirCartao`): o decisivo vai no Equilibrado e a janela fecha sem troca. Depois o jogo segue até o próximo decisivo ou a próxima janela.
   - O `testes-ui.js` agora roda o fluxo de verdade num DOM falso (`domfalso.js`). No código de antes, o teste falha: "80 apertos, 80 sem andar".
2. **O cartão do mata-mata mostra o adversário.**
   - O sorteio do mata-mata acontece uma vez só (`confrontosDuplos` e `finalUnica` guardam o par). Antes de mostrar o cartão, o jogo joga as etapas em que você não está (`avancarAte`) e revela o sorteio.
   - O cartão diz, por exemplo, "Ida fora de casa contra Novorizontino · rival mais fraco". Na volta: "Ida: 0×0 · tudo igual · volta em casa · rival mais fraco". No Brasileirão: "em casa/fora · jogo parelho".
   - A bateria confirma que o sorteio não mudou: 920 de 920 tentativas idênticas fora da política "boa", que agora usa o adversário para escolher a postura.
3. **A janela de transferências abre sempre.**
   - Em 150 temporadas por dificuldade × política, ela abriu em 150 de 150: depois do último jogo antes da pausa (31/05), antes do jogo de 19/07.
   - Uso: quem pega a maior nota usa em 96%, com reforço de +5,6 de nota. Quem escolhe ao acaso usa em 49%, com +2,8.
   - "Seguir sem trocar" fecha a janela.
   - Não aparecia antes por dois motivos: o bug 1 travava o "Até o decisivo", e o "Simular até aqui" do calendário pulava a janela. Agora o calendário para nela também.
4. **Resumo no celular.** Os três números cabem numa linha só (3 colunas iguais, números em 1,9rem). Conferido a 390 px.
5. **Desafio do dia.**
   - A primeira linha do "Copiar resultado" convida a comparar: `Desafio 27/09: 12º no BR — e você?`. Com título, fica: `Desafio 27/09: campeão brasileiro, campeão da Copa do Brasil — e você?`.
   - Depois vêm a data e a semente.
   - Repetir o mesmo dia dá os mesmos leques (testado com geradores diferentes). Mudar o dia muda os leques.
6. **Revisão rápida.**
   - O entrosamento lia "2 ligações (−0,3 na força)", que parecia contradição. Agora lê "−0,3 na força (time novo −1,3, +0,5 × 2 ligações)".
   - O cartão explica que os outros botões jogam no Equilibrado.
   - A versão dos arquivos mudou (`?v=2026-09-27b`), para o navegador buscar o código novo.

Fumaça de 1.000 tentativas com as mesmas sementes, código de antes × depois:
- As métricas das políticas sem decisão ficam idênticas (920 de 920 tentativas iguais).
- A política "boa" ganha +6,1 pts, porque agora vê o adversário antes da postura.
- 0 exceções no código novo. As 80 do código antigo são da bateria nova chamando `parDoUsuario`, que não existia lá.

## 9. Fase 4: emoção do pacote e jogos que valem de verdade (27/09)

```bash
scripts/bateria/draft/rodar.sh && node scripts/bateria/draft/metas.js                 # metas, agora com o grupo [E] (emoção)
SEMENTE_BASE=777777 SAIDA=/tmp/b2 scripts/bateria/draft/rodar.sh && node scripts/bateria/draft/metas.js /tmp/b2/tudo.jsonl
node scripts/bateria/draft/estrela.js 40 50     # uma estrela no lugar de um madeira: quanto mexe nas chances
node scripts/bateria/draft/decisivos.js 300 [humano|aleatorio|melhor]   # paradas "Até o próximo decisivo" por temporada
```

### 9.1 Emoção

- **Chances do leque:** palha 10%, madeira 62%, tijolo 20%, concreto 8%. Antes eram 10/79/10/1.
- **Contrapeso para a estrela não decidir sozinha**, usando as alavancas que já existiam:
  - o elenco (antes de entrosamento e esquema) que passa de 7,5 pontos abaixo do elenco mais forte da CPU rende só 0,3 por ponto (`JOELHO_ELENCO`, `RENDE_ACIMA_DO_JOELHO`);
  - o entrosamento vale mais: +0,9 por ligação, até +4;
  - o time novo começa mais atrás: Fácil −1,5, Normal −2,7, Difícil −4,3;
  - a folga do time pronto sobre o clube mais forte caiu de 2 para 1,5.

| Normal | antes (fase 3) | fase 4 (sementes 0 / 777777) | meta |
|---|---|---|---|
| drafts que mostram 2+ concretos | 10,6% | **93,8% / 93,9%** | ≥ 90% |
| drafts que mostram 1+ concreto | 41,9% | 99,0% / 99,2% | — |
| leques com tijolo ou concreto | 43,3% | **77,7% / 77,7%** | ≥ 70% |
| concretos vistos por draft | 0,5 | 4,3 | — |
| concretos escolhidos pela maior nota | ~0,5 | 3,7 | — |

**A estrela ainda é estrela** (`estrela.js`, mesmas sementes). Um concreto no lugar de um titular madeira da mesma função, com 50 temporadas por elenco:

| elenco | força | G6 | campeão BR | algum título | posição média |
|---|---|---|---|---|---|
| típico ("humano") | +1,35 | +10,0 pp | +3,9 pp | +5,8 pp | −1,1 |
| da maior nota | +1,07 | +5,0 pp | +4,8 pp | +6,7 pp | −0,5 |

A caixa de chances do resumo mostra essa diferença.

### 9.2 Jogos que valem

- No Brasileirão, o jogo só é decisivo nas 6 últimas rodadas e com uma linha da tabela em jogo para você: título, G6/Libertadores, Sul-Americana (12º) ou fugir do Z4.
- A linha está em jogo se você estiver a até 2 pontos dela (4 nas 2 últimas rodadas) e a conta ainda puder virar com os pontos que faltam (`emJogoNoBrasileirao`).
- O cartão diz o que está em jogo ("Em jogo: a vaga na Libertadores · falta 1 ponto").
- Mata-mata e finais continuam sempre decisivos.

| paradas por temporada | antes (36ª-38ª sempre) | depois |
|---|---|---|
| draft típico ("humano"): média (p10-p90) | 12,7 (8-17) | 12,4 (7-18) |
| ao acaso | 11,1 (7-16) | 10,4 (5-16) |
| maior nota | 13,8 (9-19) | 12,3 (6-18) |
| no Brasileirão (humano) | 4,2, com 0% das temporadas sem nenhuma | 3,0, com 18% das temporadas sem nenhuma (nada em jogo) |
| por mês (humano, depois) | — | abr 1,0 · mai 1,0 · jul 0,5 · ago 3,6 · set 1,5 · out 1,5 · nov 3,0 · dez 0,2 |

**Metade da meta de 6-12.** A média cai para 10-12, mas o p90 fica em 16-18. Quem vai longe nas copas soma 7-9 paradas só no mata-mata (Copa do Brasil 5,4 + continental 3,9 no draft típico).

Para caber sempre em 12, mantendo "todo mata-mata decisivo", só dando menos parada no Brasileirão, e ele já está em ~3. A alternativa mais próxima: tornar decisivo só o jogo de volta e a final (a ida vira jogo comum, com a postura do painel). Isso tira ~3-4 paradas de quem vai longe.

### 9.3 Metas depois da fase 4

| meta | sementes 0 | sementes 777777 |
|---|---|---|
| 1 realismo (gols, mandante, visitante, 0×0, campeão, lanterna, 17º, Libertadores, pênaltis) | todas PASS: 2,35 · 49,7% · 25,9% · 8,0% · 74,0 · 29,4 · 41,0 · 52,7% brasileiro / 11,1% altitude · 18,0% | todas PASS |
| 2 inteligente − maior nota (≥ +3) | +3,5 | +3,2 |
| 2 escolhas que não são a maior nota (≥ 25%) | 40,0% | 40,6% |
| 3 esquema ótimo mais frequente (≤ 40%) / melhor − pior (≥ 3) | 27,5% / 5,5 pts | — |
| 4 decisões boas − Equilibrado: pts (≥ +3) / títulos (+3 a +5 pp) | +3,6 / +6,8 pp (FAIL: acima) | +4,3 / +12,5 pp (FAIL: acima) |
| 5 Fácil / Normal / Difícil: mediana ao acaso | 8 / 12 / 15 | 9 / 11 / 13 (Difícil: FAIL por 1 posição; n=225) |
| 5 campeão com a maior nota | 24,9 / 17,1 / 8,4% | 23,6 / 16,7 / 5,3% |
| 7 time dos sonhos campeão (≤ 40%) | 37 / 31,5 / 22,5% | — |
| 7 pior escolha: Z4 (75-92) / top 12 (≥ 3) | 80,0% / 5,3% | 75,3% / 3,5% |
| 7 erros, calendário, expulso que marca, tempo | 0 · 0 · 0 · 17,6 ms | 0 · 0 · 0 · 15,9 ms |
| E emoção | PASS (acima) | PASS |

- `testes-ui.js`: 42 ok. Entram três checagens novas:
  - mata-mata sempre decisivo;
  - nenhuma rodada decisiva fora das 6 últimas e todo cartão de rodada com "Em jogo";
  - a 36ª-38ª às vezes decisiva, às vezes não.
- Chromium, temporada inteira no "Até o próximo decisivo": 0 erros no console.

### 9.4 Ida do mata-mata vira jogo comum (proposta da 9.2, aplicada)

- A ida do mata-mata não pergunta mais a postura: vale a do painel ("Postura nos outros jogos", Equilibrado se ninguém mexer).
- Perguntam a volta, com o agregado na mesa, e a final em jogo único (`ehIda` e `decisivaParaUsuario`).
- Embaixo do placar aparece a linha "Próximo: Copa do Brasil · Oitavas (ida) contra X (12 de ago.). Ida: vale a postura do painel (Equilibrado); a volta pergunta." Ela muda na hora em que a pessoa troca a postura do painel.
- O calendário mostra o mesmo aviso no "Próximo".
- A regra do Brasileirão ("Em jogo") não mudou.

`decisivos.js 300` (paradas de "Até o próximo decisivo" por temporada):

| draft | fase 4 | agora | meta |
|---|---|---|---|
| típico ("humano") | 12,4 (p10 7, p90 18) | **7,9 (p10 4, p90 11)** | média 7-10, p90 ≤ 12 |
| ao acaso | 10,4 (5-16) | 7,0 (3-11) | |
| maior nota (vai mais longe) | 12,3 (6-18) | 7,8 (4-12) | |

Média por mês no draft típico: mai 1,0 · jul 0,3 · ago 1,6 · set 1,0 · out 1,2 · nov 2,6 · dez 0,2. Ficam no Brasileirão 3,0, na Copa do Brasil 2,8 e na continental 2,1.

- **Decisões boas − sempre Equilibrado:** +4,1 pts (`decisoes.sh 400`, igual à fase 4, meta ≥ +3). A política boa escolhe a postura da ida pelo contexto, no painel, com o adversário já sorteado.
- **Fumaça de 1.000 tentativas, fase 4 × agora:** 920 de 920 tentativas iguais fora da política "boa". As métricas não se mexem.
- **`testes-ui.js`:** 44 ok. Checam que a ida não pede postura, que a volta e a final pedem, e que a dica "Ida: vale a postura do painel (Equilibrado)" aparece.
