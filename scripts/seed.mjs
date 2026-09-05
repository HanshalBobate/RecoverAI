import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mulberry32 Deterministic PRNG
function createPRNG(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const prng = createPRNG(4242);

function randChoice(arr) {
  return arr[Math.floor(prng() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(prng() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 2) {
  const val = min + prng() * (max - min);
  return parseFloat(val.toFixed(decimals));
}

// Realistic Indian customer name pools
const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Advait', 'Ananya', 'Arjun', 'Bhavya', 'Chirag', 'Deepika',
  'Dev', 'Divya', 'Gaurav', 'Isha', 'Ishaan', 'Kavya', 'Karan', 'Meera',
  'Naveen', 'Neha', 'Nikhil', 'Pooja', 'Pranav', 'Priya', 'Rahul', 'Rhea',
  'Rohan', 'Roshni', 'Sahil', 'Sakshi', 'Sameer', 'Sanvi', 'Siddharth', 'Sneha',
  'Tarun', 'Tanvi', 'Varun', 'Vidya', 'Vikram', 'Vandana', 'Yash', 'Zoya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Mehta', 'Iyer', 'Menon', 'Nair', 'Reddy',
  'Rao', 'Choudhury', 'Mukherjee', 'Banerjee', 'Chatterjee', 'Gupta', 'Aggarwal',
  'Bansal', 'Singhania', 'Kapoor', 'Malhotra', 'Bhatia', 'Joshi', 'Kulkarni',
  'Deshmukh', 'Pawar', 'Bhattacharya', 'Ghosh', 'Sen', 'Dutta', 'Sinha', 'Chauhan'
];

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'IndusInd Bank', 'Yes Bank'];
const CARD_NETWORKS = ['Visa', 'Mastercard', 'RuPay'];

// 10 Distinct Scenarios to generate realistic distribution
const SCENARIOS = [
  {
    code: 'A_STRONG_CUSTOMER_TEMP_FAILURE',
    desc: 'Strong customer with high loyalty experiencing gateway/timeout glitch',
    weight: 15,
  },
  {
    code: 'B_CHRONIC_FAILURE_CUSTOMER',
    desc: 'Customer with repeated previous failures and multiple attempts',
    weight: 15,
  },
  {
    code: 'C_EXPIRED_CARD',
    desc: 'Active subscription customer whose payment card recently expired',
    weight: 15,
  },
  {
    code: 'D_BANK_DECLINE',
    desc: 'Bank declined transaction due to limits, fraud filter, or international restriction',
    weight: 15,
  },
  {
    code: 'E_INSUFFICIENT_FUNDS',
    desc: 'Debit/UPI transaction declined due to insufficient account balance',
    weight: 15,
  },
  {
    code: 'F_CHECKOUT_ABANDONED',
    desc: 'Customer dropped off at payment checkout without completing flow',
    weight: 15,
  },
  {
    code: 'G_GATEWAY_ERROR',
    desc: 'Merchant gateway API failure or processor downstream unavailability',
    weight: 10,
  },
  {
    code: 'H_AUTHENTICATION_FAILURE',
    desc: 'Customer failed 3DS/OTP verification or session expired',
    weight: 10,
  },
  {
    code: 'I_SUCCESSFUL_HISTORICAL',
    desc: 'Benchmark successful payment from a healthy paying customer',
    weight: 10,
  },
  {
    code: 'J_POOR_PAYMENT_HISTORY',
    desc: 'Customer with poor subscription standing and zero successful payments',
    weight: 10,
  },
];

export function generateSeedRecords(totalCount = 200) {
  const records = [];
  const baseTimestamp = new Date('2026-03-01T08:00:00.000Z').getTime();

  for (let i = 1; i <= totalCount; i++) {
    const paymentId = `pay_rec_${String(i).padStart(4, '0')}`;
    const custNum = randInt(101, 260);
    const customerId = `cust_in_${String(custNum).padStart(4, '0')}`;
    const firstName = randChoice(FIRST_NAMES);
    const lastName = randChoice(LAST_NAMES);
    const customerName = `${firstName} ${lastName}`;
    const customerEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(10, 99)}@example.in`;

    // Pick scenario based on index and distribution
    const scenarioIndex = (i - 1) % SCENARIOS.length;
    const scenario = SCENARIOS[scenarioIndex];

    let status = 'failed';
    let failureReason = 'gateway_error';
    let attemptCount = 1;
    let subscriptionStatus = 'active';
    let prevSuccess = 0;
    let prevFail = 0;
    let methodType = 'card';
    let methodDetail = '';
    let amount = 0;

    const bank = randChoice(BANKS);
    const cardNet = randChoice(CARD_NETWORKS);
    const cardLast4 = String(randInt(1000, 9999));

    switch (scenario.code) {
      case 'A_STRONG_CUSTOMER_TEMP_FAILURE':
        // Strong customer, temporary timeout or gateway error
        status = 'failed';
        failureReason = randChoice(['timeout', 'gateway_error']);
        attemptCount = randInt(1, 2);
        subscriptionStatus = 'active';
        prevSuccess = randInt(12, 38);
        prevFail = randInt(0, 1);
        methodType = randChoice(['card', 'upi', 'netbanking']);
        amount = randChoice([2499, 4999, 8999, 14999, 28000]);
        if (methodType === 'card') methodDetail = `${bank} ${cardNet} ****${cardLast4}`;
        else if (methodType === 'upi') methodDetail = `${firstName.toLowerCase()}@ok${bank.split(' ')[0].toLowerCase()}`;
        else methodDetail = `${bank} Corporate NetBanking`;
        break;

      case 'B_CHRONIC_FAILURE_CUSTOMER':
        // Customer with multiple past failures
        status = 'failed';
        failureReason = randChoice(['bank_decline', 'insufficient_funds', 'authentication_failure']);
        attemptCount = randInt(3, 5);
        subscriptionStatus = 'past_due';
        prevSuccess = randInt(0, 2);
        prevFail = randInt(3, 8);
        methodType = 'card';
        amount = randChoice([1299, 1999, 3499, 5999]);
        methodDetail = `${bank} ${cardNet} ****${cardLast4}`;
        break;

      case 'C_EXPIRED_CARD':
        // Expired card
        status = 'failed';
        failureReason = 'expired_card';
        attemptCount = randInt(1, 3);
        subscriptionStatus = 'active';
        prevSuccess = randInt(6, 18);
        prevFail = randInt(0, 1);
        methodType = 'card';
        amount = randChoice([999, 1499, 2999, 7999, 12999]);
        methodDetail = `${bank} ${cardNet} ****${cardLast4} (Expired)`;
        break;

      case 'D_BANK_DECLINE':
        // Bank decline (limit / policy)
        status = 'failed';
        failureReason = 'bank_decline';
        attemptCount = randInt(1, 3);
        subscriptionStatus = 'active';
        prevSuccess = randInt(2, 9);
        prevFail = randInt(1, 3);
        methodType = randChoice(['card', 'netbanking']);
        amount = randChoice([15000, 32000, 48000, 75000, 120000]); // higher B2B ticket sizes often hit bank limits
        methodDetail = methodType === 'card' ? `${bank} Business ${cardNet} ****${cardLast4}` : `${bank} Corporate NetBanking`;
        break;

      case 'E_INSUFFICIENT_FUNDS':
        // Insufficient funds
        status = 'failed';
        failureReason = 'insufficient_funds';
        attemptCount = randInt(1, 3);
        subscriptionStatus = 'past_due';
        prevSuccess = randInt(1, 5);
        prevFail = randInt(1, 4);
        methodType = randChoice(['card', 'upi']);
        amount = randChoice([499, 899, 1499, 2499, 4200]);
        methodDetail = methodType === 'upi' ? `${firstName.toLowerCase()}@okhdfcbank` : `${bank} Debit ${cardNet} ****${cardLast4}`;
        break;

      case 'F_CHECKOUT_ABANDONED':
        // Checkout abandonment
        status = 'abandoned';
        failureReason = 'checkout_abandoned';
        attemptCount = 1;
        subscriptionStatus = 'unpaid';
        prevSuccess = randInt(0, 3);
        prevFail = randInt(0, 2);
        methodType = randChoice(['upi', 'card']);
        amount = randChoice([799, 1299, 2199, 3999, 6499]);
        methodDetail = methodType === 'upi' ? 'UPI Intent Triggered' : 'Checkout Form Abandoned';
        break;

      case 'G_GATEWAY_ERROR':
        // Infrastructure / Gateway error
        status = 'failed';
        failureReason = 'gateway_error';
        attemptCount = randInt(1, 2);
        subscriptionStatus = 'active';
        prevSuccess = randInt(4, 15);
        prevFail = 0;
        methodType = randChoice(['card', 'upi', 'netbanking']);
        amount = randChoice([3500, 8500, 19500, 42000]);
        methodDetail = `${bank} Gateway Handshake 504`;
        break;

      case 'H_AUTHENTICATION_FAILURE':
        // 3D Secure / OTP drop
        status = 'failed';
        failureReason = 'authentication_failure';
        attemptCount = randInt(1, 2);
        subscriptionStatus = 'active';
        prevSuccess = randInt(3, 10);
        prevFail = randInt(1, 2);
        methodType = 'card';
        amount = randChoice([1899, 3299, 5499, 9999]);
        methodDetail = `${bank} 3DS Verification Incomplete`;
        break;

      case 'I_SUCCESSFUL_HISTORICAL':
        // Benchmark successful payment
        status = 'successful';
        failureReason = null;
        attemptCount = 1;
        subscriptionStatus = 'active';
        prevSuccess = randInt(8, 25);
        prevFail = 0;
        methodType = randChoice(['card', 'upi']);
        amount = randChoice([1499, 2999, 4999, 9999, 18000]);
        methodDetail = methodType === 'upi' ? `${firstName.toLowerCase()}@okaxis` : `${bank} ${cardNet} ****${cardLast4}`;
        break;

      case 'J_POOR_PAYMENT_HISTORY':
        // Chronic non-paying / canceled
        status = randChoice(['failed', 'pending']);
        failureReason = status === 'failed' ? randChoice(['bank_decline', 'insufficient_funds']) : null;
        attemptCount = randInt(2, 4);
        subscriptionStatus = 'canceled';
        prevSuccess = 0;
        prevFail = randInt(4, 9);
        methodType = 'card';
        amount = randChoice([999, 1999, 3999]);
        methodDetail = `${bank} ${cardNet} ****${cardLast4}`;
        break;
    }

    // Time offsets within the last 5 days
    const minutesAgo = (totalCount - i) * 35 + randInt(2, 18);
    const createdAtDate = new Date(baseTimestamp - minutesAgo * 60 * 1000);
    const lastAttemptDate = new Date(createdAtDate.getTime() + (attemptCount - 1) * randInt(15, 90) * 60 * 1000);

    records.push({
      payment_id: paymentId,
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail,
      amount,
      currency: 'INR',
      status,
      failure_reason: failureReason,
      attempt_count: attemptCount,
      created_at: createdAtDate.toISOString(),
      last_attempt_at: lastAttemptDate.toISOString(),
      subscription_status: subscriptionStatus,
      previous_successful_payments: prevSuccess,
      previous_failed_payments: prevFail,
      payment_method_type: methodType,
      payment_method_detail: methodDetail,
    });
  }

  return records;
}

export function seedDatabase() {
  const customPath = process.env.DATABASE_PATH;
  const dbPath = customPath
    ? (path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath))
    : path.join(process.cwd(), 'data', 'recoverai.db');

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[RecoverAI] Connecting to SQLite database at: ${dbPath}`);
  const db = new DatabaseSync(dbPath);

  // Re-create schema cleanly
  db.exec(`
    DROP TABLE IF EXISTS payments;

    CREATE TABLE payments (
      payment_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      failure_reason TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT NOT NULL,
      subscription_status TEXT NOT NULL DEFAULT 'active',
      previous_successful_payments INTEGER NOT NULL DEFAULT 0,
      previous_failed_payments INTEGER NOT NULL DEFAULT 0,
      payment_method_type TEXT NOT NULL DEFAULT 'card',
      payment_method_detail TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX idx_payments_status ON payments(status);
    CREATE INDEX idx_payments_failure_reason ON payments(failure_reason);
    CREATE INDEX idx_payments_customer_id ON payments(customer_id);
    CREATE INDEX idx_payments_created_at ON payments(created_at);
  `);

  const insertStmt = db.prepare(`
    INSERT INTO payments (
      payment_id, customer_id, customer_name, customer_email,
      amount, currency, status, failure_reason,
      attempt_count, created_at, last_attempt_at,
      subscription_status, previous_successful_payments, previous_failed_payments,
      payment_method_type, payment_method_detail
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  const records = generateSeedRecords(200);

  const statusCounts = {};
  const reasonCounts = {};
  let totalAmount = 0;
  let revenueAtRisk = 0;

  for (const r of records) {
    insertStmt.run(
      r.payment_id,
      r.customer_id,
      r.customer_name,
      r.customer_email,
      r.amount,
      r.currency,
      r.status,
      r.failure_reason,
      r.attempt_count,
      r.created_at,
      r.last_attempt_at,
      r.subscription_status,
      r.previous_successful_payments,
      r.previous_failed_payments,
      r.payment_method_type,
      r.payment_method_detail
    );

    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.failure_reason) {
      reasonCounts[r.failure_reason] = (reasonCounts[r.failure_reason] || 0) + 1;
    }
    totalAmount += r.amount;
    if (r.status === 'failed' || r.status === 'abandoned') {
      revenueAtRisk += r.amount;
    }
  }

  console.log(`=======================================================`);
  console.log(`  RecoverAI — Database Seeding Complete`);
  console.log(`=======================================================`);
  console.log(`Total Records Inserted: ${records.length}`);
  console.log(`Total Volume:           ₹${totalAmount.toLocaleString('en-IN')}`);
  console.log(`Total Revenue at Risk:  ₹${revenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`-------------------------------------------------------`);
  console.log(`Status Breakdown:`);
  for (const [st, count] of Object.entries(statusCounts)) {
    console.log(`  - ${st.padEnd(15)}: ${count} records (${((count / records.length) * 100).toFixed(1)}%)`);
  }
  console.log(`-------------------------------------------------------`);
  console.log(`Failure Reason Breakdown:`);
  for (const [reason, count] of Object.entries(reasonCounts)) {
    console.log(`  - ${reason.padEnd(25)}: ${count} records`);
  }
  console.log(`=======================================================`);

  db.close();
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase();
}
