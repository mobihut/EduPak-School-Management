import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Download, 
  Filter, 
  Search, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Building2,
  CreditCard,
  FileText,
  PieChart as PieChartIcon,
  Plus,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Clock,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp, 
  limit 
} from 'firebase/firestore';
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import xlsx from 'json-as-xlsx';
import { toast } from 'sonner';

// --- Types ---
interface SchoolBilling {
  id: string;
  name: string;
  plan: string;
  billingDate: any;
  status: 'Paid' | 'Overdue';
  mrr: number;
  category: string;
  paymentMethod: 'Stripe' | 'Bank Transfer' | 'Cash';
  lastPaymentDate: any;
}

interface PlatformExpense {
  id: string;
  category: string;
  amount: number;
  date: any;
  description: string;
}

interface FinancialSummary {
  totalMRR: number;
  pendingReceivables: number;
  netProfitMargin: number;
  churnRate: number;
  revenueGrowth: number;
}

// --- Components ---

const FinancialReportsModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [billings, setBillings] = useState<SchoolBilling[]>([]);
  const [expenses, setExpenses] = useState<PlatformExpense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'Server', amount: 0, description: '' });

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Schools for Billing
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        const schoolsData = schoolsSnap.docs.map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate() || new Date();
          const billingDate = new Date(createdAt);
          billingDate.setMonth(new Date().getMonth());
          
          // Determine status (Overdue if billing date was > 7 days ago and not paid)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const isOverdue = isBefore(billingDate, sevenDaysAgo) && data.subscriptionStatus !== 'active';

          return {
            id: doc.id,
            name: data.name || 'Unknown School',
            plan: data.plan || 'Standard',
            billingDate: Timestamp.fromDate(billingDate),
            status: isOverdue ? 'Overdue' : 'Paid',
            mrr: data.plan === 'Premium' ? 199 : (data.plan === 'Enterprise' ? 499 : 99),
            category: data.category || 'Private',
            paymentMethod: data.paymentMethod || 'Stripe',
            lastPaymentDate: data.lastPaymentDate || data.createdAt
          } as SchoolBilling;
        });
        setBillings(schoolsData);

        // 2. Fetch Expenses
        const expensesSnap = await getDocs(query(collection(db, 'platform_expenses'), orderBy('date', 'desc')));
        const expensesData = expensesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PlatformExpense[];
        setExpenses(expensesData);

      } catch (error) {
        console.error("Error fetching financial data:", error);
        toast.error("Failed to load financial reports");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Calculations ---
  const summary = useMemo((): FinancialSummary => {
    const totalMRR = billings.reduce((sum, b) => sum + b.mrr, 0);
    const pendingReceivables = billings.filter(b => b.status === 'Overdue').reduce((sum, b) => sum + b.mrr, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    const netProfit = totalMRR - (totalExpenses / 12); // Approximate monthly expense
    const netProfitMargin = totalMRR > 0 ? (netProfit / totalMRR) * 100 : 0;
    
    // Mock churn rate for demo
    const churnRate = 2.4; 
    const revenueGrowth = 15.8;

    return { totalMRR, pendingReceivables, netProfitMargin, churnRate, revenueGrowth };
  }, [billings, expenses]);

  const revenueHistory = useMemo(() => {
    // Generate mock history based on current MRR
    return Array.from({ length: 12 }).map((_, i) => {
      const month = format(subMonths(new Date(), 11 - i), 'MMM');
      const factor = 0.8 + (i * 0.05); // Gradual growth
      return {
        month,
        revenue: Math.round(summary.totalMRR * factor),
        expenses: Math.round((summary.totalMRR * 0.3) * (0.9 + Math.random() * 0.2))
      };
    });
  }, [summary.totalMRR]);

  const forecastingData = useMemo(() => {
    const lastRevenue = revenueHistory[revenueHistory.length - 1].revenue;
    const growthRate = 0.05; // 5% monthly growth
    return Array.from({ length: 4 }).map((_, i) => {
      const month = format(subMonths(new Date(), -i), 'MMM');
      return {
        month,
        projected: Math.round(lastRevenue * Math.pow(1 + growthRate, i))
      };
    });
  }, [revenueHistory]);

  // --- Handlers ---
  const handleAddExpense = async () => {
    if (newExpense.amount <= 0 || !newExpense.description) {
      toast.error("Please provide valid expense details");
      return;
    }

    try {
      const expenseData = {
        ...newExpense,
        date: Timestamp.now()
      };
      const docRef = await addDoc(collection(db, 'platform_expenses'), expenseData);
      setExpenses([{ id: docRef.id, ...expenseData }, ...expenses]);
      setShowExpenseModal(false);
      setNewExpense({ category: 'Server', amount: 0, description: '' });
      toast.success("Expense logged successfully");
    } catch (error) {
      toast.error("Failed to log expense");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'platform_expenses', id));
      setExpenses(expenses.filter(e => e.id !== id));
      toast.success("Expense deleted");
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  const exportToExcel = () => {
    const data: any[] = [
      {
        sheet: "Tenant Billing",
        columns: [
          { label: "School Name", value: "name" },
          { label: "Plan", value: "plan" },
          { label: "MRR ($)", value: "mrr" },
          { label: "Status", value: "status" },
          { label: "Category", value: "category" },
          { label: "Payment Method", value: "paymentMethod" }
        ],
        content: billings
      },
      {
        sheet: "Platform Expenses",
        columns: [
          { label: "Category", value: "category" },
          { label: "Amount ($)", value: "amount" },
          { label: "Description", value: "description" },
          { label: "Date", value: (row: any) => format(row.date.toDate(), 'yyyy-MM-dd') }
        ],
        content: expenses
      }
    ];

    const settings = {
      fileName: `Financial_Audit_${format(new Date(), 'yyyy-MM-dd')}`,
      extraLength: 3,
      writeOptions: {}
    };

    xlsx(data, settings);
    toast.success("Excel report exported");
  };

  const generateInvoice = (school: SchoolBilling) => {
    const doc = new jsPDF();
    const taxRate = 0.15; // 15% GST
    const taxAmount = school.mrr * taxRate;
    const totalAmount = school.mrr + taxAmount;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 243, 255); // Neon Blue
    doc.text("EDUPAK PLATFORM INVOICE", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice Date: ${format(new Date(), 'PPP')}`, 20, 40);
    doc.text(`Invoice ID: INV-${school.id.slice(0, 8).toUpperCase()}`, 20, 45);

    // School Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Bill To:", 20, 60);
    doc.setFont("helvetica", "bold");
    doc.text(school.name, 20, 65);
    doc.setFont("helvetica", "normal");
    doc.text(`Plan: ${school.plan}`, 20, 70);

    // Table
    (doc as any).autoTable({
      startY: 80,
      head: [['Description', 'Amount', 'Tax (15%)', 'Total']],
      body: [
        [`${school.plan} Subscription - ${format(new Date(), 'MMMM yyyy')}`, `$${school.mrr.toFixed(2)}`, `$${taxAmount.toFixed(2)}`, `$${totalAmount.toFixed(2)}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 243, 255] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text(`Total Due: $${totalAmount.toFixed(2)}`, 140, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Thank you for choosing EduPak. Please pay within 7 days.", 105, 280, { align: 'center' });

    doc.save(`Invoice_${school.name.replace(/\s+/g, '_')}_${format(new Date(), 'MMM_yyyy')}.pdf`);
    toast.success("Invoice generated");
  };

  const filteredBillings = billings.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || b.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#00f3ff]" />
        <p className="text-neon-blue font-mono uppercase tracking-widest animate-pulse">Aggregating Financial Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
            <DollarSign className="text-neon-green" size={32} />
            Financial <span className="text-neon-green">Engine</span>
          </h2>
          <p className="text-gray-500 font-mono text-xs mt-1 uppercase tracking-widest">Real-time Revenue & Expense Analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-xs font-bold uppercase tracking-widest transition-all"
          >
            <Download size={16} />
            Export Audit
          </button>
          <button 
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/30 rounded-xl text-neon-green text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,255,0,0.1)]"
          >
            <Plus size={16} />
            Log Expense
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total MRR', value: `$${summary.totalMRR.toLocaleString()}`, trend: `+${summary.revenueGrowth}%`, icon: TrendingUp, color: 'neon-green', sub: 'Monthly Recurring' },
          { label: 'Receivables', value: `$${summary.pendingReceivables.toLocaleString()}`, trend: 'Action Required', icon: AlertCircle, color: 'neon-red', sub: 'Unpaid Subscriptions' },
          { label: 'Profit Margin', value: `${summary.netProfitMargin.toFixed(1)}%`, trend: 'Healthy', icon: Zap, color: 'neon-blue', sub: 'Net After Expenses' },
          { label: 'Churn Rate', value: `${summary.churnRate}%`, trend: '-0.2%', icon: TrendingDown, color: 'neon-orange', sub: 'Lost Subscriptions' },
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-${kpi.color}/20 relative group overflow-hidden`}
          >
            <div className={`absolute top-0 left-0 w-full h-1 bg-${kpi.color} opacity-20 group-hover:opacity-50 transition-opacity`} />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-cyber-black/50 border border-white/5 text-${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full bg-cyber-black/50 text-${kpi.color} border border-${kpi.color}/20`}>
                {kpi.trend}
              </span>
            </div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{kpi.label}</h3>
            <p className="text-3xl font-black text-white tracking-tighter mb-1">{kpi.value}</p>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Revenue Analytics</h3>
              <p className="text-xs text-gray-500 font-mono">12-Month Performance Trend</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-blue" />
                <span className="text-[10px] font-black text-gray-500 uppercase">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-purple" />
                <span className="text-[10px] font-black text-gray-500 uppercase">Expenses</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#bf00ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#bf00ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 10, fontWeight: 900 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 10, fontWeight: 900 }}
                  tickFormatter={(val) => `$${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#00f3ff" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" stroke="#bf00ff" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col">
          <div className="mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Predictive Forecast</h3>
            <p className="text-xs text-gray-500 font-mono">Next 3 Months Projection</p>
          </div>
          <div className="flex-1 space-y-6">
            {forecastingData.slice(1).map((data, i) => (
              <div key={i} className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-neon-blue/30 transition-all">
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">{data.month} Projection</p>
                  <p className="text-2xl font-black text-white tracking-tighter">${data.projected.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center text-neon-blue group-hover:scale-110 transition-transform">
                  <ArrowUpRight size={20} />
                </div>
              </div>
            ))}
            <div className="mt-auto p-4 bg-neon-blue/5 rounded-2xl border border-neon-blue/10">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-neon-blue" size={14} />
                <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">AI Insight</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Based on current growth of 5.2% MoM, your MRR is expected to cross <span className="text-white font-bold">$100k</span> by Q3.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Billing Table */}
      <div className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Tenant Billing</h3>
            <p className="text-xs text-gray-500 font-mono">Manage School Subscriptions & Invoices</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="text"
                placeholder="Search schools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-cyber-black border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-neon-blue transition-all w-64"
              />
            </div>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-cyber-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-neon-blue transition-all"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cyber-black/50">
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">School</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Plan</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Billing Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBillings.map((school) => (
                <tr key={school.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center text-neon-blue">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{school.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono uppercase">{school.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400 uppercase`}>
                      {school.plan}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-mono text-gray-400">{format(school.billingDate.toDate(), 'MMM dd, yyyy')}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-white">${school.mrr}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${school.status === 'Paid' ? 'bg-neon-green' : 'bg-neon-red animate-pulse'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${school.status === 'Paid' ? 'text-neon-green' : 'text-neon-red'}`}>
                        {school.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => generateInvoice(school)}
                      className="p-2 hover:bg-neon-blue/10 rounded-lg text-gray-500 hover:text-neon-blue transition-all"
                      title="Download Invoice"
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses & P&L Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Platform Expenses</h3>
              <p className="text-xs text-gray-500 font-mono">Recent Operational Costs</p>
            </div>
            <div className="p-3 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 text-neon-purple">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                    {expense.category === 'Server' ? <Zap size={18} /> : <CreditCard size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{expense.description}</p>
                    <p className="text-[10px] text-gray-600 uppercase font-black">{expense.category} • {format(expense.date.toDate(), 'MMM dd')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-black text-neon-red">-${expense.amount}</p>
                  <button 
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-neon-red/10 rounded-lg text-gray-600 hover:text-neon-red transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="text-center py-12 text-gray-600 font-mono text-sm">No expenses logged yet.</div>
            )}
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Profit & Loss Summary</h3>
              <p className="text-xs text-gray-500 font-mono">Monthly Financial Health</p>
            </div>
            <div className="p-3 rounded-2xl bg-neon-green/10 border border-neon-green/20 text-neon-green">
              <PieChartIcon size={20} />
            </div>
          </div>
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-cyber-black/50 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Revenue</span>
                <span className="text-sm font-black text-neon-green">+${summary.totalMRR.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-neon-green"
                />
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-cyber-black/50 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Expenses</span>
                <span className="text-sm font-black text-neon-red">-${(expenses.reduce((s, e) => s + e.amount, 0) / 12).toFixed(2)}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(expenses.reduce((s, e) => s + e.amount, 0) / (summary.totalMRR * 12)) * 100}%` }}
                  className="h-full bg-neon-red"
                />
              </div>
            </div>
            <div className="p-8 rounded-3xl bg-gradient-to-br from-neon-blue/10 to-transparent border border-neon-blue/20 text-center">
              <p className="text-[10px] font-black text-neon-blue uppercase tracking-[0.3em] mb-2">Net Monthly Profit</p>
              <p className="text-5xl font-black text-white tracking-tighter mb-2">
                ${(summary.totalMRR - (expenses.reduce((s, e) => s + e.amount, 0) / 12)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <div className="flex items-center justify-center gap-2 text-neon-green">
                <ArrowUpRight size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Growing 12% MoM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExpenseModal(false)}
              className="absolute inset-0 bg-cyber-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-cyber-gray p-8 rounded-[2.5rem] border border-white/10 max-w-md w-full relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Log Platform Expense</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Category</label>
                  <select 
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as any })}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue transition-all"
                  >
                    <option value="Server">Server Infrastructure</option>
                    <option value="API">API & Third Party</option>
                    <option value="Staff">Staff Salaries</option>
                    <option value="Marketing">Marketing & Ads</option>
                    <option value="Other">Other Costs</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Amount ($)</label>
                  <input 
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Description</label>
                  <textarea 
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue transition-all min-h-[100px] resize-none"
                    placeholder="What is this expense for?"
                  />
                </div>
                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => setShowExpenseModal(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 font-bold uppercase tracking-widest text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddExpense}
                    className="flex-1 py-4 bg-neon-blue text-cyber-black font-black uppercase tracking-widest text-xs rounded-2xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all"
                  >
                    Log Expense
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinancialReportsModule;
