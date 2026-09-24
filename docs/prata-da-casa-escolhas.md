# Prata da Casa: mapa das escolhas

A carreira é dividida em quatro fases. Cada fase tem as suas perguntas. Uma escolha mexe nos medidores na hora e pode marcar o jogador, e essa marca faz outra pergunta aparecer mais tarde: no mesmo ano (seta cheia) ou num ano seguinte (seta tracejada).
Nenhuma situação se repete na mesma carreira. O foco da pré-temporada é a exceção: ele é a escolha de treino de todo ano.

## Medidores (de -5 a +5)

| Medidor | O que muda na temporada |
|---|---|
| **Técnico** (confiança do treinador) | minutos em campo (o que mais pesa). Zera quando você troca de clube |
| **Cabeça** (disciplina fora de campo) | evolução e nota; negativa aumenta o risco de lesão |
| **Torcida** | nota e vitrine pro mercado |
| **Vestiário** | minutos e evolução (cai pela metade ao trocar de clube) |
| **Imprensa** | vitrine pro mercado |

A projeção do ano (jogos, gols, nota, OVR, vitrine) já conta esses medidores. Por isso cada escolha mexe nos números na hora.

## Fase 1 · Base (16 a 19 anos)

Pouco minuto e pouco dinheiro. Treino e cabeça fora de campo decidem quem sobe.

```mermaid
flowchart LR
  A[Primeira semana no alojamento] -->|Chega uma hora antes<br/>Cabeça +1, Técnico +1| OP[O titular sentiu no aquecimento]
  A -.->|Faz o que o treino pede| OP
  A -.->|Folga é pra voltar pro bairro<br/>Cabeça -1| B[Os amigos do bairro]
  OP -->|Se oferece: chance maior<br/>com rotina e cabeça| OK1[Entrou e não saiu mais<br/>Técnico +2, minutos]
  OP -->|Espera| X1[Chamaram outro garoto]
  B -->|Manda um áudio e fica<br/>Cabeça +1| OK2[Melhor em campo no domingo]
  B -.->|Vai e dá errado<br/>Técnico -2 ou -3| D[A diretoria chamou a família]
  D -->|Muda tudo| OK3[Cabeça +2, volta a ter chance]
  D -->|Diz que é perseguição| X2[Encostado no time B]

  M[O mês não fecha em casa] -.->|Divulga site de apostas<br/>Cabeça -1| P[A publicidade que ficou]
  M -->|Adiantamento ou bico| OK4[Cabeça ou Técnico +1]
  P -->|Mantém a parceria e dá errado| BI[marca: insistiu na bet]
  M -.->|marca: divulgou bet| AL
```

Perguntas soltas da base: treinar com o profissional ou ser titular no sub-20, terminar a escola à noite, celular no alojamento, empresário na porta do CT, estreia, convocação sub-20, o capitão que se oferece pra ser mentor.

## Fase 2 · Afirmação (20 a 24)

O primeiro dinheiro, as redes e as tentações. Polêmica pode render ou afundar.

```mermaid
flowchart LR
  C[Primeiro salário de verdade] -.->|Carro dos sonhos| G[O carro e a fase ruim]
  C -->|Casa pra família / guarda| OKc[Cabeça +1]
  G -->|Responde nas redes| POL1[polêmica +1]

  GR[O grupo da infância aposta nos seus jogos] -.->|Conta a escalação| STJD[Denúncia no tribunal esportivo]
  GR -->|Sai do grupo| OKg[Cabeça +1]
  GR -.->|Avisa, mas continuam| INV[Seu nome numa investigação]
  STJD --> GAN[Gancho de 30 dias a 1 ano]
  GR -.->|marca: vazou| AL

  AL[Aliciador: R$ 100 mil por um amarelo] -.->|Aceita| OPR[Operação sobre apostas]
  AL -.->|Mostra pro clube| TEST[Testemunha da acusação]

  PC[Gol no clássico, na casa deles] -.->|Comemora provocando<br/>55%: Torcida +2 / 45%: expulso| MIC[O microfone]
  MIC -->|Critica o técnico ao vivo| CRIT{deu certo?}
  CRIT -->|sim| T1[Técnico caiu, o novo te escala]
  CRIT -->|não| T2[Afastado, Técnico -4]
  MIC -.->|2+ polêmicas| PER[Você virou personagem]
  PER -->|Aceita o palco| PAL[Vitrine alta ou crise]
  PER -->|Some da mídia| CALM[polêmica -1]
```

Quem mexeu com aposta (publicidade, escalação, parceria mantida) tem mais chance de ser procurado pelo aliciador.

## Fase 3 · Auge (25 a 30)

Liderança, vestiário e decisões grandes.

```mermaid
flowchart LR
  CR[O vestiário contra o técnico] -.->|Fica com o técnico<br/>Técnico +2, Vestiário -2| RA[O racha]
  CR -->|Fica com o grupo| G2{técnico cai?}
  G2 -->|sim| N[Técnico novo, confiança zerada]
  G2 -->|não| T3[Técnico -3]
  REN[O presidente quer renovar] -.->|Assina| BR[A braçadeira]
  REN -.->|Espera a janela| COB[A torcida cobra]
  RIV[Provocação do rival] -->|resultado| DEP[Depois do apito / virou meme]
  DEP -.-> REE[Reencontro com o rival]
  J[A final e o joelho] -.->|Esconde e joga| J2[O joelho de novo]
```

## Fase 4 · Veterano (31+)

O corpo cobra. Hora de pensar no legado.

```mermaid
flowchart LR
  CO[O corpo começou a cobrar] -.->|Gestão de carga| LE[Conversa sobre o futuro]
  CO -.->|Quer jogar tudo| LE
  LE -->|Curso de treinador| FT[marca: futuro técnico]
  MEN[Foi mentorado aos 17] -.-> AP[O garoto da base te pede ajuda]
```

## Como uma temporada escolhe as perguntas

1. O foco da pré-temporada entra todo ano.
2. Entram as consequências que venceram (no máximo duas).
3. Se a fase acabou de começar, entra o arco que abre a fase: a rotina aos 16, o primeiro contrato aos 19–21 e o corpo aos 31.
4. Senão, pode começar um arco novo da fase. Arcos que combinam com as suas marcas pesam mais: quem mexeu com aposta atrai o aliciador.
5. Situações soltas da fase completam o ano. Nenhuma repete na mesma carreira.

No automático ("Simular o resto"), a consequência que venceu resolve sozinha pela primeira opção. Arco novo não começa no automático.
