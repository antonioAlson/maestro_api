# Configuração do Relatório Jira

Este documento explica como configurar a integração com o Jira para gerar relatórios Excel.

## Pré-requisitos

1. Conta Jira com acesso aos projetos MANTA e TENSYLON
2. Token de API do Jira

## Como obter o Token de API do Jira

1. Acesse: https://id.atlassian.com/manage-profile/security/api-tokens
2. Clique em "Create API token"
3. Dê um nome ao token (ex: "Maestro App")
4. Copie o token gerado (você não poderá vê-lo novamente)

## Configuração

1. Abra o arquivo: `maestro/src/environments/environment.ts`

2. Configure as seguintes variáveis:

```typescript
export const environment = {
  production: false,
  jira: {
    url: 'https://sua-empresa.atlassian.net',  // Substitua pela URL da sua instância Jira
    email: 'seu-email@empresa.com',             // Seu email do Jira
    apiToken: 'seu-token-aqui'                  // Token de API gerado
  }
};
```

3. Faça o mesmo no arquivo de produção: `maestro/src/environments/environment.prod.ts`

## Filtros Configurados

O relatório busca issues com os seguintes critérios:

### Projetos e Status:
- **MANTA**: "A Produzir", "Liberado Engenharia"
- **TENSYLON**: "A Produzir", "Liberado Engenharia", "Aguardando Acabamento", "Aguardando Autoclave", "Aguardando Corte", "Aguardando montagem"

### Situações Válidas:
- ⚪️RECEBIDO ENCAMINHADO
- 🟢RECEBIDO LIBERADO
- ⚫Aguardando entrada

## Campos Exportados

O relatório Excel contém as seguintes colunas:

1. **ID**: Chave da issue (ex: MANTA-123)
2. **Tipo de issue**: Tipo do card (História, Tarefa, etc)
3. **Chave**: Link clicável para o card no Jira
4. **Resumo**: Título do card
5. **Status**: Status atual do card
6. **SITUAÇÃO**: Campo customizado (customfield_10039)
7. **Veículo**: Campo customizado (customfield_11298)
8. **DT. PREVISÃO ENTREGA**: Campo customizado (customfield_10245)

## Como Usar

1. Acesse o menu **PCP > Relatórios PCP**
2. Clique no botão **Relatório Jira**
3. Aguarde o processamento (pode levar alguns segundos dependendo da quantidade de cards)
4. O arquivo Excel será baixado automaticamente com o nome: `jira_cards DD.MM.YYYY HH.MM.xlsx`

## Solução de Problemas

### Erro de autenticação
- Verifique se o email e token estão corretos
- Certifique-se de que o token não expirou
- Teste o acesso manual à API: `https://sua-empresa.atlassian.net/rest/api/3/myself`

### Nenhum card encontrado
- Verifique se há cards que atendem aos critérios de filtro
- Confirme se os nomes dos status e situações estão corretos
- Revise o filtro JQL no arquivo `jira.service.ts`

### Erro de CORS
- A API do Jira deve permitir requisições do domínio da aplicação
- Para desenvolvimento local, pode ser necessário configurar um proxy

## Modificando os Filtros

Para alterar o filtro JQL, edite o arquivo:
`maestro/src/app/services/jira.service.ts`

Localize a propriedade `jql` na classe `JiraService` e modifique conforme necessário.

Para alterar as situações válidas, modifique o array `situacoesValidas` no mesmo arquivo.
