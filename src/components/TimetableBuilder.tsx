import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Save, 
  Printer, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ChevronRight,
  LayoutGrid,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface TimetableSlot {
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

interface DaySchedule {
  [period: string]: TimetableSlot;
}

interface Timetable {
  timetable_id: string;
  school_id: string;
  class: string;
  section: string;
  term: string;
  schedule: {
    [day: string]: DaySchedule;
  };
  updated_by: string;
  timestamp: any;
}

interface Staff {
  staff_id: string;
  name: string;
  designation: string;
  department: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = ['Period 1', 'Period 2', 'Period 3', 'Break', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'];

const TimetableBuilder: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('First Term 2026');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allTimetables, setAllTimetables] = useState<Timetable[]>([]);
  const [currentTimetable, setCurrentTimetable] = useState<Timetable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: string; period: string } | null>(null);
  const [modalSubject, setModalSubject] = useState('');
  const [modalTeacherId, setModalTeacherId] = useState('');

  const classes = ['Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  const sections = ['A', 'B', 'C', 'D'];

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Fetch User's School ID
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser.uid)));
        const schoolId = userDoc.docs[0]?.data()?.schoolId;
        
        if (!schoolId) return;

        // Fetch Staff
        const staffQuery = query(collection(db, 'staff'), where('school_id', '==', schoolId), where('is_active', '==', true));
        const staffSnap = await getDocs(staffQuery);
        setStaff(staffSnap.docs.map(d => d.data() as Staff));

        // Listen to all timetables for clash detection
        const ttQuery = query(collection(db, 'timetables'), where('school_id', '==', schoolId));
        const unsubscribe = onSnapshot(ttQuery, (snap) => {
          const tts = snap.docs.map(d => d.data() as Timetable);
          setAllTimetables(tts);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error('Failed to load school data');
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection && selectedTerm) {
      const tt = allTimetables.find(t => 
        t.class === selectedClass && 
        t.section === selectedSection && 
        t.term === selectedTerm
      );
      
      if (tt) {
        setCurrentTimetable(tt);
      } else {
        setCurrentTimetable({
          timetable_id: `${selectedClass}-${selectedSection}-${selectedTerm}`.replace(/\s+/g, '-').toLowerCase(),
          school_id: '', // Will be filled on save
          class: selectedClass,
          section: selectedSection,
          term: selectedTerm,
          schedule: {},
          updated_by: auth.currentUser?.uid || '',
          timestamp: null
        });
      }
    }
  }, [selectedClass, selectedSection, selectedTerm, allTimetables]);

  const checkTeacherClash = (teacherId: string, day: string, period: string) => {
    const clash = allTimetables.find(tt => {
      // Don't check against the current class/section we are editing
      if (tt.class === selectedClass && tt.section === selectedSection && tt.term === selectedTerm) return false;
      
      const slot = tt.schedule[day]?.[period];
      return slot?.teacher_id === teacherId;
    });

    return clash;
  };

  const handleCellClick = (day: string, period: string) => {
    if (period === 'Break') return;
    
    const existingSlot = currentTimetable?.schedule[day]?.[period];
    setActiveSlot({ day, period });
    setModalSubject(existingSlot?.subject || '');
    setModalTeacherId(existingSlot?.teacher_id || '');
    setIsModalOpen(true);
  };

  const saveSlot = () => {
    if (!activeSlot || !currentTimetable) return;

    const { day, period } = activeSlot;

    if (modalTeacherId) {
      const clash = checkTeacherClash(modalTeacherId, day, period);
      if (clash) {
        const teacherName = staff.find(s => s.staff_id === modalTeacherId)?.name || 'Teacher';
        toast.error(`Clash Detected! ${teacherName} is already teaching ${clash.class}-${clash.section} during ${period} on ${day}.`, {
          duration: 5000
        });
        return;
      }
    }

    const teacherName = staff.find(s => s.staff_id === modalTeacherId)?.name || '';
    
    const newSchedule = { ...currentTimetable.schedule };
    if (!newSchedule[day]) newSchedule[day] = {};
    
    if (!modalSubject && !modalTeacherId) {
      delete newSchedule[day][period];
    } else {
      newSchedule[day][period] = {
        subject: modalSubject,
        teacher_id: modalTeacherId,
        teacher_name: teacherName
      };
    }

    setCurrentTimetable({ ...currentTimetable, schedule: newSchedule });
    setIsModalOpen(false);
  };

  const saveFullTimetable = async () => {
    if (!currentTimetable || !selectedClass || !selectedSection) {
      toast.error('Please select class and section');
      return;
    }

    setIsSaving(true);
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser?.uid)));
      const schoolId = userDoc.docs[0]?.data()?.schoolId;

      const timetableData = {
        ...currentTimetable,
        school_id: schoolId,
        updated_by: auth.currentUser?.uid,
        timestamp: serverTimestamp()
      };

      await setDoc(doc(db, 'timetables', currentTimetable.timetable_id), timetableData);
      toast.success('Timetable saved successfully!');
    } catch (error) {
      console.error('Error saving timetable:', error);
      toast.error('Failed to save timetable');
    } finally {
      setIsSaving(false);
    }
  };

  const clearTimetable = () => {
    if (window.confirm('Are you sure you want to clear this entire timetable?')) {
      setCurrentTimetable(prev => prev ? { ...prev, schedule: {} } : null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getTeacherAvailability = (day: string, period: string) => {
    return staff.filter(s => !checkTeacherClash(s.staff_id, day, period));
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white p-4 md:p-8 font-sans">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: white !important; 
            color: black !important;
            padding: 20px;
          }
          .no-print { display: none !important; }
          .print-area table { border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td { border: 1px solid #ccc; padding: 8px; text-align: center; }
          .print-area h1, .print-area h2 { color: black !important; text-align: center; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink">
              Timetable Builder
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">
              Academic Scheduling & Clash Detection
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl border border-white/10 transition-all flex items-center gap-2 font-black uppercase tracking-widest text-xs"
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={saveFullTimetable}
              disabled={isSaving || !selectedClass || !selectedSection}
              className="bg-neon-blue text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
              Save Timetable
            </button>
          </div>
        </div>

        {/* Control Strip */}
        <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5 no-print">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
              >
                <option value="">Choose Class...</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
              >
                <option value="">Choose Section...</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Term / Semester</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
              >
                <option value="First Term 2026">First Term 2026</option>
                <option value="Mid Term 2026">Mid Term 2026</option>
                <option value="Final Term 2026">Final Term 2026</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="bg-cyber-gray/20 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden print-area">
          <div className="p-6 border-b border-white/5 flex justify-between items-center no-print">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
              <LayoutGrid className="text-neon-blue" size={20} />
              Weekly Schedule
            </h2>
            <button 
              onClick={clearTimetable}
              className="text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </div>

          <div className="hidden print:block mb-8 text-center">
            <h1 className="text-3xl font-bold">Academic Timetable</h1>
            <h2 className="text-xl text-gray-600 mt-2">Class: {selectedClass} | Section: {selectedSection} | {selectedTerm}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-4 bg-cyber-black/40 border-r border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 w-32">Day / Period</th>
                  {PERIODS.map(period => (
                    <th key={period} className={`p-4 bg-cyber-black/40 border-b border-white/5 text-[10px] font-black uppercase tracking-widest ${period === 'Break' ? 'text-neon-pink' : 'text-gray-500'}`}>
                      {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td className="p-4 bg-cyber-black/40 border-r border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-neon-blue">
                      {day}
                    </td>
                    {PERIODS.map(period => {
                      const slot = currentTimetable?.schedule[day]?.[period];
                      const isBreak = period === 'Break';
                      
                      return (
                        <td 
                          key={period} 
                          onClick={() => handleCellClick(day, period)}
                          className={`p-2 border-b border-r border-white/5 min-w-[140px] h-24 transition-all ${!isBreak ? 'cursor-pointer hover:bg-white/5' : 'bg-neon-pink/5'}`}
                        >
                          {isBreak ? (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-pink rotate-90 md:rotate-0">RECESS</span>
                            </div>
                          ) : slot ? (
                            <div className="flex flex-col justify-center h-full p-2 rounded-lg bg-neon-blue/5 border border-neon-blue/20 group relative">
                              <p className="text-xs font-black text-neon-blue uppercase truncate">{slot.subject}</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 truncate flex items-center gap-1">
                                <User size={10} />
                                {slot.teacher_name}
                              </p>
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                <Plus size={12} className="text-neon-blue" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity no-print">
                              <Plus size={20} className="text-gray-700" />
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

        {/* Teacher Availability Panel */}
        {activeSlot && !isModalOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5 no-print"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <User className="text-neon-purple" size={18} />
                Teacher Availability: {activeSlot.day} - {activeSlot.period}
              </h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {getTeacherAvailability(activeSlot.day, activeSlot.period).map(t => (
                <div key={t.staff_id} className="bg-cyber-black/60 px-4 py-2 rounded-lg border border-white/5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold uppercase">{t.name}</span>
                </div>
              ))}
              {getTeacherAvailability(activeSlot.day, activeSlot.period).length === 0 && (
                <p className="text-xs text-gray-500 italic">No teachers available for this slot.</p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Assignment Modal */}
      <AnimatePresence>
        {isModalOpen && activeSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-cyber-gray border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 bg-cyber-black/40">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-neon-blue">Assign Slot</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                      {activeSlot.day} • {activeSlot.period}
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Subject Name</label>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={modalSubject}
                      onChange={(e) => setModalSubject(e.target.value)}
                      placeholder="e.g. Mathematics"
                      className="w-full bg-cyber-black border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Assign Teacher</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <select
                      value={modalTeacherId}
                      onChange={(e) => setModalTeacherId(e.target.value)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all appearance-none"
                    >
                      <option value="">Select Teacher...</option>
                      {staff.map(t => {
                        const clash = checkTeacherClash(t.staff_id, activeSlot.day, activeSlot.period);
                        return (
                          <option key={t.staff_id} value={t.staff_id} disabled={!!clash}>
                            {t.name} {clash ? '(CLASH)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {modalTeacherId && checkTeacherClash(modalTeacherId, activeSlot.day, activeSlot.period) && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" size={18} />
                    <p className="text-[10px] text-red-400 font-bold uppercase leading-relaxed">
                      This teacher is already assigned to another class during this period.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setModalSubject('');
                      setModalTeacherId('');
                    }}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                  >
                    Clear Slot
                  </button>
                  <button
                    onClick={saveSlot}
                    className="flex-2 bg-neon-blue text-black py-4 px-8 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimetableBuilder;
