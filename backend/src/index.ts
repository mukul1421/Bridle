// CRITICAL: Load .env BEFORE any other imports so that modules like agentService.ts
// can read GEMINI_API_KEY during their top-level initialization.
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { evaluatePolicy } from './services/policyEngine';
import {
  executePurchasingPipeline,
  getPendingApprovals,
  decidePendingApproval,
} from './services/executionPipeline';
import { getTransactionHistory, clearTransactionHistory } from './services/stateStore';
import {
  getNotifications,
  clearNotifications,
  getWebhookUrl,
  setWebhookUrl,
} from './services/notificationService';
import { CATALOG_DATABASE, searchCatalog } from './services/catalogService';
import { planAndGeneratePurchaseRequest } from './services/agentService';
import { PolicyRule, TransactionRequest } from './types/policy';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Active policy rules store (editable via API/UI)
let activeRulesStore: PolicyRule[] = [
  {
    id: 'rule_spend_cap_01',
    type: 'SPEND_CAP',
    name: 'Per-Transaction Hard & Soft Limit',
    enabled: true,
    maxAmountPerTransaction: 15000,
    softCapEscalateThreshold: 10000,
    currency: 'INR',
  },
  {
    id: 'rule_vendor_allowlist_01',
    type: 'VENDOR_ALLOWLIST',
    name: 'Supplier Allowlist',
    enabled: true,
    allowedVendors: [
      'snack_house_pvt_ltd',
      'cloud_services_inc',
      'office_supplies_co',
      'fresh_stationery_hub',
    ],
    blockUnlistedVendors: true,
  },
  {
    id: 'rule_category_limit_01',
    type: 'CATEGORY_LIMIT',
    name: 'Category Spend Allocations',
    enabled: true,
    categoryCaps: {
      snacks: 15000,
      office_supplies: 20000,
      cloud_infrastructure: 50000,
    },
  },
  {
    id: 'rule_rolling_total_01',
    type: 'ROLLING_TOTAL',
    name: '24-Hour Rolling Budget Ceiling',
    enabled: true,
    windowHours: 24,
    maxRollingAmount: 40000,
  },
];

// State Reset Endpoint (clears accumulated test transactions)
app.post('/api/v1/reset', (req, res) => {
  clearTransactionHistory();
  res.json({ success: true, message: 'Transaction history cleared. Rolling totals reset to zero.' });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Agent Trust Layer Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root Info Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Agent Trust Layer API',
    description: 'Policy & Audit Engine for LLM Purchasing Agents',
    endpoints: {
      health: '/health',
      catalog: '/api/v1/catalog',
      agentPlanAndPurchase: '/api/v1/agent/plan-and-purchase',
      agentPurchase: '/api/v1/agent/purchase',
      policyEvaluate: '/api/v1/policy/evaluate',
      getRules: '/api/v1/policy/rules',
      updateRules: 'PUT /api/v1/policy/rules',
      getApprovals: '/api/v1/approvals',
      decideApproval: 'POST /api/v1/approvals/:id/decide',
      getAuditLogs: '/api/v1/audit/logs',
      notifications: '/api/v1/notifications',
      webhookConfig: '/api/v1/notifications/webhook-config',
    },
  });
});

// 1. Get Catalog Database
app.get('/api/v1/catalog', (req, res) => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || undefined;
  res.json({ catalog: searchCatalog(query, category) });
});

// 2. Autonomous LLM Agent: Plan & Purchase from Natural Language
app.post('/api/v1/agent/plan-and-purchase', async (req, res) => {
  try {
    const { goalText, merchantId = 'acme_corp', rules = activeRulesStore } = req.body;

    if (!goalText || typeof goalText !== 'string') {
      return res.status(400).json({ error: 'goalText string is required' });
    }

    // Step 1: LLM Purchasing Agent reasons over goal & catalog database
    const plan = await planAndGeneratePurchaseRequest(goalText, merchantId);

    // Step 2: Pass agent's structured purchase request into Policy Engine & Payment Pipeline
    const execution = await executePurchasingPipeline(plan.transactionRequest, rules);

    res.json({
      plan,
      execution,
    });
  } catch (error: any) {
    console.error('[API] Agent plan-and-purchase error:', error);
    res.status(500).json({ error: error.message || 'Agent planning error' });
  }
});

// 3. Get & Update Policy Rules
app.get('/api/v1/policy/rules', (req, res) => {
  res.json({ rules: activeRulesStore });
});

app.put('/api/v1/policy/rules', (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'Request body must contain an array of rules' });
  }
  activeRulesStore = rules;
  res.json({ message: 'Policy rules updated successfully', rules: activeRulesStore });
});

// 4. Policy Evaluation (Dry Run)
app.post('/api/v1/policy/evaluate', async (req, res) => {
  try {
    const requestData: TransactionRequest = req.body.request;
    const customRules: PolicyRule[] = req.body.rules || activeRulesStore;

    if (!requestData || !requestData.totalAmount || !requestData.vendorId) {
      return res.status(400).json({
        error: 'Invalid request. TransactionRequest must contain totalAmount and vendorId.',
      });
    }

    const history = getTransactionHistory(100);
    const verdict = await evaluatePolicy(requestData, customRules, history);

    res.json({ verdict, request: requestData });
  } catch (error: any) {
    console.error('[API] Evaluation error:', error);
    res.status(500).json({ error: error.message || 'Internal evaluation error' });
  }
});

// 5. Gated Agent Purchase Execution Pipeline
app.post('/api/v1/agent/purchase', async (req, res) => {
  try {
    const requestData: TransactionRequest = req.body.request;
    const customRules: PolicyRule[] = req.body.rules || activeRulesStore;

    if (!requestData || !requestData.totalAmount || !requestData.vendorId) {
      return res.status(400).json({
        error: 'Invalid request. TransactionRequest must contain totalAmount and vendorId.',
      });
    }

    const pipelineResult = await executePurchasingPipeline(requestData, customRules);
    res.json(pipelineResult);
  } catch (error: any) {
    console.error('[API] Agent purchase execution error:', error);
    res.status(500).json({ error: error.message || 'Execution pipeline error' });
  }
});

// 6. Pending Approval Queue Endpoints
app.get('/api/v1/approvals', (req, res) => {
  res.json({ approvals: getPendingApprovals() });
});

app.post('/api/v1/approvals/:id/decide', async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reviewerNote } = req.body;

    if (decision !== 'APPROVE' && decision !== 'DENY') {
      return res.status(400).json({ error: "Decision must be 'APPROVE' or 'DENY'" });
    }

    const result = await decidePendingApproval(id, decision, reviewerNote);
    res.json({ message: `Pending request ${decision}D successfully`, result });
  } catch (error: any) {
    console.error('[API] Approval decision error:', error);
    res.status(400).json({ error: error.message });
  }
});

// 7. Audit Log History Endpoint
app.get('/api/v1/audit/logs', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json({ logs: getTransactionHistory(limit) });
});

// 8. Breach Notifications Endpoints
app.get('/api/v1/notifications', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '20', 10);
  res.json({
    notifications: getNotifications(limit),
    webhookUrl: getWebhookUrl(),
  });
});

app.post('/api/v1/notifications/webhook-config', (req, res) => {
  const { webhookUrl } = req.body;
  setWebhookUrl(webhookUrl || null);
  res.json({
    message: webhookUrl ? 'Webhook URL updated successfully' : 'Webhook URL cleared',
    webhookUrl: getWebhookUrl(),
  });
});

app.delete('/api/v1/notifications', (req, res) => {
  clearNotifications();
  res.json({ message: 'Notifications cleared' });
});

app.listen(PORT, () => {
  console.log(`[Agent Trust Layer] Server running on http://localhost:${PORT}`);
});
