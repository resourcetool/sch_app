// src/services/teacherAuthService.js
//
// NEW FILE — Handles teacher account creation WITHOUT affecting the
// currently logged-in admin session.
//
// Problem: Firebase's createUserWithEmailAndPassword() signs IN the
// newly created user, which logs the admin OUT and redirects them
// away. This is the root cause of the "admin redirected to teachers
// page" bug.
//
// Solution: Use a SECONDARY Firebase app instance just for creating
// accounts. The secondary app is separate from the main auth state,
// so the admin remains signed in throughout.

import { initializeApp, getApps }    from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc }                from 'firebase/firestore';
import { db }                         from './firebase';

const SECONDARY_APP_NAME = 'secondary-for-teacher-creation';

/**
 * Creates a Firebase Auth account for a teacher without affecting
 * the currently signed-in admin user.
 *
 * Returns the new user's UID.
 */
export async function createTeacherAccount(email, password, profileData) {
  // Get the main app's config so we can clone it for the secondary app
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

  // Create the user in the secondary auth context
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid  = cred.user.uid;

  // Sign out of the secondary auth so it stays clean for next use
  await secondaryAuth.signOut();

  // Write the user profile document to Firestore (using the main db)
  // assignedClasses and assignedSubjects MUST be arrays in Firestore.
  // The rules use .hasAny() on these fields — if they are missing or not
  // arrays, hasAny() throws and the teacher gets permission denied.
  const assignedClasses  = Array.isArray(profileData.assignedClasses)  ? profileData.assignedClasses  : [];
  const assignedSubjects = Array.isArray(profileData.assignedSubjects) ? profileData.assignedSubjects : [];

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
  });

  return uid;
}
