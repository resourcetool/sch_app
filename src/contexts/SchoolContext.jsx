// src/contexts/SchoolContext.jsx
//
// Changes:
// - Added `teacherProfile` to context: the teachers[] record that belongs to the
//   currently logged-in teacher (matched by email). This is used in Scores.jsx
//   to filter classes and subjects down to only what the teacher is assigned to.
//   Admins get teacherProfile = null (they see everything).
// - subjectsForUser / classesForUser derived values exposed so pages don't need
//   to repeat the filter logic everywhere.
// - updateSchool() preserved exactly.
// - All existing exports preserved.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { idbGet, idbGetAll, idbPut } from '../services/indexedDB';
import { doc, getDoc } from 'firebase/firestore';
import { db }          from '../services/firebase';
import { useAuth }     from './AuthContext';

const SchoolContext = createContext(null);

export function SchoolProvider({ children }) {
  const { userProfile } = useAuth();
  const [school,   setSchool]   = useState(null);
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      // School document — try IDB first, fall back to Firestore
      let s = await idbGet('schools', schoolId);
      if (!s && navigator.onLine) {
        const snap = await getDoc(doc(db, 'schools', schoolId));
        if (snap.exists()) { s = { id: snap.id, ...snap.data() }; await idbPut('schools', s); }
      }
      setSchool(s);
      const [cls, subj, tchr] = await Promise.all([
        idbGetAll('classes',  'schoolId', schoolId),
        idbGetAll('subjects', 'schoolId', schoolId),
        idbGetAll('teachers', 'schoolId', schoolId),
      ]);
      setClasses(cls);
      setSubjects(subj);
      setTeachers(tchr);
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

  // ── TEACHER PROFILE ──────────────────────────────────────────────
  // Find the teachers[] record for the currently logged-in teacher.
  // Matched by email (userProfile.email) so it works even if the teacher
  // registered from a different device.
  const teacherProfile = useMemo(() => {
    if (!userProfile || userProfile.role !== 'teacher') return null;
    return teachers.find(t =>
      t.email?.toLowerCase() === userProfile.email?.toLowerCase()
    ) || null;
  }, [userProfile, teachers]);

  // ── SCOPED VIEWS FOR TEACHERS ────────────────────────────────────
  // Teachers only see their assigned classes and subjects.
  // Admins and super-admins see everything.
  const classesForUser = useMemo(() => {
    if (!teacherProfile) return classes; // admin sees all
    return classes.filter(c => teacherProfile.assignedClasses?.includes(c.id));
  }, [classes, teacherProfile]);

  const subjectsForUser = useMemo(() => {
    if (!teacherProfile) return subjects; // admin sees all
    return subjects.filter(s => teacherProfile.assignedSubjects?.includes(s.id));
  }, [subjects, teacherProfile]);

  return (
    <SchoolContext.Provider value={{
      school, classes, subjects, teachers, loading,
      refresh, updateSchool, schoolId,
      teacherProfile,
      classesForUser,
      subjectsForUser,
    }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
