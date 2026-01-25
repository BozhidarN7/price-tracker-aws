import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { AIResult } from '../types/product.ts';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

export default async function parseWithBedrock(
  ocrText: string,
): Promise<AIResult> {
  const prompt = buildPrompt(ocrText);

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    }),
  );

  const raw = Buffer.from(response.body).toString('utf-8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Bedrock returned invalid JSON');
  }

  /**
   * Claude response format:
   * {
   *   "content": [
   *     { "type": "text", "text": "..." }
   *   ]
   * }
   */
  const outputText = parsed?.content?.[0]?.text;
  if (!outputText) {
    throw new Error('Claude did not return text output');
  }

  try {
    return extractJson(outputText);
  } catch {
    throw new Error('Model output was not valid JSON');
  }
}

const extractJson = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON detected');
  }
  return JSON.parse(text.slice(start, end + 1));
};

const buildPrompt = (ocrText: string): string => {
  return `
You are a data extraction system.

The input is OCR text from a supermarket receipt.
The text may contain irrelevant information such as totals, VAT, legal text, payment details, or random characters.
The receipt may be in Bulgarian or English.

Your task:
Extract ONLY purchased products and normalize their prices.

STRICT RULES (follow all):
- Extract ONLY real purchased products listed on the receipt
- Ignore totals, subtotals, VAT, discounts, loyalty info, card info, and legal text
- Do NOT guess or infer products that are not clearly present
- Do NOT invent missing values
- If a value is not explicitly present, return null
- Return STRICT JSON ONLY (no markdown, no comments, no explanations)

PRICE NORMALIZATION RULES:
- If a product is sold by weight (kg, g):
  - Convert the price to price per 1 kilogram (kg)
- If a product is sold by volume (l, ml):
  - Convert the price to price per 1 liter (l)
- If a product is sold per unit:
  - Return the price for exactly ONE unit
- If multiple units are purchased together (e.g. "2 avocados for 2.00"):
  - Divide the total price by the quantity
  - Return the price for ONE unit
- If the unit or quantity cannot be confidently determined:
  - Do NOT calculate
  - Return the price as null

CURRENCY RULES:
- Use currency ONLY if explicitly present in the text
- If currency is not explicit, return null

CATEGORY RULES:
- Each product MUST be assigned exactly ONE category
- Choose the closest matching category from the list below
- If no category clearly matches, use "Other"

ALLOWED CATEGORIES:
- Groceries
- Beverages
- Dairy
- Snacks
- Dining & Takeaway
- Household
- Cleaning Supplies
- Personal Care
- Health & Pharmacy
- Electronics
- Appliances
- Clothing & Accessories
- Transport
- Fuel
- Entertainment
- Subscriptions
- Pets
- Baby & Kids
- Home & Garden
- Office & Stationery
- Gifts
- Other

OUTPUT SCHEMA (STRICT):
{
  "store": string | null,
  "currency": "BGN" | "EUR" | null,
  "purchaseDate": string | null,
  "products": [
    {
      "name": string,
      "brand": string | null,
      "category": string,
      "price": number | null,
      "unit": "kg" | "l" | "unit" | null
    }
  ]
}

OCR TEXT:
"""
${ocrText}
"""
`;
};
