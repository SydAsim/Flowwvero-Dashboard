/**
 * api/update-status.ts — POST /api/update-status
 * Vercel Serverless Function: updates a lead's status/notes/followUpDate/aiReport in Supabase
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateLeadDetailsInSupabase } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { rowId, status, notes, followUpDate, aiReport } = req.body;

  if (!rowId) {
    return res.status(400).json({ success: false, message: 'rowId is required.' });
  }

  try {
    const success = await updateLeadDetailsInSupabase(rowId, { status, notes, followUpDate, aiReport });
    if (success) {
      return res.status(200).json({ success: true, message: 'Details updated successfully.' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to update in Supabase.' });
    }
  } catch (err: any) {
    console.error('[API /update-status] ❌ Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
