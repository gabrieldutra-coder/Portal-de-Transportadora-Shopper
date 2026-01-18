document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.API_BASE;

  const loginInput = document.getElementById("login");
  const senhaInput = document.getElementById("senha");
  const btnLogin = document.getElementById("btnLogin");
  const msg = document.getElementById("msg");

  // Debug rápido (pode remover depois)
  console.log("API_BASE:", API_BASE);
  console.log("btnLogin:", btnLogin);

  if (!API_BASE) {
    if (msg) {
      msg.style.color = "red";
      msg.innerText = "Erro: API_BASE não carregou. Verifique config.js.";
    }
    return;
  }

  if (!btnLogin || !loginInput || !senhaInput || !msg) {
    console.error("IDs não encontrados no HTML. Esperado: login, senha, btnLogin, msg");
    return;
  }

  btnLogin.addEventListener("click", async () => {
    msg.style.color = "#aebac1";
    msg.innerText = "Entrando...";

    const login = loginInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!login || !senha) {
      msg.style.color = "red";
      msg.innerText = "Preencha login e senha.";
      return;
    }

    try {
      const resposta = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        msg.style.color = "green";
        msg.innerText = dados.mensagem || "Login válido ✅";

        localStorage.setItem("token", dados.token);
        localStorage.setItem("login", login);

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 250);
      } else {
        msg.style.color = "red";
        msg.innerText = dados.mensagem || "Login inválido ❌";
      }
    } catch (e) {
      msg.style.color = "red";
      msg.innerText = "Erro ao conectar no servidor. Verifique o backend.";
      console.error(e);
    }
  });
});
