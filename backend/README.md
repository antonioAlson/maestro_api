# Maestro API

API REST para o sistema Maestro

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`
2. Configure as variáveis de ambiente com suas credenciais do banco de dados
3. Execute o script SQL em `database/schema.sql` para criar as tabelas

## Uso

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## Endpoints

### Autenticação

- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Obter dados do usuário autenticado

## Tecnologias

- Node.js
- Express
- PostgreSQL
- JWT para autenticação
- Bcrypt para hash de senhas
