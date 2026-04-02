import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Target, 
  Clock, 
  BookOpen, 
  Calendar, 
  Bell, 
  FileText, 
  Library, 
  Video, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Award,
  ChevronRight,
  Search,
  X,
  FileUp,
  Loader2,
  User,
  History
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  Timestamp,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { useStudentAssignments, Assignment } from '../hooks/useStudentAssignments';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { toast } from 'sonner';

interface StudentProfile {
  student_id: string;
  school_id: string;
  student_uid?: string;
  personal_info: {
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  academic_info: {
    grade: string;
    section: string;
    rollNumber: string;
  };
  attendance_stats?: {
    percentage: number;
    status: 'gold' | 'silver' | 'bronze';
  };
  gpa?: number;
}

interface TimetableSlot {
  subject: string;
  teacher_name: string;
  time: string;
  zoom_link?: string;
}

const StudentPortalDashboard: React.FC = () => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  const { assignments } = useStudentAssignments(
    student?.school_id || '', 
    student?.academic_info.grade || '', 
    student?.academic_info.section || ''
  );

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Student Profile
    const q = query(
      collection(db, 'students'),
      where('student_uid', '==', auth.currentUser.uid)
    );

    const unsubscribeStudent = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as StudentProfile;
        setStudent(data);
        fetchRelatedData(data);
      }
      setIsLoading(false);
    });

    return () => unsubscribeStudent();
  }, []);

  const fetchRelatedData = (studentData: StudentProfile) => {
    // Fetch Timetable for today
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const timetableQuery = query(
      collection(db, 'timetables'),
      where('school_id', '==', studentData.school_id),
      where('class', '==', studentData.academic_info.grade),
      where('section', '==', studentData.academic_info.section)
    );

    onSnapshot(timetableQuery, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const todaySchedule = data.schedule?.[today] || {};
        const slots = Object.entries(todaySchedule).map(([period, details]: [string, any]) => ({
          period,
          ...details
        }));
        setTimetable(slots);
      }
    });

    // Fetch Announcements
    const announcementsQuery = query(
      collection(db, 'global_announcements'),
      where('target_audience', 'in', ['all', studentData.school_id]),
      orderBy('created_at', 'desc'),
      limit(5)
    );
    onSnapshot(announcementsQuery, (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Recent Results (Exam Marks)
    const marksQuery = query(
      collection(db, 'exam_marks'),
      where('student_id', '==', studentData.student_id),
      where('school_id', '==', studentData.school_id),
      orderBy('timestamp', 'desc'),
      limit(6)
    );

    onSnapshot(marksQuery, (snapshot) => {
      if (!snapshot.empty) {
        const marks = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            subject: data.subject,
            score: (data.marks_obtained / data.total_marks) * 100,
            full: 100
          };
        });
        setRecentResults(marks);
      } else {
        // Mock Recent Results if none found
        setRecentResults([
          { subject: 'Math', score: 85, full: 100 },
          { subject: 'Science', score: 92, full: 100 },
          { subject: 'English', score: 78, full: 100 },
          { subject: 'History', score: 88, full: 100 },
          { subject: 'Physics', score: 95, full: 100 },
        ]);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmissionFile(e.target.files[0]);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !submissionFile || !student) return;

    setIsSubmitting(true);
    try {
      const fileRef = ref(storage, `schools/${student.school_id}/assignments/${selectedAssignment.id}/${auth.currentUser?.uid}_${submissionFile.name}`);
      await uploadBytes(fileRef, submissionFile);
      const downloadUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'submissions'), {
        assignment_id: selectedAssignment.id,
        student_id: student.student_id,
        student_uid: auth.currentUser?.uid,
        school_id: student.school_id,
        submission_url: downloadUrl,
        submitted_at: serverTimestamp(),
        status: 'submitted',
        file_name: submissionFile.name
      });

      toast.success("Assignment submitted successfully! 🚀");
      setIsSubmitModalOpen(false);
      setSubmissionFile(null);
      setSelectedAssignment(null);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit assignment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <Loader2 className="text-neon-cyan animate-spin" size={48} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center text-white">
        <p>Student profile not found. Please contact administration.</p>
      </div>
    );
  }

  const attendanceColor = student.attendance_stats?.status === 'gold' ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 
                         student.attendance_stats?.status === 'silver' ? 'border-gray-300 shadow-[0_0_15px_rgba(209,213,219,0.5)]' : 
                         'border-amber-600 shadow-[0_0_15px_rgba(180,83,9,0.5)]';

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans pb-20">
      {/* Gamified Header */}
      <header className="relative overflow-hidden pt-8 pb-12 px-6 bg-gradient-to-b from-neon-purple/10 to-transparent">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className={`relative w-24 h-24 rounded-full border-4 ${attendanceColor} p-1 transition-all duration-500`}>
            <img 
              src={student.personal_info.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.personal_info.firstName}`} 
              alt="Avatar" 
              className="w-full h-full rounded-full object-cover bg-cyber-gray"
            />
            <div className="absolute -bottom-2 -right-2 bg-neon-cyan p-1.5 rounded-lg shadow-lg">
              <Trophy size={16} className="text-black" />
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black tracking-tighter"
            >
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">{student.personal_info.firstName}</span>! 🚀
            </motion.h1>
            <p className="text-gray-400 font-medium mt-1 uppercase tracking-widest text-xs">
              {student.academic_info.grade} • Section {student.academic_info.section} • Roll #{student.academic_info.rollNumber}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Attendance</p>
              <p className="text-xl font-black text-neon-cyan">{student.attendance_stats?.percentage || 94}%</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">GPA</p>
              <p className="text-xl font-black text-neon-purple">{student.gpa || '3.8'}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tasks</p>
              <p className="text-xl font-black text-neon-pink">{assignments.length}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Today's Mission */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
              <Target size={18} className="text-neon-cyan" />
              Today's Mission
            </h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase">{new Date().toDateString()}</span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {timetable.length > 0 ? timetable.map((slot, idx) => {
              const isCurrent = idx === 1; // Mocking current period
              return (
                <motion.div 
                  key={idx}
                  whileHover={{ scale: 1.02 }}
                  className={`flex-shrink-0 w-64 p-5 rounded-2xl border transition-all duration-300 ${
                    isCurrent 
                    ? 'bg-neon-cyan/10 border-neon-cyan shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                    : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${isCurrent ? 'bg-neon-cyan text-black' : 'bg-white/10 text-gray-400'}`}>
                      {slot.period}
                    </span>
                    {isCurrent && (
                      <motion.div 
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-2 h-2 rounded-full bg-neon-cyan shadow-[0_0_8px_#06b6d4]"
                      />
                    )}
                  </div>
                  <h3 className="text-lg font-black mb-1">{slot.subject}</h3>
                  <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                    <User size={12} /> {slot.teacher_name}
                  </p>
                  {slot.zoom_link && (
                    <button className="w-full py-2 rounded-xl bg-neon-cyan text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-colors">
                      <Video size={14} /> Join Online Class
                    </button>
                  )}
                </motion.div>
              );
            }) : (
              <div className="w-full p-8 rounded-2xl border border-dashed border-white/10 text-center text-gray-500">
                No classes scheduled for today. Rest up! 💤
              </div>
            )}
          </div>
        </section>

        {/* Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Assignments */}
          <div className="md:col-span-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400">
                <BookOpen size={18} className="text-neon-purple" />
                Homework & Assignments
              </h2>
              <button className="text-[10px] font-bold text-neon-purple uppercase hover:underline">View All</button>
            </div>
            
            <div className="space-y-4">
              {assignments.length > 0 ? assignments.slice(0, 3).map((assignment) => (
                <div key={assignment.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-neon-purple/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{assignment.title}</h4>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        {assignment.subject} • Due {assignment.due_date.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      setIsSubmitModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-neon-purple/10 text-neon-purple text-[10px] font-black uppercase tracking-widest border border-neon-purple/20 group-hover:bg-neon-purple group-hover:text-black transition-all"
                  >
                    Submit Work
                  </button>
                </div>
              )) : (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">All caught up! No pending assignments.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div className="md:col-span-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
              <TrendingUp size={18} className="text-neon-pink" />
              Recent Results
            </h2>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={recentResults}>
                  <PolarGrid stroke="#ffffff20" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Radar
                    name="Student"
                    dataKey="score"
                    stroke="#f472b6"
                    fill="#f472b6"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {recentResults.slice(0, 2).map((res, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">{res.subject}</span>
                  <span className="font-bold text-neon-pink">{res.score}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Noticeboard */}
          <div className="md:col-span-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
              <Bell size={18} className="text-yellow-400" />
              Noticeboard
            </h2>
            <div className="space-y-4">
              {announcements.map((note) => (
                <div key={note.id} className="p-4 rounded-2xl bg-white/5 border-l-4 border-yellow-400">
                  <h4 className="font-bold text-sm mb-1">{note.title}</h4>
                  <p className="text-xs text-gray-400 line-clamp-2">{note.message}</p>
                  <p className="text-[10px] text-gray-600 mt-2 uppercase font-black">{new Date(note.created_at?.seconds * 1000).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Library */}
          <div className="md:col-span-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-400 mb-6">
              <Library size={18} className="text-neon-cyan" />
              Library & Resources
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-neon-cyan/50 transition-all group">
                <div className="w-12 h-12 rounded-full bg-neon-cyan/10 flex items-center justify-center text-neon-cyan mb-3 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Syllabus PDF</span>
              </button>
              <button className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-neon-cyan/50 transition-all group">
                <div className="w-12 h-12 rounded-full bg-neon-cyan/10 flex items-center justify-center text-neon-cyan mb-3 group-hover:scale-110 transition-transform">
                  <History size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Past Papers</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Submission Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#151921] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Submit Assignment</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">{selectedAssignment?.title}</p>
                </div>
                <button 
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div 
                  className={`relative group border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all ${
                    submissionFile ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10 hover:border-neon-cyan/50'
                  }`}
                >
                  <input 
                    type="file" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {submissionFile ? (
                    <>
                      <CheckCircle2 size={48} className="text-neon-cyan mb-4" />
                      <p className="text-sm font-bold text-white">{submissionFile.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase mt-2">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 mb-4 group-hover:text-neon-cyan group-hover:scale-110 transition-all">
                        <FileUp size={32} />
                      </div>
                      <p className="text-sm font-bold text-gray-400">Drag & drop or click to upload</p>
                      <p className="text-[10px] text-gray-600 uppercase mt-2">PDF, JPG, or PNG (Max 5MB)</p>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-400/10 border border-yellow-400/20">
                    <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-400/80 leading-relaxed uppercase font-bold">
                      Ensure your file is named correctly (e.g., Math_HW_Ahmed.pdf) before submitting. Late submissions may be penalized.
                    </p>
                  </div>
                </div>

                <button 
                  disabled={!submissionFile || isSubmitting}
                  onClick={handleSubmitAssignment}
                  className="w-full py-4 rounded-2xl bg-neon-cyan text-black font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Submit to Teacher
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentPortalDashboard;
