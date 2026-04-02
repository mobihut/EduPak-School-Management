import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  DollarSign, 
  User, 
  Calendar, 
  CreditCard, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  X,
  ArrowRight,
  TrendingUp,
  History,
  FileText,
  Download,
  Plus,
  Minus
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  runTransaction,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useReactToPrint } from 'react-to-print';

interface Student {
  id: string;
  student_id: string;
  personal_info: {
    firstName: string;
    lastName: string;
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

interface Invoice {
  id: string;
  invoice_id: string;
  school_id: string;
  student_id: string;
  month: string;
  total_amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date: string;
  fine_applied: number;
  discount_applied?: number;
}

interface Payment {
  id: string;
  payment_id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  amount_paid: number;
  payment_method: 'cash' | 'bank_transfer' | 'online';
  collected_by: string;
  timestamp: any;
}

const FeeCollectionModule = ({ schoolId }: { schoolId: string }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment Form State
  const [fineAmount, setFineAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'online'>('cash');
  
  // Analytics State
  const [stats, setStats] = useState({
    collectedToday: 0,
    totalPending: 0
  });

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalytics();
    fetchPendingStudents();
  }, [schoolId]);

  const fetchAnalytics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // In a real app, we'd use a more efficient aggregation or a cloud function
      // For this demo, we'll fetch today's payments
      const paymentsQuery = query(
        collection(db, 'fee_payments'),
        where('school_id', '==', schoolId),
        where('timestamp', '>=', Timestamp.fromDate(today))
      );
      
      const paymentsSnap = await getDocs(paymentsQuery);
      let todayTotal = 0;
      paymentsSnap.forEach(doc => {
        todayTotal += doc.data().amount_paid;
      });

      // Fetch pending invoices total
      const pendingQuery = query(
        collection(db, 'fee_invoices'),
        where('school_id', '==', schoolId),
        where('status', 'in', ['unpaid', 'partial'])
      );
      
      const pendingSnap = await getDocs(pendingQuery);
      let pendingTotal = 0;
      pendingSnap.forEach(doc => {
        const data = doc.data();
        pendingTotal += (data.total_amount - data.paid_amount);
      });

      setStats({
        collectedToday: todayTotal,
        totalPending: pendingTotal
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const fetchPendingStudents = async () => {
    setIsLoading(true);
    try {
      // First get all pending invoices to find unique student IDs
      const q = query(
        collection(db, 'fee_invoices'),
        where('school_id', '==', schoolId),
        where('status', 'in', ['unpaid', 'partial'])
      );
      
      const snap = await getDocs(q);
      const studentIds = new Set<string>();
      snap.forEach(doc => studentIds.add(doc.data().student_id));

      if (studentIds.size === 0) {
        setStudents([]);
        return;
      }

      // Then fetch those students
      // Note: Firestore 'in' query limit is 10, so we might need to chunk if many students
      const studentIdsArray = Array.from(studentIds).slice(0, 30); // Limit for demo
      const studentsQuery = query(
        collection(db, 'students'),
        where('school_id', '==', schoolId),
        where('student_id', 'in', studentIdsArray)
      );
      
      const studentsSnap = await getDocs(studentsQuery);
      const fetchedStudents: Student[] = [];
      studentsSnap.forEach(doc => {
        fetchedStudents.push({ id: doc.id, ...doc.data() } as Student);
      });
      
      setStudents(fetchedStudents);
    } catch (error) {
      console.error("Error fetching pending students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSelect = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoading(true);
    setSelectedInvoices([]);
    setFineAmount(0);
    setDiscountAmount(0);
    setPaymentAmount(0);

    try {
      const q = query(
        collection(db, 'fee_invoices'),
        where('school_id', '==', schoolId),
        where('student_id', '==', student.student_id),
        where('status', 'in', ['unpaid', 'partial']),
        orderBy('due_date', 'asc')
      );
      
      const snap = await getDocs(q);
      const invoices: Invoice[] = [];
      snap.forEach(doc => {
        invoices.push({ id: doc.id, ...doc.data() } as Invoice);
      });
      setStudentInvoices(invoices);
    } catch (error) {
      console.error("Error fetching student invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSelection = prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId];
      
      // Recalculate suggested payment amount
      const totalDue = studentInvoices
        .filter(inv => newSelection.includes(inv.id))
        .reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);
      
      setPaymentAmount(totalDue);
      return newSelection;
    });
  };

  const handleCollectPayment = async () => {
    if (!selectedStudent || selectedInvoices.length === 0 || paymentAmount <= 0) return;
    
    setIsProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        let remainingPayment = paymentAmount;
        const timestamp = serverTimestamp();
        const collectorEmail = auth.currentUser?.email || 'System';

        for (const invId of selectedInvoices) {
          if (remainingPayment <= 0) break;

          const invoiceRef = doc(db, 'fee_invoices', invId);
          const invoiceSnap = await transaction.get(invoiceRef);
          
          if (!invoiceSnap.exists()) continue;
          
          const invoiceData = invoiceSnap.data() as Invoice;
          const currentBalance = invoiceData.total_amount - invoiceData.paid_amount;
          
          const paymentForThisInvoice = Math.min(remainingPayment, currentBalance);
          const newPaidAmount = invoiceData.paid_amount + paymentForThisInvoice;
          const newStatus = newPaidAmount >= invoiceData.total_amount ? 'paid' : 'partial';

          // 1. Update Invoice
          transaction.update(invoiceRef, {
            paid_amount: newPaidAmount,
            status: newStatus,
            fine_applied: (invoiceData.fine_applied || 0) + (fineAmount / selectedInvoices.length), // Distribute fine
            discount_applied: (invoiceData.discount_applied || 0) + (discountAmount / selectedInvoices.length)
          });

          // 2. Create Payment Record
          const paymentRef = doc(collection(db, 'fee_payments'));
          transaction.set(paymentRef, {
            payment_id: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            school_id: schoolId,
            invoice_id: invId,
            student_id: selectedStudent.student_id,
            amount_paid: paymentForThisInvoice,
            payment_method: paymentMethod,
            collected_by: collectorEmail,
            timestamp: timestamp
          });

          remainingPayment -= paymentForThisInvoice;
        }
      });

      // Success
      handlePrint();
      fetchAnalytics();
      fetchPendingStudents();
      setSelectedStudent(null);
      setSelectedInvoices([]);
    } catch (error) {
      console.error("Payment Transaction Failed:", error);
      alert("Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt_${selectedStudent?.student_id}_${Date.now()}`,
  });

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.personal_info.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.personal_info.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id.includes(searchQuery) ||
      s.guardian_info.phone.includes(searchQuery);
    
    const matchesGrade = selectedGrade === 'All' || s.academic_info.grade === selectedGrade;
    
    return matchesSearch && matchesGrade;
  });

  const totalSelectedDue = studentInvoices
    .filter(inv => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0);

  const finalTotal = totalSelectedDue + fineAmount - discountAmount;

  return (
    <div className="flex flex-col h-full bg-cyber-black text-white overflow-hidden">
      {/* Analytics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-cyber-gray/20 border-b border-white/5">
        <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Collected Today</h3>
            <p className="text-3xl font-black text-green-400 tracking-tighter">Rs. {stats.collectedToday.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-cyber-gray/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Pending Dues</h3>
            <p className="text-3xl font-black text-red-500 tracking-tighter">Rs. {stats.totalPending.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* POS Split Pane */}
      <div className="flex-grow flex overflow-hidden">
        {/* Left Pane: Search & Pending List */}
        <div className="w-full md:w-1/3 border-r border-white/5 flex flex-col bg-cyber-black/50">
          <div className="p-6 space-y-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text"
                placeholder="Search Student (Name, ID, Phone)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-neon-indigo/50 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="flex-1 bg-cyber-gray/50 border border-white/5 rounded-xl py-2 px-4 text-xs font-bold uppercase tracking-widest text-gray-400 focus:outline-none"
              >
                <option value="All">All Grades</option>
                {['Nursery', 'KG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                <div className="w-8 h-8 border-2 border-neon-indigo border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Scanning Ledger...</p>
              </div>
            ) : filteredStudents.length > 0 ? (
              filteredStudents.map(student => (
                <motion.div 
                  key={student.id}
                  whileHover={{ x: 5 }}
                  onClick={() => handleStudentSelect(student)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-4 ${
                    selectedStudent?.id === student.id 
                      ? 'bg-neon-indigo/10 border-neon-indigo shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                      : 'bg-cyber-gray/20 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/5 overflow-hidden flex-shrink-0">
                    {student.personal_info.photoUrl ? (
                      <img src={student.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h4 className="text-sm font-black text-white truncate uppercase tracking-tight">
                      {student.personal_info.firstName} {student.personal_info.lastName}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span>{student.student_id}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-700" />
                      <span>Grade {student.academic_info.grade}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className={selectedStudent?.id === student.id ? 'text-neon-indigo' : 'text-gray-700'} />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto text-gray-800 mb-4" size={48} />
                <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">No Pending Dues Found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Checkout Terminal */}
        <div className="flex-grow flex flex-col bg-cyber-black">
          {selectedStudent ? (
            <div className="h-full flex flex-col">
              {/* Profile Header */}
              <div className="p-6 bg-cyber-gray/10 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl border-2 border-neon-indigo/30 p-1">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-cyber-black">
                      {selectedStudent.personal_info.photoUrl ? (
                        <img src={selectedStudent.personal_info.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-800">
                          <User size={32} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                      {selectedStudent.personal_info.firstName} {selectedStudent.personal_info.lastName}
                    </h2>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="px-3 py-1 rounded-full bg-neon-indigo/10 border border-neon-indigo/20 text-neon-indigo text-[10px] font-black uppercase tracking-widest">
                        {selectedStudent.student_id}
                      </span>
                      <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        Grade {selectedStudent.academic_info.grade} • Section {selectedStudent.academic_info.section}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Outstanding</p>
                  <p className="text-3xl font-black text-white tracking-tighter">
                    Rs. {studentInvoices.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex-grow flex overflow-hidden">
                {/* Invoice Selection */}
                <div className="w-1/2 p-6 border-r border-white/5 overflow-y-auto custom-scrollbar">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <FileText size={14} /> Select Invoices to Pay
                  </h3>
                  <div className="space-y-3">
                    {studentInvoices.map(invoice => (
                      <div 
                        key={invoice.id}
                        onClick={() => toggleInvoiceSelection(invoice.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          selectedInvoices.includes(invoice.id)
                            ? 'bg-neon-indigo/10 border-neon-indigo'
                            : 'bg-cyber-gray/20 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              selectedInvoices.includes(invoice.id) ? 'bg-neon-indigo border-neon-indigo' : 'border-white/20'
                            }`}>
                              {selectedInvoices.includes(invoice.id) && <ArrowRight size={12} className="text-white" />}
                            </div>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{invoice.month}</span>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                            invoice.status === 'unpaid' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {invoice.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            Due: {invoice.due_date}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 line-through">Rs. {invoice.total_amount}</p>
                            <p className="text-lg font-black text-white">Rs. {invoice.total_amount - invoice.paid_amount}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collection Form */}
                <div className="w-1/2 p-8 flex flex-col bg-cyber-black/30">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-8 flex items-center gap-2">
                    <CreditCard size={14} /> Payment Details
                  </h3>
                  
                  <div className="space-y-6 flex-grow">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Fine / Late Fee</label>
                        <div className="relative">
                          <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={14} />
                          <input 
                            type="number"
                            value={fineAmount || ''}
                            onChange={(e) => setFineAmount(Number(e.target.value))}
                            className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-red-500/30"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Discount</label>
                        <div className="relative">
                          <Minus className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={14} />
                          <input 
                            type="number"
                            value={discountAmount || ''}
                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                            className="w-full bg-cyber-gray/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-green-500/30"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Amount Paying Now</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-neon-indigo" size={18} />
                        <input 
                          type="number"
                          value={paymentAmount || ''}
                          onChange={(e) => setPaymentAmount(Number(e.target.value))}
                          className="w-full bg-neon-indigo/5 border border-neon-indigo/20 rounded-2xl py-5 pl-12 pr-6 text-2xl font-black text-white focus:outline-none focus:border-neon-indigo transition-all"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest ml-1">
                        Total Selected: Rs. {totalSelectedDue} | Final Balance: Rs. {finalTotal}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'cash', label: 'Cash', icon: DollarSign },
                          { id: 'bank_transfer', label: 'Bank', icon: History },
                          { id: 'online', label: 'Online', icon: CreditCard }
                        ].map(method => (
                          <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                              paymentMethod === method.id 
                                ? 'bg-neon-indigo/20 border-neon-indigo text-white' 
                                : 'bg-cyber-gray/20 border-white/5 text-gray-500 hover:border-white/10'
                            }`}
                          >
                            <method.icon size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={isProcessing || paymentAmount <= 0 || selectedInvoices.length === 0}
                    onClick={handleCollectPayment}
                    className="w-full bg-neon-indigo hover:bg-neon-indigo/90 disabled:opacity-50 disabled:cursor-not-allowed text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-[0_0_30px_rgba(99,102,241,0.3)] flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Printer size={20} />
                        Collect & Print Receipt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-32 h-32 bg-neon-indigo/5 rounded-full flex items-center justify-center mb-8 border border-neon-indigo/10">
                <DollarSign className="text-neon-indigo animate-pulse" size={64} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Collection Terminal</h3>
              <p className="text-gray-500 text-sm max-w-md leading-relaxed">
                Select a student from the left panel to begin a fee collection session. Support for partial payments, late fees, and instant receipts is built-in.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Receipt for Printing */}
      <div style={{ display: 'none' }}>
        <div ref={receiptRef} className="p-8 bg-white text-black font-sans w-[148mm] min-h-[210mm]">
          <div className="border-2 border-black p-6">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-black flex items-center justify-center text-white font-black text-2xl">EP</div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tighter">EduPak Institution</h1>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Fee Payment Receipt</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase">Receipt #: {Date.now().toString().slice(-8)}</p>
                <p className="text-[10px] font-black uppercase">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200">
              <div>
                <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Student Information</h4>
                <p className="text-lg font-black uppercase">{selectedStudent?.personal_info.firstName} {selectedStudent?.personal_info.lastName}</p>
                <p className="text-sm font-bold">ID: {selectedStudent?.student_id}</p>
                <p className="text-sm font-bold">Grade: {selectedStudent?.academic_info.grade} - {selectedStudent?.academic_info.section}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Guardian Information</h4>
                <p className="text-sm font-bold">{selectedStudent?.guardian_info.name}</p>
                <p className="text-sm font-bold">{selectedStudent?.guardian_info.phone}</p>
              </div>
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2 text-[10px] font-black uppercase">Description</th>
                  <th className="py-2 text-[10px] font-black uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {studentInvoices.filter(inv => selectedInvoices.includes(inv.id)).map(inv => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 text-sm font-bold">Fee for {inv.month}</td>
                    <td className="py-3 text-sm font-bold text-right">Rs. {inv.total_amount}</td>
                  </tr>
                ))}
                {fineAmount > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-sm font-bold">Late Fee / Fine</td>
                    <td className="py-3 text-sm font-bold text-right">Rs. {fineAmount}</td>
                  </tr>
                )}
                {discountAmount > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-sm font-bold">Discount Applied</td>
                    <td className="py-3 text-sm font-bold text-right text-red-600">- Rs. {discountAmount}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td className="py-4 text-lg font-black uppercase">Total Paid</td>
                  <td className="py-4 text-2xl font-black text-right">Rs. {paymentAmount}</td>
                </tr>
              </tfoot>
            </table>

            <div className="flex justify-between items-end mt-12">
              <div className="text-[10px] font-bold text-gray-500 uppercase">
                Payment Method: {paymentMethod.replace('_', ' ')}<br />
                Collected By: {auth.currentUser?.email}
              </div>
              <div className="text-center w-48">
                <div className="border-b border-black mb-2 h-12"></div>
                <p className="text-[10px] font-black uppercase">Authorized Signature</p>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-dashed border-gray-300 text-center">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">This is a computer generated receipt and does not require a physical stamp.</p>
              <p className="text-[9px] font-black uppercase mt-1">Powered by EduPak SaaS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeCollectionModule;
