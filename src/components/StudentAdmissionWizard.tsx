import React, { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, BookOpen, Users, CheckCircle, ChevronRight, 
  ChevronLeft, Upload, X, Loader2, Calendar, Phone, 
  Mail, CreditCard, MapPin, Droplets, ArrowRight, 
  Camera, ShieldCheck, FileText, Heart, Star, Bus, 
  Home, Save, Trash2, ArrowLeft
} from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// --- Form Schema ---
const admissionSchema = z.object({
  // Step 1: Personal Info
  firstName: z.string().min(2, "First name is too short"),
  lastName: z.string().min(2, "Last name is too short"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  bloodGroup: z.string().optional(),
  cnic_bform: z.string().optional(),
  religion: z.string().optional(),
  nationality: z.string().min(1, "Nationality is required"),
  medicalHistory: z.string().optional(),
  
  // Step 2: Academic Details
  admissionDate: z.string().min(1, "Admission date is required"),
  grade: z.string().min(1, "Grade is required"),
  section: z.string().min(1, "Section is required"),
  rollNumber: z.string().optional(),
  previousSchool: z.string().optional(),
  house: z.string().optional(),
  clubs: z.string().optional(), 
  
  // Step 3: Guardian Details
  guardianName: z.string().min(2, "Guardian name is required"),
  guardianPhone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  guardianEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  guardianCnic: z.string().optional(),
  homeAddress: z.string().min(10, "Address is too short"),
  guardianOccupation: z.string().optional(),
  guardianRelation: z.string().min(1, "Relation is required"),
});

type AdmissionFormData = z.infer<typeof admissionSchema>;

interface StudentAdmissionWizardProps {
  schoolId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const StudentAdmissionWizard: React.FC<StudentAdmissionWizardProps> = ({ schoolId, onSuccess, onCancel }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Photo & Cropping State
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [finalPhotoBlob, setFinalPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<AdmissionFormData>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      admissionDate: new Date().toISOString().split('T')[0],
      gender: "male",
      nationality: "Pakistani",
      guardianRelation: "Father",
      firstName: "",
      lastName: "",
      dob: "",
      grade: "",
      section: "",
      guardianName: "",
      guardianPhone: "",
      homeAddress: "",
    }
  });

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCropping(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    ));
  };

  const getCroppedImg = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          setFinalPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          setIsCropping(false);
        }
      }, 'image/jpeg');
    }
  }, [completedCrop]);

  const nextStep = async () => {
    let fieldsToValidate: (keyof AdmissionFormData)[] = [];
    if (step === 1) fieldsToValidate = ["firstName", "lastName", "dob", "gender"];
    if (step === 2) fieldsToValidate = ["grade", "section", "admissionDate"];
    if (step === 3) fieldsToValidate = ["guardianName", "guardianPhone", "homeAddress"];

    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  const onSubmit = async (data: AdmissionFormData) => {
    setIsSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('school_id', '==', schoolId));
      const snapshot = await getDocs(q);
      const studentCount = snapshot.size + 1;
      const studentId = `EP-${year}-${studentCount.toString().padStart(4, '0')}`;
      
      let photoUrl = "";

      if (finalPhotoBlob) {
        const storageRef = ref(storage, `schools/${schoolId}/students/${studentId}/profile.jpg`);
        const snapshot = await uploadBytes(storageRef, finalPhotoBlob);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'students'), {
        student_id: studentId,
        school_id: schoolId,
        personal_info: {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dob,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          cnic_bform: data.cnic_bform,
          religion: data.religion,
          nationality: data.nationality,
          medical_history: data.medicalHistory,
          photoUrl
        },
        academic_info: {
          grade: data.grade,
          section: data.section,
          rollNumber: data.rollNumber,
          previousSchool: data.previousSchool,
          house: data.house,
          admissionYear: year.toString(),
          clubs: data.clubs ? data.clubs.split(',').map(c => c.trim()) : []
        },
        guardian_info: {
          name: data.guardianName,
          relationship: data.guardianRelation,
          phone: data.guardianPhone,
          email: data.guardianEmail,
          occupation: data.guardianOccupation,
          address: data.homeAddress
        },
        status: 'active',
        admission_date: data.admissionDate,
        created_at: serverTimestamp(),
        timeline: [{
          event: 'Admission Completed',
          date: Timestamp.now(),
          type: 'Academic',
          details: `Student admitted to Class ${data.grade} - ${data.section}`
        }],
        behavior_stats: { merits: 0, demerits: 0 }
      });

      toast.success("Student admitted successfully!");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Admission error:", error);
      toast.error("Failed to submit admission. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, label: 'Personal', icon: User },
    { id: 2, label: 'Academic', icon: BookOpen },
    { id: 3, label: 'Guardian', icon: Users },
    { id: 4, label: 'Review', icon: CheckCircle },
  ];

  return (
    <div className="max-w-5xl mx-auto font-['Plus_Jakarta_Sans'] bg-slate-50 min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Student <span className="text-slate-400">Admission</span></h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Complete the multi-step form to register a new student.</p>
        </div>
        <button onClick={onCancel} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all border border-slate-200 shadow-sm">
          <X size={24} />
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-12 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-200 -z-10" />
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-3">
            <div 
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                step >= s.id 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' 
                  : 'bg-white text-slate-300 border-slate-200'
              }`}
            >
              <s.icon size={24} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-slate-900' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-white border border-slate-200 p-8 md:p-16 rounded-[3rem] shadow-sm min-h-[600px] flex flex-col">
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <div className="w-40 h-40 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden group-hover:border-slate-900 transition-colors">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="text-slate-300 group-hover:text-slate-900" size={40} />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={onSelectFile}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
                      <Upload size={16} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Profile Photo Upload</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                    <input {...register("firstName")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="Ahmed" />
                    {errors.firstName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                    <input {...register("lastName")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="Khan" />
                    {errors.lastName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.lastName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                    <input type="date" {...register("dob")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                    <select {...register("gender")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all appearance-none">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                    <select {...register("bloodGroup")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all appearance-none">
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNIC / B-Form</label>
                    <input {...register("cnic_bform")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="42101-XXXXXXX-X" />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical History / Allergies</label>
                    <textarea {...register("medicalHistory")} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all resize-none" placeholder="e.g. Peanut allergy, Asthma..." />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admission Date</label>
                    <input type="date" {...register("admissionDate")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class / Grade</label>
                    <select {...register("grade")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all appearance-none">
                      <option value="">Select Grade</option>
                      {['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Section</label>
                    <input {...register("section")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="e.g. A, Blue, Rose" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Roll Number</label>
                    <input {...register("rollNumber")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="e.g. 2026-001" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">House System</label>
                    <select {...register("house")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all appearance-none">
                      <option value="">Select House</option>
                      <option value="Jinnah">Jinnah (Blue)</option>
                      <option value="Iqbal">Iqbal (Green)</option>
                      <option value="Liaquat">Liaquat (Red)</option>
                      <option value="Sir Syed">Sir Syed (Yellow)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Previous School</label>
                    <input {...register("previousSchool")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="e.g. City School" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clubs / Societies (Comma separated)</label>
                    <input {...register("clubs")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="e.g. Robotics, Debate, Sports" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Name</label>
                    <input {...register("guardianName")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="Muhammad Khan" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relationship</label>
                    <select {...register("guardianRelation")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all appearance-none">
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Uncle">Uncle</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input {...register("guardianPhone")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="+923001234567" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input {...register("guardianEmail")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="guardian@example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Occupation</label>
                    <input {...register("guardianOccupation")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="e.g. Engineer, Doctor" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">National ID (CNIC)</label>
                    <input {...register("guardianCnic")} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all" placeholder="42101-XXXXXXX-X" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Residential Address</label>
                    <textarea 
                      {...register("homeAddress")} 
                      rows={4} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:border-slate-900 outline-none transition-all min-h-[120px] resize-y" 
                      placeholder="Enter full residential address (House #, Street, Area, City)..." 
                    />
                    {errors.homeAddress && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.homeAddress.message}</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl">
                   <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                        {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <User size={40} className="text-slate-200 m-auto mt-6" />}
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{getValues().firstName} {getValues().lastName}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class {getValues().grade} - {getValues().section}</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Personal Details</h5>
                      <div className="space-y-3">
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">DOB:</span> {getValues().dob}</p>
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">Gender:</span> {getValues().gender}</p>
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">CNIC:</span> {getValues().cnic_bform || 'N/A'}</p>
                      </div>
                   </div>
                   <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Guardian Details</h5>
                      <div className="space-y-3">
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">Name:</span> {getValues().guardianName}</p>
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">Phone:</span> {getValues().guardianPhone}</p>
                        <p className="text-xs text-slate-900"><span className="text-slate-400 font-bold">Address:</span> {getValues().homeAddress}</p>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-10 border-t border-slate-100">
          <button 
            onClick={step === 1 ? onCancel : prevStep}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px] transition-all"
          >
            <ChevronLeft size={16} /> {step === 1 ? 'Cancel' : 'Previous'}
          </button>

          {step < 4 ? (
            <button 
              onClick={nextStep}
              className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
            >
              Next Step <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {isSubmitting ? 'Processing...' : 'Confirm Admission'}
            </button>
          )}
        </div>
      </div>

      {/* Cropper Modal */}
      <AnimatePresence>
        {isCropping && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] p-10 overflow-hidden shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-8">Crop Profile Photo</h3>
              
              <div className="max-h-[50vh] overflow-auto mb-8 rounded-2xl border border-slate-200">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img ref={imgRef} src={imgSrc} alt="Crop me" onLoad={onImageLoad} className="max-w-full" />
                </ReactCrop>
              </div>

              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setIsCropping(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={getCroppedImg}
                  className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/20"
                >
                  Apply Crop
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentAdmissionWizard;
