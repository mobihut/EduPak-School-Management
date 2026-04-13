import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Search, 
  Plus, 
  Download, 
  Printer, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  Calendar, 
  DollarSign, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  History, 
  Settings, 
  FileText, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  ChevronRight, 
  Smartphone, 
  Zap, 
  Clock, 
  ShieldCheck,
  Briefcase,
  Wallet,
  Receipt,
  MessageSquare,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  getDocs,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Types ---

interface FeeHead {
  id: string;
  name: string;
  description: string;
  schoolId: string;
}

interface FeeGroup {
  id: string;
  name: string;
  classId: string;
  heads: {
    headId: string;
    amount: number;
    isRecurring: boolean;
  }[];
  schoolId: string;
}

interface Discount {
  id: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  schoolId: string;
}

interface FeeVoucher {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  classId: string;
  month: string;
  year: number;
  totalAmount: number;
  discountAmount: number;
  fineAmount: number;
  paidAmount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  dueDate: any;
  schoolId: string;
  items: {
    name: string;
    amount: number;
  }[];
}

interface Transaction {
  id: string;
  voucherId: string;
  studentId: string;
  amount: number;
  paymentMode: 'cash' | 'bank' | 'online';
  collectedBy: string;
  timestamp: any;
  schoolId: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: any;
  schoolId: string;
}

// --- Constants ---

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COLORS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

// --- Components ---

const FeeCollectionModule: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'collection' | 'structure' | 'reports' | 'generation'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Generation States
  const [genMonth, setGenMonth] = useState(MONTHS[new Date().getMonth()]);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genClass, setGenClass] = useState('all');
  
  // Data States
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [feeGroups, setFeeGroups] = useState<FeeGroup[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [vouchers, setVouchers] = useState<FeeVoucher[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank' | 'online'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    const unsubHeads = onSnapshot(query(collection(db, 'fee_heads'), where('schoolId', '==', schoolId)), (snap) => {
      setFeeHeads(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeeHead)));
    });

    const unsubGroups = onSnapshot(query(collection(db, 'fee_groups'), where('schoolId', '==', schoolId)), (snap) => {
      setFeeGroups(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeeGroup)));
    });

    const unsubDiscounts = onSnapshot(query(collection(db, 'fee_discounts'), where('schoolId', '==', schoolId)), (snap) => {
      setDiscounts(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Discount)));
    });

    const unsubVouchers = onSnapshot(
      query(collection(db, 'fee_vouchers'), where('schoolId', '==', schoolId), orderBy('dueDate', 'desc'), limit(100)),
      (snap) => {
        setVouchers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeeVoucher)));
        setLoading(false);
      }
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'fee_transactions'), where('schoolId', '==', schoolId), orderBy('timestamp', 'desc'), limit(50)),
      (snap) => {
        setTransactions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction)));
      }
    );

    const unsubExpenses = onSnapshot(query(collection(db, 'school_expenses'), where('schoolId', '==', schoolId)), (snap) => {
      setExpenses(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Expense)));
    });

    const unsubStudents = onSnapshot(query(collection(db, 'students'), where('school_id', '==', schoolId), where('status', '==', 'active')), (snap) => {
      setStudents(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
    });

    return () => {
      unsubHeads();
      unsubGroups();
      unsubDiscounts();
      unsubVouchers();
      unsubTransactions();
      unsubExpenses();
      unsubStudents();
    };
  }, [schoolId]);

  // Search Logic
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const lowerQuery = searchQuery.toLowerCase();
    
    // Find students matching query
    const matchingStudents = students.filter(s => 
      `${s.personal_info?.firstName} ${s.personal_info?.lastName}`.toLowerCase().includes(lowerQuery) || 
      s.academic_info?.rollNumber?.includes(searchQuery)
    );

    return matchingStudents.map(student => {
      const voucher = vouchers.find(v => v.studentId === student.id && v.month === genMonth && v.year === genYear);
      return {
        student,
        voucher: voucher || null
      };
    });
  }, [searchQuery, students, vouchers, genMonth, genYear]);

  const handleGenerateIndividualVoucher = async (student: any) => {
    setIsProcessing(true);
    try {
      const groupsSnap = await getDocs(query(collection(db, 'fee_groups'), where('schoolId', '==', schoolId)));
      const groups = groupsSnap.docs.map(d => ({ ...d.data(), id: d.id } as FeeGroup));
      
      const studentClass = student.academic_info?.grade;
      const group = groups.find(g => g.classId === studentClass);
      
      if (!group) {
        toast.error(`No fee group found for Class ${studentClass}`);
        return;
      }

      const items = group.heads.map(h => ({
        name: feeHeads.find(fh => fh.id === h.headId)?.name || 'Fee Item',
        amount: h.amount
      }));
      const totalAmount = items.reduce((acc, item) => acc + item.amount, 0);
      
      const voucherData = {
        studentId: student.id,
        studentName: `${student.personal_info?.firstName} ${student.personal_info?.lastName}`,
        rollNo: student.academic_info?.rollNumber || 'N/A',
        classId: studentClass,
        month: genMonth,
        year: genYear,
        totalAmount,
        discountAmount: 0,
        fineAmount: 0,
        paidAmount: 0,
        balance: totalAmount,
        status: 'unpaid',
        dueDate: Timestamp.fromDate(new Date(genYear, MONTHS.indexOf(genMonth), 10)),
        schoolId,
        items,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'fee_vouchers'), voucherData);
      setSelectedStudent({ ...voucherData, id: docRef.id });
      toast.success("Voucher generated successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCollectFee = async (voucher: FeeVoucher) => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid amount");
    if (amount > voucher.balance) return toast.error("Amount exceeds balance");

    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const voucherRef = doc(db, 'fee_vouchers', voucher.id);
        const vDoc = await transaction.get(voucherRef);
        if (!vDoc.exists()) throw new Error("Voucher not found");

        const currentPaid = vDoc.data().paidAmount || 0;
        const newPaid = currentPaid + amount;
        const newBalance = vDoc.data().totalAmount + vDoc.data().fineAmount - vDoc.data().discountAmount - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : 'partial';

        transaction.update(voucherRef, {
          paidAmount: newPaid,
          balance: newBalance,
          status: newStatus,
          updatedAt: serverTimestamp()
        });

        const txRef = doc(collection(db, 'fee_transactions'));
        transaction.set(txRef, {
          voucherId: voucher.id,
          studentId: voucher.studentId,
          studentName: voucher.studentName,
          amount,
          paymentMode,
          collectedBy: auth.currentUser?.displayName || 'Admin',
          timestamp: serverTimestamp(),
          schoolId
        });
      });

      toast.success("Payment collected successfully!");
      generateReceipt(voucher, amount);
      setPaymentAmount('');
      setSelectedStudent(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateVouchers = async () => {
    setIsProcessing(true);
    try {
      // 1. Fetch Students
      let studentsQuery = query(collection(db, 'students'), where('school_id', '==', schoolId), where('status', '==', 'active'));
      if (genClass !== 'all') {
        studentsQuery = query(studentsQuery, where('academic_info.grade', '==', genClass));
      }
      const studentsSnap = await getDocs(studentsQuery);
      const studentsToProcess = studentsSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));

      if (studentsToProcess.length === 0) {
        toast.error("No active students found for the selected criteria.");
        return;
      }

      // 2. Fetch Fee Groups
      const groupsSnap = await getDocs(query(collection(db, 'fee_groups'), where('schoolId', '==', schoolId)));
      const groups = groupsSnap.docs.map(d => ({ ...d.data(), id: d.id } as FeeGroup));

      // 3. Process each student
      let generatedCount = 0;
      let skippedCount = 0;

      for (const student of studentsToProcess) {
        // Check if voucher already exists
        const existingVoucherQuery = query(
          collection(db, 'fee_vouchers'),
          where('schoolId', '==', schoolId),
          where('studentId', '==', student.id),
          where('month', '==', genMonth),
          where('year', '==', genYear)
        );
        const existingSnap = await getDocs(existingVoucherQuery);
        if (!existingSnap.empty) {
          skippedCount++;
          continue;
        }

        // Find Fee Group for student's class
        const studentClass = student.academic_info?.grade;
        const group = groups.find(g => g.classId === studentClass);
        if (!group) continue;

        // Calculate amounts
        const items = group.heads.map(h => ({
          name: feeHeads.find(fh => fh.id === h.headId)?.name || 'Fee Item',
          amount: h.amount
        }));
        const totalAmount = items.reduce((acc, item) => acc + item.amount, 0);
        
        const discountAmount = 0;
        const fineAmount = 0;
        const balance = totalAmount + fineAmount - discountAmount;

        // Create Voucher
        await addDoc(collection(db, 'fee_vouchers'), {
          studentId: student.id,
          studentName: `${student.personal_info?.firstName} ${student.personal_info?.lastName}`,
          rollNo: student.academic_info?.rollNumber || 'N/A',
          classId: studentClass,
          month: genMonth,
          year: genYear,
          totalAmount,
          discountAmount,
          fineAmount,
          paidAmount: 0,
          balance,
          status: 'unpaid',
          dueDate: Timestamp.fromDate(new Date(genYear, MONTHS.indexOf(genMonth), 10)),
          schoolId,
          items,
          createdAt: serverTimestamp()
        });
        generatedCount++;
      }

      toast.success(`Generated ${generatedCount} vouchers. Skipped ${skippedCount} existing.`);
      setActiveTab('collection');
    } catch (err: any) {
      toast.error("Error generating vouchers: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceipt = (voucher: FeeVoucher, amount: number) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(168, 85, 247); // Neon Purple
    doc.text("EDUPAK FINANCIALS", 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("OFFICIAL FEE RECEIPT", 105, 28, { align: 'center' });
    
    // Receipt Info
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receipt No: #${Math.floor(Math.random() * 1000000)}`, 20, 45);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 45);
    
    // Student Details
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 55, 170, 30, 'F');
    doc.setFontSize(10);
    doc.text(`Student: ${voucher.studentName}`, 25, 65);
    doc.text(`Roll No: ${voucher.rollNo}`, 25, 75);
    doc.text(`Class: ${voucher.classId}`, 120, 65);
    doc.text(`Month: ${voucher.month} ${voucher.year}`, 120, 75);
    
    // Payment Details
    doc.setFontSize(14);
    doc.text("Payment Summary", 20, 100);
    
    let y = 110;
    doc.setFontSize(10);
    doc.text("Description", 20, y);
    doc.text("Amount", 170, y, { align: 'right' });
    doc.line(20, y + 2, 190, y + 2);
    
    y += 10;
    doc.text(`Fee Payment (${paymentMode.toUpperCase()})`, 20, y);
    doc.text(`PKR ${amount.toLocaleString()}`, 170, y, { align: 'right' });
    
    y += 20;
    doc.setFontSize(12);
    doc.text("Total Paid:", 120, y);
    doc.text(`PKR ${amount.toLocaleString()}`, 170, y, { align: 'right' });
    
    y += 10;
    doc.setTextColor(255, 0, 0);
    doc.text("Remaining Balance:", 120, y);
    doc.text(`PKR ${(voucher.balance - amount).toLocaleString()}`, 170, y, { align: 'right' });
    
    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text("This is a computer-generated receipt and does not require a physical signature.", 105, 280, { align: 'center' });
    
    doc.save(`Receipt_${voucher.studentName}_${Date.now()}.pdf`);
  };

  const dashboardStats = useMemo(() => {
    const totalCollected = transactions.reduce((acc, t) => acc + t.amount, 0);
    const totalDues = vouchers.reduce((acc, v) => acc + v.balance, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    
    return {
      collected: totalCollected,
      dues: totalDues,
      expenses: totalExpenses,
      profit: totalCollected - totalExpenses
    };
  }, [transactions, vouchers, expenses]);

  const chartData = useMemo(() => {
    // Mocking last 7 days for area chart
    return [
      { day: 'Mon', collected: 45000, expected: 50000 },
      { day: 'Tue', collected: 52000, expected: 50000 },
      { day: 'Wed', collected: 38000, expected: 50000 },
      { day: 'Thu', collected: 65000, expected: 50000 },
      { day: 'Fri', collected: 48000, expected: 50000 },
      { day: 'Sat', collected: 25000, expected: 30000 },
      { day: 'Sun', collected: 12000, expected: 15000 },
    ];
  }, []);

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-purple/10 border border-neon-purple/20 mb-4"
          >
            <ShieldCheck className="text-neon-purple" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-purple">Secure Financial Engine</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Fee <span className="text-neon-purple">Collection.</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-cyber-gray/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2 border-r border-white/10">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Today's Cash</p>
            <p className="text-lg font-black text-white">PKR 124,500</p>
          </div>
          <button className="p-3 bg-neon-purple text-black rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'dashboard', label: 'Financial Overview', icon: BarChart3 },
          { id: 'generation', label: 'Generate Slips', icon: Printer },
          { id: 'collection', label: 'Collect Fee', icon: Wallet },
          { id: 'structure', label: 'Fee Structure', icon: Settings },
          { id: 'reports', label: 'Reports & Expenses', icon: FileText },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-neon-purple text-white border-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                : 'bg-cyber-gray/40 text-gray-500 border-white/5 hover:border-white/10'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Collected', value: `PKR ${dashboardStats.collected.toLocaleString()}`, icon: ArrowUpRight, color: 'text-green-400', trend: '+15%' },
                { label: 'Outstanding Dues', value: `PKR ${dashboardStats.dues.toLocaleString()}`, icon: AlertCircle, color: 'text-red-400', trend: 'Defaulters' },
                { label: 'Total Expenses', value: `PKR ${dashboardStats.expenses.toLocaleString()}`, icon: ArrowDownRight, color: 'text-yellow-400', trend: '-5%' },
                { label: 'Net Profit', value: `PKR ${dashboardStats.profit.toLocaleString()}`, icon: Zap, color: 'text-neon-purple', trend: 'Healthy' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`p-3 bg-white/5 rounded-2xl border border-white/5 ${stat.color}`}>
                      <stat.icon size={20} />
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest bg-white/5 ${stat.color}`}>
                      {stat.trend}
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white uppercase tracking-tighter">{stat.value}</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Revenue Forecast</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-neon-purple" />
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Collected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Expected</span>
                    </div>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="collected" stroke="#A855F7" fillOpacity={1} fill="url(#colorColl)" strokeWidth={3} />
                      <Area type="monotone" dataKey="expected" stroke="#333" fill="transparent" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Collection by Mode</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Cash', value: 65 },
                          { name: 'Bank', value: 25 },
                          { name: 'Online', value: 10 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4 mt-4">
                  {[
                    { label: 'Cash Payments', val: '65%', color: 'bg-neon-purple' },
                    { label: 'Bank Transfers', val: '25%', color: 'bg-blue-500' },
                    { label: 'Online Portal', val: '10%', color: 'bg-green-500' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-black text-white">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'generation' && (
          <motion.div 
            key="generation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-[3rem] border border-white/5 space-y-12">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-neon-purple/10 rounded-[2rem] flex items-center justify-center mx-auto border border-neon-purple/20">
                  <Printer className="text-neon-purple" size={40} />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Bulk Fee Generation</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                  Generate monthly fee slips for all students or specific classes in one click.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Billing Month</label>
                  <select 
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-neon-purple/50 outline-none transition-all"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Billing Year</label>
                  <select 
                    value={genYear}
                    onChange={(e) => setGenYear(parseInt(e.target.value))}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-neon-purple/50 outline-none transition-all"
                  >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Target Class</label>
                  <select 
                    value={genClass}
                    onChange={(e) => setGenClass(e.target.value)}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-neon-purple/50 outline-none transition-all"
                  >
                    <option value="all">All Classes</option>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-neon-purple/5 p-8 rounded-3xl border border-neon-purple/10 space-y-4">
                <div className="flex items-start gap-4">
                  <AlertCircle className="text-neon-purple shrink-0" size={20} />
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight">Important Note</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-1 leading-relaxed">
                      The system will automatically skip students who already have a voucher generated for the selected month and year. 
                      Fee amounts are calculated based on the assigned Fee Group for each student's class.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleGenerateVouchers}
                disabled={isProcessing}
                className="w-full py-6 bg-neon-purple text-black rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-3"
              >
                {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <><Zap size={20} /> Generate Fee Slips Now</>}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'collection' && (
          <motion.div 
            key="collection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Search & Selection */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Quick Search</h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text"
                    placeholder="Search by Name or Roll No..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:border-neon-purple/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                  {searchResults.map(({ student, voucher }) => (
                    <div 
                      key={student.id}
                      onClick={() => voucher ? setSelectedStudent(voucher) : setSelectedStudent({ student, isNew: true })}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        (selectedStudent?.id === voucher?.id || selectedStudent?.student?.id === student.id)
                          ? 'bg-neon-purple/10 border-neon-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                          : 'bg-white/5 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-white uppercase tracking-widest">
                          {student.personal_info?.firstName} {student.personal_info?.lastName}
                        </p>
                        {voucher ? (
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                            voucher.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                            voucher.status === 'partial' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {voucher.status}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-white/10 text-gray-400">
                            No Slip
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Roll: {student.academic_info?.rollNumber}</p>
                        {voucher && <p className="text-[10px] font-black text-neon-purple">PKR {voucher.balance.toLocaleString()}</p>}
                      </div>
                    </div>
                  ))}
                  {searchQuery && searchResults.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No students found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Interface */}
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence mode="wait">
                {selectedStudent?.isNew ? (
                  <motion.div 
                    key="generate-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-[2.5rem] border border-white/5 text-center space-y-8"
                  >
                    <div className="w-20 h-20 bg-neon-purple/10 rounded-[2rem] flex items-center justify-center mx-auto border border-neon-purple/20">
                      <Receipt className="text-neon-purple" size={40} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                        {selectedStudent.student.personal_info?.firstName} {selectedStudent.student.personal_info?.lastName}
                      </h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">
                        No fee slip found for {genMonth} {genYear}
                      </p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5 max-w-sm mx-auto">
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        Generate a new fee slip for this student based on their class ({selectedStudent.student.academic_info?.grade}) fee structure.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleGenerateIndividualVoucher(selectedStudent.student)}
                      disabled={isProcessing}
                      className="px-12 py-4 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center gap-3 mx-auto"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <><Plus size={16} /> Generate Individual Slip</>}
                    </button>
                  </motion.div>
                ) : selectedStudent ? (
                  <motion.div 
                    key="payment-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-neon-purple/20 rounded-2xl flex items-center justify-center border border-neon-purple/30">
                          <Users className="text-neon-purple" size={32} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedStudent.studentName}</h3>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Class {selectedStudent.classId} • Roll No: {selectedStudent.rollNo}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedStudent(null)} className="p-2 text-gray-500 hover:text-white">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Payable</p>
                        <p className="text-xl font-black text-white">PKR {selectedStudent.totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Already Paid</p>
                        <p className="text-xl font-black text-green-400">PKR {selectedStudent.paidAmount.toLocaleString()}</p>
                      </div>
                      <div className="p-6 bg-neon-purple/10 rounded-3xl border border-neon-purple/20">
                        <p className="text-[8px] font-black text-neon-purple uppercase tracking-widest mb-1">Current Balance</p>
                        <p className="text-xl font-black text-white">PKR {selectedStudent.balance.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Adjust Discount</label>
                        <div className="flex gap-2">
                          <select 
                            onChange={(e) => {
                              const discount = discounts.find(d => d.id === e.target.value);
                              if (discount) {
                                // Update voucher in Firestore
                                const newDiscount = discount.type === 'percentage' 
                                  ? (selectedStudent.totalAmount * discount.value / 100)
                                  : discount.value;
                                updateDoc(doc(db, 'fee_vouchers', selectedStudent.id), {
                                  discountAmount: newDiscount,
                                  balance: selectedStudent.totalAmount + selectedStudent.fineAmount - newDiscount - selectedStudent.paidAmount
                                });
                              }
                            }}
                            className="flex-grow bg-cyber-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:border-neon-purple/50 outline-none transition-all"
                          >
                            <option value="">Select Discount...</option>
                            {discounts.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.value}{d.type === 'percentage' ? '%' : ' PKR'})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Add Fine</label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            placeholder="Fine Amount..."
                            onBlur={(e) => {
                              const fine = parseFloat(e.target.value) || 0;
                              updateDoc(doc(db, 'fee_vouchers', selectedStudent.id), {
                                fineAmount: fine,
                                balance: selectedStudent.totalAmount + fine - selectedStudent.discountAmount - selectedStudent.paidAmount
                              });
                            }}
                            className="flex-grow bg-cyber-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:border-neon-purple/50 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Amount</label>
                        <div className="relative">
                          <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-neon-purple" size={24} />
                          <input 
                            type="number"
                            placeholder="0.00"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full bg-cyber-black/50 border border-white/10 rounded-[2rem] pl-16 pr-8 py-6 text-2xl font-black text-white focus:border-neon-purple/50 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Mode</label>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { id: 'cash', label: 'Cash', icon: Wallet },
                            { id: 'bank', label: 'Bank', icon: Briefcase },
                            { id: 'online', label: 'Online', icon: Zap },
                          ].map((mode) => (
                            <button 
                              key={mode.id}
                              onClick={() => setPaymentMode(mode.id as any)}
                              className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${
                                paymentMode === mode.id 
                                  ? 'bg-neon-purple text-black border-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                                  : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'
                              }`}
                            >
                              <mode.icon size={24} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{mode.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => handleCollectFee(selectedStudent)}
                        disabled={isProcessing}
                        className="w-full py-6 bg-neon-purple text-black rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-3"
                      >
                        {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> Confirm & Generate Receipt</>}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="no-selection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center p-12 bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 border-dashed"
                  >
                    <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6">
                      <Search className="text-gray-600" size={48} />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Select a Student</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto mt-2 leading-relaxed">
                      Search and select a student from the directory to view their dues and collect payments.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'structure' && (
          <motion.div 
            key="structure"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Fee Heads */}
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Fee Heads</h3>
                <button className="p-2 bg-neon-purple/10 text-neon-purple rounded-xl border border-neon-purple/20">
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-4">
                {feeHeads.map(head => (
                  <div key={head.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-neon-purple/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-cyber-black rounded-xl text-neon-purple">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest">{head.name}</p>
                        <p className="text-[10px] text-gray-500">{head.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-gray-500 hover:text-white"><Edit2 size={14} /></button>
                      <button className="p-2 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Groups */}
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Fee Groups (Class-wise)</h3>
                <button className="p-2 bg-neon-purple/10 text-neon-purple rounded-xl border border-neon-purple/20">
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-4">
                {feeGroups.map(group => (
                  <div key={group.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-neon-purple/20 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">{group.name}</h4>
                      <span className="text-[8px] font-black px-2 py-1 bg-neon-purple/10 text-neon-purple rounded uppercase">Class {group.classId}</span>
                    </div>
                    <div className="space-y-2">
                      {group.heads.map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500 uppercase tracking-widest font-bold">
                            {feeHeads.find(fh => fh.id === h.headId)?.name || 'Unknown'}
                          </span>
                          <span className="text-white font-black">PKR {h.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Monthly</span>
                      <span className="text-sm font-black text-neon-purple">
                        PKR {group.heads.reduce((acc, h) => acc + h.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Defaulters List */}
            <div className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Defaulters List</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Students with outstanding dues</p>
                </div>
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
                    <MessageSquare size={16} /> Send Bulk Reminders
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Student</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Class</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Total Due</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Last Payment</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {vouchers.filter(v => v.status !== 'paid').map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.01] transition-colors group">
                        <td className="px-8 py-6">
                          <p className="text-xs font-black text-white uppercase tracking-widest">{v.studentName}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Roll: {v.rollNo}</p>
                        </td>
                        <td className="px-8 py-6 text-xs text-gray-400">Class {v.classId}</td>
                        <td className="px-8 py-6 text-xs font-black text-red-400">PKR {v.balance.toLocaleString()}</td>
                        <td className="px-8 py-6 text-xs text-gray-500">12 days ago</td>
                        <td className="px-8 py-6 text-right">
                          <button className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-neon-purple transition-all">
                            <MessageSquare size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses Tracker */}
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Expense Tracker</h3>
                <button className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">
                  <Plus size={16} /> Add Expense
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expenses.map(exp => (
                  <div key={exp.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-yellow-500/20 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500">
                        <ArrowDownRight size={20} />
                      </div>
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{exp.category}</span>
                    </div>
                    <p className="text-xl font-black text-white">PKR {exp.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 mt-2 line-clamp-1">{exp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeeCollectionModule;
