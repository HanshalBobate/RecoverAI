# RecoverAI — Phase 3: LLM Brain + Provider Abstraction

## Objective
The primary objective of Phase 3 is to introduce an artificial intelligence reasoning layer into RecoverAI without displacing the deterministic safety guarantees built in Phase 2. 

The LLM is deployed to:
1. Understand nuanced payment failure context and customer interaction history.
2. Formulate a root-cause diagnosis.
3. Recommend an appropriate recovery intervention.
4. Provide structured, transparent justification for the proposal.

**Core Architectural Invariant:**
The LLM can reason and recommend, but **it cannot authorize and it cannot execute**. The deterministic Phase 2 Policy Engine retains supreme and absolute authority over all interventions. Every AI proposal is treated as untrusted input, strictly validated against a typed schema, and passed to the policy validator which approves, modifies, or overrides the action before any final decision is reached.

---

## Phase 1 Context
In Phase 1, RecoverAI established:
- **Application Core**: Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS.
- **Embedded Database**: Local file-backed SQLite database (`data/recoverai.db`) using native `node:sqlite` (zero compilation dependencies).
- **Synthetic Indian Financial Dataset**: 200 realistic payments seeded with seed `#4242`, featuring 171 at-risk transactions (151 failed, 20 abandoned), real Indian payment rails (UPI, RuPay, Visa, Mastercard, NetBanking), and diverse failure modes (`timeout`, `insufficient_funds`, `bank_decline`, `expired_card`, `gateway_error`, `authentication_failure`, `checkout_abandoned`).
- **Foundational APIs**: `/api/payments`, `/api/payments/[id]`, `/api/payments/summary`.
- **Operations Dashboard**: Summary metric cards, at-risk payment filtering, and detailed customer inspection modal.

---

## Phase 2 Context
Phase 2 introduced the deterministic **Recovery Decision Engine**:
- **Diagnosis Engine** (`src/lib/recovery/diagnosis.ts`): Rule-based classification mapping failure types and customer history to recovery actions.
- **Policy Engine** (`src/lib/recovery/policy.ts`): Strict safety rules (`POL-000` through `POL-100`) enforcing hard stops:
  - Expired cards must never be retried (`POL-002`).
  - Automatic retries capped at 2 attempts (`POL-003`).
  - Bank declines capped at 1 retry (`POL-004`).
  - High-value transactions (> ₹50,000) escalated if repeated (`POL-005`).
- **Telemetry & Metrics** (`src/lib/recovery/metrics.ts`): Distinguishing Revenue at Risk from Potentially Recoverable Value, with Recovered Revenue strictly ₹0 (zero execution).
- **Batch Evaluation Endpoint**: `POST /api/recovery/analyze` and single-transaction endpoint `GET /api/payments/[id]/decision`.

---

## New Architecture
Phase 3 establishes an end-to-end, multi-stage reasoning and safety pipeline:

```
+-------------------------------------------------------------------------+
|                              PAYMENT RECORD                             |
|          (Amount, Failure Reason, Attempt Count, Customer History)      |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                             CONTEXT BUILDER                             |
|      (Sanitizes payload, removes secrets, injects policy constraints)   |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                          LLM REASONING LAYER                            |
|          Provider Abstraction: Mock | Ollama | OpenAI | Gemini          |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                        OUTPUT SCHEMA VALIDATOR                          |
|    (Validates JSON, checks enum values, enforces [0, 1] confidence)     |
+-------------------------------------------------------------------------+
                                     │
                  ┌──────────────────┴──────────────────┐
                  │ (If error/timeout/malformed)         │ (If valid)
                  ▼                                     ▼
+-----------------------------------+ +-----------------------------------+
|      DETERMINISTIC FALLBACK       | |   DETERMINISTIC POLICY ENGINE     |
|   (Phase 2 Rules Engine executes) | |    (Validates or Overrides AI)    |
+-----------------------------------+ +-----------------------------------+
                  │                                     │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                             FINAL DECISION                              |
|           (Policy-Approved Action + Complete Audit Representation)       |
+-------------------------------------------------------------------------+
```

---

## LLM Provider Interface
All model interactions are decoupled through the `LLMProvider` TypeScript interface defined in `src/lib/llm/types.ts`:

```typescript
export interface LLMProvider {
  readonly providerType: LLMProviderType; // 'mock' | 'ollama' | 'openai' | 'gemini'
  readonly modelName: string;
  analyzePayment(context: PaymentContext): Promise<LLMRecommendation>;
}
```

No external LLM SDKs are required. All remote providers use Node's native `fetch` API, eliminating dependency bloat and platform-specific native addon compilation issues.

---

## Ollama Provider
- **Implementation**: `src/lib/llm/providers/ollama.ts`
- **Protocol**: HTTP POST to `/api/generate` with `format: "json"`.
- **Default Base URL**: `http://localhost:11434` (configurable via `OLLAMA_BASE_URL`).
- **Default Model**: `llama3.2` (configurable via `OLLAMA_MODEL`).
- **Error Handling**: Gracefully intercepts connection refused, missing model, timeouts, and unparseable JSON without crashing. Triggers automatic fallback to the deterministic rules engine.

---

## OpenAI Provider
- **Implementation**: `src/lib/llm/providers/openai.ts`
- **Protocol**: HTTP POST to `https://api.openai.com/v1/chat/completions`.
- **Features**: Uses `response_format: { type: "json_object" }` for structured output.
- **Default Model**: `gpt-4o-mini` (configurable via `OPENAI_MODEL`).
- **Security**: Requires server-side `OPENAI_API_KEY`. Missing or invalid keys immediately trigger deterministic fallback. Keys are never exposed to the client or in API responses.

---

## Gemini Provider
- **Implementation**: `src/lib/llm/providers/gemini.ts`
- **Protocol**: HTTP POST to Google Generative Language API (`v1beta/models/{model}:generateContent`).
- **Features**: Sets `generationConfig: { responseMimeType: "application/json" }`.
- **Default Model**: `gemini-1.5-flash` (configurable via `GEMINI_MODEL`).
- **Security**: Uses `GEMINI_API_KEY` server-side only. Rate limits (HTTP 429) or quota errors are caught and trigger deterministic fallback.

---

## Mock Provider
- **Implementation**: `src/lib/llm/providers/mock.ts`
- **Purpose**: Enables 100% offline, zero-configuration development, testing, and hackathon demonstrations.
- **Characteristics**: Deterministic, reproducible, context-aware rule simulation. Produces realistic diagnoses and recommendations matching real merchant scenarios.
- **Activation**: Set `LLM_PROVIDER=mock` or leave undefined (mock is the default).

---

## Environment Variables
Configured via `.env` (template in `.env.example`):

```bash
# Provider Selection: mock | ollama | openai | gemini
LLM_PROVIDER=mock

# Ollama Configuration (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# OpenAI Configuration
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Gemini Configuration
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

---

## Provider Selection
Provider resolution is handled by `getLLMProvider(overrideType?: LLMProviderType)` in `src/lib/llm/service.ts`:
1. Inspects explicit override parameter (used for per-request testing).
2. Reads `process.env.LLM_PROVIDER`.
3. Defaults to `'mock'` if unspecified, invalid, or empty.

---

## LLM Input Context
Built by `buildPaymentContext(payment)` in `src/lib/llm/context.ts`. The context is stripped of all sensitive customer data and database internals:

```typescript
export interface PaymentContext {
  payment: {
    payment_id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    failure_reason: PaymentFailureReason | null;
    attempt_count: number;
    payment_method_type: string;
  };
  customer: {
    customer_id: string;
    customer_name: string;
    subscription_status: string;
    previous_successful_payments: number;
    previous_failed_payments: number;
  };
  policy_constraints: {
    max_automatic_retries: number;
    remaining_retries_allowed: number;
    allow_retry: boolean;
    high_value_threshold: number;
  };
}
```

---

## LLM Output Schema
The LLM must return strict JSON conforming to:

```json
{
  "classification": "recoverable | unlikely_recoverable | requires_escalation",
  "diagnosis": "Root cause explanation string",
  "recommended_action": "retry_payment | contact_customer | request_payment_method_update | escalate_to_human | do_nothing",
  "confidence": 0.92,
  "reason": "Detailed reasoning referencing history and failure mode",
  "risk_level": "low | medium | high"
}
```

---

## Output Validation
Implemented in `src/lib/llm/validator.ts` via `validateLLMOutput()`:
- Strips Markdown code blocks (````json ... ````).
- Validates JSON parseability.
- Validates enum membership for `classification`, `recommended_action`, and `risk_level`.
- Rejects arbitrary, unapproved action strings (e.g. `force_retry`, `drain_account`).
- Bounds `confidence` strictly to `[0.0, 1.0]`.
- Checks presence and length of `diagnosis` and `reason` strings.
- On any validation failure: immediately diverts to the deterministic fallback engine.

---

## Policy Validation
The deterministic Phase 2 policy engine (`validateDecision`) serves as an uncompromising safety guard:

| Scenario | AI Suggestion | Policy Interception | Final Decision | Policy Rule |
| :--- | :--- | :--- | :--- | :--- |
| Expired Card | `retry_payment` | REJECTED: Card is expired | `request_payment_method_update` | POL-002 |
| Attempts >= 2 | `retry_payment` | REJECTED: Retry cap reached | `escalate_to_human` | POL-003 |
| Bank Decline (2nd) | `retry_payment` | REJECTED: Issuer decline limit | `escalate_to_human` | POL-004 |
| 2FA / OTP Failure | `retry_payment` | REJECTED: Cardholder input needed | `contact_customer` | POL-100 |
| Successful Payment | `retry_payment` | REJECTED: Payment finalized | `do_nothing` | POL-000 |

When an override occurs, the audit trail flags `policy_overridden: true` and logs both the AI's proposed action and the policy's final mandated action.

---

## Fallback Behavior
If any of the following occur:
- Network drop or provider offline (e.g. Ollama daemon not started)
- Missing or invalid API key
- Request timeout (5-second hard limit)
- Non-JSON or malformed output
- Schema validation failure
- Rate limiting / HTTP 429

The system:
1. Logs the fallback reason (sanitized, zero secrets).
2. Sets `fallback_occurred: true` and `decision_source: "deterministic_fallback"`.
3. Immediately evaluates the payment using Phase 2's deterministic `assessPayment(payment)`.
4. Returns a complete, valid final decision. The application never fails or crashes.

---

## AI Assessment API
`GET /api/payments/[id]/ai-assessment`
- **Method**: GET
- **Parameters**: `id` (payment ID)
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "assessment_id": "audit_pay_rec_0001_1788592512336",
    "timestamp": "2026-09-05T07:15:12.336Z",
    "payment_id": "pay_rec_0001",
    "provider": "mock",
    "model": "recoverai-mock-v1",
    "ai_recommendation": {
      "classification": "recoverable",
      "diagnosis": "Transient gateway network timeout during authorization handshake.",
      "recommended_action": "retry_payment",
      "confidence": 0.93,
      "reason": "Customer Isha Dutta has high lifetime reliability (27 past successes). Transient retry recommended.",
      "risk_level": "low"
    },
    "policy_result": {
      "allowed": true,
      "final_action": "retry_payment",
      "policy_rule": "POL-100: Standard Autonomous Recovery Policy Permitted.",
      "stop_condition": "Stop automatic retries after 2 attempts.",
      "reason": "Customer Isha Dutta has high lifetime reliability...",
      "overridden": false
    },
    "final_decision": {
      "payment_id": "pay_rec_0001",
      "classification": "recoverable",
      "diagnosis": "Transient gateway network timeout...",
      "action": "retry_payment",
      "confidence": 0.93,
      "reason": "Customer Isha Dutta has high lifetime reliability...",
      "policy_rule": "POL-100: Standard Autonomous Recovery Policy Permitted.",
      "stop_condition": "Stop automatic retries after 2 attempts.",
      "risk_level": "low",
      "policy_overridden": false
    },
    "decision_source": "ai_with_policy_validation",
    "fallback_occurred": false,
    "policy_overridden": false
  }
}
```

*Note: The deterministic endpoint `GET /api/payments/[id]/decision` remains fully operational.*

---

## Batch AI Analysis
`POST /api/recovery/ai-analyze`
- **Method**: POST (supports `{ payment_ids: string[], provider?: LLMProviderType }` or empty body for all at-risk payments)
- **Convenience Handler**: `GET /api/recovery/ai-analyze` also available.
- **Financial Invariant**: `recovered_revenue` is strictly `0`. Value is reported under `potentially_recoverable_value`.

---

## Audit Model
Every single AI interaction records an `AIAssessmentAudit`:
- `assessment_id`: Unique identifier (`audit_{payment_id}_{timestamp}`).
- `timestamp`: ISO-8601 execution time.
- `payment_id`: Associated transaction.
- `provider`: Provider type (`mock`, `ollama`, `openai`, `gemini`).
- `model`: Exact model name string.
- `ai_recommendation`: Original AI suggestion object (null if fallback).
- `policy_result`: Deterministic validation outcome (`allowed`, `overridden`, `policy_rule`, `stop_condition`).
- `final_decision`: The authoritative policy-approved decision.
- `decision_source`: `'ai_with_policy_validation'` or `'deterministic_fallback'`.
- `fallback_occurred`: Boolean flag.
- `fallback_reason`: Error description if fallback was triggered.
- `policy_overridden`: Boolean flag indicating if safety rules amended the AI proposal.

---

## UI Changes
1. **Header Provider Badge** (`src/app/page.tsx`):
   - Displays current provider status (e.g., `AI: MOCK (Offline)`, `AI: OLLAMA`, `AI: OPENAI`, `AI: GEMINI`).
   - Displays clear fallback indicator if remote provider fails.
2. **Batch AI Risk Triage**:
   - Secondary button in header alongside Rules Engine triage.
   - Triggers batch AI reasoning across the entire cohort.
   - Displays AI recommendations, policy overrides intercepted count, and final approved action distribution.
3. **Three-Stage Payment Detail Inspector** (`src/components/PaymentDetailModal.tsx`):
   - **Stage 1 (AI Diagnostic Recommendation)**: Displays AI root cause diagnosis, suggested action, confidence gauge, and reasoning explanation.
   - **Stage 2 (Deterministic Policy Validation)**: Prominently highlights whether the action was permitted or overridden. When overridden, shows a high-contrast visual flow: `[AI Suggestion] -> [Policy Override Reason] -> [Final Safe Action]`.
   - **Stage 3 (Final Policy-Approved Action)**: Displays the final authorized intervention, stopping conditions, and regulatory compliance rule.

---

## Testing
Test suite in `scripts/test_llm_provider.mjs` validates 16 comprehensive scenarios:
1. Mock provider returns valid recommendation.
2. Mock provider is deterministic across multiple calls.
3. Invalid LLM action is rejected by validator.
4. Confidence below 0 is rejected.
5. Confidence above 1 is rejected.
6. Missing required field is rejected.
7. Malformed JSON falls back safely.
8. Provider failure falls back to deterministic engine.
9. Expired card cannot become retry_payment (policy override).
10. Retry over maximum attempts is rejected (policy override).
11. Full assessment workflow captures policy override of AI recommendation.
12. Deterministic Phase 2 decision engine functions unchanged.
13. AI assessment endpoint works in mock mode.
14. No API keys or secrets appear in serialized audit structures.
15. Read-only guarantee: No payment status changes during AI assessment.
16. Zero execution invariant: Recovered revenue is strictly 0.

Run all tests via:
```bash
npm test
```

---

## Security
- **No Client Secrets**: API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) are accessed strictly within server-side API routes and lib services.
- **No Response Leaks**: Serialized API responses are audited to ensure no sensitive credentials or keys are exposed.
- **Git Ignored**: `.env` and `.env*.local` are explicitly ignored in `.gitignore`.
- **Sanitized Prompts**: Customer identifiers, card PANs, CVVs, and internal secrets are excluded from LLM context builder.

---

## Completed Deliverables
- [x] Provider-independent abstraction (`LLMProvider`)
- [x] Mock LLM provider (`MockLLMProvider`)
- [x] Ollama local integration (`OllamaLLMProvider`)
- [x] OpenAI integration (`OpenAILLMProvider`)
- [x] Gemini integration (`GeminiLLMProvider`)
- [x] Structured Context Builder (`buildPaymentContext`)
- [x] Strict Output Schema Validator (`validateLLMOutput`)
- [x] Deterministic Policy Override Enforcement (`validateDecision`)
- [x] Deterministic Fallback Engine
- [x] Audit Trail Representation (`AIAssessmentAudit`)
- [x] REST Endpoint: `GET /api/payments/[id]/ai-assessment`
- [x] REST Endpoint: `POST /api/recovery/ai-analyze`
- [x] UI: AI Provider status indicator
- [x] UI: 3-stage visual inspection card in `PaymentDetailModal`
- [x] UI: Batch AI triage controls and metrics banner
- [x] 16/16 Automated Tests in `scripts/test_llm_provider.mjs`
- [x] Zero payment execution verified; recovered revenue strictly ₹0

---

## Known Limitations
- **No Live Payment Execution**: In accordance with Phase 3 specifications, no recovery actions (payment retries, customer nudges, webhook triggers) are dispatched to real or sandbox gateways.
- **External Network Dependencies for Live Providers**: OpenAI, Gemini, and Ollama require network access or running local processes. When unavailable, the system safely operates via fallback or default Mock mode.

---

## Phase 4 Preparation
Phase 4 will introduce **Autonomous Execution and Verification**:
1. **Execution Engine Integration**:
   - The execution engine will consume ONLY the `final_decision` generated by the policy validator.
   - The execution engine must never directly execute the `ai_recommendation`.
2. **State Mutation & Payment Statuses**:
   - Payments will transition from `failed` to `recovery_in_progress` -> `recovered` or `unrecoverable`.
3. **Audited Financial Realization**:
   - `recovered_revenue` will increment **only** after successful gateway webhook confirmation.
4. **Idempotency & Safety Guards**:
   - Every execution will generate an idempotency key preventing duplicate retries or charges.
