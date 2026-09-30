// Service worker do Tem dado em casa: o site abre offline e fica instalavel (PWA).
// - pagina (HTML) e .json sem versao: rede primeiro, cai pro cache sem internet
// - js/css com ?v=, imagens e fontes: cache primeiro e atualiza por tras. Versao nova
//   e outra URL (?v= no HTML), entao nao tem risco de misturar versoes.
// Troque VERSAO pra forcar limpar tudo.
const VERSAO = "tdc-2026-09-30";
const PAGINAS = ["./", "index.html", "show-do-dadao.html", "tem-time-em-casa.html", "prata-da-casa.html"];

// instala com as paginas e tudo que elas puxam (scripts, css, dados, imagens do proprio site),
// lido do HTML: assim ja abre offline depois da primeira visita
async function precachear() {
  const c = await caches.open(VERSAO);
  const arquivos = new Set();
  for (const pagina of PAGINAS) {
    try {
      const r = await fetch(pagina, { cache: "no-cache" });
      if (!r.ok) continue;
      await c.put(pagina, r.clone());
      const html = await r.text();
      for (const [, u] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|json|svg|png|webp|jpg)(?:\?[^"]*)?)"/g)) arquivos.add(u);
    } catch { /* sem rede na instalacao: tenta na proxima */ }
  }
  await Promise.all([...arquivos].map((u) => c.add(u).catch(() => {})));
}

self.addEventListener("install", (e) => {
  e.waitUntil(precachear().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const FONTES = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mesmoSite = url.origin === self.location.origin;
  if (!mesmoSite && !FONTES.test(req.url)) return; // contador de visitas, YouTube etc.: direto

  // pagina e dado sem versao na URL (os .json que o site pede sempre frescos): rede primeiro
  const versionado = url.searchParams.has("v") || /\.(png|svg|webp|jpg|woff2?)$/.test(url.pathname) || !mesmoSite;
  if (req.mode === "navigate" || !versionado) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))),
    );
    return;
  }

  e.respondWith(
    caches.open(VERSAO).then(async (c) => {
      const guardada = await c.match(req);
      const rede = fetch(req)
        .then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; })
        .catch(() => guardada);
      return guardada || rede;
    }),
  );
});
