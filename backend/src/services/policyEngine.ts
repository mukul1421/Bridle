import {
  PolicyRule,
  PolicyVerdict,
  RuleEvaluationResult,
  SpendCapRule,
  VendorAllowlistRule,
  CategoryLimitRule,
  RollingTotalRule,
  TransactionRequest,
  VerdictType,
} from '../types/policy';
import { dispatchPolicyBreachNotification } from './notificationService';

/**
 * Evaluates SPEND_CAP rule
 */
function evaluateSpendCap(rule: SpendCapRule, request: TransactionRequest): RuleEvaluationResult {
  const amount = request.totalAmount;
  const hardCap = rule.maxAmountPerTransaction;
  const softCap = rule.softCapEscalateThreshold;

  if (amount > hardCap) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: false,
      verdict: 'BLOCK',
      reason: `Transaction total ₹${amount.toLocaleString()} exceeds hard spend cap of ₹${hardCap.toLocaleString()}`,
    };
  }

  if (softCap && amount >= softCap) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: true,
      verdict: 'ESCALATE',
      reason: `Transaction total ₹${amount.toLocaleString()} reaches soft cap threshold of ₹${softCap.toLocaleString()}; requires human manager approval`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    passed: true,
    verdict: 'ALLOW',
    reason: `Transaction total ₹${amount.toLocaleString()} is within spend cap of ₹${hardCap.toLocaleString()}`,
  };
}

/**
 * Evaluates VENDOR_ALLOWLIST rule
 */
function evaluateVendorAllowlist(
  rule: VendorAllowlistRule,
  request: TransactionRequest
): RuleEvaluationResult {
  const allowed = rule.allowedVendors.map((v) => v.toLowerCase());
  const requestVendorId = request.vendorId.toLowerCase();
  const requestVendorName = request.vendorName.toLowerCase();

  const isAllowed = allowed.some((v) => v === requestVendorId || v === requestVendorName);

  if (isAllowed) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: true,
      verdict: 'ALLOW',
      reason: `Vendor '${request.vendorName}' is on the approved supplier allowlist`,
    };
  }

  if (rule.blockUnlistedVendors) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: false,
      verdict: 'BLOCK',
      reason: `Vendor '${request.vendorName}' (${request.vendorId}) is not in the approved supplier allowlist`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    passed: true,
    verdict: 'ALLOW',
    reason: `Vendor '${request.vendorName}' is unlisted but blockUnlistedVendors is disabled`,
  };
}

/**
 * Evaluates CATEGORY_LIMIT rule
 */
function evaluateCategoryLimit(
  rule: CategoryLimitRule,
  request: TransactionRequest
): RuleEvaluationResult {
  const categoryCap = rule.categoryCaps[request.category];

  if (categoryCap === undefined) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: true,
      verdict: 'ALLOW',
      reason: `No specific category limit configured for category '${request.category}'`,
    };
  }

  if (request.totalAmount > categoryCap) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: false,
      verdict: 'BLOCK',
      reason: `Transaction total ₹${request.totalAmount.toLocaleString()} exceeds category '${request.category}' limit of ₹${categoryCap.toLocaleString()}`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    passed: true,
    verdict: 'ALLOW',
    reason: `Transaction total ₹${request.totalAmount.toLocaleString()} is within category '${request.category}' limit of ₹${categoryCap.toLocaleString()}`,
  };
}

/**
 * Evaluates ROLLING_TOTAL rule
 */
function evaluateRollingTotal(
  rule: RollingTotalRule,
  request: TransactionRequest,
  history: TransactionRequest[] = []
): RuleEvaluationResult {
  const now = new Date(request.timestamp || Date.now()).getTime();
  const windowMs = rule.windowHours * 60 * 60 * 1000;
  const windowStart = now - windowMs;

  const pastWindowSum = history
    .filter((tx) => {
      const txTime = new Date(tx.timestamp).getTime();
      return txTime >= windowStart && txTime <= now;
    })
    .reduce((sum, tx) => sum + tx.totalAmount, 0);

  const projectedRollingTotal = pastWindowSum + request.totalAmount;

  if (projectedRollingTotal > rule.maxRollingAmount) {
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      passed: false,
      verdict: 'BLOCK',
      reason: `Projected ${rule.windowHours}h rolling spend ₹${projectedRollingTotal.toLocaleString()} (past: ₹${pastWindowSum.toLocaleString()} + current: ₹${request.totalAmount.toLocaleString()}) exceeds rolling cap of ₹${rule.maxRollingAmount.toLocaleString()}`,
    };
  }

  return {
    ruleId: rule.id,
    ruleType: rule.type,
    passed: true,
    verdict: 'ALLOW',
    reason: `Projected ${rule.windowHours}h rolling total ₹${projectedRollingTotal.toLocaleString()} is within rolling cap of ₹${rule.maxRollingAmount.toLocaleString()}`,
  };
}

/**
 * Core Policy Engine Evaluator
 * Evaluates all active rules against a purchase request and computes overall verdict.
 */
export async function evaluatePolicy(
  request: TransactionRequest,
  rules: PolicyRule[],
  history: TransactionRequest[] = []
): Promise<PolicyVerdict> {
  const evaluatedRules: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    // Skip disabled rules
    if (rule.enabled === false) {
      evaluatedRules.push({
        ruleId: rule.id,
        ruleType: rule.type,
        passed: true,
        verdict: 'ALLOW',
        reason: `Rule '${rule.name}' is currently disabled and was skipped`,
      });
      continue;
    }

    let result: RuleEvaluationResult;
    switch (rule.type) {
      case 'SPEND_CAP':
        result = evaluateSpendCap(rule, request);
        break;
      case 'VENDOR_ALLOWLIST':
        result = evaluateVendorAllowlist(rule, request);
        break;
      case 'CATEGORY_LIMIT':
        result = evaluateCategoryLimit(rule, request);
        break;
      case 'ROLLING_TOTAL':
        result = evaluateRollingTotal(rule, request, history);
        break;
      default:
        result = {
          ruleId: (rule as any).id || 'unknown',
          ruleType: (rule as any).type || 'UNKNOWN',
          passed: true,
          verdict: 'ALLOW',
          reason: 'Unknown rule type skipped',
        };
    }

    evaluatedRules.push(result);
  }

  // Determine Overall Verdict with Strict Precedence: BLOCK > ESCALATE > ALLOW
  const hasBlock = evaluatedRules.some((r) => r.verdict === 'BLOCK');
  const hasEscalate = evaluatedRules.some((r) => r.verdict === 'ESCALATE');

  let overallVerdict: VerdictType = 'ALLOW';
  let overallReason = 'All policy checks passed successfully. Transaction pre-approved for execution.';

  if (hasBlock) {
    overallVerdict = 'BLOCK';
    const blockingReasons = evaluatedRules
      .filter((r) => r.verdict === 'BLOCK')
      .map((r) => r.reason)
      .join('; ');
    overallReason = `Policy Violation [BLOCKED]: ${blockingReasons}`;
  } else if (hasEscalate) {
    overallVerdict = 'ESCALATE';
    const escalationReasons = evaluatedRules
      .filter((r) => r.verdict === 'ESCALATE')
      .map((r) => r.reason)
      .join('; ');
    overallReason = `Policy Soft-Cap Reached [NEEDS APPROVAL]: ${escalationReasons}`;
  }

  const verdict: PolicyVerdict = {
    requestId: request.requestId,
    verdict: overallVerdict,
    overallReason,
    evaluatedRules,
    timestamp: new Date().toISOString(),
  };

  // Dispatch Breach Notifications if blocked or escalated
  if (overallVerdict !== 'ALLOW') {
    await dispatchPolicyBreachNotification(verdict, request);
  }

  return verdict;
}
