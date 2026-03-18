import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function formatJiraDate(rawDate) {
  if (!rawDate) return '';

  const dateOnly = String(rawDate).split('T')[0];
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  return String(rawDate);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const BLOCKED_REPORT_STATUS = 'RECEBIDO NAO LIBERADO';

function normalizeCardId(value) {
  return String(value || '').trim().toUpperCase();
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sanitizeRelativePath(value) {
  return toPosixPath(String(value || '').trim())
    .replace(/^\/+/, '')
    .replace(/\.\.(\/|$)/g, '');
}

function findCardDirectories(entries, cardId) {
  const normalizedCardId = normalizeCardId(cardId);
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const exact = directories.filter((name) => normalizeCardId(name) === normalizedCardId);
  if (exact.length > 0) {
    return exact;
  }

  return directories.filter((name) => {
    const normalized = normalizeCardId(name);
    return normalized.startsWith(`${normalizedCardId} `)
      || normalized.startsWith(`${normalizedCardId}-`)
      || normalized.startsWith(`${normalizedCardId}_`)
      || normalized.includes(normalizedCardId);
  });
}

async function walkFiles(rootPath, currentRelative = '') {
  const currentPath = currentRelative ? path.join(rootPath, currentRelative) : rootPath;
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const relative = currentRelative ? path.join(currentRelative, entry.name) : entry.name;

    if (entry.isDirectory()) {
      const nested = await walkFiles(rootPath, relative);
      output.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      output.push(relative);
    }
  }

  return output;
}

function createServerBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function toLocalFileResult(req, cardId, dirName, relativeFilePath) {
  const baseUrl = createServerBaseUrl(req);
  const safeRelativePath = sanitizeRelativePath(relativeFilePath);
  const filename = path.basename(relativeFilePath);
  const ext = path.extname(filename).toLowerCase();

  return {
    url: `${baseUrl}/api/jira/download-arquivo/${encodeURIComponent(cardId)}/${encodeURIComponent(dirName)}/${encodeURIComponent(toPosixPath(safeRelativePath))}`,
    name: filename,
    cardId,
    extension: ext,
    isPdf: ext === '.pdf',
    source: 'local',
    relativePath: toPosixPath(path.join(dirName, safeRelativePath))
  };
}

function toJiraFileResult(req, cardId, attachment) {
  const baseUrl = createServerBaseUrl(req);
  const ext = path.extname(attachment.filename || '').toLowerCase();

  return {
    url: `${baseUrl}/api/jira/download-arquivo-jira/${encodeURIComponent(cardId)}/${encodeURIComponent(attachment.id)}/${encodeURIComponent(attachment.filename || 'arquivo')}`,
    name: attachment.filename,
    cardId,
    extension: ext,
    isPdf: ext === '.pdf',
    source: 'jira',
    size: attachment.size || 0,
    mimeType: attachment.mimeType || 'application/octet-stream'
  };
}

async function buscarArquivosNoJira(cardId, req) {
  const jiraUrl = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!jiraUrl || !email || !apiToken) {
    return [];
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url = `${jiraUrl}/rest/api/3/issue/${encodeURIComponent(cardId)}?fields=attachment`;

  try {
    const response = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`
      }
    });

    const attachments = response.data?.fields?.attachment;
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return [];
    }

    // Filtrar apenas PDFs
    return attachments
      .map((attachment) => toJiraFileResult(req, cardId, attachment))
      .filter((file) => file.isPdf);
  } catch (error) {
    // Retornar vazio silenciosamente para cards não encontrados
    if (error?.response?.status === 404) {
      return [];
    }
    // Log apenas para erros reais
    console.error(`❌ Jira erro: ${cardId}`);
    return [];
  }
}

function isBlockedReportStatus(statusName, situacao) {
  const normalizedStatus = normalizeText(statusName);
  const normalizedSituacao = normalizeText(situacao);

  return normalizedStatus.includes(BLOCKED_REPORT_STATUS)
    || normalizedSituacao.includes(BLOCKED_REPORT_STATUS);
}

/**
 * Busca issues do Jira com paginação
 */
export const getJiraIssues = async (req, res) => {
  try {
    console.log('🔍 Iniciando busca de issues do Jira...');

    const jiraUrl = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!jiraUrl || !email || !apiToken) {
      console.error('❌ Credenciais do Jira não configuradas');
      return res.status(500).json({
        success: false,
        message: 'Credenciais do Jira não configuradas no servidor'
      });
    }

    // Filtro JQL
    const jql = '(project = MANTA AND status IN ("A Produzir", "Liberado Engenharia")) OR (project = TENSYLON AND status IN ("A Produzir", "Liberado Engenharia", "Aguardando Acabamento", "Aguardando Autoclave", "Aguardando Corte", "Aguardando montagem"))';

    const url = `${jiraUrl}/rest/api/3/search/jql`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    console.log('📡 URL:', url);
    console.log('📧 Email:', email);
    console.log('🔑 Token presente:', !!apiToken);
    console.log('🔍 JQL:', jql);

    const situacoesValidas = [
      '⚪️RECEBIDO ENCAMINHADO',
      '🟢RECEBIDO LIBERADO',
      '⚫Aguardando entrada'
    ];

    let allIssues = [];
    let nextPageToken = null;
    let pageCount = 0;

    // Buscar todas as páginas via nextPageToken (mesma lógica do script Python)
    while (true) {
      pageCount++;
      console.log(`📄 [PÁGINA ${pageCount}] Buscando issues via nextPageToken...`);

      const params = {
        jql: jql,
        maxResults: 100,
        fields: [
          'issuetype',
          'summary',
          'status',
          'customfield_10039',
          'customfield_11298',
          'customfield_10245'
        ].join(',')
      };

      if (nextPageToken) {
        params.nextPageToken = nextPageToken;
      }

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        params
      });

      const issues = response.data.issues || [];
      const isLast = !!response.data.isLast;

      console.log(`✅ [PÁGINA ${pageCount}] Recebidas ${issues.length} issues`);
      console.log(`📊 [PÁGINA ${pageCount}] Acumuladas até agora: ${allIssues.length + issues.length}`);

      allIssues = [...allIssues, ...issues];

      if (isLast) {
        break;
      }

      nextPageToken = response.data.nextPageToken || null;
      if (!nextPageToken) {
        console.log('⚠️ nextPageToken ausente; encerrando paginação para evitar loop.');
        break;
      }
    }

    console.log(`✅ Paginação concluída! ${pageCount} páginas processadas`);
    console.log(`🎯 Total de issues coletadas: ${allIssues.length}`);

    // Processar issues com filtro de SITUAÇÃO (igual ao script de referência)
    const processedData = [];
    let skippedBySituacao = 0;
    
    for (const issue of allIssues) {
      const fields = issue.fields;
      const key = issue.key;

      // SITUAÇÃO
      let situacao = '';
      const situacaoRaw = fields.customfield_10039;
      if (situacaoRaw && typeof situacaoRaw === 'object' && situacaoRaw.value) {
        situacao = situacaoRaw.value;
      } else if (situacaoRaw) {
        situacao = situacaoRaw;
      }

      if (!situacoesValidas.includes(situacao)) {
        skippedBySituacao++;
        continue;
      }

      const statusName = fields.status?.name || '';

      // VEÍCULO
      let veiculo = '';
      const veiculoRaw = fields.customfield_11298;
      if (veiculoRaw && typeof veiculoRaw === 'object' && veiculoRaw.value) {
        veiculo = veiculoRaw.value;
      } else if (veiculoRaw) {
        veiculo = veiculoRaw;
      }

      // DATA PREVISÃO
      let previsao = '';
      const previsaoRaw = fields.customfield_10245;
      if (previsaoRaw) {
        previsao = formatJiraDate(previsaoRaw);
      }

      // Extrair número do resumo (se houver)
      const resumoTexto = fields.summary || '';
      const numerosEncontrados = resumoTexto.match(/\d+/g);
      const resumoNumero = numerosEncontrados ? parseInt(numerosEncontrados[0], 10) : 0;

      processedData.push({
        key: key,
        resumo: resumoNumero,
        status: statusName,
        situacao: situacao,
        veiculo: veiculo,
        previsao: previsao
      });
    }

    console.log(`⛔ Issues removidas por SITUAÇÃO fora da lista: ${skippedBySituacao}`);
    console.log(`✅ Issues filtradas: ${processedData.length}`);

    // Ordenar: priorizar veículos com marcas especiais (Land Rover, Toyota, Jaguar)
    const marcasDestaque = ['land rover', 'toyota', 'jaguar'];
    
    processedData.sort((a, b) => {
      const veiculoA = (a.veiculo || '').toLowerCase();
      const veiculoB = (b.veiculo || '').toLowerCase();
      
      const temMarcaA = marcasDestaque.some(marca => veiculoA.includes(marca));
      const temMarcaB = marcasDestaque.some(marca => veiculoB.includes(marca));
      
      // Se A tem marca e B não, A vem primeiro
      if (temMarcaA && !temMarcaB) return -1;
      // Se B tem marca e A não, B vem primei ro
      if (!temMarcaA && temMarcaB) return 1;
      
      // Se ambos têm ou ambos não têm marcas, ordenar alfabeticamente por veículo
      return veiculoA.localeCompare(veiculoB);
    });

    console.log(`🔄 Issues ordenadas (prioritárias no topo + ordem alfabética)`);

    return res.json({
      success: true,
      total: allIssues.length,
      filtered: processedData.length,
      data: processedData
    });

  } catch (error) {
    console.error('❌ Erro ao buscar issues do Jira:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do Jira: ' + error.message
    });
  }
};

/**
 * Busca issues do Jira apenas com marcas CONTEC (Land Rover, Toyota, Jaguar)
 */
export const getContecIssues = async (req, res) => {
  try {
    console.log('🔍 Iniciando busca de issues CONTEC do Jira...');

    const jiraUrl = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!jiraUrl || !email || !apiToken) {
      console.error('❌ Credenciais do Jira não configuradas');
      return res.status(500).json({
        success: false,
        message: 'Credenciais do Jira não configuradas no servidor'
      });
    }

    // Filtro JQL
    const jql = '(project = MANTA AND status IN ("A Produzir", "Liberado Engenharia")) OR (project = TENSYLON AND status IN ("A Produzir", "Liberado Engenharia", "Aguardando Acabamento", "Aguardando Autoclave", "Aguardando Corte", "Aguardando montagem"))';

    const url = `${jiraUrl}/rest/api/3/search/jql`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    console.log('📡 [CONTEC] URL:', url);
    console.log('📧 [CONTEC] Email:', email);
    console.log('🔑 [CONTEC] Token presente:', !!apiToken);
    console.log('🔍 [CONTEC] JQL:', jql);

    const situacoesValidas = [
      '⚪️RECEBIDO ENCAMINHADO',
      '🟢RECEBIDO LIBERADO',
      '⚫Aguardando entrada'
    ];

    let allIssues = [];
    let nextPageToken = null;
    let pageCount = 0;

    // Buscar todas as páginas via nextPageToken
    while (true) {
      pageCount++;
      console.log(`📄 [CONTEC PÁGINA ${pageCount}] Buscando issues via nextPageToken...`);

      const params = {
        jql: jql,
        maxResults: 100,
        fields: [
          'issuetype',
          'summary',
          'status',
          'customfield_10039',
          'customfield_11298',
          'customfield_10245'
        ].join(',')
      };

      if (nextPageToken) {
        params.nextPageToken = nextPageToken;
      }

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        params
      });

      const issues = response.data.issues || [];
      const isLast = !!response.data.isLast;

      console.log(`✅ [CONTEC PÁGINA ${pageCount}] Recebidas ${issues.length} issues`);
      console.log(`📊 [CONTEC PÁGINA ${pageCount}] Acumuladas até agora: ${allIssues.length + issues.length}`);

      allIssues = [...allIssues, ...issues];

      if (isLast) {
        break;
      }

      nextPageToken = response.data.nextPageToken || null;
      if (!nextPageToken) {
        console.log('⚠️ [CONTEC] nextPageToken ausente; encerrando paginação para evitar loop.');
        break;
      }
    }

    console.log(`✅ [CONTEC] Paginação concluída! ${pageCount} páginas processadas`);
    console.log(`🎯 [CONTEC] Total de issues coletadas: ${allIssues.length}`);

    // Marcas CONTEC que devem ser filtradas
    const marcasContec = ['land rover', 'toyota', 'jaguar'];

    // Processar e filtrar issues (SITUAÇÃO válida + marca CONTEC)
    const processedData = [];
    let skippedByStatus = 0;
    let skippedBySituacao = 0;
    
    for (const issue of allIssues) {
      const fields = issue.fields;
      const key = issue.key;

      // SITUAÇÃO
      let situacao = '';
      const situacaoRaw = fields.customfield_10039;
      if (situacaoRaw && typeof situacaoRaw === 'object' && situacaoRaw.value) {
        situacao = situacaoRaw.value;
      } else if (situacaoRaw) {
        situacao = situacaoRaw;
      }

      if (!situacoesValidas.includes(situacao)) {
        skippedBySituacao++;
        continue;
      }

      const statusName = fields.status?.name || '';

      if (isBlockedReportStatus(statusName, situacao)) {
        skippedByStatus++;
        continue;
      }

      // VEÍCULO
      let veiculo = '';
      const veiculoRaw = fields.customfield_11298;
      if (veiculoRaw && typeof veiculoRaw === 'object' && veiculoRaw.value) {
        veiculo = veiculoRaw.value;
      } else if (veiculoRaw) {
        veiculo = veiculoRaw;
      }

      // Filtrar apenas marcas CONTEC
      const veiculoLower = veiculo.toLowerCase();
      const temMarcaContec = marcasContec.some(marca => veiculoLower.includes(marca));
      
      if (!temMarcaContec) {
        continue; // Pular se não for marca CONTEC
      }

      // DATA PREVISÃO
      let previsao = '';
      const previsaoRaw = fields.customfield_10245;
      if (previsaoRaw) {
        previsao = formatJiraDate(previsaoRaw);
      }

      // Extrair número do resumo (se houver)
      const resumoTexto = fields.summary || '';
      const numerosEncontrados = resumoTexto.match(/\d+/g);
      const resumoNumero = numerosEncontrados ? parseInt(numerosEncontrados[0], 10) : 0;

      processedData.push({
        key: key,
        resumo: resumoNumero,
        status: statusName,
        situacao: situacao,
        veiculo: veiculo,
        previsao: previsao
      });
    }

    console.log(`⛔ [CONTEC] Issues removidas por status bloqueado: ${skippedByStatus}`);
    console.log(`⛔ [CONTEC] Issues removidas por SITUAÇÃO fora da lista: ${skippedBySituacao}`);
    console.log(`✅ Issues CONTEC filtradas: ${processedData.length}`);

    // Ordenar alfabeticamente por veículo
    processedData.sort((a, b) => {
      const veiculoA = (a.veiculo || '').toLowerCase();
      const veiculoB = (b.veiculo || '').toLowerCase();
      return veiculoA.localeCompare(veiculoB);
    });

    console.log(`🔄 Issues CONTEC ordenadas alfabeticamente`);

    return res.json({
      success: true,
      total: allIssues.length,
      filtered: processedData.length,
      data: processedData
    });

  } catch (error) {
    console.error('❌ Erro ao buscar issues CONTEC do Jira:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados CONTEC do Jira: ' + error.message
    });
  }
};

/**
 * Reprograma múltiplas issues do Jira com nova data de previsão
 */
export const reprogramarEmMassa = async (req, res) => {
  console.log('🎯 ============================================');
  console.log('🎯 ENDPOINT /reprogramar-massa INICIADO');
  console.log('🎯 ============================================');
  
  try {
    console.log('🚀 Iniciando reprogramação em massa...');

    const JIRA_UPDATE_TIMEOUT_MS = 45000; // 45 segundos por card

    const { ids, date } = req.body;
    
    console.log('📦 Body recebido:', { ids, date });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de IDs é obrigatória e deve ser um array não vazio'
      });
    }

    // Data pode ser null para limpar o campo no Jira
    const dateValue = date || null;

    const jiraUrl = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    const campoPrevisao = 'customfield_10245';

    if (!jiraUrl || !email || !apiToken) {
      console.error('❌ Credenciais do Jira não configuradas');
      return res.status(500).json({
        success: false,
        message: 'Credenciais do Jira não configuradas no servidor'
      });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    console.log('📅 Nova previsão:', dateValue === null ? '(LIMPAR CAMPO)' : dateValue);
    console.log('📋 IDs para atualizar:', ids.length);
    ids.forEach(id => console.log(`   • ${id}`));

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Atualizar cada issue
    for (const issueId of ids) {
      try {
        console.log(`🔄 Processando ${issueId}...`);
        const url = `${jiraUrl}/rest/api/3/issue/${issueId}`;
        
        const response = await axios.put(
          url,
          {
            fields: {
              [campoPrevisao]: dateValue
            }
          },
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`
            },
            timeout: JIRA_UPDATE_TIMEOUT_MS
          }
        );

        if (response.status === 204 || response.status === 200) {
          successCount++;
          const msg = dateValue ? `atualizado para ${dateValue}` : 'data limpa';
          console.log(`✅ ${issueId} ${msg}`);
          results.push({
            id: issueId,
            success: true,
            message: dateValue ? `Atualizado para ${dateValue}` : 'Data limpa'
          });
        } else {
          errorCount++;
          console.log(`❌ ${issueId} falhou (${response.status})`);
          results.push({
            id: issueId,
            success: false,
            message: `Falhou com status ${response.status}`
          });
        }
      } catch (error) {
        errorCount++;
        const errorMessage =
          error.code === 'ECONNABORTED'
            ? `Timeout ao atualizar issue após ${JIRA_UPDATE_TIMEOUT_MS / 1000}s`
            : (error.response?.data?.errorMessages?.join(', ') || error.message);
        console.log(`❌ ${issueId} erro: ${errorMessage}`);
        results.push({
          id: issueId,
          success: false,
          message: errorMessage
        });
      }
    }

    console.log('='.repeat(60));
    console.log('REPROGRAMAÇÃO FINALIZADA');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log('='.repeat(60));

    const responseData = {
      success: true,
      message: `Reprogramação concluída: ${successCount} sucesso, ${errorCount} erros`,
      data: {
        successCount,
        errorCount,
        total: ids.length,
        results
      }
    };

    console.log('📤 [RESPONSE] Preparando resposta...');
    console.log('📦 [RESPONSE] Dados:', JSON.stringify(responseData, null, 2));
    console.log('📡 [RESPONSE] Enviando HTTP 200...');
    
    res.status(200).json(responseData);
    
    console.log('✅ [RESPONSE] Resposta enviada com sucesso ao cliente!');
    console.log('🎯 ============================================');
    console.log('🎯 ENDPOINT /reprogramar-massa FINALIZADO');
    console.log('🎯 ============================================');

  } catch (error) {
    console.error('❌ [ERROR] Erro na reprogramação em massa:', error);
    console.error('❌ [ERROR] Stack:', error.stack);
    
    const errorResponse = {
      success: false,
      message: 'Erro ao reprogramar issues: ' + error.message
    };
    
    console.log('📤 [ERROR] Enviando resposta de erro...');
    res.status(500).json(errorResponse);
    console.log('📤 [ERROR] Resposta de erro enviada');
  }
};

/**
 * Busca todos os PDFs por IDs dos cards (filtrados por extensão .pdf)
 */
export const buscarArquivosPorIds = async (req, res) => {
  console.log('🔍 ============================================');
  console.log('🔍 ENDPOINT /buscar-arquivos (PDFs) INICIADO');
  console.log('🔍 ============================================');
  
  try {
    const { ids } = req.body;
    
    console.log('📦 Body recebido:', { ids });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lista de IDs é obrigatória e deve ser um array não vazio'
      });
    }

    // Diretório base onde estão os arquivos locais
    const basePdfPath = process.env.PDF_BASE_PATH || 'C:\\OPs';
    console.log(`📁 Buscando PDFs para ${ids.length} cards em: ${basePdfPath}`);
    
    const foundFiles = [];
    const startTime = Date.now();

    let basePathEntries = null;
    try {
      basePathEntries = await fs.promises.readdir(basePdfPath, { withFileTypes: true });
    } catch (error) {
      console.log('⚠️ Diretório local não acessível. Busca apenas no Jira.');
    }

    // Buscar arquivos para cada ID em paralelo (local + Jira)
    const searchPromises = ids.map(async (cardId) => {
      try {
        let localFiles = [];
        if (basePathEntries) {
          const matchingDirs = findCardDirectories(basePathEntries, cardId);

          if (matchingDirs.length > 0) {
            for (const dirName of matchingDirs) {
              const absoluteDir = path.join(basePdfPath, dirName);
              const files = await walkFiles(absoluteDir);
              files.forEach((relativeFile) => {
                const fileResult = toLocalFileResult(req, cardId, dirName, relativeFile);
                // Filtrar apenas PDFs
                if (fileResult.isPdf) {
                  localFiles.push(fileResult);
                }
              });
            }
          }
        }

        const jiraFiles = await buscarArquivosNoJira(cardId, req);

        const dedupeMap = new Map();
        [...localFiles, ...jiraFiles].forEach((file) => {
          const key = `${normalizeCardId(file.cardId)}|${normalizeCardId(file.name)}|${file.size || 0}`;
          if (!dedupeMap.has(key)) {
            dedupeMap.set(key, file);
          }
        });

        return Array.from(dedupeMap.values());
      } catch (error) {
        console.error(`❌ Erro: ${cardId} - ${error.message}`);
        return [];
      }
    });

    // Aguardar todas as buscas em paralelo
    const results = await Promise.all(searchPromises);
    results.forEach(files => foundFiles.push(...files));

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⚡ Busca concluída: ${foundFiles.length} PDFs encontrados em ${elapsedTime}s`);

    const responseData = {
      success: true,
      count: foundFiles.length,
      files: foundFiles
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [ERROR] Erro ao buscar PDFs:', error);
    console.error('❌ [ERROR] Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar PDFs: ' + error.message
    });
  }
};

/**
 * Faz download de um arquivo específico
 */
export const downloadArquivo = async (req, res) => {
  try {
    const { cardId, directory } = req.params;
    const rawRelativeFilePath = req.params[0] || '';
    const safeRelativePath = sanitizeRelativePath(decodeURIComponent(rawRelativeFilePath));
    const safeDirectory = decodeURIComponent(directory || '');
    
    console.log(`📥 Download solicitado: ${cardId}/${safeDirectory}/${safeRelativePath}`);

    const basePdfPath = process.env.PDF_BASE_PATH || 'C:\\OPs';
    const filePath = path.join(basePdfPath, safeDirectory, safeRelativePath);

    console.log(`📁 Caminho completo: ${filePath}`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado');
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    // Enviar arquivo
    console.log('✅ Enviando arquivo...');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('❌ Erro ao enviar arquivo:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erro ao enviar arquivo'
          });
        }
      } else {
        console.log('✅ Arquivo enviado com sucesso');
      }
    });

  } catch (error) {
    console.error('❌ Erro ao fazer download do arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer download: ' + error.message
    });
  }
};

/**
 * Faz proxy de download de anexo do Jira
 */
export const downloadArquivoJira = async (req, res) => {
  try {
    const { cardId, attachmentId, filename } = req.params;
    const jiraUrl = process.env.JIRA_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!jiraUrl || !email || !apiToken) {
      return res.status(500).json({
        success: false,
        message: 'Credenciais do Jira não configuradas no servidor'
      });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const issueUrl = `${jiraUrl}/rest/api/3/issue/${encodeURIComponent(cardId)}?fields=attachment`;

    const issueResponse = await axios.get(issueUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`
      }
    });

    const attachments = issueResponse.data?.fields?.attachment || [];
    const target = attachments.find((item) => String(item.id) === String(attachmentId));

    if (!target?.content) {
      return res.status(404).json({
        success: false,
        message: 'Anexo não encontrado no Jira'
      });
    }

    const fileResponse = await axios.get(target.content, {
      responseType: 'stream',
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    const downloadName = target.filename || decodeURIComponent(filename || 'arquivo');
    const contentType = target.mimeType || fileResponse.headers['content-type'] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    fileResponse.data.pipe(res);
  } catch (error) {
    console.error('❌ Erro ao baixar anexo do Jira:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao baixar anexo do Jira: ' + error.message
    });
  }
};