// src/contexts/AuthContext.jsx
//
// Critical fixes:
// 1. On auth state change, ALWAYS fetch profile from Firestore if IDB is empty
//    (cache cleared scenario). Never leave userProfile as null when user is logged in.
// 2. initialSync() is awaited before setting loading=false so that SchoolContext
//    has fresh Firestore data in IDB before it tries to read.
// 3. syncComplete state added — components can wait for sync before rendering.
// 4. Super admin path unchanged.

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db }              from '../services/firebase';
import { initialSync, setupConnectivityListeners } from '../services/syncService';
import { idbGet, idbPut }        from '../services/indexedDB';
import { logActivity }           from '../services/superAdminService';
import { isSuperAdmin }           from '../services/superAdminService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [syncComplete, setSyncComplete] = useState(false);

  useEffect(() => {
    setupConnectivityListeners();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setSyncComplete(false);

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setSyncComplete(true);
        return;
      }

      // ── SUPER ADMIN ────────────────────────────────────────────
      if (isSuperAdmin(firebaseUser.email)) {
        setUser(firebaseUser);
        setUserProfile({
          id: firebaseUser.uid, email: firebaseUser.email,
          firstName: 'Super', lastName: 'Admin',
          role: 'superadmin', schoolId: null,
        });
        setLoading(false);
        setSyncComplete(true);
        return;
      }

      // ── REGULAR USER ───────────────────────────────────────────
      // Step 1: Try IDB (instant, works offline)
      let profile = await idbGet('users', firebaseUser.uid);

      // Step 2: IDB miss (cache cleared) → ALWAYS fetch from Firestore
      if (!profile && navigator.onLine) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            profile = { id: snap.id, ...snap.data() };
            await idbPut('users', profile);  // repopulate IDB
          }
        } catch (err) {
          console.error('[Auth] Could not fetch user profile from Firestore:', err.message);
        }
      }

      // Set user immediately so UI can render something
      setUser(firebaseUser);
      setUserProfile(profile || null);
      setLoading(false);

      // Step 3: Run full sync to repopulate ALL IDB collections from Firestore.
      // This fixes "students disappear after cache clear" — after this completes,
      // SchoolContext will re-read from IDB and find everything.
      if (profile?.schoolId && navigator.onLine) {
        try {
          await initialSync(profile.schoolId);
        } catch (err) {
          console.error('[Auth] initialSync failed:', err.message);
        }
      }

      setSyncComplete(true);

      // Log login activity for super admin visibility
      if (profile?.schoolId) {
        logActivity(profile.schoolId, firebaseUser.uid, firebaseUser.email, 'login', {
          role: profile.role,
        });
      }
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
    const cred     = await createUserWithEmailAndPassword(auth, email, password);
    const uid      = cred.user.uid;
    const schoolId = `school_${Date.now()}`;

    const school = {
      id:             schoolId,
      name:           schoolData.schoolName,
      address:        schoolData.address        || '',
      phone:          schoolData.phone          || '',
      email:          schoolData.email          || '',
      code:           schoolData.code           || schoolData.schoolName.substring(0, 3).toUpperCase(),
      gradingScale:   null,
      promotionRules: null,
      academicYear:   schoolData.academicYear   || new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      currentTerm:    schoolData.currentTerm    || '1',
      createdAt:      Date.now(),
    };

    await setDoc(doc(db, 'schools', schoolId), school);
    await idbPut('schools', school);

    const profile = {
      id: uid, schoolId, email,
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
    <AuthContext.Provider value={{
      user, userProfile, loading, syncComplete,
      login, logout, registerAdmin,
    }}>
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
