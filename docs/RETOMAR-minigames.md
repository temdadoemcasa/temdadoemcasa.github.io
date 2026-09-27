# RETOMAR — minigames (Prata da Casa e Tem Time em Casa)

Atualizado em **2026-09-27 (noite)**. Branch `prata-evolucao-e-caminho` (saiu de `integracao-main`), no GitHub, **não está no `main`**.

## Antes de tudo: o `main` andou em paralelo

O `origin/main` recebeu os PRs #33–#38 de outra sessão enquanto esta branch era feita. Tentativa de merge em 27/09: **23 conflitos no `carreira.js`** + `index.html`, `prata-da-casa.html` e `tem-time-em-casa.html` (só o `?v=` dos arquivos). Os conflitos de verdade:

- **Curva de evolução (o principal):** aqui, `trajetoria` faz 94% do caminho até os 24 (expoente 2, maduro aos 24/26); no `main` (#36), expoente 2,3 até o pico e "evolução mais rápida entre 17 e 22"; e o #37 fez a evolução depender da liga (A > B > C > D). Os dois lados resolvem o mesmo pedido do dono de jeitos diferentes. **Juntar exige escolher um modelo (ou combinar) e recalibrar com a bateria:** as metas de auge abaixo foram medidas SEM as mudanças do `main`.
- **Lances:** o `main` pôs `emCampo: true` e `fezGol(J)` nos lances; aqui eles passaram a usar `chanceLance` (dificuldade pela liga) e alguns centros mudaram (driblar o goleiro 66, desarme limpo 74, jogar no sacrifício 70). Resolver somando os dois.
- `?v=` dos arquivos: usar uma versão nova, maior que as duas.

Caminho sugerido: merge do `origin/main` na branch → resolver → `scripts/bateria/prata/bateria.sh` (4 processos) → reajustar `DERIVA_POTENCIAL`/`FAIXAS_POTENCIAL` até bater as metas → `node scripts/bateria/draft/testes-ui.js` e `scripts/bateria/draft/rodar.sh` → push do `main`.

## O que esta branch fez (7 commits)

### Prata da Casa
- **Crescimento:** 94% do caminho até o potencial aos 24 (goleiro 26); o resto devagar até o pico. Aos 24, potencial 83–88 dá 83 no aleatório e 86 jogando bem (antes 79/81).
- **Carta equilibrada** (pedido do dono): atributo no máximo OVR + 8 ao subir; na queda, o que passa de OVR + 6 cai primeiro. Nenhuma carta passa de OVR + 7 do auge ao fim (antes até +17).
- **Caminho:** destaque na B/C/D (nota ≥ 7, ou garoto titular com nota ≥ 6,7) vai direto pra Série A; clube pequeno vende quem sobe depois de ano bom (70%). Porta da Europa: OVR 82 (20–24) ou 84 (18–19).
- **Potencial vira promessa:** escorrega 0,8/ano até os 24 se as escolhas não compensam (−6 a +2 do sorteado). Faixas: 76–84 58%, 85–89 24,5%, 90–92 12%, 93–95 4%, 97–99 1,5%.
- **Metas do auge (dono, 27/09):** jogando sério 94+ ~6–8%, 91–93 ~13%, 88–90 ~17%; aleatório 94+ ~5%. Medido: estratégica 9,6 / 12,4 / 20,1%; aleatória 4,9 / 5,3 / 15,1%.
- **Bola de Ouro:** abaixo de 94–95, cada Bola já ganha pesa na próxima (auge 91–93: no máximo 2). 94+ segue "adoidado" (média 5,4, máx 11).
- **Veterano:** carreira até os 40 (goleiro 42), sem aposentadoria sorteada; botão **Pendurar as chuteiras** a partir dos 34 (dois toques). Queda: até 1/ano depois do pico, 1–2/ano a partir dos 34. Veterano na Europa (34+, OVR < 90): clube não renova, tenta revender, proposta garantida de clube brasileiro, reserva só por um ano. Na Europa aos 35: 24%; aos 36: 8%.
- **Lances:** dificuldade pela força da liga (`chanceLance`) só nos lances de jogo (e no clássico).
- Bateria: todas as metas PASSA (`scripts/bateria/prata/metas.js`); política da bateria pendura a partir dos 34 (mediana 36).

### Tem Time em Casa (draft)
- Você escolhe a vaga: toque na vaga vazia abre o leque dela; toque no jogador e no destino muda de posição (ou troca dois que cabem na vaga um do outro).
- **Fim do roubo** (ir e voltar com o ⇄ refazia o leque): cada vaga sorteia UMA vez no draft; a vaga que esvazia volta com o que sobrou do leque dela. Teste em `testes-ui.js` (falha com o código antigo).

## Decisões com o dono (pendentes)

1. **Freios do time montado** (`draft.js:611`): um onze de média 85 empata com Palmeiras (83,7) e Flamengo (84,1) porque (a) time novo −1,4 de entrosamento, (b) o que passa do elenco mais forte da CPU rende 25%, (c) teto ~+3 sobre o clube mais forte. Proposta: rende 50% e teto +6 → quem monta bem vai de ~31% pra ~40–45% de título brasileiro. Dono disse "show" — confirmar antes de mexer.
2. **Libertadores:** hoje 78,7% de campeão brasileiro (meta atual 75–80; real 2019–2025: 7 de 7). Proposta: ~88%, tirando parte do +3,1 que soma em todo estrangeiro (`dados/competicoes-2026.json`, `estrangeiros`).
3. **Fluminense campeão 3 vezes seguidas:** na bateria o Flu leva o BR em 8,7% (Fla 29,9%, Pal 25,3%). Perguntar se o dono estava no **desafio do dia** (mesma semente o dia todo, temporada repete de propósito). Se não, investigar.
4. Zebras medidas (não mexer sem pedido): 3º mais forte fora x Remo em mata-mata perde 15%, por 2+ 3,5% (Brasileirão real top-4 fora x Z4: 11% / 6,8%, 44 jogos); seu time em casa x Junior perde 12%.
