/**
 * api/generate-report.ts — POST /api/generate-report
 * Vercel Serverless Function: generates AI meeting notes/report.
 * Tries Google AI Studio (Gemini Flash) first, falls back to OpenRouter.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildReportPrompt(businessName: string, category: string, notes: string) {
  return `You are an expert sales assistant and consultant.
Analyze these raw call notes for a ${category} named "${businessName}".
Create a professional Meeting Report containing exactly these sections:

1. Executive Summary
2. Key Pain Points
3. Buying Intent Level (High, Medium, or Low)
4. Recommended Next Steps

Keep it concise, professional, and actionable.

RAW CALL NOTES:
"${notes}"

Return ONLY the report text. Do not use JSON or extra conversational filler. Use clear headings for the sections.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { businessName, category, notes, rowId } = req.body;

  if (!businessName || !notes || !rowId) {
    return res.status(400).json({ success: false, message: 'businessName, notes, and rowId are required.' });
  }

  const prompt = buildReportPrompt(businessName, category || 'business', notes);

  // ── 1. Try Google AI Studio (Gemini Flash 2.0) first ──
  const googleAiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (googleAiKey) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleAiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const reportText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (reportText) {
          return res.status(200).json({ success: true, aiReport: reportText });
        }
      }
    } catch (err: any) {
      console.warn('[API /generate-report] ⚠️ Gemini error:', err.message);
    }
  }

  // ── 2. Fallback to OpenRouter ──
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return res.status(500).json({ success: false, message: 'No AI API keys configured.' });
  }

  const modelsToTry = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'openrouter/auto',
  ];

  let reportText = '';
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
          temperature: 0.5,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error (${response.status}): ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      let rawText = data.choices?.[0]?.message?.content?.trim() || '';
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (rawText) { reportText = rawText; break; }
      else throw new Error('Empty response');

    } catch (err: any) {
      lastError = err;
    }
  }

  if (!reportText) {
    return res.status(500).json({ success: false, message: lastError?.message || 'All AI models failed.' });
  }

  return res.status(200).json({ success: true, aiReport: reportText });
}
