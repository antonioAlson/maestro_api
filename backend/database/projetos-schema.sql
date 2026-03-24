-- Tabela para armazenar os projetos/espelhos gerados
CREATE TABLE IF NOT EXISTS maestro.projetos_espelhos (
  id SERIAL PRIMARY KEY,
  card_id VARCHAR(50) NOT NULL,
  numero_ordem VARCHAR(50),
  titulo VARCHAR(255),
  usuario_email VARCHAR(255) NOT NULL,
  usuario_nome VARCHAR(255),
  arquivo_pdf VARCHAR(255),
  tamanho_kb DECIMAL(10, 2),
  quantidade_pecas INTEGER DEFAULT 1,
  arquivo_projeto_incluido BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'gerado',
  tempo_processamento DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_projetos_card_id ON maestro.projetos_espelhos(card_id);
CREATE INDEX IF NOT EXISTS idx_projetos_usuario ON maestro.projetos_espelhos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_projetos_created_at ON maestro.projetos_espelhos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projetos_numero_ordem ON maestro.projetos_espelhos(numero_ordem);

-- Comentários para documentação
COMMENT ON TABLE maestro.projetos_espelhos IS 'Registro dos espelhos/projetos gerados no sistema';
COMMENT ON COLUMN maestro.projetos_espelhos.card_id IS 'ID do card no Jira (ex: TENSYLON-819)';
COMMENT ON COLUMN maestro.projetos_espelhos.numero_ordem IS 'Número da ordem de produção';
COMMENT ON COLUMN maestro.projetos_espelhos.quantidade_pecas IS 'Quantidade de peças especificada na geração';
