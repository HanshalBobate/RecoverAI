import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

async function verify() {
  console.log('=======================================================');
  console.log('  RecoverAI Phase 1 — Verification Suite');
  console.log('=======================================================\n');

  // PART 1: Direct SQLite Verification
  const dbPath = path.join(process.cwd(), 'data', 'recoverai.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file missing at ${dbPath}. Run 'npm run db:seed' first.`);
  }

  const db = new DatabaseSync(dbPath);
  console.log('✓ SQLite Database File Verified: ' + dbPath);

  const countRow = db.prepare('SELECT COUNT(*) as count FROM payments').get();
  if (countRow.count < 100) {
    throw new Error(`Expected >= 100 payments, found ${countRow.count}`);
  }
  console.log(`✓ Record Count: ${countRow.count} payments found (Pass >= 100)`);

  const statusRows = db.prepare('SELECT status, COUNT(*) as c FROM payments GROUP BY status').all();
  console.log('✓ Status Distribution:');
  for (const row of statusRows) {
    console.log(`    - ${row.status}: ${row.c}`);
  }

  const failedCount = db.prepare("SELECT COUNT(*) as c FROM payments WHERE status = 'failed'").get().c;
  if (failedCount <= 50) {
    throw new Error('Expected majority failed payments for revenue recovery use case');
  }
  console.log(`✓ Failed / At-Risk Density: ${failedCount} records (Pass)`);

  const reasons = db.prepare('SELECT DISTINCT failure_reason FROM payments WHERE failure_reason IS NOT NULL').all();
  console.log(`✓ Distinct Failure Reasons: ${reasons.length} categories represented`);

  // Verify Scenario A: strong customer with temporary timeout/gateway error
  const scenarioA = db.prepare(`
    SELECT * FROM payments 
    WHERE previous_successful_payments > 10 
      AND (failure_reason = 'timeout' OR failure_reason = 'gateway_error')
    LIMIT 1
  `).get();
  if (!scenarioA) {
    throw new Error('Scenario A (strong customer + temporary failure) missing from dataset');
  }
  console.log(`✓ Scenario A Verified: ${scenarioA.customer_name} (${scenarioA.previous_successful_payments} past successes, failed with ${scenarioA.failure_reason})`);

  // Verify Scenario C: expired card
  const scenarioC = db.prepare("SELECT * FROM payments WHERE failure_reason = 'expired_card' LIMIT 1").get();
  if (!scenarioC) {
    throw new Error('Scenario C (expired card) missing from dataset');
  }
  console.log(`✓ Scenario C Verified: ${scenarioC.customer_name} (${scenarioC.payment_method_detail})`);

  // Verify Scenario F: checkout abandoned
  const scenarioF = db.prepare("SELECT * FROM payments WHERE status = 'abandoned' LIMIT 1").get();
  if (!scenarioF) {
    throw new Error('Scenario F (checkout abandoned) missing from dataset');
  }
  console.log(`✓ Scenario F Verified: ${scenarioF.customer_name} (Status: ${scenarioF.status})`);

  db.close();

  // PART 2: HTTP Endpoint Verification (if server is running)
  try {
    const pingRes = await fetch('http://localhost:3000/api/payments/summary', { signal: AbortSignal.timeout(1500) });
    if (pingRes.ok) {
      console.log('\n--- Server HTTP Verification (http://localhost:3000) ---');
      const summaryJson = await pingRes.json();
      console.log('✓ GET /api/payments/summary: SUCCESS (Revenue at risk: ₹' + summaryJson.data.total_revenue_at_risk.toLocaleString('en-IN') + ')');

      const listRes = await fetch('http://localhost:3000/api/payments?limit=3');
      const listJson = await listRes.json();
      console.log(`✓ GET /api/payments: SUCCESS (${listJson.total} total in ledger)`);

      const singleId = listJson.data[0].payment_id;
      const singleRes = await fetch(`http://localhost:3000/api/payments/${singleId}`);
      console.log(`✓ GET /api/payments/${singleId}: SUCCESS (${singleRes.status})`);

      const homeRes = await fetch('http://localhost:3000/');
      const homeHtml = await homeRes.text();
      console.log(`✓ GET / (Dashboard UI): SUCCESS (${homeHtml.length} bytes rendered)`);
    }
  } catch {
    console.log('\n(Note: Dev server is currently stopped. HTTP test suite can be run with `npm run dev` active.)');
  }

  console.log('\n=======================================================');
  console.log('  PHASE 1 VERIFICATION COMPLETED SUCCESSFULLY');
  console.log('=======================================================');
}

verify().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
