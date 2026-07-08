/**
 * _lib/sheets.ts
 * Google Sheets integration for Vercel serverless functions.
 * Uses the service account private key stored in environment variables.
 */

import { google } from 'googleapis';

const SHEET_HEADERS = [
  'Timestamp', 'Search Query', 'Business Name', 'Category', 'Address',
  'Phone', 'Website', 'Google Maps URL', 'Rating', 'Review Count',
  'Business Status', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday', 'Status', 'Pakistan Time', 'USA Time',
];

function getSheetsClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    throw new Error('Missing Google service account credentials.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function getFirstSheetTitle(sheets: any, sheetId: string) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetsList = spreadsheet.data.sheets;
    if (sheetsList && sheetsList.length > 0) return sheetsList[0].properties.title;
  } catch (err: any) {
    console.error('[Sheets] Error fetching spreadsheet metadata:', err.message);
  }
  return 'Sheet1';
}

async function hasHeaderRow(sheets: any, sheetId: string, sheetTitle: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetTitle}!A1:U1`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return false;
    return rows[0][0] === 'Timestamp';
  } catch {
    return false;
  }
}

async function getExistingKeys(sheets: any, sheetId: string, sheetTitle: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetTitle}!H:H`,
    });
    const rows = response.data.values;
    if (!rows || rows.length <= 1) return new Set();
    return new Set(
      rows.slice(1)
        .map((row: any[]) => row[0] ? row[0].toString().trim().toLowerCase() : '')
        .filter((url: string) => url !== '')
    );
  } catch {
    return new Set();
  }
}

function leadToRow(lead: any) {
  return [
    lead.fetchedAt      || new Date().toISOString(),
    lead.searchQuery    || '',
    lead.businessName   || '',
    lead.category       || '',
    lead.address        || '',
    lead.phone          || '',
    lead.website        || '',
    lead.googleMapsUrl  || '',
    lead.rating         != null ? lead.rating : '',
    lead.reviewCount    != null ? lead.reviewCount : '',
    lead.businessStatus || '',
    lead.monday         || '',
    lead.tuesday        || '',
    lead.wednesday      || '',
    lead.thursday       || '',
    lead.friday         || '',
    lead.saturday       || '',
    lead.sunday         || '',
    lead.status         || '',
    lead.pakistanTime   || '',
    lead.usaTime        || '',
  ];
}

export async function appendLeadsToSheet(sheetId: string, leads: any[]) {
  if (!sheetId || !leads || leads.length === 0) return 0;

  const sheets = getSheetsClient();
  const sheetTitle = await getFirstSheetTitle(sheets, sheetId);
  const headerExists = await hasHeaderRow(sheets, sheetId, sheetTitle);
  const existingKeys = await getExistingKeys(sheets, sheetId, sheetTitle);

  const freshLeads = leads.filter(lead => {
    const leadUrl = lead.googleMapsUrl ? lead.googleMapsUrl.toString().trim().toLowerCase() : '';
    return !leadUrl || !existingKeys.has(leadUrl);
  });

  if (freshLeads.length === 0) return 0;

  const rowsToAppend: any[] = [];
  if (!headerExists) rowsToAppend.push(SHEET_HEADERS);
  const dataRows = freshLeads.map(leadToRow);
  rowsToAppend.push(...dataRows);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetTitle}!A:U`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rowsToAppend },
  });

  return dataRows.length;
}
