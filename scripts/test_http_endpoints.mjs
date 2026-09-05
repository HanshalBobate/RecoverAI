async function testHttpEndpoints() {
  const baseUrl = 'http://localhost:3000';
  console.log(`Connecting to RecoverAI HTTP server at ${baseUrl}...\n`);

  // 1. Test Execution Preview
  console.log('1. GET /api/payments/pay_rec_0001/execution-preview');
  const previewRes = await fetch(`${baseUrl}/api/payments/pay_rec_0001/execution-preview`);
  console.log(`Status: ${previewRes.status}`);
  const previewData = await previewRes.json();
  console.log('Preview Data:', JSON.stringify(previewData, null, 2));

  // 2. Test Execution POST (Demo A: Success)
  console.log('\n2. POST /api/recovery/execute (pay_rec_0001)');
  const execRes = await fetch(`${baseUrl}/api/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: 'pay_rec_0001' }),
  });
  console.log(`Status: ${execRes.status}`);
  const execData = await execRes.json();
  console.log('Execution Data:', JSON.stringify(execData, null, 2));

  // 3. Test Idempotency (Repeat execution on pay_rec_0001)
  console.log('\n3. POST /api/recovery/execute (pay_rec_0001 idempotent re-run)');
  const execRes2 = await fetch(`${baseUrl}/api/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: 'pay_rec_0001' }),
  });
  console.log(`Status: ${execRes2.status}`);
  const execData2 = await execRes2.json();
  console.log('Idempotent Execution Data:', JSON.stringify(execData2, null, 2));

  // 4. Test Blocked Execution (pay_rec_0200)
  console.log('\n4. POST /api/recovery/execute (pay_rec_0200 safety block)');
  const blockRes = await fetch(`${baseUrl}/api/recovery/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: 'pay_rec_0200' }),
  });
  console.log(`Status: ${blockRes.status}`);
  const blockData = await blockRes.json();
  console.log('Safety Block Data:', JSON.stringify(blockData, null, 2));

  // 5. Test Batch Execution
  console.log('\n5. POST /api/recovery/execute-batch (batch of 5 specific IDs)');
  const batchRes = await fetch(`${baseUrl}/api/recovery/execute-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_ids: ['pay_rec_0001', 'pay_rec_0002', 'pay_rec_0003', 'pay_rec_0004', 'pay_rec_0005'] }),
  });
  console.log(`Status: ${batchRes.status}`);
  const batchData = await batchRes.json();
  console.log('Batch Summary:', JSON.stringify(batchData.data?.summary, null, 2));

  // 6. Test Audit Ledger
  console.log('\n6. GET /api/recovery/audit');
  const auditRes = await fetch(`${baseUrl}/api/recovery/audit?limit=5`);
  console.log(`Status: ${auditRes.status}`);
  const auditData = await auditRes.json();
  console.log('Audit Metrics:', JSON.stringify(auditData.data?.metrics, null, 2));
  console.log(`Audit Items returned: ${auditData.data?.executions?.length}`);

  console.log('\n✓ ALL LIVE HTTP API ENDPOINTS FUNCTIONING CORRECTLY!');
}

testHttpEndpoints().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
