import {
  PolicyRule,
  PolicyVerdict,
  TransactionRequest,
} from '../types/policy';
import { evaluatePolicy } from './policyEngine';
import {
  createAndCaptureRazorpayOrder,
  RazorpayPaymentResult,
} from './razorpayService';
import {
  recordTransaction,
  withAtomicLock,
  getTransactionHistory,
} from './stateStore';

export interface PendingApprovalItem {
  id: string;
  request: TransactionRequest;
  verdict: PolicyVerdict;
  status: 'PENDING_HUMAN_APPROVAL' | 'APPROVED_BY_HUMAN' | 'DENIED_BY_HUMAN';
  createdAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  paymentResult?: RazorpayPaymentResult;
}

export interface ExecutionPipelineResult {
  requestId: string;
  verdict: PolicyVerdict;
  status: 'COMPLETED' | 'REJECTED' | 'PENDING_HUMAN_APPROVAL';
  pendingApprovalId?: string;
  payment?: RazorpayPaymentResult | null;
  timestamp: string;
}

// In-memory Pending Approval Queue store
const pendingApprovalsStore: PendingApprovalItem[] = [];

export function getPendingApprovals(): PendingApprovalItem[] {
  return [...pendingApprovalsStore].reverse();
}

export function clearPendingApprovals(): void {
  pendingApprovalsStore.length = 0;
}

/**
 * Core Gated Execution Pipeline
 * Takes a merchant transaction request, evaluates policy rules atomically,
 * and routes to Razorpay execution, Human Approval Queue, or Blocked Audit Log.
 */
export async function executePurchasingPipeline(
  request: TransactionRequest,
  rules: PolicyRule[]
): Promise<ExecutionPipelineResult> {
  return withAtomicLock(async () => {
    // 1. Get recent transaction history for rolling calculation
    const history = getTransactionHistory(100);

    // 2. Evaluate against policy engine
    const verdict = await evaluatePolicy(request, rules, history);

    const timestamp = new Date().toISOString();

    // 3. Handle Verdict Outcomes
    if (verdict.verdict === 'BLOCK') {
      recordTransaction({
        ...request,
        executedAt: timestamp,
        status: 'REJECTED',
      });

      return {
        requestId: request.requestId,
        verdict,
        status: 'REJECTED',
        payment: null,
        timestamp,
      };
    }

    if (verdict.verdict === 'ESCALATE') {
      const pendingItem: PendingApprovalItem = {
        id: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        request,
        verdict,
        status: 'PENDING_HUMAN_APPROVAL',
        createdAt: timestamp,
      };

      pendingApprovalsStore.push(pendingItem);

      recordTransaction({
        ...request,
        executedAt: timestamp,
        status: 'PENDING_HUMAN_APPROVAL',
      });

      return {
        requestId: request.requestId,
        verdict,
        status: 'PENDING_HUMAN_APPROVAL',
        pendingApprovalId: pendingItem.id,
        payment: null,
        timestamp,
      };
    }

    // Verdict is ALLOW -> Execute Razorpay Payment
    const payment = await createAndCaptureRazorpayOrder(
      request.totalAmount,
      request.currency || 'INR',
      `rcpt_${request.merchantId}`,
      {
        goalText: request.goalText,
        vendorName: request.vendorName,
        category: request.category,
      }
    );

    recordTransaction({
      ...request,
      executedAt: timestamp,
      razorpayOrderId: payment.orderId,
      razorpayPaymentId: payment.paymentId,
      status: 'COMPLETED',
    });

    return {
      requestId: request.requestId,
      verdict,
      status: 'COMPLETED',
      payment,
      timestamp,
    };
  });
}

/**
 * Resolves a pending escalation item via Human Approval or Denial
 */
export async function decidePendingApproval(
  pendingId: string,
  decision: 'APPROVE' | 'DENY',
  reviewerNote = ''
): Promise<PendingApprovalItem> {
  const item = pendingApprovalsStore.find((p) => p.id === pendingId);
  if (!item) {
    throw new Error(`Pending approval item '${pendingId}' not found.`);
  }

  if (item.status !== 'PENDING_HUMAN_APPROVAL') {
    throw new Error(`Pending approval item '${pendingId}' has already been processed.`);
  }

  item.reviewedAt = new Date().toISOString();
  item.reviewerNote = reviewerNote;

  if (decision === 'DENY') {
    item.status = 'DENIED_BY_HUMAN';
    recordTransaction({
      ...item.request,
      executedAt: item.reviewedAt,
      status: 'DENIED_BY_HUMAN',
    });
    return item;
  }

  // Decision is APPROVE -> Trigger Razorpay Payment
  const payment = await createAndCaptureRazorpayOrder(
    item.request.totalAmount,
    item.request.currency || 'INR',
    `rcpt_human_approved_${item.request.merchantId}`,
    {
      goalText: item.request.goalText,
      vendorName: item.request.vendorName,
      humanApproved: 'true',
      reviewerNote,
    }
  );

  item.status = 'APPROVED_BY_HUMAN';
  item.paymentResult = payment;

  recordTransaction({
    ...item.request,
    executedAt: item.reviewedAt,
    razorpayOrderId: payment.orderId,
    razorpayPaymentId: payment.paymentId,
    status: 'COMPLETED',
  });

  return item;
}
