import express from 'express';
import multer from 'multer';
import { 
  getJiraIssues, 
  getContecIssues, 
  reprogramarEmMassa,
  atualizarDatasIndividuais,
  buscarArquivosPorIds,
  downloadArquivo,
  downloadArquivoJira,
  gerarEspelhos,
  obterLogsEspelhos,
  listarProjetosEspelhos,
  obterProjetoEspelho,
  obterEstatisticasProjetos
} from '../controllers/jiraController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

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

// Gerar espelho (aceita múltiplos arquivos)
router.post('/gerar-espelhos', authenticate, upload.array('arquivoProjeto[]', 10), gerarEspelhos);

// Obter logs de geração de espelhos
router.get('/logs-espelhos', authenticate, obterLogsEspelhos);

// NOVOS ENDPOINTS - Gestão de Projetos/Espelhos
// Listar projetos cadastrados
router.get('/projetos-espelhos', authenticate, listarProjetosEspelhos);

// Obter detalhes de um projeto específico
router.get('/projetos-espelhos/:id', authenticate, obterProjetoEspelho);

// Obter estatísticas dos projetos
router.get('/projetos-espelhos-stats', authenticate, obterEstatisticasProjetos);

export default router;
