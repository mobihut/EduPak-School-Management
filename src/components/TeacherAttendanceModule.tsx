import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Save, 
  ArrowLeft,
  Users,
  Search,
  Filter,
  User,
  Check,
  X,
  Info
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface AttendanceEntry {
  student_id: string;
  status: 'P' | 'A' | 'L';
  remarks: string;
  student_name: string;
  roll_number?: string;
}

interface AttendanceRecord {
  school_id: string;
  date: string;
  class: string;
  section: string;
  marked_by_uid: string;
  created_at: any;
  records: AttendanceEntry[];
}

interface TeacherClass {
  class: string;
  section: string;
}

const TeacherAttendanceModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<TeacherClass[]>([]);
  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchAssignedClasses = async () => {
      if (!userProfile.uid || !userProfile.schoolId) return;
      
      try {
        // Fetch teacher's assigned classes from timetables
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
                const key = `${data.class}-${data.section}`;
                if (!classesSet.has(key)) {
                  classesSet.add(key);
                  classes.push({ class: data.class, section: data.section });
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
    if (selectedClass) {
      fetchRoster();
    }
  }, [selectedClass, selectedDate]);

  const fetchRoster = async () => {
    if (!selectedClass) return;

    setIsLoading(true);
    try {
      const docId = `${userProfile.schoolId}_${selectedDate}_${selectedClass.class}_${selectedClass.section}`;
      const existingDoc = await getDoc(doc(db, 'attendance_records', docId));

      if (existingDoc.exists()) {
        const data = existingDoc.data() as AttendanceRecord;
        setRoster(data.records);
      } else {
        // Fetch students for this class/section
        const studentsQuery = query(
          collection(db, 'students'),
          where('school_id', '==', userProfile.schoolId),
          where('academic_info.grade', '==', selectedClass.class),
          where('academic_info.section', '==', selectedClass.section)
        );
        const studentSnap = await getDocs(studentsQuery);
        const newRoster: AttendanceEntry[] = studentSnap.docs.map(doc => {
          const s = doc.data();
          return {
            student_id: doc.id,
            student_name: `${s.personal_info.firstName} ${s.personal_info.lastName}`,
            roll_number: s.academic_info.rollNumber,
            status: 'P',
            remarks: ''
          };
        });
        setRoster(newRoster.sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || '')));
      }
    } catch (error) {
      console.error("Error fetching roster:", error);
      toast.error("Failed to load student list");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = (studentId: string, status: 'P' | 'A' | 'L') => {
    setRoster(prev => prev.map(entry => 
      entry.student_id === studentId ? { ...entry, status } : entry
    ));
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;
    
    setIsSaving(true);
    try {
      const docId = `${userProfile.schoolId}_${selectedDate}_${selectedClass.class}_${selectedClass.section}`;
      const record: AttendanceRecord = {
        school_id: userProfile.schoolId,
        date: selectedDate,
        class: selectedClass.class,
        section: selectedClass.section,
        marked_by_uid: userProfile.uid,
        created_at: serverTimestamp(),
        records: roster
      };

      await setDoc(doc(db, 'attendance_records', docId), record);
      toast.success("Attendance saved successfully!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRoster = roster.filter(s => 
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    return {
      present: roster.filter(r => r.status === 'P').length,
      absent: roster.filter(r => r.status === 'A').length,
      leave: roster.filter(r => r.status === 'L').length,
      total: roster.length
    };
  }, [roster]);

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
            <h1 className="text-xl font-black uppercase tracking-tighter">Mark Attendance</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Daily Classroom Check-in
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Class</label>
              <select
                value={selectedClass ? `${selectedClass.class}-${selectedClass.section}` : ''}
                onChange={(e) => {
                  const [c, s] = e.target.value.split('-');
                  setSelectedClass({ class: c, section: s });
                }}
                className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
              >
                {assignedClasses.map(c => (
                  <option key={`${c.class}-${c.section}`} value={`${c.class}-${c.section}`}>
                    Class {c.class}-{c.section}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
              Present: {stats.present}
            </div>
            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest">
              Absent: {stats.absent}
            </div>
            <div className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
              Leave: {stats.leave}
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-cyber-gray/10 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all"
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Clock className="text-neon-blue animate-spin" size={32} />
              </div>
            ) : filteredRoster.map((student) => (
              <motion.div 
                layout
                key={student.student_id}
                className="bg-cyber-gray/10 border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-cyber-black border border-white/5 flex items-center justify-center text-neon-blue font-black text-xs shrink-0">
                    {student.roll_number || '??'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-tight truncate">{student.student_name}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Roll No: {student.roll_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(student.student_id, 'P')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${student.status === 'P' ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-cyber-black text-gray-500 border border-white/5'}`}
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => updateStatus(student.student_id, 'A')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${student.status === 'A' ? 'bg-red-500 text-black shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-cyber-black text-gray-500 border border-white/5'}`}
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={() => updateStatus(student.student_id, 'L')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${student.status === 'L' ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-cyber-black text-gray-500 border border-white/5'}`}
                  >
                    <span className="text-[10px] font-black">L</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-6 left-4 right-4 md:relative md:bottom-0 md:left-0 md:right-0">
          <button
            onClick={saveAttendance}
            disabled={isSaving || roster.length === 0}
            className="w-full bg-neon-blue text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,243,255,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
            Submit Attendance
          </button>
        </div>

      </div>
    </div>
  );
};

export default TeacherAttendanceModule;
