import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Users, 
  Lock, 
  Key, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Globe, 
  Activity, 
  Smartphone, 
  AlertCircle,
  ChevronRight,
  Plus,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  History,
  Terminal,
  ShieldAlert,
  Fingerprint,
  Briefcase,
  GraduationCap,
  CreditCard,
  FileText,
  Package,
  Truck,
  Home,
  MessageSquare,
  Settings
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
  Timestamp,
  orderBy,
  limit,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';

// --- Types ---

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

interface RolePermissions {
  [module: string]: Permission;
}

interface AdminRole {
  id: string;
  role_name: string;
  permissions: RolePermissions;
  school_id: string;
  createdAt?: any;
}

interface StaffMember {
  uid: string;
  email: string;
  name: string;
  role: string; // Primary role
  roles?: string[]; // Multi-role support
  status: 'active' | 'suspended' | 'inactive';
  lastActive?: any;
  lastLoginIp?: string;
  schoolId: string;
}

interface AccessLog {
  id: string;
  staffId: string;
  staffName: string;
  module: string;
  action: string;
  timestamp: any;
  ip: string;
}

// --- Constants ---

const MODULES = [
  { id: 'students', label: 'Student Management', icon: Users },
  { id: 'attendance', label: 'Attendance Tracker', icon: CheckCircle2 },
  { id: 'teachers', label: 'HR & Teachers', icon: Briefcase },
  { id: 'academics', label: 'Academic Setup', icon: GraduationCap },
  { id: 'fees', label: 'Fee Collection', icon: CreditCard },
  { id: 'exams', label: 'Exams & Results', icon: FileText },
  { id: 'inventory', label: 'Inventory Management', icon: Package },
  { id: 'transport', label: 'Transport Fleet', icon: Truck },
  { id: 'hostel', label: 'Hostel Data', icon: Home },
  { id: 'communication', label: 'Bulk SMS/WhatsApp', icon: MessageSquare },
  { id: 'settings', label: 'School Settings', icon: Settings },
];

// --- Components ---

const SchoolAdminRolesManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'roles' | 'logs'>('staff');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [newRoleName, setNewRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});

  useEffect(() => {
    if (!schoolId) return;

    // Fetch Staff
    const staffUnsub = onSnapshot(
      query(collection(db, 'users'), where('schoolId', '==', schoolId)),
      (snap) => {
        setStaff(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as StaffMember)));
      }
    );

    // Fetch Roles
    const rolesUnsub = onSnapshot(
      query(collection(db, 'admin_roles'), where('school_id', '==', schoolId)),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AdminRole)));
        setLoading(false);
      }
    );

    // Fetch Access Logs
    const logsUnsub = onSnapshot(
      query(collection(db, 'access_logs'), where('schoolId', '==', schoolId), orderBy('timestamp', 'desc'), limit(20)),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as AccessLog)));
      }
    );

    return () => {
      staffUnsub();
      rolesUnsub();
      logsUnsub();
    };
  }, [schoolId]);

  const handleTogglePermission = (module: string, action: keyof Permission) => {
    setRolePermissions(prev => ({
      ...prev,
      [module]: {
        ...(prev[module] || { view: false, create: false, edit: false, delete: false }),
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const handleSaveRole = async () => {
    if (!newRoleName) return toast.error("Role name is required");
    setSubmitting(true);
    try {
      const roleData = {
        role_name: newRoleName,
        permissions: rolePermissions,
        school_id: schoolId,
        updatedAt: serverTimestamp()
      };

      if (selectedRole) {
        await updateDoc(doc(db, 'admin_roles', selectedRole.id), roleData);
        toast.success("Role updated successfully");
      } else {
        await addDoc(collection(db, 'admin_roles'), {
          ...roleData,
          createdAt: serverTimestamp()
        });
        toast.success("New role created");
      }
      setIsRoleModalOpen(false);
      resetRoleForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetRoleForm = () => {
    setNewRoleName('');
    setRolePermissions({});
    setSelectedRole(null);
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await updateDoc(doc(db, 'users', staffId), { status: newStatus });
      toast.success(`Staff ${newStatus === 'active' ? 'activated' : 'suspended'}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAssignRole = async (staffId: string, roleName: string) => {
    try {
      await updateDoc(doc(db, 'users', staffId), { role: roleName });
      toast.success("Role assigned successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4"
          >
            <Shield className="text-neon-blue" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-blue">Advanced Access Control System</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Role <span className="text-neon-blue">Management.</span>
          </h2>
        </div>

        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => { resetRoleForm(); setIsRoleModalOpen(true); }}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Create New Role
          </button>
          <button 
            className="px-8 py-3 bg-neon-blue text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all flex items-center gap-2"
          >
            <UserPlus size={16} />
            Invite Staff
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'staff', label: 'Staff Directory', icon: Users },
          { id: 'roles', label: 'Role Definitions', icon: ShieldAlert },
          { id: 'logs', label: 'Security Logs', icon: History },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-neon-blue text-black border-neon-blue shadow-[0_0_20px_rgba(0,243,255,0.3)]' 
                : 'bg-cyber-gray/40 text-gray-500 border-white/5 hover:border-white/10'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'staff' && (
          <motion.div 
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((member) => (
                <div key={member.uid} className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 group hover:border-neon-blue/30 transition-all relative overflow-hidden">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 flex items-center justify-center border border-white/10">
                        <Fingerprint className="text-neon-blue" size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">{member.name}</h3>
                        <p className="text-[10px] font-bold text-gray-500 truncate max-w-[150px]">{member.email}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                      member.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {member.status}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Assigned Role</label>
                      <select 
                        value={member.role}
                        onChange={(e) => handleAssignRole(member.uid, e.target.value)}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-neon-blue/50"
                      >
                        <option value="">Select Role</option>
                        {roles.map(r => <option key={r.id} value={r.role_name}>{r.role_name}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Last Active</span>
                        <span className="text-[10px] font-bold text-gray-400">
                          {member.lastActive ? new Date(member.lastActive.seconds * 1000).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleToggleStaffStatus(member.uid, member.status)}
                          className={`p-2 rounded-xl transition-all ${
                            member.status === 'active' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                          }`}
                          title={member.status === 'active' ? 'Suspend Access' : 'Activate Access'}
                        >
                          {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button className="p-2 bg-white/5 text-gray-500 rounded-xl hover:text-white transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'roles' && (
          <motion.div 
            key="roles"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {roles.map((role) => (
              <div key={role.id} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 group hover:border-neon-purple/30 transition-all">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
                    <Shield className="text-neon-purple" size={28} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setSelectedRole(role);
                        setNewRoleName(role.role_name);
                        setRolePermissions(role.permissions);
                        setIsRoleModalOpen(true);
                      }}
                      className="p-2 bg-white/5 text-gray-500 rounded-xl hover:text-neon-blue transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button className="p-2 bg-white/5 text-gray-500 rounded-xl hover:text-red-400 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{role.role_name}</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">
                  {Object.keys(role.permissions).length} Modules Accessible
                </p>

                <div className="space-y-2">
                  {Object.entries(role.permissions).slice(0, 3).map(([mod, perms]) => (
                    <div key={mod} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
                      <span>{mod}</span>
                      <div className="flex gap-1">
                        {perms.view && <span className="text-neon-blue">V</span>}
                        {perms.create && <span className="text-green-500">C</span>}
                        {perms.edit && <span className="text-yellow-500">E</span>}
                        {perms.delete && <span className="text-red-500">D</span>}
                      </div>
                    </div>
                  ))}
                  {Object.keys(role.permissions).length > 3 && (
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest pt-2">
                      + {Object.keys(role.permissions).length - 3} more modules
                    </p>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div 
            key="logs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Security & Access Logs</h3>
              <button className="text-neon-blue text-[10px] font-black uppercase tracking-widest hover:underline">Export Logs</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Staff Member</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Module</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Action</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">IP Address</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-8 py-4">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">{log.staffName}</p>
                        <p className="text-[8px] text-gray-600 font-mono">{log.staffId}</p>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">{log.module}</span>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{log.action}</span>
                      </td>
                      <td className="px-8 py-4 text-[10px] font-mono text-gray-600">{log.ip}</td>
                      <td className="px-8 py-4 text-[10px] font-bold text-gray-500 text-right">
                        {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Modal */}
      <AnimatePresence>
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRoleModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-5xl bg-cyber-gray border border-white/10 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedRole ? 'Edit Role' : 'Create New Role'}</h3>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mt-1">Define granular access permissions</p>
                </div>
                <button onClick={() => setIsRoleModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Role Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Senior Accountant"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-6">
                  <h4 className="text-xs font-black text-neon-blue uppercase tracking-[0.3em] flex items-center gap-3">
                    <Lock size={16} /> Permission Matrix
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MODULES.map((mod) => (
                      <div key={mod.id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                          <mod.icon className="text-neon-purple" size={18} />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{mod.label}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          {(['view', 'create', 'edit', 'delete'] as const).map((action) => (
                            <button 
                              key={action}
                              onClick={() => handleTogglePermission(mod.id, action)}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${
                                rolePermissions[mod.id]?.[action] 
                                  ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' 
                                  : 'bg-cyber-black/50 border-white/5 text-gray-600'
                              }`}
                            >
                              {action}
                              {rolePermissions[mod.id]?.[action] ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white/[0.02] border-t border-white/5 flex justify-end gap-4">
                <button 
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-8 py-4 bg-white/5 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveRole}
                  disabled={submitting}
                  className="px-12 py-4 bg-neon-blue text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : selectedRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolAdminRolesManagement;
