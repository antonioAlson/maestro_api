import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { invalidateCache } from '../services/jiraService.js';

/**
 * =========================
 * CONFIG CRYPTO (JIRA TOKEN)
 * =========================
 */
const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.JIRA_TOKEN_SECRET; // precisa ter 32 bytes
const IV_LENGTH = 12;

if (!SECRET || SECRET.length !== 64) {
  throw new Error('JIRA_TOKEN_SECRET must be 64 hex characters (32 bytes)');
}

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text)), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
  try {
    if (!text) return null;

    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(SECRET, 'hex'),
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (err) {
    console.error('Erro ao descriptografar token:', err);
    return null;
  }
};

/**
 * =========================
 * MENU
 * =========================
 */
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
  if (!Array.isArray(menuAccess)) return [];

  return Array.from(
    new Set(menuAccess.filter(item => typeof item === 'string' && VALID_MENU_ACCESS.has(item)))
  );
};

/**
 * =========================
 * MAP USER (NUNCA EXPOR TOKEN)
 * =========================
 */
const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  menuAccess: Array.isArray(user.menu_access) ? user.menu_access : [],
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

/**
 * =========================
 * REGISTER
 * =========================
 */
export const register = async (req, res) => {
  try {
    const { name, email, password, jiraToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Preencha todos os campos obrigatórios'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'E-mail inválido'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter no mínimo 6 caracteres'
      });
    }

    const userExists = await query(
      'SELECT id FROM maestro.users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'E-mail já cadastrado'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedToken = encrypt(jiraToken);

    const result = await query(
      `INSERT INTO maestro.users 
       (name, email, password, api_token, menu_access) 
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, name, email, menu_access, created_at`,
      [name, email, hashedPassword, encryptedToken, JSON.stringify(DEFAULT_MENU_ACCESS)]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: mapUser(user),
        token
      }
    });

  } catch (error) {
    console.error('Erro register:', error);
    res.status(500).json({ success: false, message: 'Erro ao registrar usuário' });
  }
};

/**
 * =========================
 * LOGIN
 * =========================
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, name, email, password, menu_access FROM maestro.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        user: mapUser(user),
        token
      }
    });

  } catch (error) {
    console.error('Erro login:', error);
    res.status(500).json({ success: false, message: 'Erro no login' });
  }
};

/**
 * =========================
 * GET ME
 * =========================
 */
export const getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, menu_access, created_at, updated_at FROM maestro.users WHERE id = $1',
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false });
    }

    res.json({
      success: true,
      data: { user: mapUser(result.rows[0]) }
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * =========================
 * LIST USERS
 * =========================
 */
export const listUsers = async (_req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, menu_access, created_at, updated_at FROM maestro.users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: { users: result.rows.map(mapUser) }
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * =========================
 * CREATE USER (ADMIN)
 * =========================
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, jiraToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Campos obrigatórios' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'E-mail inválido'
      });
    }

    const userExists = await query(
      'SELECT id FROM maestro.users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'E-mail já cadastrado'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedToken = encrypt(jiraToken);

    const result = await query(
      `INSERT INTO maestro.users 
       (name, email, password, api_token, menu_access) 
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, name, email, menu_access, created_at, updated_at`,
      [name, email, hashedPassword, encryptedToken, JSON.stringify(DEFAULT_MENU_ACCESS)]
    );

    res.status(201).json({
      success: true,
      data: { user: mapUser(result.rows[0]) }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

/**
 * =========================
 * UPDATE ACCESS
 * =========================
 */
export const updateUserAccess = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const sanitizedAccess = sanitizeMenuAccess(req.body?.menuAccess);

    const result = await query(
      `UPDATE maestro.users 
       SET menu_access = $1::jsonb, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, name, email, menu_access, created_at, updated_at`,
      [JSON.stringify(sanitizedAccess), userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false });
    }

    res.json({
      success: true,
      data: { user: mapUser(result.rows[0]) }
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
};


/**
 * =========================
 * UPDATE SELF (senha + token Jira)
 * =========================
 */
export const updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, jiraToken } = req.body;

    const existing = await query('SELECT * FROM maestro.users WHERE id = $1', [userId]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    const currentUser = existing.rows[0];

    const setClauses = [];
    const values = [];
    let idx = 1;
    let jiraTokenChanged = false;

    if (newPassword !== undefined && newPassword !== '') {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Informe a senha atual para alterar a senha.' });
      }
      const isValid = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Senha atual incorreta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }
      setClauses.push(`password = $${idx++}`);
      values.push(await bcrypt.hash(newPassword, 10));
    }

    if (jiraToken !== undefined && jiraToken !== '') {
      setClauses.push(`api_token = $${idx++}`);
      values.push(encrypt(jiraToken));
      jiraTokenChanged = true;
    }

    if (!setClauses.length) {
      return res.status(400).json({ success: false, message: 'Nenhuma alteração enviada.' });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE maestro.users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, name, email, menu_access, created_at, updated_at`,
      values
    );

    if (jiraTokenChanged) invalidateCache(userId);

    res.json({ success: true, message: 'Configurações atualizadas com sucesso.', data: { user: mapUser(result.rows[0]) } });

  } catch (error) {
    console.error('Erro updateMe:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar configurações.' });
  }
};

/**
 * =========================
 * UPDATE USER (ADMIN)
 * =========================
 */
export const updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { name, email, password, jiraToken } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Buscar usuário atual
    const existing = await query(
      'SELECT * FROM maestro.users WHERE id = $1',
      [userId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const currentUser = existing.rows[0];

    /**
     * =========================
     * PREPARAR DADOS
     * =========================
     */

    const updatedName = name?.trim() || currentUser.name;
    const updatedEmail = email?.trim() || currentUser.email;

    // validar email se veio

    const emailExists = await query(
      'SELECT id FROM maestro.users WHERE email = $1 AND id <> $2',
      [updatedEmail, userId]
    );

    if (emailExists.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'E-mail já cadastrado'
      });
    }

    // senha opcional
    let updatedPassword = currentUser.password;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Senha deve ter no mínimo 6 caracteres'
        });
      }
      updatedPassword = await bcrypt.hash(password, 10);
    }

    // jira token opcional
    let updatedJiraToken = currentUser.api_token;
    let jiraTokenChanged = false;
    if (jiraToken !== undefined) {
      if (jiraToken === '') {
        // NÃO ALTERA
        updatedJiraToken = currentUser.api_token;
      } else {
        updatedJiraToken = encrypt(jiraToken);
        jiraTokenChanged = true;
      }
    }

    /**
     * =========================
     * UPDATE
     * =========================
     */
    const result = await query(
      `UPDATE maestro.users 
       SET name = $1,
           email = $2,
           password = $3,
           api_token = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, menu_access, created_at, updated_at`,
      [updatedName, updatedEmail, updatedPassword, updatedJiraToken, userId]
    );

    if (jiraTokenChanged) {
      invalidateCache(userId);
    }

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: {
        user: mapUser(result.rows[0])
      }
    });

  } catch (error) {
    console.error('Erro updateUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário'
    });
  }
};