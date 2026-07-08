/**
 * api/generate-script.ts — POST /api/generate-script
 * Vercel Serverless Function: generates AI cold-call scripts via OpenRouter
 * and saves them back to Supabase.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateLeadScripts } from './_lib/supabase';

function buildScriptPrompt(businessName: string, category: string, address: string, product: string) {
  return `You are an elite B2B cold calling expert with 15+ years of experience in sales training.

Generate TWO professional cold calling scripts for the following lead:
- Business Name: ${businessName}
- Business Type/Niche: ${category}
- Location: ${address}
- Product Being Sold: ${product}

IMPORTANT INSTRUCTIONS:
1. Adapt the pitch specifically to the "${category}" industry — use their pain points, terminology, and challenges.
2. Keep scripts concise, natural, and conversational — not robotic.
3. Use proven sales frameworks.

---

SCRIPT 1 — ADMIN / RECEPTIONIST / GATEKEEPER SCRIPT:
- Goal: Get transferred to the decision maker. Do NOT pitch the product here.
- Framework: Pattern Interrupt → Build Rapport → Authority Statement → Transfer Request
- Tone: Warm, confident, professional
- Length: 6-8 lines max
- Include a line for handling the "what's it about?" objection

SCRIPT 2 — MANAGER / OWNER / DECISION MAKER SCRIPT:
- Goal: Qualify, identify pain, and book a demo/callback
- Framework: SPIN Selling (Situation → Problem → Implication → Need-payoff)
- Tone: Consultative, expert, not pushy
- Length: 12-16 lines
- Include ONE common objection handler ("we're not interested" or "we already have a solution")
- End with a clear call-to-action (schedule a 15-min call)

---

Return your response in this EXACT JSON format with no markdown, no code blocks, just raw JSON:
{
  "adminScript": "[full script here with line breaks as \\n]",
  "managerScript": "[full script here with line breaks as \\n]"
}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { businessName, category, address } = req.body;
  const product = process.env.YOUR_PRODUCT || 'Workflow Automation Software';

  if (!businessName) {
    return res.status(400).json({ success: false, message: 'businessName is required.' });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return res.status(500).json({ success: false, message: 'OPENROUTER_API_KEY is not configured.' });
  }

  const prompt = buildScriptPrompt(
    businessName || 'Unknown Business',
    category     || 'Healthcare',
    address      || 'USA',
    product,
  );

  const modelsToTry = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'openrouter/auto',
  ];

  let rawText = '';
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://flowvero.vercel.app',
          'X-Title': 'Flowvero Lead Fetcher',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      let text = data.choices?.[0]?.message?.content?.trim() || '';
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (text) { rawText = text; break; }
      else throw new Error('Empty response');

    } catch (err: any) {
      lastError = err;
    }
  }

  if (!rawText) {
    return res.status(500).json({ success: false, message: lastError?.message || 'All AI models failed.' });
  }

  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let scripts: any;
  try {
    scripts = JSON.parse(jsonText);
  } catch {
    return res.status(500).json({ success: false, message: 'AI returned an unexpected format. Please try again.' });
  }

  if (!scripts.adminScript || !scripts.managerScript) {
    return res.status(500).json({ success: false, message: 'AI did not return both scripts. Please try again.' });
  }

  await updateLeadScripts(businessName, scripts.adminScript, scripts.managerScript);

  return res.status(200).json({
    success: true,
    businessName,
    category,
    product,
    adminScript:   scripts.adminScript,
    managerScript: scripts.managerScript,
  });
}
