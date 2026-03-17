import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    console.log('🔄 Iniciando setup do banco de dados...');

    // Ler arquivo SQL
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Executar script SQL
    await pool.query(schema);

    console.log('✅ Tabelas criadas com sucesso!');
    
    // Verificar se há usuários
    const result = await pool.query('SELECT COUNT(*) FROM maestro.users');
    console.log(`📊 Total de usuários no banco: ${result.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error);
    process.exit(1);
  }
}

setupDatabase();
