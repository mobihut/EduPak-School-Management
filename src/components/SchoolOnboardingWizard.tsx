import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  Building2, 
  User, 
  Phone, 
  Globe, 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Loader2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock
} from 'lucide-react';
import { auth, db, storage } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  deleteUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection,
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface OnboardingWizardProps {
  onComplete: (schoolId: string) => void;
  onBackToLogin: () => void;
}

const SchoolOnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onBackToLogin }) => {
  const [step, setStep] = useState(1);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningTextIndex, setProvisioningTextIndex] = useState(0);
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    schoolName: '',
    principalName: '',
    contactNumber: '',
    country: 'Pakistan',
    timezone: 'GMT+5 (Karachi)',
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const provisioningSteps = [
    "Creating secure tenant database...",
    "Configuring HR & Payroll modules...",
    "Setting up academic structures...",
    "Initializing communication gateway...",
    "Finalizing your dashboard...",
    "Welcome to EduPak!"
  ];

  useEffect(() => {
    if (isProvisioning) {
      const interval = setInterval(() => {
        setProvisioningTextIndex((prev) => (prev < provisioningSteps.length - 1 ? prev + 1 : prev));
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isProvisioning]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.email || !formData.password) {
        toast.error("Please fill in all fields");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return false;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return false;
      }
    } else if (step === 2) {
      if (!formData.schoolName || !formData.principalName || !formData.contactNumber) {
        toast.error("Please fill in all school details");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  const handleCompleteSetup = async () => {
    setIsProvisioning(true);
    let createdUser: any = null;

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      createdUser = userCredential.user;

      // 2. Generate School ID
      const schoolId = `EP-SCH-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // 3. Upload Logo if exists
      let logoUrl = "";
      if (logoFile) {
        const logoRef = ref(storage, `schools/${schoolId}/branding/logo.png`);
        await uploadBytes(logoRef, logoFile);
        logoUrl = await getDownloadURL(logoRef);
      }

      // 4. Create School Document
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 14);

      await setDoc(doc(db, 'schools', schoolId), {
        id: schoolId,
        name: formData.schoolName,
        principalName: formData.principalName,
        contact: formData.contactNumber,
        adminUid: createdUser.uid,
        adminEmail: formData.email,
        logoUrl,
        country: formData.country,
        timezone: formData.timezone,
        status: 'trial',
        trialStartDate: serverTimestamp(),
        licenseExpiryDate: Timestamp.fromDate(trialExpiry),
        createdAt: serverTimestamp(),
      });

      // 5. Create User Document
      await setDoc(doc(db, 'users', createdUser.uid), {
        uid: createdUser.uid,
        email: formData.email,
        name: formData.principalName,
        phone: formData.contactNumber,
        role: 'school_admin',
        schoolId: schoolId,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      // Success!
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f3ff', '#7000ff', '#ffffff']
        });
        toast.success("School onboarded successfully!");
        onComplete(schoolId);
      }, 3500);

    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error(error.message || "Failed to complete setup");
      
      // Cleanup: Delete Auth User if Firestore writes fail
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (deleteError) {
          console.error("Failed to cleanup user:", deleteError);
        }
      }
      setIsProvisioning(false);
    }
  };

  if (isProvisioning) {
    return (
      <div className="fixed inset-0 z-[100] bg-cyber-black flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin mb-8"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="text-neon-blue animate-pulse" size={32} />
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={provisioningTextIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
              Provisioning Institution
            </h2>
            <p className="text-neon-blue font-mono text-sm tracking-widest uppercase">
              {provisioningSteps[provisioningTextIndex]}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 w-64 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-neon-blue shadow-[0_0_10px_#00f3ff]"
            initial={{ width: "0%" }}
            animate={{ width: `${((provisioningTextIndex + 1) / provisioningSteps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black flex overflow-hidden">
      {/* Left Side: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-cyber-gray overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-indigo/20 to-transparent"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-neon-blue rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                <Zap className="text-black" size={28} />
              </div>
              <span className="text-3xl font-black tracking-tighter text-white uppercase italic">EduPak</span>
            </div>
            
            <h1 className="text-6xl font-black text-white leading-tight uppercase italic mb-6">
              The Future of <br />
              <span className="text-neon-blue">School Management</span> <br />
              Starts Here.
            </h1>
            <p className="text-gray-400 text-xl font-medium max-w-md">
              Join 50+ forward-thinking institutions automating their success with EduPak's enterprise-grade platform.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 max-w-md">
            <p className="text-white italic text-lg mb-4">
              "EduPak transformed our administrative workflow. We saved 40+ hours a month on payroll and attendance alone."
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neon-indigo/20 border border-neon-indigo flex items-center justify-center font-bold text-neon-indigo">
                JD
              </div>
              <div>
                <p className="text-white font-black uppercase text-sm">John Doe</p>
                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">Principal, Beaconhouse School</p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-24 w-64 h-64 bg-neon-indigo/10 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side: Wizard */}
      <div className="w-full lg:w-1/2 flex flex-col p-8 md:p-16 overflow-y-auto custom-scrollbar">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center justify-between mb-12">
            <div className="flex gap-2">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s}
                  className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                    step >= s ? 'bg-neon-blue shadow-[0_0_10px_#00f3ff]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <button 
              onClick={onBackToLogin}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
            >
              Back to Login
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">Admin Account</h2>
                    <p className="text-gray-500 font-medium">Create your primary administrator credentials.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="admin@school.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="password"
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm Password</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="password"
                          value={formData.confirmPassword}
                          onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={nextStep}
                    className="w-full bg-neon-blue text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] flex items-center justify-center gap-2"
                  >
                    Next Step <ChevronRight size={20} />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">School Profile</h2>
                    <p className="text-gray-500 font-medium">Tell us about your institution.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">School Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="text"
                          value={formData.schoolName}
                          onChange={e => setFormData({...formData, schoolName: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="e.g. Beaconhouse School System"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Principal / Owner Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="text"
                          value={formData.principalName}
                          onChange={e => setFormData({...formData, principalName: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="e.g. Dr. Ahmed Khan"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contact Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                        <input 
                          type="tel"
                          value={formData.contactNumber}
                          onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                          className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors"
                          placeholder="+92 300 1234567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={prevStep}
                      className="w-1/3 bg-white/5 text-white font-black uppercase tracking-widest py-5 rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={20} /> Back
                    </button>
                    <button 
                      onClick={nextStep}
                      className="w-2/3 bg-neon-blue text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] flex items-center justify-center gap-2"
                    >
                      Next Step <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">Brand & Locale</h2>
                    <p className="text-gray-500 font-medium">Customize your portal's identity.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col items-center">
                      <div className="relative group">
                        <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center bg-cyber-gray/50 overflow-hidden group-hover:border-neon-blue transition-colors">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                          ) : (
                            <Upload className="text-gray-600 group-hover:text-neon-blue" size={32} />
                          )}
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2 text-center">School Logo</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Country</label>
                        <div className="relative">
                          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                          <select 
                            value={formData.country}
                            onChange={e => setFormData({...formData, country: e.target.value})}
                            className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors appearance-none"
                          >
                            <option>Pakistan</option>
                            <option>United Kingdom</option>
                            <option>United States</option>
                            <option>United Arab Emirates</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Timezone</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                          <select 
                            value={formData.timezone}
                            onChange={e => setFormData({...formData, timezone: e.target.value})}
                            className="w-full bg-cyber-gray/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-blue transition-colors appearance-none"
                          >
                            <option>GMT+5 (Karachi)</option>
                            <option>GMT+0 (London)</option>
                            <option>GMT-5 (New York)</option>
                            <option>GMT+4 (Dubai)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={prevStep}
                      className="w-1/3 bg-white/5 text-white font-black uppercase tracking-widest py-5 rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={handleCompleteSetup}
                      className="w-2/3 bg-neon-blue text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] flex items-center justify-center gap-2"
                    >
                      Complete Setup <CheckCircle2 size={20} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Zap size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Instant Provisioning</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolOnboardingWizard;
