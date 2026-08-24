# Agent Trust Layer — Policy & Audit Engine for LLM Purchasing Agents

> **Razorpay AI Buildathon Submission**  
> *Governing autonomous AI spending with strict corporate policy rules, human approval escalations, and full decision audit trails.*

---

## 🚀 Overview

As autonomous LLM agents are entrusted with financial execution (purchasing inventory, paying cloud vendor bills, managing corporate SaaS subscriptions), giving them raw access to payment APIs creates severe risks: runaway spending loops, hallucinated orders, and prompt-injection vulnerabilities.

**Agent Trust Layer** is a lightweight, real-time security gate proxy that sits between an LLM Purchasing Agent and **Razorpay Payment APIs**. 

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│ Merchant Goal   │ ────> │  LLM Purchasing      │ ────> │  Agent Trust Layer   │ ────> │  Razorpay API   │
│ "Restock snacks │       │  Agent (v1)          │       │  Policy Evaluator    │       │  (Test Mode)    │
│  under ₹10k"    │       │ (Structured Request) │       │ (Caps, Allow lists)  │       │ (Order/Capture) │
└─────────────────┘       └──────────────────────┘       └──────────┬───────────┘       └─────────────────┘
                                                                    │
                                                           ┌────────┴────────┐
                                                           │ Decision Outcome│
                                                           ├─────────────────┤
                                                           │ ALLOW           │ ───> Executes Payment
                                                           │ BLOCK           │ ───> Logs Audit Reason
                                                           │ ESCALATE        │ ───> Human Approval Queue
                                                           └─────────────────┘
```

---

## ✨ Key Features

1. **Policy Governance Engine**:
   - **Spend Caps**: Per-transaction limits & daily rolling spend ceilings.
   - **Vendor Allowlist**: Restricts purchasing strictly to verified merchant suppliers.
   - **Category Limits**: Controls maximum allocations per expense category (e.g. Snacks, Cloud, Supplies).
   - **Concurrency-Safe Rolling Totals**: Prevents race conditions from draining budgets.
2. **Deterministic Evaluation**: Every request yields `ALLOW`, `BLOCK`, or `ESCALATE`, along with a transparent human-readable reason string.
3. **Razorpay Test-Mode Integration**: Gatekeeper proxy that only dispatches approved transactions to Razorpay's order and payment capture APIs.
4. **Human Approval Workflow**: Holds suspicious or high-value requests in a pending queue for 1-click admin approval or denial.
5. **Full Audit Trail**: Stores complete context for every decision (merchant goal, agent reasoning, policy rules evaluated, final verdict, timestamp).
6. **Live Dashboard**: React dashboard featuring real-time transaction feeds, spend analytics, and active pending queues.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TypeScript, Zod, Razorpay Node SDK
- **Frontend**: React, Vite, TypeScript, Vanilla CSS (Modern Dark/Light Glassmorphism)
- **Testing**: Vitest (Unit tests for policy evaluation engine)
- **Deployment**: Backend (Render / Railway), Frontend (Vercel / Netlify)

---

## 📅 12-Day Build Roadmap

- [x] **Day 1 (Mon 24 Aug)**: Project scaffold, architecture blueprint & rule schema definition
- [ ] **Day 2 (Tue 25 Aug)**: Policy engine data model, core evaluator & 10 unit test cases
- [ ] **Day 3 (Wed 26 Aug)**: Policy engine hardening: rolling totals, concurrency safety & reason generation
- [ ] **Day 4 (Thu 27 Aug)**: Razorpay test-mode integration gated behind policy evaluation
- [ ] **Day 5 (Fri 28 Aug)**: LLM purchasing agent v1 (Goal to structured purchase request)
- [ ] **Day 6 (Sat 29 Aug)**: First live deployment & end-to-end loop wiring
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
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in `backend/`:
```bash
PORT=5000
RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxx
```

### 3. Run Development Servers
```bash
# Start backend API (http://localhost:5000)
cd backend && npm run dev

# Start frontend UI (http://localhost:5173)
cd frontend && npm run dev
```
