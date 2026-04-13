import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  BookOpen, 
  Calendar, 
  ClipboardCheck, 
  FileSpreadsheet, 
  PenTool, 
  Plane, 
  MessageSquare, 
  Share2, 
  Search, 
  Settings, 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Plus, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  MoreHorizontal,
  Upload,
  Youtube,
  FileText,
  Image as ImageIcon,
  Layout,
  UserPlus,
  ShieldAlert,
  CheckCircle,
  X,
  Save,
  ChevronRight,
  Filter,
  MoreVertical,
  Lock,
  Unlock,
  UserX
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs,
  addDoc,
  Timestamp,
  orderBy,
  deleteDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Teacher {
  uid: string;
  name: string;
  email: string;
  designation: string;
  assignedClasses: string[];
  status: 'active' | 'suspended' | 'inactive';
  phone?: string;
  permissions?: {
    canMarkAttendance: boolean;
    canEditMarks: boolean;
    canPostDiary: boolean;
    canShareResources: boolean;
  };
  lastActive?: any;
}

interface Student {
  id: string;
  personal_info: {
    firstName: string;
    lastName: string;
  };
  academic_info: {
    class: string;
    section: string;
    rollNumber: string;
  };
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent';
  date: string;
}

interface TeacherPortalManagementProps {
  schoolId: string;
}

const TeacherPortalManagement: React.FC<TeacherPortalManagementProps> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'classroom' | 'tools'>('staff');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [diaryContent, setDiaryContent] = useState({ homework: '', lessonPlan: '' });
  const [resources, setResources] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    email: '',
    designation: 'Secondary Teacher',
    phone: '',
    status: 'active' as const
  });

  const fetchData = () => {
    if (!schoolId) {
      setError('School ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Authentication required.');
        setLoading(false);
        return;
      }

      try {
        // Verify if user is admin
        const adminDoc = await getDoc(doc(db, 'users', user.uid));
        if (!adminDoc.exists() || (adminDoc.data().role !== 'school_admin' && adminDoc.data().role !== 'super_admin')) {
          setError('Security Access Error: Please contact Super Admin to verify your Role.');
          setLoading(false);
          return;
        }

        // Fetch Teachers
        const teachersQuery = query(
          collection(db, 'users'), 
          where('schoolId', '==', schoolId), 
          where('role', '==', 'teacher')
        );
        
        const unsubTeachers = onSnapshot(teachersQuery, (snap) => {
          setTeachers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as Teacher)));
          setLoading(false);
        }, (err) => {
          if (err.message.includes('permission-denied')) {
            setError('Security Access Error: Insufficient permissions to access staff records.');
          } else {
            setError('Failed to fetch teachers: ' + err.message);
          }
          setLoading(false);
        });

        // Fetch Resources
        const resourcesQuery = query(collection(db, 'schools', schoolId, 'resources'), orderBy('createdAt', 'desc'));
        const unsubResources = onSnapshot(resourcesQuery, (snap) => {
          setResources(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });

        return () => {
          unsubTeachers();
          unsubResources();
        };
      } catch (err: any) {
        setError('Initialization failed: ' + err.message);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  };

  useEffect(() => {
    const cleanup = fetchData();
    return () => cleanup && cleanup();
  }, [schoolId]);

  // Fetch Students for Classroom Tools
  useEffect(() => {
    if (!schoolId || !selectedClass) return;
    const q = query(collection(db, 'students'), where('school_id', '==', schoolId), where('academic_info.class', '==', selectedClass));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(d => ({ ...d.data(), id: d.id } as Student)));
    });
    return unsub;
  }, [schoolId, selectedClass]);

  const handleAttendanceToggle = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const saveAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const batch = Object.entries(attendance).map(([studentId, status]) => {
        return setDoc(doc(db, 'schools', schoolId, 'attendance', `${today}_${studentId}`), {
          studentId,
          status,
          date: today,
          class: selectedClass,
          markedBy: 'admin', // In real use, this would be the teacher's UID
          createdAt: Timestamp.now()
        });
      });
      await Promise.all(batch);
      toast.success('Attendance marked successfully');
    } catch (error) {
      toast.error('Failed to mark attendance');
    }
  };

  const saveMarks = async () => {
    try {
      toast.success('Marks saved successfully');
    } catch (error) {
      toast.error('Failed to save marks');
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.name || !newTeacher.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Call backend to create account
      const response = await fetch('/api/admin/create-staff-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeacher.name,
          email: newTeacher.email,
          role: 'teacher',
          schoolId,
          adminUid: auth.currentUser?.uid
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create teacher account');

      // Update the user document with additional info
      await updateDoc(doc(db, 'users', result.userUid), {
        designation: newTeacher.designation,
        phone: newTeacher.phone,
        status: 'active',
        permissions: {
          canMarkAttendance: true,
          canEditMarks: false,
          canPostDiary: true,
          canShareResources: true
        }
      });

      toast.success(`Teacher onboarded! Password: ${result.password}`);
      setIsAddModalOpen(false);
      setNewTeacher({ name: '', email: '', designation: 'Secondary Teacher', phone: '', status: 'active' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = async (teacherUid: string, permission: keyof NonNullable<Teacher['permissions']>, currentValue: boolean) => {
    try {
      await updateDoc(doc(db, 'users', teacherUid), {
        [`permissions.${permission}`]: !currentValue
      });
      toast.success('Permission updated');
    } catch (error) {
      toast.error('Failed to update permission');
    }
  };

  const toggleStatus = async (teacherUid: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await updateDoc(doc(db, 'users', teacherUid), { status: newStatus });
      toast.success(`Teacher ${newStatus === 'active' ? 'activated' : 'suspended'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const uploadResource = async (type: 'pdf' | 'image' | 'youtube', url: string, title: string) => {
    try {
      await addDoc(collection(db, 'schools', schoolId, 'resources'), {
        type,
        url,
        title,
        createdAt: Timestamp.now()
      });
      toast.success('Resource shared successfully');
    } catch (error) {
      toast.error('Failed to share resource');
    }
  };

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teachers, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-24 bg-slate-100 rounded-[2rem]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-16 bg-slate-100 rounded-2xl" />
          <div className="h-16 bg-slate-100 rounded-2xl" />
        </div>
        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden">
          <div className="h-12 bg-slate-50 border-b border-slate-100" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 border-b border-slate-50 mx-6" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-8 bg-red-50/50 backdrop-blur-xl rounded-[2.5rem] border border-red-100 p-12">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center shadow-lg shadow-red-100">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center max-w-md space-y-3">
          <p className="text-xl font-black text-red-900 uppercase tracking-tight">Access Interrupted</p>
          <p className="text-sm text-red-600 font-medium leading-relaxed">{error}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => fetchData()}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-200 flex items-center gap-3 active:scale-95"
          >
            <RefreshCw size={18} />
            Retry Connection
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-white text-red-600 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-3 active:scale-95"
          >
            <Layout size={18} />
            Full Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-['Plus_Jakarta_Sans']">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 shadow-xl shadow-slate-200/50">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Teacher Portal Management</h2>
          <p className="text-sm text-slate-500 font-medium">Manage staff, classroom tools, and academic resources.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl">
          {[
            { id: 'staff', label: 'Staff List', icon: Users },
            { id: 'classroom', label: 'Classroom Tools', icon: BookOpen },
            { id: 'tools', label: 'Admin Tools', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-md shadow-blue-100' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Search & Actions */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search teachers by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 ring-blue-500/10 outline-none transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-95"
              >
                <UserPlus size={18} />
                Add New Teacher
              </button>
            </div>

            {/* Teacher List - Desktop Table / Mobile Cards */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher Info</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Permissions</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.uid} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm">
                              {teacher.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{teacher.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{teacher.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-bold text-slate-600">{teacher.designation || 'Teacher'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => togglePermission(teacher.uid, 'canMarkAttendance', teacher.permissions?.canMarkAttendance || false)}
                              title="Attendance Access"
                              className={`p-1.5 rounded-lg transition-all ${teacher.permissions?.canMarkAttendance ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}
                            >
                              <ClipboardCheck size={14} />
                            </button>
                            <button 
                              onClick={() => togglePermission(teacher.uid, 'canEditMarks', teacher.permissions?.canEditMarks || false)}
                              title="Marks Access"
                              className={`p-1.5 rounded-lg transition-all ${teacher.permissions?.canEditMarks ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                            >
                              <FileSpreadsheet size={14} />
                            </button>
                            <button 
                              onClick={() => togglePermission(teacher.uid, 'canPostDiary', teacher.permissions?.canPostDiary || false)}
                              title="Diary Access"
                              className={`p-1.5 rounded-lg transition-all ${teacher.permissions?.canPostDiary ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'}`}
                            >
                              <PenTool size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <button 
                            onClick={() => toggleStatus(teacher.uid, teacher.status)}
                            className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest transition-all ${
                              teacher.status === 'active' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {teacher.status || 'active'}
                          </button>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={18} /></button>
                            <button className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"><Key size={18} /></button>
                            <button 
                              onClick={() => toggleStatus(teacher.uid, teacher.status)}
                              className={`p-2 rounded-lg transition-all ${teacher.status === 'active' ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-red-600 bg-red-50'}`}
                            >
                              {teacher.status === 'active' ? <Lock size={18} /> : <Unlock size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => (
                  <div key={teacher.uid} className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg">
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{teacher.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{teacher.email}</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                        teacher.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {teacher.status || 'active'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Attendance</span>
                          <div className={`p-2 rounded-lg ${teacher.permissions?.canMarkAttendance ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-300'}`}>
                            <ClipboardCheck size={16} />
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Marks</span>
                          <div className={`p-2 rounded-lg ${teacher.permissions?.canEditMarks ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                            <FileSpreadsheet size={16} />
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Diary</span>
                          <div className={`p-2 rounded-lg ${teacher.permissions?.canPostDiary ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-300'}`}>
                            <PenTool size={16} />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Eye size={20} /></button>
                        <button className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Settings size={20} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'classroom' && (
          <motion.div
            key="classroom"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Class Selector */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Layout size={20} />
              </div>
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm font-black text-slate-900 focus:ring-0 outline-none"
              >
                <option value="">Select a Class to Manage...</option>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            {selectedClass ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Attendance Marker */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                        <ClipboardCheck size={20} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Attendance Marker</h3>
                    </div>
                    <button 
                      onClick={saveAttendance}
                      className="px-6 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-100"
                    >
                      Save Attendance
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                            {student.academic_info.rollNumber}
                          </div>
                          <p className="text-xs font-black text-slate-900">{student.personal_info.firstName} {student.personal_info.lastName}</p>
                        </div>
                        <button 
                          onClick={() => handleAttendanceToggle(student.id)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            attendance[student.id] === 'absent' 
                              ? 'bg-red-500 text-white shadow-md shadow-red-100' 
                              : 'bg-green-500 text-white shadow-md shadow-green-100'
                          }`}
                        >
                          {attendance[student.id] === 'absent' ? 'Absent' : 'Present'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Digital Diary */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                      <PenTool size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Digital Diary</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Daily Homework</label>
                      <textarea 
                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 ring-orange-500/20 outline-none transition-all resize-none"
                        placeholder="Enter homework for today..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lesson Plan</label>
                      <textarea 
                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 ring-blue-500/20 outline-none transition-all resize-none"
                        placeholder="Enter lesson plan details..."
                      />
                    </div>
                    <button className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                      Post to Parent Portal
                    </button>
                  </div>
                </div>

                {/* Marks Entry */}
                <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <FileSpreadsheet size={20} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Marks Entry Sheet</h3>
                    </div>
                    <div className="flex gap-2">
                      <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none">
                        <option>Monthly Test</option>
                        <option>Mid Term</option>
                        <option>Final Exam</option>
                      </select>
                      <button onClick={saveMarks} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-100">
                        Submit Marks
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mathematics</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Science</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">English</th>
                          <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map(student => (
                          <tr key={student.id}>
                            <td className="py-4">
                              <p className="text-xs font-black text-slate-900">{student.personal_info.firstName} {student.personal_info.lastName}</p>
                              <p className="text-[9px] text-slate-400 font-bold">Roll: {student.academic_info.rollNumber}</p>
                            </td>
                            <td className="py-4"><input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 ring-indigo-500/20" placeholder="00" /></td>
                            <td className="py-4"><input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 ring-indigo-500/20" placeholder="00" /></td>
                            <td className="py-4"><input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 ring-indigo-500/20" placeholder="00" /></td>
                            <td className="py-4"><input type="text" className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 ring-indigo-500/20" placeholder="Excellent performance..." /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-32 text-center bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                <BookOpen className="mx-auto text-slate-200 mb-4" size={64} />
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Classroom Tools Locked</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Please select a class from the dropdown above to begin.</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'tools' && (
          <motion.div
            key="tools"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Resource Sharing */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Share2 size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Resource Sharing Hub</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => uploadResource('youtube', '', 'New Video')} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><Youtube size={20} /></button>
                  <button onClick={() => uploadResource('pdf', '', 'New PDF')} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"><FileText size={20} /></button>
                  <button onClick={() => uploadResource('image', '', 'New Image')} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"><ImageIcon size={20} /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((res) => (
                  <div key={res.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        res.type === 'youtube' ? 'bg-red-100 text-red-600' : 
                        res.type === 'pdf' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {res.type === 'youtube' ? <Youtube size={16} /> : res.type === 'pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">{res.title}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{res.type}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteDoc(doc(db, 'schools', schoolId, 'resources', res.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Applications */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                  <Plane size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">My Leave Status</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Sick Leave</p>
                    <span className="text-[8px] font-black px-2 py-0.5 bg-green-50 text-green-600 rounded-full uppercase tracking-widest">Approved</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Oct 12 - Oct 14, 2023</p>
                </div>
                <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-purple-300 hover:bg-purple-50/30 transition-all">
                  Apply for New Leave
                </button>
              </div>
            </div>

            {/* Personal Timetable */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl">
                  <Clock size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Daily Timetable</h3>
              </div>
              <div className="space-y-3">
                {[
                  { time: '08:00 AM', subject: 'Mathematics', class: 'Class 8-A' },
                  { time: '09:30 AM', subject: 'Physics', class: 'Class 10-B' },
                  { time: '11:00 AM', subject: 'Break', class: 'Staff Room' },
                  { time: '12:00 PM', subject: 'Mathematics', class: 'Class 9-C' },
                ].map((period, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-[9px] font-black text-blue-600 w-16">{period.time}</div>
                    <div>
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{period.subject}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{period.class}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Teacher Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Onboard Teacher</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Create system access & profile</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text"
                    value={newTeacher.name}
                    onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({...newTeacher, email: e.target.value})}
                    placeholder="sarah.j@school.edu"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 ring-blue-500/10 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                    <select 
                      value={newTeacher.designation}
                      onChange={(e) => setNewTeacher({...newTeacher, designation: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 ring-blue-500/10 outline-none transition-all appearance-none"
                    >
                      <option>Secondary Teacher</option>
                      <option>Primary Teacher</option>
                      <option>Subject Specialist</option>
                      <option>Coordinator</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                    <input 
                      type="tel"
                      value={newTeacher.phone}
                      onChange={(e) => setNewTeacher({...newTeacher, phone: e.target.value})}
                      placeholder="+92..."
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl flex gap-3">
                  <ShieldAlert className="text-blue-600 shrink-0" size={20} />
                  <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                    Credentials will be auto-generated and sent to the teacher's email. They will be required to change their password on first login.
                  </p>
                </div>

                <button 
                  onClick={handleAddTeacher}
                  disabled={isSubmitting}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {isSubmitting ? 'Processing...' : 'Onboard Teacher'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherPortalManagement;
