-- Script para dar permissões ao usuário caio no banco maestro
-- Execute este script como superusuário (postgres) ou outro usuário com permissões

-- Dar permissões no schema public
GRANT ALL ON SCHEMA public TO caio;
GRANT ALL PRIVILEGES ON DATABASE maestro TO caio;

-- Dar permissão para criar tabelas e outros objetos
GRANT CREATE ON SCHEMA public TO caio;
GRANT USAGE ON SCHEMA public TO caio;

-- Permitir que caio seja dono de objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO caio;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO caio;

-- Opcional: tornar caio proprietário do schema public
ALTER SCHEMA public OWNER TO caio;
