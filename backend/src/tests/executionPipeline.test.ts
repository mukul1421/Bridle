import { describe, it, expect, beforeEach } from 'vitest';
import {
  executePurchasingPipeline,
  getPendingApprovals,
  decidePendingApproval,
  clearPendingApprovals,
} from '../services/executionPipeline';
import { clearTransactionHistory } from '../services/stateStore';
import { clearNotifications } from '../services/notificationService';
import { PolicyRule, TransactionRequest } from '../types/policy';

describe('Gated Execution Pipeline — Day 3 & Day 4 Tests', () => {
  beforeEach(() => {
    clearTransactionHistory();
    clearPendingApprovals();
    clearNotifications();
  });

  const mockRules: PolicyRule[] = [
    {
      id: 'rule_spend_cap',
      type: 'SPEND_CAP',
      name: 'Spend Cap',
      enabled: true,
      maxAmountPerTransaction: 15000,
      softCapEscalateThreshold: 10000,
      currency: 'INR',
    },
    {
      id: 'rule_vendor_allowlist',
      type: 'VENDOR_ALLOWLIST',
      name: 'Vendor Allowlist',
      enabled: true,
      allowedVendors: ['snack_house_pvt_ltd'],
      blockUnlistedVendors: true,
    },
  ];

  const baseRequest: TransactionRequest = {
    requestId: 'req_001',
    merchantId: 'merchant_acme',
    goalText: 'Buy snacks',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    items: [{ name: 'Snack Box', quantity: 1, unitPrice: 5000 }],
    totalAmount: 5000,
    currency: 'INR',
    agentReasoning: 'Selected Snack House',
    timestamp: new Date().toISOString(),
  };

  it('1. should execute Razorpay payment when policy verdict is ALLOW', async () => {
    const result = await executePurchasingPipeline(baseRequest, mockRules);

    expect(result.verdict.verdict).toBe('ALLOW');
    expect(result.status).toBe('COMPLETED');
    expect(result.payment).toBeDefined();
    expect(result.payment?.orderId).toContain('order_test_');
    expect(result.payment?.status).toBe('CAPTURED');
  });

  it('2. should reject transaction and omit payment when policy verdict is BLOCK', async () => {
    const overbudgetRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 20000,
    };

    const result = await executePurchasingPipeline(overbudgetRequest, mockRules);

    expect(result.verdict.verdict).toBe('BLOCK');
    expect(result.status).toBe('REJECTED');
    expect(result.payment).toBeNull();
  });

  it('3. should push to Pending Approval Queue when policy verdict is ESCALATE', async () => {
    const softCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 12000, // Between 10000 soft and 15000 hard
    };

    const result = await executePurchasingPipeline(softCapRequest, mockRules);

    expect(result.verdict.verdict).toBe('ESCALATE');
    expect(result.status).toBe('PENDING_HUMAN_APPROVAL');
    expect(result.pendingApprovalId).toBeDefined();

    const pendingList = getPendingApprovals();
    expect(pendingList).toHaveLength(1);
    expect(pendingList[0].status).toBe('PENDING_HUMAN_APPROVAL');
  });

  it('4. should process Razorpay payment when Human Manager approves an escalated request', async () => {
    const softCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 12000,
    };

    const pipelineResult = await executePurchasingPipeline(softCapRequest, mockRules);
    const pendingId = pipelineResult.pendingApprovalId!;

    const approvalResult = await decidePendingApproval(
      pendingId,
      'APPROVE',
      'Approved by Finance Manager'
    );

    expect(approvalResult.status).toBe('APPROVED_BY_HUMAN');
    expect(approvalResult.paymentResult).toBeDefined();
    expect(approvalResult.paymentResult?.status).toBe('CAPTURED');
    expect(approvalResult.reviewerNote).toBe('Approved by Finance Manager');
  });

  it('5. should record human denial without executing payment when manager denies escalation', async () => {
    const softCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 12000,
    };

    const pipelineResult = await executePurchasingPipeline(softCapRequest, mockRules);
    const pendingId = pipelineResult.pendingApprovalId!;

    const denialResult = await decidePendingApproval(
      pendingId,
      'DENY',
      'Over quarterly allocation budget'
    );

    expect(denialResult.status).toBe('DENIED_BY_HUMAN');
    expect(denialResult.paymentResult).toBeUndefined();
    expect(denialResult.reviewerNote).toBe('Over quarterly allocation budget');
  });
});
