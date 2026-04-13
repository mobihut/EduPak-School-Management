import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Save, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  BarChart3, 
  TrendingUp, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Clock, 
  MapPin, 
  Lock, 
  Unlock, 
  Eye, 
  Printer, 
  Share2,
  Trophy,
  RefreshCw,
  Layout,
  Settings,
  X,
  ArrowRight
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
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

// --- Types ---

interface ExamTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  schoolId: string;
}

interface DateSheetItem {
  id: string;
  termId: string;
  classId: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface GradingScale {
  id: string;
  grade: string;
  minMarks: number;
  maxMarks: number;
  points: number;
  remarks: string;
}

interface StudentResult {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  classId: string;
  termId: string;
  marks: {
    [subjectId: string]: {
      theory: number;
      practical: number;
      internal: number;
      total: number;
      grade: string;
    };
  };
  totalMarks: number;
  percentage: number;
  overallGrade: string;
  position?: number;
  attendance?: number;
  isPublished: boolean;
  isLocked: boolean;
  updatedAt: any;
}

interface Student {
  uid: string;
  name: string;
  rollNo: string;
  classId: string;
  photoURL?: string;
  attendancePercentage?: number;
}

// --- Constants ---

const DEFAULT_GRADING_SCALE: GradingScale[] = [
  { id: '1', grade: 'A+', minMarks: 90, maxMarks: 100, points: 4.0, remarks: 'Outstanding' },
  { id: '2', grade: 'A', minMarks: 80, maxMarks: 89, points: 3.7, remarks: 'Excellent' },
  { id: '3', grade: 'B+', minMarks: 70, maxMarks: 79, points: 3.3, remarks: 'Very Good' },
  { id: '4', grade: 'B', minMarks: 60, maxMarks: 69, points: 3.0, remarks: 'Good' },
  { id: '5', grade: 'C+', minMarks: 50, maxMarks: 59, points: 2.7, remarks: 'Satisfactory' },
  { id: '6', grade: 'C', minMarks: 40, maxMarks: 49, points: 2.0, remarks: 'Pass' },
  { id: '7', grade: 'F', minMarks: 0, maxMarks: 39, points: 0.0, remarks: 'Fail' },
];

const MODULES = [
  { id: 'scheduler', label: 'Exam Scheduler', icon: Calendar },
  { id: 'marks', label: 'Marks Entry', icon: Edit2 },
  { id: 'grading', label: 'Grading System', icon: Settings },
  { id: 'analytics', label: 'Result Analytics', icon: BarChart3 },
];

// --- Components ---

const ExamsResultsManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'marks' | 'grading' | 'analytics'>('scheduler');
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [dateSheet, setDateSheet] = useState<DateSheetItem[]>([]);
  const [gradingScale, setGradingScale] = useState<GradingScale[]>(DEFAULT_GRADING_SCALE);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [isDateSheetModalOpen, setIsDateSheetModalOpen] = useState(false);
  const [newTerm, setNewTerm] = useState({ name: '', startDate: '', endDate: '' });
  const [newDateSheet, setNewDateSheet] = useState({ subject: '', date: '', startTime: '', endTime: '', room: '' });

  useEffect(() => {
    if (!schoolId) return;

    const termsUnsub = onSnapshot(
      query(collection(db, 'exam_terms'), where('schoolId', '==', schoolId), orderBy('startDate', 'desc')),
      (snap) => {
        const termsData = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExamTerm));
        setTerms(termsData);
        if (termsData.length > 0 && !selectedTerm) {
          setSelectedTerm(termsData[0].id);
        }
        setLoading(false);
      }
    );

    return () => termsUnsub();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedTerm || !selectedClass) return;

    const studentsUnsub = onSnapshot(
      query(collection(db, 'students'), where('schoolId', '==', schoolId), where('classId', '==', selectedClass)),
      (snap) => {
        setStudents(snap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Student)));
      }
    );

    const resultsUnsub = onSnapshot(
      query(collection(db, 'exam_results'), where('termId', '==', selectedTerm), where('classId', '==', selectedClass)),
      (snap) => {
        setResults(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentResult)));
      }
    );

    const dateSheetUnsub = onSnapshot(
      query(collection(db, 'date_sheets'), where('termId', '==', selectedTerm), where('classId', '==', selectedClass)),
      (snap) => {
        setDateSheet(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as DateSheetItem)));
      }
    );

    return () => {
      studentsUnsub();
      resultsUnsub();
      dateSheetUnsub();
    };
  }, [selectedTerm, selectedClass, schoolId]);

  const handleCreateTerm = async () => {
    if (!newTerm.name) return toast.error("Term name is required");
    try {
      await addDoc(collection(db, 'exam_terms'), {
        ...newTerm,
        schoolId,
        status: 'upcoming',
        createdAt: serverTimestamp()
      });
      setIsTermModalOpen(false);
      setNewTerm({ name: '', startDate: '', endDate: '' });
      toast.success("Exam term created");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddDateSheet = async () => {
    if (!selectedTerm || !selectedClass) return toast.error("Select term and class first");
    try {
      await addDoc(collection(db, 'date_sheets'), {
        ...newDateSheet,
        termId: selectedTerm,
        classId: selectedClass,
        schoolId
      });
      setIsDateSheetModalOpen(false);
      setNewDateSheet({ subject: '', date: '', startTime: '', endTime: '', room: '' });
      toast.success("Date sheet updated");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const calculateGrade = (percentage: number) => {
    const scale = gradingScale.find(s => percentage >= s.minMarks && percentage <= s.maxMarks);
    return scale ? scale.grade : 'F';
  };

  const handleSaveMarks = async (studentId: string, subject: string, marks: any) => {
    const student = students.find(s => s.uid === studentId);
    if (!student) return;

    const existingResult = results.find(r => r.studentId === studentId);
    const theory = Number(marks.theory) || 0;
    const practical = Number(marks.practical) || 0;
    const internal = Number(marks.internal) || 0;
    const total = theory + practical + internal;

    const newMarks = {
      ...(existingResult?.marks || {}),
      [subject]: {
        theory,
        practical,
        internal,
        total,
        grade: calculateGrade(total) // Assuming 100 is max for now
      }
    };

    const overallTotal = Object.values(newMarks).reduce((acc, m: any) => acc + m.total, 0);
    const subjectCount = Object.keys(newMarks).length;
    const percentage = subjectCount > 0 ? overallTotal / subjectCount : 0;

    const resultData = {
      studentId,
      studentName: student.name,
      rollNo: student.rollNo,
      classId: selectedClass,
      termId: selectedTerm,
      schoolId,
      marks: newMarks,
      totalMarks: overallTotal,
      percentage,
      overallGrade: calculateGrade(percentage),
      isPublished: existingResult?.isPublished || false,
      isLocked: existingResult?.isLocked || false,
      updatedAt: serverTimestamp(),
      attendance: student.attendancePercentage || 0
    };

    try {
      if (existingResult) {
        await updateDoc(doc(db, 'exam_results', existingResult.id), resultData);
      } else {
        await addDoc(collection(db, 'exam_results'), resultData);
      }
      toast.success("Marks updated");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const generateReportCard = (studentResult: StudentResult) => {
    const student = students.find(s => s.uid === studentResult.studentId);
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("EDUPAK ERP - ACADEMIC REPORT", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Term: ${terms.find(t => t.id === studentResult.termId)?.name}`, 105, 30, { align: 'center' });
    
    // Student Info
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(10);
    doc.text(`Student Name: ${studentResult.studentName}`, 20, 45);
    doc.text(`Roll Number: ${studentResult.rollNo}`, 20, 52);
    doc.text(`Class: ${selectedClass}`, 140, 45);
    doc.text(`Attendance: ${studentResult.attendance}%`, 140, 52);
    
    // Results Table
    const tableData = Object.entries(studentResult.marks).map(([subject, m]: any) => [
      subject,
      m.theory,
      m.practical,
      m.internal,
      m.total,
      m.grade
    ]);

    (doc as any).autoTable({
      startY: 60,
      head: [['Subject', 'Theory', 'Practical', 'Internal', 'Total', 'Grade']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: [100, 100, 255] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Summary
    doc.setFontSize(12);
    doc.text(`Total Marks: ${studentResult.totalMarks}`, 20, finalY);
    doc.text(`Percentage: ${studentResult.percentage.toFixed(2)}%`, 20, finalY + 7);
    doc.text(`Overall Grade: ${studentResult.overallGrade}`, 20, finalY + 14);
    
    // Signatures
    doc.text("Class Teacher", 20, finalY + 40);
    doc.text("Principal", 150, finalY + 40);
    
    doc.save(`${studentResult.studentName}_Report_Card.pdf`);
  };

  const analyticsData = useMemo(() => {
    if (results.length === 0) return [];
    const gradesCount: any = {};
    results.forEach(r => {
      gradesCount[r.overallGrade] = (gradesCount[r.overallGrade] || 0) + 1;
    });
    return Object.entries(gradesCount).map(([name, value]) => ({ name, value }));
  }, [results]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4"
          >
            <Trophy className="text-neon-blue" size={12} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neon-blue">Academic Excellence Engine</span>
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Exams & <span className="text-neon-blue">Results.</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select 
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="bg-cyber-gray/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-neon-blue/50"
          >
            <option value="">Select Term</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <select 
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-cyber-gray/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-neon-blue/50"
          >
            <option value="">Select Class</option>
            <option value="1">Class 1</option>
            <option value="2">Class 2</option>
            <option value="3">Class 3</option>
            <option value="4">Class 4</option>
            <option value="5">Class 5</option>
          </select>
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
                ? 'bg-neon-blue text-black border-neon-blue shadow-[0_0_20px_rgba(0,243,255,0.3)]' 
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
        {activeTab === 'scheduler' && (
          <motion.div 
            key="scheduler"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Terms List */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Exam Terms</h3>
                    <button 
                      onClick={() => setIsTermModalOpen(true)}
                      className="p-2 bg-neon-blue/10 text-neon-blue rounded-xl border border-neon-blue/20 hover:bg-neon-blue/20 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {terms.map(term => (
                      <div 
                        key={term.id}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedTerm === term.id ? 'bg-neon-blue/10 border-neon-blue/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                        onClick={() => setSelectedTerm(term.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-black text-white uppercase tracking-widest">{term.name}</p>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                            term.status === 'upcoming' ? 'bg-blue-500/10 text-blue-400' :
                            term.status === 'ongoing' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-green-500/10 text-green-400'
                          }`}>
                            {term.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold">{term.startDate} - {term.endDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date Sheet */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Date Sheet Builder</h3>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Class: {selectedClass || 'None'}</p>
                    </div>
                    <button 
                      onClick={() => setIsDateSheetModalOpen(true)}
                      disabled={!selectedTerm || !selectedClass}
                      className="flex items-center gap-2 px-6 py-3 bg-neon-blue text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Add Subject
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Subject</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Timing</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Room</th>
                          <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dateSheet.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-xs font-black text-white uppercase tracking-widest">{item.subject}</p>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">{item.date}</td>
                            <td className="px-4 py-4 text-xs text-gray-400">{item.startTime} - {item.endTime}</td>
                            <td className="px-4 py-4">
                              <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-gray-400 border border-white/5">{item.room}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button onClick={() => deleteDoc(doc(db, 'date_sheets', item.id))} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {dateSheet.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">No schedule defined for this class</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'marks' && (
          <motion.div 
            key="marks"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Bulk Marks Entry</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Real-time spreadsheet interface</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Search student..."
                      className="bg-cyber-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-neon-blue/50 outline-none"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-neon-blue/10 text-neon-blue rounded-xl border border-neon-blue/20 text-[10px] font-black uppercase tracking-widest">
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Student Info</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Subject</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Theory (70)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Practical (20)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Internal (10)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map((student) => {
                      const result = results.find(r => r.studentId === student.uid);
                      return (
                        <tr key={student.uid} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-6 py-6">
                            <p className="text-xs font-black text-white uppercase tracking-widest">{student.name}</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Roll: {student.rollNo}</p>
                          </td>
                          <td className="px-6 py-6">
                            <select className="bg-cyber-black/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none">
                              <option>Mathematics</option>
                              <option>Physics</option>
                              <option>Chemistry</option>
                              <option>English</option>
                            </select>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex justify-center">
                              <input 
                                type="number"
                                placeholder="00"
                                className="w-16 bg-cyber-black/50 border border-white/10 rounded-xl px-2 py-2 text-center text-sm text-white focus:border-neon-blue/50 outline-none"
                                onBlur={(e) => handleSaveMarks(student.uid, 'Mathematics', { theory: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex justify-center">
                              <input 
                                type="number"
                                placeholder="00"
                                className="w-16 bg-cyber-black/50 border border-white/10 rounded-xl px-2 py-2 text-center text-sm text-white focus:border-neon-blue/50 outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex justify-center">
                              <input 
                                type="number"
                                placeholder="00"
                                className="w-16 bg-cyber-black/50 border border-white/10 rounded-xl px-2 py-2 text-center text-sm text-white focus:border-neon-blue/50 outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-neon-blue">{result?.totalMarks || 0}</span>
                              <span className="text-[8px] font-black text-gray-500 uppercase">{result?.overallGrade || 'F'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => result && generateReportCard(result)}
                                className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-white transition-all"
                              >
                                <Printer size={14} />
                              </button>
                              <button className="p-2 bg-white/5 text-gray-400 rounded-xl hover:text-neon-blue transition-all">
                                <Save size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Avg. Percentage', value: '78.4%', icon: TrendingUp, color: 'text-neon-blue' },
                { label: 'Pass Ratio', value: '92%', icon: CheckCircle2, color: 'text-green-400' },
                { label: 'Top Scorer', value: '98.2%', icon: Trophy, color: 'text-yellow-400' },
                { label: 'Total Students', value: students.length.toString(), icon: Users, color: 'text-purple-400' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`p-3 bg-white/5 rounded-2xl border border-white/5 ${stat.color}`}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white uppercase tracking-tighter">{stat.value}</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Grade Distribution</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analyticsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Class Performance Trend</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Class 1', score: 85 },
                      { name: 'Class 2', score: 78 },
                      { name: 'Class 3', score: 82 },
                      { name: 'Class 4', score: 90 },
                      { name: 'Class 5', score: 75 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="score" fill="#00f3ff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Term Modal */}
      <AnimatePresence>
        {isTermModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTermModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-md">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">New Exam Term</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Term Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. First Term 2026"
                    value={newTerm.name}
                    onChange={(e) => setNewTerm({...newTerm, name: e.target.value})}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Start Date</label>
                    <input 
                      type="date"
                      value={newTerm.startDate}
                      onChange={(e) => setNewTerm({...newTerm, startDate: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">End Date</label>
                    <input 
                      type="date"
                      value={newTerm.endDate}
                      onChange={(e) => setNewTerm({...newTerm, endDate: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleCreateTerm}
                  className="w-full py-4 bg-neon-blue text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all"
                >
                  Create Term
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Date Sheet Modal */}
      <AnimatePresence>
        {isDateSheetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDateSheetModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-cyber-gray p-8 rounded-3xl neon-border-blue w-full max-w-md">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Add Subject to Date Sheet</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subject Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={newDateSheet.subject}
                    onChange={(e) => setNewDateSheet({...newDateSheet, subject: e.target.value})}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Exam Date</label>
                    <input 
                      type="date"
                      value={newDateSheet.date}
                      onChange={(e) => setNewDateSheet({...newDateSheet, date: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Room Number</label>
                    <input 
                      type="text"
                      placeholder="Room 101"
                      value={newDateSheet.room}
                      onChange={(e) => setNewDateSheet({...newDateSheet, room: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Start Time</label>
                    <input 
                      type="time"
                      value={newDateSheet.startTime}
                      onChange={(e) => setNewDateSheet({...newDateSheet, startTime: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">End Time</label>
                    <input 
                      type="time"
                      value={newDateSheet.endTime}
                      onChange={(e) => setNewDateSheet({...newDateSheet, endTime: e.target.value})}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-blue/50"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddDateSheet}
                  className="w-full py-4 bg-neon-blue text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all"
                >
                  Save to Date Sheet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExamsResultsManagement;
