import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Save, 
  ArrowLeft, 
  Clock, 
  Paperclip, 
  X, 
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface TeacherClass {
  class: string;
  section: string;
  subject: string;
}

interface DiaryEntry {
  id: string;
  title: string;
  description: string;
  due_date: string;
  subject: string;
  class: string;
  section: string;
  created_at: any;
  attachments: string[];
}

const TeacherClassDiaryModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);

  useEffect(() => {
    const fetchAssignedClasses = async () => {
      if (!userProfile.uid || !userProfile.schoolId) return;
      
      try {
        const q = query(collection(db, 'timetables'), where('school_id', '==', userProfile.schoolId));
        const snapshot = await getDocs(q);
        
        const classesSet = new Set<string>();
        const classes: TeacherClass[] = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const schedule = data.schedule || {};
          
          Object.values(schedule).forEach((daySchedule: any) => {
            Object.values(daySchedule).forEach((slot: any) => {
              if (slot.teacher_id === userProfile.uid) {
                const key = `${data.class}-${data.section}-${slot.subject}`;
                if (!classesSet.has(key)) {
                  classesSet.add(key);
                  classes.push({ class: data.class, section: data.section, subject: slot.subject });
                }
              }
            });
          });
        });
        
        setAssignedClasses(classes);
        if (classes.length > 0) setSelectedClass(classes[0]);
      } catch (error) {
        console.error("Error fetching assigned classes:", error);
      }
    };

    fetchAssignedClasses();
  }, [userProfile.uid, userProfile.schoolId]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchEntries();
    }
  }, [activeTab]);

  const fetchEntries = async () => {
    if (!userProfile.schoolId) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'assignments'),
        where('school_id', '==', userProfile.schoolId),
        where('teacher_uid', '==', userProfile.uid),
        orderBy('created_at', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiaryEntry)));
    } catch (error) {
      console.error("Error fetching diary entries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !title || !description) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        school_id: userProfile.schoolId,
        teacher_uid: userProfile.uid,
        teacher_name: userProfile.name,
        class: selectedClass.class,
        section: selectedClass.section,
        subject: selectedClass.subject,
        title,
        description,
        due_date: dueDate,
        attachments: [],
        created_at: serverTimestamp(),
        type: 'homework'
      });

      toast.success("Homework posted successfully!");
      setTitle('');
      setDescription('');
      setActiveTab('list');
    } catch (error) {
      console.error("Error posting homework:", error);
      toast.error("Failed to post homework");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-3 rounded-2xl bg-cyber-gray/20 border border-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Class Diary</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Post Homework & Updates
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab(activeTab === 'list' ? 'create' : 'list')}
            className="px-6 py-3 bg-neon-pink text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,0,255,0.2)] flex items-center gap-2"
          >
            {activeTab === 'list' ? <Plus size={16} /> : <FileText size={16} />}
            {activeTab === 'list' ? 'New Entry' : 'View History'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'create' ? (
            <motion.form 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleSubmit}
              className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-8 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Select Class & Subject</label>
                  <select
                    value={selectedClass ? `${selectedClass.class}-${selectedClass.section}-${selectedClass.subject}` : ''}
                    onChange={(e) => {
                      const [c, s, sub] = e.target.value.split('-');
                      setSelectedClass({ class: c, section: s, subject: sub });
                    }}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-pink transition-all"
                  >
                    {assignedClasses.map(c => (
                      <option key={`${c.class}-${c.section}-${c.subject}`} value={`${c.class}-${c.section}-${c.subject}`}>
                        Class {c.class}-{c.section} • {c.subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-pink transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Title / Topic</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Algebra Exercise 4.2"
                  className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-pink transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Description / Instructions</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Provide detailed instructions for the students..."
                  className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-neon-pink transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Attachments (Images/Notes)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    type="button"
                    className="aspect-square bg-cyber-black border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-neon-pink hover:border-neon-pink/50 transition-all"
                  >
                    <ImageIcon size={24} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Add Image</span>
                  </button>
                  <button
                    type="button"
                    className="aspect-square bg-cyber-black border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-neon-pink hover:border-neon-pink/50 transition-all"
                  >
                    <Paperclip size={24} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Add File</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-neon-pink text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,0,255,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
                  Post to Class Diary
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {isLoading ? (
                <div className="py-20 flex justify-center">
                  <Clock className="text-neon-pink animate-spin" size={48} />
                </div>
              ) : entries.length === 0 ? (
                <div className="py-20 text-center bg-cyber-gray/10 rounded-3xl border border-white/5">
                  <BookOpen className="mx-auto text-gray-700 mb-4" size={48} />
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No diary entries found</p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="bg-cyber-gray/10 border border-white/5 rounded-3xl p-6 hover:border-neon-pink/30 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-1 bg-neon-pink/10 text-neon-pink text-[8px] font-black uppercase tracking-widest rounded-md border border-neon-pink/20">
                            {entry.subject}
                          </span>
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                            Class {entry.class}-{entry.section}
                          </span>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-neon-pink transition-colors">
                          {entry.title}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Due Date</p>
                        <p className="text-xs font-black text-neon-pink">{entry.due_date}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6 line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-gray-600" />
                        <span className="text-[10px] text-gray-600 font-bold uppercase">
                          Posted: {entry.created_at?.toDate().toLocaleDateString()}
                        </span>
                      </div>
                      <button className="text-[10px] font-black text-neon-pink uppercase tracking-widest hover:underline">
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default TeacherClassDiaryModule;
