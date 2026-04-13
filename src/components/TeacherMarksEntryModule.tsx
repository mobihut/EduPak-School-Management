import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  FileText, 
  LayoutGrid, 
  Plus, 
  Save, 
  Search, 
  ChevronRight, 
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Filter,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  writeBatch, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Exam {
  id: string;
  name: string;
  term: string;
  session: string;
  subjects: Record<string, number>;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  class: string;
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

interface TeacherClass {
  class: string;
  section: string;
  subject: string;
}

const TeacherMarksEntryModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!userProfile.uid || !userProfile.schoolId) return;
      
      try {
        // 1. Fetch Exams
        const examsQuery = query(
          collection(db, 'exams'), 
          where('school_id', '==', userProfile.schoolId),
          orderBy('created_at', 'desc')
        );
        const examsSnap = await getDocs(examsQuery);
        const examsData = examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setExams(examsData);
        if (examsData.length > 0) setSelectedExam(examsData[0].id);

        // 2. Fetch teacher's assigned classes and subjects from timetables
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
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();
  }, [userProfile.uid, userProfile.schoolId]);

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchStudentsAndMarks();
    }
  }, [selectedExam, selectedClass]);

  const fetchStudentsAndMarks = async () => {
    if (!selectedExam || !selectedClass) return;

    setIsLoading(true);
    try {
      // 1. Fetch Students
      const studentsQuery = query(
        collection(db, 'students'),
        where('school_id', '==', userProfile.schoolId),
        where('academic_info.grade', '==', selectedClass.class),
        where('academic_info.section', '==', selectedClass.section)
      );
      const studentSnap = await getDocs(studentsQuery);
      const studentsData = studentSnap.docs.map(doc => {
        const s = doc.data();
        return {
          id: doc.id,
          name: `${s.personal_info.firstName} ${s.personal_info.lastName}`,
          rollNumber: s.academic_info.rollNumber,
          class: s.academic_info.grade,
          section: s.academic_info.section
        };
      });
      setStudents(studentsData.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '')));

      // 2. Fetch Existing Marks
      const marksQuery = query(
        collection(db, 'exam_marks'),
        where('school_id', '==', userProfile.schoolId),
        where('exam_id', '==', selectedExam),
        where('subject', '==', selectedClass.subject),
        where('class', '==', selectedClass.class),
        where('section', '==', selectedClass.section)
      );
      const marksSnap = await getDocs(marksQuery);
      const marksData: Record<string, number> = {};
      marksSnap.docs.forEach(doc => {
        const data = doc.data() as ExamMark;
        marksData[data.student_id] = data.marks_obtained;
      });
      setMarks(marksData);
    } catch (error) {
      console.error("Error fetching students/marks:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkChange = (studentId: string, value: string) => {
    const numValue = parseFloat(value);
    const totalMarks = exams.find(e => e.id === selectedExam)?.subjects[selectedClass?.subject || ''] || 100;

    if (value === '') {
      const newMarks = { ...marks };
      delete newMarks[studentId];
      setMarks(newMarks);
      return;
    }

    if (isNaN(numValue)) return;
    if (numValue < 0 || numValue > totalMarks) {
      toast.error(`Marks must be between 0 and ${totalMarks}`);
      return;
    }

    setMarks(prev => ({ ...prev, [studentId]: numValue }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, studentId: string, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextStudent = students[index + 1];
      if (nextStudent) {
        inputRefs.current[nextStudent.id]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevStudent = students[index - 1];
      if (prevStudent) {
        inputRefs.current[prevStudent.id]?.focus();
      }
    }
  };

  const saveMarks = async () => {
    if (!selectedExam || !selectedClass) return;

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const totalMarks = exams.find(e => e.id === selectedExam)?.subjects[selectedClass.subject] || 100;

      // 1. Fetch existing marks to get IDs for updates
      const marksQuery = query(
        collection(db, 'exam_marks'),
        where('school_id', '==', userProfile.schoolId),
        where('exam_id', '==', selectedExam),
        where('subject', '==', selectedClass.subject),
        where('class', '==', selectedClass.class),
        where('section', '==', selectedClass.section)
      );
      const existingMarksSnap = await getDocs(marksQuery);
      const existingMarksMap: Record<string, string> = {};
      existingMarksSnap.docs.forEach(doc => {
        existingMarksMap[doc.data().student_id] = doc.id;
      });

      // 2. Add to batch
      Object.entries(marks).forEach(([studentId, obtained]) => {
        const markData: ExamMark = {
          student_id: studentId,
          exam_id: selectedExam,
          subject: selectedClass.subject,
          marks_obtained: obtained,
          total_marks: totalMarks,
          class: selectedClass.class,
          section: selectedClass.section,
          school_id: userProfile.schoolId,
          updated_at: serverTimestamp()
        } as any;

        if (existingMarksMap[studentId]) {
          batch.update(doc(db, 'exam_marks', existingMarksMap[studentId]), markData as any);
        } else {
          const newDocRef = doc(collection(db, 'exam_marks'));
          batch.set(newDocRef, markData as any);
        }
      });

      await batch.commit();
      toast.success("Marks saved successfully!");
    } catch (error) {
      console.error("Error saving marks:", error);
      toast.error("Failed to save marks");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentTotalMarks = exams.find(e => e.id === selectedExam)?.subjects[selectedClass?.subject || ''] || 100;

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
            <h1 className="text-xl font-black uppercase tracking-tighter">Enter Marks</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              Examination Results Entry
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-cyber-gray/10 rounded-3xl border border-white/5 p-6 space-y-4 sticky top-24 z-20 backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Exam</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.term})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Select Class & Subject</label>
              <select
                value={selectedClass ? `${selectedClass.class}-${selectedClass.section}-${selectedClass.subject}` : ''}
                onChange={(e) => {
                  const [c, s, sub] = e.target.value.split('-');
                  setSelectedClass({ class: c, section: s, subject: sub });
                }}
                className="w-full bg-cyber-black border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-neon-blue transition-all"
              >
                {assignedClasses.map(c => (
                  <option key={`${c.class}-${c.section}-${c.subject}`} value={`${c.class}-${c.section}-${c.subject}`}>
                    Class {c.class}-{c.section} • {c.subject}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-neon-blue">
            <AlertCircle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Total Marks for {selectedClass?.subject}: {currentTotalMarks}
            </span>
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

          <div className="bg-cyber-gray/10 rounded-3xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-cyber-black/80 backdrop-blur-md border-b border-white/5">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 w-16">Roll</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Student Name</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 w-32 text-right">Marks</th>
                  </tr>
                </thead>
                <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="p-12 text-center">
                      <Clock className="text-neon-blue animate-spin mx-auto" size={32} />
                    </td>
                  </tr>
                ) : filteredStudents.map((student, index) => (
                  <tr key={student.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="p-4 text-xs font-black text-neon-blue">{student.rollNumber || '??'}</td>
                    <td className="p-4">
                      <p className="text-xs font-black uppercase tracking-tight">{student.name}</p>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          ref={el => { if (el) inputRefs.current[student.id] = el; }}
                          type="number"
                          value={marks[student.id] ?? ''}
                          onChange={(e) => handleMarkChange(student.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, student.id, index)}
                          placeholder="0"
                          className="w-20 bg-cyber-black border border-white/10 rounded-xl px-3 py-2 text-right text-sm font-black text-neon-blue focus:outline-none focus:border-neon-blue transition-all"
                        />
                        <span className="text-[10px] text-gray-600 font-bold uppercase">/ {currentTotalMarks}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Save Button */}
        <div className="fixed bottom-6 left-4 right-4 md:relative md:bottom-0 md:left-0 md:right-0">
          <button
            onClick={saveMarks}
            disabled={isSaving || students.length === 0}
            className="w-full bg-neon-purple text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(188,19,254,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
            Save All Marks
          </button>
        </div>

      </div>
    </div>
  );
};

export default TeacherMarksEntryModule;
