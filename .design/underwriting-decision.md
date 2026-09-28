# Underwriting decision service

> Ready for task planning with **tlc-plan**. This document specifies the implementation; it does not implement the service.
> User requirements and confirmations are distinguished from reversible design defaults below.

## Situation

- Project: new, local interview application. The workspace has no application files and no commits.
- Decision: committed by the user in the brief, confirmed as a simple local interview exercise on 2026-09-28.
- In flight: no existing implementation to integrate with in this workspace.
- At stake: correctness against the exercise, clarity during a live demonstration, and simple startup. Design choices are locally reversible.
- Environment observed: Node.js 22.15.0 and npm 11.3.0.

## Problem

This construction task must demonstrate that an internal application can submit five numeric inputs and receive a deterministic underwriting recommendation with calculated metrics and complete explanations. Without the service, the required API demonstration and frontend integration contract remain unavailable. The supplied exercise fixes the business rules; this discovery resolves their implementation shape and documents edge cases.

## Evidence

- The supplied input yields monthly income 10000, DTI 0.25, LTV 0.70, APPROVE, and approvedAmount 280000.
- The user explicitly confirmed rejection of zero for all five fields, including monthlyDebt.
- APPROVE requires LTV <= 0.80. Consequently the approved amount equals requestedLoan under the current rules, although the specified minimum calculation remains explicit.
- No production volume or performance benchmark is needed to choose the shape of this local exercise.

## Journey

The brief establishes submission, validation, evaluation, and display. The following error and display details are reversible design defaults, not additional user-confirmed requirements.

1. The caller submits the five fields to POST /api/underwriting/decision.
2. Missing, malformed, or invalid input produces HTTP 400 with an actionable error. No decision is produced from invalid input.
3. Valid input produces HTTP 200 for APPROVE, REFER, or DECLINE. A declined application is a valid evaluation, not an HTTP failure.
4. The caller displays the decision, both metrics, every returned reason, and the approved amount only for APPROVE.
5. After correcting input, the caller resubmits. Repeating the same valid input returns the same response content. No applicant state is retained.
6. A frontend may clear a previous result when submitting again, show a loading state, and distinguish validation errors from connection/server failures. REFER means manual review is needed; it does not create a review task in this exercise.

## Verdict

Already committed: see Situation.

Cheaper paths considered: a standalone calculator cannot satisfy the REST deliverable; a static response cannot demonstrate the specified rules; an external service conflicts with the exercise constraints.

## Success

- Worked if: during the local demonstration, a caller can submit valid and invalid examples and understand the recommendation from the returned metrics and reasons, without reading the implementation or recalculating the rules.

## Boundary

In: one endpoint, strict input validation, a pure decision function, deterministic reasons, automated tests, one-command local startup, and a short React/Angular integration note.

Out: database, applicant history, authentication, deployment, real lending policies, a production UI, external services, actual LLM calls, and manual-review workflow implementation. These are outside the confirmed local exercise.

## Shape

Use one JavaScript ES-module application with Node.js built-in HTTP handling, test runner, and assertions. This avoids dependency installation and compilation while keeping the rules independently testable. The installed runtime exposes all three required built-in modules.

The flow is HTTP parsing and validation, then a pure decision function, then JSON serialization. No service layer, repository layer, or dependency-injection container is needed for this single operation.

### Adds

- `package.json`: ES modules; `npm start` runs `node src/server.js`; `npm test` runs `node --test`. No third-party dependencies.
- `src/server.js`: listen on `127.0.0.1:3000`; no listening as a side effect of importing the HTTP handler.
- `src/http.js`: exported handler, route matching, bounded body reading, JSON parsing, validation/error mapping, and response serialization.
- `src/validation.js`: `validateApplication(value)` returns normalized input or field errors. The decision function also uses this validation so direct callers cannot bypass the invariant.
- `src/decision.js`: `evaluateApplication(input)` calculates metrics, collects all factors, chooses a decision, and returns the result. Invalid direct input raises a typed validation error; no network, logging, clock, randomness, or state.
- `test/decision.test.js`: outcome, threshold, mixed-factor, validation, and determinism tests.
- `test/http.test.js`: actual local HTTP requests against an ephemeral port, including malformed JSON and successful/error response contracts. Close the server after testing.
- `README.md`: prerequisites, `npm start`, `npm test`, example requests, rule summary, design defaults, and frontend integration note.

### Leaves

- Persistence, UI implementation, authentication, deployment, and LLM integration remain outside scope.

A framework-backed, configurable rules service would win if this were growing into multiple endpoints or multiple independently maintained policy sets. Neither is part of this exercise. The proposed shape would need revisiting for policy administration, durable audit history, or real multi-user deployment; the pure evaluator could remain reusable.

## Roadmap

One block, **clear**: implement and demonstrate the complete local decision endpoint, including the independent evaluator, validation, automated tests, and README. The defaults in Open are reversible within this block; no RFC or spike is needed for the confirmed scope.

## Decisions

| Decision | Choice | Basis and reason | Alternative and condition for change | Reversibility |
|---|---|---|---|---|
| Delivery | Local service; no database or external calls | User-confirmed interview scope | Deployment only under a new scope | Reversible |
| Input zeros | All five fields must be greater than zero | Explicit user confirmation | Allow zero debt only if the requirement changes | Reversible |
| Runtime | JavaScript ES modules, Node.js built-ins, no third-party dependencies | JavaScript confirmed by user; built-ins remain the minimal implementation default | TypeScript if compilation/type checking becomes an evaluation preference | Reversible |
| Credit score type | Positive integer | User confirmed integer-only credit scores | Fractional scores only with a changed requirement | Reversible |
| Local port | 3000 | Explicit user confirmation | Another port if the local environment requires it | Reversible |
| HTTP contract | POST /api/underwriting/decision; 200 for all valid decisions; 400 for invalid requests | Brief plus error-shape defaults below | Different route or error format only with a consumer requirement | Reversible |
| Rule precedence | DECLINE > REFER > APPROVE | Explicit brief | No alternative within this exercise | Reversible |
| Boundaries | Strict `<` for credit rules and `>` for ratio rules | Explicit brief; equality is not a breach | Inclusive thresholds require a changed brief | Reversible |
| Approved amount | `Math.min(requestedLoan, propertyValue * 0.8)` only on APPROVE | Explicit brief | No alternative within this exercise | Reversible |
| Non-approval amount | `approvedAmount: null` for REFER and DECLINE | Default: explicit absence of an approval | Omit the field if a future consumer requires it | Reversible |
| Reasons | One most-severe breached tier per factor, all affected factors, fixed credit/DTI/LTV order | Default interpretation of every non-ideal factor; avoids duplicate explanations | Include both nested thresholds only if a consumer needs a rule trace | Reversible |
| Explanation boundary | Stable codes, severity, and deterministic message; no applicant input echo | Brief plus default reason shape | Future explanation layer may consume the result but cannot alter it | Reversible |
| Logging | No request bodies, applicant values, response bodies, or parser exception text in logs | Brief; parser exceptions may contain input fragments | No relaxation required by this task | Reversible |

### Input contract

Require a top-level JSON object, not null or an array, with these five fields: `annualIncome`, `monthlyDebt`, `propertyValue`, `requestedLoan`, `creditScore`.

- Each value must be a JSON number, finite, and strictly greater than zero. Reject strings, booleans, null, missing values, and negative or zero values; do not coerce strings.
- User-confirmed: creditScore must also be an integer. Do not invent a credit-score scale or maximum absent from the brief.
- Design default: accept positive fractional monetary values without imposing a currency, decimal-place limit, or financial ceiling.
- Validate that monthly income and calculated ratios are finite, that monthly income is greater than zero, and that calculated ratios are greater than zero. Reject unrepresentable arithmetic rather than serializing Infinity, NaN, or underflowed zero.
- Design default: ignore extra properties and construct a fresh input containing only the five supported fields. Never echo unknown properties.
- Collect field errors in the fixed field order shown above. Return field names and expected constraints, without reflecting submitted values.

### Evaluation and boundaries

Calculate `debtToIncome = monthlyDebt / (annualIncome / 12)` and `loanToValue = requestedLoan / propertyValue`. Compare the calculated numbers without rounding. Return the calculated numeric ratios; frontend formatting does not influence the decision. This exercise uses JavaScript number arithmetic, not an exact-decimal accounting model.

| Factor | DECLINE tier | REFER tier when not in DECLINE tier | Ideal |
|---|---|---|---|
| Credit score | `< 600` | `>= 600` and `< 680` | `>= 680` |
| Debt-to-income | `> 0.50` | `> 0.40` and `<= 0.50` | `<= 0.40` |
| Loan-to-value | `> 0.90` | `> 0.80` and `<= 0.90` | `<= 0.80` |

Collect every non-ideal factor before selecting the overall decision. Any DECLINE reason determines DECLINE; otherwise any REFER reason determines REFER; otherwise APPROVE. A decline does not suppress other factors that independently require referral.

### Response contract

```json
{
  "decision": "APPROVE",
  "approvedAmount": 280000,
  "metrics": { "debtToIncome": 0.25, "loanToValue": 0.7 },
  "reasons": []
}
```

Reason objects contain `code`, `severity` (`REFER` or `DECLINE`), and `message`. Messages describe the threshold without echoing applicant values.

| Code | Severity | Message |
|---|---|---|
| CREDIT_SCORE_BELOW_600 | DECLINE | Credit score is below 600. |
| CREDIT_SCORE_BELOW_680 | REFER | Credit score is below 680 and requires manual review. |
| DTI_ABOVE_050 | DECLINE | Debt-to-income ratio exceeds 50%. |
| DTI_ABOVE_040 | REFER | Debt-to-income ratio exceeds 40% and requires manual review. |
| LTV_ABOVE_090 | DECLINE | Loan-to-value ratio exceeds 90%. |
| LTV_ABOVE_080 | REFER | Loan-to-value ratio exceeds 80% and requires manual review. |

Validation error example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "monthlyDebt", "message": "Must be a finite number greater than zero." }
    ]
  }
}
```

Malformed JSON uses HTTP 400 with code `MALFORMED_JSON`, a fixed message `Request body must be valid JSON.`, and `details: []`. Do not expose the parser error. Empty bodies also receive this response.

HTTP design defaults: require `application/json` (allowing charset parameters), limit the body to 16 KiB, and return 400 with `UNSUPPORTED_CONTENT_TYPE` or `REQUEST_TOO_LARGE` for these invalid requests. Use 404 for an unknown path, 405 with `Allow: POST` for another method on this path, and a generic 500 for unexpected errors. Handle an aborted request without an uncaught exception. All error responses share the envelope above and use JSON content type.

### Verification

Use the supplied example as the base input; vary one field unless specified otherwise.

| Case | Change | Expected |
|---|---|---|
| Approval | None | APPROVE, 280000, DTI 0.25, LTV 0.7, no reasons |
| Credit decline | creditScore 599 | DECLINE, null amount, CREDIT_SCORE_BELOW_600 |
| Credit referral | creditScore 650 | REFER, null amount, CREDIT_SCORE_BELOW_680 |
| Credit boundaries | 600 and 680 | REFER and APPROVE respectively |
| DTI boundaries | monthlyDebt 4000, 5000, 5001 | APPROVE, REFER, DECLINE respectively |
| DTI referral just above boundary | monthlyDebt 4001 | REFER |
| LTV boundaries | requestedLoan 320000, 360000, 360001 | APPROVE, REFER, DECLINE respectively |
| LTV referral just above boundary | requestedLoan 320001 | REFER |
| Mixed factors | creditScore 599, monthlyDebt 4500, requestedLoan 340000 | DECLINE with three reasons in credit/DTI/LTV order |
| Validation | Each field missing, zero, negative, null, string, boolean | Field-specific 400 through HTTP; typed validation error directly |
| Numeric edge cases | Fractional credit score, overflow/underflow examples | Validation error; no non-finite metrics |
| Parsing | Malformed JSON, empty body, array, null | 400; process remains available for the next valid request |
| HTTP defaults | Wrong media type, oversized body, wrong path/method | Documented status and error code |
| Repeatability | Same input evaluated twice | Deeply equal output; input unchanged |

At minimum, exercise one successful evaluation and malformed JSON through real local HTTP, in addition to direct evaluator tests. Validate all stated HTTP defaults. Running `npm test` must not leave a server listening. During the demonstration, start with `npm start` and send the README sample request.

### Frontend and future explanations

A React component can submit the numeric form values using `fetch`; an Angular service can use `HttpClient.post`. In either case, send JSON to the endpoint and render the server-provided decision, DTI/LTV as percentages, all reason messages, and an amount only when approvedAmount is non-null. Surface 400 details beside fields; present connection and 500 failures as retryable errors. Client-side validation improves feedback, but the server remains authoritative.

Use a frontend development proxy to the local service so the browser can call the relative `/api` path without adding a CORS policy to this exercise. No frontend project is required.

A future LLM layer could receive the decision, metrics, and structured reasons to draft an explanation. It must preserve the recommendation and amounts, and the application must remain able to display the deterministic messages if explanation generation fails. No LLM adapter, prompt, credential, or dependency is implemented now.

## Open

JavaScript, integer-only credit scores, and port 3000 are now user-confirmed. Remaining low-impact defaults:

1. No invented credit-score maximum, unrestricted positive fractional money, and ignored extra fields.
2. `approvedAmount: null` for non-approvals and one highest-severity reason per factor in a fixed order. The user requested explanation of these trade-offs; they remain proposals pending that discussion.
3. A 16 KiB request limit and the documented error envelope/status defaults.

For non-approvals, null explicitly represents absence of an approved amount and preserves a consistent response shape. Omitting the field makes its presence conditional on approval but requires clients to handle an absent property. Zero is not recommended because it suggests a calculated amount rather than absence of approval.

For reasons, one highest-severity reason per factor avoids duplicate explanations: a credit score of 580 yields CREDIT_SCORE_BELOW_600, not both credit codes. Returning both thresholds provides a fuller trace of threshold breaches but may misleadingly suggest two independent problems or both referral and decline actions for the same factor. All distinct non-ideal factors are returned under either approach; deduplication never suppresses debt or LTV reasons because credit already caused a decline.

## Sources

- User-provided underwriting exercise in this conversation: endpoint, calculations, thresholds, minimum approved amount, validation, tests, and operational constraints.
- User confirmations: “Yes, local interview. Simple application.” and “Fine. Let's reject zero.”
- Subsequent user selections: JavaScript, integer-only credit scores, and port 3000; requested trade-off explanation for non-approval amount and reason granularity.
- Workspace inspection on 2026-09-28: no application files or commits; Node.js 22.15.0 and npm 11.3.0. Local import checks confirmed built-in HTTP, test, and assertion modules are available.
- Official Node.js documentation lookup was attempted but inaccessible through the web tool. No external benchmark or unverified documentation claim was used to choose the architecture.
