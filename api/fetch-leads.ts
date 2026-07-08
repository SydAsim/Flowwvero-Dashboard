/**
 * api/fetch-leads.ts — POST /api/fetch-leads
 * Vercel Serverless Function:
 *  1. Calls Google Places API to search for businesses
 *  2. Transforms results into lead objects
 *  3. Saves to Supabase (always)
 *  4. Optionally saves to Google Sheets (if sheetId provided)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveLeadsToSupabase } from './_lib/supabase';
import { appendLeadsToSheet } from './_lib/sheets';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFormattedTime(timeZone: string) {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    } as any);
  } catch {
    return new Date().toISOString();
  }
}

function transformPlace(place: any, searchQuery: string) {
  const genericTypes = ['point_of_interest', 'establishment', 'health', 'food'];
  let category = '';
  if (place.types && place.types.length > 0) {
    const meaningfulTypes = place.types.filter((t: string) => !genericTypes.includes(t));
    const firstType = meaningfulTypes.length > 0 ? meaningfulTypes[0] : place.types[0];
    category = firstType.replace(/_/g, ' ');
  }

  const openingHoursDays: Record<string, string> = {
    monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '',
  };

  if (place.regularOpeningHours && Array.isArray(place.regularOpeningHours.weekdayDescriptions)) {
    place.regularOpeningHours.weekdayDescriptions.forEach((desc: string) => {
      const splitIdx = desc.indexOf(':');
      if (splitIdx !== -1) {
        const dayPart = desc.substring(0, splitIdx).trim().toLowerCase();
        const timePart = desc.substring(splitIdx + 1).trim();
        if (dayPart in openingHoursDays) openingHoursDays[dayPart] = timePart;
      }
    });
  }

  return {
    businessName:   place.displayName?.text || '',
    category,
    address:        place.formattedAddress || '',
    phone:          place.nationalPhoneNumber || '',
    website:        place.websiteUri || '',
    googleMapsUrl:  place.googleMapsUri || '',
    rating:         place.rating ?? null,
    reviewCount:    place.userRatingCount ?? null,
    businessStatus: place.businessStatus || '',
    ...openingHoursDays,
    status:         'New',
    pakistanTime:   getFormattedTime('Asia/Karachi'),
    usaTime:        getFormattedTime('America/New_York'),
    searchQuery,
    fetchedAt:      new Date().toISOString(),
  };
}

async function searchPlaces(query: string, maxResults: number) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured.');

  const endpoint = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
    'places.userRatingCount', 'places.googleMapsUri', 'places.businessStatus',
    'places.types', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
    'places.websiteUri', 'places.regularOpeningHours', 'places.location', 'nextPageToken',
  ].join(',');

  let allPlaces: any[] = [];
  let pageToken = '';

  while (allPlaces.length < maxResults) {
    const pageSize = Math.min(maxResults - allPlaces.length, 20);
    const bodyPayload: any = { textQuery: query, pageSize };
    if (pageToken) bodyPayload.pageToken = pageToken;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Places API error (${response.status}): ${errorBody.slice(0, 400)}`);
    }

    const data = await response.json();
    const places = data.places || [];
    allPlaces = allPlaces.concat(places);
    pageToken = data.nextPageToken;
    if (!pageToken || places.length === 0) break;
  }

  return allPlaces.slice(0, maxResults);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { query, sheetId, maxResults: rawMax } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ success: false, message: 'query is required and must be a non-empty string.' });
  }

  let maxResults = parseInt(rawMax, 10);
  if (isNaN(maxResults) || maxResults < 1) maxResults = 20;
  if (maxResults > 50) maxResults = 50;

  const cleanQuery   = query.trim();
  const cleanSheetId = sheetId ? sheetId.trim() : '';

  try {
    const rawPlaces = await searchPlaces(cleanQuery, maxResults);

    if (rawPlaces.length === 0) {
      return res.status(200).json({
        success: true, query: cleanQuery, fetchedCount: 0, savedCount: 0, leads: [],
        message: 'No results found for this query.',
      });
    }

    const leads = rawPlaces.map(place => transformPlace(place, cleanQuery));

    // Save to Google Sheets (optional)
    let savedCount = leads.length;
    if (cleanSheetId) {
      savedCount = await appendLeadsToSheet(cleanSheetId, leads);
    }

    // Save to Supabase (always)
    const { saved: dbSaved, skipped: dbSkipped } = await saveLeadsToSupabase(leads);
    if (!cleanSheetId) savedCount = dbSaved;

    return res.status(200).json({
      success: true,
      query: cleanQuery,
      fetchedCount: leads.length,
      savedCount,
      dbSaved,
      dbSkipped,
      leads,
      message: 'Leads successfully fetched and processed.',
    });

  } catch (err: any) {
    console.error('[API /fetch-leads] ❌ Error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'An unexpected error occurred.' });
  }
}
