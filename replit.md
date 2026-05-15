# ErMate - Emergency Room EMR Application

## Overview
ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application developed by Varah Group, designed to optimize the workflow for emergency medicine professionals. It supports patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. Key features include voice dictation, AI-powered clinical decision support, comprehensive documentation export, and an integrated "Learn" section for medical education. The application operates on a subscription-based model, aiming to enhance efficiency and accuracy in emergency care.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is built with React Native (Expo SDK 54, React 19.1.0 with React Compiler experimental) and TypeScript. Navigation is managed through `RootStackNavigator` and `MainTabNavigator`. State management utilizes `AuthContext`, `CaseContext`, and TanStack React Query. UI/UX features themed components, automatic dark/light mode (with Night Shift), medical-specific color schemes, and enhanced navigation with Reanimated. Clinical workflows follow sequential modal flows for Triage, Adult Case Sheets (ATLS-based), Pediatric Case Sheets (PALS-based for ≤16 years), and Discharge Summaries, with age-based routing.

React Query keys are scoped to the authenticated user (e.g. `["cases", user?.id]`) to prevent cross-user data leaks. All queries are gated with `enabled: !!user?.id`.

### Backend Architecture
An Express.js server in TypeScript acts as a proxy, directing all core API calls to an external backend at `https://er-emr-backend.onrender.com/api`.

### Data Storage
Drizzle ORM with PostgreSQL is used for `users` and `ai_feedback` tables, with Zod validation. Local storage uses AsyncStorage for user tokens, session data, case timing records, trivia streak counts, and night shift preferences.

### Authentication
Supports email/password, Google Sign-In, and Apple Sign-In. A `warmUpBackend()` function prevents cold start issues on the external backend. API calls are wrapped with `fetchWithTimeout`, and login/register attempts include a retry mechanism.

### Key Features
- **Voice Input System**: Uses `expo-audio` for recording, Sarvam AI for speech-to-text (with OpenAI Whisper as fallback), and OpenAI for clinical data extraction to auto-populate case sheet fields. This includes "Smart Dictation" for comprehensive history capture and field-specific dictation.
- **Document Scanning System**: Captures documents via camera or image picker, uses Sarvam Vision API for OCR, and OpenAI for clinical data structuring.
- **Clinical Decision Support** (formerly "AI Diagnosis"): Generates differential diagnoses labelled CONSISTENT / POSSIBLE / LESS LIKELY, with medical guideline citations and a self-learning feedback system. Integrates medical literature search (PubMed, WikEM) for evidence-based suggestions. Includes an inline disclaimer banner. Actions are labelled "Add to Case" / "Exclude".
- **Document Export System**: Exports Case Sheets and Discharge Summaries in PDF and DOCX formats.
- **Device Linking**: Secure WhatsApp-style web linking for web application access via expiring link codes.
- **Quick Case Sheet**: Allows direct entry into a case sheet, bypassing triage, with minimal patient information.
- **Editable Vitals**: Displayed on the Patient tab of case sheets, with age-based normal ranges and color-coding for pediatric patients.
- **Psychological Assessment**: Integrated into case sheets, flagging relevant conditions.
- **Learn Section**: Includes "Simulation-Based Teaching" (interactive clinical case simulations), "EM Reference Library" (AI-powered chat for guidelines), and "Trivia Time" (case-based MCQ quizzes with detailed explanations).

### Retention Features
- **Night Shift / Display Mode**: Auto dark mode between 9 pm–6 am, with manual override (Always Light / Always Dark). Controlled via `useNightShift` hook (AsyncStorage-persisted). Toggle is in Profile → Display Mode. `useTheme` exposes `nightShift: { pref, setPref, isNightTime }`.
- **Weekly Stats Screen** (`StatsScreen`): Accessible from the Dashboard ("My Weekly Stats" card) and Profile ("My Stats" menu item). Shows weekly cases documented, estimated time saved vs. paper (AVG_PAPER=18 min, AVG_DIGITAL=4 min), top presenting complaints, and all-time totals. Powered by `useCaseTimer` hook (AsyncStorage).
- **Case Timing & Time-Saved Feedback**: `CaseSheetScreen` records a start timestamp on mount (`caseStartRef`). On successful `commitToBackend`, it calls `recordCaseTime` and shows a 5-second green banner ("Case saved — approx. X min saved vs paper").
- **Trivia Weekly Streak**: `useTriviaStreak` hook tracks how many quizzes the user completes per calendar week. `TriviaHomeScreen` shows the streak badge on focus. `TriviaResultScreen` increments the count once on mount (guarded by `useRef`) and shows the updated count on the score card.
- **Cases Grouped by Complaint**: `CasesScreen` has a list/tag view toggle. The "By Complaint" mode uses `SectionList`, grouping cases by `presenting_complaint.text`, sorted by frequency.

### Privacy & Data Protection
A comprehensive Privacy Policy (Version 1.0) covers data collection, storage, security, AI processing, retention, user responsibility, compliance with Indian law, data deletion, and contact information. It includes data sharing preferences and biometric lock settings.

### Subscription & AI Credits Model
Offers a Free Plan (10 cases), a Base Plan (unlimited EMR, 20 AI credits/month), and purchasable AI Credit Packs. AI credits are consumed for specific AI actions and roll over indefinitely.

## External Dependencies

### External Backend API
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- **Functionality**: Handles authentication, case management, AI features, and subscription checks.

### Database
- PostgreSQL via Drizzle ORM.

### Key NPM Packages
- `expo-av`, `expo-audio`: Audio recording.
- `react-native-reanimated`: Animations.
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation.
- `@tanstack/react-query`: Server state management.

### AI Integration
- **OpenAI**: Used for clinical decision support, interpretation, clinical data extraction, and as a fallback for speech-to-text.
- **Sarvam AI**: Primary provider for speech-to-text (Saaras v3 model) and document OCR (Sarvam Vision).
- **PubMed (NCBI E-utilities) & WikEM API**: Integrated for medical literature search to support clinical decision support.

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
- Static build system: `npm run expo:static:build && npm run server:dev`. Delete `static-build/` to force a rebuild after code changes.
- Expo account: `varah`, EAS project ID: `7d70a8b1-9c3f-4c1b-9a1d-5a1849986df7`.
