import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ToggleLeft, 
  ToggleRight, 
  Eye, 
  Key, 
  Mail, 
  Search, 
  Bell, 
  FileText, 
  Upload, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  Users,
  Layout,
  Lock,
  Unlock,
  RefreshCw,
  MoreHorizontal,
  Clock,
  BookOpen,
  CreditCard,
  Plane,
  MessageSquare,
  Wallet,
  GraduationCap,
  Calendar
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
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface PortalSettings {
  enabled: boolean;
  modules: {
    fees: boolean;
    marks: boolean;
    attendance: boolean;
    leave: boolean;
    chat: boolean;
    timetable: boolean;
    syllabus: boolean;
  };
  noticeBoard: string;
  documents: {
    id: string;
    name: string;
    url: string;
    date: string;
  }[];
}

interface ParentUser {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  studentId?: string;
  studentName?: string;
  status: string;
}

const ParentPortalManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [parents, setParents] = useState<ParentUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'accounts' | 'content'>('settings');

  const fetchData = () => {
    if (!schoolId) {
      setError('School ID is missing. Please ensure your profile is correctly set up.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      const timeoutId = setTimeout(() => {
        if (loading) {
          setError('Data fetching timed out. Please check your connection and try again.');
          setLoading(false);
        }
      }, 10000);

      // Fetch Settings
      const settingsRef = doc(db, 'schools', schoolId, 'config', 'parent_portal');
      const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        clearTimeout(timeoutId);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as PortalSettings);
        } else {
          // Initialize default settings
          const defaultSettings: PortalSettings = {
            enabled: true,
            modules: {
              fees: true,
              marks: true,
              attendance: true,
              leave: true,
              chat: true,
              timetable: true,
              syllabus: true
            },
            noticeBoard: '',
            documents: []
          };
          setDoc(settingsRef, defaultSettings).catch(err => {
            console.error('Error initializing settings:', err);
          });
          setSettings(defaultSettings);
        }
        setLoading(false);
      }, (err) => {
        clearTimeout(timeoutId);
        if (err.message.includes('permission-denied')) {
          setError('Security Access Error: Please contact Super Admin to verify your Role.');
        } else {
          setError('Failed to fetch settings: ' + err.message);
        }
        setLoading(false);
      });

      // Fetch Parents
      const parentsQuery = query(
        collection(db, 'users'),
        where('schoolId', '==', schoolId),
        where('role', '==', 'parent')
      );

      const unsubParents = onSnapshot(parentsQuery, async (snap) => {
        const parentList = snap.docs.map(d => ({ ...d.data(), uid: d.id } as ParentUser));
        
        try {
          // Fetch student names for linking
          const studentsSnap = await getDocs(query(collection(db, 'students'), where('school_id', '==', schoolId)));
          const studentMap = new Map();
          studentsSnap.docs.forEach(d => studentMap.set(d.id, d.data().personal_info?.firstName + ' ' + d.data().personal_info?.lastName));

          const enrichedParents = parentList.map(p => ({
            ...p,
            studentName: p.studentId ? studentMap.get(p.studentId) : 'Not Linked'
          }));

          setParents(enrichedParents);
        } catch (err) {
          console.error('Error enriching parents:', err);
        }
      }, (err) => {
        console.error('Error fetching parents:', err);
      });

      return () => {
        unsubSettings();
        unsubParents();
      };
    });

    return () => unsubAuth();
  };

  useEffect(() => {
    const cleanup = fetchData();
    return () => cleanup && cleanup();
  }, [schoolId]);

  const updatePortalToggle = async (field: string, value: boolean) => {
    try {
      const settingsRef = doc(db, 'schools', schoolId, 'config', 'parent_portal');
      if (field === 'enabled') {
        await updateDoc(settingsRef, { enabled: value });
      } else {
        await updateDoc(settingsRef, { [`modules.${field}`]: value });
      }
      toast.success('Settings updated successfully');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const saveNoticeBoard = async () => {
    try {
      const settingsRef = doc(db, 'schools', schoolId, 'config', 'parent_portal');
      await updateDoc(settingsRef, { noticeBoard: settings?.noticeBoard });
      toast.success('Notice board updated');
    } catch (error) {
      toast.error('Failed to update notice board');
    }
  };

  const filteredParents = parents.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 bg-white/50 backdrop-blur-xl rounded-[2.5rem] border border-white/20 p-12">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-neon-indigo/20 border-t-neon-indigo rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="w-8 h-8 text-neon-indigo animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-black text-gray-900 uppercase tracking-tighter">Initializing Secure Access</p>
          <p className="text-sm text-gray-500 font-medium animate-pulse">Verifying credentials and loading portal data...</p>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Parent Portal Control Center</h2>
          <p className="text-sm text-slate-500 font-medium">Manage access, modules, and parent accounts for your school.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
          {[
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'accounts', label: 'Accounts', icon: Users },
            { id: 'content', label: 'Content', icon: Layout },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Global Access Card */}
            <div className={`p-8 rounded-[2.5rem] border transition-all ${
              settings?.enabled 
                ? 'bg-blue-50 border-blue-100' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${settings?.enabled ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                    {settings?.enabled ? <Unlock size={24} /> : <Lock size={24} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Global Portal Access</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      {settings?.enabled ? 'Portal is currently LIVE for all parents' : 'Portal is currently DISABLED'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => updatePortalToggle('enabled', !settings?.enabled)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                    settings?.enabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    settings?.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Module Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: 'fees', label: 'Fee Details & Payments', icon: Wallet },
                { id: 'marks', label: 'Exam Marks & Results', icon: GraduationCap },
                { id: 'attendance', label: 'Live Attendance Tracking', icon: Calendar },
                { id: 'leave', label: 'Online Leave Application', icon: Plane },
                { id: 'chat', label: 'Teacher-Parent Chat', icon: MessageSquare },
                { id: 'timetable', label: 'Class Timetable', icon: Clock },
                { id: 'syllabus', label: 'Syllabus Tracker', icon: BookOpen },
              ].map((mod) => (
                <div key={mod.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                      {/* @ts-ignore */}
                      <mod.icon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{mod.label}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visibility Control</p>
                    </div>
                  </div>
                  <button 
                    // @ts-ignore
                    onClick={() => updatePortalToggle(mod.id, !settings?.modules[mod.id])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      // @ts-ignore
                      settings?.modules[mod.id] ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      // @ts-ignore
                      settings?.modules[mod.id] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'accounts' && (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search parents by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 ring-blue-500/20 outline-none transition-all"
                />
              </div>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-200">
                Add New Parent
              </button>
            </div>

            {/* Parent List Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Name</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Student</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredParents.map((parent) => (
                      <tr key={parent.uid} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm">
                              {parent.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{parent.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{parent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">{parent.studentName}</span>
                            <ExternalLink size={12} className="text-slate-300" />
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                            parent.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {parent.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              title="View as Parent"
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              title="Reset Password"
                              className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                            >
                              <Key size={18} />
                            </button>
                            <button 
                              title="Send Welcome Email"
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Mail size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredParents.length === 0 && (
                <div className="py-20 text-center">
                  <Users className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No parents found matching your search</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'content' && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Notice Board Editor */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                  <Bell size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Parent Notice Board</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This message will appear prominently at the top of the Parent Portal dashboard. Use it for urgent school-wide updates.
              </p>
              <textarea 
                value={settings?.noticeBoard}
                onChange={(e) => setSettings(prev => prev ? { ...prev, noticeBoard: e.target.value } : null)}
                placeholder="Type your announcement here..."
                className="w-full h-48 p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm focus:ring-2 ring-orange-500/20 outline-none transition-all resize-none"
              />
              <button 
                onClick={saveNoticeBoard}
                className="w-full py-4 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg shadow-orange-200"
              >
                Publish Announcement
              </button>
            </div>

            {/* Document Uploads */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <FileText size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Portal Downloads</h3>
              </div>
              <div className="space-y-4">
                {settings?.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{doc.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{doc.date}</p>
                      </div>
                    </div>
                    <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button className="w-full py-12 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
                  <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                    <Upload size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Upload New Document</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">PDF, JPG or PNG (Max 5MB)</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParentPortalManagement;
