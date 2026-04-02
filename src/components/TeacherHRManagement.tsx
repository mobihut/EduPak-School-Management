import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  ChevronRight, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  Briefcase, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  Plus,
  X,
  Save,
  Trash2,
  Edit3,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  TrendingUp,
  PieChart,
  DollarSign,
  BookOpen,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface StaffMember {
  staff_id: string;
  school_id: string;
  name: string;
  designation: string;
  department: string;
  contact_info: {
    phone: string;
    email: string;
    address: string;
  };
  payroll: {
    base_salary: number;
    allowances: number;
    deductions: number;
    bank_account: string;
    leave_balances?: {
      casual_leaves: number;
      medical_leaves: number;
      half_day_leaves: number;
    };
  };
  academic_info: {
    qualifications: string;
    experience: string;
    joining_date: string;
  };
  assigned_classes: string[];
  is_active: boolean;
  user_uid?: string | null;
  created_at: any;
}

interface TeacherHRManagementProps {
  schoolId: string;
}

const TeacherHRManagement: React.FC<TeacherHRManagementProps> = ({ schoolId }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'payroll' | 'classes'>('personal');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // New Staff Form State
  const [newStaff, setNewStaff] = useState({
    name: '',
    designation: '',
    phone: '',
    email: '',
    department: 'Teaching',
    base_salary: 0,
    createAccess: false,
    qualifications: '',
    experience: '',
    joining_date: new Date().toISOString().split('T')[0],
    address: '',
    bank_account: ''
  });

  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(db, 'staff'),
      where('school_id', '==', schoolId),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        ...doc.data(),
        staff_id: doc.id
      } as StaffMember));
      setStaff(staffData);
      if (staffData.length > 0 && !selectedStaff) {
        setSelectedStaff(staffData[0]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load staff directory");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.designation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = deptFilter === 'all' || s.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' ? s.is_active : !s.is_active);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [staff, searchTerm, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = staff.filter(s => s.is_active).length;
    const teaching = staff.filter(s => s.department === 'Teaching').length;
    const nonTeaching = staff.length - teaching;
    const totalPayroll = staff.reduce((acc, s) => acc + (s.payroll?.base_salary || 0), 0);
    
    return { active, teaching, nonTeaching, totalPayroll };
  }, [staff]);

  const handleAddStaff = async () => {
    setSubmitting(true);
    try {
      const staffId = `STF-${Date.now()}`;
      let userUid = null;

      // If system access is requested, call backend API
      if (newStaff.createAccess) {
        const response = await fetch('/api/admin/create-staff-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newStaff.name,
            email: newStaff.email,
            role: newStaff.department === 'Teaching' ? 'teacher' : 'staff',
            schoolId,
            adminUid: auth.currentUser?.uid
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to create system access");
        userUid = result.userUid;
        toast.success(`System access created. Password: ${result.password}`);
      }

      const staffData: StaffMember = {
        staff_id: staffId,
        school_id: schoolId,
        name: newStaff.name,
        designation: newStaff.designation,
        department: newStaff.department,
        contact_info: {
          phone: newStaff.phone,
          email: newStaff.email,
          address: newStaff.address
        },
        payroll: {
          base_salary: Number(newStaff.base_salary),
          allowances: 0,
          deductions: 0,
          bank_account: newStaff.bank_account,
          leave_balances: {
            casual_leaves: 10,
            medical_leaves: 5,
            half_day_leaves: 12
          }
        },
        academic_info: {
          qualifications: newStaff.qualifications,
          experience: newStaff.experience,
          joining_date: newStaff.joining_date
        },
        assigned_classes: [],
        is_active: true,
        user_uid: userUid,
        created_at: serverTimestamp()
      };

      await setDoc(doc(db, 'staff', staffId), staffData);
      toast.success("Staff member onboarded successfully");
      setIsAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error onboarding staff:", error);
      toast.error(error.message || "Failed to onboard staff");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewStaff({
      name: '',
      designation: '',
      phone: '',
      email: '',
      department: 'Teaching',
      base_salary: 0,
      createAccess: false,
      qualifications: '',
      experience: '',
      joining_date: new Date().toISOString().split('T')[0],
      address: '',
      bank_account: ''
    });
    setOnboardingStep(1);
  };

  const departments = ['Teaching', 'Administration', 'Accounts', 'Security', 'Maintenance', 'Transport'];

  return (
    <div className="space-y-8 p-6 animate-in fade-in duration-700">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-cyber-gray/50 border border-white/10 p-6 rounded-3xl neon-shadow-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={80} />
          </div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Active Staff</p>
          <h3 className="text-3xl font-black text-white">{stats.active}</h3>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-green-400">
            <TrendingUp size={12} /> <span>+2 this month</span>
          </div>
        </div>

        <div className="bg-cyber-gray/50 border border-white/10 p-6 rounded-3xl neon-shadow-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChart size={80} />
          </div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Teaching vs Non-Teaching</p>
          <div className="flex items-end gap-4">
            <h3 className="text-3xl font-black text-white">{stats.teaching} <span className="text-xs text-gray-500 font-bold">/ {stats.nonTeaching}</span></h3>
          </div>
          <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-neon-blue shadow-[0_0_10px_#00f3ff]" 
              style={{ width: `${(stats.teaching / (staff.length || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-cyber-gray/50 border border-white/10 p-6 rounded-3xl neon-shadow-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={80} />
          </div>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Monthly Payroll Est.</p>
          <h3 className="text-3xl font-black text-neon-purple">PKR {stats.totalPayroll.toLocaleString()}</h3>
          <p className="mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next payout: April 1st</p>
        </div>
      </div>

      {/* Main Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]">
        {/* Left Pane: Roster */}
        <div className="lg:col-span-4 flex flex-col bg-cyber-gray/30 border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white uppercase tracking-tighter">Staff Roster</h2>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="p-2 bg-neon-blue text-black rounded-xl hover:shadow-[0_0_15px_#00f3ff] transition-all"
              >
                <UserPlus size={18} />
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-cyber-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-neon-blue outline-none transition-all"
              />
            </div>

            <div className="flex gap-2">
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="flex-1 bg-cyber-black/50 border border-white/10 rounded-xl py-2 px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest outline-none focus:border-neon-blue"
              >
                <option value="all">All Depts</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-cyber-black/50 border border-white/10 rounded-xl py-2 px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest outline-none focus:border-neon-blue"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {filteredStaff.map((member) => (
              <button
                key={member.staff_id}
                onClick={() => setSelectedStaff(member)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                  selectedStaff?.staff_id === member.staff_id 
                    ? 'bg-neon-blue/10 border-neon-blue/30 shadow-[0_0_15px_rgba(0,243,255,0.1)]' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center text-neon-blue font-black text-xl">
                  {member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{member.name}</h4>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest truncate">{member.designation}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    member.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <ChevronRight size={14} className={`text-gray-600 transition-transform ${selectedStaff?.staff_id === member.staff_id ? 'translate-x-1 text-neon-blue' : ''}`} />
                </div>
              </button>
            ))}
            {filteredStaff.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users size={40} className="text-gray-700 mb-4" />
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No staff found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Profile & Management */}
        <div className="lg:col-span-8 bg-cyber-gray/30 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
          {selectedStaff ? (
            <>
              {/* Profile Header */}
              <div className="p-8 border-b border-white/5 bg-gradient-to-r from-neon-blue/5 to-transparent">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-32 h-32 rounded-3xl bg-cyber-black border-2 border-neon-blue/30 flex items-center justify-center text-neon-blue font-black text-5xl shadow-[0_0_30px_rgba(0,243,255,0.1)]">
                    {selectedStaff.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-2">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedStaff.name}</h1>
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        ID: {selectedStaff.staff_id}
                      </span>
                    </div>
                    <p className="text-neon-blue font-black uppercase tracking-[0.2em] text-xs">{selectedStaff.designation} • {selectedStaff.department}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 pt-2">
                      <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <Mail size={14} /> <span>{selectedStaff.contact_info.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <Phone size={14} /> <span>{selectedStaff.contact_info.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                      <Edit3 size={18} />
                    </button>
                    <button className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 hover:bg-red-500/20 transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-white/5 px-8">
                {[
                  { id: 'personal', label: 'Personal & Academic', icon: GraduationCap },
                  { id: 'payroll', label: 'Payroll & Attendance', icon: Wallet },
                  { id: 'classes', label: 'Classes & Subjects', icon: BookOpen }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                      activeTab === tab.id ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue shadow-[0_0_10px_#00f3ff]"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <AnimatePresence mode="wait">
                  {activeTab === 'personal' && (
                    <motion.div
                      key="personal"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-8"
                    >
                      <div className="space-y-6">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Briefcase size={14} /> Professional Details
                        </h3>
                        <div className="space-y-4">
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Qualifications</p>
                            <p className="text-sm text-white font-medium">{selectedStaff.academic_info.qualifications || 'Not specified'}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Experience</p>
                            <p className="text-sm text-white font-medium">{selectedStaff.academic_info.experience || 'Not specified'}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Joining Date</p>
                            <p className="text-sm text-white font-medium">{selectedStaff.academic_info.joining_date}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <MapPin size={14} /> Contact & Address
                        </h3>
                        <div className="space-y-4">
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Residential Address</p>
                            <p className="text-sm text-white font-medium leading-relaxed">{selectedStaff.contact_info.address || 'No address provided'}</p>
                          </div>
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">System Access</p>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-white font-medium">{selectedStaff.user_uid ? 'Enabled' : 'Disabled'}</p>
                              {selectedStaff.user_uid && (
                                <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">Active Account</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'payroll' && (
                    <motion.div
                      key="payroll"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-neon-purple/5 border border-neon-purple/20 p-6 rounded-3xl">
                          <p className="text-[10px] text-neon-purple font-black uppercase tracking-widest mb-1">Base Salary</p>
                          <h4 className="text-2xl font-black text-white">PKR {selectedStaff.payroll.base_salary.toLocaleString()}</h4>
                        </div>
                        <div className="bg-green-500/5 border border-green-500/20 p-6 rounded-3xl">
                          <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-1">Allowances</p>
                          <h4 className="text-2xl font-black text-white">PKR {selectedStaff.payroll.allowances.toLocaleString()}</h4>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl">
                          <p className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-1">Deductions</p>
                          <h4 className="text-2xl font-black text-white">PKR {selectedStaff.payroll.deductions.toLocaleString()}</h4>
                        </div>
                      </div>

                      {/* Leave Balances Section */}
                      <div className="space-y-6">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={14} /> Leave Entitlements
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Casual Leaves</p>
                            <h4 className="text-2xl font-black text-white">{selectedStaff.payroll.leave_balances?.casual_leaves ?? 10} <span className="text-xs text-gray-600">Days</span></h4>
                          </div>
                          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Medical Leaves</p>
                            <h4 className="text-2xl font-black text-white">{selectedStaff.payroll.leave_balances?.medical_leaves ?? 5} <span className="text-xs text-gray-600">Days</span></h4>
                          </div>
                          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Half-Day Leaves</p>
                            <h4 className="text-2xl font-black text-white">{selectedStaff.payroll.leave_balances?.half_day_leaves ?? 12} <span className="text-xs text-gray-600">Units</span></h4>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Wallet size={14} /> Banking Information
                          </h3>
                          <div className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-4">
                            <div>
                              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Bank Account / IBAN</p>
                              <p className="text-sm text-white font-mono">{selectedStaff.payroll.bank_account || 'Not provided'}</p>
                            </div>
                            <div className="pt-4 border-t border-white/5">
                              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Payment Method</p>
                              <p className="text-sm text-white font-bold">Bank Transfer</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={14} /> Attendance Overview (Current Month)
                          </h3>
                          <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                            <div className="grid grid-cols-7 gap-2">
                              {Array.from({ length: 31 }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`aspect-square rounded-lg flex items-center justify-center text-[8px] font-black ${
                                    i < 20 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                                    i < 22 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                    'bg-white/5 text-gray-600'
                                  }`}
                                >
                                  {i + 1}
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                              <span className="text-green-400">20 Present</span>
                              <span className="text-red-400">2 Absent</span>
                              <span className="text-gray-500">9 Remaining</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'classes' && (
                    <motion.div
                      key="classes"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <BookOpen size={14} /> Assigned Classes & Sections
                        </h3>
                        <button className="text-[10px] font-black text-neon-blue uppercase tracking-widest hover:underline">Manage Assignments</button>
                      </div>

                      {selectedStaff.assigned_classes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedStaff.assigned_classes.map((cls, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:border-neon-blue/30 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center text-neon-blue">
                                  <Users size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white">{cls}</p>
                                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Primary Teacher</p>
                                </div>
                              </div>
                              <ArrowRight size={16} className="text-gray-700 group-hover:text-neon-blue transition-colors" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-dashed border-white/10 rounded-3xl text-center">
                          <BookOpen size={40} className="text-gray-700 mb-4" />
                          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No classes assigned to this staff</p>
                          <button className="mt-4 px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
                            Assign Now
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 text-gray-700">
                <Users size={48} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Staff Selected</h3>
              <p className="text-gray-500 text-sm max-w-xs">Select a staff member from the roster to view their full profile and management options.</p>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-cyber-gray border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-neon-blue/10 to-transparent">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Staff Onboarding</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Step {onboardingStep} of 3: {
                    onboardingStep === 1 ? 'Basic Information' : onboardingStep === 2 ? 'Payroll Setup' : 'System Access'
                  }</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {onboardingStep === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Full Name</label>
                      <input 
                        type="text"
                        value={newStaff.name}
                        onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                        placeholder="e.g. John Doe"
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Designation</label>
                      <input 
                        type="text"
                        value={newStaff.designation}
                        onChange={(e) => setNewStaff({...newStaff, designation: e.target.value})}
                        placeholder="e.g. Senior Math Teacher"
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
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Phone Number</label>
                      <input 
                        type="tel"
                        value={newStaff.phone}
                        onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                        placeholder="+92 300 1234567"
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Residential Address</label>
                      <textarea 
                        value={newStaff.address}
                        onChange={(e) => setNewStaff({...newStaff, address: e.target.value})}
                        placeholder="Full street address..."
                        rows={3}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-neon-purple/5 border border-neon-purple/10 p-6 rounded-3xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 flex items-center justify-center text-neon-purple">
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-white uppercase tracking-tight">Salary Structure</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Define base compensation and banking</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Base Monthly Salary (PKR)</label>
                          <input 
                            type="number"
                            value={newStaff.base_salary}
                            onChange={(e) => setNewStaff({...newStaff, base_salary: Number(e.target.value)})}
                            className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-purple outline-none transition-all text-xl font-black"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Bank Account / IBAN</label>
                          <input 
                            type="text"
                            value={newStaff.bank_account}
                            onChange={(e) => setNewStaff({...newStaff, bank_account: e.target.value})}
                            placeholder="PK00 XXXX XXXX XXXX"
                            className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-purple outline-none transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Qualifications</label>
                        <input 
                          type="text"
                          value={newStaff.qualifications}
                          onChange={(e) => setNewStaff({...newStaff, qualifications: e.target.value})}
                          placeholder="e.g. M.Phil in Mathematics"
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Experience</label>
                        <input 
                          type="text"
                          value={newStaff.experience}
                          onChange={(e) => setNewStaff({...newStaff, experience: e.target.value})}
                          placeholder="e.g. 5 Years in Education"
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-cyber-black/50 border border-white/10 p-8 rounded-[2rem] text-center space-y-6">
                      <div className="w-20 h-20 bg-neon-blue/10 rounded-3xl flex items-center justify-center text-neon-blue mx-auto mb-4">
                        <Lock size={32} />
                      </div>
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">System Access Setup</h4>
                      <p className="text-gray-500 text-sm max-w-md mx-auto">Enable this to allow the staff member to log in to the EduPak portal with their own credentials.</p>
                      
                      <button 
                        onClick={() => setNewStaff({...newStaff, createAccess: !newStaff.createAccess})}
                        className={`w-full max-w-xs mx-auto py-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs ${
                          newStaff.createAccess 
                            ? 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_20px_rgba(0,243,255,0.2)]' 
                            : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                        }`}
                      >
                        {newStaff.createAccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        {newStaff.createAccess ? 'Access Enabled' : 'Enable System Access'}
                      </button>
                    </div>

                    {newStaff.createAccess && (
                      <div className="space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Login Email Address</label>
                          <input 
                            type="email"
                            value={newStaff.email}
                            onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                            placeholder="staff@school.com"
                            className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-neon-blue outline-none transition-all"
                          />
                        </div>
                        <div className="p-4 bg-neon-blue/5 border border-neon-blue/20 rounded-2xl flex items-start gap-3">
                          <AlertCircle size={16} className="text-neon-blue mt-0.5" />
                          <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                            A secure random password will be generated and displayed after onboarding. The staff member will be required to reset it upon their first login.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-white/5 bg-cyber-black/30 flex justify-between items-center">
                <button 
                  onClick={() => onboardingStep > 1 ? setOnboardingStep(onboardingStep - 1) : setIsAddModalOpen(false)}
                  className="px-8 py-4 rounded-2xl text-gray-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                  {onboardingStep === 1 ? 'Cancel' : 'Back'}
                </button>
                <button 
                  onClick={() => onboardingStep < 3 ? setOnboardingStep(onboardingStep + 1) : handleAddStaff()}
                  disabled={submitting}
                  className="px-10 py-4 rounded-2xl bg-neon-blue text-black font-black uppercase tracking-widest text-[10px] hover:shadow-[0_0_25px_#00f3ff] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : onboardingStep === 3 ? <Save size={14} /> : <ArrowRight size={14} />}
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
      `}</style>
    </div>
  );
};

export default TeacherHRManagement;
