import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  Briefcase, 
  Wallet, 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Save, 
  Plus, 
  Trash2, 
  Download, 
  Eye, 
  TrendingUp, 
  Clock, 
  Award, 
  FilePlus, 
  History, 
  PhoneCall, 
  LogOut, 
  ChevronRight, 
  BarChart3, 
  UserMinus, 
  ClipboardList, 
  Star, 
  MessageSquare, 
  Upload, 
  X,
  Printer,
  FileJson
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  orderBy, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// --- Interfaces ---

interface StaffMember {
  id: string;
  school_id: string;
  name: string;
  designation: string;
  department: string;
  status: 'active' | 'on-leave' | 'resigned' | 'terminated';
  contact_info: {
    phone: string;
    email: string;
    address: string;
    emergency_contact: {
      name: string;
      relation: string;
      phone: string;
    };
  };
  payroll: {
    base_salary: number;
    allowances: number;
    deductions: number;
    bank_account: string;
    increment_history: {
      date: string;
      amount: number;
      reason: string;
    }[];
  };
  academic_info: {
    qualifications: string;
    experience: string;
    joining_date: string;
    documents: {
      name: string;
      url: string;
      type: string;
      uploaded_at: string;
    }[];
  };
  performance: {
    rating: number;
    reviews: {
      id: string;
      date: string;
      rating: number;
      remarks: string;
      reviewer: string;
    }[];
  };
  workload: {
    periods_per_week: number;
    assigned_subjects: string[];
  };
  exit_info?: {
    resignation_date?: string;
    notice_period?: string;
    exit_date?: string;
    reason?: string;
  };
  user_uid?: string | null;
  created_at: any;
}

interface JobApplication {
  id: string;
  school_id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  status: 'applied' | 'interviewing' | 'offered' | 'rejected' | 'hired';
  resume_url: string;
  applied_at: any;
}

interface TeacherHRManagementProps {
  schoolId: string;
}

const TeacherHRManagement: React.FC<TeacherHRManagementProps> = ({ schoolId }) => {
  // --- State ---
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'directory' | 'recruitment' | 'analytics' | 'attendance'>('directory');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late' | 'short-leave'>>({});
  const [filters, setFilters] = useState({
    department: 'All',
    status: 'All',
    designation: 'All'
  });

  // --- Form State for New Staff ---
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    designation: 'Teacher',
    department: 'Academic',
    base_salary: 0,
    allowances: 0,
    deductions: 0,
    bank_account: '',
    qualifications: '',
    experience: '',
    joining_date: format(new Date(), 'yyyy-MM-dd'),
    createAccess: true
  });

  // --- Fetch Data ---
  useEffect(() => {
    if (!schoolId) return;

    const staffQuery = query(
      collection(db, 'staff'),
      where('school_id', '==', schoolId)
    );

    const unsubStaff = onSnapshot(staffQuery, (snap) => {
      const staffData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StaffMember));
      setStaff(staffData);
      if (staffData.length > 0 && !selectedStaff) {
        setSelectedStaff(staffData[0]);
      }
      setLoading(false);
    });

    const appsQuery = query(
      collection(db, 'job_applications'),
      where('school_id', '==', schoolId),
      orderBy('applied_at', 'desc')
    );

    const unsubApps = onSnapshot(appsQuery, (snap) => {
      setApplications(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as JobApplication)));
    });

    return () => {
      unsubStaff();
      unsubApps();
    };
  }, [schoolId]);

  // --- Security Audit Log ---
  const logHRActivity = async (action: string, details: any) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        school_id: schoolId,
        actor_uid: auth.currentUser?.uid,
        actor_email: auth.currentUser?.email,
        action_type: 'HR_MANAGEMENT',
        resource: 'Staff',
        details: JSON.stringify({ action, ...details }),
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Audit log failed:", error);
    }
  };

  // --- PDF Salary Slip Generation ---
  const generateSalarySlip = (member: StaffMember) => {
    const doc = new jsPDF();
    const totalEarnings = member.payroll.base_salary + member.payroll.allowances;
    const netSalary = totalEarnings - member.payroll.deductions;
    const monthYear = format(new Date(), 'MMMM yyyy');

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 243, 255); // Neon Blue
    doc.text('EduPak School Management', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Salary Slip - ${monthYear}`, 105, 30, { align: 'center' });

    // Staff Info
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Employee Name: ${member.name}`, 20, 50);
    doc.text(`Designation: ${member.designation}`, 20, 58);
    doc.text(`Department: ${member.department}`, 20, 66);
    doc.text(`Joining Date: ${member.academic_info.joining_date}`, 20, 74);

    // Salary Table
    (doc as any).autoTable({
      startY: 85,
      head: [['Description', 'Amount (PKR)']],
      body: [
        ['Basic Salary', member.payroll.base_salary.toLocaleString()],
        ['Allowances', member.payroll.allowances.toLocaleString()],
        ['Deductions', `(${member.payroll.deductions.toLocaleString()})`],
        [{ content: 'Net Salary', styles: { fontStyle: 'bold' } }, { content: netSalary.toLocaleString(), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'grid',
      headStyles: { fillStyle: [0, 243, 255], textColor: [0, 0, 0] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.text('Authorized Signature: ____________________', 20, finalY);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated document and does not require a physical stamp.', 105, finalY + 30, { align: 'center' });

    doc.save(`${member.name}_Salary_Slip_${monthYear.replace(' ', '_')}.pdf`);
    logHRActivity('GENERATE_SALARY_SLIP', { staff_id: member.id, month: monthYear });
  };

  // --- Filtering ---
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           member.designation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filters.department === 'All' || member.department === filters.department;
      const matchesStatus = filters.status === 'All' || member.status === filters.status;
      const matchesDesig = filters.designation === 'All' || member.designation === filters.designation;
      return matchesSearch && matchesDept && matchesStatus && matchesDesig;
    });
  }, [staff, searchQuery, filters]);

  // --- Handlers ---
  // --- Fetch Attendance for Selected Date ---
  useEffect(() => {
    if (!schoolId || activeView !== 'attendance') return;

    const q = query(
      collection(db, 'staff_attendance'),
      where('school_id', '==', schoolId),
      where('date', '==', attendanceDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const records: Record<string, any> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        records[data.staff_id] = data.status;
      });
      setAttendanceRecords(records);
    });

    return () => unsub();
  }, [schoolId, attendanceDate, activeView]);

  const handleMarkAttendance = async (staffId: string, staffName: string, status: 'present' | 'absent' | 'late' | 'short-leave') => {
    try {
      const attendanceId = `${schoolId}_${staffId}_${attendanceDate}`;
      await setDoc(doc(db, 'staff_attendance', attendanceId), {
        id: attendanceId,
        school_id: schoolId,
        staff_id: staffId,
        staff_name: staffName,
        date: attendanceDate,
        status,
        marked_by: auth.currentUser?.email,
        created_at: serverTimestamp()
      });
      toast.success(`Marked ${staffName} as ${status}`);
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('Failed to mark attendance');
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.email) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    try {
      let userUid = null;
      if (newStaff.createAccess) {
        const response = await fetch('/api/admin/create-staff-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newStaff.name,
            email: newStaff.email,
            role: 'teacher',
            schoolId,
            adminUid: auth.currentUser?.uid
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create account');
        userUid = result.userUid;
        toast.success(`Account created! Password: ${result.password}`);
      }

      const staffData: Partial<StaffMember> = {
        school_id: schoolId,
        name: newStaff.name,
        designation: newStaff.designation,
        department: newStaff.department,
        status: 'active',
        contact_info: {
          phone: newStaff.phone,
          email: newStaff.email,
          address: '',
          emergency_contact: { name: '', relation: '', phone: '' }
        },
        payroll: {
          base_salary: newStaff.base_salary,
          allowances: newStaff.allowances,
          deductions: newStaff.deductions,
          bank_account: newStaff.bank_account,
          increment_history: []
        },
        academic_info: {
          qualifications: newStaff.qualifications,
          experience: newStaff.experience,
          joining_date: newStaff.joining_date,
          documents: []
        },
        performance: { rating: 5, reviews: [] },
        workload: { periods_per_week: 0, assigned_subjects: [] },
        user_uid: userUid,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'staff'), staffData);
      logHRActivity('ADD_STAFF', { name: newStaff.name, designation: newStaff.designation });
      
      setIsAddModalOpen(false);
      setOnboardingStep(1);
      setNewStaff({
        name: '', email: '', phone: '', designation: 'Teacher', department: 'Academic',
        base_salary: 0, allowances: 0, deductions: 0, bank_account: '',
        qualifications: '', experience: '', joining_date: format(new Date(), 'yyyy-MM-dd'),
        createAccess: true
      });
      toast.success('Staff member onboarded successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStaffStatus = async (id: string, status: StaffMember['status']) => {
    try {
      await updateDoc(doc(db, 'staff', id), { status });
      logHRActivity('UPDATE_STAFF_STATUS', { staff_id: id, status });
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // --- Render Helpers ---
  const renderKPIs = () => {
    const activeCount = staff.filter(s => s.status === 'active').length;
    const leaveCount = staff.filter(s => s.status === 'on-leave').length;
    const totalPayroll = staff.reduce((acc, s) => acc + (s.payroll.base_salary + s.payroll.allowances - s.payroll.deductions), 0);

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Staff', value: activeCount, icon: UserCheck, color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
          { label: 'On Leave', value: leaveCount, icon: Clock, color: 'text-neon-orange', bg: 'bg-neon-orange/10' },
          { label: 'Monthly Payroll', value: `PKR ${totalPayroll.toLocaleString()}`, icon: Wallet, color: 'text-neon-green', bg: 'bg-neon-green/10' },
          { label: 'Applications', value: applications.length, icon: FilePlus, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-center gap-4"
          >
            <div className={`p-4 ${kpi.bg} ${kpi.color} rounded-2xl`}>
              <kpi.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{kpi.label}</p>
              <h3 className="text-xl font-black text-white">{kpi.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="text-neon-blue animate-pulse" size={32} />
          </div>
        </div>
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Initializing HR Command Center...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black font-sans p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-2">
            HR <span className="text-neon-blue">Command Center</span>
          </h1>
          <p className="text-gray-500 font-medium max-w-xl">
            Professional Human Resource Management System. Manage staff roster, payroll, recruitment, and performance analytics.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveView('directory')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'directory' ? 'bg-neon-blue text-black shadow-[0_0_20px_rgba(0,243,255,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            Directory
          </button>
          <button 
            onClick={() => setActiveView('recruitment')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'recruitment' ? 'bg-neon-purple text-white shadow-[0_0_20px_rgba(188,19,254,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            Recruitment
          </button>
          <button 
            onClick={() => setActiveView('analytics')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'analytics' ? 'bg-neon-green text-black shadow-[0_0_20px_rgba(0,255,0,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveView('attendance')}
            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'attendance' ? 'bg-neon-orange text-black shadow-[0_0_20px_rgba(255,140,0,0.3)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            Attendance
          </button>
        </div>
      </div>

      {renderKPIs()}

      {activeView === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Staff Roster */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Staff Roster</h2>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="p-3 bg-neon-blue text-black rounded-xl hover:scale-105 transition-all shadow-lg"
                >
                  <UserPlus size={20} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text"
                  placeholder="Search by name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white text-sm focus:border-neon-blue outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'Academic', 'Admin', 'Support'].map(dept => (
                  <button 
                    key={dept}
                    onClick={() => setFilters({...filters, department: dept})}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filters.department === dept ? 'bg-white/10 text-neon-blue border border-neon-blue/30' : 'bg-white/5 text-gray-500 border border-transparent'}`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {filteredStaff.map(member => (
                  <motion.div 
                    key={member.id}
                    layout
                    onClick={() => setSelectedStaff(member)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedStaff?.id === member.id ? 'bg-neon-blue/10 border-neon-blue/30' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${selectedStaff?.id === member.id ? 'bg-neon-blue text-black' : 'bg-white/10 text-white'}`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-white group-hover:text-neon-blue transition-colors">{member.name}</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{member.designation}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${member.status === 'active' ? 'bg-neon-green' : 'bg-neon-orange'} shadow-[0_0_8px_currentColor]`} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Detailed View */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {selectedStaff ? (
                <motion.div 
                  key={selectedStaff.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden"
                >
                  {/* Profile Header */}
                  <div className="p-8 bg-gradient-to-br from-neon-blue/10 to-transparent border-b border-white/5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-neon-blue text-black rounded-3xl flex items-center justify-center font-black text-4xl shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                          {selectedStaff.name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-3xl font-black text-white uppercase tracking-tight">{selectedStaff.name}</h2>
                          <div className="flex flex-wrap gap-3 mt-2">
                            <span className="px-3 py-1 bg-white/10 text-neon-blue rounded-lg text-[10px] font-black uppercase tracking-widest border border-neon-blue/20">
                              {selectedStaff.designation}
                            </span>
                            <span className="px-3 py-1 bg-white/10 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">
                              {selectedStaff.department}
                            </span>
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${selectedStaff.status === 'active' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-neon-orange/10 text-neon-orange border-neon-orange/20'}`}>
                              {selectedStaff.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10">
                          <Phone size={20} />
                        </button>
                        <button className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10">
                          <Mail size={20} />
                        </button>
                        <button className="p-4 bg-neon-red/10 text-neon-red rounded-2xl hover:bg-neon-red/20 transition-all border border-neon-red/20">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Profile Tabs */}
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Personal & Academic */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-neon-blue/10 text-neon-blue rounded-lg">
                            <UserCheck size={18} />
                          </div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">Employee File</h3>
                        </div>
                        
                        <div className="bg-cyber-black/50 border border-white/5 p-6 rounded-3xl space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Qualifications</span>
                            <span className="text-sm text-white font-bold">{selectedStaff.academic_info.qualifications}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Experience</span>
                            <span className="text-sm text-white font-bold">{selectedStaff.academic_info.experience}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Joining Date</span>
                            <span className="text-sm text-white font-bold">{selectedStaff.academic_info.joining_date}</span>
                          </div>
                          <div className="pt-4 border-t border-white/5">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Emergency Contact</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white font-bold">{selectedStaff.contact_info.emergency_contact.name} ({selectedStaff.contact_info.emergency_contact.relation})</span>
                              <button className="p-2 bg-neon-blue/10 text-neon-blue rounded-lg hover:bg-neon-blue/20 transition-all">
                                <PhoneCall size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Document Vault */}
                        <div className="bg-cyber-black/50 border border-white/5 p-6 rounded-3xl">
                          <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Document Vault</p>
                            <button className="text-[10px] font-black text-neon-blue uppercase tracking-widest flex items-center gap-1">
                              <Upload size={12} /> Upload
                            </button>
                          </div>
                          <div className="space-y-2">
                            {selectedStaff.academic_info.documents.length > 0 ? (
                              selectedStaff.academic_info.documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <FileText size={16} className="text-gray-400" />
                                    <span className="text-xs text-white font-medium">{doc.name}</span>
                                  </div>
                                  <button className="p-2 text-gray-500 hover:text-neon-blue transition-colors">
                                    <Download size={14} />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] text-gray-600 italic">No documents uploaded yet.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Payroll & Performance */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-neon-green/10 text-neon-green rounded-lg">
                            <Wallet size={18} />
                          </div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">Payroll Engine</h3>
                        </div>

                        <div className="bg-cyber-black/50 border border-white/5 p-6 rounded-3xl space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Base Salary</span>
                            <span className="text-sm text-white font-bold">PKR {selectedStaff.payroll.base_salary.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Allowances</span>
                            <span className="text-sm text-neon-green font-bold">+ PKR {selectedStaff.payroll.allowances.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Deductions</span>
                            <span className="text-sm text-neon-red font-bold">- PKR {selectedStaff.payroll.deductions.toLocaleString()}</span>
                          </div>
                          <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Net Payable</p>
                              <p className="text-xl font-black text-white">PKR {(selectedStaff.payroll.base_salary + selectedStaff.payroll.allowances - selectedStaff.payroll.deductions).toLocaleString()}</p>
                            </div>
                            <button 
                              onClick={() => generateSalarySlip(selectedStaff)}
                              className="px-6 py-3 bg-neon-blue text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all flex items-center gap-2"
                            >
                              <Printer size={14} /> Slip
                            </button>
                          </div>
                        </div>

                        {/* Performance Review */}
                        <div className="bg-cyber-black/50 border border-white/5 p-6 rounded-3xl">
                          <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Performance Review</p>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} size={12} className={star <= selectedStaff.performance.rating ? 'text-neon-orange fill-neon-orange' : 'text-gray-700'} />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            {selectedStaff.performance.reviews.length > 0 ? (
                              selectedStaff.performance.reviews.slice(0, 2).map(review => (
                                <div key={review.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-gray-400 font-bold">{review.date}</span>
                                    <span className="text-[10px] text-neon-blue font-black uppercase">{review.reviewer}</span>
                                  </div>
                                  <p className="text-xs text-gray-300 leading-relaxed italic">"{review.remarks}"</p>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-[10px] text-gray-600 italic mb-3">No reviews recorded yet.</p>
                                <button className="px-4 py-2 bg-white/5 text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all">
                                  Add Review
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-[2.5rem] p-12 text-center">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-gray-700 mb-6">
                    <Users size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Select a Staff Member</h3>
                  <p className="text-gray-500 max-w-sm">Choose a staff member from the roster to view their full digital employee file, payroll, and performance data.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {activeView === 'recruitment' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Recruitment Module</h2>
              <p className="text-gray-500 text-sm">Manage job applications and interview pipeline.</p>
            </div>
            <button className="px-6 py-3 bg-neon-purple text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(188,19,254,0.3)] transition-all flex items-center gap-2">
              <Plus size={16} /> Post Job
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.length > 0 ? (
              applications.map(app => (
                <div key={app.id} className="bg-cyber-black/50 border border-white/5 p-6 rounded-3xl space-y-4 hover:border-neon-purple/30 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-black text-white group-hover:text-neon-purple transition-colors">{app.name}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{app.position}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                      app.status === 'applied' ? 'bg-blue-500/10 text-blue-500' :
                      app.status === 'interviewing' ? 'bg-neon-purple/10 text-neon-purple' :
                      app.status === 'offered' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Mail size={14} /> {app.email}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Phone size={14} /> {app.phone}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <button className="text-[10px] font-black text-neon-blue uppercase tracking-widest hover:underline">View Resume</button>
                    <div className="flex gap-2">
                      <button className="p-2 bg-white/5 text-gray-400 rounded-lg hover:text-neon-green transition-colors"><CheckCircle2 size={16} /></button>
                      <button className="p-2 bg-white/5 text-gray-400 rounded-lg hover:text-neon-red transition-colors"><XCircle size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-gray-700 mx-auto mb-6">
                  <FilePlus size={40} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">No Active Applications</h3>
                <p className="text-gray-500">New job applications will appear here once you post a vacancy.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeView === 'attendance' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-neon-green/10 text-neon-green rounded-2xl">
                  <UserCheck size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Daily Staff Attendance</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Mark presence for {attendanceDate}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input 
                  type="date" 
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-neon-green transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-white/5">
                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Staff Member</th>
                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Department</th>
                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Mark Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {staff.filter(s => s.status === 'active').map((member) => (
                    <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green/20 to-neon-blue/20 flex items-center justify-center text-white font-bold">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-neon-green transition-colors">{member.name}</div>
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{member.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-6">
                        <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {member.department}
                        </span>
                      </td>
                      <td className="py-6">
                        <div className="flex items-center justify-center gap-2">
                          {[
                            { id: 'present', label: 'P', color: 'bg-neon-green', text: 'text-neon-green' },
                            { id: 'absent', label: 'A', color: 'bg-neon-red', text: 'text-neon-red' },
                            { id: 'late', label: 'L', color: 'bg-neon-purple', text: 'text-neon-purple' },
                            { id: 'short-leave', label: 'S', color: 'bg-neon-blue', text: 'text-neon-blue' }
                          ].map((status) => (
                            <button
                              key={status.id}
                              onClick={() => handleMarkAttendance(member.id, member.name, status.id as any)}
                              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-black transition-all duration-300 ${
                                attendanceRecords[member.id] === status.id 
                                  ? `${status.color} border-${status.id === 'present' ? 'neon-green' : status.id === 'absent' ? 'neon-red' : status.id === 'late' ? 'neon-purple' : 'neon-blue'} text-black shadow-[0_0_15px_rgba(0,0,0,0.3)]` 
                                  : `bg-white/5 border-white/10 ${status.text} hover:border-white/20`
                              }`}
                              title={status.id.replace('-', ' ').toUpperCase()}
                            >
                              {status.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeView === 'analytics' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Workload Analytics */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-neon-blue/10 text-neon-blue rounded-2xl">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Workload Analytics</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Periods per week vs Capacity</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {staff.filter(s => s.department === 'Academic').slice(0, 5).map(teacher => (
                  <div key={teacher.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{teacher.name}</span>
                      <span className="text-[10px] font-black text-neon-blue uppercase">{teacher.workload.periods_per_week} / 30 Periods</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(teacher.workload.periods_per_week / 30) * 100}%` }}
                        className={`h-full rounded-full ${teacher.workload.periods_per_week > 25 ? 'bg-neon-red' : 'bg-neon-blue'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Trends */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-neon-green/10 text-neon-green rounded-2xl">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Attendance Trends</h2>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Average staff presence last 30 days</p>
                </div>
              </div>
              
              <div className="h-64 flex items-end justify-between gap-2">
                {[65, 80, 45, 90, 75, 85, 95].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      className="w-full bg-neon-green/20 border-t-2 border-neon-green rounded-t-lg"
                    />
                    <span className="text-[8px] font-black text-gray-600 uppercase">Day {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Onboarding Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-cyber-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-neon-blue text-black rounded-2xl">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Onboard New Staff</h3>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Step {onboardingStep} of 3</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {onboardingStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                          type="text"
                          value={newStaff.name}
                          onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                          placeholder="e.g. Sarah Jenkins"
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Email Address</label>
                        <input 
                          type="email"
                          value={newStaff.email}
                          onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                          placeholder="sarah.j@school.edu"
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Designation</label>
                        <input 
                          type="text"
                          value={newStaff.designation}
                          onChange={(e) => setNewStaff({...newStaff, designation: e.target.value})}
                          placeholder="e.g. Senior Teacher"
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Department</label>
                        <select 
                          value={newStaff.department}
                          onChange={(e) => setNewStaff({...newStaff, department: e.target.value})}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all appearance-none"
                        >
                          <option value="Academic">Academic</option>
                          <option value="Admin">Admin</option>
                          <option value="Support">Support</option>
                          <option value="Security">Security</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Base Salary (PKR)</label>
                        <input 
                          type="number"
                          value={newStaff.base_salary}
                          onChange={(e) => setNewStaff({...newStaff, base_salary: Number(e.target.value)})}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Allowances (PKR)</label>
                        <input 
                          type="number"
                          value={newStaff.allowances}
                          onChange={(e) => setNewStaff({...newStaff, allowances: Number(e.target.value)})}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Bank Account / IBAN</label>
                      <input 
                        type="text"
                        value={newStaff.bank_account}
                        onChange={(e) => setNewStaff({...newStaff, bank_account: e.target.value})}
                        placeholder="PK00 BANK 0000..."
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-neon-blue/10 rounded-3xl flex items-center justify-center text-neon-blue mx-auto">
                        <ShieldCheck size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">System Access Setup</h4>
                      <p className="text-gray-500 text-sm max-w-md mx-auto">Enable this to allow the staff member to log in to the portal with their own credentials.</p>
                      
                      <button 
                        onClick={() => setNewStaff({...newStaff, createAccess: !newStaff.createAccess})}
                        className={`w-full max-w-xs mx-auto py-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] ${
                          newStaff.createAccess ? 'bg-neon-blue/10 border-neon-blue text-neon-blue' : 'bg-white/5 border-white/10 text-gray-500'
                        }`}
                      >
                        {newStaff.createAccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        {newStaff.createAccess ? 'Access Enabled' : 'Enable Access'}
                      </button>
                    </div>

                    <div className="p-6 bg-neon-blue/5 border border-neon-blue/20 rounded-3xl flex gap-4">
                      <AlertCircle className="text-neon-blue shrink-0" size={24} />
                      <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                        By completing onboarding, you confirm that all information provided is accurate. A security audit log will be created for this action.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-white/5 bg-white/5 flex justify-between items-center">
                <button 
                  onClick={() => onboardingStep > 1 ? setOnboardingStep(onboardingStep - 1) : setIsAddModalOpen(false)}
                  className="px-8 py-4 rounded-2xl text-gray-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                  {onboardingStep === 1 ? 'Cancel' : 'Back'}
                </button>
                <button 
                  onClick={() => onboardingStep < 3 ? setOnboardingStep(onboardingStep + 1) : handleAddStaff()}
                  disabled={submitting}
                  className="px-10 py-4 rounded-2xl bg-neon-blue text-black font-black uppercase tracking-widest text-[10px] hover:shadow-[0_0_25px_#00f3ff] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={14} /> : onboardingStep === 3 ? <Save size={14} /> : <ArrowRight size={14} />}
                  {submitting ? 'Processing...' : onboardingStep === 3 ? 'Complete Onboarding' : 'Next Step'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 243, 255, 0.2);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default TeacherHRManagement;
