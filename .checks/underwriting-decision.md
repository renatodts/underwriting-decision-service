# Underwriting decision service checks

Profile: light. Handoff: on. No existing application or test conventions.

## Sources

- `.tasks/underwriting-decision.md`: all 24 criteria, boundaries, and provisional defaults; controlling implementation task.
- `.design/underwriting-decision.md`: binding API/rule contract, validation and reason catalogue; no UI.
- Original brief and user confirmations transcribed in both sources: deterministic rules, JavaScript, integer credit score, reject all zeros, port 3000, no sensitive logs.

## Out of scope

Database, history, authentication, deployment, production lending policy, UI, LLM calls, external services, TypeScript and frameworks, as recorded in the task.

## Landing

New src/decision.js and src/validation.js share validation; src/http.js owns transport; src/server.js owns startup. Use the source-prescribed Node built-ins and node --test commands. No existing implementation to reuse.

No one-way doors: no deployed consumer or stored data. Task Unresolved 1-4 remain provisional exactly as recorded: null non-approval amount, highest tier per factor in credit/DTI/LTV order, positive fractional money, ignored extras, no score maximum, 16 KiB JSON transport.

| Local implementation choice | Literal shape | Alternative rejected |
|---|---|---|
| Error-path test seam | createHandler(evaluate = evaluateApplication) exported factory plus default handler | Global monkey-patching would introduce shared mutable test state |
| Unspecified errors | NOT_FOUND: Route not found.; METHOD_NOT_ALLOWED: Method must be POST.; INTERNAL_ERROR: Internal server error.; UNSUPPORTED_CONTENT_TYPE: Content-Type must be application/json.; REQUEST_TOO_LARGE: Request body exceeds 16384 bytes. | Exception-derived messages risk input disclosure |
| Derived arithmetic validation | annualIncome for invalid monthly income; monthlyDebt for invalid DTI; requestedLoan for invalid LTV; fixed messages | Serializing unusable metrics violates the source |

Nothing else in this change is hard to reverse.

## Handoff

One batch S1-S3. Existing application bytes = 0; shared source documents approximately 32 KB / 4 = 8k tokens. Estimated implementation/test reading S1 8k + S2 12k + S3 5k = 25k, well below 150k. Keep all three inherited slices together; fresh independent verifier after final feature commit.

## Checks

### S1 - A caller receives a deterministic recommendation and its reasons · 3 new files · existing 0 bytes · estimated 8k

**C1** - Submitting the base input returns HTTP 200 and JSON containing `decision: "APPROVE"`, `approvedAmount: 280000`, `metrics: {debtToIncome: 0.25, loanToValue: 0.7}`, and `reasons: []`.
Proof: `node --test --test-name-pattern="^C1 " test/contract.test.js`

**C2** - Submitting creditScore `599` returns HTTP 200 and `DECLINE`, with a structured reason identifying credit below 600. Changing only creditScore to `650` returns HTTP 200 and `REFER`, with a reason identifying credit below 680. Non-approval amount representation follows Unresolved 1.
Proof: `node --test --test-name-pattern="^C2 " test/contract.test.js`

**C3** - Credit scores `600` and `680` produce `REFER` and `APPROVE`, respectively; equality does not breach the corresponding credit threshold.
Proof: `node --test --test-name-pattern="^C3 " test/contract.test.js`

**C4** - MonthlyDebt values `4000`, `4001`, `5000`, and `5001` produce `APPROVE`, `REFER`, `REFER`, and `DECLINE`, respectively, with a debt reason for each non-ideal result.
Proof: `node --test --test-name-pattern="^C4 " test/contract.test.js`

**C5** - RequestedLoan values `320000`, `320001`, `360000`, and `360001` produce `APPROVE`, `REFER`, `REFER`, and `DECLINE`, respectively, with an LTV reason for each non-ideal result.
Proof: `node --test --test-name-pattern="^C5 " test/contract.test.js`

**C6** - Submitting creditScore `599`, monthlyDebt `4500`, and requestedLoan `340000` together returns `DECLINE` and reasons covering all three non-ideal factors. The credit decline must not suppress the debt and LTV referral explanations; reason granularity follows Unresolved 2.
Proof: `node --test --test-name-pattern="^C6 " test/contract.test.js`

**C7** - Each valid evaluation returns numeric `debtToIncome = monthlyDebt / (annualIncome / 12)` and `loanToValue = requestedLoan / propertyValue`, using the calculated numbers before display rounding for classification. DECLINE takes precedence over REFER, which takes precedence over APPROVE.
Proof: `node --test --test-name-pattern="^C7 " test/contract.test.js`

**C8** - Every APPROVE result returns `approvedAmount = Math.min(requestedLoan, propertyValue * 0.8)`. In particular, requestedLoan `320000` returns approvedAmount `320000`. A requestedLoan of `340000` is referred rather than converted into a smaller approved loan.
Proof: `node --test --test-name-pattern="^C8 " test/contract.test.js`

**C9** - Every non-ideal factor has a structured reason code and human-readable message, and an ideal factor has none. Source-default objects contain `code`, `severity`, and `message` from the reason catalogue below; factor ordering and overlapping thresholds follow Unresolved 2.
Proof: `node --test --test-name-pattern="^C9 " test/contract.test.js`

**C10** - Calling the decision function directly, without starting an HTTP server, produces the same recommendation and metrics as the endpoint for the base, referred, and declined examples. Repeating a call produces deeply equal results and leaves the input unchanged. A pure evaluator with no clock, randomness, I/O, or retained applicant state is the source-prescribed mechanism.
Proof: `node --test --test-name-pattern="^C10 " test/contract.test.js`


### S2 - A caller can correct invalid input without crashing the service · 3 new files · existing 0 bytes · estimated 12k

**C11** - For each of the five fields, a missing value, `0`, a negative number, `null`, a numeric string, or a boolean returns HTTP 400 with an error identifying the field and expected numeric constraint. In particular, monthlyDebt `0` is invalid. No string-to-number coercion is used.
Proof: `node --test --test-name-pattern="^C11 " test/contract.test.js`

**C12** - CreditScore `720.5` returns HTTP 400 identifying creditScore as requiring an integer. Integer-only applies to creditScore, not to the four monetary fields.
Proof: `node --test --test-name-pattern="^C12 " test/contract.test.js`

**C13** - A top-level JSON array, null, string, boolean, or number returns HTTP 400 because the request must be an object containing the five fields.
Proof: `node --test --test-name-pattern="^C13 " test/contract.test.js`

**C14** - Empty or malformed JSON returns HTTP 400. Under the source default, the response is `{error: {code: "MALFORMED_JSON", message: "Request body must be valid JSON.", details: []}}`. Raw parser exceptions or input fragments are not returned, and a subsequent base request still succeeds with HTTP 200.
Proof: `node --test --test-name-pattern="^C14 " test/contract.test.js`

**C15** - Non-finite numeric input or arithmetic that yields zero or non-finite monthly income/ratios returns HTTP 400 rather than a successful decision with unusable metrics. Concrete probes include raw JSON `1e400`, annualIncome `5e-324`, and monthlyDebt `5e-324` in otherwise base requests. Direct invalid calls raise a typed validation error rather than performing an unchecked division.
Proof: `node --test --test-name-pattern="^C15 " test/contract.test.js`

**C16** - Under the source-default validation envelope, monthlyDebt `0` returns `{error: {code: "VALIDATION_ERROR", message: "Request validation failed.", details: [{field: "monthlyDebt", message: "Must be a finite number greater than zero."}]}}`. Multiple field errors appear in annualIncome, monthlyDebt, propertyValue, requestedLoan, creditScore order without echoing submitted values.
Proof: `node --test --test-name-pattern="^C16 " test/contract.test.js`

**C17** - Under the source-default HTTP limits, a non-JSON content type returns HTTP 400 with `UNSUPPORTED_CONTENT_TYPE`, and a body exceeding 16384 bytes returns HTTP 400 with `REQUEST_TOO_LARGE`. `application/json; charset=utf-8` is accepted. Error responses use JSON and the `{error: {code, message, details}}` envelope. Remaining message literals follow Unresolved 4.
Proof: `node --test --test-name-pattern="^C17 " test/contract.test.js`

**C18** - An unknown path returns HTTP 404; a non-POST method on `/api/underwriting/decision` returns HTTP 405 with `Allow: POST`. An unexpected handler failure returns a generic HTTP 500 without internal exception details. These source-default responses use the same JSON error envelope; unspecified code/message literals follow Unresolved 4.
Proof: `node --test --test-name-pattern="^C18 " test/contract.test.js`

**C19** - When a client aborts while sending a request, the process has no uncaught exception and accepts a subsequent base request with HTTP 200. The HTTP boundary handles request errors/aborts; it does not invoke the evaluator with an incomplete body.
Proof: `node --test --test-name-pattern="^C19 " test/contract.test.js`

**C20** - Capturing application stdout/stderr while sending valid, invalid, and malformed requests shows no request/response bodies, applicant values, or parser exception text. The mechanism is omission of these values from logging paths, including the HTTP error handler; fixed startup or error metadata may follow Unresolved 4.
Proof: `node --test --test-name-pattern="^C20 " test/contract.test.js`


### S3 - The candidate can run, verify, and explain the local service · 4 new files · existing 0 bytes · estimated 5k

**C21** - With the documented Node.js prerequisite installed and port 3000 available, `npm start` launches the JavaScript service at `127.0.0.1:3000`, and the base request returns the result in criterion 1. Source default: no third-party installation or compilation is required before this command.
Proof: `node --test --test-name-pattern="^C21 " test/operation.test.js`

**C22** - `npm test` runs at least three automated outcome tests covering APPROVE, REFER, and DECLINE, the boundary/validation cases above, and local HTTP verification of successful and malformed requests. On success it exits with code 0 and leaves no test HTTP server listening. Test servers use ephemeral ports as the source proposes.
Proof: `node --test --test-name-pattern="^C22 " test/operation.test.js`

**C23** - A README reader can find the prerequisite, `npm start`, `npm test`, and a copyable base request with its expected response, followed by the rule summary and source-default choices. Executing that request against the running service produces criterion 1's response.
Proof: `node --test --test-name-pattern="^C23 " test/operation.test.js`

**C24** - The README contains a short React or Angular integration note explaining numeric JSON submission, decision/reason display, percentage formatting for both ratios, approved-amount display only for approval, field errors on 400, loading state, and connection/server errors. It describes a local development proxy and how a future LLM may explain the returned result without determining or changing the recommendation. No frontend or LLM implementation is required.
Proof: `node --test --test-name-pattern="^C24 " test/operation.test.js`

## Swept

- validation: C11-C17; retain Unresolved 3 defaults.
- failure modes: C14-C19, C21-C22.
- idempotency and retry: C10; no persisted effects.
- authorization: out of scope for localhost exercise; C21 tests binding.
- concurrency and ordering: no cross-request state; C6/C9 fix reason ordering.
- data lifecycle: no persisted applicant entity, out of scope.
- external-dependency failure: no external calls, out of scope.
- state transitions: computed outputs, no persisted state, out of scope.
- observability: C20; startup diagnostics C21.

HTTP claims C1-C9 and C11-C20 cross real local HTTP. C10 covers direct evaluation and HTTP parity. C21/C23 use the real startup entrypoint. C22 uses a bounded child test run; C24 inspects README requirements. Light profile has no Test policy or Coverage join; numeric space is sampled at documented boundaries and representability probes, not exhaustively over all JavaScript numbers.
