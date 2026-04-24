import express from 'express';
import {
  criarProjectComPlanos,
  listarProjectsComPlanos,
  obterProjectComPlanos,
  atualizarProjectFixo,
  clonarProjectComPlanos,
  atualizarPlanoDeCorte,
  adicionarPlanoDeCorte,
  excluirPlanoDeCorte,
  excluirProjectComPlanos,
} from '../controllers/cuttingPlansController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/',                               authenticate, listarProjectsComPlanos);
router.post('/',                              authenticate, criarProjectComPlanos);
router.get('/:id',                            authenticate, obterProjectComPlanos);
router.put('/:id',                            authenticate, atualizarProjectFixo);
router.post('/:id/clone',                     authenticate, clonarProjectComPlanos);
router.post('/:id/plans',                     authenticate, adicionarPlanoDeCorte);
router.put('/:projectId/plans/:planId',       authenticate, atualizarPlanoDeCorte);
router.delete('/:projectId/plans/:planId',    authenticate, excluirPlanoDeCorte);
router.delete('/:id',                         authenticate, excluirProjectComPlanos);

export default router;
