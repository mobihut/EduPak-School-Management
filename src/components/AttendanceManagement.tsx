import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  FileText,
  Download,
  Filter,
  Save,
  Loader2,
  AlertCircle,
  User,
  ArrowRight,
  TrendingUp,
  Activity,
  PieChart as PieChartIcon,
  ShieldCheck,
  History as HistoryIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Student } from './StudentManagement';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface AttendanceManagementProps {
  schoolId: string;
}

interface AttendanceRecord {
  student_id: string;
  status: 'P' | 'A' | 'L';
  remarks?: string;
  student_name: string;
  roll_number?: string;
  photo_url?: string;
}

interface DailyAttendance {
  id?: string;
  school_id: string;
  date: string; // YYYY-MM-DD
  class: string;
  section: string;
  marked_by_uid: string;
  created_at: any;
  records: AttendanceRecord[];
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'mark' | 'history' | 'reports'>('mark');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceData, setAttendanceData] = useState<Record<string, 'P' | 'A' | 'L'>>({});
  const [history, setHistory] = useState<DailyAttendance[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [sendSMS, setSendSMS] = useState(true);

  const classes = ['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const sections = ['A', 'B', 'C', 'Blue', 'Green', 'Rose'];

  // Fetch students for the selected class/section
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'students'),
          where('school_id', '==', schoolId),
          where('academic_info.grade', '==', selectedClass),
          where('academic_info.section', '==', selectedSection),
          where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(studentList);

        // Check if attendance already exists for this date/class/section
        const attendanceQuery = query(
          collection(db, 'attendance_records'),
          where('school_id', '==', schoolId),
          where('date', '==', selectedDate),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        if (!attendanceSnapshot.empty) {
          const existingData = attendanceSnapshot.docs[0].data() as DailyAttendance;
          const initialAttendance: Record<string, 'P' | 'A' | 'L'> = {};
          existingData.records.forEach(rec => {
            initialAttendance[rec.student_id] = rec.status;
          });
          setAttendanceData(initialAttendance);
        } else {
          // Default all to Present
          const initialAttendance: Record<string, 'P' | 'A' | 'L'> = {};
          studentList.forEach(s => {
            initialAttendance[s.id] = 'P';
          });
          setAttendanceData(initialAttendance);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'mark') {
      fetchStudents();
    }
  }, [schoolId, selectedClass, selectedSection, selectedDate, activeTab]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      if (activeTab !== 'history') return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'attendance_records'),
          where('school_id', '==', schoolId),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection),
          orderBy('date', 'desc'),
          limit(30)
        );
        const snapshot = await getDocs(q);
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAttendance)));
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [schoolId, selectedClass, selectedSection, activeTab]);

  // Generate Report Data
  useEffect(() => {
    const generateReport = async () => {
      if (activeTab !== 'reports') return;
      setLoading(true);
      try {
        const start = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
        const end = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
        
        const q = query(
          collection(db, 'attendance_records'),
          where('school_id', '==', schoolId),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => doc.data() as DailyAttendance);
        
        // Aggregate data for the chart
        const summary = records.reduce((acc: any, curr) => {
          const present = curr.records.filter(r => r.status === 'P').length;
          const absent = curr.records.filter(r => r.status === 'A').length;
          const late = curr.records.filter(r => r.status === 'L').length;
          
          acc.push({
            date: format(new Date(curr.date), 'dd MMM'),
            Present: present,
            Absent: absent,
            Late: late
          });
          return acc;
        }, []);
        
        setReportData(summary.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      } catch (error) {
        console.error("Error generating report:", error);
      } finally {
        setLoading(false);
      }
    };
    generateReport();
  }, [schoolId, selectedClass, selectedSection, selectedDate, activeTab]);

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const records: AttendanceRecord[] = students.map(s => ({
        student_id: s.id,
        student_name: `${s.personal_info.firstName} ${s.personal_info.lastName}`,
        roll_number: s.academic_info.rollNumber,
        photo_url: s.personal_info.photoUrl,
        status: attendanceData[s.id] || 'P'
      }));

      const attendanceDoc: DailyAttendance = {
        school_id: schoolId,
        date: selectedDate,
        class: selectedClass,
        section: selectedSection,
        marked_by_uid: auth.currentUser?.uid || '',
        created_at: serverTimestamp(),
        records
      };

      const docId = `${selectedDate}_${selectedClass}_${selectedSection}`;
      await setDoc(doc(db, 'attendance_records', docId), attendanceDoc);
      
      if (sendSMS) {
        const absentStudents = records.filter(r => r.status === 'A');
        if (absentStudents.length > 0) {
          console.log("Triggering SMS for absent students:", absentStudents);
          // Placeholder for SMS API
        }
      }

      toast.success("Attendance saved successfully!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status: 'P' | 'A') => {
    const newAttendance: Record<string, 'P' | 'A' | 'L'> = {};
    students.forEach(s => {
      newAttendance[s.id] = status;
    });
    setAttendanceData(newAttendance);
  };

  const stats = useMemo(() => {
    const total = students.length;
    const present = Object.values(attendanceData).filter(v => v === 'P').length;
    const absent = Object.values(attendanceData).filter(v => v === 'A').length;
    const late = Object.values(attendanceData).filter(v => v === 'L').length;
    return { total, present, absent, late, percentage: total > 0 ? ((present / total) * 100).toFixed(1) : '0' };
  }, [students, attendanceData]);

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4"
          >
            <ShieldCheck className="text-neon-blue" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-blue">Academic Integrity System</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white">
            Attendance <span className="text-neon-blue">Control.</span>
          </h2>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          {[
            { id: 'mark', label: 'Mark Daily', icon: CheckCircle2 },
            { id: 'history', label: 'History', icon: HistoryIcon },
            { id: 'reports', label: 'Analytics', icon: PieChartIcon }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-neon-blue text-black shadow-[0_0_20px_rgba(0,243,255,0.3)]' : 'text-gray-500 hover:text-white'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-grow min-w-[200px]">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Select Date</label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-neon-blue/50"
            />
          </div>
        </div>

        <div className="space-y-2 w-full md:w-40">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Class</label>
          <select 
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-white focus:outline-none focus:border-neon-blue/50 appearance-none"
          >
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>

        <div className="space-y-2 w-full md:w-40">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Section</label>
          <select 
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full bg-cyber-black/50 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-white focus:outline-none focus:border-neon-blue/50 appearance-none"
          >
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>

        {activeTab === 'mark' && (
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <button 
                onClick={() => markAll('P')}
                className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-500/20 transition-all"
              >
                Mark All Present
              </button>
              <button 
                onClick={() => markAll('A')}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all"
              >
                Mark All Absent
              </button>
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer group ml-auto">
              <div 
                onClick={() => setSendSMS(!sendSMS)}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                  sendSMS ? 'bg-neon-blue border-neon-blue text-black' : 'border-white/20 group-hover:border-white/40'
                }`}
              >
                {sendSMS && <CheckCircle2 size={14} strokeWidth={3} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Auto-SMS Parents</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">Notify guardians of absent students</span>
              </div>
            </label>

            <button 
              onClick={handleSaveAttendance}
              disabled={saving || students.length === 0}
              className="px-8 py-4 bg-neon-blue text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Attendance
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'mark' && (
          <motion.div 
            key="mark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Students', value: stats.total, icon: Users, color: 'text-white' },
                { label: 'Present', value: stats.present, icon: CheckCircle2, color: 'text-green-500' },
                { label: 'Absent', value: stats.absent, icon: XCircle, color: 'text-red-500' },
                { label: 'Attendance %', value: `${stats.percentage}%`, icon: Activity, color: 'text-neon-blue' }
              ].map((stat, i) => (
                <div key={i} className="bg-cyber-gray/40 p-6 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <stat.icon size={14} className={stat.color} />
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Attendance List */}
            <div className="bg-cyber-gray/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 overflow-hidden">
              {loading ? (
                <div className="p-20 text-center">
                  <Loader2 className="animate-spin text-neon-blue mx-auto mb-4" size={40} />
                  <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">Loading Student Roster...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="p-20 text-center">
                  <Users className="text-gray-700 mx-auto mb-4" size={40} />
                  <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">No students found in this class/section</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Student</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Roll No</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {students.map((student) => (
                        <tr key={student.id} className="group hover:bg-white/[0.01] transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                                {student.personal_info.photoUrl ? (
                                  <img src={student.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User size={16} className="text-gray-700" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-black text-white tracking-tight">{student.personal_info.firstName} {student.personal_info.lastName}</p>
                                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">ID: {student.student_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs font-mono text-gray-400">{student.academic_info.rollNumber || 'N/A'}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center justify-center gap-2">
                              {[
                                { id: 'P', label: 'Present', icon: CheckCircle2, color: 'peer-checked:bg-green-500 peer-checked:text-black text-green-500 border-green-500/20' },
                                { id: 'A', label: 'Absent', icon: XCircle, color: 'peer-checked:bg-red-500 peer-checked:text-black text-red-500 border-red-500/20' },
                                { id: 'L', label: 'Late', icon: Clock, color: 'peer-checked:bg-amber-500 peer-checked:text-black text-amber-500 border-amber-500/20' }
                              ].map((status) => (
                                <label key={status.id} className="cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name={`attendance-${student.id}`}
                                    value={status.id}
                                    checked={attendanceData[student.id] === status.id}
                                    onChange={() => setAttendanceData(prev => ({ ...prev, [student.id]: status.id as any }))}
                                    className="hidden peer"
                                  />
                                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all ${status.color}`}>
                                    <status.icon size={14} />
                                    {status.label}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {loading ? (
              <div className="p-20 text-center">
                <Loader2 className="animate-spin text-neon-blue mx-auto mb-4" size={40} />
              </div>
            ) : history.length === 0 ? (
              <div className="bg-cyber-gray/40 p-20 rounded-[3rem] border border-white/5 text-center">
                <HistoryIcon className="text-gray-700 mx-auto mb-4" size={40} />
                <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">No attendance history found for this class</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((record, i) => {
                  const p = record.records.filter(r => r.status === 'P').length;
                  const a = record.records.filter(r => r.status === 'A').length;
                  const l = record.records.filter(r => r.status === 'L').length;
                  const perc = ((p / record.records.length) * 100).toFixed(1);

                  return (
                    <motion.div 
                      key={record.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 hover:border-neon-blue/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                          <CalendarIcon className="text-neon-blue" size={20} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{format(new Date(record.date), 'dd MMM yyyy')}</p>
                          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Marked by Admin</p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Present</span>
                          <span className="text-sm font-black text-green-500">{p}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Absent</span>
                          <span className="text-sm font-black text-red-500">{a}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Late</span>
                          <span className="text-sm font-black text-amber-500">{l}</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-neon-blue" style={{ width: `${perc}%` }} />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedDate(record.date);
                          setActiveTab('mark');
                        }}
                        className="w-full py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:bg-neon-blue group-hover:text-black transition-all flex items-center justify-center gap-2"
                      >
                        View Details <ArrowRight size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div 
            key="reports"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[3rem] border border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <TrendingUp className="text-neon-blue" size={24} /> Monthly Attendance Trend
                  </h3>
                  <button className="p-3 bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all">
                    <Download size={18} />
                  </button>
                </div>
                
                <div className="h-[400px] w-full">
                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-neon-blue" size={40} />
                    </div>
                  ) : reportData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-600 uppercase font-black text-[10px] tracking-widest">
                      No data for this month
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fontWeight: 900 }}
                        />
                        <YAxis 
                          stroke="#666" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fontWeight: 900 }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                          itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                        />
                        <Bar dataKey="Present" fill="#00f3ff" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Absent" fill="#ff4d4d" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Late" fill="#ffb800" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[3rem] border border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                  <PieChartIcon className="text-neon-purple" size={24} /> Distribution
                </h3>
                <div className="h-[300px] w-full">
                  {reportData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: reportData.reduce((a, b) => a + b.Present, 0) },
                            { name: 'Absent', value: reportData.reduce((a, b) => a + b.Absent, 0) },
                            { name: 'Late', value: reportData.reduce((a, b) => a + b.Late, 0) }
                          ]}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#00f3ff" />
                          <Cell fill="#ff4d4d" />
                          <Cell fill="#ffb800" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 uppercase font-black text-[10px] tracking-widest">
                      No data
                    </div>
                  )}
                </div>
                <div className="space-y-4 mt-8">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-neon-blue" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Present</span>
                    </div>
                    <span className="text-sm font-black text-white">
                      {reportData.length > 0 ? (reportData.reduce((a, b) => a + b.Present, 0) / reportData.length).toFixed(1) : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Absent</span>
                    </div>
                    <span className="text-sm font-black text-white">
                      {reportData.length > 0 ? (reportData.reduce((a, b) => a + b.Absent, 0) / reportData.length).toFixed(1) : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceManagement;
