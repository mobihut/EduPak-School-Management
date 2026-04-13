import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Briefcase, MapPin, Phone, Mail, Calendar, 
  ShieldCheck, Activity, TrendingUp, History, FileText, 
  Upload, Download, Trash2, Plus, Link2, QrCode, 
  Printer, MessageSquare, ChevronLeft, Bus, Home, 
  Star, ShieldAlert, CheckCircle2, XCircle, Clock, 
  Camera, Save, FileUp, ExternalLink, MoreVertical, 
  AlertCircle, Heart, FileDown, UserX, GraduationCap, 
  CreditCard, ArrowLeft, MoreHorizontal, Edit2
} from 'lucide-react';
import { Student } from './StudentManagement';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  doc, updateDoc, arrayUnion, arrayRemove, collection, 
  query, where, getDocs, Timestamp, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentProfileProps {
  student: Student;
  onBack: () => void;
  onUpdate: (updates: Partial<Student>) => Promise<void>;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, onBack, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'academic' | 'documents' | 'timeline' | 'behavior' | 'transport' | 'financials'>('overview');
  const [isUploading, setIsUploading] = useState(false);
  const [isLinkingSibling, setIsLinkingSibling] = useState(false);
  const [siblingSearch, setSiblingSearch] = useState('');
  const [siblingResults, setSiblingResults] = useState<Student[]>([]);
  const [isAddingTimeline, setIsAddingTimeline] = useState(false);
  const [timelineForm, setTimelineForm] = useState({ event: '', type: 'Academic', details: '' });

  const attendanceData = [
    { month: 'Sep', rate: 92 },
    { month: 'Oct', rate: 95 },
    { month: 'Nov', rate: 88 },
    { month: 'Dec', rate: 96 },
    { month: 'Jan', rate: 94 },
    { month: 'Feb', rate: 98 },
  ];

  const onDrop = async (acceptedFiles: File[]) => {
    setIsUploading(true);
    try {
      for (const file of acceptedFiles) {
        const storageRef = ref(storage, `schools/${student.school_id}/students/${student.id}/documents/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        await updateDoc(doc(db, 'students', student.id), {
          documents: arrayUnion({
            name: file.name,
            url,
            type: file.type,
            uploaded_at: Timestamp.now()
          })
        });
      }
      toast.success("Documents uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload documents");
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDeleteDocument = async (docItem: any) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const storageRef = ref(storage, docItem.url);
      await deleteObject(storageRef);
      await updateDoc(doc(db, 'students', student.id), {
        documents: arrayRemove(docItem)
      });
      toast.success("Document deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleSearchSiblings = async () => {
    if (siblingSearch.length < 3) return;
    try {
      const q = query(
        collection(db, 'students'),
        where('school_id', '==', student.school_id),
        where('student_id', '!=', student.student_id)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Student))
        .filter(s => 
          `${s.personal_info.firstName} ${s.personal_info.lastName}`.toLowerCase().includes(siblingSearch.toLowerCase()) ||
          s.student_id.toLowerCase().includes(siblingSearch.toLowerCase())
        );
      setSiblingResults(results);
    } catch (error) {
      console.error("Sibling search error:", error);
    }
  };

  const handleLinkSibling = async (siblingId: string) => {
    try {
      await updateDoc(doc(db, 'students', student.id), {
        sibling_ids: arrayUnion(siblingId)
      });
      await updateDoc(doc(db, 'students', siblingId), {
        sibling_ids: arrayUnion(student.id)
      });
      toast.success("Sibling linked successfully");
      setIsLinkingSibling(false);
    } catch (error) {
      console.error("Linking error:", error);
      toast.error("Failed to link sibling");
    }
  };

  const handleAddTimeline = async () => {
    try {
      await updateDoc(doc(db, 'students', student.id), {
        timeline: arrayUnion({
          ...timelineForm,
          date: Timestamp.now()
        })
      });
      toast.success("Timeline event added");
      setIsAddingTimeline(false);
      setTimelineForm({ event: '', type: 'Academic', details: '' });
    } catch (error) {
      console.error("Timeline error:", error);
    }
  };

  const handleUpdateBehavior = async (type: 'merits' | 'demerits', amount: number) => {
    const currentStats = student.behavior_stats || { merits: 0, demerits: 0 };
    await onUpdate({
      behavior_stats: {
        ...currentStats,
        [type]: Math.max(0, currentStats[type] + amount)
      }
    });
    toast.success(`${type === 'merits' ? 'Merit' : 'Demerit'} updated`);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'academic', label: 'Academic', icon: GraduationCap },
    { id: 'financials', label: 'Financials', icon: CreditCard },
    { id: 'documents', label: 'Vault', icon: ShieldCheck },
    { id: 'timeline', label: 'Timeline', icon: History },
    { id: 'behavior', label: 'Discipline', icon: ShieldAlert },
    { id: 'transport', label: 'Transport', icon: Bus },
  ];

  return (
    <div className="space-y-8 pb-20 font-['Plus_Jakarta_Sans'] bg-slate-50 min-h-screen p-4 md:p-8">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-all group"
        >
          <div className="p-2 rounded-xl bg-white border border-slate-200 group-hover:bg-slate-50 transition-all">
            <ArrowLeft size={18} />
          </div>
          Back to Directory
        </button>
        <div className="flex gap-3">
          <button className="p-3 bg-white rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-slate-200 shadow-sm">
            <Printer size={18} />
          </button>
          <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
            Edit Profile
          </button>
        </div>
      </div>

      {/* Profile Banner */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-32 bg-slate-900 relative">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        </div>
        <div className="px-8 pb-8 -mt-16 relative">
          <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] bg-white border-4 border-white shadow-xl overflow-hidden">
                {student.personal_info.photoUrl ? (
                  <img src={student.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50">
                    <User size={64} className="text-slate-200" />
                  </div>
                )}
              </div>
              <button className="absolute bottom-2 right-2 p-3 bg-slate-900 text-white rounded-2xl shadow-xl hover:scale-110 transition-transform">
                <Camera size={16} />
              </button>
            </div>

            <div className="flex-grow pb-2">
              <div className="flex items-center gap-4 mb-2">
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
                  {student.personal_info.firstName} <span className="text-slate-400">{student.personal_info.lastName}</span>
                </h2>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  student.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  {student.status}
                </span>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                Class {student.academic_info.grade} • Section {student.academic_info.section} • Roll No: {student.academic_info.rollNumber || 'TBD'}
              </p>
            </div>

            <div className="flex gap-3 pb-2">
              <button className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">
                <Phone size={20} />
              </button>
              <button className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-2 p-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
              activeTab === tab.id 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Personal Info Card */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <User className="text-slate-400" size={24} /> Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {[
                      { label: 'Full Name', value: `${student.personal_info.firstName} ${student.personal_info.lastName}`, icon: User },
                      { label: 'Date of Birth', value: student.personal_info.dateOfBirth, icon: Calendar },
                      { label: 'Gender', value: student.personal_info.gender, icon: Activity },
                      { label: 'Blood Group', value: student.personal_info.bloodGroup || 'N/A', icon: Heart },
                      { label: 'Admission Year', value: student.academic_info.admissionYear, icon: GraduationCap },
                      { label: 'Student ID', value: student.student_id, icon: ShieldCheck },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900 capitalize">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guardian Info Card */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <Briefcase className="text-slate-400" size={24} /> Guardian Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {[
                      { label: 'Primary Guardian', value: student.guardian_info.name, icon: User },
                      { label: 'Relationship', value: student.guardian_info.relationship, icon: Link2 },
                      { label: 'Contact Number', value: student.guardian_info.phone, icon: Phone },
                      { label: 'Email Address', value: student.guardian_info.email || 'N/A', icon: Mail },
                      { label: 'Occupation', value: student.guardian_info.occupation || 'N/A', icon: Briefcase },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'academic' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <GraduationCap className="text-slate-400" size={24} /> Academic Standing
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                      { label: 'Current Grade', value: student.academic_info.grade },
                      { label: 'Section', value: student.academic_info.section },
                      { label: 'Roll Number', value: student.academic_info.rollNumber || 'N/A' },
                      { label: 'Admission No', value: student.student_id },
                      { label: 'Enrollment Date', value: student.admission_date },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sibling Linking Section */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                      <Link2 className="text-slate-400" size={24} /> Sibling Network
                    </h3>
                    <button 
                      onClick={() => setIsLinkingSibling(true)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                      Link Sibling
                    </button>
                  </div>

                  {isLinkingSibling && (
                    <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                      <div className="flex gap-4">
                        <input 
                          type="text"
                          placeholder="Search by Name or Student ID..."
                          value={siblingSearch}
                          onChange={(e) => setSiblingSearch(e.target.value)}
                          className="flex-grow bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-slate-900 outline-none"
                        />
                        <button 
                          onClick={handleSearchSiblings}
                          className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Search
                        </button>
                      </div>
                      <div className="space-y-2">
                        {siblingResults.map(res => (
                          <div key={res.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                            <span className="text-xs font-bold text-slate-900">{res.personal_info.firstName} {res.personal_info.lastName} ({res.student_id})</span>
                            <button 
                              onClick={() => handleLinkSibling(res.id)}
                              className="text-[10px] font-black uppercase text-slate-900"
                            >
                              Link Student
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {student.sibling_ids?.length ? (
                      student.sibling_ids.map(sid => (
                        <div key={sid} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                              <User size={18} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Linked Sibling</p>
                              <p className="text-[10px] text-slate-400 font-mono">{sid}</p>
                            </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-xs font-medium italic">No siblings linked to this profile.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'financials' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <CreditCard className="text-slate-400" size={24} /> Fee Payment History
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Month</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {[
                          { month: 'March 2026', amount: '12,500', date: '05 Mar 2026', status: 'Paid' },
                          { month: 'February 2026', amount: '12,500', date: '02 Feb 2026', status: 'Paid' },
                          { month: 'January 2026', amount: '12,500', date: '10 Jan 2026', status: 'Paid' },
                        ].map((fee, i) => (
                          <tr key={i} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 text-sm font-bold text-slate-900">{fee.month}</td>
                            <td className="py-4 text-sm font-mono text-slate-600">PKR {fee.amount}</td>
                            <td className="py-4 text-xs text-slate-400">{fee.date}</td>
                            <td className="py-4">
                              <span className="px-2 py-1 bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest rounded border border-green-100">
                                {fee.status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-slate-900 transition-all border border-slate-200">
                                <Download size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'documents' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <ShieldCheck className="text-slate-400" size={24} /> Document Vault
                  </h3>
                  
                  <div 
                    {...getRootProps()} 
                    className={`p-12 border-2 border-dashed rounded-[2rem] text-center transition-all cursor-pointer mb-10 ${
                      isDragActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <FileUp className="text-slate-400" size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-900 mb-1">Drag & drop documents here</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CNIC, B-Form, Health Records, Certificates (Max 5MB)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {student.documents?.map((docItem, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <FileText className="text-slate-400" size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{docItem.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                              {docItem.uploaded_at ? format(docItem.uploaded_at.toDate(), 'MMM dd, yyyy') : 'Recently'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a 
                            href={docItem.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white rounded-lg text-slate-400 hover:text-slate-900 transition-all border border-slate-200"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button 
                            onClick={() => handleDeleteDocument(docItem)}
                            className="p-2 bg-white rounded-lg text-slate-400 hover:text-red-600 transition-all border border-slate-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'timeline' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                      <History className="text-slate-400" size={24} /> Student Timeline
                    </h3>
                    <button 
                      onClick={() => setIsAddingTimeline(true)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                      Add Event
                    </button>
                  </div>

                  {isAddingTimeline && (
                    <div className="mb-10 p-8 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Title</label>
                          <input 
                            type="text"
                            value={timelineForm.event}
                            onChange={(e) => setTimelineForm({...timelineForm, event: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-900"
                            placeholder="e.g. Won Science Fair"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                          <select 
                            value={timelineForm.type}
                            onChange={(e) => setTimelineForm({...timelineForm, type: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"
                          >
                            <option value="Academic">Academic</option>
                            <option value="Discipline">Discipline</option>
                            <option value="Health">Health</option>
                            <option value="Sports">Sports</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</label>
                        <textarea 
                          value={timelineForm.details}
                          onChange={(e) => setTimelineForm({...timelineForm, details: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-900 h-24 resize-none"
                          placeholder="Provide more context..."
                        />
                      </div>
                      <div className="flex justify-end gap-4">
                        <button onClick={() => setIsAddingTimeline(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                        <button onClick={handleAddTimeline} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Save Event</button>
                      </div>
                    </div>
                  )}

                  <div className="relative space-y-8 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                    {student.timeline?.sort((a,b) => b.date.seconds - a.date.seconds).map((event, i) => (
                      <div key={i} className="relative pl-16">
                        <div className="absolute left-4 top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-900 z-10" />
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{event.event}</h4>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {format(event.date.toDate(), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <span className="inline-block px-2 py-0.5 bg-white rounded text-[8px] font-black uppercase tracking-widest text-slate-400 mb-3 border border-slate-100">
                            {event.type}
                          </span>
                          {event.details && <p className="text-xs text-slate-500 leading-relaxed">{event.details}</p>}
                        </div>
                      </div>
                    ))}
                    {(!student.timeline || student.timeline.length === 0) && (
                      <div className="pl-16 py-10">
                        <p className="text-slate-400 text-xs italic">No timeline events recorded yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'behavior' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-green-50 border border-green-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Star className="text-green-500" size={32} />
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 mb-2">{student.behavior_stats?.merits || 0}</h3>
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-8">Merit Points</p>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleUpdateBehavior('merits', 1)} className="p-3 bg-white text-green-600 rounded-xl hover:bg-green-50 transition-all border border-green-100 shadow-sm">
                        <Plus size={20} />
                      </button>
                      <button onClick={() => handleUpdateBehavior('merits', -1)} className="p-3 bg-white text-slate-400 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 shadow-sm">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-100 p-10 rounded-[2.5rem] text-center shadow-sm">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <ShieldAlert className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 mb-2">{student.behavior_stats?.demerits || 0}</h3>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-8">Demerit Points</p>
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleUpdateBehavior('demerits', 1)} className="p-3 bg-white text-red-600 rounded-xl hover:bg-red-50 transition-all border border-red-100 shadow-sm">
                        <Plus size={20} />
                      </button>
                      <button onClick={() => handleUpdateBehavior('demerits', -1)} className="p-3 bg-white text-slate-400 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 shadow-sm">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <Activity className="text-slate-400" size={24} /> Discipline Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Overall Conduct</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Based on merit/demerit ratio</p>
                      </div>
                      <span className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-100">
                        Excellent
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'transport' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8 flex items-center gap-3">
                    <Bus className="text-slate-400" size={24} /> Transport Mapping
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Name</p>
                        <p className="text-sm font-bold text-slate-900">Route 12 - DHA Phase 6</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup/Drop Stop</p>
                        <p className="text-sm font-bold text-slate-900">Main Gate, Sector J</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</p>
                        <p className="text-sm font-bold text-slate-900">LES-4421</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <MapPin className="text-slate-400" size={32} />
                      </div>
                      <p className="text-xs font-bold text-slate-900 mb-2">Live Tracking</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-relaxed">
                        Real-time bus tracking is available during school hours.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: QR & Quick Stats */}
        <div className="space-y-8">
          {/* QR Code Card */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Digital Identity</h3>
            <div className="p-6 bg-slate-50 rounded-3xl inline-block border border-slate-100 mb-8">
              <QRCodeSVG value={`STUDENT:${student.id}`} size={160} level="H" />
            </div>
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">{student.student_id}</p>
            <p className="text-[10px] text-slate-400 font-medium max-w-[200px] mx-auto leading-relaxed">
              Scan for quick attendance and profile verification.
            </p>
          </div>

          {/* Attendance Trends */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Attendance Trends</h3>
            <div className="h-48 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#0f172a" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#0f172a', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-end gap-4 mb-6">
              <div className="text-5xl font-bold text-slate-900 tracking-tighter">94<span className="text-slate-400">%</span></div>
              <div className="pb-2">
                <TrendingUp className="text-green-500" size={20} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '94%' }}
                  className="h-full bg-slate-900"
                />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Present: 172</span>
                <span className="text-slate-400">Absent: 8</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
            <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all flex items-center justify-center gap-3">
              <FileDown size={16} />
              Download SLC
            </button>
            <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all flex items-center justify-center gap-3">
              <Printer size={16} />
              Print ID Card
            </button>
            <button className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-all flex items-center justify-center gap-3">
              <UserX size={16} />
              Withdraw Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
