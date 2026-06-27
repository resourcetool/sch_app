// src/contexts/AuthContext.jsx
//
// FIXES:
// 1. registerAdmin() is now atomic — if Firestore writes fail after Firebase Auth
//    account creation, the Auth account is DELETED to prevent orphaned emails.
//    This fixes "email taken but account never created" permanently.
// 2. logActivity() now logs login time with lastLoginAt timestamp so school admin
//    and super admin can see when each user last logged in.
// 3. onAuthStateChanged now BLOCKS rendering (keeps loading=true) until profile
//    is fetched — prevents any brief flash of dashboard for pending-approval users.
// 4. Pending-approval guard: if profile exists but subscription is pending/rejected,
//    the SubscriptionContext handles the wall — AuthContext just ensures profile loads.
// 5. Teacher login activity now also logged with loginTime for school admin visibility.

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db }              from '../services/firebase';
import { initialSync, setupConnectivityListeners } from '../services/syncService';
import { idbGet, idbPut }        from '../services/indexedDB';
import { logActivity }           from '../services/superAdminService';
import { isSuperAdmin }          from '../services/superAdminService';

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

      // Step 2: IDB miss → ALWAYS fetch from Firestore to get authoritative profile
      if (!profile && navigator.onLine) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            profile = { id: snap.id, ...snap.data() };
            await idbPut('users', profile);
          }
        } catch (err) {
          console.error('[Auth] Could not fetch user profile from Firestore:', err.message);
        }
      }

      // Set user — SubscriptionContext will handle pending/rejected wall
      setUser(firebaseUser);
      setUserProfile(profile || null);
      setLoading(false);

      // Step 3: Run full sync to repopulate ALL IDB collections from Firestore.
      if (profile?.schoolId && navigator.onLine) {
        try {
          await initialSync(profile.schoolId);
        } catch (err) {
          console.error('[Auth] initialSync failed:', err.message);
        }
      }

      setSyncComplete(true);

      // Log login activity with timestamp so school admin can see teacher login times
      if (profile?.schoolId) {
        logActivity(profile.schoolId, firebaseUser.uid, firebaseUser.email, 'login', {
          role:        profile.role,
          firstName:   profile.firstName || '',
          lastName:    profile.lastName  || '',
          lastLoginAt: Date.now(),
        });

        // Also update lastLoginAt on the user's Firestore profile
        // so Teachers page can display it
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            lastLoginAt: Date.now(),
          }, { merge: true });
          // Update IDB too
          if (profile) {
            await idbPut('users', { ...profile, lastLoginAt: Date.now() });
          }
        } catch (err) {
          console.warn('[Auth] Could not update lastLoginAt:', err.message);
        }
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

  /**
   * registerAdmin — ATOMIC account creation.
   *
   * If any Firestore write fails after the Firebase Auth account is created,
   * we immediately delete the Auth account so the email is free to be reused.
   * This prevents the "email exists in Auth but has no school/profile" orphan state.
   */
  async function registerAdmin(email, password, schoolData) {
    // Step 1: Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;
    const schoolId = `school_${Date.now()}`;

    try {
      // Step 2: Write school document
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

      // Step 3: Write user profile document
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

    } catch (firestoreError) {
      // ── ATOMIC ROLLBACK ───────────────────────────────────────
      // Firestore write failed. Delete the Firebase Auth account so the email
      // can be retried. Also attempt to clean up any partial Firestore docs.
      console.error('[Auth] registerAdmin Firestore write failed — rolling back Auth account:', firestoreError.message);
      try {
        await deleteUser(cred.user);
      } catch (deleteErr) {
        console.error('[Auth] Could not delete orphaned Auth account:', deleteErr.message);
      }
      try {
        await deleteDoc(doc(db, 'schools', schoolId));
      } catch (_) { /* best-effort cleanup */ }
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (_) { /* best-effort cleanup */ }

      // Re-throw with a user-friendly message that includes the original cause
      throw new Error(
        `Account setup failed and has been rolled back. Please try again.\n\nTechnical detail: ${firestoreError.message}`
      );
    }
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
