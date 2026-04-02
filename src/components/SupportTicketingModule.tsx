import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Paperclip, 
  MoreVertical, 
  X,
  ChevronRight,
  User,
  School,
  ShieldCheck,
  History,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { 
  useSupportTickets, 
  useTicketMessages, 
  useSupportAnalytics, 
  updateTicketStatus 
} from '../hooks/useSupport';
import { SupportTicket, TicketStatus, TicketPriority } from '../types/support';
import { auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SupportTicketingModule: React.FC = () => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ status?: TicketStatus; priority?: TicketPriority; search?: string }>({});
  const { tickets, loading: ticketsLoading } = useSupportTickets(filters);
  const stats = useSupportAnalytics();

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Top Analytics Strip */}
      <div className="flex items-center gap-6 p-6 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className={`flex flex-col gap-1 p-4 rounded-2xl border ${stats.totalOpen > 10 ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-white/10 bg-white/5'}`}>
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">Total Open Tickets</span>
          <span className={`text-3xl font-black ${stats.totalOpen > 10 ? 'text-red-500' : 'text-white'}`}>{stats.totalOpen}</span>
        </div>
        <div className="flex flex-col gap-1 p-4 rounded-2xl border border-white/10 bg-white/5">
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">Avg Resolution Time</span>
          <span className="text-3xl font-black text-cyan-400">{stats.avgResolutionTime}</span>
        </div>
        <div className="flex flex-col gap-1 p-4 rounded-2xl border border-white/10 bg-white/5">
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">Pending Reply</span>
          <span className="text-3xl font-black text-purple-500">{stats.pendingReply}</span>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Ticket Queue */}
        <div className="w-1/3 border-r border-white/10 flex flex-col bg-white/2">
          <div className="p-4 flex flex-col gap-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text" 
                placeholder="Search tickets or schools..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {(['open', 'pending', 'resolved'] as TicketStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => setFilters(prev => ({ ...prev, status: prev.status === status ? undefined : status }))}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter transition-all ${filters.status === status ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                >
                  {status}
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 self-center mx-1" />
              {(['high', 'normal', 'low'] as TicketPriority[]).map(priority => (
                <button
                  key={priority}
                  onClick={() => setFilters(prev => ({ ...prev, priority: prev.priority === priority ? undefined : priority }))}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter transition-all ${filters.priority === priority ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {ticketsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-white/30 gap-2">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm font-medium">No tickets found</span>
              </div>
            ) : (
              tickets.map(ticket => (
                <TicketCard 
                  key={ticket.id} 
                  ticket={ticket} 
                  isSelected={selectedTicketId === ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Ticket Thread */}
        <div className="flex-1 flex flex-col bg-[#080808]">
          {selectedTicket ? (
            <TicketThread ticket={selectedTicket} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <MessageSquare className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-white/40 uppercase tracking-widest">Select a Ticket</h3>
                <p className="text-sm font-medium">Choose a conversation from the left to start helping.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TicketCard: React.FC<{ ticket: SupportTicket; isSelected: boolean; onClick: () => void }> = ({ ticket, isSelected, onClick }) => {
  const priorityColor = {
    high: 'text-red-500 bg-red-500/10 border-red-500/20',
    urgent: 'text-red-500 bg-red-500/10 border-red-500/20',
    normal: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    low: 'text-white/50 bg-white/5 border-white/10'
  }[ticket.priority];

  const statusColor = {
    open: 'bg-green-500',
    pending: 'bg-yellow-500',
    resolved: 'bg-white/20'
  }[ticket.status];

  return (
    <button 
      onClick={onClick}
      className={`w-full p-4 flex gap-4 border-b border-white/5 transition-all hover:bg-white/5 text-left group relative ${isSelected ? 'bg-white/5 border-l-4 border-l-cyan-500' : ''}`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center overflow-hidden">
          <User className="w-6 h-6 text-white/50" />
        </div>
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#050505] ${statusColor}`} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-cyan-500 truncate">{ticket.school_name}</span>
          <span className="text-[10px] font-bold text-white/30 whitespace-nowrap">
            {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
          </span>
        </div>
        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors truncate">{ticket.subject}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${priorityColor}`}>
            {ticket.priority}
          </span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">#{ticket.id.slice(-6)}</span>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 text-white/20 self-center transition-transform ${isSelected ? 'translate-x-1 text-cyan-500' : 'group-hover:translate-x-1'}`} />
    </button>
  );
};

const TicketThread: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
  const { messages, loading, sendMessage } = useTicketMessages(ticket.id);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `tickets/${ticket.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await sendMessage(`Sent an attachment: ${file.name}`, url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (confirm("Are you sure you want to resolve this ticket?")) {
      await updateTicketStatus(ticket.id, 'resolved');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <School className="w-8 h-8 text-cyan-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black uppercase tracking-tight">{ticket.subject}</h2>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                ticket.priority === 'high' ? 'border-red-500 text-red-500' : 'border-cyan-500 text-cyan-500'
              }`}>
                {ticket.priority}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-xs font-bold text-white/50">
                <User className="w-3 h-3" />
                <span>{ticket.school_name}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-1 text-xs font-bold text-white/50">
                <ShieldCheck className="w-3 h-3" />
                <span>School ID: {ticket.school_id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            value={ticket.status}
            onChange={(e) => updateTicketStatus(ticket.id, e.target.value as TicketStatus)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-cyan-500/50"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <MoreVertical className="w-5 h-5 text-white/50" />
          </button>
        </div>
      </div>

      {/* Message Thread */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.03)_0%,transparent_100%)]"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={msg.id}
              className={`flex ${msg.sender_role === 'support' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] flex flex-col gap-1 ${msg.sender_role === 'support' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-lg ${
                  msg.sender_role === 'support' 
                    ? 'bg-cyan-600 text-white rounded-tr-none shadow-cyan-500/10' 
                    : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                }`}>
                  {msg.text}
                  {msg.attachment_url && (
                    <a 
                      href={msg.attachment_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-black/20 hover:bg-black/40 transition-colors border border-white/10"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span className="text-xs font-bold truncate">View Attachment</span>
                    </a>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">
                  {msg.sender_name} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="p-6 border-t border-white/10 bg-white/2">
        {ticket.status === 'resolved' ? (
          <div className="flex items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-bold uppercase tracking-widest text-white/50">This ticket has been resolved.</span>
            <button 
              onClick={() => updateTicketStatus(ticket.id, 'open')}
              className="text-cyan-500 hover:underline text-sm font-black uppercase tracking-widest"
            >
              Re-open Ticket
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your reply here... (Shift + Enter for new line)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pr-32 min-h-[100px] text-sm focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
              />
              <div className="absolute right-4 bottom-4 flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5 text-white/50" />}
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-cyan-500 text-black font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">Canned Responses</button>
                <button className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">Internal Note</button>
              </div>
              <button 
                onClick={handleCloseTicket}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
              >
                <CheckCircle2 className="w-3 h-3" />
                Resolve Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTicketingModule;
