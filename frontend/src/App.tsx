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
  Store,
  Plus,
  Trash2,
  Check,
  Save,
  FileCode2,
} from 'lucide-react';

/* ────────────────── Types ────────────────── */

interface PolicyRule {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  maxAmountPerTransaction?: number;
  softCapEscalateThreshold?: number;
  allowedVendors?: string[];
  blockUnlistedVendors?: boolean;
  categoryCaps?: Record<string, number>;
  windowHours?: number;
  maxRollingAmount?: number;
  promptText?: string;
  defaultAction?: 'BLOCK' | 'ESCALATE';
}

interface RuleEvaluationResult {
  ruleId: string;
  ruleType: string;
  passed: boolean;
  verdict: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  reason: string;
}

interface PolicyVerdict {
  requestId: string;
  verdict: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  overallReason: string;
  evaluatedRules: RuleEvaluationResult[];
  timestamp: string;
}

interface RazorpayPayment {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
  vendorPayoutStatus: string;
  vendorPayoutId: string;
  createdAt: string;
  mode: string;
}

interface CatalogItem {
  id: string;
  vendorId: string;
  vendorName: string;
  category: 'snacks' | 'office_supplies' | 'cloud_infrastructure';
  name: string;
  unitPrice: number;
  currency: string;
  inStock: boolean;
  tags: string[];
}

interface SupplierInfo {
  vendorId: string;
  vendorName: string;
  category: string;
  itemCount: number;
}

interface BuyerAgentPlan {
  parsedGoal: string;
  detectedCategory: string;
  detectedBudgetLimit: number | null;
  selectedVendorId: string;
  selectedVendorName: string;
  selectedItem: { id: string; name: string; unitPrice: number; category: string };
  quantity: number;
  totalAmount: number;
  reasoning: string;
  transactionRequest: any;
  provider: 'LIVE_GEMINI_API' | 'LOCAL_BUYER_SIMULATOR';
}

interface PolicyGuardianAudit {
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complianceSummary: string;
  auditPoints: string[];
  guardianVerdict: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  policyVerdict: PolicyVerdict;
  guardianReasoning: string;
  nlRuleEvaluations?: Array<{
    ruleId: string;
    ruleName: string;
    promptText: string;
    passed: boolean;
    verdict: 'ALLOW' | 'BLOCK' | 'ESCALATE';
    reason: string;
  }>;
  provider: 'LIVE_GEMINI_API' | 'LOCAL_GUARDIAN_ENGINE';
}

interface ExecutionResult {
  requestId: string;
  verdict: PolicyVerdict;
  status: 'COMPLETED' | 'REJECTED' | 'PENDING_HUMAN_APPROVAL';
  pendingApprovalId?: string;
  payment?: RazorpayPayment | null;
  timestamp: string;
}

interface DualAgentResponse {
  plan: BuyerAgentPlan;
  guardianAudit?: PolicyGuardianAudit;
  execution?: ExecutionResult;
}

interface PendingApprovalItem {
  id: string;
  request: any;
  verdict: PolicyVerdict;
  status: 'PENDING_HUMAN_APPROVAL' | 'APPROVED_BY_HUMAN' | 'DENIED_BY_HUMAN';
  createdAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
  paymentResult?: RazorpayPayment;
}

interface AuditLogItem {
  requestId: string;
  merchantId: string;
  goalText: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  status: string;
  executedAt: string;
}

interface BreachNotification {
  id: string;
  requestId: string;
  verdict: 'BLOCK' | 'ESCALATE';
  overallReason: string;
  breachedRules: string[];
  totalAmount: number;
  vendorName: string;
  goalText: string;
  timestamp: string;
}

/* ────────────────── Helpers ────────────────── */

function formatReasoning(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw
    .replace(/^\[LIVE Gemini[^\]]*\]\s*/i, '')
    .replace(/^\[Buyer Agent[^\]]*\]\s*/i, '')
    .replace(/^\[LLM[^\]]*\]\s*/i, '');

  const bracketSteps = cleaned.match(/\[[^\]]+\][^[]+/g);
  if (bracketSteps && bracketSteps.length > 1) {
    return bracketSteps.map((s) => s.replace(/^\[([^\]]+)\]\s*/, '**$1:** ').trim());
  }

  const sentences = cleaned.split(/\.\s+/).filter((s) => s.trim().length > 5);
  if (sentences.length > 1) {
    return sentences.map((s) => s.trim().replace(/\.$/, '') + '.');
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

function riskColor(r: string) {
  if (r === 'LOW') return '#10b981';
  if (r === 'MEDIUM') return '#f59e0b';
  if (r === 'HIGH') return '#ef4444';
  return '#dc2626';
}

/* ────────────────── Main App Component ────────────────── */

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent' | 'inventory' | 'rules' | 'approvals' | 'audit'>('agent');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeToast, setActiveToast] = useState<BreachNotification | null>(null);

  // Agent State
  const [agentPrompt, setAgentPrompt] = useState('');
  const [merchantId, setMerchantId] = useState('acme_corp');
  const [agentResult, setAgentResult] = useState<DualAgentResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Item / Supplier Form State
  const [newItemName, setNewItemName] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newCategory, setNewCategory] = useState<'snacks' | 'office_supplies' | 'cloud_infrastructure'>('office_supplies');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Policy Rule Editing State
  const [editableRules, setEditableRules] = useState<PolicyRule[]>([]);
  const [newVendorInput, setNewVendorInput] = useState('');

  // Natural Language Custom Rule State
  const [nlRuleName, setNlRuleName] = useState('');
  const [nlRulePrompt, setNlRulePrompt] = useState('');
  const [nlRuleAction, setNlRuleAction] = useState<'BLOCK' | 'ESCALATE'>('BLOCK');

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [rulesRes, catalogRes, approvalsRes, auditRes] = await Promise.all([
        fetch('/api/v1/policy/rules'),
        fetch('/api/v1/catalog'),
        fetch('/api/v1/approvals'),
        fetch('/api/v1/audit/logs'),
      ]);

      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setEditableRules((prev) => (prev.length === 0 ? JSON.parse(JSON.stringify(d.rules || [])) : prev));
      }
      if (catalogRes.ok) {
        const d = await catalogRes.json();
        setCatalogItems(d.items || []);
        setSuppliers(d.suppliers || []);
      }
      if (approvalsRes.ok) {
        const d = await approvalsRes.json();
        setPendingApprovals(d.approvals || []);
      }
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAuditLogs(d.logs || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // 1. Run Full Dual-Agent Pipeline
  const handleRunFullPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim()) return;
    setThinking(true);
    setActionMessage(null);
    setAgentResult(null);

    try {
      const res = await fetch('/api/v1/agent/plan-and-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: agentPrompt, merchantId, rules: editableRules }),
      });
      const data: DualAgentResponse = await res.json();
      setAgentResult(data);
      setThinking(false);

      if (data.execution && (data.execution.verdict.verdict === 'BLOCK' || data.execution.verdict.verdict === 'ESCALATE')) {
        const notif: BreachNotification = {
          id: `notif_${Date.now()}`,
          requestId: data.execution.requestId,
          verdict: data.execution.verdict.verdict,
          overallReason: data.execution.verdict.overallReason,
          breachedRules: data.execution.verdict.evaluatedRules
            .filter((r) => r.verdict !== 'ALLOW')
            .map((r) => r.reason),
          totalAmount: data.plan.totalAmount,
          vendorName: data.plan.selectedVendorName,
          goalText: data.plan.parsedGoal,
          timestamp: new Date().toISOString(),
        };
        setActiveToast(notif);
        setTimeout(() => setActiveToast(null), 5000);
      }
      fetchData();
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setThinking(false);
    }
  };

  // 2. Run Standalone Buyer Agent (Agent 1 only)
  const handleRunBuyerOnly = async () => {
    if (!agentPrompt.trim()) return;
    setThinking(true);
    setActionMessage(null);
    setAgentResult(null);

    try {
      const res = await fetch('/api/v1/agent/buyer/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: agentPrompt, merchantId }),
      });
      const data = await res.json();
      setAgentResult({ plan: data.plan });
      setThinking(false);
      setActionMessage('Buyer Agent drafted proposal successfully!');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error('Buyer Agent error:', err);
      setThinking(false);
    }
  };

  // 3. Run Standalone Guardian Agent (Agent 2 on current plan)
  const handleRunGuardianAuditOnly = async () => {
    if (!agentResult?.plan) return;
    setThinking(true);

    try {
      const res = await fetch('/api/v1/agent/guardian/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal: agentResult.plan, rules: editableRules }),
      });
      const data = await res.json();
      setAgentResult((prev) => (prev ? { ...prev, guardianAudit: data.guardianAudit } : null));
      setThinking(false);
      setActionMessage('Guardian Agent completed compliance audit!');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error('Guardian Agent audit error:', err);
      setThinking(false);
    }
  };

  // Add Item to Catalog Handler
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newVendorName || !newUnitPrice) return;

    try {
      const res = await fetch('/api/v1/catalog/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName,
          vendorName: newVendorName,
          vendorId: newVendorName.toLowerCase().replace(/\s+/g, '_'),
          category: newCategory,
          unitPrice: Number(newUnitPrice),
          tags: newTags ? newTags.split(',').map((t) => t.trim()) : [newItemName.toLowerCase()],
        }),
      });

      if (res.ok) {
        setActionMessage(`Supplier product "${newItemName}" added to catalog!`);
        setTimeout(() => setActionMessage(null), 3000);
        setNewItemName('');
        setNewVendorName('');
        setNewUnitPrice('');
        setNewTags('');
        setIsAddingItem(false);
        fetchData();
      }
    } catch (err) {
      console.error('Add item error:', err);
    }
  };

  // Delete Item Handler
  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/v1/catalog/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        setActionMessage('Item removed from catalog.');
        setTimeout(() => setActionMessage(null), 3000);
        fetchData();
      }
    } catch (err) {
      console.error('Delete item error:', err);
    }
  };

  // Reset Catalog Handler
  const handleResetCatalog = async () => {
    try {
      await fetch('/api/v1/catalog/reset', { method: 'POST' });
      setActionMessage('Catalog reset to default baseline.');
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
    } catch (err) {
      console.error('Reset catalog error:', err);
    }
  };

  // Save Policy Rules Handler
  const handleSavePolicyRules = async () => {
    try {
      const res = await fetch('/api/v1/policy/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: editableRules }),
      });
      if (res.ok) {
        setActionMessage('Policy rules & natural language checks updated successfully!');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Save rules error:', err);
    }
  };

  // Update rule field helper
  const updateRuleField = (ruleId: string, updates: Partial<PolicyRule>) => {
    setEditableRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  };

  // Add Natural Language Custom Rule
  const handleAddNLRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlRulePrompt.trim()) return;

    const newRule: PolicyRule = {
      id: `rule_custom_nl_${Date.now()}`,
      type: 'CUSTOM_NL_RULE',
      name: nlRuleName.trim() || 'Custom Plain-English Policy',
      promptText: nlRulePrompt.trim(),
      enabled: true,
      defaultAction: nlRuleAction,
    };

    setEditableRules((prev) => [...prev, newRule]);
    setNlRuleName('');
    setNlRulePrompt('');
    setActionMessage('Custom natural language rule added! Click "Save Policy Changes" to persist.');
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Remove Natural Language Custom Rule
  const handleRemoveNLRule = (ruleId: string) => {
    setEditableRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // Add vendor to allowlist
  const handleAddVendorToAllowlist = (ruleId: string) => {
    if (!newVendorInput.trim()) return;
    const vendorTag = newVendorInput.trim().toLowerCase().replace(/\s+/g, '_');
    setEditableRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          const current = r.allowedVendors || [];
          if (!current.includes(vendorTag)) {
            return { ...r, allowedVendors: [...current, vendorTag] };
          }
        }
        return r;
      })
    );
    setNewVendorInput('');
  };

  // Remove vendor from allowlist
  const handleRemoveVendorFromAllowlist = (ruleId: string, vendorTag: string) => {
    setEditableRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          return { ...r, allowedVendors: (r.allowedVendors || []).filter((v) => v !== vendorTag) };
        }
        return r;
      })
    );
  };

  // Approvals Handler
  const handleDecideApproval = async (id: string, decision: 'APPROVE' | 'DENY') => {
    try {
      const res = await fetch(`/api/v1/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerNote: decision === 'APPROVE' ? 'Approved by Compliance Admin' : 'Denied by Compliance Admin',
        }),
      });
      if (res.ok) {
        setActionMessage(`Request ${decision === 'APPROVE' ? 'approved' : 'denied'} successfully!`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchData();
      }
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleResetState = async () => {
    try {
      await fetch('/api/v1/reset', { method: 'POST' });
      setAgentResult(null);
      setActionMessage('State reset — rolling spend cleared.');
      setTimeout(() => setActionMessage(null), 3000);
      fetchData();
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Stats
  const totalLogs = auditLogs.length;
  const allowCount = auditLogs.filter((l) => l.status === 'COMPLETED').length;
  const blockCount = auditLogs.filter((l) => l.status === 'REJECTED').length;
  const pendingCount = pendingApprovals.filter((a) => a.status === 'PENDING_HUMAN_APPROVAL').length;
  const totalVolume = auditLogs
    .filter((l) => l.status === 'COMPLETED')
    .reduce((s, l) => s + (l.totalAmount || 0), 0);

  const examples = [
    { label: 'Safe Snack Order', color: '#10b981', prompt: 'Restock 5 boxes of office snacks under 10000' },
    { label: 'Stationery Near Cap', color: '#f59e0b', prompt: 'Get 8 packs of premium coffee for the team' },
    { label: 'Single-Item NL Cap Test', color: '#ef4444', prompt: 'Buy 1 Ergonomic Mesh Executive Chair for 12000' },
    { label: 'Unlisted Supplier', color: '#a855f7', prompt: 'Purchase 1 refurbished hard drive from unapproved store' },
  ];

  const nlRuleExamples = [
    { name: 'Single Item ₹8k Cap', text: 'Block any purchase where an individual item costs more than ₹8,000 INR', action: 'BLOCK' as const },
    { name: 'Cloud Spend Escalation', text: 'Require manager approval for any cloud infrastructure or database purchase', action: 'ESCALATE' as const },
    { name: 'Eco-Friendly Requirement', text: 'Snacks must be certified organic or healthy refreshments only', action: 'BLOCK' as const },
  ];

  const customNLRules = editableRules.filter((r) => r.type === 'CUSTOM_NL_RULE');
  const numericalRules = editableRules.filter((r) => r.type !== 'CUSTOM_NL_RULE');

  return (
    <div className="container">
      {/* ── Toast Alert ── */}
      {activeToast && (
        <div
          className="toast-alert"
          style={{
            borderLeftColor: activeToast.verdict === 'BLOCK' ? 'var(--status-block)' : 'var(--status-escalate)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <AlertTriangle size={18} color={activeToast.verdict === 'BLOCK' ? '#ef4444' : '#f59e0b'} />
            <strong style={{ fontSize: '0.9rem' }}>
              {activeToast.verdict === 'BLOCK' ? '🚫 Transaction Blocked' : '⚠️ Escalated for Review'}
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
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Bridle</h1>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 400 }}>
              Decoupled Dual-Agent Trust Layer
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Autonomous Purchasing Agent (Buyer) audited by Policy Guardian Agent before Razorpay execution.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="logo-badge">
            <span className="status-dot" /> Live Dual-Agent Sandbox
          </span>
          <button onClick={handleResetState} className="btn-icon" title="Reset Transaction State">
            <RotateCcw size={15} />
          </button>
          <button onClick={fetchData} className="btn-icon" title="Refresh Dashboard">
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
          <span className="stat-label" style={{ color: 'var(--status-allow)' }}>
            Approved
          </span>
          <span className="stat-value" style={{ color: 'var(--status-allow)' }}>
            {allowCount}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ color: 'var(--status-block)' }}>
            Blocked
          </span>
          <span className="stat-value" style={{ color: 'var(--status-block)' }}>
            {blockCount}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label" style={{ color: 'var(--status-escalate)' }}>
            Escalated
          </span>
          <span className="stat-value" style={{ color: 'var(--status-escalate)' }}>
            {pendingCount}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Spend Volume</span>
          <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            ₹{totalVolume.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <nav className="tab-nav">
        {[
          { key: 'agent' as const, icon: <Bot size={15} />, label: 'Dual-Agent Flow' },
          { key: 'inventory' as const, icon: <Store size={15} />, label: `Suppliers & Catalog (${catalogItems.length})` },
          { key: 'rules' as const, icon: <Sliders size={15} />, label: `Policy Configurator (${editableRules.length})` },
          { key: 'approvals' as const, icon: <UserCheck size={15} />, label: 'Approvals Queue', count: pendingCount },
          { key: 'audit' as const, icon: <FileText size={15} />, label: 'Audit Trail' },
        ].map((tab) => (
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

      {/* ═══════════════ TAB 1: DUAL-AGENT PIPELINE ═══════════════ */}
      {activeTab === 'agent' && (
        <div className="agent-layout">
          {/* Input Panel */}
          <div className="glass-card">
            <h3 className="section-title">
              <Sparkles size={18} color="#6366f1" /> Merchant Spending Intent
            </h3>
            <p className="section-desc">
              State your purchase goal. You can execute both agents in an end-to-end pipeline, or run <strong>Agent 1 (Buyer)</strong> and <strong>Agent 2 (Guardian)</strong> independently.
            </p>

            {/* Quick Examples */}
            <div className="examples-grid">
              {examples.map((ex) => (
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

            <form onSubmit={handleRunFullPipeline} className="agent-form">
              <textarea
                className="input-field"
                rows={2}
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                placeholder='e.g. "Buy 1 Ergonomic Mesh Executive Chair for 12000" or custom item'
                required
              />
              <div className="form-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="merchant-input">
                  <label>Merchant ID</label>
                  <input className="input-field" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleRunBuyerOnly}
                    className="btn-secondary"
                    disabled={thinking || !agentPrompt.trim()}
                    title="Run only Agent 1 to search catalog & draft order"
                  >
                    🤖 Draft with Buyer Only
                  </button>
                  {agentResult?.plan && !agentResult?.guardianAudit && (
                    <button
                      type="button"
                      onClick={handleRunGuardianAuditOnly}
                      className="btn-secondary"
                      disabled={thinking}
                      style={{ borderColor: '#10b981', color: '#10b981' }}
                    >
                      🛡️ Audit with Guardian
                    </button>
                  )}
                  <button type="submit" className="btn-primary btn-lg" disabled={thinking}>
                    {thinking ? (
                      <>
                        <span className="spinner" /> Dual-Agent Reasoning...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Run Full Pipeline
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Thinking State */}
          {thinking && (
            <div className="glass-card result-card">
              <div className="thinking-state">
                <span className="spinner large" />
                <h4>Dual Agents in Action...</h4>
                <p>🤖 Agent 1: Searching dynamic catalog → 🛡️ Agent 2: Checking math bounds & custom natural language rules</p>
              </div>
            </div>
          )}

          {/* Dual-Agent Result Display */}
          {agentResult && !thinking && (
            <div className="glass-card result-card">
              {/* Agent 1: Autonomous Buyer */}
              <div className="result-step">
                <div className="step-header">
                  <div className="step-number">1</div>
                  <div>
                    <h4>🤖 Agent 1: Buyer Agent</h4>
                    <span className="provider-tag">
                      {agentResult.plan.provider === 'LIVE_GEMINI_API' ? '⚡ Gemini 3.5 Flash' : '🔧 Local Engine'}
                    </span>
                  </div>
                </div>

                <div className="order-summary">
                  <div className="order-item">
                    <Package size={16} color="var(--accent-indigo)" />
                    <div>
                      <strong>
                        {agentResult.plan.quantity}× {agentResult.plan.selectedItem?.name}
                      </strong>
                      <span className="order-meta">
                        Supplier: {agentResult.plan.selectedVendorName} (<code>{agentResult.plan.selectedVendorId}</code>) · ₹
                        {agentResult.plan.selectedItem?.unitPrice?.toLocaleString()} each
                      </span>
                    </div>
                    <span className="order-total">₹{agentResult.plan.totalAmount?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="reasoning-box">
                  <span className="reasoning-label">💡 Buyer Proposal Reasoning</span>
                  <ul className="reasoning-list">
                    {formatReasoning(agentResult.plan.reasoning).map((step, i) => (
                      <li
                        key={i}
                        dangerouslySetInnerHTML={{
                          __html: step.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
                        }}
                      />
                    ))}
                  </ul>
                </div>
              </div>

              {/* Arrow */}
              {agentResult.guardianAudit && (
                <>
                  <div className="step-arrow">
                    <ArrowRight size={20} color="var(--text-muted)" />
                  </div>

                  {/* Agent 2: Policy Guardian & Auditor */}
                  <div className="result-step">
                    <div className="step-header">
                      <div className="step-number" style={{ borderColor: '#10b981', color: '#10b981' }}>
                        2
                      </div>
                      <div>
                        <h4>🛡️ Agent 2: Policy Guardian</h4>
                        <span
                          className="provider-tag"
                          style={{
                            background: `${riskColor(agentResult.guardianAudit.riskRating)}20`,
                            color: riskColor(agentResult.guardianAudit.riskRating),
                          }}
                        >
                          Risk: {agentResult.guardianAudit.riskRating}
                        </span>
                      </div>
                    </div>

                    <div
                      className="verdict-card"
                      style={{
                        background: verdictBg(agentResult.guardianAudit.guardianVerdict),
                        borderColor: `${verdictColor(agentResult.guardianAudit.guardianVerdict)}60`,
                      }}
                    >
                      <div className="verdict-header">
                        <span
                          className="verdict-badge"
                          style={{ color: verdictColor(agentResult.guardianAudit.guardianVerdict) }}
                        >
                          {verdictIcon(agentResult.guardianAudit.guardianVerdict)}
                          {agentResult.guardianAudit.guardianVerdict === 'ALLOW'
                            ? 'Compliance Approved'
                            : agentResult.guardianAudit.guardianVerdict === 'BLOCK'
                            ? 'Policy Blocked'
                            : 'Soft-Cap Escalated'}
                        </span>
                        <span className="verdict-status">
                          {agentResult.execution?.status || 'Audited'}
                        </span>
                      </div>

                      {agentResult.guardianAudit.complianceSummary && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.6rem', fontWeight: 500 }}>
                          {agentResult.guardianAudit.complianceSummary}
                        </p>
                      )}

                      {/* Rule Checklist */}
                      <div className="rules-check-list">
                        {agentResult.guardianAudit.policyVerdict?.evaluatedRules?.map((r, i) => (
                          <div key={i} className="rule-check-item">
                            {r.verdict === 'ALLOW' ? (
                              <CheckCircle size={14} color="var(--status-allow)" />
                            ) : r.verdict === 'BLOCK' ? (
                              <XCircle size={14} color="var(--status-block)" />
                            ) : (
                              <AlertTriangle size={14} color="var(--status-escalate)" />
                            )}
                            <span className="rule-check-label">
                              {r.ruleType === 'SPEND_CAP'
                                ? 'Spend Cap Check'
                                : r.ruleType === 'VENDOR_ALLOWLIST'
                                ? 'Supplier Allowlist'
                                : r.ruleType === 'CATEGORY_LIMIT'
                                ? 'Category Budget'
                                : r.ruleType === 'ROLLING_TOTAL'
                                ? '24h Rolling Cap'
                                : 'Plain-English Custom Rule'}
                            </span>
                            <span className="rule-check-result" style={{ color: verdictColor(r.verdict) }}>
                              {r.verdict === 'ALLOW' ? 'Passed' : r.verdict === 'BLOCK' ? 'Blocked' : 'Escalate'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Payment Receipt / Execution Step */}
              {agentResult.execution?.payment && (
                <>
                  <div className="step-arrow">
                    <ArrowRight size={20} color="var(--text-muted)" />
                  </div>

                  <div className="result-step">
                    <div className="step-header">
                      <div className="step-number success">3</div>
                      <h4>Razorpay Gate</h4>
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
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Payment ID: <code>{agentResult.execution.payment.paymentId}</code> · Mode:{' '}
                          {agentResult.execution.payment.mode}
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
                <h4>Decoupled Dual-Agent Engine Ready</h4>
                <p>
                  Agent 1 searches your suppliers and drafts an order. Agent 2 enforces both mathematical caps and your custom plain-English policies.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB 2: SUPPLIERS & CATALOG MANAGER ═══════════════ */}
      {activeTab === 'inventory' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="section-title">
              <Store size={18} color="#06b6d4" /> Dynamic Suppliers & Product Catalog
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setIsAddingItem(!isAddingItem)} className="btn-primary">
                <Plus size={15} /> {isAddingItem ? 'Close Form' : 'Add New Product / Supplier'}
              </button>
              <button onClick={handleResetCatalog} className="btn-secondary" title="Reset Catalog">
                <RotateCcw size={15} /> Reset Baseline
              </button>
            </div>
          </div>
          <p className="section-desc">
            Any supplier or product you add here will be dynamically discovered and purchased by the Buyer Agent!
          </p>

          {/* Add Product Form */}
          {isAddingItem && (
            <form onSubmit={handleAddItem} style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent-blue)' }}>
                ➕ Create New Supplier Item
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRODUCT NAME</label>
                  <input className="input-field" placeholder="e.g. Smart Standing Desk" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SUPPLIER / VENDOR NAME</label>
                  <input className="input-field" placeholder="e.g. Apex Workspace" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CATEGORY</label>
                  <select className="input-field" value={newCategory} onChange={(e) => setNewCategory(e.target.value as any)}>
                    <option value="snacks">Snacks & Refreshments</option>
                    <option value="office_supplies">Office Supplies & Furniture</option>
                    <option value="cloud_infrastructure">Cloud Infrastructure & IT</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>UNIT PRICE (₹ INR)</label>
                  <input type="number" className="input-field" placeholder="e.g. 14000" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} required />
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SEARCH TAGS (COMMA SEPARATED)</label>
                <input className="input-field" placeholder="e.g. desk, standing desk, apex, furniture" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
              </div>
              <button type="submit" className="btn-success">
                <Check size={15} /> Save to Dynamic Catalog
              </button>
            </form>
          )}

          {/* Suppliers Summary Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {suppliers.map((s) => (
              <span key={s.vendorId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                🏷️ <strong>{s.vendorName}</strong> (<code>{s.vendorId}</code>) — {s.itemCount} items
              </span>
            ))}
          </div>

          {/* Catalog Table */}
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Supplier / Vendor</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.map((item) => (
                  <tr key={item.id}>
                    <td className="bold">{item.name}</td>
                    <td>
                      {item.vendorName} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({item.vendorId})</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
                        {item.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="bold" style={{ color: 'var(--accent-indigo)' }}>
                      ₹{item.unitPrice.toLocaleString()} INR
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="btn-icon"
                        title="Delete Product"
                        style={{ color: 'var(--status-block)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 3: POLICY RULES CONFIGURATOR ═══════════════ */}
      {activeTab === 'rules' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="section-title">
              <Sliders size={18} color="#10b981" /> Interactive Policy Rules & Custom Checks
            </h3>
            <button onClick={handleSavePolicyRules} className="btn-success">
              <Save size={15} /> Save Policy Changes
            </button>
          </div>
          <p className="section-desc">
            Customize numerical limits (hard/soft caps, category budgets, allowlists) and write <strong>plain-English policy checks</strong> enforced by Agent 2.
          </p>

          {/* 1. Natural Language Custom Policy Rules Creator */}
          <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-indigo)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileCode2 size={18} /> ✍️ Write Custom Policy Checks in Plain English
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Type any corporate check in natural language. Guardian Agent (Agent 2) will semantically interpret and enforce it for every transaction!
            </p>

            {/* Quick NL Examples */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center' }}>EXAMPLE CHECKS:</span>
              {nlRuleExamples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setNlRuleName(ex.name);
                    setNlRulePrompt(ex.text);
                    setNlRuleAction(ex.action);
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  ➕ {ex.name}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddNLRule} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>POLICY NAME</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Single-Item Price Ceiling"
                    value={nlRuleName}
                    onChange={(e) => setNlRuleName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRIGGER ACTION</label>
                  <select
                    className="input-field"
                    value={nlRuleAction}
                    onChange={(e) => setNlRuleAction(e.target.value as any)}
                  >
                    <option value="BLOCK">🚫 Immediate Block</option>
                    <option value="ESCALATE">🟡 Escalate to Manager</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  NATURAL LANGUAGE POLICY INSTRUCTION (PLAIN ENGLISH)
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder='e.g. "Block any purchase where an individual item costs more than ₹8,000 INR" or "Require manager review for all cloud subscriptions"'
                  value={nlRulePrompt}
                  onChange={(e) => setNlRulePrompt(e.target.value)}
                  required
                />
              </div>

              <div>
                <button type="submit" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}>
                  <Plus size={14} /> Add Plain-English Policy Rule
                </button>
              </div>
            </form>

            {/* Active Natural Language Rules List */}
            {customNLRules.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                  ACTIVE NATURAL LANGUAGE RULES ({customNLRules.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {customNLRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <strong style={{ fontSize: '0.85rem' }}>{rule.name}</strong>
                          <span
                            className="badge"
                            style={{
                              background: rule.defaultAction === 'BLOCK' ? 'var(--status-block-bg)' : 'var(--status-escalate-bg)',
                              color: rule.defaultAction === 'BLOCK' ? 'var(--status-block)' : 'var(--status-escalate)',
                              fontSize: '0.65rem',
                            }}
                          >
                            {rule.defaultAction}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                          "{rule.promptText}"
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label className="toggle-label" style={{ fontSize: '0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => updateRuleField(rule.id, { enabled: e.target.checked })}
                          />
                          {rule.enabled ? 'On' : 'Off'}
                        </label>
                        <button
                          onClick={() => handleRemoveNLRule(rule.id)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--status-block)' }}
                          title="Delete Rule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Numerical Deterministic Policy Rules Grid */}
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
            📊 NUMERICAL THRESHOLDS & BOUNDS
          </h4>
          <div className="rules-grid">
            {numericalRules.map((rule) => (
              <div key={rule.id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
                <div className="rule-card-header">
                  <strong>{rule.name}</strong>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRuleField(rule.id, { enabled: e.target.checked })}
                    />
                    <span className="toggle-text">{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className="rule-card-body">
                  {/* Spend Cap Config */}
                  {rule.type === 'SPEND_CAP' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                          HARD SPEND CAP (₹ INR) — Immediate Block
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.maxAmountPerTransaction || 15000}
                          onChange={(e) =>
                            updateRuleField(rule.id, { maxAmountPerTransaction: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                          SOFT CAP THRESHOLD (₹ INR) — Escalates to Manager
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.softCapEscalateThreshold || 10000}
                          onChange={(e) =>
                            updateRuleField(rule.id, { softCapEscalateThreshold: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Vendor Allowlist Config */}
                  {rule.type === 'VENDOR_ALLOWLIST' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        APPROVED VENDOR IDENTIFIERS
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {rule.allowedVendors?.map((v) => (
                          <span
                            key={v}
                            style={{
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <code>{v}</code>
                            <XCircle
                              size={12}
                              style={{ cursor: 'pointer', color: 'var(--status-block)' }}
                              onClick={() => handleRemoveVendorFromAllowlist(rule.id, v)}
                            />
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <input
                          className="input-field"
                          placeholder="e.g. vertex_supplies"
                          value={newVendorInput}
                          onChange={(e) => setNewVendorInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddVendorToAllowlist(rule.id)}
                          className="btn-secondary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Category Limits Config */}
                  {rule.type === 'CATEGORY_LIMIT' && rule.categoryCaps && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SNACKS CAP (₹ INR)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.categoryCaps.snacks || 15000}
                          onChange={(e) =>
                            updateRuleField(rule.id, {
                              categoryCaps: { ...rule.categoryCaps, snacks: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OFFICE SUPPLIES CAP (₹ INR)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.categoryCaps.office_supplies || 20000}
                          onChange={(e) =>
                            updateRuleField(rule.id, {
                              categoryCaps: { ...rule.categoryCaps, office_supplies: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CLOUD CAP (₹ INR)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.categoryCaps.cloud_infrastructure || 50000}
                          onChange={(e) =>
                            updateRuleField(rule.id, {
                              categoryCaps: { ...rule.categoryCaps, cloud_infrastructure: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Rolling Total Config */}
                  {rule.type === 'ROLLING_TOTAL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>WINDOW (HOURS)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.windowHours || 24}
                          onChange={(e) => updateRuleField(rule.id, { windowHours: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MAX ROLLING SPEND (₹ INR)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={rule.maxRollingAmount || 40000}
                          onChange={(e) => updateRuleField(rule.id, { maxRollingAmount: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 4: APPROVALS QUEUE ═══════════════ */}
      {activeTab === 'approvals' && (
        <div className="glass-card">
          <h3 className="section-title">
            <UserCheck size={18} color="#f59e0b" /> Pending Human Approvals Queue
          </h3>
          <p className="section-desc">
            Purchases flagged by Agent 2 as exceeding soft caps or triggering review rules require compliance sign-off.
          </p>

          {pendingApprovals.length === 0 ? (
            <div className="empty-state small">
              <ShieldAlert size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <p>No pending approvals currently in queue.</p>
            </div>
          ) : (
            <div className="approval-list">
              {pendingApprovals.map((item) => (
                <div key={item.id} className="approval-item">
                  <div className="approval-header">
                    <span
                      className={`badge badge-${
                        item.status === 'PENDING_HUMAN_APPROVAL'
                          ? 'escalate'
                          : item.status === 'APPROVED_BY_HUMAN'
                          ? 'allow'
                          : 'block'
                      }`}
                    >
                      {item.status === 'PENDING_HUMAN_APPROVAL'
                        ? 'Awaiting Review'
                        : item.status === 'APPROVED_BY_HUMAN'
                        ? 'Approved'
                        : 'Denied'}
                    </span>
                    <span className="approval-time">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="approval-body">
                    <p className="approval-goal">"{item.request?.goalText}"</p>
                    <div className="approval-details">
                      <span>Supplier: {item.request?.vendorName}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 700 }}>₹{item.request?.totalAmount?.toLocaleString()} INR</span>
                    </div>
                    <p className="approval-reason">{item.verdict?.overallReason}</p>
                  </div>

                  {item.status === 'PENDING_HUMAN_APPROVAL' ? (
                    <div className="approval-actions">
                      <button onClick={() => handleDecideApproval(item.id, 'APPROVE')} className="btn-success">
                        <CheckCircle size={15} /> Approve & Dispatch Payment
                      </button>
                      <button onClick={() => handleDecideApproval(item.id, 'DENY')} className="btn-danger">
                        <XCircle size={15} /> Deny Purchase
                      </button>
                    </div>
                  ) : (
                    <div className="approval-resolved">
                      Resolved {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ''} — {item.reviewerNote}
                      {item.paymentResult && (
                        <span style={{ color: 'var(--status-allow)', marginLeft: '0.5rem' }}>
                          Razorpay Order: <code>{item.paymentResult.orderId}</code>
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

      {/* ═══════════════ TAB 5: AUDIT LOGS ═══════════════ */}
      {activeTab === 'audit' && (
        <div className="glass-card">
          <h3 className="section-title">
            <FileText size={18} color="#06b6d4" /> Live Transaction Audit Trail
          </h3>
          <p className="section-desc">Immutable audit record of all dual-agent transactions and outcomes.</p>

          {auditLogs.length === 0 ? (
            <div className="empty-state small">
              <FileText size={32} color="var(--text-muted)" strokeWidth={1.5} />
              <p>No transactions yet.</p>
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
                    <th>Verdict Status</th>
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
                        <span
                          className={`badge badge-${
                            log.status === 'COMPLETED'
                              ? 'allow'
                              : log.status === 'REJECTED'
                              ? 'block'
                              : 'escalate'
                          }`}
                        >
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
