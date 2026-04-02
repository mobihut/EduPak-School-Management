import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  CreditCard, 
  BookOpen, 
  Calendar, 
  Bell, 
  ChevronRight, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  DollarSign,
  ArrowRight,
  User,
  LogOut,
  CreditCard as PaymentIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class_id: string;
  section: string;
  school_id: string;
  parent_uid: string;
  photo_url?: string;
}

interface AttendanceRecord {
  status: 'present' | 'absent' | 'late' | 'leave';
  date: Timestamp;
}

interface FeeRecord {
  id: string;
  amount: number;
  due_date: Timestamp;
  status: 'paid' | 'unpaid' | 'partial';
  type: string;
}

interface ExamResult {
  id: string;
  exam_name: string;
  percentage: number;
  grade: string;
  date: Timestamp;
}

interface ParentPortalDashboardProps {
  parentUid: string;
  parentName: string;
}

const ParentPortalDashboard: React.FC<ParentPortalDashboardProps> = ({ parentUid, parentName }) => {
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [pendingFees, setPendingFees] = useState<FeeRecord[]>([]);
  const [latestResult, setLatestResult] = useState<ExamResult | null>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);

  // 1. Hook-like logic to fetch children
  useEffect(() => {
    if (!parentUid) return;

    const q = query(
      collection(db, 'students'),
      where('parent_uid', '==', parentUid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const kids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setChildren(kids);
      if (kids.length > 0 && !selectedChild) {
        setSelectedChild(kids[0]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching children:", error);
      toast.error("Failed to load children data");
    });

    return () => unsubscribe();
  }, [parentUid]);

  // 2. Fetch specific child data when selectedChild changes
  useEffect(() => {
    if (!selectedChild) return;

    // Fetch Today's Attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attQuery = query(
      collection(db, 'attendance_records'),
      where('student_id', '==', selectedChild.id),
      where('date', '>=', Timestamp.fromDate(today))
    );

    const unsubAtt = onSnapshot(attQuery, (snapshot) => {
      if (!snapshot.empty) {
        // Assuming attendance_records has a 'records' array with student data
        const data = snapshot.docs[0].data();
        const record = data.records?.find((r: any) => r.student_id === selectedChild.id);
        if (record) {
          setTodayAttendance({ status: record.status, date: data.date });
        } else {
          setTodayAttendance(null);
        }
      } else {
        setTodayAttendance(null);
      }
    });

    // Fetch Pending Fees
    const feeQuery = query(
      collection(db, 'fee_invoices'),
      where('student_id', '==', selectedChild.id),
      where('status', 'in', ['unpaid', 'partial']),
      orderBy('due_date', 'asc')
    );

    const unsubFees = onSnapshot(feeQuery, (snapshot) => {
      setPendingFees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeeRecord)));
    });

    // Fetch Latest Exam Results
    const resQuery = query(
      collection(db, 'exam_marks'),
      where('student_id', '==', selectedChild.id),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubRes = onSnapshot(resQuery, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setLatestResult({ 
          id: snapshot.docs[0].id, 
          exam_name: data.subject, // Using subject as exam name for now
          percentage: Math.round((data.marks_obtained / data.total_marks) * 100),
          grade: 'A', // Mock grade
          date: data.timestamp 
        } as ExamResult);
      } else {
        setLatestResult(null);
      }
    });

    // Fetch School Notices
    const noticeQuery = query(
      collection(db, 'announcements'),
      where('school_id', '==', selectedChild.school_id),
      orderBy('created_at', 'desc'),
      limit(5)
    );

    const unsubNotice = onSnapshot(noticeQuery, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAtt();
      unsubFees();
      unsubRes();
      unsubNotice();
    };
  }, [selectedChild]);

  const totalOutstanding = pendingFees.reduce((sum, fee) => sum + fee.amount, 0);

  const handlePayment = (fee: FeeRecord) => {
    setSelectedFee(fee);
    setIsPaymentModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white pb-24 font-sans selection:bg-neon-blue selection:text-black">
      {/* Header & Multi-Child Switcher */}
      <header className="bg-cyber-gray/40 backdrop-blur-xl border-b border-white/5 pt-8 pb-4 px-6 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black text-neon-blue uppercase tracking-[0.3em] mb-1">Parent Portal</p>
            <h1 className="text-2xl font-black tracking-tighter">Welcome, <span className="text-white/70">{parentName}</span></h1>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-400 hover:text-white"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Child Switcher */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child)}
              className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
                selectedChild?.id === child.id 
                ? 'bg-neon-blue/10 border-neon-blue/40 text-neon-blue' 
                : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                selectedChild?.id === child.id ? 'border-neon-blue/30 bg-neon-blue/20' : 'border-white/10 bg-white/5'
              }`}>
                {child.photo_url ? (
                  <img src={child.photo_url} alt={child.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wider leading-none mb-1">{child.name.split(' ')[0]}</p>
                <p className="text-[10px] font-medium opacity-60">Class {child.class_id}</p>
              </div>
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 mt-6 space-y-6">
        {/* Quick Alerts Strip */}
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md ${
            todayAttendance?.status === 'present' 
            ? 'bg-green-500/5 border-green-500/20 text-green-400' 
            : todayAttendance?.status === 'absent'
            ? 'bg-red-500/5 border-red-500/20 text-red-400'
            : 'bg-white/5 border-white/10 text-gray-400'
          }`}>
            <div className="flex items-center gap-3">
              {todayAttendance?.status === 'present' ? <CheckCircle2 size={20} /> : todayAttendance?.status === 'absent' ? <XCircle size={20} /> : <Clock size={20} />}
              <span className="text-sm font-bold uppercase tracking-widest">
                Today's Attendance: {todayAttendance?.status ? todayAttendance.status.toUpperCase() : 'NOT MARKED'}
              </span>
            </div>
            <ChevronRight size={16} className="opacity-40" />
          </div>

          <div className="flex items-center gap-3 p-4 bg-neon-purple/5 border border-neon-purple/20 rounded-2xl text-neon-purple">
            <AlertCircle size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Upcoming: Parent-Teacher Meeting on Friday</span>
          </div>
        </div>

        {/* 2x2 Grid Action Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Fees */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-cyber-gray/40 border border-white/5 p-5 rounded-[2.5rem] flex flex-col justify-between h-48 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign size={64} className="text-neon-blue" />
            </div>
            <div>
              <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center mb-4 border border-neon-blue/20">
                <CreditCard size={20} className="text-neon-blue" />
              </div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Fees & Dues</p>
              <h3 className="text-xl font-black text-white">PKR {totalOutstanding.toLocaleString()}</h3>
            </div>
            <button 
              onClick={() => pendingFees.length > 0 && handlePayment(pendingFees[0])}
              className="w-full py-2 bg-neon-blue text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.3)] active:shadow-none transition-all"
            >
              Pay Now
            </button>
          </motion.div>

          {/* Card 2: Academic Progress */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-cyber-gray/40 border border-white/5 p-5 rounded-[2.5rem] flex flex-col justify-between h-48 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={64} className="text-neon-green" />
            </div>
            <div>
              <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center mb-4 border border-neon-green/20">
                <BookOpen size={20} className="text-neon-green" />
              </div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Academics</p>
              <h3 className="text-xl font-black text-white">{latestResult ? `${latestResult.percentage}%` : 'N/A'}</h3>
              <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">{latestResult ? latestResult.exam_name : 'No recent results'}</p>
            </div>
            <div className="flex items-center gap-1 text-neon-green text-[10px] font-black uppercase tracking-widest">
              View Report <ArrowRight size={12} />
            </div>
          </motion.div>

          {/* Card 3: Timetable & Attendance */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-cyber-gray/40 border border-white/5 p-5 rounded-[2.5rem] flex flex-col justify-between h-48 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar size={64} className="text-neon-purple" />
            </div>
            <div>
              <div className="w-10 h-10 bg-neon-purple/10 rounded-xl flex items-center justify-center mb-4 border border-neon-purple/20">
                <Calendar size={20} className="text-neon-purple" />
              </div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Schedule</p>
              <h3 className="text-xl font-black text-white">Class {selectedChild?.class_id}</h3>
              <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">Section {selectedChild?.section}</p>
            </div>
            <div className="flex items-center gap-1 text-neon-purple text-[10px] font-black uppercase tracking-widest">
              Timetable <ArrowRight size={12} />
            </div>
          </motion.div>

          {/* Card 4: Noticeboard */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="bg-cyber-gray/40 border border-white/5 p-5 rounded-[2.5rem] flex flex-col justify-between h-48 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bell size={64} className="text-neon-orange" />
            </div>
            <div>
              <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center mb-4 border border-neon-orange/20">
                <Bell size={20} className="text-neon-orange" />
              </div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Notices</p>
              <h3 className="text-xl font-black text-white">{notices.length}</h3>
              <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">New Announcements</p>
            </div>
            <div className="flex items-center gap-1 text-neon-orange text-[10px] font-black uppercase tracking-widest">
              Read All <ArrowRight size={12} />
            </div>
          </motion.div>
        </div>

        {/* Recent Activity / Timeline */}
        <div className="bg-cyber-gray/20 border border-white/5 rounded-[2.5rem] p-6">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Clock size={14} /> Recent Activity
          </h3>
          <div className="space-y-6">
            {notices.slice(0, 3).map((notice, idx) => (
              <div key={notice.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-neon-blue rounded-full shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
                  {idx !== 2 && <div className="w-px h-full bg-white/10 mt-2"></div>}
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-wider mb-1">{notice.title}</p>
                  <p className="text-[10px] text-gray-500 line-clamp-1">{notice.content}</p>
                  <p className="text-[9px] text-gray-600 font-bold uppercase mt-2">
                    {notice.created_at?.toDate().toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Payment Gateway Modal Placeholder */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-[#121214] border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] p-8 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <PaymentIcon size={120} className="text-neon-blue" />
              </div>

              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="w-12 h-12 bg-neon-blue/10 rounded-2xl flex items-center justify-center mb-4 border border-neon-blue/20">
                    <PaymentIcon size={24} className="text-neon-blue" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tighter">Fee Payment</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Secure Gateway</p>
                </div>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 text-gray-400 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Student</span>
                  <span className="text-xs font-black text-white uppercase tracking-wider">{selectedChild?.name}</span>
                </div>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Fee Type</span>
                  <span className="text-xs font-black text-white uppercase tracking-wider">{selectedFee?.type || 'Monthly Tuition'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount Due</span>
                  <span className="text-xl font-black text-neon-blue">PKR {selectedFee?.amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    toast.success("Redirecting to Stripe...");
                    setTimeout(() => setIsPaymentModalOpen(false), 2000);
                  }}
                  className="w-full py-4 bg-white text-black text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors"
                >
                  Pay with Credit Card
                </button>
                <button 
                  onClick={() => {
                    toast.success("Redirecting to JazzCash...");
                    setTimeout(() => setIsPaymentModalOpen(false), 2000);
                  }}
                  className="w-full py-4 bg-[#d41c1c] text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-[#b01717] transition-colors"
                >
                  Pay with JazzCash
                </button>
                <p className="text-[9px] text-center text-gray-600 font-bold uppercase tracking-widest mt-4">
                  Encrypted & Secure Payment Processing
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0c]/80 backdrop-blur-2xl border-t border-white/5 px-8 py-4 flex justify-between items-center z-40">
        <button className="flex flex-col items-center gap-1 text-neon-blue">
          <Home size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <BookOpen size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Academics</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <CreditCard size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Fees</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500">
          <Bell size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Notices</span>
        </button>
      </nav>
    </div>
  );
};

const Home = ({ size }: { size: number }) => <Users size={size} />;

export default ParentPortalDashboard;
