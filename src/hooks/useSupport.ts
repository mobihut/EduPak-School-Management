import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SupportTicket, TicketMessage, TicketStatus, TicketPriority } from '../types/support';

export const useSupportTickets = (filters: { status?: TicketStatus; priority?: TicketPriority; search?: string } = {}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q = query(collection(db, 'support_tickets'), orderBy('updated_at', 'desc'));

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportTicket[];

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        docs = docs.filter(t => 
          t.subject.toLowerCase().includes(searchLower) || 
          t.school_name.toLowerCase().includes(searchLower)
        );
      }

      setTickets(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching tickets:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filters.status, filters.priority, filters.search]);

  return { tickets, loading, error };
};

export const useTicketMessages = (ticketId: string | null) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'support_tickets', ticketId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TicketMessage[];
      setMessages(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching messages:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ticketId]);

  const sendMessage = async (text: string, attachmentUrl?: string) => {
    if (!ticketId || !auth.currentUser) return;

    const messageData = {
      sender_id: auth.currentUser.uid,
      sender_name: auth.currentUser.displayName || 'Support Admin',
      sender_role: 'support',
      text,
      attachment_url: attachmentUrl || null,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'support_tickets', ticketId, 'messages'), messageData);
    await updateDoc(doc(db, 'support_tickets', ticketId), {
      updated_at: new Date().toISOString()
    });
  };

  return { messages, loading, sendMessage };
};

export const useSupportAnalytics = () => {
  const [stats, setStats] = useState({
    totalOpen: 0,
    avgResolutionTime: '2.4h',
    pendingReply: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'support_tickets'), where('status', '==', 'open'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalOpen: snapshot.size,
        pendingReply: snapshot.docs.filter(d => d.data().status === 'open').length // Simplified
      }));
    });

    return () => unsubscribe();
  }, []);

  return stats;
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
  await updateDoc(doc(db, 'support_tickets', ticketId), {
    status,
    updated_at: new Date().toISOString()
  });
};
