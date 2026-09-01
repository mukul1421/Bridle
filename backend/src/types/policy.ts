import { z } from 'zod';

// Rule Types
export type RuleType = 'SPEND_CAP' | 'VENDOR_ALLOWLIST' | 'CATEGORY_LIMIT' | 'ROLLING_TOTAL' | 'CUSTOM_NL_RULE';

// Base Rule Schema
export const BaseRuleSchema = z.object({
  id: z.string(),
  type: z.enum(['SPEND_CAP', 'VENDOR_ALLOWLIST', 'CATEGORY_LIMIT', 'ROLLING_TOTAL', 'CUSTOM_NL_RULE']),
  enabled: z.boolean().default(true),
  name: z.string(),
  description: z.string().optional(),
});

// 1. Spend Cap Rule
export const SpendCapRuleSchema = BaseRuleSchema.extend({
  type: z.literal('SPEND_CAP'),
  maxAmountPerTransaction: z.number().positive(),
  softCapEscalateThreshold: z.number().positive().optional(),
  currency: z.string().default('INR'),
});
export type SpendCapRule = z.infer<typeof SpendCapRuleSchema>;

// 2. Vendor Allowlist Rule
export const VendorAllowlistRuleSchema = BaseRuleSchema.extend({
  type: z.literal('VENDOR_ALLOWLIST'),
  allowedVendors: z.array(z.string()),
  blockUnlistedVendors: z.boolean().default(true),
});
export type VendorAllowlistRule = z.infer<typeof VendorAllowlistRuleSchema>;

// 3. Category Limit Rule
export const CategoryLimitRuleSchema = BaseRuleSchema.extend({
  type: z.literal('CATEGORY_LIMIT'),
  categoryCaps: z.record(z.string(), z.number().positive()),
});
export type CategoryLimitRule = z.infer<typeof CategoryLimitRuleSchema>;

// 4. Rolling Total Rule
export const RollingTotalRuleSchema = BaseRuleSchema.extend({
  type: z.literal('ROLLING_TOTAL'),
  windowHours: z.number().positive().default(24),
  maxRollingAmount: z.number().positive(),
});
export type RollingTotalRule = z.infer<typeof RollingTotalRuleSchema>;

// 5. Custom Natural Language Rule
export const CustomNaturalLanguageRuleSchema = BaseRuleSchema.extend({
  type: z.literal('CUSTOM_NL_RULE'),
  promptText: z.string(),
  defaultAction: z.enum(['BLOCK', 'ESCALATE']).default('BLOCK'),
});
export type CustomNaturalLanguageRule = z.infer<typeof CustomNaturalLanguageRuleSchema>;

// Union of all Rule Schemas
export const PolicyRuleSchema = z.discriminatedUnion('type', [
  SpendCapRuleSchema,
  VendorAllowlistRuleSchema,
  CategoryLimitRuleSchema,
  RollingTotalRuleSchema,
  CustomNaturalLanguageRuleSchema,
]);
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// Policy Verdict
export type VerdictType = 'ALLOW' | 'BLOCK' | 'ESCALATE';

export interface RuleEvaluationResult {
  ruleId: string;
  ruleType: RuleType;
  passed: boolean;
  verdict: VerdictType;
  reason: string;
}

export interface PolicyVerdict {
  requestId: string;
  verdict: VerdictType;
  overallReason: string;
  evaluatedRules: RuleEvaluationResult[];
  timestamp: string;
}

// Purchase Item Schema
export const PurchaseItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

// Transaction Request Schema
export const TransactionRequestSchema = z.object({
  requestId: z.string(),
  merchantId: z.string(),
  goalText: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  category: z.string(),
  items: z.array(PurchaseItemSchema),
  totalAmount: z.number().positive(),
  currency: z.string().default('INR'),
  agentReasoning: z.string(),
  timestamp: z.string().datetime().or(z.string()),
});

export type TransactionRequest = z.infer<typeof TransactionRequestSchema>;
