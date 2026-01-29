// ================== SESSÃO ==================
const token = localStorage.getItem("token");
const login = localStorage.getItem("login");

if (!token || !login) {
  window.location.href = "index.html";
}

// Base da API (configurada em frontend/config.js)
const API_BASE = window.API_BASE;
if (!API_BASE) {
  alert("API_BASE não configurado. Edite frontend/config.js com a URL do backend (Render).");
}

// ✅ Mensagem padrão quando não existe demonstrativo
const MENSAGEM_SEM_DEMO =
  "A sua transportadora não tem um demonstrativo nessa quinzena, caso tenha dúvidas entrar em contato com o suporte!\n\nNúmero: 11 91591-2131";

// ================== ELEMENTOS ==================
const tituloEl = document.getElementById("titulo");
const selectEl = document.getElementById("periodoSelect");
const msgEl = document.getElementById("mensagemBox");

const copyBtn = document.getElementById("copyBtn");
const pdfBtn = document.getElementById("pdfBtn");
const logoutBtn = document.getElementById("logoutBtn");

const waNameEl = document.getElementById("waName");
const waTimeEl = document.getElementById("waTime");

// ================== TOPO ==================
waNameEl.innerText = login;

// ================== FUNÇÃO DE LIMPEZA PARA PDF ==================
function limparTextoParaPDF(texto) {
  if (!texto) return "";

  // Normaliza acentos e composição de caracteres
  let t = texto.normalize("NFKC");

  // Remove caracteres de controle (exceto \n e \t)
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Remove caracteres de substituição
  t = t.replace(/\uFFFD/g, "");

  // Remove caracteres problemáticos para jsPDF
  t = t.replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ•–—…°ºª€]/g, "");

  // Evita muitas linhas em branco seguidas
  t = t.replace(/\n{4,}/g, "\n\n\n");

  return t;
}

// ================== FUNÇÕES AUX ==================
function setHoraWhatsAppAgora() {
  const now = new Date();
  waTimeEl.innerText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mostrarSemDemonstrativo() {
  tituloEl.innerText = "Sem demonstrativo";
  msgEl.innerText = MENSAGEM_SEM_DEMO;
  setHoraWhatsAppAgora();

  // dropdown desabilitado (sem períodos)
  selectEl.innerHTML = `<option value="">Sem períodos disponíveis</option>`;
  selectEl.disabled = true;
}

// ================== FUNÇÕES ==================
async function carregarPeriodos() {
  // estado inicial
  tituloEl.innerText = "Carregando...";
  msgEl.innerText = "Carregando períodos...";
  selectEl.disabled = true;

  try {
    const resp = await fetch(`${API_BASE}/periodos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Se token inválido
    if (resp.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("login");
      window.location.href = "index.html";
      return;
    }

    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      // Se o backend retornar erro
      tituloEl.innerText = "Erro";
      msgEl.innerText = dados.mensagem || "Erro ao carregar períodos.";
      return;
    }

    // Se não há períodos, não há demonstrativo também
    if (!dados.periodos || dados.periodos.length === 0) {
      mostrarSemDemonstrativo();
      return;
    }

    // montar select
    selectEl.disabled = false;
    selectEl.innerHTML = "";

    dados.periodos.forEach((p, index) => {
      const opt = document.createElement("option");
      opt.value = p.periodo;
      opt.textContent = `${p.periodo} - ${p.titulo}`;
      if (index === 0) opt.selected = true;
      selectEl.appendChild(opt);
    });

    // carregar o primeiro período automaticamente
    carregarDemonstrativo(selectEl.value);
  } catch {
    tituloEl.innerText = "Erro";
    msgEl.innerText = "Erro ao conectar com o servidor.";
  }
}

async function carregarDemonstrativo(periodo) {
  tituloEl.innerText = "Carregando...";
  msgEl.innerText = "Carregando demonstrativo...";
  setHoraWhatsAppAgora();

  try {
    const resp = await fetch(
      `${API_BASE}/demonstrativo?periodo=${encodeURIComponent(periodo)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Se token inválido
    if (resp.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("login");
      window.location.href = "index.html";
      return;
    }

    // ✅ Caso não exista demonstrativo (404)
    if (resp.status === 404) {
      mostrarSemDemonstrativo();
      return;
    }

    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok || !dados.ok || !dados.demonstrativo) {
      // qualquer erro ou resposta incompleta => mostrar mensagem padrão
      mostrarSemDemonstrativo();
      return;
    }

    const demo = dados.demonstrativo;

    tituloEl.innerText = demo.titulo || "Seu demonstrativo";
    msgEl.innerText = demo.mensagem || "";
    setHoraWhatsAppAgora();
  } catch {
    // erro de rede
    tituloEl.innerText = "Erro";
    msgEl.innerText = "Erro ao buscar demonstrativo.";
  }
}

// ================== EVENTOS ==================

// Trocar período
selectEl.addEventListener("change", () => {
  if (!selectEl.disabled && selectEl.value) {
    carregarDemonstrativo(selectEl.value);
  }
});

// Copiar mensagem
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(msgEl.innerText);
    copyBtn.innerText = "Copiado ✅";
    setTimeout(() => (copyBtn.innerText = "Copiar"), 1200);
  } catch {
    alert("Não foi possível copiar automaticamente.");
  }
});

// Gerar PDF (texto sanitizado)
pdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const titulo = limparTextoParaPDF(tituloEl.innerText || "Demonstrativo");
  const texto = limparTextoParaPDF(msgEl.innerText || "");

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, 40, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Login: ${login}`, 40, 70);

  // Corpo com quebra automática
  doc.setFontSize(11);
  const linhas = doc.splitTextToSize(texto, 515);
  doc.text(linhas, 40, 100);

  // Nome do arquivo
  const periodo = selectEl.value || "sem_periodo";
  const safeLogin = login.replace(/[^\w\-]+/g, "_");
  doc.save(`demonstrativo_${safeLogin}_${periodo}.pdf`);
});

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("login");
  window.location.href = "index.html";
});

// ================== INIT ==================
carregarPeriodos();
