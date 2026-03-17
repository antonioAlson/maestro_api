import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

async function createTestUser() {
  try {
    console.log('🔄 Criando usuário de teste...');

    // Dados do novo usuário
    const name = 'Guarino Silva';
    const email = 'guarino.silva@opera.security';
    const password = 'Caio123qwe';

    console.log(`👤 Nome: ${name}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Senha: ${password}`);
    console.log();

    // Hash da senha
    console.log('🔐 Gerando hash da senha...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('✅ Hash gerado:', hashedPassword.substring(0, 20) + '...');

    // Verificar se o usuário já existe
    console.log('🔍 Verificando se usuário já existe...');
    const existingUser = await pool.query(
      'SELECT id FROM maestro.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  Usuário já existe! Atualizando senha...');
      
      // Atualizar senha do usuário existente
      await pool.query(
        'UPDATE maestro.users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [hashedPassword, email]
      );
      
      console.log('✅ Senha atualizada com sucesso!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Senha: ${password}`);
      process.exit(0);
    }

    // Criar usuário
    console.log('➕ Criando novo usuário...');
    const result = await pool.query(
      'INSERT INTO maestro.users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    console.log('✅ Usuário criado com sucesso!');
    console.log('👤 Dados do usuário:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Nome: ${result.rows[0].name}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Senha: ${password}`);
    console.log('\n💡 Use estas credenciais para fazer login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createTestUser();
