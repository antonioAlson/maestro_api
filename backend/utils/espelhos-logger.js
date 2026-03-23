import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de log
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'espelhos-gerados.txt');

/**
 * Garante que o diretório de logs existe
 */
function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Formata data no padrão brasileiro
 */
function formatarData(date = new Date()) {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  const hora = String(date.getHours()).padStart(2, '0');
  const minuto = String(date.getMinutes()).padStart(2, '0');
  const segundo = String(date.getSeconds()).padStart(2, '0');
  
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}:${segundo}`;
}

/**
 * Registra uma operação de geração de espelhos
 * @param {Object} logData - Dados da operação
 * @param {string} logData.usuario - Nome ou email do usuário
 * @param {string[]} logData.cards - IDs dos cards processados
 * @param {boolean} logData.sucesso - Se a operação foi bem-sucedida
 * @param {number} logData.quantidadeGerada - Quantidade de espelhos gerados
 * @param {string} logData.erro - Mensagem de erro (se houver)
 * @param {boolean} logData.incluiuPdf - Se incluiu PDF do projeto
 * @param {Object} logData.detalhes - Detalhes adicionais
 */
export function registrarGeracaoEspelhos(logData) {
  try {
    ensureLogDirectory();

    const dataHora = formatarData();
    const usuario = logData.usuario || 'Usuário não identificado';
    const cards = Array.isArray(logData.cards) ? logData.cards : [];
    const sucesso = logData.sucesso === true;
    const quantidadeGerada = logData.quantidadeGerada || 0;
    const erro = logData.erro || null;
    const incluiuPdf = logData.incluiuPdf === true;
    const detalhes = logData.detalhes || {};

    // Monta o registro formatado
    const separador = '='.repeat(80);
    let registro = `\n${separador}\n`;
    registro += `DATA/HORA: ${dataHora}\n`;
    registro += `USUÁRIO: ${usuario}\n`;
    registro += `OPERAÇÃO: Geração de Espelhos\n`;
    registro += `\n`;
    
    // Cards processados
    registro += `CARDS PROCESSADOS: ${cards.length}\n`;
    if (cards.length > 0) {
      cards.forEach((cardId, index) => {
        registro += `  ${index + 1}. ${cardId}\n`;
      });
    }
    registro += `\n`;

    // Status da operação
    registro += `STATUS: ${sucesso ? '✓ SUCESSO' : '✗ FALHA'}\n`;
    if (sucesso) {
      registro += `ESPELHOS GERADOS: ${quantidadeGerada}\n`;
      registro += `PDF DO PROJETO INCLUÍDO: ${incluiuPdf ? 'Sim' : 'Não'}\n`;
    }
    
    if (erro) {
      registro += `\n`;
      registro += `ERRO:\n`;
      registro += `  ${erro}\n`;
    }

    // Detalhes adicionais
    if (Object.keys(detalhes).length > 0) {
      registro += `\n`;
      registro += `DETALHES ADICIONAIS:\n`;
      Object.entries(detalhes).forEach(([chave, valor]) => {
        registro += `  ${chave}: ${valor}\n`;
      });
    }

    registro += `${separador}\n`;

    // Adiciona ao arquivo (append)
    fs.appendFileSync(LOG_FILE, registro, 'utf8');

    console.log(`📝 Log registrado em: ${LOG_FILE}`);
  } catch (error) {
    console.error('❌ Erro ao registrar log de espelhos:', error.message);
    // Não propaga o erro para não impactar a operação principal
  }
}

/**
 * Obtém o conteúdo completo do arquivo de log
 */
export function obterLogsEspelhos() {
  try {
    ensureLogDirectory();
    
    if (!fs.existsSync(LOG_FILE)) {
      return '';
    }

    return fs.readFileSync(LOG_FILE, 'utf8');
  } catch (error) {
    console.error('❌ Erro ao ler logs de espelhos:', error.message);
    return '';
  }
}

/**
 * Limpa o arquivo de log (usar com cuidado)
 */
export function limparLogsEspelhos() {
  try {
    ensureLogDirectory();
    
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
      console.log('🗑️ Logs de espelhos limpos');
    }
  } catch (error) {
    console.error('❌ Erro ao limpar logs de espelhos:', error.message);
  }
}
