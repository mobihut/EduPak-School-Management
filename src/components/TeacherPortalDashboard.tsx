import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Coffee, 
  Clock, 
  ChevronRight, 
  Bell, 
  User, 
  BookOpen,
  ArrowRight,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import TeacherAttendanceModule from './TeacherAttendanceModule';
import TeacherMarksEntryModule from './TeacherMarksEntryModule';
import TeacherLeaveModule from './TeacherLeaveModule';

// --- Types ---
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
}

interface TeacherScheduleItem {
  day: string;
  period: string;
  subject: string;
  className: string;
  section: string;
  time: string;
  isCurrent?: boolean;
  isNext?: boolean;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: Timestamp;
  priority: 'high' | 'normal' | 'low';
}

// --- Helper Hook ---
const useTeacherSchedule = (uid: string | undefined, schoolId: string | undefined) => {
  const [schedule, setSchedule] = useState<TeacherScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !schoolId) return;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    // In a real production app, we'd have a 'teacher_ids' array on the timetable doc for efficient querying
    // For this implementation, we fetch the school's timetables and filter for the teacher
    const q = query(collection(db, 'timetables'), where('school_id', '==', schoolId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherItems: TeacherScheduleItem[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Timetable;
        const daySchedule = data.schedule[today];
        
        if (daySchedule) {
          Object.entries(daySchedule).forEach(([period, slot]) => {
            if (slot.teacher_id === uid) {
              teacherItems.push({
                day: today,
                period,
                subject: slot.subject,
                className: data.class,
                section: data.section,
                time: period // In a real app, map 'Period 1' to actual time '08:00 AM'
              });
            }
          });
        }
      });

      // Sort by period (assuming period names are sortable or mapped)
      const sorted = teacherItems.sort((a, b) => a.period.localeCompare(b.period));
      setSchedule(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedule:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid, schoolId]);

  return { schedule, loading };
};

// --- Components ---

const QuickActionCard = ({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-6 rounded-3xl bg-cyber-gray/20 border border-white/5 hover:border-${color}/40 transition-all gap-3 h-32 md:h-40`}
  >
    <div className={`p-3 rounded-2xl bg-${color}/10 text-${color}`}>
      <Icon size={28} />
    </div>
    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white text-center">{label}</span>
  </motion.button>
);

const TeacherPortalDashboard: React.FC<{ userProfile: any }> = ({ userProfile }) => {
  const { schedule, loading } = useTeacherSchedule(userProfile.uid, userProfile.schoolId);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeView, setActiveView] = useState<'dashboard' | 'attendance' | 'marks' | 'leave'>('dashboard');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userProfile.schoolId) return;
    
    const q = query(
      collection(db, 'announcements'), 
      where('school_id', '==', userProfile.schoolId),
      orderBy('timestamp', 'desc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    return () => unsubscribe();
  }, [userProfile.schoolId]);

  const upNext = useMemo(() => {
    // Simple logic: first item in schedule that isn't past (mocking time for now)
    return schedule[0];
  }, [schedule]);

  const formattedDate = currentTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit'
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <Clock className="text-neon-blue animate-spin" size={48} />
      </div>
    );
  }

  if (activeView === 'attendance') {
    return <TeacherAttendanceModule userProfile={userProfile} onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'marks') {
    return <TeacherMarksEntryModule userProfile={userProfile} onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'leave') {
    return <TeacherLeaveModule userProfile={userProfile} onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter">
                WELCOME BACK, <span className="text-neon-blue">{userProfile.name.toUpperCase()}</span>
              </h1>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                {formattedDate} • {formattedTime}
              </p>
            </div>
            <button className="p-3 rounded-2xl bg-cyber-gray/20 border border-white/5 text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {/* Up Next Widget */}
        {upNext && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-neon-blue/20 via-cyber-gray/40 to-cyber-black border border-neon-blue/30 p-6 md:p-8"
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neon-blue mb-2">
                  <Clock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Up Next</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter">
                  {upNext.className}-{upNext.section} <span className="text-gray-400">/</span> {upNext.subject}
                </h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                  Starts in 15 mins • {upNext.period}
                </p>
              </div>
              <button className="bg-neon-blue text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,243,255,0.2)] flex items-center justify-center gap-2">
                Go to Class
                <ArrowRight size={16} />
              </button>
            </div>
            {/* Decorative background element */}
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-neon-blue/10 blur-[80px] rounded-full" />
          </motion.div>
        )}

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionCard 
            icon={CheckCircle2} 
            label="Mark Attendance" 
            color="neon-blue" 
            onClick={() => setActiveView('attendance')} 
          />
          <QuickActionCard 
            icon={FileText} 
            label="Enter Marks" 
            color="neon-purple" 
            onClick={() => setActiveView('marks')} 
          />
          <QuickActionCard 
            icon={Calendar} 
            label="My Timetable" 
            color="neon-pink" 
            onClick={() => toast.info("Timetable View Loading...")} 
          />
          <QuickActionCard 
            icon={Coffee} 
            label="Leave Request" 
            color="gray-400" 
            onClick={() => setActiveView('leave')} 
          />
        </section>

        {/* Today's Schedule Timeline */}
        <section className="bg-cyber-gray/10 rounded-[2rem] border border-white/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
              <Calendar className="text-neon-blue" size={20} />
              Today's Schedule
            </h3>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {schedule.length} Periods
            </span>
          </div>

          <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
            {schedule.map((item, idx) => (
              <div key={idx} className="flex gap-6 group">
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${idx === 0 ? 'bg-neon-blue border-neon-blue text-black' : 'bg-cyber-black border-white/10 text-gray-500'}`}>
                  <span className="text-xs font-black">{idx + 1}</span>
                </div>
                <div className={`flex-1 p-5 rounded-2xl border transition-all ${idx === 0 ? 'bg-neon-blue/5 border-neon-blue/20' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">{item.subject}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                        Class {item.className}-{item.section}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-neon-blue uppercase tracking-widest">{item.period}</p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase mt-1">08:00 - 08:45</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {schedule.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-gray-600" size={24} />
                </div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No classes scheduled for today</p>
              </div>
            )}
          </div>
        </section>

        {/* Announcements */}
        <section className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 px-2">
            <Bell size={14} />
            School Announcements
          </h3>
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-cyber-gray/20 border border-white/5 p-4 rounded-2xl flex gap-4 items-start">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ann.priority === 'high' ? 'bg-neon-pink shadow-[0_0_10px_rgba(255,46,108,0.5)]' : 'bg-neon-blue'}`} />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-white">{ann.title}</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{ann.content}</p>
                  <p className="text-[9px] text-gray-600 mt-2 font-bold uppercase">
                    {ann.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <p className="text-center text-gray-600 text-[10px] font-bold uppercase py-4">No recent announcements</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default TeacherPortalDashboard;
