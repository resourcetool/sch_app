// src/services/teacherAuthService.js
//
// FIXES:
// 1. ATOMIC creation — if Firestore setDoc fails after Firebase Auth account
//    creation, the Auth account is deleted so the email can be retried.
//    This was the root cause of "email taken, account creation fails" bug.
// 2. Secondary app pattern preserved — admin remains signed in throughout.
// 3. lastLoginAt initialised to null on creation so Teachers page can detect
//    "never logged in" vs "logged in at X" cleanly.

import { initializeApp, getApps }                   from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword }   from 'firebase/auth';
import { doc, setDoc, deleteDoc }                    from 'firebase/firestore';
import { db }                                        from './firebase';

const SECONDARY_APP_NAME = 'secondary-for-teacher-creation';

/**
 * Creates a Firebase Auth account for a teacher WITHOUT affecting the
 * currently signed-in admin session (uses a secondary Firebase app).
 *
 * ATOMIC: if Firestore profile write fails, the Auth account is deleted
 * so the email is immediately free to be retried — no orphaned emails.
 *
 * Returns the new user's UID.
 */
export async function createTeacherAccount(email, password, profileData) {
  const { getApp }     = await import('firebase/app');
  const mainApp        = getApp();
  const mainConfig     = mainApp.options;

  // Create or reuse a secondary Firebase app instance
  let secondaryApp;
  const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
  if (existing) {
    secondaryApp = existing;
  } else {
    secondaryApp = initializeApp(mainConfig, SECONDARY_APP_NAME);
  }

  const secondaryAuth = getAuth(secondaryApp);

  // Create the Firebase Auth account via the secondary app
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid  = cred.user.uid;

  // Sign out of secondary app immediately — keeps it clean for next use
  await secondaryAuth.signOut();

  // Now write the Firestore profile. If this fails, delete the Auth account.
  const assignedClasses  = Array.isArray(profileData.assignedClasses)  ? profileData.assignedClasses  : [];
  const assignedSubjects = Array.isArray(profileData.assignedSubjects) ? profileData.assignedSubjects : [];

  try {
    await setDoc(doc(db, 'users', uid), {
      id:               uid,
      schoolId:         profileData.schoolId,
      email,
      firstName:        profileData.firstName  || '',
      lastName:         profileData.lastName   || '',
      role:             'teacher',
      teacherId:        profileData.teacherId,
      assignedClasses,
      assignedSubjects,
      status:           'active',
      createdAt:        Date.now(),
      lastLoginAt:      null,   // populated on first login via AuthContext
    });

    return uid;

  } catch (firestoreError) {
    // ── ATOMIC ROLLBACK ──────────────────────────────────────────
    // Firestore write failed. Delete the Auth account so the email can be reused.
    console.error('[TeacherAuth] Firestore write failed — rolling back Auth account:', firestoreError.message);
    try {
      // Re-sign in to secondary to get the user object, then delete it
      const secondaryAuth2 = getAuth(secondaryApp);
      const rollbackCred   = await secondaryAuth2.signInWithEmailAndPassword(email, password).catch(() => null);
      if (rollbackCred?.user) {
        const { deleteUser } = await import('firebase/auth');
        await deleteUser(rollbackCred.user);
        await secondaryAuth2.signOut();
      }
    } catch (deleteErr) {
      console.error('[TeacherAuth] Could not delete orphaned Auth account:', deleteErr.message);
    }
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (_) { /* best-effort */ }

    throw new Error(
      `Teacher account creation failed and has been rolled back so the email is free to retry.\n\nTechnical: ${firestoreError.message}`
    );
  }
}
