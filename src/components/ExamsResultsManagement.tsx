import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  FileText, 
  LayoutGrid, 
  Settings, 
  Plus, 
  Save, 
  Search, 
  ChevronRight, 
  Printer, 
  Download,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Users,
  BookOpen,
  PieChart as PieChartIcon,
  Calendar,
  Filter,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  writeBatch, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
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

interface Exam {
  id: string;
  name: string;
  term: string;
  session: string;
  subjects: Record<string, number>; // subjectName: totalMarks
  created_at: any;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  grade: string;
  section: string;
}

interface ExamMark {
  id?: string;
  student_id: string;
  exam_id: string;
  subject: string;
  marks_obtained: number;
  total_marks: number;
  class: string;
  section: string;
}

const GRADES = [
  { min: 90, grade: 'A+', color: '#10b981' },
  { min: 80, grade: 'A', color: '#34d399' },
  { min: 70, grade: 'B', color: '#3b82f6' },
  { min: 60, grade: 'C', color: '#fbbf24' },
  { min: 50, grade: 'D', color: '#f59e0b' },
  { min: 0, grade: 'F', color: '#ef4444' },
];

export const calculateGrade = (obtained: number, total: number) => {
  if (!total || total === 0) return 'N/A';
  const percentage = (obtained / total) * 100;
  const gradeObj = GRADES.find(g => percentage >= g.min);
  return gradeObj ? gradeObj.grade : 'F';
};

const ExamsResultsManagement: React.FC<{ schoolId: string }> = ({ schoolId }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'entry' | 'analytics' | 'report'>('setup');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection States
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, number>>({}); // studentId: marks
  const [existingMarksDocs, setExistingMarksDocs] = useState<Record<string, string>>({}); // studentId: docId
  const [isSaving, setIsSaving] = useState(false);

  // Constants (Aligned with Admission Wizard)
  const classes = ['Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  const sections = ['A', 'B', 'C', 'D'];

  useEffect(() => {
    fetchExams();
  }, [schoolId]);

  const fetchExams = async () => {
    try {
      const q = query(
        collection(db, 'exams'), 
        where('school_id', '==', schoolId),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const examData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examData);
      if (examData.length > 0) setSelectedExam(examData[0].id);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndMarks = async () => {
    if (!selectedClass || !selectedSection || !selectedExam || !selectedSubject) return;
    
    setLoading(true);
    try {
      // Fetch Students
      const studentQuery = query(
        collection(db, 'students'),
        where('school_id', '==', schoolId),
        where('academic_info.grade', '==', selectedClass),
        where('academic_info.section', '==', selectedSection)
      );
      const studentSnapshot = await getDocs(studentQuery);
      const studentData = studentSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          name: `${data.personal_info?.firstName} ${data.personal_info?.lastName}`,
          rollNumber: data.academic_info?.rollNumber || 'N/A',
          grade: data.academic_info?.grade,
          section: data.academic_info?.section
        } as Student;
      });
      setStudents(studentData);

      // Fetch Existing Marks
      const marksQuery = query(
        collection(db, 'exam_marks'),
        where('school_id', '==', schoolId),
        where('exam_id', '==', selectedExam),
        where('subject', '==', selectedSubject),
        where('class', '==', selectedClass),
        where('section', '==', selectedSection)
      );
      const marksSnapshot = await getDocs(marksQuery);
      const marksMap: Record<string, number> = {};
      const docsMap: Record<string, string> = {};
      
      marksSnapshot.docs.forEach(doc => {
        const data = doc.data();
        marksMap[data.student_id] = data.marks_obtained;
        docsMap[data.student_id] = doc.id;
      });

      setMarks(marksMap);
      setExistingMarksDocs(docsMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load student data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'entry') {
      fetchStudentsAndMarks();
    }
  }, [activeTab, selectedClass, selectedSection, selectedExam, selectedSubject]);

  const handleMarkChange = (studentId: string, value: string) => {
    const numValue = parseFloat(value);
    setMarks(prev => ({
      ...prev,
      [studentId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const saveAllMarks = async () => {
    if (!selectedExam || !selectedSubject) return;
    setIsSaving(true);
    
    const exam = exams.find(e => e.id === selectedExam);
    const totalMarks = exam?.subjects[selectedSubject] || 100;

    try {
      const batch = writeBatch(db);
      
      students.forEach(student => {
        const marksObtained = marks[student.id] || 0;
        const docId = existingMarksDocs[student.id];
        
        if (docId) {
          // Update
          const docRef = doc(db, 'exam_marks', docId);
          batch.update(docRef, {
            marks_obtained: marksObtained,
            total_marks: totalMarks,
            updated_by: auth.currentUser?.email,
            timestamp: serverTimestamp()
          });
        } else {
          // Create
          const newDocRef = doc(collection(db, 'exam_marks'));
          batch.set(newDocRef, {
            mark_id: newDocRef.id,
            school_id: schoolId,
            exam_id: selectedExam,
            student_id: student.id,
            class: selectedClass,
            section: selectedSection,
            subject: selectedSubject,
            marks_obtained: marksObtained,
            total_marks: totalMarks,
            updated_by: auth.currentUser?.email,
            timestamp: serverTimestamp()
          });
        }
      });

      await batch.commit();
      toast.success("All marks saved successfully");
      fetchStudentsAndMarks(); // Refresh to get new doc IDs
    } catch (error) {
      console.error("Error saving marks:", error);
      toast.error("Failed to save marks");
    } finally {
      setIsSaving(false);
    }
  };

  // Exam Setup Form State
  const [newExam, setNewExam] = useState({
    name: '',
    term: 'First Term',
    session: '2025-26',
    subjects: [{ name: '', total: 100 }]
  });

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.name) return;

    try {
      const subjectsMap: Record<string, number> = {};
      newExam.subjects.forEach(s => {
        if (s.name) subjectsMap[s.name] = s.total;
      });

      const examData = {
        school_id: schoolId,
        name: newExam.name,
        term: newExam.term,
        session: newExam.session,
        subjects: subjectsMap,
        created_at: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'exams'), examData);
      toast.success("Exam created successfully");
      setNewExam({ name: '', term: 'First Term', session: '2025-26', subjects: [{ name: '', total: 100 }] });
      fetchExams();
    } catch (error) {
      console.error("Error creating exam:", error);
      toast.error("Failed to create exam");
    }
  };

  // Analytics Logic
  const analyticsData = useMemo(() => {
    if (activeTab !== 'analytics' || students.length === 0) return [];
    
    // This is a simplified version. Real analytics would aggregate all subjects.
    // For now, let's show distribution of grades for the selected subject.
    const distribution: Record<string, number> = {};
    GRADES.forEach(g => distribution[g.grade] = 0);

    students.forEach(s => {
      const m = marks[s.id] || 0;
      const exam = exams.find(e => e.id === selectedExam);
      const total = exam?.subjects[selectedSubject] || 100;
      const grade = calculateGrade(m, total);
      if (grade !== 'N/A') distribution[grade]++;
    });

    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [activeTab, students, marks, selectedExam, selectedSubject, exams]);

  // Report Card Generation State
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);

  const generateReports = async () => {
    if (!selectedClass || !selectedSection || !selectedExam) {
      toast.error("Please select Exam, Class, and Section");
      return;
    }

    setIsGeneratingReports(true);
    try {
      // 1. Fetch all students in class/section
      const studentQuery = query(
        collection(db, 'students'),
        where('school_id', '==', schoolId),
        where('academic_info.grade', '==', selectedClass),
        where('academic_info.section', '==', selectedSection)
      );
      const studentSnapshot = await getDocs(studentQuery);
      const classStudents = studentSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          name: `${data.personal_info?.firstName} ${data.personal_info?.lastName}`,
          rollNumber: data.academic_info?.rollNumber || 'N/A',
          grade: data.academic_info?.grade,
          section: data.academic_info?.section
        };
      });

      // 2. Fetch all marks for this exam and class/section
      const marksQuery = query(
        collection(db, 'exam_marks'),
        where('school_id', '==', schoolId),
        where('exam_id', '==', selectedExam),
        where('class', '==', selectedClass),
        where('section', '==', selectedSection)
      );
      const marksSnapshot = await getDocs(marksQuery);
      const allMarks = marksSnapshot.docs.map(doc => doc.data());

      // 3. Group marks by student
      const exam = exams.find(e => e.id === selectedExam);
      const reports = classStudents.map(student => {
        const studentMarks = allMarks.filter(m => m.student_id === student.id);
        
        let totalObtained = 0;
        let totalMax = 0;
        
        const subjectResults = Object.keys(exam?.subjects || {}).map(subName => {
          const markEntry = studentMarks.find(m => m.subject === subName);
          const obtained = markEntry?.marks_obtained || 0;
          const max = exam?.subjects[subName] || 100;
          
          totalObtained += obtained;
          totalMax += max;
          
          return {
            subject: subName,
            obtained,
            max,
            percentage: (obtained / max) * 100,
            grade: calculateGrade(obtained, max)
          };
        });

        const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

        return {
          student,
          subjects: subjectResults,
          totalObtained,
          totalMax,
          overallPercentage,
          overallGrade: calculateGrade(totalObtained, totalMax),
          position: 0
        };
      });

      // 4. Calculate Positions
      reports.sort((a, b) => b.totalObtained - a.totalObtained);
      reports.forEach((r, idx) => {
        r.position = idx + 1;
      });

      setReportCards(reports);
      toast.success(`Generated ${reports.length} report cards`);
    } catch (error) {
      console.error("Error generating reports:", error);
      toast.error("Failed to generate report cards");
    } finally {
      setIsGeneratingReports(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white p-6 pb-24">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          .report-card {
            padding: 40px;
            border: 2px solid #000;
            margin-bottom: 20px;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .report-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
          }
          .report-table th, .report-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          .report-footer {
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            padding-top: 40px;
          }
          .sig-line {
            border-top: 1px solid #000;
            width: 200px;
            text-align: center;
            padding-top: 5px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 no-print">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <Trophy className="text-neon-blue" size={40} />
            Exams & <span className="text-neon-blue">Results</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold tracking-widest uppercase mt-1">
            Academic Performance Engine v2.0
          </p>
        </div>

        <div className="flex bg-cyber-gray/30 p-1 rounded-xl border border-white/5">
          {(['setup', 'entry', 'analytics', 'report'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-neon-blue text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]' 
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {tab === 'report' ? 'Report Card Generator' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="no-print">
        {activeTab === 'setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Exam Form */}
            <div className="lg:col-span-1">
              <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
                <h2 className="text-xl font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Plus className="text-neon-blue" size={20} />
                  Define New Exam
                </h2>
                <form onSubmit={handleCreateExam} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Exam Name</label>
                    <input
                      type="text"
                      value={newExam.name}
                      onChange={e => setNewExam({...newExam, name: e.target.value})}
                      placeholder="e.g. Mid-Term 2026"
                      className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Term</label>
                      <select
                        value={newExam.term}
                        onChange={e => setNewExam({...newExam, term: e.target.value})}
                        className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                      >
                        <option>First Term</option>
                        <option>Mid Term</option>
                        <option>Final Term</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Session</label>
                      <input
                        type="text"
                        value={newExam.session}
                        onChange={e => setNewExam({...newExam, session: e.target.value})}
                        className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Subjects & Total Marks</label>
                      <button 
                        type="button"
                        onClick={() => setNewExam({...newExam, subjects: [...newExam.subjects, { name: '', total: 100 }]})}
                        className="text-[10px] font-black uppercase text-neon-blue hover:underline"
                      >
                        + Add Subject
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {newExam.subjects.map((sub, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Subject"
                            value={sub.name}
                            onChange={e => {
                              const subs = [...newExam.subjects];
                              subs[idx].name = e.target.value;
                              setNewExam({...newExam, subjects: subs});
                            }}
                            className="flex-1 bg-cyber-black border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neon-blue"
                          />
                          <input
                            type="number"
                            placeholder="Marks"
                            value={sub.total}
                            onChange={e => {
                              const subs = [...newExam.subjects];
                              subs[idx].total = parseInt(e.target.value);
                              setNewExam({...newExam, subjects: subs});
                            }}
                            className="w-20 bg-cyber-black border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neon-blue"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-neon-blue text-black font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] mt-4"
                  >
                    Create Exam Instance
                  </button>
                </form>
              </div>
            </div>

            {/* Exam List */}
            <div className="lg:col-span-2">
              <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5 h-full">
                <h2 className="text-xl font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                  <LayoutGrid className="text-neon-blue" size={20} />
                  Active Exam Definitions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map(exam => (
                    <div key={exam.id} className="bg-cyber-black/40 p-5 rounded-xl border border-white/5 hover:border-neon-blue/30 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-black uppercase tracking-tight text-lg group-hover:text-neon-blue transition-colors">{exam.name}</h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{exam.term} • {exam.session}</p>
                        </div>
                        <div className="bg-neon-blue/10 text-neon-blue text-[10px] font-black px-2 py-1 rounded uppercase">
                          {Object.keys(exam.subjects).length} Subjects
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(exam.subjects).slice(0, 4).map(s => (
                          <span key={s} className="text-[9px] bg-white/5 px-2 py-1 rounded text-gray-400 uppercase font-bold">{s}</span>
                        ))}
                        {Object.keys(exam.subjects).length > 4 && (
                          <span className="text-[9px] text-gray-600 font-bold">+{Object.keys(exam.subjects).length - 4} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {exams.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600 italic">
                      <FileText size={48} className="mb-4 opacity-20" />
                      <p>No exams defined yet. Start by creating one.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'entry' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Exam</label>
                <select
                  value={selectedExam}
                  onChange={e => setSelectedExam(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Choose Exam...</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Class...</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Section</label>
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Section...</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Choose Subject...</option>
                  {selectedExam && Object.keys(exams.find(e => e.id === selectedExam)?.subjects || {}).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={saveAllMarks}
                disabled={isSaving || students.length === 0}
                className="bg-neon-blue text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <CustomRefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Save All Marks
              </button>
            </div>

            {/* Data Grid */}
            <div className="bg-cyber-gray/20 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Roll No</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Student Name</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Marks Obtained</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Total Marks</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map((student, idx) => {
                      const total = exams.find(e => e.id === selectedExam)?.subjects[selectedSubject] || 100;
                      const obtained = marks[student.id] || 0;
                      const grade = calculateGrade(obtained, total);
                      
                      return (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-neon-blue">{student.rollNumber || 'N/A'}</td>
                          <td className="px-6 py-4 font-black uppercase text-sm">{student.name}</td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={marks[student.id] ?? ''}
                              onChange={e => handleMarkChange(student.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const nextInput = document.querySelector(`input[data-index="${idx + 1}"]`) as HTMLInputElement;
                                  nextInput?.focus();
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const prevInput = document.querySelector(`input[data-index="${idx - 1}"]`) as HTMLInputElement;
                                  prevInput?.focus();
                                }
                              }}
                              data-index={idx}
                              className="w-24 bg-cyber-black/60 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue text-center font-bold"
                            />
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-bold text-sm">{total}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                              grade === 'F' ? 'bg-red-500/10 text-red-500' : 'bg-neon-blue/10 text-neon-blue'
                            }`}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-gray-600 italic">
                          Select filters above to load student roster
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Grade Distribution */}
            <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
              <h2 className="text-xl font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                <PieChartIcon className="text-neon-blue" size={20} />
                Grade Distribution
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
                      itemStyle={{ color: '#00f3ff' }}
                    />
                    <Bar dataKey="value" fill="#00f3ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
              <h2 className="text-xl font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                <TrendingUp className="text-neon-blue" size={20} />
                Section Performance
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyber-black/40 p-6 rounded-xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Class Average</p>
                  <h3 className="text-3xl font-black text-neon-blue">
                    {students.length > 0 
                      ? (Object.keys(marks).reduce((acc, key) => acc + (marks[key] || 0), 0) / students.length).toFixed(1) 
                      : '0.0'}%
                  </h3>
                </div>
                <div className="bg-cyber-black/40 p-6 rounded-xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Pass Percentage</p>
                  <h3 className="text-3xl font-black text-green-400">
                    {students.length > 0 
                      ? ((Object.keys(marks).filter(key => (marks[key] || 0) >= 33).length / students.length) * 100).toFixed(0) 
                      : '0'}%
                  </h3>
                </div>
                <div className="bg-cyber-black/40 p-6 rounded-xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Highest Score</p>
                  <h3 className="text-3xl font-black text-yellow-400">
                    {students.length > 0 ? Math.max(...Object.keys(marks).map(key => marks[key] || 0), 0) : '0'}
                  </h3>
                </div>
                <div className="bg-cyber-black/40 p-6 rounded-xl border border-white/5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Students</p>
                  <h3 className="text-3xl font-black text-white">{students.length}</h3>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-cyber-gray/20 backdrop-blur-xl p-6 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Exam</label>
                <select
                  value={selectedExam}
                  onChange={e => setSelectedExam(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Choose Exam...</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Class</label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Class...</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Section</label>
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="w-full bg-cyber-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="">Section...</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateReports}
                  disabled={isGeneratingReports}
                  className="bg-white text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  {isGeneratingReports ? <CustomRefreshCw className="animate-spin" size={18} /> : <FileText size={18} />}
                  Generate Reports
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={reportCards.length === 0}
                  className="bg-neon-blue text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] flex items-center gap-2 disabled:opacity-50"
                >
                  <Printer size={18} />
                  Print All
                </button>
              </div>
            </div>

            {/* Preview Grid */}
            {reportCards.length > 0 && (
              <div className="bg-neon-blue/5 border border-neon-blue/20 p-4 rounded-xl mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-neon-blue/10 rounded-full flex items-center justify-center">
                    <Users className="text-neon-blue" size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Batch Summary</p>
                    <p className="text-sm font-black uppercase tracking-tight">
                      {reportCards.length} Reports Generated for {selectedClass} - {selectedSection}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Average Percentage</p>
                  <p className="text-lg font-black text-neon-blue">
                    {(reportCards.reduce((acc, r) => acc + r.overallPercentage, 0) / reportCards.length).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportCards.map((report, idx) => (
                <div key={idx} className="bg-cyber-gray/20 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black uppercase text-lg">{report.student.name}</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Roll: {report.student.rollNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-neon-blue">{report.overallPercentage.toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Grade: {report.overallGrade}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                      <span>Position</span>
                      <span className="text-white">#{report.position}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                      <span>Total Marks</span>
                      <span className="text-white">{report.totalObtained} / {report.totalMax}</span>
                    </div>
                  </div>
                </div>
              ))}
              {reportCards.length === 0 && (
                <div className="col-span-full py-20 text-center bg-cyber-gray/10 rounded-3xl border border-dashed border-white/5">
                  <FileText className="mx-auto text-gray-700 mb-4" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                    No reports generated yet. Select Exam, Class, and Section above to start.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print Container */}
      <div className="print-container hidden">
        {reportCards.map((report, idx) => (
          <div key={idx} className="report-card page-break">
            <div className="report-header">
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>EDUPAK SCHOOL SYSTEM</h1>
              <p style={{ margin: '5px 0' }}>Academic Excellence & Innovation</p>
              <h2 style={{ fontSize: '18px', marginTop: '10px', textDecoration: 'underline' }}>PROGRESS REPORT CARD</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div>
                <p><strong>Student Name:</strong> {report.student.name}</p>
                <p><strong>Roll Number:</strong> {report.student.rollNumber}</p>
                <p><strong>Class / Section:</strong> {report.student.grade} - {report.student.section}</p>
              </div>
              <div>
                <p><strong>Examination:</strong> {exams.find(e => e.id === selectedExam)?.name}</p>
                <p><strong>Session:</strong> {exams.find(e => e.id === selectedExam)?.session}</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Max Marks</th>
                  <th>Obtained</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {report.subjects.map((sub: any, sIdx: number) => (
                  <tr key={sIdx}>
                    <td>{sub.subject}</td>
                    <td>{sub.max}</td>
                    <td>{sub.obtained}</td>
                    <td>{sub.percentage.toFixed(1)}%</td>
                    <td>{sub.grade}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                  <td>TOTAL</td>
                  <td>{report.totalMax}</td>
                  <td>{report.totalObtained}</td>
                  <td>{report.overallPercentage.toFixed(1)}%</td>
                  <td>{report.overallGrade}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #000', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', textAlign: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#666' }}>OVERALL PERCENTAGE</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{report.overallPercentage.toFixed(1)}%</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#666' }}>FINAL GRADE</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{report.overallGrade}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#666' }}>CLASS POSITION</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{report.position}</p>
                </div>
              </div>
            </div>

            <div className="report-footer">
              <div className="sig-line">Class Teacher</div>
              <div className="sig-line">Examination Controller</div>
              <div className="sig-line">Principal</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExamsResultsManagement;

const CustomRefreshCw = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);
