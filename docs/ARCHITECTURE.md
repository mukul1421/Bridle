# Architecture Specification — Agent Trust Layer

## 1. Executive Design & Core Concepts

The **Agent Trust Layer** is designed as a zero-trust policy engine wrapper around autonomous LLM agents executing payments.

### 1.1 The Policy Evaluation Pipeline
```
[ Incoming Purchase Request ]
            │
            ▼
 ┌──────────────────────┐
 │ 1. Schema Validation │ ── (Invalid format) ──> [ REJECT (400) ]
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 2. Vendor Allowlist  │ ── (Unlisted vendor) ──> [ BLOCK ]
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 3. Per-Transaction   │ ── (> Hard Cap) ───────> [ BLOCK ]
 │    Spend Cap         │ ── (> Soft Cap) ───────> [ ESCALATE ]
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 4. Category Limits   │ ── (> Allocation) ─────> [ BLOCK ]
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ 5. Rolling Daily/    │ ── (Exceeds 24h cap) ──> [ ESCALATE / BLOCK ]
 │    Weekly Totals     │
 └──────────┬───────────┘
            │
            ▼
       [  ALLOW  ] ───> Dispatches to Razorpay API
```

---

## 2. Policy Engine Schema Design

The policy engine operates on standard JSON rule objects stored per merchant account.

### 2.1 Rule Data Schema Definitions

#### A. Per-Transaction Spend Cap Rule (`SPEND_CAP`)
```json
{
  "id": "rule_spend_cap_01",
  "type": "SPEND_CAP",
  "enabled": true,
  "maxAmountPerTransaction": 15000,
  "softCapEscalateThreshold": 10000,
  "currency": "INR"
}
```

#### B. Vendor Allowlist Rule (`VENDOR_ALLOWLIST`)
```json
{
  "id": "rule_vendor_allowlist_01",
  "type": "VENDOR_ALLOWLIST",
  "enabled": true,
  "allowedVendors": [
    "snack_house_pvt_ltd",
    "cloud_services_inc",
    "office_supplies_co",
    "fresh_stationery_hub"
  ],
  "blockUnlistedVendors": true
}
```

#### C. Category Spend Limit Rule (`CATEGORY_LIMIT`)
```json
{
  "id": "rule_category_limit_01",
  "type": "CATEGORY_LIMIT",
  "enabled": true,
  "categoryCaps": {
    "snacks_and_beverages": 10000,
    "office_supplies": 20000,
    "cloud_infrastructure": 50000
  }
}
```

#### D. Rolling Window Limit Rule (`ROLLING_TOTAL`)
```json
{
  "id": "rule_rolling_total_01",
  "type": "ROLLING_TOTAL",
  "enabled": true,
  "windowHours": 24,
  "maxRollingAmount": 30000
}
```

---

## 3. Transaction & Evaluation Data Schema

### 3.1 Incoming Transaction Request
```json
{
  "requestId": "req_9812739182",
  "merchantId": "merch_demo_1",
  "goalText": "Restock office snacks for team under ₹10,000",
  "vendorId": "snack_house_pvt_ltd",
  "vendorName": "Snack House Pvt Ltd",
  "category": "snacks_and_beverages",
  "items": [
    { "name": "Mixed Nuts Box", "quantity": 10, "unitPrice": 400 },
    { "name": "Energy Bars (Pack of 12)", "quantity": 5, "unitPrice": 800 }
  ],
  "totalAmount": 8000,
  "currency": "INR",
  "agentReasoning": "Selected highest rated vendor for team snacks keeping total at ₹8,000.",
  "timestamp": "2026-08-24T22:10:00Z"
}
```

### 3.2 Policy Decision Verdict
```json
{
  "requestId": "req_9812739182",
  "verdict": "ALLOW", // "ALLOW" | "BLOCK" | "ESCALATE"
  "evaluatedRules": [
    {
      "ruleId": "rule_spend_cap_01",
      "passed": true,
      "reason": "Amount ₹8,000 is under max cap ₹15,000 and soft cap ₹10,000."
    },
    {
      "ruleId": "rule_vendor_allowlist_01",
      "passed": true,
      "reason": "Vendor 'snack_house_pvt_ltd' is in allowlist."
    }
  ],
  "overallReason": "All policy governance checks passed successfully.",
  "timestamp": "2026-08-24T22:10:01Z"
}
```

---

## 4. State Machine for Human Approval

```
[ Request Created ]
        │
        ├── Verdict: ALLOW ──> [ Executed via Razorpay ] ──> [ Status: COMPLETED ]
        │
        ├── Verdict: BLOCK ──> [ Logged in Audit Trail ] ──> [ Status: REJECTED ]
        │
        └── Verdict: ESCALATE ──> [ Placed in Pending Queue ]
                                       │
                                       ├── Admin Clicks Approve ──> [ Executed via Razorpay ]
                                       │
                                       └── Admin Clicks Deny ────> [ Status: DENIED_BY_HUMAN ]
```
