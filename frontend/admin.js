let adminToken = null;

// Base da API (configurada em frontend/config.js)
const API_BASE = window.API_BASE;
if (!API_BASE) {
  alert("API_BASE não configurado. Edite frontend/config.js com a URL do backend (Render)." );
}

// ELEMENTOS
const loginBox = document.getElementById("loginBox");
const panelBox = document.getElementById("panelBox");

const adminUser = document.getElementById("adminUser");
const adminPass = document.getElementById("adminPass");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const loginMsg = document.getElementById("loginMsg");

const statusBox = document.getElementById("statusBox");
const refreshStatusBtn = document.getElementById("refreshStatusBtn");

const usuariosFile = document.getElementById("usuariosFile");
const demoFile = document.getElementById("demoFile");
const qualidadeFile = document.getElementById("qualidadeFile");

const uploadUsuariosBtn = document.getElementById("uploadUsuariosBtn");
const uploadDemoBtn = document.getElementById("uploadDemoBtn");
const uploadQualidadeBtn = document.getElementById("uploadQualidadeBtn");

const panelMsg = document.getElementById("panelMsg");

// ================= FUNÇÕES =================
async function carregarStatus() {
  statusBox.innerText = "Carregando status...";
  panelMsg.innerText = "";

  try {
    const resp = await fetch(`${API_BASE}/admin/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const dados = await resp.json();

    if (!resp.ok) {
      statusBox.innerText = "Erro ao buscar status.";
      panelMsg.innerText = dados.mensagem || "Erro.";
      return;
    }

    statusBox.innerHTML = `
      <div><strong>Usuários carregados:</strong> ${dados.usuarios}</div>
      <div><strong>Logins com demonstrativo:</strong> ${dados.loginsComDemonstrativo}</div>
      <div><strong>Logins com Qualidade:</strong> ${dados.loginsComQualidade || 0}</div>
    `;
  } catch {
    statusBox.innerText = "Erro de conexão.";
  }
}

// ================= LOGIN =================
adminLoginBtn.addEventListener("click", async () => {
  loginMsg.innerText = "Entrando...";

  try {
    const resp = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: adminUser.value.trim(),
        pass: adminPass.value.trim(),
      }),
    });

    const dados = await resp.json();

    if (!resp.ok) {
      loginMsg.innerText = dados.mensagem || "Login inválido.";
      return;
    }

    adminToken = dados.token;
    loginBox.classList.add("hidden");
    panelBox.classList.remove("hidden");

    await carregarStatus();
  } catch {
    loginMsg.innerText = "Erro ao conectar com o servidor.";
  }
});

// ================= STATUS =================
refreshStatusBtn.addEventListener("click", carregarStatus);

// ================= UPLOAD USUARIOS =================
uploadUsuariosBtn.addEventListener("click", async () => {
  if (!usuariosFile.files[0]) {
    panelMsg.innerText = "Selecione o arquivo usuarios.csv.";
    return;
  }

  panelMsg.innerText = "Enviando usuarios.csv...";

  const form = new FormData();
  form.append("file", usuariosFile.files[0]);

  try {
    const resp = await fetch(`${API_BASE}/admin/upload/usuarios`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });

    const dados = await resp.json();
    panelMsg.innerText = dados.mensagem || "Upload finalizado.";
    await carregarStatus();
  } catch {
    panelMsg.innerText = "Erro ao enviar usuarios.csv.";
  }
});

// ================= UPLOAD DEMONSTRATIVO =================
uploadDemoBtn.addEventListener("click", async () => {
  if (!demoFile.files[0]) {
    panelMsg.innerText = "Selecione o arquivo demonstrativo.csv.";
    return;
  }

  panelMsg.innerText = "Enviando demonstrativo.csv...";

  const form = new FormData();
  form.append("file", demoFile.files[0]);

  try {
    const resp = await fetch(`${API_BASE}/admin/upload/demonstrativo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });

    const dados = await resp.json();
    panelMsg.innerText = dados.mensagem || "Upload finalizado.";
    await carregarStatus();
  } catch {
    panelMsg.innerText = "Erro ao enviar demonstrativo.csv.";
  }
});

// ================= UPLOAD QUALIDADE =================
uploadQualidadeBtn.addEventListener("click", async () => {
  if (!qualidadeFile.files[0]) {
    panelMsg.innerText = "Selecione o arquivo qualidade.csv.";
    return;
  }

  panelMsg.innerText = "Enviando qualidade.csv...";

  const form = new FormData();
  form.append("file", qualidadeFile.files[0]);

  try {
    const resp = await fetch(`${API_BASE}/admin/upload/qualidade`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });

    const dados = await resp.json();
    panelMsg.innerText = dados.mensagem || "Upload finalizado.";
    await carregarStatus();
  } catch {
    panelMsg.innerText = "Erro ao enviar qualidade.csv.";
  }
});
