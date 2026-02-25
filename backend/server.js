const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// Em produção use variáveis de ambiente (Render/Vercel/etc.)
// Configure no provedor:
//   JWT_SECRET, ADMIN_USER, ADMIN_PASS
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

// bancos em memória
let usuariosPorLogin = {};
let demosPorLogin = {};
let qualidadePorLogin = {}; // ✅ NOVO

// ---- carregar CSVs
function carregarCSVs() {
  const usuariosPath = path.join(__dirname, "data", "usuarios.csv");
  const demosPath = path.join(__dirname, "data", "demonstrativos.csv");
  const qualidadePath = path.join(__dirname, "data", "qualidade.csv"); // ✅ NOVO

  const usuariosFile = fs.readFileSync(usuariosPath, "utf8");
  const demosFile = fs.readFileSync(demosPath, "utf8");

  // qualidade.csv pode não existir no começo — então tratamos com segurança
  let qualidadeFile = "";
  try {
    qualidadeFile = fs.readFileSync(qualidadePath, "utf8");
  } catch {
    qualidadeFile = "";
  }

  const usuarios = parse(usuariosFile, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const demonstrativos = parse(demosFile, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const qualidade = qualidadeFile
    ? parse(qualidadeFile, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    : [];

  // usuários
  usuariosPorLogin = {};
  for (const u of usuarios) {
    usuariosPorLogin[String(u.LOGIN).trim()] = {
      login: String(u.LOGIN).trim(),
      senha: String(u.SENHA),
    };
  }

  // demonstrativos por login (lista)
  demosPorLogin = {};
  for (const d of demonstrativos) {
    const login = String(d.LOGIN).trim();
    if (!demosPorLogin[login]) demosPorLogin[login] = [];

    demosPorLogin[login].push({
      periodo: String(d.PERIODO || "").trim(),
      titulo: String(d.TITULO || "").trim(),
      mensagem: d.MENSAGEM ?? "",
    });
  }

  // ordenar período desc (mais recente primeiro)
  for (const login of Object.keys(demosPorLogin)) {
    demosPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  // ✅ QUALIDADE por login (lista com várias mensagens por período)
  qualidadePorLogin = {};
  for (const q of qualidade) {
    const login = String(q.LOGIN || "").trim();
    const periodo = String(q.PERIODO || "").trim();

    // sua coluna é "ID" (como você adicionou)
    const id = String(q.ID ?? "").trim();

    // se vier vazio, ainda assim não quebrar:
    const safeId = id || "1";

    // imagem pode vir como IMAGEM_URL ou IMAGEM (caso você use outro nome)
    const imagemUrl = String(q.IMAGEM_URL ?? q.IMAGEM ?? q.IMAGEMURL ?? "").trim();

    if (!login || !periodo) continue;

    const item = {
      key: `${periodo}|${safeId}`,
      periodo,
      id: safeId,
      titulo: String(q.TITULO || "").trim(),
      mensagem: q.MENSAGEM ?? "",
      imagemUrl: imagemUrl || null,
    };

    if (!qualidadePorLogin[login]) qualidadePorLogin[login] = [];
    qualidadePorLogin[login].push(item);
  }

  // ordenar: período desc e, dentro do período, ID desc (numérico se der)
  for (const login of Object.keys(qualidadePorLogin)) {
    qualidadePorLogin[login].sort((a, b) => {
      const p = b.periodo.localeCompare(a.periodo);
      if (p !== 0) return p;

      const ai = Number(a.id);
      const bi = Number(b.id);

      if (!Number.isNaN(ai) && !Number.isNaN(bi)) return bi - ai;
      return String(b.id).localeCompare(String(a.id));
    });
  }

  console.log("CSVs carregados ✅");
  console.log("Usuários:", Object.keys(usuariosPorLogin).length);
  console.log("Logins com demonstrativo:", Object.keys(demosPorLogin).length);
  console.log("Logins com qualidade:", Object.keys(qualidadePorLogin).length);
}

carregarCSVs();

// ---- middleware JWT
function autenticarJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, mensagem: "Sem token." });
  }

  const token = auth.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.login = payload.login;
    next();
  } catch {
    return res.status(401).json({ ok: false, mensagem: "Token inválido." });
  }
}

// ================= UPLOAD CONFIG (salva em backend/data) =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "data"));
  },
  filename: (req, file, cb) => {
    // nomes fixos no servidor
    const url = req.originalUrl;

    if (url.includes("/usuarios")) return cb(null, "usuarios.csv");
    if (url.includes("/demonstrativo")) return cb(null, "demonstrativos.csv");

    // ✅ opcional: upload qualidade.csv
    if (url.includes("/qualidade")) return cb(null, "qualidade.csv");

    // fallback
    return cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ================= MIDDLEWARE ADMIN =================
function autenticarAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, mensagem: "Sem token admin." });
  }

  const token = auth.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload || payload.role !== "admin") {
      return res.status(403).json({ ok: false, mensagem: "Acesso negado." });
    }

    return next();
  } catch {
    return res.status(401).json({ ok: false, mensagem: "Token admin inválido." });
  }
}

// ---- rotas
app.get("/", (req, res) => res.send("Backend CSV rodando ✅"));

app.post("/login", (req, res) => {
  const { login, senha } = req.body;

  const user = usuariosPorLogin[String(login).trim()];
  if (!user) return res.status(401).json({ ok: false, mensagem: "Login inválido ❌" });

  if (String(user.senha) !== String(senha)) {
    return res.status(401).json({ ok: false, mensagem: "Senha inválida ❌" });
  }

  const token = jwt.sign({ login: String(login).trim() }, JWT_SECRET, { expiresIn: "2h" });
  return res.json({ ok: true, mensagem: "Login válido ✅", token });
});

// lista períodos disponíveis (para dropdown) - DEMO
app.get("/periodos", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  const periodos = lista.map((d) => ({ periodo: d.periodo, titulo: d.titulo }));
  return res.json({ ok: true, periodos });
});

// retorna mensagem do período (ou a mais recente) - DEMO
app.get("/demonstrativo", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  if (lista.length === 0) {
    return res.status(404).json({ ok: false, mensagem: "Nenhum demonstrativo encontrado." });
  }

  const { periodo } = req.query;

  if (periodo) {
    const demo = lista.find((d) => d.periodo === periodo);
    if (!demo) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, demonstrativo: demo });
  }

  // mais recente
  return res.json({ ok: true, demonstrativo: lista[0] });
});

// ================== ✅ QUALIDADE ==================

// lista opções (1 por mensagem) => retorna key PERIODO|ID
app.get("/qualidade/periodos", autenticarJWT, (req, res) => {
  const lista = qualidadePorLogin[req.login] || [];
  const periodos = lista.map((q) => ({
    key: q.key,
    periodo: q.periodo,
    titulo: q.titulo,
  }));
  return res.json({ ok: true, periodos });
});

// retorna 1 mensagem de qualidade por key (PERIODO|ID)
// exemplo: /qualidade?key=2026-01-2Q|2
app.get("/qualidade", autenticarJWT, (req, res) => {
  const lista = qualidadePorLogin[req.login] || [];
  if (lista.length === 0) {
    return res.status(404).json({ ok: false, mensagem: "Nenhuma mensagem de qualidade encontrada." });
  }

  const { key, periodo, id } = req.query;

  // prioridade: key
  if (key) {
    const item = lista.find((q) => q.key === key);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Item de qualidade não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  // fallback: periodo + id
  if (periodo && id) {
    const k = `${periodo}|${id}`;
    const item = lista.find((q) => q.key === k);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Item de qualidade não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  // fallback: se vier só periodo, retorna o primeiro daquele período
  if (periodo) {
    const item = lista.find((q) => q.periodo === periodo);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  // mais recente (primeiro da lista ordenada)
  return res.json({ ok: true, qualidade: lista[0] });
});

// recarregar sem reiniciar
app.post("/recarregar-csv", (req, res) => {
  carregarCSVs();
  res.json({ ok: true, mensagem: "CSVs recarregados ✅" });
});

const PORT = process.env.PORT || 3000;

// ================= ROTAS ADMIN =================

// login admin (retorna token)
app.post("/admin/login", (req, res) => {
  const { user, pass } = req.body;

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, mensagem: "Admin inválido ❌" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
  return res.json({ ok: true, mensagem: "Admin OK ✅", token });
});

// status do que está carregado em memória
app.get("/admin/status", autenticarAdmin, (req, res) => {
  return res.json({
    ok: true,
    usuarios: Object.keys(usuariosPorLogin).length,
    loginsComDemonstrativo: Object.keys(demosPorLogin).length,
    loginsComQualidade: Object.keys(qualidadePorLogin).length,
  });
});

// upload usuarios.csv
app.post("/admin/upload/usuarios", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "usuarios.csv enviado e recarregado ✅" });
  } catch (e) {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (usuarios)." });
  }
});

// upload demonstrativos.csv
app.post("/admin/upload/demonstrativo", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "demonstrativos.csv enviado e recarregado ✅" });
  } catch (e) {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (demonstrativo)." });
  }
});

// ✅ opcional: upload qualidade.csv
app.post("/admin/upload/qualidade", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "qualidade.csv enviado e recarregado ✅" });
  } catch (e) {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (qualidade)." });
  }
});

app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
