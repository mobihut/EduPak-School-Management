import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Assignment {
  id: string;
  school_id: string;
  class: string;
  section: string;
  subject: string;
  title: string;
  description: string;
  due_date: Timestamp;
  created_at: Timestamp;
  created_by: string;
  attachment_url?: string;
}

export const useStudentAssignments = (schoolId: string, className: string, sectionName: string) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !className || !sectionName) return;

    const q = query(
      collection(db, 'assignments'),
      where('school_id', '==', schoolId),
      where('class', '==', className),
      where('section', '==', sectionName),
      orderBy('due_date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      setAssignments(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching assignments:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId, className, sectionName]);

  return { assignments, loading, error };
};
