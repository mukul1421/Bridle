import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { evaluatePolicy } from './services/policyEngine';
import {
  getNotifications,
  clearNotifications,
  getWebhookUrl,
  setWebhookUrl,
} from './services/notificationService';
import { PolicyRule, TransactionRequest } from './types/policy';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory store for rules and transaction history
const activeRulesStore: PolicyRule[] = [
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
      snacks: 10000,
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

const transactionHistoryStore: TransactionRequest[] = [];

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
      policyEvaluate: '/api/v1/policy/evaluate',
      getRules: '/api/v1/policy/rules',
      notifications: '/api/v1/notifications',
      webhookConfig: '/api/v1/notifications/webhook-config',
    },
  });
});

// 1. Get Active Rules
app.get('/api/v1/policy/rules', (req, res) => {
  res.json({
    rules: activeRulesStore,
  });
});

// 2. Policy Evaluation Endpoint
app.post('/api/v1/policy/evaluate', async (req, res) => {
  try {
    const requestData: TransactionRequest = req.body.request;
    const customRules: PolicyRule[] = req.body.rules || activeRulesStore;

    if (!requestData || !requestData.totalAmount || !requestData.vendorId) {
      return res.status(400).json({
        error: 'Invalid request. TransactionRequest must contain totalAmount and vendorId.',
      });
    }

    const verdict = await evaluatePolicy(requestData, customRules, transactionHistoryStore);

    // If allowed or escalated, record in history store for rolling calculations
    if (verdict.verdict === 'ALLOW') {
      transactionHistoryStore.push(requestData);
    }

    res.json({
      verdict,
      request: requestData,
    });
  } catch (error: any) {
    console.error('[API] Evaluation error:', error);
    res.status(500).json({ error: error.message || 'Internal evaluation error' });
  }
});

// 3. Get Breach Notifications Endpoint
app.get('/api/v1/notifications', (req, res) => {
  const limit = parseInt((req.query.limit as string) || '20', 10);
  res.json({
    notifications: getNotifications(limit),
    webhookUrl: getWebhookUrl(),
  });
});

// 4. Configure Webhook Endpoint
app.post('/api/v1/notifications/webhook-config', (req, res) => {
  const { webhookUrl } = req.body;
  setWebhookUrl(webhookUrl || null);
  res.json({
    message: webhookUrl ? 'Webhook URL updated successfully' : 'Webhook URL cleared',
    webhookUrl: getWebhookUrl(),
  });
});

// 5. Clear Notifications
app.delete('/api/v1/notifications', (req, res) => {
  clearNotifications();
  res.json({ message: 'Notifications cleared' });
});

app.listen(PORT, () => {
  console.log(`[Agent Trust Layer] Server running on http://localhost:${PORT}`);
});
