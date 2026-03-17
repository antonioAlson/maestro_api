-- Criação da tabela de usuários no schema maestro
CREATE TABLE IF NOT EXISTS maestro.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS idx_users_email ON maestro.users(email);

-- Exemplo de inserção (senha: 123456)
-- A senha deve ser hasheada no backend antes de inserir
-- INSERT INTO maestro.users (name, email, password) 
-- VALUES ('Usuário Teste', 'teste@example.com', '$2a$10$...');
