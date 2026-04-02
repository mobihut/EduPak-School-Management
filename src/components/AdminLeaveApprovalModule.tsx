import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  ChevronRight,
  Info,
  Check,
  X,
  MessageSquare,
  ArrowRight,
  Users,
  Eye
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  runTransaction, 
  updateDoc,
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface LeaveRequest {
  id: string;
  school_id: string;
  teacher_uid: string;
  teacher_name: string;
  leave_type: 'Casual' | 'Medical' | 'Half-Day' | 'Unpaid';
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: any;
  reviewed_by?: string;
  review_remarks?: string;
  reviewed_at?: any;
}

interface StaffMember {
  staff_id: string;
  name: string;
  designation: string;
  user_uid: string;
  payroll: {
    leave_balances: {
      casual_leaves: number;
      medical_leaves: number;
      half_day_leaves: number;
    };
  };
}

interface AdminLeaveApprovalModuleProps {
  schoolId: string;
  adminName: string;
}

const AdminLeaveApprovalModule: React.FC<AdminLeaveApprovalModuleProps> = ({ schoolId, adminName }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; requestId: string | null; remarks: string }>({
    isOpen: false,
    requestId: null,
    remarks: ''
  });
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('school_id', '==', schoolId),
      orderBy('applied_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leave requests:", error);
      toast.error("Failed to load leave requests");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesTab = activeTab === 'pending' ? req.status === 'pending' : req.status !== 'pending';
      const matchesSearch = req.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           req.leave_type.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [requests, activeTab, searchTerm]);

  const stats = useMemo(() => {
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const today = new Date().toISOString().split('T')[0];
    const onLeaveToday = requests.filter(r => 
      r.status === 'approved' && 
      today >= r.start_date && 
      today <= r.end_date
    ).length;

    return { pendingCount, onLeaveToday };
  }, [requests]);

  const handleApprove = async (request: LeaveRequest) => {
    setProcessingId(request.id);
    try {
      // 1. First find the staff document ID outside the transaction
      const staffQuery = query(
        collection(db, 'staff'),
        where('school_id', '==', schoolId),
        where('user_uid', '==', request.teacher_uid)
      );
      const staffSnapshot = await getDocs(staffQuery);
      
      if (staffSnapshot.empty) {
        throw new Error("Staff record not found for this teacher.");
      }

      const staffDocId = staffSnapshot.docs[0].id;
      const staffRef = doc(db, 'staff', staffDocId);
      const requestRef = doc(db, 'leave_requests', request.id);

      await runTransaction(db, async (transaction) => {
        const staffDoc = await transaction.get(staffRef);
        if (!staffDoc.exists()) {
          throw new Error("Staff record no longer exists.");
        }

        const staffData = staffDoc.data() as StaffMember;

        // 2. Check and deduct balance
        const balances = staffData.payroll?.leave_balances || { casual_leaves: 10, medical_leaves: 5, half_day_leaves: 12 };
        let balanceKey: string | null = null;

        if (request.leave_type === 'Casual') balanceKey = 'casual_leaves';
        else if (request.leave_type === 'Medical') balanceKey = 'medical_leaves';
        else if (request.leave_type === 'Half-Day') balanceKey = 'half_day_leaves';

        if (balanceKey && request.leave_type !== 'Unpaid') {
          const currentBalance = (balances as any)[balanceKey] || 0;
          if (currentBalance < request.total_days) {
            throw new Error(`Insufficient ${request.leave_type} leave balance. Current: ${currentBalance}, Requested: ${request.total_days}`);
          }
          
          transaction.update(staffRef, {
            [`payroll.leave_balances.${balanceKey}`]: currentBalance - request.total_days
          });
        }

        // 3. Update request status
        transaction.update(requestRef, {
          status: 'approved',
          reviewed_by: adminName,
          reviewed_at: serverTimestamp()
        });
      });

      toast.success(`Leave approved for ${request.teacher_name}. Balance updated.`);
    } catch (error: any) {
      console.error("Approval error:", error);
      toast.error(error.message || "Failed to approve leave");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionModal.requestId || !rejectionModal.remarks.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessingId(rejectionModal.requestId);
    try {
      const requestRef = doc(db, 'leave_requests', rejectionModal.requestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        review_remarks: rejectionModal.remarks,
        reviewed_by: adminName,
        reviewed_at: serverTimestamp()
      });

      toast.success("Leave request rejected");
      setRejectionModal({ isOpen: false, requestId: null, remarks: '' });
    } catch (error) {
      console.error("Rejection error:", error);
      toast.error("Failed to reject leave request");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8 p-6 animate-in fade-in duration-700">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-cyber-gray/50 border border-white/10 p-6 rounded-3xl neon-shadow-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={80} />
          </div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Staff on Leave Today</p>
          <h3 className="text-3xl font-black text-white">{stats.onLeaveToday}</h3>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neon-blue">
            <ArrowRight size={12} /> <span>View daily attendance</span>
          </div>
        </div>

        <div className={`bg-cyber-gray/50 border p-6 rounded-3xl neon-shadow-subtle relative overflow-hidden group transition-all ${
          stats.pendingCount > 0 ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/10'
        }`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={80} className={stats.pendingCount > 0 ? 'text-red-500' : 'text-gray-500'} />
          </div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Pending Requests</p>
          <h3 className={`text-3xl font-black ${stats.pendingCount > 0 ? 'text-red-500' : 'text-white'}`}>
            {stats.pendingCount}
          </h3>
          <div className={`mt-4 flex items-center gap-2 text-[10px] font-bold ${stats.pendingCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {stats.pendingCount > 0 ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            <span>{stats.pendingCount > 0 ? 'Action required immediately' : 'All caught up'}</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-cyber-black/50 p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'pending' ? 'bg-neon-blue text-black shadow-[0_0_15px_#00f3ff]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Pending Requests
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'history' ? 'bg-neon-blue text-black shadow-[0_0_15px_#00f3ff]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            History / Logs
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text"
            placeholder="Search by teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-neon-blue outline-none transition-all"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Clock className="text-neon-blue animate-spin" size={40} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 text-center bg-cyber-gray/20 rounded-[2.5rem] border border-dashed border-white/5">
            <Info className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">No {activeTab} requests found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRequests.map((req) => (
              <motion.div
                layout
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-cyber-gray/30 border border-white/5 rounded-[2rem] p-6 hover:border-white/10 transition-all group"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Teacher Info */}
                  <div className="flex items-center gap-4 lg:w-64">
                    <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-white/10 flex items-center justify-center text-neon-blue font-black text-xl">
                      {req.teacher_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate">{req.teacher_name}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">Teacher</p>
                    </div>
                  </div>

                  {/* Leave Details */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Leave Type</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        req.leave_type === 'Medical' ? 'bg-neon-pink/10 text-neon-pink' :
                        req.leave_type === 'Casual' ? 'bg-neon-blue/10 text-neon-blue' :
                        req.leave_type === 'Half-Day' ? 'bg-neon-purple/10 text-neon-purple' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {req.leave_type}
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Duration</p>
                      <p className="text-xs font-black text-white">{req.total_days} Days</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase">{new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Reason</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 italic">"{req.reason}"</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 lg:pl-6 lg:border-l border-white/5">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          disabled={processingId === req.id}
                          onClick={() => handleApprove(req)}
                          className="flex-1 lg:flex-none px-6 py-3 bg-green-500 text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {processingId === req.id ? <Clock className="animate-spin" size={14} /> : <Check size={14} />}
                          Approve
                        </button>
                        <button
                          disabled={processingId === req.id}
                          onClick={() => setRejectionModal({ isOpen: true, requestId: req.id, remarks: '' })}
                          className="flex-1 lg:flex-none px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </>
                    ) : (
                      <div className="text-right">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {req.status}
                        </span>
                        <p className="text-[9px] text-gray-600 font-bold uppercase mt-1">Reviewed by {req.reviewed_by}</p>
                      </div>
                    )}
                    
                    {req.attachment_url && (
                      <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                        <Eye size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
              className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-cyber-gray border border-white/10 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Reject Leave Request</h2>
                <button onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })} className="text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0" size={20} />
                  <p className="text-[11px] text-red-300/80 leading-relaxed">
                    Rejecting this request will notify the teacher. You must provide a valid reason for this decision.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Rejection Remarks</label>
                  <textarea 
                    value={rejectionModal.remarks}
                    onChange={(e) => setRejectionModal({ ...rejectionModal, remarks: e.target.value })}
                    placeholder="e.g. Insufficient coverage for your classes on these dates..."
                    rows={4}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-red-500 outline-none transition-all resize-none text-sm"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setRejectionModal({ ...rejectionModal, isOpen: false })}
                    className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processingId !== null || !rejectionModal.remarks.trim()}
                    className="flex-1 py-4 bg-red-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50"
                  >
                    Confirm Rejection
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
