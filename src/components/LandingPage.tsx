import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';

const NavItem = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href} 
    className="text-gray-400 hover:text-neon-blue transition-colors text-sm font-black uppercase tracking-widest"
  >
    {children}
  </a>
);

const FeatureCard = ({ icon: Icon, title, description, className = "" }: { icon: any; title: string; description: string; className?: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={`bg-cyber-gray/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 hover:border-neon-blue/30 transition-all group ${className}`}
  >
    <div className="w-12 h-12 bg-neon-blue/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-neon-blue/20">
      <Icon className="text-neon-blue" size={24} />
    </div>
    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-3">{title}</h3>
    <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const PricingCard = ({ tier, price, description, features, isPopular = false }: { tier: string; price: string; description: string; features: string[]; isPopular?: boolean }) => (
  <motion.div 
    whileHover={{ y: -10 }}
    className={`p-8 rounded-[40px] border ${isPopular ? 'neon-border-blue bg-neon-blue/5' : 'border-white/5 bg-cyber-gray/40'} relative flex flex-col h-full`}
  >
    {isPopular && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-neon-blue text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full shadow-[0_0_15px_#00f3ff]">
        Most Popular
      </div>
    )}
    <div className="mb-8">
      <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{tier}</h3>
      <p className="text-gray-500 text-xs uppercase font-bold tracking-widest">{description}</p>
    </div>
    <div className="mb-8">
      <span className="text-5xl font-black text-white tracking-tighter">{price}</span>
      {price !== 'Custom' && <span className="text-gray-500 text-sm ml-2 uppercase font-black tracking-widest">/mo</span>}
    </div>
    <div className="space-y-4 mb-10 flex-grow">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <CheckCircle2 className="text-neon-blue" size={18} />
          <span className="text-sm text-gray-400 font-medium">{f}</span>
        </div>
      ))}
    </div>
    <button className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all ${isPopular ? 'bg-neon-blue text-black hover:shadow-[0_0_30px_#00f3ff]' : 'bg-white/5 text-white hover:bg-white/10'}`}>
      Get Started
    </button>
  </motion.div>
);

const LandingPage: React.FC<{ onLoginClick: () => void }> = ({ onLoginClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white selection:bg-neon-blue selection:text-black overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-cyber-black/80 backdrop-blur-xl border-bottom border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neon-blue rounded-xl flex items-center justify-center shadow-[0_0_15px_#00f3ff]">
              <Zap className="text-black" size={24} />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">EduPak</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <NavItem href="#features">Features</NavItem>
            <NavItem href="#pricing">Pricing</NavItem>
            <NavItem href="#testimonials">Testimonials</NavItem>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={onLoginClick}
              className="px-6 py-2 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              Login
            </button>
            <button className="px-6 py-3 bg-neon-blue text-black text-xs font-black uppercase tracking-[0.2em] rounded-xl hover:shadow-[0_0_20px_#00f3ff] transition-all">
              Start Free Trial
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Nav Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-cyber-gray border-b border-white/5 px-6 py-8 space-y-6"
            >
              <div className="flex flex-col gap-6">
                <NavItem href="#features">Features</NavItem>
                <NavItem href="#pricing">Pricing</NavItem>
                <NavItem href="#testimonials">Testimonials</NavItem>
              </div>
              <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                <button 
                  onClick={onLoginClick}
                  className="w-full py-4 text-sm font-black uppercase tracking-widest text-gray-400"
                >
                  Login
                </button>
                <button className="w-full py-4 bg-neon-blue text-black text-xs font-black uppercase tracking-[0.2em] rounded-xl">
                  Start Free Trial
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-neon-blue/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-neon-purple/10 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 bg-neon-blue rounded-full animate-pulse shadow-[0_0_8px_#00f3ff]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">v2.4 Now Live</span>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
              Automate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">School.</span><br />
              Empower Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-blue">Teachers.</span><br />
              Engage Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Parents.</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-500 max-w-xl mb-12 leading-relaxed">
              The all-in-one, enterprise-grade school management platform designed to scale your institution without the administrative headaches.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start">
              <button 
                onClick={() => trackEvent({ category: 'Conversion', action: 'Click', label: 'Start 14-Day Free Trial' })}
                className="w-full sm:w-auto px-10 py-5 bg-neon-blue text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:shadow-[0_0_30px_#00f3ff] transition-all flex items-center justify-center gap-3 group"
              >
                Start 14-Day Free Trial
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </button>
              <button className="w-full sm:w-auto px-10 py-5 bg-white/5 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all border border-white/10">
                Book a Demo
              </button>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 100, rotate: 5 }}
            animate={{ opacity: 1, x: 0, rotate: -5 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative hidden lg:block"
          >
            {/* Mockup Overlap */}
            <div className="relative z-10 bg-cyber-gray p-4 rounded-3xl neon-border-blue shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <img 
                src="https://picsum.photos/seed/dashboard/1200/800" 
                alt="Admin Dashboard" 
                className="rounded-2xl opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-10 -left-10 w-48 h-96 bg-cyber-black p-3 rounded-[40px] neon-border-purple shadow-2xl transform rotate-12">
                <img 
                  src="https://picsum.photos/seed/mobile/400/800" 
                  alt="Parent App" 
                  className="rounded-[32px] h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon-blue/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-neon-purple/20 rounded-full blur-3xl animate-pulse" />
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 border-y border-white/5 bg-cyber-black/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 mb-12">
            Trusted by 50+ Forward-Thinking Schools across the country
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40">
            {['City School', 'Beaconhouse', 'Roots', 'LGS', 'KIPS'].map((name, i) => (
              <span key={i} className="text-2xl font-black text-white uppercase tracking-tighter hover:text-neon-blue hover:opacity-100 transition-all cursor-default">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid (Bento Box) */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6">Built for the <span className="text-neon-blue">Future</span> of Education</h2>
            <p className="text-gray-500 max-w-2xl mx-auto uppercase font-bold tracking-widest text-xs">Every module you need to run a modern institution at peak efficiency.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Zap}
              title="Lightning-Fast Attendance"
              description="Biometric and QR-based attendance tracking with instant SMS alerts to parents."
              className="md:col-span-2"
            />
            <FeatureCard 
              icon={BarChart3}
              title="Automated Exams"
              description="Generate result cards and performance analytics in seconds."
            />
            <FeatureCard 
              icon={Users}
              title="HR & Payroll"
              description="Complete staff management, automated salary disbursement, and leave tracking."
            />
            <FeatureCard 
              icon={Smartphone}
              title="Parent Mobile App"
              description="Real-time updates, fee payments, and direct communication for parents."
              className="md:col-span-2"
            />
            <FeatureCard 
              icon={CreditCard}
              title="Secure Fee Collection"
              description="Online payments, automated invoicing, and POS integration for on-campus collections."
              className="md:col-span-3"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-cyber-gray/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-8">Simple, Transparent <span className="text-neon-purple">Pricing</span></h2>
            
            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-xs font-black uppercase tracking-widest ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-600'}`}>Monthly</span>
              <button 
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="w-14 h-7 bg-cyber-black rounded-full p-1 relative border border-white/10"
              >
                <motion.div 
                  animate={{ x: billingCycle === 'monthly' ? 0 : 28 }}
                  className="w-5 h-5 bg-neon-purple rounded-full shadow-[0_0_10px_#bc13fe]"
                />
              </button>
              <span className={`text-xs font-black uppercase tracking-widest ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-600'}`}>
                Yearly <span className="text-neon-blue ml-2">(Save 20%)</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PricingCard 
              tier="Basic"
              price={billingCycle === 'monthly' ? 'Rs. 5,000' : 'Rs. 4,000'}
              description="For Small Schools (< 200 Students)"
              features={[
                "Student Information System",
                "Basic Attendance",
                "Fee Management",
                "Email Support"
              ]}
            />
            <PricingCard 
              tier="Pro"
              price={billingCycle === 'monthly' ? 'Rs. 15,000' : 'Rs. 12,000'}
              description="For Growing Institutions"
              isPopular={true}
              features={[
                "Everything in Basic",
                "Parent Mobile App",
                "Automated Exams",
                "HR & Payroll Module",
                "Priority 24/7 Support"
              ]}
            />
            <PricingCard 
              tier="Enterprise"
              price="Custom"
              description="For Large School Networks"
              features={[
                "Everything in Pro",
                "Multi-Campus Management",
                "Custom API Integration",
                "Dedicated Account Manager",
                "On-Site Training"
              ]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neon-blue rounded-lg flex items-center justify-center">
              <Zap className="text-black" size={18} />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">EduPak</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-600">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>

          <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">
            © 2026 EduPak SaaS. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
