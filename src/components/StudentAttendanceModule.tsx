import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Save, 
  MessageSquare, 
  ChevronRight,
  User,
  AlertCircle,
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
import { toast } from 'sonner';

interface Student {
  id: string;
  student_id: string;
  personal_info: {
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  academic_info: {
    grade: string;
    section: string;
    rollNumber?: string;
  };
  guardian_info: {
    name: string;
    phone: string;
  };
}

interface AttendanceEntry {
  student_id: string;
  status: 'P' | 'A' | 'L';
  remarks: string;
  student_name: string; // Added for easier UI handling
  roll_number?: string;
  photo_url?: string;
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

const StudentAttendanceModule = ({ schoolId }: { schoolId: string }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sendSMS, setSendSMS] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Grades and Sections (In a real app, these would be fetched from school settings)
  const grades = ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const sections = ['A', 'B', 'C', 'D'];

  const fetchRoster = async () => {
    if (!selectedGrade || !selectedSection) {
      toast.error("Please select Grade and Section first");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Check if attendance already exists for this day/class/section
      const docId = `${schoolId}_${selectedDate}_${selectedGrade}_${selectedSection}`;
      const existingDoc = await getDoc(doc(db, 'attendance_records', docId));

      if (existingDoc.exists()) {
        const data = existingDoc.data() as AttendanceRecord;
        setRoster(data.records);
        toast.info("Existing attendance record loaded");
      } else {
        // 2. Fetch students for this class/section to create a new roster
        const q = query(
          collection(db, 'students'),
          where('school_id', '==', schoolId),
          where('academic_info.grade', '==', selectedGrade),
          where('academic_info.section', '==', selectedSection),
          where('status', '==', 'active')
        );

        const snap = await getDocs(q);
        const newRoster: AttendanceEntry[] = [];
        snap.forEach(doc => {
          const student = doc.data() as Student;
          newRoster.push({
            student_id: student.student_id,
            status: 'P', // Default to Present
            remarks: '',
            student_name: `${student.personal_info.firstName} ${student.personal_info.lastName}`,
            roll_number: student.academic_info.rollNumber,
            photo_url: student.personal_info.photoUrl
          });
        });

        // Sort by roll number if available
        newRoster.sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true }));
        
        setRoster(newRoster);
        if (newRoster.length === 0) {
          toast.warning("No active students found in this section");
        }
      }
    } catch (error) {
      console.error("Error fetching roster:", error);
      toast.error("Failed to fetch student roster");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = (studentId: string, status: 'P' | 'A' | 'L') => {
    setRoster(prev => prev.map(item => 
      item.student_id === studentId ? { ...item, status } : item
    ));
  };

  const markAll = (status: 'P' | 'A') => {
    setRoster(prev => prev.map(item => ({ ...item, status })));
  };

  const stats = useMemo(() => {
    const total = roster.length;
    const present = roster.filter(r => r.status === 'P').length;
    const absent = roster.filter(r => r.status === 'A').length;
    const leave = roster.filter(r => r.status === 'L').length;
    return { total, present, absent, leave };
  }, [roster]);

  const triggerAbsentSMS = (absentStudents: AttendanceEntry[]) => {
    console.log("Triggering SMS for absent students:", absentStudents);
    // Placeholder for SMS API Integration (e.g., Twilio, Vonage, or local gateway)
    /*
    absentStudents.forEach(student => {
      const message = `Dear Parent, your child ${student.student_name} is absent from school today (${selectedDate}). - EduPak Admin`;
      // callSmsApi(student.guardian_phone, message);
    });
    */
  };

  const saveAttendance = async () => {
    if (roster.length === 0) return;

    setIsSaving(true);
    try {
      const docId = `${schoolId}_${selectedDate}_${selectedGrade}_${selectedSection}`;
      const record: AttendanceRecord = {
        school_id: schoolId,
        date: selectedDate,
        class: selectedGrade,
        section: selectedSection,
        marked_by_uid: auth.currentUser?.uid || 'unknown',
        created_at: serverTimestamp(),
        records: roster.map(({ student_id, status, remarks, student_name, roll_number, photo_url }) => ({
          student_id,
          status,
          remarks,
          student_name,
          roll_number,
          photo_url
        }))
      };

      await setDoc(doc(db, 'attendance_records', docId), record);
      
      if (sendSMS) {
        const absentOnes = roster.filter(r => r.status === 'A');
        if (absentOnes.length > 0) {
          triggerAbsentSMS(absentOnes);
        }
      }

      toast.success("Attendance saved successfully!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance record");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRoster = roster.filter(r => 
    r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.student_id.includes(searchQuery) ||
    (r.roll_number && r.roll_number.includes(searchQuery))
  );

  return (
    <div className="flex flex-col h-full bg-cyber-black text-white">
      {/* Top Control Bar - Sticky */}
      <div className="sticky top-0 z-30 bg-cyber-gray/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Attendance Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neon-blue" size={18} />
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Grade / Class</label>
              <select 
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
              >
                <option value="">Select Grade</option>
                {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Section</label>
              <select 
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-neon-blue/50 transition-all"
              >
                <option value="">Select Section</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
          <button 
            onClick={fetchRoster}
            disabled={isLoading}
            className="bg-neon-blue hover:bg-neon-blue/90 text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Users size={18} />}
            Fetch Roster
          </button>
        </div>
      </div>

      {/* Analytics Strip */}
      <AnimatePresence>
        {roster.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-cyber-gray/20 border-b border-white/5 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-cyber-gray/40 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Students</p>
                <p className="text-2xl font-black text-white">{stats.total}</p>
              </div>
              <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/20">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Present</p>
                <p className="text-2xl font-black text-green-400">{stats.present}</p>
              </div>
              <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/20">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Absent</p>
                <p className="text-2xl font-black text-red-400">{stats.absent}</p>
              </div>
              <div className="bg-yellow-500/5 p-4 rounded-2xl border border-yellow-500/20">
                <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">On Leave</p>
                <p className="text-2xl font-black text-yellow-400">{stats.leave}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Roster Area */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {roster.length > 0 ? (
            <div className="space-y-6">
              {/* List Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text"
                    placeholder="Quick Search Student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-cyber-gray/30 border border-white/5 rounded-xl py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-neon-blue/30"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => markAll('P')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-green-500/20 transition-all"
                  >
                    Mark All Present
                  </button>
                  <button 
                    onClick={() => markAll('A')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    Mark All Absent
                  </button>
                </div>
              </div>

              {/* Student Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredRoster.map((entry, idx) => (
                  <motion.div 
                    layout
                    key={entry.student_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                      entry.status === 'A' ? 'bg-red-500/5 border-red-500/20' : 
                      entry.status === 'L' ? 'bg-yellow-500/5 border-yellow-500/20' : 
                      'bg-cyber-gray/20 border-white/5'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/5 overflow-hidden flex-shrink-0">
                      {entry.photo_url ? (
                        <img src={entry.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                          <User size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-black text-white truncate uppercase tracking-tight">
                        {entry.student_name}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Roll: {entry.roll_number || 'N/A'} • {entry.student_id}
                      </p>
                    </div>

                    {/* P/A/L Segmented Control */}
                    <div className="flex bg-cyber-black/50 p-1 rounded-xl border border-white/5">
                      {[
                        { id: 'P', label: 'P', color: 'bg-green-500 text-black', activeColor: 'text-green-400' },
                        { id: 'A', label: 'A', color: 'bg-red-500 text-white', activeColor: 'text-red-400' },
                        { id: 'L', label: 'L', color: 'bg-yellow-500 text-black', activeColor: 'text-yellow-400' }
                      ].map(btn => (
                        <button
                          key={btn.id}
                          onClick={() => updateStatus(entry.student_id, btn.id as any)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                            entry.status === btn.id 
                              ? btn.color + ' shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-24 h-24 bg-cyber-gray/40 rounded-full flex items-center justify-center mb-8 border border-white/5">
                <Users className="text-gray-700" size={48} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">No Roster Loaded</h3>
              <p className="text-gray-500 text-sm max-w-xs">Select a class and section above to fetch the student attendance roster.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer - Sticky */}
      <AnimatePresence>
        {roster.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="sticky bottom-0 z-30 bg-cyber-gray/90 backdrop-blur-xl border-t border-white/10 p-6"
          >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div 
                    onClick={() => setSendSMS(!sendSMS)}
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                      sendSMS ? 'bg-neon-blue border-neon-blue text-black' : 'border-white/20 group-hover:border-white/40'
                    }`}
                  >
                    {sendSMS && <Check size={14} strokeWidth={4} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Auto-SMS Parents</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Notify guardians of absent students</span>
                  </div>
                </label>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-cyber-black/50 rounded-xl border border-white/5">
                  <Info size={14} className="text-neon-blue" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                    Last Marked: {selectedDate}
                  </span>
                </div>
              </div>

              <button 
                onClick={saveAttendance}
                disabled={isSaving}
                className="w-full sm:w-auto bg-neon-blue hover:bg-neon-blue/90 text-black px-12 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-[0_0_30px_rgba(0,243,255,0.3)] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={20} />
                    Save Attendance
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentAttendanceModule;
