import pool from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env') });

async function configureUserJiraToken() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Verificando tokens do Jira dos usuários...\n');
    
    // Listar todos os usuários
    const users = await client.query(`
      SELECT id, name, email, api_token
      FROM maestro.users
      ORDER BY id;
    `);
    
    console.log('👥 Usuários no banco de dados:');
    console.log('='.repeat(80));
    users.rows.forEach(user => {
      const hasToken = user.api_token ? '✓ Configurado' : '✗ NÃO CONFIGURADO';
      console.log(`  [${hasToken}] ID: ${user.id} | ${user.name} | ${user.email}`);
    });
    console.log('='.repeat(80));
    
    const usersWithoutToken = users.rows.filter(u => !u.api_token);
    
    if (usersWithoutToken.length === 0) {
      console.log('\n✅ Todos os usuários já possuem token configurado!');
      return;
    }
    
    console.log(`\n⚠️ ${usersWithoutToken.length} usuário(s) sem token configurado`);
    console.log('\n📝 Para configurar, execute o seguinte SQL:\n');
    
    usersWithoutToken.forEach(user => {
      console.log(`-- Configurar token para ${user.name}`);
      console.log(`UPDATE maestro.users`);
      console.log(`SET api_token = 'SEU_TOKEN_JIRA_AQUI'`);
      console.log(`WHERE email = '${user.email}';`);
      console.log('');
    });
    
    console.log('🔗 Para gerar um token do Jira:');
    console.log('   https://id.atlassian.com/manage-profile/security/api-tokens');
    console.log('\n💡 Dica: Use o token que está no .env se disponível');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
configureUserJiraToken()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha:', error);
    process.exit(1);
  });
