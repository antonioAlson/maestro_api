import express from 'express';
import { 
  getJiraIssues, 
  getContecIssues, 
  reprogramarEmMassa,
  atualizarDatasIndividuais,
  buscarArquivosPorIds,
  downloadArquivo,
  downloadArquivoJira
} from '../controllers/jiraController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Buscar issues do Jira (requer autenticação)
router.get('/issues', authenticate, getJiraIssues);

// Buscar issues CONTEC (Land Rover, Toyota, Jaguar)
router.get('/contec', authenticate, getContecIssues);

// Reprogramar múltiplas issues em massa
router.post('/reprogramar-massa', authenticate, reprogramarEmMassa);

// Atualizar datas individuais (cada issue com data diferente)
router.post('/atualizar-datas-individuais', authenticate, atualizarDatasIndividuais);

// Buscar arquivos por IDs
router.post('/buscar-arquivos', authenticate, buscarArquivosPorIds);

// Download de arquivo específico
router.get('/download-arquivo/:cardId/:directory/*', authenticate, downloadArquivo);

// Download de anexo do Jira
router.get('/download-arquivo-jira/:cardId/:attachmentId/:filename', authenticate, downloadArquivoJira);

export default router;
