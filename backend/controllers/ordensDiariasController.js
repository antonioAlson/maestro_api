import pool from '../config/database.js';

/**
 * Buscar ordens diárias
 * @route GET /api/ordens-diarias
 */
export async function getOrdensDiarias(req, res) {
  try {
    const { dataInicio, dataFim } = req.query;

    let query = `
      SELECT 
        id,
        seq,
        tipo,
        os,
        veiculo,
        data_entrega,
        obs,
        created_at,
        updated_at
      FROM maestro.ordens_diarias
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Filtro por data de início
    if (dataInicio) {
      query += ` AND data_entrega >= $${paramCount}`;
      params.push(dataInicio);
      paramCount++;
    }

    // Filtro por data fim
    if (dataFim) {
      query += ` AND data_entrega <= $${paramCount}`;
      params.push(dataFim);
      paramCount++;
    }

    query += `
      ORDER BY
        data_entrega ASC NULLS LAST,
        CASE WHEN seq ~ '^[0-9]+$' THEN seq::int END ASC NULLS LAST,
        seq ASC,
        id ASC
    `;

    console.log('📋 Buscando ordens diárias...', { dataInicio, dataFim });

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar ordens diárias:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar ordens diárias',
      error: error.message
    });
  }
}

/**
 * Criar nova ordem diária
 * @route POST /api/ordens-diarias
 */
export async function createOrdemDiaria(req, res) {
  try {
    const { seq, tipo, os, veiculo, data_entrega, obs } = req.body;

    // Validação básica
    if (!os || !data_entrega) {
      return res.status(400).json({
        success: false,
        message: 'OS e data de entrega são obrigatórios'
      });
    }

    const query = `
      INSERT INTO maestro.ordens_diarias 
        (seq, tipo, os, veiculo, data_entrega, obs)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const params = [seq, tipo, os, veiculo, data_entrega, obs];
    const result = await pool.query(query, params);

    console.log('✅ Ordem diária criada:', result.rows[0].id);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Ordem diária criada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar ordem diária:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar ordem diária',
      error: error.message
    });
  }
}

/**
 * Atualizar ordem diária
 * @route PUT /api/ordens-diarias/:id
 */
export async function updateOrdemDiaria(req, res) {
  try {
    const { id } = req.params;
    const { seq, tipo, os, veiculo, data_entrega, obs } = req.body;

    const query = `
      UPDATE maestro.ordens_diarias
      SET 
        seq = COALESCE($1, seq),
        tipo = COALESCE($2, tipo),
        os = COALESCE($3, os),
        veiculo = COALESCE($4, veiculo),
        data_entrega = COALESCE($5, data_entrega),
        obs = COALESCE($6, obs),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const params = [seq, tipo, os, veiculo, data_entrega, obs, id];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordem diária não encontrada'
      });
    }

    console.log('✅ Ordem diária atualizada:', id);

    return res.json({
      success: true,
      data: result.rows[0],
      message: 'Ordem diária atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ordem diária:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar ordem diária',
      error: error.message
    });
  }
}

/**
 * Deletar ordem diária
 * @route DELETE /api/ordens-diarias/:id
 */
export async function deleteOrdemDiaria(req, res) {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM maestro.ordens_diarias WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordem diária não encontrada'
      });
    }

    console.log('✅ Ordem diária deletada:', id);

    return res.json({
      success: true,
      message: 'Ordem diária deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar ordem diária:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao deletar ordem diária',
      error: error.message
    });
  }
}
