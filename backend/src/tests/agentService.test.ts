import { describe, it, expect } from 'vitest';
import { planAndGeneratePurchaseRequest } from '../services/agentService';
import { searchCatalog } from '../services/catalogService';

describe('Autonomous LLM Purchasing Agent — Day 5 Tests', () => {
  it('1. should search catalog by keywords correctly', () => {
    const snackItems = searchCatalog('snack', 'snacks');
    expect(snackItems.length).toBeGreaterThan(0);
    expect(snackItems[0].vendorId).toBe('snack_house_pvt_ltd');

    const paperItems = searchCatalog('paper', 'office_supplies');
    expect(paperItems.length).toBeGreaterThan(0);
    expect(paperItems[0].vendorId).toBe('office_supplies_co');
  });

  it('2. should parse natural language goal and formulate structured purchase request for snacks', async () => {
    const goal = 'Restock 5 boxes of office snacks under 10000';
    const plan = await planAndGeneratePurchaseRequest(goal, 'acme_corp');

    expect(plan.detectedCategory).toBe('snacks');
    expect(plan.quantity).toBe(5);
    expect(plan.selectedVendorId).toBe('snack_house_pvt_ltd');
    expect(plan.totalAmount).toBe(5000); // 5 x 1000

    const req = plan.transactionRequest;
    expect(req.goalText).toBe(goal);
    expect(req.vendorId).toBe('snack_house_pvt_ltd');
    expect(req.category).toBe('snacks');
    expect(req.items[0].quantity).toBe(5);
    expect(req.totalAmount).toBe(5000);
    expect(req.agentReasoning).toContain('[LLM Intent Parser]');
  });

  it('3. should parse stationery goals and route to office supplies vendor', async () => {
    const goal = 'Order 5 A4 paper reams under 8000';
    const plan = await planAndGeneratePurchaseRequest(goal, 'acme_corp');

    expect(plan.detectedCategory).toBe('office_supplies');
    expect(plan.quantity).toBe(5);
    expect(plan.selectedVendorId).toBe('office_supplies_co');
    expect(plan.totalAmount).toBe(6000); // 5 x 1200
  });

  it('4. should identify unapproved tech vendor from natural language goal', async () => {
    const goal = 'Purchase 1 refurbished hard drive from unapproved store';
    const plan = await planAndGeneratePurchaseRequest(goal, 'acme_corp');

    expect(plan.selectedVendorId).toBe('unapproved_store_99');
    expect(plan.transactionRequest.vendorName).toBe('Unapproved Tech Store 99');
  });
});
