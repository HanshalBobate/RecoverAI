# RecoverAI — Phase 4: Bounded Recovery Execution

## Objective
The objective of Phase 4 is to introduce a controlled, bounded recovery execution layer into RecoverAI. For the first time in the project lifecycle, **Recovered Revenue** may become greater than zero, but strictly derived from verified execution outcome records.

**Core Architectural Principle:**
**NO ACTION MAY EXECUTE UNLESS IT HAS PASSED THE DETERMINISTIC POLICY ENGINE.**
The execution layer is strictly prohibited from reinterpreting, modifying, or bypassing policy decisions. The complete decision and execution pipeline is:

```
DETECT → DIAGNOSE → AI RECOMMENDATION → OUTPUT VALIDATION → POLICY VALIDATION → EXECUTION GATE → RECOVERY ACTION → OUTCOME → AUDIT LOG → UPDATED METRICS
```

---

## Phase 1 Context
Phase 1 established the foundational operational ledger:
- Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS.
- Local, offline SQLite database (`data/recoverai.db`) using native `node:sqlite`.
- 200 deterministic synthetic Indian merchant records (Mulberry32 PRNG seed `#4242`) with 171 at-risk payments (151 failed, 20 abandoned) across Indian payment rails (UPI, RuPay, Visa, Mastercard, NetBanking).
- Read-only REST API endpoints and interactive fintech ledger.

---

## Phase 2 Context
Phase 2 built the deterministic **Recovery Decision Engine**:
- Automated root cause diagnosis mapping 7 failure modes to 5 approved recovery actions (`retry_payment`, `contact_customer`, `request_payment_method_update`, `escalate_to_human`, `do_nothing`).
- Centralized policy configuration (`RECOVERY_POLICY_CONFIG`) enforcing maximum retries (`MAX_AUTOMATIC_RETRIES = 2`), bank decline caps (`MAX_BANK_DECLINE_RETRIES = 1`), and blocking retries on expired instruments.
- Calibrated confidence scoring with customer reputation weighting.
- Mandatory stop conditions for every recovery intervention.
- Analytical distinction: `Potentially Recoverable Value` (analytical estimate) vs `Recovered Revenue` (strictly ₹0).

---

## Phase 3 Context
Phase 3 introduced the **LLM Brain & Provider Abstraction**:
- Decoupled `LLMProvider` interface with native `fetch` implementations for Mock, Ollama, OpenAI, and Gemini.
- Context Builder providing minimal, sanitized prompts without customer secrets or database internals.
- Strict JSON Schema Validator checking closed enums and bounded confidence `[0.0, 1.0]`.
- Policy Override Supremacy: The policy engine validates or overrides all AI suggestions before reaching a decision.
- Deterministic Fallback: Failures, timeouts, or invalid JSON seamlessly fall back to the Phase 2 deterministic engine.

---

## Execution Architecture
Phase 4 connects policy-approved decisions to an isolated, safe execution layer:

```
+─────────────────────────────────────────────────────────────────────────+
|                             PAYMENT RECORD                              |
|           (Status: failed / abandoned, Attempt count, Profile)          |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                        PHASE 3 LLM REASONING LAYER                      |
|                (Mock | Ollama | OpenAI | Gemini Providers)              |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                    DETERMINISTIC POLICY VALIDATOR                       |
|           (Supreme Authority: Validates or Overrides AI Proposal)       |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                         HARD EXECUTION GATE                             |
|          Defense in Depth: Verifies Policy Clearance, Idempotency,      |
|             and Retry Stopping Rules before calling any Executor        |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                          RECOVERY EXECUTOR                              |
|                MockRecoveryExecutor | RazorpayTestExecutor              |
|        (Deterministic Simulation vs Sandboxed Test Mode Adapter)        |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                           EXECUTION OUTCOME                             |
|    Status: succeeded | failed | blocked | customer_action_required |    |
|                          escalated | no_action                          |
|         Accounting: amount_recovered > 0 ONLY when succeeded            |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                      IMMUTABLE SQLite AUDIT LEDGER                      |
|              (recovery_executions table stores every attempt)           |
+─────────────────────────────────────────────────────────────────────────+
                                     │
                                     ▼
+─────────────────────────────────────────────────────────────────────────+
|                     ATTRIBUTED RECOVERED REVENUE                        |
|             Formula: SUM(amount_recovered WHERE status='succeeded')     |
+─────────────────────────────────────────────────────────────────────────+
```

---

## Execution Safety Model
The system creates a strict defense-in-depth safety boundary:

```
CLIENT UI ➔ REST API ➔ POLICY VALIDATOR ➔ EXECUTION GATE ➔ EXECUTOR
```

1. **Server Authority**: The client never passes an action or an amount. The client specifies only `payment_id`. The server evaluates the AI diagnosis and runs policy validation to authorize the action.
2. **Untrusted LLM**: Raw LLM output never reaches the executor. Only a `RecoveryDecision` approved by `validateDecision()` can pass the gate.
3. **Double-Check Stopping Rules**: Even if an unauthorized decision slipped past the validator, the Execution Gate and the Executor independently check retry counts and card expiration states before executing.

---

## Execution Modes
Configured via `RECOVERY_EXECUTION_MODE`:
- `mock` (Default): 100% offline, deterministic simulation. Zero external API credentials, zero internet dependency.
- `razorpay_test`: Isolated test-mode adapter strictly requiring test keys (`rzp_test_...`). Rejects production keys.

---

## Mock Executor
- **Implementation**: `src/lib/execution/executors/mock.ts`
- **Behavior**: Deterministic synthetic outcomes based on payment profile:
  - `retry_payment` on transient glitch (`timeout`, `gateway_error`) on attempt 1 with high customer reputation -> `succeeded`, `amount_recovered = payment.amount`.
  - `retry_payment` with weak history or higher attempt count -> `failed`, `amount_recovered = 0`.
  - `contact_customer` -> `customer_action_required`, `amount_recovered = 0` (notification queued).
  - `request_payment_method_update` -> `customer_action_required`, `amount_recovered = 0` (instrument update queued).
  - `escalate_to_human` -> `escalated`, `amount_recovered = 0` (ticket created).
  - `do_nothing` -> `no_action`, `amount_recovered = 0`.
- **Stopping Rules**: Direct executor check blocks any retry if `attempt_count >= 2` or `failure_reason === 'expired_card'`.

---

## Razorpay Test Executor
- **Implementation**: `src/lib/execution/executors/razorpay.ts`
- **Security**: Validates `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` server-side only.
- **Safety Gate**: Rejects any key that does not start with `rzp_test_`.
- **Fault Tolerance**: Missing credentials or network drops return a structured failure result without crashing the application.
- **Zero Real Money Movement**: Operates strictly within Razorpay's test-mode sandbox.

---

## Executable Actions
| Action | Execution Classification | Simulated Outcome | Financial Impact |
| :--- | :--- | :--- | :--- |
| `retry_payment` | Direct Test-Mode Retry | `succeeded` or `failed` | `+amount` if succeeded; ₹0 if failed |
| `contact_customer` | Out-of-band Communication | `customer_action_required` | ₹0 (awaiting customer action) |
| `request_payment_method_update` | Instrument Update Link | `customer_action_required` | ₹0 (awaiting customer card entry) |
| `escalate_to_human` | Operations Queue Ticket | `escalated` | ₹0 (awaiting human operator review) |
| `do_nothing` | Non-actionable Terminal Hold | `no_action` | ₹0 (no action taken) |

---

## Execution Result Schema
```typescript
interface RecoveryExecutionResult {
  execution_id: string;
  payment_id: string;
  assessment_id: string | null;
  action: RecoveryAction;
  status: 'succeeded' | 'failed' | 'blocked' | 'customer_action_required' | 'escalated' | 'no_action';
  amount_attempted: number;
  amount_recovered: number; // 0 <= amount_recovered <= amount_attempted
  execution_mode: 'mock' | 'razorpay_test';
  failure_reason?: string;
  timestamp: string;
  policy_rule: string;
  decision_source: string;
  provider?: string | null;
  model?: string | null;
  already_recovered?: boolean;
}
```

---

## Idempotency
1. **Pre-Execution Check**: Before invoking an executor, `getSuccessfulRecovery(payment_id)` checks SQLite.
2. **Safe Response**: If the payment was already recovered, the system returns the existing execution record with `already_recovered: true`.
3. **No Double-Counting**: Re-executing a payment or re-running batch recovery will never increment `recovered_revenue`.

---

## Execution Gate
Implemented in `src/lib/execution/gate.ts`:
- Check 1: Idempotency check (rejects already-recovered transactions).
- Check 2: Payment finalized check (rejects `status === 'successful'`).
- Check 3: Expired instrument guard (rejects `expired_card` retry).
- Check 4: Retry limit cap (rejects `attempt_count >= 2`).
- Check 5: Bank decline restraint (rejects `bank_decline` re-attempts >= 1).
- Check 6: Routes non-retry interventions into appropriate `customer_action_required` or `escalated` states.

---

## Stop Conditions
Every recovery action is bound by mandatory stopping conditions:
- `POL-002`: Stop retrying expired cards immediately; await cardholder update.
- `POL-003`: Stop automatic retries after 2 attempts; escalate to human support.
- `POL-004`: Stop retrying bank declines after 1 attempt; escalate to operations.
- `POL-005`: High-value transactions (> ₹50,000) escalate immediately upon secondary failure.

---

## Audit Model
Every execution is recorded in the SQLite `recovery_executions` table:
- **Identifier**: `execution_id` (`rec_exec_{payment_id}_{timestamp}`)
- **Target**: `payment_id`
- **Context**: `assessment_id`, `decision_source`, `provider`, `model`
- **Action & Rule**: `action`, `policy_rule`
- **Financial Attribution**: `amount_attempted`, `amount_recovered`
- **Outcome**: `status`, `failure_reason`
- **Audit Timestamp**: `created_at`

---

## Database Changes
Added to `src/lib/db.ts` (`initSchema`):
```sql
CREATE TABLE IF NOT EXISTS recovery_executions (
  execution_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  assessment_id TEXT,
  action TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_attempted REAL NOT NULL,
  amount_recovered REAL NOT NULL DEFAULT 0,
  policy_rule TEXT NOT NULL,
  decision_source TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_executions_payment_id ON recovery_executions(payment_id);
CREATE INDEX IF NOT EXISTS idx_recovery_executions_status ON recovery_executions(status);
CREATE INDEX IF NOT EXISTS idx_recovery_executions_created_at ON recovery_executions(created_at);
```

---

## APIs
### Phase 4 Endpoints:
- `GET /api/payments/[id]/execution-preview` — Returns pre-execution parameters, policy clearance, eligibility, and prior executions.
- `POST /api/recovery/execute` — Executes a single payment recovery. Request: `{ payment_id: string }`. Server determines action.
- `POST /api/recovery/execute-batch` — Executes bounded recovery actions across at-risk payments in batch.
- `GET /api/recovery/audit` — Returns recent persistent execution records and aggregate metrics for operational visibility.

---

## Batch Execution
- **Endpoint**: `POST /api/recovery/execute-batch`
- **Execution Model**: Sequential, controlled execution over at-risk payments.
- **Idempotency**: Running batch execution multiple times skips already-recovered payments and preserves financial integrity.

---

## Revenue Accounting
### The Golden Accounting Rule:
$$\text{Recommendation} \neq \text{Recovery}$$
$$\text{Analytical Estimate} \neq \text{Recovery}$$
$$\text{Verified Execution Success} = \text{Recovery}$$

### Formula:
$$\text{Recovered Revenue} = \sum \text{amount\_recovered} \quad (\text{WHERE } status = \text{'succeeded'})$$

- `recovery_rate = (recovered_revenue / total_revenue_at_risk) * 100`
- `recovery_success_rate = (successful_recoveries / payments_attempted) * 100`

---

## Dashboard Metrics
1. **Revenue at Risk**: Total unrecovered failed + abandoned payments (~₹18,87,975).
2. **Potentially Recoverable**: Algorithmic model estimate of salvageable volume.
3. **Recovered Revenue (Test Mode)**: Live value strictly queried from `recovery_executions` table.
4. **Recovery Rate**: Percentage of revenue at risk successfully recovered.
5. **Policy Blocks**: Count of recovery actions blocked by the policy engine.

---

## UI Changes
- **Payment Detail Modal**:
  - Displays **Stage 4 • Bounded Recovery Execution & Attribution** section.
  - Previews execution mode, eligibility, and potential recovery amount.
  - Interactive `[ Execute Recovery ]` button with loading spinner and disabled states when blocked.
  - Live result banner for `✓ RECOVERY SUCCESSFUL`, `✕ RECOVERY FAILED`, `→ CUSTOMER ACTION REQUIRED`, and `🔒 EXECUTION BLOCKED`.
- **Top Navigation**:
  - Phase 4 Active badge.
  - Execution mode status pill (`Mode: MOCK (Test)`).
  - `[ Run Batch Recovery ]` action button.
  - `[ Audit Ledger ]` action button.
- **Batch Results Banner**: Displays cohort outcomes (Analyzed, Attempted, Succeeded, Failed, Blocked, Recovered Revenue).

---

## Activity Feed
- Live operational stream rendering the most recent recovery executions.
- Badges for Succeeded (Emerald), Blocked (Amber), Action Required (Sky), Failed (Rose).
- Clicking any activity row opens the payment detail inspector for that payment.

---

## Testing
Comprehensive test suite in `scripts/test_recovery_execution.mjs` verifying 29 scenarios (62 assertions):
1. Eligible retry executes successfully in mock mode.
2. Expired card retry is blocked.
3. Retry above maximum attempts is blocked.
4. Policy-approved contact_customer produces customer_action_required.
5. Escalation produces escalated.
6. do_nothing produces no_action.
7. Successful execution records recovered amount.
8. Failed execution records zero recovered amount.
9. recovered_revenue only includes successful executions.
10. Repeated execution of same payment is idempotent.
11. Duplicate execution cannot double-count revenue.
12. Client cannot choose arbitrary action.
13. Client cannot choose arbitrary amount.
14. Execution without policy approval is rejected.
15. AI recommendation overridden by policy cannot execute original action.
16. Missing Razorpay credentials do not crash mock mode.
17. Mock mode works with zero API keys.
18. Original payment record remains intact.
19. Audit record is created for every execution attempt.
20. Batch execution produces correct aggregate metrics.
21. Running batch execution twice does not double recovered revenue.
22. Recovered revenue <= total attempted value.
23. Recovered revenue <= total revenue at risk.
24. Successful recovery count matches successful execution records.
25. TypeScript compilation passes.
26. Production build passes.
27. Phase 1 tests still pass.
28. Phase 2 tests still pass.
29. Phase 3 tests still pass.

---

## Security
- Server-side only: Razorpay test credentials never reach the browser.
- Key inspection: Rejects any Razorpay key lacking the `rzp_test_` prefix.
- Read-only integrity: Original payment records are never mutated or destroyed.
- Input validation: Client cannot supply arbitrary action strings or amounts.

---

## Demo Instructions
1. **Demo A (Successful Recovery)**: Open `pay_rec_0001` (Timeout, healthy customer). Click `Execute Recovery`. Verified: `✓ RECOVERY SUCCESSFUL`, +₹14,999 recovered.
2. **Demo B (Safety Override)**: Open `pay_rec_0200` (Attempt 3, persistent bank decline). Notice button is blocked: `🔒 Execution Blocked`. Policy rule `POL-003` displayed.
3. **Demo C (Customer Action)**: Open payment with expired card. Action is `request_payment_method_update`. Result: `→ CUSTOMER ACTION REQUIRED`, amount recovered: ₹0.
4. **Demo D (Idempotency)**: Execute `pay_rec_0001` again. Notice: `Already Recovered`, recovered revenue does not change.

---

## Known Limitations
- Test-mode only: In accordance with hackathon constraints, no real financial transactions are processed.
- Customer communications are simulated as queued notifications rather than real SMS/WhatsApp dispatches.

---

## Important Architectural Decisions
1. **Single Table for Executions**: Rather than mutating payments in-place, every attempt is appended to `recovery_executions`, preserving complete financial auditability.
2. **Server-Decided Actions**: Eliminates malicious client manipulation of actions or amounts.
3. **Idempotent by Design**: Duplicate clicks or batch reruns never create duplicate recovered revenue.

---

## Phase 5 Preparation
Phase 5 can introduce:
1. **Campaign & Experimentation Optimization**: A/B testing multi-channel customer outreach schedules.
2. **Predictive Recovery Routing**: Routing high-confidence recoverables through automated retries and lower-confidence ones to customer nudges.
3. **Live Webhook Ingestion**: Ingesting real Razorpay webhook settlement events to mark payments permanently settled.
All Phase 5 enhancements will continue to adhere to:
`AI Recommendation -> Policy Validation -> Execution Gate -> Executor -> Audit`.
