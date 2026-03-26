-- Tabela para armazenar as ordens diárias de produção
-- Usado no módulo de Acompanhamento (Cronograma)

CREATE TABLE IF NOT EXISTS maestro.ordens_diarias (
  id SERIAL PRIMARY KEY,
  seq VARCHAR(10),
  tipo VARCHAR(50),
  os VARCHAR(50),
  veiculo VARCHAR(255),
  data_entrega DATE,
  obs TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_ordens_data_entrega ON maestro.ordens_diarias(data_entrega);
CREATE INDEX IF NOT EXISTS idx_ordens_os ON maestro.ordens_diarias(os);
CREATE INDEX IF NOT EXISTS idx_ordens_created_at ON maestro.ordens_diarias(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE maestro.ordens_diarias IS 'Ordens de produção diárias para acompanhamento no cronograma';
COMMENT ON COLUMN maestro.ordens_diarias.seq IS 'Número sequencial da ordem';
COMMENT ON COLUMN maestro.ordens_diarias.tipo IS 'Tipo da ordem (ex: MANTA, TENSYLON, etc)';
COMMENT ON COLUMN maestro.ordens_diarias.os IS 'Número da Ordem de Serviço';
COMMENT ON COLUMN maestro.ordens_diarias.veiculo IS 'Veículo/Modelo relacionado à ordem';
COMMENT ON COLUMN maestro.ordens_diarias.data_entrega IS 'Data prevista de entrega';
COMMENT ON COLUMN maestro.ordens_diarias.obs IS 'Observações adicionais';

-- Dados de exemplo para teste
INSERT INTO maestro.ordens_diarias (seq, tipo, os, veiculo, data_entrega, obs) VALUES
  ('1', 'MANTA', '1234', 'Toyota Hilux 2024', '2026-03-27', 'Prioridade alta'),
  ('2', 'TENSYLON', '1235', 'Ford Ranger 2024', '2026-03-28', 'Aguardando material'),
  ('3', 'MANTA', '1236', 'Volkswagen Amarok 2024', '2026-03-29', ''),
  ('4', 'TENSYLON', '1237', 'Chevrolet S10 2024', '2026-03-30', 'Cliente VIP')
ON CONFLICT DO NOTHING;

-- Mensagem de conclusão
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela maestro.ordens_diarias criada com sucesso!';
  RAISE NOTICE '📋 Índices criados para otimização de consultas';
  RAISE NOTICE '📊 Dados de exemplo inseridos';
END $$;
