import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { evaluateApplication } from '../src/decision.js';
import { ValidationError, validateApplication } from '../src/validation.js';
import { createHandler } from '../src/http.js';

const base = { annualIncome:120000, monthlyDebt:2500, propertyValue:400000, requestedLoan:280000, creditScore:720 };
const approval = { decision:'APPROVE', approvedAmount:280000, metrics:{debtToIncome:0.25,loanToValue:0.7}, reasons:[] };
const catalogue = [
 ['CREDIT_SCORE_BELOW_600','DECLINE','Credit score is below 600.'],
 ['CREDIT_SCORE_BELOW_680','REFER','Credit score is below 680 and requires manual review.'],
 ['DTI_ABOVE_050','DECLINE','Debt-to-income ratio exceeds 50%.'],
 ['DTI_ABOVE_040','REFER','Debt-to-income ratio exceeds 40% and requires manual review.'],
 ['LTV_ABOVE_090','DECLINE','Loan-to-value ratio exceeds 90%.'],
 ['LTV_ABOVE_080','REFER','Loan-to-value ratio exceeds 80% and requires manual review.'],
].map(([code,severity,message])=>({code,severity,message}));
async function serve(t, evaluate) {
 const server=http.createServer(createHandler(evaluate));
 server.listen(0,'127.0.0.1'); await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return { port:server.address().port, call:(value=base, options={})=>request(server.address().port,value,options) };
}
function request(port,value,{raw,method='POST',path='/api/underwriting/decision',type='application/json'}={}) {
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path,method,headers:{'content-type':type}},res=>{
   let body=''; res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>{
    try {resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(body)});}catch(e){reject(e);}
   });
  });req.on('error',reject);req.end(raw ?? JSON.stringify(value));
 });
}
function error(result,status,code) {
 assert.equal(result.status,status); assert.match(result.headers['content-type'],/^application\/json/);
 assert.equal(result.body.error.code,code);assert.equal(typeof result.body.error.message,'string');assert.ok(Array.isArray(result.body.error.details));
 assert.deepEqual(Object.keys(result.body),['error']);
 const fixedMessages = {
  UNSUPPORTED_CONTENT_TYPE: 'Content-Type must be application/json.',
  REQUEST_TOO_LARGE: 'Request body exceeds 16384 bytes.',
  NOT_FOUND: 'Route not found.',
  METHOD_NOT_ALLOWED: 'Method must be POST.',
  INTERNAL_ERROR: 'Internal server error.',
  MALFORMED_JSON: 'Request body must be valid JSON.',
 };
 if (Object.hasOwn(fixedMessages, code)) {
  assert.deepEqual(result.body, {error: {code, message: fixedMessages[code], details: []}});
 }
}
test('C1 base approval',async t=>{const {call}=await serve(t);const r=await call();assert.equal(r.status,200);assert.deepEqual(r.body,approval);});
test('C2 credit outcomes',async t=>{const {call}=await serve(t);for(const [score,decision,reason] of [[599,'DECLINE',catalogue[0]],[650,'REFER',catalogue[1]]]){const r=await call({...base,creditScore:score});assert.equal(r.status,200);assert.equal(r.body.decision,decision);assert.equal(r.body.approvedAmount,null);assert.deepEqual(r.body.reasons,[reason]);}});
test('C3 credit boundaries',async t=>{const {call}=await serve(t);for(const [creditScore,expected] of [[600,'REFER'],[680,'APPROVE']])assert.equal((await call({...base,creditScore})).body.decision,expected);});
test('C4 debt boundaries',async t=>{const {call}=await serve(t);for(const [monthlyDebt,expected,index] of [[4000,'APPROVE',null],[4001,'REFER',3],[5000,'REFER',3],[5001,'DECLINE',2]]){const r=await call({...base,monthlyDebt});assert.equal(r.body.decision,expected);assert.deepEqual(r.body.reasons,index===null?[]:[catalogue[index]]);}});
test('C5 loan boundaries',async t=>{const {call}=await serve(t);for(const [requestedLoan,expected,index] of [[320000,'APPROVE',null],[320001,'REFER',5],[360000,'REFER',5],[360001,'DECLINE',4]]){const r=await call({...base,requestedLoan});assert.equal(r.body.decision,expected);assert.deepEqual(r.body.reasons,index===null?[]:[catalogue[index]]);}});
test('C6 mixed factors',async t=>{const {call}=await serve(t);const r=await call({...base,creditScore:599,monthlyDebt:4500,requestedLoan:340000});assert.equal(r.body.decision,'DECLINE');assert.deepEqual(r.body.reasons,[catalogue[0],catalogue[3],catalogue[5]]);});
test('C7 exact metrics and precedence',async t=>{const {call}=await serve(t);for(const [patch,expected] of [[{},'APPROVE'],[{monthlyDebt:4000.000001},'REFER'],[{requestedLoan:320000.000001},'REFER'],[{creditScore:650,monthlyDebt:5001},'DECLINE'],[{creditScore:650,requestedLoan:360001},'DECLINE']]){const input={...base,...patch};const r=await call(input);assert.equal(r.status,200);assert.equal(r.body.decision,expected);assert.deepEqual(r.body.metrics,{debtToIncome:input.monthlyDebt/(input.annualIncome/12),loanToValue:input.requestedLoan/input.propertyValue});}});
test('C8 approved amount',async t=>{const {call}=await serve(t);for(const requestedLoan of [1,280000,320000]){const r=await call({...base,requestedLoan});assert.equal(r.body.decision,'APPROVE');assert.equal(r.body.approvedAmount,Math.min(requestedLoan,400000*0.8));}const r=await call({...base,requestedLoan:340000});assert.equal(r.body.decision,'REFER');assert.equal(r.body.approvedAmount,null);});
test('C9 complete reason catalogue',async t=>{const {call}=await serve(t);for(const [patch,index] of [[{creditScore:599},0],[{creditScore:650},1],[{monthlyDebt:5001},2],[{monthlyDebt:4500},3],[{requestedLoan:360001},4],[{requestedLoan:340000},5]])assert.deepEqual((await call({...base,...patch})).body.reasons,[catalogue[index]]);assert.deepEqual((await call()).body.reasons,[]);});
test('C10 direct parity repeatability and no mutation',async t=>{const {call}=await serve(t);for(const creditScore of [720,650,599]){const input=Object.freeze({...base,creditScore});const before=structuredClone(input);const direct=evaluateApplication(input);assert.deepEqual(direct,(await call(input)).body);assert.deepEqual(evaluateApplication(input),direct);assert.deepEqual(input,before);}const extra={...base,unknown:'private'};assert.deepEqual(validateApplication(extra),base);assert.deepEqual(evaluateApplication(extra),approval);assert.equal(evaluateApplication({...base,creditScore:999999,monthlyDebt:2500.5}).decision,'APPROVE');});
test('C11 all invalid fields',async t=>{const {call}=await serve(t);for(const field of Object.keys(base))for(const value of [undefined,0,-1,null,'123',true]){const input={...base,[field]:value};const r=await call(input);error(r,400,'VALIDATION_ERROR');assert.deepEqual(r.body.error.details,[{field,message:'Must be a finite number greater than zero.'}]);assert.throws(()=>evaluateApplication(input),ValidationError);}});
test('C12 integer score fractional money',async t=>{const {call}=await serve(t);const r=await call({...base,creditScore:720.5});error(r,400,'VALIDATION_ERROR');assert.deepEqual(r.body.error.details,[{field:'creditScore',message:'Must be an integer.'}]);assert.equal((await call({annualIncome:120000.5,monthlyDebt:2500.5,propertyValue:400000.5,requestedLoan:280000.5,creditScore:720})).status,200);});
test('C13 object required',async t=>{const {call}=await serve(t);for(const input of [[],null,'hello',true,123]){const r=await call(input);error(r,400,'VALIDATION_ERROR');assert.match(r.body.error.details[0].message,/object/i);}});
test('C14 malformed and recovery',async t=>{const {call}=await serve(t);for(const raw of ['', '{"secretApplicant":BROKEN']){const r=await call(base,{raw});error(r,400,'MALFORMED_JSON');assert.deepEqual(r.body,{error:{code:'MALFORMED_JSON',message:'Request body must be valid JSON.',details:[]}});const recovery=await call();assert.equal(recovery.status,200);assert.deepEqual(recovery.body,approval);}});
test('C15 nonrepresentable numbers',async t=>{const {call}=await serve(t);for(const patch of [{annualIncome:5e-324},{monthlyDebt:5e-324},{requestedLoan:1e308,propertyValue:5e-324},{requestedLoan:5e-324,propertyValue:1e308}]){error(await call({...base,...patch}),400,'VALIDATION_ERROR');assert.throws(()=>evaluateApplication({...base,...patch}),ValidationError);}error(await call(base,{raw:JSON.stringify(base).replace('120000','1e400')}),400,'VALIDATION_ERROR');for(const value of [NaN,Infinity,-Infinity])for(const field of Object.keys(base))assert.throws(()=>evaluateApplication({...base,[field]:value}),ValidationError);});
test('C16 error envelope ordering',async t=>{const {call}=await serve(t);assert.deepEqual((await call({...base,monthlyDebt:0})).body,{error:{code:'VALIDATION_ERROR',message:'Request validation failed.',details:[{field:'monthlyDebt',message:'Must be a finite number greater than zero.'}]}});const r=await call({creditScore:'SECRET',requestedLoan:'SECRET',monthlyDebt:'SECRET',annualIncome:'SECRET',propertyValue:'SECRET'});assert.deepEqual(r.body.error.details.map(x=>x.field),['annualIncome','monthlyDebt','propertyValue','requestedLoan','creditScore']);assert.ok(!JSON.stringify(r.body).includes('SECRET'));});
test('C17 media and byte limit',async t=>{const {call}=await serve(t);error(await call(base,{type:'text/plain'}),400,'UNSUPPORTED_CONTENT_TYPE');error(await call(base,{raw:' '.repeat(16385)}),400,'REQUEST_TOO_LARGE');error(await call(base,{raw:'é'.repeat(8193)}),400,'REQUEST_TOO_LARGE');const json=JSON.stringify(base);assert.equal((await call(base,{raw:json+' '.repeat(16384-Buffer.byteLength(json)),type:'application/json; charset=utf-8'})).status,200);});
test('C18 routing and internal failure',async t=>{const {call}=await serve(t);error(await call(base,{path:'/unknown'}),404,'NOT_FOUND');const method=await call(base,{method:'PUT'});error(method,405,'METHOD_NOT_ALLOWED');assert.equal(method.headers.allow,'POST');const failing=await serve(t,()=>{throw new Error('SECRET INTERNAL');});const r=await failing.call();error(r,500,'INTERNAL_ERROR');assert.deepEqual(r.body,{error:{code:'INTERNAL_ERROR',message:'Internal server error.',details:[]}});});
test('C19 aborted request and recovery',async t=>{let calls=0;const {port,call}=await serve(t,input=>{calls++;return evaluateApplication(input);});const socket=net.connect(port,'127.0.0.1');await once(socket,'connect');socket.write('POST /api/underwriting/decision HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{"annualIncome":');await new Promise(r=>setTimeout(r,30));socket.destroy();await once(socket,'close');await new Promise(r=>setTimeout(r,30));assert.equal(calls,0);assert.equal((await call()).status,200);assert.equal(calls,1);});
test('C20 no sensitive application logs', async t => {
  // Isolate application stdout/stderr from the test runner's own output.
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'node:http';
    import { handler } from './src/http.js';
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => process.send(server.address().port));
  `], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  });
  let logs = '';
  child.stdout.on('data', chunk => logs += chunk);
  child.stderr.on('data', chunk => logs += chunk);
  const [port] = await once(child, 'message');
  assert.equal((await request(port, base)).status, 200);
  assert.equal((await request(port, {...base, creditScore: 'PRIVATE_SENTINEL'})).status, 400);
  assert.equal((await request(port, base, {raw: '{"PRIVATE_SENTINEL":BROKEN'})).status, 400);
  child.kill();
  await once(child, 'close');
  assert.equal(logs, '');
});
