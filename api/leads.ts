/**
 * api/leads.ts — GET /api/leads
 * Vercel Serverless Function: reads all leads from Supabase
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLeadsFromSupabase } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const page   = parseInt(req.query.page  as string, 10) || 1;
  const limit  = parseInt(req.query.limit as string, 10) || 1000;
  const search = ((req.query.search as string) || '').trim();

  try {
    const { leads, total } = await getLeadsFromSupabase({ page, limit, search });
    return res.status(200).json({ success: true, leads, total, page, limit });
  } catch (err: any) {
    console.error('[API /leads] ❌ Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
