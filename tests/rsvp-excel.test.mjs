import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('server keeps a private Excel snapshot of all replies and correct attending totals', async () => {
 const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wedding-excel-test-'));
 let child;
 async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs='';child.stdout.on('data', data=>logs+=data);child.stderr.on('data',data=>logs+=data);
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){const match=logs.match(/Wedding Server running at http:\/\/127.0.0.1:(\d+)/);if(match)return 'http://127.0.0.1:'+match[1];if(child.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,30));}
  throw new Error(logs || 'Server did not start');
 }
 async function stop(){const exit=once(child,'exit');child.kill();await exit;child=undefined;}
 try {
  await fs.copyFile(path.join(root,'server.js'),path.join(dir,'server.js'));
  await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  await fs.cp(path.join(root,'lib'),path.join(dir,'lib'),{recursive:true});
  await fs.mkdir(path.join(dir,'public'));await fs.writeFile(path.join(dir,'public/index.html'),'Invitation');
  await fs.symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
  let base=await start();
  const fixture=(name,pax,attendance,wish,visible)=>({id:crypto.randomUUID(),name,pax,attendance,wish,visible,website:''});
  const first=fixture('Aminah',2,'Hadir','=1+1',true);
  const replies=[first,fixture('Private guest',3,'Hadir','Private wishes',false),fixture('Far away',4,'Tidak hadir','Best wishes',true)];
  for(const response of await Promise.all(replies.map(row=>fetch(base+'/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)}))))assert.equal(response.status,200);
  assert.equal((await fetch(base+'/api/rsvp',{method:'POST',body:JSON.stringify(first)})).status,200);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path.join(dir,'exports/rsvp-syahrul-suhaila.xlsx'));
  assert.equal(workbook.getWorksheet('Ringkasan').getCell('B3').value,5);
  assert.equal(workbook.getWorksheet('Ringkasan').getCell('B4').value,3);
  const rows=workbook.getWorksheet('Senarai RSVP');assert.equal(rows.rowCount,4);
  assert.equal(rows.getCell('D2').value,'=1+1');
  assert.ok(rows.getColumn(4).values.includes('Private wishes'));
  const publicData=await (await fetch(base+'/api/rsvp')).json();assert.equal(publicData.messages.length,2);assert.ok(!publicData.messages.some(r=>r.name==='Private guest'));
  const leak=await fetch(base+'/exports/rsvp-syahrul-suhaila.xlsx');assert.equal(await leak.text(),'Invitation');
  await stop();base=await start();
  const restored=new ExcelJS.Workbook();await restored.xlsx.readFile(path.join(dir,'exports/rsvp-syahrul-suhaila.xlsx'));assert.equal(restored.getWorksheet('Ringkasan').getCell('B3').value,5);
 } finally {if(child)await stop();await fs.rm(dir,{recursive:true,force:true});}
});
