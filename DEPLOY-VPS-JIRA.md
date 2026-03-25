# Guia de Deploy - VPS

## Após fazer deploy das alterações de credenciais do Jira

### 1. Verificar status dos usuários

Execute o script de verificação:

```bash
cd backend
node scripts/configure-user-jira-token.js
```

Isso mostrará quais usuários precisam de token configurado.

### 2. Configurar tokens dos usuários

Para cada usuário que precisa de acesso ao Jira, execute no banco de dados:

```sql
UPDATE maestro.users
SET api_token = 'TOKEN_DO_JIRA_AQUI'
WHERE email = 'email.do.usuario@dominio.com';
```

**Como obter o token do Jira:**
1. Acesse: https://id.atlassian.com/manage-profile/security/api-tokens
2. Faça login com a conta Atlassian do usuário
3. Clique em "Create API token"
4. Dê um nome (ex: "Maestro VPS")
5. Copie o token gerado
6. Execute o SQL acima com o token

### 3. Verificar novamente

Após configurar, execute novamente o script para confirmar:

```bash
node scripts/configure-user-jira-token.js
```

Todos os usuários devem aparecer com "✓ Configurado".

### 4. Reiniciar o backend (se necessário)

```bash
pm2 restart maestro-backend
# ou
npm start
```

### 5. Testar

Acesse o frontend e tente gerar um relatório do Jira para confirmar que funciona.

---

## Diferenças da versão anterior

**ANTES:** As credenciais do Jira eram lidas do arquivo `.env` (compartilhadas por todos)

**AGORA:** Cada usuário tem suas próprias credenciais no banco de dados (coluna `api_token`)

### Vantagens:
- ✓ Cada usuário usa suas próprias credenciais do Jira
- ✓ Rastreabilidade de quem fez cada ação
- ✓ Não precisa compartilhar tokens
- ✓ Pode revogar acesso de um usuário específico

### Campos necessários:
- `email` (já existia) - usado para autenticação no Jira
- `api_token` (novo) - token da API do Jira do usuário

---

## Problemas comuns

### Erro 500 ao buscar issues do Jira

**Causa:** Usuário sem `api_token` configurado

**Solução:**
1. Execute o script de verificação
2. Configure o token usando o SQL acima
3. Reinicie o backend

### "Credenciais do Jira não configuradas"

**Causa:** Campo `api_token` está vazio (`NULL`) para o usuário

**Solução:**
```sql
-- Verificar qual usuário está com problema
SELECT id, name, email, 
  CASE WHEN api_token IS NULL THEN 'SEM TOKEN' ELSE 'OK' END as status
FROM maestro.users;

-- Configurar token
UPDATE maestro.users
SET api_token = 'TOKEN_AQUI'
WHERE id = <ID_DO_USUARIO>;
```

---

## Migração do esquema

Se ainda não executou a migração, execute:

```bash
cd backend
node scripts/fix-jira-credentials-columns.js
```

Isso irá:
- Adicionar coluna `api_token` se não existir
- Remover colunas antigas (`jira_email`, `jira_api_token`)
- Migrar dados se houver

---

## Variáveis de ambiente (.env)

As seguintes variáveis do Jira **NÃO SÃO MAIS NECESSÁRIAS** no `.env`:
- ~~`JIRA_EMAIL`~~ (removido)
- ~~`JIRA_API_TOKEN`~~ (removido)

Apenas esta é necessária:
- `JIRA_URL=https://carboncars.atlassian.net`

As credenciais agora vêm do banco de dados (tabela `users`).
