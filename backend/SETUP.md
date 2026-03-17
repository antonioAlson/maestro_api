# 🚀 Guia de Configuração - Maestro API

## 📋 Pré-requisitos

1. **Node.js** (v18 ou superior)
2. **PostgreSQL** instalado e rodando
3. **npm** ou **yarn**

## 🔧 Configuração do Banco de Dados

### 1. Criar o banco de dados

Abra o terminal do PostgreSQL (psql) ou use uma ferramenta como pgAdmin:

```sql
CREATE DATABASE maestro;
```

### 2. Configurar variáveis de ambiente

O arquivo `.env` já foi criado com as configurações padrão. Edite-o se necessário:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maestro
DB_USER=postgres
DB_PASSWORD=postgres  # Altere para sua senha
```

### 3. Criar as tabelas

Execute o script de setup:

```bash
npm run setup-db
```

Este comando irá criar automaticamente a tabela `users` no banco de dados.

### 4. Criar usuário de teste (opcional)

Para testar rapidamente, crie um usuário de teste:

```bash
npm run create-test-user
```

**Credenciais do usuário de teste:**
- Email: `teste@maestro.com`
- Senha: `123456`

## ▶️ Executar a API

### Desenvolvimento (com hot reload):
```bash
npm run dev
```

### Produção:
```bash
npm start
```

A API estará disponível em: `http://localhost:3000`

## 📡 Testando os Endpoints

### 1. Health Check

```bash
curl http://localhost:3000
```

### 2. Registrar novo usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "senha123"
  }'
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Usuário cadastrado com sucesso",
  "data": {
    "user": {
      "id": 1,
      "name": "João Silva",
      "email": "joao@example.com",
      "createdAt": "2026-03-17T..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Fazer Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@maestro.com",
    "password": "123456"
  }'
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "user": {
      "id": 1,
      "name": "Usuário Teste",
      "email": "teste@maestro.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 4. Obter dados do usuário autenticado

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Usuário Teste",
      "email": "teste@maestro.com",
      "createdAt": "2026-03-17T...",
      "updatedAt": "2026-03-17T..."
    }
  }
}
```

## 🔐 Autenticação

A API usa **JWT (JSON Web Tokens)** para autenticação.

### Como usar:

1. Faça login ou registre-se para obter um token
2. Inclua o token no header `Authorization` das requisições protegidas:
   ```
   Authorization: Bearer SEU_TOKEN_AQUI
   ```

### Token expira em:
- Padrão: **7 dias**
- Configurável em `.env` (JWT_EXPIRES_IN)

## 📝 Endpoints Disponíveis

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|--------------|-----------|
| GET | `/` | Não | Health check |
| POST | `/api/auth/register` | Não | Registrar novo usuário |
| POST | `/api/auth/login` | Não | Fazer login |
| GET | `/api/auth/me` | Sim | Obter dados do usuário |

## ❌ Tratamento de Erros

A API retorna erros no seguinte formato:

```json
{
  "success": false,
  "message": "Descrição do erro"
}
```

### Códigos de status HTTP:

- **200**: Sucesso
- **201**: Criado com sucesso
- **400**: Erro de validação
- **401**: Não autenticado / Token inválido
- **404**: Não encontrado
- **500**: Erro interno do servidor

## 🔍 Troubleshooting

### Erro de conexão com o banco:

1. Verifique se o PostgreSQL está rodando:
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Confirme as credenciais no arquivo `.env`
3. Teste a conexão manualmente com psql

### Porta já em uso:

Altere a porta no arquivo `.env`:
```env
PORT=3001
```

### Token expirado:

Faça login novamente para obter um novo token.

## 🛠️ Próximos Passos

Agora que a API está funcionando, você pode:

1. **Integrar com o Angular**: Criar services para chamar os endpoints
2. **Adicionar mais endpoints**: CRUD de outros recursos
3. **Melhorar segurança**: Rate limiting, HTTPS, validações avançadas
4. **Deploy**: Preparar para produção (Railway, Render, Heroku, etc.)

## 📞 Suporte

Se encontrar algum problema, verifique:
- Logs do servidor no terminal
- Configurações do `.env`
- Conexão com o banco de dados
