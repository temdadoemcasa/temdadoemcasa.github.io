/* Tema claro/escuro. Roda no <head> pra nao piscar; escuro e o padrao da marca. */
(function () {
  var raiz = document.documentElement;
  var salvo = null;
  try { salvo = localStorage.getItem("tema"); } catch (e) {}
  if (salvo === "claro") raiz.setAttribute("data-tema", "claro");

  function rotular(botao) {
    var claro = raiz.getAttribute("data-tema") === "claro";
    botao.setAttribute("aria-pressed", claro ? "true" : "false");
    botao.setAttribute("aria-label", claro ? "Mudar pro tema escuro" : "Mudar pro tema claro");
    botao.title = botao.getAttribute("aria-label");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var topo = document.querySelector(".topo");
    if (!topo) return;
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "tema-botao";
    botao.innerHTML =
      '<svg class="tema-sol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>' +
      '<svg class="tema-lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z"/></svg>';
    rotular(botao);
    botao.addEventListener("click", function () {
      var claro = raiz.getAttribute("data-tema") !== "claro";
      if (claro) raiz.setAttribute("data-tema", "claro"); else raiz.removeAttribute("data-tema");
      try { localStorage.setItem("tema", claro ? "claro" : "escuro"); } catch (e) {}
      rotular(botao);
    });
    topo.appendChild(botao);
  });
})();
