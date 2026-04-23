import express from 'express';
import {
  register,
  login,
  getMe,
  listUsers,
  createUser,
  updateUserAccess,
  updateUser
} from '../controllers/authController.js';

import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/me', authenticate, getMe);
router.get('/users', authenticate, listUsers);
router.post('/users', authenticate, createUser);

router.put('/users/:id/access', authenticate, updateUserAccess);
router.put('/users/:id', authenticate, updateUser);

export default router;