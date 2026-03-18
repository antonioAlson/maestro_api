import express from 'express';
import { getJiraIssues, getContecIssues, reprogramarEmMassa } from '../controllers/jiraController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Buscar issues do Jira (requer autenticação)
router.get('/issues', authenticate, getJiraIssues);

// Buscar issues CONTEC (Land Rover, Toyota, Jaguar)
router.get('/contec', authenticate, getContecIssues);

// Reprogramar múltiplas issues em massa
router.post('/reprogramar-massa', authenticate, reprogramarEmMassa);

export default router;
