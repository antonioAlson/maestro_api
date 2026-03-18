import axios from 'axios';

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

    let allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    let total = 0;

    // Buscar todas as páginas
    do {
      console.log(`📄 Buscando issues - startAt: ${startAt}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        params: {
          jql: jql,
          startAt: startAt,
          maxResults: maxResults,
          fields: [
            'issuetype',
            'summary',
            'status',
            'customfield_10039',
            'customfield_11298',
            'customfield_10245'
          ].join(',')
        }
      });

      const issues = response.data.issues || [];
      total = response.data.total || 0;
      
      console.log(`✅ Recebidas ${issues.length} issues. Total no Jira: ${total}`);
      
      allIssues = [...allIssues, ...issues];
      startAt += maxResults;

    } while (startAt < total);

    console.log(`🎯 Total de issues coletadas: ${allIssues.length}`);

    // Situações válidas
    const situacoesValidas = [
      '⚪️RECEBIDO ENCAMINHADO',
      '🟢RECEBIDO LIBERADO',
      '⚫Aguardando entrada'
    ];

    // Processar e filtrar issues
    const processedData = [];
    
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

      // Filtrar situações
      if (!situacoesValidas.includes(situacao)) {
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

      // DATA PREVISÃO
      let previsao = '';
      const previsaoRaw = fields.customfield_10245;
      if (previsaoRaw) {
        try {
          const date = new Date(previsaoRaw);
          previsao = date.toLocaleDateString('pt-BR');
        } catch {
          previsao = previsaoRaw;
        }
      }

      // Extrair número do resumo (se houver)
      const resumoTexto = fields.summary || '';
      const numerosEncontrados = resumoTexto.match(/\d+/g);
      const resumoNumero = numerosEncontrados ? parseInt(numerosEncontrados[0], 10) : 0;

      processedData.push({
        key: key,
        resumo: resumoNumero,
        status: fields.status?.name || '',
        situacao: situacao,
        veiculo: veiculo,
        previsao: previsao
      });
    }

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
      // Se B tem marca e A não, B vem primeiro
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

    console.log('📡 URL:', url);
    console.log('📧 Email:', email);
    console.log('🔑 Token presente:', !!apiToken);

    let allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    let total = 0;

    // Buscar todas as páginas
    do {
      console.log(`📄 Buscando issues - startAt: ${startAt}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        params: {
          jql: jql,
          startAt: startAt,
          maxResults: maxResults,
          fields: [
            'issuetype',
            'summary',
            'status',
            'customfield_10039',
            'customfield_11298',
            'customfield_10245'
          ].join(',')
        }
      });

      const issues = response.data.issues || [];
      total = response.data.total || 0;
      
      console.log(`✅ Recebidas ${issues.length} issues. Total no Jira: ${total}`);
      
      allIssues = [...allIssues, ...issues];
      startAt += maxResults;

    } while (startAt < total);

    console.log(`🎯 Total de issues coletadas: ${allIssues.length}`);

    // Situações válidas
    const situacoesValidas = [
      '⚪️RECEBIDO ENCAMINHADO',
      '🟢RECEBIDO LIBERADO',
      '⚫Aguardando entrada'
    ];

    // Marcas CONTEC que devem ser filtradas
    const marcasContec = ['land rover', 'toyota', 'jaguar'];

    // Processar e filtrar issues
    const processedData = [];
    
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

      // Filtrar situações
      if (!situacoesValidas.includes(situacao)) {
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
        try {
          const date = new Date(previsaoRaw);
          previsao = date.toLocaleDateString('pt-BR');
        } catch {
          previsao = previsaoRaw;
        }
      }

      // Extrair número do resumo (se houver)
      const resumoTexto = fields.summary || '';
      const numerosEncontrados = resumoTexto.match(/\d+/g);
      const resumoNumero = numerosEncontrados ? parseInt(numerosEncontrados[0], 10) : 0;

      processedData.push({
        key: key,
        resumo: resumoNumero,
        status: fields.status?.name || '',
        situacao: situacao,
        veiculo: veiculo,
        previsao: previsao
      });
    }

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
