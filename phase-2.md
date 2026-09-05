# RecoverAI — Phase 2: Recovery Decision Engine

> **Track 03 — AI Revenue Recovery (Hackathon MVP)**  
> **Status**: Completed & Verified  
> **Notice**: Analytical and decision layer only. Zero payment execution is performed in Phase 2.

---

## 1. Objective

The primary objective of Phase 2 is to build the **deterministic Recovery Decision Engine** for RecoverAI.

The engine analyzes at-risk payments (failed authorizations and abandoned checkouts) and answers eight foundational operational questions:
1. **What happened?** (Root cause diagnosis)
2. **Is recovery potentially possible?** (Classification)
3. **What intervention is appropriate?** (Action recommendation)
4. **Why is that intervention appropriate?** (Customer history & context reasoning)
5. **How confident is the decision?** (Calibrated confidence score between 0.0 and 1.0)
6. **What policy permits the action?** (Governing policy rule)
7. **When must the system stop?** (Explicit stopping condition)
8. **Should the case be escalated to a human?** (Escalation safety boundary)

Phase 2 produces **decisions only**. No live gateway APIs are called, no payments are retried, and no database payment records have their status changed.

---

## 2. Phase 1 Context

Phase 1 established the data and operational baseline for RecoverAI:
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (Strict Mode).
- **Styling**: Tailwind CSS v4 with custom dark fintech aesthetics and Lucide icons.
- **Database**: Local SQLite via Node.js native `node:sqlite` (`DatabaseSync`), requiring zero external daemons or native build tools.
- **Dataset**: 200 deterministic synthetic Indian merchant records generated via Mulberry32 PRNG (seed `#4242`).
- **Baseline Metrics**: 151 failed transactions, 20 abandoned checkouts, 20 successful transactions, 9 pending transactions (~₹18,87,975 revenue at risk).
- **Core Endpoints**: `GET /api/payments`, `GET /api/payments/[id]`, `GET /api/payments/summary`.
- **UI**: Operations dashboard, interactive payments ledger, search/filtering, and payment inspector modal.

Phase 2 builds directly upon this foundation without breaking or rewriting existing Phase 1 components.

---

## 3. Recovery Workflow

The engine follows a strict multi-stage deterministic pipeline:

```
┌─────────────────────────────────────────────────────────┐
│                         DETECT                          │
│   Ingest at-risk transaction (failed / abandoned)       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                        DIAGNOSE                         │
│   Evaluate failure reason (timeout, bank_decline, etc.) │
│   Analyze customer repayment history & reputation       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                         DECIDE                          │
│   Formulate proposed action, confidence, & risk level   │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    POLICY VALIDATION                    │
│   Evaluate against centralized policy thresholds        │
│   Enforce retry caps, expired method rules, & stops     │
│   OVERRIDE proposed action if policy boundary breached  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     FINAL DECISION                      │
│   Output strongly typed RecoveryDecision object         │
│   (Zero execution; ready for review or audit)           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Decision Model

The decision output is governed by the strongly typed `RecoveryDecision` interface in [`src/lib/recovery/types.ts`](file:///d:/PROJECTS/RecoverAI/src/lib/recovery/types.ts):

```typescript
export interface RecoveryDecision {
  payment_id: string;
  classification: 'recoverable' | 'unlikely_recoverable' | 'requires_escalation';
  diagnosis: string;
  action: 'retry_payment'
        | 'contact_customer'
        | 'request_payment_method_update'
        | 'escalate_to_human'
        | 'do_nothing';
  confidence: number;       // Bounded float [0.0, 1.0]
  reason: string;           // Detailed rationale explaining history and context
  policy_rule: string;      // Specific governance policy identifier and clause
  stop_condition: string;   // Mandatory stopping rule
  risk_level: 'low' | 'medium' | 'high';
  policy_overridden: boolean; // Flag indicating if policy modified original proposal
  original_action?: RecoveryAction; // Unsafe action proposed before policy override
}
```

---

## 5. Supported Actions

The engine supports a closed, explicit set of 5 actions:

| Action | Description | When Recommended |
| :--- | :--- | :--- |
| `retry_payment` | Submit transaction for automatic re-attempt | Transient gateway timeouts or temporary upstream errors on healthy accounts below retry limit. |
| `contact_customer` | Issue automated customer communication (SMS, WhatsApp, email) | Insufficient account funds, 3DS authentication/OTP drops, and commercial checkout abandonment. |
| `request_payment_method_update` | Send secure link to add an active payment instrument | Expired credit/debit cards or invalid payment instruments. Automated retry is strictly prohibited. |
| `escalate_to_human` | Route case to finance / operations queue | Repeated bank declines, chronic failure history, high-value risk threshold breached, or retry caps reached. |
| `do_nothing` | Halt all automated processing | Terminal state reached (already settled), or active pending settlement awaiting gateway webhook. |

---

## 6. Diagnosis Rules

Deterministic diagnosis logic is isolated in [`src/lib/recovery/diagnosis.ts`](file:///d:/PROJECTS/RecoverAI/src/lib/recovery/diagnosis.ts):

### 1. `timeout`
- **Root Cause**: Transient gateway or network latency during authorization handshake.
- **Rules**:
  - If attempts < `MAX_AUTOMATIC_RETRIES` (2): classification = `recoverable`, action = `retry_payment`, risk = `low` (or `medium` if customer history is poor).
  - If attempts >= `MAX_AUTOMATIC_RETRIES`: classification = `requires_escalation`, action = `escalate_to_human`. Automatic retries are halted.

### 2. `gateway_error`
- **Root Cause**: Upstream 5xx response or acquirer interchange degradation.
- **Rules**:
  - If attempts < `MAX_AUTOMATIC_RETRIES` (2): classification = `recoverable`, action = `retry_payment`.
  - If repeated attempts: classification = `requires_escalation`, action = `escalate_to_human`, risk = `high`.

### 3. `bank_decline`
- **Root Cause**: Card issuer or core banking system refused authorization.
- **Rules**:
  - Never blindly retry bank declines.
  - If attempt == 1 **AND** customer has strong lifetime history (>= 3 successes, >= 70% success rate): limited conservative retry permitted (`retry_payment`, risk = `medium`).
  - If attempt >= 2 or weak customer history: classification = `requires_escalation`, action = `escalate_to_human`, risk = `high`.
  - Moderate/new customer: action = `contact_customer` to advise checking with card issuer.

### 4. `insufficient_funds`
- **Root Cause**: Account balance or UPI linked bank balance insufficient at execution time.
- **Rules**:
  - Do not aggressively retry.
  - If attempt < `MAX_AUTOMATIC_RETRIES`: action = `contact_customer` to allow balance top-up.
  - If attempts >= `MAX_AUTOMATIC_RETRIES`: action = `escalate_to_human`.

### 5. `expired_card`
- **Root Cause**: Card validity date has expired.
- **Rules**:
  - Automatic retry is mathematically guaranteed to fail.
  - Action = `request_payment_method_update`, classification = `recoverable`, confidence = 0.98, risk = `low`.

### 6. `authentication_failure`
- **Root Cause**: Cardholder 3D Secure / OTP verification challenge timed out or failed.
- **Rules**:
  - Requires customer action; background retries cannot bypass mandatory 2FA.
  - Action = `contact_customer` (or `escalate_to_human` if chronic attempts), classification = `recoverable`.

### 7. `checkout_abandoned`
- **Root Cause**: Commercial dropoff before entering payment instrument.
- **Rules**:
  - Not a technical failure; treated as a revenue recovery opportunity.
  - Action = `contact_customer`, classification = `recoverable`, risk = `low`.

---

## 7. Customer History

Customer lifetime payment history directly modulates decision confidence, risk tiering, and permitted interventions:
- **Lifetime Fields Evaluated**: `previous_successful_payments`, `previous_failed_payments`, total history, success ratio, and `subscription_status`.
- **Strong History** (`previous_successful_payments >= 3` and `successRate >= 70%`):
  - Elevates decision confidence (e.g. 0.95 vs 0.78 for transient timeouts).
  - Permits a single bounded retry recommendation on first-time bank declines.
  - Contextualized in `reason`: *"High-reputation customer with strong historical track record..."*
- **Weak History** (`previous_failed_payments >= 2` and `successRate < 50%`):
  - Elevates risk tier from `low` to `medium` or `high`.
  - Prohibits bank decline retry recommendations.
  - Contextualized in `reason`: *"Elevated risk customer with poor historical track record..."*

---

## 8. Policy Configuration

All governance thresholds are centralized in [`src/lib/recovery/policy.ts`](file:///d:/PROJECTS/RecoverAI/src/lib/recovery/policy.ts) inside `RECOVERY_POLICY_CONFIG`:

```typescript
export const RECOVERY_POLICY_CONFIG = {
  MAX_AUTOMATIC_RETRIES: 2,                 // Global hard cap on automatic retries
  MAX_BANK_DECLINE_RETRIES: 1,              // Maximum retry attempts for bank declines
  HIGH_VALUE_THRESHOLD: 50000,              // Transactions >= ₹50,000 require human escalation on repeated failure
  STRONG_HISTORY_MIN_SUCCESSES: 3,          // Minimum past successes for strong reputation
  POOR_HISTORY_FAILURE_RATIO_THRESHOLD: 0.5 // Failure ratio threshold for elevated risk
} as const;
```

---

## 9. Stop Conditions

Every decision must supply a verifiable, non-empty `stop_condition`. Recommendations without a stopping rule are considered incomplete and invalid.

Implemented stop conditions:
- **Retry Bound**: *"Stop automatic retries after 2 attempts. Escalate to operations team."*
- **Expired Instrument**: *"Do not retry expired payment methods. Await cardholder instrument update."*
- **Bank Decline Safeguard**: *"Escalate after repeated bank declines. Do not spam issuing bank."*
- **3DS Authentication**: *"Do not automatically retry authentication failures indefinitely. Customer intervention required."*
- **Customer Outreach**: *"Stop outreach after 3 unanswered notifications or upon customer response."*
- **Subscription Guard**: *"Subscription canceled; cease autonomous recovery attempts."*
- **High-Value Exposure**: *"High-value transaction threshold exceeded; require supervisor clearance."*

---

## 10. Policy Validation & Safety Boundary

The Policy Validation layer (`validateDecision`) serves as the strict safety boundary.

### Override Priority
If any proposed decision violates a policy rule, the policy validator **rejects** the proposal and **overrides** the final action:
1. **Retry on Expired Card**: Policy intercepts and overrides `retry_payment` → `request_payment_method_update`.
2. **Retry Cap Exceeded** (`attempt_count >= 2`): Policy intercepts and overrides `retry_payment` → `escalate_to_human`.
3. **Repeated Bank Declines**: Policy intercepts and overrides `retry_payment` → `escalate_to_human`.
4. **Retry on Authentication Failure**: Policy intercepts and overrides `retry_payment` → `contact_customer`.
5. **Canceled Subscriptions**: Policy intercepts and halts retry proposals.
6. **High Value (> ₹50,000) with Retries**: Policy routes to `escalate_to_human`.

When overridden, `policy_overridden: true` and `original_action` are attached to the audit record.

---

## 11. APIs

### 1. Single Payment Recovery Decision
- **Endpoint**: `GET /api/payments/[id]/decision`
- **Method**: `GET`
- **Description**: Evaluates deterministic recovery assessment for a single payment. Read-only; zero mutation.
- **Sample Request**:
  ```bash
  curl http://localhost:3000/api/payments/pay_rec_0200/decision
  ```
- **Sample Response**:
  ```json
  {
    "success": true,
    "data": {
      "payment_id": "pay_rec_0200",
      "classification": "requires_escalation",
      "diagnosis": "Persistent bank decline recorded after 3 attempts or elevated customer risk profile.",
      "action": "escalate_to_human",
      "confidence": 0.89,
      "reason": "Repeated bank declines or weak customer history indicates issuer block or insufficient limits. Autonomous retry aborted. Elevated risk customer with poor historical track record (8 past failures vs 0 successes, 0% success rate).",
      "policy_rule": "POL-100: Standard Autonomous Recovery Policy Permitted.",
      "stop_condition": "Escalated to human operator; autonomous agent pauses actions.",
      "risk_level": "high",
      "policy_overridden": false
    }
  }
  ```

### 2. Batch Recovery Risk Analysis
- **Endpoint**: `POST /api/recovery/analyze` (also supports `GET`)
- **Method**: `POST`
- **Description**: Runs deterministic decision engine across at-risk payments and aggregates operational telemetry.
- **Sample Request**:
  ```bash
  curl -X POST http://localhost:3000/api/recovery/analyze
  ```
- **Sample Response**:
  ```json
  {
    "success": true,
    "data": {
      "metrics": {
        "payments_analyzed": 171,
        "recoverable_count": 79,
        "unlikely_recoverable_count": 0,
        "escalation_count": 92,
        "retry_recommendation_count": 18,
        "customer_contact_count": 41,
        "payment_method_update_count": 20,
        "do_nothing_count": 0,
        "total_revenue_at_risk": 1887975,
        "potentially_recoverable_value": 627234
      }
    }
  }
  ```

---

## 12. Batch Metrics

| Metric | Type | Description |
| :--- | :--- | :--- |
| `payments_analyzed` | `number` | Total count of at-risk transactions processed (171 failed & abandoned). |
| `recoverable_count` | `number` | Count of payments classified as potentially recoverable (79). |
| `unlikely_recoverable_count` | `number` | Count of payments deemed unlikely to recover (0). |
| `escalation_count` | `number` | Count of payments requiring operations escalation (92). |
| `retry_recommendation_count`| `number` | Payments where safe transient retry is recommended (18). |
| `customer_contact_count` | `number` | Payments where customer notification is recommended (41). |
| `payment_method_update_count`| `number` | Payments requiring replacement card/instrument update (20). |
| `do_nothing_count` | `number` | Terminal or in-flight holds (0). |
| `total_revenue_at_risk` | `number` (INR) | Total volume of failed and abandoned transactions (₹18,87,975). |
| `potentially_recoverable_value` | `number` (INR) | Model estimate of salvageable volume (₹6,27,234). **NOT** labeled as recovered revenue. |

---

## 13. UI Changes

1. **Payment Detail Inspector Modal** ([`PaymentDetailModal.tsx`](file:///d:/PROJECTS/RecoverAI/src/components/PaymentDetailModal.tsx)):
   - Added a new **"Recovery Assessment"** panel.
   - Displays:
     - Classification badge (`Recoverable`, `Requires Escalation`, `Unlikely Recoverable`).
     - Root-cause diagnosis.
     - Recommended Action pill with distinctive icon.
     - Calibrated confidence percentage & Risk level indicator.
     - Contextual reason explaining customer reputation and attempt count.
     - Governing Policy Rule code (`POL-001`, `POL-003`, etc.).
     - Explicit Stop Condition.
     - Policy Override warning banner when a recommendation was intercepted and modified.
     - Phase 2 scope disclaimer: *"Decision-only evaluation &bull; Autonomous execution inactive in Phase 2"*.

2. **Operations Dashboard** ([`page.tsx`](file:///d:/PROJECTS/RecoverAI/src/app/page.tsx)):
   - Added **"Analyze Revenue Risk"** primary button to header.
   - Renders **"Revenue Risk Assessment"** batch triage panel with:
     - 4 metric cards: Payments Analyzed, Potentially Recoverable, Requires Escalation, and Potential Recovery Value.
     - Action breakdown chips (`retry_payment`, `contact_customer`, `request_payment_method_update`, `escalate_to_human`, `do_nothing`).
     - Mandatory financial governance disclaimer.
   - Updated header badge: `Phase 2 • Decision Engine`.

---

## 14. Testing & Verification

### Automated Test Suite
- Test script: [`scripts/test_decision_engine.mjs`](file:///d:/PROJECTS/RecoverAI/scripts/test_decision_engine.mjs)
- Run command: `npm test` (executes both Phase 1 verification and Phase 2 decision engine tests).
- Results: **19/19 tests passed (100%)**.

### Required Scenarios Verified:
1. **Timeout + healthy customer**: Recommends `retry_payment` (`recoverable`, `low` risk).
2. **Gateway error + healthy customer**: Recommends `retry_payment`.
3. **Timeout + max attempts (2)**: Rejects retry; escalates to human operator.
4. **Gateway error + max attempts (2)**: Rejects retry; escalates to human operator.
5. **Expired card**: Recommends `request_payment_method_update`; strictly prohibits retry.
6. **Insufficient funds (1st attempt)**: Recommends `contact_customer`; avoids blind retries.
7. **Repeated insufficient funds**: Recommends `escalate_to_human`.
8. **Authentication failure**: Recommends customer involvement; never automatically loops.
9. **Checkout abandonment**: Recommends `contact_customer` as commercial opportunity.
10. **Repeated bank declines**: Escalates to human; prevents issuing bank spam.
11. **Strong payment history**: Elevates confidence (0.95 vs 0.78) and explains context in reason.
12. **Poor payment history**: Elevates risk tier to `medium`/`high` and limits aggressive actions.
13. **Policy override enforcement**: Policy validator intercepts invalid retry actions and forces safe alternative.
14. **Stop condition completeness**: All 7 failure types produce verified, non-empty stopping rules.
15. **Confidence boundedness**: All confidence values strictly bounded between `0.0` and `1.0`.
16. **Database batch telemetry**: Accurately processes 171 at-risk transactions.
17. **Financial accounting accuracy**: Potentially Recoverable Value (₹6,27,234) <= Total Revenue at Risk (₹18,87,975).
18. **Action distribution completeness**: Action sum matches analyzed total exactly (171).
19. **Read-only invariant**: Zero database modifications occur (20 successful payments remain untouched).

---

## 15. Completed Deliverables

- [x] Strongly typed decision model (`RecoveryDecision`, `RecoveryAction`, `RecoveryClassification`, `RiskLevel`).
- [x] Closed set of 5 supported actions.
- [x] Deterministic diagnosis rules covering all 7 failure categories.
- [x] Customer history evaluator incorporating lifetime success/failure ratio and reputation.
- [x] Centralized policy configuration (`RECOVERY_POLICY_CONFIG`, `MAX_AUTOMATIC_RETRIES = 2`).
- [x] Policy validation layer with override authority.
- [x] Explicit stopping rules on all recommendations.
- [x] `GET /api/payments/[id]/decision` API endpoint.
- [x] `POST /api/recovery/analyze` batch analysis endpoint.
- [x] Batch decision metrics computation.
- [x] Payment Detail Inspector UI extension with "Recovery Assessment" panel.
- [x] Operations dashboard "Analyze Revenue Risk" button and batch analysis panel.
- [x] Comprehensive test suite covering all 15 required scenarios + batch/DB verification.
- [x] Zero external LLMs integrated (100% offline).
- [x] Zero payment execution performed (analytical recommendations only).
- [x] Consolidated test runner in `package.json`.
- [x] Production build passes with zero TypeScript or Next.js build errors.
- [x] `phase-2.md` and `README.md` updated.

---

## 16. Known Limitations

1. **Deterministic Heuristics**: Recommendations are currently computed via deterministic rules and customer historical weights rather than LLM reasoning (LLM abstraction planned for Phase 3).
2. **Fixed Retries**: `MAX_AUTOMATIC_RETRIES` is capped at 2 globally; dynamic retry windows based on time-of-day or merchant category are not yet modeled.
3. **No Execution**: Recommendations cannot yet trigger live or simulated webhooks, customer emails, or payment retries (execution planned for Phase 4).

---

## 17. Important Architectural Decisions

1. **Policy Engine as Supreme Safety Boundary**:
   - The policy engine MUST always execute *after* any proposed recommendation (whether algorithmic or from an LLM).
   - The policy engine retains absolute override authority over actions.
   - Future phases must never allow arbitrary action strings from an LLM or user to bypass `validateDecision()`.
2. **Strict Financial Semantics**:
   - `potentially_recoverable_value` is an algorithmic model estimate.
   - It must never be displayed as or combined with "recovered revenue" until Phase 4 execution and confirmation.
3. **Zero Native Build Dependencies**:
   - Native Node.js `node:sqlite` (`DatabaseSync`) ensures zero compilation issues on Windows, Linux, and macOS.
4. **Separation of Diagnosis vs Policy**:
   - Diagnosis answers *"What is probably happening?"*
   - Decision answers *"What would be a sensible intervention?"*
   - Policy answers *"Are we allowed to do that?"*

---

## 18. Phase 3 Preparation (LLM Architecture)

Phase 3 will introduce LLM-based root-cause diagnosis. Future phases must preserve the deterministic safety boundary created in Phase 2:

```
                  ┌──────────────────────┐
                  │    Payment Record    │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │      PHASE 3 LLM     │
                  │   Diagnosis Prompt   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    LLM PROPOSAL      │
                  │  ProposedDecision:   │
                  │  - action            │
                  │  - diagnosis         │
                  │  - reason            │
                  └──────────┬───────────┘
                             │
                             ▼
       ══════════════════════════════════════════════
       POLICY SAFETY BOUNDARY (ESTABLISHED IN PHASE 2)
       ══════════════════════════════════════════════
                             │
                             ▼
                  ┌──────────────────────┐
                  │   validateDecision   │
                  │ (Deterministic Rules)│
                  └──────────┬───────────┘
                             │
             ┌───────────────┴───────────────┐
             │                               │
         [Allowed]                      [Overridden]
             │                               │
             ▼                               ▼
     Execute LLM Action             Force Policy Safe Action
                                    (e.g. escalate_to_human)
```

By establishing `validateDecision()` and `RECOVERY_POLICY_CONFIG` in Phase 2, Phase 3 can safely experiment with local (Ollama) and cloud (OpenAI, Gemini) models without risking out-of-bounds payment retries or policy violations.
