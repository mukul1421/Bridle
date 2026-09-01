import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  RefreshCw,
  Sliders,
  UserCheck,
  FileText,
  Sparkles,
  Bot,
  ArrowRight,
  Zap,
  ShieldAlert,
  Package,
  RotateCcw,
} from 'lucide-react';

/* ────────────────── Types ────────────────── */

interface PolicyRule {
  id: string; type: string; name: string; enabled: boolean;
  maxAmountPerTransaction?: number; softCapEscalateThreshold?: number;
  allowedVendors?: string[]; blockUnlistedVendors?: boolean;
  categoryCaps?: Record<string, number>;
  windowHours?: number; maxRollingAmount?: number;
}

interface RuleEvaluationResult {
  ruleId: string; ruleType: string; passed: boolean;
  verdict: 'ALLOW' | 'BLOCK' | 'ESCALATE'; reason: string;
}

interface PolicyVerdict {
  requestId: string; verdict: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  overallReason: string; evaluatedRules: RuleEvaluationResult[];
  timestamp: string;
}

interface RazorpayPayment {
  orderId: string; paymentId: string; amount: number;
  currency: string; status: string; receipt: string;
  vendorPayoutStatus: string; vendorPayoutId: string;
  createdAt: string; mode: string;
}

interface LLMAgentPlan {
  parsedGoal: string; detectedCategory: string;
  detectedBudgetLimit: number | null;
  selectedVendorId: string; selectedVendorName: string;
  selectedItem: { id: string; name: string; unitPrice: number; category: string; };
  quantity: number; totalAmount: number; reasoning: string;
  transactionRequest: any;
  provider: 'LIVE_GEMINI_API' | 'LOCAL_LLM_SIMULATOR';
}

interface ExecutionResult {
  requestId: string; verdict: PolicyVerdict;
  status: 'COMPLETED' | 'REJECTED' | 'PENDING_HUMAN_APPROVAL';
  pendingApprovalId?: string; payment?: RazorpayPayment | null;
  timestamp: string;
}

interface PlanAndPurchaseResponse { plan: LLMAgentPlan; execution: ExecutionResult; }

interface PendingApprovalItem {
  id: string; request: any; verdict: PolicyVerdict;
  status: 'PENDING_HUMAN_APPROVAL' | 'APPROVED_BY_HUMAN' | 'DENIED_BY_HUMAN';
  createdAt: string; reviewedAt?: string; reviewerNote?: string;
  paymentResult?: RazorpayPayment;
}

interface AuditLogItem {
  requestId: string; merchantId: string; goalText: string;
  vendorName: string; totalAmount: number; currency: string;
  status: string; executedAt: string;
}

interface BreachNotification {
  id: string; requestId: string; verdict: 'BLOCK' | 'ESCALATE';
  overallReason: string; breachedRules: string[];
  totalAmount: number; vendorName: string; goalText: string;
  timestamp: string;
}

/* ────────────────── Helpers ────────────────── */

/** Formats AI reasoning into clean bullet points */
function formatReasoning(raw: string): string[] {
  // Strip [LIVE Gemini ...] or [LLM Intent Parser] prefixes
  const cleaned = raw
    .replace(/^\[LIVE Gemini[^\]]*\]\s*/i, '')
    .replace(/^\[LLM[^\]]*\]\s*/i, '');

  // If it has bracket-delimited steps, split on them
  const bracketSteps = cleaned.match(/\[[^\]]+\][^[]+/g);
  if (bracketSteps && bracketSteps.length > 1) {
    return bracketSteps.map(s => s.replace(/^\[([^\]]+)\]\s*/, '**$1:** ').trim());
  }

  // If it's a single natural-language paragraph from Gemini, split on sentence endings
  const sentences = cleaned.split(/\.\s+/).filter(s => s.trim().length > 5);
  if (sentences.length > 1) {
    return sentences.map(s => s.trim().replace(/\.$/, '') + '.');
  }

  return [cleaned];
}

function verdictColor(v: string) {
  if (v === 'ALLOW') return 'var(--status-allow)';
  if (v === 'BLOCK') return 'var(--status-block)';
  return 'var(--status-escalate)';
}

function verdictBg(v: string) {
  if (v === 'ALLOW') return 'var(--status-allow-bg)';
  if (v === 'BLOCK') return 'var(--status-block-bg)';
  return 'var(--status-escalate-bg)';
}

function verdictIcon(v: string) {
  if (v === 'ALLOW') return <CheckCircle size={18} />;
  if (v === 'BLOCK') return <XCircle size={18} />;
  return <AlertTriangle size={18} />;
}

function verdictLabel(v: string) {
  if (v === 'ALLOW') return 'Approved';
  if (v === 'BLOCK') return 'Blocked';
  return 'Needs Approval';
}

function statusLabel(s: string) {
  if (s === 'COMPLETED') return 'Payment Executed';
  if (s === 'REJECTED') return 'Transaction Rejected';
  return 'Awaiting Human Approval';
}

/* ────────────────── Component ────────────────── */

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent' | 'approvals' | 'rules' | 'audit'>('agent');
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notifications, setNotifications] = useState<BreachNotification[]>([]);
  const [activeToast, setActiveToast] = useState<BreachNotification | null>(null);

  const [agentPrompt, setAgentPrompt] = useState('');
  const [merchantId, setMerchantId] = useState('acme_corp');
  const [agentResult, setAgentResult] = useState<PlanAndPurchaseResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [rulesRes, approvalsRes, auditRes, notifRes] = await Promise.all([
        fetch('/api/v1/policy/rules'),
        fetch('/api/v1/approvals'),
        fetch('/api/v1/audit/logs'),
        fetch('/api/v1/notifications'),
      ]);
      if (rulesRes.ok) { const d = await rulesRes.json(); setRules(d.rules || []); }
      if (approvalsRes.ok) { const d = await approvalsRes.json(); setPendingApprovals(d.approvals || []); }
      if (auditRes.ok) { const d = await auditRes.json(); setAuditLogs(d.logs || []); }
      if (notifRes.ok) { const d = await notifRes.json(); setNotifications(d.notifications || []); }
    } catch (err) { console.error('Error fetching dashboard data:', err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim()) return;
    setThinking(true);
    setActionMessage(null);
    setAgentResult(null);

    try {
      const res = await fetch('/api/v1/agent/plan-and-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: agentPrompt, merchantId }),
      });
      const data: PlanAndPurchaseResponse = await res.json();
      setAgentResult(data);
      setThinking(false);

      if (data.execution.verdict.verdict === 'BLOCK' || data.execution.verdict.verdict === 'ESCALATE') {
        const notif: BreachNotification = {
          id: `notif_${Date.now()}`, requestId: data.execution.requestId,
          verdict: data.execution.verdict.verdict,
          overallReason: data.execution.verdict.overallReason,
          breachedRules: data.execution.verdict.evaluatedRules.filter(r => r.verdict !== 'ALLOW').map(r => r.reason),
          totalAmount: data.plan.totalAmount, vendorName: data.plan.selectedVendorName,
          goalText: data.plan.parsedGoal, timestamp: new Date().toISOString(),
        };
        setActiveToast(notif);
        setTimeout(() => setActiveToast(null), 5000);
      }
      fetchData();
    } catch (err: any) {
      console.error('Agent execution error:', err);
      setThinking(false);
    }
  };

  const handleDecideApproval = async (id: string, decision: 'APPROVE' | 'DENY') => {
    try {
      const res = await fetch(`/api/v1/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerNote: decision === 'APPROVE' ? 'Approved by Admin' : 'Denied by Admin' }),
      });
      if (res.ok) {
        setActionMessage(`Request ${decision === 'APPROVE' ? 'approved' : 'denied'} successfully!`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchData();
      }
    } catch (err) { console.error('Approval decision error:', err); }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    const updatedRules = rules.map(r => (r.id === ruleId ? { ...r, enabled } : r));
    try {
      const res = await fetch('/api/v1/policy/rules', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updatedRules }),
      });
      if (res.ok) setRules(updatedRules);
    } catch (err) { console.error('Toggle rule error:', err); }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/v1/reset', { method: 'POST' });
      setAgentResult(null);
      setActionMessage('State reset — rolling totals cleared.');
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
    } catch (err) { console.error('Reset error:', err); }
  };

  // Stats
  const totalLogs = auditLogs.length;
  const allowCount = auditLogs.filter(l => l.status === 'COMPLETED').length;
  const blockCount = auditLogs.filter(l => l.status === 'REJECTED').length;
  const pendingCount = pendingApprovals.filter(a => a.status === 'PENDING_HUMAN_APPROVAL').length;
  const totalVolume = auditLogs.filter(l => l.status === 'COMPLETED').reduce((s, l) => s + (l.totalAmount || 0), 0);

  /* ── Example prompts ── */
  const examples = [
    { label: 'Safe Purchase', color: '#10b981', prompt: 'Restock 5 boxes of office snacks under 10000' },
    { label: 'Near Limit', color: '#f59e0b', prompt: 'Get 8 packs of premium coffee for the team' },
    { label: 'Over Budget', color: '#ef4444', prompt: 'Bulk order 2 executive desks for 18000' },
    { label: 'Bad Supplier', color: '#a855f7', prompt: 'Purchase 1 refurbished hard drive from unapproved store' },
  ];

  return (
    <div className="container">
      {/* ── Toast Alert ── */}
      {activeToast && (
        <div className="toast-alert" style={{
          borderLeftColor: activeToast.verdict === 'BLOCK' ? 'var(--status-block)' : 'var(--status-escalate)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <AlertTriangle size={18} color={activeToast.verdict === 'BLOCK' ? '#ef4444' : '#f59e0b'} />
            <strong style={{ fontSize: '0.9rem' }}>
              {activeToast.verdict === 'BLOCK' ? '🚫 Transaction Blocked' : '⚠️ Sent to Approval Queue'}
            </strong>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            {activeToast.vendorName} — ₹{activeToast.totalAmount.toLocaleString()}
          </p>
        </div>
      )}

      {/* ── Header ── */}
      <header className="header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.15rem' }}>
            <ShieldCheck size={28} color="#3b82f6" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Bridle
            </h1>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 400 }}>
              Agent Trust Layer
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            AI agent for autonomous purchasing — governed by policy safety rules before any payment executes.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="logo-badge">
            <span className="status-dot" /> Sandbox Mode
          </span>
          <button onClick={handleReset} className="btn-icon" title="Reset state">
            <RotateCcw size={15} />
          </button>
          <button onClick={fetchData} className="btn-icon" title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* ── Stats Row ── */}
      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-label">Requests</span>
          <span className="stat-value">{totalLogs}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ color: 'var(--status-allow)' }}>Approved</span>
          <span className="stat-value" style={{ color: 'var(--status-allow)' }}>{allowCount}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ color: 'var(--status-block)' }}>Blocked</span>
          <span className="stat-value" style={{ color: 'var(--status-block)' }}>{blockCount}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ color: 'var(--status-escalate)' }}>Pending</span>
          <span className="stat-value" style={{ color: 'var(--status-escalate)' }}>{pendingCount}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Volume</span>
          <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>₹{totalVolume.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <nav className="tab-nav">
        {[
          { key: 'agent' as const, icon: <Bot size={15} />, label: 'AI Agent' },
          { key: 'approvals' as const, icon: <UserCheck size={15} />, label: 'Approvals', count: pendingCount },
          { key: 'rules' as const, icon: <Sliders size={15} />, label: 'Policy Rules' },
          { key: 'audit' as const, icon: <FileText size={15} />, label: 'Audit Log' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.icon} {tab.label}
            {tab.count ? <span className="tab-count">{tab.count}</span> : null}
          </button>
        ))}
      </nav>

      {/* ── Success Banner ── */}
      {actionMessage && (
        <div className="success-banner">
          <CheckCircle size={16} /> {actionMessage}
        </div>
      )}

      {/* ═══════════════ TAB: AI AGENT ═══════════════ */}
      {activeTab === 'agent' && (
        <div className="agent-layout">
          {/* ── Input Panel ── */}
          <div className="glass-card">
            <h3 className="section-title">
              <Sparkles size={18} color="#6366f1" /> What would you like to buy?
            </h3>
            <p className="section-desc">
              Describe your purchase in plain English. The AI agent will find the best product, compute costs, and submit it through the policy safety check.
            </p>

            {/* Quick Examples */}
            <div className="examples-grid">
              {examples.map(ex => (
                <button
                  key={ex.prompt}
                  type="button"
                  onClick={() => setAgentPrompt(ex.prompt)}
                  className="example-chip"
                  style={{ borderColor: `${ex.color}40` }}
                >
                  <span className="example-dot" style={{ background: ex.color }} />
                  <span className="example-label">{ex.label}</span>
                  <span className="example-text">{ex.prompt}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleRunAgent} className="agent-form">
              <textarea
                className="input-field"
                rows={2}
                value={agentPrompt}
                onChange={e => setAgentPrompt(e.target.value)}
                placeholder='e.g. "Buy 5 boxes of office snacks under ₹10,000"'
                required
              />
              <div className="form-footer">
                <div className="merchant-input">
                  <label>Merchant</label>
                  <input className="input-field" value={merchantId} onChange={e => setMerchantId(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary btn-lg" disabled={thinking}>
                  {thinking ? (
                    <><span className="spinner" /> Thinking...</>
                  ) : (
                    <><Send size={16} /> Execute</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Result Panel ── */}
          {thinking && (
            <div className="glass-card result-card">
              <div className="thinking-state">
                <span className="spinner large" />
                <h4>AI Agent is reasoning...</h4>
                <p>Searching catalogs, computing prices, evaluating policies</p>
              </div>
            </div>
          )}

          {agentResult && !thinking && (
            <div className="glass-card result-card">
              {/* ── Step 1: AI Decision ── */}
              <div className="result-step">
                <div className="step-header">
                  <div className="step-number">1</div>
                  <div>
                    <h4>AI Agent Decision</h4>
                    <span className="provider-tag">
                      {agentResult.plan.provider === 'LIVE_GEMINI_API' ? '⚡ Gemini 3.5 Flash' : '🔧 Local Engine'}
                    </span>
                  </div>
                </div>

                <div className="order-summary">
                  <div className="order-item">
                    <Package size={16} color="var(--accent-indigo)" />
                    <div>
                      <strong>{agentResult.plan.quantity}× {agentResult.plan.selectedItem?.name}</strong>
                      <span className="order-meta">
                        from {agentResult.plan.selectedVendorName} · ₹{agentResult.plan.selectedItem?.unitPrice?.toLocaleString()} each
                      </span>
                    </div>
                    <span className="order-total">₹{agentResult.plan.totalAmount?.toLocaleString()}</span>
                  </div>
                </div>

                {/* AI Reasoning Steps */}
                <div className="reasoning-box">
                  <span className="reasoning-label">💡 AI Reasoning</span>
                  <ul className="reasoning-list">
                    {formatReasoning(agentResult.plan.reasoning).map((step, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: step.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
                    ))}
                  </ul>
                </div>
              </div>

              {/* ── Arrow ── */}
              <div className="step-arrow">
                <ArrowRight size={20} color="var(--text-muted)" />
              </div>

              {/* ── Step 2: Safety Check ── */}
              <div className="result-step">
                <div className="step-header">
                  <div className="step-number">2</div>
                  <h4>Policy Safety Check</h4>
                </div>

                <div className="verdict-card" style={{
                  background: verdictBg(agentResult.execution.verdict.verdict),
                  borderColor: `${verdictColor(agentResult.execution.verdict.verdict)}60`,
                }}>
                  <div className="verdict-header">
                    <span className="verdict-badge" style={{ color: verdictColor(agentResult.execution.verdict.verdict) }}>
                      {verdictIcon(agentResult.execution.verdict.verdict)}
                      {verdictLabel(agentResult.execution.verdict.verdict)}
                    </span>
                    <span className="verdict-status">
                      {statusLabel(agentResult.execution.status)}
                    </span>
                  </div>

                  {/* Rule Results */}
                  <div className="rules-check-list">
                    {agentResult.execution.verdict.evaluatedRules.map((r, i) => (
                      <div key={i} className="rule-check-item">
                        {r.verdict === 'ALLOW' ? (
                          <CheckCircle size={14} color="var(--status-allow)" />
                        ) : r.verdict === 'BLOCK' ? (
                          <XCircle size={14} color="var(--status-block)" />
                        ) : (
                          <AlertTriangle size={14} color="var(--status-escalate)" />
                        )}
                        <span className="rule-check-label">
                          {r.ruleType === 'SPEND_CAP' ? 'Spend Limit' :
                           r.ruleType === 'VENDOR_ALLOWLIST' ? 'Supplier Check' :
                           r.ruleType === 'CATEGORY_LIMIT' ? 'Category Budget' : '24h Rolling Cap'}
                        </span>
                        <span className="rule-check-result" style={{ color: verdictColor(r.verdict) }}>
                          {r.verdict === 'ALLOW' ? 'Passed' : r.verdict === 'BLOCK' ? 'Failed' : 'Review'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Arrow ── */}
              {agentResult.execution.payment && (
                <>
                  <div className="step-arrow">
                    <ArrowRight size={20} color="var(--text-muted)" />
                  </div>

                  {/* ── Step 3: Payment ── */}
                  <div className="result-step">
                    <div className="step-header">
                      <div className="step-number success">3</div>
                      <h4>Payment Executed</h4>
                    </div>

                    <div className="payment-card">
                      <div className="payment-row">
                        <CreditCard size={16} color="var(--accent-blue)" />
                        <div>
                          <div className="payment-label">Razorpay Order</div>
                          <code>{agentResult.execution.payment.orderId}</code>
                        </div>
                      </div>
                      <div className="payment-row">
                        <Zap size={16} color="var(--status-allow)" />
                        <div>
                          <div className="payment-label">Status</div>
                          <strong style={{ color: 'var(--status-allow)' }}>
                            {agentResult.execution.payment.status}
                          </strong>
                        </div>
                      </div>
                      <div className="payment-row">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Payment: <code>{agentResult.execution.payment.paymentId}</code> · Mode: {agentResult.execution.payment.mode}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!agentResult && !thinking && (
            <div className="glass-card result-card">
              <div className="empty-state">
                <Bot size={40} color="var(--text-muted)" strokeWidth={1.5} />
                <h4>Ready to process</h4>
                <p>Select an example or type your own purchase request above, then click <strong>Execute</strong>.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: APPROVALS ═══════════════ */}
      {activeTab === 'approvals' && (
        <div className="glass-card">
          <h3 className="section-title">
            <UserCheck size={18} color="#f59e0b" /> Pending Approvals
          </h3>
          <p className="section-desc">
            Transactions that exceeded the soft spending cap are held here for manual review.
          </p>

          {pendingApprovals.length === 0 ? (
            <div className="empty-state small">
              <ShieldAlert size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <p>No pending approvals. Try the <strong>"Near Limit"</strong> example in the AI Agent tab.</p>
            </div>
          ) : (
            <div className="approval-list">
              {pendingApprovals.map(item => (
                <div key={item.id} className="approval-item">
                  <div className="approval-header">
                    <span className={`badge badge-${item.status === 'PENDING_HUMAN_APPROVAL' ? 'escalate' : item.status === 'APPROVED_BY_HUMAN' ? 'allow' : 'block'}`}>
                      {item.status === 'PENDING_HUMAN_APPROVAL' ? 'Awaiting Review' :
                       item.status === 'APPROVED_BY_HUMAN' ? 'Approved' : 'Denied'}
                    </span>
                    <span className="approval-time">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="approval-body">
                    <p className="approval-goal">"{item.request?.goalText}"</p>
                    <div className="approval-details">
                      <span>{item.request?.vendorName}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 700 }}>₹{item.request?.totalAmount?.toLocaleString()}</span>
                    </div>
                    <p className="approval-reason">{item.verdict?.overallReason}</p>
                  </div>

                  {item.status === 'PENDING_HUMAN_APPROVAL' ? (
                    <div className="approval-actions">
                      <button onClick={() => handleDecideApproval(item.id, 'APPROVE')} className="btn-success">
                        <CheckCircle size={15} /> Approve & Pay
                      </button>
                      <button onClick={() => handleDecideApproval(item.id, 'DENY')} className="btn-danger">
                        <XCircle size={15} /> Deny
                      </button>
                    </div>
                  ) : (
                    <div className="approval-resolved">
                      Resolved {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ''} — {item.reviewerNote}
                      {item.paymentResult && (
                        <span style={{ color: 'var(--status-allow)', marginLeft: '0.5rem' }}>
                          Order: <code>{item.paymentResult.orderId}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: POLICY RULES ═══════════════ */}
      {activeTab === 'rules' && (
        <div className="glass-card">
          <h3 className="section-title">
            <Sliders size={18} color="#10b981" /> Active Policy Rules
          </h3>
          <p className="section-desc">
            These rules are checked before every transaction. Toggle them on/off to test different scenarios.
          </p>

          <div className="rules-grid">
            {rules.map(rule => (
              <div key={rule.id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
                <div className="rule-card-header">
                  <strong>{rule.name}</strong>
                  <label className="toggle-label">
                    <input type="checkbox" checked={rule.enabled} onChange={e => handleToggleRule(rule.id, e.target.checked)} />
                    <span className="toggle-text">{rule.enabled ? 'On' : 'Off'}</span>
                  </label>
                </div>
                <div className="rule-card-body">
                  {rule.type === 'SPEND_CAP' && (
                    <>
                      <div className="rule-detail">Hard limit: <strong>₹{rule.maxAmountPerTransaction?.toLocaleString()}</strong></div>
                      <div className="rule-detail">Escalate above: <strong>₹{rule.softCapEscalateThreshold?.toLocaleString()}</strong></div>
                    </>
                  )}
                  {rule.type === 'VENDOR_ALLOWLIST' && (
                    <>
                      <div className="rule-detail">Approved vendors: <strong>{rule.allowedVendors?.length}</strong></div>
                      <div className="rule-detail">Block unknown: <strong>{rule.blockUnlistedVendors ? 'Yes' : 'No'}</strong></div>
                    </>
                  )}
                  {rule.type === 'CATEGORY_LIMIT' && rule.categoryCaps && (
                    Object.entries(rule.categoryCaps).map(([cat, cap]) => (
                      <div key={cat} className="rule-detail">{cat.replace('_', ' ')}: <strong>₹{cap.toLocaleString()}</strong></div>
                    ))
                  )}
                  {rule.type === 'ROLLING_TOTAL' && (
                    <>
                      <div className="rule-detail">Window: <strong>{rule.windowHours}h</strong></div>
                      <div className="rule-detail">Max rolling spend: <strong>₹{rule.maxRollingAmount?.toLocaleString()}</strong></div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: AUDIT LOG ═══════════════ */}
      {activeTab === 'audit' && (
        <div className="glass-card">
          <h3 className="section-title">
            <FileText size={18} color="#06b6d4" /> Transaction Audit Trail
          </h3>
          <p className="section-desc">
            Complete history of every transaction processed through the system.
          </p>

          {auditLogs.length === 0 ? (
            <div className="empty-state small">
              <FileText size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <p>No transactions yet. Use the AI Agent tab to create your first request.</p>
            </div>
          ) : (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Goal</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td className="muted">{new Date(log.executedAt).toLocaleTimeString()}</td>
                      <td>{log.goalText}</td>
                      <td>{log.vendorName}</td>
                      <td className="bold">₹{log.totalAmount?.toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${log.status === 'COMPLETED' ? 'allow' : log.status === 'REJECTED' ? 'block' : 'escalate'}`}>
                          {log.status === 'COMPLETED' ? 'Approved' : log.status === 'REJECTED' ? 'Blocked' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
