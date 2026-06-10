// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { initialSync, setupConnectivityListeners } from '../services/syncService';
import { idbGet, idbPut } from '../services/indexedDB';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupConnectivityListeners();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Try IDB first (offline)
        let profile = await idbGet('users', firebaseUser.uid);

        if (!profile && navigator.onLine) {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            profile = { id: snap.id, ...snap.data() };
            await idbPut('users', profile);
          }
        }

        setUser(firebaseUser);
        setUserProfile(profile);

        if (profile?.schoolId && navigator.onLine) {
          initialSync(profile.schoolId).catch(console.error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred;
  }

  async function logout() {
    await signOut(auth);
  }

  async function registerAdmin(email, password, schoolData) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Create school
    const schoolId = `school_${Date.now()}`;
    const school = {
      id: schoolId,
      name: schoolData.schoolName,
      address: schoolData.address,
      phone: schoolData.phone,
      email: schoolData.email,
      code: schoolData.code || schoolData.schoolName.substring(0, 3).toUpperCase(),
      gradingScale: null, // use default
      promotionRules: null,
      academicYear: schoolData.academicYear || '2024/2025',
      currentTerm: schoolData.currentTerm || '1',
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'schools', schoolId), school);
    await idbPut('schools', school);

    const userProfile = {
      id: uid,
      schoolId,
      email,
      firstName: schoolData.firstName,
      lastName: schoolData.lastName,
      role: 'admin',
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', uid), userProfile);
    await idbPut('users', userProfile);

    return { user: cred.user, school, userProfile };
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, logout, registerAdmin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
