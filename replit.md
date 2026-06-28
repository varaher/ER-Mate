# ErMate - Emergency Room EMR Application

## Overview
ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application developed by Varah Group, designed to optimize the workflow for emergency medicine professionals. It supports patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. Key features include voice dictation, document scanning, AI-powered clinical decision support, comprehensive documentation export, a team shift management system, and an integrated "Learn" section for medical education. The application operates on a subscription-based model, aiming to enhance efficiency and accuracy in emergency care.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is built with React Native (Expo SDK 54, React 19.1.0 with React Compiler experimental) and TypeScript. Navigation is managed through `RootStackNavigator` and `MainTabNavigator`. State management utilizes `AuthContext`, `CaseContext`, `DepartmentContext`, and TanStack React Query. UI/UX features themed components, automatic dark/light mode (with Night Shift), medical-specific color schemes, and enhanced navigation with Reanimated. Clinical workflows follow sequential modal flows for Triage, Adult Case Sheets (ATLS-based), Pediatric Case Sheets (PALS-based for ≤16 years), and Discharge Summaries, with age-based routing.

React Query keys are scoped to the authenticated user (e.g. `["cases", user?.id]`) to prevent cross-user data leaks. All queries are gated with `enabled: !!user?.id`.

### Backend Architecture
An Express.js server in TypeScript acts as a proxy, directing all core API calls to an external backend at `https://er-emr-backend.onrender.com/api`. Gzip compression (`compression` npm package, level 6) is enabled on all responses. JS/CSS static assets are served with `Cache-Control: public, max-age=31536000, immutable`; HTML and manifests use `no-cache`.

### Data Storage
Drizzle ORM with PostgreSQL is used for `users`, `ai_feedback`, `auth_sessions`, `departments`, `department_members`, `shifts`, `shift_sessions`, `handovers`, `case_overlays`, and `escalations` tables, with Zod validation. Local storage uses AsyncStorage for user tokens, session data, case timing records, trivia streak counts, and night shift preferences.

### Authentication
Supports email/password, Google Sign-In, and Apple Sign-In. A `warmUpBackend()` function prevents cold start issues on the external backend. API calls are wrapped with `fetchWithTimeout`, and login/register attempts include a retry mechanism.

`AuthContext` exports a `loginWithToken(authToken, userData)` helper that sets AsyncStorage + React state in one call — used by the web QR login flow.

### Key Features

#### Clinical EMR
- **Patient Triage**: 5-level (P1–P5) priority system with vitals, GCS, chief complaint, and triage colour at the door.
- **Adult Case Sheet** (ATLS-based): 7 clinical tabs — Patient, History (SAMPLE), Primary Survey (ABCDE), Examination, Treatment, Notes, Disposition. Switchable Medical / Trauma mode.
- **Pediatric Case Sheet** (PALS-based, ≤16 yrs): Age-appropriate documentation with paediatric normal ranges, weight-based dosing references, and developmental history.
- **Smart Dictation**: Doctor dictates naturally; Sarvam AI transcribes (Saaras v3, OpenAI Whisper fallback), GPT-4o extracts structured clinical data and auto-populates all relevant fields across all 7 tabs.
- **Dictation Completion Map**: After every Smart Dictation session, a visual bottom sheet shows which tabs were filled, field counts per tab (e.g. 14/40 fields captured), colour-coded progress bars (green ≥75%, amber partial, red 0%), and "Review gaps" button that jumps to the first empty tab. Coloured dots persist on each tab button so the doctor always knows where gaps remain.
- **Document Scanning**: Camera or gallery photo → Sarvam Vision OCR → GPT-4o structures clinical data → populates fields.
- **Clinical Decision Support**: AI-generated differential diagnoses labelled CONSISTENT / POSSIBLE / LESS LIKELY, with PubMed and WikEM citations. Actions: "Add to Case" / "Exclude".
- **Discharge Summary**: AI-generated from documented data, exportable as PDF or DOCX.
- **Editable Vitals**: Inline editing in the Patient tab with age-based normal ranges and colour coding for abnormal values.
- **Psychological Assessment**: PHQ-2, GAD-2, and PTSD flags integrated in the Examination tab.
- **Quick Case Sheet**: Bypass triage for fast-track or pre-triaged patients — start a case with just name and complaint.

#### Team & Shift Management (local PostgreSQL, new)
- **Department Setup**: HOD creates the department with name, hospital, and shift schedules (Morning / Evening / Night with max consultant and resident slot counts). Invite link shareable via WhatsApp.
- **Shift Check-In**: Shift Selection modal appears when the app is opened during a shift window. Doctors pick their shift, see real-time slot counts, and tap Start. A shift banner appears on the Dashboard.
- **Shift-Aware Case View**: When on shift, consultants and HOD see a SHIFT CASES section in the Cases tab — all cases from every doctor currently on the same shift, colour-coded by triage priority with doctor name/role badges. Auto-refreshes every 30 seconds.
- **Consultant Review**: Consultant taps a resident's shift case → review modal → writes clinical notes → case is marked Reviewed (green badge visible to all on the shift).
- **HOD Dashboard**: Live view of shift slot counts, all doctors currently on shift with duration, all active cases across all shifts, and Force Out for individual sessions. Names resolved from department roster (not raw UUIDs).
- **Manage Roster**: HOD adds/removes team members; invite link regeneration. Members list shows name, email, role, and on-shift status.
- **Handover Sheet**: Select cases to hand over, add pending notes, export PDF. Incoming handovers visible in Profile.

#### Learn Section
- **Simulation-Based Teaching**: Branching clinical scenarios with evolving vitals, investigation results, and management decision trees.
- **EM Reference Library**: AI-powered guideline chat (GPT-4o + PubMed integration).
- **Trivia Time**: Case-based MCQ quizzes with weekly streak tracking (AsyncStorage-persisted).

#### Tools & Productivity
- **Pediatric Drug Calculator**: Weight-based emergency drug dosing (adrenaline, atropine, adenosine, fluid boluses, etc.).
- **My Weekly Stats**: Cases documented this week, estimated time saved vs paper (avg 14 min/case), top presenting complaints, all-time totals. Powered by `useCaseTimer`.
- **Cases by Complaint**: Toggle the Cases tab to group cases by presenting complaint, sorted by frequency.
- **Night Shift Display Mode**: Auto dark mode 9 pm–6 am; manual override (Always Light / Always Dark).
- **Link to Web**: 6-digit code or QR scan to transfer phone session to a desktop browser instantly.
- **Feature Tour**: `TourScreen` (Profile → Take a Tour) — interactive expandable cards for every feature across 4 categories: Clinical EMR, Team & Shifts, Learning, Tools. NEW badge on shift-related and dictation-map features.

### Case Sheet Field Mapping (External Backend)
When loading cases saved by the external backend directly (not via the app's own voice commit), the field structure differs:
- **Primary Assessment**: External backend stores ABCDE as flat-prefixed fields under `primary_assessment` (e.g. `airway_status`, `breathing_rr`, `circulation_hr`, `disability_gcs_e/v/m`, `disability_grbs`, `disability_avpu`, `exposure_temperature`). `loadCase` in `CaseSheetScreen` maps these when `abcde` is absent.
- **Procedures**: Top-level `procedures_performed` array is read as fallback when `procedures.procedures_performed` is absent.
- **Medications**: Top-level `drugs_administered` array is used as fallback when `treatment.medications` is empty.
- **History**: `history.signs_and_symptoms` → `sample.signsSymptoms`; `history.family_history` and `history.social_history` are appended to `otherHistory`.

### Dictation Completion Map Architecture
`client/components/DictationResultModal.tsx` exports:
- `calculateDictationCompletion(data: SmartDictationExtracted): DictationCompletion` — scores each of 7 tabs (patient 10 fields, history 7, primary 5, exam 8, treatment 5, notes 1, disposition 4) from the extracted dictation data.
- `getTabStatus(tc: TabCompletion): "full" | "partial" | "empty"` — full ≥75%, partial >0%, empty = 0.
- `DictationResultModal` — bottom sheet with overall bar, per-tab progress rows, and "Review gaps" / "Done" actions.
In `CaseSheetScreen`: after `handleSmartDictation` completes, `calculateDictationCompletion(data)` is called and stored in `dictationCompletion` state. `TabButton` reads this state to render a coloured dot (green/amber/red) per tab.

### Team System Architecture
Departments, shifts, and shift sessions live entirely in local PostgreSQL. Cases remain on the external backend. Data is merged on `caseId` (text) client-side.

Key tables: `departments`, `department_members` (has `name`, `email`, `role`, `status`), `shifts` (has `maxConsultants`, `maxResidents`, `startTime`, `endTime`), `shift_sessions` (has `userId`, `roleForShift`, `checkedInAt`, `status`), `case_overlays` (has `patientName`, `patientAge`, `chiefComplaint`, `triagePriority`, `doctorUserId`, `doctorName`).

Routes: `server/routes/department.ts` (department CRUD, members, admin endpoint), `server/routes/shifts.ts` (shift CRUD, check-in/out, shift cases, consultant review, HOD all-shift-cases, shift counts), registered via `registerDepartmentRoutes()` and `registerShiftRoutes()` in `server/routes.ts`.

`DepartmentContext` exports: `department`, `membership`, `shiftSession`, `activeShift`, `isHOD`, `checkIn`, `dismissShiftSelect`, `showShiftSelect`, `shifts`.

### Shift-Aware Case Registration
After every successful `commitToBackend` in `CaseSheetScreen`, `POST /api/cases/:id/register-shift` is called if the user is on an active shift. This stores a patient snapshot (name, age, chief complaint, triage priority, doctor name) in `case_overlays` linked to the shift session — enabling the Shift Cases view and HOD Dashboard.

### Privacy & Case Filtering
Cases are filtered server-side by checking `created_by_user_id` (primary), `created_by`, `doctor_id`, `user_id`, and `doctor_email` against the authenticated user. This prevents any cross-user data leaks regardless of which field name the external backend uses.

### Retention Features
- **Night Shift / Display Mode**: Auto dark mode between 9 pm–6 am, with manual override (Always Light / Always Dark). Controlled via `useNightShift` hook (AsyncStorage-persisted). Toggle is in Profile → Display Mode. `useTheme` exposes `nightShift: { pref, setPref, isNightTime }`.
- **Weekly Stats Screen** (`StatsScreen`): Accessible from the Dashboard ("My Weekly Stats" card) and Profile ("My Stats" menu item). Shows weekly cases documented, estimated time saved vs. paper (AVG_PAPER=18 min, AVG_DIGITAL=4 min), top presenting complaints, and all-time totals. Powered by `useCaseTimer` hook (AsyncStorage).
- **Case Timing & Time-Saved Feedback**: `CaseSheetScreen` records a start timestamp on mount (`caseStartRef`). On successful `commitToBackend`, it calls `recordCaseTime` and shows a 5-second green banner ("Case saved — approx. X min saved vs paper").
- **Trivia Weekly Streak**: `useTriviaStreak` hook tracks how many quizzes the user completes per calendar week. `TriviaHomeScreen` shows the streak badge on focus. `TriviaResultScreen` increments the count once on mount (guarded by `useRef`) and shows the updated count on the score card.
- **Cases Grouped by Complaint**: `CasesScreen` has a list/tag view toggle. The "By Complaint" mode uses `SectionList`, grouping cases by `presenting_complaint.text`, sorted by frequency.

### Performance
- **Gzip compression**: `compression` middleware (level 6) on the Express server reduces the 3.6 MB JS bundle to ~878 KB on the wire (~75% reduction).
- **Browser caching**: JS/CSS assets served with `Cache-Control: public, max-age=31536000, immutable` — returning users load from local cache instantly. HTML/manifests use `no-cache` to ensure app updates always reach users.
- **Static build skipping**: `scripts/build.js` skips the Metro bundle step if `static-build/` already exists, making server restarts near-instant.
- **Service Worker**: PWA service worker pre-caches key assets and serves cached content when offline.

### Privacy & Data Protection
A comprehensive Privacy Policy (Version 1.0) covers data collection, storage, security, AI processing, retention, user responsibility, compliance with Indian law, data deletion, and contact information. It includes data sharing preferences and biometric lock settings.

### Subscription & AI Credits Model
Offers a Free Plan (10 cases), a Base Plan (unlimited EMR, 20 AI credits/month), and purchasable AI Credit Packs. AI credits are consumed for specific AI actions (Smart Dictation, Clinical Decision Support, document scanning, EM Reference queries, AI discharge summaries) and roll over indefinitely.

## External Dependencies

### External Backend API
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- **Functionality**: Handles authentication, case management, AI features, and subscription checks.

### Database
- PostgreSQL via Drizzle ORM (local tables for team/shift system).

### Key NPM Packages
- `expo-av`, `expo-audio`: Audio recording.
- `react-native-reanimated`: Animations.
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation.
- `@tanstack/react-query`: Server state management.
- `compression`: Gzip middleware for Express (type declaration in `server/compression.d.ts`).

### AI Integration
- **OpenAI**: Clinical decision support, data extraction, and fallback speech-to-text.
- **Sarvam AI**: Primary speech-to-text (Saaras v3 model) and document OCR (Sarvam Vision).
- **PubMed (NCBI E-utilities) & WikEM API**: Medical literature search for clinical decision support.

## Key Custom Hooks
| Hook | File | Purpose |
|---|---|---|
| `useTheme` | `client/hooks/useTheme.ts` | Theme + dark mode + nightShift controls |
| `useNightShift` | `client/hooks/useNightShift.ts` | Auto/manual dark mode with AsyncStorage persistence |
| `useCaseTimer` | `client/hooks/useCaseTimer.ts` | Records per-case documentation time; computes weekly stats and time saved |
| `useTriviaStreak` | `client/hooks/useTriviaStreak.ts` | Tracks weekly trivia quiz completions via AsyncStorage |

## Important Constraints
- **Never edit `package.json`** — use `npm run dev` to start Expo.
- **Never change bundle identifiers** (`com.ermate.app`) after initial setup.
- **Never modify the `scripts/` directory** — critical for static deployment.
- **Never downgrade React Native or Expo versions**.
- **Never hardcode domain URLs** — always use `process.env.EXPO_PUBLIC_DOMAIN` or `getApiUrl()`.
- Static build system: `npm run expo:static:build && npm run server:dev`. Delete `static-build/` to force a rebuild after code changes. Server-only changes (no client edits) take effect on restart without rebuilding.
- Expo account: `varah`, EAS project ID: `7d70a8b1-9c3f-4c1b-9a1d-5a1849986df7`.
