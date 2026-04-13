import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Users, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  FileText, 
  MessageSquare, 
  Bell, 
  LogOut, 
  ChevronRight, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Plus, 
  Send, 
  Home, 
  GraduationCap, 
  Wallet, 
  ClipboardList, 
  Menu, 
  X,
  ArrowRight,
  Info,
  RefreshCw,
  Layout,
  Settings,
  ShieldCheck,
  Briefcase,
  Plane,
  HeartPulse,
  Baby,
  AlertTriangle,
  Trophy,
  Star,
  Zap,
  Smartphone,
  Cake,
  Megaphone,
  History,
  FileDown,
  ChevronLeft,
  MoreHorizontal,
  Check
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
  setDoc,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { format, isToday, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import confetti from 'canvas-confetti';

// --- Types ---

interface Student {
  uid: string;
  name: string;
  rollNo: string;
  classId: string;
  sectionId: string;
  photoURL?: string;
  schoolId: string;
  parentId: string;
  attendancePercentage?: number;
  dob?: string; // YYYY-MM-DD
  grade?: string;
}

interface FeeVoucher {
  id: string;
  studentId: string;
  month: string;
  year: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  dueDate: any;
}

interface Homework {
  id: string;
  subject: string;
  content: string;
  date: string;
  classId: string;
  sectionId: string;
  isDone?: boolean;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'on-leave' | 'holiday';
}

interface ExamResult {
  id: string;
  termName: string;
  marks: Record<string, { total: number; obtained: number; grade: string }>;
  percentage: number;
  overallGrade: string;
  remarks?: string;
}

interface SyllabusTopic {
  id: string;
  subject: string;
  topic: string;
  isCompleted: boolean;
}

interface SchoolAnnouncement {
  id: string;
  title: string;
  content: string;
  type: 'urgent' | 'info' | 'event';
  timestamp: any;
}

interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  type: 'academic' | 'sports' | 'meeting';
}

// --- Components ---

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

const GlassCard = ({ children, className, accentColor = "blue" }: { children: React.ReactNode, className?: string, accentColor?: string }) => {
  const accentClasses: Record<string, string> = {
    blue: "shadow-blue-500/10 border-blue-500/20",
    green: "shadow-emerald-500/10 border-emerald-500/20",
    purple: "shadow-purple-500/10 border-purple-500/20",
    orange: "shadow-orange-500/10 border-orange-500/20",
    pink: "shadow-pink-500/10 border-pink-500/20",
  };

  return (
    <div className={`bg-white/80 backdrop-blur-xl border rounded-[2.5rem] p-6 shadow-2xl ${accentClasses[accentColor]} ${className}`}>
      {children}
    </div>
  );
};

const ParentPortalDashboard: React.FC<{ parentId: string; schoolId: string }> = ({ parentId, schoolId }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'fees' | 'results' | 'profile' | 'notifications'>('home');
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [vouchers, setVouchers] = useState<FeeVoucher[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBirthday, setIsBirthday] = useState(false);
  const [fetchTimeout, setFetchTimeout] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setLoading(false);
        setError("User not authenticated. Please log in again.");
      }
    });
    return () => unsubscribe();
  }, []);

  // Selected Child Data
  const selectedChild = useMemo(() => children.find(c => c.uid === selectedChildId), [children, selectedChildId]);

  useEffect(() => {
    if (!authReady || !parentId || !schoolId) return;

    setLoading(true);
    setError(null);
    setFetchTimeout(false);

    const timeoutId = setTimeout(() => {
      if (loading) {
        setFetchTimeout(true);
        setLoading(false);
      }
    }, 10000); // 10s timeout

    // Fetch Children
    const q = query(
      collection(db, 'students'),
      where('school_id', '==', schoolId),
      where('parent_uid', '==', parentId)
    );

    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(timeoutId);
      const childrenData = snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Student));
      setChildren(childrenData);
      if (childrenData.length > 0 && !selectedChildId) {
        setSelectedChildId(childrenData[0].uid);
      }
      setLoading(false);
    }, (err) => {
      clearTimeout(timeoutId);
      console.error("Error fetching children:", err);
      if (err.message.includes('permission-denied')) {
        setError("Security Access Error: Please contact Super Admin to verify your Role.");
      } else {
        setError("Failed to load children data. Please try again.");
      }
      setLoading(false);
    });

    // Fetch Announcements
    const annUnsub = onSnapshot(
      query(collection(db, 'global_announcements'), where('target_audience', 'in', ['all', schoolId]), orderBy('created_at', 'desc'), limit(5)),
      (snap) => setAnnouncements(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SchoolAnnouncement))),
      (err) => console.error("Error fetching announcements:", err)
    );

    return () => {
      unsub();
      annUnsub();
      clearTimeout(timeoutId);
    };
  }, [authReady, parentId, schoolId]);

  useEffect(() => {
    if (!authReady || !selectedChildId || !selectedChild) return;

    // Check Birthday
    if (selectedChild.dob) {
      const today = new Date();
      const dob = new Date(selectedChild.dob);
      if (today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate()) {
        setIsBirthday(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
        });
      } else {
        setIsBirthday(false);
      }
    }

    // Fetch Fees
    const feeUnsub = onSnapshot(
      query(collection(db, 'fee_invoices'), where('student_id', '==', selectedChildId), orderBy('due_date', 'desc'), limit(10)),
      (snap) => setVouchers(snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          studentId: data.student_id,
          month: data.month,
          year: new Date(data.due_date).getFullYear(),
          totalAmount: data.total_amount,
          paidAmount: data.paid_amount,
          balance: data.total_amount - data.paid_amount,
          status: data.status,
          dueDate: data.due_date
        } as FeeVoucher;
      })),
      (err) => console.error("Error fetching fees:", err)
    );

    // Fetch Homework (Assignments)
    const hwUnsub = onSnapshot(
      query(
        collection(db, 'assignments'), 
        where('class', '==', selectedChild.classId),
        where('section', '==', selectedChild.sectionId),
        orderBy('due_date', 'desc'),
        limit(10)
      ),
      (snap) => setHomework(snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          subject: data.subject,
          content: data.description,
          date: data.due_date,
          classId: data.class,
          sectionId: data.section
        } as Homework;
      })),
      (err) => console.error("Error fetching homework:", err)
    );

    // Fetch Attendance
    const attUnsub = onSnapshot(
      query(collection(db, 'attendance_records'), where('school_id', '==', schoolId), limit(31)),
      (snap) => {
        // Filter records for this student locally since they are stored in an array
        const studentRecords: AttendanceRecord[] = [];
        snap.docs.forEach(doc => {
          const data = doc.data();
          const record = data.records.find((r: any) => r.student_id === selectedChildId);
          if (record) {
            studentRecords.push({
              id: doc.id,
              date: data.date,
              status: record.status === 'P' ? 'present' : record.status === 'A' ? 'absent' : 'on-leave'
            });
          }
        });
        setAttendance(studentRecords);
      },
      (err) => console.error("Error fetching attendance:", err)
    );

    // Fetch Results
    const resUnsub = onSnapshot(
      query(collection(db, 'exam_marks'), where('student_id', '==', selectedChildId)),
      (snap) => {
        // Group marks by exam_id
        const examGroups: Record<string, ExamResult> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (!examGroups[data.exam_id]) {
            examGroups[data.exam_id] = {
              id: data.exam_id,
              termName: 'Exam ' + data.exam_id.substring(0, 4),
              marks: {},
              percentage: 0,
              overallGrade: 'N/A'
            };
          }
          examGroups[data.exam_id].marks[data.subject] = {
            total: data.total_marks,
            obtained: data.marks_obtained,
            grade: data.marks_obtained / data.total_marks >= 0.8 ? 'A' : 'B'
          };
        });
        setResults(Object.values(examGroups));
      },
      (err) => console.error("Error fetching results:", err)
    );

    // Fetch Syllabus
    const sylUnsub = onSnapshot(
      query(collection(db, 'syllabus'), where('classId', '==', selectedChild.classId)),
      (snap) => setSyllabus(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SyllabusTopic))),
      (err) => console.error("Error fetching syllabus:", err)
    );

    // Fetch Events
    const eventUnsub = onSnapshot(
      query(collection(db, 'school_events'), where('schoolId', '==', schoolId), limit(10)),
      (snap) => setEvents(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SchoolEvent))),
      (err) => console.error("Error fetching events:", err)
    );

    return () => {
      feeUnsub();
      hwUnsub();
      attUnsub();
      resUnsub();
      sylUnsub();
      eventUnsub();
    };
  }, [authReady, selectedChildId, selectedChild, schoolId]);

  const toggleHomework = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'school_diary', id), { isDone: !currentStatus });
      toast.success(currentStatus ? 'Marked as incomplete' : 'Great job! Homework done.');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const pendingFees = useMemo(() => {
    return vouchers.reduce((acc, v) => v.status !== 'paid' ? acc + v.balance : acc, 0);
  }, [vouchers]);

  const syllabusProgress = useMemo(() => {
    if (syllabus.length === 0) return 0;
    const completed = syllabus.filter(s => s.isCompleted).length;
    return Math.round((completed / syllabus.length) * 100);
  }, [syllabus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Synchronizing Family Data...</p>
      </div>
    );
  }

  if (error || fetchTimeout) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {fetchTimeout ? "Connection Timeout" : "Access Restricted"}
            </h2>
            <p className="text-sm font-bold text-slate-500 leading-relaxed">
              {fetchTimeout 
                ? "The connection is taking longer than expected. Please check your internet or try again."
                : error}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Plus_Jakarta_Sans'] pb-24 md:pb-12 text-slate-900">
      {/* Top Header & Family Switcher */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 rotate-3">
              <GraduationCap size={28} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tight">EduPak <span className="text-blue-600">Hub</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Family Portal</p>
            </div>
          </div>

          {/* Family Switcher */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 px-1 max-w-[60%] md:max-w-md">
            {children.map(child => (
              <button
                key={child.uid}
                onClick={() => setSelectedChildId(child.uid)}
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-2xl transition-all border-2 ${
                  selectedChildId === child.uid 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${selectedChildId === child.uid ? 'border-white/50' : 'border-slate-100'}`}>
                  {child.photoURL ? (
                    <img src={child.photoURL} alt={child.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={14} />
                    </div>
                  )}
                </div>
                <span className="text-xs font-black whitespace-nowrap">{child.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('notifications')}
              className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all relative"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </div>

        {/* News Ticker */}
        <div className="bg-blue-600 text-white py-1.5 overflow-hidden whitespace-nowrap">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="inline-block px-4"
          >
            {announcements.map(ann => (
              <span key={ann.id} className="mx-8 text-[10px] font-black uppercase tracking-widest">
                <Megaphone size={12} className="inline mr-2" /> {ann.title}: {ann.content.substring(0, 50)}...
              </span>
            ))}
            {announcements.length === 0 && (
              <span className="mx-8 text-[10px] font-black uppercase tracking-widest">Welcome to EduPak Family Hub! Stay updated with school news here.</span>
            )}
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Birthday Celebration */}
              {isBirthday && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-1 rounded-[2.5rem] shadow-2xl"
                >
                  <div className="bg-white/90 backdrop-blur-md rounded-[2.4rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center text-pink-500 animate-bounce">
                        <Cake size={40} />
                      </div>
                      <div className="text-center md:text-left">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Happy Birthday, {selectedChild?.name}! 🎂</h2>
                        <p className="text-sm font-bold text-slate-500">The whole school wishes you a fantastic day filled with joy and learning.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })}
                      className="px-6 py-3 bg-pink-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-pink-600 transition-all shadow-lg shadow-pink-200"
                    >
                      Celebrate! 🎉
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard accentColor="blue" className="relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <Calendar size={24} />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 bg-blue-50 text-blue-600 rounded-full uppercase tracking-widest">Attendance</span>
                  </div>
                  <h4 className="text-4xl font-black tracking-tighter text-slate-900">{selectedChild?.attendancePercentage || 0}%</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Current Academic Year</p>
                  <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedChild?.attendancePercentage || 0}%` }}
                      className="h-full bg-blue-600 rounded-full"
                    />
                  </div>
                </GlassCard>

                <GlassCard accentColor="purple" className="relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <Trophy size={24} />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 bg-purple-50 text-purple-600 rounded-full uppercase tracking-widest">Performance</span>
                  </div>
                  <h4 className="text-4xl font-black tracking-tighter text-slate-900">{selectedChild?.grade || 'A+'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Overall Academic Grade</p>
                  <div className="mt-4 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={14} className={i <= 4 ? "text-yellow-400 fill-yellow-400" : "text-slate-200"} />
                    ))}
                  </div>
                </GlassCard>

                <GlassCard accentColor="orange" className="relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                      <Wallet size={24} />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 bg-orange-50 text-orange-600 rounded-full uppercase tracking-widest">Fees</span>
                  </div>
                  <h4 className="text-4xl font-black tracking-tighter text-slate-900">PKR {pendingFees.toLocaleString()}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Total Outstanding Dues</p>
                  <button 
                    onClick={() => setActiveTab('fees')}
                    className="mt-4 w-full py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-200"
                  >
                    Pay Now
                  </button>
                </GlassCard>
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Digital Diary (Homework) */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                          <ClipboardList size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Digital Diary</h3>
                      </div>
                      <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View History</button>
                    </div>
                    
                    <div className="space-y-4">
                      {homework.length > 0 ? homework.map((hw) => (
                        <div key={hw.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-blue-200 transition-all group flex items-start gap-4">
                          <button 
                            onClick={() => toggleHomework(hw.id, !!hw.isDone)}
                            className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                              hw.isDone ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-transparent'
                            }`}
                          >
                            <Check size={14} />
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{hw.subject}</span>
                              <span className="text-[10px] font-bold text-slate-400">{hw.date}</span>
                            </div>
                            <p className={`text-sm leading-relaxed ${hw.isDone ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                              {hw.content}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Star className="text-yellow-400" size={32} />
                          </div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No homework for today!</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Enjoy your evening.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Syllabus Tracker */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                          <TrendingUp size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Syllabus Tracker</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-emerald-600">{syllabusProgress}%</span>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                      </div>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-8">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${syllabusProgress}%` }}
                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {syllabus.slice(0, 4).map((topic) => (
                        <div key={topic.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${topic.isCompleted ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{topic.subject}</span>
                          </div>
                          <span className="text-[10px] font-black text-slate-900 truncate max-w-[120px]">{topic.topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Attendance & Events */}
                <div className="space-y-8">
                  {/* Attendance Calendar */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Attendance</h3>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronLeft size={16} /></button>
                        <span className="text-[10px] font-black uppercase tracking-widest">{format(new Date(), 'MMMM yyyy')}</span>
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                        <div key={day} className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest">{day}</div>
                      ))}
                      {Array.from({ length: 31 }).map((_, i) => {
                        const status = i % 10 === 0 ? 'absent' : i % 15 === 0 ? 'holiday' : 'present';
                        return (
                          <div 
                            key={i} 
                            className={`aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all cursor-pointer hover:scale-110 ${
                              status === 'present' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              status === 'absent' ? 'bg-red-50 text-red-600 border border-red-100' :
                              'bg-yellow-50 text-yellow-600 border border-yellow-100'
                            }`}
                          >
                            {i + 1}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Present</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Absent</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Holiday</span></div>
                    </div>
                  </div>

                  {/* Upcoming Events */}
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Upcoming Events</h3>
                      <Calendar size={18} className="text-blue-400" />
                    </div>
                    <div className="space-y-6">
                      {events.length > 0 ? events.map((event) => (
                        <div key={event.id} className="flex items-start gap-4 group cursor-pointer">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex flex-col items-center justify-center group-hover:bg-blue-600 transition-all">
                            <span className="text-xs font-black">{event.date.split('-')[2]}</span>
                            <span className="text-[8px] font-bold uppercase opacity-60">{format(parseISO(event.date), 'MMM')}</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-tight group-hover:text-blue-400 transition-colors">{event.title}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{event.type}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-8 opacity-40">
                          <p className="text-[10px] font-black uppercase tracking-widest">No upcoming events</p>
                        </div>
                      )}
                    </div>
                    <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                      Full Calendar
                    </button>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-col items-center gap-3 hover:border-blue-200 transition-all group">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                        <Plane size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Apply Leave</span>
                    </button>
                    <button className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-col items-center gap-3 hover:border-blue-200 transition-all group">
                      <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
                        <MessageSquare size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Teacher Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'fees' && (
            <motion.div 
              key="fees"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Fee Management</h3>
                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600"><Printer size={18} /></button>
                    <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600"><FileDown size={18} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Current Outstanding</p>
                    <h4 className="text-5xl font-black tracking-tighter mb-8">PKR {pendingFees.toLocaleString()}</h4>
                    <div className="flex items-center gap-4">
                      <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
                        Pay Online
                      </button>
                      <button className="px-6 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Details
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Paid</p>
                      <p className="text-2xl font-black text-slate-900">PKR 85k</p>
                    </div>
                    <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Scholarship</p>
                      <p className="text-2xl font-black text-slate-900">15%</p>
                    </div>
                    <div className="p-6 bg-orange-50 rounded-[2rem] border border-orange-100">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Last Payment</p>
                      <p className="text-2xl font-black text-slate-900">Mar 05</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Due</p>
                      <p className="text-2xl font-black text-slate-900">Apr 10</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Payment History</h4>
                  {vouchers.map((v) => (
                    <div key={v.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          v.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                        }`}>
                          <CreditCard size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{v.month} {v.year} Fee Slip</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voucher ID: {v.id.substring(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-8">
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">PKR {v.totalAmount.toLocaleString()}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${
                            v.status === 'paid' ? 'text-emerald-600' : 'text-red-600'
                          }`}>{v.status}</p>
                        </div>
                        <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Virtual Timetable */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Virtual Timetable</h3>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <Clock size={20} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { period: '01', time: '08:00 - 08:45', subject: 'Mathematics', teacher: 'Mr. Ahmed Khan', color: 'blue' },
                      { period: '02', time: '08:45 - 09:30', subject: 'English', teacher: 'Ms. Sarah Ali', color: 'purple' },
                      { period: '03', time: '09:30 - 10:15', subject: 'Science', teacher: 'Dr. Usman', color: 'emerald' },
                      { period: 'BR', time: '10:15 - 10:45', subject: 'Lunch Break', teacher: 'Cafeteria', isBreak: true },
                      { period: '04', time: '10:45 - 11:30', subject: 'Urdu', teacher: 'Ms. Fatima', color: 'orange' },
                    ].map((slot, idx) => (
                      <div key={idx} className={`p-5 rounded-3xl border flex items-center justify-between transition-all hover:scale-[1.02] ${
                        slot.isBreak ? 'bg-yellow-50 border-yellow-100' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs ${
                            slot.isBreak ? 'bg-yellow-200 text-yellow-700' : 'bg-white text-slate-900 shadow-sm'
                          }`}>
                            {slot.period}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{slot.subject}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{slot.time}</p>
                          </div>
                        </div>
                        {!slot.isBreak && (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{slot.teacher}</p>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Room 101</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exam & Report Cards */}
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-8">Academic Results</h3>
                    <div className="space-y-6">
                      {results.length > 0 ? results.map((res) => (
                        <div key={res.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all" />
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{res.termName}</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Session 2023-24</p>
                            </div>
                            <div className="text-right">
                              <span className="text-3xl font-black text-blue-600">{res.percentage}%</span>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {Object.entries(res.marks).map(([subject, data]) => (
                              <div key={subject} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{subject}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-black text-slate-900">{data.obtained}/{data.total}</span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                                    data.grade.startsWith('A') ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                  }`}>{data.grade}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {res.remarks && (
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-8">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <MessageSquare size={12} /> Teacher's Remarks
                              </p>
                              <p className="text-xs text-slate-600 italic">"{res.remarks}"</p>
                            </div>
                          )}

                          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                            <FileDown size={16} /> Download Report Card
                          </button>
                        </div>
                      )) : (
                        <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                          <Trophy className="mx-auto text-slate-200 mb-4" size={48} />
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No results published yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download Center */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Download Center</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { title: 'Final Exam Date Sheet', type: 'PDF', size: '1.2 MB' },
                        { title: 'Annual Sports Day Flyer', type: 'JPG', size: '4.5 MB' },
                        { title: 'School Uniform Policy', type: 'PDF', size: '0.8 MB' },
                      ].map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{file.title}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{file.type} • {file.size}</p>
                            </div>
                          </div>
                          <Download size={16} className="text-slate-300 group-hover:text-blue-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <div className="relative pt-8">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-white p-1.5 shadow-2xl mx-auto mb-6">
                    <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-slate-100 flex items-center justify-center text-slate-400">
                      {selectedChild?.photoURL ? (
                        <img src={selectedChild.photoURL} alt={selectedChild.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={48} />
                      )}
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedChild?.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Student ID: {selectedChild?.uid.substring(0, 8)}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class & Section</p>
                    <p className="text-sm font-black text-slate-900">{selectedChild?.classId} - {selectedChild?.sectionId}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Roll Number</p>
                    <p className="text-sm font-black text-slate-900">{selectedChild?.rollNo}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                    <p className="text-sm font-black text-slate-900">{selectedChild?.dob ? format(parseISO(selectedChild.dob), 'MMMM dd, yyyy') : 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guardian Name</p>
                    <p className="text-sm font-black text-slate-900">Parent User</p>
                  </div>
                </div>

                <div className="mt-12 pt-12 border-t border-slate-100 flex flex-col gap-4">
                  <button className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    <Settings size={16} /> Account Settings
                  </button>
                  <button 
                    onClick={() => auth.signOut()}
                    className="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} /> Logout Securely
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div 
              key="notifications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Notification Center</h3>
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Mark all as read</button>
              </div>
              
              <div className="space-y-4">
                {[
                  { title: 'Fee Reminder', content: 'Your fee for April 2024 is due in 2 days. Please pay online to avoid fine.', time: '2 hours ago', type: 'urgent', icon: Wallet },
                  { title: 'Homework Assigned', content: 'New Mathematics assignment has been posted for Class 10-A.', time: '5 hours ago', type: 'info', icon: ClipboardList },
                  { title: 'Attendance Alert', content: 'Your child was marked Present today at 08:15 AM.', time: '1 day ago', type: 'success', icon: CheckCircle2 },
                  { title: 'School Event', content: 'Annual Sports Day is scheduled for next Friday. Don\'t forget the uniform!', time: '2 days ago', type: 'event', icon: Trophy },
                ].map((notif, idx) => (
                  <div key={idx} className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex gap-6 group hover:border-blue-200 transition-all">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      notif.type === 'urgent' ? 'bg-red-50 text-red-500' :
                      notif.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                      notif.type === 'event' ? 'bg-purple-50 text-purple-500' :
                      'bg-blue-50 text-blue-500'
                    }`}>
                      <notif.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{notif.title}</h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{notif.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{notif.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-4 z-50 flex items-center justify-between safe-area-bottom">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'fees', icon: Wallet, label: 'Fees' },
          { id: 'results', icon: GraduationCap, label: 'Results' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1.5 transition-all ${
              activeTab === tab.id ? 'text-blue-600 scale-110' : 'text-slate-400'
            }`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : ''}`}>
              <tab.icon size={22} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default ParentPortalDashboard;
