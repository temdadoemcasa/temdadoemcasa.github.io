"""Le o feed RSS do canal e grava dados/videos.json.

Roda no GitHub Actions (ver .github/workflows/videos.yml), uma vez por dia.
So biblioteca padrao: o feed publico do YouTube nao pede chave de API, e
o site continua estatico.

Canal sem video e estado VALIDO, nao erro: grava lista vazia e o site
escreve "primeiro video em breve". Feed fora do ar e erro: o script sai
com codigo 1 e NAO sobrescreve o arquivo -- apagar a lista de videos por
uma falha de rede faria o site dizer que o canal esta vazio.
"""

from __future__ import annotations

import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CANAL = "UCUtBkkAXahKuAmfREXLQugA"
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CANAL}"
SAIDA = Path(__file__).resolve().parents[1] / "dados" / "videos.json"
MAXIMO = 6

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def videos_do_feed(xml: str) -> list[dict]:
    """Os videos do feed, mais recentes primeiro, no maximo MAXIMO."""
    raiz = ET.fromstring(xml)
    videos = []
    for entrada in raiz.findall("atom:entry", NS):
        video_id = entrada.findtext("yt:videoId", namespaces=NS)
        if not video_id:
            continue
        videos.append(
            {
                "id": video_id,
                "titulo": (entrada.findtext("atom:title", namespaces=NS) or "").strip(),
                "publicado": entrada.findtext("atom:published", namespaces=NS),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "thumb": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            }
        )
    videos.sort(key=lambda v: v["publicado"] or "", reverse=True)
    return videos[:MAXIMO]


def main() -> int:
    try:
        with urllib.request.urlopen(FEED, timeout=30) as resposta:
            xml = resposta.read().decode("utf-8")
        videos = videos_do_feed(xml)
    except Exception as erro:  # rede ou XML: nao sobrescrever
        print(f"feed indisponivel, videos.json mantido: {erro}", file=sys.stderr)
        return 1
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(videos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(videos)} videos em {SAIDA.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
