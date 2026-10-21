const test = require('node:test');
const assert = require('node:assert/strict');
const { processScan, resultResponse } = require('../services/scan');

function fakeDb(employee) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM employee_data')) return { rows: employee ? [employee] : [] };
      return { rows: [], rowCount:1 };
    }
  };
}

test('green scan returns one-second response and writes exactly one log', async () => {
  const db=fakeDb({employee_id:'EMP1',name:'Ari',department:'QC',location:'Plant A',is_active:true,inspection_level:'green'});
  const result=await processScan(db,{value:'EMP1',source:'camera'},new Date('2026-10-08T03:00:00Z'),{checkpointLocation:'Gate 1'});
  assert.equal(result.code,'GREEN');assert.equal(result.display_ms,1000);
  assert.equal(result.employee.location,'Plant A');assert.equal(result.checkpoint_location,'Gate 1');
  const insert=db.calls.find((call)=>call.sql.includes('INSERT INTO inspection_scan_logs'));
  assert.ok(insert);assert.equal(insert.params[7],'Gate 1');
  assert.equal(db.calls.filter((call)=>call.sql.includes('INSERT INTO inspection_scan_logs')).length,1);
});
test('red scan snapshots red level and writes one log on every repeated call', async () => {
  const db=fakeDb({employee_id:'EMP2',name:'Budi',department:'WH',is_active:true,inspection_level:'red'});
  const first=await processScan(db,{value:'EMP2',source:'manual'});const second=await processScan(db,{value:'EMP2',source:'manual'});
  assert.equal(first.code,'RED');assert.equal(first.display_ms,2000);assert.equal(second.code,'RED');
  const inserts=db.calls.filter((call)=>call.sql.includes('INSERT INTO inspection_scan_logs'));assert.equal(inserts.length,2);assert.equal(inserts[0].params[2],'red');
});
test('unknown, inactive, and invalid scans are logged with stable result codes', async () => {
  const unknown=fakeDb(null);assert.equal((await processScan(unknown,{value:'NONE',source:'camera'})).code,'EMPLOYEE_NOT_FOUND');
  const inactive=fakeDb({employee_id:'OFF',name:'Off',department:'X',is_active:false,inspection_level:'green'});assert.equal((await processScan(inactive,{value:'OFF',source:'manual'})).code,'EMPLOYEE_INACTIVE');
  const invalid=fakeDb(null);assert.equal((await processScan(invalid,{value:'',source:'manual'})).code,'INVALID_QR');
  assert.equal(unknown.calls.filter((call)=>call.sql.includes('INSERT INTO')).length,1);assert.equal(inactive.calls.filter((call)=>call.sql.includes('INSERT INTO')).length,1);assert.equal(invalid.calls.filter((call)=>call.sql.includes('INSERT INTO')).length,1);
});
test('result mapping never treats red as failure', () => {
  assert.equal(resultResponse('RED').success,true);assert.equal(resultResponse('EMPLOYEE_INACTIVE').success,false);
});
test('failed scans still return checkpoint location', async () => {
  const db=fakeDb(null);
  const result=await processScan(db,{value:'NONE',source:'camera'},new Date('2026-10-08T03:00:00Z'),{checkpointLocation:'Lobby'});
  assert.equal(result.code,'EMPLOYEE_NOT_FOUND');assert.equal(result.checkpoint_location,'Lobby');assert.equal(result.employee,null);
});
