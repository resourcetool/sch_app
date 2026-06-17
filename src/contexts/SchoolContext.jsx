// src/contexts/SchoolContext.jsx
//
// Critical fixes:
// 1. refresh() now falls back to Firestore for ALL collections (not just school doc)
//    when IDB returns empty results. This fixes "students disappear after cache clear".
// 2. After initialSync completes in AuthContext, SchoolContext auto-re-runs refresh()
//    via the syncComplete dependency so fresh data appears immediately.
// 3. All collection reads: try IDB first, if empty and online → fetch from Firestore.
// 4. teacherProfile, classesForUser, subjectsForUser, getSubjectsForClass preserved.

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from 'react';
import {
  collection, doc, getDoc, getDocs, query, where
} from 'firebase/firestore';
import { db }         from '../services/firebase';
import { idbGet, idbGetAll, idbPutMany, idbPut } from '../services/indexedDB';
import { useAuth }    from './AuthContext';

const SchoolContext = createContext(null);

// Pull a collection from Firestore into IDB and return the records
async function fetchCollectionFromFirestore(collectionName, schoolId) {
  try {
    const q    = query(collection(db, collectionName), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (records.length > 0) await idbPutMany(collectionName, records);
    return records;
  } catch (err) {
    console.error(`[School] Firestore fetch failed for ${collectionName}:`, err.message);
    return [];
  }
}

// Read from IDB; if empty and online, fall back to Firestore
async function readCollection(collectionName, schoolId) {
  const local = await idbGetAll(collectionName, 'schoolId', schoolId);
  if (local.length > 0) return local;
  if (navigator.onLine) {
    return fetchCollectionFromFirestore(collectionName, schoolId);
  }
  return [];
}

export function SchoolProvider({ children }) {
  const { userProfile, syncComplete } = useAuth();

  const [school,   setSchool]   = useState(null);
  const [classes,  setClasses]  = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      // School document: try IDB, fallback to Firestore
      let s = await idbGet('schools', schoolId);
      if (!s && navigator.onLine) {
        try {
          const snap = await getDoc(doc(db, 'schools', schoolId));
          if (snap.exists()) {
            s = { id: snap.id, ...snap.data() };
            await idbPut('schools', s);
          }
        } catch (err) {
          console.error('[School] Firestore school fetch failed:', err.message);
        }
      }
      setSchool(s);

      // All collections: try IDB first, fall back to Firestore if empty
      const [cls, subj, tchr] = await Promise.all([
        readCollection('classes',  schoolId),
        readCollection('subjects', schoolId),
        readCollection('teachers', schoolId),
      ]);
      setClasses(cls);
      setSubjects(subj);
      setTeachers(tchr);
    } catch (err) {
      console.error('[School] refresh error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  // Refresh when schoolId changes OR when sync completes
  // syncComplete triggers after initialSync() finishes in AuthContext,
  // ensuring fresh Firestore data is in IDB before we read it
  useEffect(() => {
    refresh();
  }, [refresh, syncComplete]);

  async function updateSchool(data) {
    const updated = { ...school, ...data, updatedAt: Date.now() };
    await idbPut('schools', updated);
    const { writeRecord } = await import('../services/syncService');
    await writeRecord('schools', schoolId, updated, schoolId);
    setSchool(updated);
  }

  // ── TEACHER PROFILE ───────────────────────────────────────────
  const teacherProfile = useMemo(() => {
    if (!userProfile || userProfile.role !== 'teacher') return null;
    return teachers.find(
      t => t.email?.toLowerCase() === userProfile.email?.toLowerCase()
    ) || null;
  }, [userProfile, teachers]);

  // ── SCOPED VIEWS ──────────────────────────────────────────────
  const classesForUser = useMemo(() => {
    if (!teacherProfile) return classes;
    return classes.filter(c => teacherProfile.assignedClasses?.includes(c.id));
  }, [classes, teacherProfile]);

  const subjectsForUser = useMemo(() => {
    if (!teacherProfile) return subjects;
    return subjects.filter(s => teacherProfile.assignedSubjects?.includes(s.id));
  }, [subjects, teacherProfile]);

  function getSubjectsForClass(classId) {
    const cls         = classes.find(c => c.id === classId);
    const allSubjects = teacherProfile
      ? subjects.filter(s => teacherProfile.assignedSubjects?.includes(s.id))
      : subjects;
    if (!classId) return allSubjects;
    return allSubjects.filter(s =>
      s.classIds?.includes(classId) ||
      cls?.subjectIds?.includes(s.id)
    );
  }

  return (
    <SchoolContext.Provider value={{
      school, classes, subjects, teachers, loading,
      refresh, updateSchool, schoolId,
      teacherProfile,
      classesForUser,
      subjectsForUser,
      getSubjectsForClass,
    }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
