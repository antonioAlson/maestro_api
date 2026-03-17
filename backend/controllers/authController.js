import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

// Registrar novo usuário
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validação básica
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, insira um e-mail válido'
      });
    }

    // Validar tamanho da senha
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter no mínimo 6 caracteres'
      });
    }

    // Verificar se o email já existe
    const userExists = await query(
      'SELECT id FROM maestro.users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este e-mail já está cadastrado'
      });
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Inserir usuário no banco
    const result = await query(
      'INSERT INTO maestro.users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cadastrar usuário'
    });
  }
};

// Login de usuário
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔵 Tentativa de login:', email);

    // Validação básica
    if (!email || !password) {
      console.log('❌ Campos vazios');
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos'
      });
    }

    // Buscar usuário no banco
    console.log('🔍 Buscando usuário no banco...');
    const result = await query(
      'SELECT id, name, email, password FROM maestro.users WHERE email = $1',
      [email]
    );
    
    console.log('📊 Resultado:', result.rows.length, 'usuário(s) encontrado(s)');

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado');
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha inválidos'
      });
    }

    const user = result.rows[0];
    console.log('👤 Usuário encontrado:', user.name);

    // Verificar senha
    console.log('🔐 Verificando senha...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔐 Senha válida?', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Senha inválida');
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha inválidos'
      });
    }

    // Gerar token JWT
    console.log('🎫 Gerando token JWT...');
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    console.log('✅ Token gerado');

    console.log('✅ Login bem-sucedido! Enviando resposta...');
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        token
      }
    });
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login'
    });
  }
};

// Obter dados do usuário autenticado
export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT id, name, email, created_at, updated_at FROM maestro.users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do usuário'
    });
  }
};
