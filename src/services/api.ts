import type { Lead } from '../types/lead';

export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  REFRESH_INTERVAL: 5000 // Fast polling (every 5 seconds)
};

// ── Service Layer Methods ──

/**
 * Fetch all leads from the Node.js Backend (which reads from Supabase).
 */
export async function fetchLeads(): Promise<{ leads: Lead[]; isLive: boolean; total: number }> {
  try {
    // Fetch up to 1000 leads by default so we get all records, not just the newest 50
    const response = await fetch(`${CONFIG.API_BASE_URL}/leads?limit=1000`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return { leads: data.leads || [], isLive: true, total: data.total || 0 };
  } catch (error) {
    console.error('Failed to fetch from backend API:', error);
    return { leads: [], isLive: false, total: 0 };
  }
}

/**
 * Update a lead's details (status, notes, followUpDate) via backend.
 */
export async function updateLeadDetails(rowId: number, updates: Partial<Lead>): Promise<boolean> {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, ...updates })
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('API updateLeadDetails error:', error);
    return false;
  }
}

/**
 * Generate AI Meeting Notes from raw call notes
 */
export async function generateLeadReport(businessName: string, category: string, notes: string, rowId: number): Promise<{ success: boolean; message?: string; aiReport?: string }> {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, category, notes, rowId })
    });
    return await response.json();
  } catch (error) {
    console.error('API generateLeadReport error:', error);
    return { success: false, message: 'Network error or server unreachable.' };
  }
}

/**
 * Scrape leads via the Node.js backend.
 */
export async function scrapeLeads(query: string, sheetId: string, maxResults: number): Promise<{ success: boolean; message: string; fetchedCount?: number; savedCount?: number; dbSaved?: number; dbSkipped?: number }> {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/fetch-leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        sheetId,
        maxResults
      })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error fetching leads');
    }
    return data;
  } catch (error: any) {
    console.error('Failed to scrape leads:', error);
    return { success: false, message: error.message || 'Failed to scrape leads.' };
  }
}
