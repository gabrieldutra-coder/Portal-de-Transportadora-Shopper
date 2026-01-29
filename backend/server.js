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

// ================= CONFIG =================
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

// ================= MEMÓRIA =================
let usuariosPorLogin = {};
let demosPorLogin = {};

// ================= FUNÇÕES AUX =================
function limparTexto(s) {
  return String(s ?? "")
    .replace(/\r/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function soDigitos(s) {
  return limparTexto(s).replace(/\D/g, "");
}

// ================= CARREGAR CSV =================
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

  usuariosPorLogin = {};
  for (const u of usuarios) {
    const login = limparTexto(u.LOGIN);
    const senha = limparTexto(u.SENHA);

    if (login) {
      usuariosPorLogin[login] = { login, senha };
    }
  }

  demosPorLogin = {};
  for (const d of demonstrativos) {
    const login = limparTexto(d.LOGIN);
    if (!login) continue;

    if (!demosPorLogin[login]) demosPorLogin[login] = [];

    demosPorLogin[login].push({
      periodo: limparTexto(d.PERIODO),
      titulo: limparTexto(d.TITULO),
      mensagem: d.MENSAGEM, // mantém quebras de linha
    });
  }

  for (const login of Object.keys(demosPorLogin)) {
    demosPorLogin[login].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  console.log("CSVs carregados ✅");
  console.log("Usuários:", Object.keys(usuariosPorLogin).length);
  console.log("Logins com demonstrativo:", Object.keys(demosPorLogin).length);
}

carregarCSVs();

// ================= JWT =================
function autenticarJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, mensagem: "Sem token." });
  }

  try {
    const payload = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET);
    req.login = payload.login;
    next();
  } catch {
    return res.status(401).json({ ok: false, mensagem: "Token inválido." });
  }
}

// ================= UPLOAD =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "data"));
  },
  filename: (req, file, cb) => {
    if (req.originalUrl.includes("/usuarios")) return cb(null, "usuarios.csv");
    return cb(null, "demonstrativos.csv");
  },
});

const upload = multer({ storage });

// ================= ADMIN =================
function autenticarAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, mensagem: "Sem token admin." });
  }

  try {
    const payload = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ ok: false, mensagem: "Acesso negado." });
    }
    next();
  } catch {
    return res.status(401).json({ ok: false, mensagem: "Token admin inválido." });
  }
}

// ================= ROTAS =================
app.get("/", (req, res) => res.send("Backend rodando ✅"));

// ===== LOGIN USUÁRIO =====
app.post("/login", (req, res) => {
  const loginDigitado = limparTexto(req.body?.login);
  const senhaDigitada = limparTexto(req.body?.senha);

  const user = usuariosPorLogin[loginDigitado];
  if (!user) {
    return res.status(401).json({ ok: false, mensagem: "Login inválido ❌" });
  }

  const senhaCSV = limparTexto(user.senha);

  const csvTemDigitos = soDigitos(senhaCSV).length > 0;
  const digitadaTemDigitos = soDigitos(senhaDigitada).length > 0;

  let ok = false;

  if (csvTemDigitos && digitadaTemDigitos) {
    ok = soDigitos(senhaCSV) === soDigitos(senhaDigitada);
  } else {
    ok = senhaCSV === senhaDigitada;
  }

  if (!ok) {
    console.log("LOGIN:", loginDigitado);
    console.log("SENHA_DIGITADA:", senhaDigitada, "=>", soDigitos(senhaDigitada));
    console.log("SENHA_CSV:", senhaCSV, "=>", soDigitos(senhaCSV));
    return res.status(401).json({ ok: false, mensagem: "Senha inválida ❌" });
  }

  const token = jwt.sign({ login: loginDigitado }, JWT_SECRET, {
    expiresIn: "2h",
  });

  return res.json({ ok: true, mensagem: "Login válido ✅", token });
});

// ===== PERIODOS =====
app.get("/periodos", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  const periodos = lista.map((d) => ({ periodo: d.periodo, titulo: d.titulo }));
  res.json({ ok: true, periodos });
});

// ===== DEMONSTRATIVO =====
app.get("/demonstrativo", autenticarJWT, (req, res) => {
  const lista = demosPorLogin[req.login] || [];
  if (!lista.length) {
    return res.status(404).json({ ok: false, mensagem: "Nenhum demonstrativo." });
  }

  const { periodo } = req.query;
  if (periodo) {
    const demo = lista.find((d) => d.periodo === periodo);
    if (!demo) {
      return res.status(404).json({ ok: false, mensagem: "Período não encontrado." });
    }
    return res.json({ ok: true, demonstrativo: demo });
  }

  res.json({ ok: true, demonstrativo: lista[0] });
});

// ===== ADMIN =====
app.post("/admin/login", (req, res) => {
  const { user, pass } = req.body;
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, mensagem: "Admin inválido ❌" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ ok: true, mensagem: "Admin OK ✅", token });
});

app.get("/admin/status", autenticarAdmin, (req, res) => {
  res.json({
    ok: true,
    usuarios: Object.keys(usuariosPorLogin).length,
    loginsComDemonstrativo: Object.keys(demosPorLogin).length,
  });
});

app.post("/admin/upload/usuarios", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    res.json({ ok: true, mensagem: "usuarios.csv recarregado ✅" });
  } catch {
    res.status(500).json({ ok: false, mensagem: "Erro ao recarregar usuarios.csv" });
  }
});

app.post("/admin/upload/demonstrativo", autenticarAdmin, upload.single("file"), (req, res) => {
  try {
    carregarCSVs();
    res.json({ ok: true, mensagem: "demonstrativos.csv recarregado ✅" });
  } catch {
    res.status(500).json({ ok: false, mensagem: "Erro ao recarregar demonstrativos.csv" });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
