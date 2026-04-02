import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  ArrowLeft, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Upload, 
  ChevronRight,
  Info,
  Coffee,
  HeartPulse,
  Clock3,
  DollarSign
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  onSnapshot,
  orderBy,
  limit
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

interface LeaveBalance {
  type: string;
  used: number;
  total: number;
  color: string;
  icon: any;
}

const TeacherLeaveModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [leaveType, setLeaveType] = useState<'Casual' | 'Medical' | 'Half-Day' | 'Unpaid'>('Casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  useEffect(() => {
    if (!userProfile.uid || !userProfile.schoolId) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('school_id', '==', userProfile.schoolId),
      where('teacher_uid', '==', userProfile.uid),
      orderBy('applied_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching leave requests:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.uid, userProfile.schoolId]);

  const balances: LeaveBalance[] = useMemo(() => {
    const casualUsed = requests.filter(r => r.leave_type === 'Casual' && r.status === 'approved').reduce((acc, r) => acc + r.total_days, 0);
    const medicalUsed = requests.filter(r => r.leave_type === 'Medical' && r.status === 'approved').reduce((acc, r) => acc + r.total_days, 0);
    
    return [
      { type: 'Casual', used: casualUsed, total: 10, color: 'neon-blue', icon: Coffee },
      { type: 'Medical', used: medicalUsed, total: 5, color: 'neon-pink', icon: HeartPulse },
      { type: 'Half-Day', used: 0, total: 4, color: 'neon-purple', icon: Clock3 },
      { type: 'Unpaid', used: 0, total: 0, color: 'gray-500', icon: DollarSign },
    ];
  }, [requests]);

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date cannot be before start date");
      return;
    }
    if (reason.length < 10) {
      toast.error("Reason must be at least 10 characters long");
      return;
    }

    setIsSubmitting(true);
    try {
      const newRequest = {
        school_id: userProfile.schoolId,
        teacher_uid: userProfile.uid,
        teacher_name: userProfile.name,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        status: 'pending',
        applied_at: serverTimestamp(),
      };

      // In a real app, we would upload the attachment to Firebase Storage here
      // and get the URL. For now, we'll just log it.
      if (attachment) {
        console.log("Attachment selected:", attachment.name);
      }

      await addDoc(collection(db, 'leave_requests'), newRequest);
      
      // NOTE: A Cloud Function trigger would be added here to send a push notification 
      // to the school_admin when a new request is inserted.

      toast.success("Leave request submitted successfully!");
      setIsApplying(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      setAttachment(null);
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast.error("Failed to submit leave request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 rounded-2xl bg-cyber-gray/20 border border-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Leave Management</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Apply and track your absences
            </p>
          </div>
        </div>

        {/* Leave Balances */}
        <section className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-4 min-w-max">
            {balances.map((balance) => (
              <div key={balance.type} className="bg-cyber-gray/10 border border-white/5 p-5 rounded-3xl w-44 space-y-3">
                <div className={`w-10 h-10 rounded-2xl bg-${balance.color}/10 flex items-center justify-center text-${balance.color}`}>
                  <balance.icon size={20} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{balance.type}</h4>
                  <p className="text-lg font-black tracking-tight">
                    {balance.total > 0 ? `${balance.total - balance.used}/${balance.total}` : 'N/A'}
                  </p>
                  <p className="text-[9px] font-bold text-gray-600 uppercase">Remaining</p>
                </div>
                {balance.total > 0 && (
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-${balance.color} transition-all duration-500`} 
                      style={{ width: `${Math.min(100, (balance.used / balance.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Apply Button */}
        <button
          onClick={() => setIsApplying(true)}
          className="w-full bg-neon-blue text-black py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(0,243,255,0.2)] flex items-center justify-center gap-3"
        >
          <Plus size={20} />
          Apply for New Leave
        </button>

        {/* Leave History */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 px-2">
            <Clock size={16} />
            Leave History
          </h3>
          
          <div className="space-y-4">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Clock className="text-neon-blue animate-spin" size={32} />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 bg-cyber-gray/5 rounded-3xl border border-dashed border-white/10">
                <Info className="mx-auto text-gray-600 mb-3" size={32} />
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No leave history found</p>
              </div>
            ) : requests.map((req) => (
              <div key={req.id} className="bg-cyber-gray/10 border border-white/5 p-5 rounded-3xl space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        req.status === 'approved' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                        req.status === 'rejected' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                        'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                      }`} />
                      <h4 className="text-xs font-black uppercase tracking-tight">{req.leave_type} Leave</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{req.total_days} Days</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                      req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 
                      req.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-cyber-black/40 rounded-xl border border-white/5">
                  <p className="text-[11px] text-gray-400 leading-relaxed italic">"{req.reason}"</p>
                </div>

                {req.status === 'rejected' && req.review_remarks && (
                  <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Admin Remarks:</p>
                    <p className="text-[11px] text-red-300/80 leading-relaxed">{req.review_remarks}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Apply Modal (Bottom Sheet Style) */}
        <AnimatePresence>
          {isApplying && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsApplying(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-[#0f0f12] border-t border-white/10 rounded-t-[3rem] z-50 p-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-black tracking-tighter uppercase">Apply for Leave</h2>
                    <button type="button" onClick={() => setIsApplying(false)} className="text-gray-500 hover:text-white">
                      <XCircle size={24} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Leave Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['Casual', 'Medical', 'Half-Day', 'Unpaid'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setLeaveType(type as any)}
                            className={`py-3 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${
                              leaveType === type ? 'bg-neon-blue border-neon-blue text-black' : 'bg-cyber-gray/10 border-white/5 text-gray-500'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">From Date</label>
                        <input
                          type="date"
                          required
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">To Date</label>
                        <input
                          type="date"
                          required
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all"
                        />
                      </div>
                    </div>

                    {totalDays > 0 && (
                      <div className="p-4 bg-neon-blue/5 border border-neon-blue/20 rounded-2xl flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neon-blue">Total Duration</span>
                        <span className="text-sm font-black text-white">{totalDays} Days</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Reason for Leave</label>
                      <textarea
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please explain the reason for your absence..."
                        rows={4}
                        className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all resize-none"
                      />
                      <p className="text-[9px] text-gray-600 mt-2 font-bold uppercase">Min. 10 characters required</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Attachment (Optional)</label>
                      <div className="relative">
                        <input
                          type="file"
                          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                          className="hidden"
                          id="file-upload"
                        />
                        <label 
                          htmlFor="file-upload"
                          className="flex items-center justify-center gap-3 w-full py-4 bg-cyber-gray/10 border border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/5 transition-all"
                        >
                          <Upload size={18} className="text-gray-500" />
                          <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                            {attachment ? attachment.name : 'Upload Document'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-neon-blue text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,243,255,0.3)] flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? <Clock className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Submit Request
                  </button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default TeacherLeaveModule;
