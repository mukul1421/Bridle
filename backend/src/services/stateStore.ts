import { TransactionRequest } from '../types/policy';

export interface RecordedTransaction extends TransactionRequest {
  executedAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'COMPLETED' | 'REJECTED' | 'PENDING_HUMAN_APPROVAL' | 'DENIED_BY_HUMAN';
}

// In-memory state store for executed & historical transactions
const transactionHistory: RecordedTransaction[] = [];

// Simple in-memory concurrency lock (mutex flag for atomic check-and-reserve)
let isLocked = false;
const lockQueue: Array<() => void> = [];

async function acquireLock(): Promise<void> {
  if (!isLocked) {
    isLocked = true;
    return;
  }
  return new Promise((resolve) => {
    lockQueue.push(resolve);
  });
}

function releaseLock(): void {
  if (lockQueue.length > 0) {
    const next = lockQueue.shift();
    if (next) next();
  } else {
    isLocked = false;
  }
}

/**
 * Executes a function inside an atomic lock context to guarantee concurrency safety
 */
export async function withAtomicLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquireLock();
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

/**
 * Returns recorded transactions
 */
export function getTransactionHistory(limit = 50): RecordedTransaction[] {
  return [...transactionHistory].reverse().slice(0, limit);
}

/**
 * Adds a transaction to the history store
 */
export function recordTransaction(tx: RecordedTransaction): void {
  transactionHistory.push(tx);
}

/**
 * Calculates rolling spend for a given window in hours
 */
export function calculateRollingSpend(windowHours = 24, nowTimestamp = Date.now()): number {
  const windowMs = windowHours * 60 * 60 * 1000;
  const windowStart = nowTimestamp - windowMs;

  return transactionHistory
    .filter((tx) => {
      if (tx.status !== 'COMPLETED') return false;
      const txTime = new Date(tx.executedAt || tx.timestamp).getTime();
      return txTime >= windowStart && txTime <= nowTimestamp;
    })
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
}

/**
 * Clears history store (useful for test resets)
 */
export function clearTransactionHistory(): void {
  transactionHistory.length = 0;
}
