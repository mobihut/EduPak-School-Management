import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  User, 
  TrendingUp, 
  Award, 
  Clock, 
  FileText, 
  BarChart3,
  ChevronRight,
  Star,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  class: string;
  section: string;
  personal_info: {
    firstName: string;
    lastName: string;
  };
}

interface MarkRecord {
  subject: string;
  marks_obtained: number;
  total_marks: number;
  exam_name: string;
}

interface AttendanceStats {
  present: number;
  absent: number;
  leave: number;
  total: number;
}

const TeacherStudentProgressModule: React.FC<{ userProfile: any; onBack: () => void }> = ({ userProfile, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [studentData, setStudentData] = useState<{
    marks: MarkRecord[];
    attendance: AttendanceStats;
    behavior: any[];
  } | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!userProfile.schoolId) return;
      setIsLoading(true);
      try {
        // Fetch students for the teacher's school
        const q = query(
          collection(db, 'students'),
          where('school_id', '==', userProfile.schoolId)
        );
        const snapshot = await getDocs(q);
        const studentsData = snapshot.docs.map(doc => {
          const s = doc.data();
          return {
            id: doc.id,
            name: `${s.personal_info.firstName} ${s.personal_info.lastName}`,
            rollNumber: s.academic_info.rollNumber,
            class: s.academic_info.grade,
            section: s.academic_info.section,
            personal_info: s.personal_info
          } as Student;
        });
        setStudents(studentsData);
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error("Failed to load students");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [userProfile.schoolId]);

  const fetchStudentProgress = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoading(true);
    try {
      // 1. Fetch Marks
      const marksQuery = query(
        collection(db, 'exam_marks'),
        where('school_id', '==', userProfile.schoolId),
        where('student_id', '==', student.id),
        limit(10)
      );
      const marksSnap = await getDocs(marksQuery);
      const marks = marksSnap.docs.map(doc => doc.data() as MarkRecord);

      // 2. Fetch Attendance (Mocking stats for now based on actual records if available)
      const attendanceQuery = query(
        collection(db, 'attendance_records'),
        where('school_id', '==', userProfile.schoolId)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      let p = 0, a = 0, l = 0;
      attendanceSnap.docs.forEach(doc => {
        const data = doc.data();
        const record = data.records.find((r: any) => r.student_id === student.id);
        if (record) {
          if (record.status === 'P') p++;
          else if (record.status === 'A') a++;
          else if (record.status === 'L') l++;
        }
      });

      // 3. Fetch Behavior
      const behaviorQuery = query(
        collection(db, 'behavior_records'),
        where('student_id', '==', student.id),
        orderBy('created_at', 'desc'),
        limit(5)
      );
      const behaviorSnap = await getDocs(behaviorQuery);
      const behavior = behaviorSnap.docs.map(doc => doc.data());

      setStudentData({
        marks,
        attendance: { present: p, absent: a, leave: l, total: p + a + l },
        behavior
      });
    } catch (error) {
      console.error("Error fetching progress:", error);
      toast.error("Failed to load student progress");
    } finally {
      setIsLoading(false);
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
            onClick={selectedStudent ? () => setSelectedStudent(null) : onBack}
            className="p-3 rounded-2xl bg-cyber-gray/20 border border-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Student Progress</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              {selectedStudent ? `Analyzing ${selectedStudent.name}` : 'Performance Analytics Center'}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!selectedStudent ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  placeholder="Search for a student to view progress..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-cyber-gray/10 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-neon-blue transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading && students.length === 0 ? (
                  [1,2,3,4].map(i => (
                    <div key={i} className="h-24 bg-cyber-gray/10 rounded-2xl animate-pulse border border-white/5" />
                  ))
                ) : filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => fetchStudentProgress(student)}
                    className="flex items-center justify-between p-5 bg-cyber-gray/10 border border-white/5 rounded-2xl hover:border-neon-blue/30 transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/5 flex items-center justify-center text-neon-blue font-black">
                        {student.rollNumber || '??'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-neon-blue transition-colors">{student.name}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Class {student.class}-{student.section}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-gray-600 group-hover:text-neon-blue transition-colors" size={20} />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {isLoading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Generating Progress Report...</p>
                </div>
              ) : (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-cyber-gray/10 border border-white/5 p-6 rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <TrendingUp className="text-green-400" size={20} />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Attendance</span>
                      </div>
                      <p className="text-3xl font-black tracking-tighter">
                        {studentData?.attendance.total ? Math.round((studentData.attendance.present / studentData.attendance.total) * 100) : 0}%
                      </p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Overall Presence</p>
                    </div>
                    <div className="bg-cyber-gray/10 border border-white/5 p-6 rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <Award className="text-neon-blue" size={20} />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Academic</span>
                      </div>
                      <p className="text-3xl font-black tracking-tighter">
                        {studentData?.marks.length ? Math.round(studentData.marks.reduce((acc, m) => acc + (m.marks_obtained/m.total_marks), 0) / studentData.marks.length * 100) : 0}%
                      </p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Avg. Performance</p>
                    </div>
                    <div className="bg-cyber-gray/10 border border-white/5 p-6 rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <Star className="text-yellow-400" size={20} />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Behavior</span>
                      </div>
                      <p className="text-3xl font-black tracking-tighter">
                        {studentData?.behavior.reduce((acc, b) => acc + (b.type === 'star' ? 1 : b.type === 'warning' ? -1 : 0), 0) || 0}
                      </p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Merit Points</p>
                    </div>
                  </div>

                  {/* Marks Chart / List */}
                  <section className="bg-cyber-gray/10 border border-white/5 rounded-[2rem] p-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                      <BarChart3 size={16} className="text-neon-blue" />
                      Recent Exam Performance
                    </h3>
                    <div className="space-y-4">
                      {studentData?.marks.map((m, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                            <span>{m.subject} <span className="text-gray-600">({m.exam_name})</span></span>
                            <span className="text-neon-blue">{m.marks_obtained}/{m.total_marks}</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(m.marks_obtained/m.total_marks) * 100}%` }}
                              className={`h-full ${m.marks_obtained/m.total_marks > 0.8 ? 'bg-green-500' : m.marks_obtained/m.total_marks > 0.5 ? 'bg-neon-blue' : 'bg-red-500'}`}
                            />
                          </div>
                        </div>
                      ))}
                      {studentData?.marks.length === 0 && (
                        <p className="text-center text-gray-600 text-[10px] font-bold uppercase py-8">No exam data available</p>
                      )}
                    </div>
                  </section>

                  {/* Behavior Timeline */}
                  <section className="bg-cyber-gray/10 border border-white/5 rounded-[2rem] p-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                      <Star size={16} className="text-yellow-400" />
                      Behavior Log
                    </h3>
                    <div className="space-y-4">
                      {studentData?.behavior.map((b, i) => (
                        <div key={i} className="flex gap-4 items-start p-4 bg-cyber-black/40 rounded-2xl border border-white/5">
                          <div className={`p-2 rounded-lg ${b.type === 'star' ? 'bg-green-500/10 text-green-400' : b.type === 'warning' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {b.type === 'star' ? <Award size={16} /> : b.type === 'warning' ? <AlertCircle size={16} /> : <FileText size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">{b.category}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{b.description}</p>
                            <p className="text-[8px] text-gray-600 mt-2 font-bold uppercase">{b.created_at?.toDate().toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                      {studentData?.behavior.length === 0 && (
                        <p className="text-center text-gray-600 text-[10px] font-bold uppercase py-8">No behavior records found</p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default TeacherStudentProgressModule;
