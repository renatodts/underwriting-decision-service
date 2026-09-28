# Underwriting decision service verification

**Verdict**: PASS  
**Profile**: light  
**Diff range**: `44ecc02..c0c12c261ac039a311ed28338833c8f22fdefa3e`  
**Round**: 2 - scoped  
**Verifier**: independent sub-agent, not the author  
**Verified at**: `c0c12c261ac039a311ed28338833c8f22fdefa3e`

All 24 checks are proven under the light profile. Independently reran `npm test` at the new HEAD: 25 passed, 0 failed, 0 cancelled, 0 skipped, exit 0. Every C1-C24 test appeared individually as passing, alongside the startup-failure test.

## Scope and provenance

Round 1 fully reviewed `44ecc02..4ac947aebb1660779c6a3fafc813ef8719156ecb`, opened `.checks/underwriting-decision.md`, `.tasks/underwriting-decision.md`, `.design/underwriting-decision.md` and the skill's `references/verify.md`, and independently ran every proof. Source and implementation findings are carried from that commit except where noted below.

Round 2 reviewed the complete fix diff `4ac947a..c0c12c2`, all prior non-PASS checks, and the shared error assertion's affected checks. The fix changes only `test/contract.test.js`: it adds exact fixed error envelopes and the recovery status assertion. Contract-test citations below are refreshed at the new HEAD. Unchanged operation-test and implementation evidence is carried from `4ac947aebb1660779c6a3fafc813ef8719156ecb`; all executable proofs were rerun at the new HEAD.

The user-authorized removal of the additional monthlyDebt=1e308 probe remains respected; no replacement is required. Numeric space is sampled at the prescribed boundaries and representability probes.

## Round 1 findings and resolution

Round 1 verdict was FAIL, with 21/24 checks fully proven despite all 25 tests passing.

| Prior gap | Round 2 evidence | Resolution |
|---|---|---|
| C14 checked recovery body but not HTTP 200 | `test/contract.test.js:65`: `assert.equal(recovery.status,200); assert.deepEqual(recovery.body,approval);` after both empty and malformed requests | Resolved |
| C17 checked error message type rather than fixed content | `test/contract.test.js:49`: `assert.deepEqual(result.body, {error: {code, message: fixedMessages[code], details: []}});`; literal messages at lines 41-42; invoked at line 68 | Resolved |
| C18 did not assert fixed 404/405 messages and empty details | Same exact envelope assertion at line 49; literal messages at lines 43-44; invoked at line 69 | Resolved |

No assertions were weakened. The shared helper continues to check status and JSON content type at line 37. Its fixed-message branch additionally covers MALFORMED_JSON and INTERNAL_ERROR. VALIDATION_ERROR keeps its existing field-specific assertions.

## Checks

All proof names below ran in the single independent `npm test` invocation at the verified HEAD. In the provenance column, carried means the assertion verdict is carried from `4ac947aebb1660779c6a3fafc813ef8719156ecb` with current citations; reverified means the assertion or its shared helper was reviewed again at `c0c12c261ac039a311ed28338833c8f22fdefa3e`.

The expected approval literal is at `test/contract.test.js:12`; expected reason literals are at lines 14-20 and are independent of implementation constants. Parameterized expectations are explicit in each test body.

| Check | Proof run | Assertion evidence and claim | Provenance | Result |
|---|---|---|---|---|
| C1 | C1 base approval | `test/contract.test.js:52`: `assert.equal(r.status,200); assert.deepEqual(r.body,approval);`. The literal at line 12 fixes APPROVE, 280000, metrics 0.25/0.7 and empty reasons. | Carried | PASS |
| C2 | C2 credit outcomes | `test/contract.test.js:53`: `assert.equal(r.status,200); assert.equal(r.body.decision,decision); assert.equal(r.body.approvedAmount,null); assert.deepEqual(r.body.reasons,[reason]);`, with explicit 599/DECLINE and 650/REFER cases and catalogue entries 0/1. | Carried | PASS |
| C3 | C3 credit boundaries | `test/contract.test.js:54`: `assert.equal((await call({...base,creditScore})).body.decision,expected)` for `[600,'REFER']` and `[680,'APPROVE']`. | Carried | PASS |
| C4 | C4 debt boundaries | `test/contract.test.js:55`: `assert.equal(r.body.decision,expected); assert.deepEqual(r.body.reasons,index===null?[]:[catalogue[index]]);`, for debt 4000/4001/5000/5001 and APPROVE/REFER/REFER/DECLINE. | Carried | PASS |
| C5 | C5 loan boundaries | `test/contract.test.js:56`: `assert.equal(r.body.decision,expected); assert.deepEqual(r.body.reasons,index===null?[]:[catalogue[index]]);`, for loan 320000/320001/360000/360001 and APPROVE/REFER/REFER/DECLINE. | Carried | PASS |
| C6 | C6 mixed factors | `test/contract.test.js:57`: `assert.equal(r.body.decision,'DECLINE'); assert.deepEqual(r.body.reasons,[catalogue[0],catalogue[3],catalogue[5]]);`, for credit 599, debt 4500 and loan 340000. | Carried | PASS |
| C7 | C7 exact metrics and precedence | `test/contract.test.js:58`: `assert.equal(r.body.decision,expected); assert.deepEqual(r.body.metrics,{debtToIncome:input.monthlyDebt/(input.annualIncome/12),loanToValue:input.requestedLoan/input.propertyValue});`. Cases include tiny threshold breaches and credit referral combined with DTI/LTV decline. | Carried | PASS |
| C8 | C8 approved amount | `test/contract.test.js:59`: `assert.equal(r.body.approvedAmount,Math.min(requestedLoan,400000*0.8))` for 1/280000/320000; loan 340000 asserts REFER and null amount. | Carried | PASS |
| C9 | C9 complete reason catalogue | `test/contract.test.js:60`: `assert.deepEqual((await call({...base,...patch})).body.reasons,[catalogue[index]]); assert.deepEqual((await call()).body.reasons,[]);`, covering all six explicit catalogue entries. | Carried | PASS |
| C10 | C10 direct parity repeatability and no mutation | `test/contract.test.js:61`: `assert.deepEqual(direct,(await call(input)).body); assert.deepEqual(evaluateApplication(input),direct); assert.deepEqual(input,before);`, for scores 720/650/599. Inspection of `src/decision.js:3-33` confirms request-local calculation without I/O, clock, randomness or retained state. | Carried | PASS |
| C11 | C11 all invalid fields | `test/contract.test.js:62`: `error(r,400,'VALIDATION_ERROR'); assert.deepEqual(r.body.error.details,[{field,message:'Must be a finite number greater than zero.'}]);`, crossing five fields with undefined/zero/negative/null/string/boolean. Helper status assertion remains at line 37. | Reverified helper; other evidence carried | PASS |
| C12 | C12 integer score fractional money | `test/contract.test.js:63`: `assert.deepEqual(r.body.error.details,[{field:'creditScore',message:'Must be an integer.'}]);`, with 400 validation error; positive fractions in all four money fields assert 200. | Reverified helper; other evidence carried | PASS |
| C13 | C13 object required | `test/contract.test.js:64`: `error(r,400,'VALIDATION_ERROR'); assert.match(r.body.error.details[0].message,/object/i);`, for array/null/string/boolean/number. | Reverified helper; other evidence carried | PASS |
| C14 | C14 malformed and recovery | `test/contract.test.js:65` asserts the exact MALFORMED_JSON body and `assert.equal(recovery.status,200); assert.deepEqual(recovery.body,approval);`, after both malformed and empty JSON. | Reverified | PASS |
| C15 | C15 nonrepresentable numbers | `test/contract.test.js:66`: `error(await call({...base,...patch}),400,'VALIDATION_ERROR'); assert.throws(()=>evaluateApplication({...base,...patch}),ValidationError);`. Includes annualIncome/debt underflow, LTV overflow/underflow, raw 1e400, and direct NaN/Infinity/-Infinity for all fields. | Reverified helper; other evidence carried | PASS |
| C16 | C16 error envelope ordering | `test/contract.test.js:67` deep-compares the literal monthlyDebt-zero envelope; `assert.deepEqual(r.body.error.details.map(x=>x.field),['annualIncome','monthlyDebt','propertyValue','requestedLoan','creditScore']); assert.ok(!JSON.stringify(r.body).includes('SECRET'));`. | Carried | PASS |
| C17 | C17 media and byte limit | `test/contract.test.js:68` calls `error` with 400 and UNSUPPORTED_CONTENT_TYPE/REQUEST_TOO_LARGE for wrong media and oversized ASCII/multibyte bodies; asserts 200 at exactly 16384 bytes with charset. Lines 37 and 49 assert status, JSON and exact envelope using fixed literal messages at lines 41-42. | Reverified | PASS |
| C18 | C18 routing and internal failure | `test/contract.test.js:69` checks 404/NOT_FOUND, 405/METHOD_NOT_ALLOWED, `assert.equal(method.headers.allow,'POST')`, and exact generic 500. Line 49 now asserts exact envelopes including messages at lines 43-45 and empty details. | Reverified | PASS |
| C19 | C19 aborted request and recovery | `test/contract.test.js:70`: `assert.equal(calls,0); assert.equal((await call()).status,200); assert.equal(calls,1);`, after destroying an incomplete request. No uncaught exception occurred. | Carried | PASS |
| C20 | C20 no sensitive application logs | `test/contract.test.js:89-91` sends valid/invalid/malformed requests to an isolated application child; line 94: `assert.equal(logs, '')`, after close and stdout/stderr capture. | Carried | PASS |
| C21 | C21 documented startup | `test/operation.test.js:17`: `assert.equal(pkg.scripts.start,'node src/server.js'); assert.equal(pkg.dependencies,undefined); assert.equal(r.status,200);` and exact approval comparison. Startup output is asserted at line 15; `src/server.js:9` binds 127.0.0.1:3000. | Carried | PASS |
| C22 | C22 test runner completes and closes servers | `test/operation.test.js:18`: `assert.equal(pkg.scripts.test,'node --test'); assert.equal(code,0,output);`, plus individual C1-C20 success matches. Independent outer npm test also exited 0. `test/contract.test.js:23-24` uses ephemeral listeners with registered closure. | Carried; full execution refreshed | PASS |
| C23 | C23 README executable example | `test/operation.test.js:19` checks prerequisite, command and section terms; `assert.deepEqual(sample,base); assert.equal(r.status,200); assert.deepEqual(await r.json(),expected);`. README inspection confirms copyable curl and matching literal blocks. | Carried | PASS |
| C24 | C24 frontend integration guidance | `test/operation.test.js:20`: `assert.match(readme,pattern)` over explicit React, numeric JSON, all reasons, ratio percentages, approval-only amount, 400 field errors, loading, connection/500, proxy and LLM-preservation patterns. README text contains those instructions. | Carried | PASS |

## Profile-specific steps

Carried from round 1: no UI is present. UI source enumeration, Coverage join and Test policy verdicts are not required under light; no Coverage or Test policy section is present. No Swept row claims an inherited implementation constraint. Out-of-scope policies remain unchanged.

## Faults injected

None, as prescribed by the light profile. The verifier modified no implementation or tests; only this report was written.

## Gate

Verified at `c0c12c261ac039a311ed28338833c8f22fdefa3e`: `npm test` returned exit 0 with 25 passed and 0 failed. All C1-C24 tests individually ran and passed. All three prior assertion gaps are resolved. **24/24 checks proven; PASS.**
