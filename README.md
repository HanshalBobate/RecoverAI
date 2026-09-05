# RecoverAI — AI Revenue Recovery Controller

> **Track 03 — AI Revenue Recovery (Hackathon MVP)**  
> Detects revenue at risk, diagnoses payment failure root causes with an LLM reasoning layer, validates recommendations against deterministic policy safety rules, and executes bounded recovery interventions with strict idempotency and audit attribution.

---

## Current Phase

**Phase 5 — Production-Grade Demo Polish (Completed)**

> [!IMPORTANT]
> **CRITICAL GOVERNANCE STATEMENTS**:
> 1. **"Only policy-approved decisions may reach the execution layer."**  
>    The execution gate rejects any action not authorized by the Phase 2 deterministic policy engine. Neither raw LLM suggestions nor user-specified action strings can trigger execution.
> 2. **"Recovered Revenue is calculated exclusively from successful execution records."**  
>    $$\text{Recovered Revenue} = \sum \text{amount\_recovered} \quad (\text{WHERE } status = \text{'succeeded'})$$  
>    No money is counted as recovered based on AI confidence, recommendations, or analytical estimates.
> 3. **"Mock execution is synthetic test-mode behavior and does not represent real money movement."**  
>    All recovery executions operate strictly in test/demo mode (`mock` or `razorpay_test`). No real customer cards are charged, and no real WhatsApp/SMS/emails are dispatched.
> 4. **"Strict Concurrency & Idempotency Hardening."**  
>    An in-memory per-payment mutex and double-checked idempotency pattern guarantee that parallel requests, race conditions, or network retries never double-credit recovered revenue.

---

## The 5-Stage Governance Pipeline

```
DETECT (Phase 1 SQLite At-Risk Ingestion)
   ↓
DIAGNOSE (Phase 2 Deterministic Failure Classification & Context Reasoning)
   ↓
AI RECOMMENDATION (Phase 3 LLM Multi-Provider Reasoner: Mock / Ollama / OpenAI / Gemini)
   ↓
OUTPUT VALIDATION (Phase 3 Strict JSON Schema Guard & Enum Enforcement)
   ↓
POLICY VALIDATION (Phase 2 Supreme Deterministic Authority: POL-001 to POL-004)
   ↓
EXECUTION GATE (Phase 4 Hardware-Style Pre-Execution Guard & Idempotency Lock)
   ↓
RECOVERY ACTION (Phase 4 Bounded Mock / Razorpay-Test Executor)
   ↓
OUTCOME & ATTRIBUTION (Phase 4 Verified Attribution: Succeeded, Blocked, Escalated)
   ↓
AUDIT LEDGER (Phase 4 Immutable recovery_executions SQLite Table)
   ↓
ACCOUNTING TRANSPARENCY (Phase 5 Mathematical Invariants & Live Metrics)
```

---

## Execution Modes

| Mode | Environment Value | Requirements | Behavior | Real Money Movement |
| :--- | :--- | :--- | :--- | :--- |
| **Mock** (Default) | `RECOVERY_EXECUTION_MODE=mock` | None (100% Offline) | Deterministic synthetic simulation based on payment parameters and customer track record | **Zero (Simulated)** |
| **Razorpay Test** | `RECOVERY_EXECUTION_MODE=razorpay_test` | `RAZORPAY_KEY_ID` (starts with `rzp_test_`), `RAZORPAY_KEY_SECRET` | Isolated test adapter running against Razorpay sandbox endpoints | **Zero (Test Sandbox)** |

---

## Environment Variables

Configured in `.env` (template in [`.env.example`](file:///d:/PROJECTS/RecoverAI/.env.example)):

```env
# Execution Configuration: mock | razorpay_test
RECOVERY_EXECUTION_MODE=mock

# Razorpay Test Mode Credentials (Optional — Test keys only)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# LLM Provider Configuration: mock | ollama | openai | gemini
LLM_PROVIDER=mock

# Ollama Local LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# OpenAI Cloud LLM
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Google Gemini Cloud LLM
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

---

## Execution Safety Model (Defense in Depth)

```
BROWSER UI  ──▶  REST API  ──▶  POLICY VALIDATOR  ──▶  EXECUTION GATE  ──▶  EXECUTOR
```

1. **Server-Decided Actions**: The client sends only `{ payment_id }`. The client cannot specify or alter the action or amount.
2. **Untrusted LLM**: The executor never reads raw LLM output. Only policy-approved decisions reach the execution gate.
3. **Execution Gate**: Double-checks retry limits (`attempt_count >= 2`), expired cards, already-recovered transactions, and terminal states.
4. **Idempotency**: If a payment has already been successfully recovered, re-executing it returns `already_recovered` and never double-credits revenue.
5. **Original Ledger Preservation**: Original payment records in `payments` table are never mutated or destroyed. Every attempt is recorded as an immutable audit row in `recovery_executions`.

---

## Action Classification & Outcome Model

| Action | Execution Type | Outcome Status | Financial Accounting |
| :--- | :--- | :--- | :--- |
| `retry_payment` | Direct Test Retry | `succeeded` or `failed` | `+amount` if succeeded; ₹0 if failed |
| `contact_customer` | Out-of-band Link | `customer_action_required` | ₹0 (awaiting customer action) |
| `request_payment_method_update` | Instrument Update | `customer_action_required` | ₹0 (awaiting instrument update) |
| `escalate_to_human` | Operations Ticket | `escalated` | ₹0 (routed to manual queue) |
| `do_nothing` | Non-actionable Hold | `no_action` | ₹0 (no action taken) |

---

## REST APIs

### Phase 4 Endpoints
- `GET /api/payments/[id]/execution-preview`  
  Returns pre-execution parameters: proposed action, policy clearance, eligibility, execution mode, amount at risk, potential recovery, stop condition, and prior executions.
- `POST /api/recovery/execute`  
  Executes recovery for a single payment. Request payload: `{ payment_id: string }`. Server decides the action.
- `POST /api/recovery/execute-batch`  
  Executes bounded recovery actions across at-risk payments in batch. Idempotent on repeated executions.
- `GET /api/recovery/audit`  
  Returns recent persistent execution audit records and live execution metrics.

### Phase 3 Endpoints (Preserved)
- `GET /api/payments/[id]/ai-assessment` — LLM diagnosis + policy validation audit.
- `POST /api/recovery/ai-analyze` — Batch AI cohort triage.
- `GET /api/recovery/ai-analyze` — Query batch AI cohort triage.

### Phase 2 Endpoints (Preserved)
- `GET /api/payments/[id]/decision` — Deterministic decision engine assessment.
- `POST /api/recovery/analyze` — Deterministic batch cohort analysis.

### Phase 1 Endpoints (Preserved)
- `GET /api/payments` — Query filtered payments ledger.
- `GET /api/payments/[id]` — Fetch single payment record.
- `GET /api/payments/summary` — Descriptive status and volume aggregates.

---

## Quickstart & Verification

### 1. Seed SQLite Database
```bash
npm run db:seed
```

### 2. Run Automated Verification Suite (Phases 1, 2, 3, and 4)
```bash
npm test
```
Executes:
1. `scripts/verify.mjs` — Phase 1 schema, distributions, and scenario tests.
2. `scripts/test_decision_engine.mjs` — Phase 2 deterministic rules & policy engine tests (19 assertions).
3. `scripts/test_llm_provider.mjs` — Phase 3 LLM provider abstraction & safety tests (55 assertions).
4. `scripts/test_recovery_execution.mjs` — Phase 4 bounded recovery execution, idempotency, stopping rules, and revenue accounting tests (62 assertions).

### 3. Start Operations Console
```bash
npm run dev
# Or production server
npm run build && npm run start
```
Open [http://localhost:3000](http://localhost:3000).

---

## Interactive Evaluator Demo Scenarios (1-Click Quick-Launcher)

A dedicated toolbar at the top of the operations dashboard provides 1-click access to all critical evaluation paths:

### Scenario A: Clean Recovery
- **Trigger**: Click `Scenario A` button on dashboard (or inspect `pay_rec_0001`).
- **Telemetry**: Network timeout, healthy VIP customer (15 past successes, 0 failures).
- **Pipeline Flow**: Step 1 Detect &rarr; Step 2 Diagnose (90% Conf) &rarr; Step 3 Policy Gate (Approved under `POL-100`) &rarr; Step 4 Execution Gate (`PASSED`) &rarr; Step 5 Execute.
- **Outcome**: `✓ RECOVERY SUCCESSFUL` (+₹14,999 recovered, execution ID saved to SQLite, Recovered Revenue metric increases).

### Scenario B: Safety Override Block
- **Trigger**: Click `Scenario B` button on dashboard (or inspect `pay_rec_0200`).
- **Telemetry**: Attempt count (3) &ge; maximum allowed automatic retries (2).
- **Pipeline Flow**: Policy Gate enforces `POL-003` Hard Stop; overrides AI recommendation; forces `escalate_to_human`.
- **Outcome**: Execution Gate status is `BLOCKED`; `[ Execute Recovery ]` button is safely locked (`🔒 Execution Blocked`); zero revenue movement.

### Scenario C: Customer Action Required (Expired Instrument)
- **Trigger**: Click `Scenario C` button on dashboard (or inspect `pay_rec_0004`).
- **Telemetry**: Card expiration failure.
- **Pipeline Flow**: Policy Gate enforces `POL-002` Hard Stop (never retry expired instruments); forces `request_payment_method_update`.
- **Outcome**: `→ CUSTOMER ACTION REQUIRED`; updates queued via portal link; ₹0 attributed until customer adds new card.

### Scenario D: Idempotency & Double-Click Guard
- **Trigger**: Click `Scenario D` button on dashboard (or re-inspect `pay_rec_0001`).
- **Telemetry**: Transaction already successfully recovered in Scenario A.
- **Pipeline Flow**: Execution Gate detects prior success record via `getSuccessfulRecovery`; returns `eligibility: 'already_recovered'`.
- **Outcome**: Button displays `✓ Already Recovered`; re-execution via UI or API returns `already_recovered: true`; strictly zero duplicate revenue credited.

### Scenario E: Cart Abandonment Outreach
- **Trigger**: Click `Scenario E` button on dashboard (or inspect `pay_rec_0019`).
- **Telemetry**: Checkout abandonment.
- **Pipeline Flow**: AI recognizes drop-off intent; Policy authorizes customer outreach; queues payment link.
- **Outcome**: `→ CUSTOMER ACTION REQUIRED`; ₹0 attributed; cardholder contacted via link.

---

## Adversarial Security & Robustness Suite

Run the dedicated adversarial attack suite:
```powershell
npm run test:adversarial
```

Validates 10 attack vectors (33 automated assertions):
1. **Action Injection**: Client sends `{ action: "payout_now" }` &rarr; Server ignores client action; executes only policy decision.
2. **Amount Tampering**: Client sends `{ amount: 9999999 }` &rarr; Server ignores client amount; charges exact database amount.
3. **Negative Amount Clamp**: Negative or NaN values in payloads are safely sanitized and clamped to ₹0.
4. **Policy Bypass**: Attempting retry on expired card or attempt &ge; 2 is blocked by the Execution Gate.
5. **10-Thread Concurrent Race Condition**: Firing 10 parallel execution requests for the same payment results in exactly 1 execution and 9 idempotent rejections, crediting revenue strictly once.
6. **Non-Existent Payment IDs**: Safely returns 404 Not Found without uncaught exceptions.
7. **SQL Injection**: Parameterized SQL queries completely prevent SQL injection attacks.
8. **Tampered Mode**: Unsupported modes (`"production"`, `"live"`) safely clamp to `'mock'`.
9. **Multi-Cycle Idempotency**: 5 consecutive re-runs of the same payment yield zero change in total recovered revenue.
10. **Payments Table Immutability**: The original 200 payments table records remain 100% untouched and uncorrupted.

---

## Security & Governance Guardrails
- **Zero Live Credentials**: Rejects any Razorpay key lacking `rzp_test_`.
- **Client Sanitization**: Client cannot submit recovery amounts or action overrides.
- **Server-Side Secrets**: API keys are accessed strictly in server routes and never exposed in client JSON or audit tables.
- **Auditable Integrity**: Original payment states remain intact for financial compliance.
- **Transparent Accounting**: Click `[ Accounting Audit ]` in the dashboard to review the mathematical accounting invariant: `recovered_revenue = SUM(amount_recovered WHERE status = 'succeeded')`.

---

## Verification & Testing Commands

```powershell
# Run all 5 test suites (165+ assertions)
npm test

# Run adversarial security suite only
npm run test:adversarial

# Run TypeScript typecheck
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server
npm run start
```
