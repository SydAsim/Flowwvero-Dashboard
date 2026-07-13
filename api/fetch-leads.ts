/**
 * api/fetch-leads.ts — POST /api/fetch-leads
 * Vercel Serverless Function:
 *  1. Calls Google Places API to search for businesses
 *  2. Transforms results into lead objects
 *  3. Saves to Supabase (always)
 *  4. Optionally saves to Google Sheets (if sheetId provided)
 *
 * Strategy: if the original query doesn't yield enough NEW leads
 * (because the DB already has most results), automatically tries
 * geographic variants (north/south/east/west/downtown/etc.) to find
 * fresh businesses in different parts of the same city.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveLeadsToSupabase, getExistingGoogleMapsUrls } from './_lib/supabase.js';
import { appendLeadsToSheet } from './_lib/sheets.js';

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

/**
 * Build geographic variants of a query so we can find more leads
 * when the original query pool is exhausted in the DB.
 *
 * "dental clinics in orlando Florida" →
 *   "dental clinics in north orlando Florida"
 *   "dental clinics in south orlando Florida"
 *   "dental clinics in downtown orlando Florida"
 *   ... etc
 */
function buildQueryVariants(originalQuery: string): string[] {
  const variants: string[] = [originalQuery];

  const areaModifiers = [
    'north', 'south', 'east', 'west', 'downtown', 'central',
    'northeast', 'northwest', 'southeast', 'southwest',
    'uptown', 'metro', 'suburbs', 'greater',
  ];

  // Detect "X in [location]" pattern
  const inMatch = originalQuery.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    const [, businessType, location] = inMatch;
    for (const mod of areaModifiers) {
      variants.push(`${businessType} in ${mod} ${location}`);
    }
    // Also try "near [location]"
    variants.push(`${businessType} near ${location}`);
  } else {
    // Fallback: append modifiers
    for (const mod of areaModifiers) {
      variants.push(`${originalQuery} ${mod}`);
    }
  }

  return variants;
}

/**
 * Call Google Places API for a single query.
 * Filters out places already in DB (knownUrls) and already collected
 * this session (collectedUrls) to ensure every result is truly new.
 *
 * NOTE: knownUrls is NEVER mutated here.
 * collectedUrls IS mutated — it tracks places found across all variant calls.
 */
async function searchPlaces(
  query: string,
  maxResults: number,
  knownUrls: Set<string>,       // from DB — read-only
  collectedUrls: Set<string>,   // cross-variant tracker — mutated here
): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured.');

  const endpoint = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
    'places.userRatingCount', 'places.googleMapsUri', 'places.businessStatus',
    'places.types', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
    'places.websiteUri', 'places.regularOpeningHours', 'places.location', 'nextPageToken',
  ].join(',');

  console.log(`[Places] Query: "${query}" | need ${maxResults} new | DB has ${knownUrls.size}, session has ${collectedUrls.size}`);

  let newPlaces: any[] = [];
  let allFetched = 0;
  let pageToken: string | undefined = undefined;
  const API_FETCH_LIMIT = 60; // Max the Places API returns via pagination
  const seenInPage = new Set<string>(); // within this single call only

  while (newPlaces.length < maxResults && allFetched < API_FETCH_LIMIT) {
    const bodyPayload: any = { textQuery: query, pageSize: 20 };
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
    const places: any[] = data.places || [];
    allFetched += places.length;

    for (const place of places) {
      const mapsUrl: string = place.googleMapsUri || '';
      // Skip if: already in DB, already found this session, or duplicate within this call
      if (mapsUrl && (knownUrls.has(mapsUrl) || collectedUrls.has(mapsUrl) || seenInPage.has(mapsUrl))) continue;
      newPlaces.push(place);
      if (mapsUrl) {
        seenInPage.add(mapsUrl);       // within-call dedup
        collectedUrls.add(mapsUrl);   // cross-variant session dedup
      }
    }

    console.log(`[Places] Page: ${places.length} from API | ${newPlaces.length}/${maxResults} new | ${allFetched} total`);

    pageToken = data.nextPageToken || undefined;
    if (!pageToken || places.length === 0) break;
  }

  const result = newPlaces.slice(0, maxResults);
  console.log(`[Places] ✅ "${query}" → ${result.length} new places (${allFetched} fetched from API)`);
  return result;
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
    // ── 1. Load all existing place URLs from DB (one query, used for all variants) ──
    console.log('[API /fetch-leads] Loading existing place URLs from DB…');
    const knownUrls = await getExistingGoogleMapsUrls();

    // ── 2. Build query variants (original first, then geographic expansions) ──
    const variants = buildQueryVariants(cleanQuery);
    const collectedUrls = new Set<string>(); // tracks places found this session across all variants
    let allRawPlaces: any[] = [];
    let variantsUsed = 0;

    for (const variant of variants) {
      if (allRawPlaces.length >= maxResults) break;

      const needed = maxResults - allRawPlaces.length;
      console.log(`[API] Trying variant ${variantsUsed + 1}/${variants.length}: "${variant}" | need ${needed} more`);

      const places = await searchPlaces(variant, needed, knownUrls, collectedUrls);
      allRawPlaces = allRawPlaces.concat(places);
      variantsUsed++;

      console.log(`[API] Variant yielded ${places.length} new places. Running total: ${allRawPlaces.length}/${maxResults}`);

      // Small delay between variant calls to be respectful to the API
      if (places.length === 0 && allRawPlaces.length < maxResults && variantsUsed < variants.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // ── 3. If still nothing after all variants ──
    if (allRawPlaces.length === 0) {
      return res.status(200).json({
        success: true, query: cleanQuery, fetchedCount: 0, savedCount: 0, leads: [],
        message: `No NEW leads found — your database already has all matching businesses for "${cleanQuery}" and its geographic variations. Try a completely different city or business type.`,
      });
    }

    // ── 4. Transform & save ──
    const leads = allRawPlaces.map(place => transformPlace(place, cleanQuery));
    console.log(`[API] Transformed ${leads.length} new leads from ${variantsUsed} query variant(s).`);

    // Save to Google Sheets (optional)
    let savedCount = leads.length;
    if (cleanSheetId) {
      savedCount = await appendLeadsToSheet(cleanSheetId, leads);
    }

    // Save to Supabase — fresh DB check (don't pass collectedUrls, we need a real insert check)
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
      message: `Successfully fetched ${dbSaved} new leads${variantsUsed > 1 ? ` (searched ${variantsUsed} area variants to find them)` : ''}.`,
    });

  } catch (err: any) {
    console.error('[API /fetch-leads] ❌ Error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'An unexpected error occurred.' });
  }
}
