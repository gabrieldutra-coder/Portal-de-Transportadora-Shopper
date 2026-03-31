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
  "A sua transportadora não tem uma mensagem de Demonstrativo disponível para visualizar no momento.\n\nEm caso de dúvidas, entre em contato com: https://wa.me/5511971920349";

const MENSAGEM_SEM_QUALIDADE =
  "A sua transportadora não tem uma mensagem de Classificação disponível para visualizar no momento.\n\nEm caso de dúvidas, entre em contato com: https://wa.me/5511971920349";

const MENSAGEM_SEM_CESTAS =
  "A sua transportadora não tem uma mensagem de Cestas disponível para visualizar no momento.\n\nEm caso de dúvidas, entre em contato com: https://wa.me/5511971920349";

const MENSAGEM_SEM_ERROS =
  "A sua transportadora não tem uma mensagem de Erros disponível para visualizar no momento.\n\nEm caso de dúvidas, entre em contato com: https://wa.me/5511971920349";

// ================== ELEMENTOS ==================
const tituloEl = document.getElementById("titulo");
const selectEl = document.getElementById("periodoSelect");
const msgEl = document.getElementById("mensagemBox");
const mediaEl = document.getElementById("mediaBox");
const setorSelect = document.getElementById("setorSelect");

const copyBtn = document.getElementById("copyBtn");
const pdfBtn = document.getElementById("pdfBtn");
const logoutBtn = document.getElementById("logoutBtn");

const waNameEl = document.getElementById("waName");
const waTimeEl = document.getElementById("waTime");

if (waNameEl) waNameEl.innerText = login;

// ================== ESTADO ==================
let setorAtual = null; // demo | qualidade | cestas | erros

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
    const normalized = String(url).replace(/&amp;/g, "&");
    const u = new URL(normalized);

    const openId = u.searchParams.get("id");
    if (openId) return `https://drive.google.com/uc?export=view&id=${openId}`;

    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

    return null;
  } catch {
    return null;
  }
}

// ================== LINKS CLICÁVEIS + IMAGENS + NEGRITO ==================
function linkificarTexto(texto) {
  if (!texto) return "";

  let seguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const placeholders = [];

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  }

  seguro = seguro.replace(urlRegex, (url) => {
    const driveDirect = driveToDirect(url);
    const finalUrl = driveDirect || url;

    let html = "";

    if (isImageUrl(finalUrl) || driveDirect) {
      html = `
        <div class="wa-media">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="wa-media-link">Abrir</a>
          <img class="wa-img" src="${finalUrl}" alt="Comprovação" loading="lazy" />
        </div>
      `;
    } else {
      html = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }

    const token = `___LINK_${placeholders.length}___`;
    placeholders.push(html);
    return token;
  });

  // Negrito estilo WhatsApp: *texto*
  seguro = seguro.replace(/\*(.*?)\*/g, "<strong>$1</strong>");

  seguro = seguro.replace(/\n/g, "<br>");

  placeholders.forEach((html, index) => {
    seguro = seguro.replace(`___LINK_${index}___`, html);
  });

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

function mensagemSemConteudo(sector) {
  switch (sector) {
    case "qualidade":
      return MENSAGEM_SEM_QUALIDADE;
    case "cestas":
      return MENSAGEM_SEM_CESTAS;
    case "erros":
      return MENSAGEM_SEM_ERROS;
    default:
      return MENSAGEM_SEM_DEMO;
  }
}

function tituloSemConteudo(sector) {
  switch (sector) {
    case "qualidade":
      return "SEM MENSAGEM DE CLASSIFICAÇÃO";
    case "cestas":
      return "SEM MENSAGEM DE CESTAS";
    case "erros":
      return "SEM MENSAGEM DE ERROS";
    default:
      return "SEM MENSAGEM DE DEMONSTRATIVO";
  }
}

function mostrarSemConteudo(sector) {
  tituloEl.innerText = tituloSemConteudo(sector);
  msgEl.innerHTML = linkificarTexto(mensagemSemConteudo(sector));
  setHoraWhatsAppAgora();
  limparMidia();

  selectEl.innerHTML = `<option value="">Sem períodos disponíveis</option>`;
  selectEl.disabled = true;
}

function mostrarEstadoInicial() {
  tituloEl.innerText = "SELECIONE O SETOR NO CAMPO ACIMA! ☝";
  msgEl.innerText = "Escolha acima o setor que deseja visualizar.";
  setHoraWhatsAppAgora();
  limparMidia();
  selectEl.innerHTML = `<option value="" selected>Selecione o período</option>`;
  selectEl.disabled = true;
}

function endpointsDoSetor() {
  switch (setorAtual) {
    case "qualidade":
      return {
        periodos: `${API_BASE}/qualidade/periodos`,
        item: `${API_BASE}/qualidade`,
      };
    case "cestas":
      return {
        periodos: `${API_BASE}/cestas/periodos`,
        item: `${API_BASE}/cestas`,
      };
    case "erros":
      return {
        periodos: `${API_BASE}/erros/periodos`,
        item: `${API_BASE}/erros`,
      };
    default:
      return {
        periodos: `${API_BASE}/periodos`,
        item: `${API_BASE}/demonstrativo`,
      };
  }
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

    if (!resp.ok || !dados.periodos || dados.periodos.length === 0) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    selectEl.disabled = false;
    selectEl.innerHTML = "";

    dados.periodos.forEach((p, index) => {
      const opt = document.createElement("option");
      opt.value = setorAtual === "qualidade" ? (p.key || "") : (p.periodo || "");
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

    let payload = null;
    if (setorAtual === "qualidade") payload = dados.qualidade;
    else if (setorAtual === "cestas") payload = dados.cestas;
    else if (setorAtual === "erros") payload = dados.erros;
    else payload = dados.demonstrativo;

    if (!payload) {
      mostrarSemConteudo(setorAtual);
      return;
    }

    let tituloPadrao = "Seu Demonstrativo";
    if (setorAtual === "qualidade") tituloPadrao = "Qualidade";
    if (setorAtual === "cestas") tituloPadrao = "Cestas";
    if (setorAtual === "erros") tituloPadrao = "Erros";

    tituloEl.innerText = payload.titulo || tituloPadrao;
    msgEl.innerHTML = linkificarTexto(payload.mensagem || "");
    setHoraWhatsAppAgora();

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

setorSelect?.addEventListener("change", () => {
  setorAtual = setorSelect.value || null;
  if (!setorAtual) {
    mostrarEstadoInicial();
    return;
  }
  carregarPeriodos();
});

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

  const titulo = limparTextoParaPDF(tituloEl.innerText || "Conteúdo");
  const texto = limparTextoParaPDF(msgEl.innerText || "");

  const marginLeft = 40;
  const marginTop = 100;
  const marginBottom = 40;
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
  const lineHeight = 14;
  const linhas = doc.splitTextToSize(texto, maxWidth);

  let y = marginTop;
  for (let i = 0; i < linhas.length; i++) {
    if (y + lineHeight > usableHeight) {
      doc.addPage();
      y = 40;
    }
    doc.text(linhas[i], marginLeft, y);
    y += lineHeight;
  }

  const valor = selectEl.value || "sem_valor";
  const safeLogin = login.replace(/[^\w\-]+/g, "_");
  const prefixo = setorAtual || "conteudo";
  doc.save(`${prefixo}_${safeLogin}_${valor}.pdf`);
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("login");
  window.location.href = "index.html";
});

// ================== INIT ==================
mostrarEstadoInicial();