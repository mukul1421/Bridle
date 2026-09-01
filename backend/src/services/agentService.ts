import { GoogleGenerativeAI } from '@google/generative-ai';
import { TransactionRequest } from '../types/policy';
import { searchCatalog, CATALOG_DATABASE, CatalogItem } from './catalogService';

export interface LLMAgentPlan {
  parsedGoal: string;
  detectedCategory: 'snacks' | 'office_supplies' | 'cloud_infrastructure';
  detectedBudgetLimit: number | null;
  selectedVendorId: string;
  selectedVendorName: string;
  selectedItem: CatalogItem;
  quantity: number;
  totalAmount: number;
  reasoning: string;
  transactionRequest: TransactionRequest;
  provider: 'LIVE_GEMINI_API' | 'LOCAL_LLM_SIMULATOR';
}

const getGeminiClient = (() => {
  let client: GoogleGenerativeAI | null = null;
  let initialized = false;

  return (): GoogleGenerativeAI | null => {
    if (initialized) return client;
    initialized = true;

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_gemini_api')) {
      try {
        client = new GoogleGenerativeAI(apiKey);
        console.log('[AgentService] ✅ Live Google Gemini API initialized successfully');
      } catch (err: any) {
        console.warn('[AgentService] Failed to initialize GoogleGenerativeAI:', err.message);
      }
    } else {
      console.log('[AgentService] No valid GEMINI_API_KEY found — using local reasoning fallback');
    }
    return client;
  };
})();

/**
 * Live Google Gemini LLM API Call
 */
async function callLiveGeminiLLM(
  goalText: string,
  merchantId: string
): Promise<LLMAgentPlan | null> {
  const genAI = getGeminiClient();
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
You are Bridle's Autonomous Purchasing Agent for merchant "${merchantId}".
Your job is to analyze the merchant's plain-language spending goal, search the available inventory catalog below, choose the best supplier and items, calculate prices and quantities, and produce a structured purchase request.

Merchant Goal: "${goalText}"

Available Vendor Inventory Catalog:
${JSON.stringify(CATALOG_DATABASE, null, 2)}

Instructions:
1. Identify the requested items, quantities, and target budget from the merchant goal.
2. Select the matching product and vendor from the catalog.
3. Calculate unit price * quantity = totalAmount.
4. Provide a clear step-by-step reasoning string explaining your choice.
5. Return JSON strictly matching this schema:
{
  "parsedGoal": "${goalText}",
  "detectedCategory": "snacks" | "office_supplies" | "cloud_infrastructure",
  "detectedBudgetLimit": number or null,
  "selectedVendorId": "vendor_id_string",
  "selectedVendorName": "vendor_name_string",
  "itemName": "item_name_string",
  "quantity": number,
  "unitPrice": number,
  "totalAmount": number,
  "reasoning": "Step-by-step reasoning explaining item selection and price optimization"
}
`;

    const response = await model.generateContent(prompt);
    const textResult = response.response.text();
    const parsed = JSON.parse(textResult);

    const catalogMatch =
      CATALOG_DATABASE.find((i) => i.vendorId === parsed.selectedVendorId) ||
      CATALOG_DATABASE.find((i) => i.name.toLowerCase().includes(parsed.itemName?.toLowerCase())) ||
      CATALOG_DATABASE[0];

    const transactionRequest: TransactionRequest = {
      requestId: `tx_agent_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      merchantId,
      goalText,
      vendorId: parsed.selectedVendorId || catalogMatch.vendorId,
      vendorName: parsed.selectedVendorName || catalogMatch.vendorName,
      category: parsed.detectedCategory || catalogMatch.category,
      items: [
        {
          name: parsed.itemName || catalogMatch.name,
          quantity: parsed.quantity || 1,
          unitPrice: parsed.unitPrice || catalogMatch.unitPrice,
        },
      ],
      totalAmount: parsed.totalAmount || (parsed.unitPrice || catalogMatch.unitPrice) * (parsed.quantity || 1),
      currency: 'INR',
      agentReasoning: `[LIVE Gemini 3.5 Flash API] ${parsed.reasoning || 'Extracted goal intent and selected catalog item autonomously.'}`,
      timestamp: new Date().toISOString(),
    };

    return {
      parsedGoal: goalText,
      detectedCategory: parsed.detectedCategory || catalogMatch.category,
      detectedBudgetLimit: parsed.detectedBudgetLimit || null,
      selectedVendorId: parsed.selectedVendorId || catalogMatch.vendorId,
      selectedVendorName: parsed.selectedVendorName || catalogMatch.vendorName,
      selectedItem: catalogMatch,
      quantity: parsed.quantity || 1,
      totalAmount: transactionRequest.totalAmount,
      reasoning: `[LIVE Gemini 3.5 Flash LLM API] ${parsed.reasoning}`,
      transactionRequest,
      provider: 'LIVE_GEMINI_API',
    };
  } catch (err: any) {
    console.warn('[AgentService] Live Gemini API call error, using local fallback:', err.message);
    return null;
  }
}

/**
 * Autonomous LLM Purchasing Agent Reasoning Engine
 * Parses natural language merchant goals, queries vendor catalog,
 * optimizes item selection, and produces structured purchase requests.
 */
export async function planAndGeneratePurchaseRequest(
  goalText: string,
  merchantId = 'acme_corp'
): Promise<LLMAgentPlan> {
  // 1. Try Live Gemini API call if key is present
  const liveResult = await callLiveGeminiLLM(goalText, merchantId);
  if (liveResult) {
    return liveResult;
  }

  // 2. Intelligent Fallback Reasoning Engine
  const normalizedGoal = goalText.toLowerCase();

  let budgetLimit: number | null = null;
  const budgetMatch = normalizedGoal.match(/(?:under|below|max|budget|limit|cap|₹|\$)\s*(\d+)/i);
  if (budgetMatch) {
    budgetLimit = parseInt(budgetMatch[1], 10);
  } else {
    const numberMatches = normalizedGoal.match(/\b\d{4,6}\b/g);
    if (numberMatches && numberMatches.length > 0) {
      budgetLimit = parseInt(numberMatches[numberMatches.length - 1], 10);
    }
  }

  let quantity = 1;
  const qtyMatch = normalizedGoal.match(/(\d+)\s*(?:boxes|reams|chairs|sets|packs|cans|items|units|x)?/i);
  if (qtyMatch) {
    const parsedQty = parseInt(qtyMatch[1], 10);
    if (parsedQty < 100) {
      quantity = parsedQty;
    }
  }

  let category: 'snacks' | 'office_supplies' | 'cloud_infrastructure' = 'snacks';
  let targetVendorIdFilter: string | null = null;

  if (
    normalizedGoal.includes('unapproved') ||
    normalizedGoal.includes('store 99') ||
    normalizedGoal.includes('refurbished') ||
    normalizedGoal.includes('hard drive')
  ) {
    category = 'cloud_infrastructure';
    targetVendorIdFilter = 'unapproved_store_99';
  } else if (
    normalizedGoal.includes('snack') ||
    normalizedGoal.includes('food') ||
    normalizedGoal.includes('beverage') ||
    normalizedGoal.includes('drink') ||
    normalizedGoal.includes('coffee')
  ) {
    category = 'snacks';
  } else if (
    normalizedGoal.includes('paper') ||
    normalizedGoal.includes('pen') ||
    normalizedGoal.includes('stationery') ||
    normalizedGoal.includes('chair') ||
    normalizedGoal.includes('toner') ||
    normalizedGoal.includes('desk') ||
    normalizedGoal.includes('office')
  ) {
    category = 'office_supplies';
  } else if (
    normalizedGoal.includes('cloud') ||
    normalizedGoal.includes('server') ||
    normalizedGoal.includes('compute') ||
    normalizedGoal.includes('database') ||
    normalizedGoal.includes('hosting')
  ) {
    category = 'cloud_infrastructure';
  } else {
    category = 'snacks';
  }

  let matchedItems = searchCatalog(normalizedGoal, category);
  if (targetVendorIdFilter) {
    matchedItems = CATALOG_DATABASE.filter((i) => i.vendorId === targetVendorIdFilter);
  }
  if (matchedItems.length === 0) {
    matchedItems = CATALOG_DATABASE.filter((i) => i.category === category);
  }

  const selectedItem = matchedItems[0] || CATALOG_DATABASE[0];
  let totalAmount = selectedItem.unitPrice * quantity;

  const reasoningLines = [
    `[LLM Intent Parser] Analyzed merchant goal: "${goalText}".`,
    `[Category Routing] Mapped intent to category '${category}'. Target budget limit: ${budgetLimit ? `₹${budgetLimit.toLocaleString()}` : 'None specified'}.`,
    `[Catalog Search] Queried vendor database for '${category}'. Selected item '${selectedItem.name}' from supplier '${selectedItem.vendorName}'.`,
    `[Order Optimization] Calculated line order: ${quantity} units x ₹${selectedItem.unitPrice.toLocaleString()} = ₹${totalAmount.toLocaleString()} INR.`,
    `[Structured Request Generator] Emitted validated TransactionRequest JSON payload for Policy Engine gate evaluation.`,
  ];

  const reasoning = reasoningLines.join(' ');

  const transactionRequest: TransactionRequest = {
    requestId: `tx_agent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    merchantId,
    goalText,
    vendorId: selectedItem.vendorId,
    vendorName: selectedItem.vendorName,
    category: selectedItem.category,
    items: [
      {
        name: selectedItem.name,
        quantity,
        unitPrice: selectedItem.unitPrice,
      },
    ],
    totalAmount,
    currency: selectedItem.currency || 'INR',
    agentReasoning: reasoning,
    timestamp: new Date().toISOString(),
  };

  return {
    parsedGoal: goalText,
    detectedCategory: category,
    detectedBudgetLimit: budgetLimit,
    selectedVendorId: selectedItem.vendorId,
    selectedVendorName: selectedItem.vendorName,
    selectedItem,
    quantity,
    totalAmount,
    reasoning,
    transactionRequest,
    provider: 'LOCAL_LLM_SIMULATOR',
  };
}
