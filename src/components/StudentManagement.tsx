import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Search, Filter, List, LayoutGrid, 
  MoreHorizontal, Eye, Trash2, UserCheck2, UserX, 
  Activity, ShieldCheck, TrendingUp, MessageSquare, 
  X, User, ChevronRight, Briefcase, Phone, QrCode,
  IdCard, Loader2, CheckCircle2, MoreVertical, Edit2,
  Mail, MapPin, Calendar, GraduationCap, XCircle,
  Clock, ArrowRight, Download, FileText, AlertCircle,
  Plus, Camera, Heart, History, Cake, FileUp, Save,
  Printer, Bus, Home, Star, ShieldAlert, FileDown,
  Link2, Trash
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, updateDoc, addDoc, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import StudentAdmissionWizard from './StudentAdmissionWizard';
import StudentProfile from './StudentProfile';

export interface Student {
  id: string;
  student_id: string;
  personal_info: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    photoUrl?: string;
  };
  academic_info: {
    grade: string;
    section: string;
    rollNumber?: string;
    admissionYear: string;
  };
  guardian_info: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    occupation?: string;
  };
  school_id: string;
  sibling_ids?: string[];
  qr_code?: string;
  documents?: {
    name: string;
    url: string;
    type: string;
    uploaded_at: any;
  }[];
  timeline?: {
    event: string;
    date: any;
    type: string;
    details?: string;
  }[];
  behavior_stats?: {
    merits: number;
    demerits: number;
  };
  status: 'active' | 'inactive' | 'suspended' | 'withdrawn' | 'alumni';
  admission_date: string;
  created_at: any;
}

const StudentManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isAdmissionWizardOpen, setIsAdmissionWizardOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(db, 'students'),
      where('school_id', '==', schoolId),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching students:", error);
      setLoading(false);
      toast.error("Failed to load students. Check permissions.");
    });

    return () => unsubscribe();
  }, [schoolId]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const searchLower = searchQuery.toLowerCase();
      const fullName = `${s.personal_info.firstName} ${s.personal_info.lastName}`.toLowerCase();
      const matchesSearch = 
        fullName.includes(searchLower) || 
        s.student_id.toLowerCase().includes(searchLower) ||
        s.academic_info.rollNumber?.toLowerCase().includes(searchLower) ||
        s.academic_info.grade.toLowerCase().includes(searchLower) ||
        s.academic_info.section.toLowerCase().includes(searchLower) ||
        s.guardian_info.name.toLowerCase().includes(searchLower) ||
        s.personal_info.bloodGroup?.toLowerCase().includes(searchLower);

      const matchesClass = filterClass === 'All' || s.academic_info.grade === filterClass;
      const matchesStatus = filterStatus === 'All' || s.status === filterStatus.toLowerCase();
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, searchQuery, filterClass, filterStatus]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleBulkPromote = async () => {
    if (selectedStudents.length === 0) return;
    const batch = writeBatch(db);
    selectedStudents.forEach(id => {
      const student = students.find(s => s.id === id);
      if (student) {
        const currentGrade = parseInt(student.academic_info.grade);
        if (!isNaN(currentGrade)) {
          batch.update(doc(db, 'students', id), {
            'academic_info.grade': (currentGrade + 1).toString(),
            'updated_at': serverTimestamp()
          });
        }
      }
    });
    
    try {
      await batch.commit();
      toast.success(`Promoted ${selectedStudents.length} students to next class`);
      setSelectedStudents([]);
    } catch (error) {
      toast.error("Failed to promote students");
    }
  };

  const handleCreateAuditLog = async (action: string, resourceId: string) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        school_id: schoolId,
        actor_uid: auth.currentUser?.uid,
        actor_email: auth.currentUser?.email,
        action_type: 'STUDENT_MANAGEMENT',
        resource: 'Student',
        resource_id: resourceId,
        details: action,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }
  };

  const handleViewProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsProfileOpen(true);
  };

  if (isAdmissionWizardOpen) {
    return (
      <StudentAdmissionWizard 
        schoolId={schoolId} 
        onSuccess={() => {
          setIsAdmissionWizardOpen(false);
          handleCreateAuditLog('New Admission Created', 'new');
        }}
        onCancel={() => setIsAdmissionWizardOpen(false)}
      />
    );
  }

  if (isProfileOpen && selectedStudentId) {
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      return (
        <StudentProfile 
          student={student} 
          onBack={() => setIsProfileOpen(false)}
          onUpdate={async (updates) => {
            await updateDoc(doc(db, 'students', student.id), updates);
            handleCreateAuditLog('Student Profile Updated', student.id);
          }}
        />
      );
    }
  }

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans'] bg-slate-50 min-h-screen p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-900/20">
              <Users size={24} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Information <span className="text-slate-400 font-medium">System</span></h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Manage admissions, profiles, and academic records for your school.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAdmissionWizardOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
          >
            <UserPlus size={18} />
            New Admission
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: students.length, icon: Users, color: 'blue' },
          { label: 'Active', value: students.filter(s => s.status === 'active').length, icon: CheckCircle2, color: 'green' },
          { label: 'New This Month', value: 12, icon: UserPlus, color: 'purple' },
          { label: 'Avg Attendance', value: '96.4%', icon: Activity, color: 'amber' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by Name, Roll No, or Student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
            />
          </div>
          
          <div className="flex gap-3">
            <select 
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-900 transition-all"
            >
              <option value="All">All Classes</option>
              {['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>

            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-900 transition-all"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button 
                onClick={() => setViewMode('table')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedStudents.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl text-white shadow-xl"
            >
              <div className="flex items-center gap-4 ml-2">
                <span className="text-xs font-bold uppercase tracking-widest">{selectedStudents.length} Students Selected</span>
                <div className="h-4 w-[1px] bg-white/20" />
                <button 
                  onClick={handleBulkPromote}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-green-400 transition-colors"
                >
                  <TrendingUp size={14} />
                  Promote to Next Class
                </button>
                <button 
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 transition-colors"
                >
                  <IdCard size={14} />
                  Export ID Cards
                </button>
              </div>
              <button 
                onClick={() => setSelectedStudents([])}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Student List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-slate-900" size={40} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-slate-200 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserX className="text-slate-300" size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Students Found</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm">Try adjusting your filters or search query to find what you're looking for.</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-6 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={selectAllStudents}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Profile</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Academic Info</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Guardian</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className={`group hover:bg-slate-50 transition-colors ${selectedStudents.includes(student.id) ? 'bg-slate-50' : ''}`}>
                    <td className="px-8 py-6">
                      <input 
                        type="checkbox" 
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden">
                          {student.personal_info.photoUrl ? (
                            <img src={student.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="text-slate-300" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-slate-900 transition-colors">
                            {student.personal_info.firstName} {student.personal_info.lastName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {student.student_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Class {student.academic_info.grade} - {student.academic_info.section}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roll: {student.academic_info.rollNumber || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">{student.guardian_info.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{student.guardian_info.phone}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                        student.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' :
                        student.status === 'suspended' ? 'bg-red-50 text-red-600 border-red-100' :
                        'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleViewProfile(student.id)}
                          className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200"
                        >
                          <Eye size={16} />
                        </button>
                        <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <motion.div 
                key={student.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-200 hover:border-slate-900/30 transition-all group relative overflow-hidden shadow-sm hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox" 
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
                      {student.personal_info.photoUrl ? (
                        <img src={student.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="text-slate-300" size={24} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      student.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {student.status}
                    </span>
                    <p className="text-[10px] font-mono text-slate-900 font-bold">{student.student_id}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-xl font-bold text-slate-900 tracking-tight mb-1 group-hover:text-slate-900 transition-colors">
                    {student.personal_info.firstName} {student.personal_info.lastName}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Class {student.academic_info.grade} • Section {student.academic_info.section}
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Briefcase size={14} className="text-slate-400" />
                    <span className="text-xs font-bold">{student.guardian_info.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-xs font-mono">{student.guardian_info.phone}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex gap-3">
                  <button 
                    onClick={() => handleViewProfile(student.id)}
                    className="flex-grow py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200"
                  >
                    View Profile
                  </button>
                  <button className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-xl transition-all border border-slate-200">
                    <QrCode size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagement;
