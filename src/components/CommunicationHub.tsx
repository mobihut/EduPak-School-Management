import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  MessageSquare, 
  Mail, 
  Bell, 
  History, 
  Layout, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Paperclip, 
  Smartphone, 
  Users, 
  User, 
  GraduationCap, 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  Eye, 
  Trash2, 
  Copy, 
  FileText, 
  Settings,
  Zap,
  BarChart3,
  CreditCard,
  Phone,
  Share2,
  X,
  ArrowRight,
  Info,
  RefreshCw,
  UserX
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';

// --- Types ---

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: 'fee' | 'attendance' | 'event' | 'holiday' | 'result' | 'general';
}

interface CommunicationLog {
  id: string;
  subject: string;
  content: string;
  channels: string[];
  audience: string;
  targetCount: number;
  status: 'sent' | 'pending' | 'failed';
  timestamp: any;
  sentBy: string;
  readCount?: number;
}

interface AudienceGroup {
  id: string;
  name: string;
  type: 'class' | 'staff' | 'custom';
  memberCount: number;
}

// --- Constants ---

const DYNAMIC_TAGS = [
  { tag: '{student_name}', label: 'Student Name' },
  { tag: '{parent_name}', label: 'Parent Name' },
  { tag: '{class}', label: 'Class' },
  { tag: '{section}', label: 'Section' },
  { tag: '{fee_amount}', label: 'Fee Amount' },
  { tag: '{due_date}', label: 'Due Date' },
  { tag: '{roll_no}', label: 'Roll Number' },
];

const PREBUILT_TEMPLATES: Partial<MessageTemplate>[] = [
  { title: 'Fee Reminder', category: 'fee', content: 'Dear {parent_name}, this is a reminder that the school fee for {student_name} of Class {class} is due by {due_date}. Amount: {fee_amount}. Please ignore if already paid.' },
  { title: 'Student Absent', category: 'attendance', content: 'Dear Parent, {student_name} (Roll No: {roll_no}) of Class {class} is marked absent today. Please provide a leave application if this was planned.' },
  { title: 'PTM Announcement', category: 'event', content: 'Dear Parent, a Parent-Teacher Meeting is scheduled for this Saturday at 10:00 AM. We look forward to discussing {student_name}\'s progress.' },
  { title: 'Emergency Holiday', category: 'holiday', content: 'Important: Due to heavy rainfall, the school will remain closed tomorrow. Classes will resume as per schedule from the following day.' },
];

// --- Components ---

const CommunicationHub: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'templates' | 'automation' | 'analytics'>('compose');
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [automationSettings, setAutomationSettings] = useState({
    autoAbsent: true,
    feeReminders: true,
    examResults: false,
    holidayAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose State
  const [messageData, setMessageData] = useState({
    subject: '',
    content: '',
    channels: {
      sms: true,
      email: true,
      push: true,
      whatsapp: false
    },
    audience: 'all_students',
    targetClass: '',
    scheduledDate: '',
    scheduledTime: '',
  });

  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    // Fetch Logs
    const logsUnsub = onSnapshot(
      query(collection(db, 'communication_logs'), where('schoolId', '==', schoolId), orderBy('timestamp', 'desc'), limit(50)),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as CommunicationLog)));
        setLoading(false);
      }
    );

    // Fetch Templates
    const templatesUnsub = onSnapshot(
      query(collection(db, 'message_templates'), where('schoolId', '==', schoolId)),
      (snap) => {
        setTemplates(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as MessageTemplate)));
      }
    );

    return () => {
      logsUnsub();
      templatesUnsub();
    };
  }, [schoolId]);

  const handleSendMessage = async (isTest = false) => {
    if (!messageData.content) return toast.error("Message content is required");
    if (!isTest && !messageData.subject) return toast.error("Subject is required");

    setIsSending(true);
    try {
      const activeChannels = Object.entries(messageData.channels)
        .filter(([_, enabled]) => enabled)
        .map(([channel]) => channel);

      if (activeChannels.length === 0) throw new Error("Select at least one channel");

      const logData = {
        schoolId,
        subject: messageData.subject,
        content: messageData.content,
        channels: activeChannels,
        audience: isTest ? 'Admin (Test)' : messageData.audience,
        targetCount: isTest ? 1 : 150, // Mock count for now
        status: 'sent',
        timestamp: serverTimestamp(),
        sentBy: auth.currentUser?.displayName || 'Admin',
        readCount: 0
      };

      await addDoc(collection(db, 'communication_logs'), logData);
      
      if (isTest) {
        toast.success("Test message sent to your registered contact");
      } else {
        toast.success("Broadcast started successfully!");
        setMessageData({
          ...messageData,
          subject: '',
          content: '',
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const insertTag = (tag: string) => {
    setMessageData(prev => ({
      ...prev,
      content: prev.content + ' ' + tag
    }));
  };

  const applyTemplate = (template: MessageTemplate) => {
    setMessageData(prev => ({
      ...prev,
      subject: template.title,
      content: template.content
    }));
    setActiveTab('compose');
    toast.success("Template applied");
  };

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-purple/10 border border-neon-purple/20 mb-4"
          >
            <Zap className="text-neon-purple" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-purple">Enterprise Messaging Engine</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Communication <span className="text-neon-purple">Hub.</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 bg-cyber-gray/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2 border-r border-white/10">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">SMS Credits</p>
            <p className="text-lg font-black text-white">4,280</p>
          </div>
          <button className="p-3 bg-neon-purple text-black rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'compose', label: 'Compose Message', icon: Send },
          { id: 'history', label: 'Sent History', icon: History },
          { id: 'templates', label: 'Templates', icon: Layout },
          { id: 'automation', label: 'Automation', icon: Zap },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-neon-purple text-white border-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                : 'bg-cyber-gray/40 text-gray-500 border-white/5 hover:border-white/10'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'compose' && (
          <motion.div 
            key="compose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">New Broadcast</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowPreview(!showPreview)}
                        className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-white transition-all"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subject / Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Urgent: School Holiday Announcement"
                      value={messageData.subject}
                      onChange={(e) => setMessageData({...messageData, subject: e.target.value})}
                      className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Message Content</label>
                      <div className="flex gap-2">
                        {DYNAMIC_TAGS.slice(0, 3).map(tag => (
                          <button 
                            key={tag.tag}
                            onClick={() => insertTag(tag.tag)}
                            className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-bold text-neon-purple hover:bg-neon-purple/10 transition-all"
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      rows={8}
                      placeholder="Type your message here..."
                      value={messageData.content}
                      onChange={(e) => setMessageData({...messageData, content: e.target.value})}
                      className="w-full bg-cyber-black/50 border border-white/10 rounded-3xl px-6 py-6 text-sm focus:border-neon-purple/50 outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all">
                      <Paperclip size={14} />
                      Attach PDF/Image
                    </button>
                    <button 
                      onClick={() => setActiveTab('templates')}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                    >
                      <Layout size={14} />
                      Use Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-neon-purple/10 rounded-2xl border border-neon-purple/20">
                    <Calendar className="text-neon-purple" size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">Schedule Broadcast</h4>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Leave empty to send immediately</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Send Date</label>
                    <input 
                      type="date"
                      value={messageData.scheduledDate}
                      onChange={(e) => setMessageData({...messageData, scheduledDate: e.target.value})}
                      className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Send Time</label>
                    <input 
                      type="time"
                      value={messageData.scheduledTime}
                      onChange={(e) => setMessageData({...messageData, scheduledTime: e.target.value})}
                      className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-neon-purple/50 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-8">
              {/* Channels */}
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h4 className="text-xs font-black text-neon-purple uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <Share2 size={14} /> Delivery Channels
                </h4>
                <div className="space-y-3">
                  {[
                    { id: 'sms', label: 'SMS Gateway', icon: Smartphone, color: 'text-blue-400' },
                    { id: 'email', label: 'Email Service', icon: Mail, color: 'text-red-400' },
                    { id: 'push', label: 'App Notification', icon: Bell, color: 'text-yellow-400' },
                    { id: 'whatsapp', label: 'WhatsApp API', icon: Phone, color: 'text-green-400', isNew: true },
                  ].map((channel) => (
                    <button 
                      key={channel.id}
                      onClick={() => setMessageData({
                        ...messageData,
                        channels: { ...messageData.channels, [channel.id]: !messageData.channels[channel.id as keyof typeof messageData.channels] }
                      })}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        messageData.channels[channel.id as keyof typeof messageData.channels]
                          ? 'bg-white/5 border-neon-purple/30'
                          : 'bg-transparent border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <channel.icon className={channel.color} size={18} />
                        <div className="text-left">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{channel.label}</p>
                          {channel.isNew && <span className="text-[6px] font-black bg-green-500 text-black px-1 rounded uppercase">Beta</span>}
                        </div>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-all ${
                        messageData.channels[channel.id as keyof typeof messageData.channels] ? 'bg-neon-purple' : 'bg-gray-800'
                      }`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                          messageData.channels[channel.id as keyof typeof messageData.channels] ? 'right-1' : 'left-1'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h4 className="text-xs font-black text-neon-purple uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <Users size={14} /> Target Audience
                </h4>
                <div className="space-y-4">
                  <select 
                    value={messageData.audience}
                    onChange={(e) => setMessageData({...messageData, audience: e.target.value})}
                    className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-neon-purple/50"
                  >
                    <option value="all_students">All Students</option>
                    <option value="specific_class">Specific Class</option>
                    <option value="all_staff">All Staff Members</option>
                    <option value="individual_parent">Individual Parent</option>
                    <option value="custom_group">Custom Group</option>
                  </select>

                  {messageData.audience === 'specific_class' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <select 
                        className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-neon-purple/50"
                      >
                        <option value="">Select Class</option>
                        <option value="1">Class 1</option>
                        <option value="2">Class 2</option>
                        <option value="3">Class 3</option>
                      </select>
                    </motion.div>
                  )}

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Estimated Reach</span>
                      <span className="text-[10px] font-black text-white">1,240 People</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <button 
                  onClick={() => handleSendMessage(true)}
                  disabled={isSending}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone size={16} />
                  Send Test Message
                </button>
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={isSending}
                  className="w-full py-5 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-3 group"
                >
                  {isSending ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden"
          >
            <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Broadcast History</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input 
                    type="text"
                    placeholder="Search logs..."
                    className="bg-cyber-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-neon-purple/50 outline-none"
                  />
                </div>
                <button className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-white transition-all">
                  <Filter size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Message Details</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Channels</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Audience</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{log.subject}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-1 max-w-xs">{log.content}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex gap-2">
                          {log.channels.map(ch => (
                            <div key={ch} className="p-1.5 bg-white/5 rounded-lg border border-white/5 text-gray-400">
                              {ch === 'sms' && <Smartphone size={12} />}
                              {ch === 'email' && <Mail size={12} />}
                              {ch === 'push' && <Bell size={12} />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-black text-neon-purple uppercase tracking-widest">{log.audience.replace('_', ' ')}</p>
                        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{log.targetCount} Recipients</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'sent' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_8px_#eab308]'
                          }`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">{log.status}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-[10px] font-bold text-gray-400">
                          {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </p>
                        <p className="text-[8px] font-bold text-gray-600">
                          {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div 
            key="templates"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Add New Template Card */}
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 border-dashed flex flex-col items-center justify-center text-center group hover:border-neon-purple/50 transition-all cursor-pointer">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="text-gray-500 group-hover:text-neon-purple" size={32} />
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Create Template</h4>
                <p className="text-[10px] text-gray-500 mt-2">Save time by creating reusable message formats</p>
              </div>

              {/* Prebuilt Templates */}
              {PREBUILT_TEMPLATES.map((temp, idx) => (
                <div key={idx} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 group hover:border-neon-purple/30 transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-white">
                      <Copy size={14} />
                    </button>
                  </div>
                  
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 ${
                    temp.category === 'fee' ? 'bg-red-500/10 text-red-400' :
                    temp.category === 'attendance' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {temp.category === 'fee' ? <CreditCard size={20} /> :
                     temp.category === 'attendance' ? <CheckCircle2 size={20} /> :
                     <FileText size={20} />}
                  </div>

                  <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-2">{temp.title}</h4>
                  <p className="text-[10px] text-gray-500 line-clamp-3 mb-8 leading-relaxed">{temp.content}</p>

                  <button 
                    onClick={() => applyTemplate(temp as MessageTemplate)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neon-purple hover:bg-neon-purple hover:text-black transition-all"
                  >
                    Use This Template
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'automation' && (
          <motion.div 
            key="automation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-neon-purple/10 rounded-2xl border border-neon-purple/20">
                  <Zap className="text-neon-purple" size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white uppercase tracking-tighter">Automated Triggers</h4>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configure system-wide auto-messaging</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'autoAbsent', label: 'Auto-Absent Alerts', desc: 'Send SMS to parents when student is marked absent', icon: UserX },
                  { id: 'feeReminders', label: 'Fee Reminders', desc: 'Auto-remind 3 days before due date', icon: CreditCard },
                  { id: 'examResults', label: 'Result Publishing', desc: 'Notify parents when exam results are published', icon: GraduationCap },
                  { id: 'holidayAlerts', label: 'Holiday Notifications', desc: 'Broadcast holiday news automatically', icon: Calendar },
                ].map((trigger) => (
                  <div key={trigger.id} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-neon-purple/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-cyber-black rounded-2xl text-gray-400">
                        <trigger.icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-widest">{trigger.label}</p>
                        <p className="text-[10px] text-gray-500">{trigger.desc}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAutomationSettings(prev => ({ ...prev, [trigger.id]: !prev[trigger.id as keyof typeof automationSettings] }))}
                      className={`w-12 h-6 rounded-full relative transition-all ${
                        automationSettings[trigger.id as keyof typeof automationSettings] ? 'bg-neon-purple' : 'bg-gray-800'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        automationSettings[trigger.id as keyof typeof automationSettings] ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center items-center text-center space-y-6">
              <div className="w-20 h-20 bg-neon-purple/10 rounded-[2rem] flex items-center justify-center border border-neon-purple/20">
                <Info className="text-neon-purple" size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">Smart Engine Active</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                  The automation engine runs in the background. It monitors attendance and fee records every 24 hours to trigger configured messages.
                </p>
              </div>
              <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">
                View Automation Logs
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              { label: 'Total Sent', value: '12,480', sub: '+12% this month', icon: Send, color: 'text-neon-purple' },
              { label: 'Delivery Rate', value: '98.4%', sub: 'High performance', icon: CheckCircle2, color: 'text-green-400' },
              { label: 'Open Rate', value: '72%', sub: 'App Notifications', icon: Eye, color: 'text-blue-400' },
              { label: 'Failed', value: '124', sub: 'Invalid Numbers', icon: XCircle, color: 'text-red-400' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 bg-white/5 rounded-2xl border border-white/5 ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Live</span>
                </div>
                <p className="text-3xl font-black text-white uppercase tracking-tighter">{stat.value}</p>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">{stat.label}</p>
                <p className={`text-[8px] font-bold mt-4 ${stat.color}`}>{stat.sub}</p>
              </div>
            ))}

            <div className="md:col-span-2 lg:col-span-4 bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">Channel Distribution</h4>
                <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none">
                  <option>Last 30 Days</option>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <div className="h-64 flex items-end gap-4">
                {[
                  { label: 'SMS', val: '80%', color: 'bg-blue-400' },
                  { label: 'Email', val: '60%', color: 'bg-red-400' },
                  { label: 'Push', val: '95%', color: 'bg-yellow-400' },
                  { label: 'WhatsApp', val: '20%', color: 'bg-green-400' },
                ].map((bar, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-4">
                    <div className="w-full bg-white/5 rounded-2xl relative overflow-hidden flex flex-col justify-end h-48">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: bar.val }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className={`w-full ${bar.color} opacity-80 shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
                      />
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowPreview(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative w-full max-w-sm bg-cyber-black border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
            >
              {/* Phone Frame Header */}
              <div className="h-14 bg-white/5 flex items-center justify-center border-b border-white/5">
                <div className="w-20 h-6 bg-black rounded-full" />
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neon-purple/20 flex items-center justify-center border border-neon-purple/30">
                      <Smartphone className="text-neon-purple" size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">EduPak Portal</p>
                      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Just Now</p>
                    </div>
                  </div>
                  <X className="text-gray-500 cursor-pointer" size={16} onClick={() => setShowPreview(false)} />
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-3">
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">{messageData.subject || 'Message Subject'}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {messageData.content || 'Your message content will appear here...'}
                  </p>
                </div>

                <div className="pt-4">
                  <button className="w-full py-4 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Open Portal
                  </button>
                </div>
              </div>

              <div className="h-8 bg-white/5 flex items-center justify-center">
                <div className="w-32 h-1 bg-white/20 rounded-full" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommunicationHub;
