export interface Lead {
  rowId: number;
  timestamp?: string;
  searchQuery?: string;
  businessName: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  status: string;
  pakistanTime?: string;
  usaTime?: string;
  notes?: string;
  followUpDate?: string;
  aiReport?: string;
}

export type LeadStatus =
  | 'New'
  | 'Called'
  | 'Interested'
  | 'Follow Up'
  | 'No Answer'
  | 'Not Interested'
  | 'Wrong Number'
  | 'Booked'
  | 'Closed';

export interface DashboardStats {
  totalLeads: number;
  industriesCount: number;
  hasPhoneCount: number;
  hasWebsiteCount: number;
  averageRating: number;
  statusCounts: Record<string, number>;
}
