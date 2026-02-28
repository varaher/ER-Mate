# ErMate - Emergency Room EMR Application

## Overview

ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application built with React Native and Expo, developed by **Varah Group**. Its primary purpose is to streamline the workflow for emergency medicine physicians and residents, covering patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. The application aims to improve efficiency and accuracy in emergency care through features like voice dictation, AI-powered diagnostics, and comprehensive documentation export. It operates on a subscription-based model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54, React 19.1.0 (with React Compiler experimental), and TypeScript.
**Navigation**: `RootStackNavigator` for authentication and modals, `MainTabNavigator` for core app navigation (Dashboard, Cases, New Patient, Logs, Profile), and native stack navigation for screen transitions.
**State Management**: `AuthContext` for authentication, `CaseContext` for current case data, and TanStack React Query for server state.
**UI/UX**: Themed components (`ThemedView`, `ThemedText`, `Button`, `Card`) with automatic dark/light mode and medical-specific color schemes. `KeyboardAwareScrollViewCompat` and Reanimated are used for enhanced UI/UX.
**Clinical Workflow**: Sequential modal flows for Triage, Adult Case Sheet (ATLS-based, 7 tabs), Pediatric Case Sheet (PALS-based for ≤16 years), and Discharge Summary. Age-based routing directs patients to the appropriate case sheet.

### Backend Architecture

**Server**: Express.js with TypeScript, primarily acting as a proxy to an external backend.
**Current State**: The local Express server handles basic routing and serves static files, with all core API calls directed to `https://er-emr-backend.onrender.com/api`.

### Data Storage

**Database Schema**: Drizzle ORM with PostgreSQL for `users` and `ai_feedback` tables, defined in `shared/schema.ts` with Zod validation.
**Local Storage**: AsyncStorage for user token and session, `useRef` for form data to optimize input performance.

### Key Features

**Voice Input System**: Integrates `VoiceRecorder` component using `expo-audio` for recording. Speech-to-text uses Sarvam AI (Saaras v3 model, optimized for Indian accents) as primary with OpenAI Whisper as fallback. OpenAI handles clinical data extraction from transcripts to auto-populate case sheet fields. Available in both adult and pediatric case sheets (Notes tab).
**Document Scanning System**: `DocumentScanner` component uses device camera or image picker to capture documents (lab reports, prescriptions, handwritten notes). Images are sent to `/api/scan/document` endpoint which uses Sarvam Vision API for OCR text extraction, then OpenAI for clinical data structuring. Available in both adult and pediatric case sheets (Notes tab).
**AI Diagnosis System**: Generates differential diagnoses with confidence levels and medical guideline citations. It includes a self-learning feedback system that stores user feedback to improve AI accuracy.
**Document Export System**: Supports export of Case Sheets and Discharge Summaries in PDF and DOCX formats, with platform-aware file handling for web and mobile.
**Device Linking**: Provides a secure WhatsApp-style web linking feature for accessing the web application, generating temporary, expiring link codes.
**Quick Case Sheet** (`client/screens/QuickCaseSheetScreen.tsx`): Skip triage and jump directly into a case sheet with minimal patient info (name, age, sex). Accessed via the FAB "+" button on Dashboard (3 options: Start with Triage / Start Adult Case Sheet / Start Pediatric Case Sheet) or Dashboard shortcut buttons. Vitals are editable directly on the Patient tab of the case sheet.
**Editable Vitals on Patient Tab**: Both adult and pediatric case sheets now show editable vital signs on the Patient tab. Adult case sheet displays HR, RR, SpO2, Temp, GRBS, Pain, BP (Sys/Dia), and GCS (E/V/M) in a clean grid layout with units. Pediatric case sheet (`PediatricCaseSheetScreen.tsx`) shows the same vitals with **age-based normal ranges** displayed below each field (e.g., "100-160 bpm" for infants). Vital values are **color-coded**: green when within normal range for the age group, red when abnormal. Age groups: Neonate (0-1 mo), Infant (1-12 mo), Toddler (1-3 yr), Preschool (3-6 yr), School Age (6-12 yr), Adolescent (12-16 yr). Normal ranges defined in `client/lib/pediatricVitals.ts`. Smart Dictation also populates vitals when mentioned during dictation.
**Psychological Assessment**: Captured in Case Sheet (suicidal ideation, self-harm history, intent to harm others, substance abuse, psychiatric history, treatment status, support system, notes). Displayed in View Case Sheet with "Normal" default when nothing is marked, or "Abnormal" in red when flags are present. Data saved via `psychological` key in case payload.
**Adult View Case Sheet Section Order**: Patient Info → Triage/Vitals → Presenting Complaint → Primary Assessment (ABCDE) → Adjuncts → History of Present Illness → Secondary Survey (Signs & Symptoms, Past Medical, Surgical, Family/Gynec, LMP, Allergies) → General Examination → Systemic Examination (CNS, CVS, Chest, Abdomen, Extremities) → Psychological Assessment → Investigations → Treatment Plan (Medications, Infusions, Notes) → Procedures → ER Observation → Disposition → Differential Diagnosis → AI Diagnosis Panel → Addendum Notes → Case Information.

### Learn Section

The app includes a dedicated "Learn" tab (`client/screens/LearnScreen.tsx`) in the main navigation with three educational modules:

**Simulation-Based Teaching** (`client/screens/SimulationListScreen.tsx`, `SimulationScreen.tsx`, `SimulationResultScreen.tsx`, `client/data/simulationCases.ts`): Interactive clinical case simulations with 11 realistic ER cases (STEMI, Tension Pneumothorax, Sepsis, Anaphylaxis, DKA, Ectopic Pregnancy, Stroke, PE, Meningitis, Pediatric Seizure, Aortic Dissection). Features include distractor/unnecessary actions with time penalties and clinical harm warnings, auto-timeout system, action timestamps tracking, multi-factor scoring with clinical feedback, harmful/unnecessary action identification, action timeline on results screen, 5-step interactive tutorial overlay (shown first time, reopenable), color-coded status badges (Done/Red Flag/Unnecessary/Harmful/Pending/Critical), animated critical vitals with blinking, contextual tab hints, full case scenario text display, and styled in-app confirmation modal for ending simulation.

**EM Reference Library** (`client/screens/EMReferenceScreen.tsx`): Emergency Medicine reference resource with AI-powered chat for looking up clinical guidelines, protocols, and medical information.

**Trivia Time** (`client/screens/TriviaHomeScreen.tsx`, `TriviaQuizScreen.tsx`, `TriviaResultScreen.tsx`, `client/data/triviaQuestions.ts`): Case-based MCQ quiz system covering all medical specialties. Features three difficulty levels (Easy, Medium, Hard), category selection, detailed explanations with reliable medical references for each question, and a results screen with score breakdown.

### Privacy & Data Protection

**Privacy Policy Screen** (`client/screens/PrivacyScreen.tsx`): Comprehensive privacy policy (Version 1.0) accessible from Profile > Privacy. Contains 11 expandable sections matching the official Varah Group privacy policy draft:
1. Introduction (ErMate by Varah Group)
2. Information We Collect (account info + clinical data)
3. Purpose of Data Collection (clinical documentation, workflow, AI support, education)
4. Data Storage & Security (HTTPS, authenticated access, technical safeguards)
5. AI Processing (third-party AI usage, no independent storage by AI providers)
6. Data Retention (active while subscription active, deletion options)
7. User Responsibility (patient consent, hospital policies, device security)
8. Compliance with Indian Law (DPDPA 2023, medical record-keeping guidelines)
9. Data Deletion Requests (account/data deletion within 30 days)
10. Changes to This Policy (notification through app updates)
11. Contact Information (Varah Group, varahgrp@gmail.com, www.varahgrp.com)

Also includes data sharing preferences (analytics toggle, AI training toggle), biometric lock setting, and data management actions (clear local data, download data, delete account).

### Subscription & AI Credits Model

**Pricing**:
- **Free Plan**: 10 cases total, all clinical features included, no AI credits.
- **Base Plan**: Rs. 799/month with **first month free** for new users. Unlimited manual EMR, case storage, PDF/DOCX export, and 20 AI credits per month.
- **Credit Packs**: 50 credits / Rs. 499, 100 credits / Rs. 899 (best value), 300 credits / Rs. 2499.

**AI Credit System** (1 AI action = 1 credit, no exceptions):
- **Uses 1 credit**: Smart Dictation, ABG AI Interpretation, Provisional AI Diagnosis, AI Differential Reasoning Panel, Generate Discharge Summary (AI), Course in Hospital AI Generation, Document OCR Scan, EM Reference Ask AI (per query), EM Reference Continue after 3 replies.
- **Always free (0 credits)**: Manual typing & editing, case save & storage, view cases & dashboard, export to PDF/DOCX, browse EM Reference library, simulation cases (static), trivia quizzes.
- Credits roll over forever (never expire), +20 added monthly with active subscription, usable only while subscription is active.

**Implementation**: `client/screens/UpgradeScreen.tsx` handles plan display, free trial banner, credit balance, credit pack purchases, and the "How AI Credits Work" info section. Dashboard (`client/screens/DashboardScreen.tsx`) shows an AI Credits widget with color-coded warnings (green = healthy, amber = low at ≤10, red = exhausted). Subscription status fetched from `/api/subscription/status` endpoint on the external backend.

## External Dependencies

**External Backend API**:
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- **Functionality**: Handles authentication, case management, AI features, and subscription checks. All clinical data operations.

**Database**:
- PostgreSQL via Drizzle ORM.
- Requires `DATABASE_URL` environment variable.

**Key NPM Packages**:
- `expo-av`, `expo-audio`: Audio recording.
- `expo-blur`, `expo-glass-effect`: UI effects.
- `expo-haptics`: Tactile feedback.
- `react-native-reanimated`: Animations.
- `react-native-keyboard-controller`: Keyboard management.
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation.
- `@tanstack/react-query`: Server state management.

**AI Integration**:
- OpenAI (via Replit AI Integrations) for AI diagnosis, interpretation, and clinical data extraction.
- Sarvam AI (via SARVAM_AI_API_KEY secret) for speech-to-text (Saaras v3 model) and document OCR (Sarvam Vision).
- **AI Diagnosis System** (`server/services/aiDiagnosis.ts`): Perplexity-style evidence-based diagnosis with real-time medical literature search. Searches PubMed API and WikEM before AI analysis, includes context-appropriate textbook and guideline references (ATLS, PALS, Surviving Sepsis, etc.). Returns `DiagnosisSuggestion` with `keyFindings`, `workup`, `management`, inline `[citation]` references, and `SearchSource[]` array with clickable URLs.
- **Medical Search Service** (`server/services/medicalSearch.ts`): Searches PubMed (NCBI E-utilities), WikEM API, and provides curated textbook/guideline references based on chief complaint context. Returns `MedicalSearchResult[]` with source types: pubmed, textbook, guideline, wikem.
- **AIDiagnosisPanel** (`client/components/AIDiagnosisPanel.tsx`): Perplexity-style UI with expandable differential diagnoses, inline `[1]` citation references, horizontally scrollable citation chips, collapsible Sources panel with categorized references, and self-learning feedback (accept/reject). Red flags include timeframe badges and cited guidelines.
- **Vibe Dictation / Smart Dictation** (`client/components/SmartDictation.tsx`): "Vibe coding" approach - doctors dictate complete patient history naturally; app transcribes via Sarvam AI STT (primary) + OpenAI gpt-4o-mini-transcribe (fallback), displays full editable transcript, then on "Copy to Case Sheet" tap, AI (GPT-4o) parses and auto-fills 20+ case sheet fields. Two-step flow: (1) Record & see transcript, (2) Copy to case sheet with field preview. Server uses ffmpeg (`server/services/audioConvert.ts`) to convert any audio format (iOS .caf, etc.) to WAV before STT. Endpoints: `/api/voice/transcribe` (audio→text), `/api/voice/extract-clinical` (text→structured fields), `/api/voice/smart-dictation` (combined). Integrated in both Adult (ATLS) and Pediatric (PALS) case sheets.
- **Voice Recorder** (`client/components/VoiceRecorder.tsx`): Same two-step flow for individual fields - Record → See transcript → Copy to Field. Used in case sheet Notes tabs and Triage screen.

## Company Information

- **Developer**: Varah Group
- **Contact Email**: varahgrp@gmail.com
- **Website**: www.varahgrp.com

## Future Plans

- **ARYA**: Parent company's standalone AI assistant system (like Alexa/Gemini/OpenAI). Currently under production. Will eventually be integrated into ErMate and ErPrana to replace/enhance the current in-app health chat features.
