import dotenv from 'dotenv';
import pool from '../config/database.js';

dotenv.config();

const rows = [
  ['1', 'MANTA', '30755', 'TOYOTA - RAV4 HEV SUV - 2025', '25/03/2026', ''],
  ['2', 'MANTA', '30903', 'TOYOTA - RAV4 HEV SUV - 2025', '25/03/2026', ''],
  ['3', 'MANTA', '31222', 'BMW - X5 SUV - 2026', '25/03/2026', ''],
  ['4', 'MANTA', '31336', 'BMW - X5 SUV - 2024', '25/03/2026', ''],
  ['5', 'MANTA', '2603', 'BMW X2 SUV 2021', '26/03/2026', ''],
  ['6', 'MANTA', '2603', 'BMW SERIE 3 SEDAN 2024', '26/03/2026', ''],
  ['7', 'MANTA', '1046764', 'VOLKSWAGEN TAOS SUV 2022', '26/03/2026', ''],
  ['8', 'MANTA', '31216', 'TOYOTA - RAV4 HEV SUV - 2025', '26/03/2026', ''],
  ['9', 'MANTA', '31106', 'TOYOTA - RAV4 HEV SUV - 2025', '26/03/2026', ''],
  ['10', 'MANTA', '30814', 'TOYOTA - RAV4 HEV SUV - 2025', '26/03/2026', ''],
  ['11', 'MANTA', '30836', 'BMW - X3 SUV - 2026', '26/03/2026', ''],
  ['12', 'MANTA', '31182', 'HONDA - NEW HR-V SUV - 2026', '26/03/2026', ''],
  ['13', 'MANTA', '31165', 'BMW - X5 SUV - 2026', '26/03/2026', ''],
  ['14', 'MANTA', '31075', 'BYD - SONG PLUS SUV - 2026', '26/03/2026', ''],
  ['15', 'MANTA', '30880', 'CHEVROLET - TRAILBLAZER SUV - 2026', '26/03/2026', ''],
  ['16', 'MANTA', '30879', 'CHEVROLET - TRAILBLAZER SUV - 2026', '26/03/2026', ''],
  ['17', 'MANTA', '31065', 'FIAT - FASTBACK SUV - 2026', '26/03/2026', ''],
  ['18', 'MANTA', '30952', 'FORD - NOVA RANGER PICK-UP - 2026', '26/03/2026', ''],
  ['19', 'MANTA', '30752', 'GWM - HAVAL H6 GT - 2025', '26/03/2026', ''],
  ['20', 'MANTA', '31282', 'GWM - HAVAL H6 PHEV 19 - 2025', '26/03/2026', ''],
  ['21', 'MANTA', '30714', 'GWM - HAVAL H6 PHEV 19 - 2026', '26/03/2026', ''],
  ['22', 'MANTA', '30820', 'GWM - HAVAL H6 PHEV 35 - 2026', '26/03/2026', ''],
  ['23', 'MANTA', '30644', 'GWM - HAVAL H6 PHEV 35 - 2026', '26/03/2026', ''],
  ['24', 'MANTA', '31029', 'GWM - HAVAL H9 SUV - 2026', '26/03/2026', ''],
  ['25', 'MANTA', '30960', 'GWM - HAVAL H9 SUV - 2026', '26/03/2026', ''],
  ['26', 'MANTA', '30512', 'GWM - HAVAL H9 SUV - 2026', '26/03/2026', ''],
  ['27', 'MANTA', '31210', 'GWM - TANK 300 SUV - 2026', '26/03/2026', ''],
  ['28', 'MANTA', '31188', 'GWM - TANK 300 SUV - 2026', '26/03/2026', ''],
  ['29', 'MANTA', '30957', 'GWM - TANK 300 SUV - 2026', '26/03/2026', ''],
  ['30', 'MANTA', '31181', 'JAECOO - JAECOO 7 SUV - 2026', '26/03/2026', '']
];

function toIsoDate(brDate) {
  const [day, month, year] = brDate.split('/');
  return `${year}-${month}-${day}`;
}

async function run() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Limpa apenas os registros atuais para refletir exatamente a carga informada.
    await client.query('DELETE FROM maestro.ordens_diarias');

    const insertSql = `
      INSERT INTO maestro.ordens_diarias (seq, tipo, os, veiculo, data_entrega, obs)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const row of rows) {
      const [seq, tipo, os, veiculo, dataEntregaBr, obs] = row;
      await client.query(insertSql, [seq, tipo, os, veiculo, toIsoDate(dataEntregaBr), obs]);
    }

    await client.query('COMMIT');
    console.log(`✅ Carga concluída com sucesso. Registros inseridos: ${rows.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao carregar ordens_diarias:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
