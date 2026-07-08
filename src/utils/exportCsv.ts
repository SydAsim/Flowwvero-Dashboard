import type { Lead } from '../types/lead';

export function exportLeadsToCSV(leads: Lead[], filename = 'flowvero_leads.csv') {
  if (leads.length === 0) return;

  const headers = [
    'Row ID',
    'Timestamp',
    'Search Query',
    'Business Name',
    'Category',
    'Address',
    'Phone',
    'Website',
    'Google Maps URL',
    'Rating',
    'Review Count',
    'Business Status',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Status',
    'Pakistan Time',
    'USA Time'
  ];

  const rows = leads.map(l => [
    l.rowId,
    l.timestamp || '',
    l.searchQuery || '',
    l.businessName ? `"${l.businessName.replace(/"/g, '""')}"` : '',
    l.category || '',
    l.address ? `"${l.address.replace(/"/g, '""')}"` : '',
    l.phone || '',
    l.website || '',
    l.googleMapsUrl || '',
    l.rating ?? '',
    l.reviewCount ?? '',
    l.businessStatus || '',
    l.monday || '',
    l.tuesday || '',
    l.wednesday || '',
    l.thursday || '',
    l.friday || '',
    l.saturday || '',
    l.sunday || '',
    l.status || '',
    l.pakistanTime || '',
    l.usaTime || ''
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadCallList(leads: Lead[], filename = 'flowvero_call_list.csv') {
  // Only export leads with a phone number
  const callList = leads.filter(l => l.phone);
  exportLeadsToCSV(callList, filename);
}
