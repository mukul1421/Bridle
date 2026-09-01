# Bridle — Autonomous LLM Purchasing Agent & Policy Governance Engine

> **Razorpay AI Buildathon Submission**  
> *Bridle: An intelligent dual-system combining an Autonomous LLM Purchasing Agent with a strict Financial Policy Governance & Audit Engine for Razorpay payments.*

---

## 🚀 Overview

As business operations automate, merchants need AI agents capable of autonomously procuring inventory, renewing SaaS subscriptions, and managing vendor disbursements. However, giving an LLM unconstrained access to payment channels creates massive financial risks (runaway loops, overspending, vendor scams, prompt injection attacks).

**Bridle** solves this by building a unified 2-part architecture:
1. **Autonomous LLM Purchasing Agent**: Interprets plain-language merchant goals, analyzes vendor catalogs/inventories, calculates item quantities & costs, and formulates optimal structured purchase requests.
2. **Policy Governance Engine (Trust Layer)**: Intercepts every agent purchase request and evaluates it against strict corporate spending policies before executing payments through **Razorpay Test-Mode APIs**.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             BRIDLE SYSTEM                                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│  ┌──────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────┐  │
│  │ Merchant Goal Input  │ ─────> │ 1. LLM Purchasing Agent      │ ─────> │ Structured Purchase Req │  │
│  │ "Restock snacks      │        │    - Catalog Reasoning       │        │  { vendor, items,        │  │
│  │  under ₹10,000"      │        │    - Price & Quantity Planner│        │    total: ₹8,000 }       │  │
│  └──────────────────────┘        └──────────────────────────────┘        └────────────┬─────────────┘  │
│                                                                                       │                │
│                                                                                       ▼                │
│  ┌──────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────┐  │
│  │ Razorpay API         │ <───── │  ALLOW                       │ <───── │ 2. Policy Governance     │  │
│  │ (Test Mode Payment)  │        ├──────────────────────────────┤        │    Engine                │  │
│  └──────────────────────┘        │  BLOCK ──> Audit Reason      │        │    - Spend Caps          │  │
│                                  ├──────────────────────────────┤        │    - Vendor Allowlist    │  │
│                                  │  ESCALATE ──> Human Approval │        │    - Category Allocations│  │
│                                  └──────────────────────────────┘        │    - 24h Rolling Ceilings │  │
│                                                                          └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key System Pillars

### Pillar 1: Autonomous LLM Purchasing Agent
- **Natural Language Goal Understanding**: Takes vague human requests like *"Restock 20 packs of coffee and tea for office under ₹5,000"*.
- **Inventory & Catalog Reasoning**: Queries available vendor stock, compares prices, and balances quality vs budget constraints.
- **Structured Request Formulation**: Outputs deterministic JSON purchase payloads ready for financial evaluation.

### Pillar 2: Policy & Governance Engine (Trust Layer)
- **Spend Caps**: Hard transaction caps & soft cap escalation thresholds.
- **Vendor Allowlist**: Restricts purchasing strictly to verified merchant suppliers.
- **Category Allocations**: Controls maximum limits per expense category (e.g. Snacks, IT Equipment, Supplies).
- **Concurrency-Safe Rolling Totals**: 24-hour rolling budget ceilings to prevent race conditions.
- **Deterministic Outcomes**:
  - `ALLOW`: Dispatches order directly to Razorpay.
  - `BLOCK`: Immediately rejects with a plain-language explanation.
  - `ESCALATE`: Routes to Human Approval Queue for manual admin review.

### Integrated Features
- **Razorpay Test-Mode Integration**: Gatekeeper proxy ensuring only policy-cleared transactions execute payments.
- **Audit Trail & Decision Transparency**: Stores complete decision context (merchant goal, agent rationale, policy checks, final verdict).
- **Real-Time Governance Dashboard**: React UI featuring live transaction feeds, approval cards, and financial analytics.

---

## 🛠️ Tech Stack

- **LLM Agent**: OpenAI / Gemini Structured Outputs, Prompt Engineering, Inventory Datasets
- **Backend API**: Node.js, Express, TypeScript, Zod, Razorpay Node SDK
- **Frontend UI**: React, Vite, TypeScript, Vanilla CSS (Modern Dark/Light Glassmorphic Design)
- **Testing**: Vitest (Unit tests for Policy Evaluator & Agent JSON outputs)
- **Deployment**: Backend (Render / Railway), Frontend (Vercel / Netlify)

---

## 📅 12-Day Build Roadmap

- [x] **Day 1 (Mon 24 Aug)**: Project scaffold, dual architecture blueprint & rule schema definition
- [ ] **Day 2 (Tue 25 Aug)**: Policy engine data model, core evaluator & 10 unit test cases
- [ ] **Day 3 (Wed 26 Aug)**: Policy engine hardening: rolling totals, concurrency safety & reason generation
- [ ] **Day 4 (Thu 27 Aug)**: Razorpay test-mode integration gated behind policy evaluation
- [ ] **Day 5 (Fri 28 Aug)**: LLM purchasing agent v1 (Goal to structured purchase request)
- [ ] **Day 6 (Sat 29 Aug)**: Full loop wiring (Goal -> LLM Agent -> Policy Engine -> Razorpay) & First Live Deploy
- [ ] **Day 7 (Sun 30 Aug)**: Audit trail & decision logging API
- [ ] **Day 8 (Mon 31 Aug)**: Human approval workflow (pending queue & approve/deny actions)
- [ ] **Day 9 (Tue 01 Sep)**: Dashboard UI (stats bar, live feed, approval cards)
- [ ] **Day 10 (Wed 02 Sep)**: Integration testing & adversarial attack simulation
- [ ] **Day 11 (Thu 03 Sep)**: Repository polish, documentation & architecture diagrams
- [ ] **Day 12 (Fri 04 Sep)**: Final pitch rehearsal & submission

---

## 🚦 Quick Start (Local Development)

### 1. Clone & Install
```bash
# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in `backend/`:
```bash
PORT=5000
RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxx
LLM_API_KEY=your_gemini_or_openai_api_key
```

### 3. Run Development Servers
```bash
# Backend API (http://localhost:5000)
cd backend && npm run dev

# Frontend UI (http://localhost:5173)
cd frontend && npm run dev
```
