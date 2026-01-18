// CONFIG DE API
// Local: abre com Live Server / localhost
// Produção: troque para sua URL do Render (ex: https://seu-app.onrender.com)

(function () {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // 1) Se você definir manualmente, este valor prevalece:
  // window.API_BASE = "https://seu-app.onrender.com";

  // 2) Fallback automático:
  window.API_BASE = window.API_BASE || (isLocal ? "http://localhost:3000" : "");
})();
