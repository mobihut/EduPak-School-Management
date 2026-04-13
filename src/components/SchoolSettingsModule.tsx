import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  School, 
  Palette, 
  Calendar, 
  Shield, 
  Upload, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Globe, 
  Facebook, 
  Instagram, 
  Youtube, 
  Bell, 
  Image as ImageIcon, 
  Type, 
  Clock, 
  Languages, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  X,
  Lock,
  Eye,
  Layout,
  FileText,
  Smartphone,
  UserPlus,
  GraduationCap
} from 'lucide-react';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

// --- Types ---

interface SchoolSettings {
  id: string;
  name: string;
  registrationNumber: string;
  slogan: string;
  email: string;
  phone: string;
  address: string;
  logoURL?: string;
  signatureURL?: string;
  
  // Branding
  theme: {
    primary: string;
    secondary: string;
    fontFamily: string;
  };
  sliders: string[];
  noticeBoard: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    youtube: string;
  };
  
  // Academic
  currentSession: string;
  sessions: string[];
  holidays: { id: string; name: string; date: string; type: 'Holiday' | 'Event' }[];
  classes: { id: string; name: string; sections: string[] }[];
  timezone: string;
  language: string;
  
  // Permissions
  modules: {
    teacherFeeView: boolean;
    parentAdmission: boolean;
    onlineAttendance: boolean;
    examResults: boolean;
  };
  
  updatedAt: any;
}

const DEFAULT_SETTINGS: Partial<SchoolSettings> = {
  theme: {
    primary: '#00f3ff',
    secondary: '#bc13fe',
    fontFamily: 'Plus Jakarta Sans'
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    youtube: ''
  },
  sessions: ['2025-2026'],
  currentSession: '2025-2026',
  holidays: [],
  classes: [
    { id: '1', name: 'Class 1', sections: ['A', 'B'] },
    { id: '2', name: 'Class 2', sections: ['A'] }
  ],
  timezone: 'UTC+5',
  language: 'English',
  modules: {
    teacherFeeView: false,
    parentAdmission: true,
    onlineAttendance: true,
    examResults: true
  }
};

// --- Components ---

const SchoolSettingsModule: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'academic' | 'access'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    const unsubscribe = onSnapshot(doc(db, 'schools', schoolId), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...docSnap.data() } as SchoolSettings);
      } else {
        // Initialize with defaults if not exists
        const initial = { ...DEFAULT_SETTINGS, id: schoolId } as SchoolSettings;
        setDoc(doc(db, 'schools', schoolId), initial);
        setSettings(initial);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const handleSave = async (updates: Partial<SchoolSettings>) => {
    if (!schoolId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', schoolId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Settings updated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'logo' | 'signature') => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const storageRef = ref(storage, `schools/${schoolId}/${type}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'schools', schoolId), {
        [type === 'logo' ? 'logoURL' : 'signatureURL']: url,
        updatedAt: serverTimestamp()
      });
      
      setMessage({ type: 'success', text: `${type === 'logo' ? 'Logo' : 'Signature'} uploaded!` });
    } catch (err) {
      console.error("Upload error:", err);
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset branding to defaults?")) {
      handleSave({ theme: DEFAULT_SETTINGS.theme });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'profile', label: 'Profile & Identity', icon: School },
    { id: 'branding', label: 'Portal Branding', icon: Palette },
    { id: 'academic', label: 'Academic Setup', icon: Calendar },
    { id: 'access', label: 'Access & Permissions', icon: Shield },
  ];

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4"
          >
            <Settings className="text-neon-blue" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-blue">Enterprise Configuration Suite</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            School <span className="text-neon-blue">Settings.</span>
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={resetToDefault}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-500 hover:text-white transition-all"
            title="Reset to Default"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all border ${
                activeTab === tab.id 
                  ? 'bg-neon-blue text-black border-neon-blue shadow-[0_0_30px_rgba(0,243,255,0.3)]' 
                  : 'bg-cyber-gray/40 text-gray-500 border-white/5 hover:border-white/10'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="ml-auto" size={16} />}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* School Identity */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <School className="text-neon-blue" size={24} /> School Identity
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">School Name</label>
                        <input 
                          type="text"
                          value={settings.name || ''}
                          onChange={(e) => handleSave({ name: e.target.value })}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Registration Number</label>
                        <input 
                          type="text"
                          value={settings.registrationNumber || ''}
                          onChange={(e) => handleSave({ registrationNumber: e.target.value })}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Slogan / Motto</label>
                        <input 
                          type="text"
                          value={settings.slogan || ''}
                          onChange={(e) => handleSave({ slogan: e.target.value })}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Logo Upload */}
                      <div className="flex items-center gap-6 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                        <div className="w-24 h-24 rounded-2xl bg-cyber-black border border-white/10 flex items-center justify-center overflow-hidden">
                          {settings.logoURL ? (
                            <img src={settings.logoURL} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="text-gray-700" size={32} />
                          )}
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">School Logo</p>
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-neon-blue/10 border border-neon-blue/20 rounded-xl text-neon-blue text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-neon-blue/20 transition-all">
                            <Upload size={14} />
                            Upload Logo
                            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} />
                          </label>
                        </div>
                      </div>

                      {/* Signature Upload */}
                      <div className="flex items-center gap-6 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                        <div className="w-24 h-24 rounded-2xl bg-cyber-black border border-white/10 flex items-center justify-center overflow-hidden">
                          {settings.signatureURL ? (
                            <img src={settings.signatureURL} alt="Signature" className="w-full h-full object-contain" />
                          ) : (
                            <FileText className="text-gray-700" size={32} />
                          )}
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">Principal Signature</p>
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-xl text-neon-purple text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-neon-purple/20 transition-all">
                            <Upload size={14} />
                            Upload Sign
                            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'signature')} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <Globe className="text-neon-purple" size={24} /> Contact Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Official Email</label>
                      <input 
                        type="email"
                        value={settings.email || ''}
                        onChange={(e) => handleSave({ email: e.target.value })}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                      <input 
                        type="tel"
                        value={settings.phone || ''}
                        onChange={(e) => handleSave({ phone: e.target.value })}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Full Address</label>
                      <textarea 
                        rows={3}
                        value={settings.address || ''}
                        onChange={(e) => handleSave({ address: e.target.value })}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'branding' && (
              <motion.div 
                key="branding"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Theme Engine */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <Palette className="text-neon-blue" size={24} /> Theme Engine
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Primary Color</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="color"
                          value={settings.theme.primary}
                          onChange={(e) => handleSave({ theme: { ...settings.theme, primary: e.target.value } })}
                          className="w-16 h-16 bg-transparent border-none cursor-pointer"
                        />
                        <div className="flex-grow bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-xs text-white">
                          {settings.theme.primary.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Secondary Color</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="color"
                          value={settings.theme.secondary}
                          onChange={(e) => handleSave({ theme: { ...settings.theme, secondary: e.target.value } })}
                          className="w-16 h-16 bg-transparent border-none cursor-pointer"
                        />
                        <div className="flex-grow bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-xs text-white">
                          {settings.theme.secondary.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Font Family</label>
                      <select 
                        value={settings.theme.fontFamily}
                        onChange={(e) => handleSave({ theme: { ...settings.theme, fontFamily: e.target.value } })}
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="Inter">Inter</option>
                        <option value="Outfit">Outfit</option>
                        <option value="Space Grotesk">Space Grotesk</option>
                      </select>
                    </div>
                  </div>

                  {/* Real-time Preview */}
                  <div className="mt-12 p-8 bg-cyber-black/50 rounded-[2rem] border border-white/5">
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-6">Portal Preview</p>
                    <div className="flex items-center gap-6">
                      <button 
                        style={{ backgroundColor: settings.theme.primary + '20', borderColor: settings.theme.primary + '40', color: settings.theme.primary }}
                        className="px-6 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest"
                      >
                        Sample Button
                      </button>
                      <div 
                        style={{ borderLeftColor: settings.theme.secondary }}
                        className="pl-4 border-l-4"
                      >
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Headline Preview</h4>
                        <p className="text-[10px] text-gray-500">This is how your custom theme will look.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social & Notice Board */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Layout className="text-neon-purple" size={24} /> Notice Board
                    </h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Scrolling News / Announcements</label>
                      <textarea 
                        rows={4}
                        value={settings.noticeBoard || ''}
                        onChange={(e) => handleSave({ noticeBoard: e.target.value })}
                        placeholder="Welcome to the new academic session! Admissions are now open..."
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Globe className="text-neon-blue" size={24} /> Social Links
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                          <Facebook className="text-blue-500" size={18} />
                        </div>
                        <input 
                          type="text"
                          value={settings.socialLinks.facebook}
                          onChange={(e) => handleSave({ socialLinks: { ...settings.socialLinks, facebook: e.target.value } })}
                          placeholder="Facebook URL"
                          className="flex-grow bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center border border-pink-500/20">
                          <Instagram className="text-pink-500" size={18} />
                        </div>
                        <input 
                          type="text"
                          value={settings.socialLinks.instagram}
                          onChange={(e) => handleSave({ socialLinks: { ...settings.socialLinks, instagram: e.target.value } })}
                          placeholder="Instagram URL"
                          className="flex-grow bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-pink-500/50"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                          <Youtube className="text-red-500" size={18} />
                        </div>
                        <input 
                          type="text"
                          value={settings.socialLinks.youtube}
                          onChange={(e) => handleSave({ socialLinks: { ...settings.socialLinks, youtube: e.target.value } })}
                          placeholder="YouTube URL"
                          className="flex-grow bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-red-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'academic' && (
              <motion.div 
                key="academic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Session & Calendar */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Calendar className="text-neon-blue" size={24} /> Academic Sessions
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Current Active Session</label>
                        <select 
                          value={settings.currentSession}
                          onChange={(e) => handleSave({ currentSession: e.target.value })}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-blue/50 outline-none transition-all"
                        >
                          {settings.sessions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-4">All Sessions</p>
                        <div className="flex flex-wrap gap-2">
                          {settings.sessions.map(s => (
                            <span key={s} className="px-3 py-1 bg-neon-blue/10 text-neon-blue border border-neon-blue/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              {s}
                            </span>
                          ))}
                          <button className="px-3 py-1 bg-white/5 text-gray-500 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">
                            + Add New
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <Clock className="text-neon-purple" size={24} /> Regional Settings
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Time Zone</label>
                        <select 
                          value={settings.timezone}
                          onChange={(e) => handleSave({ timezone: e.target.value })}
                          className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                        >
                          <option value="UTC+5">UTC+5 (Pakistan Standard Time)</option>
                          <option value="UTC+0">UTC+0 (Greenwich Mean Time)</option>
                          <option value="UTC+8">UTC+8 (Singapore/China)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Preferred Language</label>
                        <div className="flex items-center gap-4">
                          <Languages className="text-gray-500" size={20} />
                          <select 
                            value={settings.language}
                            onChange={(e) => handleSave({ language: e.target.value })}
                            className="flex-grow bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                          >
                            <option value="English">English</option>
                            <option value="Urdu">Urdu</option>
                            <option value="Arabic">Arabic</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Class & Section Setup */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-3">
                      <Layout className="text-neon-blue" size={24} /> Class & Section Setup
                    </h3>
                    <button className="px-4 py-2 bg-neon-blue/10 border border-neon-blue/20 rounded-xl text-neon-blue text-[10px] font-black uppercase tracking-widest hover:bg-neon-blue/20 transition-all">
                      Add Class
                    </button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {settings.classes.map((cls) => (
                      <div key={cls.id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 group hover:border-neon-blue/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-black text-white uppercase tracking-tight">{cls.name}</span>
                          <button className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cls.sections.map(sec => (
                            <span key={sec} className="px-2 py-1 bg-cyber-black/50 border border-white/5 rounded text-[8px] font-black text-gray-400 uppercase tracking-widest">
                              Sec {sec}
                            </span>
                          ))}
                          <button className="w-6 h-6 bg-white/5 rounded flex items-center justify-center text-gray-500 hover:text-neon-blue transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'access' && (
              <motion.div 
                key="access"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Module Toggles */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <Lock className="text-neon-blue" size={24} /> Portal Access & Permissions
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    {[
                      { id: 'teacherFeeView', label: 'Teachers can view Fee Details', desc: 'Allow teachers to see student payment history', icon: FileText },
                      { id: 'parentAdmission', label: 'Public Online Admission', desc: 'Enable the public enrollment form on your website', icon: UserPlus },
                      { id: 'onlineAttendance', label: 'Real-time Attendance Alerts', desc: 'Automatically send SMS/Email for absentees', icon: Bell },
                      { id: 'examResults', label: 'Publish Exam Results', desc: 'Make report cards visible on the parent portal', icon: GraduationCap },
                    ].map((mod) => (
                      <div key={mod.id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                            <mod.icon className="text-gray-500" size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{mod.label}</p>
                            <p className="text-[8px] text-gray-500 font-medium uppercase tracking-widest">{mod.desc}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleSave({ modules: { ...settings.modules, [mod.id]: !settings.modules[mod.id as keyof typeof settings.modules] } })}
                          className={`w-12 h-6 rounded-full p-1 transition-all duration-500 relative ${
                            settings.modules[mod.id as keyof typeof settings.modules] ? 'bg-neon-blue' : 'bg-gray-800'
                          }`}
                        >
                          <motion.div 
                            animate={{ x: settings.modules[mod.id as keyof typeof settings.modules] ? 24 : 0 }}
                            className={`w-4 h-4 rounded-full shadow-lg ${settings.modules[mod.id as keyof typeof settings.modules] ? 'bg-black' : 'bg-gray-500'}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile App Settings */}
                <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <Smartphone className="text-neon-purple" size={24} /> Mobile App Configuration
                  </h3>
                  <div className="p-8 bg-neon-purple/5 border border-neon-purple/20 rounded-3xl flex flex-col md:flex-row items-center gap-8">
                    <div className="w-32 h-32 bg-white p-2 rounded-2xl">
                      <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
                        <Smartphone className="text-gray-300" size={48} />
                      </div>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                      <h4 className="text-sm font-black text-white uppercase tracking-tight mb-2">EduPak Mobile Companion</h4>
                      <p className="text-[10px] text-gray-500 leading-relaxed max-w-md mb-6 uppercase font-bold tracking-widest">
                        Your school is currently using the Enterprise SaaS version. Mobile app white-labeling is available for your tier.
                      </p>
                      <button className="px-6 py-3 bg-neon-purple text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] transition-all">
                        Configure Mobile App
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SchoolSettingsModule;
