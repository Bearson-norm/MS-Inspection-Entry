/**
 * Set inspection level for all employees in a department.
 *
 * Usage:
 *   node scripts/set-department-level.js
 *   node scripts/set-department-level.js --department Production --level red
 *   node scripts/set-department-level.js --dry-run
 *
 * Env: DEPARTMENT, LEVEL (green|red), UPDATED_BY (default: bulk-script)
 */
require('dotenv').config();
const { pool, close } = require('../database');

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const department = readArg('department', process.env.DEPARTMENT || 'Production');
const level = readArg('level', process.env.LEVEL || 'red');
const updatedBy = process.env.UPDATED_BY || 'bulk-script';
const dryRun = process.argv.includes('--dry-run');

if (!['green', 'red'].includes(level)) {
  console.error('Level must be green or red.');
  process.exit(1);
}

async function main() {
  const preview = await pool.query(
    `SELECT employee_id, name, department, COALESCE(is_active, true) AS is_active
     FROM employee_data
     WHERE TRIM(department) ILIKE TRIM($1)
     ORDER BY employee_id`,
    [department]
  );

  if (preview.rows.length === 0) {
    const distinct = await pool.query(
      `SELECT DISTINCT TRIM(department) AS department
       FROM employee_data
       WHERE department IS NOT NULL AND TRIM(department) <> ''
       ORDER BY 1`
    );
    console.error(`No employees found for department "${department}".`);
    if (distinct.rows.length) {
      console.error('Available departments:');
      distinct.rows.forEach((row) => console.error(`  - ${row.department}`));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Department: ${department} (case-insensitive match)`);
  console.log(`Level: ${level}`);
  console.log(`Employees: ${preview.rows.length}`);
  preview.rows.forEach((row) => {
    console.log(`  ${row.employee_id}  ${row.name}  active=${row.is_active}`);
  });

  if (dryRun) {
    console.log('Dry run — no changes written.');
    return;
  }

  const result = await pool.query(
    `INSERT INTO inspection_employee_levels (employee_id, level, updated_by, updated_at)
     SELECT e.employee_id, $2, $3, NOW()
     FROM employee_data e
     WHERE TRIM(e.department) ILIKE TRIM($1)
     ON CONFLICT (employee_id) DO UPDATE
       SET level = EXCLUDED.level,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING employee_id`,
    [department, level, updatedBy]
  );

  console.log(`Updated ${result.rowCount} employee level(s) to "${level}".`);
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(close);
