# Instalação da Tabela de Projetos Espelhos

## 1. Executar o Schema SQL

Para criar a tabela de projetos/espelhos no banco de dados PostgreSQL, execute o seguinte script:

```bash
# Conectar ao banco de dados
psql -h 46.202.92.228 -U caio -d opera

# Ou executar diretamente o arquivo
psql -h 46.202.92.228 -U caio -d opera -f backend/database/projetos-schema.sql
```

## 2. Verificar a criação da tabela

```sql
-- Verificar se a tabela foi criada
\dt maestro.projetos_espelhos

-- Verificar a estrutura da tabela
\d maestro.projetos_espelhos

-- Testar a inserção (opcional)
SELECT COUNT(*) FROM maestro.projetos_espelhos;
```

## 3. Funcionalidades Implementadas

### Backend

1. **Novo Schema**: `backend/database/projetos-schema.sql`
   - Tabela `maestro.projetos_espelhos` com todos os campos necessários
   - Índices para otimização de consultas
   - Comentários de documentação

2. **Controller**: `backend/controllers/jiraController.js`
   - `listarProjetosEspelhos()`: Lista projetos com paginação e filtros
   - `obterProjetoEspelho(id)`: Obtém detalhes de um projeto específico
   - `obterEstatisticasProjetos()`: Retorna estatísticas gerais
   - Inserção automática de registro após geração bem-sucedida de espelho

3. **Rotas**: `backend/routes/jira.js`
   - `GET /api/jira/projetos-espelhos`: Listar projetos (paginação, filtro, ordenação)
   - `GET /api/jira/projetos-espelhos/:id`: Obter projeto específico
   - `GET /api/jira/projetos-espelhos-stats`: Estatísticas

### Frontend

1. **Service**: `maestro/src/app/services/jira.service.ts`
   - `listarProjetosEspelhos()`: Consumir API de listagem
   - `obterProjetoEspelho(id)`: Buscar projeto específico
   - `obterEstatisticasProjetos()`: Buscar estatísticas
   - Interfaces TypeScript para tipagem forte

2. **Componente**: `maestro/src/app/pages/cadastro-projetos/`
   - Listagem completa de projetos em tabela
   - Filtro por card ID, número de ordem, título ou usuário
   - Ordenação por qualquer coluna (clicável)
   - Paginação com navegação
   - Painel de estatísticas retrátil
   - Design responsivo

3. **Funcionalidades da Interface**:
   - Busca textual com Enter
   - Ordenação por colunas (clique no cabeçalho)
   - Indicadores visuais (badges) para status e arquivos
   - Formatação de datas em pt-BR
   - Loading states e tratamento de erros
   - Responsivo para mobile

## 4. Fluxo de Dados

### Geração de Espelho
1. Usuário gera espelho em `/projetos/espelhos`
2. Backend processa e salva PDF
3. Registro é automaticamente inserido em `maestro.projetos_espelhos`
4. Log também é gravado em `backend/logs/espelhos-gerados.txt`

### Visualização de Cadastros
1. Usuário acessa `/projetos/cadastro`
2. Componente carrega lista paginada do backend
3. Filtros e ordenação são aplicados
4. Estatísticas são carregadas separadamente

## 5. Parâmetros de Query

### Listar Projetos
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 50)
- `filtro`: Texto para busca (card_id, numero_ordem, titulo, usuario)
- `ordenarPor`: Campo para ordenar (created_at, numero_ordem, card_id, usuario_nome, quantidade_pecas)
- `ordem`: ASC ou DESC

Exemplo:
```
GET /api/jira/projetos-espelhos?page=1&limit=20&filtro=TENSYLON&ordenarPor=created_at&ordem=DESC
```

## 6. Campos da Tabela

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL | ID único do registro |
| card_id | VARCHAR(50) | ID do card no Jira (ex: TENSYLON-819) |
| numero_ordem | VARCHAR(50) | Número da ordem de produção |
| titulo | VARCHAR(255) | Título do card |
| usuario_email | VARCHAR(255) | Email do usuário que gerou |
| usuario_nome | VARCHAR(255) | Nome do usuário |
| arquivo_pdf | VARCHAR(255) | Nome do arquivo PDF gerado |
| tamanho_kb | DECIMAL | Tamanho do PDF em KB |
| quantidade_pecas | INTEGER | Quantidade de peças especificada |
| arquivo_projeto_incluido | BOOLEAN | Se incluiu arquivo de projeto |
| status | VARCHAR(50) | Status do projeto (padrão: 'gerado') |
| tempo_processamento | DECIMAL | Tempo de processamento em segundos |
| created_at | TIMESTAMP | Data/hora de criação |
| updated_at | TIMESTAMP | Data/hora de atualização |

## 7. Próximos Passos (Opcional)

- Adicionar filtros avançados (por data, usuário, status)
- Implementar exportação para Excel
- Adicionar gráficos de produtividade
- Permitir edição de informações
- Adicionar campo de observações
- Dashboard com métricas em tempo real
