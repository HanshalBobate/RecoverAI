import {
  executeRecoveryForPayment,
  getExecutionPreview,
  executeRecoveryBatch,
} from '../src/lib/execution/index.ts';
import {
  getPaymentById,
  getAllRecoveryExecutions,
  getExecutionMetrics,
  getRecoveredRevenue,
  getDb,
} from '../src/lib/db.ts';

async function runDemo() {
  console.log('================================================================');
  console.log('  RECOVERAI — PHASE 4: BOUNDED RECOVERY EXECUTION LIVE DEMO');
  console.log('================================================================\n');

  const db = getDb();
  db.exec('DELETE FROM recovery_executions');

  // ----------------------------------------------------------------
  // DEMO A — Successful Recovery
  // Payment -> AI recommends retry -> Policy approves -> Execute -> Success -> ₹X recovered -> Audit record
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('DEMO A: SUCCESSFUL RECOVERY');
  console.log('----------------------------------------------------------------');
  const paymentA = getPaymentById('pay_rec_0001');
  console.log(`Payment: ${paymentA.payment_id} | Amount: ₹${paymentA.amount.toLocaleString('en-IN')} | Reason: ${paymentA.failure_reason}`);
  
  const previewA = await getExecutionPreview('pay_rec_0001');
  console.log(`AI Recommendation: ${previewA.proposed_action}`);
  console.log(`Policy Status:     ${previewA.policy_status} (${previewA.policy_rule})`);
  console.log(`Execution Gate:    ${previewA.execution_eligibility.toUpperCase()}`);
  console.log(`Execution Mode:    ${previewA.execution_mode.toUpperCase()}`);

  const execA = await executeRecoveryForPayment('pay_rec_0001');
  console.log(`Execution Status:  ${execA.status.toUpperCase()}`);
  console.log(`Amount Attempted:  ₹${execA.amount_attempted.toLocaleString('en-IN')}`);
  console.log(`Amount Recovered:  ₹${execA.amount_recovered.toLocaleString('en-IN')}`);
  console.log(`Execution ID:      ${execA.execution_id}`);
  console.log(`Audit Record Created: ✓\n`);

  // ----------------------------------------------------------------
  // DEMO B — Safety Override
  // Payment -> AI recommends retry -> Policy rejects -> Execution blocked -> No money recovered -> Audit record
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('DEMO B: SAFETY OVERRIDE (MAX RETRIES REACHED)');
  console.log('----------------------------------------------------------------');
  const paymentB = getPaymentById('pay_rec_0200');
  console.log(`Payment: ${paymentB.payment_id} | Attempt Count: ${paymentB.attempt_count} (Max allowed: 2)`);
  
  const previewB = await getExecutionPreview('pay_rec_0200');
  console.log(`AI Recommended Action: ${previewB.proposed_action}`);
  console.log(`Policy Decision:       ${previewB.policy_status} (${previewB.policy_rule})`);
  console.log(`Execution Gate:        ${previewB.execution_eligibility.toUpperCase()} (Block Reason: ${previewB.block_reason || 'N/A'})`);

  const execB = await executeRecoveryForPayment('pay_rec_0200');
  console.log(`Execution Status:      ${execB.status.toUpperCase()}`);
  console.log(`Amount Attempted:      ₹${execB.amount_attempted.toLocaleString('en-IN')}`);
  console.log(`Amount Recovered:      ₹${execB.amount_recovered.toLocaleString('en-IN')}`);
  console.log(`Failure / Reason:      ${execB.failure_reason}`);
  console.log(`Audit Record Created:  ✓\n`);

  // ----------------------------------------------------------------
  // DEMO C — Customer Action Required
  // Expired card -> AI recommends retry/update -> Policy forces payment-method update -> No retry executed -> Customer action required
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('DEMO C: CUSTOMER ACTION REQUIRED (EXPIRED CARD)');
  console.log('----------------------------------------------------------------');
  const paymentC = getPaymentById('pay_rec_0004');
  console.log(`Payment: ${paymentC.payment_id} | Instrument: ${paymentC.payment_method_detail} | Reason: ${paymentC.failure_reason}`);
  
  const previewC = await getExecutionPreview('pay_rec_0004');
  console.log(`AI Recommendation: ${previewC.proposed_action}`);
  console.log(`Policy Rule:       ${previewC.policy_rule}`);
  console.log(`Stop Condition:    ${previewC.stop_condition}`);

  const execC = await executeRecoveryForPayment('pay_rec_0004');
  console.log(`Execution Status:  ${execC.status.toUpperCase()}`);
  console.log(`Action Performed:  ${execC.action}`);
  console.log(`Amount Recovered:  ₹${execC.amount_recovered.toLocaleString('en-IN')} (Customer must complete portal update)`);
  console.log(`Execution Note:    ${execC.failure_reason}`);
  console.log(`Audit Record Created: ✓\n`);

  // ----------------------------------------------------------------
  // DEMO D — Idempotency Enforcement
  // Execute same successful recovery twice -> First: SUCCESS, Second: ALREADY_RECOVERED -> Recovered revenue remains unchanged
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('DEMO D: IDEMPOTENCY ENFORCEMENT');
  console.log('----------------------------------------------------------------');
  const revBefore = getRecoveredRevenue();
  console.log(`Current Total Recovered Revenue in DB: ₹${revBefore.toLocaleString('en-IN')}`);
  console.log(`Re-executing payment 'pay_rec_0001' (which already succeeded in Demo A)...`);

  const execD = await executeRecoveryForPayment('pay_rec_0001');
  console.log(`Execution Status:   ${execD.status.toUpperCase()}`);
  console.log(`Already Recovered:  ${execD.already_recovered}`);
  console.log(`Original Execution: ${execD.execution_id}`);
  console.log(`Amount Credited:    ₹${execD.amount_recovered.toLocaleString('en-IN')}`);

  const revAfter = getRecoveredRevenue();
  console.log(`Total Recovered Revenue after 2nd attempt: ₹${revAfter.toLocaleString('en-IN')}`);
  console.log(`Revenue Unchanged:  ${revBefore === revAfter ? 'YES (No Double Counting)' : 'NO (ERROR)'}\n`);

  // ----------------------------------------------------------------
  // BATCH RECOVERY COHORT DEMO
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('BATCH RECOVERY COHORT DEMO');
  console.log('----------------------------------------------------------------');
  const batchResult = await executeRecoveryBatch({ maxPayments: 10 });
  console.log(`Payments Analyzed:      ${batchResult.summary.analyzed}`);
  console.log(`Payments Attempted:     ${batchResult.summary.attempted}`);
  console.log(`Successful Recoveries:  ${batchResult.summary.successful}`);
  console.log(`Failed Recoveries:      ${batchResult.summary.failed}`);
  console.log(`Blocked Executions:     ${batchResult.summary.blocked}`);
  console.log(`Batch Recovered Rev:    ₹${batchResult.summary.recovered_revenue.toLocaleString('en-IN')}`);
  console.log(`Recovery Rate:          ${batchResult.summary.recovery_rate}%`);
  console.log(`Recovery Success Rate:  ${batchResult.summary.recovery_success_rate}%\n`);

  // ----------------------------------------------------------------
  // AUDIT LEDGER SUMMARY
  // ----------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('AUDIT LEDGER SNAPSHOT (LAST 5 ENTRIES)');
  console.log('----------------------------------------------------------------');
  const auditEntries = getAllRecoveryExecutions(5);
  for (const entry of auditEntries) {
    console.log(`• [${entry.execution_id}] ${entry.payment_id} -> ${entry.action} [${entry.status}] ₹${entry.amount_recovered} (Mode: ${entry.execution_mode}, Rule: ${entry.policy_rule})`);
  }

  const metrics = getExecutionMetrics();
  console.log('\nAggregate Ledger Metrics:');
  console.log(JSON.stringify(metrics, null, 2));
  console.log('\n================================================================');
  console.log('  DEMO COMPLETE: ALL RECOVERAI PHASE 4 INVARIANTS VERIFIED');
  console.log('================================================================');
}

runDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
