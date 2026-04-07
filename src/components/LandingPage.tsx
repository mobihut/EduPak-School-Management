import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { trackEvent } from '../utils/analytics';
import { 
  Zap, 
  Shield, 
  Users, 
  BarChart3, 
  CreditCard, 
  LayoutDashboard, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X,
  Globe,
  Smartphone,
  BookOpen,
  Calendar,
  Layers,
  Brain,
  Fingerprint,
  MessageSquare,
  DollarSign,
  FileText,
  Book,
  MapPin,
  Wallet,
  UserCheck,
  UserPlus,
  Clock,
  Package,
  Home,
  Bell,
  Settings,
  Activity,
  Video,
  ClipboardList,
  Phone,
  Play,
  Facebook,
  Linkedin,
  Twitter,
  MessageCircle,
  Building2,
  GraduationCap,
  Mail,
  IdCard,
  Sparkles,
  Cpu,
  Lock,
  Database,
  Cloud,
  MousePointer2
} from 'lucide-react';

const NavItem = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href} 
    className="text-gray-400 hover:text-neon-blue transition-all duration-300 text-xs font-bold uppercase tracking-[0.2em] relative group"
  >
    {children}
    <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-neon-blue transition-all duration-300 group-hover:w-full shadow-[0_0_8px_#00f3ff]" />
  </a>
);

const FeatureCard = ({ icon: Icon, title, description, className = "" }: { icon: any; title: string; description: string; className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -8, scale: 1.01 }}
    className={`bg-white/[0.03] backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 hover:border-neon-blue/40 transition-all duration-500 group relative overflow-hidden ${className}`}
  >
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-white/10 group-hover:border-neon-blue/30 group-hover:shadow-[0_0_20px_rgba(0,243,255,0.2)]">
        <Icon className="text-neon-blue" size={28} />
      </div>
      <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-3 group-hover:text-neon-blue transition-colors">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed font-medium">{description}</p>
    </div>
  </motion.div>
);

const PricingCard = ({ tier, price, description, features, isPopular = false }: { tier: string; price: string; description: string; features: string[]; isPopular?: boolean }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    whileHover={{ y: -12 }}
    className={`p-10 rounded-[3rem] border transition-all duration-500 ${isPopular ? 'border-neon-blue/50 bg-neon-blue/[0.03] shadow-[0_0_40px_rgba(0,243,255,0.1)]' : 'border-white/10 bg-white/[0.02]'} relative flex flex-col h-full overflow-hidden group`}
  >
    {isPopular && (
      <div className="absolute top-6 right-6">
        <div className="bg-neon-blue text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-[0_0_20px_#00f3ff] animate-pulse">
          Recommended
        </div>
      </div>
    )}
    <div className="mb-10">
      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-3 group-hover:text-neon-blue transition-colors">{tier}</h3>
      <p className="text-gray-500 text-xs uppercase font-bold tracking-[0.2em]">{description}</p>
    </div>
    <div className="mb-10">
      <div className="flex items-baseline gap-1">
        <span className="text-6xl font-black text-white tracking-tighter">{price}</span>
        {price !== 'Custom' && <span className="text-gray-500 text-sm uppercase font-black tracking-widest">/mo</span>}
      </div>
    </div>
    <div className="space-y-5 mb-12 flex-grow">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-4 group/item">
          <div className="w-5 h-5 rounded-full bg-neon-blue/10 flex items-center justify-center group-hover/item:scale-110 transition-transform">
            <CheckCircle2 className="text-neon-blue" size={14} />
          </div>
          <span className="text-sm text-gray-400 font-medium group-hover/item:text-gray-200 transition-colors">{f}</span>
        </div>
      ))}
    </div>
    <button 
      onClick={() => trackEvent({ category: 'Pricing', action: 'Click', label: `Start Free Trial - ${tier}` })}
      className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-300 ${isPopular ? 'bg-neon-blue text-black hover:shadow-[0_0_30px_#00f3ff] hover:scale-[1.02]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/30'}`}
    >
      Get Started Now
    </button>
  </motion.div>
);

const LandingPage: React.FC<{ onLoginClick: () => void }> = ({ onLoginClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    { icon: Brain, title: "AI Student Analytics", description: "Predictive performance tracking and personalized learning paths using advanced neural networks." },
    { icon: Fingerprint, title: "Biometric Attendance", description: "Secure fingerprint and face-recognition integration with instant cloud synchronization." },
    { icon: MessageCircle, title: "WhatsApp Automation", description: "Instant alerts, fee reminders, and academic reports sent directly to parents' WhatsApp." },
    { icon: DollarSign, title: "Fee Management", description: "Automated invoicing, multi-channel online payments, and smart recovery tracking." },
    { icon: ClipboardList, title: "Online Exams", description: "Secure digital testing environment with automated grading and proctoring features." },
    { icon: Book, title: "Library Management", description: "Digital cataloging, RFID issue tracking, and automated fine management system." },
    { icon: MapPin, title: "Transport GPS", description: "Real-time bus tracking, route optimization, and geofencing for student safety." },
    { icon: Wallet, title: "Payroll & HR", description: "Staff records, automated salary disbursement, and comprehensive leave management." },
    { icon: Smartphone, title: "Parent Mobile App", description: "Dedicated high-performance app for real-time updates, fees, and communication." },
    { icon: UserCheck, title: "Teacher Portal", description: "Streamlined lesson planning, attendance, and grading with collaborative tools." },
    { icon: GraduationCap, title: "Student Portal", description: "Personalized dashboard for assignments, results, and digital learning resources." },
    { icon: UserPlus, title: "Admission Management", description: "Paperless online admission workflow and inquiry tracking with CRM integration." }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-neon-blue selection:text-black overflow-x-hidden font-['Plus_Jakarta_Sans']">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        html { scroll-behavior: smooth; }
        .neon-text-blue { text-shadow: 0 0 10px rgba(0,243,255,0.5), 0 0 20px rgba(0,243,255,0.2); }
        .neon-text-purple { text-shadow: 0 0 10px rgba(188,19,254,0.5), 0 0 20px rgba(188,19,254,0.2); }
        .grid-bg { background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0); background-size: 40px 40px; }
      `}} />

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            x: [0, 100, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-neon-blue/20 rounded-full blur-[150px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.15, 0.1],
            x: [0, -100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-neon-purple/20 rounded-full blur-[150px]" 
        />
      </div>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'bg-black/80 backdrop-blur-2xl border-b border-white/10 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-neon-blue rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(0,243,255,0.4)] group-hover:rotate-[10deg] transition-transform duration-500">
              <Zap className="text-black" size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">EduPak</span>
              <span className="text-[10px] font-bold text-neon-blue tracking-[0.3em] uppercase">Enterprise</span>
            </div>
          </motion.div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-12">
            <NavItem href="#features">Features</NavItem>
            <NavItem href="#pricing">Pricing</NavItem>
            <NavItem href="#stats">Analytics</NavItem>
            <NavItem href="#contact">Contact</NavItem>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <button 
              onClick={onLoginClick}
              className="px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors"
            >
              Portal Login
            </button>
            <button className="px-8 py-4 bg-white text-black text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neon-blue hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] transition-all duration-500">
              Free Trial
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden w-12 h-12 flex items-center justify-center bg-white/5 rounded-xl border border-white/10"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-3xl border-b border-white/10 px-8 py-12 space-y-8"
            >
              <div className="flex flex-col gap-8">
                <NavItem href="#features">Features</NavItem>
                <NavItem href="#pricing">Pricing</NavItem>
                <NavItem href="#stats">Analytics</NavItem>
                <NavItem href="#contact">Contact</NavItem>
              </div>
              <div className="pt-8 border-t border-white/10 flex flex-col gap-6">
                <button 
                  onClick={onLoginClick}
                  className="w-full py-5 text-sm font-bold uppercase tracking-[0.2em] text-gray-400"
                >
                  Portal Login
                </button>
                <button className="w-full py-5 bg-neon-blue text-black text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                  Start Free Trial
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-8 min-h-screen flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-10 backdrop-blur-md"
              >
                <Sparkles className="text-neon-blue" size={16} />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neon-blue">AI-Powered School Management</span>
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-6xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.85] mb-10"
              >
                The Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-cyan-400 to-neon-purple neon-text-blue">Evolution</span> of Education.
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl text-gray-400 max-w-xl mb-12 leading-relaxed font-medium"
              >
                EduPak is the world's most advanced school ERP, combining artificial intelligence with seamless automation to empower modern institutions.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center gap-6"
              >
                <button className="w-full sm:w-auto px-12 py-6 bg-neon-blue text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:shadow-[0_0_40px_rgba(0,243,255,0.6)] transition-all duration-500 flex items-center justify-center gap-4 group text-sm">
                  Get Started Free
                  <ArrowRight className="group-hover:translate-x-2 transition-transform" size={20} />
                </button>
                <button className="w-full sm:w-auto px-12 py-6 bg-white/5 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all duration-500 border border-white/10 flex items-center justify-center gap-4 text-sm backdrop-blur-md group">
                  <Play size={18} className="fill-white group-hover:scale-110 transition-transform" />
                  Watch Demo
                </button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-16 flex items-center gap-8"
              >
                <div className="flex -space-x-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-full border-2 border-[#050505] bg-white/10 overflow-hidden">
                      <img src={`https://i.pravatar.cc/150?u=${i}`} alt="User" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => <Sparkles key={i} className="text-neon-blue fill-neon-blue" size={12} />)}
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Trusted by 500+ Schools</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative hidden lg:block"
            >
              <div className="relative z-10 p-4 bg-white/[0.03] backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
                <img 
                  src="https://picsum.photos/seed/edu-dashboard/1200/800" 
                  alt="EduPak Dashboard" 
                  className="rounded-[2.5rem] w-full h-auto opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-neon-blue/20 rounded-full blur-[80px] animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-neon-purple/20 rounded-full blur-[80px] animate-pulse" />
              </div>
              
              {/* Floating Elements */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-12 left-12 p-6 bg-black/80 backdrop-blur-2xl rounded-3xl border border-neon-blue/30 shadow-[0_0_30px_rgba(0,243,255,0.2)] z-20"
              >
                <Activity className="text-neon-blue mb-2" size={24} />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Real-time Stats</div>
                <div className="text-xl font-black text-white">+99.9%</div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-12 right-12 p-6 bg-black/80 backdrop-blur-2xl rounded-3xl border border-neon-purple/30 shadow-[0_0_30px_rgba(188,19,254,0.2)] z-20"
              >
                <Users className="text-neon-purple mb-2" size={24} />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Students</div>
                <div className="text-xl font-black text-white">100,000+</div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section id="stats" className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { label: "Global Institutions", value: "500+", icon: Building2, color: "neon-blue" },
              { label: "Daily Active Users", value: "100k+", icon: Users, color: "neon-purple" },
              { label: "Uptime Guarantee", value: "99.9%", icon: Activity, color: "neon-blue" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-500 group text-center"
              >
                <div className={`w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500`}>
                  <stat.icon className={`text-${stat.color}`} size={32} />
                </div>
                <div className="text-6xl font-black text-white tracking-tighter mb-3">{stat.value}</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em]">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento */}
      <section id="features" className="py-32 px-8 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-8">
            <div className="max-w-2xl">
              <h2 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter leading-none mb-8">
                The Most <span className="text-neon-blue neon-text-blue">Powerful</span><br />Feature Set.
              </h2>
              <p className="text-gray-500 font-medium text-lg leading-relaxed uppercase tracking-widest">
                Every tool you need to manage your institution with surgical precision.
              </p>
            </div>
            <button className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
              View All 50+ Features
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <FeatureCard 
                key={i}
                icon={f.icon}
                title={f.title}
                description={f.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-10">
              Scalable <span className="text-neon-purple neon-text-purple">Pricing</span> Plans.
            </h2>
            
            <div className="inline-flex items-center p-2 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${billingCycle === 'monthly' ? 'bg-neon-purple text-white shadow-[0_0_20px_rgba(188,19,254,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingCycle('yearly')}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${billingCycle === 'yearly' ? 'bg-neon-purple text-white shadow-[0_0_20px_rgba(188,19,254,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Yearly <span className="ml-2 text-neon-blue">(-20%)</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-10">
            <PricingCard 
              tier="Lite"
              price={billingCycle === 'monthly' ? 'Rs. 10k' : 'Rs. 8k'}
              description="Perfect for small academies"
              features={[
                "Student Management System",
                "Basic Attendance Tracking",
                "Fee Collection Portal",
                "SMS Alert Integration",
                "Email Support"
              ]}
            />
            <PricingCard 
              tier="Enterprise"
              price={billingCycle === 'monthly' ? 'Rs. 25k' : 'Rs. 20k'}
              description="Our most popular plan"
              isPopular={true}
              features={[
                "Everything in Lite",
                "Parent & Teacher Mobile Apps",
                "AI Performance Analytics",
                "Online Exam Module",
                "HR & Payroll Automation",
                "24/7 Priority Support"
              ]}
            />
            <PricingCard 
              tier="Network"
              price="Custom"
              description="For school chains & groups"
              features={[
                "Everything in Enterprise",
                "Multi-Campus Centralized Control",
                "Custom API & Integrations",
                "White-label Mobile Apps",
                "Dedicated Account Manager",
                "On-site Training & Setup"
              ]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="relative pt-32 pb-16 px-8 bg-black border-t border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-20 mb-32">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-neon-blue rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                  <Zap className="text-black" size={28} />
                </div>
                <span className="text-3xl font-black tracking-tighter uppercase">EduPak</span>
              </div>
              <p className="text-gray-500 text-lg max-w-md mb-12 font-medium leading-relaxed">
                The future of school management is here. Join 500+ institutions already transforming education with EduPak.
              </p>
              <div className="flex gap-6">
                {[Facebook, Linkedin, Twitter].map((Icon, i) => (
                  <a key={i} href="#" className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 hover:text-neon-blue hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-neon-blue/30">
                    <Icon size={24} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white mb-10">Navigation</h4>
              <ul className="space-y-6 text-sm font-bold uppercase tracking-widest text-gray-500">
                <li><a href="#" className="hover:text-neon-blue transition-colors">Home</a></li>
                <li><a href="#features" className="hover:text-neon-blue transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-neon-blue transition-colors">Pricing</a></li>
                <li><a href="#stats" className="hover:text-neon-blue transition-colors">Analytics</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white mb-10">Contact</h4>
              <ul className="space-y-6 text-sm font-bold uppercase tracking-widest text-gray-500">
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-neon-blue/10 transition-colors">
                    <Mail size={18} className="text-neon-blue" />
                  </div>
                  <span className="group-hover:text-white transition-colors lowercase">admin@mobihut.pk</span>
                </li>
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-neon-blue/10 transition-colors">
                    <Phone size={18} className="text-neon-blue" />
                  </div>
                  <span className="group-hover:text-white transition-colors">+92 304 1478644</span>
                </li>
                <li className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-neon-blue/10 transition-colors">
                    <Globe size={18} className="text-neon-blue" />
                  </div>
                  <span className="group-hover:text-white transition-colors lowercase">mobihut.pk</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-16 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-600">
              © 2026 EduPak Enterprise. All Rights Reserved.
            </p>
            
            <div className="flex items-center gap-6">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 group hover:border-green-500/50 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <MessageCircle size={16} className="text-green-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Developed by</span>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">MoBiHuT | +92 304 1478644</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
