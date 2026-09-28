import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
const childEnvironment = { ...process.env };
delete childEnvironment.NODE_TEST_CONTEXT;
const base={annualIncome:120000,monthlyDebt:2500,propertyValue:400000,requestedLoan:280000,creditScore:720};
async function startup(t) {
 const child=spawn(process.execPath,['src/server.js'],{stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
 let output='';let errors='';child.stderr.on('data',c=>errors+=c);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),5000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Startup failed: '+errors));});child.stdout.on('data',c=>{output+=c;if(output.includes('http://127.0.0.1:3000')){clearTimeout(timer);resolve();}});});
 assert.equal(output,'Underwriting service listening at http://127.0.0.1:3000\n');return child;
}
test('C21 documented startup',async t=>{const pkg=JSON.parse(await readFile('package.json'));assert.equal(pkg.scripts.start,'node src/server.js');assert.equal(pkg.dependencies,undefined);await startup(t);const r=await fetch('http://127.0.0.1:3000/api/underwriting/decision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(base)});assert.equal(r.status,200);assert.deepEqual(await r.json(),{decision:'APPROVE',approvedAmount:280000,metrics:{debtToIncome:0.25,loanToValue:0.7},reasons:[]});});
test('C22 test runner completes and closes servers',async()=>{const pkg=JSON.parse(await readFile('package.json'));assert.equal(pkg.scripts.test,'node --test');const child=spawn(process.execPath,['--test','test/contract.test.js'],{stdio:['ignore','pipe','pipe'],timeout:15000,env:childEnvironment});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);const [code]=await once(child,'exit');assert.equal(code,0,output);for(let n=1;n<=20;n++)assert.match(output,new RegExp('ok \\d+ - C'+n+' '));assert.match(output,/# fail 0/);});
test('C23 README executable example',async t=>{const readme=await readFile('README.md','utf8');for(const term of ['Node.js 22','npm start','npm test','Rule summary','Provisional defaults'])assert.ok(readme.includes(term),term);const sample=JSON.parse(readme.match(/<!-- request -->\s*```json\s*([\s\S]*?)```/)[1]);const expected=JSON.parse(readme.match(/<!-- response -->\s*```json\s*([\s\S]*?)```/)[1]);assert.deepEqual(sample,base);await startup(t);const r=await fetch('http://127.0.0.1:3000/api/underwriting/decision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sample)});assert.equal(r.status,200);assert.deepEqual(await r.json(),expected);});
test('C24 frontend integration guidance',async()=>{const readme=await readFile('README.md','utf8');for(const pattern of [/React/,/numeric JSON/,/all reason messages/,/both ratios.*percentages/,/only.*APPROVE/,/400.*field/,/loading/,/connection.*500/,/development proxy/,/LLM/,/must not.*change.*recommendation/])assert.match(readme,pattern);});
test('startup failure is sanitized and exits nonzero',async t=>{const blocker=net.createServer();blocker.listen(3000,'127.0.0.1');await once(blocker,'listening');t.after(()=>new Promise(r=>blocker.close(r)));const child=spawn(process.execPath,['src/server.js']);let errors='';child.stderr.on('data',c=>errors+=c);const [code]=await once(child,'exit');assert.equal(code,1);assert.equal(errors,'Unable to start underwriting service.\n');});
