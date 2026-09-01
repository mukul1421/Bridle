import { PolicyVerdict, TransactionRequest } from '../types/policy';

export interface BreachNotification {
  id: string;
  requestId: string;
  merchantId: string;
  verdict: 'BLOCK' | 'ESCALATE';
  overallReason: string;
  breachedRules: string[];
  totalAmount: number;
  currency: string;
  vendorName: string;
  goalText: string;
  timestamp: string;
  webhookStatus?: 'SENT' | 'FAILED' | 'DISABLED';
}

// In-memory breach notifications log
const notificationStore: BreachNotification[] = [];

// Optional Webhook URL (can be set via env or runtime API)
let configuredWebhookUrl: string | null = process.env.BREACH_WEBHOOK_URL || null;

export const setWebhookUrl = (url: string | null) => {
  configuredWebhookUrl = url;
};

export const getWebhookUrl = (): string | null => {
  return configuredWebhookUrl;
};

export const getNotifications = (limit = 20): BreachNotification[] => {
  return [...notificationStore].reverse().slice(0, limit);
};

export const clearNotifications = (): void => {
  notificationStore.length = 0;
};

/**
 * Dispatches real-time policy breach notification to webhooks & stores in-app alert history
 */
export async function dispatchPolicyBreachNotification(
  verdict: PolicyVerdict,
  request: TransactionRequest
): Promise<BreachNotification | null> {
  // Only trigger for policy breaches (BLOCK or ESCALATE)
  if (verdict.verdict === 'ALLOW') {
    return null;
  }

  const breachedRuleNames = verdict.evaluatedRules
    .filter((r) => r.verdict === 'BLOCK' || r.verdict === 'ESCALATE')
    .map((r) => `${r.ruleType}: ${r.reason}`);

  const notification: BreachNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    requestId: request.requestId,
    merchantId: request.merchantId,
    verdict: verdict.verdict,
    overallReason: verdict.overallReason,
    breachedRules: breachedRuleNames,
    totalAmount: request.totalAmount,
    currency: request.currency || 'INR',
    vendorName: request.vendorName,
    goalText: request.goalText,
    timestamp: new Date().toISOString(),
    webhookStatus: configuredWebhookUrl ? 'SENT' : 'DISABLED',
  };

  // Add to in-memory store
  notificationStore.push(notification);

  // Send external webhook if configured
  if (configuredWebhookUrl) {
    try {
      const payload = {
        text: `🚨 *POLICY BREACH ALERT [${notification.verdict}]* 🚨\n*Merchant:* ${request.merchantId}\n*Goal:* "${request.goalText}"\n*Vendor:* ${request.vendorName}\n*Amount:* ₹${request.totalAmount}\n*Reason:* ${verdict.overallReason}`,
        notification,
      };

      // Best effort webhook dispatch
      fetch(configuredWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.error('[NotificationService] Webhook dispatch error:', err.message);
        notification.webhookStatus = 'FAILED';
      });
    } catch (err: any) {
      console.error('[NotificationService] Failed to trigger webhook fetch:', err.message);
      notification.webhookStatus = 'FAILED';
    }
  }

  console.log(
    `[NotificationService] 🚨 Breach Alert Dispatched [${notification.verdict}]: ${notification.overallReason}`
  );

  return notification;
}
