import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MATERIAL_COLORS = {
  ARAMIDA: rgb(1, 0.84, 0.62),     // amarelo
  TENSYLON: rgb(0.65, 0.85, 1),    // azul claro (exemplo)
};

async function getUserJiraCredentials(userId) {
  const result = await pool.query(
    'SELECT email, api_token FROM maestro.users WHERE id = $1',
    [userId]
  );
  if (!result.rows.length) throw new Error('Usuário não encontrado');
  const { email, api_token } = result.rows[0];
  if (!email || !api_token) throw new Error('Credenciais do Jira não configuradas para este usuário.');
  return { email, apiToken: api_token };
}

async function fetchJiraCards(email, apiToken) {
  const jiraUrl = process.env.JIRA_URL;
  if (!jiraUrl) return [];

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const jql = `(project = MANTA AND "fábrica de manta[dropdown]" = "CARBON OPACO" AND status IN ("A Produzir", "Liberado Engenharia")) OR (project = TENSYLON AND status IN ("A Produzir", "Liberado Engenharia", "Aguardando Acabamento", "Aguardando Autoclave", "Aguardando Corte", "Aguardando montagem", "🔴RECEBIDO NÃO LIBERADO"))`;
  const fieldsStr = 'summary,status,customfield_11298,customfield_10245,customfield_11353';

  let allIssues = [];
  let nextPageToken = null;

  do {
    const params = { jql, maxResults: 100, fields: fieldsStr };
    if (nextPageToken) params.nextPageToken = nextPageToken;

    const resp = await axios.get(`${jiraUrl}/rest/api/3/search/jql`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      params,
    });

    allIssues = [...allIssues, ...(resp.data.issues || [])];
    nextPageToken = resp.data.isLast ? null : (resp.data.nextPageToken || null);
  } while (nextPageToken);

  return allIssues.map(issue => {
    const f = issue.fields;
    const npRaw = f.customfield_11353;
    let numeroProjeto = '';
    if (npRaw && typeof npRaw === 'object' && npRaw.value) {
      numeroProjeto = String(npRaw.value).trim();
    } else if (npRaw) {
      numeroProjeto = String(npRaw).trim();
    }
    if (!numeroProjeto) {
      const m = String(f.summary || '').match(/([A-Z]{2,}-\d+)/);
      numeroProjeto = m ? m[0].toUpperCase() : '';
    }
    const osMatch = String(f.summary || '').match(/(\d{3,10})/g);
    return {
      key: issue.key,
      resumo: f.summary || '',
      veiculo: f.customfield_11298 || '',
      previsao: f.customfield_10245 || '',
      numeroProjeto,
      osNumber: osMatch ? osMatch[osMatch.length - 1] : '',
    };
  });
}

async function fetchDbProjects() {
  const { rows } = await pool.query(`
    SELECT
      p.id, p.project, p.material_type, p.brand, p.model, p.roof_config,
      p.total_parts_qty, p.lid_parts_qty, p.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id',              cp.id,
            'plate_width',     cp.plate_width,
            'plate_height',    cp.plate_height,
            'square_meters',   cp.square_meters,
            'linear_meters',   cp.linear_meters,
            'plate_consumption', cp.plate_consumption,
            'reviews',         cp.reviews,
            'attachments', (
              SELECT COALESCE(
                json_agg(json_build_object(
                  'type', cpa.type,
                  'file', json_build_object(
                    'id',            fs.id,
                    'original_name', fs.original_name,
                    'mime_type',     fs.mime_type
                  )
                )),
                '[]'::json
              )
              FROM maestro.cutting_plan_attachment cpa
              JOIN maestro.file_storage fs ON fs.id = cpa.file_id
              WHERE cpa.cutting_plan_id = cp.id
            )
          ) ORDER BY cp.id
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'::json
      ) AS cutting_plans
    FROM maestro.project p
    LEFT JOIN maestro.cutting_plan cp ON cp.project_id = p.id
    GROUP BY p.id
    ORDER BY p.id DESC
  `);
  return rows;
}

function classifyProject(project) {
  const plans = project.cutting_plans || [];
  if (!plans.length) {
    return { status: 'pending', issues: ['NO_ATTACHMENT', 'NO_LABELING', 'NO_CUTTING'] };
  }
  const issueSet = new Set();
  for (const plan of plans) {
    const reviews = plan.reviews || {};
    const attachments = Array.isArray(plan.attachments) ? plan.attachments : [];
    if (!attachments.some(a => a.type === 'infoproject')) issueSet.add('NO_ATTACHMENT');
    if (!reviews.labeling) issueSet.add('NO_LABELING');
    if (!reviews.cutting) issueSet.add('NO_CUTTING');
  }
  return issueSet.size === 0
    ? { status: 'ready', issues: [] }
    : { status: 'pending', issues: [...issueSet] };
}

// GET /api/mirrors/projects
export const getProjects = async (req, res) => {
  try {
    const dbProjects = await fetchDbProjects();

    let jiraCards = [];
    try {
      const { email, apiToken } = await getUserJiraCredentials(req.user.id);
      jiraCards = await fetchJiraCards(email, apiToken);
    } catch (err) {
      console.warn('⚠️ Jira indisponível:', err.message);
    }

    const dbMap = new Map(
      dbProjects.filter(p => p.project).map(p => [String(p.project).trim().toUpperCase(), p])
    );

    const ready = [];
    const missing = [];
    const pending = [];
    const matchedIds = new Set();

    for (const card of jiraCards) {
      const key = String(card.numeroProjeto || '').trim().toUpperCase();
      if (!key || key === '-') continue;

      const dbProj = dbMap.get(key);
      if (!dbProj) {
        missing.push(card);
        continue;
      }

      matchedIds.add(dbProj.id);
      const { status, issues } = classifyProject(dbProj);
      const item = { ...dbProj, jiraKey: card.key, osNumber: card.osNumber, veiculo: card.veiculo };
      if (status === 'ready') ready.push(item);
      else pending.push({ ...item, issues });
    }

    for (const p of dbProjects) {
      if (matchedIds.has(p.id)) continue;
      const { status, issues } = classifyProject(p);
      const item = { ...p, jiraKey: null, osNumber: null, veiculo: null };
      if (status === 'ready') ready.push(item);
      else pending.push({ ...item, issues });
    }

    return res.json({ success: true, data: { ready, missing, pending } });
  } catch (error) {
    console.error('❌ getProjects:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/mirrors/generate-os
export const generateOS = async (req, res) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects) || !projects.length) {
      return res.status(400).json({ success: false, message: '"projects" array é obrigatório.' });
    }

    const ids = projects.map(p => Number(p.id)).filter(id => Number.isFinite(id) && id > 0);
    if (!ids.length) return res.status(400).json({ success: false, message: 'IDs inválidos.' });

    const { rows } = await pool.query(`
      SELECT
        p.id, p.project, p.material_type, p.brand, p.model, p.roof_config, p.total_parts_qty,
        COALESCE(
          json_agg(
            json_build_object(
              'id',              cp.id,
              'plate_width',     cp.plate_width,
              'plate_height',    cp.plate_height,
              'square_meters',   cp.square_meters,
              'linear_meters',   cp.linear_meters,
              'plate_consumption', cp.plate_consumption,
              'attachments', (
                SELECT COALESCE(
                  json_agg(json_build_object(
                    'type', cpa.type,
                    'file', json_build_object(
                      'id',   fs.id,
                      'name', fs.original_name,
                      'path', fs.path
                    )
                  )),
                  '[]'::json
                )
                FROM maestro.cutting_plan_attachment cpa
                JOIN maestro.file_storage fs ON fs.id = cpa.file_id
                WHERE cpa.cutting_plan_id = cp.id
              )
            ) ORDER BY cp.id
          ) FILTER (WHERE cp.id IS NOT NULL),
          '[]'::json
        ) AS cutting_plans
      FROM maestro.project p
      LEFT JOIN maestro.cutting_plan cp ON cp.project_id = p.id
      WHERE p.id = ANY($1::int[])
      GROUP BY p.id
      ORDER BY p.id
    `, [ids]);

    for (const proj of rows) {
      const hasInfoProject = (proj.cutting_plans || []).some(plan =>
        (plan.attachments || []).some(a => a.type === 'infoproject')
      );
      if (!hasInfoProject) {
        return res.status(422).json({
          success: false,
          message: `Projeto "${proj.project}" não possui InfoProject anexado.`,
        });
      }
    }

    const metaMap = new Map(projects.map(p => [Number(p.id), { osNumber: String(p.os_number || '') }]));
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < rows.length; i++) {
      const proj = rows[i];
      const meta = metaMap.get(proj.id) || {};
      await appendFirstPage(mergedPdf, proj, meta, i + 1);
      await appendInfoProjectPages(mergedPdf, proj);
      await appendLastPage(mergedPdf, proj);
    }

    const pdfBytes = await mergedPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OS-${Date.now()}.pdf"`);
    return res.end(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('❌ generateOS:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PDF helpers ────────────────────────────────────────────────────────────

async function appendFirstPage(mergedPdf, project, meta, packageNumber) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const backendRoot = path.join(__dirname, '..');
  const footerCandidates = [
    path.join(backendRoot, 'scripts', 'projetos', 'logo-footer.png'),
    path.join(backendRoot, 'scripts', 'projetos', 'footer.png'),
  ];
  const footerPath = footerCandidates.find(c => fs.existsSync(c));
  const topLogoPath = path.join(backendRoot, 'scripts', 'projetos', 'logo.png');

  const marginLeft = 58;
  const isTensylonProject = String(project.material_type || '').toUpperCase() === 'TENSYLON';

  // ── Logo topo central ──────────────────────────────────────────────────────
  let yPos = height - 100;
  if (fs.existsSync(topLogoPath)) {
    try {
      let logoBytes = await fs.promises.readFile(topLogoPath);
      if (logoBytes.toString('utf8', 0, 8).startsWith('iVBORw0K')) {
        logoBytes = Buffer.from(logoBytes.toString('utf8'), 'base64');
      }
      const logoImg = await doc.embedPng(logoBytes);
      const logoW = 130;
      const logoH = (logoImg.height / logoImg.width) * logoW;
      page.drawImage(logoImg, { x: (width - logoW) / 2, y: yPos - 10, width: logoW, height: logoH });
      yPos -= 18;
    } catch {
      page.drawText('OPERA', { x: width / 2 - 30, y: yPos, size: 16, font: fontBold, color: rgb(0.4, 0.6, 0.8) });
      yPos -= 15;
      page.drawText('Armouring Materials', { x: width / 2 - 45, y: yPos, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    }
  } else {
    page.drawText('OPERA', { x: width / 2 - 30, y: yPos, size: 16, font: fontBold, color: rgb(0.4, 0.6, 0.8) });
    yPos -= 15;
    page.drawText('Armouring Materials', { x: width / 2 - 45, y: yPos, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // ── "Pacote N - Kit" top right ─────────────────────────────────────────────
  const pkgLabel = `Pacote ${packageNumber} - ${'Kit'}`;
  const pkgW = fontBold.widthOfTextAtSize(pkgLabel, 10);
  page.drawText(pkgLabel, {
    x: width - marginLeft - pkgW,
    y: height - 45,
    size: 10,
    font: fontBold,
    color: rgb(0.16, 0.44, 0.72),
  });

  // ── Badge do material (Aramida / Tensylon) ─────────────────────────────────
  const tituloMaterial = isTensylonProject ? 'Tensylon' : 'Aramida';
  const titleSize = 21;
  const titleW = fontBold.widthOfTextAtSize(tituloMaterial, titleSize);
  const titleX = width / 2 - titleW / 2;
  yPos -= 50;
  page.drawRectangle({
    x: titleX - 8, y: yPos - 4,
    width: titleW + 16, height: titleSize + 7,
    color: rgb(1, 0.95, 0.2),
  });
  page.drawText(tituloMaterial, { x: titleX, y: yPos, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });

  // ── Helper: texto centrado numa caixa ─────────────────────────────────────
  const drawCentered = (text, bx, by, bw, bh, size, useBold, color) => {
    const f = useBold ? fontBold : font;
    const v = String(text || '');
    const tw = f.widthOfTextAtSize(v, size);
    page.drawText(v, { x: bx + (bw - tw) / 2, y: by + (bh - size) / 2 + 2, size, font: f, color });
  };

  // ── Campos do documento ────────────────────────────────────────────────────
  yPos -= 60;
  const lineHeight = 45;
  const fieldSize = 16;

  const fields = [
    ['Modelo:', project.model || '-'],
    ['Kit:', project.brand || '-'],
    ['Tipo de teto:', project.roof_config || '-'],
    ['Projeto:', project.project || '-'],
    ['Data:', new Date().toLocaleDateString('pt-BR')],
    ['Quantidade de peças:', String(project.total_parts_qty || '-')],
    ['OS:', meta.osNumber || '-'],
  ];

  // Agregar square_meters de todos os planos (primeiro valor não-vazio por chave)
  const sqm = {};
  for (const plan of (project.cutting_plans || [])) {
    for (const [k, v] of Object.entries(plan.square_meters || {})) {
      if (v && String(v).trim() && sqm[k] === undefined) sqm[k] = String(v).trim();
    }
  }

  for (const [label, value] of fields) {
    page.drawText(label, { x: marginLeft, y: yPos, size: fieldSize, font: fontBold, color: rgb(0, 0, 0) });
    const lw = fontBold.widthOfTextAtSize(label, fieldSize);
    page.drawText(String(value), { x: marginLeft + lw + 6, y: yPos, size: fieldSize, font, color: rgb(0, 0, 0) });
    yPos -= lineHeight;

    // Tabela de consumo logo após o campo OS: (apenas Aramida)
    if (label === 'OS:' && !isTensylonProject) {
      const consumoKeys = ['8C', '9C', '11C'];
      const consumoColors = [rgb(0.08, 0.08, 0.95), rgb(0.1, 0.45, 0.13), rgb(0.95, 0.05, 0.05)];
      const tableW = Math.min((width - marginLeft * 2) * 0.88, 520);
      const colW = tableW / 3;
      const hdrH = 30;
      const valH = 26;
      const labelY = yPos - 6;
      const tableTopY = labelY - 10 - hdrH;

      page.drawText('Consumo (m²):', { x: marginLeft, y: labelY, size: fieldSize, font: fontBold, color: rgb(0, 0, 0) });

      for (let i = 0; i < 3; i++) {
        const cx = marginLeft + i * colW;
        page.drawRectangle({ x: cx, y: tableTopY, width: colW, height: hdrH, color: consumoColors[i], borderColor: rgb(0, 0, 0), borderWidth: 1 });
        drawCentered(consumoKeys[i], cx, tableTopY, colW, hdrH, 14, false, rgb(1, 1, 1));
      }

      const valY = tableTopY - valH;
      for (let i = 0; i < 3; i++) {
        const cx = marginLeft + i * colW;
        page.drawRectangle({ x: cx, y: valY, width: colW, height: valH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 });
        drawCentered(sqm[consumoKeys[i]] || '', cx, valY, colW, valH, 13, false, rgb(0, 0, 0));
      }

      yPos = valY - 18;
    }
  }

  // ── QR code ────────────────────────────────────────────────────────────────
  const qrPayload = [project.model, project.roof_config, project.project, meta.osNumber]
    .filter(v => String(v || '').trim()).join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload || project.project || '', { margin: 1, width: 300 });
  const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImg = await doc.embedPng(qrBytes);

  yPos -= 30;
  const qrSize = 92;
  const qrX = width / 2 - qrSize / 2;
  const qrY = yPos - qrSize;

  // ── Footer (background image) ──────────────────────────────────────────────
  if (footerPath) {
    try {
      let fBytes = await fs.promises.readFile(footerPath);
      if (fBytes.toString('utf8', 0, 8).startsWith('iVBORw0K')) {
        fBytes = Buffer.from(fBytes.toString('utf8'), 'base64');
      }
      const fImg = await doc.embedPng(fBytes);
      const fH = (fImg.height / fImg.width) * width;
      page.drawImage(fImg, { x: 0, y: 0, width, height: fH, opacity: 0.9 });
    } catch { /* sem imagem de rodapé */ }
  }

  // ── Footer texto ───────────────────────────────────────────────────────────
  const footerY = 80;
  ['Avenida Tucunaré 421', 'Tamboré • Barueri – SP', 'CEP 06460-020', '+55 11 0000 0000', 'www.operacomposite.com']
    .forEach((line, i) => page.drawText(line, { x: marginLeft - 28, y: footerY - i * 10, size: 7, font, color: rgb(0.36, 0.36, 0.36) }));

  // ── Ícones sociais ─────────────────────────────────────────────────────────
  const iconFill = rgb(0.08, 0.36, 0.56);
  const iconsY = footerY - 56;
  const iconStartX = marginLeft - 21;
  [{ label: 'IG', size: 5.2 }, { label: 'f', size: 8.5 }, { label: 'YT', size: 4.8 }, { label: 'in', size: 5.6 }]
    .forEach(({ label, size }, idx) => {
      const cx = iconStartX + idx * 20;
      page.drawCircle({ x: cx, y: iconsY, size: 7, color: iconFill });
      const tw = fontBold.widthOfTextAtSize(label, size);
      page.drawText(label, { x: cx - tw / 2, y: iconsY - size / 3, size, font: fontBold, color: rgb(1, 1, 1) });
    });

  // ── QR sobreposto (desenhado por último) ───────────────────────────────────
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const revText = 'FO 21.1 - REV. 1';
  const revW = font.widthOfTextAtSize(revText, 7);
  page.drawText(revText, { x: qrX + qrSize / 2 - revW / 2, y: qrY - 12, size: 7, font, color: rgb(0.42, 0.42, 0.42) });

  const built = await PDFDocument.load(await doc.save());
  const [copied] = await mergedPdf.copyPages(built, [0]);
  mergedPdf.addPage(copied);
}

async function appendInfoProjectPages(mergedPdf, project) {
  for (const plan of project.cutting_plans || []) {
    const infoAtt = (plan.attachments || []).find(a => a.type === 'infoproject');
    if (!infoAtt?.file?.path || !fs.existsSync(infoAtt.file.path)) continue;
    try {
      const bytes = await fs.promises.readFile(infoAtt.file.path);
      const infoPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await mergedPdf.copyPages(infoPdf, infoPdf.getPageIndices());
      copied.forEach(p => mergedPdf.addPage(p));
    } catch (err) {
      console.warn('⚠️ InfoProject merge skipped:', err.message);
    }
  }
}

async function appendLastPage(mergedPdf, project) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const marginLeft = 58;

  const backendRoot = path.join(__dirname, '..');
  const topLogoPath = path.join(backendRoot, 'scripts', 'projetos', 'logo.png');

  const footerCandidates = [
    path.join(backendRoot, 'scripts', 'projetos', 'logo-footer.png'),
    path.join(backendRoot, 'scripts', 'projetos', 'footer.png'),
  ];
  const footerPath = footerCandidates.find(c => fs.existsSync(c));

  const isTensylon = String(project.material_type || '').toUpperCase() === 'TENSYLON';
  const materialLabel = isTensylon ? 'Tensylon' : 'Aramida';

  let y = height - 80;

  // ───── LOGO
  if (fs.existsSync(topLogoPath)) {
    try {
      const logoBytes = await fs.promises.readFile(topLogoPath);
      const logoImg = await doc.embedPng(logoBytes);

      const logoW = 120;
      const logoH = (logoImg.height / logoImg.width) * logoW;

      page.drawImage(logoImg, {
        x: (width - logoW) / 2,
        y: height - 100,
        width: logoW,
        height: logoH,
      });

      y -= 40;
    } catch {
      page.drawText('OPERA', {
        x: width / 2 - 30,
        y: height - 80,
        size: 14,
        font: fontBold,
      });
    }
  }

  // ───── HEADER DIREITA
  page.drawText('Pacote 2 - Tampa', {
    x: width - 180,
    y: height - 50,
    size: 10,
    font,
    color: rgb(0.2, 0.4, 0.6),
  });

  y -= 50;

  // ───── MATERIAL (central)
  const matSize = 18;
  const matWidth = fontBold.widthOfTextAtSize(materialLabel, matSize);
  const matX = width / 2 - matWidth / 2;

  page.drawRectangle({
    x: matX - 12,
    y: y - 6,
    width: matWidth + 26,
    height: matSize + 10,
    color: rgb(1, 1, 0),
  });

  page.drawText(materialLabel, {
    x: matX,
    y,
    size: matSize + 2,
    font: fontBold,
  });

  y -= 60;

  // ───── TAG (retângulo azul ajustado)
  page.drawRectangle({
    x: marginLeft,
    y: y - 4,
    width: 145,
    height: 22,
    color: rgb(0.1, 0.1, 0.5),
  });
  page.drawText('Tampa traseira', {
    x: marginLeft + 6, y,
    size: matSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  }
  ); y -= 45;

  // ───── INFOS
  const info = [
    ['Modelo:', project.model],
    ['Projeto:', project.project],
    ['Quantidade:', project.total_parts_qty],
  ];

  const labelSize = 16;
  const lineGap = 32;
  const spacing = 6; // espaço entre label e valor

  for (const [label, value] of info) {
    // desenha label
    page.drawText(label, {
      x: marginLeft,
      y,
      size: labelSize,
      font: fontBold,
    });

    // calcula largura do label
    const labelWidth = fontBold.widthOfTextAtSize(label, labelSize);

    // desenha valor logo após o label
    page.drawText(String(value || '-'), {
      x: marginLeft + labelWidth + spacing,
      y,
      size: labelSize,
      font,
    });

    y -= lineGap;
  }

  // ───── FOOTER (imagem)
  if (footerPath) {
    try {
      let fBytes = await fs.promises.readFile(footerPath);

      if (fBytes.toString('utf8', 0, 8).startsWith('iVBORw0K')) {
        fBytes = Buffer.from(fBytes.toString('utf8'), 'base64');
      }

      const fImg = await doc.embedPng(fBytes);
      const fH = (fImg.height / fImg.width) * width;

      page.drawImage(fImg, {
        x: 0,
        y: 0,
        width,
        height: fH,
        opacity: 0.9,
      });
    } catch { }
  }

  // ───── TEXTOS FOOTER
  const footerY = 80;

  [
    'Avenida Tucunaré 421',
    'Tamboré • Barueri – SP',
    'CEP 06460-020',
    '+55 11 0000 0000',
    'www.operacomposite.com'
  ].forEach((line, i) => {
    page.drawText(line, {
      x: marginLeft - 28,
      y: footerY - i * 10,
      size: 7,
      font,
      color: rgb(0.36, 0.36, 0.36),
    });
  });

  // ───── ÍCONES SOCIAIS
  const iconFill = rgb(0.08, 0.36, 0.56);
  const iconsY = footerY - 56;
  const iconStartX = marginLeft - 21;

  [
    { label: 'IG', size: 5.2 },
    { label: 'f', size: 8.5 },
    { label: 'YT', size: 4.8 },
    { label: 'in', size: 5.6 }
  ].forEach(({ label, size }, idx) => {
    const cx = iconStartX + idx * 20;

    page.drawCircle({
      x: cx,
      y: iconsY,
      size: 7,
      color: iconFill,
    });

    const tw = fontBold.widthOfTextAtSize(label, size);

    page.drawText(label, {
      x: cx - tw / 2,
      y: iconsY - size / 3,
      size,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });

  // ───── REV
  const revText = 'FO.21.1 - REV. 1';
  const revW = font.widthOfTextAtSize(revText, 8);

  page.drawText(revText, {
    x: width / 2 - revW / 2,
    y: 40,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // ───── FINALIZA
  const built = await PDFDocument.load(await doc.save());
  const [copied] = await mergedPdf.copyPages(built, [0]);
  mergedPdf.addPage(copied);
}