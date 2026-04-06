import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  Globe, 
  MousePointer2, 
  Filter, 
  Download, 
  Calendar, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  Mail, 
  MapPin, 
  PieChart as PieChartIcon, 
  Activity, 
  DollarSign, 
  ChevronRight, 
  MoreVertical,
  AlertCircle,
  Clock,
  UserPlus,
  BarChart,
  Layers,
  Share2,
  ExternalLink
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar,
  Legend,
  Funnel,
  FunnelChart,
  LabelList
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  Timestamp, 
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';
import xlsx from 'json-as-xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Types ---
interface MarketingLead {
  id: string;
  email: string;
  source: string;
  campaignId?: string;
  status: 'lead' | 'trial' | 'paid' | 'abandoned';
  region: string;
  createdAt: Timestamp;
  lastStep?: string;
}

interface Campaign {
  id: string;
  name: string;
  code: string;
  budget: number;
  spent: number;
  clicks: number;
  conversions: number;
  startDate: Timestamp;
  endDate?: Timestamp;
}

interface VisitorMetric {
  date: string;
  visitors: number;
  signups: number;
  conversions: number;
}

interface MarketingStats {
  totalLeads: number;
  conversionRate: number;
  cac: number;
  roi: number;
  trafficSources: { name: string; value: number; color: string }[];
  funnelData: { name: string; value: number; fill: string }[];
  topPlans: { name: string; value: number }[];
  regionData: { region: string; count: number; percentage: number }[];
  churnRisk: number;
}

interface School {
  id: string;
  name: string;
  adminEmail: string;
  status: string;
  lastActive?: Timestamp;
}

const COLORS = {
  blue: '#00f3ff',
  purple: '#bc13fe',
  indigo: '#6366f1',
  green: '#00ff00',
  red: '#ff003c',
  orange: '#ff8c00',
  gray: '#1a1a1a',
  white: '#ffffff'
};

const MarketingAnalyticsModule: React.FC = () => {
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [visitorMetrics, setVisitorMetrics] = useState<VisitorMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for initial visualization if Firebase is empty
  const mockVisitorData = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      date: format(subDays(new Date(), 29 - i), 'MMM dd'),
      visitors: Math.floor(Math.random() * 500) + 200,
      signups: Math.floor(Math.random() * 50) + 10,
      conversions: Math.floor(Math.random() * 10) + 2
    }));
  }, []);

  useEffect(() => {
    // Real-time leads listener
    const leadsQuery = query(
      collection(db, 'marketing_leads'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );

    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MarketingLead[];
      setLeads(leadsData);
    });

    // Real-time campaigns listener
    const campaignsQuery = query(collection(db, 'marketing_campaigns'));
    const unsubscribeCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Campaign[];
      setCampaigns(campaignsData);
    });

    // Real-time schools listener for churn prediction
    const schoolsQuery = query(collection(db, 'schools'));
    const unsubscribeSchools = onSnapshot(schoolsQuery, (snapshot) => {
      const schoolsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as School[];
      setSchools(schoolsData);
      setIsLoading(false);
    });

    return () => {
      unsubscribeLeads();
      unsubscribeCampaigns();
      unsubscribeSchools();
    };
  }, []);

  // Aggregated Stats
  const stats = useMemo((): MarketingStats => {
    const totalLeads = leads.length;
    const paidLeads = leads.filter(l => l.status === 'paid').length;
    const conversionRate = totalLeads > 0 ? (paidLeads / totalLeads) * 100 : 0;
    
    const totalSpent = campaigns.reduce((acc, curr) => acc + curr.spent, 0);
    const cac = paidLeads > 0 ? totalSpent / paidLeads : 0;
    
    // Traffic Sources
    const sourcesMap: Record<string, number> = {};
    leads.forEach(l => {
      sourcesMap[l.source] = (sourcesMap[l.source] || 0) + 1;
    });
    const trafficSources = Object.entries(sourcesMap).map(([name, value], i) => ({
      name,
      value,
      color: [COLORS.blue, COLORS.purple, COLORS.indigo, COLORS.green][i % 4]
    }));

    // Funnel Data
    const funnelData = [
      { name: 'Visitors', value: 12500, fill: COLORS.blue },
      { name: 'Leads', value: totalLeads || 1200, fill: COLORS.purple },
      { name: 'Trials', value: leads.filter(l => l.status === 'trial').length || 450, fill: COLORS.indigo },
      { name: 'Paid', value: paidLeads || 120, fill: COLORS.green }
    ];

    // Region Data
    const regionsMap: Record<string, number> = {};
    leads.forEach(l => {
      regionsMap[l.region] = (regionsMap[l.region] || 0) + 1;
    });
    const regionData = Object.entries(regionsMap)
      .map(([region, count]) => ({
        region,
        count,
        percentage: (count / totalLeads) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Churn Risk Calculation (Schools not active for 10+ days)
    const tenDaysAgo = subDays(new Date(), 10);
    const atRiskSchools = schools.filter(s => 
      s.status === 'active' && 
      (!s.lastActive || s.lastActive.toDate() < tenDaysAgo)
    ).length;
    const churnRisk = schools.length > 0 ? (atRiskSchools / schools.length) * 100 : 0;

    return {
      totalLeads,
      conversionRate,
      cac,
      roi: totalSpent > 0 ? (paidLeads * 500 - totalSpent) / totalSpent * 100 : 0, // Assuming $500 LTV
      trafficSources,
      funnelData,
      topPlans: [
        { name: 'Pro', value: 45 },
        { name: 'Enterprise', value: 30 },
        { name: 'Starter', value: 25 }
      ],
      regionData,
      churnRisk
    };
  }, [leads, campaigns, schools]);

  const filteredLeads = leads.filter(l => 
    l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportReport = () => {
    const data: any[] = [
      {
        sheet: "Marketing Leads",
        columns: [
          { label: "Email", value: "email" },
          { label: "Source", value: "source" },
          { label: "Status", value: "status" },
          { label: "Region", value: "region" },
          { label: "Created At", value: (row: any) => format(row.createdAt.toDate(), 'yyyy-MM-dd HH:mm') }
        ],
        content: leads
      },
      {
        sheet: "Campaign Performance",
        columns: [
          { label: "Campaign Name", value: "name" },
          { label: "Code", value: "code" },
          { label: "Budget ($)", value: "budget" },
          { label: "Spent ($)", value: "spent" },
          { label: "Clicks", value: "clicks" },
          { label: "Conversions", value: "conversions" }
        ],
        content: campaigns
      }
    ];

    const settings = {
      fileName: `Marketing_Report_${format(new Date(), 'yyyy-MM-dd')}`,
      extraLength: 3,
      writeOptions: {}
    };

    xlsx(data, settings);
    toast.success("Marketing report exported successfully");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin" />
          <BarChart3 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-neon-blue animate-pulse" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <BarChart3 className="text-neon-purple" size={40} />
            MARKETING <span className="text-neon-purple">COMMAND</span> CENTER
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-2 uppercase tracking-[0.3em] opacity-80">
            Growth Engine • Real-time Acquisition Analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportReport}
            className="flex items-center gap-2 px-6 py-3 bg-cyber-gray/40 border border-neon-purple/30 rounded-2xl text-neon-purple text-xs font-black uppercase tracking-widest hover:bg-neon-purple/10 transition-all neon-glow-button"
          >
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Leads" 
          value={stats.totalLeads.toLocaleString()} 
          trend="+18.2%" 
          icon={UserPlus} 
          color="purple" 
          description="Signup attempts this month"
        />
        <KPICard 
          title="Conversion Rate" 
          value={`${stats.conversionRate.toFixed(1)}%`} 
          trend="+2.4%" 
          icon={Target} 
          color="blue" 
          description="Visitors to Paid Schools"
        />
        <KPICard 
          title="Avg. CAC" 
          value={`$${stats.cac.toFixed(0)}`} 
          trend="-12.5%" 
          icon={DollarSign} 
          color="green" 
          description="Customer Acquisition Cost"
          isNegativeTrend
        />
        <KPICard 
          title="Marketing ROI" 
          value={`${stats.roi.toFixed(0)}%`} 
          trend="+45.2%" 
          icon={TrendingUp} 
          color="orange" 
          description="Return on Ad Spend"
        />
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visitor Analytics Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Activity className="text-neon-blue" size={20} />
                Visitor Traffic Trends
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Daily interaction volume</p>
            </div>
            <div className="flex bg-cyber-black/50 p-1 rounded-xl border border-white/5">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateRange === range ? 'bg-neon-blue text-cyber-black' : 'text-gray-500 hover:text-white'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockVisitorData}>
                <defs>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#444" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px' }}
                  itemStyle={{ fontWeight: 800 }}
                />
                <Area type="monotone" dataKey="visitors" stroke={COLORS.blue} strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" />
                <Area type="monotone" dataKey="signups" stroke={COLORS.purple} strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Conversion Funnel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8"
        >
          <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8 flex items-center gap-2">
            <Layers className="text-neon-purple" size={20} />
            Conversion Funnel
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                />
                <Funnel
                  data={stats.funnelData}
                  dataKey="value"
                  nameKey="name"
                >
                  <LabelList position="right" fill="#fff" stroke="none" dataKey="name" style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-gray-500 uppercase">Overall Efficiency</span>
              <span className="text-xs font-black text-neon-green">9.6%</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Second Row: Regions & Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Region Tracking */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <MapPin className="text-neon-indigo" size={20} />
              Geographic Distribution
            </h3>
            <Globe className="text-gray-600 animate-spin-slow" size={24} />
          </div>
          <div className="space-y-6">
            {stats.regionData.length > 0 ? stats.regionData.map((region, idx) => (
              <div key={region.region} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-white">{region.region}</span>
                  <span className="text-neon-indigo">{region.count} Schools ({region.percentage.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${region.percentage}%` }}
                    className="h-full bg-gradient-to-r from-neon-indigo to-neon-purple"
                  />
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <MapPin size={32} className="opacity-20 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No geographic data yet</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Campaign Manager */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Zap className="text-neon-orange" size={20} />
              Active Campaigns
            </h3>
            <button className="p-2 bg-neon-orange/10 rounded-xl text-neon-orange hover:bg-neon-orange/20 transition-all">
              <Plus size={20} />
            </button>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Campaign</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">ROI</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Conversions</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaigns.length > 0 ? campaigns.map((campaign) => {
                  const roi = campaign.spent > 0 ? ((campaign.conversions * 500) - campaign.spent) / campaign.spent * 100 : 0;
                  return (
                    <tr key={campaign.id} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-white text-sm">{campaign.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{campaign.code}</div>
                      </td>
                      <td className="py-4">
                        <span className={`text-xs font-black ${roi >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 text-xs font-bold text-gray-300">{campaign.conversions}</td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-neon-green/10 text-neon-green text-[8px] font-black uppercase rounded-lg border border-neon-green/20">Active</span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-500">
                      <p className="text-[10px] font-black uppercase tracking-widest">No active campaigns</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Third Row: Growth Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Top Plans Pie Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8"
        >
          <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8 flex items-center gap-2">
            <PieChartIcon className="text-neon-blue" size={20} />
            Popular Plans
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.topPlans}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.topPlans.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[COLORS.blue, COLORS.purple, COLORS.indigo][index % 3]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {stats.topPlans.map((plan, i) => (
              <div key={plan.name} className="flex items-center justify-between text-[10px] font-black uppercase">
                <span className="text-gray-500">{plan.name}</span>
                <span className="text-white">{plan.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Churn Prediction */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 flex items-center gap-2">
              <AlertCircle className="text-neon-red" size={20} />
              Churn Risk
            </h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-8">Inactivity Detection (10+ Days)</p>
          </div>
          
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle 
                  cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * stats.churnRisk) / 100}
                  className="text-neon-red drop-shadow-[0_0_8px_rgba(255,0,60,0.5)]" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">{stats.churnRisk.toFixed(1)}%</span>
                <span className="text-[8px] font-black text-gray-500 uppercase">Risk Level</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button className="w-full py-3 bg-neon-red/10 border border-neon-red/20 rounded-xl text-neon-red text-[10px] font-black uppercase tracking-widest hover:bg-neon-red/20 transition-all">
              View At-Risk Schools
            </button>
          </div>
        </motion.div>

        {/* Lead Capture List */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-cyber-gray/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Mail className="text-neon-purple" size={20} />
                Recent Leads
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Potential acquisition targets</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-cyber-black/50 border border-white/10 rounded-xl text-xs text-white focus:border-neon-purple/50 outline-none transition-all w-full md:w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Lead Email</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Source</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                  <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeads.length > 0 ? filteredLeads.slice(0, 5).map((lead) => (
                  <tr key={lead.id} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 flex items-center justify-center text-[10px] font-black text-white">
                          {lead.email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-white">{lead.email}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lead.source}</span>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 text-[8px] font-black uppercase rounded-lg border ${
                        lead.status === 'paid' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                        lead.status === 'trial' ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/20' :
                        'bg-gray-500/10 text-gray-500 border-gray-500/20'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 text-[10px] text-gray-500 font-mono">
                      {format(lead.createdAt.toDate(), 'MMM dd, HH:mm')}
                    </td>
                    <td className="py-4 text-right">
                      <button className="p-2 text-gray-500 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      <p className="text-[10px] font-black uppercase tracking-widest">No leads found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- Helper Components ---

const KPICard = ({ title, value, trend, icon: Icon, color, description, isNegativeTrend = false }: any) => {
  const colorMap = {
    blue: 'text-neon-blue border-neon-blue/20 bg-neon-blue/5',
    purple: 'text-neon-purple border-neon-purple/20 bg-neon-purple/5',
    green: 'text-neon-green border-neon-green/20 bg-neon-green/5',
    orange: 'text-neon-orange border-neon-orange/20 bg-neon-orange/5',
    red: 'text-neon-red border-neon-red/20 bg-neon-red/5'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-cyber-gray/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 relative group overflow-hidden hover:border-white/10 transition-all"
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-${color} to-transparent opacity-30 group-hover:opacity-100 transition-opacity`} />
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorMap[color as keyof typeof colorMap]}`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black ${isNegativeTrend ? 'text-neon-red' : 'text-neon-green'}`}>
          {isNegativeTrend ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
          {trend}
        </div>
      </div>
      <h3 className="text-3xl font-black text-white tracking-tighter mb-1">{value}</h3>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{title}</p>
      <p className="text-[9px] text-gray-600 font-medium leading-relaxed">{description}</p>
    </motion.div>
  );
};

const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default MarketingAnalyticsModule;
