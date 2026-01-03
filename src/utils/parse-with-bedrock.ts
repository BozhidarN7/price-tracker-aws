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
You are a system that extracts structured data from OCR text.

The input text comes from a supermarket receipt.
The text may contain:
- totals
- VAT
- card payment info
- legal text
- random characters
- Bulgarian or English language

Your task:
Extract ONLY purchased products.

Rules:
- Ignore totals, subtotals, VAT, discounts
- Ignore receipt metadata
- Do NOT guess missing values
- Do NOT invent products
- Prices must be numeric
- Currency must be inferred only if explicitly present

Return STRICT JSON ONLY.
Do not include explanations.
Do not include markdown.
Do not include comments.

Schema:
{
  "store": string | null,
  "currency": "BGN" | "EUR" | null,
  "purchaseDate": string | null,
  "products": [
    {
      "name": string,
      "brand": string | null,
      "price": number
    }
  ]
}

OCR TEXT:
"""
${ocrText}
"""
`;
};
