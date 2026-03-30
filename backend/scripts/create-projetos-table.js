import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

async function createProjetosTable() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: '-c search_path=maestro,public'
  });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    
    // Ler o arquivo SQL
    const sqlPath = join(__dirname, '..', 'database', 'projetos-schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Executando script SQL...');
    await pool.query(sql);
    
    console.log('✅ Tabela maestro.projetos_espelhos criada com sucesso!');
    
    // Verificar se a tabela foi criada
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'maestro' 
      AND table_name = 'projetos_espelhos'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verificação: Tabela encontrada no banco de dados');
      
      // Contar registros
      const count = await pool.query('SELECT COUNT(*) FROM maestro.projetos_espelhos');
      console.log(`📊 Total de registros: ${count.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createProjetosTable();
