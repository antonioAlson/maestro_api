require("dotenv").config();

const axios = require("axios");
const cron = require("node-cron");
const dayjs = require("dayjs");
const { Pool } = require("pg");
let rodando = false;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "maestro",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
});

const JIRA_URL = process.env.JIRA_URL;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

const JQL = `project = MANTA AND status IN ("A Produzir", "Liberado Engenharia","Em Produção", "Produzido")`;


const client = axios.create({
  baseURL: `${JIRA_URL}/rest/api/3`,
  auth: {
    username: EMAIL,
    password: API_TOKEN,
  },
});

async function salvarOuAtualizar(issue) {
  const query = `
    INSERT INTO maestro.jira_cards (
      key,
      tipo,
      resumo,
      status,
      situacao,
      veiculo,
      previsao,
      last_updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (key)
    DO UPDATE SET
      tipo = EXCLUDED.tipo,
      resumo = EXCLUDED.resumo,
      status = EXCLUDED.status,
      situacao = EXCLUDED.situacao,
      veiculo = EXCLUDED.veiculo,
      previsao = EXCLUDED.previsao,
      last_updated_at = NOW();
  `;

  const values = [
    issue.key,
    issue.tipo,
    issue.resumo,
    issue.status,
    issue.situacao,
    issue.veiculo,
    issue.previsao || null,
  ];

  try {
    await pool.query(query, values);
  } catch (err) {
    console.error(`❌ Erro ao salvar ${issue.key}:`, err.message);
  }
}

async function buscarIssues(jql, nextPageToken = null) {
  const params = {
    jql,
    maxResults: 100,
    fields: "issuetype,summary,status,customfield_10039,customfield_11298,customfield_10245",
  };

  if (nextPageToken) {
    params.nextPageToken = nextPageToken;
  }
  const response = await client.get("/search/jql", { params });

  return response.data;
}

async function processar() {
  let nextPage = null;
  let total = 0;

  console.log("🚀 Sync iniciada...");

  try {
    do {
      const data = await buscarIssues(JQL, nextPage);
      const issues = data.issues || [];


      for (const issue of issues) {
        const fields = issue.fields || {};

        const key = issue.key;
        const tipo = fields.issuetype?.name || "";
        const resumo = fields.summary || "";
        const status = fields.status?.name || "";

        const situacaoRaw = fields.customfield_10039;
        const situacao =
          typeof situacaoRaw === "object"
            ? situacaoRaw?.value
            : situacaoRaw || "";

        const veiculoRaw = fields.customfield_11298;
        const veiculo =
          typeof veiculoRaw === "object"
            ? veiculoRaw?.value
            : veiculoRaw || "";

        const previsaoRaw = fields.customfield_10245;

        console.log(`🔎 Salvando ${key}`);

        await salvarOuAtualizar({
          key,
          tipo,
          resumo,
          status,
          situacao,
          veiculo,
          previsao: previsaoRaw,
        });

        total++;
      }

      nextPage = data.nextPageToken;
      if (data.isLast) break;

    } while (true);

    console.log(`🏁 Total sincronizado: ${total}`);

  } catch (err) {
    console.error("!---! Erro:", err.message);
  }
}

cron.schedule("*/5 * * * *", async () => {
  if (rodando) {
    console.log("⏳ Ainda em execução, pulando...");
    return;
  }

  rodando = true;

  console.log("\n⏰ Rodando sincronização...");
  await processar();
  rodando = false;
});

// execução inicial
processar();