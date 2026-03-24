# Impressão em Massa de PDFs

## Funcionalidade Implementada

Foi adicionada uma nova funcionalidade em **Ordens de Produção PCP** que permite imprimir múltiplos arquivos PDF de uma só vez usando a função de impressão do navegador.

## Como Usar

### 1. Acessar a Funcionalidade
1. Vá em **Ordens de Produção** no menu
2. Clique no card **"Impressão em Massa"** (ícone de impressora laranja)

### 2. Inserir IDs dos Cards
1. Cole ou digite os IDs dos cards no campo de texto
2. Os IDs podem ser separados por:
   - Vírgula: `MANTA-123, MANTA-124`
   - Espaço: `MANTA-123 MANTA-124`
   - Quebra de linha
   - Ponto e vírgula

Exemplo:
```
MANTA-123
MANTA-124
TENSYLON-456
```

### 3. Buscar Arquivos
1. Clique no botão **"Buscar Arquivos"**
2. O sistema irá:
   - Buscar todos os PDFs associados aos IDs fornecidos
   - Baixar os arquivos para a memória do navegador
   - Exibir a lista de arquivos encontrados

### 4. Selecionar Arquivos para Impressão
- Por padrão, todos os arquivos são selecionados automaticamente
- Você pode desmarcar arquivos individuais clicando neles
- Use os botões "Selecionar todos" ou "Limpar seleção" para controle rápido

### 5. Imprimir
1. Clique no botão **"Imprimir (X)"** onde X é o número de arquivos selecionados
2. O sistema irá:
   - Abrir cada PDF em uma nova aba do navegador
   - Acionar automaticamente a caixa de diálogo de impressão para cada arquivo
   - Você verá múltiplas abas abertas, uma para cada PDF

### 6. Configurar Impressão
- Para cada arquivo, o navegador abrirá a janela de impressão
- Configure suas preferências (impressora, orientação, etc.)
- Clique em "Imprimir" ou "Cancelar" para cada arquivo
- As abas podem ser fechadas após a impressão

## Características Técnicas

### Fluxo de Funcionamento
1. **Busca de Arquivos**: O sistema consulta o backend para encontrar todos os PDFs anexados aos cards
2. **Download**: Os arquivos são baixados para a memória do navegador (usando Blobs)
3. **Seleção**: Interface permite escolher quais arquivos imprimir
4. **Impressão**: Cada arquivo selecionado é aberto em uma nova aba com `window.print()` acionado automaticamente

### Limitações do Navegador
- **Bloqueador de Pop-ups**: Certifique-se de permitir pop-ups para o site
- **Performance**: Para grandes quantidades (10+ arquivos), o navegador pode ficar lento
- **Memória**: Cada PDF é carregado na memória do navegador
- **Intervalo**: Há um delay de 1 segundo entre cada arquivo para evitar sobrecarga

### Diferença entre Download e Impressão

| Recurso | Download OPs | Impressão em Massa |
|---------|--------------|-------------------|
| Resultado | Arquivo ZIP único | Múltiplas janelas de impressão |
| Uso | Salvar arquivos localmente | Imprimir diretamente |
| Armazenamento | Cria arquivo no disco | Temporário na memória |
| Seleção | Seleciona quais baixar | Seleciona quais imprimir |

## Dicas de Uso

### Para Melhor Performance
1. Processe lotes de até 10 PDFs por vez
2. Feche as abas após imprimir para liberar memória
3. Use uma conexão de internet estável para o download inicial

### Para Impressão em Massa
1. Configure uma impressora padrão antes de iniciar
2. Se possível, use "Imprimir tudo" na primeira janela e aplique às outras
3. Alguns navegadores permitem configuração de impressão padrão

### Solução de Problemas

**"Nenhum arquivo PDF encontrado"**
- Verifique se os IDs estão corretos
- Confirme se os cards têm PDFs anexados
- Verifique se você tem permissão de acesso aos cards

**"Pop-ups bloqueados"**
- Clique no ícone de bloqueio na barra de endereços
- Permita pop-ups para este site
- Tente novamente

**"Navegador travou"**
- Reduza a quantidade de arquivos por lote
- Feche outras abas desnecessárias
- Reinicie o navegador se necessário

## Atalhos de Teclado

- **ESC**: Fechar modal
- **Enter**: Buscar arquivos (quando IDs estão preenchidos)

## Tecnologias Utilizadas

- **Blob URLs**: Para criar URLs temporárias dos PDFs
- **window.open()**: Para abrir novas abas
- **window.print()**: Para acionar a impressão
- **Angular Forms**: Para gerenciar estado de seleção
- **RxJS**: Para operações assíncronas de download

## Próximas Melhorias (Sugeridas)

- [ ] Pré-visualização dos PDFs antes de imprimir
- [ ] Opção de imprimir tudo em uma única janela
- [ ] Configuração de impressão padronizada
- [ ] Histórico de impressões realizadas
- [ ] Estimativa de páginas totais antes de imprimir
