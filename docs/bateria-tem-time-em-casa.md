# Bateria do Tem Time em Casa: 5.000 tentativas (draft + temporada completa)

Auditoria de 26/09/2026. Os scripts estão em `scripts/bateria/draft/` e o modo de rodar está no README de lá.

Os números abaixo vêm da rodada com semente sobre o código de `192edfe` (seção "antes"). A seção 7 compara com o código depois das correções.

## 0. Como reproduzir

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
