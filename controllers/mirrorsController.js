import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

import JSZip from 'jszip';
import { fetchJiraIssues, fetchAramidaIssues, fetchTensylonIssues, attachToJiraIssue, updateJiraIssueFields, deleteJiraAttachment } from '../services/jiraService.js';
import { fetchAllProjects, fetchProjectsByIds } from '../services/mirrorProjectRepository.js';
import { classifyAll } from '../services/classifierService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── GET /api/mirrors/projects ──────────────────────────────────────────────
//
// Query params:
//   dimension  string  "1.60x3.00"  (ignored when material=tensylon)
//   material   string  "aramida" | "tensylon"  (default: aramida)
//
// Response:
//   {
//     success: true,
//     data: {
//       ready:       [...],   // project exists + plan matches + no issues
//       pending:     [...],   // project exists + plan matches + has issues[]
//       missing:     [...],   // no DB project found for Jira card
//       noDimension: [...],   // project exists but no plan for selected dimension
//       meta: { totalJira, dimension, material }
//     }
//   }
//
export const getProjects = async (req, res) => {
  const { dimension = '1.60x3.00', material = 'aramida', search = '' } = req.query;

  try {
    const [dbProjects, jiraCards] = await Promise.all([
      fetchAllProjects(),
      fetchJiraIssues(req.user.id).catch(err => {
        console.warn('[Mirrors] Jira indisponível:', err.message);
        return [];
      }),
    ]);

    const result = classifyAll(jiraCards, dbProjects, dimension, material);

    if (search.trim()) {
      const t = search.trim().toLowerCase();
      const matches = item =>
        [item.project, item.model, item.brand, item.osNumber,
        item.numeroProjeto, item.veiculo, item.resumo]
          .some(v => String(v || '').toLowerCase().includes(t));
      result.ready = result.ready.filter(matches);
      result.pending = result.pending.filter(matches);
      result.missing = result.missing.filter(matches);
      result.noDimension = result.noDimension.filter(matches);
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Mirrors] getProjects error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/mirrors/projects/aramida ─────────────────────────────────────
//
// Query params:
//   dimension  string  "1.60x3.00"  (default)
//   search     string  free-text filter applied server-side
//
export const getAramidaProjects = async (req, res) => {
  const { dimension = '1.60x3.00', search = '' } = req.query;

  try {
    const [dbProjects, jiraCards] = await Promise.all([
      fetchAllProjects(),
      fetchAramidaIssues(req.user.id).catch(err => {
        console.warn('[Mirrors] Jira Aramida indisponível:', err.message);
        return [];
      }),
    ]);

    const result = classifyAll(jiraCards, dbProjects, dimension, 'aramida');

    if (search.trim()) {
      const t = search.trim().toLowerCase();
      const matches = item =>
        [item.project, item.model, item.brand, item.osNumber,
        item.numeroProjeto, item.veiculo, item.resumo]
          .some(v => String(v || '').toLowerCase().includes(t));
      result.ready = result.ready.filter(matches);
      result.pending = result.pending.filter(matches);
      result.missing = result.missing.filter(matches);
      result.noDimension = result.noDimension.filter(matches);
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Mirrors] getAramidaProjects error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/mirrors/projects/tensylon ────────────────────────────────────
//
// Query params:
//   search  string  free-text filter applied server-side
//
export const getTensylonProjects = async (req, res) => {
  const { search = '' } = req.query;

  try {
    const [dbProjects, jiraCards] = await Promise.all([
      fetchAllProjects(),
      fetchTensylonIssues(req.user.id).catch(err => {
        console.warn('[Mirrors] Jira Tensylon indisponível:', err.message);
        return [];
      }),
    ]);

    const result = classifyAll(jiraCards, dbProjects, null, 'tensylon');

    if (search.trim()) {
      const t = search.trim().toLowerCase();
      const matches = item =>
        [item.project, item.model, item.brand, item.osNumber,
        item.numeroProjeto, item.veiculo, item.resumo]
          .some(v => String(v || '').toLowerCase().includes(t));
      result.ready = result.ready.filter(matches);
      result.pending = result.pending.filter(matches);
      result.missing = result.missing.filter(matches);
      result.noDimension = result.noDimension.filter(matches);
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Mirrors] getTensylonProjects error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/mirrors/generate-os ──────────────────────────────────────────
//
// Body: { projects: [{ id, jiraKey, os_number }] }
// Returns: application/pdf blob
//
export const generateOS = async (req, res) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects) || !projects.length) {
      return res.status(400).json({ success: false, message: '"projects" array é obrigatório.' });
    }

    // Deduplicate IDs only for the DB query — the original array may repeat
    // the same ID for different jiraKeys (same physical project, multiple OS).
    const uniqueIds = [...new Set(
      projects
        .map(p => Number(p.id))
        .filter(id => Number.isFinite(id) && id > 0)
    )];

    if (!uniqueIds.length) {
      return res.status(400).json({ success: false, message: 'IDs inválidos.' });
    }

    const dbRows = await fetchProjectsByIds(uniqueIds);

    // Validate every DB project has at least one infoproject attachment.
    for (const proj of dbRows) {
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

    // Lookup by id — iterate over the original projects array so that
    // repeated IDs (different jiraKey/os_number) each produce their own pages.
    const rowMap = new Map(dbRows.map(r => [r.id, r]));
    const zip = new JSZip();
    const failures = [];

    for (const entry of projects) {
      const proj = rowMap.get(Number(entry.id));
      if (!proj) continue;

      const meta = { osNumber: String(entry.os_number || entry.osNumber || '') };
      const folderName = `OS-${meta.osNumber || entry.jiraKey}`;
      let attachmentIds = [];
      let phase = 'geração do PDF';

      try {
        const folder = zip.folder(folderName);

        // Build individual PDF for this OS entry.
        const singlePdf = await PDFDocument.create();
        await appendFirstPage(singlePdf, proj, meta, 1);
        await appendInfoProjectPages(singlePdf, proj);
        await appendLastPage(singlePdf, proj, meta);
        const singleBytes = await singlePdf.save();

        // Add PDF to ZIP folder.
        folder.file(`${folderName}.pdf`, Buffer.from(singleBytes));

        // Add .txt attachments with XXXXX → OS number substitution.
        const seenFileIds = new Set();
        for (const plan of (proj.cutting_plans || [])) {
          for (const att of (plan.attachments || [])) {
            if (!att.file?.name?.toLowerCase().endsWith('.txt')) continue;
            if (seenFileIds.has(att.file.id)) continue;
            seenFileIds.add(att.file.id);
            if (!att.file.path || !fs.existsSync(att.file.path)) continue;
            try {
              const content = await fs.promises.readFile(att.file.path, 'utf8');
              folder.file(
                `${meta.osNumber}-${att.file.name}`,
                content.replace(/XXXXX/g, meta.osNumber),
              );
            } catch (err) {
              console.warn(`[Mirrors] Falha ao ler txt ${att.file.name}:`, err.message);
            }
          }
        }

        // Attach PDF to Jira — throws on any failure.
        phase = 'envio do PDF ao Jira';
        attachmentIds = await attachToJiraIssue(req.user.id, entry.jiraKey, `${folderName}.pdf`, Buffer.from(singleBytes));
        console.log(`[Mirrors] Anexado ${folderName}.pdf ao card ${entry.jiraKey}`);

        // Update square meters custom fields — throws on any failure.
        phase = 'atualização dos campos m²';
        const sqm = {};
        for (const plan of (proj.cutting_plans || [])) {
          for (const [k, v] of Object.entries(plan.square_meters || {})) {
            if (v !== '' && v != null && sqm[k] === undefined) {
              const n = parseFloat(String(v).replace(',', '.'));
              if (Number.isFinite(n)) sqm[k] = n;
            }
          }
        }

        const isTensylon = String(proj.material_type || '').toUpperCase() === 'TENSYLON';
        const sqmFields = {};

        if (isTensylon) {
          if (sqm.tensylon != null) {
            sqmFields.customfield_13636 = sqm.tensylon;
            sqmFields.customfield_13634 = sqm.tensylon;
          }
        } else {
          if (sqm['8C'] != null)  { sqmFields.customfield_13625 = sqm['8C'];  sqmFields.customfield_13631 = sqm['8C'];  }
          if (sqm['9C'] != null)  { sqmFields.customfield_13626 = sqm['9C'];  sqmFields.customfield_13632 = sqm['9C'];  }
          if (sqm['11C'] != null) { sqmFields.customfield_13627 = sqm['11C']; sqmFields.customfield_13633 = sqm['11C']; }
        }

        if (Object.keys(sqmFields).length) {
          await updateJiraIssueFields(req.user.id, entry.jiraKey, sqmFields);
          console.log(`[Mirrors] Campos m² atualizados no card ${entry.jiraKey}`);
        }

      } catch (err) {
        // Rollback: remove any PDF already attached to Jira for this entry.
        for (const attId of attachmentIds) {
          try {
            await deleteJiraAttachment(req.user.id, attId);
            console.log(`[Mirrors] Rollback: anexo ${attId} removido do card ${entry.jiraKey}`);
          } catch (delErr) {
            console.warn(`[Mirrors] Falha no rollback do anexo ${attId}:`, delErr.message);
          }
        }

        // Remove this entry's folder from the ZIP.
        zip.remove(folderName);

        failures.push({ jiraKey: entry.jiraKey, os_number: meta.osNumber, phase, message: err.message });
        console.warn(`[Mirrors] Falha na OS ${entry.jiraKey} (fase: ${phase}):`, err.message);
      }
    }

    // If every entry failed, return a structured error instead of an empty ZIP.
    const successCount = projects.length - failures.length;
    if (successCount === 0) {
      return res.status(422).json({ success: false, message: 'Todas as OS falharam ao ser geradas.', failures });
    }

    // Include a plain-text error log inside the ZIP when there are partial failures.
    if (failures.length > 0) {
      const lines = [
        `Relatório de falhas — ${new Date().toLocaleString('pt-BR')}`,
        '',
        ...failures.map(f => `OS ${f.os_number} (${f.jiraKey})\n  Fase: ${f.phase}\n  Erro: ${f.message}`),
      ];
      zip.file('ERROS.txt', lines.join('\n'));
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="OS-${Date.now()}.zip"`);
    res.setHeader('X-OS-Failures', JSON.stringify(failures));
    return res.end(zipBuffer);
  } catch (error) {
    console.error('[Mirrors] generateOS error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PDF helpers ─────────────────────────────────────────────────────────────

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

  // ── Logo ──────────────────────────────────────────────────────────────────
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

  // ── "Pacote N – Kit" top right ────────────────────────────────────────────
  const pkgLabel = `Pacote ${packageNumber} - Kit`;
  const pkgW = fontBold.widthOfTextAtSize(pkgLabel, 10);
  page.drawText(pkgLabel, {
    x: width - marginLeft - pkgW, y: height - 45,
    size: 10, font: fontBold, color: rgb(0.16, 0.44, 0.72),
  });

  // ── Material badge ────────────────────────────────────────────────────────
  const tituloMaterial = isTensylonProject ? 'Tensylon' : 'Aramida';
  const titleSize = 21;
  const titleW = fontBold.widthOfTextAtSize(tituloMaterial, titleSize);
  const titleX = width / 2 - titleW / 2;
  yPos -= 50;
  page.drawRectangle({ x: titleX - 8, y: yPos - 4, width: titleW + 16, height: titleSize + 7, color: rgb(1, 0.95, 0.2) });
  page.drawText(tituloMaterial, { x: titleX, y: yPos, size: titleSize, font: fontBold, color: rgb(0, 0, 0) });

  // ── Helper: centred text in a box ─────────────────────────────────────────
  const drawCentered = (text, bx, by, bw, bh, size, useBold, color) => {
    const f = useBold ? fontBold : font;
    const v = String(text || '');
    const tw = f.widthOfTextAtSize(v, size);
    page.drawText(v, { x: bx + (bw - tw) / 2, y: by + (bh - size) / 2 + 2, size, font: f, color });
  };

  // ── Document fields ───────────────────────────────────────────────────────
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

  // Aggregate square_meters across all plans (first non-empty value per key)
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

    // Consumption table immediately after OS field (Aramida only)
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

  // ── QR code ───────────────────────────────────────────────────────────────
  const qrPayload = [project.model, project.roof_config, project.project, meta.osNumber]
    .filter(v => String(v || '').trim()).join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload || project.project || '', { margin: 1, width: 300 });
  const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImg = await doc.embedPng(qrBytes);

  yPos -= 30;
  const qrSize = 92;
  const qrX = width / 2 - qrSize / 2;
  const qrY = yPos - qrSize;

  // ── Footer background image ───────────────────────────────────────────────
  if (footerPath) {
    try {
      let fBytes = await fs.promises.readFile(footerPath);
      if (fBytes.toString('utf8', 0, 8).startsWith('iVBORw0K')) {
        fBytes = Buffer.from(fBytes.toString('utf8'), 'base64');
      }
      const fImg = await doc.embedPng(fBytes);
      const fH = (fImg.height / fImg.width) * width;
      page.drawImage(fImg, { x: 0, y: 0, width, height: fH, opacity: 0.9 });
    } catch { /* footer image optional */ }
  }

  // ── Footer text ───────────────────────────────────────────────────────────
  const footerY = 80;
  ['Avenida Tucunaré 421', 'Tamboré • Barueri – SP', 'CEP 06460-020', '+55 11 0000 0000', 'www.operacomposite.com']
    .forEach((line, i) => page.drawText(line, { x: marginLeft - 28, y: footerY - i * 10, size: 7, font, color: rgb(0.36, 0.36, 0.36) }));

  // ── Social icons ──────────────────────────────────────────────────────────
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

  // ── QR drawn last (on top) ────────────────────────────────────────────────
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const revText = 'FO 21.1 - REV. 1';
  const revW = font.widthOfTextAtSize(revText, 7);
  page.drawText(revText, { x: qrX + qrSize / 2 - revW / 2, y: qrY - 12, size: 7, font, color: rgb(0.42, 0.42, 0.42) });

  const built = await PDFDocument.load(await doc.save());
  const [copied] = await mergedPdf.copyPages(built, [0]);
  mergedPdf.addPage(copied);
}

async function appendInfoProjectPages(mergedPdf, project) {
  for (const plan of (project.cutting_plans || [])) {
    const infoAtt = (plan.attachments || []).find(a => a.type === 'infoproject');
    if (!infoAtt?.file?.path || !fs.existsSync(infoAtt.file.path)) continue;
    try {
      const bytes = await fs.promises.readFile(infoAtt.file.path);
      const infoPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await mergedPdf.copyPages(infoPdf, infoPdf.getPageIndices());
      copied.forEach(p => mergedPdf.addPage(p));
    } catch (err) {
      console.warn('[Mirrors] InfoProject merge skipped:', err.message);
    }
  }
}

async function appendLastPage(mergedPdf, project, meta) {
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

  // ── Logo ──────────────────────────────────────────────────────────────────
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

  // ── Header right ──────────────────────────────────────────────────────────
  page.drawText('Pacote 2 - Tampa', {
    x: width - 180,
    y: height - 50,
    size: 10,
    font,
    color: rgb(0.2, 0.4, 0.6),
  });

  y -= 50;

  // ── Material label ────────────────────────────────────────────────────────
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

  // ── Tag ───────────────────────────────────────────────────────────────────
  page.drawRectangle({
    x: marginLeft,
    y: y - 4,
    width: 145,
    height: 22,
    color: rgb(0.1, 0.1, 0.5),
  });

  page.drawText('Tampa traseira', {
    x: marginLeft + 6,
    y,
    size: matSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 45;

  // ── Helper para valores seguros ───────────────────────────────────────────
  const safe = v => (v === null || v === undefined || v === '' ? '-' : String(v));

  // ── Info fields (COM OS INTEGRADO) ────────────────────────────────────────
  const labelSize = 16;
  const lineGap = 32;
  const spacing = 6;

  const info = [
    ['Modelo:', safe(project.model)],
    ['Projeto:', safe(project.project)],
    ['Quantidade:', safe(project.total_parts_qty)],
    ['OS:', safe(meta?.osNumber)],
  ];

  for (const [label, value] of info) {
    page.drawText(label, {
      x: marginLeft,
      y,
      size: labelSize,
      font: fontBold,
    });

    const lw = fontBold.widthOfTextAtSize(label, labelSize);

    page.drawText(value, {
      x: marginLeft + lw + spacing,
      y,
      size: labelSize,
      font,
    });

    y -= lineGap;
  }

  // ── Footer image ──────────────────────────────────────────────────────────
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
    } catch {
      // opcional
    }
  }

  // ── Footer text ───────────────────────────────────────────────────────────
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

  // ── Social icons ──────────────────────────────────────────────────────────
  const iconFill = rgb(0.08, 0.36, 0.56);
  const iconsY = footerY - 56;
  const iconStartX = marginLeft - 21;

  [
    { label: 'IG', size: 5.2 },
    { label: 'f', size: 8.5 },
    { label: 'YT', size: 4.8 },
    { label: 'in', size: 5.6 },
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

  // ── Revision ──────────────────────────────────────────────────────────────
  const revText = 'FO.21.1 - REV. 1';
  const revW = font.widthOfTextAtSize(revText, 8);

  page.drawText(revText, {
    x: width / 2 - revW / 2,
    y: 40,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // ── Merge no PDF final ────────────────────────────────────────────────────
  const built = await PDFDocument.load(await doc.save());
  const [copied] = await mergedPdf.copyPages(built, [0]);
  mergedPdf.addPage(copied);
}

