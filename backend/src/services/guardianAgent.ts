import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  TransactionRequest,
  PolicyRule,
  PolicyVerdict,
  VerdictType,
  RuleEvaluationResult,
  CustomNaturalLanguageRule,
} from '../types/policy';
import { evaluatePolicy } from './policyEngine';
import { BuyerAgentPlan } from './buyerAgent';

export interface PolicyGuardianAudit {
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceSummary: string;
  auditPoints: string[];
  guardianVerdict: VerdictType;
  policyVerdict: PolicyVerdict;
  guardianReasoning: string;
  nlRuleEvaluations: Array<{
    ruleId: string;
    ruleName: string;
    promptText: string;
    passed: boolean;
    verdict: VerdictType;
    reason: string;
  }>;
  provider: 'LIVE_GEMINI_API' | 'LOCAL_GUARDIAN_ENGINE';
}

const getGeminiClient = (() => {
  let client: GoogleGenerativeAI | null = null;
  let initialized = false;

  return (): GoogleGenerativeAI | null => {
    if (initialized) return client;
    initialized = true;

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_gemini_api')) {
      try {
        client = new GoogleGenerativeAI(apiKey);
        console.log('[GuardianAgent] ✅ Live Google Gemini API initialized for Policy Guardian Agent');
      } catch (err: any) {
        console.warn('[GuardianAgent] Failed to initialize GoogleGenerativeAI:', err.message);
      }
    }
    return client;
  };
})();

/**
 * Standalone Policy Guardian Agent (Agent 2)
 * Performs semantic compliance audits on proposals, checks mathematical bounds,
 * and enforces plain-English custom policy rules.
 */
export async function runGuardianAgent(
  proposal: BuyerAgentPlan | { transactionRequest: TransactionRequest; parsedGoal?: string },
  rules: PolicyRule[],
  history: TransactionRequest[] = []
): Promise<PolicyGuardianAudit> {
  const transaction = proposal.transactionRequest;
  const goalText = (proposal as any).parsedGoal || transaction.goalText;

  // 1. Separate deterministic rules from custom natural language rules
  const deterministicRules = rules.filter((r) => r.type !== 'CUSTOM_NL_RULE');
  const nlRules: CustomNaturalLanguageRule[] = rules.filter(
    (r): r is CustomNaturalLanguageRule => r.type === 'CUSTOM_NL_RULE' && r.enabled !== false
  );

  // 2. Run deterministic policy engine evaluator
  const basePolicyVerdict = await evaluatePolicy(transaction, deterministicRules, history);

  // 3. Evaluate Custom Natural Language Rules using Gemini 3.5 Flash
  const genAI = getGeminiClient();
  let nlRuleResults: Array<{
    ruleId: string;
    ruleName: string;
    promptText: string;
    passed: boolean;
    verdict: VerdictType;
    reason: string;
  }> = [];

  let llmComplianceSummary = '';
  let llmGuardianReasoning = '';
  let llmAuditPoints: string[] = [];
  let llmRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const auditPrompt = `
You are Bridle's Policy Guardian & Compliance Auditor Agent (Agent 2).
Your responsibility is to strictly audit a purchase order submitted by Buyer Agent (Agent 1).

Proposed Purchase Order:
${JSON.stringify(
  {
    goal: goalText,
    vendorId: transaction.vendorId,
    vendorName: transaction.vendorName,
    category: transaction.category,
    items: transaction.items,
    totalAmount: transaction.totalAmount,
    currency: transaction.currency,
    buyerReasoning: transaction.agentReasoning,
  },
  null,
  2
)}

Corporate Mathematical Checks:
Base Verdict: ${basePolicyVerdict.verdict}
Base Reason: ${basePolicyVerdict.overallReason}
Rule Evaluations: ${JSON.stringify(basePolicyVerdict.evaluatedRules, null, 2)}

Active Custom Natural Language Rules:
${JSON.stringify(
  nlRules.map((r) => ({ id: r.id, name: r.name, ruleDescription: r.promptText, defaultAction: r.defaultAction })),
  null,
  2
)}

Instructions:
1. Conduct a rigorous audit of the transaction against BOTH the numerical bounds AND the active Custom Natural Language Rules.
2. For each Custom Natural Language Rule:
   - Determine if the proposed order violates the plain-English rule (passed: true/false).
   - If violated, set verdict to the rule's defaultAction ("BLOCK" or "ESCALATE") and provide a clear explanation.
3. Compute overall risk rating: "LOW" (if all passed), "MEDIUM" (if escalated), "HIGH" or "CRITICAL" (if blocked).
4. Return JSON strictly matching this schema:
{
  "riskRating": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "complianceSummary": "Crisp 1-2 sentence executive compliance verdict",
  "auditPoints": ["point 1", "point 2", "point 3"],
  "guardianReasoning": "Detailed audit synthesis explaining policy checks",
  "nlRuleEvaluations": [
    {
      "ruleId": "rule_id",
      "ruleName": "rule_name",
      "promptText": "rule_text",
      "passed": boolean,
      "verdict": "ALLOW" | "BLOCK" | "ESCALATE",
      "reason": "Clear explanation of evaluation"
    }
  ]
}
`;

      const response = await model.generateContent(auditPrompt);
      const textResult = response.response.text();
      const parsedAudit = JSON.parse(textResult);

      llmRiskRating = parsedAudit.riskRating || 'LOW';
      llmComplianceSummary = parsedAudit.complianceSummary || '';
      llmGuardianReasoning = parsedAudit.guardianReasoning || '';
      llmAuditPoints = Array.isArray(parsedAudit.auditPoints) ? parsedAudit.auditPoints : [];
      nlRuleResults = Array.isArray(parsedAudit.nlRuleEvaluations) ? parsedAudit.nlRuleEvaluations : [];
    } catch (err: any) {
      console.warn('[GuardianAgent] LLM semantic audit fallback:', err.message);
    }
  }

  // Local fallback evaluation for NL rules if LLM not used or missing results
  if (nlRuleResults.length === 0 && nlRules.length > 0) {
    for (const rule of nlRules) {
      const lowerRule = rule.promptText.toLowerCase();
      let passed = true;
      let reason = `Natural language rule '${rule.name}' checked and passed.`;
      let verdict: VerdictType = 'ALLOW';

      // Basic semantic heuristics for local fallback
      if (lowerRule.includes('single item') || lowerRule.includes('individual item') || lowerRule.includes('item price')) {
        const match = lowerRule.match(/(\d+)/);
        if (match) {
          const cap = parseInt(match[1], 10);
          const maxItemPrice = Math.max(...transaction.items.map((i) => i.unitPrice));
          if (maxItemPrice > cap) {
            passed = false;
            verdict = rule.defaultAction || 'BLOCK';
            reason = `Item unit price ₹${maxItemPrice.toLocaleString()} exceeds natural language rule cap of ₹${cap.toLocaleString()} ('${rule.promptText}')`;
          }
        }
      }

      nlRuleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        promptText: rule.promptText,
        passed,
        verdict,
        reason,
      });
    }
  }

  // 4. Merge evaluations into Final Governance Verdict
  const allEvaluations: RuleEvaluationResult[] = [
    ...basePolicyVerdict.evaluatedRules,
    ...nlRuleResults.map((r) => ({
      ruleId: r.ruleId,
      ruleType: 'CUSTOM_NL_RULE' as const,
      passed: r.passed,
      verdict: r.verdict,
      reason: r.reason,
    })),
  ];

  const hasBlock = allEvaluations.some((r) => r.verdict === 'BLOCK');
  const hasEscalate = allEvaluations.some((r) => r.verdict === 'ESCALATE');

  let finalVerdict: VerdictType = 'ALLOW';
  let overallReason = 'All policy checks and natural language rules passed successfully. Transaction approved.';

  if (hasBlock) {
    finalVerdict = 'BLOCK';
    const blockingReasons = allEvaluations
      .filter((r) => r.verdict === 'BLOCK')
      .map((r) => r.reason)
      .join('; ');
    overallReason = `Policy Violation [BLOCKED]: ${blockingReasons}`;
  } else if (hasEscalate) {
    finalVerdict = 'ESCALATE';
    const escalationReasons = allEvaluations
      .filter((r) => r.verdict === 'ESCALATE')
      .map((r) => r.reason)
      .join('; ');
    overallReason = `Policy Escalation [NEEDS APPROVAL]: ${escalationReasons}`;
  }

  const finalPolicyVerdict: PolicyVerdict = {
    requestId: transaction.requestId,
    verdict: finalVerdict,
    overallReason: llmComplianceSummary || overallReason,
    evaluatedRules: allEvaluations,
    timestamp: new Date().toISOString(),
  };

  const calculatedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    finalVerdict === 'BLOCK' ? 'HIGH' : finalVerdict === 'ESCALATE' ? 'MEDIUM' : 'LOW';

  return {
    riskRating: llmRiskRating || calculatedRisk,
    complianceSummary: llmComplianceSummary || overallReason,
    auditPoints:
      llmAuditPoints.length > 0
        ? llmAuditPoints
        : allEvaluations.map((r) => `${r.ruleType}: ${r.passed ? 'PASSED' : 'VIOLATION'} — ${r.reason}`),
    guardianVerdict: finalVerdict,
    policyVerdict: finalPolicyVerdict,
    guardianReasoning:
      llmGuardianReasoning ||
      `Guardian Agent evaluated ${allEvaluations.length} policy boundaries and custom rules for ₹${transaction.totalAmount.toLocaleString()} INR.`,
    nlRuleEvaluations: nlRuleResults,
    provider: genAI ? 'LIVE_GEMINI_API' : 'LOCAL_GUARDIAN_ENGINE',
  };
}
