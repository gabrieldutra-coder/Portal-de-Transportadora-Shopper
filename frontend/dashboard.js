// ================== SESSÃO ==================
const token = localStorage.getItem("token");
const login = localStorage.getItem("login");

if (!token || !login) {
  window.location.href = "index.html";
}

// Base da API (configurada em frontend/config.js)
const API_BASE = window.API_BASE;
if (!API_BASE) {
  alert(
    "API_BASE não configurado. Edite frontend/config.js com a URL do backend (Render)."
  );
}

// ================== MENSAGENS PADRÃO ==================
const MENSAGEM_SEM_DEMO =
  "A sua transportadora não tem um Demonstrativo nessa quinzena.\n\n Em caso de dúvidas entrar em contato com o Time do Financeiro!";

const MENSAGEM_SEM_QUALIDADE =
  "A sua transportadora não tem uma Classificação nessa quinzena.\n\nEm caso de dúvidas, entre em contato com o Time de Qualidade";

// ================== ELEMENTOS ==================
const tituloEl = document.getElementById("titulo");
const selectEl = document.getElementById("periodoSelect");
const msgEl = document.getElementById("mensagemBox");
const mediaEl = document.getElementById("mediaBox");

const copyBtn = document.getElementById("copyBtn");
const pdfBtn = document.getElementById("pdfBtn");
const logoutBtn = document.getElementById("logoutBtn");

const waNameEl = document.getElementById("waName");
const waTimeEl = document.getElementById("waTime");

const tabDemo = document.getElementById("tabDemo");
const tabQualidade = document.getElementById("tabQualidade");

// ================== TOPO ==================
if (waNameEl) waNameEl.innerText = login;

// ================== PDF: LIMPEZA ==================
function limparTextoParaPDF(texto) {
  if (!texto) return "";

  let t = texto.normalize("NFKC");
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  t = t.replace(/\uFFFD/g, "");
  t = t.replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ•–—…°ºª€]/g, "");
  t = t.replace(/\n{4,}/g, "\n\n\n");

  return t;
}

// ================== DRIVE -> LINK DIRETO (IMG) ==================
function driveToDirect(url) {
  if (!url) return null;

  try {
    const u = new URL(url);

    // open?id=FILEID
    const openId = u.searchParams.get("id");
    if (openId) return `https://drive.google.com/uc?export=view&id=${openId}`;

    // /file/d/FILEID/...
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

    return null;
  } catch {
    return null;
  }
}

// ================== LINKS CLICÁVEIS + IMAGENS EMBUTIDAS ==================
function linkificarTexto(texto) {
  if (!texto) return "";

  // Escapa HTML básico por segurança
  let seguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const urlRegex = /(https?:\/\/[^\s<]+)/g;

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  }

  seguro = seguro.replace(urlRegex, (url) => {
    const driveDirect = driveToDirect(url);
    const finalUrl = driveDirect || url;

    // Se for imagem (ou Drive convertido), embute <img>
    if (isImageUrl(finalUrl) || driveDirect) {
      return `
        <div class="wa-media">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="wa-media-link">Abrir</a>
          <img class="wa-img" src="${finalUrl}" alt="Comprovação" loading="lazy" />
        </div>
      `;
    }

    // Caso normal: link clicável
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Mantém quebras de linha
  seguro = seguro.replace(/\n/g, "<br>");

  return seguro;
}

// ================== AUX ==================
function setHoraWhatsAppAgora() {
  const now = new Date();
  if (!waTimeEl) return;
  waTimeEl.innerText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function limparMidia() {
  if (!mediaEl) return;
  mediaEl.innerHTML = "";
  mediaEl.style.display = "none";
}

function mostrarImagem(url) {
  if (!mediaEl || !url) return;

  limparMidia();

  const direto = driveToDirect(url) || url;

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.className = "wa-img";
  img.src = direto;
  img.alt = "Comprovação";
  img.loading = "lazy";

  a.appendChild(img);
  mediaEl.appendChild(a);
  mediaEl.style.display = "block";
}

function marcarTabAtiva(sector) {
  if (sector === "qualidade") {
    tabQualidade?.classList.add("active");
    tabDemo?.classList.remove("active");
  } else {
    tabDemo?.classList.add("active");
    tabQualidade?.classList.remove("active");
  }
}

function mensagemSemConteudo(sector) {
  return sector === "qualidade" ? MENSAGEM_SEM_QUALIDADE : MENSAGEM_SEM_DEMO;
}

function mostrarSemConteudo(sector) {
  tituloEl.innerText = sector === "qualidade" ? "Sem Classificação" : "Sem Demonstrativo";
  msgEl.innerHTML = linkificarTexto(mensagemSemConteudo(sector));
  setHoraWhatsAppAgora();
  limparMidia();

  selectEl.innerHTML = `<option value="">Sem períodos disponíveis</option>`;
  selectEl.disabled = true;
}

// ================== SETOR ATUAL ==================
let setorAtual = "demo"; // "demo" | "qualidade"

function endpointsDoSetor() {
  if (setorAtual === "qualidade") {
    return {
      periodos: `${API_BASE}/qualidade/periodos`,
      item: `${API_BASE}/qualidade`,
    };
  }

  return {
    periodos: `${API_BASE}/periodos`,
    item: `${API_BASE}/demonstrativo`,
  };
}

// ================== FUNÇÕES ==================
async function carregarPeriodos() {
  tituloEl.innerText = "Carregando...";
  msgEl.innerText = "Carregando períodos...";
  setHoraWhatsAppAgora();
  limparMidia();
  selectEl.disabled = true;

  const { periodos: periodosUrl } = endpointsDoSetor();

  try {
    const resp = await fetch(periodosUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("login");
      window.location.href = "index.html";
      return;
    }

    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    if (!dados.periodos || dados.periodos.length === 0) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = "";

    // ✅ AQUI: Qualidade usa "key", Demo usa "periodo"
    dados.periodos.forEach((p, index) => {
      const opt = document.createElement("option");
      opt.value = setorAtual === "qualidade" ? (p.key || "") : p.periodo;
      opt.textContent = `${p.periodo} - ${p.titulo}`;
      if (index === 0) opt.selected = true;
      selectEl.appendChild(opt);
    });

    carregarItem(selectEl.value);
  } catch (err) {
    console.error("Erro carregarPeriodos:", err);
    mostrarSemConteudo(setorAtual);
  }
}

async function carregarItem(valorSelect) {
  tituloEl.innerText = "Carregando...";
  msgEl.innerText = "Carregando...";
  setHoraWhatsAppAgora();
  limparMidia();

  const { item: itemUrl } = endpointsDoSetor();

  // ✅ Demo busca por periodo, Qualidade busca por key
  const param = setorAtual === "qualidade" ? "key" : "periodo";
  const url = `${itemUrl}?${param}=${encodeURIComponent(valorSelect || "")}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("login");
      window.location.href = "index.html";
      return;
    }

    if (resp.status === 404) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok || !dados.ok) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    // demo => dados.demonstrativo
    // qualidade => dados.qualidade
    const payload = setorAtual === "qualidade" ? dados.qualidade : dados.demonstrativo;

    if (!payload) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    tituloEl.innerText =
      payload.titulo || (setorAtual === "qualidade" ? "Qualidade" : "Seu demonstrativo");

    // ✅ renderiza texto + links + imagens embutidas
    msgEl.innerHTML = linkificarTexto(payload.mensagem || "");
    setHoraWhatsAppAgora();

    // ✅ imagem via coluna imagemUrl (opcional)
    if (setorAtual === "qualidade" && payload.imagemUrl) {
      mostrarImagem(payload.imagemUrl);
    }
  } catch (err) {
    console.error("Erro carregarItem:", err);
    mostrarSemConteudo(setorAtual);
  }
}

// ================== EVENTOS ==================
selectEl.addEventListener("change", () => {
  if (!selectEl.disabled && selectEl.value) {
    carregarItem(selectEl.value);
  }
});

// Copiar (texto puro, sem HTML)
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(msgEl.innerText);
    copyBtn.innerText = "Copiado ✅";
    setTimeout(() => (copyBtn.innerText = "Copiar"), 1200);
  } catch {
    alert("Não foi possível copiar automaticamente.");
  }
});

pdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const titulo = limparTextoParaPDF(tituloEl.innerText || "Demonstrativo");
  const texto = limparTextoParaPDF(msgEl.innerText || "");

  const marginLeft = 40;
  const marginTop = 100;
  const marginBottom = 40;

  // A4 em pt (jsPDF): 595.28 x 841.89
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableHeight = pageHeight - marginBottom;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, marginLeft, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`ID: ${login}`, marginLeft, 70);

  doc.setFontSize(11);

  const maxWidth = 515;
  const lineHeight = 14; // ajuste fino se quiser
  const linhas = doc.splitTextToSize(texto, maxWidth);

  let y = marginTop;

  for (let i = 0; i < linhas.length; i++) {
    if (y + lineHeight > usableHeight) {
      doc.addPage();
      y = 40; // topo da nova página
    }
    doc.text(linhas[i], marginLeft, y);
    y += lineHeight;
  }

  const valor = selectEl.value || "sem_valor";
  const safeLogin = login.replace(/[^\w\-]+/g, "_");
  const prefixo = setorAtual === "qualidade" ? "qualidade" : "demonstrativo";
  doc.save(`${prefixo}_${safeLogin}_${valor}.pdf`);
});

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("login");
  window.location.href = "index.html";
});

// Tabs
function trocarSetor(novo) {
  setorAtual = novo;
  marcarTabAtiva(novo);
  carregarPeriodos();
}

tabDemo?.addEventListener("click", () => trocarSetor("demo"));
tabQualidade?.addEventListener("click", () => trocarSetor("qualidade"));

// ================== INIT ==================
marcarTabAtiva(setorAtual);
carregarPeriodos();
