import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, CreditCard, Activity, CheckCircle } from 'lucide-react';

interface SystemHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: SystemHealth) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch backend health:', err);
        setError('Backend server offline (run npm run dev in backend/)');
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      {/* Header Bar */}
      <header className="header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <ShieldCheck size={28} color="#3b82f6" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Agent Trust Layer
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Policy Governance & Decision Audit Proxy for LLM Purchasing Agents
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="logo-badge">Razorpay AI Buildathon</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span className="status-dot" style={{ backgroundColor: error ? 'var(--status-block)' : 'var(--status-allow)' }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {loading ? 'Checking Engine...' : error ? 'Backend Offline' : 'Policy Engine Active'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Card 1: Core Engine Status */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color="#3b82f6" /> Backend Core Status
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 600 }}>Day 1 Scaffold</span>
          </div>
          
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Connecting to backend...</p>
          ) : error ? (
            <div style={{ color: 'var(--status-block)', fontSize: '0.9rem' }}>{error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
              <div><strong>Service:</strong> {health?.service}</div>
              <div><strong>Version:</strong> v{health?.version}</div>
              <div><strong>Status:</strong> <span style={{ color: 'var(--status-allow)' }}>Online</span></div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Last Health Ping: {health?.timestamp}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Active Rules Configured */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#10b981" /> Active Policy Rules
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600 }}>4 Schemas Defined</span>
          </div>
          
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} color="#10b981" /> <strong>Spend Cap:</strong> Max ₹15,000 / txn
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} color="#10b981" /> <strong>Vendor Allowlist:</strong> Verified suppliers only
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} color="#10b981" /> <strong>Category Limit:</strong> Category allocations
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} color="#10b981" /> <strong>Rolling Total:</strong> 24h budget ceilings
            </li>
          </ul>
        </div>

        {/* Card 3: Razorpay Integration Gate */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="#f59e0b" /> Payment Gate
            </h3>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>Razorpay Test Mode</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Only transaction requests achieving an <strong>ALLOW</strong> policy verdict will be dispatched to Razorpay's test APIs.
          </p>
        </div>
      </div>

      {/* Banner info */}
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.1) 100%)', borderColor: 'rgba(59,130,246,0.3)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Activity size={20} color="#3b82f6" /> Day 1 Build Target Accomplished
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Project repository scaffolded with Node.js/Express TypeScript backend, React/Vite dashboard frontend, and comprehensive policy rule schema definitions. Ready for Day 2 Policy Evaluator implementation!
        </p>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>📄 Architecture Blueprint: <code>docs/ARCHITECTURE.md</code></span>
          <span>⚙️ Rule Schema Types: <code>backend/src/types/policy.ts</code></span>
        </div>
      </div>
    </div>
  );
};
