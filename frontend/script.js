document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const API_BASE = window.API_BASE;
  if (!API_BASE) {
    const msg = document.getElementById("mensagem");
    msg.style.color = "red";
    msg.innerText = "API_BASE não configurado. Edite frontend/config.js com a URL do backend (Render).";
    return;
  }

  const login = document.getElementById("login").value;
  const senha = document.getElementById("senha").value;
  const msg = document.getElementById("mensagem");

  msg.style.color = "red";
  msg.innerText = "Enviando...";

  try {
    const resposta = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha }),
    });

    const dados = await resposta.json();

    if (resposta.ok) {
  msg.style.color = "green";
  msg.innerText = dados.mensagem;

  // token REAL vindo do backend
  localStorage.setItem("token", dados.token);
  localStorage.setItem("login", login);

  window.location.href = "dashboard.html";
} else {
  msg.style.color = "red";
  msg.innerText = dados.mensagem;


    }
  } catch (erro) {
    msg.style.color = "red";
    msg.innerText = "Erro ao conectar no servidor. Verifique se o backend está rodando.";
  }
});
