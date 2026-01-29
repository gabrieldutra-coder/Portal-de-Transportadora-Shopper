// CONFIG DE API
// Local: abre com Live Server OU file://
// Produção: Render

(function () {
  const hostname = window.location.hostname;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "" ||          // file://
    hostname === null;

  window.API_BASE = isLocal
    ? "http://localhost:3000"
    : "https://portal-de-transportadora-shopper.onrender.com";

  console.log("API_BASE:", window.API_BASE);
})();
