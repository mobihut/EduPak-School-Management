import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Printer, 
  Download, 
  QrCode, 
  User, 
  Phone, 
  Droplets, 
  Calendar, 
  Hash,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { motion, AnimatePresence } from 'motion/react';

interface IDCardGeneratorProps {
  schoolId: string;
}

interface StudentData {
  id: string;
  student_id: string;
  personal_info: {
    firstName: string;
    lastName: string;
    dob: string;
    gender: string;
    bloodGroup?: string;
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

interface SchoolSettings {
  name: string;
  logoUrl?: string;
}

const IDCardGenerator: React.FC<IDCardGeneratorProps> = ({ schoolId }) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  
  // Filters
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toggles
  const [showQrCode, setShowQrCode] = useState(true);
  const [showBloodGroup, setShowBloodGroup] = useState(true);
  const [showGuardianPhone, setShowGuardianPhone] = useState(true);
  
  // Signature
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  
  // Preview Zoom
  const [zoom, setZoom] = useState(1);
  
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ID_Cards_${selectedGrade}_${selectedSection}`,
  });

  useEffect(() => {
    const fetchSchoolSettings = async () => {
      try {
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) {
          setSchoolSettings({
            name: schoolDoc.data().name,
            logoUrl: schoolDoc.data().logoUrl || 'https://picsum.photos/seed/school/200/200'
          });
        }
      } catch (error) {
        console.error("Error fetching school settings:", error);
      }
    };
    fetchSchoolSettings();
  }, [schoolId]);

  const fetchStudents = async () => {
    if (!selectedGrade && !searchQuery) return;
    
    setLoading(true);
    try {
      let q;
      if (searchQuery) {
        // Simple search by student_id or name (client-side filter for simplicity in this demo)
        q = query(collection(db, 'students'), where('school_id', '==', schoolId));
      } else {
        q = query(
          collection(db, 'students'), 
          where('school_id', '==', schoolId),
          where('academic_info.grade', '==', selectedGrade),
          where('academic_info.section', '==', selectedSection)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const fetchedStudents: StudentData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        if (searchQuery) {
          const fullName = `${data.personal_info?.firstName || ''} ${data.personal_info?.lastName || ''}`.toLowerCase();
          if (fullName.includes(searchQuery.toLowerCase()) || (data.student_id && data.student_id.includes(searchQuery))) {
            fetchedStudents.push({ id: doc.id, ...data } as StudentData);
          }
        } else {
          fetchedStudents.push({ id: doc.id, ...data } as StudentData);
        }
      });
      setStudents(fetchedStudents);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
      {/* Left Pane: Settings & Filters */}
      <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Filter size={18} className="text-neon-indigo" /> Control Room
          </h3>

          {/* Selection Filters */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Class</label>
                <select 
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-indigo outline-none transition-all"
                >
                  <option value="">Select Class</option>
                  {['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Section</label>
                <select 
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-indigo outline-none transition-all"
                >
                  <option value="">Select Section</option>
                  {['A', 'B', 'C', 'D'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text"
                placeholder="Search Student ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white text-sm focus:border-neon-indigo outline-none transition-all"
              />
            </div>

            <button 
              onClick={fetchStudents}
              disabled={loading}
              className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/5 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Fetching...' : 'Fetch Students'}
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Toggles */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Display Options</label>
            <div className="space-y-3">
              <Toggle label="Include QR Code" checked={showQrCode} onChange={setShowQrCode} />
              <Toggle label="Show Blood Group" checked={showBloodGroup} onChange={setShowBloodGroup} />
              <Toggle label="Include Guardian Phone" checked={showGuardianPhone} onChange={setShowGuardianPhone} />
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Signature Upload */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Principal Signature</label>
            <div className="relative group">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleSignatureUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-white/5 rounded-2xl p-6 text-center group-hover:border-neon-indigo/50 transition-all bg-black/20">
                {signatureUrl ? (
                  <div className="relative inline-block">
                    <img src={signatureUrl} alt="Signature" className="h-12 mx-auto filter invert brightness-200" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSignatureUrl(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto text-gray-500" size={24} />
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Upload Transparent PNG</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={() => handlePrint()}
            disabled={students.length === 0}
            className="w-full bg-neon-indigo text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} /> Generate & Print Cards
          </button>
        </div>
      </div>

      {/* Right Pane: Live Preview Canvas */}
      <div className="lg:col-span-8 bg-black/40 rounded-3xl border border-white/5 overflow-hidden flex flex-col">
        <div className="p-4 border-bottom border-white/5 flex items-center justify-between bg-cyber-gray/20">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Preview</span>
            <div className="flex items-center bg-black/40 rounded-lg border border-white/5 p-1">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:text-neon-indigo transition-colors"><ZoomOut size={14} /></button>
              <span className="text-[10px] font-mono w-12 text-center text-white">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:text-neon-indigo transition-colors"><ZoomIn size={14} /></button>
            </div>
          </div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            {students.length} Students Selected
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-gray-900/50 flex justify-center items-start custom-scrollbar">
          <div 
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            className="transition-transform duration-200"
          >
            {/* A4 Paper Simulation */}
            <div 
              ref={printRef}
              className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] p-[10mm] print:p-0 mx-auto"
            >
              <div className="grid grid-cols-2 gap-[5mm] justify-items-center">
                {students.map((student) => (
                  <IDCard 
                    key={student.id}
                    student={student}
                    schoolSettings={schoolSettings}
                    showQrCode={showQrCode}
                    showBloodGroup={showBloodGroup}
                    showGuardianPhone={showGuardianPhone}
                    signatureUrl={signatureUrl}
                  />
                ))}
              </div>
              
              {/* Print Styles */}
              <style>{`
                @media print {
                  @page {
                    size: A4;
                    margin: 10mm;
                  }
                  body {
                    background: white !important;
                    margin: 0;
                    padding: 0;
                  }
                  .print-container {
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 5mm !important;
                    width: 100% !important;
                  }
                  /* Hide everything except the printRef content */
                  body > *:not(.print-root) {
                    display: none !important;
                  }
                }
              `}</style>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-medium text-gray-400">{label}</span>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-all relative ${checked ? 'bg-neon-indigo' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

interface IDCardProps {
  student: StudentData;
  schoolSettings: SchoolSettings | null;
  showQrCode: boolean;
  showBloodGroup: boolean;
  showGuardianPhone: boolean;
  signatureUrl: string | null;
}

const IDCard: React.FC<IDCardProps> = ({ 
  student, 
  schoolSettings, 
  showQrCode, 
  showBloodGroup, 
  showGuardianPhone,
  signatureUrl 
}) => {
  return (
    <div className="id-card-container w-[2.125in] h-[3.375in] bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm print:shadow-none print:border-gray-300 page-break-inside-avoid relative">
      {/* Design Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-neon-indigo" />
      
      {/* Header */}
      <div className="p-2 flex items-center gap-2 border-b border-gray-100">
        <img 
          src={schoolSettings?.logoUrl || 'https://picsum.photos/seed/school/50/50'} 
          alt="Logo" 
          className="w-8 h-8 object-contain"
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-[8px] font-black uppercase text-gray-900 leading-tight truncate">
            {schoolSettings?.name || 'EduPak Institution'}
          </h4>
          <p className="text-[6px] font-bold text-neon-indigo uppercase tracking-widest">Student ID Card</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 flex flex-col items-center text-center">
        {/* Photo */}
        <div className="w-20 h-24 bg-gray-100 border-2 border-gray-200 rounded-md overflow-hidden mb-2">
          {student.personal_info.photoUrl ? (
            <img src={student.personal_info.photoUrl} alt="Student" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <User size={32} />
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-tight mb-1">
          {student.personal_info.firstName} {student.personal_info.lastName}
        </h3>

        {/* Details Grid */}
        <div className="w-full grid grid-cols-2 gap-x-2 gap-y-1 text-left mt-1">
          <DetailItem icon={<Hash size={6} />} label="ID" value={student.student_id} />
          <DetailItem icon={<Calendar size={6} />} label="Grade" value={student.academic_info.grade} />
          <DetailItem icon={<Filter size={6} />} label="Sec" value={student.academic_info.section} />
          {student.academic_info.rollNumber && (
            <DetailItem icon={<Hash size={6} />} label="Roll" value={student.academic_info.rollNumber} />
          )}
          <DetailItem icon={<Calendar size={6} />} label="DOB" value={student.personal_info.dob} />
          {showBloodGroup && student.personal_info.bloodGroup && (
            <DetailItem icon={<Droplets size={6} />} label="Blood" value={student.personal_info.bloodGroup} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-50 border-t border-gray-100 flex items-end justify-between">
        <div className="flex-1 space-y-1">
          {showGuardianPhone && (
            <div className="flex items-center gap-1">
              <Phone size={6} className="text-gray-400" />
              <span className="text-[6px] font-bold text-gray-600">{student.guardian_info.phone}</span>
            </div>
          )}
          <div className="pt-1">
            {signatureUrl ? (
              <img src={signatureUrl} alt="Signature" className="h-4 object-contain" />
            ) : (
              <div className="h-4 border-b border-gray-300 border-dashed w-16" />
            )}
            <p className="text-[5px] font-black uppercase text-gray-400 mt-0.5">Principal Signature</p>
          </div>
        </div>

        {showQrCode && (
          <div className="bg-white p-1 rounded border border-gray-200">
            <QRCodeSVG value={student.student_id} size={28} />
          </div>
        )}
      </div>
    </div>
  );
};

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center gap-1">
    <span className="text-gray-400">{icon}</span>
    <span className="text-[6px] font-black text-gray-400 uppercase">{label}:</span>
    <span className="text-[6px] font-bold text-gray-800 truncate">{value}</span>
  </div>
);

export default IDCardGenerator;
