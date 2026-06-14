// src/contexts/AuthContext.jsx
//
// Changes:
// - isSuperAdmin() now delegates to the updated superAdminService which supports
//   multiple emails via VITE_SUPER_ADMIN_EMAILS env var.
// - No other logic changes; all existing functionality preserved.

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { initialSync, setupConnectivityListeners } from '../services/syncService';
import { idbGet, idbPut } from '../services/indexedDB';
import { isSuperAdmin } from '../services/superAdminService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setupConnectivityListeners();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Super admin — synthesise a profile without needing a Firestore user doc
        if (isSuperAdmin(firebaseUser.email)) {
          const saProfile = {
            id:        firebaseUser.uid,
            email:     firebaseUser.email,
            firstName: 'Super',
            lastName:  'Admin',
            role:      'superadmin',
            schoolId:  null,
          };
          setUser(firebaseUser);
          setUserProfile(saProfile);
          setLoading(false);
          return;
        }

        // Regular user — try IndexedDB first (works offline)
        let profile = await idbGet('users', firebaseUser.uid);

        if (!profile && navigator.onLine) {
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (snap.exists()) {
              profile = { id: snap.id, ...snap.data() };
              await idbPut('users', profile);
            }
          } catch (err) {
            console.warn('Could not fetch user profile:', err.message);
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
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  async function registerAdmin(email, password, schoolData) {
    const cred    = await createUserWithEmailAndPassword(auth, email, password);
    const uid     = cred.user.uid;
    const schoolId = `school_${Date.now()}`;

    const school = {
      id:            schoolId,
      name:          schoolData.schoolName,
      address:       schoolData.address       || '',
      phone:         schoolData.phone         || '',
      email:         schoolData.email         || '',
      code:          schoolData.code          || schoolData.schoolName.substring(0, 3).toUpperCase(),
      gradingScale:  null,
      promotionRules: null,
      academicYear:  schoolData.academicYear  || '2024/2025',
      currentTerm:   schoolData.currentTerm   || '1',
      createdAt:     Date.now(),
    };

    await setDoc(doc(db, 'schools', schoolId), school);
    await idbPut('schools', school);

    const profile = {
      id:        uid,
      schoolId,
      email,
      firstName: schoolData.firstName || '',
      lastName:  schoolData.lastName  || '',
      role:      'admin',
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'users', uid), profile);
    await idbPut('users', profile);

    return { user: cred.user, school, userProfile: profile };
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, logout, registerAdmin }}>
      {loading ? (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0f3460',
        }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid rgba(255,255,255,.2)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'spin .7s linear infinite', margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: '.9rem', opacity: .7 }}>Loading…</div>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
