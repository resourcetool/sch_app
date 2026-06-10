// src/contexts/SchoolContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { idbGet, idbGetAll, idbPut } from '../services/indexedDB';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const SchoolContext = createContext(null);

export function SchoolProvider({ children }) {
  const { userProfile } = useAuth();
  const [school, setSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let s = await idbGet('schools', schoolId);
      if (!s && navigator.onLine) {
        const snap = await getDoc(doc(db, 'schools', schoolId));
        if (snap.exists()) { s = { id: snap.id, ...snap.data() }; await idbPut('schools', s); }
      }
      setSchool(s);
      setClasses(await idbGetAll('classes', 'schoolId', schoolId));
      setSubjects(await idbGetAll('subjects', 'schoolId', schoolId));
      setTeachers(await idbGetAll('teachers', 'schoolId', schoolId));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function updateSchool(data) {
    const updated = { ...school, ...data, updatedAt: Date.now() };
    await idbPut('schools', updated);
    const { writeRecord } = await import('../services/syncService');
    await writeRecord('schools', schoolId, updated, schoolId);
    setSchool(updated);
  }

  return (
    <SchoolContext.Provider value={{ school, classes, subjects, teachers, loading, refresh, updateSchool, schoolId }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
