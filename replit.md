# ErMate - Emergency Room EMR Application

## Release Status: RC-2 (Post Code Freeze Features)

**Status**: Release Candidate 2 - Code freeze broken with user approval for new features  
**Date**: January 17, 2026

### RC-2 New Features (January 17, 2026)
1. **Infusion Section** - Added dedicated section in Treatment tab for IV infusions/drips with drug name, dose, dilution, and rate fields
2. **Treatment History System** - Auto-saves treatments to database for ML-based recommendations on future patients
3. **Enhanced ViewCaseScreen** - Now displays medications list with dose/route/frequency, infusions, IV fluids, and primary diagnosis
4. **Physical Exam Abnormal Findings** - ViewCaseScreen now properly displays all abnormal findings (pallor, icterus, cyanosis, etc.)

### RC-1 Bug Fixes Applied (January 16, 2026)
1. **Fixed Save as Draft functionality** - Added proper error handling when draft isn't initialized
2. **Fixed data persistence** - Local draft data now takes priority over backend data when loading cases
3. **Fixed abnormal sections capture** - ABCDE abnormal status checkboxes now save properly
4. **Fixed procedures data structure** - Created ProcedureCategory type, properly handles generalNotes
5. **Applied draft loading fix to PediatricCaseSheetScreen** - Consistent behavior for both adult and pediatric workflows
6. **Fixed syntax error in CaseSheetScreen** - Corrected brace mismatch in loadCase function
7. **Fixed web preview** - Server now serves static web build correctly
8. **Fixed commit/save TypeError** - allergies, pastMedicalHistory, differentialDiagnoses, labsOrdered, and imaging fields now handle both string and array data types (prevents "split is not a function" error)
9. **Fixed CollapsibleSection icons** - Icons in collapsible sections (PAT, ABCDE) now display as Feather icons instead of text characters
10. **Fixed default drug frequency** - New medication entries in adult case sheet now default to "stat" frequency
11. **Fixed TriageScreen typing lag** - Text inputs now use ref-based pattern for smooth continuous typing without re-renders

### Supported Input Values
- Text fields accept "nil", "none", "n/a", "not applicable", or any freeform text
- These values are valid clinical documentation entries and save normally
- No input validation blocks these common medical notation shortcuts

## Overview

ErMate is a mobile-first Emergency Room Electronic Medical Records (EMR) application built with React Native and Expo. It provides emergency medicine physicians and residents with a streamlined workflow for patient triage, case management, physical examinations, investigations, treatment planning, and discharge documentation. The app supports voice dictation, AI-powered features, and follows a subscription-based model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54
- Uses Expo's managed workflow with new architecture enabled
- React 19.1.0 with React Compiler experimental feature
- TypeScript for type safety throughout

**Navigation Structure**:
- `RootStackNavigator`: Handles authentication flow and modal screens
- `MainTabNavigator`: 5-tab layout (Dashboard, Cases, New Patient FAB, Logs, Profile)
- Native stack navigation for screen transitions with gesture support

**State Management**:
- `AuthContext`: Manages user authentication, tokens, and session persistence via AsyncStorage
- `CaseContext`: Manages current case data during the triage-to-discharge workflow
- TanStack React Query for server state management and caching

**UI Components**:
- Themed components (`ThemedView`, `ThemedText`, `Button`, `Card`) with automatic dark/light mode support
- Medical-specific color scheme with triage priority colors (RED, ORANGE, YELLOW, GREEN, BLUE)
- `KeyboardAwareScrollViewCompat` for form-heavy screens
- Reanimated for smooth animations

**Clinical Workflow Screens** (sequential modal flow):
1. TriageScreen - Patient demographics, vitals, presenting complaint
2. CaseSheetScreen (adults 17+) - ATLS-based ABCDE assessment with 7 tabs (Patient, Primary, History, Exam, Treatment, Notes, Disposition)
3. PediatricCaseSheetScreen (≤16 years) - PALS-based assessment with PAT, modified ABCDE, pediatric SAMPLE history, HEENT exam
4. DischargeSummaryScreen - Final documentation and PDF/Word export

**Age-Based Routing**:
- Patients aged ≤16 years are classified as pediatric and routed to PediatricCaseSheetScreen
- Adults (17+ years) use CaseSheetScreen with ATLS protocol
- Age classification uses `isPediatric()` from `client/lib/pediatricVitals.ts`
- All navigation points (Dashboard, Cases, ViewCase, Triage) respect this routing

### Backend Architecture

**Server**: Express.js with TypeScript
- Runs on port 5000 (configurable)
- CORS configured for Replit domains
- Static file serving for web builds
- HTTP proxy middleware for development

**Current State**: The Express server is scaffolded with basic routing infrastructure. The application currently connects to an external backend at `https://er-emr-backend.onrender.com/api` for all API calls.

**API Client** (`client/lib/api.ts`):
- Token-based authentication via AsyncStorage
- Standard REST methods: `apiGet`, `apiPost`, `apiPatch`, `apiUpload`
- Centralized error handling

### Data Storage

**Database Schema** (Drizzle ORM with PostgreSQL):
- `users` table: Basic user authentication (id, username, password)
- `ai_feedback` table: AI diagnosis feedback for self-learning (suggestion_id, case_id, feedback_type, user_correction, suggestion_text, user_id, created_at)
- Schema defined in `shared/schema.ts` with Zod validation via drizzle-zod
- Database connection in `server/db.ts` using pg Pool

**Local Storage**:
- AsyncStorage for token and user data persistence
- Form data uses `useRef` pattern to prevent re-render lag during text input

### Voice Input System

The app includes two voice input approaches:

**VoiceRecorder Component** (`client/components/VoiceRecorder.tsx`):
- Uses `expo-audio` for audio recording (modern API)
- Clear record → stop → save workflow with visual feedback
- Pulsing animation during recording
- Sends audio to external backend `/ai/voice-to-text` for transcription
- AI-powered clinical data extraction via `/api/ai/extract-clinical` endpoint
- Auto-populates extracted data (HPI, allergies, medications, exam findings, diagnoses) into case sheet fields
- Proper resource cleanup after recording completes

**Legacy Voice Buttons** (field-level):
- Uses `expo-av` for audio recording (deprecated, migration pending)
- WebSocket streaming transcription
- Multi-language support (English, Hindi, Malayalam)

**AI Clinical Data Extraction** (`server/services/aiDiagnosis.ts`):
- `extractClinicalDataFromVoice()` function uses GPT-4o with temperature 0.2
- Extracts structured clinical data: chief complaint, HPI, past history, allergies, medications, symptoms, exam findings, diagnoses, treatment notes
- Respects patient context (age, sex, presenting complaint) for better accuracy
- Only extracts information explicitly stated in transcript, no assumptions

### AI Diagnosis System (Self-Learning)

**AI-Powered Diagnosis with References** (Perplexity-style):
- Generates differential diagnoses with confidence levels (high/moderate/low)
- Cites medical guidelines (ATLS, PALS, Surviving Sepsis, ACC/AHA, WikEM, Tintinalli's, Rosen's, etc.)
- Expandable citation cards showing source, title, year, excerpt, and link
- Red flag detection with severity levels and recommended actions
- Uses OpenAI via Replit AI Integrations (no API key needed, uses credits)

**Self-Learning Feedback System**:
- Thumbs up/down feedback on AI suggestions
- Tracks user acceptance, rejection, and corrections
- Stores feedback in `ai_feedback` database table (requires DATABASE_URL)
- Learning insights based on acceptance rate
- When user accepts diagnosis, it auto-populates the Primary Diagnosis field
- Returns 503 error when database unavailable - no ephemeral storage fallback

**API Endpoints** (server/routes.ts):
- `POST /api/ai/diagnose` - Get AI diagnosis suggestions with references
- `POST /api/ai/feedback` - Record user feedback on suggestions
- `GET /api/ai/stats` - Get feedback statistics and learning insights

**Components**:
- `AIDiagnosisPanel` - Purple-themed AI assistant panel in Treatment tab
- `server/services/aiDiagnosis.ts` - AI diagnosis service with medical knowledge base

### Document Export System

**Case Sheet & Discharge Summary Export**:
- Download button appears for completed/discharged cases on Dashboard
- Export options: PDF and Word (DOCX) formats
- Supports both Case Sheet (full clinical documentation) and Discharge Summary export
- Uses `pdfkit` for PDF generation and `docx` library for Word documents
- Platform-aware file handling: Web uses blob download, mobile uses expo-file-system + expo-sharing

**Export Endpoints** (server/routes.ts):
- `POST /api/export/casesheet-pdf` - Generate Case Sheet PDF
- `POST /api/export/casesheet-docx` - Generate Case Sheet Word document  
- `POST /api/export/discharge-pdf` - Generate Discharge Summary PDF
- `POST /api/export/discharge-docx` - Generate Discharge Summary Word document

### Device Linking (Web App Access)

**LinkDevicesScreen**:
- WhatsApp-style web linking feature accessible from Profile menu
- Generates temporary 6-character link codes for web access
- Shows linked devices with unlink option
- Secure: Only uses backend-generated codes, no client-side fallbacks
- Timer shows code expiration countdown

## External Dependencies

### External Backend API
- **URL**: `https://er-emr-backend.onrender.com/api`
- **WebSocket**: `wss://er-emr-backend.onrender.com`
- Handles: Authentication, case management, AI features, subscription checks
- All clinical data operations go through this external service

### Database
- PostgreSQL via Drizzle ORM
- Connection string expected in `DATABASE_URL` environment variable
- Migrations output to `./migrations` directory

### Key NPM Packages
- `expo-av`: Audio recording for voice input
- `expo-blur`, `expo-glass-effect`: UI effects
- `expo-haptics`: Tactile feedback
- `react-native-reanimated`: Animations
- `react-native-keyboard-controller`: Keyboard-aware forms
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation
- `@tanstack/react-query`: Server state management

### Build & Development
- Expo CLI for development (`expo:dev`)
- TSX for running TypeScript server
- ESBuild for production server bundling
- Babel with module-resolver for path aliases (`@/` → `./client`, `@shared/` → `./shared`)