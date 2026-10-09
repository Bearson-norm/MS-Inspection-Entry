const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const config = require('../config');
const { pool } = require('../database');
const { createApp } = require('../app');

test('HTTP flow covers scan, authentication, level update, report, and Excel export', async (t) => {
  const originalQuery = pool.query.bind(pool);
  const sessions = new Map();
  const logs = [];
  const employee = { employee_id:'EMP100', name:'Sari', department:'QC', is_active:true, inspection_level:'green' };

  pool.query = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/g, ' ').trim();
    if (compact === 'SELECT 1') return { rows:[{ '?column?':1 }] };
    if (compact.startsWith('SELECT username, password FROM users')) return { rows:params[0]===config.adminUsername?[{username:config.adminUsername,password:bcrypt.hashSync('test-password',4)}]:[] };
    if (compact.startsWith('DELETE FROM inspection_admin_sessions WHERE expires_at')) return { rows:[], rowCount:0 };
    if (compact.startsWith('INSERT INTO inspection_admin_sessions')) { sessions.set(params[0],{username:params[1],expires_at:params[2]});return {rows:[],rowCount:1}; }
    if (compact.startsWith('SELECT username FROM inspection_admin_sessions')) { const found=sessions.get(params[0]);return {rows:found?[{username:found.username}]:[]}; }
    if (compact.startsWith('DELETE FROM inspection_admin_sessions WHERE token_hash')) {sessions.delete(params[0]);return {rows:[],rowCount:1};}
    if (compact.includes('FROM employee_data e LEFT JOIN inspection_employee_levels') && compact.includes('WHERE e.employee_id = $1')) return { rows:params[0]===employee.employee_id?[employee]:[] };
    if (compact.startsWith('INSERT INTO inspection_scan_logs')) {logs.push(params);return {rows:[],rowCount:1};}
    if (compact === 'SELECT employee_id FROM employee_data WHERE employee_id = $1') return {rows:params[0]===employee.employee_id?[{employee_id:employee.employee_id}]:[]};
    if (compact.startsWith('INSERT INTO inspection_employee_levels')) {employee.inspection_level=params[1];return {rows:[{employee_id:params[0],level:params[1],updated_by:params[2],updated_at:new Date()}],rowCount:1};}
    if (compact.startsWith('SELECT COUNT(*)::int AS total')) return {rows:[{total:logs.length,green:1,red:0,errors:1}]};
    if (compact.startsWith('SELECT COUNT(*) FROM inspection_scan_logs')) return {rows:[{count:String(logs.length)}]};
    if (compact.startsWith('SELECT l.id, l.employee_id')) return {rows:logs.map((entry,index)=>({id:index+1,employee_id:entry[0],name:entry[0]?employee.name:null,department:entry[0]?employee.department:null,scanned_value:entry[1],inspection_level:entry[2],result_code:entry[3],source:entry[4],business_date:entry[5],scanned_at:entry[6]}))};
    if (compact.startsWith('SELECT DISTINCT department')) return {rows:[{department:'QC'}]};
    throw new Error(`Unexpected SQL in integration test: ${compact}`);
  };
  t.after(async () => { pool.query = originalQuery; await pool.end(); });

  const app = createApp();
  const green = await request(app).post('/api/scans').send({value:'EMP100',source:'camera'}).expect(200);
  assert.equal(green.body.code,'GREEN');assert.equal(green.body.display_ms,1000);
  const invalid = await request(app).post('/api/scans').send({value:'',source:'manual'}).expect(400);
  assert.equal(invalid.body.code,'INVALID_QR');assert.equal(logs.length,2);
  await request(app).get('/api/admin/reports/summary?start_date=2026-10-01&end_date=2026-10-08').expect(401);

  const agent=request.agent(app);
  await agent.post('/api/auth/login').set('Origin',config.appOrigin).send({username:config.adminUsername,password:'test-password'}).expect(200).expect('set-cookie',/inspection_session=/);
  const update=await agent.patch('/api/admin/employees/EMP100/level').set('Origin',config.appOrigin).send({level:'red'}).expect(200);
  assert.equal(update.body.data.level,'red');
  const summary=await agent.get('/api/admin/reports/summary?start_date=2026-10-01&end_date=2026-10-08').expect(200);
  assert.equal(summary.body.data.total,2);
  await agent.get('/api/admin/reports/export?start_date=2026-10-01&end_date=2026-10-08').expect(200).expect('Content-Type',/spreadsheetml/);
  await agent.post('/api/auth/logout').set('Origin',config.appOrigin).expect(200);
  await agent.get('/api/auth/session').expect(401);
});
