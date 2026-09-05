# RecoverAI — AI Revenue Recovery Controller

> **Track 03 — AI Revenue Recovery (Hackathon MVP)**  
> An autonomous, policy-governed revenue recovery orchestration platform designed for high-throughput merchant payment infrastructures (UPI, RuPay, Visa, Mastercard, NetBanking).  
> **Detects** revenue at risk across merchant payment pipelines, **diagnoses** payment failure root causes using an LLM reasoning layer, **validates** proposals against deterministic policy safety rules, and **executes** bounded, idempotent recovery actions backed by an immutable SQLite audit ledger.

---

[![Node.js](https://img.shields.io/badge/Node.js-v24.14.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.0-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-Native_node%3Asqlite-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Tests](https://img.shields.io/badge/Automated_Tests-165%2B_Passing-success?logo=checkmarx&logoColor=white)](file:///d:/PROJECTS/RecoverAI/scripts)
[![Security](https://img.shields.io/badge/Adversarial_Defense-10_Vectors_Verified-blueviolet?logo=shield&logoColor=white)](file:///d:/PROJECTS/RecoverAI/scripts/test_adversarial.mjs)

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Core Architectural Principles & Safety Invariants](#2-core-architectural-principles--safety-invariants)
3. [The 5-Stage Governance Pipeline](#3-the-5-stage-governance-pipeline)
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
5. [The 10 Payment Failure Scenarios](#5-the-10-payment-failure-scenarios)
6. [LLM Provider Abstraction & Reasoning Layer](#6-llm-provider-abstraction--reasoning-layer)
7. [Deterministic Policy Engine & Stopping Rules](#7-deterministic-policy-engine--stopping-rules)
8. [Bounded Execution Layer & Defense in Depth](#8-bounded-execution-layer--defense-in-depth)
9. [Concurrency & Idempotency Hardening](#9-concurrency--idempotency-hardening)
10. [Accounting Integrity & Live Financial Metrics](#10-accounting-integrity--live-financial-metrics)
11. [Operations Console & UI Highlights](#11-operations-console--ui-highlights)
12. [1-Click Interactive Evaluator Demo Scenarios](#12-1-click-interactive-evaluator-demo-scenarios)
13. [Adversarial Security & Robustness Suite](#13-adversarial-security--robustness-suite)
14. [Complete REST API Reference](#14-complete-rest-api-reference)
15. [Codebase Map & Directory Structure](#15-codebase-map--directory-structure)
16. [Getting Started & Installation](#16-getting-started--installation)
17. [Verification & Automated Test Suites](#17-verification--automated-test-suites)
18. [Environment Variables & Configuration](#18-environment-variables--configuration)

---

## 1. Executive Summary & Problem Statement

In modern digital commerce and subscription businesses, **5% to 15% of checkout transactions fail or are abandoned**. Across India's rapidly growing digital payment ecosystem (UPI, cards, NetBanking), this translates to billions in lost merchant Gross Merchandise Value (GMV).

### The Failure of Traditional Recovery Logic
Traditional payment retry logic suffers from severe structural flaws:
- **Blind, Dumb Retries**: Systems retry payments on rigid cron timers regardless of root cause (e.g., retrying an expired card or an account with insufficient balance 5 times).
- **Customer Friction & Churn**: Bombarding users with generic failure notifications causes frustration and brand abandonment.
- **Cardholder Fatigue & Gateway Bans**: Repeated blind retries trigger bank rate limits, risk score downgrades, issuer blacklisting, and merchant gateway penalty fees.
- **Zero Financial Governance**: Existing automation tools lack hardware-style pre-execution gating, leading to duplicate charges, race conditions, and unverified attribution claims.

### The RecoverAI Solution
**RecoverAI** replaces dumb retries with an intelligent, multi-stage recovery controller. It pairs an **LLM Reasoning Layer** (for contextual root-cause diagnosis and intervention strategy) with a **Supreme Deterministic Policy Engine** (for hard safety boundaries, retry ceilings, and compliance enforcement) and a **Bounded Hardware-Style Execution Gate** (guaranteeing strict idempotency, per-payment mutex serialization, and immutable audit logging).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              RECOVERAI VALUE PROP                            │
├───────────────────────┬──────────────────────────────┬───────────────────────┤
│    RECOVER REVENUE    │      PRESERVE REPUTATION     │   TOTAL ACCOUNTABILITY │
│ Intelligently recover │ Eliminate card fatigue and   │ Every rupee recovered │
│ high-confidence       │ issuer blocks by honoring    │ is mathematically     │
│ transactions across   │ strict retry limits and      │ proven by successful  │
│ payment rails.        │ routing to human care.       │ execution records.    │
└───────────────────────┴──────────────────────────────┴───────────────────────┘
```

---

## 2. Core Architectural Principles & Safety Invariants

RecoverAI is built upon five non-negotiable architectural invariants:

> [!IMPORTANT]
> ### The 5 Non-Negotiable Governance Invariants
> 
> 1. **"The LLM Is an Untrusted Advisor."**  
>    The LLM reasoning layer generates diagnoses and recommendations, but has **zero execution privilege**. It cannot authorize retries, mutate records, or charge cards. All AI output is strictly validated against a typed JSON schema and submitted to the deterministic policy engine.
> 
> 2. **"Only Policy-Approved Decisions May Reach the Execution Gate."**  
>    The deterministic policy engine (`POL-000` through `POL-100`) possesses supreme authority. If a policy boundary is violated (e.g., expired card, attempt count $\ge 2$, bank decline threshold exceeded), the AI proposal is immediately overridden and autonomous execution is blocked.
> 
> 3. **"Recovered Revenue Is Calculated Exclusively from Verified Executions."**  
>    $$\text{Recovered Revenue} = \sum \text{amount\_recovered} \quad (\text{WHERE } status = \text{'succeeded'})$$  
>    **Prediction $\neq$ Recovery.** Analytical confidence, AI estimates, and queued outreach actions contribute exactly **₹0** to recovered revenue until a successful execution record is written to the SQLite audit ledger.
> 
> 4. **"Hardware-Style Pre-Execution Gating & Idempotency Locking."**  
>    The execution service utilizes an in-memory per-payment mutex and double-checked idempotency locking. Firing 10 concurrent requests simultaneously across threads results in exactly **1** primary execution and **9** idempotent rejections, guaranteeing zero revenue double-counting.
> 
> 5. **"Zero Real Money Movement in Demo & Test Environments."**  
>    All recovery workflows execute in either synthetic offline simulation mode (`mock`) or against isolated payment processor sandbox environments (`razorpay_test`). No live customer cards are charged, and live credentials (`rzp_live_`) are rejected at the startup boundary.

---

## 3. The 5-Stage Governance Pipeline

Every at-risk transaction progresses through an auditable 5-stage lifecycle:

```
Stage 1: DETECT
   │ Ingests failed/abandoned transaction from SQLite ledger
   │ Extracts telemetry: error code, payment rail, attempt count, customer reputation
   ▼
Stage 2: DIAGNOSE
   │ Evaluates technical failure code and behavioral drop-off indicators
   │ Calculates customer historical repayment ratio and trust tier
   ▼
Stage 3: AI RECOMMENDATION
   │ Sanitizes payload (removes secrets/PII) and submits to LLM Provider
   │ Multi-provider support: Mock / Ollama (local) / OpenAI / Gemini
   │ Strict JSON Schema Validator enforces closed enums and confidence ∈ [0.0, 1.0]
   ▼
Stage 4: POLICY VALIDATION
   │ Deterministic Policy Engine evaluates rules POL-000 to POL-100
   │ Enforces hard ceilings: Max 2 retries, 0 retries on expired cards, 1 bank decline retry
   │ Supreme Authority: Overrides AI recommendation if safety boundary breached
   ▼
Stage 5: EXECUTION GATE & AUDIT LEDGER
   │ Hardware-style Pre-Execution Gate checks idempotency, locks per-payment mutex
   │ Bounded Executor runs action (retry_payment, contact_customer, escalate_to_human)
   │ Persists immutable outcome to recovery_executions SQLite ledger
   ▼
FINANCIAL ATTRIBUTION & TRANSPARENCY
   │ Recovered Revenue updated ONLY if execution status === 'succeeded'
   │ Live mathematical accounting audit verified against SQLite database
```

---

## 4. System Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
|                                     BROWSER CLIENT                                    |
|                                                                                       |
|  +---------------------------+  +--------------------------+  +--------------------+  |
|  | 1-Click Scenario Launcher |  | Executive Metric Cards   |  | Filter & Search    |  |
|  | (Scenarios A through E)   |  | (At-Risk, Recovered, %)  |  | (Status, Failure)  |  |
|  +-------------+-------------+  +------------+-------------+  +---------+----------+  |
|                |                             |                          |             |
|  +-------------v-----------------------------v--------------------------v----------+  |
|  | Interactive Payments Ledger Table & Visual 5-Stage Pipeline Stepper Modal       |  |
|  +-------------------------------------------+-------------------------------------+  |
+----------------------------------------------|----------------------------------------+
                                               | HTTPS / JSON
                                               v
+---------------------------------------------------------------------------------------+
|                                  NEXT.JS 15 APP ROUTER                                |
|                                                                                       |
|  /api/payments                  /api/payments/[id]/decision                           |
|  /api/payments/[id]             /api/payments/[id]/ai-assessment                      |
|  /api/payments/summary          /api/payments/[id]/execution-preview                  |
|  /api/recovery/analyze          /api/recovery/execute                                 |
|  /api/recovery/ai-analyze       /api/recovery/execute-batch                           |
|  /api/recovery/audit                                                                  |
+----------------------------------------------+----------------------------------------+
                                               | Server-Side Controller
                                               v
+---------------------------------------------------------------------------------------+
|                                   RECOVERAI ENGINE                                    |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  | Context Builder (Sanitizes data, strips PII, formats prompt)                   |  |
|  +-----------------------------------------+---------------------------------------+  |
|                                            |                                          |
|  +-----------------------------------------v---------------------------------------+  |
|  | LLM Provider Abstraction: Mock | Ollama (Local) | OpenAI | Gemini               |  |
|  +-----------------------------------------+---------------------------------------+  |
|                                            | Raw AI JSON                              |
|  +-----------------------------------------v---------------------------------------+  |
|  | Output Schema Validator (Strict schema, closed enums, confidence clamping)      |  |
|  +-----------------------------------------+---------------------------------------+  |
|                                            | Validated Proposal                       |
|  +-----------------------------------------v---------------------------------------+  |
|  | Deterministic Policy Engine (POL-000 to POL-100: Retries, Expired Cards, Caps) |  |
|  +-----------------------------------------+---------------------------------------+  |
|                                            | Policy-Approved Action                   |
|  +-----------------------------------------v---------------------------------------+  |
|  | Execution Gate (Pre-execution validation, mutex lock, double-checked idempotency) |
|  +-----------------------------------------+---------------------------------------+  |
|                                            | Safe Execution Clearance                 |
|  +-----------------------------------------v---------------------------------------+  |
|  | Bounded Executor: MockRecoveryExecutor | RazorpayTestExecutor                   |  |
|  +-----------------------------------------+---------------------------------------+  |
+----------------------------------------------|----------------------------------------+
                                               | Synchronous Engine Calls
                                               v
+---------------------------------------------------------------------------------------+
|                                DATA ACCESS LAYER (src/lib/db.ts)                      |
|                           Native Node.js 24 SQLite (DatabaseSync)                     |
+----------------------------------------------+----------------------------------------+
                                               | File I/O
                                               v
+---------------------------------------------------------------------------------------+
|                             LOCAL SQLITE DATABASE (data/recoverai.db)                 |
|                                                                                       |
|  Table: `payments` (200 records, immutable original ledger)                           |
|  Table: `recovery_executions` (immutable audit log of every recovery attempt)          |
+---------------------------------------------------------------------------------------+
```

---

## 5. The 10 Payment Failure Scenarios

The seeded SQLite dataset (`data/recoverai.db`) contains **200 realistic Indian merchant transactions** generated deterministically via a Mulberry32 PRNG (seed `#4242`). It models 10 distinct real-world payment scenarios:

| Scenario | Key Telemetry & Failure Code | Payment Rail | Customer Profile | AI Diagnosis | Governing Policy Rule | Approved Action | Outcome Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A: Transient Gateway Timeout** | `timeout` / Gateway 504 / Attempt 1 | UPI / RuPay | High-trust VIP (15 past successes, 0 failures) | Transient network packet loss; high recovery probability | `POL-100` (Approved within safe limits) | `retry_payment` | `succeeded` (+₹14,999) |
| **B: Chronic Non-Payer Hard Stop** | `insufficient_funds` / Attempt 3 | Visa / Mastercard | Low reputation (0 successes, 5 failures) | Chronic insolvency pattern; autonomous retries exhausted | `POL-003` (Max 2 retries hard ceiling) | `escalate_to_human` | `escalated` (₹0, Blocked) |
| **C: Expired Payment Instrument** | `expired_card` / Attempt 1 | Mastercard | Average customer (3 past successes) | Card expired; financial retry will permanently fail | `POL-002` (Prohibit retry on expired instruments) | `request_payment_method_update` | `customer_action_required` (₹0) |
| **D: Bank Decline / Balance Limit** | `bank_decline` / Attempt 1 | RuPay / NetBanking | Loyal customer (8 past successes) | Temporary issuer balance constraint or server glitch | `POL-004` (Bank decline 1-retry cap) | `retry_payment` | `succeeded` or `failed` |
| **E: Checkout Cart Abandonment** | `checkout_abandoned` / Attempt 1 | UPI Deep Link | Active shopper dropped off at payment step | Buyer hesitation or app switch during checkout | `POL-100` (Customer outreach authorized) | `contact_customer` | `customer_action_required` (₹0) |
| **F: High-Risk Velocity Spike** | `authentication_failure` / Attempt 2 | Credit Card | Suspicious device velocity / unknown IP | Potential credential compromise or fraud trigger | `POL-001` (Security anomaly guard) | `escalate_to_human` | `escalated` (₹0) |
| **G: Upstream Gateway Outage** | `gateway_error` / Attempt 1 | NetBanking | Medium trust corporate account | Upstream bank core banking system maintenance (502) | `POL-100` (Exponential backoff retry) | `retry_payment` | `succeeded` |
| **H: 3DS OTP Abandonment** | `authentication_failure` / Attempt 1 | Debit Card | High-frequency retail buyer | User failed to submit SMS OTP before session expiry | `POL-100` (Customer reminder flow) | `contact_customer` | `customer_action_required` (₹0) |
| **I: High-Value Corporate Invoice** | `bank_decline` / Amount > ₹50,000 | Corporate Card | Enterprise account with repeated decline | Transaction exceeds automated clearing limits | `POL-005` (High-value transaction cap) | `escalate_to_human` | `escalated` (₹0) |
| **J: Micro-Transaction Friction** | `timeout` / Amount < ₹100 | UPI QR Code | Daily consumer micro-transaction | High-velocity micro-payment dropped due to UPI switch latency | `POL-100` (Immediate silent retry) | `retry_payment` | `succeeded` |

---

## 6. LLM Provider Abstraction & Reasoning Layer

RecoverAI decouples LLM inference through a clean TypeScript interface (`src/lib/llm/types.ts`):

```typescript
export interface LLMProvider {
  readonly providerType: LLMProviderType; // 'mock' | 'ollama' | 'openai' | 'gemini'
  readonly modelName: string;
  analyzePayment(context: PaymentContext): Promise<LLMRecommendation>;
}
```

### Supported Providers
1. **Mock Provider** (Default — Zero Config):
   - 100% offline, deterministic simulation matching real financial failure characteristics.
   - Requires zero API keys and zero internet access. Ideal for automated testing, CI/CD, and fast local development.
2. **Ollama Provider** (Local Private LLM):
   - Connects to a local Ollama daemon (e.g., `http://localhost:11434` running `llama3.2`, `mistral`, or `phi-3`).
   - Keeps 100% of financial data completely on-premise.
3. **OpenAI Provider** (Cloud Enterprise):
   - Uses native `fetch` against OpenAI REST endpoints (e.g., `gpt-4o-mini`, `gpt-4o`).
   - Implements structured JSON response formatting.
4. **Google Gemini Provider** (Cloud Scalable):
   - Uses native `fetch` against Google AI Gemini endpoints (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`).
   - High-throughput reasoning with minimal latency.

### Context Builder & Sanitization (`src/lib/llm/context.ts`)
The context builder sanitizes raw payment objects before prompt generation:
- **Zero Sensitive Data**: Strips CVVs, full card numbers, customer passwords, and internal DB tokens.
- **Minimal, Structured Payload**: Injects only essential financial telemetry (amount in INR, payment method, failure reason, error code, customer historical success/failure counts, and policy limits).

### Strict Output Schema Validator (`src/lib/llm/validator.ts`)
Raw LLM text output is treated as **untrusted user input**:
- Enforces valid JSON structure (strips markdown code fences if present).
- Validates that `action` belongs to the closed enum: `retry_payment`, `contact_customer`, `request_payment_method_update`, `escalate_to_human`, `do_nothing`.
- Validates that `classification` belongs to: `recoverable`, `unlikely_recoverable`, `requires_escalation`.
- Clamps `confidence` strictly between `0.0` and `1.0`.

### Deterministic Fallback Engine
If an LLM provider encounters a network timeout, API outage, rate limit, or outputs invalid JSON, RecoverAI triggers a **seamless zero-downtime fallback** to the Phase 2 deterministic diagnosis engine. The system never crashes or hangs on LLM failures.

---

## 7. Deterministic Policy Engine & Stopping Rules

The Deterministic Policy Engine (`src/lib/recovery/policy.ts`) enforces absolute organizational safety rules:

```typescript
export const RECOVERY_POLICY_CONFIG = {
  MAX_AUTOMATIC_RETRIES: 2,         // POL-003: Hard stop on automatic retries
  MAX_BANK_DECLINE_RETRIES: 1,      // POL-004: Hard stop on bank declines
  HIGH_VALUE_THRESHOLD: 50000,      // POL-005: Escalation threshold in INR
  MIN_CONFIDENCE_FOR_RETRY: 0.60,   // Minimum confidence required for retry
  MIN_REPUTATION_FOR_RETRY: 0.40,   // Minimum customer success ratio
};
```

### Policy Rules Reference
- **`POL-000` (Settled State Lock)**: Transaction is already marked `successful`. Absolutely no recovery action may be scheduled or executed.
- **`POL-001` (Security Anomaly Guard)**: Triggered on unknown failure reasons or suspicious velocity spikes. Action: `escalate_to_human`.
- **`POL-002` (Expired Instrument Lock)**: Automatic retry on an expired card is strictly forbidden by payment network rules. Action: `request_payment_method_update`.
- **`POL-003` (Retry Cap Ceiling)**: If `attempt_count >= MAX_AUTOMATIC_RETRIES (2)`, further autonomous retries are prohibited to prevent issuer blacklisting. Action: `escalate_to_human`.
- **`POL-004` (Bank Decline Cap)**: If a bank decline has already been retried once (`attempt_count >= 1`), further retries are prohibited. Action: `contact_customer` or `escalate_to_human`.
- **`POL-005` (High-Value Exposure)**: Transactions exceeding ₹50,000 with multiple failed attempts cannot be retried autonomously. Action: `escalate_to_human`.
- **`POL-100` (Policy Clearance)**: Transaction satisfies all safety constraints, attempt count is within bounds, and customer reputation is healthy. Action: `retry_payment` or `contact_customer`.

---

## 8. Bounded Execution Layer & Defense in Depth

The execution architecture enforces a multi-tier defense-in-depth model:

```
CLIENT REQUEST  ──▶  SERVER CONTROLLER  ──▶  POLICY VALIDATOR  ──▶  EXECUTION GATE  ──▶  EXECUTOR
```

1. **Server-Decided Interventions**: The client sends only `{ payment_id: string }`. The client cannot specify, suggest, or override the action or the amount.
2. **Untrusted AI Isolation**: The executor never reads raw LLM output. Only policy-approved decisions reach the execution gate.
3. **Hardware-Style Pre-Execution Gate (`src/lib/execution/gate.ts`)**: Evaluates eligibility immediately before execution:
   - Verifies policy clearance.
   - Checks if payment is already recovered.
   - Checks attempt count caps.
   - Checks expired instrument status.
4. **Execution Adapters**:
   - `MockRecoveryExecutor`: Deterministic, synthetic simulation with configurable success probabilities based on customer reputation and failure modes.
   - `RazorpayTestExecutor`: Sandboxed adapter interacting with Razorpay test endpoints (`rzp_test_`). Rejects live keys (`rzp_live_`).

### Action Classification & Financial Accounting Model

| Action | Execution Method | Outcome Status | Financial Attribution |
| :--- | :--- | :--- | :--- |
| `retry_payment` | Direct Sandbox/Mock Retry | `succeeded` or `failed` | **+₹Amount** if `succeeded`; **₹0** if `failed` |
| `contact_customer` | Dispatches Payment Link / Reminder | `customer_action_required` | **₹0** (No money moved until customer acts) |
| `request_payment_method_update` | Queues Instrument Update Portal | `customer_action_required` | **₹0** (No money moved until card updated) |
| `escalate_to_human` | Creates Operations Queue Ticket | `escalated` | **₹0** (Routed to human operator) |
| `do_nothing` | Non-actionable Hold | `no_action` | **₹0** (No action taken) |

---

## 9. Concurrency & Idempotency Hardening

In high-throughput merchant environments, race conditions, double-clicks, and network retries frequently trigger duplicate payment executions. RecoverAI eliminates this through a two-stage concurrency defense:

### 1. In-Memory Per-Payment Mutex (`src/lib/execution/service.ts`)
```typescript
// Serializes parallel execution attempts for the same transaction
private async withPaymentMutex<T>(paymentId: string, fn: () => Promise<T>): Promise<T>
```
All execution requests for `pay_rec_0001` are queued on an in-memory lock chain for that specific ID. Requests for other payments proceed concurrently without blocking.

### 2. Double-Checked Idempotency Pattern
Before executing any action:
1. **Check 1 (Pre-Lock)**: Reads `recovery_executions` table for prior successful execution. If found, returns `already_recovered: true` immediately.
2. **Acquire Mutex**: Serializes the execution.
3. **Check 2 (Post-Lock)**: Re-evaluates `getSuccessfulRecovery(paymentId)` inside the mutex lock. If a parallel thread finished execution while this thread was waiting, it immediately detects the success record, aborts execution, and returns `already_recovered: true`.

**Result**: Firing 10 concurrent requests simultaneously across threads results in exactly **1 primary execution** and **9 idempotent rejections**, crediting revenue strictly once.

---

## 10. Accounting Integrity & Live Financial Metrics

RecoverAI enforces mathematical financial invariants across all dashboard metrics and API responses:

### The Mathematical Accounting Formula
$$\text{Total Revenue at Risk} = \sum_{\text{status} \in \{\text{'failed'}, \text{'abandoned'}\}} \text{payment.amount}$$

$$\text{Potentially Recoverable Value} = \sum \text{decision.potential\_recovery} \quad (\text{Analytical Estimate})$$

$$\text{Recovered Revenue} = \sum_{\text{status} = \text{'succeeded'}} \text{execution.amount\_recovered} \quad (\text{Strict Financial Ledger})$$

### Core Accounting Invariants
- **Upper Bound Invariant 1**: $\text{Recovered Revenue} \le \text{Total Revenue at Risk}$
- **Upper Bound Invariant 2**: $\text{Amount Recovered} \le \text{Attempted Payment Amount}$
- **Zero Double-Counting**: Re-executing an already-recovered payment never increments recovered revenue.
- **Original Ledger Immutability**: The 200 records in the `payments` table are **never mutated or overwritten**. All recovery history is stored in the separate `recovery_executions` audit ledger.

---

## 11. Operations Console & UI Highlights

The RecoverAI operations console is built with **Next.js 15 App Router**, **React 19**, and **Tailwind CSS v4** with a custom dark fintech design system:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ RECOVERAI — AI REVENUE RECOVERY CONTROLLER                         [ Accounting Audit ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Quick Scenarios: [A: Clean Recovery] [B: Safety Override] [C: Expired Card] [D: Idemp] │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────────┤
│  REVENUE AT RISK  │ RECOVERED REVENUE │ POTENTIAL RECOVER │       RECOVERY RATE        │
│    ₹18,87,975     │      ₹14,999      │     ₹9,45,200     │      78.9% Confidence      │
├───────────────────┴───────────────────┴───────────────────┴────────────────────────────┤
│ [ Filter by Status ▾ ]  [ Filter by Failure Reason ▾ ]   [ Search customer, ID... ]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ID             CUSTOMER         AMOUNT     RAIL      STATUS     REASON         ACTION  │
│ pay_rec_0001   Aditya Sharma    ₹14,999    UPI       failed     timeout        Inspect │
│ pay_rec_0200   Priya Patel      ₹12,499    Card      failed     insufficient   Inspect │
│ pay_rec_0004   Vikram Malhotra  ₹3,499     Card      failed     expired_card   Inspect │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Visual Components
- **Visual 5-Stage Pipeline Stepper (`src/components/PipelineStepper.tsx`)**:
  Renders real-time stage progression across the top of the payment inspector modal:
  1. *Detect* &rarr; Failure telemetry & error codes
  2. *Diagnose* &rarr; AI reasoning & calibrated confidence
  3. *Policy Gate* &rarr; Deterministic rule evaluation (`POL-001` to `POL-100`)
  4. *Execution Gate* &rarr; Pre-execution eligibility (`PASSED`, `BLOCKED`, `ALREADY_RECOVERED`)
  5. *Audit Ledger* &rarr; Real-time outcome status (`+₹14,999 Recovered`, `Blocked`, `Escalated`)
- **Interactive Payment Inspector (`src/components/PaymentDetailModal.tsx`)**:
  Full-screen audit modal with tabbed views: Telemetry, AI Diagnosis, Policy Decision, Pre-Execution Preview, One-Click Execution Button, and Complete Audit Log.
- **Executive Metric Cards (`src/components/MetricCard.tsx`)**:
  Real-time KPI cards displaying Revenue at Risk, Recovered Revenue, Potential Recoverable, and Recovery Success Rates.
- **Accounting Audit Modal**:
  Dedicated modal explaining the exact mathematical derivation of recovered revenue and verifying SQLite database integrity.

---

## 12. 1-Click Interactive Evaluator Demo Scenarios

The operations dashboard includes a dedicated **Demo Scenario Launcher** across the top of the interface:

### Scenario A: Clean Autonomous Recovery
- **Target Payment**: `pay_rec_0001` (Aditya Sharma — ₹14,999 — UPI)
- **Telemetry**: Network timeout during gateway processing; high-trust VIP customer (15 past successes, 0 failures).
- **Pipeline Progression**:
  - *Stage 1 Detect*: Failure reason `timeout`, attempt count `1`.
  - *Stage 2 Diagnose*: AI identifies transient network glitch (90% confidence).
  - *Stage 3 Policy Gate*: Passes `POL-100` (within retry and confidence thresholds).
  - *Stage 4 Execution Gate*: Eligibility `PASSED`.
  - *Stage 5 Execute*: Click `[ Execute Recovery ]` &rarr; `✓ RECOVERY SUCCESSFUL`.
- **Outcome**: **+₹14,999** credited to Recovered Revenue metric; audit record written to SQLite.

### Scenario B: Safety Override Block
- **Target Payment**: `pay_rec_0200` (Priya Patel — ₹12,499 — Card)
- **Telemetry**: Insufficient funds; attempt count `3` (exceeds maximum allowed automatic retries of `2`).
- **Pipeline Progression**:
  - *Stage 3 AI Recommendation*: AI suggests retrying the payment.
  - *Stage 4 Policy Gate*: **OVERRIDDEN** by `POL-003` Hard Stop (Max 2 retries). Action forced to `escalate_to_human`.
  - *Stage 5 Execution Gate*: Eligibility `BLOCKED`. Button locked (`🔒 Execution Blocked`).
- **Outcome**: Zero money movement; transaction safely routed to operations queue.

### Scenario C: Expired Instrument Handling
- **Target Payment**: `pay_rec_0004` (Vikram Malhotra — ₹3,499 — Card)
- **Telemetry**: Card expiration failure (`expired_card`).
- **Pipeline Progression**:
  - *Stage 4 Policy Gate*: Enforces `POL-002` (Prohibit financial retry on expired cards). Action forced to `request_payment_method_update`.
  - *Stage 5 Execution*: Queues payment method update link to cardholder.
- **Outcome**: Status `customer_action_required`; **₹0** credited until cardholder provides a new card.

### Scenario D: Idempotency & Concurrency Guard
- **Target Payment**: Re-inspect `pay_rec_0001` (recovered in Scenario A).
- **Pipeline Progression**:
  - *Stage 5 Execution Gate*: Detects prior successful execution via `getSuccessfulRecovery()`.
  - *Gate Status*: Displays `✓ Already Recovered`.
  - *Re-Execution Trigger*: Re-executing via UI or API returns `already_recovered: true`.
- **Outcome**: Strictly **₹0** duplicate revenue credited.

### Scenario E: Checkout Cart Drop-off Outreach
- **Target Payment**: `pay_rec_0019` (Rahul Verma — ₹4,999 — UPI)
- **Telemetry**: User abandoned checkout flow (`checkout_abandoned`).
- **Pipeline Progression**:
  - *Stage 2 Diagnose*: AI identifies buyer drop-off; recommends warm customer outreach.
  - *Stage 4 Policy Gate*: Authorizes WhatsApp/SMS checkout recovery link.
- **Outcome**: Status `customer_action_required`; ₹0 credited until customer completes checkout.

---

## 13. Adversarial Security & Robustness Suite

RecoverAI features a dedicated security test suite (`scripts/test_adversarial.mjs`) validating **10 adversarial attack vectors** (33 automated assertions):

| # | Attack Vector | Adversarial Payload / Condition | Defensive Mechanism | Result |
| :- | :--- | :--- | :--- | :---: |
| 1 | **Action Injection** | Client submits `{ action: "payout_now" }` | Server ignores client action; determines action strictly from policy | **DEFENDED** |
| 2 | **Amount Tampering** | Client attempts to claim `{ amount: 9999999 }` | Server ignores client amount; uses database payment amount | **DEFENDED** |
| 3 | **Negative Amount Clamp** | Payload with negative attempted/recovered values | Sanitized and clamped to 0 in database layer | **DEFENDED** |
| 4 | **Policy Bypass Attempt** | Client requests retry on an expired card | Blocked by Execution Gate (`POL-002`) | **DEFENDED** |
| 5 | **10-Thread Concurrent Race** | 10 parallel execution requests for the same payment | In-memory mutex + double-checked lock: 1 succeeds, 9 rejected | **DEFENDED** |
| 6 | **Non-Existent Payment ID** | Request with `pay_rec_nonexistent_9999` | Handled gracefully with 404 Not Found | **DEFENDED** |
| 7 | **SQL Injection Attack** | Parameter: `' OR '1'='1' --` | Parameterized SQL queries completely prevent SQL injection | **DEFENDED** |
| 8 | **Tampered Mode Injection** | Payload with `mode: "production"` | Safely clamped to `'mock'`; rejects unauthorized live execution | **DEFENDED** |
| 9 | **Multi-Cycle Idempotency** | 5 consecutive re-runs of the same transaction | Total recovered revenue in database remains 100% unchanged | **DEFENDED** |
| 10 | **Ledger Immutability** | Audit after execution attacks | Original 200 `payments` records remain 100% untouched | **DEFENDED** |

Run the adversarial security suite:
```powershell
npm run test:adversarial
```

---

## 14. Complete REST API Reference

All endpoints run on the Next.js App Router (`/api/...`):

### Core Payments Ledger Endpoints
- `GET /api/payments`
  - **Query Parameters**: `status`, `failure_reason`, `search`, `limit`, `offset`
  - **Response**: Array of payment records with pagination metadata.
- `GET /api/payments/[id]`
  - **Path Parameter**: `id` (e.g., `pay_rec_0001`)
  - **Response**: Single detailed payment record.
- `GET /api/payments/summary`
  - **Response**: Aggregated counts, total volume, total revenue at risk, and failure reason distribution.

### Decision & AI Assessment Endpoints
- `GET /api/payments/[id]/decision`
  - **Response**: Phase 2 deterministic decision (`classification`, `action`, `confidence`, `policy_rule`, `stop_condition`).
- `GET /api/payments/[id]/ai-assessment`
  - **Response**: Phase 3 AI diagnosis + policy validation audit (`provider`, `model`, `recommendation`, `policy_override`).
- `POST /api/recovery/analyze`
  - **Request Body**: Optional `{ filter: { status: 'failed' } }`
  - **Response**: Batch cohort analysis using the deterministic engine.
- `POST /api/recovery/ai-analyze`
  - **Request Body**: `{ payment_ids: string[] }` or empty for top at-risk cohort.
  - **Response**: Batch cohort triage using the active LLM provider.

### Recovery Execution & Audit Endpoints
- `GET /api/payments/[id]/execution-preview`
  - **Response**: Pre-execution parameters (`proposed_action`, `policy_clearance`, `eligibility`, `amount_at_risk`, `stop_condition`, `prior_executions`).
- `POST /api/recovery/execute`
  - **Request Body**: `{ payment_id: string }` *(Server determines the action autonomously)*
  - **Response**: Execution outcome record (`execution_id`, `status`, `amount_recovered`, `policy_rule`, `already_recovered`).
- `POST /api/recovery/execute-batch`
  - **Request Body**: `{ payment_ids?: string[] }`
  - **Response**: Batch execution summary (`analyzed`, `executed`, `recovered_revenue`, `results`).
- `GET /api/recovery/audit`
  - **Response**: Recent persistent execution audit records from SQLite and live aggregate financial metrics.

---

## 15. Codebase Map & Directory Structure

```
RecoverAI/
├── .env.example                     # Environment configuration template
├── package.json                     # Dependencies, scripts, and build metadata
├── tsconfig.json                    # TypeScript compiler configuration (Strict)
├── next.config.ts                   # Next.js configuration (Server external packages)
├── README.md                        # Project documentation
├── phase-1.md to phase-5.md         # Detailed architectural documentation per phase
│
├── data/
│   └── recoverai.db                 # Local SQLite database (payments & recovery_executions)
│
├── scripts/
│   ├── seed.mjs                     # Mulberry32 PRNG seed script (200 payments)
│   ├── verify.mjs                   # Phase 1 baseline & distribution tests
│   ├── test_decision_engine.mjs     # Phase 2 deterministic engine tests (19 assertions)
│   ├── test_llm_provider.mjs        # Phase 3 LLM provider & safety tests (55 assertions)
│   ├── test_recovery_execution.mjs  # Phase 4 execution & idempotency tests (62 assertions)
│   ├── test_adversarial.mjs         # Phase 5 security & robustness tests (33 assertions)
│   ├── test_http_endpoints.mjs      # REST API route integration tests
│   └── demo_phase4.mjs              # Command-line execution demo walkthrough
│
└── src/
    ├── app/
    │   ├── globals.css              # Dark fintech styling tokens
    │   ├── layout.tsx               # Root layout with Inter font
    │   ├── page.tsx                 # Operations console & interactive demo dashboard
    │   └── api/                     # 13 Next.js REST API routes
    │       ├── payments/
    │       │   ├── route.ts         # GET /api/payments
    │       │   ├── summary/route.ts # GET /api/payments/summary
    │       │   └── [id]/
    │       │       ├── route.ts     # GET /api/payments/[id]
    │       │       ├── decision/    # GET /api/payments/[id]/decision
    │       │       ├── ai-assessment/# GET /api/payments/[id]/ai-assessment
    │       │       └── execution-preview/# GET /api/payments/[id]/execution-preview
    │       └── recovery/
    │           ├── analyze/route.ts # POST /api/recovery/analyze
    │           ├── ai-analyze/route.ts # POST /api/recovery/ai-analyze
    │           ├── execute/route.ts # POST /api/recovery/execute
    │           ├── execute-batch/   # POST /api/recovery/execute-batch
    │           └── audit/route.ts   # GET /api/recovery/audit
    │
    ├── components/
    │   ├── MetricCard.tsx           # Executive KPI metric card
    │   ├── PaymentDetailModal.tsx   # Deep-dive payment evaluation & execution modal
    │   ├── PaymentsTable.tsx        # Interactive data table with filters and pagination
    │   ├── PipelineStepper.tsx      # Visual 5-stage progress indicator
    │   └── StatusBadge.tsx          # Color-coded financial status badge
    │
    └── lib/
        ├── db.ts                    # Native Node.js SQLite data access layer
        ├── format.ts                # Indian Rupee (INR) & date formatting utilities
        ├── types.ts                 # Domain models (Payment, Customer, FailureReason)
        ├── recovery/                # Phase 2 Deterministic Decision Engine
        │   ├── types.ts             # Decision engine interfaces & type definitions
        │   ├── diagnosis.ts         # Root cause diagnosis & customer reputation scoring
        │   ├── policy.ts            # Central policy engine (POL-000 to POL-100)
        │   ├── metrics.ts           # Revenue at risk & recovery potential metrics
        │   └── engine.ts            # High-level recovery decision coordinator
        ├── llm/                     # Phase 3 LLM Reasoning Layer
        │   ├── types.ts             # LLM provider interfaces & recommendation models
        │   ├── context.ts           # Sanitized context builder & prompt generator
        │   ├── validator.ts         # Strict JSON Schema & enum validator
        │   ├── service.ts           # Multi-provider coordinator with fallback
        │   └── providers/           # Provider implementations
        │       ├── mock.ts          # Offline deterministic mock provider
        │       ├── ollama.ts        # Local Ollama LLM provider
        │       ├── openai.ts        # OpenAI cloud provider
        │       └── gemini.ts        # Google Gemini cloud provider
        └── execution/               # Phase 4 Bounded Execution Layer
            ├── types.ts             # Execution result & outcome status definitions
            ├── gate.ts              # Hardware-style Pre-Execution Gate
            ├── service.ts           # Execution service with per-payment mutex & locking
            └── executors/           # Bounded execution adapters
                ├── mock.ts          # Deterministic mock recovery executor
                └── razorpay.ts      # Sandboxed Razorpay test mode adapter
```

---

## 16. Getting Started & Installation

### Prerequisites
- **Node.js**: v20.0.0 or higher (Tested on Node.js v24.14.0 with native `node:sqlite`).
- **npm**: v10.0.0 or higher.
- **Git** & **GitHub CLI** (`gh` optional).

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/HanshalBobate/RecoverAI.git
cd RecoverAI
npm install
```

### Step 2: Seed SQLite Database
Populate the local SQLite database (`data/recoverai.db`) with 200 deterministic payment records:
```bash
npm run db:seed
```

### Step 3: Run Automated Test Suites
Verify system health across all 5 phases:
```bash
npm test
```

### Step 4: Start the Operations Console
```bash
# Start development server
npm run dev

# Or build and start production server
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 17. Verification & Automated Test Suites

RecoverAI features an exhaustive verification harness with **165+ automated assertions across 5 distinct test suites**:

```powershell
# Run all test suites
npm test
```

### Test Suite Breakdown
1. **Phase 1 Verification (`scripts/verify.mjs`)**:
   - Verifies SQLite schema creation, table indices, Mulberry32 PRNG determinism, 200 payment records, and baseline scenario distributions.
2. **Phase 2 Decision Engine Tests (`scripts/test_decision_engine.mjs`)**:
   - 19 assertions validating failure categorization, customer reputation weighting, policy boundary overrides, stopping rules, and metric distinction.
3. **Phase 3 LLM Provider & Safety Tests (`scripts/test_llm_provider.mjs`)**:
   - 55 assertions testing context sanitization, schema validation, enum enforcement, confidence clamping, multi-provider abstraction, and deterministic fallback.
4. **Phase 4 Recovery Execution Tests (`scripts/test_recovery_execution.mjs`)**:
   - 62 assertions validating hardware execution gating, mock execution outcomes, idempotency, stopping condition enforcement, and strict revenue accounting.
5. **Phase 5 Adversarial & Security Tests (`scripts/test_adversarial.mjs`)**:
   - 33 assertions testing 10 adversarial attack vectors including action injection, amount tampering, 10-thread concurrency race conditions, SQL injection, and ledger immutability.

### Additional Verification Commands
```powershell
# Run adversarial security suite only
npm run test:adversarial

# Run TypeScript strict typecheck
npx tsc --noEmit

# Compile production bundle
npm run build
```

---

## 18. Environment Variables & Configuration

Configured in `.env` (template provided in [`.env.example`](file:///d:/PROJECTS/RecoverAI/.env.example)):

```env
# ==============================================================================
# RecoverAI — Environment Configuration
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Execution Mode Configuration
# ------------------------------------------------------------------------------
# Options: 'mock' | 'razorpay_test'
# Default: 'mock' (100% offline synthetic simulation, zero live money movement)
RECOVERY_EXECUTION_MODE=mock

# ------------------------------------------------------------------------------
# 2. Razorpay Test Credentials (Optional — Required only for 'razorpay_test' mode)
# Must begin with 'rzp_test_'. Live keys ('rzp_live_') will be strictly rejected.
# ------------------------------------------------------------------------------
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# ------------------------------------------------------------------------------
# 3. LLM Provider Configuration
# ------------------------------------------------------------------------------
# Options: 'mock' | 'ollama' | 'openai' | 'gemini'
# Default: 'mock' (100% offline deterministic simulation, zero API keys needed)
LLM_PROVIDER=mock

# --- Ollama Local LLM (Optional) ---
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# --- OpenAI Cloud LLM (Optional) ---
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# --- Google Gemini Cloud LLM (Optional) ---
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

---

## Governance & Compliance Notice

- **Demo & Evaluation Environment**: RecoverAI operates strictly in test and simulation modes (`mock` and `razorpay_test`). No real money movements occur, and no live customer credit cards or bank accounts are debited.
- **Financial Compliance**: All recovery revenue metrics are derived from verified execution records in the SQLite database. Predictions, AI confidence scores, and customer outreach actions contribute exactly ₹0 to recovered revenue until verified execution occurs.
- **Privacy & Security**: Customer financial data is processed locally within the application boundary. All remote LLM payloads are stripped of sensitive cardholder details and authentication credentials.

---

**RecoverAI** — *Track 03: AI Revenue Recovery*  
Built with Next.js 15, React 19, TypeScript, and Native Node.js SQLite.
