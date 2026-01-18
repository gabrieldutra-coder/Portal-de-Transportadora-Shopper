# Publicar online (Render + Vercel)

## Backend (Render)
1. Suba este projeto para o GitHub.
2. No Render: New -> Web Service -> selecione o repositório.
3. Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment variables:
   - `JWT_SECRET` (obrigatório)
   - `ADMIN_USER` (obrigatório)
   - `ADMIN_PASS` (obrigatório)

> Observação: no plano free, o disco pode ser efêmero. Use o painel admin para re-enviar os CSVs quando necessário.

## Frontend (Vercel)
1. No Vercel: New Project -> selecione o repositório.
2. Root Directory: `frontend`
3. Framework: Other
4. Após deploy, edite `frontend/config.js` e coloque a URL do Render:

```js
// window.API_BASE = "https://seu-backend.onrender.com";
```

Depois faça commit e redeploy.

## Teste
- Frontend: abra a URL do Vercel.
- Login: use um LOGIN/SENHA do `usuarios.csv`.
- Admin: `.../admin.html` -> faça upload dos CSVs.
