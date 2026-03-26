let adminToken = null;

const API_BASE = window.API_BASE;
if (!API_BASE) {
  alert("API_BASE não configurado. Edite frontend/config.js com a URL do backend (Render)." );
}

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
const errosFile = document.getElementById("errosFile");
const cestasFile = document.getElementById("cestasFile");

const uploadUsuariosBtn = document.getElementById("uploadUsuariosBtn");
const uploadDemoBtn = document.getElementById("uploadDemoBtn");
const uploadQualidadeBtn = document.getElementById("uploadQualidadeBtn");
const uploadErrosBtn = document.getElementById("uploadErrosBtn");
const uploadCestasBtn = document.getElementById("uploadCestasBtn");

const panelMsg = document.getElementById("panelMsg");

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
      <div><strong>Logins com Erros:</strong> ${dados.loginsComErros || 0}</div>
      <div><strong>Logins com Cestas:</strong> ${dados.loginsComCestas || 0}</div>
    `;
  } catch {
    statusBox.innerText = "Erro de conexão.";
  }
}

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

refreshStatusBtn.addEventListener("click", carregarStatus);

async function enviarCsv(fileInput, endpoint, nome) {
  if (!fileInput.files[0]) {
    panelMsg.innerText = `Selecione o arquivo ${nome}.`;
    return;
  }

  panelMsg.innerText = `Enviando ${nome}...`;
  const form = new FormData();
  form.append("file", fileInput.files[0]);

  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });

    const dados = await resp.json();
    panelMsg.innerText = dados.mensagem || "Upload finalizado.";
    await carregarStatus();
  } catch {
    panelMsg.innerText = `Erro ao enviar ${nome}.`;
  }
}

uploadUsuariosBtn.addEventListener("click", () => enviarCsv(usuariosFile, "/admin/upload/usuarios", "usuarios.csv"));
uploadDemoBtn.addEventListener("click", () => enviarCsv(demoFile, "/admin/upload/demonstrativo", "demonstrativos.csv"));
uploadQualidadeBtn.addEventListener("click", () => enviarCsv(qualidadeFile, "/admin/upload/qualidade", "qualidade.csv"));
uploadErrosBtn.addEventListener("click", () => enviarCsv(errosFile, "/admin/upload/erros", "erros.csv"));
uploadCestasBtn.addEventListener("click", () => enviarCsv(cestasFile, "/admin/upload/cestas", "cestas.csv"));
