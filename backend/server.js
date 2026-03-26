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

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

let usuariosPorLogin = {};
let demosPorLogin = {};
let qualidadePorLogin = {};
let errosPorLogin = {};
let cestasPorLogin = {};

function parseCsvFileSafe(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.trim()) return [];
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return [];
  }
}

function carregarCSVs() {
  const usuariosPath = path.join(__dirname, "data", "usuarios.csv");
  const demosPath = path.join(__dirname, "data", "demonstrativos.csv");
  const qualidadePath = path.join(__dirname, "data", "qualidade.csv");
  const errosPath = path.join(__dirname, "data", "erros.csv");
  const cestasPath = path.join(__dirname, "data", "cestas.csv");

  const usuarios = parseCsvFileSafe(usuariosPath);
  const demonstrativos = parseCsvFileSafe(demosPath);
  const qualidade = parseCsvFileSafe(qualidadePath);
  const erros = parseCsvFileSafe(errosPath);
  const cestas = parseCsvFileSafe(cestasPath);

  usuariosPorLogin = {};
  for (const u of usuarios) {
    const login = String(u.LOGIN || "").trim();
    if (!login) continue;
    usuariosPorLogin[login] = {
      login,
      senha: String(u.SENHA ?? ""),
    };
  }

  demosPorLogin = {};
  for (const d of demonstrativos) {
    const login = String(d.LOGIN || "").trim();
    if (!login) continue;
    if (!demosPorLogin[login]) demosPorLogin[login] = [];
    demosPorLogin[login].push({
      periodo: String(d.PERIODO || "").trim(),
      titulo: String(d.TITULO || "").trim(),
      mensagem: d.MENSAGEM ?? "",
    });
  }
  for (const login of Object.keys(demosPorLogin)) {
    demosPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  qualidadePorLogin = {};
  for (const q of qualidade) {
    const login = String(q.LOGIN || "").trim();
    const periodo = String(q.PERIODO || "").trim();
    const id = String(q.ID ?? "").trim() || "1";
    const imagemUrl = String(q.IMAGEM_URL ?? q.IMAGEM ?? q.IMAGEMURL ?? "").trim();
    if (!login || !periodo) continue;

    const item = {
      key: `${periodo}|${id}`,
      periodo,
      id,
      titulo: String(q.TITULO || "").trim(),
      mensagem: q.MENSAGEM ?? "",
      imagemUrl: imagemUrl || null,
    };

    if (!qualidadePorLogin[login]) qualidadePorLogin[login] = [];
    qualidadePorLogin[login].push(item);
  }
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

  errosPorLogin = {};
  for (const e of erros) {
    const login = String(e.LOGIN || "").trim();
    if (!login) continue;
    if (!errosPorLogin[login]) errosPorLogin[login] = [];
    errosPorLogin[login].push({
      periodo: String(e.PERIODO || "").trim(),
      titulo: String(e.TITULO || "").trim(),
      mensagem: e.MENSAGEM ?? "",
    });
  }
  for (const login of Object.keys(errosPorLogin)) {
    errosPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  cestasPorLogin = {};
  for (const c of cestas) {
    const login = String(c.LOGIN || "").trim();
    if (!login) continue;
    if (!cestasPorLogin[login]) cestasPorLogin[login] = [];
    cestasPorLogin[login].push({
      periodo: String(c.PERIODO || "").trim(),
      titulo: String(c.TITULO || "").trim(),
      mensagem: c.MENSAGEM ?? "",
    });
  }
  for (const login of Object.keys(cestasPorLogin)) {
    cestasPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  console.log("CSVs carregados ✅");
  console.log("Usuários:", Object.keys(usuariosPorLogin).length);
  console.log("Logins com demonstrativo:", Object.keys(demosPorLogin).length);
  console.log("Logins com qualidade:", Object.keys(qualidadePorLogin).length);
  console.log("Logins com erros:", Object.keys(errosPorLogin).length);
  console.log("Logins com cestas:", Object.keys(cestasPorLogin).length);
}

carregarCSVs();

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "data"));
  },
  filename: (req, file, cb) => {
    const url = req.originalUrl;
    if (url.includes("/usuarios")) return cb(null, "usuarios.csv");
    if (url.includes("/demonstrativo")) return cb(null, "demonstrativos.csv");
    if (url.includes("/qualidade")) return cb(null, "qualidade.csv");
    if (url.includes("/erros")) return cb(null, "erros.csv");
    if (url.includes("/cestas")) return cb(null, "cestas.csv");
    return cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

app.get("/periodos", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  const periodos = lista.map((d) => ({ periodo: d.periodo, titulo: d.titulo }));
  return res.json({ ok: true, periodos });
});

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

  return res.json({ ok: true, demonstrativo: lista[0] });
});

app.get("/qualidade/periodos", autenticarJWT, (req, res) => {
  const lista = qualidadePorLogin[req.login] || [];
  const periodos = lista.map((q) => ({ key: q.key, periodo: q.periodo, titulo: q.titulo }));
  return res.json({ ok: true, periodos });
});

app.get("/qualidade", autenticarJWT, (req, res) => {
  const lista = qualidadePorLogin[req.login] || [];
  if (lista.length === 0) {
    return res.status(404).json({ ok: false, mensagem: "Nenhuma mensagem de qualidade encontrada." });
  }

  const { key, periodo, id } = req.query;

  if (key) {
    const item = lista.find((q) => q.key === key);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Item de qualidade não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  if (periodo && id) {
    const k = `${periodo}|${id}`;
    const item = lista.find((q) => q.key === k);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Item de qualidade não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  if (periodo) {
    const item = lista.find((q) => q.periodo === periodo);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, qualidade: item });
  }

  return res.json({ ok: true, qualidade: lista[0] });
});

app.get("/erros/periodos", autenticarJWT, (req, res) => {
  const lista = errosPorLogin[req.login] || [];
  const periodos = lista.map((e) => ({ periodo: e.periodo, titulo: e.titulo }));
  return res.json({ ok: true, periodos });
});

app.get("/erros", autenticarJWT, (req, res) => {
  const lista = errosPorLogin[req.login] || [];
  if (lista.length === 0) {
    return res.status(404).json({ ok: false, mensagem: "Nenhum registro de erros encontrado." });
  }

  const { periodo } = req.query;
  if (periodo) {
    const item = lista.find((e) => e.periodo === periodo);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, erros: item });
  }

  return res.json({ ok: true, erros: lista[0] });
});

app.get("/cestas/periodos", autenticarJWT, (req, res) => {
  const lista = cestasPorLogin[req.login] || [];
  const periodos = lista.map((c) => ({ periodo: c.periodo, titulo: c.titulo }));
  return res.json({ ok: true, periodos });
});

app.get("/cestas", autenticarJWT, (req, res) => {
  const lista = cestasPorLogin[req.login] || [];
  if (lista.length === 0) {
    return res.status(404).json({ ok: false, mensagem: "Nenhum registro de cestas encontrado." });
  }

  const { periodo } = req.query;
  if (periodo) {
    const item = lista.find((c) => c.periodo === periodo);
    if (!item) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, cestas: item });
  }

  return res.json({ ok: true, cestas: lista[0] });
});

app.post("/recarregar-csv", (req, res) => {
  carregarCSVs();
  res.json({ ok: true, mensagem: "CSVs recarregados ✅" });
});

const PORT = process.env.PORT || 3000;

app.post("/admin/login", (req, res) => {
  const { user, pass } = req.body;
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, mensagem: "Admin inválido ❌" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
  return res.json({ ok: true, mensagem: "Admin OK ✅", token });
});

app.get("/admin/status", autenticarAdmin, (req, res) => {
  return res.json({
    ok: true,
    usuarios: Object.keys(usuariosPorLogin).length,
    loginsComDemonstrativo: Object.keys(demosPorLogin).length,
    loginsComQualidade: Object.keys(qualidadePorLogin).length,
    loginsComErros: Object.keys(errosPorLogin).length,
    loginsComCestas: Object.keys(cestasPorLogin).length,
  });
});

app.post("/admin/upload/usuarios", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "usuarios.csv enviado e recarregado ✅" });
  } catch {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (usuarios)." });
  }
});

app.post("/admin/upload/demonstrativo", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "demonstrativos.csv enviado e recarregado ✅" });
  } catch {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (demonstrativo)." });
  }
});

app.post("/admin/upload/qualidade", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "qualidade.csv enviado e recarregado ✅" });
  } catch {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (qualidade)." });
  }
});

app.post("/admin/upload/erros", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "erros.csv enviado e recarregado ✅" });
  } catch {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (erros)." });
  }
});

app.post("/admin/upload/cestas", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    return res.json({ ok: true, mensagem: "cestas.csv enviado e recarregado ✅" });
  } catch {
    return res.status(500).json({ ok: false, mensagem: "Erro ao recarregar CSVs (cestas)." });
  }
});

app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
