"""A frase de cada barra do Top 10 em Casa, aberta pela dica junto com as iniciais.

Tres tipos, todos fatos da base (nada inventado; sem fato, sem frase):
- clubes:      "Já passou por X e Y" -- clubes da carreira (appearances + transfers do
               Transfermarkt), sem o clube que a barra ja mostra, os mais conhecidos primeiro;
- copa:        "Jogou a Copa de 2022 com Fulano" -- mesma selecao na mesma Copa (escalacoes
               do SofaScore no banco do futdata, casadas com o Transfermarkt por nome +
               nascimento + pais);
- companheiro: "Foi companheiro de Fulano no Clube" -- jogaram juntos (mesmo jogo, mesmo
               clube) no Transfermarkt.
O famoso citado nunca esta no mesmo ranking (senao a dica entregaria outra resposta) e
precisa ter valido pelo menos FAMOSO no Transfermarkt. O tipo de cada barra sai de um
sorteio fixo por ranking + jogador (o desafio do dia e igual pra todo mundo); se o tipo
sorteado nao tem fato pra esse jogador, vale o proximo da fila.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

import duckdb

TIPOS = ["clubes", "copa", "companheiro"]
FAMOSO = 20_000_000  # maior valor de mercado do citado, em euro
JOGOS_JUNTOS = 5  # companheiro de clube: pelo menos isso de jogos lado a lado
# base, sub-23, time B: nao e "clube conhecido" e confunde com o principal
TIME_DE_BASE = re.compile(r"\b(U\d\d|B|II|Castilla|Primavera|Juvenil|Sub-?\d\d|Jong|Reserves?|Youth)\b", re.I)
# "no Real Madrid", mas "na Juventus": artigo do clube no portugues do torcedor
FEMININOS = {"Juventus", "Inter", "Roma", "Lazio", "Fiorentina", "Atalanta", "Sampdoria", "Udinese", "Salernitana",
             "Spezia", "Cremonese", "Real Sociedad", "Chapecoense", "Ponte Preta", "Portuguesa", "Ternana", "Reggina",
             "Lazio", "Sampdoria", "Sociedad", "Fiorentina"}


# o nome oficial do Transfermarkt que o limpar_clube do gerador nao encurta
CURTOS = {
    "Club Atlético River Plate": "River Plate", "Club Atlético Boca Juniors": "Boca Juniors", "Club Atlético Lanús": "Lanús",
    "Club Atlético Talleres": "Talleres", "Racing Club Asociación Civil de Avellaneda": "Racing",
    "Instituto Atlético Central Córdoba": "Instituto", "Club de Regatas Vasco da Gama": "Vasco",
    "Clube Atlético Mineiro": "Atlético-MG", "Clube Atlético Paranaense": "Athletico-PR", "Clube de Regatas do Flamengo": "Flamengo",
    "Cruzeiro Esporte Clube": "Cruzeiro", "Grêmio Foot-Ball Porto Alegrense": "Grêmio", "S. A. F. Botafogo": "Botafogo",
    "Santos Futebol Clube": "Santos", "Sociedade Esportiva Palmeiras": "Palmeiras", "Sport Club Internacional": "Internacional",
    "Sport Club Corinthians Paulista": "Corinthians", "São Paulo Futebol Clube": "São Paulo", "Fluminense Football Club": "Fluminense",
    "Associação Chapecoense de Futebol": "Chapecoense", "Esporte Clube Bahia": "Bahia", "Fortaleza Esporte Clube": "Fortaleza",
    "Esporte Clube Vitória": "Vitória", "Esporte Clube Juventude": "Juventude", "Ceará Sporting Club": "Ceará",
    "Coritiba Foot Ball Club": "Coritiba", "Sport Club do Recife": "Sport", "Red Bull Bragantino": "Bragantino",
    "Clube do Remo": "Remo", "Mirasol Futebol Clube": "Mirassol",
    "AO FK Zenit Sankt-Peterburg": "Zenit", "PFK CSKA Moskva": "CSKA Moscou", 'Футбольный клуб "Локомотив" Москва': "Lokomotiv Moscou",
    "Beşiktaş Jimnastik Kulübü": "Beşiktaş", "Bologna Football Club 1909": "Bologna", "Fußballclub Red Bull Salzburg": "Salzburg",
    "Panathinaikos Athlitikos Omilos": "Panathinaikos", "FK Partizan Belgrade": "Partizan", "FC Shakhtar Donetsk": "Shakhtar Donetsk",
    "FC Girondins Bordeaux": "Bordeaux", "EA Guingamp": "Guingamp", "ESTAC Troyes": "Troyes", "FC Lorient": "Lorient",
    "FC Schalke 04": "Schalke 04", "FC Midtjylland": "Midtjylland", "FC Volendam": "Volendam", "SC Freiburg": "Freiburg",
    "SC Braga": "Braga", "SD Eibar": "Eibar", "UD Las Palmas": "Las Palmas", "CD Leganés": "Leganés", "UC Sampdoria": "Sampdoria",
    "RSC Anderlecht": "Anderlecht", "SV Werder Bremen": "Werder Bremen", "Beerschot VA": "Beerschot", "CF América": "América-MEX",
    "Deportivo de La Coruña": "Deportivo La Coruña", "Al-Ahli Saudi": "Al-Ahli", "AZ Alkmaar": "AZ",
}
# nome do SofaScore que o paises.py (Transfermarkt/Wikipedia) nao conhece
PAISES_SOFASCORE = {"USA": "us", "Bosnia & Herzegovina": "ba", "Côte d'Ivoire": "ci", "Cabo Verde": "cv"}
FORA_DO_ALFABETO = re.compile(r"[^\u0000-\u024F\s'\".-]")  # cirilico, grego, arabe: o torcedor nao le


def sorteio(ranking_id: str, jogador_id) -> int:
    """Inteiro fixo por ranking + jogador (sha1, igual em qualquer maquina)."""
    return int(hashlib.sha1(f"{ranking_id}|{jogador_id}".encode()).hexdigest()[:8], 16)


def artigo(clube: str) -> str:
    return "na" if clube in FEMININOS else "no"


def lista_e(nomes: list[str]) -> str:
    return nomes[0] if len(nomes) == 1 else ", ".join(nomes[:-1]) + " e " + nomes[-1]


def mesmo_clube(a: str, b: str, normalizar) -> bool:
    """'Bayern' x 'FC Bayern München' ja limpos: igual ou um dentro do outro."""
    x, y = normalizar(a), normalizar(b)
    return bool(x and y) and (x == y or x in y or y in x)


class Dicas:
    def __init__(self, tm, limpar_clube, normalizar, copas: dict[int, Path] | None = None):
        self.tm, self.limpar, self.norm = tm, limpar_clube, normalizar
        c = tm.c
        # o csv.gz e lido uma vez so: a frase de cada barra consulta essas tabelas centenas de vezes
        c.execute("create or replace temp table ap as select game_id, player_id, player_club_id from appearances")
        c.execute("create or replace temp table tr as select player_id, to_club_id from transfers")
        c.execute("create or replace temp table vm as select player_id, highest_market_value_in_eur from players")
        # fama do clube: quantos jogadores de 20 mi+ ja entraram em campo por ele
        self.fama_clube = dict(c.execute(f"""
            select a.player_club_id, count(distinct a.player_id) from ap a join vm p using (player_id)
            where p.highest_market_value_in_eur >= {FAMOSO} group by 1""").fetchall())
        self.copas = {}  # ano -> {tm_id: set(tm_id dos companheiros de selecao)}
        for ano, banco in sorted((copas or {}).items()):
            self.copas[ano] = self._copa(ano, banco)

    def clube(self, cid):
        """Nome curto do clube, ou None (time de base, nome em outro alfabeto)."""
        bruto = self.tm.clubes.get(cid)
        if not bruto:
            return None
        nome = CURTOS.get(bruto) or CURTOS.get(self.limpar(bruto)) or self.limpar(bruto)
        if TIME_DE_BASE.search(nome) or FORA_DO_ALFABETO.search(nome):
            return None
        return nome

    # --- clubes da carreira ---------------------------------------------------
    def clubes_da_carreira(self, pid) -> list[str]:
        ids = {r[0] for r in self.tm.c.execute("""
            select player_club_id from ap where player_id = ?
            union select to_club_id from tr where player_id = ?""", [pid, pid]).fetchall()}
        clubes = {}
        for cid in ids:
            if cid not in self.tm.clubes:  # fora do clubs.csv (sem clube, aposentado, selecao, divisao de baixo)
                continue
            nome = self.clube(cid)
            if not nome:
                continue
            clubes[nome] = max(clubes.get(nome, 0), self.fama_clube.get(cid, 0))
        return sorted(clubes, key=lambda n: (-clubes[n], n))

    def frase_clubes(self, pid, clube_da_barra):
        outros = [n for n in self.clubes_da_carreira(pid) if not (clube_da_barra and mesmo_clube(n, clube_da_barra, self.norm))]
        if not outros:
            return None
        return f"Já passou por {lista_e(outros[:2])}"

    # --- companheiro de clube ----------------------------------------------------
    def companheiros_de_clube(self, pid):
        """[(companheiro, clube_id, jogos juntos)] do mais famoso pro menos."""
        return self.tm.c.execute(f"""
            with meus as (select game_id, player_club_id from ap where player_id = ?)
            select o.player_id, o.player_club_id, count(*) jogos
            from ap o join meus m on o.game_id = m.game_id and o.player_club_id = m.player_club_id
            join vm p on p.player_id = o.player_id
            where o.player_id <> ? and p.highest_market_value_in_eur >= {FAMOSO}
            group by 1, 2 having count(*) >= {JOGOS_JUNTOS}
            order by max(p.highest_market_value_in_eur) desc, jogos desc, o.player_id""", [pid, pid]).fetchall()

    def frase_companheiro(self, pid, proibidos, citados, sorteado):
        """Um dos 3 companheiros mais famosos (sorteio fixo), cada um no clube em que mais jogaram juntos;
        quem ja foi citado noutra barra do ranking vai pro fim da fila."""
        melhores = {}
        for outro, cid, jogos in self.companheiros_de_clube(pid):
            clube = self.clube(cid)
            if outro in proibidos or not clube:
                continue
            if outro not in melhores or jogos > melhores[outro][1]:
                melhores[outro] = (clube, jogos)
        if not melhores:
            return None
        fila = sorted(melhores, key=lambda o: (o in citados, -(self.tm.jog[o][6] or 0), o))
        frescos = [o for o in fila if o not in citados][:3] or fila[:1]
        outro = frescos[sorteado % len(frescos)]
        citados.add(outro)
        clube = melhores[outro][0]
        return f"Foi companheiro de {self.tm.jog[outro][1]} {artigo(clube)} {clube}"

    # --- Copa do Mundo -------------------------------------------------------------
    def _copa(self, ano, banco: Path):
        """Selecao de cada jogador numa Copa, casado SofaScore -> Transfermarkt.
        So entra quem casou sem duvida: nome (ou uma palavra do nome) + nascimento + pais;
        sem nascimento, nome inteiro + pais e um candidato so."""
        from paises import iso_do_pais

        s = duckdb.connect(str(banco), read_only=True)
        linhas = s.execute("""
            -- pm.team_id e o clube do jogador; a selecao da partida sai do lado (casa/fora) no jogo
            select distinct pm.player_id, t.team_id, t.name, p.name, p.short_name, p.date_of_birth
            from fct_player_match pm join fct_match m using (event_id) join dim_player p using (player_id)
            join dim_team t on t.team_id = case when pm.is_home then m.home_team_id else m.away_team_id end
            where m.season_year = ? and coalesce(pm.minutes_played, 0) > 0""", [ano]).fetchall()
        s.close()
        por_nasc, por_nome, por_nasc_so = {}, {}, {}
        for p, j in self.tm.jog.items():
            nasc = str(j[5])[:10] if j[5] else None
            pais = self.tm.pais(p)
            if nasc:
                por_nasc.setdefault((nasc, pais), []).append(p)
                por_nasc_so.setdefault(nasc, []).append(p)
            por_nome.setdefault((self.norm(j[1]), pais), []).append(p)
        selecao, casados, sem_par = {}, {}, 0
        for sid, time_id, time_nome, nome, curto, nasc in linhas:
            pais = PAISES_SOFASCORE.get(time_nome) or iso_do_pais(time_nome)
            palavras = set(self.norm(nome or "").split()) | set(self.norm(curto or "").split())
            tm_id = None
            if nasc and pais:
                d = str(nasc)[:10]
                cands = [p for p in por_nasc.get((d, pais), []) if palavras & set(self.norm(self.tm.jog[p][1]).split())]
                if not cands:  # cidadania principal do TM e outra (dupla nacionalidade): nome inteiro + nascimento
                    cands = [p for p in por_nasc_so.get(d, []) if self.norm(self.tm.jog[p][1]) == self.norm(nome or "")]
                tm_id = cands[0] if len(cands) == 1 else None
            elif pais:
                cands = por_nome.get((self.norm(nome or ""), pais), [])
                tm_id = cands[0] if len(cands) == 1 else None
            if tm_id is None:
                sem_par += 1
                continue
            if tm_id in casados and casados[tm_id] != sid:  # dois do SofaScore no mesmo TM: nenhum vale
                selecao.pop(tm_id, None)
                continue
            casados[tm_id] = sid
            selecao[tm_id] = time_id
        times = {}
        for tm_id, time_id in selecao.items():
            times.setdefault(time_id, set()).add(tm_id)
        print(f"copa {ano}: {len(selecao)} jogadores casados com o Transfermarkt, {sem_par} sem par seguro")
        return {tm_id: times[t] - {tm_id} for tm_id, t in selecao.items()}

    def frase_copa(self, pid, proibidos, citados, sorteado):
        opcoes = []
        for ano, selecoes in self.copas.items():
            if pid not in selecoes:
                continue
            famosos = sorted((c for c in selecoes[pid] if c not in proibidos and (self.tm.jog[c][6] or 0) >= FAMOSO),
                             key=lambda c: (c in citados, -(self.tm.jog[c][6] or 0), c))
            if famosos:
                opcoes.append((ano, famosos[0]))
        if not opcoes:
            return None
        ano, outro = opcoes[sorteado % len(opcoes)]
        citados.add(outro)
        return f"Jogou a Copa de {ano} com {self.tm.jog[outro][1]}"

    # --- a frase da barra ---------------------------------------------------------
    def frase(self, ranking_id, item, ids_do_ranking, nomes_do_ranking, citados):
        """(tipo, texto) ou None. `item` e a barra ja montada (id, nome, clube); `citados` junta
        os famosos ja usados nas barras de cima do mesmo ranking (pra nao repetir)."""
        pid = item["id"]
        if isinstance(pid, str):  # so na Wikipedia: sem carreira no Transfermarkt
            return None
        proibidos = set(ids_do_ranking) | {pid}
        n = sorteio(ranking_id, pid)
        for k in range(len(TIPOS)):
            tipo = TIPOS[(n + k) % len(TIPOS)]
            if tipo == "clubes":
                texto = self.frase_clubes(pid, item.get("clube"))
            elif tipo == "copa":
                texto = self.frase_copa(pid, proibidos, citados, n // len(TIPOS))
            else:
                texto = self.frase_companheiro(pid, proibidos, citados, n // len(TIPOS))
            # trava final: nenhum nome do ranking (nem o dele) dentro da frase
            if texto and not any(re.search(rf"\b{re.escape(self.norm(x))}\b", self.norm(texto)) for x in nomes_do_ranking):
                return tipo, texto
        return None
