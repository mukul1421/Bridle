import { describe, it, expect, beforeEach } from 'vitest';
import { evaluatePolicy } from '../services/policyEngine';
import {
  PolicyRule,
  TransactionRequest,
  SpendCapRule,
  VendorAllowlistRule,
  CategoryLimitRule,
  RollingTotalRule,
} from '../types/policy';
import { clearNotifications, getNotifications } from '../services/notificationService';

describe('Policy Engine Evaluator — Day 2 Core Tests', () => {
  beforeEach(() => {
    clearNotifications();
  });

  // Mock Rules
  const mockSpendCapRule: SpendCapRule = {
    id: 'rule_spend_cap_01',
    type: 'SPEND_CAP',
    name: 'Per-Transaction Spend Cap',
    enabled: true,
    maxAmountPerTransaction: 15000,
    softCapEscalateThreshold: 10000,
    currency: 'INR',
  };

  const mockVendorAllowlistRule: VendorAllowlistRule = {
    id: 'rule_vendor_allowlist_01',
    type: 'VENDOR_ALLOWLIST',
    name: 'Supplier Allowlist',
    enabled: true,
    allowedVendors: ['snack_house_pvt_ltd', 'office_supplies_co'],
    blockUnlistedVendors: true,
  };

  const mockCategoryLimitRule: CategoryLimitRule = {
    id: 'rule_category_limit_01',
    type: 'CATEGORY_LIMIT',
    name: 'Category Budget Caps',
    enabled: true,
    categoryCaps: {
      snacks: 8000,
      stationery: 12000,
    },
  };

  const mockRollingTotalRule: RollingTotalRule = {
    id: 'rule_rolling_total_01',
    type: 'ROLLING_TOTAL',
    name: '24h Budget Cap',
    enabled: true,
    windowHours: 24,
    maxRollingAmount: 25000,
  };

  // Base valid transaction request
  const baseRequest: TransactionRequest = {
    requestId: 'tx_test_101',
    merchantId: 'merchant_acme',
    goalText: 'Buy snacks for team',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    items: [{ name: 'Snack Box', quantity: 5, unitPrice: 1000 }],
    totalAmount: 5000,
    currency: 'INR',
    agentReasoning: 'Selected Snack House within budget.',
    timestamp: new Date().toISOString(),
  };

  it('1. should return ALLOW when request satisfies all policy rules', async () => {
    const rules: PolicyRule[] = [mockSpendCapRule, mockVendorAllowlistRule, mockCategoryLimitRule];
    const verdict = await evaluatePolicy(baseRequest, rules);

    expect(verdict.verdict).toBe('ALLOW');
    expect(verdict.evaluatedRules).toHaveLength(3);
    expect(getNotifications()).toHaveLength(0);
  });

  it('2. should return BLOCK when totalAmount exceeds hard spend cap', async () => {
    const overCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 18000,
    };

    const verdict = await evaluatePolicy(overCapRequest, [mockSpendCapRule]);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.overallReason).toContain('exceeds hard spend cap');
    expect(getNotifications()).toHaveLength(1);
    expect(getNotifications()[0].verdict).toBe('BLOCK');
  });

  it('3. should return ESCALATE when totalAmount breaches soft cap threshold', async () => {
    const softCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 12000, // Between soft (10000) and hard (15000)
    };

    const verdict = await evaluatePolicy(softCapRequest, [mockSpendCapRule]);

    expect(verdict.verdict).toBe('ESCALATE');
    expect(verdict.overallReason).toContain('reaches soft cap threshold');
    expect(getNotifications()).toHaveLength(1);
    expect(getNotifications()[0].verdict).toBe('ESCALATE');
  });

  it('4. should return BLOCK when vendor is not in allowlist', async () => {
    const unlistedVendorRequest: TransactionRequest = {
      ...baseRequest,
      vendorId: 'unapproved_vendor_xyz',
      vendorName: 'Unapproved Vendor XYZ',
    };

    const verdict = await evaluatePolicy(unlistedVendorRequest, [mockVendorAllowlistRule]);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.overallReason).toContain('not in the approved supplier allowlist');
    expect(getNotifications()).toHaveLength(1);
  });

  it('5. should return ALLOW when vendor is in allowlist', async () => {
    const listedVendorRequest: TransactionRequest = {
      ...baseRequest,
      vendorId: 'office_supplies_co',
      vendorName: 'Office Supplies Co',
    };

    const verdict = await evaluatePolicy(listedVendorRequest, [mockVendorAllowlistRule]);

    expect(verdict.verdict).toBe('ALLOW');
  });

  it('6. should return BLOCK when category limit is exceeded', async () => {
    const categoryOverbudgetRequest: TransactionRequest = {
      ...baseRequest,
      category: 'snacks',
      totalAmount: 9500, // Snack cap is 8000
    };

    const verdict = await evaluatePolicy(categoryOverbudgetRequest, [mockCategoryLimitRule]);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.overallReason).toContain('exceeds category');
  });

  it('7. should return ALLOW when category spend is within category cap', async () => {
    const categoryUnderbudgetRequest: TransactionRequest = {
      ...baseRequest,
      category: 'stationery',
      totalAmount: 10000, // Stationery cap is 12000
    };

    const verdict = await evaluatePolicy(categoryUnderbudgetRequest, [mockCategoryLimitRule]);

    expect(verdict.verdict).toBe('ALLOW');
  });

  it('8. should ignore disabled rules during evaluation', async () => {
    const disabledSpendCapRule: SpendCapRule = {
      ...mockSpendCapRule,
      enabled: false,
    };

    const overCapRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 25000, // Exceeds hard cap, but rule is disabled
    };

    const verdict = await evaluatePolicy(overCapRequest, [disabledSpendCapRule]);

    expect(verdict.verdict).toBe('ALLOW');
    expect(verdict.evaluatedRules[0].reason).toContain('currently disabled');
  });

  it('9. should prioritize BLOCK over ESCALATE when multiple rules are triggered', async () => {
    const multiTriggerRequest: TransactionRequest = {
      ...baseRequest,
      totalAmount: 12000, // Triggers ESCALATE on spend cap (soft limit 10000)
      vendorId: 'unlisted_vendor',
      vendorName: 'Unlisted Vendor', // Triggers BLOCK on vendor allowlist
    };

    const verdict = await evaluatePolicy(multiTriggerRequest, [
      mockSpendCapRule,
      mockVendorAllowlistRule,
    ]);

    expect(verdict.verdict).toBe('BLOCK');
  });

  it('10. should return BLOCK when 24h rolling budget total is exceeded', async () => {
    const pastTx: TransactionRequest = {
      ...baseRequest,
      requestId: 'past_tx_001',
      totalAmount: 22000,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    };

    const newTx: TransactionRequest = {
      ...baseRequest,
      requestId: 'new_tx_002',
      totalAmount: 5000, // 22000 + 5000 = 27000 > 25000 rolling max
      timestamp: new Date().toISOString(),
    };

    const verdict = await evaluatePolicy(newTx, [mockRollingTotalRule], [pastTx]);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.overallReason).toContain('rolling spend');
  });
});
