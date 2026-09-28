# Underwriting decision service

A local interview exercise using deterministic JavaScript rules and Node.js built-ins. No database, external services, dependencies, compilation, UI, or LLM calls.

## Run

Prerequisite: Node.js 22 or newer with npm, and port 3000 available.

```sh
npm start
```

The service binds to `127.0.0.1:3000`. Stop it with Ctrl+C. No `npm install` is needed. Startup failures print a fixed message and exit nonzero; applicant data and parser errors are never logged.

In another terminal:

```sh
curl -sS http://127.0.0.1:3000/api/underwriting/decision \
  -H 'Content-Type: application/json' \
  -d '{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}'
```

Request:
<!-- request -->
```json
{"annualIncome":120000,"monthlyDebt":2500,"propertyValue":400000,"requestedLoan":280000,"creditScore":720}
```

Expected HTTP 200 response:
<!-- response -->
```json
{"decision":"APPROVE","approvedAmount":280000,"metrics":{"debtToIncome":0.25,"loanToValue":0.7},"reasons":[]}
```

## Test

Stop the demonstration server first so port 3000 is available for startup tests.

```sh
npm test
```

Tests cover all outcomes, exact boundaries, mixed factors, validation, arithmetic extremes, real HTTP requests, aborted clients, logging, startup and documentation. HTTP contract tests use ephemeral ports and close their servers. Startup tests briefly use port 3000. The runner exits nonzero on failure.

## Rule summary

DTI = monthlyDebt / (annualIncome / 12). LTV = requestedLoan / propertyValue. Compare unrounded JavaScript numbers.

| Factor | DECLINE | REFER if not declined | Ideal |
| --- | --- | --- | --- |
| Credit score | < 600 | < 680 | >= 680 |
| DTI | > 0.50 | > 0.40 | <= 0.40 |
| LTV | > 0.90 | > 0.80 | <= 0.80 |

Any decline factor wins over referral; referral wins over approval. Every affected factor gets an explanation, even when another factor declines the application. Every valid decision returns HTTP 200. Approval returns `Math.min(requestedLoan, propertyValue * 0.8)`; high-LTV requests are referred or declined instead of downsized into approvals.

All five fields must be finite numbers greater than zero, including monthlyDebt. Credit score must be an integer. Monthly income and both calculated ratios must also remain finite and greater than zero. Numeric strings are rejected.

## Provisional defaults

The plan leaves these choices open and explicitly authorizes their interim use:

- REFER and DECLINE return `approvedAmount: null`.
- Reasons contain one highest-severity tier per factor, in credit/DTI/LTV order, with stable `code`, `severity` and `message` fields.
- Monetary fractions are accepted, credit scores have no invented maximum, and unknown input fields are ignored without echoing them.
- Requests require `application/json` with optional charset parameters and a maximum of 16384 bytes. Empty/malformed JSON, invalid input, unsupported content type and oversized bodies return 400.

Every error uses `{ "error": { "code": "...", "message": "...", "details": [] } }`. Validation details identify fields and constraints without reflecting values, in annualIncome, monthlyDebt, propertyValue, requestedLoan, creditScore order. For example:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed.","details":[{"field":"monthlyDebt","message":"Must be a finite number greater than zero."}]}}
```

Error codes are `VALIDATION_ERROR`, `MALFORMED_JSON`, `UNSUPPORTED_CONTENT_TYPE`, `REQUEST_TOO_LARGE`, `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405 with `Allow: POST`) and `INTERNAL_ERROR` (generic 500). No application CLI flags are provided.

## Frontend integration

A React form can use `fetch('/api/underwriting/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })`. Convert form strings to numbers and submit numeric JSON. Client validation improves feedback; server validation remains authoritative.

Show a loading state while awaiting the response and clear stale results on resubmission. Render the decision and all reason messages. Format both ratios as percentages for display, without using the rounded values for decisions. Display the approved amount only for APPROVE. Map 400 validation details to field errors; show other 400 messages at form level. Present connection and 500 failures as retryable errors. REFER means manual review is needed; this service does not create a review task.

Configure the frontend development proxy to forward `/api` to `http://127.0.0.1:3000`. This permits relative URLs without adding CORS to the exercise.

A future LLM may explain the returned decision, metrics and reasons, but must not determine or change the recommendation or approved amount. If explanation generation fails, display the deterministic reason messages. No LLM adapter is implemented.

## Code

`src/decision.js` exports the pure evaluator. `src/validation.js` exports shared validation and `ValidationError`. `src/http.js` exports the handler and a factory for testing internal failures, without opening a port. `src/server.js` owns startup. Inputs and results are request-local and are not persisted.
