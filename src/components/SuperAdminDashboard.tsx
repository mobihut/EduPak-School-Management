import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  Building2, 
  Users, 
  Ticket, 
  AlertTriangle,
  Loader2,
  TrendingUp,
  Activity
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, getCountFromServer } from 'firebase/firestore';

// --- Types ---
interface GlobalStats {
  totalMRR: number;
  activeTenants: number;
  totalUsers: number;
  openTickets: number;
  revenueHistory: { month: string; mrr: number }[];
  acquisitionHistory: { month: string; schools: number }[];
  userDistribution: { name: string; value: number }[];
}

interface RecentSchool {
  id: string;
  name: string;
  status: string;
  createdAt: any;
  adminEmail: string;
}

// --- Custom Hook for Efficient Data Fetching ---
const useGlobalStats = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [recentSchools, setRecentSchools] = useState<RecentSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Aggregated Global Stats (Cost Efficient: 1 Read)
        const statsDocRef = doc(db, 'platform_stats', 'global');
        const statsSnap = await getDoc(statsDocRef);
        
        let dashboardStats: GlobalStats;

        if (statsSnap.exists()) {
          dashboardStats = statsSnap.data() as GlobalStats;
        } else {
          // If aggregated doc doesn't exist, fetch real counts dynamically
          console.log("Aggregated stats not found, fetching live counts...");
          
          const schoolsCountSnap = await getCountFromServer(collection(db, 'schools'));
          const usersCountSnap = await getCountFromServer(collection(db, 'users'));
          
          const activeTenants = schoolsCountSnap.data().count;
          const totalUsers = usersCountSnap.data().count;
          
          // Simple revenue calculation: $99 per school per month
          const totalMRR = activeTenants * 99;

          dashboardStats = {
            totalMRR,
            activeTenants,
            totalUsers,
            openTickets: 0, // Default to 0 if no tickets collection yet
            revenueHistory: [
              { month: 'Current', mrr: totalMRR }
            ],
            acquisitionHistory: [
              { month: 'Current', schools: activeTenants }
            ],
            userDistribution: [
              { name: 'Total Users', value: totalUsers }
            ]
          };
        }

        setStats(dashboardStats);

        // 2. Fetch 5 Most Recent Schools
        const schoolsQuery = query(collection(db, 'schools'), orderBy('createdAt', 'desc'), limit(5));
        const schoolsSnap = await getDocs(schoolsQuery);
        const schoolsData = schoolsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as RecentSchool[];
        
        setRecentSchools(schoolsData);

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return { stats, recentSchools, loading, error };
};

// --- Cyberpunk Color Palette for Charts ---
const COLORS = {
  cyan: '#00f3ff',
  pink: '#ff00ff',
  purple: '#7000ff',
  green: '#00ff00',
  red: '#ff003c',
  gray: '#2a2a35'
};

const PIE_COLORS = [COLORS.cyan, COLORS.purple, COLORS.pink, COLORS.green];

// --- Main Component ---
interface SuperAdminDashboardProps {
  userProfile: any;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ userProfile }) => {
  // Security Context Check
  if (userProfile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4">
        <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-3xl max-w-md text-center shadow-[0_0_30px_rgba(255,0,60,0.2)]">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Access Denied</h2>
          <p className="text-red-200">This control room is restricted to Super Administrators only.</p>
        </div>
      </div>
    );
  }

  const { stats, recentSchools, loading, error } = useGlobalStats();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-neon-blue animate-spin" size={48} />
          <p className="text-neon-blue font-mono uppercase tracking-widest animate-pulse">Initializing Control Room...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black text-red-500 font-mono">
        Error loading dashboard: {error}
      </div>
    );
  }

  const hasHighTickets = stats.openTickets > 5;

  return (
    <div className="min-h-screen bg-cyber-black p-4 md:p-8 font-sans overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Activity className="text-neon-blue" size={36} />
              Super Admin <span className="text-neon-blue">Overview</span>
            </h1>
            <p className="text-gray-500 font-mono text-xs mt-2 uppercase tracking-widest opacity-80">Central Control Room • Live Metrics</p>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: MRR */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-cyber-gray/40 backdrop-blur-md border border-green-500/30 rounded-3xl p-6 relative overflow-hidden group"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 0, 0.1)' }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total MRR</p>
              <div className="p-2 bg-green-500/10 rounded-xl"><DollarSign className="text-green-500" size={20} /></div>
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              ${stats.totalMRR.toLocaleString()}<span className="text-sm text-gray-500 font-medium tracking-normal ml-1">/mo</span>
            </h3>
            <p className="text-green-400 text-xs font-bold mt-2 flex items-center gap-1"><TrendingUp size={12}/> +12.5% from last month</p>
          </motion.div>

          {/* Card 2: Active Tenants */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-cyber-gray/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-neon-blue/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Tenants</p>
              <div className="p-2 bg-neon-blue/10 rounded-xl"><Building2 className="text-neon-blue" size={20} /></div>
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">{stats.activeTenants}</h3>
            <p className="text-gray-500 text-xs font-bold mt-2">Schools Onboarded</p>
          </motion.div>

          {/* Card 3: Total Users */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-cyber-gray/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-neon-purple/30 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Platform Users</p>
              <div className="p-2 bg-neon-purple/10 rounded-xl"><Users className="text-neon-purple" size={20} /></div>
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">{stats.totalUsers.toLocaleString()}</h3>
            <p className="text-gray-500 text-xs font-bold mt-2">Total active accounts</p>
          </motion.div>

          {/* Card 4: Open Tickets */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className={`bg-cyber-gray/40 backdrop-blur-md border rounded-3xl p-6 relative overflow-hidden group transition-all ${hasHighTickets ? 'border-red-500/50 shadow-[0_0_20px_rgba(255,0,60,0.2)]' : 'border-white/5 hover:border-white/20'}`}
          >
            {hasHighTickets && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse" />}
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Open Tickets</p>
              <div className={`p-2 rounded-xl ${hasHighTickets ? 'bg-red-500/20' : 'bg-white/5'}`}>
                <Ticket className={hasHighTickets ? 'text-red-500' : 'text-gray-400'} size={20} />
              </div>
            </div>
            <h3 className={`text-3xl font-bold tracking-tight ${hasHighTickets ? 'text-red-500' : 'text-white'}`}>
              {stats.openTickets}
            </h3>
            <p className={`${hasHighTickets ? 'text-red-400' : 'text-gray-500'} text-xs font-bold mt-2`}>
              {hasHighTickets ? 'Requires immediate attention' : 'Within normal limits'}
            </p>
          </motion.div>
        </div>

        {/* Main Charts Grid (Bento Box) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Revenue Growth (Full Width on mobile, spans 2 cols on desktop) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-cyber-gray/30 border border-white/5 rounded-3xl p-6"
          >
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#00ff00]" />
              Revenue Growth & Projections
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a24', borderColor: 'rgba(0,255,0,0.3)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#00ff00', fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mrr" 
                    name="MRR"
                    stroke={COLORS.green} 
                    strokeWidth={3} 
                    dot={{ fill: COLORS.gray, stroke: COLORS.green, strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6, fill: COLORS.green, shadow: '0 0 10px #00ff00' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 2: Tenant Acquisition */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
            className="bg-cyber-gray/30 border border-white/5 rounded-3xl p-6"
          >
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_8px_#00f3ff]" />
              Tenant Acquisition
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.acquisitionHistory} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 243, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#1a1a24', borderColor: 'rgba(0,243,255,0.3)', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="schools" name="New Schools" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 3: User Distribution */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}
            className="bg-cyber-gray/30 border border-white/5 rounded-3xl p-6"
          >
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-purple shadow-[0_0_8px_#7000ff]" />
              User Distribution
            </h3>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.userDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.userDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a24', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#999' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>

        {/* Recent Activity Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="bg-cyber-gray/30 border border-white/5 rounded-3xl overflow-hidden"
        >
          <div className="p-6 border-b border-white/5">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Recent Registrations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                  <th className="p-4 font-black">School Name</th>
                  <th className="p-4 font-black">Admin Email</th>
                  <th className="p-4 font-black">Status</th>
                  <th className="p-4 font-black">Signup Date</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-300">
                {recentSchools.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 italic">No recent registrations found.</td>
                  </tr>
                ) : (
                  recentSchools.map((school, idx) => (
                    <tr key={school.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center text-neon-blue font-black text-xs">
                          {school.name.substring(0, 2).toUpperCase()}
                        </div>
                        {school.name}
                      </td>
                      <td className="p-4 text-gray-400">{school.adminEmail}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          school.status === 'trial' ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' :
                          school.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {school.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 font-mono text-xs">
                        {school.createdAt?.toDate ? school.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default SuperAdminDashboard;
