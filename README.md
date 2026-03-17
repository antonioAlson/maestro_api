# 🚀 Maestro - Guia de Início Rápido

## 📋 Pré-requisitos

- Node.js v18+
- PostgreSQL
- npm

## ⚙️ Instalação Completa

### 1. Instalar todas as dependências

```powershell
npm run install:all
```

Este comando instala as dependências:
- Raiz do projeto
- Backend (API)
- Frontend (Angular)

### 2. Configurar Banco de Dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE maestro;
```

Configure o arquivo `backend/.env` com suas credenciais (já está preenchido com valores padrão).

### 3. Criar tabelas do banco

```powershell
npm run setup:db
```

### 4. Criar usuário de teste (opcional)

```powershell
npm run create:test-user
```

**Credenciais de teste:**
- Email: `teste@maestro.com`
- Senha: `123456`

## 🎯 Iniciar o Projeto

### ⚡ Opção 1: Usando npm (Recomendado)

```powershell
npm start
```

ou

```powershell
npm run dev
```

### ⚡ Opção 2: Script PowerShell

```powershell
.\start.ps1
```

### ⚡ Opção 3: Script Batch (cmd)

```cmd
start.bat
```

Ou simplesmente dê duplo clique no arquivo `start.bat`

### 📌 O que cada opção faz:

Todas as opções iniciam:
- **Backend API**: http://localhost:3000
- **Frontend Angular**: http://localhost:4200

**Diferenças:**
- **npm start**: Roda tudo em um único terminal (usa concurrently)
- **start.ps1**: Abre 2 janelas PowerShell separadas
- **start.bat**: Abre 2 janelas CMD separadas

### Iniciar separadamente:

**Apenas Backend:**
```powershell
npm run start:backend
```

**Apenas Frontend:**
```powershell
npm run start:frontend
```

## 📁 Estrutura do Projeto

```
v2.0/
├── backend/          # API REST (Node.js + Express + PostgreSQL)
├── maestro/          # Frontend (Angular)
└── package.json      # Scripts de gerenciamento
```

## 🔗 URLs

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000

## 📚 Documentação

- **Backend Setup**: [backend/SETUP.md](backend/SETUP.md)
- **Integração Angular-API**: [backend/INTEGRATION.md](backend/INTEGRATION.md)

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia backend + frontend juntos |
| `npm run dev` | Alias para npm start |
| `npm run start:backend` | Inicia apenas o backend |
| `npm run start:frontend` | Inicia apenas o frontend |
| `npm run install:all` | Instala todas as dependências |
| `npm run setup:db` | Cria tabelas no banco |
| `npm run create:test-user` | Cria usuário de teste |

## ✅ Checklist de Primeira Execução

- [ ] Instalar Node.js e PostgreSQL
- [ ] Criar banco de dados `maestro`
- [ ] Executar `npm run install:all`
- [ ] Configurar `backend/.env` (já tem valores padrão)
- [ ] Executar `npm run setup:db`
- [ ] Executar `npm run create:test-user`
- [ ] Executar `npm start`
- [ ] Acessar http://localhost:4200
- [ ] Testar login com credenciais de teste

## 🔧 Troubleshooting

**Erro de porta em uso:**
- Backend: Altere `PORT` em `backend/.env`
- Frontend: Altere porta no Angular CLI com `ng serve --port 4201`

**Erro de conexão com banco:**
- Verifique se PostgreSQL está rodando
- Confirme credenciais em `backend/.env`

**Erro ao instalar dependências:**
- Limpe cache: `npm cache clean --force`
- Delete `node_modules` e reinstale

## 🎉 Pronto!

Agora você pode acessar http://localhost:4200 e fazer login com o usuário de teste!
