# School Management & Assessment System

A production-grade, multi-tenant academic records platform with offline-first support, promotion tracking, analytics, and backup/recovery.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Firestore Schema Design](#firestore-schema-design)
4. [Enrollment System Design](#enrollment-system-design)
5. [Promotion Engine](#promotion-engine)
6. [Offline Sync Strategy](#offline-sync-strategy)
7. [Security Rules](#security-rules)
8. [Setup Instructions](#setup-instructions)
9. [Deployment Guide](#deployment-guide)
10. [Folder Structure](#folder-structure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   React (Vite) SPA                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │  Pages   │ │ Services │ │   Contexts (State)   │ │
│  └──────────┘ └──────────┘ └──────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐        ┌───────────▼──────────┐
│   IndexedDB    │        │   Firebase Firestore  │
│ (Offline Store)│◄──────►│  (Source of Truth)   │
└────────────────┘  Sync  └──────────────────────┘
     Write-first          Auto-sync when online
```

### Key Design Principles

- **Multi-tenant isolation**: All data scoped by `schoolId`. Cross-school data access is impossible at the Firestore rules level.
- **Offline-first**: All writes go to IndexedDB immediately. A sync queue persists pending operations until the device is online.
- **Enrollment-based identity**: Students have permanent identities; their class relationship is time-bound through Enrollment records.
- **Immutable audit logs**: Promotions, finalized results, and restore operations create append-only audit records.

---

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Frontend      | React 18, Vite                      |
| Auth          | Firebase Authentication             |
| Database      | Firebase Firestore                  |
| Offline Store | IndexedDB via `idb`                 |
| Charts        | Recharts                            |
| PDF Export    | jsPDF + jsPDF-autotable             |
| Excel         | SheetJS (xlsx)                      |
| Routing       | React Router v6                     |
| Styling       | Custom CSS (no framework)           |

---

## Firestore Schema Design

```
schools/
  {schoolId}/
    name, code, address, phone, email
    academicYear, currentTerm
    gradingScale[]          ← configurable per school
    promotionRules          ← configurable per school

users/
  {userId}/
    schoolId, email, role   ← 'admin' | 'teacher'
    firstName, lastName
    assignedClasses[]       ← teachers only
    assignedSubjects[]      ← teachers only

students/
  {studentId}/
    schoolId
    studentCode             ← e.g. "GHS-0001"
    firstName, lastName, dateOfBirth, gender
    guardianName, guardianPhone, address
    status                  ← 'active' | 'graduated'
    createdAt

enrollments/              ← TIME-BASED class relationship
  {enrollmentId}/
    schoolId
    studentId               ← FK → students
    classId                 ← FK → classes
    academicYear            ← e.g. "2024/2025"
    term                    ← "1" | "2" | "3"
    status                  ← 'active' | 'completed' | 'conditional'
    enrolledAt, completedAt
    promotionId             ← FK → promotions (when completed)

teachers/
  {teacherId}/
    schoolId
    firstName, lastName, email, staffId
    assignedClasses[]
    assignedSubjects[]

classes/
  {classId}/
    schoolId
    name, level, capacity

subjects/
  {subjectId}/
    schoolId
    name, code
    classIds[]              ← which classes offer this subject
    maxClassScore, maxExamScore

scores/
  {scoreId}/
    schoolId
    enrollmentId, studentId, classId, subjectId
    academicYear, term
    classScore, examScore
    total                   ← computed
    isFinalized             ← bool

results/                  ← computed, precomputed per term
  {resultId}/
    schoolId
    enrollmentId, studentId, classId
    academicYear, term
    totalScore, average, position
    subjectResults[]        ← [{subjectId, subjectName, total, grade, remarks}]
    isFinalized             ← bool, required for promotion

promotions/               ← IMMUTABLE AUDIT LOG
  {promotionId}/
    schoolId
    fromClassId, toClassId
    fromAcademicYear, fromTerm
    toAcademicYear, toTerm
    adminId, adminNote, timestamp
    affectedStudents[]      ← full record of each student's outcome
    summary                 ← {promoted, repeated, conditional, graduated}

analytics/                ← PRECOMPUTED SNAPSHOTS
  {snapshotId}/
    schoolId, classId, academicYear, term
    classAverage, studentCount
    gradeDistribution       ← {A1: 5, B2: 12, ...}
    subjectAverages[]       ← [{subjectId, subjectName, average}]
    topStudents[]
    createdAt
```

---

## Enrollment System Design

The enrollment system is the architectural core that prevents data loss and enables history tracking.

### Why Not Attach Class Directly to Student?

```
❌ WRONG (what NOT to do):
student.classId = "form2a"    ← loses where student was before
student.classId = "form1a"    ← on promotion, history is gone

✅ CORRECT (enrollment-based):
Enrollment 1: { studentId, classId: "form1a", year: "2023/24", term: 1, status: "completed" }
Enrollment 2: { studentId, classId: "form2a", year: "2024/25", term: 1, status: "active" }
```

### Enrollment Lifecycle

```
Student added
    │
    ▼
enrollStudent() → creates Enrollment { status: "active" }
    │
    ▼
Scores entered against enrollmentId (not studentId directly)
    │
    ▼
Results generated → uses enrollmentId as anchor
    │
    ▼
Results finalized (isFinalized: true)
    │
    ▼
Promotion executed:
  ├─ Old enrollment → status: "completed", completedAt, promotionId
  └─ New enrollment created for next year/class
```

---

## Promotion Engine

The promotion engine is a 5-step transactional process.

### Step 1: Validation
Before promotion can proceed, the system checks:
- Results exist for the class/term
- All results are finalized (`isFinalized: true`)
- All active enrollments have corresponding results
- No prior promotion exists for this class/term

### Step 2: Preview
The system applies promotion rules to every student and builds a preview table showing:
- Current class → Next class
- Calculated decision (Promote / Repeat / Conditional / Graduate)
- Admin override column (per-student)

### Step 3: Rule Engine
```
average >= promoteThreshold (default: 50) → PROMOTE
average >= conditionalMin   (default: 40) → CONDITIONAL
average <  repeatBelow      (default: 40) → REPEAT
isLastClass == true                       → GRADUATED
```

### Step 4: Execution (Safe Transaction)
```javascript
// For each student:

// 1. Mark old enrollment complete (never deleted)
enrollment.status = "completed"
enrollment.completedAt = timestamp
enrollment.promotionId = auditId

// 2. Create NEW enrollment for next year
newEnrollment = {
  studentId, classId: nextClassId,   // or same class if repeating
  academicYear: nextYear,
  term: nextTerm,
  status: "active"
}
```

### Step 5: Audit Log
An immutable `promotions` document is written with:
- Admin ID, timestamp, note
- Full list of affected students and their decisions
- Summary counts

---

## Offline Sync Strategy

### Architecture: Write-Through with Sync Queue

```
User Action (e.g., save score)
        │
        ▼
  writeRecord()
  ├─ idbPut(store, record)      ← IMMEDIATE — UI never waits
  └─ enqueueSyncOperation()     ← appended to syncQueue in IDB
        │
        ▼
  If online: syncToFirestore()  ← processes queue via batch writes
  If offline: stays in queue
        │
        ▼
  window 'online' event fires   ← auto-triggers sync
```

### Conflict Resolution Rules

| Scenario | Resolution |
|----------|------------|
| Same record updated offline on two devices | Last-write-wins (by `updatedAt` timestamp) |
| Finalized result modified offline | Server copy wins — finalized records are locked |
| Score entered while offline, then online synced | Sync proceeds normally (non-destructive) |
| Promotion executed while offline | Blocked — promotion requires online validation |

### Sync States (shown in topbar)
- `● Synced` — all local changes committed to Firestore
- `↻ Syncing...` — batch write in progress
- `⚠ Offline` — device is offline, changes queued
- `✕ Sync Error` — batch write failed, will retry

---

## Security Rules

The Firestore rules enforce three layers:

1. **Authentication**: All requests require a valid Firebase Auth token.
2. **School isolation**: `getUserData().schoolId` must match the document's `schoolId`.
3. **Role enforcement**: Admins have full write access. Teachers can only write scores for their assigned classes/subjects. Promotion and finalization are admin-only.

Key immutability rules:
- `students`: never deleted (status changed only)
- `enrollments`: never deleted (completed status only)
- `results`: cannot be updated after `isFinalized: true`
- `promotions`: completely immutable after creation

---

## Setup Instructions

### 1. Firebase Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Create project at https://console.firebase.google.com
# Enable: Authentication (Email/Password), Firestore, Storage
```

### 2. Clone & Install

```bash
git clone <your-repo>
cd school-management-system
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase config values
# Find these in Firebase Console → Project Settings → Your apps
```

### 4. Deploy Firestore Rules & Indexes

```bash
firebase use --add   # select your project
firebase deploy --only firestore
```

### 5. Run Locally

```bash
npm run dev
# Opens at http://localhost:5173
```

### 6. First Login

Visit `/register` to create your school account. This creates:
- A Firebase Auth user
- A `schools/{schoolId}` document
- A `users/{uid}` document with `role: "admin"`

---

## Deployment Guide

### Firebase Hosting (Recommended)

```bash
npm run build
firebase deploy --only hosting
```

### Vercel

```bash
npm install -g vercel
vercel --prod
# Set environment variables in Vercel dashboard
```

### Environment Variables for Production

Set these in your hosting provider's dashboard (never in code):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

---

## Folder Structure

```
src/
├── components/
│   └── layout/
│       └── Layout.jsx          ← Sidebar + Topbar shell
├── contexts/
│   ├── AuthContext.jsx          ← Firebase auth + user profile
│   └── SchoolContext.jsx        ← School-wide data (classes, subjects, teachers)
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx
│   ├── Students.jsx             ← CRUD + Excel import + enrollment
│   ├── Teachers.jsx             ← CRUD + Firebase Auth creation
│   ├── Classes.jsx
│   ├── Subjects.jsx
│   ├── Scores.jsx               ← Excel-like batch score entry
│   ├── Reports.jsx              ← Result generation + PDF download
│   ├── Promotion.jsx            ← 5-step promotion engine
│   ├── Analytics.jsx            ← Recharts dashboard
│   ├── Backup.jsx               ← Backup/restore/export
│   └── Settings.jsx             ← School config, grading, promo rules
├── services/
│   ├── firebase.js              ← Firebase app init
│   ├── indexedDB.js             ← IDB wrapper (offline store)
│   ├── syncService.js           ← Write-through + sync queue
│   ├── studentService.js        ← Student + enrollment CRUD
│   ├── scoreService.js          ← Score entry + result engine
│   ├── promotionService.js      ← 5-step promotion engine
│   ├── reportService.js         ← jsPDF report generation
│   └── backupService.js         ← Backup/restore/export
├── index.css                    ← Full design system
├── App.jsx                      ← Router + protected routes
└── main.jsx
```

---

## Scaling Notes

- **Thousands of students**: Firestore queries are indexed by `schoolId + classId + academicYear + term`. Each query is O(results) not O(all students).
- **Multiple schools**: Complete data isolation via `schoolId` — no joins between schools are possible.
- **Read optimization**: `SchoolContext` caches classes/subjects/teachers in memory. Analytics snapshots are precomputed at result generation time.
- **Write optimization**: Score entry uses client-side debouncing. Batch writes via Firestore `writeBatch` for promotions.
- **Offline scalability**: IndexedDB holds the full school dataset locally. Initial sync pulls all collections on login; subsequent syncs are delta-based via the sync queue.
