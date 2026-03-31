import pool from './config/database.js';

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'maestro' AND table_name = 'project' 
  ORDER BY ordinal_position
`).then(result => {
  console.log('Colunas da tabela maestro.project:');
  result.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });
  process.exit(0);
}).catch(error => {
  console.error('Erro:', error.message);
  process.exit(1);
});
