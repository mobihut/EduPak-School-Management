/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { initializeApp } from 'firebase/app';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { initGA, trackPageView } from './utils/analytics';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  collection,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  addDoc,
  writeBatch,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  GraduationCap, 
  UserCheck, 
  Calendar, 
  BookOpen, 
  CreditCard, 
  Bus, 
  Home, 
  IdCard, 
  Bell, 
  Info,
  LogOut, 
  Settings,
  Plus,
  Search,
  ChevronRight,
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  Users,
  ShieldCheck,
  Key,
  AlertTriangle,
  Clock,
  LayoutDashboard,
  DollarSign,
  Building2,
  Layers,
  Zap,
  Activity,
  Cpu,
  HardDrive,
  ShieldAlert,
  LifeBuoy,
  Megaphone,
  History,
  Database,
  Menu,
  X,
  TrendingUp,
  Globe,
  Server,
  Shield,
  MoreVertical,
  Filter,
  Download,
  CheckCircle2,
  Copy,
  ExternalLink,
  Wallet,
  CheckCircle,
  AlertCircle,
  FileText,
  Printer,
  Edit2,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Trash,
  Key as KeyIcon,
  Copy as CopyIcon,
  RefreshCw,
  RotateCcw,
  FileJson,
  FileSpreadsheet,
  Ban,
  FileDown,
  UserX,
  UserCheck2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Filter as FilterIcon,
  ArrowRight,
  Send,
  Paperclip,
  MessageSquare,
  Check,
  Palette,
  Save,
  Upload,
  UserPlus,
  Loader2
} from 'lucide-react';
import { auth, db, storage, secondaryAuth } from './firebase';
import StudentAdmissionWizard from './components/StudentAdmissionWizard';
import IDCardGenerator from './components/IDCardGenerator';
import FeeCollectionModule from './components/FeeCollectionModule';
import StudentAttendanceModule from './components/StudentAttendanceModule';
import TeacherHRManagement from './components/TeacherHRManagement';
import ExamsResultsManagement from './components/ExamsResultsManagement';
import TimetableBuilder from './components/TimetableBuilder';
import TeacherPortalDashboard from './components/TeacherPortalDashboard';
import AdminLeaveApprovalModule from './components/AdminLeaveApprovalModule';
import ParentPortalDashboard from './components/ParentPortalDashboard';
import LandingPage from './components/LandingPage';
import SchoolOnboardingWizard from './components/SchoolOnboardingWizard';
import StudentPortalDashboard from './components/StudentPortalDashboard';
import { QRCodeSVG } from 'qrcode.react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: string; // Supports custom roles
  schoolId?: string;
  studentId?: string; // For parents
  status: 'active' | 'inactive' | 'suspended' | 'banned';
  isForcedResetRequired: boolean;
  secret_pin?: string;
  createdAt: Timestamp;
  lastActive?: Timestamp;
}

const createAuditLog = async (action_type: AuditLog['action_type'], resource: string, details: string) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const logRef = collection(db, 'audit_logs');
    await addDoc(logRef, {
      actor_uid: user.uid,
      actor_email: user.email,
      action_type,
      resource,
      details,
      ip_address: '127.0.0.1', // Mocked for client-side demo
      timestamp: Timestamp.now()
    });
  } catch (error: any) {
    console.error("Failed to create audit log:", error);
    if (error.message?.includes('Missing or insufficient permissions')) {
      console.error("PERMISSION_ERROR_JSON:", JSON.stringify({
        error: error.message,
        operationType: 'create',
        path: 'audit_logs',
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified
        }
      }));
    }
  }
};

interface AdminRole {
  id: string;
  role_name: string;
  permissions: {
    [module: string]: ('view' | 'create' | 'edit' | 'delete')[];
  };
}

interface SupportTicket {
  id: string;
  school_id: string;
  school_name: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface GlobalAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'update' | 'warning';
  target_audience: 'all' | string; // 'all' or schoolId
  created_by: string;
  created_at: Timestamp;
  expires_at: Timestamp;
}

interface AuditLog {
  id: string;
  actor_uid: string;
  actor_email: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SYSTEM' | 'REVOKE';
  resource: string;
  details: string;
  ip_address: string;
  timestamp: Timestamp;
}

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'school_admin' | 'super_admin';
  text: string;
  attachment_url?: string;
  timestamp: Timestamp;
}

interface GlobalConfig {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  currency: 'PKR' | 'USD' | 'GBP';
  timezone: string;
  branding: {
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
  };
  apis: {
    stripePublic: string;
    stripeSecret: string;
    smtpHost: string;
    smtpKey: string;
    smsApiUrl: string;
    smsApiKey: string;
  };
  legal: {
    termsAndConditions: string;
    privacyPolicy: string;
  };
  updatedAt: Timestamp;
  updatedBy: string;
}

interface School {
  id: string;
  name: string;
  principalName?: string;
  address?: string;
  adminUid: string;
  adminEmail: string;
  contact: string;
  logoUrl?: string;
  country?: string;
  timezone?: string;
  trialStartDate: Timestamp;
  licenseExpiryDate: Timestamp;
  status: 'trial' | 'active' | 'expired' | 'suspended';
  createdAt: Timestamp;
}

interface Teacher {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  status: 'active' | 'on_leave' | 'resigned';
}

interface Payroll {
  id: string;
  teacherUid: string;
  teacherName: string;
  schoolId: string;
  month: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: 'pending' | 'paid';
  paidAt?: Timestamp;
  createdAt: Timestamp;
}

interface GlobalSettings {
  footerText: string;
  footerPhone: string;
  isMaintenanceMode: boolean;
  backupSettings?: {
    automatedBackups: boolean;
    retentionDays: number;
    storageRegion: string;
  };
}

interface BackupHistory {
  id: string;
  timestamp: string;
  size: number;
  type: 'manual' | 'automated';
  status: 'completed' | 'failed' | 'in_progress';
  fileUrl: string;
  createdBy: string;
}

// --- Neon Components ---

const NeonInput = ({ icon: Icon, ...props }: any) => (
  <div className="relative group">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-neon-blue group-focus-within:neon-text-blue transition-all" size={18} />
    <input
      {...props}
      className="w-full pl-10 pr-4 py-3 bg-cyber-gray/50 border border-neon-blue/30 rounded-xl focus:neon-border-blue outline-none transition-all text-white placeholder:text-gray-600"
    />
  </div>
);

const NeonButton = ({ children, loading, variant = 'blue', ...props }: any) => (
  <button
    {...props}
    disabled={loading}
    className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
      variant === 'blue' 
        ? 'bg-neon-blue/10 text-neon-blue neon-border-blue hover:bg-neon-blue hover:text-black' 
        : 'bg-neon-purple/10 text-neon-purple neon-border-purple hover:bg-neon-purple hover:text-black'
    }`}
  >
    {loading ? 'Processing...' : children}
  </button>
);

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-cyber-black flex flex-col items-center justify-center text-white z-50"
    >
      <motion.div
        initial={{ scale: 0.5, filter: 'blur(10px)' }}
        animate={{ scale: 1, filter: 'blur(0px)' }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="bg-cyber-gray p-8 rounded-3xl neon-border-blue mb-6"
      >
        <GraduationCap size={80} className="text-neon-blue neon-text-blue" />
      </motion.div>
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-6xl font-black tracking-tighter text-white"
      >
        Edu<span className="text-neon-blue">Pak</span>
      </motion.h1>
      <div className="mt-4 h-1 w-48 bg-cyber-gray rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="h-full w-full bg-neon-blue shadow-[0_0_10px_#00f3ff]"
        />
      </div>
    </motion.div>
  );
};

const AuthScreen = ({ onLoginSuccess, onBack, onOnboarding }: { onLoginSuccess: (user: FirebaseUser) => void, onBack: () => void, onOnboarding: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'teacher' | 'parent',
    schoolId: '',
    studentId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Log successful login
        await createAuditLog('LOGIN', 'Auth', `User logged in: ${user.email}`);

        // Auto-Initialization bypass for Super Admin
        if (user.email === 'admin@mobihut.pk') {
          const profileSnap = await getDoc(doc(db, 'users', user.uid));
          if (!profileSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: 'admin@mobihut.pk',
              role: 'super_admin',
              name: 'MoBiHuT Super Admin',
              secret_pin: '2233',
              status: 'active',
              isForcedResetRequired: false, // Immediately route to Dashboard
              createdAt: Timestamp.now()
            });
          }
        }
        onLoginSuccess(user);
      } else {
        if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match');
        
        // --- SaaS Validation Logic ---
        if (formData.role === 'student' || formData.role === 'teacher') {
          if (!formData.schoolId) throw new Error('School ID is required');
          const schoolSnap = await getDoc(doc(db, 'schools', formData.schoolId));
          if (!schoolSnap.exists()) throw new Error('INVALID SCHOOL ID. Access Denied.');
        }

        if (formData.role === 'parent') {
          if (!formData.studentId) throw new Error('Student ID is required');
          const studentSnap = await getDoc(doc(db, 'users', formData.studentId));
          if (!studentSnap.exists() || studentSnap.data()?.role !== 'student') {
            throw new Error('INVALID STUDENT ID. Parent must link to an active student.');
          }
        }

        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // 2. Create corresponding profile in Firestore
        const profileData: any = {
          uid: userCredential.user.uid,
          email: formData.email,
          name: formData.fullName,
          role: formData.role,
          status: 'active',
          isForcedResetRequired: false,
          createdAt: Timestamp.now()
        };

        if (formData.role === 'student' || formData.role === 'teacher') {
          profileData.schoolId = formData.schoolId;
        } else if (formData.role === 'parent') {
          const studentSnap = await getDoc(doc(db, 'users', formData.studentId));
          profileData.studentId = formData.studentId;
          profileData.schoolId = studentSnap.data()?.schoolId;
        }

        await setDoc(doc(db, 'users', userCredential.user.uid), profileData);
        onLoginSuccess(userCredential.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center p-4 relative">
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors"
      >
        <ChevronLeft size={16} />
        Back to Home
      </button>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-cyber-gray p-8 rounded-2xl neon-border-blue w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-blue to-transparent opacity-50" />
        
        <div className="flex justify-center mb-8">
          <div className="bg-neon-blue/10 p-4 rounded-2xl neon-border-blue">
            <GraduationCap size={40} className="text-neon-blue neon-text-blue" />
          </div>
        </div>

        <h2 className="text-3xl font-black text-center text-white mb-2 tracking-tight">
          {isLogin ? 'SYSTEM ACCESS' : 'NEW ONBOARDING'}
        </h2>
        <p className="text-gray-500 text-center mb-8 text-sm uppercase tracking-widest">
          {isLogin ? 'Enter credentials to proceed' : 'Join your educational community'}
        </p>

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && (
            <>
              <div className="flex bg-cyber-black/50 p-1 rounded-xl neon-border-blue/20 mb-4">
                {(['student', 'teacher', 'parent'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormData({...formData, role: r})}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      formData.role === r ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <NeonInput
                icon={UserIcon}
                type="text"
                required
                placeholder="Full Name"
                value={formData.fullName}
                onChange={(e: any) => setFormData({...formData, fullName: e.target.value})}
              />
            </>
          )}
          <NeonInput
            icon={Mail}
            type="email"
            required
            placeholder="Email Address"
            value={formData.email}
            onChange={(e: any) => setFormData({...formData, email: e.target.value})}
          />
          <NeonInput
            icon={Lock}
            type="password"
            required
            placeholder="Password"
            value={formData.password}
            onChange={(e: any) => setFormData({...formData, password: e.target.value})}
          />
          {!isLogin && (
            <>
              <NeonInput
                icon={Lock}
                type="password"
                required
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e: any) => setFormData({...formData, confirmPassword: e.target.value})}
              />
              {(formData.role === 'student' || formData.role === 'teacher') && (
                <NeonInput
                  icon={ShieldCheck}
                  type="text"
                  required
                  placeholder="School ID"
                  value={formData.schoolId}
                  onChange={(e: any) => setFormData({...formData, schoolId: e.target.value})}
                />
              )}
              {formData.role === 'parent' && (
                <NeonInput
                  icon={Users}
                  type="text"
                  required
                  placeholder="Student ID"
                  value={formData.studentId}
                  onChange={(e: any) => setFormData({...formData, studentId: e.target.value})}
                />
              )}
            </>
          )}

          {error && <p className="text-red-500 text-xs text-center font-bold uppercase tracking-tighter">{error}</p>}

          <NeonButton type="submit" loading={loading}>
            {isLogin ? 'Initialize Session' : 'Create Account'}
          </NeonButton>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-4">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-neon-purple text-sm font-bold uppercase tracking-widest hover:neon-text-purple transition-all"
          >
            {isLogin ? 'Create New Account' : 'Back to Login'}
          </button>
          
          {isLogin && (
            <div className="pt-4 border-t border-white/5">
              <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-4">
                Are you a School Owner?
              </p>
              <button 
                onClick={onOnboarding}
                className="w-full bg-white/5 text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-white/10 transition-all border border-white/10 flex items-center justify-center gap-2 text-[11px]"
              >
                <Building2 size={16} className="text-neon-blue" />
                Register Your Institution
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ForcedResetScreen = ({ userProfile, onComplete }: { userProfile: UserProfile, onComplete: () => void }) => {
  const [formData, setFormData] = useState({
    email: userProfile.email,
    name: '',
    password: '',
    confirmPassword: '',
    secretPin: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    
    // Strict PIN Protection for Super Admin
    if (userProfile.role === 'super_admin' && formData.secretPin !== '2233') {
      setError('INVALID SECRET PIN. ACCESS DENIED.');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user authenticated');
      if (formData.email !== currentUser.email) await updateEmail(currentUser, formData.email);
      await updatePassword(currentUser, formData.password);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        email: formData.email,
        name: formData.name,
        isForcedResetRequired: false
      });
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-cyber-gray p-8 rounded-2xl neon-border-purple w-full max-w-md">
        <h2 className="text-2xl font-black text-center text-white mb-2 neon-text-purple uppercase tracking-tighter">Security Override</h2>
        <p className="text-gray-500 text-center mb-8 text-xs uppercase tracking-widest">Update system credentials</p>
        <form onSubmit={handleReset} className="space-y-4">
          <NeonInput icon={Mail} type="email" required value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
          <NeonInput icon={UserIcon} type="text" required placeholder="New Name" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} />
          <NeonInput icon={Lock} type="password" required placeholder="New Password" value={formData.password} onChange={(e: any) => setFormData({...formData, password: e.target.value})} />
          <NeonInput icon={Lock} type="password" required placeholder="Confirm Password" value={formData.confirmPassword} onChange={(e: any) => setFormData({...formData, confirmPassword: e.target.value})} />
          
          {userProfile.role === 'super_admin' && (
            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] text-neon-purple font-black uppercase tracking-widest mb-2">Master Authorization PIN</p>
              <NeonInput icon={Key} type="password" required placeholder="SECRET PIN" value={formData.secretPin} onChange={(e: any) => setFormData({...formData, secretPin: e.target.value})} />
            </div>
          )}

          {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
          <NeonButton type="submit" loading={loading} variant="purple">Authorize Update</NeonButton>
        </form>
      </motion.div>
    </div>
  );
};

const useActiveAnnouncements = (schoolId: string | undefined) => {
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const now = Timestamp.now();
    const q = query(
      collection(db, 'global_announcements'),
      where('expires_at', '>', now),
      orderBy('expires_at', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as GlobalAnnouncement))
        .filter(ann => ann.target_audience === 'all' || ann.target_audience === schoolId);
      
      setAnnouncements(list);
      setLoading(false);
    }, (error) => {
      console.error("Announcements error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  return { announcements, loading };
};

const Dashboard = ({ userProfile, settings, school }: { userProfile: UserProfile, settings: GlobalSettings, school: School | null }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
  const [selectedTeacherForIdCard, setSelectedTeacherForIdCard] = useState<Teacher | null>(null);
  const [userRolePermissions, setUserRolePermissions] = useState<AdminRole | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);

  // If student, show the gamified portal directly
  if (userProfile.role === 'student') {
    return <StudentPortalDashboard userProfile={userProfile} />;
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global_config'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as GlobalConfig);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userProfile.role !== 'super_admin' && !['school_admin', 'teacher', 'student', 'parent'].includes(userProfile.role)) {
      // Fetch custom role permissions
      const fetchRole = async () => {
        const roleDoc = await getDoc(doc(db, 'admin_roles', userProfile.role));
        if (roleDoc.exists()) {
          setUserRolePermissions(roleDoc.data() as AdminRole);
        }
      };
      fetchRole();
    }
  }, [userProfile.role]);

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete') => {
    if (userProfile.role === 'super_admin') return true;
    if (!userRolePermissions) return false;
    return userRolePermissions.permissions[module]?.includes(action) || false;
  };

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<GlobalAnnouncement | null>(null);

  const NotificationBell = () => {
    const { announcements: activeAnnouncements, loading } = useActiveAnnouncements(userProfile.schoolId || undefined);
    const [isOpen, setIsOpen] = useState(false);

    if (loading || activeAnnouncements.length === 0) return null;

    return (
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-neon-blue transition-all hover:bg-neon-blue/10 rounded-xl relative"
        >
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_#ef4444]" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-cyber-gray border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-4 border-b border-white/5 bg-cyber-black/50">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active Announcements</h4>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {activeAnnouncements.map((ann: GlobalAnnouncement) => (
                    <button 
                      key={ann.id}
                      onClick={() => {
                        setSelectedAnnouncement(ann);
                        setIsOpen(false);
                      }}
                      className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 p-1.5 rounded-lg border ${
                          ann.type === 'warning' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                          ann.type === 'update' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                          'bg-blue-500/10 border-blue-500/20 text-blue-500'
                        }`}>
                          <Info size={12} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-neon-blue transition-colors">{ann.title}</p>
                          <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{ann.message}</p>
                          <p className="text-[8px] text-gray-600 mt-2 uppercase font-black tracking-widest">
                            {ann.created_at.toDate().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const AnnouncementDetailModal = ({ announcement, onClose }: { announcement: GlobalAnnouncement, onClose: () => void }) => {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-cyber-gray w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
        >
          <div className={`h-2 ${
            announcement.type === 'warning' ? 'bg-red-500' :
            announcement.type === 'update' ? 'bg-green-500' :
            'bg-neon-blue'
          }`} />
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border ${
                  announcement.type === 'warning' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  announcement.type === 'update' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    announcement.type === 'warning' ? 'bg-red-500' :
                    announcement.type === 'update' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`} />
                  {announcement.type}
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{announcement.title}</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="bg-cyber-black/50 p-6 rounded-2xl border border-white/5 mb-8">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {announcement.message}
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
              <span>Sent: {announcement.created_at.toDate().toLocaleString()}</span>
              <span>ID: {announcement.id.slice(0, 8)}</span>
            </div>

            <div className="mt-10">
              <NeonButton onClick={onClose} className="w-full">Dismiss</NeonButton>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const getMenuItems = () => {
    if (userProfile.role === 'super_admin' || (userRolePermissions)) {
      const allItems = [
        { category: 'MAIN DASHBOARD', items: [
          { id: 'profile', label: 'My Profile', icon: UserIcon, module: 'profile' },
          { id: 'overview', label: 'Overview', icon: LayoutDashboard, module: 'overview' },
          { id: 'billing', label: 'Revenue & Billing', icon: DollarSign, module: 'billing' },
        ]},
        { category: 'TENANT MANAGEMENT', items: [
          { id: 'schools', label: 'Schools Directory', icon: Building2, module: 'schools' },
          { id: 'licenses', label: 'License Keys', icon: Key, module: 'licenses' },
          { id: 'plans', label: 'Subscription Plans', icon: Layers, module: 'plans' },
        ]},
        { category: 'USER ADMINISTRATION', items: [
          { id: 'global_users', label: 'Global Users', icon: Users, module: 'users' },
          { id: 'admin_roles', label: 'Super Admin Roles', icon: ShieldCheck, module: 'admin_roles' },
        ]},
        { category: 'SYSTEM & INFRASTRUCTURE', items: [
          { id: 'global_settings', label: 'Global Settings', icon: Settings, module: 'settings' },
          { id: 'integrations', label: 'Integration & APIs', icon: Zap, module: 'integrations' },
          { id: 'health', label: 'Server Health', icon: Activity, module: 'health' },
          { id: 'backup', label: 'Backup & Restore', icon: Database, module: 'backup' },
        ]},
        { category: 'SUPPORT & LOGS', items: [
          { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy, module: 'tickets' },
          { id: 'announcements', label: 'Global Announcements', icon: Megaphone, module: 'announcements' },
          { id: 'audit_logs', label: 'Audit Logs', icon: History, module: 'audit_logs' },
        ] }
      ];

      if (userProfile.role === 'super_admin') return allItems;

      // Filter based on permissions
      return allItems.map(cat => ({
        ...cat,
        items: cat.items.filter(item => hasPermission(item.module || '', 'view'))
      })).filter(cat => cat.items.length > 0);
    }

    const common = [
      { id: 'overview', label: 'Overview', icon: Home },
    ];

    const schoolStaff = [
      ...common,
      { id: 'students', label: 'Students', icon: GraduationCap },
      { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
      { id: 'teachers', label: 'Teachers', icon: UserCheck },
      { id: 'hr_payroll', label: 'HR & Payroll', icon: Wallet },
      { id: 'academics', label: 'Academics', icon: BookOpen },
      { id: 'exams', label: 'Exams', icon: Calendar },
      { id: 'fees', label: 'Fees', icon: CreditCard },
      { id: 'transport', label: 'Transport', icon: Bus },
      { id: 'hostel', label: 'Hostel', icon: Home },
      { id: 'id_cards', label: 'ID Cards', icon: IdCard },
      { id: 'notices', label: 'Notices', icon: Bell },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];

    if (userProfile.role === 'school_admin') {
      return [
        { category: 'SCHOOL MANAGEMENT', items: [
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
          { id: 'students', label: 'Student Management', icon: GraduationCap },
          { id: 'attendance', label: 'Student Attendance', icon: CheckCircle2 },
          { id: 'teachers', label: 'HR & Teachers', icon: Users },
          { id: 'leave_approval', label: 'Leave Approval', icon: Clock },
          { id: 'academics', label: 'Academic & Classes', icon: BookOpen },
          { id: 'fees', label: 'Fee Collection', icon: DollarSign },
          { id: 'exams', label: 'Examinations & Results', icon: FileText },
          { id: 'timetable', label: 'Timetable Builder', icon: Calendar },
          { id: 'communication', label: 'Communication', icon: Megaphone },
          { id: 'school_settings', label: 'School Settings', icon: Settings },
        ]}
      ];
    }
    
    if (userProfile.role === 'teacher') return [{ category: 'TEACHER PANEL', items: schoolStaff.filter(i => !['fees', 'settings'].includes(i.id)) }];
    
    if (userProfile.role === 'parent') return [{ category: 'PARENT PORTAL', items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'academics', label: 'Academics', icon: BookOpen },
      { id: 'exams', label: 'Exams', icon: Calendar },
      { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
      { id: 'notices', label: 'Notices', icon: Bell },
    ]}];

    return [{ category: 'STUDENT PORTAL', items: [
      ...common,
      { id: 'academics', label: 'My Academics', icon: BookOpen },
      { id: 'exams', label: 'My Exams', icon: Calendar },
      { id: 'fees', label: 'Fee Status', icon: CreditCard },
      { id: 'notices', label: 'Notices', icon: Bell },
    ]}];
  };

  const menuCategories = getMenuItems();

  const PermissionDenied = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 neon-border-red">
        <ShieldAlert className="text-red-500" size={40} />
      </div>
      <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Access Restricted</h3>
      <p className="text-gray-500 text-sm max-w-md">
        Your current role does not have the required permissions to access this module. 
        Please contact the Master Admin if you believe this is an error.
      </p>
    </div>
  );

  const SchoolsDirectory = () => {
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [newSchoolData, setNewSchoolData] = useState({
      schoolName: '',
      schoolAddress: '',
      adminName: '',
      adminEmail: '',
      adminPhone: ''
    });
    const [registrationResult, setRegistrationResult] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
      const q = onSnapshot(collection(db, 'schools'), (snapshot) => {
        const schoolList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as School));
        setSchools(schoolList);
        setLoading(false);
      });
      return () => q();
    }, []);

    const handleRegisterSchool = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError('');
      
      // DEBUG LOGS
      console.log("--- Add School Debug (Frontend) ---");
      console.log("Data to send:", newSchoolData);
      console.log("Current User UID:", auth.currentUser?.uid);
      console.log("User Profile Role:", userProfile.role);
      console.log("Is Super Admin:", userProfile.role === 'super_admin');
      console.log("------------------------------------");

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("You must be logged in to perform this action.");
        }

        // 1. Generate random 8-character password
        const password = Math.random().toString(36).slice(-8);

        // Step A: createUserWithEmailAndPassword MUST resolve completely first.
        console.log("1. Attempting to create user with email:", newSchoolData.adminEmail);
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          newSchoolData.adminEmail, 
          password
        );
        
        // Step B: Wait for the new user's uid.
        const newUid = userCredential.user.uid;
        console.log("2. Auth successful, new UID:", newUid);

        // Sign out the secondary app so it doesn't persist
        await secondaryAuth.signOut();
        
        // Step C: Only AFTER Step B is successful, write to the schools collection.
        console.log("3. Writing to schools collection...");
        const schoolId = `EP-SCH-${Math.floor(1000 + Math.random() * 9000)}`;
        const now = new Date();
        const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await setDoc(doc(db, 'schools', schoolId), {
          id: schoolId,
          name: newSchoolData.schoolName,
          address: newSchoolData.schoolAddress || "",
          adminUid: newUid,
          adminEmail: newSchoolData.adminEmail,
          contact: newSchoolData.adminPhone || "",
          status: "active",
          createdAt: serverTimestamp(),
          trialExpiresAt: Timestamp.fromDate(trialExpiresAt),
          licenseExpiryDate: Timestamp.fromDate(trialExpiresAt),
        });
        console.log("4. School document created successfully.");

        // Step D: Write to the users collection to set the role: 'school_admin'.
        console.log("5. Writing to users collection...");
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          email: newSchoolData.adminEmail,
          name: newSchoolData.adminName,
          role: "school_admin",
          schoolId: schoolId,
          status: "active",
          isForcedResetRequired: true,
          createdAt: serverTimestamp(),
        });
        console.log("6. User document created successfully.");

        // Log the action
        await createAuditLog('CREATE', 'Schools', `Registered new school: ${newSchoolData.schoolName} (${schoolId})`);
        console.log("7. Audit log created.");

        setRegistrationResult({ 
          success: true, 
          uid: newUid, 
          adminEmail: newSchoolData.adminEmail, 
          password, 
          schoolId 
        });
        setIsAddModalOpen(false);
        setIsSuccessModalOpen(true);
        setNewSchoolData({ schoolName: '', schoolAddress: '', adminName: '', adminEmail: '', adminPhone: '' });
      } catch (err: any) {
        console.error("Registration Error Details:", {
          code: err.code,
          message: err.message,
          fullError: err
        });
        setError(err.message || "An error occurred during registration.");
      } finally {
        setSubmitting(false);
      }
    };

    const handleEditSchool = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSchool) return;
      setSubmitting(true);
      setError('');

      try {
        await updateDoc(doc(db, 'schools', editingSchool.id), {
          name: editingSchool.name,
          address: editingSchool.address,
          contact: editingSchool.contact,
          status: editingSchool.status,
          updatedAt: serverTimestamp()
        });

        await createAuditLog('UPDATE', 'Schools', `Updated school: ${editingSchool.name} (${editingSchool.id})`);
        setIsEditModalOpen(false);
        setEditingSchool(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [schoolToDelete, setSchoolToDelete] = useState<{ id: string, name: string, adminUid?: string } | null>(null);

    const handleDeleteSchool = async () => {
      if (!schoolToDelete) return;
      const { id: schoolId, name: schoolName, adminUid: schoolAdminUid } = schoolToDelete;
      
      setLoading(true);
      try {
        // 1. Delete Auth User via backend
        if (schoolAdminUid) {
          const response = await fetch('/api/admin/delete-school', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId,
              adminUid: auth.currentUser?.uid,
              schoolAdminUid
            })
          });
          if (!response.ok) {
            const data = await response.json();
            console.error("Failed to delete auth user:", data.error);
          }
        }

        // 2. Delete School Document
        await deleteDoc(doc(db, 'schools', schoolId));

        // 3. Delete School Admin User Document
        if (schoolAdminUid) {
          await deleteDoc(doc(db, 'users', schoolAdminUid));
        }

        await createAuditLog('DELETE', 'Schools', `Deleted school: ${schoolName} (${schoolId})`);
        toast.success(`School ${schoolName} deleted successfully`);
        setIsDeleteModalOpen(false);
        setSchoolToDelete(null);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    const filteredSchools = schools.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.adminEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search schools, IDs, or emails..." 
              className="w-full pl-10 pr-4 py-2 bg-cyber-gray/50 border border-white/5 rounded-xl focus:neon-border-blue outline-none transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex bg-cyber-gray/50 p-1 rounded-xl border border-white/5">
              {['all', 'active', 'suspended'].map(status => (
                <button 
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    statusFilter === status ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 md:flex-none bg-white text-black px-6 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-neon-blue transition-all font-black uppercase tracking-widest text-[10px]"
            >
              <Plus size={16} />
              Add School
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyber-black/50 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">School ID</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">School Name</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Admin Email</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Contact</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Expiry Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Retrieving Tenant Data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSchools.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Search className="text-gray-700" size={40} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">No schools found matching your criteria</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-neon-blue">{school.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-white">{school.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{school.address || 'No Address'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Mail size={12} className="text-gray-500" />
                        {school.adminEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Phone size={12} className="text-gray-500" />
                        {school.contact || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        school.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        school.status === 'suspended' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {school.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Calendar size={12} className="text-gray-500" />
                        {school.licenseExpiryDate?.toDate().toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingSchool(school);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-gray-500 hover:text-neon-blue hover:bg-white/5 rounded-lg transition-all"
                          title="Edit School"
                        >
                          <Edit2 size={16} />
                         </button>
                         <button 
                           onClick={() => {
                             setSchoolToDelete({ id: school.id, name: school.name, adminUid: school.adminUid });
                             setIsDeleteModalOpen(true);
                           }}
                           className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                           title="Delete School"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-cyber-black/30 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Showing {filteredSchools.length} of {schools.length} Schools</span>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-cyber-gray border border-white/5 rounded-lg text-gray-500 disabled:opacity-50" disabled>Previous</button>
              <button className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-cyber-gray border border-white/5 rounded-lg text-gray-500 disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {isDeleteModalOpen && schoolToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute inset-0 bg-cyber-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-cyber-gray border border-white/10 rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <Trash2 className="text-red-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Confirm Deletion</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">This action is irreversible</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                  Are you sure you want to delete <span className="text-white font-bold">{schoolToDelete.name}</span>? 
                  This will also permanently delete the school's admin user account and all associated data.
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteSchool}
                    disabled={loading}
                    className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Delete School'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add School Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsAddModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Register New Tenant</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Onboard a new school to the EduPak ecosystem</p>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-gray-500 hover:text-white"><X size={24} /></button>
                </div>

                <form onSubmit={handleRegisterSchool} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-blue uppercase tracking-[0.2em] border-b border-neon-blue/20 pb-2">School Information</h4>
                      <NeonInput icon={Building2} placeholder="School Name" required value={newSchoolData.schoolName} onChange={(e: any) => setNewSchoolData({...newSchoolData, schoolName: e.target.value})} />
                      <NeonInput icon={Home} placeholder="School Address" value={newSchoolData.schoolAddress} onChange={(e: any) => setNewSchoolData({...newSchoolData, schoolAddress: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-[0.2em] border-b border-neon-purple/20 pb-2">Admin Credentials</h4>
                      <NeonInput icon={UserIcon} placeholder="Admin Full Name" required value={newSchoolData.adminName} onChange={(e: any) => setNewSchoolData({...newSchoolData, adminName: e.target.value})} />
                      <NeonInput icon={Mail} type="email" placeholder="Admin Email" required value={newSchoolData.adminEmail} onChange={(e: any) => setNewSchoolData({...newSchoolData, adminEmail: e.target.value})} />
                      <NeonInput icon={Phone} placeholder="Admin Phone Number" value={newSchoolData.adminPhone} onChange={(e: any) => setNewSchoolData({...newSchoolData, adminPhone: e.target.value})} />
                    </div>
                  </div>

                  {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase text-center">{error}</div>}

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-all">Cancel</button>
                    <NeonButton type="submit" loading={submitting}>Register School</NeonButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit School Modal */}
        <AnimatePresence>
          {isEditModalOpen && editingSchool && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsEditModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Edit School</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Update school details and status</p>
                  </div>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-gray-500 hover:text-white"><X size={24} /></button>
                </div>

                <form onSubmit={handleEditSchool} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-blue uppercase tracking-[0.2em] border-b border-neon-blue/20 pb-2">School Information</h4>
                      <NeonInput icon={Building2} placeholder="School Name" required value={editingSchool.name} onChange={(e: any) => setEditingSchool({...editingSchool, name: e.target.value})} />
                      <NeonInput icon={Home} placeholder="School Address" value={editingSchool.address || ''} onChange={(e: any) => setEditingSchool({...editingSchool, address: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-[0.2em] border-b border-neon-purple/20 pb-2">Status & Contact</h4>
                      <NeonInput icon={Phone} placeholder="Contact Number" value={editingSchool.contact || ''} onChange={(e: any) => setEditingSchool({...editingSchool, contact: e.target.value})} />
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">School Status</label>
                        <select 
                          value={editingSchool.status}
                          onChange={(e) => setEditingSchool({...editingSchool, status: e.target.value as any})}
                          className="w-full bg-cyber-black border border-white/5 rounded-xl px-4 py-3 text-white focus:neon-border-blue outline-none transition-all text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="trial">Trial</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase text-center">{error}</div>}

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-all">Cancel</button>
                    <NeonButton type="submit" loading={submitting}>Save Changes</NeonButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Success Modal */}
        <AnimatePresence>
          {isSuccessModalOpen && registrationResult && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-cyber-gray p-10 rounded-3xl neon-border-blue w-full max-w-md text-center"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                  <CheckCircle2 className="text-green-400" size={40} />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Registration Successful</h3>
                <p className="text-gray-500 text-sm mb-8 uppercase tracking-widest">Share these credentials with the School Admin</p>
                
                <div className="space-y-4 mb-10">
                  <div className="bg-cyber-black p-4 rounded-2xl border border-white/5 text-left">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">School ID</p>
                    <p className="text-neon-blue font-mono font-bold text-lg">{registrationResult.schoolId}</p>
                  </div>
                  <div className="bg-cyber-black p-4 rounded-2xl border border-white/5 text-left">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Admin Email</p>
                    <p className="text-white font-bold">{registrationResult.adminEmail}</p>
                  </div>
                  <div className="bg-cyber-black p-4 rounded-2xl border border-white/5 text-left relative group">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Temporary Password</p>
                    <p className="text-neon-purple font-mono font-bold text-lg">{registrationResult.password}</p>
                    <button 
                      onClick={() => navigator.clipboard.writeText(registrationResult.password)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-neon-purple transition-all"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <NeonButton onClick={() => setIsSuccessModalOpen(false)}>Done</NeonButton>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const TeacherHRManagement = () => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [payroll, setPayroll] = useState<Payroll[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'staff' | 'payroll'>('staff');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [generating, setGenerating] = useState(false);
    const [processingPayout, setProcessingPayout] = useState(false);
    const [selectedPayrollForPayout, setSelectedPayrollForPayout] = useState<Payroll | null>(null);
    const [selectedTeacherForSalaryEdit, setSelectedTeacherForSalaryEdit] = useState<Teacher | null>(null);
    const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<Teacher | null>(null);
    const [selectedPayrollForPayslip, setSelectedPayrollForPayslip] = useState<Payroll | null>(null);
    const [editingSalary, setEditingSalary] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const schoolId = userProfile.schoolId || '';

    useEffect(() => {
      if (!schoolId) return;

      const teachersUnsub = onSnapshot(collection(db, 'schools', schoolId, 'teachers'), (snap) => {
        setTeachers(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Teacher)));
      });

      const payrollUnsub = onSnapshot(collection(db, 'schools', schoolId, 'payroll'), (snap) => {
        setPayroll(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payroll)));
        setLoading(false);
      });

      return () => {
        teachersUnsub();
        payrollUnsub();
      };
    }, [schoolId]);

    const handleGeneratePayroll = async () => {
      setGenerating(true);
      setMessage(null);
      try {
        const response = await fetch('/api/payroll/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId,
            month: selectedMonth,
            adminUid: userProfile.uid
          })
        });
        const data = await response.json();
        if (data.success) {
          setMessage({ type: 'success', text: data.message });
        } else {
          setMessage({ type: 'error', text: data.error });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setGenerating(false);
      }
    };

    const handleMarkAsPaid = async (payrollId: string) => {
      setProcessingPayout(true);
      setMessage(null);
      try {
        const response = await fetch('/api/payroll/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId,
            payrollId,
            adminUid: userProfile.uid
          })
        });
        const data = await response.json();
        if (data.success) {
          setMessage({ type: 'success', text: `Payout successful! Transaction ID: ${data.transactionId}` });
          setSelectedPayrollForPayout(null);
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setProcessingPayout(false);
      }
    };

    const PayoutConfirmationModal = () => {
      if (!selectedPayrollForPayout) return null;
      const p = selectedPayrollForPayout;

      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-cyber-gray p-8 rounded-[40px] neon-border-blue max-w-md w-full relative overflow-hidden"
          >
            <button 
              onClick={() => setSelectedPayrollForPayout(null)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-neon-blue/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-neon-blue/20">
                <DollarSign className="text-neon-blue" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Confirm Payout</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Salary Disbursement Authorization</p>
            </div>

            <div className="bg-cyber-black p-6 rounded-2xl border border-white/5 space-y-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Teacher</span>
                <span className="text-sm font-black text-white uppercase tracking-tighter">{p.teacherName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Period</span>
                <span className="text-xs font-bold text-gray-400 uppercase">{p.month}</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Net Amount</span>
                <span className="text-xl font-black text-neon-blue">Rs. {p.netSalary.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedPayrollForPayout(null)}
                className="flex-1 py-4 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-2xl hover:text-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleMarkAsPaid(p.id)}
                disabled={processingPayout}
                className="flex-1 py-4 bg-neon-blue text-black font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_20px_#00f3ff] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingPayout ? <Clock className="animate-spin" size={18} /> : <Zap size={18} />}
                Initiate
              </button>
            </div>
            
            <p className="text-[8px] text-gray-600 text-center mt-6 uppercase font-bold tracking-widest">
              Funds will be transferred via MockGateway_v1
            </p>
          </motion.div>
        </div>
      );
    };

    const filteredPayroll = payroll.filter(p => p.month === selectedMonth);

    const stats = {
      totalNet: filteredPayroll.reduce((sum, p) => sum + p.netSalary, 0),
      totalPaid: filteredPayroll.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.netSalary, 0),
      totalPending: filteredPayroll.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.netSalary, 0),
      count: filteredPayroll.length,
      paidCount: filteredPayroll.filter(p => p.status === 'paid').length,
      pendingCount: filteredPayroll.filter(p => p.status === 'pending').length,
    };

    const handleBulkPayout = async () => {
      const pending = filteredPayroll.filter(p => p.status === 'pending');
      if (pending.length === 0) return;
      
      if (!confirm(`Are you sure you want to initiate bulk payout for ${pending.length} teachers? Total: Rs. ${stats.totalPending.toLocaleString()}`)) return;

      setProcessingPayout(true);
      setMessage(null);
      let successCount = 0;
      let failCount = 0;

      for (const p of pending) {
        try {
          const response = await fetch('/api/payroll/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId,
              payrollId: p.id,
              adminUid: userProfile.uid
            })
          });
          const data = await response.json();
          if (data.success) successCount++;
          else failCount++;
        } catch (err) {
          failCount++;
        }
      }

      setMessage({ 
        type: failCount === 0 ? 'success' : 'error', 
        text: `Bulk payout complete. Success: ${successCount}, Failed: ${failCount}` 
      });
      setProcessingPayout(false);
    };

    const handleUpdateSalary = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeacherForSalaryEdit) return;
      setEditingSalary(true);
      setMessage(null);
      try {
        const response = await fetch('/api/admin/update-teacher-salary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId,
            teacherUid: selectedTeacherForSalaryEdit.uid,
            baseSalary: selectedTeacherForSalaryEdit.baseSalary,
            allowances: selectedTeacherForSalaryEdit.allowances,
            deductions: selectedTeacherForSalaryEdit.deductions,
            adminUid: userProfile.uid
          })
        });
        const data = await response.json();
        if (data.success) {
          setMessage({ type: 'success', text: 'Salary structure updated successfully' });
          setSelectedTeacherForSalaryEdit(null);
        } else {
          setMessage({ type: 'error', text: data.error });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setEditingSalary(false);
      }
    };

    const EditSalaryModal = () => {
      if (!selectedTeacherForSalaryEdit) return null;
      const t = selectedTeacherForSalaryEdit;

      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-cyber-gray p-8 rounded-[40px] neon-border-purple max-w-md w-full relative overflow-hidden"
          >
            <button 
              onClick={() => setSelectedTeacherForSalaryEdit(null)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-neon-purple/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-neon-purple/20">
                <DollarSign className="text-neon-purple" size={32} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Edit Salary</h2>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">{t.name}</p>
            </div>

            <form onSubmit={handleUpdateSalary} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Base Salary (Rs.)</label>
                <NeonInput icon={DollarSign} type="number" required value={t.baseSalary} onChange={(e: any) => setSelectedTeacherForSalaryEdit({...t, baseSalary: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Allowances (Rs.)</label>
                <NeonInput icon={Plus} type="number" value={t.allowances} onChange={(e: any) => setSelectedTeacherForSalaryEdit({...t, allowances: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Deductions (Rs.)</label>
                <NeonInput icon={X} type="number" value={t.deductions} onChange={(e: any) => setSelectedTeacherForSalaryEdit({...t, deductions: Number(e.target.value)})} />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setSelectedTeacherForSalaryEdit(null)}
                  className="flex-1 py-4 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-2xl hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editingSalary}
                  className="flex-1 py-4 bg-neon-purple text-white font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_20px_rgba(191,0,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editingSalary ? <Clock className="animate-spin" size={18} /> : <Zap size={18} />}
                  Update
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      );
    };

    const PayrollHistoryModal = () => {
      if (!selectedTeacherForHistory) return null;
      const t = selectedTeacherForHistory;
      const history = payroll.filter(p => p.teacherUid === t.uid).sort((a, b) => b.month.localeCompare(a.month));

      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-cyber-gray p-8 rounded-[40px] neon-border-blue max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[80vh]"
          >
            <button 
              onClick={() => setSelectedTeacherForHistory(null)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Payroll History</h2>
              <p className="text-neon-blue text-[10px] font-black uppercase tracking-widest mt-1">{t.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {history.map(p => (
                <div key={p.id} className="bg-cyber-black p-6 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-neon-blue/30 transition-all">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Period</p>
                    <p className="text-lg font-black text-white uppercase tracking-tighter">{p.month}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Net Salary</p>
                    <p className="text-lg font-black text-neon-blue tracking-tighter">Rs. {p.netSalary.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Status</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                        {p.status}
                      </span>
                    </div>
                    <button 
                      onClick={() => setSelectedPayrollForPayslip(p)}
                      className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                    >
                      <FileText size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="py-12 text-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
                  No payroll history found for this teacher
                </div>
              )}
            </div>
          </motion.div>
        </div>
      );
    };

    const PayslipModal = () => {
      if (!selectedPayrollForPayslip) return null;
      const p = selectedPayrollForPayslip;

      return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-12 rounded-none max-w-2xl w-full relative text-black font-serif shadow-2xl"
            id="printable-payslip"
          >
            <button 
              onClick={() => setSelectedPayrollForPayslip(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors print:hidden"
            >
              <X size={24} />
            </button>

            <div className="text-center border-b-2 border-black pb-8 mb-8">
              <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">{school?.name || 'School Name'}</h1>
              <p className="text-sm text-gray-600 italic">{school?.address || 'School Address'}</p>
              <div className="mt-6 inline-block border border-black px-6 py-2 font-bold uppercase tracking-[0.3em]">
                Salary Payslip
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Employee Name</span>
                  <span className="text-xs font-bold">{p.teacherName}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Employee ID</span>
                  <span className="text-xs font-mono">{p.teacherUid.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Designation</span>
                  <span className="text-xs font-bold">Teacher</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Month/Year</span>
                  <span className="text-xs font-bold">{p.month}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Payment Status</span>
                  <span className="text-xs font-bold uppercase">{p.status}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500">Disbursement Date</span>
                  <span className="text-xs font-bold">{p.paidAt ? p.paidAt.toDate().toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-2 mb-4">Earnings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs">Basic Salary</span>
                    <span className="text-xs font-bold">Rs. {p.baseSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs">Allowances</span>
                    <span className="text-xs font-bold">Rs. {p.allowances.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                    <span className="text-xs uppercase">Gross Earnings</span>
                    <span className="text-xs">Rs. {(p.baseSalary + p.allowances).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase border-b-2 border-black pb-2 mb-4">Deductions</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs">Professional Tax / Other</span>
                    <span className="text-xs font-bold">Rs. {p.deductions.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                    <span className="text-xs uppercase">Total Deductions</span>
                    <span className="text-xs">Rs. {p.deductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 p-6 flex justify-between items-center mb-12">
              <span className="text-sm font-bold uppercase tracking-widest">Net Salary Payable</span>
              <span className="text-2xl font-bold">Rs. {p.netSalary.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12">
              <div className="text-center">
                <div className="border-b border-black mb-2"></div>
                <p className="text-[10px] uppercase font-bold">Employee Signature</p>
              </div>
              <div className="text-center">
                <div className="border-b border-black mb-2"></div>
                <p className="text-[10px] uppercase font-bold">Authorized Signatory</p>
              </div>
            </div>

            <div className="mt-12 flex justify-center print:hidden">
              <button 
                onClick={() => window.print()}
                className="bg-black text-white px-8 py-3 rounded-none font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-gray-800 transition-all"
              >
                <Printer size={16} />
                Print Payslip
              </button>
            </div>
          </motion.div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex bg-cyber-gray/50 p-1 rounded-2xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveSubTab('staff')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'staff' ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'}`}
          >
            Staff Directory
          </button>
          <button 
            onClick={() => setActiveSubTab('payroll')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'payroll' ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'}`}
          >
            Payroll Management
          </button>
        </div>

        {activeSubTab === 'staff' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map(teacher => (
              <motion.div 
                key={teacher.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-cyber-gray p-6 rounded-2xl border border-white/5 hover:neon-border-blue transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 blur-3xl -mr-16 -mt-16 group-hover:bg-neon-blue/10 transition-all"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="w-12 h-12 bg-neon-blue/10 rounded-xl flex items-center justify-center neon-border-blue/20 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                    <UserIcon className="text-neon-blue" size={24} />
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${teacher.status === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    {teacher.status}
                  </span>
                </div>
                
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1 leading-none">{teacher.name}</h3>
                  <p className="text-[10px] font-black text-neon-blue uppercase tracking-widest mb-4 opacity-70">{teacher.designation || 'Teacher'}</p>
                  
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Base Salary</span>
                      <span className="text-xs font-black text-white tracking-tighter">Rs. {teacher.baseSalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Allowances</span>
                      <span className="text-xs font-black text-green-500 tracking-tighter">+ Rs. {teacher.allowances.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Deductions</span>
                      <span className="text-xs font-black text-red-500 tracking-tighter">- Rs. {teacher.deductions.toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest">Net Payable</span>
                      <span className="text-sm font-black text-white tracking-tighter">Rs. {(teacher.baseSalary + teacher.allowances - teacher.deductions).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2 relative z-10">
                  <button 
                    onClick={() => setSelectedTeacherForHistory(teacher)}
                    className="flex-1 py-2 bg-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                  >
                    View History
                  </button>
                  <button 
                    onClick={() => setSelectedTeacherForSalaryEdit(teacher)}
                    className="flex-1 py-2 bg-neon-blue/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-neon-blue hover:bg-neon-blue hover:text-black transition-all"
                  >
                    Edit Salary
                  </button>
                </div>
              </motion.div>
            ))}
            {teachers.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center bg-cyber-gray/50 rounded-3xl border border-dashed border-white/10">
                <p className="text-gray-500 text-xs font-black uppercase tracking-widest">No staff members found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-cyber-gray p-6 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Total Net Payable</p>
                <p className="text-2xl font-black text-white tracking-tighter">Rs. {stats.totalNet.toLocaleString()}</p>
                <p className="text-[8px] text-gray-500 uppercase font-bold mt-2">{stats.count} Records</p>
              </div>
              <div className="bg-cyber-gray p-6 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Total Disbursed</p>
                <p className="text-2xl font-black text-green-500 tracking-tighter">Rs. {stats.totalPaid.toLocaleString()}</p>
                <p className="text-[8px] text-gray-500 uppercase font-bold mt-2">{stats.paidCount} Paid</p>
              </div>
              <div className="bg-cyber-gray p-6 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Total Pending</p>
                <p className="text-2xl font-black text-neon-blue tracking-tighter">Rs. {stats.totalPending.toLocaleString()}</p>
                <p className="text-[8px] text-gray-500 uppercase font-bold mt-2">{stats.pendingCount} Pending</p>
              </div>
              <div className="bg-cyber-gray p-6 rounded-2xl border border-white/5 flex flex-col justify-center">
                <button 
                  onClick={handleBulkPayout}
                  disabled={processingPayout || stats.pendingCount === 0}
                  className="w-full py-3 bg-neon-blue text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:shadow-[0_0_20px_#00f3ff] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingPayout ? <Clock className="animate-spin" size={16} /> : <Zap size={16} />}
                  Bulk Disburse
                </button>
              </div>
            </div>

            <div className="bg-cyber-gray p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-cyber-black p-3 rounded-xl border border-white/5">
                  <Calendar className="text-neon-purple" size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">Payroll Period</p>
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-white font-black uppercase outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={handleGeneratePayroll}
                disabled={generating}
                className="bg-neon-purple text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:shadow-[0_0_20px_rgba(191,0,255,0.3)] transition-all disabled:opacity-50"
              >
                {generating ? <Clock className="animate-spin" size={16} /> : <Zap size={16} />}
                Generate Payroll
              </button>
            </div>

            {message && (
              <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'} text-xs font-bold uppercase tracking-widest flex items-center gap-2`}>
                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </div>
            )}

            <div className="bg-cyber-gray rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Teacher</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Base</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Net Salary</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPayroll.map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-white uppercase tracking-tighter">{p.teacherName}</p>
                          <p className="text-[10px] text-gray-600 font-mono">{p.teacherUid}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-400">Rs. {p.baseSalary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-xs font-black text-neon-blue">Rs. {p.netSalary.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {p.status === 'pending' && (
                            <button 
                              onClick={() => setSelectedPayrollForPayout(p)}
                              className="text-neon-blue hover:text-white transition-colors"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredPayroll.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
                          No payroll records found for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <AnimatePresence>
              {selectedPayrollForPayout && <PayoutConfirmationModal />}
              {selectedTeacherForSalaryEdit && <EditSalaryModal />}
              {selectedTeacherForHistory && <PayrollHistoryModal />}
              {selectedPayrollForPayslip && <PayslipModal />}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const Teachers = () => {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<any>(null);
    const [newTeacher, setNewTeacher] = useState({
      name: '',
      email: '',
      phone: '',
      designation: 'Senior Teacher',
      baseSalary: 35000,
      allowances: 5000,
      deductions: 0
    });

    const schoolId = userProfile.schoolId || '';

    useEffect(() => {
      if (!schoolId) return;
      const q = onSnapshot(collection(db, 'schools', schoolId, 'teachers'), (snapshot) => {
        setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Teacher)));
        setLoading(false);
      });
      return () => q();
    }, [schoolId]);

    const handleRegisterTeacher = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/register-teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newTeacher,
            schoolId,
            adminUid: userProfile.uid
          })
        });
        const data = await response.json();
        if (data.success) {
          setSuccessData(data);
          setIsAddModalOpen(false);
          setNewTeacher({
            name: '', email: '', phone: '', designation: 'Senior Teacher',
            baseSalary: 35000, allowances: 5000, deductions: 0
          });
        } else {
          setError(data.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    const updateStatus = async (teacherUid: string, newStatus: string) => {
      try {
        // Update both users and teachers records
        await updateDoc(doc(db, 'users', teacherUid), { status: newStatus });
        await updateDoc(doc(db, 'schools', schoolId, 'teachers', teacherUid), { status: newStatus });
      } catch (err: any) {
        alert("Error updating status: " + err.message);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1">Staff Directory</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Manage your school's teaching faculty</p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-neon-blue text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all"
          >
            <Plus size={16} /> Add Teacher
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-48 bg-white/5 animate-pulse rounded-2xl" />)
          ) : teachers.map(t => (
            <motion.div 
              key={t.uid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-cyber-gray p-6 rounded-2xl border border-white/5 hover:border-neon-blue/30 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-cyber-black rounded-xl flex items-center justify-center border border-white/5 group-hover:neon-border-blue transition-all">
                  <UserIcon className="text-neon-blue" size={24} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <select 
                    value={t.status}
                    onChange={(e) => updateStatus(t.uid, e.target.value)}
                    className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full outline-none cursor-pointer ${
                      t.status === 'active' ? 'bg-green-500/10 text-green-500' : 
                      t.status === 'on_leave' ? 'bg-yellow-500/10 text-yellow-500' : 
                      'bg-red-500/10 text-red-500'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="resigned">Resigned</option>
                  </select>
                </div>
              </div>

              <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-none mb-1">{t.name}</h4>
              <p className="text-xs text-neon-purple font-bold mb-4">{t.designation}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-gray-500">
                  <Mail size={12} />
                  <span className="text-[10px] font-mono">{t.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Phone size={12} />
                  <span className="text-[10px] font-mono">{t.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1">Net Salary</p>
                  <p className="text-xs font-bold text-white">Rs. {(t.baseSalary + t.allowances - t.deductions).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedTeacherForIdCard(t)}
                    className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-neon-purple transition-all"
                    title="Print ID Card"
                  >
                    <Globe size={16} />
                  </button>
                  <button className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-neon-blue transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {teachers.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-cyber-gray/30 rounded-[40px] border border-dashed border-white/10">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="text-gray-600" size={32} />
              </div>
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest">No faculty members registered yet</p>
            </div>
          )}
        </div>

        {/* Add Teacher Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsAddModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Register Faculty</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Add a new teacher to the school system</p>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleRegisterTeacher} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-blue uppercase tracking-[0.2em] border-b border-neon-blue/20 pb-2">Personal Details</h4>
                      <NeonInput icon={UserIcon} placeholder="Full Name" required value={newTeacher.name} onChange={(e: any) => setNewTeacher({...newTeacher, name: e.target.value})} />
                      <NeonInput icon={Mail} type="email" placeholder="Email Address" required value={newTeacher.email} onChange={(e: any) => setNewTeacher({...newTeacher, email: e.target.value})} />
                      <NeonInput icon={Phone} placeholder="Phone Number" value={newTeacher.phone} onChange={(e: any) => setNewTeacher({...newTeacher, phone: e.target.value})} />
                      <NeonInput icon={GraduationCap} placeholder="Designation (e.g. Senior Teacher)" value={newTeacher.designation} onChange={(e: any) => setNewTeacher({...newTeacher, designation: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-[0.2em] border-b border-neon-purple/20 pb-2">Salary Structure</h4>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Base Salary (Rs.)</label>
                        <NeonInput icon={DollarSign} type="number" required value={newTeacher.baseSalary} onChange={(e: any) => setNewTeacher({...newTeacher, baseSalary: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Allowances (Rs.)</label>
                        <NeonInput icon={Plus} type="number" value={newTeacher.allowances} onChange={(e: any) => setNewTeacher({...newTeacher, allowances: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Deductions (Rs.)</label>
                        <NeonInput icon={X} type="number" value={newTeacher.deductions} onChange={(e: any) => setNewTeacher({...newTeacher, deductions: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>

                  {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase text-center">{error}</div>}

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] text-gray-500 hover:text-white transition-all">Cancel</button>
                    <NeonButton type="submit" loading={submitting}>Register Faculty</NeonButton>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Success Modal for Teacher Registration */}
        <AnimatePresence>
          {successData && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-cyber-gray p-10 rounded-3xl neon-border-blue w-full max-w-md text-center shadow-[0_0_50px_rgba(0,243,255,0.1)]"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                  <CheckCircle2 className="text-green-400" size={40} />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Faculty Registered</h3>
                <p className="text-gray-500 text-sm mb-8 uppercase tracking-widest">Teacher account has been initialized</p>
                
                <div className="space-y-4 mb-10">
                  <div className="bg-cyber-black p-4 rounded-2xl border border-white/5 text-left">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Login Email</p>
                    <p className="text-white font-bold">{successData.email}</p>
                  </div>
                  <div className="bg-cyber-black p-4 rounded-2xl border border-white/5 text-left relative group">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Temporary Password</p>
                    <p className="text-neon-purple font-mono font-bold text-lg">{successData.password}</p>
                    <button 
                      onClick={() => navigator.clipboard.writeText(successData.password)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-neon-purple transition-all"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <NeonButton onClick={() => setSuccessData(null)}>Done</NeonButton>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const PasswordResetModal = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (newPassword.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Re-authenticate user to verify current password
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error("User not authenticated.");

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // 2. Call backend to update password with PIN verification
        const response = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUid: user.uid,
            newPassword,
            pin,
            adminUid: user.uid
          })
        });

        const data = await response.json();
        if (data.success) {
          setSuccess(true);
          setTimeout(() => {
            setIsPasswordResetModalOpen(false);
            setSuccess(false);
          }, 2000);
        } else {
          setError(data.error || "Failed to reset password.");
        }
      } catch (err: any) {
        console.error("Reset error:", err);
        setError(err.code === 'auth/wrong-password' ? "Incorrect current password." : err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setIsPasswordResetModalOpen(false)}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-cyber-gray p-8 rounded-3xl neon-border-purple w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Secure Reset</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Update your administrative access</p>
            </div>
            <button onClick={() => setIsPasswordResetModalOpen(false)} className="p-2 text-gray-500 hover:text-white"><X size={24} /></button>
          </div>

          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                <CheckCircle className="text-green-400" size={32} />
              </div>
              <p className="text-green-400 font-black uppercase tracking-widest text-xs">Password Updated Successfully</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Current Password</label>
                <NeonInput icon={Lock} type="password" required value={currentPassword} onChange={(e: any) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Security PIN</label>
                <NeonInput icon={ShieldCheck} type="password" placeholder="Enter 4-digit PIN" required value={pin} onChange={(e: any) => setPin(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">New Password</label>
                  <NeonInput icon={Key} type="password" required value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Confirm</label>
                  <NeonInput icon={Key} type="password" required value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} />
                </div>
              </div>

              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{error}</div>}

              <div className="pt-4">
                <NeonButton type="submit" loading={loading} variant="purple">Update Credentials</NeonButton>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    );
  };

  const TeacherIDCardModal = () => {
    if (!selectedTeacherForIdCard) return null;
    const t = selectedTeacherForIdCard;
    const qrData = JSON.stringify({
      name: t.name,
      email: t.email,
      designation: t.designation,
      school: school?.name || 'EduPak School'
    });

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm no-print">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-cyber-gray p-8 rounded-[40px] neon-border-blue max-w-md w-full relative overflow-hidden"
        >
          <button 
            onClick={() => setSelectedTeacherForIdCard(null)}
            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">ID Card Preview</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Professional Faculty Credential</p>
          </div>

          {/* ID Card Design */}
          <div id="id-card-printable" className="bg-white text-black p-6 rounded-2xl shadow-2xl mx-auto w-[300px] h-[450px] flex flex-col items-center justify-between border-4 border-cyber-black relative overflow-hidden">
            {/* Header */}
            <div className="w-full bg-cyber-black text-white p-4 absolute top-0 left-0 flex items-center justify-center gap-2">
              <GraduationCap size={20} className="text-neon-blue" />
              <span className="font-black text-xs tracking-widest uppercase">{school?.name || 'EDUPAK SCHOOL'}</span>
            </div>

            <div className="mt-16 flex flex-col items-center flex-1 w-full">
              <div className="w-24 h-24 bg-gray-100 rounded-2xl border-2 border-cyber-black flex items-center justify-center mb-4 overflow-hidden">
                <UserIcon size={48} className="text-gray-300" />
              </div>
              
              <h3 className="text-xl font-black uppercase tracking-tighter text-center leading-none mb-1">{t.name}</h3>
              <p className="text-xs font-bold text-neon-purple uppercase tracking-widest mb-4">{t.designation}</p>
              
              <div className="w-full space-y-2 mb-6">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Employee ID</span>
                  <span className="text-[10px] font-bold font-mono">{t.uid.substring(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Email</span>
                  <span className="text-[10px] font-bold font-mono">{t.email}</span>
                </div>
              </div>

              <div className="mt-auto mb-4">
                <QRCodeSVG value={qrData} size={80} level="H" />
                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest text-center mt-2">Scan for Verification</p>
              </div>
            </div>

            {/* Footer */}
            <div className="w-full h-2 bg-neon-blue absolute bottom-0 left-0"></div>
          </div>

          <div className="mt-8 flex gap-4">
            <button 
              onClick={() => window.print()}
              className="flex-1 py-4 bg-neon-blue text-black font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_20px_#00f3ff] transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} /> Print Card
            </button>
          </div>
        </motion.div>

        {/* Hidden Printable Version */}
        <div className="hidden print-only fixed inset-0 bg-white">
          <div className="flex items-center justify-center h-screen">
             <div className="bg-white text-black p-6 rounded-2xl shadow-none w-[300px] h-[450px] flex flex-col items-center justify-between border-4 border-black relative overflow-hidden">
                <div className="w-full bg-black text-white p-4 absolute top-0 left-0 flex items-center justify-center gap-2">
                  <span className="font-black text-xs tracking-widest uppercase">{school?.name || 'EDUPAK SCHOOL'}</span>
                </div>
                <div className="mt-16 flex flex-col items-center flex-1 w-full">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl border-2 border-black flex items-center justify-center mb-4 overflow-hidden">
                    <UserIcon size={48} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-center leading-none mb-1">{t.name}</h3>
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-4">{t.designation}</p>
                  <div className="w-full space-y-2 mb-6">
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Employee ID</span>
                      <span className="text-[10px] font-bold font-mono">{t.uid.substring(0, 8).toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="mt-auto mb-4">
                    <QRCodeSVG value={qrData} size={80} level="H" />
                  </div>
                </div>
                <div className="w-full h-2 bg-blue-500 absolute bottom-0 left-0"></div>
              </div>
          </div>
        </div>
      </div>
    );
  };

  const GlobalSettingsModule = () => {
    const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'branding' | 'apis' | 'legal'>('general');
    const [config, setConfig] = useState<GlobalConfig | null>(globalConfig);
    const [isSaving, setIsSaving] = useState(false);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);

    useEffect(() => {
      if (globalConfig && !config) {
        setConfig(globalConfig);
      }
    }, [globalConfig]);

    const handleSave = async () => {
      if (!config) return;
      setIsSaving(true);
      try {
        await setDoc(doc(db, 'settings', 'global_config'), {
          ...config,
          updatedAt: Timestamp.now(),
          updatedBy: userProfile?.uid || 'system'
        });
      } catch (error) {
        console.error("Error saving config:", error);
      } finally {
        setIsSaving(false);
      }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
      const file = e.target.files?.[0];
      if (!file) return;

      const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon;
      setUploading(true);

      try {
        const storage = getStorage();
        const storageRef = ref(storage, `branding/${type}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        setConfig(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            branding: {
              ...prev.branding,
              [type === 'logo' ? 'logoUrl' : 'faviconUrl']: url
            }
          };
        });
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setUploading(false);
      }
    };

    const toggleKeyVisibility = (key: string) => {
      setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!config) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <RefreshCw className="text-neon-blue animate-spin mb-4" size={32} />
          <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Synchronizing Global State...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-24">
        <div className="flex gap-2 p-1 bg-cyber-black/50 rounded-2xl border border-white/5 w-fit">
          {[
            { id: 'general', label: 'General', icon: Globe },
            { id: 'branding', label: 'Branding', icon: Palette },
            { id: 'apis', label: 'Integrations', icon: Key },
            { id: 'legal', label: 'Legal', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeSettingsTab === tab.id 
                  ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {activeSettingsTab === 'general' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="text-neon-blue" size={20} />
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">General Configuration</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platform Name</label>
                    <input 
                      type="text"
                      value={config.platformName}
                      onChange={(e) => setConfig({ ...config, platformName: e.target.value })}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Support Email</label>
                    <input 
                      type="email"
                      value={config.supportEmail}
                      onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Contact Phone</label>
                    <input 
                      type="text"
                      value={config.supportPhone}
                      onChange={(e) => setConfig({ ...config, supportPhone: e.target.value })}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Default Currency</label>
                    <select 
                      value={config.currency}
                      onChange={(e) => setConfig({ ...config, currency: e.target.value as any })}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all appearance-none"
                    >
                      <option value="PKR">PKR - Pakistani Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">System Timezone</label>
                    <select 
                      value={config.timezone}
                      onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all appearance-none"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="Asia/Karachi">Asia/Karachi (GMT+5)</option>
                      <option value="America/New_York">America/New_York (GMT-5)</option>
                      <option value="Europe/London">Europe/London (GMT+0)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSettingsTab === 'branding' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Palette className="text-neon-purple" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Visual Identity</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Main Platform Logo</label>
                      <div className="relative group">
                        <div className="w-full h-40 bg-cyber-black rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 group-hover:border-neon-blue transition-all overflow-hidden">
                          {config.branding.logoUrl ? (
                            <img src={config.branding.logoUrl} alt="Logo" className="max-h-24 object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <>
                              <Upload className="text-gray-600" size={32} />
                              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Drop logo here</p>
                            </>
                          )}
                          {uploadingLogo && (
                            <div className="absolute inset-0 bg-cyber-black/80 flex items-center justify-center">
                              <RefreshCw className="text-neon-blue animate-spin" size={24} />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file" 
                          onChange={(e) => handleFileUpload(e, 'logo')}
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Favicon (32x32)</label>
                      <div className="relative group">
                        <div className="w-full h-40 bg-cyber-black rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 group-hover:border-neon-purple transition-all overflow-hidden">
                          {config.branding.faviconUrl ? (
                            <img src={config.branding.faviconUrl} alt="Favicon" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <>
                              <Upload className="text-gray-600" size={32} />
                              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Drop favicon</p>
                            </>
                          )}
                          {uploadingFavicon && (
                            <div className="absolute inset-0 bg-cyber-black/80 flex items-center justify-center">
                              <RefreshCw className="text-neon-purple animate-spin" size={24} />
                            </div>
                          )}
                        </div>
                        <input 
                          type="file" 
                          onChange={(e) => handleFileUpload(e, 'favicon')}
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">Primary Accent Color</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="color" 
                        value={config.branding.primaryColor}
                        onChange={(e) => setConfig({
                          ...config,
                          branding: { ...config.branding, primaryColor: e.target.value }
                        })}
                        className="w-12 h-12 bg-transparent border-none cursor-pointer"
                      />
                      <div className="flex-1 bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-gray-400 uppercase tracking-widest">
                        {config.branding.primaryColor}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSettingsTab === 'apis' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="text-neon-blue" size={20} />
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">Payment Gateway (Stripe)</h3>
                    </div>
                    <div className="px-3 py-1 bg-neon-blue/10 rounded-full border border-neon-blue/20 text-[9px] font-black text-neon-blue uppercase tracking-widest">
                      Live Mode
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Publishable Key</label>
                      <input 
                        type="text"
                        value={config.apis.stripePublic}
                        onChange={(e) => setConfig({
                          ...config,
                          apis: { ...config.apis, stripePublic: e.target.value }
                        })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Secret Key</label>
                      <div className="relative">
                        <input 
                          type={showKeys['stripe'] ? 'text' : 'password'}
                          value={config.apis.stripeSecret}
                          onChange={(e) => setConfig({
                            ...config,
                            apis: { ...config.apis, stripeSecret: e.target.value }
                          })}
                          className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-neon-blue outline-none transition-all pr-12"
                        />
                        <button 
                          onClick={() => toggleKeyVisibility('stripe')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                        >
                          {showKeys['stripe'] ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex items-center gap-3">
                    <Mail className="text-neon-purple" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Email Service (SMTP)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">SMTP Host</label>
                      <input 
                        type="text"
                        value={config.apis.smtpHost}
                        onChange={(e) => setConfig({
                          ...config,
                          apis: { ...config.apis, smtpHost: e.target.value }
                        })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">API Key / Password</label>
                      <div className="relative">
                        <input 
                          type={showKeys['smtp'] ? 'text' : 'password'}
                          value={config.apis.smtpKey}
                          onChange={(e) => setConfig({
                            ...config,
                            apis: { ...config.apis, smtpKey: e.target.value }
                          })}
                          className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-neon-blue outline-none transition-all pr-12"
                        />
                        <button 
                          onClick={() => toggleKeyVisibility('smtp')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                        >
                          {showKeys['smtp'] ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex items-center gap-3">
                    <Phone className="text-neon-blue" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">SMS Gateway</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">API Endpoint URL</label>
                      <input 
                        type="text"
                        value={config.apis.smsApiUrl}
                        onChange={(e) => setConfig({
                          ...config,
                          apis: { ...config.apis, smsApiUrl: e.target.value }
                        })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-neon-blue outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">API Key</label>
                      <div className="relative">
                        <input 
                          type={showKeys['sms'] ? 'text' : 'password'}
                          value={config.apis.smsApiKey}
                          onChange={(e) => setConfig({
                            ...config,
                            apis: { ...config.apis, smsApiKey: e.target.value }
                          })}
                          className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:border-neon-blue outline-none transition-all pr-12"
                        />
                        <button 
                          onClick={() => toggleKeyVisibility('sms')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                        >
                          {showKeys['sms'] ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSettingsTab === 'legal' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="text-neon-blue" size={20} />
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">Legal & Compliance</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Terms & Conditions</label>
                      <span className="text-[9px] text-gray-600 font-bold uppercase">Rich Text Editor</span>
                    </div>
                    <textarea 
                      value={config.legal.termsAndConditions}
                      onChange={(e) => setConfig({
                        ...config,
                        legal: { ...config.legal, termsAndConditions: e.target.value }
                      })}
                      className="w-full h-48 bg-cyber-black border border-white/10 rounded-2xl p-6 text-sm text-gray-400 focus:border-neon-blue outline-none transition-all resize-none leading-relaxed"
                      placeholder="Enter platform terms and conditions..."
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Privacy Policy</label>
                      <span className="text-[9px] text-gray-600 font-bold uppercase">Rich Text Editor</span>
                    </div>
                    <textarea 
                      value={config.legal.privacyPolicy}
                      onChange={(e) => setConfig({
                        ...config,
                        legal: { ...config.legal, privacyPolicy: e.target.value }
                      })}
                      className="w-full h-48 bg-cyber-black border border-white/10 rounded-2xl p-6 text-sm text-gray-400 focus:border-neon-blue outline-none transition-all resize-none leading-relaxed"
                      placeholder="Enter platform privacy policy..."
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6">System Status</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Last Updated</span>
                  <span className="text-[10px] font-mono text-neon-blue">{config.updatedAt.toDate().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Updated By</span>
                  <span className="text-[10px] font-mono text-neon-purple">{config.updatedBy}</span>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3 text-green-500">
                    <CheckCircle size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Configuration Synced</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neon-blue/5 p-6 rounded-3xl border border-neon-blue/20">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="text-neon-blue" size={20} />
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Security Note</h4>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                API keys and secrets are strictly encrypted at rest and masked in the UI. Only authorized Super Admins can view or modify these integration settings.
              </p>
            </div>
          </div>
        </div>

        <div className="fixed bottom-12 right-12 z-50">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`group relative flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:bg-neon-blue transition-all active:scale-95 disabled:opacity-50 ${isSaving ? 'pr-12' : ''}`}
          >
            {isSaving ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
            
            {!isSaving && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-blue rounded-full animate-ping" />
            )}
          </button>
        </div>
      </div>
    );
  };

  const GlobalAnnouncementsModule = () => {
    const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
      title: '',
      message: '',
      type: 'info' as 'info' | 'update' | 'warning',
      target_audience: 'all',
      expiryDays: '3'
    });

    useEffect(() => {
      const q = query(collection(db, 'global_announcements'), orderBy('created_at', 'desc'));
      const unsubscribeAnn = onSnapshot(q, (snapshot) => {
        setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalAnnouncement)));
        setLoading(false);
      });

      const unsubscribeSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
        setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
      });

      return () => {
        unsubscribeAnn();
        unsubscribeSchools();
      };
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || !formData.message) return;

      setIsSubmitting(true);
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expiryDays));

        await addDoc(collection(db, 'global_announcements'), {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          target_audience: formData.target_audience,
          created_by: auth.currentUser?.uid,
          created_at: Timestamp.now(),
          expires_at: Timestamp.fromDate(expiresAt)
        });

        setIsModalOpen(false);
        setFormData({ title: '', message: '', type: 'info', target_audience: 'all', expiryDays: '3' });
      } catch (error) {
        console.error("Error creating announcement:", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleDelete = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this announcement?")) {
        try {
          // await deleteDoc(doc(db, 'global_announcements', id));
          console.log("Delete announcement:", id);
        } catch (error) {
          console.error("Error deleting announcement:", error);
        }
      }
    };

    const handleForceExpire = async (id: string) => {
      try {
        await updateDoc(doc(db, 'global_announcements', id), {
          expires_at: Timestamp.now()
        });
      } catch (error) {
        console.error("Error expiring announcement:", error);
      }
    };

    const activeCount = announcements.filter(a => a.expires_at.toMillis() > Date.now()).length;

    return (
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-cyan-400" />
              Global Announcements
            </h2>
            <p className="text-slate-400 text-sm">Broadcast updates and notifications to all schools.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Active</p>
                <p className="text-xl font-mono text-cyan-400">{activeCount}</p>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Sent</p>
                <p className="text-xl font-mono text-purple-400">{announcements.length}</p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create New
            </button>
          </div>
        </div>

        {/* Announcements List */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Announcement</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Type</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Audience</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Sent Date</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading announcements...
                    </td>
                  </tr>
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No announcements found.
                    </td>
                  </tr>
                ) : (
                  announcements.map((ann) => {
                    const isActive = ann.expires_at.toMillis() > Date.now();
                    const targetSchool = schools.find(s => s.id === ann.target_audience);

                    return (
                      <motion.tr
                        key={ann.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <p className="text-white font-medium truncate">{ann.title}</p>
                            <p className="text-slate-500 text-xs truncate">{ann.message}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            ann.type === 'warning' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            ann.type === 'update' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {ann.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-300 text-sm">
                            {ann.target_audience === 'all' ? (
                              <>
                                <Globe className="w-4 h-4 text-cyan-400" />
                                All Schools
                              </>
                            ) : (
                              <>
                                <Building2 className="w-4 h-4 text-purple-400" />
                                {targetSchool?.name || ann.target_audience}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-green-400' : 'text-slate-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                            {isActive ? 'Active' : 'Expired'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                          {ann.created_at.toDate().toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isActive && (
                              <button
                                onClick={() => handleForceExpire(ann.id)}
                                title="Force Expire"
                                className="p-2 hover:bg-amber-500/10 text-amber-400 rounded-lg transition-colors"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(ann.id)}
                              title="Delete"
                              className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Megaphone className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Compose Announcement</h3>
                      <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">New Broadcast</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleCreate} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Title */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Announcement Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., System Maintenance Update"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      >
                        <option value="info">Information (Blue)</option>
                        <option value="update">Update (Green)</option>
                        <option value="warning">Warning (Red)</option>
                      </select>
                    </div>

                    {/* Target */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Audience</label>
                      <select
                        value={formData.target_audience}
                        onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      >
                        <option value="all">All Schools</option>
                        {schools.map(school => (
                          <option key={school.id} value={school.id}>{school.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Expiry */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auto-Expire After</label>
                      <select
                        value={formData.expiryDays}
                        onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      >
                        <option value="1">24 Hours</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message Body</label>
                    <textarea
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Type your announcement message here..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      Publish Announcement
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const SupportHelpdesk = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const q = query(collection(db, 'support_tickets'), orderBy('updated_at', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
        setTickets(ticketList);
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

    useEffect(() => {
      if (selectedTicket) {
        const q = query(
          collection(db, 'support_tickets', selectedTicket.id, 'messages'),
          orderBy('timestamp', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const messageList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketMessage));
          setMessages(messageList);
        });
        return () => unsubscribe();
      }
    }, [selectedTicket]);

    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !selectedTicket) return;

      const messageData = {
        sender_id: userProfile.uid,
        sender_name: userProfile.name,
        sender_role: 'super_admin',
        text: newMessage,
        timestamp: Timestamp.now()
      };

      try {
        await addDoc(collection(db, 'support_tickets', selectedTicket.id, 'messages'), messageData);
        await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
          updated_at: Timestamp.now(),
          status: selectedTicket.status === 'open' ? 'pending' : selectedTicket.status
        });
        setNewMessage('');
      } catch (err) {
        console.error('Error sending message:', err);
      }
    };

    const handleStatusChange = async (newStatus: SupportTicket['status']) => {
      if (!selectedTicket) return;
      try {
        await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
          status: newStatus,
          updated_at: Timestamp.now()
        });
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      } catch (err) {
        console.error('Error updating status:', err);
      }
    };

    const filteredTickets = tickets.filter(t => {
      const matchesSearch = t.school_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    const stats = {
      open: tickets.filter(t => t.status === 'open').length,
      unassigned: tickets.filter(t => !t.assigned_to).length,
      avgResolution: '2.4 Hours'
    };

    const getPriorityColor = (p: string) => {
      switch (p) {
        case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/20';
        case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      }
    };

    const getStatusColor = (s: string) => {
      switch (s) {
        case 'resolved': return 'text-green-500 bg-green-500/10 border-green-500/20';
        case 'pending': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        default: return 'text-red-500 bg-red-500/10 border-red-500/20';
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 ${stats.open > 10 ? 'neon-border-red' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Open Tickets</span>
              <AlertCircle className={stats.open > 10 ? 'text-red-500' : 'text-gray-500'} size={16} />
            </div>
            <p className="text-3xl font-black text-white">{stats.open}</p>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Unassigned</span>
              <UserX className="text-gray-500" size={16} />
            </div>
            <p className="text-3xl font-black text-white">{stats.unassigned}</p>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Avg. Resolution</span>
              <Clock className="text-gray-500" size={16} />
            </div>
            <p className="text-3xl font-black text-white">{stats.avgResolution}</p>
          </div>
        </div>

        <div className="flex gap-6 h-[70vh]">
          <div className="w-1/3 bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-bottom border-white/5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-neon-blue transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 bg-cyber-black/50 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black uppercase text-gray-400 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select 
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="flex-1 bg-cyber-black/50 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black uppercase text-gray-400 focus:outline-none"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-neon-blue" /></div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">No tickets found</div>
              ) : (
                filteredTickets.map(ticket => (
                  <motion.div
                    key={ticket.id}
                    whileHover={{ x: 4 }}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-neon-blue/10 border-neon-blue/30' 
                        : 'bg-cyber-black/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-xs font-black text-white uppercase truncate max-w-[150px]">{ticket.school_name}</h4>
                      <span className="text-[10px] text-gray-500">{new Date(ticket.updated_at.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-1 mb-3">{ticket.subject}</p>
                    <div className="flex gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            {selectedTicket ? (
              <>
                <div className="p-6 border-bottom border-white/5 flex items-center justify-between bg-cyber-black/20">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 size={12} className="text-neon-blue" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{selectedTicket.school_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <select 
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(e.target.value as SupportTicket['status'])}
                      className={`bg-cyber-black/50 border border-white/10 rounded-xl py-2 px-4 text-xs font-black uppercase focus:outline-none transition-colors ${getStatusColor(selectedTicket.status)}`}
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-cyber-black/10">
                  {messages.map((msg, i) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.sender_role === 'super_admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] space-y-1 ${msg.sender_role === 'super_admin' ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-2xl text-sm ${
                          msg.sender_role === 'super_admin' 
                            ? 'bg-neon-blue text-white rounded-tr-none shadow-[0_0_15px_rgba(0,243,255,0.2)]' 
                            : 'bg-cyber-gray border border-white/10 text-gray-200 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-2 px-2">
                          <span className="text-[9px] font-black text-gray-600 uppercase">{msg.sender_name}</span>
                          <span className="text-[9px] text-gray-700">•</span>
                          <span className="text-[9px] text-gray-600">{new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 border-top border-white/5 bg-cyber-black/20">
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div className="flex items-center gap-4 mb-2">
                      <select 
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="bg-cyber-black/50 border border-white/10 rounded-lg py-1 px-3 text-[10px] font-black uppercase text-gray-500 focus:outline-none hover:border-neon-blue transition-colors"
                      >
                        <option value="">Canned Responses</option>
                        <option value="Hello, we have received your request and are looking into it.">Acknowledgment</option>
                        <option value="This issue has been resolved. Please check and let us know.">Resolution</option>
                        <option value="We need more information regarding this issue. Could you please provide screenshots?">Request Info</option>
                      </select>
                    </div>
                    <div className="relative">
                      <textarea 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your reply here..."
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl p-4 pr-16 text-sm text-white focus:outline-none focus:border-neon-blue transition-all min-h-[100px] resize-none"
                      />
                      <div className="absolute right-4 bottom-4 flex items-center gap-2">
                        <button type="button" className="p-2 text-gray-500 hover:text-neon-blue transition-colors">
                          <Paperclip size={20} />
                        </button>
                        <button 
                          type="submit"
                          disabled={!newMessage.trim()}
                          className="p-3 bg-neon-blue text-cyber-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_15px_rgba(0,243,255,0.3)]"
                        >
                          <Send size={20} />
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-neon-blue/5 rounded-full flex items-center justify-center mb-6 border border-neon-blue/20">
                  <MessageSquare className="text-neon-blue/40" size={40} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">No Ticket Selected</h3>
                <p className="text-gray-500 text-sm max-w-xs">Select a ticket from the inbox to view the conversation and reply.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const RevenueBilling = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Mock data for visualization
    const revenueData = [
      { month: 'Oct', revenue: 45000 },
      { month: 'Nov', revenue: 52000 },
      { month: 'Dec', revenue: 48000 },
      { month: 'Jan', revenue: 61000 },
      { month: 'Feb', revenue: 75000 },
      { month: 'Mar', revenue: 84200 },
    ];

    const mockTransactions = [
      { id: 'INV-001', school: 'Beaconhouse School', plan: 'Enterprise', amount: 1200, date: '2026-03-25', status: 'paid' },
      { id: 'INV-002', school: 'City School', plan: 'Pro', amount: 800, date: '2026-03-24', status: 'paid' },
      { id: 'INV-003', school: 'Roots International', plan: 'Basic', amount: 400, date: '2026-03-23', status: 'failed' },
      { id: 'INV-004', school: 'LGS', plan: 'Enterprise', amount: 1200, date: '2026-03-22', status: 'paid' },
      { id: 'INV-005', school: 'KIPS College', plan: 'Pro', amount: 800, date: '2026-03-21', status: 'pending' },
    ];

    const mockPlans = [
      { id: 'basic', name: 'Basic', price: 400, features: ['Up to 500 Students', 'Core HR', 'Basic Reports'] },
      { id: 'pro', name: 'Pro', price: 800, features: ['Up to 2000 Students', 'Advanced HR', 'Finance Module', 'Email Alerts'] },
      { id: 'enterprise', name: 'Enterprise', price: 1200, features: ['Unlimited Students', 'Full Suite', 'Dedicated Support', 'Custom Domain'] },
    ];

    return (
      <div className="space-y-8">
        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'MRR', value: '$84,200', trend: '+5.2%', icon: DollarSign, color: 'text-neon-blue' },
            { label: 'ARR', value: '$1.01M', trend: '+12.8%', icon: TrendingUp, color: 'text-neon-purple' },
            { label: 'Active Subscriptions', value: '124', trend: '+8', icon: UserCheck, color: 'text-green-400' },
            { label: 'Expired Trials', value: '12', trend: '-2', icon: AlertTriangle, color: 'text-red-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-cyber-black/50 border border-white/5 ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full bg-cyber-black/50 ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</h3>
              <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-white">Revenue Growth</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Last 6 Months Performance</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-neon-blue text-black text-[10px] font-black uppercase tracking-widest rounded-lg">Monthly</button>
              <button className="px-4 py-2 bg-cyber-black text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-lg">Yearly</button>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#666" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontWeight: 'bold' }}
                />
                <YAxis 
                  stroke="#666" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontWeight: 'bold' }}
                  tickFormatter={(value) => `$${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #00f3ff30', borderRadius: '12px' }}
                  itemStyle={{ color: '#00f3ff', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#00f3ff" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Subscription Plans */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Active Plans</h3>
              <button className="p-2 bg-neon-purple/10 text-neon-purple rounded-lg border border-neon-purple/20 hover:bg-neon-purple hover:text-black transition-all">
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {mockPlans.map((plan) => (
                <div key={plan.id} className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-neon-purple/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-white font-black uppercase tracking-tighter text-lg">{plan.name}</h4>
                      <p className="text-neon-purple font-black text-2xl tracking-tighter">${plan.price}<span className="text-[10px] text-gray-500">/mo</span></p>
                    </div>
                    <button className="p-2 text-gray-500 hover:text-white transition-colors">
                      <Settings size={16} />
                    </button>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <CheckCircle size={12} className="text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white group-hover:border-neon-purple/50 transition-all">
                    Edit Plan Details
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Recent Transactions</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search invoices..." 
                  className="pl-10 pr-4 py-2 bg-cyber-black/50 border border-white/5 rounded-xl text-xs outline-none focus:neon-border-blue transition-all"
                />
              </div>
            </div>
            <div className="bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cyber-black/50 border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Invoice</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">School</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {mockTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono font-bold text-neon-blue">{tx.id}</p>
                        <p className="text-[9px] text-gray-600 font-bold uppercase">{tx.date}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-white">{tx.school}</p>
                        <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest">{tx.plan} Plan</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-white">${tx.amount}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          tx.status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          tx.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-gray-500 hover:text-neon-blue transition-colors">
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SubscriptionPlansManager = () => {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [planToDelete, setPlanToDelete] = useState<any | null>(null);
    const [schoolsInPlan, setSchoolsInPlan] = useState<any[]>([]);
    const [migrationPlanId, setMigrationPlanId] = useState('');
    const [isMigrating, setIsMigrating] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    
    // Form State
    const [formData, setFormData] = useState({
      name: '',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [] as string[],
      isActive: true,
      maxStudents: 500,
      maxTeachers: 50,
      storageLimit: '5GB',
      supportLevel: 'Email',
      hasCustomDomain: false,
      hasWhiteLabel: false,
      hasApiAccess: false,
      hasAdvancedAnalytics: false,
      hasMobileApp: true,
      hasMultiCampus: false,
      hasAttendanceModule: true,
      hasExamModule: true,
      hasFeeManagement: true,
      hasParentPortal: true,
      hasSmsIntegration: false,
      hasLibraryManagement: false,
      hasInventoryManagement: false,
      hasTransportManagement: false,
      hasHostelManagement: false,
      hasPayrollManagement: false
    });
    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'subscription_plans'), (snapshot) => {
        const plansList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlans(plansList);
        setLoading(false);
      });
      return () => unsub();
    }, []);

    const handleDeleteClick = async (plan: any) => {
      setPlanToDelete(plan);
      // Check for schools using this plan
      const schoolsRef = collection(db, 'schools');
      const q = query(schoolsRef, where('planId', '==', plan.id));
      const snapshot = await getDocs(q);
      const schools = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchoolsInPlan(schools);
      setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
      if (!planToDelete) return;
      
      try {
        setIsMigrating(true);
        
        // 1. Migrate schools if any
        if (schoolsInPlan.length > 0) {
          if (!migrationPlanId) {
            toast.error("Please select a plan to migrate existing schools to.");
            setIsMigrating(false);
            return;
          }
          
          const batch = writeBatch(db);
          schoolsInPlan.forEach(school => {
            const schoolRef = doc(db, 'schools', school.id);
            batch.update(schoolRef, { planId: migrationPlanId });
          });
          await batch.commit();
          toast.success(`Migrated ${schoolsInPlan.length} schools to new plan.`);
        }

        // 2. Delete the plan
        await deleteDoc(doc(db, 'subscription_plans', planToDelete.id));
        toast.success("Subscription plan deleted successfully.");
        setIsDeleteModalOpen(false);
        setPlanToDelete(null);
        setSchoolsInPlan([]);
        setMigrationPlanId('');
      } catch (error) {
        console.error("Error deleting plan:", error);
        toast.error("Failed to delete plan.");
      } finally {
        setIsMigrating(false);
      }
    };

    const handleAddFeature = () => {
      if (newFeature.trim()) {
        setFormData(prev => ({
          ...prev,
          features: [...prev.features, newFeature.trim()]
        }));
        setNewFeature('');
      }
    };

    const handleRemoveFeature = (index: number) => {
      setFormData(prev => ({
        ...prev,
        features: prev.features.filter((_, i) => i !== index)
      }));
    };

    const resetForm = () => {
      setFormData({
        name: '',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: [],
        isActive: true,
        maxStudents: 500,
        maxTeachers: 50,
        storageLimit: '5GB',
        supportLevel: 'Email',
        hasCustomDomain: false,
        hasWhiteLabel: false,
        hasApiAccess: false,
        hasAdvancedAnalytics: false,
        hasMobileApp: true,
        hasMultiCampus: false,
        hasAttendanceModule: true,
        hasExamModule: true,
        hasFeeManagement: true,
        hasParentPortal: true,
        hasSmsIntegration: false,
        hasLibraryManagement: false,
        hasInventoryManagement: false,
        hasTransportManagement: false,
        hasHostelManagement: false,
        hasPayrollManagement: false
      });
    };

    const handleSavePlan = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const planId = editingPlan ? editingPlan.id : `plan_${Date.now()}`;
        const planData = {
          planId,
          ...formData,
          createdAt: editingPlan ? editingPlan.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'subscription_plans', planId), planData);
        toast.success(editingPlan ? 'Plan updated successfully' : 'New plan created');
        setIsModalOpen(false);
        setEditingPlan(null);
        resetForm();
      } catch (error) {
        console.error("Error saving plan:", error);
        toast.error('Failed to save plan');
      }
    };

    const togglePlanStatus = async (plan: any) => {
      try {
        await updateDoc(doc(db, 'subscription_plans', plan.id), {
          isActive: !plan.isActive
        });
        toast.success(`Plan ${plan.isActive ? 'deactivated' : 'activated'}`);
      } catch (error) {
        console.error("Error toggling plan status:", error);
        toast.error('Failed to toggle status');
      }
    };

    const openEditModal = (plan: any) => {
      setEditingPlan(plan);
      setFormData({
        name: plan.name || '',
        monthlyPrice: plan.monthlyPrice || 0,
        yearlyPrice: plan.yearlyPrice || 0,
        features: plan.features || [],
        isActive: plan.isActive !== undefined ? plan.isActive : true,
        maxStudents: plan.maxStudents || 500,
        maxTeachers: plan.maxTeachers || 50,
        storageLimit: plan.storageLimit || '5GB',
        supportLevel: plan.supportLevel || 'Email',
        hasCustomDomain: !!plan.hasCustomDomain,
        hasWhiteLabel: !!plan.hasWhiteLabel,
        hasApiAccess: !!plan.hasApiAccess,
        hasAdvancedAnalytics: !!plan.hasAdvancedAnalytics,
        hasMobileApp: !!plan.hasMobileApp,
        hasMultiCampus: !!plan.hasMultiCampus,
        hasAttendanceModule: !!plan.hasAttendanceModule,
        hasExamModule: !!plan.hasExamModule,
        hasFeeManagement: !!plan.hasFeeManagement,
        hasParentPortal: !!plan.hasParentPortal,
        hasSmsIntegration: !!plan.hasSmsIntegration,
        hasLibraryManagement: !!plan.hasLibraryManagement,
        hasInventoryManagement: !!plan.hasInventoryManagement,
        hasTransportManagement: !!plan.hasTransportManagement,
        hasHostelManagement: !!plan.hasHostelManagement,
        hasPayrollManagement: !!plan.hasPayrollManagement
      });
      setIsModalOpen(true);
    };

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Subscription Plans</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
              <Zap size={12} className="text-neon-blue" />
              Manage SaaS Pricing Tiers & Features
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-cyber-black p-1 rounded-2xl border border-white/5 shadow-inner">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billingCycle === 'monthly' ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.5)]' : 'text-gray-500 hover:text-white'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billingCycle === 'yearly' ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.5)]' : 'text-gray-500 hover:text-white'}`}
              >
                Yearly
              </button>
            </div>
            <button 
              onClick={() => {
                setEditingPlan(null);
                resetForm();
                setIsModalOpen(true);
              }}
              className="px-8 py-4 bg-neon-purple text-black font-black uppercase tracking-widest rounded-[20px] hover:shadow-[0_0_30px_rgba(188,19,254,0.6)] transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95"
            >
              <Plus size={20} /> Create New Plan
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-32 text-center">
            <div className="w-16 h-16 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-[0_0_20px_rgba(0,243,255,0.2)]"></div>
            <p className="text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Synchronizing Cloud Tiers...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {plans.map((plan) => (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -10 }}
                className={`relative bg-cyber-gray/40 backdrop-blur-xl p-10 rounded-[50px] border-2 transition-all group overflow-hidden ${plan.isActive ? 'border-white/5 hover:border-neon-blue/40 shadow-2xl hover:shadow-neon-blue/10' : 'border-red-500/20 grayscale opacity-40'}`}
              >
                {/* Decorative Background Element */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl group-hover:bg-neon-blue/10 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">{plan.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${plan.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className={`text-[8px] font-black uppercase tracking-widest ${plan.isActive ? 'text-green-400' : 'text-red-400'}`}>
                          {plan.isActive ? 'Active Tier' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-neon-blue tracking-tighter drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                          ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                        </span>
                        <span className="text-gray-500 text-xs font-bold">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <span className="text-[8px] font-black text-neon-purple uppercase tracking-widest mt-1">Save 20% Yearly</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Students</p>
                      <p className="text-lg font-black text-white">{plan.maxStudents}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Teachers</p>
                      <p className="text-lg font-black text-white">{plan.maxTeachers}</p>
                    </div>
                  </div>

                  <div className="space-y-6 mb-12">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Layers size={12} className="text-neon-purple" />
                      Core Features
                    </p>
                    <ul className="grid grid-cols-1 gap-4">
                      {plan.features?.slice(0, 6).map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-3 text-xs text-gray-300 font-semibold group/item">
                          <div className="p-1 bg-neon-blue/10 rounded-lg group-hover/item:bg-neon-blue/20 transition-colors">
                            <CheckCircle size={12} className="text-neon-blue" />
                          </div>
                          {feature}
                        </li>
                      ))}
                      {plan.features?.length > 6 && (
                        <li className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-8">
                          + {plan.features.length - 6} More Features
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex items-center gap-3">
                    <button 
                      onClick={() => openEditModal(plan)}
                      className="flex-1 py-4 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit3 size={16} /> Edit
                    </button>
                    <button 
                      onClick={() => togglePlanStatus(plan)}
                      className={`p-4 rounded-2xl border transition-all ${plan.isActive ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' : 'border-green-500/20 text-green-400 hover:bg-green-500/10'}`}
                      title={plan.isActive ? "Deactivate Plan" : "Activate Plan"}
                    >
                      {plan.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(plan)}
                      className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg hover:shadow-red-500/40"
                      title="Delete Plan"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                className="relative w-full max-w-4xl bg-cyber-gray p-10 rounded-[60px] border border-white/10 shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
                      {editingPlan ? 'Refine Tier' : 'Architect New Plan'}
                    </h2>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                      <Settings size={12} className="text-neon-purple" />
                      Configure Advanced SaaS Parameters
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white/5 rounded-2xl transition-colors group">
                    <X size={32} className="text-gray-500 group-hover:text-white transition-colors" />
                  </button>
                </div>

                <form onSubmit={handleSavePlan} className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Basic Info */}
                    <div className="md:col-span-3 space-y-6">
                      <h4 className="text-[10px] font-black text-neon-blue uppercase tracking-widest border-b border-white/5 pb-2">Identity & Pricing</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Plan Name</label>
                          <input 
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                            placeholder="e.g. Enterprise Elite"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Monthly Price ($)</label>
                          <div className="relative">
                            <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input 
                              required
                              type="number"
                              value={formData.monthlyPrice}
                              onChange={(e) => setFormData({...formData, monthlyPrice: Number(e.target.value)})}
                              className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] pl-14 pr-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Yearly Price ($)</label>
                          <div className="relative">
                            <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input 
                              required
                              type="number"
                              value={formData.yearlyPrice}
                              onChange={(e) => setFormData({...formData, yearlyPrice: Number(e.target.value)})}
                              className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] pl-14 pr-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="md:col-span-3 space-y-6">
                      <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-widest border-b border-white/5 pb-2">Capacity & Limits</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Max Students</label>
                          <input 
                            type="number"
                            value={formData.maxStudents}
                            onChange={(e) => setFormData({...formData, maxStudents: Number(e.target.value)})}
                            className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Max Teachers</label>
                          <input 
                            type="number"
                            value={formData.maxTeachers}
                            onChange={(e) => setFormData({...formData, maxTeachers: Number(e.target.value)})}
                            className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Storage</label>
                          <input 
                            type="text"
                            value={formData.storageLimit}
                            onChange={(e) => setFormData({...formData, storageLimit: e.target.value})}
                            className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-2">Support</label>
                          <select 
                            value={formData.supportLevel}
                            onChange={(e) => setFormData({...formData, supportLevel: e.target.value})}
                            className="w-full bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold appearance-none"
                          >
                            <option value="Email">Email Only</option>
                            <option value="Priority Email">Priority Email</option>
                            <option value="Chat & Email">Chat & Email</option>
                            <option value="24/7 Phone">24/7 Phone</option>
                            <option value="Dedicated Manager">Dedicated Manager</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Features Toggles */}
                    <div className="md:col-span-3 space-y-6">
                      <h4 className="text-[10px] font-black text-neon-blue uppercase tracking-widest border-b border-white/5 pb-2">Advanced Modules & Access</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { key: 'hasCustomDomain', label: 'Custom Domain' },
                          { key: 'hasWhiteLabel', label: 'White Label' },
                          { key: 'hasApiAccess', label: 'API Access' },
                          { key: 'hasAdvancedAnalytics', label: 'Advanced Analytics' },
                          { key: 'hasMobileApp', label: 'Mobile App' },
                          { key: 'hasMultiCampus', label: 'Multi Campus' },
                          { key: 'hasAttendanceModule', label: 'Attendance' },
                          { key: 'hasExamModule', label: 'Exams' },
                          { key: 'hasFeeManagement', label: 'Fee Mgmt' },
                          { key: 'hasParentPortal', label: 'Parent Portal' },
                          { key: 'hasSmsIntegration', label: 'SMS Integration' },
                          { key: 'hasLibraryManagement', label: 'Library' },
                          { key: 'hasInventoryManagement', label: 'Inventory' },
                          { key: 'hasTransportManagement', label: 'Transport' },
                          { key: 'hasHostelManagement', label: 'Hostel' },
                          { key: 'hasPayrollManagement', label: 'Payroll' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${formData[item.key as keyof typeof formData] ? 'bg-neon-blue/10 border-neon-blue/40 text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.1)]' : 'bg-white/5 border-white/5 text-gray-500'}`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                            {formData[item.key as keyof typeof formData] ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Features List */}
                    <div className="md:col-span-3 space-y-6">
                      <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-widest border-b border-white/5 pb-2">Custom Feature Tags</h4>
                      <div className="flex gap-4">
                        <input 
                          type="text"
                          value={newFeature}
                          onChange={(e) => setNewFeature(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                          className="flex-1 bg-cyber-black/50 border border-white/5 rounded-[24px] px-8 py-5 text-white outline-none focus:neon-border-blue transition-all font-bold"
                          placeholder="Add custom feature tag..."
                        />
                        <button 
                          type="button"
                          onClick={handleAddFeature}
                          className="px-8 py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-[24px] hover:bg-white/10 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {formData.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-neon-blue/10 border border-neon-blue/20 px-5 py-3 rounded-xl">
                            <span className="text-xs font-bold text-neon-blue">{feature}</span>
                            <button type="button" onClick={() => handleRemoveFeature(idx)} className="text-neon-blue hover:text-white transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-10 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-6 bg-white/5 text-gray-400 font-black uppercase tracking-widest rounded-[30px] hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-6 bg-neon-blue text-black font-black uppercase tracking-widest rounded-[30px] hover:shadow-[0_0_40px_rgba(0,243,255,0.6)] transition-all transform hover:-translate-y-1 active:scale-95"
                    >
                      {editingPlan ? 'Update Plan' : 'Deploy Plan'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-cyber-black/95 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-cyber-gray p-10 rounded-[50px] border border-red-500/30 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]"
              >
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-red-500/20">
                  <AlertTriangle size={48} className="text-red-500" />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Terminate Plan?</h3>
                
                {schoolsInPlan.length > 0 ? (
                  <div className="space-y-6 mb-8">
                    <p className="text-gray-400 text-sm font-medium leading-relaxed">
                      This plan is active for <span className="text-neon-purple font-black">{schoolsInPlan.length} schools</span>. You must reassign them to a new plan before deletion.
                    </p>
                    <div className="space-y-3 text-left">
                      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Target Migration Plan</label>
                      <select 
                        value={migrationPlanId}
                        onChange={(e) => setMigrationPlanId(e.target.value)}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:neon-border-purple transition-all font-bold appearance-none"
                      >
                        <option value="">Select replacement plan...</option>
                        {plans.filter(p => p.id !== planToDelete?.id && p.isActive).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm font-medium mb-10 leading-relaxed">
                    You are about to permanently delete <span className="text-white font-black">{planToDelete?.name}</span>. This action is irreversible.
                  </p>
                )}

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={confirmDelete}
                    disabled={isMigrating || (schoolsInPlan.length > 0 && !migrationPlanId)}
                    className="w-full py-5 bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 shadow-xl hover:shadow-red-500/40 transition-all disabled:opacity-50"
                  >
                    {isMigrating ? 'Processing...' : schoolsInPlan.length > 0 ? 'Reassign & Delete' : 'Confirm Termination'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setPlanToDelete(null);
                      setSchoolsInPlan([]);
                      setMigrationPlanId('');
                    }}
                    className="w-full py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-2xl hover:text-white transition-all"
                  >
                    Abort
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const LicenseKeysManager = () => {
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Generation Form State
    const [genForm, setGenForm] = useState({
      plan_id: 'basic',
      duration: '30',
      count: 1
    });

    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'license_keys'), (snapshot) => {
        const keysList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setKeys(keysList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      });
      return () => unsub();
    }, []);

    const handleGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsGenerating(true);
      try {
        const response = await fetch('/api/admin/generate-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: genForm.plan_id,
            duration_days: Number(genForm.duration),
            count: genForm.count
          })
        });
        
        if (response.ok) {
          setGenForm({ ...genForm, count: 1 });
        }
      } catch (error) {
        console.error("Error generating keys:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    const revokeKey = async (keyId: string) => {
      try {
        await updateDoc(doc(db, 'license_keys', keyId), {
          status: 'revoked'
        });
      } catch (error) {
        console.error("Error revoking key:", error);
      }
    };

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      // Could add a toast here
    };

    const filteredKeys = keys.filter(k => filter === 'all' || k.status === filter);

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">License Management</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Manual Sales & Reseller Keys</p>
          </div>
        </div>

        {/* Generation Panel */}
        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[40px] border border-white/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-neon-blue/10 rounded-2xl border border-neon-blue/20">
              <KeyIcon className="text-neon-blue" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-white">Generate New Keys</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Create secure batch licenses</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-2">Plan Type</label>
              <select 
                value={genForm.plan_id}
                onChange={(e) => setGenForm({...genForm, plan_id: e.target.value})}
                className="w-full bg-cyber-black/50 border border-white/5 rounded-2xl px-6 py-4 text-white outline-none focus:neon-border-blue transition-all appearance-none"
              >
                <option value="basic">Basic Plan</option>
                <option value="pro">Pro Plan</option>
                <option value="enterprise">Enterprise Plan</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-2">Duration</label>
              <select 
                value={genForm.duration}
                onChange={(e) => setGenForm({...genForm, duration: e.target.value})}
                className="w-full bg-cyber-black/50 border border-white/5 rounded-2xl px-6 py-4 text-white outline-none focus:neon-border-blue transition-all appearance-none"
              >
                <option value="15">15-Day Extension</option>
                <option value="30">1 Month</option>
                <option value="180">6 Months</option>
                <option value="365">1 Year</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-2">Batch Count</label>
              <input 
                type="number"
                min="1"
                max="100"
                value={genForm.count}
                onChange={(e) => setGenForm({...genForm, count: Number(e.target.value)})}
                className="w-full bg-cyber-black/50 border border-white/5 rounded-2xl px-6 py-4 text-white outline-none focus:neon-border-blue transition-all"
              />
            </div>
            <button 
              disabled={isGenerating}
              type="submit"
              className="w-full py-4 bg-neon-blue text-black font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_20px_#00f3ff] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
              Generate Key(s)
            </button>
          </form>
        </div>

        {/* Inventory Table */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-cyber-black p-1 rounded-xl border border-white/5">
              {['all', 'unused', 'active', 'revoked'].map((s) => (
                <button 
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === s ? 'bg-neon-purple text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Search keys..." 
                className="pl-10 pr-4 py-2 bg-cyber-black/50 border border-white/5 rounded-xl text-xs outline-none focus:neon-border-blue transition-all w-full md:w-64"
              />
            </div>
          </div>

          <div className="bg-cyber-gray/40 backdrop-blur-md rounded-[40px] border border-white/5 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyber-black/50 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">License Key</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Plan / Duration</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Assigned School</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Created</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <RefreshCw className="animate-spin text-neon-blue mx-auto mb-4" size={32} />
                      <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Fetching Inventory...</p>
                    </td>
                  </tr>
                ) : filteredKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">
                          {k.status === 'unused' ? k.key : `${k.key.substring(0, 11)}****-****`}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(k.key)}
                          className="p-1.5 text-gray-500 hover:text-neon-blue transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <CopyIcon size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-white uppercase">{k.plan_id}</p>
                      <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest">{k.duration_days} Days</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        k.status === 'unused' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        k.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        k.status === 'revoked' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-400">{k.school_id || '--'}</p>
                      {k.activated_at && <p className="text-[8px] text-gray-600 uppercase">{new Date(k.activated_at).toLocaleDateString()}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-gray-500 font-bold">{new Date(k.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {k.status !== 'revoked' && (
                          <button 
                            onClick={() => revokeKey(k.id)}
                            className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                            title="Revoke Key"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        <button className="p-2 text-gray-500 hover:text-white transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- Server Health & Infrastructure ---

  /**
   * Hook for School Admins to fetch active announcements
   */
  const AuditLogsModule = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
      dateRange: '7d',
      actionType: 'all',
      actorSearch: '',
      resourceFilter: 'all'
    });
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    useEffect(() => {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
        setLogs(logList);
        setLoading(false);
      });

      return () => unsubscribe();
    }, []);

    const filteredLogs = logs.filter(log => {
      const matchesAction = filters.actionType === 'all' || log.action_type === filters.actionType;
      const matchesResource = filters.resourceFilter === 'all' || log.resource === filters.resourceFilter;
      const matchesActor = log.actor_email.toLowerCase().includes(filters.actorSearch.toLowerCase());
      
      const logDate = log.timestamp.toDate();
      const now = new Date();
      let matchesDate = true;
      if (filters.dateRange === '7d') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        matchesDate = logDate >= sevenDaysAgo;
      } else if (filters.dateRange === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        matchesDate = logDate >= thirtyDaysAgo;
      }

      return matchesAction && matchesResource && matchesActor && matchesDate;
    });

    const exportToCSV = () => {
      const headers = ['Timestamp', 'Actor', 'Action', 'Resource', 'Details', 'IP Address'];
      const rows = filteredLogs.map(log => [
        log.timestamp.toDate().toLocaleString(),
        log.actor_email,
        log.action_type,
        log.resource,
        log.details.replace(/"/g, '""'),
        log.ip_address
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${new Date().toISOString()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const criticalAlertsCount = logs.filter(log => 
      (log.action_type === 'DELETE' || log.action_type === 'REVOKE') && 
      log.timestamp.toMillis() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Actions Logged</h3>
              <p className="text-3xl font-black text-white tracking-tighter">{logs.length.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-neon-blue/10 border border-neon-blue/20 text-neon-blue">
              <History size={24} />
            </div>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Critical Alerts (24h)</h3>
              <p className="text-3xl font-black text-red-500 tracking-tighter">{criticalAlertsCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
              <ShieldAlert size={24} />
            </div>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Actor Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search by email..." 
                  className="w-full pl-10 pr-4 py-2 bg-cyber-black/50 border border-white/10 rounded-xl focus:neon-border-blue outline-none text-xs"
                  value={filters.actorSearch}
                  onChange={(e) => setFilters({...filters, actorSearch: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Action Type</label>
              <select 
                className="bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:neon-border-blue"
                value={filters.actionType}
                onChange={(e) => setFilters({...filters, actionType: e.target.value})}
              >
                <option value="all">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
                <option value="SYSTEM">SYSTEM</option>
                <option value="REVOKE">REVOKE</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Resource</label>
              <select 
                className="bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:neon-border-blue"
                value={filters.resourceFilter}
                onChange={(e) => setFilters({...filters, resourceFilter: e.target.value})}
              >
                <option value="all">All Modules</option>
                <option value="Schools">Schools</option>
                <option value="Users">Users</option>
                <option value="Billing">Billing</option>
                <option value="Settings">Settings</option>
                <option value="Roles">Roles</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Timeframe</label>
              <select 
                className="bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:neon-border-blue"
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <button 
              onClick={exportToCSV}
              className="px-6 py-2 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-neon-blue transition-all flex items-center gap-2"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyber-black/50 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Actor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Action</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Resource</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-neon-blue mb-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Decrypting Audit Trail...</span>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">No activity logs found</span>
                    </td>
                  </tr>
                ) : filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock size={12} className="text-gray-600" />
                          {log.timestamp.toDate().toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-white">{log.actor_email}</p>
                        <p className="text-[8px] text-gray-600 font-mono tracking-tighter">{log.actor_uid}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                          log.action_type === 'CREATE' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          log.action_type === 'UPDATE' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          log.action_type === 'DELETE' || log.action_type === 'REVOKE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-300">{log.resource}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-gray-500">{log.ip_address}</span>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedRow === log.id && (
                        <tr>
                          <td colSpan={5} className="px-6 py-0">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="py-6 border-t border-white/5">
                                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Change Details (JSON Payload)</h5>
                                <pre className="bg-cyber-black/50 p-4 rounded-xl border border-white/10 text-[10px] font-mono text-neon-blue overflow-x-auto">
                                  {log.details}
                                </pre>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const useServerMetrics = () => {
    const [metrics, setMetrics] = useState({
      cpu: 45,
      ram: 12.4,
      storage: 68.2,
      uptime: 99.98,
      traffic: Array.from({ length: 20 }, (_, i) => ({ time: i, requests: Math.floor(Math.random() * 500) + 200 })),
      services: [
        { name: 'Firebase Auth', status: 'online', latency: 42 },
        { name: 'Payment Gateway', status: 'online', latency: 115 },
        { name: 'SMTP Service', status: 'online', latency: 78 },
        { name: 'Cloud Storage', status: 'online', latency: 55 }
      ]
    });

    useEffect(() => {
      const interval = setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          cpu: Math.min(100, Math.max(0, prev.cpu + (Math.random() * 10 - 5))),
          ram: Math.min(32, Math.max(8, prev.ram + (Math.random() * 0.4 - 0.2))),
          traffic: [...prev.traffic.slice(1), { time: Date.now(), requests: Math.floor(Math.random() * 500) + 200 }],
          services: prev.services.map(s => ({ ...s, latency: Math.max(20, s.latency + Math.floor(Math.random() * 10 - 5)) }))
        }));
      }, 3000);
      return () => clearInterval(interval);
    }, []);

    return metrics;
  };

  const ServerHealthDashboard = () => {
    const metrics = useServerMetrics();
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(settings.isMaintenanceMode || false);

    const toggleMaintenanceMode = async () => {
      if (confirmText !== 'CONFIRM') return;
      try {
        const newStatus = !isMaintenanceMode;
        await updateDoc(doc(db, 'settings', 'global'), { isMaintenanceMode: newStatus });
        setIsMaintenanceMode(newStatus);
        setIsMaintenanceModalOpen(false);
        setConfirmText('');
      } catch (error) {
        console.error("Error toggling maintenance mode:", error);
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Top Status Banner */}
        <div className={`p-6 rounded-3xl border backdrop-blur-xl flex flex-col md:flex-row justify-between items-center gap-6 transition-all duration-500 ${
          metrics.cpu > 85 ? 'bg-red-500/10 border-red-500/30 neon-shadow-red' : 'bg-green-500/10 border-green-500/30 neon-shadow-green'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${metrics.cpu > 85 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {metrics.cpu > 85 ? <ShieldAlert size={32} /> : <CheckCircle2 size={32} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                {metrics.cpu > 85 ? 'Degraded Performance' : 'All Systems Operational'}
              </h2>
              <p className="text-xs font-bold text-gray-500 tracking-widest uppercase">System Uptime: <span className="text-neon-blue">{metrics.uptime}%</span></p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Last Deployment</p>
              <p className="text-white font-bold text-sm">2 hours ago</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Active Nodes</p>
              <p className="text-white font-bold text-sm">12 / 12</p>
            </div>
          </div>
        </div>

        {/* Live Resource Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'CPU Usage', value: Math.round(metrics.cpu), unit: '%', icon: Cpu, color: metrics.cpu > 85 ? 'text-red-500' : 'text-neon-blue', max: 100 },
            { label: 'RAM Allocation', value: metrics.ram.toFixed(1), unit: 'GB', icon: HardDrive, color: 'text-neon-purple', max: 32 },
            { label: 'DB Storage', value: metrics.storage, unit: '%', icon: Database, color: 'text-yellow-500', max: 100 }
          ].map((gauge, i) => (
            <div key={i} className="bg-cyber-gray/50 border border-white/10 p-8 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all">
              <div className="relative z-10 flex flex-col items-center">
                <div className={`p-3 rounded-xl bg-white/5 mb-6 ${gauge.color}`}>
                  <gauge.icon size={24} />
                </div>
                <div className="relative w-32 h-32 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                    <circle 
                      cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                      strokeDasharray={364.4} 
                      strokeDashoffset={364.4 - (364.4 * Number(gauge.value)) / gauge.max}
                      className={`${gauge.color} transition-all duration-1000 ease-out`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{gauge.value}</span>
                    <span className="text-[10px] text-gray-500 font-black uppercase">{gauge.unit}</span>
                  </div>
                </div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{gauge.label}</h3>
              </div>
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 blur-[60px] opacity-20 ${gauge.color.replace('text-', 'bg-')}`} />
            </div>
          ))}
        </div>

        {/* Real-Time Traffic Graph */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-cyber-gray/50 border border-white/10 p-8 rounded-3xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Active API Traffic</h3>
                <p className="text-xs font-bold text-gray-500 tracking-widest uppercase">Requests per minute (Live)</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 border border-neon-blue/20 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
                <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">Live Stream</span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.traffic}>
                  <defs>
                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#00f3ff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="#00f3ff" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Microservices Status */}
          <div className="bg-cyber-gray/50 border border-white/10 p-8 rounded-3xl">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Microservices</h3>
            <div className="space-y-4">
              {metrics.services.map((service, i) => (
                <div key={i} className="p-4 rounded-2xl bg-cyber-black/50 border border-white/5 flex justify-between items-center group hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-tight">{service.name}</p>
                      <p className="text-[10px] text-gray-600 font-bold uppercase">Latency: {service.latency}ms</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                    Online
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5">
              <h4 className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-4">Quick Actions</h4>
              <div className="space-y-3">
                <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="text-neon-blue" /> Clear Global Cache
                </button>
                <button 
                  onClick={() => setIsMaintenanceModalOpen(true)}
                  className={`w-full py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    isMaintenanceMode 
                      ? 'bg-red-500 text-white border-red-600' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'
                  }`}
                >
                  <ShieldAlert size={14} /> {isMaintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Mode Modal */}
        <AnimatePresence>
          {isMaintenanceModalOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-cyber-gray border border-red-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-6 animate-pulse">
                    <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Critical Action</h2>
                  <p className="text-gray-400 text-sm mb-8">
                    Enabling maintenance mode will redirect all users to a maintenance screen. Only Super Admins will be able to access the platform.
                  </p>
                  
                  <div className="w-full space-y-4">
                    <div className="text-left">
                      <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-2 block">Type "CONFIRM" to proceed</label>
                      <input 
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                        placeholder="CONFIRM"
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-white font-black tracking-widest focus:border-red-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsMaintenanceModalOpen(false)}
                        className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Abort
                      </button>
                      <button 
                        onClick={toggleMaintenanceMode}
                        disabled={confirmText !== 'CONFIRM'}
                        className="flex-1 py-4 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const BackupRestoreDashboard = () => {
    const [backups, setBackups] = useState<BackupHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<BackupHistory | null>(null);
    const [restoreConfirm, setRestoreConfirm] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);

    const [backupSettings, setBackupSettings] = useState(settings.backupSettings || {
      automatedBackups: true,
      retentionDays: 30,
      storageRegion: 'us-central1'
    });

    useEffect(() => {
      const q = query(collection(db, 'backups_history'), orderBy('timestamp', 'desc'), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackupHistory));
        setBackups(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

    const runManualBackup = async () => {
      setIsBackingUp(true);
      try {
        const response = await fetch('/api/admin/backup/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminUid: userProfile?.uid })
        });
        const result = await response.json();
        if (result.success) {
          // Toast or message
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Backup failed:", error);
        alert("Backup failed. Check logs.");
      } finally {
        setIsBackingUp(false);
      }
    };

    const handleRestore = async () => {
      if (restoreConfirm !== 'RESTORE-CONFIRM' || !selectedBackup) return;
      setIsRestoring(true);
      try {
        const response = await fetch('/api/admin/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            backupId: selectedBackup.id, 
            adminUid: userProfile?.uid,
            confirmCode: restoreConfirm
          })
        });
        const result = await response.json();
        if (result.success) {
          alert("System restored successfully. The page will reload.");
          window.location.reload();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Restore failed:", error);
        alert("Restore failed. Check logs.");
      } finally {
        setIsRestoring(false);
        setIsRestoreModalOpen(false);
        setRestoreConfirm('');
      }
    };

    const saveSettings = async () => {
      try {
        await updateDoc(doc(db, 'settings', 'global'), { backupSettings });
        setIsSettingsOpen(false);
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    };

    const lastBackup = backups.find(b => b.status === 'completed');
    const totalStorage = backups.reduce((acc, b) => acc + (b.size || 0), 0) / (1024 * 1024 * 1024); // GB

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Last Successful Backup', value: lastBackup ? new Date(lastBackup.timestamp).toLocaleString() : 'Never', icon: CheckCircle2, color: 'text-green-400' },
            { label: 'Total Storage Used', value: `${totalStorage.toFixed(2)} GB`, icon: HardDrive, color: 'text-neon-blue' },
            { label: 'Next Scheduled', value: 'Today, 02:00 AM', icon: Clock, color: 'text-neon-purple' },
            { label: 'Backup Health', value: 'Healthy', icon: ShieldCheck, color: 'text-green-400' }
          ].map((card, i) => (
            <div key={i} className="bg-cyber-gray/50 border border-white/10 p-6 rounded-3xl neon-shadow-subtle">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-white/5 ${card.color}`}>
                  <card.icon size={20} />
                </div>
              </div>
              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">{card.label}</p>
              <h3 className="text-lg font-black text-white">{card.value}</h3>
            </div>
          ))}
        </div>

        {/* Action Panel */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-cyber-gray/30 border border-white/5 p-8 rounded-3xl">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Backup Control Center</h2>
            <p className="text-xs font-bold text-gray-500 tracking-widest uppercase">Manage system snapshots and disaster recovery</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Settings size={14} /> Settings
            </button>
            <button 
              onClick={runManualBackup}
              disabled={isBackingUp}
              className={`px-8 py-3 rounded-xl bg-neon-blue text-black text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isBackingUp ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_20px_rgba(0,243,255,0.5)]'}`}
            >
              {isBackingUp ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
              {isBackingUp ? 'Backing Up...' : 'Run Manual Backup'}
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-cyber-gray/50 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Snapshot History</h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <History size={12} /> {backups.length} Snapshots
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Backup ID</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date & Time</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Size</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={6} className="px-8 py-20 text-center text-gray-500 font-bold uppercase tracking-widest">Fetching history...</td></tr>
                ) : backups.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-20 text-center text-gray-500 font-bold uppercase tracking-widest">No backups found</td></tr>
                ) : backups.map((b) => (
                  <tr key={b.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-4">
                      <span className="text-xs font-mono text-neon-blue font-bold">{b.id}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-xs text-white font-bold">{new Date(b.timestamp).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-xs text-gray-400">{(b.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${b.type === 'manual' ? 'bg-neon-purple/10 text-neon-purple' : 'bg-neon-blue/10 text-neon-blue'}`}>
                        {b.type}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${b.status === 'completed' ? 'bg-green-500' : b.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{b.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => window.open(b.fileUrl, '_blank')}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                          title="Download JSON"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          onClick={() => { setSelectedBackup(b); setIsRestoreModalOpen(true); }}
                          className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                          title="Restore from this backup"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-cyber-gray border border-white/10 rounded-3xl p-8 shadow-2xl"
              >
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Backup Configuration</h2>
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-tight">Automated Daily Backups</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Runs every night at 02:00 AM</p>
                    </div>
                    <button 
                      onClick={() => setBackupSettings(prev => ({ ...prev, automatedBackups: !prev.automatedBackups }))}
                      className={`w-12 h-6 rounded-full transition-all relative ${backupSettings.automatedBackups ? 'bg-neon-blue' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${backupSettings.automatedBackups ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Retention Period (Days)</label>
                    <input 
                      type="number"
                      value={backupSettings.retentionDays}
                      onChange={(e) => setBackupSettings(prev => ({ ...prev, retentionDays: Number(e.target.value) }))}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-neon-blue transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Storage Region</label>
                    <select 
                      value={backupSettings.storageRegion}
                      onChange={(e) => setBackupSettings(prev => ({ ...prev, storageRegion: e.target.value }))}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-neon-blue transition-all appearance-none"
                    >
                      <option value="us-central1">US Central (Iowa)</option>
                      <option value="europe-west1">Europe West (Belgium)</option>
                      <option value="asia-east1">Asia East (Taiwan)</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                    <button onClick={saveSettings} className="flex-1 py-4 rounded-xl bg-neon-blue text-black text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.5)] transition-all">Save Changes</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Restore Confirmation Modal */}
        <AnimatePresence>
          {isRestoreModalOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => !isRestoring && setIsRestoreModalOpen(false)}
                className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-cyber-gray border border-red-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-6 animate-pulse">
                    <RotateCcw size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Critical Restore</h2>
                  <p className="text-gray-400 text-sm mb-8">
                    You are about to restore the system to the state of <span className="text-white font-bold">{selectedBackup ? new Date(selectedBackup.timestamp).toLocaleString() : ''}</span>. 
                    <br/><br/>
                    <span className="text-red-400 font-black uppercase tracking-widest">Warning:</span> All current data will be overwritten. This action is irreversible.
                  </p>
                  
                  <div className="w-full space-y-4">
                    <div className="text-left">
                      <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-2 block">Type "RESTORE-CONFIRM" to proceed</label>
                      <input 
                        type="text"
                        value={restoreConfirm}
                        onChange={(e) => setRestoreConfirm(e.target.value.toUpperCase())}
                        placeholder="RESTORE-CONFIRM"
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-white font-black tracking-widest focus:border-red-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsRestoreModalOpen(false)}
                        disabled={isRestoring}
                        className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Abort
                      </button>
                      <button 
                        onClick={handleRestore}
                        disabled={restoreConfirm !== 'RESTORE-CONFIRM' || isRestoring}
                        className="flex-1 py-4 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Execute Restore'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const GlobalUsersDirectory = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [schoolFilter, setSchoolFilter] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState({
      total: 0,
      admins: 0,
      teachers: 0,
      students: 0
    });
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'reset' | 'ban', user: UserProfile } | null>(null);

    const fetchUsers = async (isNextPage = false) => {
      setLoading(true);
      try {
        let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));

        if (roleFilter !== 'all') {
          q = query(q, where('role', '==', roleFilter));
        }
        if (schoolFilter) {
          q = query(q, where('schoolId', '==', schoolFilter));
        }
        
        if (isNextPage && lastDoc) {
          q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const fetchedUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
        
        if (isNextPage) {
          setUsers(prev => [...prev, ...fetchedUsers]);
        } else {
          setUsers(fetchedUsers);
        }

        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 50);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchUsers();
      // Fetch stats (simplified for demo, in real app use cloud functions or aggregation)
      const fetchStats = async () => {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const all = snap.docs.map(d => d.data() as UserProfile);
        setStats({
          total: all.length,
          admins: all.filter(u => u.role === 'school_admin').length,
          teachers: all.filter(u => u.role === 'teacher').length,
          students: all.filter(u => u.role === 'student').length
        });
      };
      fetchStats();
    }, [roleFilter, schoolFilter]);

    const exportToCSV = () => {
      const headers = ['Name', 'Email', 'Phone', 'Role', 'School ID', 'Status', 'Joined Date'];
      const rows = users.map(u => [
        u.name,
        u.email,
        u.phone || 'N/A',
        u.role,
        u.schoolId || 'N/A',
        u.status,
        new Date(u.createdAt).toLocaleDateString()
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `edupak_users_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const suspendUser = async (userId: string) => {
      try {
        await updateDoc(doc(db, 'users', userId), { status: 'suspended' });
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: 'suspended' } : u));
        setIsConfirmModalOpen(false);
      } catch (error) {
        console.error("Error suspending user:", error);
      }
    };

    const resetPassword = async (email: string) => {
      try {
        await sendPasswordResetEmail(auth, email);
        alert(`Password reset email sent to ${email}`);
        setIsConfirmModalOpen(false);
      } catch (error) {
        console.error("Error resetting password:", error);
      }
    };

    const banUser = async (userId: string) => {
      try {
        await updateDoc(doc(db, 'users', userId), { status: 'banned' });
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, status: 'banned' } : u));
        setIsConfirmModalOpen(false);
      } catch (error) {
        console.error("Error banning user:", error);
      }
    };

    const confirmActionHandler = () => {
      if (!confirmAction) return;
      if (confirmAction.type === 'suspend') suspendUser(confirmAction.user.uid);
      else if (confirmAction.type === 'ban') banUser(confirmAction.user.uid);
      else resetPassword(confirmAction.user.email);
    };

    const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm))
    );

    return (
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-400' },
            { label: 'School Admins', value: stats.admins, icon: ShieldCheck, color: 'text-purple-400' },
            { label: 'Teachers', value: stats.teachers, icon: GraduationCap, color: 'text-green-400' },
            { label: 'Students', value: stats.students, icon: BookOpen, color: 'text-cyan-400' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-neon-blue/30 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-cyber-black/50 border border-white/5 ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
              </div>
              <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</h3>
              <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text"
                  placeholder="Search by Name, Email, or Phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
                />
              </div>
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-cyber-black/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
              >
                <option value="all">All Roles</option>
                <option value="school_admin">School Admins</option>
                <option value="teacher">Teachers</option>
                <option value="student">Students</option>
                <option value="parent">Parents</option>
              </select>
              <input 
                type="text"
                placeholder="School ID..."
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="bg-cyber-black/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-neon-blue/50 transition-all w-32"
              />
            </div>
            <NeonButton onClick={exportToCSV} variant="blue" className="w-full lg:w-auto">
              <FileDown size={18} className="mr-2" />
              Export CSV
            </NeonButton>
          </div>
        </div>

        {/* Table */}
        <div className="bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User Info</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">School</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Joined Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="w-10 h-10 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Loading Users...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No users found</p>
                    </td>
                  </tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-white/10 flex items-center justify-center text-neon-blue font-black uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{u.name}</p>
                          <p className="text-[10px] text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        u.role === 'school_admin' ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20' :
                        u.role === 'teacher' ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20' :
                        u.role === 'student' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-400">{u.schoolId || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        u.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        u.status === 'suspended' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        u.status === 'banned' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-gray-500 font-bold">{new Date(u.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedUser(u); setIsDrawerOpen(true); }}
                          className="p-2 text-gray-500 hover:text-neon-blue transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <div className="relative group/menu">
                          <button className="p-2 text-gray-500 hover:text-white transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                          <div className="absolute right-0 top-full mt-2 w-48 bg-cyber-gray border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 overflow-hidden">
                            <button 
                              onClick={() => { setConfirmAction({ type: 'reset', user: u }); setIsConfirmModalOpen(true); }}
                              className="w-full px-4 py-3 text-left text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white flex items-center gap-2"
                            >
                              <RefreshCw size={14} />
                              Reset Password
                            </button>
                            {u.status !== 'suspended' && (
                              <button 
                                onClick={() => { setConfirmAction({ type: 'suspend', user: u }); setIsConfirmModalOpen(true); }}
                                className="w-full px-4 py-3 text-left text-xs font-bold text-yellow-400 hover:bg-yellow-400/10 flex items-center gap-2"
                              >
                                <Ban size={14} />
                                Suspend User
                              </button>
                            )}
                            {u.status !== 'banned' && (
                              <button 
                                onClick={() => { setConfirmAction({ type: 'ban', user: u }); setIsConfirmModalOpen(true); }}
                                className="w-full px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                              >
                                <UserX size={14} />
                                Ban User
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
              Showing {filteredUsers.length} Users
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={loading}
                className="p-2 text-gray-500 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => fetchUsers(true)}
                disabled={!hasMore || loading}
                className="p-2 text-gray-500 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* User Details Drawer */}
        <AnimatePresence>
          {isDrawerOpen && selectedUser && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-cyber-black/80 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-cyber-gray border-l border-white/10 z-[70] p-8 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">User Details</h2>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-white/10 flex items-center justify-center text-neon-blue text-4xl font-black uppercase shadow-[0_0_30px_rgba(0,243,255,0.1)]">
                      {selectedUser.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedUser.name}</h3>
                      <p className="text-neon-blue font-bold text-sm">{selectedUser.role.replace('_', ' ')}</p>
                      <span className={`mt-2 inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        selectedUser.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Email Address</p>
                      <p className="text-white font-bold">{selectedUser.email}</p>
                    </div>
                    <div className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Phone Number</p>
                      <p className="text-white font-bold">{selectedUser.phone || 'Not Provided'}</p>
                    </div>
                    <div className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">School ID</p>
                      <p className="text-neon-purple font-mono font-bold">{selectedUser.schoolId || 'N/A'}</p>
                    </div>
                    <div className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Joined Date</p>
                      <p className="text-white font-bold">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {selectedUser.role === 'parent' && (
                    <div className="bg-neon-blue/5 p-6 rounded-2xl border border-neon-blue/20">
                      <h4 className="text-xs font-black text-neon-blue uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users size={14} /> Linked Students
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Student ID:</span>
                          <span className="text-white font-mono">{selectedUser.studentId || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-6 flex flex-col gap-4">
                    <NeonButton onClick={() => { setConfirmAction({ type: 'reset', user: selectedUser }); setIsConfirmModalOpen(true); }} variant="blue" className="w-full">
                      <RefreshCw size={18} className="mr-2" />
                      Reset Password
                    </NeonButton>
                    <NeonButton onClick={() => { setConfirmAction({ type: 'suspend', user: selectedUser }); setIsConfirmModalOpen(true); }} variant="purple" className="w-full">
                      <Ban size={18} className="mr-2" />
                      Suspend Account
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {isConfirmModalOpen && confirmAction && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsConfirmModalOpen(false)}
                className="fixed inset-0 bg-cyber-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-cyber-gray p-8 rounded-3xl neon-border-purple max-w-md w-full relative z-10 text-center"
              >
                <div className="w-20 h-20 bg-neon-purple/10 rounded-full flex items-center justify-center mx-auto mb-6 neon-border-purple">
                  <AlertTriangle className="text-neon-purple" size={40} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Confirm Action</h3>
                <p className="text-gray-500 text-sm mb-8">
                  Are you sure you want to {confirmAction.type === 'suspend' ? 'suspend' : 'reset the password for'} <strong>{confirmAction.user.name}</strong>?
                  {confirmAction.type === 'suspend' && " This user will be immediately logged out and blocked from access."}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmActionHandler}
                    className="flex-1 py-3 rounded-xl bg-neon-purple text-white text-xs font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(191,0,255,0.5)] transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const SuperAdminRolesManagement = () => {
    const [activeSubTab, setActiveSubTab] = useState<'staff' | 'roles'>('staff');
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', password: '', role: '', name: '' });
    const [newRoleData, setNewRoleData] = useState<AdminRole>({
      id: '',
      role_name: '',
      permissions: {
        schools: [],
        billing: [],
        health: [],
        backup: [],
        users: []
      }
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
      const staffUnsub = onSnapshot(
        query(collection(db, 'users'), where('role', '!=', 'student'), where('role', '!=', 'teacher'), where('role', '!=', 'parent')),
        (snap) => {
          setStaff(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
        }
      );

      const rolesUnsub = onSnapshot(collection(db, 'admin_roles'), (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AdminRole)));
        setLoading(false);
      });

      return () => {
        staffUnsub();
        rolesUnsub();
      };
    }, []);

    const handleInviteStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError('');
      try {
        const response = await fetch('/api/admin/invite-staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...inviteData, adminUid: userProfile.uid })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setIsInviteModalOpen(false);
        setInviteData({ email: '', password: '', role: '', name: '' });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoleData.role_name) return;
      setSubmitting(true);
      setError('');
      try {
        const roleId = newRoleData.role_name.toLowerCase().replace(/\s+/g, '_');
        await setDoc(doc(db, 'admin_roles', roleId), { ...newRoleData, id: roleId });
        setIsRoleModalOpen(false);
        setNewRoleData({
          id: '',
          role_name: '',
          permissions: {
            schools: [],
            billing: [],
            health: [],
            backup: [],
            users: []
          }
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    const togglePermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete') => {
      setNewRoleData(prev => {
        const current = prev.permissions[module] || [];
        const updated = current.includes(action) 
          ? current.filter(a => a !== action)
          : [...current, action];
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [module]: updated
          }
        };
      });
    };

    const modules = [
      { id: 'schools', label: 'Schools Directory' },
      { id: 'billing', label: 'Revenue & Billing' },
      { id: 'health', label: 'Server Health' },
      { id: 'backup', label: 'Backup & Restore' },
      { id: 'users', label: 'Global Users' },
      { id: 'announcements', label: 'Global Announcements' }
    ];

    const actions: ('view' | 'create' | 'edit' | 'delete')[] = ['view', 'create', 'edit', 'delete'];

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Staff & RBAC Control</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Manage administrative access and custom roles</p>
          </div>
          <div className="flex bg-cyber-gray/50 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveSubTab('staff')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'staff' ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'}`}
            >
              Staff Directory
            </button>
            <button 
              onClick={() => setActiveSubTab('roles')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'roles' ? 'bg-neon-blue text-black' : 'text-gray-500 hover:text-white'}`}
            >
              Roles & Permissions
            </button>
          </div>
        </div>

        {activeSubTab === 'staff' ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-neon-blue text-black px-6 py-2 rounded-xl flex items-center gap-2 hover:shadow-[0_0_20px_#00f3ff] transition-all font-black uppercase tracking-widest text-[10px]"
              >
                <Plus size={16} />
                Invite New Staff
              </button>
            </div>

            <div className="bg-cyber-gray/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-cyber-black/50 border-b border-white/5">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Name</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Email</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Role</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Last Active</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {staff.map((member) => (
                      <tr key={member.uid} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-white">{member.name}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">{member.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${member.role === 'super_admin' ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/20' : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'}`}>
                            {member.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {member.lastActive ? member.lastActive.toDate().toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${member.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {member.email !== 'admin@mobihut.pk' ? (
                            <div className="flex gap-2">
                              <button className="p-2 text-gray-500 hover:text-neon-blue transition-colors"><Edit3 size={16} /></button>
                              <button className="p-2 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          ) : (
                            <Shield size={16} className="text-neon-purple opacity-50 ml-2" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Custom Roles</h3>
                <button onClick={() => setIsRoleModalOpen(true)} className="p-1 text-neon-blue hover:neon-text-blue transition-all"><Plus size={18} /></button>
              </div>
              {roles.map(role => (
                <button 
                  key={role.id}
                  onClick={() => setNewRoleData(role)}
                  className={`w-full text-left p-4 bg-cyber-gray/40 border rounded-2xl hover:neon-border-blue transition-all group ${newRoleData.id === role.id ? 'neon-border-blue' : 'border-white/5'}`}
                >
                  <p className="text-sm font-bold text-white group-hover:text-neon-blue transition-colors">{role.role_name}</p>
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                    {Object.values(role.permissions).flat().length} Permissions Active
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-3 bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Permissions Matrix</h3>
                <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest bg-neon-blue/10 px-3 py-1 rounded-full border border-neon-blue/20">Enterprise Grade RBAC</span>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-5 gap-4 border-b border-white/5 pb-4">
                  <div className="col-span-1 text-[10px] font-black text-gray-600 uppercase tracking-widest">Module</div>
                  {actions.map(a => (
                    <div key={a} className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">{a}</div>
                  ))}
                </div>

                {modules.map(mod => (
                  <div key={mod.id} className="grid grid-cols-5 gap-4 items-center py-4 border-b border-white/5 last:border-0 group">
                    <div className="col-span-1">
                      <p className="text-sm font-bold text-white group-hover:text-neon-blue transition-colors">{mod.label}</p>
                    </div>
                    {actions.map(action => (
                      <div key={action} className="flex justify-center">
                        <button 
                          onClick={() => togglePermission(mod.id, action)}
                          className={`w-6 h-6 rounded-md border transition-all flex items-center justify-center ${
                            newRoleData.permissions[mod.id]?.includes(action)
                            ? 'bg-neon-blue border-neon-blue text-black shadow-[0_0_10px_#00f3ff]'
                            : 'bg-cyber-black border-white/10 text-transparent hover:border-neon-blue/50'
                          }`}
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
                <NeonButton onClick={handleCreateRole} loading={submitting} className="max-w-xs">Save Role Configuration</NeonButton>
              </div>
            </div>
          </div>
        )}

        {/* Invite Staff Modal */}
        <AnimatePresence>
          {isInviteModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-md">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Invite New Staff</h3>
                <form onSubmit={handleInviteStaff} className="space-y-4">
                  <NeonInput icon={UserIcon} placeholder="Full Name" required value={inviteData.name} onChange={(e: any) => setInviteData({...inviteData, name: e.target.value})} />
                  <NeonInput icon={Mail} type="email" placeholder="Email Address" required value={inviteData.email} onChange={(e: any) => setInviteData({...inviteData, email: e.target.value})} />
                  <NeonInput icon={Lock} type="password" placeholder="Temporary Password" required value={inviteData.password} onChange={(e: any) => setInviteData({...inviteData, password: e.target.value})} />
                  <select 
                    required 
                    value={inviteData.role} 
                    onChange={(e) => setInviteData({...inviteData, role: e.target.value})}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:neon-border-blue outline-none transition-all"
                  >
                    <option value="" disabled>Select Role</option>
                    <option value="super_admin">Super Admin</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                  </select>
                  {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                  <NeonButton type="submit" loading={submitting}>Send Invitation</NeonButton>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Create Role Modal */}
        <AnimatePresence>
          {isRoleModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRoleModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-3xl neon-border-purple w-full max-w-md">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Create Custom Role</h3>
                <div className="space-y-6">
                  <NeonInput icon={ShieldCheck} placeholder="Role Name (e.g. Billing Manager)" required value={newRoleData.role_name} onChange={(e: any) => setNewRoleData({...newRoleData, role_name: e.target.value})} />
                  <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed">
                    Once created, you can configure granular permissions in the matrix view.
                  </p>
                  <NeonButton onClick={() => setIsRoleModalOpen(false)} variant="purple">Initialize Role</NeonButton>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // --- School Admin Portal Components ---
  const SchoolDashboardOverview = ({ schoolId }: { schoolId: string }) => {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 neon-border-indigo/20">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-neon-indigo/10 rounded-xl border border-neon-indigo/20">
                <Users className="text-neon-indigo" size={24} />
              </div>
              <span className="text-[10px] font-black text-neon-indigo uppercase tracking-widest">Live</span>
            </div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">1,248</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Total Students</p>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                <CheckCircle className="text-green-400" size={24} />
              </div>
              <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">94%</span>
            </div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">1,173</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Today's Attendance</p>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <DollarSign className="text-red-400" size={24} />
              </div>
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Pending</span>
            </div>
            <p className="text-3xl font-black text-white uppercase tracking-tighter">PKR 450K</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Pending Fees</p>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Recent Admissions</h3>
          <div className="text-center py-12">
            <GraduationCap className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No recent admissions found for this session</p>
          </div>
        </div>
      </div>
    );
  };

  const StudentManagement = ({ schoolId }: { schoolId: string }) => {
    const [isAdmissionWizardOpen, setIsAdmissionWizardOpen] = useState(false);
    const [isIDCardGeneratorOpen, setIsIDCardGeneratorOpen] = useState(false);

    if (isAdmissionWizardOpen) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">New Admission</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Register a new student to your institution</p>
            </div>
            <button 
              onClick={() => setIsAdmissionWizardOpen(false)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-gray-400 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <StudentAdmissionWizard 
            schoolId={schoolId} 
            onSuccess={() => setIsAdmissionWizardOpen(false)}
            onCancel={() => setIsAdmissionWizardOpen(false)}
          />
        </div>
      );
    }

    if (isIDCardGeneratorOpen) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">ID Card Generator</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Batch generate and print student identification cards</p>
            </div>
            <button 
              onClick={() => setIsIDCardGeneratorOpen(false)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-gray-400 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <IDCardGenerator schoolId={schoolId} />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Student Management</h2>
          <button 
            onClick={() => setIsAdmissionWizardOpen(true)}
            className="bg-neon-indigo text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all active:scale-95"
          >
            <UserPlus size={16} /> New Admission
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 text-center group hover:neon-border-indigo/20 transition-all cursor-pointer">
            <div className="w-16 h-16 bg-neon-indigo/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Users className="text-neon-indigo" size={32} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Student Directory</h3>
            <p className="text-gray-500 text-xs font-medium">View and manage all enrolled students.</p>
          </div>
          <div 
            onClick={() => setIsIDCardGeneratorOpen(true)}
            className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 text-center group hover:neon-border-indigo/20 transition-all cursor-pointer"
          >
            <div className="w-16 h-16 bg-neon-indigo/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <IdCard className="text-neon-indigo" size={32} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">ID Cards</h3>
            <p className="text-gray-500 text-xs font-medium">Generate and print student identification cards.</p>
          </div>
          <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 text-center group hover:neon-border-indigo/20 transition-all cursor-pointer">
            <div className="w-16 h-16 bg-neon-indigo/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <TrendingUp className="text-neon-indigo" size={32} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Promotions</h3>
            <p className="text-gray-500 text-xs font-medium">Promote students to the next academic session.</p>
          </div>
        </div>

        <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-[2.5rem] border border-white/5 text-center">
          <GraduationCap className="mx-auto text-gray-800 mb-6" size={80} />
          <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">No Students Found</h3>
          <p className="text-gray-500 max-w-md mx-auto font-medium mb-8">Start by adding your first student to the system using the "New Admission" button above.</p>
          <button 
            onClick={() => setIsAdmissionWizardOpen(true)}
            className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/10 transition-all"
          >
            Add First Student
          </button>
        </div>
      </div>
    );
  };

  const HRTeachersManagement = ({ schoolId }: { schoolId: string }) => (
    <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 text-center">
      <Users className="mx-auto text-neon-indigo mb-6" size={64} />
      <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">HR & Teachers</h3>
      <p className="text-gray-400 max-w-md mx-auto font-medium">Manage teacher profiles, attendance, and salary disbursements.</p>
    </div>
  );

  const AcademicClassesManagement = ({ schoolId }: { schoolId: string }) => (
    <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 text-center">
      <BookOpen className="mx-auto text-neon-indigo mb-6" size={64} />
      <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Academic & Classes</h3>
      <p className="text-gray-400 max-w-md mx-auto font-medium">Configure timetables, syllabus, and class sections.</p>
    </div>
  );

  const FeeCollectionManagement = ({ schoolId }: { schoolId: string }) => (
    <FeeCollectionModule schoolId={schoolId} />
  );

  const ExamsResultsManagement = ({ schoolId }: { schoolId: string }) => (
    <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 text-center">
      <FileText className="mx-auto text-neon-indigo mb-6" size={64} />
      <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Examinations & Results</h3>
      <p className="text-gray-400 max-w-md mx-auto font-medium">Schedule exams, enter marks, and generate report cards.</p>
    </div>
  );

  const CommunicationModule = ({ schoolId }: { schoolId: string }) => (
    <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 text-center">
      <Megaphone className="mx-auto text-neon-indigo mb-6" size={64} />
      <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Communication</h3>
      <p className="text-gray-400 max-w-md mx-auto font-medium">Send SMS, Emails, and App notifications to parents and staff.</p>
    </div>
  );

  const SchoolSettingsModule = ({ schoolId }: { schoolId: string }) => (
    <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 text-center">
      <Settings className="mx-auto text-neon-indigo mb-6" size={64} />
      <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">School Settings</h3>
      <p className="text-gray-400 max-w-md mx-auto font-medium">Configure school profile, session dates, and portal branding.</p>
    </div>
  );

  const SuperAdminProfile = () => {
    const [formData, setFormData] = useState({
      name: userProfile.name || '',
      email: userProfile.email || '',
      password: '',
      confirmPassword: '',
      secretPin: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (formData.secretPin !== '2233') {
        setError('INVALID SECRET PIN. ACCESS DENIED.');
        return;
      }

      if (formData.password && formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('No user authenticated');

        // Update Email if changed
        if (formData.email !== currentUser.email) {
          await updateEmail(currentUser, formData.email);
        }

        // Update Password if provided
        if (formData.password) {
          await updatePassword(currentUser, formData.password);
        }

        // Update Firestore Profile
        await updateDoc(doc(db, 'users', currentUser.uid), {
          name: formData.name,
          email: formData.email,
          updatedAt: Timestamp.now()
        });

        await createAuditLog('UPDATE', 'Profile', `Super Admin updated their profile: ${formData.email}`);
        toast.success('Profile updated successfully');
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '', secretPin: '' }));
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Super Admin Profile</h2>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Update your global administrative credentials</p>
        </div>

        <form onSubmit={handleUpdate} className="bg-cyber-gray/40 backdrop-blur-md rounded-3xl border border-white/5 p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
              <NeonInput 
                icon={UserIcon} 
                required 
                placeholder="Admin Name" 
                value={formData.name} 
                onChange={(e: any) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
              <NeonInput 
                icon={Mail} 
                type="email" 
                required 
                placeholder="admin@example.com" 
                value={formData.email} 
                onChange={(e: any) => setFormData({...formData, email: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New Password (Optional)</label>
              <NeonInput 
                icon={Lock} 
                type="password" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={(e: any) => setFormData({...formData, password: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm Password</label>
              <NeonInput 
                icon={Lock} 
                type="password" 
                placeholder="••••••••" 
                value={formData.confirmPassword} 
                onChange={(e: any) => setFormData({...formData, confirmPassword: e.target.value})} 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <div className="space-y-2 max-w-xs">
              <label className="text-[10px] font-black text-neon-blue uppercase tracking-widest ml-1 flex items-center gap-2">
                <Shield size={12} />
                Security PIN Required
              </label>
              <NeonInput 
                icon={Key} 
                type="password" 
                required 
                placeholder="Enter 2233" 
                value={formData.secretPin} 
                onChange={(e: any) => setFormData({...formData, secretPin: e.target.value})} 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neon-blue transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50"
          >
            {loading ? 'Updating Credentials...' : 'Update Global Profile'}
          </button>
        </form>
      </div>
    );
  };

  const renderContent = () => {
    // Placeholder for all 14 tabs
    const tabLabels: Record<string, string> = {};
    menuCategories.forEach(cat => cat.items.forEach(item => tabLabels[item.id] = item.label));

    if (activeTab === 'overview') {
      if (userProfile.role === 'school_admin') {
        return <SchoolDashboardOverview schoolId={userProfile.schoolId!} />;
      }
      if (userProfile.role === 'teacher') {
        return <TeacherPortalDashboard userProfile={userProfile} />;
      }
      if (userProfile.role === 'parent') {
        return <ParentPortalDashboard parentUid={userProfile.uid} parentName={userProfile.name} />;
      }
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Schools', value: '124', trend: '+12%', icon: Building2, color: 'text-blue-400' },
              { label: 'Active Students', value: '45,210', trend: '+8%', icon: Users, color: 'text-purple-400' },
              { label: 'Monthly Revenue', value: '$84,200', trend: '+15%', icon: DollarSign, color: 'text-green-400' },
              { label: 'System Health', value: '99.9%', trend: 'Stable', icon: Activity, color: 'text-cyan-400' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-neon-blue/30 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-cyber-black/50 border border-white/5 ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full bg-cyber-black/50 ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-blue-400'}`}>
                    {stat.trend}
                  </span>
                </div>
                <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</h3>
                <p className="text-3xl font-black text-white tracking-tighter">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Growth Analytics</h3>
                <TrendingUp className="text-neon-blue" size={20} />
              </div>
              <div className="h-64 flex items-end justify-between gap-2 px-4">
                {[40, 70, 45, 90, 65, 80, 50, 95, 75, 85, 60, 100].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.05 }}
                    className="flex-1 bg-gradient-to-t from-neon-blue/20 to-neon-blue rounded-t-sm relative group"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-cyber-black text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {h}%
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                <span>Jan</span><span>Mar</span><span>Jun</span><span>Sep</span><span>Dec</span>
              </div>
            </div>

            <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5">
              <h3 className="text-lg font-black uppercase tracking-widest text-white mb-6">Recent Activity</h3>
              <div className="space-y-6">
                {[
                  { user: 'Beaconhouse School', action: 'Renewed License', time: '2h ago', icon: Key },
                  { user: 'City School', action: 'New Onboarding', time: '5h ago', icon: Building2 },
                  { user: 'Admin', action: 'System Backup', time: '12h ago', icon: Database },
                  { user: 'Support', action: 'Ticket Resolved', time: '1d ago', icon: LifeBuoy },
                ].map((act, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyber-black/50 flex items-center justify-center border border-white/5 text-neon-purple">
                      <act.icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{act.user}</p>
                      <p className="text-xs text-gray-500">{act.action}</p>
                      <p className="text-[10px] text-gray-600 mt-1 uppercase font-black">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'profile' && userProfile.role === 'super_admin') {
      return <SuperAdminProfile />;
    }

    if (activeTab === 'schools') {
      if (!hasPermission('schools', 'view')) return <PermissionDenied />;
      return <SchoolsDirectory />;
    }

    if (activeTab === 'admin_roles') {
      if (!hasPermission('admin_roles', 'view')) return <PermissionDenied />;
      return <SuperAdminRolesManagement />;
    }

    if (activeTab === 'plans') {
      if (!hasPermission('plans', 'view')) return <PermissionDenied />;
      return <SubscriptionPlansManager />;
    }

    if (activeTab === 'licenses') {
      if (!hasPermission('licenses', 'view')) return <PermissionDenied />;
      return <LicenseKeysManager />;
    }

    if (activeTab === 'billing') {
      if (!hasPermission('billing', 'view')) return <PermissionDenied />;
      return <RevenueBilling />;
    }

    if (activeTab === 'global_users') {
      if (!hasPermission('users', 'view')) return <PermissionDenied />;
      return <GlobalUsersDirectory />;
    }

    if (activeTab === 'health') {
      if (!hasPermission('health', 'view')) return <PermissionDenied />;
      return <ServerHealthDashboard />;
    }

    if (activeTab === 'backup') {
      if (!hasPermission('backup', 'view')) return <PermissionDenied />;
      return <BackupRestoreDashboard />;
    }

    if (activeTab === 'tickets') {
      if (!hasPermission('tickets', 'view')) return <PermissionDenied />;
      return <SupportHelpdesk />;
    }

    if (activeTab === 'announcements') {
      if (!hasPermission('announcements', 'view')) return <PermissionDenied />;
      return <GlobalAnnouncementsModule />;
    }

    if (activeTab === 'audit_logs') {
      if (!hasPermission('audit_logs', 'view')) return <PermissionDenied />;
      return <AuditLogsModule />;
    }

    if (activeTab === 'global_settings') {
      if (!hasPermission('settings', 'view')) return <PermissionDenied />;
      return <GlobalSettingsModule />;
    }

    if (activeTab === 'students') {
      return <StudentManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'attendance') {
      return <StudentAttendanceModule schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'leave_approval' && userProfile.role === 'school_admin') {
      return <AdminLeaveApprovalModule schoolId={userProfile.schoolId!} adminName={userProfile.name} />;
    }

    if (activeTab === 'teachers' && userProfile.role === 'school_admin') {
      return <TeacherHRManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'academics') {
      return <AcademicClassesManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'fees') {
      return <FeeCollectionManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'exams') {
      return <ExamsResultsManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'timetable') {
      return <TimetableBuilder />;
    }

    if (activeTab === 'communication') {
      return <CommunicationModule schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'school_settings') {
      return <SchoolSettingsModule schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'hr_payroll') {
      return <TeacherHRManagement schoolId={userProfile.schoolId!} />;
    }

    if (activeTab === 'teachers') {
      return <TeacherHRManagement schoolId={userProfile.schoolId!} />;
    }

    return (
      <div className="bg-cyber-gray/40 backdrop-blur-md p-12 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-neon-blue/5 rounded-full flex items-center justify-center mb-8 border border-neon-blue/20">
          <Clock className="text-neon-blue animate-pulse" size={48} />
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">
          {tabLabels[activeTab]} Module
        </h3>
        <p className="text-gray-500 text-sm max-w-md leading-relaxed">
          The enterprise <span className="text-neon-blue font-bold">{tabLabels[activeTab]}</span> system is currently being provisioned for your SaaS instance. Full functionality will be available in the next deployment cycle.
        </p>
        <div className="mt-8 flex gap-4">
          <div className="px-4 py-2 bg-cyber-black/50 rounded-lg border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            Status: Development
          </div>
          <div className="px-4 py-2 bg-cyber-black/50 rounded-lg border border-white/5 text-[10px] font-black uppercase tracking-widest text-neon-blue">
            Priority: High
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-cyber-black flex flex-col text-white selection:bg-neon-blue selection:text-black">
      <AnimatePresence>
        {isPasswordResetModalOpen && <PasswordResetModal />}
        {selectedTeacherForIdCard && <TeacherIDCardModal />}
        {selectedAnnouncement && (
          <AnnouncementDetailModal 
            announcement={selectedAnnouncement} 
            onClose={() => setSelectedAnnouncement(null)} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-20 bg-cyber-gray/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 md:hidden text-gray-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`${userProfile.role === 'school_admin' ? 'bg-neon-indigo/10 border-neon-indigo/20' : 'bg-neon-blue/10 border-neon-blue/20'} p-2 rounded-xl border`}>
              <GraduationCap size={28} className={userProfile.role === 'school_admin' ? 'text-neon-indigo' : 'text-neon-blue'} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter leading-none">
                Edu<span className={userProfile.role === 'school_admin' ? 'text-neon-indigo' : 'text-neon-blue'}>Pak</span>
              </h1>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 leading-none mt-1">
                {userProfile.role === 'school_admin' && school ? school.name : 'Enterprise'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <NotificationBell />
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-sm font-black text-white tracking-tight">{userProfile.name || 'Administrator'}</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{userProfile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple p-[1px] cursor-pointer group relative" onClick={() => setIsPasswordResetModalOpen(true)}>
            <div className="w-full h-full bg-cyber-black rounded-[11px] flex items-center justify-center group-hover:bg-white/5 transition-all">
              <UserIcon size={20} className="text-white" />
            </div>
            <div className="absolute -bottom-12 right-0 bg-cyber-gray border border-white/10 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
              Change Password
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-gray-500 hover:text-red-400 transition-all hover:bg-red-400/10 rounded-xl"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 w-72 bg-cyber-gray/50 backdrop-blur-xl border-r border-white/5 
          z-40 transition-transform duration-300 transform 
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 flex flex-col
        `}>
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
            {menuCategories.map((category, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="px-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">
                  {category.category}
                </h4>
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group
                        ${activeTab === item.id 
                          ? (userProfile.role === 'school_admin' ? 'bg-neon-indigo text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-neon-blue text-black shadow-[0_0_20px_rgba(0,243,255,0.3)]')
                          : 'text-gray-500 hover:text-white hover:bg-white/5'}
                      `}
                    >
                      <item.icon size={18} className={activeTab === item.id ? (userProfile.role === 'school_admin' ? 'text-white' : 'text-black') : (userProfile.role === 'school_admin' ? 'group-hover:text-neon-indigo' : 'group-hover:text-neon-blue') + ' transition-colors'} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-white/5">
            <div className="bg-cyber-black/50 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <Server size={14} className="text-neon-purple" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Server Status</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase">
                  <span className="text-gray-500">CPU LOAD</span>
                  <span className="text-neon-blue">24%</span>
                </div>
                <div className="h-1 bg-cyber-gray rounded-full overflow-hidden">
                  <div className="h-full w-[24%] bg-neon-blue" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[radial-gradient(circle_at_50%_0%,_#111111_0%,_#050505_100%)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div>
                <div className={`flex items-center gap-2 ${userProfile.role === 'school_admin' ? 'text-neon-indigo' : 'text-neon-blue'} mb-2`}>
                  <Globe size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                    {userProfile.role === 'school_admin' ? 'School Management System' : 'Global Infrastructure'}
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
                  {activeTab.replace('_', ' ')}
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-cyber-gray/50 rounded-xl border border-white/5">
                  <Clock size={14} className="text-gray-500" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {userProfile.role === 'super_admin' && (
                  <button className="bg-white text-black px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-neon-blue transition-all font-black uppercase tracking-widest text-[10px] shadow-lg">
                    <Plus size={16} />
                    Quick Action
                  </button>
                )}
              </div>
            </div>

            {renderContent()}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="h-16 bg-cyber-gray/80 backdrop-blur-xl border-t border-white/5 px-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-gray-600">
          <span>DEVELOP BY</span>
          <span className="text-gray-400 hover:text-neon-blue transition-colors cursor-pointer">MOBIHUT</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-neon-blue" />
            <span>ISO 27001 CERTIFIED</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-green-500" />
            <span>ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-black text-gray-500">
            <Phone size={12} className="text-neon-purple" />
            <span className="tracking-widest">+92 304 1478644</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>({ footerText: 'Develop by MoBiHuT', footerPhone: '+92 304 1478644', isMaintenanceMode: false });
  const [loading, setLoading] = useState(true);

  // Initialize GA4
  useEffect(() => {
    initGA();
  }, []);

  // Track Pageviews
  useEffect(() => {
    // Since we are not using a traditional router for navigation in this specific App structure,
    // we track the initial load. If you add react-router-dom, use useLocation() here.
    trackPageView(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let schoolUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (profileUnsubscribe) { profileUnsubscribe(); profileUnsubscribe = null; }
      if (schoolUnsubscribe) { schoolUnsubscribe(); schoolUnsubscribe = null; }

      if (firebaseUser) {
        profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const profile = snapshot.data() as UserProfile;
            
            if (profile.status === 'suspended' || profile.status === 'banned') {
              signOut(auth);
              setUserProfile(null);
              setLoading(false);
              return;
            }

            setUserProfile(profile);
            
            // If user belongs to a school, track school license status
            if (profile.schoolId && profile.role !== 'super_admin') {
              if (schoolUnsubscribe) schoolUnsubscribe();
              schoolUnsubscribe = onSnapshot(doc(db, 'schools', profile.schoolId), (schoolSnap) => {
                if (schoolSnap.exists()) {
                  setSchool(schoolSnap.data() as School);
                }
              }, (error) => {
                console.error("School snapshot error:", error);
              });
            }
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setSchool(null);
        setLoading(false);
      }
    });

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          footerText: data.footerText || 'Develop by MoBiHuT',
          footerPhone: data.footerPhone || '+92 304 1478644',
          isMaintenanceMode: data.isMaintenanceMode || false
        });
      }
    }, (error) => {
      console.error("Settings snapshot error:", error);
    });

    const globalConfigUnsubscribe = onSnapshot(doc(db, 'settings', 'global_config'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as GlobalConfig);
      }
    }, (error) => {
      console.error("Global config snapshot error:", error);
    });

    return () => { 
      authUnsubscribe(); 
      if (profileUnsubscribe) profileUnsubscribe();
      if (schoolUnsubscribe) schoolUnsubscribe();
      settingsUnsubscribe(); 
      globalConfigUnsubscribe();
    };
  }, []);

  // Global License Check
  const isLicenseExpired = () => {
    if (!school || !school.licenseExpiryDate || userProfile?.role === 'super_admin') return false;
    try {
      const now = Timestamp.now().toMillis();
      const expiry = school.licenseExpiryDate.toMillis();
      return now > expiry;
    } catch (e) {
      console.error("License check error:", e);
      return false;
    }
  };

  if (!isSplashComplete) return <SplashScreen onComplete={() => setIsSplashComplete(true)} />;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-cyber-black"><div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#00f3ff]" /></div>;
  
  if (!user) {
    if (showOnboarding) {
      return (
        <SchoolOnboardingWizard 
          onComplete={(schoolId) => {
            setShowOnboarding(false);
            setShowAuth(false);
          }} 
          onBackToLogin={() => {
            setShowOnboarding(false);
            setShowAuth(true);
          }} 
        />
      );
    }
    if (showAuth) {
      return (
        <AuthScreen 
          onLoginSuccess={(u) => setUser(u)} 
          onBack={() => setShowAuth(false)} 
          onOnboarding={() => setShowOnboarding(true)}
        />
      );
    }
    return <LandingPage onLoginClick={() => setShowAuth(true)} />;
  }
  
  if (isLicenseExpired()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4">
        <div className="bg-cyber-gray p-10 rounded-3xl neon-border-purple max-w-md w-full text-center">
          <div className="w-20 h-20 bg-neon-purple/10 rounded-full flex items-center justify-center mx-auto mb-8 neon-border-purple animate-pulse">
            <AlertTriangle className="text-neon-purple" size={40} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Trial Expired</h2>
          <p className="text-gray-500 text-sm mb-10 leading-relaxed">
            Your school's access period has ended. Please contact your Super Admin to renew your license and continue using EduPak.
          </p>
          <div className="flex flex-col gap-4">
            <div className="bg-cyber-black p-4 rounded-xl border border-white/5">
              <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">School ID</p>
              <p className="text-neon-blue font-mono font-bold">{school?.id}</p>
            </div>
            <NeonButton onClick={() => signOut(auth)} variant="purple">Sign Out</NeonButton>
          </div>
        </div>
      </div>
    );
  }

  if (userProfile?.isForcedResetRequired) return <ForcedResetScreen userProfile={userProfile} onComplete={() => {}} />;
  
  if (settings.isMaintenanceMode && userProfile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4 text-center">
        <div className="bg-cyber-gray p-10 rounded-3xl border border-red-500/30 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20 animate-pulse">
            <Settings className="text-red-500" size={48} />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">System Upgrade</h2>
          <p className="text-gray-500 text-sm mb-10 leading-relaxed">
            EduPak is currently undergoing a scheduled maintenance and infrastructure upgrade to improve your experience. We'll be back online shortly.
          </p>
          <div className="bg-cyber-black p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
              <span>Status</span>
              <span className="text-red-500">Maintenance Mode</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-1/3 h-full bg-red-500"
              />
            </div>
            <p className="text-[9px] text-gray-700 font-bold uppercase tracking-[0.2em]">Estimated Completion: 45 Minutes</p>
          </div>
          <div className="mt-8">
            <NeonButton onClick={() => signOut(auth)} variant="purple">Sign Out</NeonButton>
          </div>
        </div>
      </div>
    );
  }

  if (user && !userProfile && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4 text-center">
        <div className="bg-cyber-gray p-8 rounded-2xl neon-border-purple max-w-md w-full">
          <div className="w-16 h-16 bg-neon-purple/10 rounded-full flex items-center justify-center mx-auto mb-6 neon-border-purple/20">
            <UserIcon className="text-neon-purple" size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">User profile not found</h2>
          <p className="text-gray-500 text-sm mb-8">Please contact support to initialize your account access.</p>
          <NeonButton onClick={() => signOut(auth)} variant="purple">
            Return to Login
          </NeonButton>
        </div>
      </div>
    );
  }

  if (userProfile) return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <Dashboard userProfile={userProfile} settings={settings} school={school} />
    </>
  );

  return null;
}
