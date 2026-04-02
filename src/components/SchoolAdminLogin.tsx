import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface SchoolAdminLoginProps {
  onLoginSuccess: (user: any, schoolId: string) => void;
  onBack?: () => void;
}

const SchoolAdminLogin: React.FC<SchoolAdminLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Fetch the user's document
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await signOut(auth);
        throw new Error("User profile not found.");
      }

      const userData = userDocSnap.data();

      // Step 3: Role Verification
      if (userData.role === 'school_admin' || userData.role === 'super_admin') {
        // If YES: Save school_id and navigate
        const schoolId = userData.schoolId || '';
        onLoginSuccess(user, schoolId);
      } else {
        // If NO: Instantly log them out and display strict error
        await signOut(auth);
        throw new Error("Access Denied: This portal is restricted to School Administrators only.");
      }
    } catch (err: any) {
      // Error Handling
      console.error("Login Error:", err);
      let errorMessage = "An error occurred during login.";
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else {
        setError("Failed to send password reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-black p-4 relative overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-neon-blue/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-neon-purple/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Login Card */}
        <div className="bg-cyber-gray/80 backdrop-blur-xl border border-white/10 rounded-[30px] p-10 shadow-[0_0_40px_rgba(0,243,255,0.05)] relative overflow-hidden">
          
          {/* Subtle Neon Top Border */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-blue opacity-50" />

          {/* Header */}
          <div className="text-center mb-10">
            <motion.h1 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-4xl font-black tracking-tighter text-white mb-2"
            >
              Edu<span className="text-neon-blue">Pak</span>
            </motion.h1>
            <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
              School Admin Portal
            </p>
          </div>

          {/* Error State */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3 overflow-hidden"
              >
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-200 font-medium leading-relaxed">{error}</p>
              </motion.div>
            )}
            {resetSent && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3 overflow-hidden"
              >
                <AlertCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-green-200 font-medium leading-relaxed">Password reset email sent! Check your inbox.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-500 group-focus-within:text-neon-blue transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-cyber-black/50 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white placeholder-gray-600 outline-none focus:border-neon-blue focus:bg-cyber-black transition-all font-medium"
                  placeholder="admin@school.edu"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-2 mr-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Password
                </label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-[10px] font-black text-neon-blue hover:text-white uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-500 group-focus-within:text-neon-blue transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-cyber-black/50 border border-white/5 rounded-2xl pl-12 pr-12 py-4 text-white placeholder-gray-600 outline-none focus:border-neon-blue focus:bg-cyber-black transition-all font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full relative group overflow-hidden rounded-2xl mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-purple opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative px-6 py-4 flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <Loader2 size={20} className="text-white animate-spin" />
                    <span className="text-white font-black uppercase tracking-widest text-sm">Authenticating...</span>
                  </>
                ) : (
                  <span className="text-white font-black uppercase tracking-widest text-sm">Login to Dashboard</span>
                )}
              </div>
            </button>

          </form>

          {onBack && (
            <div className="mt-8 text-center">
              <button 
                onClick={onBack}
                disabled={loading}
                className="text-xs font-bold text-gray-500 hover:text-white transition-colors disabled:opacity-50"
              >
                ← Back to Main Menu
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SchoolAdminLogin;
