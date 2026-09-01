import { runBuyerAgent, BuyerAgentPlan } from './buyerAgent';
import { runGuardianAgent, PolicyGuardianAudit } from './guardianAgent';
import { TransactionRequest, PolicyRule } from '../types/policy';

export { runBuyerAgent, BuyerAgentPlan } from './buyerAgent';
export { runGuardianAgent, PolicyGuardianAudit } from './guardianAgent';

export type LLMAgentPlan = BuyerAgentPlan;

/**
 * Re-export for compatibility with previous callers
 */
export async function planAndGeneratePurchaseRequest(
  goalText: string,
  merchantId = 'acme_corp'
): Promise<BuyerAgentPlan> {
  return runBuyerAgent(goalText, merchantId);
}

export async function auditWithPolicyGuardianAgent(
  plan: BuyerAgentPlan,
  rules: PolicyRule[],
  history: TransactionRequest[] = []
): Promise<PolicyGuardianAudit> {
  return runGuardianAgent(plan, rules, history);
}
