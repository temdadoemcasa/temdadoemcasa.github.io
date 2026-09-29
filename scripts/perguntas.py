"""Banco de perguntas do Show do Dadão.

A fonte legivel (perguntas.json) fica fora do site. O site so recebe
dados/perguntas.js, com o JSON embaralhado (XOR + base64): nao e segredo,
so evita que a resposta apareca de cara pra quem abrir o arquivo.

    python3 scripts/perguntas.py codificar caminho/perguntas.json
    python3 scripts/perguntas.py decodificar caminho/saida.json

Formato de cada pergunta:
    {"n": "f|m|d|p", "q": "enunciado", "a": "certa", "e": ["errada", "errada", "errada"], "x": "curiosidade (opcional)"}
n: f = facil (perguntas 1-5), m = medio (6-10), d = dificil (11-15), p = a pergunta final (16).
"""
import base64
import json
import sys
from pathlib import Path

CHAVE = b"temdadoemcasa"
SAIDA = Path(__file__).resolve().parent.parent / "dados" / "perguntas.js"
NIVEIS = {"f", "m", "d", "p"}


def xor(dados: bytes) -> bytes:
    return bytes(b ^ CHAVE[i % len(CHAVE)] for i, b in enumerate(dados))


def validar(perguntas):
    vistos = set()
    for i, p in enumerate(perguntas):
        onde = f"pergunta {i + 1} ({p.get('q', '')[:50]})"
        assert p.get("n") in NIVEIS, f"{onde}: nivel invalido"
        assert p.get("q") and p.get("a"), f"{onde}: sem enunciado ou resposta"
        erradas = p.get("e") or []
        assert len(erradas) == 3, f"{onde}: precisa de 3 erradas"
        opcoes = [p["a"], *erradas]
        assert len(set(opcoes)) == 4, f"{onde}: alternativa repetida"
        assert p["q"] not in vistos, f"{onde}: pergunta repetida"
        vistos.add(p["q"])


def codificar(fonte: Path):
    perguntas = json.loads(fonte.read_text(encoding="utf-8"))
    validar(perguntas)
    # id estavel pelo texto: o jogo lembra quais ja saiu (sem repetir tao cedo)
    for p in perguntas:
        p["id"] = format(abs(hash_estavel(p["q"])) % 16**8, "08x")
    compacto = json.dumps(perguntas, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    texto = base64.b64encode(xor(compacto)).decode("ascii")
    SAIDA.write_text(
        "// Gerado por scripts/perguntas.py. Nao edite a mao.\n"
        f'const PERGUNTAS_CODIFICADAS = "{texto}";\n',
        encoding="utf-8",
    )
    contagem = {n: sum(p["n"] == n for p in perguntas) for n in "fmdp"}
    print(f"{len(perguntas)} perguntas -> {SAIDA.name} {contagem}")


def hash_estavel(texto: str) -> int:
    h = 2166136261
    for b in texto.encode("utf-8"):
        h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    return h


def decodificar(destino: Path):
    js = SAIDA.read_text(encoding="utf-8")
    texto = js.split('"')[1]
    perguntas = json.loads(xor(base64.b64decode(texto)).decode("utf-8"))
    for p in perguntas:
        p.pop("id", None)
    linhas = ",\n".join(json.dumps(p, ensure_ascii=False) for p in perguntas)
    destino.write_text(f"[\n{linhas}\n]\n", encoding="utf-8")
    print(f"{len(perguntas)} perguntas -> {destino}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in {"codificar", "decodificar"}:
        sys.exit(__doc__)
    (codificar if sys.argv[1] == "codificar" else decodificar)(Path(sys.argv[2]))
