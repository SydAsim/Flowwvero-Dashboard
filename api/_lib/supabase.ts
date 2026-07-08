/**
 * _lib/supabase.ts
 * Shared Supabase client for Vercel serverless functions.
 * Uses the service_role key — only safe on the server side (Vercel functions).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] ⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY not set.');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ── Save leads to Supabase, skipping duplicates ──
export async function saveLeadsToSupabase(leads: any[]) {
  if (!supabase) return { saved: 0, skipped: 0 };
  let saved = 0, skipped = 0;

  for (const lead of leads) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('business_name', lead.businessName || '')
      .eq('address', lead.address || '')
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { error } = await supabase.from('leads').insert({
      business_name:   lead.businessName   || '',
      category:        lead.category        || '',
      address:         lead.address         || '',
      phone:           lead.phone           || '',
      website:         lead.website         || '',
      google_maps_url: lead.googleMapsUrl   || '',
      rating:          lead.rating          ?? null,
      review_count:    lead.reviewCount     ?? null,
      business_status: lead.businessStatus  || '',
      monday:          lead.monday          || '',
      tuesday:         lead.tuesday         || '',
      wednesday:       lead.wednesday       || '',
      thursday:        lead.thursday        || '',
      friday:          lead.friday          || '',
      saturday:        lead.saturday        || '',
      sunday:          lead.sunday          || '',
      status:          lead.status          || 'New',
      search_query:    lead.searchQuery     || '',
      pakistan_time:   lead.pakistanTime    || '',
      usa_time:        lead.usaTime         || '',
      fetched_at:      lead.fetchedAt       || new Date().toISOString(),
    });

    if (error) console.error(`[Supabase] ❌ Insert error for "${lead.businessName}":`, error.message);
    else saved++;
  }

  return { saved, skipped };
}

// ── Get leads with pagination ──
export async function getLeadsFromSupabase({ page = 1, limit = 50, search = '' } = {}) {
  if (!supabase) return { leads: [], total: 0 };

  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) query = query.ilike('business_name', `%${search}%`);

  const { data, error, count } = await query;
  if (error) { console.error('[Supabase] ❌ Read error:', error.message); return { leads: [], total: 0 }; }

  const leads = (data || []).map((lead: any) => ({
    rowId:          lead.id,
    businessName:   lead.business_name,
    category:       lead.category,
    address:        lead.address,
    phone:          lead.phone,
    website:        lead.website,
    googleMapsUrl:  lead.google_maps_url,
    rating:         lead.rating,
    reviewCount:    lead.review_count,
    businessStatus: lead.business_status,
    monday:         lead.monday,
    tuesday:        lead.tuesday,
    wednesday:      lead.wednesday,
    thursday:       lead.thursday,
    friday:         lead.friday,
    saturday:       lead.saturday,
    sunday:         lead.sunday,
    status:         lead.status,
    searchQuery:    lead.search_query,
    pakistanTime:   lead.pakistan_time,
    usaTime:        lead.usa_time,
    fetchedAt:      lead.fetched_at,
    adminScript:    lead.admin_script,
    managerScript:  lead.manager_script,
    notes:          lead.notes,
    followUpDate:   lead.follow_up_date,
    aiReport:       lead.ai_report,
    timestamp:      lead.created_at,
  }));

  return { leads, total: count || 0 };
}

// ── Update lead scripts by business name ──
export async function updateLeadScripts(businessName: string, adminScript: string, managerScript: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('leads')
    .update({ admin_script: adminScript, manager_script: managerScript })
    .eq('business_name', businessName);
  if (error) console.error(`[Supabase] ❌ Script update error:`, error.message);
}

// ── Update lead details by Supabase ID ──
export async function updateLeadDetailsInSupabase(id: number, updates: { status?: string; notes?: string; followUpDate?: string; aiReport?: string }) {
  if (!supabase) return false;

  const updateData: Record<string, any> = {};
  if (updates.status !== undefined)      updateData.status        = updates.status;
  if (updates.notes !== undefined)       updateData.notes         = updates.notes;
  if (updates.followUpDate !== undefined) updateData.follow_up_date = updates.followUpDate;
  if (updates.aiReport !== undefined)    updateData.ai_report     = updates.aiReport;

  const { error } = await supabase.from('leads').update(updateData).eq('id', id);
  if (error) { console.error(`[Supabase] ❌ Details update error for ID ${id}:`, error.message); return false; }
  return true;
}
