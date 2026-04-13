import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Users, 
  GraduationCap, 
  Clock, 
  MapPin, 
  Lock, 
  Unlock, 
  Eye, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  ChevronRight, 
  Layout, 
  Settings,
  CheckCircle2,
  AlertCircle,
  FileText,
  Book,
  ClipboardList,
  MessageSquare,
  ArrowRight,
  Info,
  RefreshCw,
  Layers,
  UserCheck
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
  orderBy, 
  limit, 
  getDocs,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Types ---

interface ClassRoom {
  id: string;
  name: string;
  sections: Section[];
  schoolId: string;
}

interface Section {
  id: string;
  name: string;
  classTeacherId: string;
  classTeacherName: string;
  capacity: number;
  enrolledCount: number;
}

interface TimetableSlot {
  id: string;
  day: string; // Monday, Tuesday, etc.
  startTime: string;
  endTime: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  room: string;
  type: 'academic' | 'break';
}

interface SyllabusItem {
  id: string;
  subject: string;
  classId: string;
  topics: {
    title: string;
    isCompleted: boolean;
  }[];
  completionPercentage: number;
  schoolId: string;
}

interface SchoolDiaryEntry {
  id: string;
  date: string;
  classId: string;
  sectionId: string;
  subject: string;
  homework: string;
  schoolId: string;
}

// --- Constants ---

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM'
];

const MODULES = [
  { id: 'classes', label: 'Classes & Sections', icon: Layers },
  { id: 'timetable', label: 'Timetable Builder', icon: Calendar },
  { id: 'syllabus', label: 'Syllabus Tracker', icon: BookOpen },
  { id: 'diary', label: 'Digital Diary', icon: ClipboardList },
];

// --- Components ---

const AcademicClassesManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'timetable' | 'syllabus' | 'diary'>('classes');
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [diary, setDiary] = useState<SchoolDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', sections: [{ name: 'A', capacity: 40, classTeacherId: '', classTeacherName: '' }] });
  const [newSlot, setNewSlot] = useState<Partial<TimetableSlot>>({ day: 'Monday', startTime: '08:00 AM', type: 'academic' });

  useEffect(() => {
    if (!schoolId) return;

    // Fetch Classes
    const classesUnsub = onSnapshot(
      query(collection(db, 'classes'), where('schoolId', '==', schoolId)),
      (snap) => {
        setClasses(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassRoom)));
        setLoading(false);
      }
    );

    // Fetch Staff for Teacher Assignment
    const staffUnsub = onSnapshot(
      query(collection(db, 'staff'), where('schoolId', '==', schoolId)),
      (snap) => {
        setStaff(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id })));
      }
    );

    return () => {
      classesUnsub();
      staffUnsub();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass || !selectedSection) return;

    // Fetch Timetable for selected class/section
    const timetableUnsub = onSnapshot(
      query(
        collection(db, 'timetables'), 
        where('schoolId', '==', schoolId), 
        where('classId', '==', selectedClass),
        where('sectionId', '==', selectedSection)
      ),
      (snap) => {
        setTimetable(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimetableSlot)));
      }
    );

    return () => timetableUnsub();
  }, [selectedClass, selectedSection, schoolId]);

  const handleCreateClass = async () => {
    if (!newClass.name) return toast.error("Class name is required");
    try {
      await addDoc(collection(db, 'classes'), {
        ...newClass,
        schoolId,
        createdAt: serverTimestamp()
      });
      setIsClassModalOpen(false);
      setNewClass({ name: '', sections: [{ name: 'A', capacity: 40, classTeacherId: '', classTeacherName: '' }] });
      toast.success("Class structure created");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedClass || !selectedSection) return toast.error("Select class and section first");
    
    // Simple conflict detection
    const conflict = timetable.find(s => s.day === newSlot.day && s.startTime === newSlot.startTime);
    if (conflict) return toast.error("Time slot already occupied!");

    try {
      await addDoc(collection(db, 'timetables'), {
        ...newSlot,
        classId: selectedClass,
        sectionId: selectedSection,
        schoolId,
        createdAt: serverTimestamp()
      });
      setIsSlotModalOpen(false);
      toast.success("Timetable slot added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const generateTimetablePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const className = classes.find(c => c.id === selectedClass)?.name || '';
    
    doc.setFontSize(20);
    doc.text(`TIMETABLE: CLASS ${className} - SECTION ${selectedSection}`, 148, 20, { align: 'center' });
    
    const tableData = TIME_SLOTS.map(time => {
      const row = [time];
      DAYS.forEach(day => {
        const slot = timetable.find(s => s.day === day && s.startTime === time);
        row.push(slot ? `${slot.subject}\n(${slot.teacherName})` : '-');
      });
      return row;
    });

    (doc as any).autoTable({
      startY: 30,
      head: [['Time', ...DAYS]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [168, 85, 247] }
    });

    doc.save(`Timetable_${className}_${selectedSection}.pdf`);
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
            <BookOpen className="text-neon-purple" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-purple">Academic Management Suite</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Academic & <span className="text-neon-purple">Classes.</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-cyber-gray/40 backdrop-blur-md p-2 rounded-2xl border border-white/5">
            <div className="px-4 py-2 border-r border-white/10">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Total Classes</p>
              <p className="text-lg font-black text-white">{classes.length}</p>
            </div>
            <button 
              onClick={() => setIsClassModalOpen(true)}
              className="p-3 bg-neon-purple text-black rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {MODULES.map((tab) => (
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
        {activeTab === 'classes' && (
          <motion.div 
            key="classes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {classes.map((cls) => (
              <div key={cls.id} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 group hover:border-neon-purple/30 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="p-4 bg-neon-purple/10 rounded-2xl border border-neon-purple/20">
                    <Layers className="text-neon-purple" size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-500 hover:text-white transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => deleteDoc(doc(db, 'classes', cls.id))} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{cls.name}</h3>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">{cls.sections.length} Sections Defined</p>

                <div className="space-y-4">
                  {cls.sections.map((sec, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-white uppercase tracking-widest">Section {sec.name}</span>
                        <span className="text-[8px] font-black px-2 py-1 bg-green-500/10 text-green-400 rounded uppercase">
                          {sec.enrolledCount || 0} / {sec.capacity} Students
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <UserCheck size={12} className="text-neon-purple" />
                        {sec.classTeacherName || 'No Teacher Assigned'}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full mt-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Section
                </button>
              </div>
            ))}

            {/* Empty State / Add New */}
            <div 
              onClick={() => setIsClassModalOpen(true)}
              className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 border-dashed flex flex-col items-center justify-center text-center group hover:border-neon-purple/50 transition-all cursor-pointer min-h-[300px]"
            >
              <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="text-gray-500 group-hover:text-neon-purple" size={32} />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest">Define New Class</h4>
              <p className="text-[10px] text-gray-500 mt-2">Set up academic structure for a new grade</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'timetable' && (
          <motion.div 
            key="timetable"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Selection Bar */}
            <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 flex flex-wrap items-center gap-6">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Select Class</label>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neon-purple/50"
                >
                  <option value="">Choose Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Select Section</label>
                <select 
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-cyber-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neon-purple/50"
                >
                  <option value="">Choose Section</option>
                  {classes.find(c => c.id === selectedClass)?.sections.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button 
                  onClick={() => setIsSlotModalOpen(true)}
                  disabled={!selectedClass || !selectedSection}
                  className="px-6 py-3 bg-neon-purple text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all disabled:opacity-50"
                >
                  Add Slot
                </button>
                <button 
                  onClick={generateTimetablePDF}
                  disabled={!selectedClass || !selectedSection}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all disabled:opacity-50"
                >
                  <Printer size={20} />
                </button>
              </div>
            </div>

            {/* Timetable Grid */}
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 bg-white/[0.02] border border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Time</th>
                      {DAYS.map(day => (
                        <th key={day} className="p-4 bg-white/[0.02] border border-white/5 text-[10px] font-black text-white uppercase tracking-widest">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(time => (
                      <tr key={time}>
                        <td className="p-4 border border-white/5 text-center">
                          <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">{time}</span>
                        </td>
                        {DAYS.map(day => {
                          const slot = timetable.find(s => s.day === day && s.startTime === time);
                          return (
                            <td key={`${day}-${time}`} className="p-2 border border-white/5 min-w-[150px] h-24">
                              {slot ? (
                                <motion.div 
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className={`h-full p-3 rounded-xl border flex flex-col justify-between relative group ${
                                    slot.type === 'break' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-neon-purple/10 border-neon-purple/20'
                                  }`}
                                >
                                  <button 
                                    onClick={() => deleteDoc(doc(db, 'timetables', slot.id))}
                                    className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <X size={12} />
                                  </button>
                                  <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">{slot.subject}</p>
                                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-1">{slot.teacherName}</p>
                                  </div>
                                  <div className="flex items-center gap-1 text-[8px] text-neon-purple font-black uppercase tracking-widest">
                                    <MapPin size={8} /> {slot.room}
                                  </div>
                                </motion.div>
                              ) : (
                                <div className="h-full w-full rounded-xl border border-white/[0.02] border-dashed flex items-center justify-center group hover:border-white/10 transition-all">
                                  <Plus className="text-white/0 group-hover:text-white/10 transition-all" size={16} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'syllabus' && (
          <motion.div 
            key="syllabus"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Syllabus Tracker</h3>
                <button className="p-2 bg-neon-purple/10 text-neon-purple rounded-xl border border-neon-purple/20">
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-6">
                {[
                  { subject: 'Mathematics', class: 'Class 10-A', progress: 65, color: 'bg-blue-500' },
                  { subject: 'Physics', class: 'Class 10-A', progress: 40, color: 'bg-purple-500' },
                  { subject: 'Chemistry', class: 'Class 10-A', progress: 85, color: 'bg-green-500' },
                  { subject: 'English', class: 'Class 10-A', progress: 20, color: 'bg-yellow-500' },
                ].map((item, idx) => (
                  <div key={idx} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">{item.subject}</h4>
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{item.class}</p>
                      </div>
                      <span className="text-lg font-black text-white">{item.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        className={`h-full ${item.color} shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-neon-purple/10 rounded-[2rem] flex items-center justify-center border border-neon-purple/20">
                <Book className="text-neon-purple" size={32} />
              </div>
              <div>
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">Lesson Planner</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mt-2 leading-relaxed">
                  Teachers can upload and organize their daily lesson plans for administrative review and approval.
                </p>
              </div>
              <button className="px-8 py-4 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
                Upload Lesson Plan
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'diary' && (
          <motion.div 
            key="diary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Digital School Diary</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Daily homework & announcements</p>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-neon-purple text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
                <Plus size={16} /> New Diary Entry
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { date: 'Today', subject: 'Mathematics', class: '10-A', content: 'Complete Exercise 4.2 and solve the first 5 problems of Chapter 5.', status: 'Sent' },
                { date: 'Today', subject: 'Physics', class: '10-A', content: 'Read the chapter on Electromagnetism and prepare for a surprise quiz.', status: 'Sent' },
                { date: 'Yesterday', subject: 'English', class: '10-A', content: 'Write an essay on "The Impact of AI on Education" (500 words).', status: 'Delivered' },
              ].map((entry, idx) => (
                <div key={idx} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-neon-purple uppercase tracking-widest">{entry.date}</span>
                    <span className="text-[8px] font-black px-2 py-1 bg-green-500/10 text-green-400 rounded uppercase">{entry.status}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{entry.subject}</h4>
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Class {entry.class}</p>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{entry.content}</p>
                  <div className="pt-4 flex justify-end gap-2">
                    <button className="p-2 text-gray-500 hover:text-white transition-colors"><Edit2 size={14} /></button>
                    <button className="p-2 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Class Modal */}
      <AnimatePresence>
        {isClassModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClassModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-[2.5rem] border border-white/10 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Define New Class</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Class Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Class 10"
                    value={newClass.name}
                    onChange={(e) => setNewClass({...newClass, name: e.target.value})}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Initial Section</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text"
                      placeholder="Section Name (A)"
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50"
                    />
                    <input 
                      type="number"
                      placeholder="Capacity (40)"
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleCreateClass}
                  className="w-full py-5 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all"
                >
                  Create Class Structure
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slot Modal */}
      <AnimatePresence>
        {isSlotModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSlotModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-[2.5rem] border border-white/10 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Add Timetable Slot</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Day</label>
                    <select 
                      value={newSlot.day}
                      onChange={(e) => setNewSlot({...newSlot, day: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-xs text-white outline-none focus:border-neon-purple/50"
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Start Time</label>
                    <select 
                      value={newSlot.startTime}
                      onChange={(e) => setNewSlot({...newSlot, startTime: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-xs text-white outline-none focus:border-neon-purple/50"
                    >
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subject</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={newSlot.subject}
                    onChange={(e) => setNewSlot({...newSlot, subject: e.target.value})}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Assign Teacher</label>
                  <select 
                    value={newSlot.teacherId}
                    onChange={(e) => {
                      const t = staff.find(s => s.uid === e.target.value);
                      setNewSlot({...newSlot, teacherId: e.target.value, teacherName: t?.name || ''});
                    }}
                    className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-xs text-white outline-none focus:border-neon-purple/50"
                  >
                    <option value="">Select Teacher</option>
                    {staff.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Room / Lab</label>
                    <input 
                      type="text"
                      placeholder="Room 101"
                      value={newSlot.room}
                      onChange={(e) => setNewSlot({...newSlot, room: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:border-neon-purple/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Slot Type</label>
                    <select 
                      value={newSlot.type}
                      onChange={(e) => setNewSlot({...newSlot, type: e.target.value as any})}
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-4 text-xs text-white outline-none focus:border-neon-purple/50"
                    >
                      <option value="academic">Academic</option>
                      <option value="break">Break / Lunch</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleAddSlot}
                  className="w-full py-5 bg-neon-purple text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all"
                >
                  Save Slot to Timetable
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicClassesManagement;
