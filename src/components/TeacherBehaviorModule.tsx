import React, { useState, useEffect } from 'react';
import { 
  Star, 
  AlertTriangle, 
  MessageSquare, 
  Search, 
  ArrowLeft, 
  Save, 
  Clock,
  User,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  class: string;
  section: string;
}

interface BehaviorRecord {
  id: string;
  student_id: string;
  student_name: string;
  type: 'star' | 'warning' | 'note';
  category: string;
  points: number;
  description: string;
  created_at: any;
  teacher_name: string;
}

const TeacherBehaviorModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<BehaviorRecord[]>([]);

  // Form State
  const [type, setType] = useState<'star' | 'warning' | 'note'>('star');
  const [category, setCategory] = useState('Academic Excellence');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchStudents();
    fetchRecentLogs();
  }, [userProfile.schoolId]);

  const fetchStudents = async () => {
    if (!userProfile.schoolId) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('school_id', '==', userProfile.schoolId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const s = doc.data();
        return {
          id: doc.id,
          name: `${s.personal_info.firstName} ${s.personal_info.lastName}`,
          rollNumber: s.academic_info.rollNumber,
          class: s.academic_info.grade,
          section: s.academic_info.section
        };
      });
      setStudents(data);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentLogs = async () => {
    if (!userProfile.schoolId) return;
    try {
      const q = query(
        collection(db, 'behavior_records'),
        where('school_id', '==', userProfile.schoolId),
        where('teacher_uid', '==', userProfile.uid),
        orderBy('created_at', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      setRecentLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BehaviorRecord)));
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudent || !description) {
      toast.error("Please select a student and provide a description");
      return;
    }

    setIsSubmitting(true);
    try {
      const points = type === 'star' ? 10 : type === 'warning' ? -10 : 0;
      await addDoc(collection(db, 'behavior_records'), {
        school_id: userProfile.schoolId,
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        teacher_uid: userProfile.uid,
        teacher_name: userProfile.name,
        type,
        category,
        points,
        description,
        created_at: serverTimestamp()
      });

      toast.success(`Behavior ${type} logged for ${selectedStudent.name}`);
      setDescription('');
      setSelectedStudent(null);
      fetchRecentLogs();
    } catch (error) {
      console.error("Error logging behavior:", error);
      toast.error("Failed to log behavior");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 rounded-2xl bg-cyber-gray/20 border border-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Behavior Tracker</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Log Stars, Warnings & Notes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Selection & Form */}
          <div className="space-y-6">
            <div className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-6 space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-neon-blue">1. Select Student</h2>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text"
                  placeholder="Search student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {isLoading ? (
                  <div className="py-8 flex justify-center"><Clock className="animate-spin text-neon-blue" /></div>
                ) : filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between group ${
                      selectedStudent?.id === s.id 
                        ? 'bg-neon-blue/10 border-neon-blue text-neon-blue' 
                        : 'bg-cyber-black/40 border-white/5 text-gray-400 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                        selectedStudent?.id === s.id ? 'bg-neon-blue text-black' : 'bg-cyber-gray/20'
                      }`}>
                        {s.rollNumber || '??'}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-tight">{s.name}</p>
                        <p className="text-[8px] font-bold uppercase opacity-60">Class {s.class}-{s.section}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className={selectedStudent?.id === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} />
                  </button>
                ))}
              </div>
            </div>

            {selectedStudent && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-6 space-y-6"
              >
                <h2 className="text-xs font-black uppercase tracking-widest text-neon-purple">2. Log Incident</h2>
                
                <div className="flex gap-2">
                  {[
                    { id: 'star', icon: Star, label: 'Star', color: 'yellow-400' },
                    { id: 'warning', icon: AlertTriangle, label: 'Warning', color: 'red-500' },
                    { id: 'note', icon: MessageSquare, label: 'Note', color: 'neon-blue' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id as any)}
                      className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                        type === t.id 
                          ? `bg-${t.color}/10 border-${t.color} text-${t.color} shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
                          : 'bg-cyber-black/40 border-white/5 text-gray-500'
                      }`}
                    >
                      <t.icon size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-purple transition-all"
                  >
                    <option>Academic Excellence</option>
                    <option>Discipline Issue</option>
                    <option>Helping Others</option>
                    <option>Late Arrival</option>
                    <option>Uniform Violation</option>
                    <option>Outstanding Participation</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Details</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe the incident or reason for the star/warning..."
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-neon-purple transition-all resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-neon-purple text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(188,19,254,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
                  Submit Log
                </button>
              </motion.div>
            )}
          </div>

          {/* Right Column: Recent Logs */}
          <div className="space-y-6">
            <div className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-6 h-full">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                <Clock size={14} /> Your Recent Logs
              </h2>
              
              <div className="space-y-4">
                {recentLogs.length === 0 ? (
                  <div className="py-20 text-center opacity-30">
                    <MessageSquare className="mx-auto mb-4" size={48} />
                    <p className="text-[10px] font-black uppercase tracking-widest">No recent logs</p>
                  </div>
                ) : recentLogs.map(log => (
                  <div key={log.id} className="bg-cyber-black/40 border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          log.type === 'star' ? 'bg-yellow-400/10 text-yellow-400' : 
                          log.type === 'warning' ? 'bg-red-500/10 text-red-500' : 
                          'bg-neon-blue/10 text-neon-blue'
                        }`}>
                          {log.type === 'star' ? <Star size={16} /> : 
                           log.type === 'warning' ? <AlertTriangle size={16} /> : 
                           <MessageSquare size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight">{log.student_name}</p>
                          <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{log.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black ${log.points >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {log.points > 0 ? `+${log.points}` : log.points} pts
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed italic">"{log.description}"</p>
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <Clock size={10} className="text-gray-600" />
                      <span className="text-[8px] text-gray-600 font-bold uppercase">
                        {log.created_at?.toDate().toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TeacherBehaviorModule;
