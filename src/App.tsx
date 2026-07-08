import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  PhoneCall,
  BrainCircuit,
  LineChart as LucideLineChart,
  Search,
  Sun,
  Moon,
  RefreshCw,
  Sparkles,
  Database,
  ExternalLink,
  ChevronRight,
  Clipboard,
  Phone,
  FileSpreadsheet,
  FilterX,
  Star,
  CheckCircle2,
  Calendar,
  Grid,
  List,
  Copy,
  Printer,
  ChevronLeft,
  X,
  Clock,
  Sparkle,
  Inbox,
  History,
  PhoneOff,
  Globe
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area
} from 'recharts';

import type { Lead, LeadStatus, DashboardStats } from './types/lead';
import { fetchLeads, updateLeadDetails, scrapeLeads, CONFIG } from './services/api';
import { generateLeadScript } from './utils/scriptGenerator';
import { exportLeadsToCSV, downloadCallList } from './utils/exportCsv';

export default function App() {
  // ── UI Preference States ──
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('flowvero_dark_mode') === 'true';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowvero_sidebar_collapsed') === 'true';
  });
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('Dashboard'); 
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table'); 

  // ── Data States ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  // ── Interactive Detail States ──
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeScriptLead, setActiveScriptLead] = useState<Lead | null>(null);
  const [scriptModalOpen, setScriptModalOpen] = useState<boolean>(false);
  const [scriptActiveTab, setScriptActiveTab] = useState<'script' | 'objections' | 'sms' | 'email'>('script');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Drawer Detail States ──
  const [drawerNotes, setDrawerNotes] = useState<string>('');
  const [drawerFollowUpDate, setDrawerFollowUpDate] = useState<string>('');
  const [drawerAiReport, setDrawerAiReport] = useState<string>('');
  const [isSavingDetails, setIsSavingDetails] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // ── Filter States ──
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterRating, setFilterRating] = useState<string>('');
  const [filterBusinessStatus, setFilterBusinessStatus] = useState<string>('');
  const [filterHasPhone, setFilterHasPhone] = useState<string>('all'); 
  const [filterHasWebsite, setFilterHasWebsite] = useState<string>('all'); 
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('All Leads');

  // ── Scraper States ──
  const [scrapeQuery, setScrapeQuery] = useState('');
  const [scrapeSheetId, setScrapeSheetId] = useState('');
  const [scrapeMaxResults, setScrapeMaxResults] = useState('20');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ fetched?: number, saved?: number, dbSaved?: number, dbSkipped?: number } | null>(null);

  const handleScrape = async () => {
    if (!scrapeQuery) {
      showToast('Search Query is required.', 'error');
      return;
    }
    setIsScraping(true);
    setScrapeResult(null);
    showToast('Scraping leads from Google Maps...', 'success');
    
    const result = await scrapeLeads(scrapeQuery, scrapeSheetId, parseInt(scrapeMaxResults, 10));
    
    setIsScraping(false);
    if (result.success) {
      showToast(`Success! Fetched ${result.fetchedCount} leads.`, 'success');
      setScrapeResult({ fetched: result.fetchedCount, saved: result.savedCount, dbSaved: result.dbSaved, dbSkipped: result.dbSkipped });
      loadData(true); // reload dashboard leads
      setActiveTab('Dashboard'); // switch to dashboard automatically
    } else {
      showToast(`Error: ${result.message}`, 'error');
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // ── Load Theme ──
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('flowvero_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('flowvero_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // ── Toast Trigger Helper ──
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Fetch Lead Data ──
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchLeads();
      setLeads(result.leads);
      setIsLive(result.isLive);
      setLastSynced(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial Fetch + Auto-sync interval
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Sync drawer states when a new lead is selected
  useEffect(() => {
    if (selectedLead) {
      setDrawerNotes(selectedLead.notes || '');
      setDrawerFollowUpDate(selectedLead.followUpDate || '');
      setDrawerAiReport(selectedLead.aiReport || '');
    }
  }, [selectedLead]);


  // ── Update Lead Status Handler ──
  const handleUpdateStatus = async (leadId: number, nextStatus: LeadStatus) => {
    const prevLeads = [...leads];
    setLeads(prevLeads.map(l => l.rowId === leadId ? { ...l, status: nextStatus } : l));
    if (selectedLead && selectedLead.rowId === leadId) {
      setSelectedLead({ ...selectedLead, status: nextStatus });
    }
    showToast(`Lead status updated to "${nextStatus}"`);

    const success = await updateLeadDetails(leadId, { status: nextStatus });
    if (!success) {
      setLeads(prevLeads);
      showToast('Failed to update status in Supabase', 'error');
    } else {
      loadData(true);
    }
  };

  // ── Save Drawer Details (Notes + Follow-Up Date) Handler ──
  const handleSaveDrawerDetails = async () => {
    if (!selectedLead) return;
    setIsSavingDetails(true);
    const success = await updateLeadDetails(selectedLead.rowId, {
      notes: drawerNotes,
      followUpDate: drawerFollowUpDate,
      aiReport: drawerAiReport
    });
    setIsSavingDetails(false);
    if (success) {
      setLeads(prev => prev.map(l => l.rowId === selectedLead.rowId ? { ...l, notes: drawerNotes, followUpDate: drawerFollowUpDate, aiReport: drawerAiReport } : l));
      setSelectedLead(prev => prev ? { ...prev, notes: drawerNotes, followUpDate: drawerFollowUpDate, aiReport: drawerAiReport } : prev);
      showToast('Notes & follow-up date saved!');
    } else {
      showToast('Failed to save details.', 'error');
    }
  };

  // ✨ Generate AI Report Handler ✨
  const handleGenerateReport = async () => {
    if (!selectedLead) return;
    if (!drawerNotes.trim()) {
      showToast('Please add some Call Notes first to generate a report.', 'error');
      return;
    }
    setIsGeneratingReport(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s hard timeout
      
      const response = await fetch('http://localhost:5000/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: selectedLead.businessName,
          category: selectedLead.category || 'business',
          notes: drawerNotes,
          rowId: selectedLead.rowId
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Unknown error' }));
        showToast(`Failed: ${errData.message || response.statusText}`, 'error');
        return;
      }
      
      const result = await response.json();
      
      if (result.success && result.aiReport) {
        setDrawerAiReport(result.aiReport);
        // Auto-save the new report
        await updateLeadDetails(selectedLead.rowId, {
          notes: drawerNotes,
          followUpDate: drawerFollowUpDate,
          aiReport: result.aiReport
        });
        setLeads(prev => prev.map(l => l.rowId === selectedLead.rowId ? { ...l, aiReport: result.aiReport } : l));
        setSelectedLead(prev => prev ? { ...prev, aiReport: result.aiReport } : prev);
        showToast('✅ AI Report generated & saved!', 'success');
      } else {
        showToast(`Failed: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        showToast('Request timed out. The AI is busy — please try again.', 'error');
      } else {
        showToast('Network error. Make sure the backend server is running.', 'error');
      }
    } finally {
      setIsGeneratingReport(false); // ALWAYS stops the spinner
    }
  };

  // ── Filtering Logic ──
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch =
        searchQuery === '' ||
        (l.businessName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.category || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = filterCategory === '' || l.category === filterCategory;
      const matchesStatus = filterStatus === '' || l.status === filterStatus;
      const matchesActiveStatusFilter = activeStatusFilter === 'All Leads' || l.status === activeStatusFilter || (!l.status && activeStatusFilter === 'New');
      const matchesRating =
        filterRating === '' ||
        (filterRating === '4plus' && (l.rating || 0) >= 4) ||
        (filterRating === '3plus' && (l.rating || 0) >= 3);
      const matchesBizStatus = filterBusinessStatus === '' || l.businessStatus === filterBusinessStatus;
      const matchesPhone =
        filterHasPhone === 'all' ||
        (filterHasPhone === 'yes' && !!l.phone) ||
        (filterHasPhone === 'no' && !l.phone);
      const matchesWeb =
        filterHasWebsite === 'all' ||
        (filterHasWebsite === 'yes' && !!l.website) ||
        (filterHasWebsite === 'no' && !l.website);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesActiveStatusFilter &&
        matchesRating &&
        matchesBizStatus &&
        matchesPhone &&
        matchesWeb
      );
    });
  }, [
    leads,
    searchQuery,
    filterCategory,
    filterStatus,
    activeStatusFilter,
    filterRating,
    filterBusinessStatus,
    filterHasPhone,
    filterHasWebsite
  ]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
    setFilterStatus('');
    setActiveStatusFilter('All Leads');
    setFilterRating('');
    setFilterBusinessStatus('');
    setFilterHasPhone('all');
    setFilterHasWebsite('all');
    setCurrentPage(1);
    showToast('Filters reset successfully');
  };

  // Unique categories list for dropdowns
  const uniqueCategories = useMemo(() => {
    return [...new Set(leads.map(l => l.category).filter(Boolean))].sort();
  }, [leads]);

  // Unique Business Status list
  const uniqueBusinessStatuses = useMemo(() => {
    return [...new Set(leads.map(l => l.businessStatus).filter(Boolean))].sort();
  }, [leads]);

  // ── Analytics Statistics Calculations ──
  const stats = useMemo<DashboardStats>(() => {
    const totalLeads = leads.length;
    const hasPhoneCount = leads.filter(l => l.phone).length;
    const hasWebsiteCount = leads.filter(l => l.website).length;
    const ratedLeads = leads.filter(l => l.rating);
    const averageRating =
      ratedLeads.length > 0
        ? parseFloat((ratedLeads.reduce((acc, l) => acc + (l.rating || 0), 0) / ratedLeads.length).toFixed(2))
        : 0;

    const statusCounts: Record<string, number> = {};
    leads.forEach(l => {
      const s = l.status || 'New';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const industries = new Set(leads.map(l => l.category).filter(Boolean));

    return {
      totalLeads,
      industriesCount: industries.size,
      hasPhoneCount,
      hasWebsiteCount,
      averageRating,
      statusCounts
    };
  }, [leads]);

  // Status badge style mapping
  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    New: { bg: 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
    Called: { bg: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
    Interested: { bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    'Follow Up': { bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    'No Answer': { bg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-500' },
    'Not Interested': { bg: 'bg-red-50 dark:bg-red-950/40 border border-red-200/50 dark:border-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    'Wrong Number': { bg: 'bg-orange-50 dark:bg-orange-950/40 border border-orange-200/50 dark:border-orange-900/40', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
    Booked: { bg: 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50 dark:border-teal-900/40', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
    Closed: { bg: 'bg-slate-900/5 dark:bg-slate-950/80 border border-slate-900/10 dark:border-slate-800', text: 'text-slate-850 dark:text-slate-400', dot: 'bg-slate-900 dark:bg-slate-250' }
  };

  const getStatusStyle = (status: string) => {
    return statusConfig[status] || statusConfig['New'];
  };

  // ── Pagination Calculation ──
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLeads, currentPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  }, [filteredLeads, itemsPerPage]);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
  };

  // ── Action Handlers ──
  const handleCopyText = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`);
  };

  const handleOpenScript = (lead: Lead) => {
    setActiveScriptLead(lead);
    setScriptActiveTab('script');
    setScriptModalOpen(true);
  };

  // Detailed opening schedule mapping
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Recharts Chart Data formatting
  const chartDataStatus = useMemo(() => {
    return Object.entries(stats.statusCounts).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const chartDataIndustry = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      if (l.category) counts[l.category] = (counts[l.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); 
  }, [leads]);

  const chartDataDaily = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      if (l.timestamp) {
        const date = new Date(l.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        counts[date] = (counts[date] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }, [leads]);

  // AI Script Modal component helper
  const scriptContent = useMemo(() => {
    if (!activeScriptLead) return null;
    return generateLeadScript(activeScriptLead);
  }, [activeScriptLead]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 antialiased font-sans">
      
      {/* ── Left Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-250/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-md flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg select-none">
              F
            </span>
            {!sidebarCollapsed && (
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                Flowvero
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronLeft className={`w-4 h-4 transition duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-3.5 flex flex-col gap-1.5 overflow-y-auto">
          {[
            { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'Leads', icon: Users, label: 'Leads' },
            { id: 'Call Pipeline', icon: PhoneCall, label: 'Call Pipeline' },
            { id: 'AI Scripts', icon: BrainCircuit, label: 'AI Scripts' },
            { id: 'Lead Scraper', icon: Search, label: 'Lead Scraper' },
            { id: 'Analytics', icon: LucideLineChart, label: 'Analytics' }
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpenMobile(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-sm font-semibold ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm border border-slate-800/10 dark:border-slate-200/10'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          {!sidebarCollapsed ? (
            <div className="bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-3.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkle className="w-3.5 h-3.5 text-purple-500 fill-purple-500 animate-pulse" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-450 dark:text-slate-350">AI Lead System</h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Personalize cold call scripts for your segments automatically.</p>
              </div>
              <button
                onClick={() => {
                  if (leads.length > 0) {
                    handleOpenScript(leads[0]);
                  } else {
                    showToast('No leads available', 'error');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold py-2.5 px-3.5 rounded-xl shadow transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 dark:text-purple-600" />
                Generate Scripts
              </button>
            </div>
          ) : (
            <button
              onClick={() => leads.length > 0 && handleOpenScript(leads[0])}
              className="w-11 h-11 mx-auto rounded-xl bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 flex items-center justify-center shadow-lg transition"
            >
              <Sparkles className="w-5 h-5 text-purple-400 dark:text-purple-650" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {sidebarOpenMobile && (
        <div
          onClick={() => setSidebarOpenMobile(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ── Main Panel Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1 max-w-lg">
            <button
              onClick={() => setSidebarOpenMobile(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search business, phone, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 select-none">
                ⌘K
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Live Indicator Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
              isLive 
                ? 'bg-emerald-105/30 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                : 'bg-slate-100/30 text-slate-500 border-slate-500/20 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-[10px] font-semibold tracking-wider ${isLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {isLive ? 'LIVE SCRAPING' : 'LOCAL CACHED'}
              </span>
            </div>

            {/* Date display */}
            <span className="hidden lg:inline text-xs text-slate-400 font-bold uppercase tracking-wider">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>

            {/* Manual Sync Button */}
            <button
              onClick={() => {
                loadData();
                showToast('Synchronizing database...');
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              title="Sync Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 text-slate-555 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            </button>

            {/* User profile avatar */}
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
              alt="Profile"
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 object-cover"
            />
          </div>
        </header>

        {/* ── Main Dashboard Scrollable Content ── */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'Dashboard' && (
            <>
              {/* Header Title with gradient */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                Flowvero <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-transparent">Lead Dashboard</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Real-time scraped leads with AI-generated cold calling scripts and call status tracking.
              </p>
            </div>
            
            {/* Download and print features */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportLeadsToCSV(filteredLeads)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold hover:bg-slate-55 dark:hover:bg-slate-800 transition shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                Export CSV
              </button>
              <button
                onClick={() => downloadCallList(filteredLeads)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold hover:bg-slate-55 dark:hover:bg-slate-800 transition shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5 text-blue-500" />
                Call List
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold hover:bg-slate-55 dark:hover:bg-slate-800 transition shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                Print List
              </button>
            </div>
          </div>

          {/* Sync Time banner */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-xs text-slate-450 font-bold">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last synced: {lastSynced.toLocaleTimeString()} (Every {CONFIG.REFRESH_INTERVAL / 1000}s)</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-500/5 dark:bg-red-950/10 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-455 rounded-2xl text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}



          {/* Horizontal Status Cards Filter */}
          <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
            {[
              { id: 'All Leads', icon: Users, color: 'text-purple-500' },
              { id: 'New', icon: Inbox, color: 'text-blue-500' },
              { id: 'Called', icon: PhoneCall, color: 'text-emerald-500' },
              { id: 'Interested', icon: Star, color: 'text-purple-600' },
              { id: 'Follow Up', icon: History, color: 'text-orange-500' },
              { id: 'No Answer', icon: PhoneOff, color: 'text-red-500' },
              { id: 'Booked', icon: Calendar, color: 'text-teal-500' },
              { id: 'Closed', icon: CheckCircle2, color: 'text-slate-600 dark:text-slate-400' }
            ].map(statusCard => {
              const Icon = statusCard.icon;
              const count = statusCard.id === 'All Leads' ? leads.length :
                            statusCard.id === 'New' ? leads.filter(l => !l.status || l.status === 'New').length :
                            leads.filter(l => l.status === statusCard.id).length;
              const isActive = activeStatusFilter === statusCard.id;
              
              return (
                <button
                  key={statusCard.id}
                  onClick={() => setActiveStatusFilter(statusCard.id)}
                  className={`min-w-[120px] bg-white dark:bg-slate-900 border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 snap-center transition-all duration-300 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm' 
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${statusCard.color}`} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{statusCard.id}</span>
                  <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{count}</span>
                </button>
              );
            })}
          </div>

              {/* Glassmorphism Filters Section */}
              <div className="glass-panel shadow-premium rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-450 dark:text-slate-350 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    Segmenting Controls
                  </h3>
                  <button
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition"
                  >
                    <FilterX className="w-3.5 h-3.5" />
                    Clear Filters
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Industry</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="">All Industries</option>
                      {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="">All Statuses</option>
                      {Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Google Rating</label>
                    <select
                      value={filterRating}
                      onChange={(e) => setFilterRating(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="">All Ratings</option>
                      <option value="4plus">⭐ 4.0 & Up</option>
                      <option value="3plus">⭐ 3.0 & Up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Operational</label>
                    <select
                      value={filterBusinessStatus}
                      onChange={(e) => setFilterBusinessStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="">All States</option>
                      {uniqueBusinessStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Has Phone</label>
                    <select
                      value={filterHasPhone}
                      onChange={(e) => setFilterHasPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="all">Either</option>
                      <option value="yes">Yes, Available</option>
                      <option value="no">No, Missing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Has Website</label>
                    <select
                      value={filterHasWebsite}
                      onChange={(e) => setFilterHasWebsite(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-700 transition"
                    >
                      <option value="all">Either</option>
                      <option value="yes">Yes, Available</option>
                      <option value="no">No, Missing</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lead Table Widget */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-premium">
                <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/40">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Leads Directory ({filteredLeads.length})</h3>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-850 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-lg transition ${viewMode === 'cards' ? 'bg-white dark:bg-slate-850 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-slate-450 dark:text-slate-400 font-bold">
                          <th className="py-4 px-5 w-12 text-center">#</th>
                          <th className="py-4 px-5">Business Name</th>
                          <th className="py-4 px-5">Category</th>
                          <th className="py-4 px-5">Phone</th>
                          <th className="py-4 px-5">Rating</th>
                          <th className="py-4 px-5">Reviews</th>
                          <th className="py-4 px-5">Website</th>
                          <th className="py-4 px-5">Google Maps</th>
                          <th className="py-4 px-5">Operational</th>
                          <th className="py-4 px-5">Current Status</th>
                          <th className="py-4 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800/60">
                        {loading ? (
                          Array.from({ length: itemsPerPage }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              <td className="py-4 px-5 text-center"><div className="w-4 h-4 mx-auto bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-32 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-8 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                              <td className="py-4 px-5"><div className="w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded-full" /></td>
                              <td className="py-4 px-5"><div className="w-24 h-8 ml-auto bg-slate-200 dark:bg-slate-800 rounded-lg" /></td>
                            </tr>
                          ))
                        ) : paginatedLeads.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                              No matching leads found. Reset segmenting controls to view all.
                            </td>
                          </tr>
                        ) : (
                          paginatedLeads.map((lead, index) => {
                            const sc = getStatusStyle(lead.status);
                            return (
                              <tr
                                key={lead.rowId}
                                className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition cursor-pointer"
                                onClick={() => {
                                  setSelectedLead(lead);
                                  setDrawerOpen(true);
                                }}
                              >
                                <td className="py-3.5 px-5 text-center font-bold text-slate-400">
                                  {(currentPage - 1) * itemsPerPage + index + 1}
                                </td>
                                <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                                  {lead.businessName}
                                </td>
                                <td className="py-3.5 px-5 text-slate-655 dark:text-slate-400 capitalize font-medium">
                                  {lead.category || '—'}
                                </td>
                                <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-350">
                                  {lead.phone || <span className="text-slate-350 dark:text-slate-650 italic font-normal">No phone</span>}
                                </td>
                                <td className="py-3.5 px-5 text-amber-500 font-bold">
                                  {lead.rating ? `⭐ ${lead.rating}` : '—'}
                                </td>
                                <td className="py-3.5 px-5 text-slate-500 font-medium">
                                  {lead.reviewCount ? lead.reviewCount.toLocaleString() : '—'}
                                </td>
                                <td className="py-3.5 px-5">
                                  {lead.website ? (
                                    <a
                                      href={lead.website}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 text-emerald-500 hover:text-emerald-600 hover:underline font-bold"
                                    >
                                      Visit
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-350 dark:text-slate-650 italic">No website</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-5">
                                  {lead.googleMapsUrl ? (
                                    <a
                                      href={lead.googleMapsUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-600 hover:underline font-bold"
                                    >
                                      Map
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-3.5 px-5 text-slate-450 dark:text-slate-400 font-medium">
                                  {lead.businessStatus || '—'}
                                </td>
                                <td className="py-3.5 px-5">
                                  <select
                                    value={lead.status || 'New'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateStatus(lead.rowId, e.target.value as LeadStatus)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wider ${sc.bg} ${sc.text} transition outline-none cursor-pointer`}
                                  >
                                    {Object.keys(statusConfig).map(s => (
                                      <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition">
                                    <button
                                      onClick={() => handleOpenScript(lead)}
                                      className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all shadow-xs"
                                      title="Generate script"
                                    >
                                      <BrainCircuit className="w-4 h-4" />
                                    </button>
                                    {lead.phone && (
                                      <button
                                        onClick={() => handleCopyText(lead.phone || '', 'Phone')}
                                        className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all shadow-xs"
                                        title="Copy Phone"
                                      >
                                        <Clipboard className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedLead(lead);
                                        setDrawerOpen(true);
                                      }}
                                      className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                                      title="View Details"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Grid View layout
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredLeads.map(lead => {
                      const sc = getStatusStyle(lead.status);
                      return (
                        <div
                          key={lead.rowId}
                          onClick={() => {
                            setSelectedLead(lead);
                            setDrawerOpen(true);
                          }}
                          className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-305 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">{lead.businessName}</h4>
                              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${sc.bg} ${sc.text}`}>
                                {lead.status}
                              </span>
                            </div>
                            <span className="inline-block text-[11px] font-bold text-slate-400 capitalize">{lead.category || 'Niche'}</span>
                          </div>
                          <div className="space-y-1 text-xs font-semibold text-slate-500">
                            {lead.phone && <div>📞 {lead.phone}</div>}
                            {lead.rating && <div className="text-amber-500">⭐ {lead.rating} ({lead.reviewCount || 0} reviews)</div>}
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-800/60 pt-3.5 text-[11px] font-bold">
                            {lead.website ? (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-500 hover:underline"
                              >
                                Website ↗
                              </a>
                            ) : (
                              <span className="text-slate-400">No website</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenScript(lead);
                              }}
                              className="text-purple-505 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                              <BrainCircuit className="w-3.5 h-3.5" />
                              Script Template
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Table Footer Pagination */}
                {!loading && filteredLeads.length > 0 && viewMode === 'table' && (
                  <div className="px-6 py-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 font-semibold">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                      >
                        Prev
                      </button>
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-bold px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'Leads' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-premium">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base uppercase tracking-wider text-slate-500">Pipeline Leads</h3>
                  <p className="text-xs text-slate-400 mt-1">Leads marked as Interested, Follow Up, or Booked.</p>
                </div>
                <div className="flex gap-2">
                  {['Interested', 'Follow Up', 'Booked'].map(s => (
                    <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {(() => {
                const pipelineLeads = leads.filter(l => ['Interested', 'Follow Up', 'Booked'].includes(l.status));
                return pipelineLeads.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">No pipeline leads yet</p>
                    <p className="text-xs text-slate-400 mt-1">Leads will appear here when marked as Interested, Follow Up, or Booked.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {pipelineLeads.map(lead => (
                      <div key={lead.rowId} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{lead.businessName}</h4>
                            <span className="text-[11px] text-slate-450 capitalize mt-1 block font-bold">{lead.category || 'Niche'}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                            lead.status === 'Interested' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800' :
                            lead.status === 'Follow Up'  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 border border-orange-200 dark:border-orange-800' :
                                                           'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800'
                          }`}>
                            {lead.status}
                          </span>
                        </div>

                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition">
                            <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            {lead.phone}
                          </a>
                        )}

                        {lead.followUpDate && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-lg">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {new Date(lead.followUpDate).toLocaleString()}
                          </div>
                        )}

                        {lead.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed line-clamp-2 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                            {lead.notes}
                          </p>
                        )}

                        <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/60 pt-3">
                          <span className="text-[10px] font-bold text-slate-400">{lead.rating ? `⭐ ${lead.rating}` : 'No rating'}</span>
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setDrawerOpen(true);
                            }}
                            className="text-xs font-bold text-emerald-500 hover:underline"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'Lead Scraper' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-extrabold tracking-tight">Lead Scraper</h3>
                <p className="text-xs text-slate-400 mt-1">Search Google Maps to extract new leads instantly.</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-premium max-w-2xl">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Search Query</label>
                    <input
                      type="text"
                      value={scrapeQuery}
                      onChange={(e) => setScrapeQuery(e.target.value)}
                      placeholder="e.g. dental clinics in Orlando Florida"
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Max Results</label>
                    <select
                      value={scrapeMaxResults}
                      onChange={(e) => setScrapeMaxResults(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    >
                      <option value="10">10 Leads</option>
                      <option value="20">20 Leads</option>
                      <option value="30">30 Leads</option>
                      <option value="50">50 Leads</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Google Sheet ID <span className="normal-case text-slate-400 font-normal">(Optional — Export Only)</span>
                    </label>
                    <input
                      type="text"
                      value={scrapeSheetId}
                      onChange={(e) => setScrapeSheetId(e.target.value)}
                      placeholder="Paste the Sheet ID from your Google Sheets URL"
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Leads are always saved to Supabase. Fill this in to also export to Google Sheets.</p>
                  </div>
                  <button
                    onClick={handleScrape}
                    disabled={isScraping}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {isScraping ? 'Scraping...' : 'Fetch Leads'}
                  </button>
                  {scrapeResult && (
                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        Successfully fetched {scrapeResult.fetched} leads.
                      </p>
                      {scrapeResult.dbSkipped !== undefined && scrapeResult.dbSkipped > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Skipped {scrapeResult.dbSkipped} duplicates that were already in the database.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Call Pipeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-lg tracking-tight">Outreach Kanban Board</h3>
                <p className="text-xs text-slate-400 mt-1">Easily map pipeline conversions by updating stage selectors.</p>
              </div>

              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
                {(['New', 'Called', 'Interested', 'Follow Up', 'Booked', 'Closed'] as LeadStatus[]).map(status => {
                  const statusLeads = leads.filter(l => (l.status || 'New') === status);
                  return (
                    <div key={status} className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 min-w-[280px] w-[280px] flex-shrink-0 flex flex-col gap-4 shadow-xs snap-center">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500">{status}</span>
                        <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-extrabold">{statusLeads.length}</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[520px]">
                        {statusLeads.length === 0 ? (
                          <div className="text-center text-[10px] font-bold text-slate-400 py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl select-none">
                            No Leads
                          </div>
                        ) : (
                          statusLeads.map(lead => (
                            <div
                              key={lead.rowId}
                              onClick={() => {
                                setSelectedLead(lead);
                                setDrawerOpen(true);
                              }}
                              className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800/85 rounded-xl p-3.5 hover:shadow-md transition cursor-pointer flex flex-col justify-between gap-3"
                            >
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug">{lead.businessName}</h5>
                                <span className="text-[10px] text-slate-400 capitalize mt-1 block font-semibold">{lead.category}</span>
                              </div>
                              
                              <div className="text-[11px] text-slate-500 font-semibold space-y-0.5">
                                {lead.phone && <div>📞 {lead.phone}</div>}
                                {lead.rating && <div className="text-amber-500">⭐ {lead.rating}</div>}
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-2.5 flex items-center justify-between">
                                <select
                                  value={lead.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateStatus(lead.rowId, e.target.value as LeadStatus)}
                                  className="text-[10px] font-extrabold border-none bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg cursor-pointer outline-none text-slate-600 dark:text-slate-350"
                                >
                                  {Object.keys(statusConfig).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenScript(lead);
                                  }}
                                  className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition shadow-2xs"
                                  title="Script"
                                >
                                  <BrainCircuit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'AI Scripts' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-premium">
              <div>
                <h3 className="font-extrabold text-base uppercase tracking-wider text-slate-500">Call script generation templates</h3>
                <p className="text-xs text-slate-400 mt-1">Configure outreach scripting parameters from map datasets.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {leads.slice(0, 4).map(lead => (
                  <div key={lead.rowId} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{lead.businessName}</h4>
                        <span className="text-[11px] font-bold text-slate-400 capitalize">{lead.category || 'Niche'}</span>
                      </div>
                      <button
                        onClick={() => handleOpenScript(lead)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Outreach
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      "I noticed you have a great reputation on Google Maps in {lead.address ? lead.address.split(',')[1]?.trim() || lead.address : 'your local area'}..."
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Analytics' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-extrabold text-lg tracking-tight">Scraping metrics & outreach conversion</h3>
                <p className="text-xs text-slate-400 mt-1">Visualize lead database metrics, coverage percentages, and ratings distributions.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Leads by Niche */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-premium">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-500" />
                    Top categories scraped
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataIndustry}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(139,92,246,0.04)' }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pipeline distribution */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-premium">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-emerald-500" />
                    Outreach status segments
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataStatus}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(16,185,129,0.04)' }} />
                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scraped Over time */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-premium lg:col-span-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    Daily scraped map entries trend
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartDataDaily}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>


      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl border shadow-xl text-xs font-extrabold bg-white dark:bg-slate-900 ${
          toastMessage.type === 'success' ? 'border-emerald-200 dark:border-emerald-950 text-emerald-600 dark:text-emerald-450' : 'border-red-200 dark:border-red-950 text-red-655 dark:text-red-400'
        }`}>
          <CheckCircle2 className="w-4.5 h-4.5" />
          {toastMessage.text}
        </div>
      )}

      {/* ── Lead Profile Drawer ── */}
      {drawerOpen && selectedLead && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs transition-opacity duration-300"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col gap-6 overflow-y-auto animate-drawer-in">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                    getStatusStyle(selectedLead.status || 'New').bg
                  } ${
                    getStatusStyle(selectedLead.status || 'New').text
                  }`}>
                    {selectedLead.status || 'New Lead'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-550 capitalize flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {selectedLead.category || 'Niche'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedLead.businessName}
                </h3>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 space-y-5 text-xs">
              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedLead.phone ? (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="col-span-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent-blue hover:opacity-90 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Now: {selectedLead.phone}
                  </a>
                ) : (
                  <div className="col-span-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 select-none">
                    No Phone Number Available
                  </div>
                )}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    handleOpenScript(selectedLead);
                  }}
                  className="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-805 transition flex items-center justify-center gap-1.5 cursor-pointer font-bold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  AI Script
                </button>
                {selectedLead.googleMapsUrl ? (
                  <a
                    href={selectedLead.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-55 dark:hover:bg-slate-805 transition flex items-center justify-center gap-1.5 text-center font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    Google Maps
                  </a>
                ) : (
                  <button
                    disabled
                    className="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    No Map
                  </button>
                )}
                </div>
              </div>

              {/* Status Management */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 shadow-xs">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Pipeline Status</label>
                <div className="relative">
                  <select
                    value={selectedLead.status || 'New'}
                    onChange={(e) => handleUpdateStatus(selectedLead.rowId, e.target.value as LeadStatus)}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-805 dark:text-slate-200 font-bold text-xs rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
                  >
                    {Object.keys(statusConfig).map(s => (
                      <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{s}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              {/* Call Timing */}
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Call Timing</h4>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/50">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Good time to call
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl relative shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Business Local Time
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', weekday: 'short' })}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {selectedLead.address?.split(',').length ? selectedLead.address.split(',')[selectedLead.address.split(',').length - 2]?.trim() : 'Orlando, FL'}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl relative shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      Pakistan Time
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', weekday: 'short' })}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Asia/Karachi
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 p-2.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Best call window: 6:30 PM - 1:00 AM PKT
                  </span>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Contact Details</h4>
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Address</span>
                      <p className="text-xs text-slate-800 dark:text-slate-300 font-semibold leading-relaxed mt-0.5">
                        {selectedLead.address || 'No address details'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Phone</span>
                        <p className="text-xs text-slate-800 dark:text-slate-300 font-bold font-mono mt-0.5">
                          {selectedLead.phone || '—'}
                        </p>
                      </div>
                      {selectedLead.phone && (
                        <button
                          onClick={() => handleCopyText(selectedLead.phone || '', 'Phone')}
                          className="text-xs font-bold text-blue-500 hover:underline cursor-pointer"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-external-link">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Website</span>
                      {selectedLead.website ? (
                        <a
                          href={selectedLead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 font-bold hover:underline flex items-center gap-1 mt-0.5"
                        >
                          {selectedLead.website} ↗
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-0.5">No website available</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-amber-500 bg-amber-500/5">
                      <Star className="w-4 h-4 fill-amber-500" />
                    </div>
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">Google Rating</span>
                      <p className="text-xs text-slate-800 dark:text-slate-300 font-bold flex items-center gap-2 mt-0.5">
                        <span>{selectedLead.rating || '—'}</span>
                        <span className="text-slate-400 dark:text-slate-550 font-normal">({selectedLead.reviewCount || 0} reviews)</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">Operating Hours</h4>
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 space-y-2">
                  {days.map(day => {
                    const field = day.toLowerCase() as keyof Lead;
                    const hoursVal = String(selectedLead[field] || 'Closed');
                    const currentDayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
                    const dayMapIndex = [7, 1, 2, 3, 4, 5, 6]; // Monday is index 1, Sunday is index 7
                    const isToday = days[dayMapIndex.indexOf(currentDayIndex === 0 ? 7 : currentDayIndex)] === day;
                    
                    return (
                      <div
                        key={day}
                        className={`flex justify-between text-xs font-semibold px-2 py-1 rounded transition border ${
                          isToday 
                            ? 'bg-primary/10 text-primary border-primary/20 dark:bg-primary-container/10 dark:text-primary-container/80 dark:border-primary-container/20' 
                            : 'text-slate-500 dark:text-slate-400 border-transparent'
                        }`}
                      >
                        <span>{day} {isToday && '(Today)'}</span>
                        <span className={hoursVal.toLowerCase() === 'closed' ? 'text-red-400 font-medium' : 'text-slate-800 dark:text-slate-300'}>
                          {hoursVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes & Follow-Up Section */}
              <div className="space-y-4 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Notes & Follow-Up
                </h4>

                {/* Follow-Up Date Picker */}
                <div>
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Schedule Follow-Up</label>
                  <input
                    type="datetime-local"
                    value={drawerFollowUpDate}
                    onChange={(e) => setDrawerFollowUpDate(e.target.value)}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition cursor-pointer"
                  />
                </div>

                {/* Call Notes Textarea */}
                <div>
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">Call Notes</label>
                  <textarea
                    value={drawerNotes}
                    onChange={(e) => setDrawerNotes(e.target.value)}
                    placeholder="Enter call notes, outcomes, or anything else…"
                    rows={4}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveDrawerDetails}
                  disabled={isSavingDetails}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingDetails ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {isSavingDetails ? 'Saving…' : 'Save Notes & Follow-Up'}
                </button>

                {/* Saved follow-up display */}
                {selectedLead.followUpDate && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 dark:text-blue-400">
                    <Calendar className="w-3 h-3" />
                    Scheduled: {new Date(selectedLead.followUpDate).toLocaleString()}
                  </div>
                )}
                
                {/* AI Generate Report Button */}
                <button
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport || !drawerNotes.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {isGeneratingReport ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingReport ? 'Generating Report...' : '✨ Generate AI Report'}
                </button>
              </div>


              {/* AI Report Box */}
              {(drawerAiReport || selectedLead.aiReport) && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
                  <div className="p-4 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        AI Meeting Report
                      </p>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">
                      {drawerAiReport || selectedLead.aiReport}
                    </div>
                  </div>
                </div>
              )}

              {/* Basic AI Insight Box (fallback) */}
              {!(drawerAiReport || selectedLead.aiReport) && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden group cursor-pointer hover:border-secondary/40 transition-colors">
                    <div className="absolute inset-0 opacity-5 bg-gradient-to-r from-secondary to-accent-blue group-hover:opacity-10 transition-opacity z-0 pointer-events-none" />
                    <Sparkles className="w-5 h-5 text-secondary relative z-10 flex-shrink-0" />
                    <div className="relative z-10">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">AI Insight</p>
                      <p className="text-xs text-slate-650 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                        {selectedLead.rating && selectedLead.rating >= 4.5 
                          ? 'High probability target based on stellar Google Maps rating and active local presence.' 
                          : 'Solid prospect clinic. Target with personalized automation outreach script.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </>
      )}

      {/* ── Tabbed AI Script Generation Modal ── */}
      {scriptModalOpen && activeScriptLead && scriptContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          {/* Modal Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl relative flex flex-col ai-gradient-border overflow-hidden animate-modal-in max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-gradient-to-r from-slate-50 to-purple-500/10 dark:from-slate-900 dark:to-purple-950/20 relative z-10">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
                  <BrainCircuit className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold ai-gradient-text flex items-center gap-2">
                    AI Cold Calling Script
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Personalized script for <span className="font-semibold text-slate-800 dark:text-slate-200">{activeScriptLead.businessName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScriptModalOpen(false)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50">
              {[
                { id: 'script', label: 'Call Script' },
                { id: 'objections', label: 'Objection Handlers' },
                { id: 'sms', label: 'SMS text' },
                { id: 'email', label: 'Email pitch' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setScriptActiveTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    scriptActiveTab === tab.id
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm border border-slate-800/10 dark:border-slate-200/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6 relative z-10 bg-white dark:bg-slate-900">
              {scriptActiveTab === 'script' && (
                <div className="space-y-6">
                  {/* Section 1: Opening */}
                  <div className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-[3px] before:h-full before:-bottom-6 before:bg-emerald-500/20">
                    <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10"></div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-450">1. Opening & Hook</h4>
                      <button
                        onClick={() => handleCopyText(`${scriptContent.opening}\n${scriptContent.reason}\n${scriptContent.personalizedLine}`, 'Opening Hook')}
                        className="text-slate-400 hover:text-emerald-500 transition cursor-pointer p-1"
                        title="Copy Opening Hook"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/80 dark:border-slate-855 rounded-2xl hover:bg-slate-100/30 dark:hover:bg-slate-950/80 transition-colors">
                      <p className="text-xs text-slate-800 dark:text-slate-250 leading-relaxed font-semibold">
                        "{scriptContent.opening}"
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-355 leading-relaxed font-semibold mt-3">
                        "{scriptContent.reason}"
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-355 leading-relaxed font-semibold mt-3">
                        "{scriptContent.personalizedLine}"
                      </p>
                    </div>
                  </div>

                  {/* Section 2: Pain Point */}
                  <div className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-[3px] before:h-full before:-bottom-6 before:bg-amber-500/20">
                    <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-500/10"></div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-450">2. Pain Point</h4>
                      <button
                        onClick={() => handleCopyText(scriptContent.painPoint, 'Pain Point')}
                        className="text-slate-400 hover:text-amber-500 transition cursor-pointer p-1"
                        title="Copy Pain Point"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/80 dark:border-slate-855 rounded-2xl hover:bg-slate-100/30 dark:hover:bg-slate-950/80 transition-colors">
                      <p className="text-xs text-slate-800 dark:text-slate-250 leading-relaxed font-semibold">
                        "{scriptContent.painPoint}"
                      </p>
                    </div>
                  </div>

                  {/* Section 3: Offer */}
                  <div className="relative pl-6">
                    <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-500/10"></div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-455">3. Automation Offer & CTA</h4>
                      <button
                        onClick={() => handleCopyText(`${scriptContent.offer}\n${scriptContent.callToAction}`, 'Offer & CTA')}
                        className="text-slate-400 hover:text-purple-500 transition cursor-pointer p-1"
                        title="Copy Offer & CTA"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="bg-purple-500/5 dark:bg-purple-450/5 border border-purple-500/10 dark:border-purple-400/20 p-4 rounded-2xl shadow-sm relative overflow-hidden group">
                      <div className="absolute right-[-20px] top-[-20px] opacity-5 transform rotate-12 transition-transform group-hover:scale-110 group-hover:opacity-10 pointer-events-none">
                        <Sparkles className="w-24 h-24 text-purple-500" />
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-bold relative z-10">
                        "{scriptContent.offer}"
                      </p>
                      <p className="text-xs text-slate-900 dark:text-white leading-relaxed font-extrabold mt-3.5 relative z-10 border-l-2 border-purple-500 pl-3">
                        "{scriptContent.callToAction}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {scriptActiveTab === 'objections' && (
                <div className="space-y-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">proven objection handlers</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(scriptContent.objectionHandling).map(([objection, response], idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-855 rounded-2xl p-4 text-xs space-y-2">
                        <span className="font-extrabold text-red-500 dark:text-red-400 block">Objection: "{objection}"</span>
                        <p className="text-slate-650 dark:text-slate-400 leading-relaxed font-semibold">"{response}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scriptActiveTab === 'sms' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Outbound SMS text pitch</span>
                    <button
                      onClick={() => handleCopyText(scriptContent.smsFollowUp, 'SMS text')}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy SMS
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-350 leading-relaxed font-mono whitespace-pre-wrap select-all">
                    {scriptContent.smsFollowUp}
                  </div>
                </div>
              )}

              {scriptActiveTab === 'email' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Email outbound pitch template</span>
                    <button
                      onClick={() => handleCopyText(scriptContent.emailFollowUp, 'Email outbound')}
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:underline cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Email
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-355 leading-relaxed font-mono whitespace-pre-wrap select-all">
                    {scriptContent.emailFollowUp}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center relative z-10">
              <button
                onClick={() => setScriptModalOpen(false)}
                className="font-body-sm text-body-sm text-slate-650 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-4 py-2 rounded-xl transition-colors focus:outline-none cursor-pointer font-bold"
              >
                Close
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleCopyText(scriptContent.smsFollowUp, 'SMS follow-up')}
                  className="flex items-center gap-2 font-body-sm text-body-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 px-4 py-2 rounded-xl shadow-sm transition-all focus:outline-none cursor-pointer font-bold"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                  Copy SMS
                </button>
                <button
                  onClick={() => {
                    const fullScript = `1. OPENING:\n"${scriptContent.opening}"\n"${scriptContent.reason}"\n"${scriptContent.personalizedLine}"\n\n2. PAIN POINT:\n"${scriptContent.painPoint}"\n\n3. OFFER & CTA:\n"${scriptContent.offer}"\n"${scriptContent.callToAction}"`;
                    handleCopyText(fullScript, 'Full Cold Script');
                  }}
                  className="flex items-center gap-2 font-body-sm text-body-sm bg-gradient-to-r from-primary to-secondary text-white px-5 py-2 rounded-xl shadow-md hover:opacity-90 hover:shadow-lg transition-all transform active:scale-98 focus:outline-none cursor-pointer font-bold"
                >
                  <Copy className="w-4 h-4" />
                  Copy Full Script
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
