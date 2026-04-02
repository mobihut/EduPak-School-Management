import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  BookOpen, 
  Users, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  X, 
  Loader2,
  Calendar,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Droplets,
  ArrowRight
} from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

// --- Form Schema ---
const admissionSchema = z.object({
  // Step 1: Personal Info
  firstName: z.string().min(2, "First name is too short"),
  lastName: z.string().min(2, "Last name is too short"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  bloodGroup: z.string().optional(),
  
  // Step 2: Academic Details
  admissionDate: z.string().min(1, "Admission date is required"),
  grade: z.string().min(1, "Grade is required"),
  section: z.string().min(1, "Section is required"),
  rollNumber: z.string().optional(),
  previousSchool: z.string().optional(),
  
  // Step 3: Guardian Details
  guardianName: z.string().min(2, "Guardian name is required"),
  guardianPhone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  guardianEmail: z.string().email("Invalid email address").optional().or(z.literal('')),
  guardianCnic: z.string().min(5, "CNIC is required"),
  homeAddress: z.string().min(10, "Address is too short"),
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
      firstName: "",
      lastName: "",
      dob: "",
      grade: "",
      section: "",
      guardianName: "",
      guardianPhone: "",
      guardianCnic: "",
      homeAddress: "",
    }
  });

  const nextStep = async () => {
    let fieldsToValidate: (keyof AdmissionFormData)[] = [];
    if (step === 1) fieldsToValidate = ["firstName", "lastName", "dob", "gender"];
    if (step === 2) fieldsToValidate = ["grade", "section", "admissionDate"];
    if (step === 3) fieldsToValidate = ["guardianName", "guardianPhone", "guardianCnic", "homeAddress"];

    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: AdmissionFormData) => {
    setIsSubmitting(true);
    try {
      // 1. Generate a temporary ID for storage path
      const studentId = `STU-${Date.now()}`;
      let photoUrl = "";

      // 2. Upload Photo if exists
      if (photoFile) {
        const storageRef = ref(storage, `schools/${schoolId}/students/${studentId}/profile.jpg`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      // 3. Save to Firestore
      await addDoc(collection(db, 'students'), {
        student_id: studentId,
        school_id: schoolId,
        personal_info: {
          firstName: data.firstName,
          lastName: data.lastName,
          dob: data.dob,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          photoUrl
        },
        academic_info: {
          grade: data.grade,
          section: data.section,
          rollNumber: data.rollNumber,
          previousSchool: data.previousSchool
        },
        guardian_info: {
          name: data.guardianName,
          phone: data.guardianPhone,
          email: data.guardianEmail,
          cnic: data.guardianCnic,
          address: data.homeAddress
        },
        status: 'active',
        admission_date: data.admissionDate,
        created_at: serverTimestamp()
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

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center bg-cyber-gray/50 overflow-hidden group-hover:border-neon-indigo transition-colors">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="text-gray-600 group-hover:text-neon-indigo" size={32} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2 text-center">Profile Photo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">First Name</label>
                <input 
                  {...register("firstName")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. Ahmed"
                />
                {errors.firstName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Last Name</label>
                <input 
                  {...register("lastName")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. Khan"
                />
                {errors.lastName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.lastName.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Date of Birth</label>
                <input 
                  type="date"
                  {...register("dob")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                />
                {errors.dob && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.dob.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Gender</label>
                <select 
                  {...register("gender")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors appearance-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Blood Group</label>
                <select 
                  {...register("bloodGroup")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors appearance-none"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Admission Date</label>
                <input 
                  type="date"
                  {...register("admissionDate")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Class / Grade</label>
                <select 
                  {...register("grade")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors appearance-none"
                >
                  <option value="">Select Grade</option>
                  <option value="Nursery">Nursery</option>
                  <option value="KG">KG</option>
                  <option value="Class 1">Class 1</option>
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                  <option value="Class 4">Class 4</option>
                  <option value="Class 5">Class 5</option>
                  <option value="Class 6">Class 6</option>
                  <option value="Class 7">Class 7</option>
                  <option value="Class 8">Class 8</option>
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                </select>
                {errors.grade && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.grade.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Section</label>
                <select 
                  {...register("section")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors appearance-none"
                >
                  <option value="">Select Section</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="Blue">Blue</option>
                  <option value="Green">Green</option>
                </select>
                {errors.section && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.section.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Roll Number</label>
                <input 
                  {...register("rollNumber")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. 2024-001"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Previous School Name (Optional)</label>
                <input 
                  {...register("previousSchool")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. Beaconhouse School System"
                />
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Father's / Guardian's Name</label>
                <input 
                  {...register("guardianName")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. Muhammad Khan"
                />
                {errors.guardianName && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.guardianName.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contact Number</label>
                <input 
                  {...register("guardianPhone")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. +923001234567"
                />
                {errors.guardianPhone && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.guardianPhone.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Address (Optional)</label>
                <input 
                  {...register("guardianEmail")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. guardian@example.com"
                />
                {errors.guardianEmail && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.guardianEmail.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">CNIC / National ID</label>
                <input 
                  {...register("guardianCnic")}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors"
                  placeholder="e.g. 42101-1234567-1"
                />
                {errors.guardianCnic && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.guardianCnic.message}</p>}
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Home Address</label>
                <textarea 
                  {...register("homeAddress")}
                  rows={3}
                  className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-indigo transition-colors resize-none"
                  placeholder="e.g. House #123, Street #4, Sector F-10, Islamabad"
                />
                {errors.homeAddress && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.homeAddress.message}</p>}
              </div>
            </div>
          </motion.div>
        );
      case 4:
        const values = getValues();
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="bg-neon-indigo/5 border border-neon-indigo/20 p-6 rounded-2xl">
              <h4 className="text-neon-indigo font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                <User size={14} /> Personal Summary
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Name</p>
                  <p className="text-white font-bold">{values.firstName} {values.lastName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">DOB</p>
                  <p className="text-white font-bold">{values.dob}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Gender</p>
                  <p className="text-white font-bold capitalize">{values.gender}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Blood</p>
                  <p className="text-white font-bold">{values.bloodGroup || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h4 className="text-gray-400 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                <BookOpen size={14} /> Academic Summary
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Grade</p>
                  <p className="text-white font-bold">{values.grade}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Section</p>
                  <p className="text-white font-bold">{values.section}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Roll #</p>
                  <p className="text-white font-bold">{values.rollNumber || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Admission</p>
                  <p className="text-white font-bold">{values.admissionDate}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <h4 className="text-gray-400 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                <Users size={14} /> Guardian Summary
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Guardian</p>
                    <p className="text-white font-bold">{values.guardianName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Phone</p>
                    <p className="text-white font-bold">{values.guardianPhone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">CNIC</p>
                    <p className="text-white font-bold">{values.guardianCnic}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Address</p>
                  <p className="text-white font-bold">{values.homeAddress}</p>
                </div>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  const steps = [
    { id: 1, label: 'Personal', icon: User },
    { id: 2, label: 'Academic', icon: BookOpen },
    { id: 3, label: 'Guardian', icon: Users },
    { id: 4, label: 'Review', icon: CheckCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 -z-10" />
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-3">
            <div 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border ${
                step >= s.id 
                  ? 'bg-neon-indigo text-white border-neon-indigo shadow-[0_0_20px_rgba(99,102,241,0.3)]' 
                  : 'bg-cyber-gray text-gray-600 border-white/5'
              }`}
            >
              <s.icon size={20} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-neon-indigo' : 'text-gray-600'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-cyber-gray/40 backdrop-blur-xl border border-white/5 p-8 md:p-12 rounded-[2rem] neon-border-indigo/20 min-h-[500px] flex flex-col">
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/5">
          <button 
            onClick={step === 1 ? onCancel : prevStep}
            className="flex items-center gap-2 text-gray-500 hover:text-white font-black uppercase tracking-widest text-[10px] transition-colors"
          >
            <ChevronLeft size={16} /> {step === 1 ? 'Cancel' : 'Previous'}
          </button>

          {step < 4 ? (
            <button 
              onClick={nextStep}
              className="bg-neon-indigo text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95"
            >
              Next Step <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="bg-neon-indigo text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>Processing <Loader2 className="animate-spin" size={16} /></>
              ) : (
                <>Confirm Admission <ArrowRight size={16} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAdmissionWizard;
