# RecoverAI — Phase 1

## Objective

The objective of Phase 1 is to establish a rock-solid, production-grade local foundation for **RecoverAI** without over-engineering or introducing premature autonomous logic. 

Phase 1 provides:
1. A strongly-typed SQLite database containing 200 deterministic, realistic Indian merchant payment transactions.
2. Distinct representation of 10 critical payment scenarios (scenarios A through J) covering temporary gateway glitches, chronic non-payers, expired instruments, bank declines, and abandoned checkout flows.
3. Clean, read-only Next.js REST API endpoints delivering payment records and descriptive aggregate statistics.
4. A modern fintech operations dashboard with executive metric cards, interactive filters, search capabilities, and a payment inspector modal.
5. Persistent architecture contracts to prepare for Phase 2 (AI Diagnosis and Decision Engine).

---

## Product Context

### Track 03: AI Revenue Recovery
In modern merchant checkout operations, 5–15% of transactions fail or are abandoned, resulting in substantial lost revenue. Traditional payment retry logic is dumb (fixed intervals, blind retries) and often triggers customer friction, bank rate limits, or additional gateway fees.

**RecoverAI** will eventually:
1. Detect revenue at risk across merchant payment pipelines.
2. Diagnose why each payment failed using customer profile history, error codes, and merchant policies.
3. Decide the optimal recovery intervention (smart retry scheduling, UPI deep-link fallback, card update notification, or human support escalation).
4. Execute bounded, policy-compliant recovery workflows.
5. Verify and attribute recovered funds.
6. Enforce strict stopping rules and maintain an immutable audit trail.

### What Phase 1 Does NOT Do
- Does **not** implement autonomous recovery decisions or automated retry dispatch.
- Does **not** connect to paid or live external LLM APIs (Ollama, OpenAI, Gemini).
- Does **not** perform real money movements or link to live payment processors.
- Does **not** fabricate fake "revenue recovered" metrics before recovery mechanisms are active.

Phase 1 establishes the ground-truth operational ledger.

---

## Architecture

```
                                  RecoverAI Architecture
                                  
+----------------------------------------------------------------------------------+
|                            Next.js 15 Client Layer                               |
|                                                                                  |
|  +--------------------+  +----------------------+  +--------------------------+  |
|  | Executive Metrics  |  | Filter & Search Bar  |  | Interactive Ledger Table |  |
|  | (Revenue at Risk,  |  | (Status, Failure     |  | (Status Badges,          |  |
|  |  Failed, Abandoned)|  |  Reason, Search)     |  |  INR Formatting, Modal)  |  |
|  +---------+----------+  +----------+-----------+  +------------+-------------+  |
+------------|------------------------|---------------------------|----------------+
             |                        |                           |
             +------------------------+---------------------------+
                                      | Fetch
                                      v
+----------------------------------------------------------------------------------+
|                           Next.js 15 API Route Layer                             |
|                                                                                  |
|  - GET /api/payments          (Query filtering, pagination, search)              |
|  - GET /api/payments/[id]     (Single record lookup)                             |
|  - GET /api/payments/summary  (Descriptive aggregations & breakdown)             |
+-------------------------------------+--------------------------------------------+
                                      | Queries
                                      v
+----------------------------------------------------------------------------------+
|                              Data Access Layer                                   |
|                             (src/lib/db.ts)                                      |
|                                                                                  |
|             Native Node.js 24 SQLite Engine (`node:sqlite` DatabaseSync)         |
+-------------------------------------+--------------------------------------------+
                                      | File I/O
                                      v
+----------------------------------------------------------------------------------+
|                             SQLite Database File                                 |
|                            (data/recoverai.db)                                   |
|                                                                                  |
|  Table: `payments` (200 deterministic Indian merchant payment records)           |
+----------------------------------------------------------------------------------+
```

### Data Flow
1. **Seeding**: The deterministic script (`scripts/seed.mjs`) initializes `data/recoverai.db`, creates table indices, and populates 200 records using a fixed Mulberry32 PRNG seed (`4242`).
2. **Server Access**: Next.js server routes interact with the SQLite database synchronously via native `node:sqlite` (`DatabaseSync`), bypassing any network latency or external service dependencies.
3. **Client UI**: The React App Router frontend fetches `/api/payments` and `/api/payments/summary`, dynamically rendering telemetry, filters, and records.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server External Packages)
- **Runtime**: Node.js v24.14.0
- **Language**: TypeScript 5.7 (Strict Mode)
- **Styling**: Tailwind CSS v4 + PostCSS
- **Icons**: Lucide React
- **Database Engine**: Native `node:sqlite` (`DatabaseSync`)
- **Seeding Engine**: Pure JavaScript Mulberry32 PRNG

---

## Database Schema

Database file path: `./data/recoverai.db`

### Table: `payments`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `payment_id` | TEXT | NO (PK) | Unique payment identifier (e.g. `pay_rec_0001`) |
| `customer_id` | TEXT | NO | Customer account ID (e.g. `cust_in_0142`) |
| `customer_name` | TEXT | NO | Synthetic Indian customer name |
| `customer_email` | TEXT | NO | Synthetic customer email address |
| `amount` | REAL | NO | Transaction amount in INR |
| `currency` | TEXT | NO | Currency ISO code (`INR`) |
| `status` | TEXT | NO | Status: `'failed'`, `'abandoned'`, `'pending'`, `'successful'` |
| `failure_reason` | TEXT | YES | Reason: `'insufficient_funds'`, `'bank_decline'`, `'expired_card'`, `'timeout'`, `'authentication_failure'`, `'gateway_error'`, `'checkout_abandoned'` |
| `attempt_count` | INTEGER | NO | Number of gateway attempts made (1–5) |
| `created_at` | TEXT | NO | ISO 8601 creation timestamp |
| `last_attempt_at` | TEXT | NO | ISO 8601 timestamp of last attempt |
| `subscription_status`| TEXT | NO | Customer standing: `'active'`, `'past_due'`, `'trialing'`, `'canceled'`, `'unpaid'` |
| `previous_successful_payments` | INTEGER | NO | Historical count of successful transactions |
| `previous_failed_payments` | INTEGER | NO | Historical count of failed transactions |
| `payment_method_type` | TEXT | NO | Method: `'card'`, `'upi'`, `'netbanking'` |
| `payment_method_detail` | TEXT | NO | Instrument metadata (e.g. `HDFC Visa ****4242`) |

### Database Indexes
- `idx_payments_status`: Speeds up filtering by status (`failed`, `abandoned`, etc.).
- `idx_payments_failure_reason`: Speeds up categorical failure queries.
- `idx_payments_customer_id`: Speeds up customer history profile lookups.
- `idx_payments_created_at`: Optimizes chronological sorting.

---

## Synthetic Dataset

- **Total Records**: 200 records
- **Random Seed**: `4242` (Deterministic Mulberry32 PRNG)
- **Currency**: INR (`₹`)
- **Total Transaction Volume**: ₹20,27,449
- **Total Revenue at Risk**: ₹18,87,975 (Failed: ₹18,33,995 | Abandoned: ₹53,980)

### Status Breakdown
- `failed`: 151 records (75.5%)
- `abandoned`: 20 records (10.0%)
- `successful`: 20 records (10.0%)
- `pending`: 9 records (4.5%)

### Failure Reason Breakdown
- `insufficient_funds`: 34 records
- `bank_decline`: 31 records
- `gateway_error`: 26 records
- `authentication_failure`: 26 records
- `expired_card`: 20 records
- `checkout_abandoned`: 20 records
- `timeout`: 14 records

### Scenarios Represented
- **Scenario A (Strong Customer + Temporary Failure)**: High previous success count (12–38), 0–1 past failures, failed due to gateway timeout or processor 504 error.
- **Scenario B (Chronic Failure Customer)**: Multiple previous failures (3–8), 3–5 attempts on current payment, status `past_due`.
- **Scenario C (Expired Payment Method)**: Active subscription, previously successful, failed with `expired_card`.
- **Scenario D (Bank Decline)**: Large B2B / consumer ticket size (₹15,000–₹1,20,000) hitting daily limits or card controls.
- **Scenario E (Insufficient Funds)**: Small/mid ticket (₹499–₹4,200) declined for insufficient debit/UPI balance.
- **Scenario F (Checkout Abandonment)**: Customer initiated checkout session but dropped off before completing authentication.
- **Scenario G (Gateway Failure)**: Infrastructure outage or 504 gateway handshake timeout.
- **Scenario H (Authentication Failure)**: 3D Secure OTP verification timeout or session exit.
- **Scenario I (Successful Historical)**: Benchmark healthy payments establishing customer baseline.
- **Scenario J (Poor Payment History)**: Repeated non-paying status with zero previous successes and canceled subscription status.

---

## API Specification

### 1. `GET /api/payments`
Retrieves a list of payment records with optional query filtering and pagination.

- **Query Parameters**:
  - `status` *(optional, string)*: Filter by status (`failed`, `abandoned`, `pending`, `successful`).
  - `failure_reason` *(optional, string)*: Filter by reason (`insufficient_funds`, `bank_decline`, etc.).
  - `search` *(optional, string)*: Substring match against `customer_name`, `customer_email`, or `payment_id`.
  - `limit` *(optional, integer, default: 250)*: Number of records to return.
  - `offset` *(optional, integer, default: 0)*: Pagination offset.
- **Response Format**:
  ```json
  {
    "success": true,
    "total": 151,
    "limit": 250,
    "offset": 0,
    "data": [
      {
        "payment_id": "pay_rec_0001",
        "customer_id": "cust_in_0142",
        "customer_name": "Aarav Sharma",
        "customer_email": "aarav.sharma24@example.in",
        "amount": 4999,
        "currency": "INR",
        "status": "failed",
        "failure_reason": "timeout",
        "attempt_count": 2,
        "created_at": "2026-03-01T04:47:00.000Z",
        "last_attempt_at": "2026-03-01T05:32:00.000Z",
        "subscription_status": "active",
        "previous_successful_payments": 24,
        "previous_failed_payments": 0,
        "payment_method_type": "card",
        "payment_method_detail": "HDFC Bank Visa ****4821"
      }
    ]
  }
  ```

### 2. `GET /api/payments/summary`
Calculates and returns descriptive aggregates across all payments in the database.

- **Query Parameters**: None
- **Response Format**:
  ```json
  {
    "success": true,
    "data": {
      "total_payments": 200,
      "failed_payments": 151,
      "abandoned_payments": 20,
      "pending_payments": 9,
      "successful_payments": 20,
      "total_revenue_at_risk": 1887975,
      "failed_revenue": 1833995,
      "abandoned_revenue": 53980,
      "pending_revenue": 34991,
      "successful_revenue": 104483,
      "by_failure_reason": {
        "timeout": { "count": 14, "amount": 164986 },
        "bank_decline": { "count": 31, "amount": 894000 },
        "expired_card": { "count": 20, "amount": 107980 }
      },
      "by_status": {
        "failed": { "count": 151, "amount": 1833995 },
        "abandoned": { "count": 20, "amount": 53980 },
        "successful": { "count": 20, "amount": 104483 },
        "pending": { "count": 9, "amount": 34991 }
      }
    }
  }
  ```

### 3. `GET /api/payments/[id]`
Retrieves full details for a specific payment ID.

- **Path Parameter**: `id` (e.g. `pay_rec_0001`)
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { ...payment } }`
  - `404 Not Found`: `{ "success": false, "error": "Payment with ID 'pay_rec_9999' not found" }`

---

## Frontend

### Dashboard Layout
1. **Executive Header**:
   - RecoverAI branding with Phase 1 Baseline badge.
   - Status indicator: "Demo Environment" (live pulse).
   - "Refresh Ledger" button triggering immediate SWR-style data refresh.
2. **Track 03 Information Banner**:
   - Explains context and confirms baseline operational isolation.
3. **Four Metric Cards**:
   - **Revenue at Risk**: Total INR sum of failed and abandoned payments (e.g. `₹18,87,975`).
   - **Failed Payments**: Total count (`151`) and percentage of ledger (`76%`).
   - **Abandoned Checkouts**: Total count (`20`) and abandonment rate (`10%`).
   - **Payments Analyzed**: Total dataset records (`200`).
4. **Interactive Controls & Filters**:
   - Real-time search query box across customer name, email, and ID.
   - Status pills (`All`, `Failed`, `Abandoned`, `Pending`, `Successful`).
   - Failure Reason dropdown filter covering all 7 categories.
   - Quick Reset button.
5. **Interactive Payments Ledger**:
   - Columns: Customer (with avatar initials), Payment ID, Amount (`₹`), Status Badge, Failure Reason, Attempts, Last Attempt, and Inspect Action.
   - Distinctive visual badges: Red for `FAILED`, Amber for `ABANDONED`, Sky for `PENDING`, Emerald for `SUCCESSFUL`.
6. **Payment Detail Inspector Modal**:
   - Transaction header with ID and status.
   - Prominent INR amount card.
   - Customer profile: name, email, ID, subscription status.
   - Channel details: payment type and instrument.
   - Descriptive failure diagnosis.
   - Lifetime historical payment profile (past successes vs failures with calculated lifetime success rate).
   - Operational baseline notice.

---

## Environment Variables

Configured in `.env.example`:

```env
# Phase 1 Database Configuration
DATABASE_PATH=./data/recoverai.db

# Server Configuration
NODE_ENV=development
PORT=3000

# Future LLM Provider Convention (Planned for Phase 2+)
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OPENAI_API_KEY=
# GEMINI_API_KEY=
```

`.env` and SQLite database binaries are ignored in `.gitignore`.

---

## Commands

### Install Dependencies
```bash
npm install
```

### Initialize and Seed Database
```bash
npm run db:seed
```

### Start Development Server
```bash
npm run dev
```

### Build Production Bundle
```bash
npm run build
```

---

## Completed Deliverables

- [x] Inspected project environment and chose Next.js 15 + TypeScript + Tailwind CSS + native SQLite (`node:sqlite`).
- [x] Configured `.env.example` with future LLM conventions and added `.env` to `.gitignore`.
- [x] Created `payments` SQLite table with indexes and schema migrations.
- [x] Built deterministic seed script (`scripts/seed.mjs`) with Mulberry32 PRNG (seed `4242`).
- [x] Generated 200 realistic Indian merchant records with INR currency.
- [x] Embedded scenarios A through J with realistic failure categories.
- [x] Built `GET /api/payments` with search, status, and failure reason filters.
- [x] Built `GET /api/payments/summary` with descriptive aggregations.
- [x] Built `GET /api/payments/[id]` for single record lookups.
- [x] Designed fintech operations dashboard with 4 metric cards.
- [x] Created interactive payments table with formatted amounts, status badges, and human-readable failure reasons.
- [x] Built payment detail inspector modal with customer history profile.
- [x] Verified zero API keys required, zero hardcoded secrets.
- [x] Created `README.md` and `phase-1.md`.

---

## Known Limitations

1. **Static Baseline**: Records reflect point-in-time captured failures; in Phase 1, there is no automatic stream or webhook ingestion.
2. **Descriptive Only**: The metrics and summaries describe current state only; no recoverability probabilities or intervention predictions are generated.
3. **Local In-Process DB**: Uses local SQLite file (`data/recoverai.db`). Suitable for single-instance hackathon MVP demonstration.

---

## Important Decisions

1. **Native `node:sqlite` over External Native Addons**: Using Node 24's built-in `node:sqlite` avoids `node-gyp`, Python, and Visual Studio C++ compiler dependencies on Windows while delivering native C SQLite performance.
2. **Fixed Deterministic PRNG**: Utilizing Mulberry32 with seed `4242` ensures every evaluator and developer gets the exact same 200 records, metric values, and edge cases.
3. **No Premature AI Mocking**: We strictly avoided fabricating "AI confidence scores" or "Recovered" revenue metrics in Phase 1. This guarantees clean demarcation when the Phase 2 AI decision engine is evaluated against baseline data.

---

## Phase 2 Preparation

Phase 2 will introduce the **AI Revenue Recovery Decision Engine**. It will build on the following contracts:

1. **Target Cohort**: Query `/api/payments?status=failed` or status `abandoned` to select candidate records for recovery diagnosis.
2. **Input Features for LLM / Rules Engine**:
   - `failure_reason`: Category of failure.
   - `attempt_count`: Current retry count.
   - `subscription_status`: Standing of the customer.
   - `previous_successful_payments` vs `previous_failed_payments`: Customer credit/loyalty profile.
   - `amount`: Financial value determining retry thresholds and SLA tiering.
3. **Proposed Action Taxonomy (for Phase 2)**:
   - `SMART_RETRY`: Schedule delayed retry (ideal for Scenario A gateway timeouts and Scenario E timing).
   - `PAYMENT_METHOD_UPDATE_REQUEST`: Send link to update card (ideal for Scenario C expired cards).
   - `UPI_COLLECT_DEEP_LINK`: Dispatch direct UPI push intent (ideal for Scenario F abandoned checkout and 3DS failure).
   - `CUSTOMER_SUPPORT_ESCALATION`: Flag for high-value B2B limit issues (Scenario D).
   - `HALT_RECOVERY`: Do not waste retries on chronic non-payers (Scenario B and J).
4. **Audit Trail Schema**: Phase 2 will introduce a companion table `recovery_actions` linked by `payment_id`.
