# Deliver the local underwriting decision service

> Build this with **tlc-implement**. Every criterion becomes a numbered check with proof.
> Items in Unresolved remain open; use only their recorded interim defaults and do not treat them as user-confirmed decisions.

## Intent

The interview candidate must demonstrate deterministic underwriting behavior, input safety, independent testing, and a usable frontend contract. The workspace currently contains only the design document, so none of these behaviors can be demonstrated. This is a construction exercise; the source supplies no production usage or business-loss figures.

A local caller will submit five numeric inputs and receive APPROVE, REFER, or DECLINE, calculated ratios, and structured human-readable reasons. Invalid submissions will receive useful HTTP 400 responses. The implementation is JavaScript and runs locally on port 3000.

24 criteria in 3 slices · 0 one-way doors in the current local context · 4 open, of which 0 block.

Cut: one task for the entire source. The observable slices are evaluating applications, rejecting invalid requests safely, and running/verifying the local demonstration. No deployment ordering, external owner, or existing consumer requires separate tasks. Sizing evidence: the user's “local interview” and “Simple application” constraints plus the design's one-block Roadmap. The workspace has no contributing rules, application code, or tracker reference; no task-size inference is made from git history.

## Criteria

The base input used below is:

```json
{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}
```

Unless stated otherwise, submit JSON to `POST /api/underwriting/decision`, change only the specified field, and retain the base values for all other fields. “Source default” identifies a reversible design choice tracked in Unresolved, not a separate user confirmation.

### A caller receives a deterministic recommendation and its reasons

1. Submitting the base input returns HTTP 200 and JSON containing `decision: "APPROVE"`, `approvedAmount: 280000`, `metrics: {debtToIncome: 0.25, loanToValue: 0.7}`, and `reasons: []`.
2. Submitting creditScore `599` returns HTTP 200 and `DECLINE`, with a structured reason identifying credit below 600. Changing only creditScore to `650` returns HTTP 200 and `REFER`, with a reason identifying credit below 680. Non-approval amount representation follows Unresolved 1.
3. Credit scores `600` and `680` produce `REFER` and `APPROVE`, respectively; equality does not breach the corresponding credit threshold.
4. MonthlyDebt values `4000`, `4001`, `5000`, and `5001` produce `APPROVE`, `REFER`, `REFER`, and `DECLINE`, respectively, with a debt reason for each non-ideal result.
5. RequestedLoan values `320000`, `320001`, `360000`, and `360001` produce `APPROVE`, `REFER`, `REFER`, and `DECLINE`, respectively, with an LTV reason for each non-ideal result.
6. Submitting creditScore `599`, monthlyDebt `4500`, and requestedLoan `340000` together returns `DECLINE` and reasons covering all three non-ideal factors. The credit decline must not suppress the debt and LTV referral explanations; reason granularity follows Unresolved 2.
7. Each valid evaluation returns numeric `debtToIncome = monthlyDebt / (annualIncome / 12)` and `loanToValue = requestedLoan / propertyValue`, using the calculated numbers before display rounding for classification. DECLINE takes precedence over REFER, which takes precedence over APPROVE.
8. Every APPROVE result returns `approvedAmount = Math.min(requestedLoan, propertyValue * 0.8)`. In particular, requestedLoan `320000` returns approvedAmount `320000`. A requestedLoan of `340000` is referred rather than converted into a smaller approved loan.
9. Every non-ideal factor has a structured reason code and human-readable message, and an ideal factor has none. Source-default objects contain `code`, `severity`, and `message` from the reason catalogue below; factor ordering and overlapping thresholds follow Unresolved 2.
10. Calling the decision function directly, without starting an HTTP server, produces the same recommendation and metrics as the endpoint for the base, referred, and declined examples. Repeating a call produces deeply equal results and leaves the input unchanged. A pure evaluator with no clock, randomness, I/O, or retained applicant state is the source-prescribed mechanism.

Source-default reason catalogue, transcribed from the design:

| Code | Severity | Message |
|---|---|---|
| CREDIT_SCORE_BELOW_600 | DECLINE | Credit score is below 600. |
| CREDIT_SCORE_BELOW_680 | REFER | Credit score is below 680 and requires manual review. |
| DTI_ABOVE_050 | DECLINE | Debt-to-income ratio exceeds 50%. |
| DTI_ABOVE_040 | REFER | Debt-to-income ratio exceeds 40% and requires manual review. |
| LTV_ABOVE_090 | DECLINE | Loan-to-value ratio exceeds 90%. |
| LTV_ABOVE_080 | REFER | Loan-to-value ratio exceeds 80% and requires manual review. |

### A caller can correct invalid input without crashing the service

11. For each of the five fields, a missing value, `0`, a negative number, `null`, a numeric string, or a boolean returns HTTP 400 with an error identifying the field and expected numeric constraint. In particular, monthlyDebt `0` is invalid. No string-to-number coercion is used.
12. CreditScore `720.5` returns HTTP 400 identifying creditScore as requiring an integer. Integer-only applies to creditScore, not to the four monetary fields.
13. A top-level JSON array, null, string, boolean, or number returns HTTP 400 because the request must be an object containing the five fields.
14. Empty or malformed JSON returns HTTP 400. Under the source default, the response is `{error: {code: "MALFORMED_JSON", message: "Request body must be valid JSON.", details: []}}`. Raw parser exceptions or input fragments are not returned, and a subsequent base request still succeeds with HTTP 200.
15. Non-finite numeric input or arithmetic that yields zero or non-finite monthly income/ratios returns HTTP 400 rather than a successful decision with unusable metrics. Concrete probes include raw JSON `1e400`, annualIncome `5e-324`, and monthlyDebt `5e-324` in otherwise base requests. Direct invalid calls raise a typed validation error rather than performing an unchecked division.
16. Under the source-default validation envelope, monthlyDebt `0` returns `{error: {code: "VALIDATION_ERROR", message: "Request validation failed.", details: [{field: "monthlyDebt", message: "Must be a finite number greater than zero."}]}}`. Multiple field errors appear in annualIncome, monthlyDebt, propertyValue, requestedLoan, creditScore order without echoing submitted values.
17. Under the source-default HTTP limits, a non-JSON content type returns HTTP 400 with `UNSUPPORTED_CONTENT_TYPE`, and a body exceeding 16384 bytes returns HTTP 400 with `REQUEST_TOO_LARGE`. `application/json; charset=utf-8` is accepted. Error responses use JSON and the `{error: {code, message, details}}` envelope. Remaining message literals follow Unresolved 4.
18. An unknown path returns HTTP 404; a non-POST method on `/api/underwriting/decision` returns HTTP 405 with `Allow: POST`. An unexpected handler failure returns a generic HTTP 500 without internal exception details. These source-default responses use the same JSON error envelope; unspecified code/message literals follow Unresolved 4.
19. When a client aborts while sending a request, the process has no uncaught exception and accepts a subsequent base request with HTTP 200. The HTTP boundary handles request errors/aborts; it does not invoke the evaluator with an incomplete body.
20. Capturing application stdout/stderr while sending valid, invalid, and malformed requests shows no request/response bodies, applicant values, or parser exception text. The mechanism is omission of these values from logging paths, including the HTTP error handler; fixed startup or error metadata may follow Unresolved 4.

### The candidate can run, verify, and explain the local service

21. With the documented Node.js prerequisite installed and port 3000 available, `npm start` launches the JavaScript service at `127.0.0.1:3000`, and the base request returns the result in criterion 1. Source default: no third-party installation or compilation is required before this command.
22. `npm test` runs at least three automated outcome tests covering APPROVE, REFER, and DECLINE, the boundary/validation cases above, and local HTTP verification of successful and malformed requests. On success it exits with code 0 and leaves no test HTTP server listening. Test servers use ephemeral ports as the source proposes.
23. A README reader can find the prerequisite, `npm start`, `npm test`, and a copyable base request with its expected response, followed by the rule summary and source-default choices. Executing that request against the running service produces criterion 1's response.
24. The README contains a short React or Angular integration note explaining numeric JSON submission, decision/reason display, percentage formatting for both ratios, approved-amount display only for approval, field errors on 400, loading state, and connection/server errors. It describes a local development proxy and how a future LLM may explain the returned result without determining or changing the recommendation. No frontend or LLM implementation is required.

## Out of scope

- Database, file persistence, applicant history, and audit records: the service evaluates a request without retaining applicant state.
- Authentication, deployment, rate limiting, API version negotiation, and operational dashboards: no real multi-user service is being launched.
- Production lending rules, currency conventions, or additional credit-score limits: the exercise supplies the policy.
- Full UI, review queue, real LLM calls, paid APIs, and external services: only the integration note is required.
- TypeScript migration or framework/rules-engine infrastructure: JavaScript is confirmed and the exercise has one endpoint.

## Observable

| Surface | Decision | Landing |
|---|---|---|
| Decision API | Response shape | 1, 7, 8, 9; Unresolved 1 and 2 |
| Decision API | Error shape and codes | 11-18; Unresolved 4 for remaining literals |
| Decision API | Who may call | 21; n/a for authentication, explicitly excluded for the localhost exercise |
| Decision API | Versioning | n/a: the source fixes one unversioned route and has no existing consumers |
| Decision API | Rate-limit behavior | n/a: no rate limiter within the local exercise; body size is separately covered by 17 |
| npm start | Output format and verbosity | Unresolved 4 |
| npm start | Flags and defaults | 21; Unresolved 4 for absence of application flags |
| npm start | Exit codes | Unresolved 4 |
| npm start | Failure during startup | Unresolved 4; no migration or persistent partial operation |
| npm test | Output format and verbosity | Unresolved 4 |
| npm test | Flags and defaults | 22; Unresolved 4 |
| npm test | Exit codes | 22 for success; Unresolved 4 for failure |
| npm test | Failure partway through execution | Unresolved 4 |
| README | Structure | 23, 24 |
| README | Tone | Unresolved 4 |
| README | Depth | 23, 24: short local usage/integration note, not a production guide |
| README | Reader's next action | 23: start, submit the example, run tests |
| UI | Empty/loading/error/unauthorized states, density, ordering, destructive confirmation | n/a: no screen is built; integration guidance only, criterion 24 |
| Organized collection | Grouping, naming, ordering, duplicates, exceptions | n/a: no collection-management surface |

## Swept

- validation: 11-17; additional source defaults remain recorded in Unresolved 3.
- failure modes: 14, 15, 17-19; startup/test diagnostics in Unresolved 4.
- idempotency and retry: 10; repeated evaluation has no persisted effects because the evaluator is pure and no storage is introduced.
- authorization: n/a, explicitly excluded in this localhost-only exercise; binding covered by 21.
- concurrency and ordering: n/a for cross-request coordination because evaluations share no mutable applicant state and have no workflow ordering. Reason ordering is Unresolved 2; no concurrency SLA is introduced.
- data lifecycle: n/a, no persisted applicant entity or history; request-local inputs and outputs only.
- external-dependency failure: n/a, no external dependency calls are allowed by the brief.
- state transitions: n/a, APPROVE/REFER/DECLINE are computed outputs, not persisted lifecycle states.
- observability: 20 for sensitive-data exclusion; Unresolved 4 for local diagnostic output. Production metrics and service targets are out of scope.

## Impact

| Front | What changes |
|---|---|
| Domain | New `decision` output: APPROVE, REFER, or DECLINE computed from the supplied policy; no existing caller branches on it. |
| Domain | New `metrics` output: debtToIncome and loanToValue from the evaluator. |
| Domain | New `reasons` output: non-ideal factor explanations from the evaluator; exact granularity remains Unresolved 2. |
| Existing application | None: workspace inspection found only the design document and git metadata. |
| Stored data | Nothing to migrate, backfill, or preserve; no storage is introduced. |
| Local operation | Introduces startup on localhost port 3000, tests, and a README. |

## Decided

None: there is no persisted schema, deployed consumer, migration, or costly one-way choice in this local exercise. User-confirmed language, port, validation, and policy constraints are preserved in Criteria. Folder placement and helper signatures from the design are reversible implementation guidance, not additional acceptance conditions.

## Surface

| Route | In | Out | Status | Criteria |
|---|---|---|---|---|
| POST /api/underwriting/decision | annualIncome, monthlyDebt, propertyValue, requestedLoan, creditScore | decision, approvedAmount for approvals, metrics, reasons; non-approval amount in Unresolved 1 | 200 | 1-9 |
| POST /api/underwriting/decision | Invalid body or content type | error with code, message, details | 400 | 11-17 |
| Other path / method | Request | error; Allow header for 405 | 404 / 405 | 18 |
| Decision endpoint on internal failure | Request | Generic error | 500 | 18 |

## Sources

- [Underwriting design](../.design/underwriting-decision.md), read in full: binding source for the rule/endpoint contract and test examples, with its Open section retained as defaults rather than silently promoted to user decisions.
- Original user brief in this conversation, no standalone URL: “Keep business rules separate from HTTP handling”, “Do not expose sensitive applicant data in logs”, “Handle division-by-zero and malformed JSON safely”, and “Use deterministic logic rather than calling a real LLM.”
- User confirmations in this conversation: “Yes, local interview. Simple application.”, “Fine. Let's reject zero.”, “Use JavaScript”, “Interget-only”, and “Go with 3000.” The integer selection refers to creditScore in the preceding Open item.
- User requested “Explain the trade-offs” for non-approval amount/reason granularity and then invoked tlc-plan. No explicit approval or delegation of those choices is inferred from that invocation.
- Workspace grounding: only `.design/underwriting-decision.md` exists outside git metadata at planning time. No existing application behavior contradicts the source. No architecture placement is fixed by this task.

This task is the record of decision. If a linked source diverges later, ask before building. No external messages or tracker records are created by this plan.

## Unresolved

All four entries are open, non-blocking defaults. They can be used provisionally as recorded, but must not be relabeled confirmed or replaced with a different product choice while building.

| # | Kind | Question | Until answered |
|---|---|---|---|
| 1 | open | Should REFER and DECLINE contain `approvedAmount: null` or omit approvedAmount? | Recommend and provisionally use null, preserving an explicit, consistent shape. User has received the trade-off explanation but has not explicitly chosen. |
| 2 | open | Should reasons contain one highest-severity tier per factor or both breached thresholds? | Recommend and provisionally use one highest-severity reason per factor, ordered credit/DTI/LTV. The mixed case in criterion 6 then returns CREDIT_SCORE_BELOW_600, DTI_ABOVE_040, LTV_ABOVE_080. Do not suppress distinct factors. |
| 3 | open | Retain the remaining input/runtime defaults in the source? | Retain positive fractional money, no invented credit-score maximum, ignored extra fields, and built-in Node.js modules with no third-party dependencies. These are safe defaults, not new user confirmations. |
| 4 | open | Retain source HTTP defaults and standard local command/documentation behavior? | Keep the source's 16 KiB limit, JSON error envelope, and documented statuses. Source-unspecified codes default to NOT_FOUND, METHOD_NOT_ALLOWED, INTERNAL_ERROR with fixed non-sensitive messages. No application CLI flags; one fixed startup URL line, terse sanitized startup failure, nonzero failure exit. Use default test-runner output and failure exit behavior. README tone is concise instructional English. These diagnostic defaults remain provisional and are not new numbered criteria. |
