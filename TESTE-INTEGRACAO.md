# 🔗 Guia de Teste - Integração Completa

## ✅ O que foi configurado:

### Backend (API):
- ✅ Servidor Express rodando na porta 3000
- ✅ Rotas de autenticação: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- ✅ Conexão com PostgreSQL
- ✅ JWT para autenticação
- ✅ Bcrypt para senhas

### Frontend (Angular):
- ✅ Auth Service criado
- ✅ HTTP Interceptor para adicionar JWT automaticamente
- ✅ Auth Guard para proteger rotas
- ✅ Componente de Login integrado com API
- ✅ Dashboard protegido com autenticação

---

## 🚀 Como testar:

### **PASSO 1: Configure o banco de dados**

```powershell
# 1. Abra psql ou pgAdmin e crie o banco:
psql -U postgres
CREATE DATABASE maestro;
\q

# 2. Configure a senha no backend/.env se necessário
# (já está configurado com postgres/postgres)

# 3. Crie as tabelas:
cd backend
npm run setup-db

# 4. Crie usuário de teste:
npm run create-test-user
```

**Credenciais de teste criadas:**
- Email: `teste@maestro.com`
- Senha: `123456`

---

### **PASSO 2: Inicie o projeto**

```powershell
# Na pasta raiz (v2.0):
npm start
```

Aguarde até ver:
- `[0] 🚀 Servidor rodando na porta: 3000`
- `[1] ✔ Browser application bundle generation complete`

---

### **PASSO 3: Teste o login**

1. **Abra o navegador:** http://localhost:4200

2. **Faça login com as credenciais:**
   - Email: `teste@maestro.com`
   - Senha: `123456`

3. **Você será redirecionado para:** http://localhost:4200/dashboard

4. **No Dashboard você verá:**
   - Mensagem de boas-vindas com seu nome
   - Seu email
   - Cards informativos
   - Botão de Logout

---

## 🔍 Como verificar se está funcionando:

### **1. Teste a API diretamente:**

```powershell
# Health check:
Invoke-RestMethod -Uri "http://localhost:3000"

# Login via PowerShell:
$body = @{
    email = "teste@maestro.com"
    password = "123456"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### **2. Abra o DevTools do navegador (F12):**

- **Console:** Verá logs de "✅ Login bem-sucedido"
- **Network:** Verá requisições para `http://localhost:3000/api/auth/login`
- **Application > Local Storage:** Verá o token `maestro_token` salvo

### **3. Teste o logout:**

- Clique no botão "Sair" no dashboard
- Você será redirecionado para `/login`
- O token será removido do localStorage

### **4. Teste rota protegida:**

- Faça logout
- Tente acessar diretamente: http://localhost:4200/dashboard
- Você será **redirecionado automaticamente** para `/login` (Guard funcionando!)

---

## 📊 Fluxo de Autenticação:

```
1. Usuário preenche login → LoginComponent

2. LoginComponent chama → AuthService.login()

3. AuthService faz → POST http://localhost:3000/api/auth/login

4. Backend valida → Consulta banco PostgreSQL

5. Backend retorna → { token, user }

6. AuthService salva → localStorage.setItem('maestro_token', token)

7. HTTP Interceptor adiciona → Header: Authorization: Bearer TOKEN

8. Router navega → /dashboard

9. AuthGuard verifica → Token existe? Sim → Permite acesso

10. Dashboard carrega → Mostra dados do usuário
```

---

## 🐛 Troubleshooting:

### **Erro: "Erro ao conectar com o servidor"**
- Verifique se o backend está rodando na porta 3000
- Confirme: http://localhost:3000 (deve retornar JSON)

### **Erro: "E-mail ou senha inválidos"**
- Confirme que executou: `npm run create-test-user`
- Verifique as credenciais: `teste@maestro.com` / `123456`

### **Erro de conexão com banco:**
- PostgreSQL está rodando?
- Credenciais corretas no `backend/.env`?
- Banco `maestro` foi criado?
- Tabelas foram criadas? (`npm run setup-db`)

### **CORS Error:**
- Backend já está configurado com CORS liberado
- Se persistir, reinicie os servidores

### **Token inválido:**
- Faça logout e login novamente
- O token expira em 7 dias (configurável no .env)

---

## 📝 Criar novos usuários:

### **Pelo Angular:**
Implemente um componente de registro que chama:
```typescript
this.authService.register(name, email, password)
```

### **Direto no banco:**
```sql
-- Gere o hash da senha primeiro (use bcrypt online ou via script)
INSERT INTO users (name, email, password) 
VALUES ('Novo Usuário', 'novo@email.com', '$2a$10$hashAqui');
```

### **Via API:**
```powershell
$body = @{
    name = "João Silva"
    email = "joao@email.com"
    password = "senha123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## 🎉 Pronto!

Sua aplicação está totalmente integrada:
- ✅ Frontend Angular conectado
- ✅ Backend API funcionando  
- ✅ PostgreSQL validando dados
- ✅ JWT implementado
- ✅ Rotas protegidas

**Próximos passos sugeridos:**
1. Implementar página de registro
2. Adicionar recuperação de senha
3. Criar mais funcionalidades no dashboard
4. Implementar refresh tokens
5. Adicionar testes unitários
