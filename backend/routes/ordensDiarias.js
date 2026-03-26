import express from 'express';
import {
  getOrdensDiarias,
  createOrdemDiaria,
  updateOrdemDiaria,
  deleteOrdemDiaria
} from '../controllers/ordensDiariasController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Listar ordens diárias (com filtros opcionais)
router.get('/', authenticate, getOrdensDiarias);

// Criar nova ordem diária
router.post('/', authenticate, createOrdemDiaria);

// Atualizar ordem diária
router.put('/:id', authenticate, updateOrdemDiaria);

// Deletar ordem diária
router.delete('/:id', authenticate, deleteOrdemDiaria);

export default router;
