import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Paperclip, 
  User, 
  Users, 
  ChevronRight, 
  Filter, 
  Search, 
  MoreVertical, 
  ArrowRight,
  Info,
  RefreshCw,
  Layout,
  Settings,
  X,
  Plus,
  Bell,
  History,
  ShieldCheck,
  Briefcase,
  Plane,
  HeartPulse,
  Baby,
  AlertTriangle
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
import { toast } from 'react-hot-toast';
import { format, isToday, isWithinInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

// --- Types ---

interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  staffPhoto?: string;
  leaveType: 'Sick' | 'Casual' | 'Emergency' | 'Maternity' | 'Unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  attachmentUrl?: string;
  appliedAt: any;
  approvedAt?: any;
  rejectedAt?: any;
  remarks?: string;
  schoolId: string;
  days: number;
}

interface StaffQuota {
  id: string;
  staffId: string;
  Sick: number;
  Casual: number;
  Emergency: number;
  Maternity: number;
  schoolId: string;
}

const LEAVE_TYPES = [
  { id: 'Sick', label: 'Sick Leave', icon: HeartPulse, color: 'text-red-400', bg: 'bg-red-400/10' },
  { id: 'Casual', label: 'Casual Leave', icon: Plane, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'Emergency', label: 'Emergency', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'Maternity', label: 'Maternity', icon: Baby, color: 'text-pink-400', bg: 'bg-pink-400/10' },
  { id: 'Unpaid', label: 'Unpaid', icon: Briefcase, color: 'text-gray-400', bg: 'bg-gray-400/10' },
];

const AdminLeaveApprovalModule: React.FC<{ schoolId: string; adminName?: string }> = ({ schoolId, adminName }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [quotas, setQuotas] = useState<Record<string, StaffQuota>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('schoolId', '==', schoolId),
      orderBy('appliedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as LeaveRequest)));
      setLoading(false);
    });

    const quotaUnsub = onSnapshot(
      query(collection(db, 'leave_quotas'), where('schoolId', '==', schoolId)),
      (snap) => {
        const quotaMap: Record<string, StaffQuota> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as StaffQuota;
          quotaMap[data.staffId] = { ...data, id: doc.id };
        });
        setQuotas(quotaMap);
      }
    );

    return () => {
      unsub();
      quotaUnsub();
    };
  }, [schoolId]);

  const handleAction = async (request: LeaveRequest, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !remarks) {
      return toast.error("Please provide a reason for rejection");
    }

    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'leave_requests', request.id);

      const updateData: any = {
        status,
        remarks,
        [status === 'approved' ? 'approvedAt' : 'rejectedAt']: serverTimestamp()
      };

      batch.update(requestRef, updateData);

      // If approved, sync with attendance and update quota
      if (status === 'approved') {
        // Update Quota
        if (request.leaveType !== 'Unpaid') {
          const quota = quotas[request.staffId];
          if (quota) {
            const quotaRef = doc(db, 'leave_quotas', quota.id);
            batch.update(quotaRef, {
              [request.leaveType]: increment(-request.days)
            });
          }
        }

        // Auto-Attendance Sync
        const start = parseISO(request.startDate);
        const end = parseISO(request.endDate);
        const days = eachDayOfInterval({ start, end });

        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const attendanceRef = doc(db, 'attendance', `${request.staffId}_${dateStr}`);
          batch.set(attendanceRef, {
            staffId: request.staffId,
            date: dateStr,
            status: 'on-leave',
            schoolId,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
      }

      await batch.commit();
      toast.success(`Leave request ${status} successfully`);
      setSelectedRequest(null);
      setRemarks('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesTab = activeTab === 'all' || req.status === activeTab;
      const matchesSearch = req.staffName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            req.leaveType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [requests, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const today = new Date();
    const onLeaveToday = requests.filter(req => 
      req.status === 'approved' && 
      isWithinInterval(today, { start: parseISO(req.startDate), end: parseISO(req.endDate) })
    ).length;

    const pendingCount = requests.filter(req => req.status === 'pending').length;
    const approvedThisMonth = requests.filter(req => {
      if (req.status !== 'approved' || !req.approvedAt) return false;
      const approvedDate = req.approvedAt.toDate();
      return approvedDate >= startOfMonth(today) && approvedDate <= endOfMonth(today);
    }).length;

    return { onLeaveToday, pendingCount, approvedThisMonth };
  }, [requests]);

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
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-purple">Automated Leave Engine</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Leave <span className="text-neon-purple">Approval.</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-cyber-gray/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2 border-r border-white/10">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Pending Requests</p>
            <p className="text-lg font-black text-white">{stats.pendingCount}</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">On Leave Today</p>
            <p className="text-lg font-black text-neon-purple">{stats.onLeaveToday}</p>
          </div>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-neon-purple/10 rounded-2xl border border-neon-purple/20 text-neon-purple">
              <Users size={20} />
            </div>
            <span className="text-[8px] font-black px-2 py-1 bg-white/5 text-neon-purple rounded-full uppercase tracking-widest">Live Status</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">{stats.onLeaveToday}</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Staff Members on Leave Today</p>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-red-400/10 rounded-2xl border border-red-400/20 text-red-400">
              <Clock size={20} />
            </div>
            <span className="text-[8px] font-black px-2 py-1 bg-white/5 text-red-400 rounded-full uppercase tracking-widest">Action Required</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">{stats.pendingCount}</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Requests Awaiting Approval</p>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-green-400/10 rounded-2xl border border-green-400/20 text-green-400">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-[8px] font-black px-2 py-1 bg-white/5 text-green-400 rounded-full uppercase tracking-widest">Monthly Summary</span>
          </div>
          <div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">{stats.approvedThisMonth}</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Approved Leaves This Month</p>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden">
        {/* Tabs & Search */}
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 bg-cyber-black/50 p-1.5 rounded-2xl border border-white/5">
            {['pending', 'approved', 'rejected', 'all'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                    ? 'bg-neon-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text"
              placeholder="Search by name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-cyber-black/50 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-xs text-white focus:border-neon-purple/50 outline-none transition-all w-full md:w-64"
            />
          </div>
        </div>

        {/* Requests Grid */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredRequests.map((req) => {
                const typeInfo = LEAVE_TYPES.find(t => t.id === req.leaveType) || LEAVE_TYPES[4];
                return (
                  <motion.div 
                    key={req.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white/5 rounded-3xl border border-white/5 p-6 hover:border-neon-purple/20 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyber-black flex items-center justify-center border border-white/5 overflow-hidden">
                          {req.staffPhoto ? (
                            <img src={req.staffPhoto} alt={req.staffName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="text-gray-600" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-widest">{req.staffName}</p>
                          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{req.staffRole}</p>
                        </div>
                      </div>
                      <div className={`p-2 rounded-lg ${typeInfo.bg} ${typeInfo.color}`}>
                        <typeInfo.icon size={16} />
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between p-3 bg-cyber-black rounded-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-gray-500" size={14} />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{req.startDate}</span>
                        </div>
                        <ArrowRight className="text-gray-700" size={12} />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{req.endDate}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed italic">"{req.reason}"</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <History className="text-gray-600" size={14} />
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{req.days} Days Requested</span>
                      </div>
                      <button 
                        onClick={() => setSelectedRequest(req)}
                        className="px-4 py-2 bg-white/5 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-neon-purple hover:text-black transition-all"
                      >
                        Review Request
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {filteredRequests.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Layout className="text-gray-700" size={32} />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">No requests found</h4>
                <p className="text-[10px] text-gray-500 mt-2">Try changing the filters or search query</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRequest(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-cyber-gray p-8 rounded-[2.5rem] border border-white/10 w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Review Leave</h3>
                <button onClick={() => setSelectedRequest(null)} className="p-2 text-gray-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl border border-white/5">
                  <div className="w-16 h-16 rounded-2xl bg-cyber-black flex items-center justify-center border border-white/5 overflow-hidden">
                    {selectedRequest.staffPhoto ? (
                      <img src={selectedRequest.staffPhoto} alt={selectedRequest.staffName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="text-gray-600" size={32} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter">{selectedRequest.staffName}</h4>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{selectedRequest.staffRole}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-cyber-black rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Leave Type</p>
                    <p className="text-sm font-black text-white uppercase tracking-widest">{selectedRequest.leaveType}</p>
                  </div>
                  <div className="p-4 bg-cyber-black rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Remaining Quota</p>
                    <p className="text-sm font-black text-neon-purple uppercase tracking-widest">
                      {selectedRequest.leaveType !== 'Unpaid' ? (quotas[selectedRequest.staffId]?.[selectedRequest.leaveType as keyof StaffQuota] || 0) : 'N/A'} Days
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Admin Remarks / Reason for Rejection</label>
                  <textarea 
                    placeholder="Enter your feedback here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50 min-h-[100px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => handleAction(selectedRequest, 'rejected')}
                    className="py-5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} /> Reject Request
                  </button>
                  <button 
                    onClick={() => handleAction(selectedRequest, 'approved')}
                    className="py-5 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Approve Leave
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

export default AdminLeaveApprovalModule;
