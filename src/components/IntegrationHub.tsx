import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Shield, 
  Key, 
  Globe, 
  Webhook, 
  Code2, 
  Activity, 
  Lock, 
  Clock, 
  Search, 
  Plus, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  MessageSquare, 
  CreditCard, 
  Video, 
  Database, 
  Share2, 
  Calendar, 
  Slack,
  MoreVertical,
  Trash2,
  RefreshCw,
  Terminal,
  ChevronRight,
  Eye,
  EyeOff,
  Settings,
  BookOpen
} from 'lucide-react';

// --- Types ---

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'communication' | 'payments' | 'education' | 'accounting' | 'developer';
  status: 'active' | 'inactive';
  isPopular?: boolean;
}

interface ApiLog {
  id: string;
  method: string;
  endpoint: string;
  status: number;
  speed: string;
  timestamp: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  event: string;
  status: 'active' | 'inactive';
}

// --- Mock Data ---

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Official API for automated school alerts and parent communication.', icon: MessageSquare, category: 'communication', status: 'active', isPopular: true },
  { id: 'twilio', name: 'Twilio SMS', description: 'Global SMS gateway for emergency notifications and OTPs.', icon: MessageSquare, category: 'communication', status: 'inactive' },
  { id: 'resend', name: 'Resend Email', description: 'Modern email API for transactional school reports and newsletters.', icon: Share2, category: 'communication', status: 'active' },
  { id: 'zoom', name: 'Zoom Meetings', description: 'Integrated virtual classrooms with automated link generation.', icon: Video, category: 'education', status: 'active', isPopular: true },
  { id: 'gmeet', name: 'Google Meet', description: 'Seamless Google Workspace integration for online classes.', icon: Video, category: 'education', status: 'inactive' },
  { id: 'teams', name: 'MS Teams', description: 'Enterprise-grade collaboration for large school networks.', icon: Video, category: 'education', status: 'inactive' },
  { id: 'stripe', name: 'Stripe', description: 'Global payment processing for international school fees.', icon: CreditCard, category: 'payments', status: 'active', isPopular: true },
  { id: 'paypal', name: 'PayPal', description: 'Secure online payments for parents worldwide.', icon: CreditCard, category: 'payments', status: 'inactive' },
  { id: 'bank_api', name: 'Local Bank API', description: 'Direct integration with local banking systems for fee recovery.', icon: Database, category: 'payments', status: 'active' },
  { id: 'gdrive', name: 'Google Drive', description: 'Cloud storage for student records and automated backups.', icon: Database, category: 'accounting', status: 'active' },
  { id: 'dropbox', name: 'Dropbox', description: 'Secure file synchronization for administrative documents.', icon: Database, category: 'accounting', status: 'inactive' },
  { id: 'gcal', name: 'Google Calendar', description: 'Sync school events and exam schedules with personal calendars.', icon: Calendar, category: 'developer', status: 'active' },
  { id: 'slack', name: 'Slack', description: 'Internal staff communication and automated system alerts.', icon: Slack, category: 'communication', status: 'inactive' },
  { id: 'glogin', name: 'Google Login', description: 'Single Sign-On (SSO) for students and staff.', icon: Lock, category: 'developer', status: 'active', isPopular: true },
  { id: 'fblogin', name: 'Facebook Auth', description: 'Social authentication for parent portal access.', icon: Lock, category: 'developer', status: 'inactive' },
];

const MOCK_LOGS: ApiLog[] = [
  { id: '1', method: 'POST', endpoint: '/v1/fees/pay', status: 200, speed: '45ms', timestamp: '2 mins ago' },
  { id: '2', method: 'GET', endpoint: '/v1/students/list', status: 200, speed: '120ms', timestamp: '5 mins ago' },
  { id: '3', method: 'POST', endpoint: '/v1/attendance/sync', status: 400, speed: '32ms', timestamp: '12 mins ago' },
  { id: '4', method: 'GET', endpoint: '/v1/exams/results', status: 200, speed: '210ms', timestamp: '15 mins ago' },
  { id: '5', method: 'PATCH', endpoint: '/v1/staff/update', status: 200, speed: '88ms', timestamp: '22 mins ago' },
];

// --- Components ---

const IntegrationCard = ({ integration, onToggle }: { integration: Integration; onToggle: (id: string) => void }) => {
  const Icon = integration.icon;
  const isActive = integration.status === 'active';

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`relative p-6 rounded-3xl border transition-all duration-300 group overflow-hidden ${
        isActive 
          ? 'bg-neon-blue/5 border-neon-blue/30 shadow-[0_0_20px_rgba(0,243,255,0.05)]' 
          : 'bg-cyber-gray/40 border-white/5 grayscale hover:grayscale-0'
      }`}
    >
      {integration.isPopular && (
        <div className="absolute top-0 right-0 bg-neon-blue text-black text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-[0_0_10px_#00f3ff]">
          Popular
        </div>
      )}
      
      <div className="flex items-start justify-between mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
          isActive ? 'bg-neon-blue/10 border-neon-blue/20 rotate-[10deg]' : 'bg-white/5 border-white/10'
        }`}>
          <Icon size={24} className={isActive ? 'text-neon-blue' : 'text-gray-500'} />
        </div>
        
        <button 
          onClick={() => onToggle(integration.id)}
          className={`w-12 h-6 rounded-full p-1 transition-all duration-500 relative ${
            isActive ? 'bg-neon-blue' : 'bg-gray-800'
          }`}
        >
          <motion.div 
            animate={{ x: isActive ? 24 : 0 }}
            className={`w-4 h-4 rounded-full shadow-lg ${isActive ? 'bg-black' : 'bg-gray-500'}`}
          />
        </button>
      </div>

      <h3 className="text-sm font-black text-white uppercase tracking-tight mb-2 group-hover:text-neon-blue transition-colors">
        {integration.name}
      </h3>
      <p className="text-gray-500 text-[10px] leading-relaxed font-medium mb-4">
        {integration.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">
            {isActive ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <button className="text-gray-500 hover:text-white transition-colors">
          <Settings size={14} />
        </button>
      </div>
    </motion.div>
  );
};

const ApiKeySection = () => {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">API Credentials</h3>
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Manage your school's access keys</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 border border-neon-blue/20 rounded-xl text-neon-blue text-[10px] font-black uppercase tracking-widest hover:bg-neon-blue/20 transition-all">
          <RefreshCw size={14} />
          Regenerate Keys
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3 block">Client ID</label>
          <div className="flex gap-3">
            <div className="flex-grow bg-cyber-black/50 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs text-neon-blue flex items-center justify-between">
              <span>edupak_live_7721_x92k</span>
              <button onClick={() => copyToClipboard('edupak_live_7721_x92k', 'id')} className="text-gray-500 hover:text-white transition-colors">
                {copied === 'id' ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3 block">Client Secret</label>
          <div className="flex gap-3">
            <div className="flex-grow bg-cyber-black/50 border border-white/5 rounded-xl px-4 py-3 font-mono text-xs text-white flex items-center justify-between">
              <span>{showSecret ? 'sk_live_9921_p02l_m88q_z11v_k09x' : '••••••••••••••••••••••••••••••••'}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowSecret(!showSecret)} className="text-gray-500 hover:text-white transition-colors">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copyToClipboard('sk_live_9921_p02l_m88q_z11v_k09x', 'secret')} className="text-gray-500 hover:text-white transition-colors">
                  {copied === 'secret' ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-neon-purple/5 border border-neon-purple/20 rounded-2xl flex items-start gap-4">
        <AlertCircle className="text-neon-purple shrink-0" size={18} />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="text-neon-purple font-black uppercase">Security Warning:</span> Never share your Client Secret in public repositories or client-side code. Use environment variables to store these credentials securely.
        </p>
      </div>
    </div>
  );
};

const WebhookDashboard = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    { id: '1', url: 'https://api.myschool.com/webhooks/payments', event: 'payment.success', status: 'active' },
    { id: '2', url: 'https://crm.external.io/hooks/admission', event: 'admission.created', status: 'active' },
  ]);

  return (
    <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">Webhooks</h3>
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Receive real-time event notifications</p>
        </div>
        <button className="w-10 h-10 bg-neon-purple/10 border border-neon-purple/20 rounded-xl text-neon-purple flex items-center justify-center hover:bg-neon-purple/20 transition-all shadow-[0_0_15px_rgba(188,19,254,0.2)]">
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {webhooks.map((webhook) => (
          <div key={webhook.id} className="p-4 bg-cyber-black/50 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-neon-purple/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-neon-purple/10 rounded-xl flex items-center justify-center border border-neon-purple/20">
                <Webhook size={18} className="text-neon-purple" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{webhook.event}</span>
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase rounded-full">Active</span>
                </div>
                <p className="text-[10px] text-gray-500 font-mono truncate max-w-[200px] md:max-w-xs">{webhook.url}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 text-gray-500 hover:text-white transition-colors"><Settings size={14} /></button>
              <button className="p-2 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ApiDocumentation = () => {
  const [activeLang, setActiveLang] = useState<'curl' | 'nodejs' | 'python'>('curl');

  const codeSnippets = {
    curl: `curl -X POST https://api.edupak.com/v1/fees/pay \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "student_id": "STU_9921",
    "amount": 15000,
    "currency": "PKR"
  }'`,
    nodejs: `const axios = require('axios');

const response = await axios.post('https://api.edupak.com/v1/fees/pay', {
  student_id: 'STU_9921',
  amount: 15000,
  currency: 'PKR'
}, {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});`,
    python: `import requests

url = "https://api.edupak.com/v1/fees/pay"
payload = {
    "student_id": "STU_9921",
    "amount": 15000,
    "currency": "PKR"
}
headers = { "Authorization": "Bearer YOUR_API_KEY" }

response = requests.post(url, json=payload, headers=headers)`
  };

  return (
    <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 lg:col-span-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">API Documentation</h3>
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Integrate EduPak into your existing workflow</p>
        </div>
        <button className="flex items-center gap-2 text-neon-blue text-[10px] font-black uppercase tracking-widest hover:underline">
          Full Documentation <ExternalLink size={14} />
        </button>
      </div>

      <div className="bg-cyber-black/80 rounded-3xl border border-white/10 overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 bg-white/5 border-b border-white/10">
          {(['curl', 'nodejs', 'python'] as const).map((lang) => (
            <button 
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeLang === lang ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {lang === 'curl' ? 'cURL' : lang === 'nodejs' ? 'Node.js' : 'Python'}
            </button>
          ))}
        </div>
        <div className="p-6 font-mono text-xs leading-relaxed overflow-x-auto">
          <pre className="text-gray-300">
            <code>{codeSnippets[activeLang]}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const SecuritySettings = () => {
  return (
    <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5">
      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-8">Security & Limits</h3>
      
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Globe className="text-neon-blue" size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">IP Whitelisting</span>
            </div>
            <button className="text-neon-blue text-[10px] font-black uppercase tracking-widest hover:underline">Add IP</button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-cyber-black/50 rounded-xl border border-white/5">
              <span className="text-[10px] font-mono text-gray-400">192.168.1.105</span>
              <button className="text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
            <div className="flex items-center justify-between p-3 bg-cyber-black/50 rounded-xl border border-white/5">
              <span className="text-[10px] font-mono text-gray-400">45.22.11.90</span>
              <button className="text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="text-neon-purple" size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Rate Limiting</span>
            </div>
            <span className="text-neon-purple text-[10px] font-black uppercase tracking-widest">60 req/min</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '45%' }}
              className="h-full bg-gradient-to-r from-neon-blue to-neon-purple shadow-[0_0_10px_#00f3ff]"
            />
          </div>
          <p className="text-[9px] text-gray-500 mt-3 uppercase font-bold tracking-widest">Current usage: 27/60 requests</p>
        </div>
      </div>
    </div>
  );
};

const LiveLogs = () => {
  return (
    <div className="bg-cyber-gray/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">Live API Logs</h3>
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Real-time traffic monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Method</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Endpoint</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Speed</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {MOCK_LOGS.map((log) => (
              <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="py-4">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                    log.method === 'POST' ? 'bg-neon-blue/10 text-neon-blue' : 
                    log.method === 'GET' ? 'bg-neon-purple/10 text-neon-purple' : 
                    'bg-white/10 text-white'
                  }`}>
                    {log.method}
                  </span>
                </td>
                <td className="py-4 text-[10px] font-mono text-gray-400">{log.endpoint}</td>
                <td className="py-4">
                  <span className={`text-[10px] font-black ${log.status === 200 ? 'text-green-500' : 'text-red-400'}`}>
                    {log.status} {log.status === 200 ? 'OK' : 'Error'}
                  </span>
                </td>
                <td className="py-4 text-[10px] font-bold text-gray-500">{log.speed}</td>
                <td className="py-4 text-[10px] font-bold text-gray-600 text-right">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Component ---

const IntegrationHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'communication' | 'payments' | 'education' | 'accounting' | 'developer'>('communication');
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(item => 
      item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item
    ));
  };

  const filteredIntegrations = integrations.filter(item => 
    item.category === activeTab && 
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [
    { id: 'communication', label: 'Communication', icon: MessageSquare },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'education', label: 'Education', icon: BookOpen },
    { id: 'accounting', label: 'Accounting', icon: Database },
    { id: 'developer', label: 'Developer Tools', icon: Terminal },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4"
          >
            <Zap className="text-neon-blue" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-blue">Enterprise Integration Hub</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Connect Your <span className="text-neon-blue">Ecosystem.</span>
          </h2>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cyber-gray/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue/50 transition-all placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {categories.map((cat) => (
          <button 
            key={cat.id}
            onClick={() => setActiveTab(cat.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              activeTab === cat.id 
                ? 'bg-neon-blue text-black border-neon-blue shadow-[0_0_20px_rgba(0,243,255,0.3)]' 
                : 'bg-cyber-gray/40 text-gray-500 border-white/5 hover:border-white/20'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredIntegrations.map((item) => (
            <IntegrationCard 
              key={item.id} 
              integration={item} 
              onToggle={toggleIntegration} 
            />
          ))}
        </AnimatePresence>
        
        {/* Add Custom Integration Card */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          className="p-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center group hover:border-neon-blue/50 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-neon-blue/10 transition-colors">
            <Plus size={24} className="text-gray-500 group-hover:text-neon-blue" />
          </div>
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-white transition-colors">
            Request Integration
          </h3>
        </motion.button>
      </div>

      {/* Developer Section */}
      <div className="pt-20">
        <div className="flex items-center gap-4 mb-12">
          <div className="h-[1px] flex-grow bg-white/5" />
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-600">Developer & API Management</h3>
          <div className="h-[1px] flex-grow bg-white/5" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <ApiKeySection />
          <WebhookDashboard />
          <ApiDocumentation />
          <SecuritySettings />
          <div className="lg:col-span-2">
            <LiveLogs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationHub;
