import { executePurchasingPipeline, getPendingApprovals, decidePendingApproval } from '../services/executionPipeline';
import { PolicyRule, TransactionRequest } from '../types/policy';

async function runDemo() {
  console.log('\n======================================================');
  console.log('🚀 BRIDLE AGENT TRUST LAYER — GATED PIPELINE DEMO');
  console.log('======================================================\n');

  const rules: PolicyRule[] = [
    {
      id: 'rule_spend_cap',
      type: 'SPEND_CAP',
      name: 'Spend Cap Rule',
      enabled: true,
      maxAmountPerTransaction: 15000,
      softCapEscalateThreshold: 10000,
      currency: 'INR',
    },
    {
      id: 'rule_vendor_allowlist',
      type: 'VENDOR_ALLOWLIST',
      name: 'Supplier Allowlist',
      enabled: true,
      allowedVendors: ['snack_house_pvt_ltd', 'office_supplies_co'],
      blockUnlistedVendors: true,
    },
  ];

  // Scenario 1: ALLOWED Purchase
  console.log('▶ SCENARIO 1: Standard Purchase Request (₹5,000)');
  const req1: TransactionRequest = {
    requestId: 'demo_req_101',
    merchantId: 'acme_corp',
    goalText: 'Restock snacks under 10000',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    items: [{ name: 'Snack Box', quantity: 5, unitPrice: 1000 }],
    totalAmount: 5000,
    currency: 'INR',
    agentReasoning: 'Selected Snack House within budget.',
    timestamp: new Date().toISOString(),
  };

  const res1 = await executePurchasingPipeline(req1, rules);
  console.log(`Verdict: ${res1.verdict.verdict} | Pipeline Status: ${res1.status}`);
  console.log(`Razorpay Order ID: ${res1.payment?.orderId}`);
  console.log(`Razorpay Payment Status: ${res1.payment?.status} | Mode: ${res1.payment?.mode}\n`);

  // Scenario 2: BLOCKED Purchase
  console.log('▶ SCENARIO 2: Hard Cap Breach Purchase Request (₹18,000)');
  const req2: TransactionRequest = {
    ...req1,
    requestId: 'demo_req_102',
    goalText: 'Bulk snack restock',
    items: [{ name: 'Giant Box', quantity: 1, unitPrice: 18000 }],
    totalAmount: 18000,
  };

  const res2 = await executePurchasingPipeline(req2, rules);
  console.log(`Verdict: ${res2.verdict.verdict} | Pipeline Status: ${res2.status}`);
  console.log(`Overall Reason: ${res2.verdict.overallReason}\n`);

  // Scenario 3: ESCALATED Purchase
  console.log('▶ SCENARIO 3: Soft Cap Escalation Purchase Request (₹12,000)');
  const req3: TransactionRequest = {
    ...req1,
    requestId: 'demo_req_103',
    goalText: 'Mid-size snack restock',
    items: [{ name: 'Medium Box', quantity: 1, unitPrice: 12000 }],
    totalAmount: 12000,
  };

  const res3 = await executePurchasingPipeline(req3, rules);
  console.log(`Verdict: ${res3.verdict.verdict} | Pipeline Status: ${res3.status}`);
  console.log(`Pending Approval Queue ID: ${res3.pendingApprovalId}`);

  // Scenario 4: Human Manager Approves Escalation
  console.log('\n▶ SCENARIO 4: Human Manager Reviews Pending Queue & Approves');
  const pendingItems = getPendingApprovals();
  if (pendingItems.length > 0) {
    const approvedItem = await decidePendingApproval(
      pendingItems[0].id,
      'APPROVE',
      'Approved after manager budget verification'
    );
    console.log(`Approval Outcome: ${approvedItem.status}`);
    console.log(`Razorpay Payment Order ID: ${approvedItem.paymentResult?.orderId}`);
  }

  console.log('\n======================================================');
  console.log('✅ DEMO PIPELINE EXECUTION COMPLETE');
  console.log('======================================================\n');
}

runDemo().catch(console.error);
