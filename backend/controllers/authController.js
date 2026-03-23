import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const DEFAULT_MENU_ACCESS = [
  '/home',
  '/pcp/ordens',
  '/pcp/acompanhamento',
  '/pcp/relatorios',
  '/projetos/espelhos',
  '/users',
  '/users/acesso',
  '/reports',
  '/settings'
];

const VALID_MENU_ACCESS = new Set(DEFAULT_MENU_ACCESS);

const sanitizeMenuAccess = (menuAccess) => {
  if (!Array.isArray(menuAccess)) {
    return [];
  }

  const validUnique = Array.from(
    new Set(menuAccess.filter(item => typeof item === 'string' && VALID_MENU_ACCESS.has(item)))
  );

  return validUnique;
};

const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  menuAccess: Array.isArray(user.menu_access) ? user.menu_access : [],
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

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
      'INSERT INTO maestro.users (name, email, password, menu_access) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, name, email, menu_access, created_at',
      [name, email, hashedPassword, JSON.stringify(DEFAULT_MENU_ACCESS)]
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
        user: mapUser(user),
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
      'SELECT id, name, email, password, menu_access FROM maestro.users WHERE email = $1',
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
        user: mapUser(user),
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
      'SELECT id, name, email, menu_access, created_at, updated_at FROM maestro.users WHERE id = $1',
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
        user: mapUser(user)
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

// Listar usuários cadastrados
export const listUsers = async (_req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, menu_access, created_at, updated_at FROM maestro.users ORDER BY created_at DESC'
    );

    const users = result.rows.map(mapUser);

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários'
    });
  }
};

// Criar usuário (uso de gestão interna)
export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, insira um e-mail válido'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter no mínimo 6 caracteres'
      });
    }

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await query(
      'INSERT INTO maestro.users (name, email, password, menu_access) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, name, email, menu_access, created_at, updated_at',
      [name, email, hashedPassword, JSON.stringify(DEFAULT_MENU_ACCESS)]
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      data: {
        user: mapUser(user)
      }
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cadastrar usuário'
    });
  }
};

// Atualizar itens de menu acessíveis por usuário
export const updateUserAccess = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const sanitizedAccess = sanitizeMenuAccess(req.body?.menuAccess);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuário inválido'
      });
    }

    const result = await query(
      'UPDATE maestro.users SET menu_access = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, menu_access, created_at, updated_at',
      [JSON.stringify(sanitizedAccess), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    return res.json({
      success: true,
      message: 'Acessos atualizados com sucesso',
      data: {
        user: mapUser(result.rows[0])
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar acessos do usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar acessos do usuário'
    });
  }
};
