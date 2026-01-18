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

// ---- carregar CSVs
function carregarCSVs() {
  const usuariosPath = path.join(__dirname, "data", "usuarios.csv");
  const demosPath = path.join(__dirname, "data", "demonstrativos.csv");

  const usuariosFile = fs.readFileSync(usuariosPath, "utf8");
  const demosFile = fs.readFileSync(demosPath, "utf8");

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

  // usuários
  usuariosPorLogin = {};
  for (const u of usuarios) {
    usuariosPorLogin[u.LOGIN] = { login: u.LOGIN, senha: String(u.SENHA) };
  }

  // demonstrativos por login (lista)
  demosPorLogin = {};
  for (const d of demonstrativos) {
    const login = d.LOGIN;

    if (!demosPorLogin[login]) demosPorLogin[login] = [];

    demosPorLogin[login].push({
      periodo: d.PERIODO,
      titulo: d.TITULO,
      mensagem: d.MENSAGEM, // vem com quebras de linha reais
    });
  }

  // ordenar período desc (mais recente primeiro)
  for (const login of Object.keys(demosPorLogin)) {
    demosPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  console.log("CSVs carregados ✅");
  console.log("Usuários:", Object.keys(usuariosPorLogin).length);
  console.log("Logins com demonstrativo:", Object.keys(demosPorLogin).length);
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
    if (req.originalUrl.includes("/usuarios")) return cb(null, "usuarios.csv");
    return cb(null, "demonstrativos.csv");
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
app.get("/", (req, res) => res.send("Backend CSV (Opção B) rodando ✅"));

app.post("/login", (req, res) => {
  const { login, senha } = req.body;

  const user = usuariosPorLogin[login];
  if (!user) return res.status(401).json({ ok: false, mensagem: "Login inválido ❌" });

  if (String(user.senha) !== String(senha)) {
    return res.status(401).json({ ok: false, mensagem: "Senha inválida ❌" });
  }

  const token = jwt.sign({ login }, JWT_SECRET, { expiresIn: "2h" });
  return res.json({ ok: true, mensagem: "Login válido ✅", token });
});

// lista períodos disponíveis (para dropdown)
app.get("/periodos", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  const periodos = lista.map((d) => ({ periodo: d.periodo, titulo: d.titulo }));
  return res.json({ ok: true, periodos });
});

// retorna mensagem do período (ou a mais recente)
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

// recarregar sem reiniciar (opcional)
app.post("/recarregar-csv", (req, res) => {
  carregarCSVs();
  res.json({ ok: true, mensagem: "CSVs recarregados ✅" });
});
// (já carregamos os CSVs no boot; não chamar novamente aqui)

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
  });
});

// upload usuarios.csv
app.post("/admin/upload/usuarios", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "usuarios.csv enviado e recarregado ✅" });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao recarregar CSVs (usuarios).",
    });
  }
});

// upload demonstrativo.csv
app.post("/admin/upload/demonstrativo", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "demonstrativo.csv enviado e recarregado ✅" });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao recarregar CSVs (demonstrativo).",
    });
  }
});

app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
